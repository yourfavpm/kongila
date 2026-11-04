import type { NextApiRequest, NextApiResponse } from 'next';
import { getRequestUser, requestReschedule } from '@kongila/database';

/**
 * Either party asks for a different time.
 *
 * The candidate's version of this used to set a flag on the vetting pipeline
 * stage and stuff the proposed time into the reason field as a formatted
 * string; the client's wrote requestedDate and requestedTime onto the match.
 * Neither produced a record anyone could act on, and nobody was notified.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const actor = await getRequestUser(req);
  if (!actor) return res.status(401).json({ error: 'Not authenticated' });

  const result = await requestReschedule(actor, req.body || {});
  if (!result.ok) return res.status(result.status).json({ error: result.error });

  return res.status(result.status).json({ interview: result.data, warnings: result.warnings });
}
