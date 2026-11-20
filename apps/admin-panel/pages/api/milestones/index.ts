import type { NextApiRequest, NextApiResponse } from 'next';
import {
  requirePermission,
  getRequestUser,
  listMilestones,
  setMilestones,
  deliverMilestone
} from '@kongila/database';

/**
 * A project's milestone plan, and signing one off.
 *
 * Reading is behind the contracts screen. Writing is behind
 * contracts.manage, because marking a milestone delivered raises an invoice,
 * and anyone who can raise an invoice can bill a client.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const actor = await getRequestUser(req);
  if (!actor) return res.status(401).json({ error: 'Not authenticated' });

  const refused = requirePermission(
    actor,
    req.method === 'GET' ? 'view:contracts' : 'contracts.manage'
  );
  if (refused) return res.status(refused.status).json({ error: refused.error });

  if (req.method === 'GET') {
    const result = await listMilestones(actor, String(req.query.contractId || ''));
    if (!result.ok) return res.status(result.status).json({ error: result.error });
    res.setHeader('Cache-Control', 'private, no-store');
    return res.status(200).json({ ...result.data, warnings: result.warnings || [] });
  }

  if (req.method === 'POST') {
    const body = (req.body || {}) as Record<string, any>;

    const result = body.action === 'deliver'
      ? await deliverMilestone(actor, {
          milestoneId: String(body.milestoneId || ''),
          note: body.note ? String(body.note) : undefined
        })
      : await setMilestones(actor, {
          contractId: String(body.contractId || ''),
          milestones: Array.isArray(body.milestones) ? body.milestones : []
        });

    if (!result.ok) return res.status(result.status).json({ error: result.error });
    return res.status(result.status).json({ ...result.data, warnings: result.warnings || [] });
  }

  res.setHeader('Allow', 'GET, POST');
  return res.status(405).json({ error: 'Method not allowed' });
}
