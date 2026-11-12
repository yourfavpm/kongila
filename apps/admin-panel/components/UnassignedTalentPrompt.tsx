/**
 * Candidates nobody owns.
 *
 * A candidate with no talent manager is a candidate nobody is working. They
 * do not appear in anyone's book, nobody is accountable for moving them
 * through vetting, and they sit in the pipeline until somebody notices. The
 * old flow relied on somebody noticing.
 *
 * This asks. It appears at the top of the talent pipeline whenever there are
 * unowned candidates, lists them newest first, and assigns in one step. It
 * disappears entirely when there are none, so it is a prompt rather than
 * furniture.
 *
 * Ordered by who has been waiting longest to be picked up, not by who signed
 * up most recently — the one at risk of being forgotten goes to the top.
 */

import React, { useMemo, useState } from 'react';
import { Mascot } from '@kongila/ui';
import { apiFetch } from '../lib/apiFetch';
import { isTalentManagerAssignable, formatAssignableUserLabel } from '../lib/adminRoleFilters';
// A type-only import: isolatedModules rejects re-exporting a type through a
// value import, and this file is compiled that way.
import type { AssignableUser } from '../lib/adminRoleFilters';

export interface UnassignedTalentPromptProps {
  talents: any[];
  users: AssignableUser[];
  /** Called after a successful assignment so the caller can refresh. */
  onAssigned: () => void | Promise<void>;
}

export default function UnassignedTalentPrompt({ talents, users, onAssigned }: UnassignedTalentPromptProps) {
  const [choice, setChoice] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);

  const managers = useMemo(
    () => (users || []).filter(isTalentManagerAssignable),
    [users]
  );

  const unowned = useMemo(() => {
    const list = (talents || []).filter(t => !t?.talentManagerId);
    // Longest waiting first. A missing date sorts last rather than first,
    // because an unknown date is not evidence of urgency.
    return list.sort((a, b) => {
      const at = Date.parse(a?.createdAt || '') || Number.MAX_SAFE_INTEGER;
      const bt = Date.parse(b?.createdAt || '') || Number.MAX_SAFE_INTEGER;
      return at - bt;
    });
  }, [talents]);

  if (unowned.length === 0) return null;

  const assign = async (talentId: string) => {
    const managerId = choice[talentId];
    if (!managerId) {
      setError('Choose a talent manager first.');
      return;
    }
    setBusy(talentId);
    setError(null);
    try {
      const res = await apiFetch('/api/clients/assign-manager', {
        method: 'POST',
        body: JSON.stringify({ talentId, userId: managerId })
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body?.error || 'That candidate was not assigned.');
        return;
      }
      if (Array.isArray(body?.warnings) && body.warnings.length > 0) {
        // Usually the migration notice. Worth surfacing rather than hiding:
        // without the column, scoping cannot filter on the owner.
        setError(body.warnings.join(' '));
      }
      await onAssigned();
    } catch (err: any) {
      setError(err?.message || 'That candidate was not assigned.');
    } finally {
      setBusy(null);
    }
  };

  const waitingDays = (createdAt?: string) => {
    const t = Date.parse(createdAt || '');
    if (!Number.isFinite(t)) return null;
    return Math.max(0, Math.floor((Date.now() - t) / 86400000));
  };

  return (
    <div
      style={{
        border: '1px solid #FBD9A3',
        background: 'linear-gradient(180deg, #FFFCF5 0%, #FFF8EC 100%)',
        borderRadius: 14,
        padding: 18,
        marginBottom: 20
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <Mascot state="pointing" tone="caution" size={46} label="" />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14.5, fontWeight: 700, color: '#8A5A00' }}>
            {unowned.length === 1
              ? '1 candidate has no talent manager'
              : `${unowned.length} candidates have no talent manager`}
          </div>
          <div style={{ fontSize: 13, color: '#9C7430', marginTop: 2 }}>
            Nobody is accountable for their vetting until somebody is assigned.
          </div>
        </div>
        <button
          type="button"
          onClick={() => setCollapsed(c => !c)}
          style={{
            background: 'none',
            border: '1px solid #EBC789',
            borderRadius: 8,
            padding: '7px 13px',
            fontSize: 12.5,
            fontWeight: 600,
            color: '#8A5A00',
            cursor: 'pointer'
          }}
        >
          {collapsed ? 'Show' : 'Hide'}
        </button>
      </div>

      {error && (
        <div style={{ marginTop: 12, fontSize: 12.5, color: '#A3401F', lineHeight: 1.55 }}>{error}</div>
      )}

      {managers.length === 0 && !collapsed && (
        <div style={{ marginTop: 14, fontSize: 13, color: '#A3401F', lineHeight: 1.6 }}>
          No operator holds the talent manager role yet, so there is nobody to assign these to.
          Give someone that role under Users first.
        </div>
      )}

      {!collapsed && managers.length > 0 && (
        <div style={{ marginTop: 14, display: 'grid', gap: 8 }}>
          {unowned.slice(0, 8).map(t => {
            const days = waitingDays(t.createdAt);
            return (
              <div
                key={t.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  flexWrap: 'wrap',
                  background: '#fff',
                  border: '1px solid #F0E0C4',
                  borderRadius: 10,
                  padding: '10px 12px'
                }}
              >
                <div style={{ flex: '1 1 180px', minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: '#1A2340' }}>
                    {t.name || t.id}
                  </div>
                  <div style={{ fontSize: 12, color: '#8795B0' }}>
                    {[t.title, t.vettingStatus, days != null ? `waiting ${days}d` : null]
                      .filter(Boolean)
                      .join(' · ')}
                  </div>
                </div>

                <select
                  value={choice[t.id] || ''}
                  onChange={e => setChoice(c => ({ ...c, [t.id]: e.target.value }))}
                  style={{
                    flex: '0 1 200px',
                    padding: '8px 10px',
                    fontSize: 13,
                    borderRadius: 8,
                    border: '1px solid #DDE2EC',
                    background: '#fff',
                    color: '#1A2340'
                  }}
                >
                  <option value="">Assign to…</option>
                  {managers.map(m => (
                    <option key={m.id} value={m.id}>{formatAssignableUserLabel(m)}</option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={() => assign(String(t.id))}
                  disabled={busy === String(t.id) || !choice[t.id]}
                  style={{
                    padding: '8px 15px',
                    borderRadius: 8,
                    border: 'none',
                    fontSize: 12.5,
                    fontWeight: 700,
                    color: '#fff',
                    background: choice[t.id] ? 'var(--kongila-blue, #0047CC)' : '#B9C3D6',
                    cursor: choice[t.id] && busy !== String(t.id) ? 'pointer' : 'not-allowed'
                  }}
                >
                  {busy === String(t.id) ? 'Assigning…' : 'Assign'}
                </button>
              </div>
            );
          })}

          {unowned.length > 8 && (
            <div style={{ fontSize: 12.5, color: '#9C7430', paddingTop: 2 }}>
              and {unowned.length - 8} more below.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
