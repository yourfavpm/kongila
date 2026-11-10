import type { NextApiRequest, NextApiResponse } from 'next';
import { canAccessRequest, getRequestUser, getSupabaseClient } from '@kongila/database';
import { resolveRole } from '@kongila/auth';
import {
  normalizeRequestStatus,
  canTransitionRequest,
  explainTransition
} from '@kongila/workflows';

/**
 * The only place a request's status changes.
 *
 * Status used to be assigned straight from a dropdown in the browser, with no
 * check that the move was legal, and normalizeRequestStatus turned anything
 * it did not recognise into 'New Request'. Between them, a typo could send a
 * request at Offer Accepted back to the start of the pipeline, silently.
 *
 * Here the target has to resolve to a canonical value, the move has to be in
 * the transition table, and the change is recorded with the administrator who
 * made it.
 */

/**
 * Requests carry both a row id and a separate id inside the JSON payload, and
 * different parts of the product key on different ones. Both are accepted
 * rather than guessed at.
 */
async function loadRequest(supabase: any, requestId: string) {
  const { data, error } = await supabase
    .from('talent_requests')
    .select('id, payload, status, client_id, account_manager_id')
    .or(`id.eq.${requestId},payload->>id.eq.${requestId}`)
    .limit(2);

  if (error) throw new Error(error.message);
  if (!data || data.length === 0) return null;
  if (data.length > 1) {
    console.warn(`[requests/status] ${requestId} matched ${data.length} rows; using the first`);
  }
  return data[0];
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const actor = await getRequestUser(req);
  if (!actor) return res.status(401).json({ error: 'Not authenticated' });
  if (actor.kind !== 'admin') {
    console.warn(`[requests/status] refused ${actor.kind} ${actor.userId}`);
    return res.status(403).json({ error: 'Not authorised' });
  }

  const { requestId, status, reason, patch } = req.body || {};
  if (!requestId || !status) {
    return res.status(400).json({ error: 'requestId and status are required' });
  }

  // Strict: an unrecognised target is refused rather than coerced.
  const target = normalizeRequestStatus(status);
  if (!target) {
    return res.status(400).json({
      error: `"${status}" is not a recognised request status.`
    });
  }

  const supabase = getSupabaseClient();

  try {
    const row = await loadRequest(supabase, String(requestId));
    if (!row) return res.status(404).json({ error: 'Request not found' });
    if (!await canAccessRequest(supabase, actor, row)) {
      return res.status(404).json({ error: 'Request not found' });
    }

    const payload = row.payload || {};
    // An existing value that no longer resolves is treated as the start of
    // the pipeline for the purpose of deciding the next move, and said out
    // loud, rather than quietly rewriting history.
    const current = normalizeRequestStatus(payload.status || row.status);
    if (!current && payload.status) {
      console.warn(
        `[requests/status] request ${requestId} holds unrecognised status "${payload.status}"`
      );
    }
    const from = current || 'New Request';

    const isAccountManagerStartingAllowedStep = resolveRole(actor.role) === 'account_manager'
      && ((from === 'New Request' && target === 'Reviewing')
        || (from === 'Reviewing' && target === 'Sourcing Talent'));
    if (resolveRole(actor.role) === 'account_manager' && !isAccountManagerStartingAllowedStep) {
      return res.status(403).json({ error: 'Account managers can only move assigned requests into Reviewing or Sourcing Talent.' });
    }

    if (!canTransitionRequest(from, target)) {
      return res.status(409).json({
        error: explainTransition(from, target),
        from,
        to: target
      });
    }

    const allowedPatchKeys = [
      'assignedAccountManagerId',
      'assignedTalentManagerId',
      'accountManagerNotes',
      'talentManagerNotes',
      'urgency',
      'internalNotes'
    ];
    const safePatch = patch && typeof patch === 'object'
      ? Object.fromEntries(Object.entries(patch).filter(([key]) => allowedPatchKeys.includes(key)))
      : {};
    const nextPayload = { ...payload, ...safePatch, status: target };
    const columnPatch: Record<string, any> = {};
    if (safePatch.assignedTalentManagerId) columnPatch.talent_manager_id = safePatch.assignedTalentManagerId;
    if (safePatch.assignedAccountManagerId) columnPatch.account_manager_id = safePatch.assignedAccountManagerId;

    const { error: updateError } = await supabase
      .from('talent_requests')
      .update({
        payload: nextPayload,
        status: target.toLowerCase().replace(/ /g, '_'),
        ...columnPatch
      })
      .eq('id', row.id);

    if (updateError) {
      console.error('[requests/status] update failed:', updateError.message);
      return res.status(500).json({ error: `Could not update the request: ${updateError.message}` });
    }

    // Recorded against the administrator who did it, not a hardcoded string.
    const { error: auditError } = await supabase.from('audit_logs').insert({
      actor: actor.email || actor.userId,
      action: 'Update Request Status',
      details: `Request ${requestId}: ${from} to ${target}${reason ? ` — ${reason}` : ''}`,
      timestamp: new Date().toISOString()
    });
    if (auditError) {
      console.warn('[requests/status] audit entry not written:', auditError.message);
    }

    return res.status(200).json({ ok: true, from, to: target });
  } catch (error: any) {
    console.error('[requests/status] unexpected failure:', error);
    return res.status(500).json({ error: error.message || 'Could not update the request' });
  }
}
