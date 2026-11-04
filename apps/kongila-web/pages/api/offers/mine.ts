import type { NextApiRequest, NextApiResponse } from 'next';
import { getRequestUser, getSupabaseClient } from '@kongila/database';

/**
 * The offers a candidate can actually act on.
 *
 * A dedicated endpoint rather than another table bolted onto readDbAsync,
 * which already reads around thirty tables on every poll. This reads one
 * table, filtered to one candidate.
 *
 * Only offers that have been sent are returned. A draft, or one still waiting
 * on Kongila's approval, is not the candidate's business yet.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const actor = await getRequestUser(req);
  if (!actor) return res.status(401).json({ error: 'Not authenticated' });
  if (actor.kind !== 'talent') return res.status(403).json({ error: 'Not authorised' });
  if (!actor.talentProfileId) return res.status(200).json({ offers: [] });

  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('offers')
    .select('*')
    .eq('talent_id', actor.talentProfileId)
    .in('status', ['sent_to_talent', 'accepted', 'declined', 'expired', 'contract_active'])
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[offers/mine] read failed:', error.message);
    return res.status(500).json({ error: `Could not load your offers: ${error.message}` });
  }

  const now = Date.now();
  const offers = (data || []).map((offer: any) => ({
    ...offer,
    // Derived rather than stored, so a lapsed deadline reads as expired even
    // before anything has written that status.
    isExpired:
      offer.status === 'expired' ||
      (offer.status === 'sent_to_talent' &&
        offer.talent_response_deadline &&
        new Date(offer.talent_response_deadline).getTime() < now),
    canRespond:
      offer.status === 'sent_to_talent' &&
      (!offer.talent_response_deadline ||
        new Date(offer.talent_response_deadline).getTime() >= now)
  }));

  return res.status(200).json({ offers });
}
