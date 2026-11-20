import type { NextApiRequest, NextApiResponse } from 'next';
import { completeProjectEngagement, completeProjectMilestone, getRequestUser, invoiceProjectMilestone } from '@kongila/database';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed.' });
  const actor = await getRequestUser(req);
  if (!actor) return res.status(401).json({ error: 'Not authenticated.' });
  const result = req.body?.action === 'complete_project'
    ? await completeProjectEngagement(actor, String(req.body?.projectId || ''))
    : req.body?.action === 'complete'
      ? await completeProjectMilestone(actor, String(req.body?.milestoneId || ''))
      : await invoiceProjectMilestone(actor, String(req.body?.milestoneId || ''));
  return res.status(result.status).json(result.ok ? result : { error: result.error });
}
