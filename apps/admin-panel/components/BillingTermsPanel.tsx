import React, { useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../lib/apiFetch';

/**
 * The terms behind a service line, and a client's own version of them.
 *
 * The fee table above this one covers the two margins. Everything else that
 * decides what an invoice says lived nowhere: the placement fee as a
 * percentage of salary, the premium for Kongila supervising an outsourced
 * person, how many days a client has to pay, and the days of the month a
 * split payment falls due.
 *
 * Two layers. A service line's terms are the default for everybody. A
 * client's terms override them for that client only, and a blank field
 * means "use the default" rather than "zero", which is the distinction that
 * makes an override usable at all.
 *
 * Nothing here touches a contract already signed. The terms are copied onto
 * a contract when it is generated, so changing them affects what happens
 * next, never what was agreed.
 */

const LINE_LABELS: Record<string, string> = {
  placement: 'Direct hire (placement)',
  outsourcing: 'Outsourcing',
  managed_workforce: 'Managed team',
  project: 'Project'
};

interface Split { label?: string; percent: number; dayOfMonth: number; }
interface Schedule { recurring: boolean; splits: Split[]; }

const asPercent = (value: number | null | undefined): string =>
  value === null || value === undefined ? '' : String(Number(value) * 100);

/** The same rule the server keeps, so the error appears before the save. */
function scheduleProblem(schedule: Schedule | null): string | null {
  if (!schedule || schedule.splits.length === 0) return null;
  const days = new Set<number>();
  for (const split of schedule.splits) {
    if (!Number.isFinite(split.percent) || split.percent <= 0) return 'Every split needs a percentage above zero.';
    if (!Number.isInteger(split.dayOfMonth) || split.dayOfMonth < 1 || split.dayOfMonth > 31) {
      return 'Every split needs a day of the month between 1 and 31.';
    }
    if (days.has(split.dayOfMonth)) return `Two splits both fall due on day ${split.dayOfMonth}.`;
    days.add(split.dayOfMonth);
  }
  const total = schedule.splits.reduce((sum, split) => sum + Number(split.percent), 0);
  if (Math.abs(total - 100) > 0.01) {
    return `The splits total ${Math.round(total * 100) / 100}%, not 100%. The client would be invoiced the wrong amount.`;
  }
  return null;
}

export default function BillingTermsPanel({ organizations = [] }: { organizations?: any[] }) {
  const [lines, setLines] = useState<any[]>([]);
  const [overrides, setOverrides] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState<string[]>([]);
  const [saving, setSaving] = useState('');

  // Which row is open, as "serviceLine" or "organizationId|serviceLine".
  const [editing, setEditing] = useState('');
  const [form, setForm] = useState<any>(null);

  const load = async () => {
    setLoading(true);
    try {
      const response = await apiFetch('/api/billing/terms');
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body?.error || 'Billing terms could not be loaded.');
      setLines(body.lines || []);
      setOverrides(body.overrides || []);
      setNotice(body.warnings || []);
      setError('');
    } catch (cause: any) {
      setError(cause?.message || 'Billing terms could not be loaded.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const organizationName = useMemo(() => {
    const byId = new Map<string, string>();
    for (const organization of organizations || []) {
      byId.set(String(organization.id), organization.name || organization.id);
    }
    return (id: string) => byId.get(String(id)) || id;
  }, [organizations]);

  const openLine = (line: any) => {
    setEditing(line.serviceLine);
    setForm({
      serviceLine: line.serviceLine,
      placementFeePct: asPercent(line.placementFeePct),
      managementPremiumPct: asPercent(line.managementPremiumPct),
      paymentTermsDays: line.paymentTermsDays ?? '',
      schedule: line.paymentSchedule || { recurring: true, splits: [], serviceRecurring: line.serviceLine === 'outsourcing' || line.serviceLine === 'managed_workforce', billingDayOfMonth: 1 }
    });
  };

  const openOverride = (organizationId: string, serviceLine: string) => {
    const existing = overrides.find(entry =>
      String(entry.organizationId) === String(organizationId) && entry.serviceLine === serviceLine);
    setEditing(`${organizationId}|${serviceLine}`);
    setForm({
      organizationId,
      serviceLine,
      clientFeePct: asPercent(existing?.clientFeePct),
      talentCommissionPct: asPercent(existing?.talentCommissionPct),
      placementFeePct: asPercent(existing?.placementFeePct),
      managementPremiumPct: asPercent(existing?.managementPremiumPct),
      paymentTermsDays: existing?.paymentTermsDays ?? '',
      schedule: existing?.paymentSchedule || { recurring: true, splits: [], serviceRecurring: serviceLine === 'outsourcing' || serviceLine === 'managed_workforce', billingDayOfMonth: 1 },
      notes: existing?.notes || ''
    });
  };

  const setSplit = (index: number, patch: Partial<Split>) => {
    setForm((current: any) => {
      const splits = [...(current.schedule?.splits || [])];
      splits[index] = { ...splits[index], ...patch };
      return { ...current, schedule: { ...(current.schedule || {}), recurring: current.schedule?.recurring !== false, splits } };
    });
  };

  const addSplit = () => setForm((current: any) => {
    const splits = [...(current.schedule?.splits || [])];
    // Two halves is what people set up most of the time, so the first click
    // offers it rather than making them do the arithmetic.
    splits.push(splits.length === 0
      ? { label: 'First instalment', percent: 50, dayOfMonth: 1 }
      : { label: `Instalment ${splits.length + 1}`, percent: 50, dayOfMonth: 15 });
    return { ...current, schedule: { ...(current.schedule || {}), recurring: current.schedule?.recurring !== false, splits } };
  });

  const removeSplit = (index: number) => setForm((current: any) => {
    const splits = (current.schedule?.splits || []).filter((_: any, i: number) => i !== index);
    return { ...current, schedule: { ...(current.schedule || {}), recurring: current.schedule?.recurring !== false, splits } };
  });

  const save = async (clear = false) => {
    const problem = scheduleProblem(form?.schedule || null);
    if (problem && !clear) { setError(problem); return; }

    setSaving(editing);
    setError('');
    try {
      const payload: any = form.organizationId
        ? {
            organizationId: form.organizationId,
            serviceLine: form.serviceLine,
            clear,
            clientFeePct: form.clientFeePct === '' ? null : Number(form.clientFeePct),
            talentCommissionPct: form.talentCommissionPct === '' ? null : Number(form.talentCommissionPct),
            placementFeePct: form.placementFeePct === '' ? null : Number(form.placementFeePct),
            managementPremiumPct: form.managementPremiumPct === '' ? null : Number(form.managementPremiumPct),
            paymentTermsDays: form.paymentTermsDays === '' ? null : Number(form.paymentTermsDays),
            paymentSchedule: form.schedule,
            notes: form.notes
          }
        : {
            // No client fee or talent commission here: the fee table above
            // owns those, and it writes the fee audit log.
            serviceLine: form.serviceLine,
            placementFeePct: form.placementFeePct === '' ? null : Number(form.placementFeePct),
            managementPremiumPct: form.managementPremiumPct === '' ? null : Number(form.managementPremiumPct),
            paymentTermsDays: form.paymentTermsDays === '' ? null : Number(form.paymentTermsDays),
            paymentSchedule: form.schedule
          };

      const response = await apiFetch('/api/billing/terms', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body?.error || 'That did not save.');

      setEditing('');
      setForm(null);
      setNotice(body.warnings || []);
      await load();
    } catch (cause: any) {
      setError(cause?.message || 'That did not save.');
    } finally {
      setSaving('');
    }
  };

  const cell: React.CSSProperties = { padding: '12px 8px', fontSize: 14 };
  const headCell: React.CSSProperties = { padding: '12px 8px', fontSize: 13, color: '#64748B', fontWeight: 600 };
  const input: React.CSSProperties = { width: 86, padding: '5px 7px', border: '1px solid #E2E8F0', borderRadius: 6, fontSize: 13 };

  const editor = (showMargins: boolean) => (
    <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 10, padding: 16, marginTop: 10 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', gap: 14 }}>
        {showMargins && (
          <>
            <label style={{ fontSize: 12, fontWeight: 700, color: '#475569' }}>
              Client fee %
              <input style={{ ...input, width: '100%', marginTop: 4 }} value={form.clientFeePct}
                placeholder="use the standard"
                onChange={e => setForm({ ...form, clientFeePct: e.target.value })} />
            </label>
            <label style={{ fontSize: 12, fontWeight: 700, color: '#475569' }}>
              Talent commission %
              <input style={{ ...input, width: '100%', marginTop: 4 }} value={form.talentCommissionPct}
                placeholder="use the standard"
                onChange={e => setForm({ ...form, talentCommissionPct: e.target.value })} />
            </label>
          </>
        )}
        <label style={{ fontSize: 12, fontWeight: 700, color: '#475569' }}>
          Placement fee % of salary
          <input style={{ ...input, width: '100%', marginTop: 4 }} value={form.placementFeePct}
            placeholder={showMargins ? 'use the standard' : 'e.g. 15'}
            onChange={e => setForm({ ...form, placementFeePct: e.target.value })} />
        </label>
        <label style={{ fontSize: 12, fontWeight: 700, color: '#475569' }}>
          Supervision premium %
          <input style={{ ...input, width: '100%', marginTop: 4 }} value={form.managementPremiumPct}
            placeholder={showMargins ? 'use the standard' : 'when Kongila manages'}
            onChange={e => setForm({ ...form, managementPremiumPct: e.target.value })} />
        </label>
        <label style={{ fontSize: 12, fontWeight: 700, color: '#475569' }}>
          Payment terms, days
          <input style={{ ...input, width: '100%', marginTop: 4 }} value={form.paymentTermsDays}
            placeholder="14" onChange={e => setForm({ ...form, paymentTermsDays: e.target.value })} />
        </label>
      </div>

      {/* The split schedule. */}
      <div style={{ marginTop: 18, paddingTop: 14, borderTop: '1px dashed #CBD5E1' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', gap: 14, marginBottom: 14 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#334155' }}>
            <input type="checkbox" checked={form.schedule?.serviceRecurring !== false}
              onChange={e => setForm({ ...form, schedule: { ...(form.schedule || { recurring: true, splits: [] }), serviceRecurring: e.target.checked } })} />
            Invoice this service every month
          </label>
          <label style={{ fontSize: 12, fontWeight: 700, color: '#475569' }}>
            Monthly billing day (1–31)
            <input style={{ ...input, width: '100%', marginTop: 4 }} type="number" min={1} max={31}
              value={form.schedule?.billingDayOfMonth ?? 1}
              onChange={e => setForm({ ...form, schedule: { ...(form.schedule || { recurring: true, splits: [] }), billingDayOfMonth: Number(e.target.value) } })} />
          </label>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div>
            <strong style={{ fontSize: 13, color: '#0F172A' }}>When the client pays</strong>
            <div style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>
              Leave empty to charge the whole invoice on its due date. Add splits to bill, say, 50%
              on the 1st and 50% on the 15th. One charge, two due dates.
            </div>
          </div>
          <button type="button" onClick={addSplit} className="btn-secondary" style={{ padding: '6px 12px', fontSize: 12 }}>
            Add a split
          </button>
        </div>

        {(form.schedule?.splits || []).map((split: Split, index: number) => (
          <div key={index} style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 10, flexWrap: 'wrap' }}>
            <input style={{ ...input, width: 170 }} value={split.label || ''} placeholder="Label"
              onChange={e => setSplit(index, { label: e.target.value })} />
            <input style={input} type="number" value={split.percent}
              onChange={e => setSplit(index, { percent: Number(e.target.value) })} />
            <span style={{ fontSize: 12, color: '#64748B' }}>% on day</span>
            <input style={{ ...input, width: 64 }} type="number" min={1} max={31} value={split.dayOfMonth}
              onChange={e => setSplit(index, { dayOfMonth: Number(e.target.value) })} />
            <button type="button" onClick={() => removeSplit(index)}
              style={{ border: 'none', background: 'none', color: '#B91C1C', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
              Remove
            </button>
          </div>
        ))}

        {form.schedule?.splits?.length > 0 && (
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, fontSize: 13, color: '#334155' }}>
            <input type="checkbox" checked={form.schedule.recurring !== false}
              onChange={e => setForm({ ...form, schedule: { ...form.schedule, recurring: e.target.checked } })} />
            Repeat these dates every month
          </label>
        )}

        {scheduleProblem(form.schedule || null) && (
          <div style={{ marginTop: 10, color: '#B45309', fontSize: 12.5 }}>
            {scheduleProblem(form.schedule || null)}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: 10, marginTop: 18, flexWrap: 'wrap' }}>
        <button type="button" onClick={() => save(false)} disabled={Boolean(saving)}
          style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: '#2563EB', color: '#fff', fontWeight: 700, fontSize: 13, cursor: saving ? 'wait' : 'pointer' }}>
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button type="button" onClick={() => { setEditing(''); setForm(null); setError(''); }} className="btn-secondary" style={{ padding: '8px 16px', fontSize: 13 }}>
          Cancel
        </button>
        {form.organizationId && (
          <button type="button" onClick={() => save(true)} className="btn-secondary"
            style={{ padding: '8px 16px', fontSize: 13, color: '#B91C1C' }}>
            Use the standard terms instead
          </button>
        )}
      </div>
    </div>
  );

  return (
    <div style={{ background: '#FFF', border: '1px solid #E2E8F0', borderRadius: 12, padding: 24 }}>
      <h3 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 8px 0', color: '#0F172A' }}>Terms and payment schedules</h3>
      <p style={{ fontSize: 13, color: '#64748B', margin: '0 0 16px 0' }}>
        What a placement costs as a share of salary, what Kongila charges to supervise, how long a
        client has to pay, and the days a split payment falls due. These are copied onto a contract
        when it is generated, so a change here affects the next contract, never one already signed.
      </p>

      {error && (
        <div role="alert" style={{ background: '#FEE2E2', border: '1px solid #FCA5A5', color: '#991B1B', padding: 12, borderRadius: 8, marginBottom: 14, fontSize: 13 }}>{error}</div>
      )}
      {notice.length > 0 && (
        <div role="status" style={{ background: '#FFFBEB', border: '1px solid #FDE68A', color: '#92400E', padding: 12, borderRadius: 8, marginBottom: 14, fontSize: 13, lineHeight: 1.6 }}>
          {notice.map((line, index) => <div key={index}>{line}</div>)}
        </div>
      )}

      {loading ? (
        <p style={{ fontSize: 13, color: '#64748B' }}>Loading…</p>
      ) : (
        <>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #E2E8F0' }}>
                <th style={headCell}>Service line</th>
                <th style={headCell}>Placement fee</th>
                <th style={headCell}>Supervision premium</th>
                <th style={headCell}>Payment terms</th>
                <th style={headCell}>Split</th>
                <th style={headCell} />
              </tr>
            </thead>
            <tbody>
              {lines.map(line => {
                const splits = line.paymentSchedule?.splits || [];
                return (
                  <React.Fragment key={line.serviceLine}>
                    <tr style={{ borderBottom: '1px solid #F1F5F9' }}>
                      <td style={{ ...cell, fontWeight: 500 }}>{LINE_LABELS[line.serviceLine] || line.serviceLine}</td>
                      <td style={cell}>
                        {line.serviceLine !== 'placement'
                          ? <span style={{ color: '#94A3B8' }}>n/a</span>
                          : line.placementFeePct === null
                            ? <span style={{ color: '#B45309' }}>not set</span>
                            : `${(line.placementFeePct * 100).toFixed(2).replace(/\.00$/, '')}% of salary`}
                      </td>
                      <td style={cell}>
                        {line.managementPremiumPct === null
                          ? <span style={{ color: '#94A3B8' }}>none</span>
                          : `${(line.managementPremiumPct * 100).toFixed(2).replace(/\.00$/, '')}%`}
                      </td>
                      <td style={cell}>{line.paymentTermsDays ?? 14} days</td>
                      <td style={cell}>
                        {splits.length === 0
                          ? <span style={{ color: '#94A3B8' }}>one payment</span>
                          : splits.map((split: Split) => `${split.percent}% on the ${split.dayOfMonth}`).join(', ')}
                      </td>
                      <td style={cell}>
                        <button onClick={() => openLine(line)} style={{ color: '#2563EB', border: 'none', background: 'none', cursor: 'pointer', fontWeight: 600 }}>Edit</button>
                      </td>
                    </tr>
                    {editing === line.serviceLine && form && (
                      <tr><td colSpan={6} style={{ padding: 0 }}>{editor(false)}</td></tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>

          {/* ── Per client ──────────────────────────────────────────────── */}
          <div style={{ marginTop: 28, paddingTop: 20, borderTop: '1px solid #E2E8F0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <div>
                <strong style={{ fontSize: 15, color: '#0F172A' }}>Clients on their own terms</strong>
                <div style={{ fontSize: 12.5, color: '#64748B', marginTop: 3 }}>
                  A blank field here means that client uses the standard figure above.
                </div>
              </div>
              {organizations.length > 0 && (
                <select
                  value=""
                  onChange={e => {
                    const [organizationId, serviceLine] = e.target.value.split('|');
                    if (organizationId) openOverride(organizationId, serviceLine);
                  }}
                  style={{ padding: '7px 10px', border: '1px solid #E2E8F0', borderRadius: 8, fontSize: 13 }}
                >
                  <option value="">Set terms for a client…</option>
                  {organizations.map((organization: any) =>
                    lines.map(line => (
                      <option key={`${organization.id}|${line.serviceLine}`} value={`${organization.id}|${line.serviceLine}`}>
                        {organization.name} — {LINE_LABELS[line.serviceLine] || line.serviceLine}
                      </option>
                    ))
                  )}
                </select>
              )}
            </div>

            {overrides.length === 0 ? (
              <p style={{ fontSize: 13, color: '#64748B', marginTop: 14 }}>
                Every client is on the standard terms.
              </p>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', marginTop: 14 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #E2E8F0' }}>
                    <th style={headCell}>Client</th>
                    <th style={headCell}>Service line</th>
                    <th style={headCell}>What differs</th>
                    <th style={headCell} />
                  </tr>
                </thead>
                <tbody>
                  {overrides.map(entry => {
                    const differences: string[] = [];
                    if (entry.clientFeePct !== null) differences.push(`client fee ${(entry.clientFeePct * 100).toFixed(2).replace(/\.00$/, '')}%`);
                    if (entry.talentCommissionPct !== null) differences.push(`commission ${(entry.talentCommissionPct * 100).toFixed(2).replace(/\.00$/, '')}%`);
                    if (entry.placementFeePct !== null) differences.push(`placement ${(entry.placementFeePct * 100).toFixed(2).replace(/\.00$/, '')}%`);
                    if (entry.managementPremiumPct !== null) differences.push(`supervision ${(entry.managementPremiumPct * 100).toFixed(2).replace(/\.00$/, '')}%`);
                    if (entry.paymentTermsDays !== null) differences.push(`${entry.paymentTermsDays} day terms`);
                    if (entry.paymentSchedule?.splits?.length) {
                      differences.push(entry.paymentSchedule.splits
                        .map((split: Split) => `${split.percent}% on the ${split.dayOfMonth}`).join(' and '));
                    }
                    const key = `${entry.organizationId}|${entry.serviceLine}`;
                    return (
                      <React.Fragment key={key}>
                        <tr style={{ borderBottom: '1px solid #F1F5F9' }}>
                          <td style={{ ...cell, fontWeight: 500 }}>{organizationName(entry.organizationId)}</td>
                          <td style={cell}>{LINE_LABELS[entry.serviceLine] || entry.serviceLine}</td>
                          <td style={{ ...cell, color: '#475569' }}>
                            {differences.length ? differences.join(', ') : <span style={{ color: '#94A3B8' }}>nothing yet</span>}
                          </td>
                          <td style={cell}>
                            <button onClick={() => openOverride(entry.organizationId, entry.serviceLine)}
                              style={{ color: '#2563EB', border: 'none', background: 'none', cursor: 'pointer', fontWeight: 600 }}>Edit</button>
                          </td>
                        </tr>
                        {editing === key && form && (
                          <tr><td colSpan={4} style={{ padding: 0 }}>{editor(true)}</td></tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            )}

            {/* A new override opened from the picker, before it has a row. */}
            {form?.organizationId && !overrides.some(entry =>
              `${entry.organizationId}|${entry.serviceLine}` === editing) && (
              <div style={{ marginTop: 14 }}>
                <strong style={{ fontSize: 13.5, color: '#0F172A' }}>
                  {organizationName(form.organizationId)} — {LINE_LABELS[form.serviceLine] || form.serviceLine}
                </strong>
                {editor(true)}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
