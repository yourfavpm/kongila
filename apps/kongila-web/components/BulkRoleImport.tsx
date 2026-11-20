import React, { useMemo, useRef, useState } from 'react';
import { apiFetch } from '../lib/apiFetch';
import { parseRoleCsv, ROLE_CSV_TEMPLATE, TIMEZONE_OPTIONS } from '@kongila/utils';
import type { ParsedRole } from '@kongila/utils';
import { MAX_ROLES_PER_REQUEST } from '@kongila/shared-types';

/**
 * Filing a spreadsheet of roles instead of the wizard, eight times over.
 *
 * A client hiring one person should use the wizard: it asks better questions
 * than a spreadsheet column can. A client hiring eight has already written
 * the spreadsheet, and re-typing it into a five-step form is the point at
 * which they email it to someone instead.
 *
 * Three things this screen insists on, because they are what makes bulk
 * filing go wrong quietly:
 *
 *   - Nothing is filed until the client has seen the table. A CSV that was
 *     read as six roles when they meant eight is obvious in a preview and
 *     invisible in a success message.
 *   - Rows that could not be read are shown, not dropped. Finding out in
 *     March that two roles never arrived is the worst version of this.
 *   - The shared context is asked once, here, and applies to every role —
 *     the same bargain the wizard makes, for the same reason.
 *
 * Each role becomes its own request on the server, exactly as the wizard's
 * roles[] does, so matching, interviews, offers and contracts stay per role.
 */

interface BulkRoleImportProps {
  currentUser: any;
  clientName?: string;
  onComplete?: (created: any[]) => void | Promise<void>;
  onCancel?: () => void;
}

/** The server files at most this many roles in one call. */
const BATCH = MAX_ROLES_PER_REQUEST;

const COMMITMENTS = ['Full-Time', 'Part-Time', 'Contract', 'Flexible'];
const DURATIONS = ['Ongoing', '3 months', '6 months', '12 months', 'Flexible'];
const URGENCIES = ['Standard', 'Urgent', 'ASAP'];

