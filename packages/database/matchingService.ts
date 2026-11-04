/**
 * Operations putting candidates in front of a client.
 *
 * `pages/matching/[requestId].tsx` did this with four browser writes: a
 * `talent_requests` update, an `audit_logs` insert attributed to a hard
 * coded 'Talent Manager', a `matches` upsert, and a `notifications` insert
 * to the client. RLS is off on `talent_requests` and `matches` in the live
 * database, so those two landed; it is on with no policy on `audit_logs`
 * and `notifications`, so the audit entry and the client's notification
 * never did. Nobody was told their candidates were ready.
 *
 * The matches were also written with status 'shortlisted'. Shortlisted is
 * the client's verdict, not operations'. A candidate arrived already
 * marked as one the client had picked, and `clientMatchTransition` then
 * had nothing left to move, so the client could not shortlist them.
 * They go in as 'proposed'.
 */

import { getSupabaseClient } from './index';
import type { RequestActor as Actor } from './scope';
import { recordAudit } from './audit';
import { notifyUsers } from './notify';
import { coerceRequestStatus } from '@kongila/workflows';

export interface MatchingResult<T = any> {
  ok: boolean;
  status: number;
  error?: string;
  data?: T;
  warnings?: string[];
}

function fail(status: number, error: string): MatchingResult {
  return { ok: false, status, error };
}

export interface ProposedCandidate {
  talentId: string;
  score?: number | null;
  breakdown?: unknown;
}

const MAX_CANDIDATES = 25;

/**
 * Submits a shortlist of candidates to the client.
 *
 * The match ids are built here rather than accepted from the caller, so a
 * submission cannot overwrite an unrelated match row by naming its id.
 */
export async function submitCandidates(
  actor: Actor,
  input: { requestId: string; candidates: ProposedCandidate[] }
): Promise<MatchingResult> {
  if (!actor) return fail(401, 'Not authenticated.');
  if (actor.kind !== 'admin') return fail(403, 'Not authorised.');

  const requestId = String(input.requestId || '').trim();
  if (!requestId) return fail(400, 'Which request?');

  const candidates = (input.candidates || []).filter(c => c && c.talentId);
  if (candidates.length === 0) return fail(400, 'No candidates were selected.');
  if (candidates.length > MAX_CANDIDATES) {
    return fail(422, `That is more than ${MAX_CANDIDATES} candidates for one request.`);
  }

  const supabase = getSupabaseClient();

  const { data: rows, error: loadError } = await supabase
    .from('talent_requests')
    .select('*')
    .or(`id.eq.${requestId},payload->>id.eq.${requestId}`)
    .limit(2);

  if (loadError) return fail(500, `That request could not be loaded: ${loadError.message}`);
  if (!rows || rows.length === 0) return fail(404, 'That request does not exist.');
  const row = rows[0];

  // Every candidate has to be a real talent profile. A bad id used to go
  // straight into matches and show up in the client portal as a blank card.
  const talentIds = Array.from(new Set(candidates.map(c => String(c.talentId))));
  const { data: profiles } = await supabase
    .from('talent_profiles').select('id').in('id', talentIds);

  const known = new Set((profiles || []).map((p: any) => String(p.id)));
  const missing = talentIds.filter(id => !known.has(id));
  if (missing.length > 0) {
    return fail(422, `Not a candidate: ${missing.join(', ')}.`);
  }

  const warnings: string[] = [];
  const payload = { ...(row.payload || {}) };
  const accountManagerId = row.account_manager_id || payload.assignedAccountManagerId || null;
  const talentManagerId = row.talent_manager_id || payload.assignedTalentManagerId || null;

  // ── The matches ──────────────────────────────────────────────────────────
  // 'proposed', not 'shortlisted'. Shortlisting is the client's move.
  const matchRows = talentIds.map(talentId => {
    const candidate = candidates.find(c => String(c.talentId) === talentId) as ProposedCandidate;
    const score = Number(candidate.score);
    return {
      id: `match_${row.id}_${talentId}`,
      request_id: row.id,
      talent_id: talentId,
      status: 'proposed',
      score: Number.isFinite(score) ? Math.round(score) : 0,
      breakdown: candidate.breakdown ?? null,
      created_at: new Date().toISOString()
    };
  });

  const { error: matchError } = await supabase
    .from('matches').upsert(matchRows, { onConflict: 'id' });
  if (matchError) return fail(500, `Those candidates were not submitted: ${matchError.message}`);

  // ── The request ──────────────────────────────────────────────────────────
  payload.status = coerceRequestStatus('Candidates Ready');
  payload.assignedAccountManagerId = accountManagerId;
  payload.assignedTalentManagerId = talentManagerId;

  const { error: requestError } = await supabase
    .from('talent_requests')
    .update({
      payload,
      status: 'candidates_ready',
      account_manager_id: accountManagerId,
      talent_manager_id: talentManagerId
    })
    .eq('id', row.id);

  if (requestError) {
    warnings.push(`The candidates were submitted but the request did not move: ${requestError.message}`);
  }

  await recordAudit(actor, {
    action: 'Submit Candidates',
    details: `Submitted ${matchRows.length} candidate(s) for request ${requestId}.`,
    entityType: 'talent_request',
    entityId: String(row.id)
  });

  // ── The client ───────────────────────────────────────────────────────────
  if (row.client_id) {
    const notified = await notifyUsers(String(row.client_id), 'candidates_ready', {
      candidateCount: matchRows.length,
      roleTitle: payload.roleDescription || row.role_description || row.service_type || undefined
    });
    warnings.push(...notified.warnings);
  } else {
    warnings.push('That request has no client on it, so nobody was notified.');
  }

  return {
    ok: true,
    status: 200,
    data: {
      requestId: row.id,
      submitted: matchRows.length,
      status: payload.status,
      // The page sets its local request from this.
      request: { ...payload, rowId: row.id, clientId: row.client_id },
      matches: matchRows.map(m => ({
        id: m.id,
        requestId: m.request_id,
        talentId: m.talent_id,
        status: m.status,
        score: m.score
      }))
    },
    warnings
  };
}

