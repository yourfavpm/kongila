import type { NextApiRequest, NextApiResponse } from 'next';
import { getRequestUser, submitTalentReview, listTalentReviews } from '@kongila/database';

/**
 * Client reviews of a candidate.
 *
 * The portal used to write a review as two rows in the notifications table
 * with the rating inside the message text. RLS is on with no policy there,
 * so the insert was denied and the review was lost; the modal reported
 * success either way.
 *
 * GET  ?talentId=
 * POST { talentId, rating, technicalScore, ..., publicFeedback, privateFeedback }
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const actor = await getRequestUser(req);
  if (!actor) return res.status(401).json({ error: 'Not authenticated' });

  if (req.method === 'GET') {
    const talentId = typeof req.query.talentId === 'string' ? req.query.talentId : '';
    const result = await listTalentReviews(actor, talentId);
    if (!result.ok) return res.status(result.status).json({ error: result.error });
    return res.status(200).json({ reviews: result.data });
  }

  if (req.method === 'POST') {
    const body = (req.body || {}) as Record<string, any>;
    const result = await submitTalentReview(actor, {
      talentId: body.talentId,
      contractId: body.contractId,
      rating: body.rating,
      technicalScore: body.technicalScore,
      communicationScore: body.communicationScore,
      reliabilityScore: body.reliabilityScore,
      publicFeedback: body.publicFeedback,
      privateFeedback: body.privateFeedback,
      isAnonymous: body.isAnonymous
    });
    if (!result.ok) return res.status(result.status).json({ error: result.error });
    return res.status(200).json({ review: result.data, warnings: result.warnings });
  }

  res.setHeader('Allow', 'GET, POST');
  return res.status(405).json({ error: 'Method not allowed' });
}
