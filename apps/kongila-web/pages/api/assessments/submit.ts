import type { NextApiRequest, NextApiResponse } from 'next';
import { getRequestUser, submitAssessment } from '@kongila/database';

/**
 * Submitting a skill assessment.
 *
 * The browser marked its own paper and upserted the score into
 * `talent_skill_assessments`, which has RLS off in the live database. Only
 * the answers are accepted here; the score is computed server side from the
 * answer key and a submitted assessment cannot be submitted twice.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const actor = await getRequestUser(req);
  if (!actor) return res.status(401).json({ error: 'Not authenticated' });

  const body = (req.body || {}) as Record<string, any>;
  const result = await submitAssessment(actor, {
    talentSkillAssessmentId: body.talentSkillAssessmentId,
    assessmentId: body.assessmentId,
    answers: body.answers || {}
  });

  if (!result.ok) return res.status(result.status).json({ error: result.error });
  return res.status(200).json(result.data);
}
