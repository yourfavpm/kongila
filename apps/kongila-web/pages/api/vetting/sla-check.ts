import type { NextApiRequest, NextApiResponse } from 'next';
import { readTalentVetting, writeTalentVetting, getRequestUser } from '@kongila/database';
import { VettingStageRecord } from '@kongila/shared-types';

/**
 * Marks SLA breaches for active vetting stages.
 *
 * This is fired from the talent dashboard on mount, which means a candidate
 * opening their own page is what drives the clock. It belongs in a scheduled
 * job rather than a page load, but until that exists it at least now requires
 * a session, only lets a candidate run it against themselves, and touches one
 * row instead of rewriting sixteen tables.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const actor = await getRequestUser(req);
  if (!actor) return res.status(401).json({ error: 'Not authenticated' });
  if (actor.kind === 'client') return res.status(403).json({ error: 'Not authorised' });

  try {
    const { talentId } = req.body;
    if (!talentId) {
      return res.status(400).json({ error: 'Missing talentId' });
    }

    if (actor.kind === 'talent' && String(actor.talentProfileId) !== String(talentId)) {
      console.warn(`[vetting/sla-check] talent ${actor.userId} attempted to run against ${talentId}`);
      return res.status(403).json({ error: 'Not authorised for this candidate' });
    }

    const snapshot = await readTalentVetting(String(talentId));
    if (!snapshot) {
      return res.status(404).json({ error: 'Talent not found' });
    }
    if (snapshot.pipeline.length === 0) {
      return res.status(200).json({ updated: false, pipeline: [] });
    }

    const pipeline: VettingStageRecord[] = [...snapshot.pipeline];
    let updated = false;
    const now = new Date();

    // Check SLAs for active stages (just marking them breached for UI/Admin)
    for (const stage of pipeline) {
      if (stage.status === 'in_progress' && stage.startedAt) {
        let slaHours = 48; // Default 48h SLA
        if (stage.stageIndex === 1) slaHours = 72; // Skill Assessment
        if (stage.stageIndex === 5) slaHours = 24; // Work Simulation window

        const startedAt = new Date(stage.startedAt);
        const hoursDiff = (now.getTime() - startedAt.getTime()) / (1000 * 60 * 60);

        if (hoursDiff > slaHours && !stage.slaBreached) {
          stage.slaBreached = true;
          updated = true;
        }
      }
    }

    if (updated) {
      const saved = await writeTalentVetting({ ...snapshot, pipeline });
      if (!saved.ok) {
        return res.status(500).json({ error: saved.error || 'Failed to save vetting pipeline' });
      }
    }

    return res.status(200).json({ updated, pipeline });

  } catch (error: any) {
    console.error('[API] SLA Check error:', error);
    return res.status(500).json({ error: error.message });
  }
}
