import type { NextApiRequest, NextApiResponse } from 'next';
import { getRequestUser, getSupabaseClient } from '@kongila/database';

/**
 * The offer queue operations work from.
 *
 * Reads one table rather than going through readDbAsync, which pulls around
 * thirty. Candidate and company names are resolved in a second pass so the
 * queue is readable without the operator opening each offer.
 */

const OPEN_STATUSES = [
  'submitted',
  'admin_approved',
  'revision_requested',
  'sent_to_talent'
];

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const actor = await getRequestUser(req);
  if (!actor) return res.status(401).json({ error: 'Not authenticated' });
  if (actor.kind !== 'admin') return res.status(403).json({ error: 'Not authorised' });

  const supabase = getSupabaseClient();
  const scope = String(req.query.scope || 'open');

  try {
    let query = supabase.from('offers').select('*').order('created_at', { ascending: false });
    if (scope === 'open') query = query.in('status', OPEN_STATUSES);

    const { data: offers, error } = await query;
    if (error) {
      console.error('[admin offers] read failed:', error.message);
      return res.status(500).json({ error: `Could not load offers: ${error.message}` });
    }

    const rows = offers || [];
    if (rows.length === 0) return res.status(200).json({ offers: [] });

    // Resolve names in two lookups rather than per row.
    const talentIds = [...new Set(rows.map((o: any) => o.talent_id).filter(Boolean))];
    const clientIds = [...new Set(rows.map((o: any) => o.client_id).filter(Boolean))];

    const [{ data: talents }, { data: profiles }] = await Promise.all([
      talentIds.length
        ? supabase.from('talent_profiles').select('id, full_name').in('id', talentIds)
        : Promise.resolve({ data: [] as any[] }),
      clientIds.length
        ? supabase.from('client_profiles').select('user_id, organization_id').in('user_id', clientIds)
        : Promise.resolve({ data: [] as any[] })
    ]);

    const orgIds = [...new Set((profiles || []).map((p: any) => p.organization_id).filter(Boolean))];
    const { data: orgs } = orgIds.length
      ? await supabase.from('organizations').select('id, name').in('id', orgIds)
      : { data: [] as any[] };

    const talentName = new Map((talents || []).map((t: any) => [String(t.id), t.full_name]));
    const orgName = new Map((orgs || []).map((o: any) => [String(o.id), o.name]));
    const orgForUser = new Map(
      (profiles || []).map((p: any) => [String(p.user_id), orgName.get(String(p.organization_id)) || null])
    );

    const now = Date.now();
    return res.status(200).json({
      offers: rows.map((offer: any) => ({
        ...offer,
        talentName: talentName.get(String(offer.talent_id)) || 'Unknown candidate',
        clientName: orgForUser.get(String(offer.client_id)) || 'Unknown company',
        isOverdue:
          offer.status === 'sent_to_talent' &&
          offer.talent_response_deadline &&
          new Date(offer.talent_response_deadline).getTime() < now
      }))
    });
  } catch (error: any) {
    console.error('[admin offers] unexpected failure:', error);
    return res.status(500).json({ error: error.message || 'Could not load offers' });
  }
}
