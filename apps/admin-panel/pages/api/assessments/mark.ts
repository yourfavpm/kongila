import type { NextApiRequest, NextApiResponse } from 'next';
import { getRequestUser, markAssessment } from '@kongila/database';

/**
 * Marking the written answers on a submitted assessment.
 *
 * There was no route for this. The admin portal's Review Submission screen
 * collected a score against each written answer and its submit handler was
 * `alert("Grading submitted!")` followed by closing the modal — nothing was
 * sent anywhere and nothing was stored. A candidate whose assessment had any
 * question that was not multiple choice could not be given a result at all,
 * and the vetting stage behind it had no score to advance on.
 *
 * The marks are per question. The total is computed on the server from the
 * questions and their max_score, not taken from the request: an operator says
 * what each answer earned, and the arithmetic is not theirs to post.
 *
 * Partial marking is allowed and expected — a long paper gets marked in more
 * than one sitting — so the result stays in the review queue until every
 * written answer has a mark.
 *
 * POST { resultId | talentSkillAssessmentId, marks: { [questionId]: number | { score, notes } },
 *        reviewerNotes? }
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const actor = await getRequestUser(req);
  if (!actor) return res.status(401).json({ error: 'Not authenticated' });

  const body = (req.body || {}) as Record<string, any>;
  if (!body.marks || typeof body.marks !== 'object' || Array.isArray(body.marks)) {
    return res.status(400).json({ error: 'Marks are required, keyed by question id.' });
  }

  const result = await markAssessment(actor, {
    resultId: body.resultId,
    talentSkillAssessmentId: body.talentSkillAssessmentId,
    marks: body.marks,
    reviewerNotes: body.reviewerNotes
  });

  if (!result.ok) return res.status(result.status).json({ error: result.error });
  return res.status(200).json(result.data);
}
