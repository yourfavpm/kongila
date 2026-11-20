import type { NextApiRequest, NextApiResponse } from 'next';
import {
  getRequestUser,
  listRolePermissions,
  updateRolePermissions,
  resetRolePermissions
} from '@kongila/database';

/**
 * What each role may do.
 *
 * GET is open to any operator, because the screen that shows it is also the
 * screen that explains why something is greyed out, and an operator who
 * cannot see the rules cannot tell a missing permission from a broken page.
 * Editing is behind users.manage, checked server-side from the verified
 * token.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const actor = await getRequestUser(req);
  if (!actor) return res.status(401).json({ error: 'Not authenticated' });

  if (req.method === 'GET') {
    const result = await listRolePermissions(actor);
    if (!result.ok) return res.status(result.status).json({ error: result.error });
    res.setHeader('Cache-Control', 'private, no-store');
    return res.status(200).json(result.data);
  }

  if (req.method === 'POST') {
    const body = (req.body || {}) as Record<string, any>;
    const result = body.action === 'reset'
      ? await resetRolePermissions(actor, { role: String(body.role || '') })
      : await updateRolePermissions(actor, {
          role: String(body.role || ''),
          permissions: Array.isArray(body.permissions) ? body.permissions : []
        });

    if (!result.ok) return res.status(result.status).json({ error: result.error });
    return res.status(result.status).json({ ...result.data, warnings: result.warnings || [] });
  }

  res.setHeader('Allow', 'GET, POST');
  return res.status(405).json({ error: 'Method not allowed' });
}
