import type { NextApiRequest, NextApiResponse } from 'next';
import { getRequestUser, getSupabaseClient, recordAudit } from '@kongila/database';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const actor = await getRequestUser(req);
  if (!actor) return res.status(401).json({ error: 'Not authenticated' });

  if (req.method === 'GET') {
    if (actor.kind !== 'client' && actor.kind !== 'talent') {
      return res.status(403).json({ error: 'Not authorised' });
    }

    const supabase = getSupabaseClient();
    const query = supabase.from('contracts').select('*').order('created_at', { ascending: false });
    const { data, error } = actor.kind === 'talent'
      ? await query.eq('talent_id', actor.talentProfileId || actor.userId)
      : await query.eq('client_id', actor.userId);

    if (error) {
      console.error('[contracts] list failed:', error.message);
      return res.status(500).json({ error: 'Could not load contracts' });
    }
    return res.status(200).json({ contracts: data || [] });
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (actor.kind !== 'client') return res.status(403).json({ error: 'Only clients can create contracts' });

  const { talentId, requestId, serviceType, roleTitle, startDate, budget } = req.body || {};
  if (!talentId || !requestId) return res.status(400).json({ error: 'talentId and requestId are required' });
  const monthlyRate = Number(budget);
  if (!Number.isFinite(monthlyRate) || monthlyRate <= 0) return res.status(422).json({ error: 'A positive contract rate is required' });

  const supabase = getSupabaseClient();
  const { data: requestRows, error: requestError } = await supabase
    .from('talent_requests').select('id, client_id, service_type, payload').eq('client_id', actor.userId);
  if (requestError) return res.status(500).json({ error: 'Could not verify the request' });
  const request = (requestRows || []).find((row: any) => String(row.id) === String(requestId) || String(row.payload?.id || '') === String(requestId));
  if (!request) return res.status(404).json({ error: 'Request not found' });

  const { data: contract, error } = await supabase.from('contracts').insert({
    client_id: actor.userId,
    talent_id: String(talentId),
    service_type: String(serviceType || request.service_type || 'Hire Talent'),
    start_date: startDate || null,
    status: 'pending',
    // contracts_rate_type_check takes Hourly or Monthly, capitalised.
    // 'monthly' was refused, so no contract was ever created here.
    rate_type: 'Monthly',
    rate_amount: monthlyRate,
    monthly_rate: monthlyRate,
    monthly_rate_usd: monthlyRate,
    engagement_model: 'Full-time',
    entry_point: 'client_dashboard'
  }).select('*').single();
  if (error) {
    console.error('[contracts] create failed:', error.message);
    return res.status(500).json({ error: 'Could not create the contract' });
  }
  await recordAudit(actor, { action: 'Create Contract', details: `Created contract for ${roleTitle || request.payload?.roleDescription || 'requested role'}.`, entityType: 'contract', entityId: String(contract.id) });
  return res.status(201).json({ contract });
}
