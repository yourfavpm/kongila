import type { NextApiRequest, NextApiResponse } from 'next';
import { getRequestUser } from '@kongila/database';

/**
 * Who the caller is, resolved server-side.
 *
 * This app read public.users from the browser to find its own role. With
 * RLS on that table the read returns nothing, and it was never the right
 * way to do it: getRequestUser takes the id from the verified token.
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
    id: actor.userId, userId: actor.userId, email: actor.email,
    role: actor.role, kind: actor.kind
  });
}
