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
import { clientMatchTransition, allCandidatesRejected, matchingProgressStatus } from '@kongila/workflows';
import { requestTitle } from '@kongila/shared-types';

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

  const { data: match, error: matchError } = await supabase
    .from('matches').select('*').eq('id', matchId).maybeSingle();
  if (matchError) return { match: null, request: null, error: matchError.message };
  if (!match) return { match: null, request: null, error: null };

  const { data: request, error: requestError } = await supabase
    .from('talent_requests').select('*').eq('id', match.request_id).maybeSingle();

  return { match, request, error: requestError?.message || null };
}

async function clientCanAccessRequest(actor: Actor, request: any): Promise<boolean> {
  if (String(request.client_id) === String(actor.userId)) return true;
  if (!actor.organizationId) return false;

  const { data, error } = await getSupabaseClient()
    .from('client_profiles')
    .select('user_id')
    .eq('organization_id', actor.organizationId);
  if (error) {
    console.error('[matchService] organization membership lookup failed:', error.message);
    return false;
  }
  return (data || []).some((profile: any) => String(profile.user_id) === String(request.client_id));
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

  const { match, request, error: contextError } = await loadMatchContext(matchId);
  if (contextError) return fail(500, `The candidate's request could not be loaded: ${contextError}`);
  if (!match) return fail(404, 'That candidate is not on any of your requests.');

  const isOperations = actor.kind === 'admin';
  if (!isOperations) {
    if (!request || !(await clientCanAccessRequest(actor, request))) {
      return fail(403, 'That candidate is not on any of your requests.');
    }
  }
  if (!request) return fail(404, 'The request for this candidate no longer exists.');

  if (actor.kind === 'client' && String(input.status).toLowerCase() === 'accepted') {
    return fail(409, 'A candidate can only be accepted through the offer response flow.');
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
    const roleTitle = requestTitle({ ...(request.payload || {}), title: request.payload?.title || request.title });
    const accepted = await notifyUsers(String(match.talent_id), 'offer_accepted', { roleTitle });
    warnings.push(...accepted.warnings);

    const ops = await notifyAdmins('offer_accepted', { roleTitle });
    warnings.push(...ops.warnings);
  }

  if (move.status === 'rejected' && request) {
    // Only when the request has run out of candidates. One rejection is
    // routine; no candidates left means somebody has to act.
    const { data: siblings, error: siblingsError } = await supabase
      .from('matches').select('id, request_id, status').eq('request_id', request.id);

    if (siblingsError) {
      warnings.push(`The rejection was saved, but remaining candidates could not be checked: ${siblingsError.message}`);
    }

    const exhausted = !siblingsError && allCandidatesRejected(
      (siblings || []).map((m: any) => ({ id: m.id, requestId: m.request_id, status: m.status })),
      String(request.id),
      matchId
    );

    if (exhausted) {
      const requestPayload = { ...(request.payload || {}) };
      const nextStatus = matchingProgressStatus(
        requestPayload.status || request.status,
        'all_candidates_rejected'
      );
      if (nextStatus) {
        requestPayload.status = nextStatus;
        const { error: requestError } = await supabase
          .from('talent_requests')
          .update({
            payload: requestPayload,
            status: nextStatus.toLowerCase().replace(/ /g, '_')
          })
          .eq('id', request.id);
        if (requestError) {
          warnings.push(`All candidates were rejected, but the request stage did not update: ${requestError.message}`);
        }
      }

      // This used to be an insert addressed to user_id 'admin_team', which
      // is not a row in users, so the foreign key refused it every time.
      const ops = await notifyAdmins('all_candidates_rejected', {
        roleTitle: requestTitle({ ...(request.payload || {}), title: request.payload?.title || request.title }),
        reason: String(input.rejectionReason || '').trim() || undefined
      });
      warnings.push(...ops.warnings);
    }
  }

  const { data: fresh } = await supabase
    .from('matches').select('*').eq('id', matchId).maybeSingle();
  const { data: freshRequest, error: freshRequestError } = await supabase
    .from('talent_requests').select('*').eq('id', request.id).maybeSingle();
  if (freshRequestError) warnings.push(`The candidate decision was saved, but the latest role stage could not be loaded: ${freshRequestError.message}`);

  return {
    ok: true,
    status: 200,
    data: {
      id: fresh?.id,
      requestId: fresh?.request_id,
      talentId: fresh?.talent_id,
      status: fresh?.status,
      score: fresh?.score,
      clientRejectionReason: fresh?.client_rejection_reason,
      requestStatus: freshRequest?.payload?.status || freshRequest?.status || request.payload?.status || request.status
    },
    warnings
  };
}
