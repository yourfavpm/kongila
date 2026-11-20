import type { NextApiRequest, NextApiResponse } from 'next';
import {
  createRequestCall,
  requirePermission,
  getRequestUser,
  scheduleRequestCall
} from '@kongila/database';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const actor = await getRequestUser(req);
  if (!actor) return res.status(401).json({ error: 'Not authenticated' });
  if (actor.kind !== 'admin') return res.status(403).json({ error: 'Not authorised' });

  // What this operator may do, checked against the permission the super
  // admin granted the role rather than against the role's name. Hiding a
  // tab is not access control; this is where the refusal happens.
  const refused = requirePermission(actor, 'requests.manage');
  if (refused) return res.status(refused.status).json({ error: refused.error });

  const body = req.body || {};
  const result = body.action === 'schedule'
    ? await scheduleRequestCall(actor, body)
    : await createRequestCall(actor, body);
  if (!result.ok) return res.status(result.status).json({ error: result.error });

  return res.status(result.status).json({
    ok: true,
    callRequest: result.data,
    warnings: result.warnings || []
  });
}
