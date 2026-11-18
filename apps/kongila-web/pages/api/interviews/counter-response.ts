import type { NextApiRequest, NextApiResponse } from 'next';
import { getRequestUser, decideCounterOffer } from '@kongila/database';

/**
 * The client answers a time the candidate proposed instead.
 *
 * The loop used to stop one step short of here. A candidate who could not
 * make the slot raised a reschedule, and only operations could answer it, so
 * the client whose interview it was had no say in the time they were being
 * moved to — they found out when the calendar invitation arrived.
 *
 * Accepting is agreement from both sides, so the interview is confirmed on
 * the spot and everybody gets the calendar file. Declining hands it back to
 * operations to find a third time rather than bouncing it at the candidate.
 *
 * POST { interviewId, accept: boolean, reason? }
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const actor = await getRequestUser(req);
  if (!actor) return res.status(401).json({ error: 'Not authenticated' });

  const { interviewId, accept, reason } = req.body || {};
  if (!interviewId) return res.status(400).json({ error: 'interviewId is required.' });
  if (typeof accept !== 'boolean') {
    return res.status(400).json({ error: 'accept must be true or false.' });
  }

  const result = await decideCounterOffer(actor, { interviewId, accept, reason });
  if (!result.ok) return res.status(result.status).json({ error: result.error });

  return res.status(result.status).json({ interview: result.data, warnings: result.warnings });
}
