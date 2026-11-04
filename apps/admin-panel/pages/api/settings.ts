import type { NextApiRequest, NextApiResponse } from 'next';
import { getRequestUser, listSettings, updateSetting } from '@kongila/database';

/**
 * Platform settings.
 *
 * Reading is open to any operator, because most screens need the values.
 * Writing is super admin only, checked inside updateSetting, and every
 * change is audited with its old and new value.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const actor = await getRequestUser(req);
  if (!actor) return res.status(401).json({ error: 'Not authenticated' });
  if (actor.kind !== 'admin') return res.status(403).json({ error: 'Not authorised' });

  if (req.method === 'GET') {
    const result = await listSettings(actor);
    if (!result.ok) return res.status(result.status).json({ error: result.error });
    return res.status(200).json({ settings: result.data });
  }

  if (req.method === 'POST') {
    const result = await updateSetting(actor, req.body || {});
    if (!result.ok) return res.status(result.status).json({ error: result.error });
    return res.status(200).json(result.data);
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
