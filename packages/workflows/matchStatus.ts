/**
 * What a client may do to a match, and what it may become.
 *
 * `matches_status_check` allows four values and nothing else. The browser
 * wrote 'interview_scheduled' and 'rejected_by_client' at three call sites;
 * Postgres rejected every one of them and the error went to console.error,
 * so a client shortlisting or rejecting a candidate changed nothing and the
 * screen showed that it had.
 *
 * The four statuses, and who moves them:
 *   proposed     operations put the candidate in front of the client
 *   shortlisted  the client wants to talk to them
 *   rejected     the client does not
 *   accepted     the client is hiring them
 *
 * This file imports nothing, so it can be tested on its own.
 */

export const MATCH_STATUSES = ['proposed', 'shortlisted', 'rejected', 'accepted'] as const;
export type MatchStatus = typeof MATCH_STATUSES[number];

/** What a client may move a match to, from each status. */
export const CLIENT_MATCH_TRANSITIONS: Record<MatchStatus, MatchStatus[]> = {
  proposed: ['shortlisted', 'rejected'],
  shortlisted: ['accepted', 'rejected'],
  // Both are the end of the line for the client. Reopening a rejection is a
  // conversation with operations, not a button.
  rejected: [],
  accepted: []
};

export function isMatchStatus(value?: string | null): value is MatchStatus {
  return (MATCH_STATUSES as readonly string[]).includes(String(value || '').trim().toLowerCase());
}

export function normaliseMatchStatus(value?: string | null): MatchStatus | null {
  const text = String(value || '').trim().toLowerCase();
  return isMatchStatus(text) ? (text as MatchStatus) : null;
}

export interface MatchTransition {
  ok: boolean;
  status?: MatchStatus;
  error?: string;
}

/**
 * Checks a client's requested move.
 *
 * The reason is required on a rejection. Operations acts on the reason —
 * it is what tells them whether to send more candidates or reopen the brief
 * — and a rejection with no reason is a dead end for everyone.
 */
export function clientMatchTransition(
  from: string | null | undefined,
  to: string | null | undefined,
  reason?: string | null
): MatchTransition {
  const current = normaliseMatchStatus(from) || 'proposed';
  const next = normaliseMatchStatus(to);

  if (!next) {
    return { ok: false, error: `"${to}" is not a match status.` };
  }

  if (next === current) return { ok: true, status: next };

  if (!CLIENT_MATCH_TRANSITIONS[current].includes(next)) {
    return {
      ok: false,
      error: CLIENT_MATCH_TRANSITIONS[current].length === 0
        ? `This candidate is already ${current}.`
        : `A ${current} candidate cannot be moved to ${next}.`
    };
  }

  if (next === 'rejected' && !String(reason || '').trim()) {
    return { ok: false, error: 'Tell us why, so we know what to send next.' };
  }

  return { ok: true, status: next };
}

/** Whether every other candidate on this request has been rejected. */
export function allCandidatesRejected(
  matches: { id: string; requestId?: string | null; status?: string | null }[],
  requestId: string,
  justRejectedId: string
): boolean {
  const onRequest = (matches || []).filter(m => String(m.requestId) === String(requestId));
  if (onRequest.length === 0) return false;
  return onRequest.every(m =>
    String(m.id) === String(justRejectedId) || normaliseMatchStatus(m.status) === 'rejected'
  );
}