export default function BulkRoleImport({ currentUser, clientName, onComplete, onCancel }: BulkRoleImportProps) {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [fileName, setFileName] = useState('');
  const [raw, setRaw] = useState('');
  const [readError, setReadError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [progress, setProgress] = useState('');
  const [warnings, setWarnings] = useState<string[]>([]);

  // Shared context, answered once and inherited by every role in the file.
  const [shared, setShared] = useState({
    commitmentLevel: 'Full-Time',
    duration: 'Ongoing',
    startDate: '',
    timezone: TIMEZONE_OPTIONS?.[0]?.value || 'EST',
    urgency: 'Standard',
    notes: ''
  });

  const parsed = useMemo(() => (raw ? parseRoleCsv(raw) : null), [raw]);
  const roles: ParsedRole[] = parsed?.roles || [];
  const problems = parsed?.problems || [];

  const readFile = (file: File) => {
    setReadError('');
    setSubmitError('');
    setWarnings([]);
    if (file.size > 1024 * 1024) {
      setReadError('That file is larger than 1MB. A list of roles should be far smaller — check you picked the right file.');
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => setReadError('That file could not be read. Try saving it again as CSV.');
    reader.onload = () => {
      setFileName(file.name);
      setRaw(String(reader.result || ''));
    };
    reader.readAsText(file);
  };

  const downloadTemplate = () => {
    const blob = new Blob([ROLE_CSV_TEMPLATE], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'kongila-roles-template.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const submit = async () => {
    if (!roles.length || submitting) return;
    setSubmitting(true);
    setSubmitError('');
    setWarnings([]);
    setProgress('');

    const created: any[] = [];
    const collectedWarnings: string[] = [];

    try {
      // Batched, because the server caps the roles one request may carry and
      // a client with forty roles should not be told to split the file up
      // themselves.
      for (let start = 0; start < roles.length; start += BATCH) {
        const slice = roles.slice(start, start + BATCH);
        setProgress(`Filing roles ${start + 1}–${start + slice.length} of ${roles.length}…`);

        const payload: any = {
          clientId: currentUser?.id,
          clientName: clientName || currentUser?.name || 'Client',
          serviceType: 'Hire Talent',
          status: 'New Request',
          createdAt: new Date().toISOString(),
          source: 'bulk-csv',
          roles: slice.map((role, index) => ({
            id: `role-${start + index + 1}`,
            title: role.title,
            count: role.count,
            seniorityLevel: role.seniorityLevel,
            requiredSkills: role.requiredSkills,
            description: role.description
          })),
          roleDescription: '',
          requiredSkills: [],
          commitmentLevel: shared.commitmentLevel,
          duration: shared.duration,
          startDate: shared.startDate || new Date().toISOString(),
          timezone: shared.timezone,
          preferredTimezones: [shared.timezone],
          urgency: shared.urgency,
          priority: shared.urgency === 'Standard' ? 'Medium' : 'High',
          additionalNotes: shared.notes,
          // Per-role money, where the file gave it, is carried on the role
          // itself; this is the band the group was filed under.
          budgetMinUsd: slice.find(role => role.budgetMinUsd)?.budgetMinUsd,
          budgetMaxUsd: slice.find(role => role.budgetMaxUsd)?.budgetMaxUsd,
          budget: slice.find(role => role.budgetMinUsd)?.budgetMinUsd || 0
        };

        const response = await apiFetch('/api/requests', {
          method: 'POST',
          body: JSON.stringify({ request: payload })
        });
        const body = await response.json().catch(() => ({}));
        if (!response.ok || !body?.request) {
          throw new Error(body?.error || `Roles ${start + 1}–${start + slice.length} could not be filed.`);
        }
        const batch = Array.isArray(body.requests) ? body.requests : [body.request];
        created.push(...batch);

        // Routes answer with warnings when a side effect failed — usually an
        // email. The request is saved either way, and a client who is never
        // told is a client who thinks nobody was notified.
        if (Array.isArray(body.warnings)) collectedWarnings.push(...body.warnings);
      }

      setWarnings(collectedWarnings);
      setProgress(`${created.length} request${created.length === 1 ? '' : 's'} filed.`);
      if (onComplete) await onComplete(created);
    } catch (error: any) {
      setSubmitError(
        (error?.message || 'Your roles could not be filed.')
        + (created.length ? ` ${created.length} were filed before this happened — check My requests before retrying so you do not file them twice.` : '')
      );
    } finally {
      setSubmitting(false);
    }
  };

  const label: React.CSSProperties = { fontSize: '12px', fontWeight: 700, color: 'var(--text-muted, #64748B)', marginBottom: '6px', display: 'block' };
  const input: React.CSSProperties = { width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1px solid var(--border-glass, #E2E8F0)', fontSize: '14px', boxSizing: 'border-box' };
  const cell: React.CSSProperties = { padding: '10px 12px', fontSize: '13px', borderBottom: '1px solid var(--border-glass, #EEF2F7)', textAlign: 'left', verticalAlign: 'top' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '22px', padding: '6px 2px' }}>
      <div>
        <div style={{ fontSize: '12px', fontWeight: 700, letterSpacing: '.06em', color: 'var(--kongila-blue, #2563EB)' }}>
          BULK IMPORT
        </div>
        <h2 style={{ margin: '6px 0 6px', fontSize: '22px' }}>Upload your roles as a spreadsheet</h2>
        <p style={{ margin: 0, color: 'var(--text-secondary, #526174)', fontSize: '14px', lineHeight: 1.6 }}>
          One row per role. We read the file, show you what we understood, and file each role as its own
          request once you confirm. The details below are asked once and apply to every role.
        </p>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center' }}>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          style={{ background: 'var(--kongila-blue, #2563EB)', color: '#fff', border: 'none', borderRadius: '10px', padding: '11px 18px', fontWeight: 700, fontSize: '13px', cursor: 'pointer' }}
        >
          {fileName ? 'Choose a different file' : 'Choose a CSV file'}
        </button>
        <button
          type="button"
          onClick={downloadTemplate}
          style={{ background: 'transparent', border: '1px solid var(--border-glass, #CBD5E1)', borderRadius: '10px', padding: '10px 16px', fontWeight: 700, fontSize: '13px', color: 'var(--kongila-blue, #2563EB)', cursor: 'pointer' }}
        >
          Download the template
        </button>
        {fileName && <span style={{ fontSize: '13px', color: 'var(--text-secondary, #526174)' }}>{fileName}</span>}
        <input
          ref={fileRef}
          type="file"
          accept=".csv,text/csv,text/plain"
          style={{ display: 'none' }}
          onChange={e => {
            const file = e.target.files?.[0];
            if (file) readFile(file);
            e.target.value = '';
          }}
        />
      </div>

      {readError && (
        <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#B91C1C', borderRadius: '10px', padding: '12px 14px', fontSize: '13px' }}>
          {readError}
        </div>
      )}

      {parsed && (
        <>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '10px', gap: '12px', flexWrap: 'wrap' }}>
              <strong style={{ fontSize: '15px' }}>
                {roles.length} role{roles.length === 1 ? '' : 's'} read
                {roles.length > 0 && ` · ${roles.reduce((total, role) => total + role.count, 0)} people`}
              </strong>
              {parsed.headers.length > 0 && (
                <span style={{ fontSize: '12px', color: 'var(--text-muted, #64748B)' }}>
                  Columns found: {parsed.headers.join(', ')}
                </span>
              )}
            </div>

            {roles.length > 0 && (
              <div style={{ border: '1px solid var(--border-glass, #E2E8F0)', borderRadius: '12px', overflow: 'auto', maxHeight: '340px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '680px' }}>
                  <thead>
                    <tr style={{ background: 'var(--bg-secondary, #F8FAFC)' }}>
                      <th style={{ ...cell, fontWeight: 700 }}>Role</th>
                      <th style={{ ...cell, fontWeight: 700 }}>People</th>
                      <th style={{ ...cell, fontWeight: 700 }}>Seniority</th>
                      <th style={{ ...cell, fontWeight: 700 }}>Skills</th>
                      <th style={{ ...cell, fontWeight: 700 }}>What they will do</th>
                    </tr>
                  </thead>
                  <tbody>
                    {roles.map(role => (
                      <tr key={`${role.line}-${role.title}`}>
                        <td style={cell}><strong>{role.title}</strong></td>
                        <td style={cell}>{role.count}</td>
                        <td style={cell}>{role.seniorityLevel || <span style={{ color: '#94A3B8' }}>—</span>}</td>
                        <td style={cell}>
                          {role.requiredSkills.length
                            ? role.requiredSkills.join(', ')
                            : <span style={{ color: '#B45309' }}>None listed — matching will be broad</span>}
                        </td>
                        <td style={{ ...cell, maxWidth: '280px' }}>
                          {role.description
                            ? role.description
                            : <span style={{ color: '#B45309' }}>Empty — we will ask you for this</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {problems.length > 0 && (
            <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: '12px', padding: '14px 16px' }}>
              <strong style={{ fontSize: '13px', color: '#92400E' }}>
                {problems.length} row{problems.length === 1 ? '' : 's'} we could not use
              </strong>
              <ul style={{ margin: '8px 0 0', paddingLeft: '18px', color: '#92400E', fontSize: '13px', lineHeight: 1.6 }}>
                {problems.map((problem, index) => (
                  <li key={index}>{problem.line > 0 ? `Row ${problem.line}: ` : ''}{problem.message}</li>
                ))}
              </ul>
              <p style={{ margin: '10px 0 0', fontSize: '12px', color: '#92400E' }}>
                Fix them in your file and upload it again, or file those roles one at a time afterwards.
              </p>
            </div>
          )}
        </>
      )}

      {roles.length > 0 && (
        <div style={{ borderTop: '1px solid var(--border-glass, #E2E8F0)', paddingTop: '18px' }}>
          <h3 style={{ margin: '0 0 4px', fontSize: '16px' }}>Applies to every role in this file</h3>
          <p style={{ margin: '0 0 14px', fontSize: '13px', color: 'var(--text-secondary, #526174)' }}>
            You can change any of this per role afterwards, from My requests.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '14px' }}>
            <div>
              <label style={label}>Commitment</label>
              <select style={input} value={shared.commitmentLevel} onChange={e => setShared({ ...shared, commitmentLevel: e.target.value })}>
                {COMMITMENTS.map(option => <option key={option} value={option}>{option}</option>)}
              </select>
            </div>
            <div>
              <label style={label}>Duration</label>
              <select style={input} value={shared.duration} onChange={e => setShared({ ...shared, duration: e.target.value })}>
                {DURATIONS.map(option => <option key={option} value={option}>{option}</option>)}
              </select>
            </div>
            <div>
              <label style={label}>Ideal start date</label>
              <input type="date" style={input} value={shared.startDate} onChange={e => setShared({ ...shared, startDate: e.target.value })} />
            </div>
            <div>
              <label style={label}>Working time zone</label>
              <select style={input} value={shared.timezone} onChange={e => setShared({ ...shared, timezone: e.target.value })}>
                {(TIMEZONE_OPTIONS || []).map(zone => (
                  <option key={zone.value} value={zone.value}>{zone.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={label}>Urgency</label>
              <select style={input} value={shared.urgency} onChange={e => setShared({ ...shared, urgency: e.target.value })}>
                {URGENCIES.map(option => <option key={option} value={option}>{option}</option>)}
              </select>
            </div>
          </div>

          <div style={{ marginTop: '14px' }}>
            <label style={label}>Anything else your team should know</label>
            <textarea
              style={{ ...input, minHeight: '76px' }}
              placeholder="Context that applies across all of these roles."
              value={shared.notes}
              onChange={e => setShared({ ...shared, notes: e.target.value })}
            />
          </div>
        </div>
      )}

      {submitError && (
        <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#B91C1C', borderRadius: '10px', padding: '12px 14px', fontSize: '13px' }}>
          {submitError}
        </div>
      )}

      {warnings.length > 0 && (
        <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', color: '#92400E', borderRadius: '10px', padding: '12px 14px', fontSize: '13px' }}>
          <strong>Filed, but:</strong>
          <ul style={{ margin: '6px 0 0', paddingLeft: '18px' }}>
            {warnings.map((warning, index) => <li key={index}>{warning}</li>)}
          </ul>
        </div>
      )}

      <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
        <button
          type="button"
          disabled={!roles.length || submitting}
          onClick={submit}
          style={{
            background: 'var(--kongila-blue, #2563EB)', color: '#fff', border: 'none',
            borderRadius: '10px', padding: '12px 22px', fontWeight: 700, fontSize: '14px',
            cursor: !roles.length || submitting ? 'not-allowed' : 'pointer',
            opacity: !roles.length || submitting ? 0.5 : 1
          }}
        >
          {submitting
            ? 'Filing…'
            : roles.length
              ? `File ${roles.length} request${roles.length === 1 ? '' : 's'}`
              : 'File requests'}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            style={{ background: 'transparent', border: '1px solid var(--border-glass, #CBD5E1)', borderRadius: '10px', padding: '11px 18px', fontWeight: 700, fontSize: '13px', cursor: 'pointer' }}
          >
            Cancel
          </button>
        )}
        {progress && <span style={{ fontSize: '13px', color: 'var(--text-secondary, #526174)' }}>{progress}</span>}
      </div>
    </div>
  );
}
