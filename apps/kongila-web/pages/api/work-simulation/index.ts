import type { NextApiRequest, NextApiResponse } from 'next';
import {
  getRequestUser,
  listWorkSimulationTasks,
  submitWorkSimulationTask,
  signDbFileUrls
} from '@kongila/database';

/**
 * A candidate's work simulation tasks.
 *
 * The candidate side of stage 6. There was nothing here, and nothing for
 * them to open: the task was never stored, so the stage pointed at a taskId
 * that did not exist.
 *
 * The talentId is taken from the verified token, never from the request, so
 * a candidate can only ever see and submit their own.
 *
 * GET                     my tasks
 * POST { taskId, submissionUrl?, submissionText?, submissionName? }
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const actor = await getRequestUser(req);
  if (!actor) return res.status(401).json({ error: 'Not authenticated' });
  if (actor.kind !== 'talent') return res.status(403).json({ error: 'Only candidates can use this endpoint' });

  res.setHeader('Cache-Control', 'private, no-store');

  if (req.method === 'GET') {
    const result = await listWorkSimulationTasks(actor);
    if (!result.ok) return res.status(result.status).json({ error: result.error });
    return res.status(200).json(await signDbFileUrls(result.data));
  }

  if (req.method === 'POST') {
    const body = (req.body || {}) as Record<string, any>;
    const result = await submitWorkSimulationTask(actor, {
      taskId: body.taskId,
      submissionUrl: body.submissionUrl,
      submissionText: body.submissionText,
      submissionName: body.submissionName
    });
    if (!result.ok) return res.status(result.status).json({ error: result.error });
    return res.status(200).json(await signDbFileUrls(result.data));
  }

  res.setHeader('Allow', 'GET, POST');
  return res.status(405).json({ error: 'Method not allowed' });
}
