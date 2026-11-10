import type { NextApiRequest, NextApiResponse } from 'next';
import {
  getRequestUser,
  listWorkSimulationTasks,
  assignWorkSimulationTask,
  markWorkSimulationTask,
  signDbFileUrls
} from '@kongila/database';

/**
 * Work simulation tasks, operations side.
 *
 * There was no route for any of this. The admin portal built the task in the
 * browser, put it in React state and attached it to a `payload` object that
 * is never sent, so stage 6 — a fifth of the composite grade — recorded a
 * taskId pointing at nothing and the candidate was never shown a task.
 *
 * GET  ?talentId=   that candidate's tasks; no query returns the admin queue
 * POST { action: 'assign', talentId, title, description?, submissionType?, deadline?, maxScore? }
 * POST { action: 'mark',   taskId, score, reviewerNotes? }
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const actor = await getRequestUser(req);
  if (!actor) return res.status(401).json({ error: 'Not authenticated' });
  if (actor.kind !== 'admin') return res.status(403).json({ error: 'Not authorised' });

  res.setHeader('Cache-Control', 'private, no-store');

  if (req.method === 'GET') {
    const talentId = typeof req.query.talentId === 'string' ? req.query.talentId : undefined;
    const result = await listWorkSimulationTasks(actor, talentId);
    if (!result.ok) return res.status(result.status).json({ error: result.error });
    return res.status(200).json(await signDbFileUrls(result.data));
  }

  if (req.method === 'POST') {
    const body = (req.body || {}) as Record<string, any>;

    if (body.action === 'mark') {
      const result = await markWorkSimulationTask(actor, {
        taskId: body.taskId,
        score: body.score,
        reviewerNotes: body.reviewerNotes
      });
      if (!result.ok) return res.status(result.status).json({ error: result.error });
      return res.status(200).json(await signDbFileUrls(result.data));
    }

    if (body.action !== 'assign') {
      return res.status(400).json({ error: 'Choose an action: assign or mark.' });
    }

    const result = await assignWorkSimulationTask(actor, {
      talentId: body.talentId,
      title: body.title,
      description: body.description,
      submissionType: body.submissionType,
      deadline: body.deadline,
      maxScore: body.maxScore
    });
    if (!result.ok) return res.status(result.status).json({ error: result.error });
    return res.status(result.status).json(await signDbFileUrls(result.data));
  }

  res.setHeader('Allow', 'GET, POST');
  return res.status(405).json({ error: 'Method not allowed' });
}
