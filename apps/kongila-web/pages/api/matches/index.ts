import type { NextApiRequest, NextApiResponse } from 'next';
import { getRequestUser, updateMatchStatus } from '@kongila/database';

/**
 * A client's decision on a candidate.
 *
 * The portal updated `matches` from the browser, twice with a status
 * `matches_status_check` does not allow, so the update was rejected and the
 * failure went to console.error while the screen showed the decision as
 * made. The notification that went with it was inserted from the browser
 * too, addressed to 'admin_team', which is not a user, so operations was
 * never told.
 *
 * PATCH { matchId, status, rejectionReason? }
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'PATCH' && req.method !== 'POST') {
    res.setHeader('Allow', 'PATCH, POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const actor = await getRequestUser(req);
  if (!actor) return res.status(401).json({ error: 'Not authenticated' });

  const body = (req.body || {}) as Record<string, any>;
  const result = await updateMatchStatus(actor, {
    matchId: body.matchId,
    status: body.status,
    rejectionReason: body.rejectionReason
  });

  if (!result.ok) return res.status(result.status).json({ error: result.error });
  return res.status(200).json({ match: result.data, warnings: result.warnings });
}
