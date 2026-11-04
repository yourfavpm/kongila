/**
 * A client's decisions on the candidates put in front of them.
 *
 * Three places in the portal updated `matches` straight from the browser:
 * `ClientDashboard` when an interview was requested, `MatchedTalentPanel`
 * when a candidate was rejected, and `pages/index.tsx` when an offer was
 * accepted. Two of them wrote a status `matches_status_check` does not
 * allow, so the update was rejected and the error was logged and swallowed;
 * the screen showed a decision the database had not recorded.
 *
 * The notifications that went with those decisions were inserted from the
 * browser too, several addressed to 'admin_team', which is not a user id,
 * so the foreign key rejected them and operations was never told anything.
 *
 * All of it happens here now: the transition is checked against
 * `clientMatchTransition`, the row belongs to the caller's own request, and
 * the people who need to know are told through `notifyUsers`.
 */

import { getSupabaseClient } from './index';
import type { RequestActor as Actor } from './scope';
import { notifyUsers, notifyAdmins } from './notify';
import { clientMatchTransition, allCandidatesRejected } from '@kongila/workflows';

export interface MatchResult<T = any> {
  ok: boolean;
  status: number;
  error?: string;
  data?: T;
  warnings?: string[];
}

function fail(status: number, error: string): MatchResult {
  return { ok: false, status, error };
}

/** The request a match belongs to, and who owns it. */
async function loadMatchContext(matchId: string) {
  const supabase = getSupabaseClient();

  const { data: match } = await supabase
    .from('matches').select('*').eq('id', matchId).maybeSingle();
  if (!match) return { match: null, request: null };

  const { data: request } = await supabase
    .from('talent_requests').select('*').eq('id', match.request_id).maybeSingle();

  return { match, request };
}

/**
 * Moves a match.
 *
 * The caller must own the request the match sits on. A client who sends
 * another client's match id gets a 403, not somebody else's candidate.
 */
export async function updateMatchStatus(
  actor: Actor,
  input: { matchId: string; status: string; rejectionReason?: string | null }
): Promise<MatchResult> {
  if (!actor) return fail(401, 'Not authenticated.');
  if (actor.kind === 'talent') return fail(403, 'A candidate does not decide on their own match.');

  const matchId = String(input.matchId || '').trim();
  if (!matchId) return fail(400, 'Which candidate?');

  const { match, request } = await loadMatchContext(matchId);
  if (!match) return fail(404, 'That candidate is not on any of your requests.');

  const isOperations = actor.kind === 'admin';
  if (!isOperations) {
    if (!request || String(request.client_id) !== String(actor.userId)) {
      return fail(403, 'That candidate is not on any of your requests.');
    }
  }

  const move = clientMatchTransition(match.status, input.status, input.rejectionReason);
  if (!move.ok) return fail(409, move.error as string);

  const patch: Record<string, unknown> = { status: move.status };
  if (move.status === 'rejected') {
    patch.client_rejection_reason = String(input.rejectionReason || '').trim();
  }

  const supabase = getSupabaseClient();
  const { error } = await supabase.from('matches').update(patch).eq('id', matchId);
  if (error) return fail(500, `That decision was not saved: ${error.message}`);

  const warnings: string[] = [];

  // ── Tell the people it affects ───────────────────────────────────────────
  if (move.status === 'accepted') {
    const roleTitle = request?.service_type || undefined;
    const accepted = await notifyUsers(String(match.talent_id), 'offer_accepted', { roleTitle });
    warnings.push(...accepted.warnings);

    const ops = await notifyAdmins('offer_accepted', { roleTitle });
    warnings.push(...ops.warnings);
  }

  if (move.status === 'rejected' && request) {
    // Only when the request has run out of candidates. One rejection is
    // routine; no candidates left means somebody has to act.
    const { data: siblings } = await supabase
      .from('matches').select('id, request_id, status').eq('request_id', request.id);

    const exhausted = allCandidatesRejected(
      (siblings || []).map((m: any) => ({ id: m.id, requestId: m.request_id, status: m.status })),
      String(request.id),
      matchId
    );

    if (exhausted) {
      // This used to be an insert addressed to user_id 'admin_team', which
      // is not a row in users, so the foreign key refused it every time.
      const ops = await notifyAdmins('all_candidates_rejected', {
        roleTitle: request.service_type || undefined,
        reason: String(input.rejectionReason || '').trim() || undefined
      });
      warnings.push(...ops.warnings);
    }
  }

  const { data: fresh } = await supabase
    .from('matches').select('*').eq('id', matchId).maybeSingle();

  return {
    ok: true,
    status: 200,
    data: {
      id: fresh?.id,
      requestId: fresh?.request_id,
      talentId: fresh?.talent_id,
      status: fresh?.status,
      score: fresh?.score,
      clientRejectionReason: fresh?.client_rejection_reason
    },
    warnings
  };
}
