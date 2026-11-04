import type { NextApiRequest, NextApiResponse } from 'next';
import { getRequestUser, getSupabaseClient, complianceGate } from '@kongila/database';

/**
 * Creating an offer.
 *
 * Until now an offer was a status string on a match, written as both
 * 'Offer Extended' and 'offer_extended', neither of which is legal under the
 * matches CHECK constraint, so nothing persisted. The hire button wrote a
 * contract straight away, skipping the offer entirely and producing a
 * contract the candidate had never seen, let alone agreed to.
 *
 * The offers table was designed for this and nothing ever wrote to it. The
 * lifecycle its enum models is:
 *
 *   draft → submitted → admin_approved → sent_to_talent → accepted
 *                    ↘ revision_requested    ↘ declined / expired
 *                    ↘ admin_declined
 *
 * A client submits; Kongila approves and sends, because Kongila is the
 * employer of record and owns the commercial terms; the candidate responds.
 * A contract is created on acceptance, not before.
 */

/** Every user id in this client's organisation. */
async function orgUserIds(supabase: any, actor: any): Promise<string[]> {
  if (!actor.organizationId) return [actor.userId];
  const { data } = await supabase
    .from('client_profiles')
    .select('user_id')
    .eq('organization_id', actor.organizationId);
  const ids = (data || []).map((r: any) => String(r.user_id));
  if (!ids.includes(String(actor.userId))) ids.push(String(actor.userId));
  return ids;
}

/** Requests carry a row id and a payload id; both are accepted rather than guessed. */
async function requestBelongsToActor(
  supabase: any,
  requestId: string,
  allowedClientIds: string[]
): Promise<boolean> {
  const { data, error } = await supabase
    .from('talent_requests')
    .select('id, client_id')
    .or(`id.eq.${requestId},payload->>id.eq.${requestId}`)
    .limit(5);
  if (error || !data || data.length === 0) return false;
  return data.some((row: any) => allowedClientIds.includes(String(row.client_id)));
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const actor = await getRequestUser(req);
  if (!actor) return res.status(401).json({ error: 'Not authenticated' });
  if (actor.kind === 'talent') return res.status(403).json({ error: 'Not authorised' });

  const {
    requestId,
    matchId,
    talentId,
    roleTitle,
    serviceType,
    proposedRateUsd,
    engagementType,
    hoursPerWeek,
    proposedStartDate,
    contractDurationType,
    contractMonths,
    paymentModel,
    paymentPeriod,
    paymentDueDay,
    clientNote,
    entryPoint
  } = req.body || {};

  // role_title, service_type and proposed_rate_usd are NOT NULL on the table.
  if (!talentId || !roleTitle || !serviceType || proposedRateUsd === undefined) {
    return res.status(400).json({
      error: 'talentId, roleTitle, serviceType and proposedRateUsd are required'
    });
  }

  const supabase = getSupabaseClient();

  try {
    // An offer cannot go to a candidate with outstanding compliance
    // documents. The gate used to be a banner on the candidate's own
    // dashboard, which blocked nothing.
    const refusal = await complianceGate('extend_offer', String(talentId));
    if (refusal) return res.status(409).json({ error: refusal });

    if (actor.kind === 'client') {
      if (!requestId) return res.status(400).json({ error: 'requestId is required' });
      const allowed = await orgUserIds(supabase, actor);
      if (!(await requestBelongsToActor(supabase, String(requestId), allowed))) {
        console.warn(`[api/offers] client ${actor.userId} attempted an offer on request ${requestId}`);
        return res.status(403).json({ error: 'Not authorised for this request' });
      }
    }

    // One live offer per candidate per request. Without this, clicking the
    // button twice creates two offers the candidate can both accept.
    const { data: existing } = await supabase
      .from('offers')
      .select('id, status')
      .eq('talent_id', talentId)
      .eq('request_id', requestId || null)
      .in('status', ['draft', 'submitted', 'revision_requested', 'admin_approved', 'sent_to_talent'])
      .limit(1);

    if (existing && existing.length > 0) {
      return res.status(409).json({
        error: 'There is already an open offer for this candidate on this request.',
        offerId: existing[0].id,
        status: existing[0].status
      });
    }

    const { data: offer, error } = await supabase
      .from('offers')
      .insert({
        request_id: requestId || null,
        match_id: matchId || null,
        client_id: actor.kind === 'client' ? actor.userId : null,
        talent_id: talentId,
        initiated_by: actor.kind === 'admin' ? 'admin' : 'client',
        entry_point: entryPoint || 'matched_talent_page',
        // A client submits for approval. Operations can send their own
        // directly, since they are the ones who would approve it.
        status: actor.kind === 'admin' ? 'admin_approved' : 'submitted',
        role_title: roleTitle,
        service_type: serviceType,
        engagement_type: engagementType || null,
        hours_per_week: hoursPerWeek || null,
        proposed_start_date: proposedStartDate || null,
        contract_duration_type: contractDurationType || null,
        contract_months: contractMonths || null,
        payment_model: paymentModel || 'flat_rate',
        payment_period: paymentPeriod || 'monthly',
        payment_due_day: paymentDueDay || null,
        proposed_rate_usd: proposedRateUsd,
        client_note_to_admin: clientNote || null
      })
      .select()
      .single();

    if (error) {
      console.error('[api/offers] insert failed:', error.message);
      return res.status(500).json({ error: `Could not create the offer: ${error.message}` });
    }

    return res.status(201).json({ ok: true, offer });
  } catch (error: any) {
    console.error('[api/offers] unexpected failure:', error);
    return res.status(500).json({ error: error.message || 'Could not create the offer' });
  }
}
