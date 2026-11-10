import type { NextApiRequest, NextApiResponse } from 'next';
import { getRequestUser, respondToRequestCall } from '@kongila/database';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const actor = await getRequestUser(req);
  if (!actor) return res.status(401).json({ error: 'Not authenticated' });

  const result = await respondToRequestCall(actor, req.body || {});
  if (!result.ok) return res.status(result.status).json({ error: result.error });
  return res.status(result.status).json({
    ok: true,
    callRequest: result.data,
    warnings: result.warnings || []
  });
}