/**
 * Flagging a request as needing sourcing.
 *
 * The button posted `{ requestId, sourcingRequired: true }` to the submit
 * route, which requires a candidate list and answered 400. Below the
 * `return` that followed it sat an unreachable fallback that updated
 * `talent_requests` from the browser and invented a task object for a
 * tasks table nothing reads. Neither path did anything.
 *
 * Flagging moves the request to Sourcing Talent and tells the managers on
 * it that there is nobody to put forward yet.
 */
export async function flagSourcingRequired(
  actor: Actor,
  input: { requestId: string; note?: string | null }
): Promise<MatchingResult> {
  if (!actor) return fail(401, 'Not authenticated.');
  if (actor.kind !== 'admin') return fail(403, 'Not authorised.');

  const requestId = String(input.requestId || '').trim();
  if (!requestId) return fail(400, 'Which request?');

  const supabase = getSupabaseClient();
  const { data: rows, error: loadError } = await supabase
    .from('talent_requests')
    .select('*')
    .or(`id.eq.${requestId},payload->>id.eq.${requestId}`)
    .limit(2);

  if (loadError) return fail(500, `That request could not be loaded: ${loadError.message}`);
  if (!rows || rows.length === 0) return fail(404, 'That request does not exist.');
  const row = rows[0];

  const payload = { ...(row.payload || {}) };
  const note = String(input.note || '').trim();

  payload.status = 'Sourcing Talent';
  payload.internalNotes = [
    payload.internalNotes || '',
    `[${new Date().toISOString().slice(0, 10)}] Flagged as sourcing required by ${actor.email || actor.userId}.`
      + (note ? ` ${note}` : '')
  ].filter(Boolean).join('\n');

  const { error } = await supabase
    .from('talent_requests')
    .update({ payload, status: 'sourcing_talent' })
    .eq('id', row.id);

  if (error) return fail(500, `That request was not flagged: ${error.message}`);

  await recordAudit(actor, {
    action: 'Flag Sourcing Required',
    details: `Request ${requestId} needs sourcing.` + (note ? ` ${note}` : ''),
    entityType: 'talent_request',
    entityId: String(row.id)
  });

  const warnings: string[] = [];
  const managers = [row.talent_manager_id, row.account_manager_id]
    .filter((id): id is string => Boolean(id));

  if (managers.length > 0) {
    const notified = await notifyUsers(managers, 'request_received', {
      roleTitle: payload.roleDescription || row.role_description || row.service_type || undefined,
      reason: 'No candidate on the platform fits this request yet. It needs sourcing.'
    });
    warnings.push(...notified.warnings);
  } else {
    warnings.push('No manager is assigned to that request, so nobody was notified.');
  }

  return {
    ok: true,
    status: 200,
    data: { requestId: row.id, status: payload.status, request: { ...payload, rowId: row.id } },
    warnings
  };
}
