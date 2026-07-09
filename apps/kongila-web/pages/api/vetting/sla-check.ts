import type { NextApiRequest, NextApiResponse } from 'next';
import { readDbAsync, writeDbAsync } from '@kongila/database';
import { VettingStageRecord } from '@kongila/shared-types';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  try {
    const { talentId } = req.body;
    if (!talentId) {
      return res.status(400).json({ error: 'Missing talentId' });
    }

    const db = await readDbAsync();
    const talentIndex = db.talents.findIndex(t => t.id === talentId);
    if (talentIndex === -1) {
      return res.status(404).json({ error: 'Talent not found' });
    }

    const talent = db.talents[talentIndex];
    if (!talent.vettingPipeline || !Array.isArray(talent.vettingPipeline)) {
      return res.status(200).json({ updated: false, pipeline: [] });
    }

    let pipeline: VettingStageRecord[] = [...talent.vettingPipeline];
    let updated = false;
    const now = new Date();

    // Check Stage 4 (Index 3) for 48h auto-advance
    const stage4 = pipeline[3];
    if (stage4 && stage4.status === 'in_progress' && stage4.startedAt) {
      const startedAt = new Date(stage4.startedAt);
      const hoursDiff = (now.getTime() - startedAt.getTime()) / (1000 * 60 * 60);
      
      if (hoursDiff >= 48) {
        // Auto-advance
        stage4.status = 'skipped';
        stage4.notes = 'Auto-advanced after 48h non-completion.';
        stage4.completedAt = now.toISOString();

        pipeline[4] = {
          ...pipeline[4],
          status: 'in_progress',
          startedAt: now.toISOString(),
        };
        updated = true;
      }
    }

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
      talent.vettingPipeline = pipeline;
      await writeDbAsync(db);
    }

    return res.status(200).json({ updated, pipeline });

  } catch (error: any) {
    console.error('[API] SLA Check error:', error);
    return res.status(500).json({ error: error.message });
  }
}
