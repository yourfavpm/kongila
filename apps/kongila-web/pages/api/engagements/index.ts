import type { NextApiRequest, NextApiResponse } from 'next';
import { getRequestUser, listEngagements } from '@kongila/database';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed.' });
  const actor = await getRequestUser(req);
  const result = await listEngagements(actor);
  return res.status(result.status).json(result.ok ? { engagements: result.data } : { error: result.error });
}
