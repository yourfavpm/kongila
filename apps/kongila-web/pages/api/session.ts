import type { NextApiRequest, NextApiResponse } from 'next';
import { getRequestUser } from '@kongila/database';

/**
 * Who the caller is, resolved server-side.
 *
 * Both portals read `public.users` from the browser to find out their own
 * role after signing in. That read is also what RLS on `users` has to
 * permit, and the admin login's version selected the whole table rather
 * than one row.
 *
 * getRequestUser already does this properly: it verifies the JWT against
 * the project, reads the row, refuses a suspended account whose token has
 * not expired yet, and normalises the role. This just returns the result.
 *
 * GET -> { userId, email, role, kind, organizationId, talentProfileId }
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const actor = await getRequestUser(req);
  if (!actor) return res.status(401).json({ error: 'Not authenticated' });

  res.setHeader('Cache-Control', 'private, no-store');
  return res.status(200).json({
    // `id` as well as `userId`, because callers that used to read
    // the users row expect the column name.
    id: actor.userId,
    userId: actor.userId,
    email: actor.email,
    role: actor.role,
    kind: actor.kind,
    organizationId: actor.organizationId,
    talentProfileId: actor.talentProfileId
  });
}
