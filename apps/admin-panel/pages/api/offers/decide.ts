import type { NextApiRequest, NextApiResponse } from 'next';
import { getRequestUser, getSupabaseClient, complianceGate } from '@kongila/database';

/**
 * Operations approving, sending, declining or returning a client's offer.
 *
 * Kongila is the employer of record, so the commercial terms are Kongila's to
 * approve before a candidate ever sees them. The offers enum models this
 * directly: submitted → admin_approved → sent_to_talent, with
 * revision_requested and admin_declined as the other ways out.
 *
 * Sending is also the point where the response clock starts. Nothing else
 * sets talent_response_deadline, which is why the column has sat unused.
 */

const DEFAULT_RESPONSE_DAYS = 5;

/** Which statuses each action may act on, so an offer cannot be sent twice. */
const ALLOWED_FROM: Record<string, string[]> = {
  approve: ['submitted', 'revision_requested'],
  send: ['submitted', 'admin_approved', 'revision_requested'],
  request_revision: ['submitted', 'admin_approved'],
  decline: ['submitted', 'admin_approved', 'revision_requested']
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const actor = await getRequestUser(req);
  if (!actor) return res.status(401).json({ error: 'Not authenticated' });
  if (actor.kind !== 'admin') {
    console.warn(`[offers/decide] refused ${actor.kind} ${actor.userId}`);
    return res.status(403).json({ error: 'Not authorised' });
  }

  const { offerId, action, note, responseDays } = req.body || {};
  if (!offerId || !ALLOWED_FROM[String(action)]) {
    return res.status(400).json({
      error: 'offerId and an action of approve, send, request_revision or decline are required'
    });
  }

  const supabase = getSupabaseClient();

  try {
    const { data: offer, error: loadError } = await supabase
      .from('offers')
      .select('id, status, talent_id')
      .eq('id', offerId)
      .maybeSingle();

    if (loadError) throw new Error(loadError.message);
    if (!offer) return res.status(404).json({ error: 'Offer not found' });

    const from = String(offer.status);
    if (!ALLOWED_FROM[String(action)].includes(from)) {
      return res.status(409).json({
        error: `An offer at "${from.replace(/_/g, ' ')}" cannot be ${String(action).replace(/_/g, ' ')}d.`
      });
    }

    const now = new Date().toISOString();
    const patch: Record<string, any> = { updated_at: now };

    if (action === 'approve') {
      patch.status = 'admin_approved';
    } else if (action === 'send') {
      // Sending the offer is the moment it reaches the candidate, so this is
      // the last point the compliance gate can stop it.
      const refusal = await complianceGate('extend_offer', String(offer.talent_id));
      if (refusal) return res.status(409).json({ error: refusal });

      const days = Number(responseDays) > 0 ? Number(responseDays) : DEFAULT_RESPONSE_DAYS;
      patch.status = 'sent_to_talent';
      patch.sent_to_talent_at = now;
      patch.talent_response_deadline = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
    } else if (action === 'request_revision') {
      patch.status = 'revision_requested';
      patch.loop_count = (offer as any).loop_count ? (offer as any).loop_count + 1 : 1;
    } else if (action === 'decline') {
      patch.status = 'admin_declined';
    }

    if (note) patch.admin_note_internal = note;

    const { error: updateError } = await supabase.from('offers').update(patch).eq('id', offerId);
    if (updateError) {
      console.error('[offers/decide] update failed:', updateError.message);
      return res.status(500).json({ error: `Could not update the offer: ${updateError.message}` });
    }

    const { error: auditError } = await supabase.from('audit_logs').insert({
      actor: actor.email || actor.userId,
      action: `Offer ${action}`,
      details: `Offer ${offerId}: ${from} to ${patch.status}${note ? ` — ${note}` : ''}`,
      timestamp: now
    });
    if (auditError) console.warn('[offers/decide] audit entry not written:', auditError.message);

    return res.status(200).json({
      ok: true,
      from,
      to: patch.status,
      respondBy: patch.talent_response_deadline || null
    });
  } catch (error: any) {
    console.error('[offers/decide] unexpected failure:', error);
    return res.status(500).json({ error: error.message || 'Could not update the offer' });
  }
}
