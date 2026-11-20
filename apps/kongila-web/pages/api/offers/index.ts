import type { NextApiRequest, NextApiResponse } from 'next';
import { getRequestUser, getSupabaseClient, complianceGate, setOfferMilestones } from '@kongila/database';
import { hasOfferCapacity, requestedHeadcount, serviceLineOf, milestonePlanProblem } from '@kongila/workflows';
import { requestTitle } from '@kongila/shared-types';

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
  const { data, error } = await supabase
    .from('client_profiles')
    .select('user_id')
    .eq('organization_id', actor.organizationId);
  if (error) throw new Error(`Could not verify company membership: ${error.message}`);
  const ids = (data || []).map((r: any) => String(r.user_id));
  if (!ids.includes(String(actor.userId))) ids.push(String(actor.userId));
  return ids;
}

/** Requests carry a row id and a payload id; both are accepted via bound filters. */
async function loadRequestById(
  supabase: any,
  requestId: string
): Promise<any | null> {
  const { data: rowMatch, error: rowError } = await supabase
    .from('talent_requests')
    .select('*')
    .eq('id', requestId)
    .maybeSingle();
  if (rowError) throw new Error(rowError.message);
  if (rowMatch) return rowMatch;

  const { data: payloadMatch, error: payloadError } = await supabase
    .from('talent_requests')
    .select('*')
    .eq('payload->>id', requestId)
    .maybeSingle();
  if (payloadError) throw new Error(payloadError.message);
  return payloadMatch || null;
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
    entryPoint,
    projectFeeUsd,
    milestones
  } = req.body || {};

  if (!requestId || !matchId || !talentId || !Number.isFinite(Number(proposedRateUsd)) || Number(proposedRateUsd) <= 0) {
    return res.status(400).json({
      error: 'requestId, matchId, talentId and a positive proposedRateUsd are required'
    });
  }

  const supabase = getSupabaseClient();

  try {
    const request = requestId ? await loadRequestById(supabase, String(requestId)) : null;
    if (requestId && !request) return res.status(404).json({ error: 'Request not found' });

    const requestStatus = String(request.payload?.status || request.status || '').toLowerCase().replace(/[_-]+/g, ' ');
    if (['closed', 'closed/cancelled', 'onboarding'].includes(requestStatus)) {
      return res.status(409).json({ error: `An offer cannot be created for a ${requestStatus} role` });
    }

    if (actor.kind === 'client') {
      const allowed = await orgUserIds(supabase, actor);
      if (!allowed.includes(String(request?.client_id))) {
        console.warn(`[api/offers] client ${actor.userId} attempted an offer on request ${requestId}`);
        return res.status(403).json({ error: 'Not authorised for this request' });
      }
    }

    const requestIds = Array.from(new Set([
      String(request.id),
      String(request.payload?.id || '')
    ].filter(Boolean)));
    const { data: match, error: matchError } = await supabase
      .from('matches')
      .select('id, request_id, talent_id, status')
      .eq('id', String(matchId))
      .maybeSingle();
    if (matchError) {
      console.error('[api/offers] match lookup failed:', matchError.message);
      return res.status(500).json({ error: 'Could not verify the candidate for this role' });
    }
    if (!match
      || String(match.talent_id) !== String(talentId)
      || !requestIds.includes(String(match.request_id))) {
      return res.status(403).json({ error: 'That candidate is not matched to this role' });
    }
    if (String(match.status).toLowerCase() === 'rejected') {
      return res.status(409).json({ error: 'An offer cannot be sent to a rejected candidate' });
    }

    const { data: candidateInterviews, error: interviewsError } = await supabase
      .from('interviews')
      .select('status')
      .in('request_id', requestIds)
      .eq('match_id', match.id)
      .eq('talent_id', talentId);
    if (interviewsError) {
      console.error('[api/offers] interview lookup failed:', interviewsError.message);
      return res.status(500).json({ error: 'Could not verify the interview history for this candidate' });
    }
    const completedInterview = (candidateInterviews || []).some(
      (interview: any) => String(interview.status).toLowerCase() === 'completed'
    );
    if (!completedInterview) {
      return res.status(409).json({ error: 'A completed interview is required before an offer can be created' });
    }

    // Validate compliance only after confirming the caller owns this
    // request and candidate association, so this endpoint cannot be used to
    // probe another candidate's compliance state.
    const refusal = await complianceGate('extend_offer', String(talentId));
    if (refusal) return res.status(409).json({ error: refusal });

    const roleTitle = requestTitle({
      ...(request.payload || {}),
      title: request.payload?.title || request.title
    });
    const serviceType = request.payload?.serviceType || request.service_type;
    if (!roleTitle || !serviceType) {
      return res.status(422).json({ error: 'The role request is missing its title or service type' });
    }

    // A project is bought as a set of deliverables, so its plan is part of
    // the offer rather than something operations works out afterwards. It is
    // checked here, before anything is written, so a project offer cannot
    // exist without one.
    const isProject = serviceLineOf(serviceType) === 'project';
    const projectFee = isProject
      ? Number(projectFeeUsd ?? proposedRateUsd)
      : 0;

    if (isProject) {
      const plan = Array.isArray(milestones) ? milestones : [];
      const problem = milestonePlanProblem(plan, projectFee);
      if (problem) return res.status(422).json({ error: problem });
    }

    if (requestId) {
      const { data: existingOffers, error: offersError } = await supabase
        .from('offers')
        .select('id')
        .in('request_id', requestIds)
        .in('status', ['draft', 'submitted', 'revision_requested', 'admin_approved', 'sent_to_talent', 'accepted', 'contract_active']);
      if (offersError) {
        console.error('[api/offers] existing offer lookup failed:', offersError.message);
        return res.status(500).json({ error: 'Could not verify how many hires are already in progress' });
      }

      const targetHires = requestedHeadcount(request.payload?.numberOfHires);
      const inProgress = existingOffers?.length || 0;
      if (!hasOfferCapacity(targetHires, inProgress)) {
        return res.status(409).json({
          error: `This role already has ${inProgress} offer(s) in progress for ${targetHires} requested hire(s).`
        });
      }
    }

    // One live offer or contract per candidate per request. Accepted offers
    // still occupy a hire slot and must not be reissued to the same person.
    const { data: existing, error: existingError } = await supabase
      .from('offers')
      .select('id, status')
      .eq('talent_id', talentId)
      .in('request_id', requestIds)
      .in('status', ['draft', 'submitted', 'revision_requested', 'admin_approved', 'sent_to_talent', 'accepted', 'contract_active'])
      .limit(1);
    if (existingError) {
      console.error('[api/offers] candidate offer lookup failed:', existingError.message);
      return res.status(500).json({ error: 'Could not verify whether this candidate already has an offer' });
    }

    if (existing && existing.length > 0) {
      return res.status(409).json({
        error: 'There is already an open offer for this candidate on this request.',
        offerId: existing[0].id,
        status: existing[0].status
      });
    }

    const insertRow: Record<string, any> = {
      request_id: request.id,
      match_id: match.id,
      client_id: request.client_id,
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
      project_fee_usd: isProject ? projectFee : null,
      client_note_to_admin: clientNote || null
    };

    const { data: offer, error } = await supabase
      .from('offers')
      .insert(insertRow)
      .select()
      .single();

    if (error) {
      // project_fee_usd arrives with the 2026-11-20 migration. Without it a
      // project offer still carries its fee in proposed_rate_usd, so retry
      // rather than refusing the offer outright.
      if (isProject && /project_fee_usd/.test(String(error.message))) {
        const { data: retried, error: retryError } = await supabase
          .from('offers')
          .insert({ ...insertRow, project_fee_usd: undefined })
          .select()
          .single();
        if (retryError) {
          console.error('[api/offers] insert failed:', retryError.message);
          return res.status(500).json({ error: `Could not create the offer: ${retryError.message}` });
        }
        return res.status(201).json({
          ok: true,
          offer: retried,
          warnings: ['This database has not had the 2026-11-20 offer milestones migration run, so '
            + 'the delivery plan was not saved with the offer.']
        });
      }
      console.error('[api/offers] insert failed:', error.message);
      return res.status(500).json({ error: `Could not create the offer: ${error.message}` });
    }

    const warnings: string[] = [];

    if (isProject && offer?.id) {
      // The offer exists, so a plan that fails to save is a warning rather
      // than a failure: operations can set it during review, and losing the
      // offer would mean the client re-entering everything.
      const saved = await setOfferMilestones(actor, {
        offerId: String(offer.id),
        milestones: Array.isArray(milestones) ? milestones : []
      });
      if (!saved.ok) {
        console.error('[api/offers] milestone plan not saved:', saved.error);
        warnings.push(`The offer was created but its delivery plan was not saved: ${saved.error}`);
      }
    }

    return res.status(201).json({ ok: true, offer, warnings });
  } catch (error: any) {
    console.error('[api/offers] unexpected failure:', error);
    return res.status(500).json({ error: error.message || 'Could not create the offer' });
  }
}
