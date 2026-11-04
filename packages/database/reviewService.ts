/**
 * A client's review of a candidate they have worked with.
 *
 * The review modal stored nothing. It inserted two rows into
 * `notifications` addressed to the client who wrote them, one of them
 * labelled confidential, with the rating written into the message text.
 * RLS is on with no policy on that table, so the browser insert was denied
 * and neither row was ever written; the modal said "securely synchronized"
 * and closed.
 *
 * Reviews now have a table of their own, `client_talent_reviews`, added by
 * the 2026-11-04 migration. Private feedback goes to operations and is
 * never returned to a candidate.
 */

import { getSupabaseClient } from './index';
import type { RequestActor as Actor } from './scope';
import { notifyAdmins } from './notify';

export interface ReviewResult<T = any> {
  ok: boolean;
  status: number;
  error?: string;
  data?: T;
  warnings?: string[];
}

function fail(status: number, error: string): ReviewResult {
  return { ok: false, status, error };
}

/** A 1 to 5 score, or null when it was not given. */
function score(value: unknown, required = false): number | null | 'bad' {
  if (value === undefined || value === null || value === '') return required ? 'bad' : null;
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1 || number > 5) return 'bad';
  return number;
}

const MAX_FEEDBACK = 5000;

/**
 * Records or replaces a review.
 *
 * One review per client per candidate, enforced by a unique index, so a
 * client revising their view updates it rather than stacking duplicates
 * into whatever averages them.
 */
export async function submitTalentReview(
  actor: Actor,
  input: {
    talentId: string;
    contractId?: string | null;
    rating: unknown;
    technicalScore?: unknown;
    communicationScore?: unknown;
    reliabilityScore?: unknown;
    publicFeedback?: string | null;
    privateFeedback?: string | null;
    isAnonymous?: boolean;
  }
): Promise<ReviewResult> {
  if (!actor) return fail(401, 'Not authenticated.');
  if (actor.kind !== 'client') return fail(403, 'Only a client reviews a candidate.');

  const talentId = String(input.talentId || '').trim();
  if (!talentId) return fail(400, 'Which candidate?');

  const rating = score(input.rating, true);
  if (rating === 'bad') return fail(422, 'A rating from 1 to 5 is required.');

  const technical = score(input.technicalScore);
  const communication = score(input.communicationScore);
  const reliability = score(input.reliabilityScore);
  if (technical === 'bad' || communication === 'bad' || reliability === 'bad') {
    return fail(422, 'Each score must be a whole number from 1 to 5.');
  }

  const publicFeedback = String(input.publicFeedback || '').trim();
  const privateFeedback = String(input.privateFeedback || '').trim();
  if (publicFeedback.length > MAX_FEEDBACK || privateFeedback.length > MAX_FEEDBACK) {
    return fail(422, `Keep feedback under ${MAX_FEEDBACK} characters.`);
  }

  const supabase = getSupabaseClient();

  // A client reviews someone they engaged. Without this, any client could
  // rate any candidate on the platform.
  const { data: contracts } = await supabase
    .from('contracts')
    .select('id')
    .eq('client_id', actor.userId)
    .eq('talent_id', talentId)
    .limit(1);

  if (!contracts || contracts.length === 0) {
    return fail(403, 'You can only review a candidate you have engaged.');
  }

  const { data, error } = await supabase
    .from('client_talent_reviews')
    .upsert({
      client_id: actor.userId,
      talent_id: talentId,
      contract_id: input.contractId ? String(input.contractId) : contracts[0].id,
      rating,
      technical_score: technical,
      communication_score: communication,
      reliability_score: reliability,
      public_feedback: publicFeedback || null,
      private_feedback: privateFeedback || null,
      is_anonymous: Boolean(input.isAnonymous),
      created_at: new Date().toISOString()
    }, { onConflict: 'client_id,talent_id' })
    .select('*')
    .maybeSingle();

  if (error) return fail(500, `Your review was not saved: ${error.message}`);

  const warnings: string[] = [];

  // Operations reads private feedback. It is the only reason it exists.
  if (privateFeedback) {
    const notified = await notifyAdmins('stage_advanced', {
      stageName: 'Private client feedback',
      reason: `A client left private feedback on candidate ${talentId}.`
    });
    warnings.push(...notified.warnings);
  }

  return {
    ok: true,
    status: 200,
    data: {
      id: data?.id,
      talentId,
      rating: data?.rating,
      publicFeedback: data?.public_feedback,
      createdAt: data?.created_at
    },
    warnings
  };
}

/**
 * Reviews of one candidate.
 *
 * Private feedback is stripped unless the caller is operations. A candidate
 * reading their own reviews sees the public half, which is the half the
 * client agreed to show them.
 */
export async function listTalentReviews(
  actor: Actor,
  talentId: string
): Promise<ReviewResult> {
  if (!actor) return fail(401, 'Not authenticated.');

  const id = String(talentId || '').trim();
  if (!id) return fail(400, 'Which candidate?');

  if (actor.kind === 'talent' && String(actor.talentProfileId || actor.userId) !== id) {
    return fail(403, 'Those are not your reviews.');
  }

  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('client_talent_reviews')
    .select('*')
    .eq('talent_id', id)
    .order('created_at', { ascending: false });

  if (error) return fail(500, `Those reviews could not be loaded: ${error.message}`);

  const isOperations = actor.kind === 'admin';

  return {
    ok: true,
    status: 200,
    data: (data || []).map((row: any) => ({
      id: row.id,
      rating: row.rating,
      technicalScore: row.technical_score,
      communicationScore: row.communication_score,
      reliabilityScore: row.reliability_score,
      publicFeedback: row.public_feedback,
      ...(isOperations ? { privateFeedback: row.private_feedback, clientId: row.client_id } : {}),
      clientName: row.is_anonymous && !isOperations ? null : undefined,
      createdAt: row.created_at
    }))
  };
}
