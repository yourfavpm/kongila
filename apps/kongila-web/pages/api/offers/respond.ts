import type { NextApiRequest, NextApiResponse } from 'next';
import { getRequestUser, getSupabaseClient, notifyAdmins, notifyUsers } from '@kongila/database';
import { matchingProgressStatus } from '@kongila/workflows';

/**
 * The candidate accepts or declines an offer.
 *
 * There was no way to do either, anywhere in the product. The talent portal
 * inferred acceptance from the existence of a contract row, so a contract
 * that operations had merely drafted showed to the candidate as a placement
 * they had agreed to.
 *
 * On acceptance a contract is created. That is the only path that creates one
 * from an offer, so a contract always has a candidate who said yes behind it.
 */

const RESPONDABLE = new Set(['sent_to_talent']);

async function advanceRequestStage(
  supabase: any,
  requestId: string | null,
  event: 'offer_accepted' | 'offer_declined'
): Promise<string | null> {
  if (!requestId) return null;

  let { data: request, error } = await supabase
    .from('talent_requests')
    .select('*')
    .eq('id', requestId)
    .maybeSingle();
  if (error) return `The offer response was saved, but its role request could not be loaded: ${error.message}`;
  if (!request) {
    const result = await supabase
      .from('talent_requests')
      .select('*')
      .eq('payload->>id', requestId)
      .maybeSingle();
    request = result.data;
    error = result.error;
  }
  if (error) return `The offer response was saved, but its role request could not be loaded: ${error.message}`;
  if (!request) return 'The offer response was saved, but its role request no longer exists.';

  if (event === 'offer_declined') {
    const requestIds = Array.from(new Set([
      String(request.id),
      String(request.payload?.id || '')
    ].filter(Boolean)));
    const { data: acceptedOffers, error: offersError } = await supabase
      .from('offers')
      .select('id')
      .in('request_id', requestIds)
      .in('status', ['accepted', 'contract_active']);
    if (offersError) {
      return `The offer response was saved, but other accepted offers could not be checked: ${offersError.message}`;
    }
    if (acceptedOffers?.length) return null;
  }

  const payload = { ...(request.payload || {}) };
  const nextStatus = matchingProgressStatus(
    payload.status || request.status,
    event
  );
  if (!nextStatus) return null;

  payload.status = nextStatus;
  const { error: updateError } = await supabase
    .from('talent_requests')
    .update({
      payload,
      status: nextStatus.toLowerCase().replace(/ /g, '_')
    })
    .eq('id', request.id);
  return updateError
    ? `The offer response was saved, but the role stage did not update: ${updateError.message}`
    : null;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const actor = await getRequestUser(req);
  if (!actor) return res.status(401).json({ error: 'Not authenticated' });
  if (actor.kind !== 'talent') {
    return res.status(403).json({ error: 'Only the candidate can respond to an offer' });
  }

  const { offerId, decision, reason } = req.body || {};
  if (!offerId || !['accept', 'decline'].includes(String(decision))) {
    return res.status(400).json({ error: 'offerId and a decision of accept or decline are required' });
  }

  const supabase = getSupabaseClient();

  try {
    const { data: offer, error: loadError } = await supabase
      .from('offers')
      .select('*')
      .eq('id', offerId)
      .maybeSingle();

    if (loadError) throw new Error(loadError.message);
    if (!offer) return res.status(404).json({ error: 'Offer not found' });

    // The candidate on the offer, not whoever asked.
    if (String(offer.talent_id) !== String(actor.talentProfileId)) {
      console.warn(`[offers/respond] talent ${actor.userId} attempted to answer offer ${offerId}`);
      return res.status(403).json({ error: 'This offer is not yours' });
    }

    if (!RESPONDABLE.has(String(offer.status))) {
      return res.status(409).json({
        error: `This offer is ${String(offer.status).replace(/_/g, ' ')} and cannot be answered.`
      });
    }

    // An expired offer is answered by the clock, not the candidate.
    if (offer.talent_response_deadline && new Date(offer.talent_response_deadline) < new Date()) {
      const { error: expiryError } = await supabase
        .from('offers')
        .update({ status: 'expired', updated_at: new Date().toISOString() })
        .eq('id', offerId)
        .eq('status', 'sent_to_talent');
      if (expiryError) return res.status(500).json({ error: `Could not expire this offer: ${expiryError.message}` });
      return res.status(409).json({ error: 'This offer has expired. Ask your talent manager for a new one.' });
    }

    const now = new Date().toISOString();

    // ── Decline ──────────────────────────────────────────────────────────────
    if (decision === 'decline') {
      const { data: declined, error } = await supabase
        .from('offers')
        .update({ status: 'declined', talent_decline_reason: reason || null, updated_at: now })
        .eq('id', offerId)
        .eq('status', 'sent_to_talent')
        .select('id')
        .maybeSingle();
      if (error) {
        console.error('[offers/respond] decline failed:', error.message);
        return res.status(500).json({ error: `Could not record your response: ${error.message}` });
      }
      if (!declined) return res.status(409).json({ error: 'This offer has already been answered.' });
      const stageWarning = await advanceRequestStage(supabase, offer.request_id, 'offer_declined');
      const roleTitle = offer.role_title || 'the role';
      const notice = offer.client_id
        ? await notifyUsers(String(offer.client_id), 'offer_declined', {
            roleTitle,
            reason: String(reason || '').trim() || undefined
          }, { sourceRecordId: String(offer.id) })
        : { warnings: ['The client could not be notified because this offer has no client.'] };
      const opsNotice = await notifyAdmins('offer_declined', {
        roleTitle,
        reason: String(reason || '').trim() || undefined
      }, { sourceRecordId: String(offer.id) });
      const warnings = [...notice.warnings, ...opsNotice.warnings];
      if (stageWarning) warnings.push(stageWarning);
      return res.status(200).json({
        ok: true,
        status: 'declined',
        warnings
      });
    }

    // ── Accept ───────────────────────────────────────────────────────────────
    const { data: accepted, error: acceptError } = await supabase
      .from('offers')
      .update({ status: 'accepted', accepted_at: now, updated_at: now })
      .eq('id', offerId)
      .eq('status', 'sent_to_talent')
      .select('id')
      .maybeSingle();

    if (acceptError) {
      console.error('[offers/respond] accept failed:', acceptError.message);
      return res.status(500).json({ error: `Could not record your response: ${acceptError.message}` });
    }
    if (!accepted) return res.status(409).json({ error: 'This offer has already been answered.' });

    const warnings: string[] = [];
    const stageWarning = await advanceRequestStage(supabase, offer.request_id, 'offer_accepted');
    if (stageWarning) warnings.push(stageWarning);
    if (offer.match_id) {
      const { error: matchError } = await supabase
        .from('matches')
        .update({ status: 'accepted' })
        .eq('id', offer.match_id)
        .eq('talent_id', offer.talent_id);
      if (matchError) warnings.push(`Your acceptance was recorded, but the match stage did not update: ${matchError.message}`);
    }
    const roleTitle = offer.role_title || 'the role';
    const notice = offer.client_id
      ? await notifyUsers(String(offer.client_id), 'offer_accepted', {
          roleTitle
        }, { sourceRecordId: String(offer.id) })
      : { warnings: ['The client could not be notified because this offer has no client.'] };
    const opsNotice = await notifyAdmins('offer_accepted', {
      roleTitle
    }, { sourceRecordId: String(offer.id) });
    warnings.push(...notice.warnings, ...opsNotice.warnings);

    // The contract exists because a candidate accepted, never before.
    const { data: contract, error: contractError } = await supabase
      .from('contracts')
      .insert({
        offer_id: offer.id,
        talent_id: offer.talent_id,
        client_id: offer.client_id,
        service_type: offer.service_type,
        rate_type: offer.payment_model === 'hourly' ? 'Hourly' : 'Monthly',
        rate_amount: offer.proposed_rate_usd,
        start_date: offer.proposed_start_date,
        status: 'pending'
      })
      .select()
      .single();

    if (contractError) {
      // The acceptance stands. Operations can issue the contract manually.
      console.error('[offers/respond] contract creation failed:', contractError.message);
      warnings.push(`Your acceptance was recorded, but the contract was not created: ${contractError.message}`);
    } else {
      const { error: linkError } = await supabase
        .from('offers')
        .update({ status: 'contract_active', updated_at: new Date().toISOString() })
        .eq('id', offerId);
      if (linkError) warnings.push(`Contract created, but the offer status did not update: ${linkError.message}`);
    }

    return res.status(200).json({ ok: true, status: 'accepted', contract: contract || null, warnings });
  } catch (error: any) {
    console.error('[offers/respond] unexpected failure:', error);
    return res.status(500).json({ error: error.message || 'Could not record your response' });
  }
}
