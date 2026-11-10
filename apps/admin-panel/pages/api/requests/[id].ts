import type { NextApiRequest, NextApiResponse } from 'next';
import { canAccessRequest, getRequestUser, getSupabaseClient } from '@kongila/database';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const actor = await getRequestUser(req);
  if (!actor) return res.status(401).json({ error: 'Not authenticated' });
  if (actor.kind !== 'admin') return res.status(403).json({ error: 'Not authorised' });

  const requestId = String(req.query.id || '').trim();
  if (!requestId) return res.status(400).json({ error: 'Request id is required' });

  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('talent_requests')
    .select('*')
    .or(`id.eq.${requestId},payload->>id.eq.${requestId}`)
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('[requests/:id] load failed:', error.message);
    return res.status(500).json({ error: 'Could not load the request' });
  }
  if (!data) return res.status(404).json({ error: 'Request not found' });
  try {
    if (!await canAccessRequest(supabase, actor, data)) {
      return res.status(404).json({ error: 'Request not found' });
    }
  } catch (accessError: any) {
    console.error('[requests/:id] ownership lookup failed:', accessError.message);
    return res.status(500).json({ error: 'Could not verify request ownership.' });
  }

  return res.status(200).json(data);
}
