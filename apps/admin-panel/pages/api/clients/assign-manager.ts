import type { NextApiRequest, NextApiResponse } from 'next';
import { getRequestUser, assignAccountManager, assignTalentManager } from '@kongila/database';

/**
 * Setting a client company's account manager.
 *
 * The page did this with four browser writes: a roles upsert, a user_roles
 * upsert, an organizations update and an audit insert. RLS is off on the
 * first three in the live database, so an admin browser could grant a role
 * link to any user id it named, and the audit entry named 'Super Admin'
 * whoever was signed in.
 *
 * POST { organizationId, userId, reason? }
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const actor = await getRequestUser(req);
  if (!actor) return res.status(401).json({ error: 'Not authenticated' });

  const body = (req.body || {}) as Record<string, any>;
  // A candidate's talent manager goes through the same route.
  const result = body.talentId
    ? await assignTalentManager(actor, { talentId: body.talentId, managerId: body.userId })
    : await assignAccountManager(actor, {
        organizationId: body.organizationId,
        userId: body.userId,
        reason: body.reason
      });

  if (!result.ok) return res.status(result.status).json({ error: result.error });
  return res.status(200).json({ ...result.data, warnings: result.warnings });
}
