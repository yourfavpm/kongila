import type { NextApiRequest, NextApiResponse } from 'next';
import { getRequestUser, recordVettingScores, updateVettingPipeline } from '@kongila/database';

/**
 * Vetting decisions.
 *
 * The panel ran the pipeline in browser state and pushed it back through
 * /api/db, which upserts the whole talents array. Every save rewrote every
 * candidate's row from whatever the screen was holding, repacked each
 * candidate's bio envelope (so an operator action could overwrite a
 * candidate's own bio text), set grade and vetting_status from the
 * browser, and wrote audit entries naming 'Admin Operator' to a table that
 * denies browser writes.
 *
 * POST { action: 'scores', talentId, scores }
 * POST { action: 'pipeline', talentId, pipeline, vettingStage?, vettingStatus? }
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const actor = await getRequestUser(req);
  if (!actor) return res.status(401).json({ error: 'Not authenticated' });

  const body = (req.body || {}) as Record<string, any>;

  const result = body.action === 'pipeline'
    ? await updateVettingPipeline(actor, {
        talentId: String(body.talentId || ''),
        pipeline: Array.isArray(body.pipeline) ? body.pipeline : [],
        vettingStage: body.vettingStage,
        vettingStatus: body.vettingStatus,
        scores: body.scores,
        action: body.auditAction,
        details: body.auditDetails
      })
    : await recordVettingScores(actor, {
        talentId: String(body.talentId || ''),
        scores: body.scores || {}
      });

  if (!result.ok) return res.status(result.status).json({ error: result.error });
  return res.status(200).json({ ...result.data, warnings: result.warnings });
}
