import type { NextApiRequest, NextApiResponse } from 'next';
import { getRequestUser, requirePermission, updateContractTerms } from '@kongila/database';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed.' });
  const actor = await getRequestUser(req);
  const refused = requirePermission(actor, 'contracts.manage');
  if (refused) return res.status(refused.status).json({ error: refused.error });
  const result = await updateContractTerms(actor!, req.body || {});
  return res.status(result.status).json(result.ok ? result.data : { error: result.error });
}
