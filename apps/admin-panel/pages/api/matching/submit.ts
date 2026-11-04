import type { NextApiRequest, NextApiResponse } from 'next';
import { getRequestUser, submitCandidates, flagSourcingRequired } from '@kongila/database';

/**
 * Submitting candidates to a client.
 *
 * The page did this with four browser writes. Two landed on tables with
 * RLS off; the audit entry and the client's notification were denied, so
 * no client was ever told their candidates were ready. The matches were
 * written as 'shortlisted', which is the client's verdict, not ours.
 *
 * POST { requestId, candidates: [{ talentId, score?, breakdown? }] }
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const actor = await getRequestUser(req);
  if (!actor) return res.status(401).json({ error: 'Not authenticated' });

  const body = (req.body || {}) as Record<string, any>;
  // Flagging a request as needing sourcing comes through here too. It
  // used to be posted as { sourcingRequired: true } with no candidates,
  // which this route answered 400.
  if (body.sourcingRequired) {
    const flagged = await flagSourcingRequired(actor, {
      requestId: body.requestId,
      note: body.note
    });
    if (!flagged.ok) return res.status(flagged.status).json({ error: flagged.error });
    return res.status(200).json({ ...flagged.data, warnings: flagged.warnings });
  }

  const result = await submitCandidates(actor, {
    requestId: body.requestId,
    // The page sends `id` for the candidate. Both spellings are taken
    // so the route does not depend on which one a caller uses.
    candidates: (Array.isArray(body.candidates) ? body.candidates : [])
      .map((c: any) => ({ talentId: c?.talentId ?? c?.id, score: c?.score, breakdown: c?.breakdown }))
  });

  if (!result.ok) return res.status(result.status).json({ error: result.error });
  return res.status(200).json({ ...result.data, warnings: result.warnings });
}
