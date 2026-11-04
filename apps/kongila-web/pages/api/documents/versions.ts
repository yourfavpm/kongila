import type { NextApiRequest, NextApiResponse } from 'next';
import { getRequestUser, documentHistory, restoreVersion } from '@kongila/database';

/**
 * A candidate's document history.
 *
 * GET  ?type=cv            every version, newest first, with which is current
 * POST action=restore      make an earlier version current again
 *
 * The version number used to be computed in the browser and nothing marked
 * the previous one superseded, so the list showed four CVs with no sign of
 * which one counted.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const actor = await getRequestUser(req);
  if (!actor) return res.status(401).json({ error: 'Not authenticated' });

  if (req.method === 'GET') {
    const type = String(req.query.type || 'cv');
    const result = await documentHistory(actor, { type, userId: req.query.userId as string });
    if (!result.ok) return res.status(result.status).json({ error: result.error });
    return res.status(200).json({ versions: result.data });
  }

  if (req.method === 'POST' && req.body?.action === 'restore') {
    const result = await restoreVersion(actor, req.body);
    if (!result.ok) return res.status(result.status).json({ error: result.error });
    return res.status(200).json(result.data);
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
