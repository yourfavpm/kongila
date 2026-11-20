import React, { useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../lib/apiFetch';
import { formatCurrency } from '@kongila/utils';

/**
 * Active work, as its own module.
 *
 * This was a third tab inside Contracts, which put two unrelated jobs behind
 * one door. Contracts is paperwork: drafting, wording, signatures, the
 * invoice that goes with it. An engagement is the work itself: who is
 * actually working, for whom, under whose supervision, and what is left to
 * deliver. An account manager opening this does not want a contract queue;
 * they want their people.
 *
 * So: its own screen, with a filter that defaults to the engagements the
 * person opening it is responsible for, because that is almost always the
 * question being asked.
 */

const LINE_LABELS: Record<string, string> = {
  placement: 'Direct hire',
  outsourcing: 'Outsourcing',
  managed_workforce: 'Managed team',
  project: 'Project'
};

const STATUS_TONE: Record<string, { bg: string; fg: string }> = {
  active: { bg: '#DCFCE7', fg: '#15803D' },
  pending_start: { bg: '#DBEAFE', fg: '#1D4ED8' },
  paused: { bg: '#FEF3C7', fg: '#92400E' },
  ended: { bg: '#F1F5F9', fg: '#475569' }
};

export default function EngagementsManager({
  currentAdminId,
  permissions = []
}: {
  currentAdminId?: string;
  permissions?: string[];
}) {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState('');
  const [scope, setScope] = useState<'mine' | 'all'>('mine');
  const [lineFilter, setLineFilter] = useState('all');

  const load = async () => {
    setLoading(true);
    try {
      const response = await apiFetch('/api/engagements');
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body?.error || 'Engagements could not be loaded.');
      setRows(body.engagements || []);
      setError('');
    } catch (cause: any) {
      setError(cause?.message || 'Engagements could not be loaded.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  /** The ones this operator is responsible for, either side of the engagement. */
  const isMine = (row: any) =>
    String(row.account_manager_id || row.accountManager?.id || '') === String(currentAdminId || '')
    || String(row.supervisor_id || row.supervisor?.id || '') === String(currentAdminId || '');

  const mineCount = useMemo(() => rows.filter(isMine).length, [rows, currentAdminId]);

  const visible = rows
    .filter(row => (scope === 'mine' && mineCount > 0 ? isMine(row) : true))
    .filter(row => (lineFilter === 'all' ? true : row.service_line === lineFilter));

  const updateMilestone = async (recordId: string, action: string) => {
    setBusy(recordId);
    setNotice('');
    try {
      const response = await apiFetch('/api/engagements/milestones', {
        method: 'POST',
        body: JSON.stringify({
          milestoneId: action === 'complete_project' ? undefined : recordId,
          projectId: action === 'complete_project' ? recordId : undefined,
          action
        })
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body?.error || 'That did not work.');
      setNotice(
        action === 'complete' ? 'Milestone marked delivered. It can be invoiced now.'
        : action === 'invoice' ? 'Milestone invoice drafted.'
        : 'Project handed over and its engagements ended.'
      );
      await load();
    } catch (cause: any) {
      setError(cause?.message || 'That did not work.');
    } finally {
      setBusy('');
    }
  };

  const chip = (status: string) => {
    const tone = STATUS_TONE[String(status || '').toLowerCase()] || STATUS_TONE.ended;
    return (
      <span style={{ padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 800, background: tone.bg, color: tone.fg }}>
        {String(status || '').replace(/_/g, ' ')}
      </span>
    );
  };

  return (
    <div style={{ display: 'grid', gap: 18 }}>
      <div>
        <h2 style={{ margin: 0, color: '#14213D', fontSize: 22, fontWeight: 800 }}>Active work</h2>
        <p style={{ color: '#64748B', margin: '6px 0 0', fontSize: 13.5 }}>
          Everybody currently working, and what is left to deliver. An engagement starts when an
          operator activates a signed contract, and billing and payroll follow it from there.
        </p>
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        {mineCount > 0 && (
          <div style={{ display: 'flex', gap: 4, background: '#F1F5F9', borderRadius: 999, padding: 3 }}>
            {([['mine', `Mine (${mineCount})`], ['all', `Everyone (${rows.length})`]] as const).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setScope(key as any)}
                style={{
                  padding: '6px 14px', borderRadius: 999, border: 'none', fontSize: 12.5, fontWeight: 700,
                  cursor: 'pointer',
                  background: scope === key ? '#FFF' : 'transparent',
                  color: scope === key ? '#14213D' : '#64748B'
                }}
              >
                {label}
              </button>
            ))}
          </div>
        )}

        <select
          value={lineFilter}
          onChange={e => setLineFilter(e.target.value)}
          style={{ padding: '7px 11px', border: '1px solid #E2E8F0', borderRadius: 8, fontSize: 12.5 }}
        >
          <option value="all">Every service line</option>
          {Object.entries(LINE_LABELS).map(([key, label]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>

        <button onClick={load} className="btn-secondary" style={{ padding: '7px 14px', fontSize: 12.5 }}>Refresh</button>
      </div>

      {error && (
        <p role="alert" style={{ color: '#B91C1C', fontSize: 13 }}>
          {error} <button className="btn-secondary" onClick={load} style={{ marginLeft: 8, fontSize: 12 }}>Retry</button>
        </p>
      )}
      {notice && (
        <p role="status" style={{ color: '#166534', fontSize: 13, background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 8, padding: '10px 12px' }}>{notice}</p>
      )}

      {loading ? (
        <p style={{ fontSize: 13, color: '#64748B' }}>Loading…</p>
      ) : visible.length === 0 ? (
        <div className="table-container" style={{ padding: 28, color: '#64748B', fontSize: 13.5, lineHeight: 1.6 }}>
          {rows.length === 0
            ? 'Nobody is working yet. An engagement appears here once a signed contract has been activated in Contracts.'
            : scope === 'mine'
              ? 'None of the active engagements are assigned to you. Switch to Everyone to see the rest.'
              : 'Nothing matches that filter.'}
        </div>
      ) : visible.map((row: any) => (
        <article key={row.id} className="table-container" style={{ padding: 18, display: 'grid', gap: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap' }}>
            <div>
              <strong style={{ color: '#14213D', fontSize: 15 }}>{row.talent?.full_name || row.role}</strong>
              <div style={{ color: '#64748B', fontSize: 13, marginTop: 2 }}>
                {row.contracts?.role_title || row.role}
                {' · '}{LINE_LABELS[row.service_line] || String(row.service_line || '').replace(/_/g, ' ')}
                {row.client?.name ? ` · ${row.client.name}` : ''}
              </div>
            </div>
            {chip(row.status)}
          </div>

          <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', fontSize: 12.5, color: '#475569' }}>
            <span>Account manager: {row.accountManager?.name || 'Unassigned'}</span>
            <span>Supervisor: {row.supervisor?.name || 'Client directs the work'}</span>
            <span>Started: {row.start_date || 'Not set'}</span>
            <span>Managed by: {String(row.management_mode || '').replace(/_/g, ' ') || 'Not set'}</span>
          </div>

          {row.engagement_groups && (
            <div style={{ background: '#F5F8FC', padding: 12, borderRadius: 8, fontSize: 13 }}>
              Managed team: <strong>{row.engagement_groups.name}</strong>
              {' · '}Coverage {row.engagement_groups.coverage_type || 'not set'}
            </div>
          )}

          {row.milestones?.length > 0 && (
            <div style={{ borderTop: '1px solid #E2E8F0', paddingTop: 10 }}>
              <strong style={{ color: '#14213D', fontSize: 13 }}>Milestones</strong>
              {row.milestones.map((milestone: any) => (
                <div key={milestone.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #F1F5F9', fontSize: 13 }}>
                  <span>
                    {milestone.sequence}. {milestone.title || milestone.name}
                    {' · '}{formatCurrency(Number(milestone.amount_usd || 0))}
                    {' · '}{milestone.status}
                  </span>
                  <span style={{ display: 'flex', gap: 6 }}>
                    {['pending', 'in_progress'].includes(milestone.status) && permissions.includes('contracts.manage') && (
                      <button className="btn-secondary" onClick={() => updateMilestone(milestone.id, 'complete')} disabled={Boolean(busy)} style={{ fontSize: 11.5, padding: '4px 10px' }}>
                        Mark delivered
                      </button>
                    )}
                    {milestone.status === 'completed' && permissions.includes('finance.manage') && (
                      <button className="btn-primary" onClick={() => updateMilestone(milestone.id, 'invoice')} disabled={Boolean(busy)} style={{ fontSize: 11.5, padding: '4px 10px' }}>
                        Draft invoice
                      </button>
                    )}
                  </span>
                </div>
              ))}
              {row.service_line === 'project'
                && row.projects?.status !== 'completed'
                && row.milestones.every((milestone: any) => ['completed', 'invoiced'].includes(milestone.status))
                && permissions.includes('contracts.manage') && (
                <button
                  className="btn-primary"
                  style={{ marginTop: 12, fontSize: 12.5 }}
                  onClick={() => updateMilestone(String(row.project_id), 'complete_project')}
                  disabled={Boolean(busy)}
                >
                  Complete the project and release the team
                </button>
              )}
            </div>
          )}
        </article>
      ))}
    </div>
  );
}
