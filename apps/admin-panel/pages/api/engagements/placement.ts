import type { NextApiRequest, NextApiResponse } from 'next';
import { getRequestUser } from '@kongila/database';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed.' });
  const actor = await getRequestUser(req);
  if (!actor) return res.status(401).json({ error: 'Not authenticated.' });
  return res.status(410).json({ error: 'Invoice preparation is separate from engagement activation. Prepare the invoice from the contract, then activate the engagement after signatures.' });
}
