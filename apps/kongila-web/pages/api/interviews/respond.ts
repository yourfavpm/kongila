import type { NextApiRequest, NextApiResponse } from 'next';
import { getRequestUser, respondToInterview } from '@kongila/database';

/**
 * A candidate accepts or declines.
 *
 * There was no way to do this at all. The database has talent_accepted,
 * talent_declined and talent_decline_reason, and no code referenced any of
 * them; the client flow wrote Scheduled immediately, so the candidate was
 * told about a call they had never been asked about.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const actor = await getRequestUser(req);
  if (!actor) return res.status(401).json({ error: 'Not authenticated' });

  const { interviewId, accept, reason } = req.body || {};
  if (typeof accept !== 'boolean') {
    return res.status(400).json({ error: 'accept must be true or false.' });
  }

  const result = await respondToInterview(actor, { interviewId, accept, reason });
  if (!result.ok) return res.status(result.status).json({ error: result.error });

  return res.status(result.status).json({ interview: result.data, warnings: result.warnings });
}
