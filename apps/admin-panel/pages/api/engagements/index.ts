import type { NextApiRequest, NextApiResponse } from 'next';
import { activateEngagement, getRequestUser, listEngagements } from '@kongila/database';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const actor = await getRequestUser(req);
  if (!actor) return res.status(401).json({ error: 'Not authenticated.' });
  if (req.method === 'GET') {
    const result = await listEngagements(actor);
    return res.status(result.status).json(result.ok ? { engagements: result.data } : { error: result.error });
  }
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed.' });
  const result = await activateEngagement(actor, req.body || {});
  return res.status(result.status).json(result.ok ? result : { error: result.error });
}
