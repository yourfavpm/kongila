import type { NextApiRequest, NextApiResponse } from 'next';
import { getRequestUser, assignAssessment } from '@kongila/database';

/**
 * Assigning a skill assessment to a candidate.
 *
 * There was no route for this and the assignment was not being stored. The
 * admin portal built the row in the browser, put it in local React state and
 * attached it to a `payload` object that was never sent — the request it rode
 * on carries the vetting pipeline and nothing else. So the stage recorded an
 * assessmentId pointing at a row that did not exist, the candidate's portal
 * had nothing to open, and the assignment vanished from the operator's own
 * screen on the next reload.
 *
 * POST { talentId, assessmentId, deadline? }
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const actor = await getRequestUser(req);
  if (!actor) return res.status(401).json({ error: 'Not authenticated' });

  const body = (req.body || {}) as Record<string, any>;
  const result = await assignAssessment(actor, {
    talentId: body.talentId,
    assessmentId: body.assessmentId,
    deadline: body.deadline ?? null
  });

  if (!result.ok) return res.status(result.status).json({ error: result.error });
  return res.status(200).json(result.data);
}
