import type { NextApiRequest, NextApiResponse } from 'next';
import { getRequestUser, getSupabaseClient } from '@kongila/database';
import { normalizeRequestStatus } from '@kongila/workflows';

function toRequest(row: any) {
  return {
    ...(row.payload || {}),
    rowId: row.id,
    clientId: row.client_id,
    serviceType: row.payload?.serviceType || row.service_type,
    status: normalizeRequestStatus(row.payload?.status || row.status) || 'New Request',
    createdAt: row.payload?.createdAt || row.created_at
  };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const actor = await getRequestUser(req);
  if (!actor) return res.status(401).json({ error: 'Not authenticated' });
  if (actor.kind !== 'admin') return res.status(403).json({ error: 'Not authorised' });

  const { data, error } = await getSupabaseClient()
    .from('talent_requests')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[admin requests] list failed:', error.message);
    return res.status(500).json({ error: 'Could not load requests' });
  }

  return res.status(200).json({ requests: (data || []).map(toRequest) });
}
