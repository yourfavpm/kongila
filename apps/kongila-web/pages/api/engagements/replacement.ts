import type { NextApiRequest, NextApiResponse } from 'next';
import { getRequestUser, requestPlacementReplacement } from '@kongila/database';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed.' });
  }
  const actor = await getRequestUser(req);
  if (!actor) return res.status(401).json({ error: 'Not authenticated.' });
  const result = await requestPlacementReplacement(actor, {
    assignmentId: String(req.body?.assignmentId || ''),
    reason: String(req.body?.reason || ''),
    notes: String(req.body?.notes || '')
  });
  return res.status(result.status).json(result.ok ? result : { error: result.error });
}
