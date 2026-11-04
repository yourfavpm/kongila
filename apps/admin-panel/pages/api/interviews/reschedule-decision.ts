import type { NextApiRequest, NextApiResponse } from 'next';
import { getRequestUser, decideReschedule } from '@kongila/database';

/**
 * Operations approves or refuses a reschedule request.
 *
 * Approving moves the existing interview. The admin panel used to route this
 * through the stage-decision handler, which fell into the create branch and
 * minted a second interview row while leaving the first one Scheduled
 * forever, so one conversation showed as two live interviews.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const actor = await getRequestUser(req);
  if (!actor) return res.status(401).json({ error: 'Not authenticated' });
  if (actor.kind !== 'admin') {
    console.warn(`[interviews/reschedule-decision] refused ${actor.kind} ${actor.userId}`);
    return res.status(403).json({ error: 'Not authorised' });
  }

  const { approve } = req.body || {};
  if (typeof approve !== 'boolean') {
    return res.status(400).json({ error: 'approve must be true or false.' });
  }

  const result = await decideReschedule(actor, req.body || {});
  if (!result.ok) return res.status(result.status).json({ error: result.error });

  return res.status(result.status).json({ interview: result.data, warnings: result.warnings });
}
