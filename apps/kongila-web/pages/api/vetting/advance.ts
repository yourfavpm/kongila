import type { NextApiRequest, NextApiResponse } from 'next';
import { readDbAsync, writeDbAsync } from '@kongila/database';
import { VettingStageRecord } from '@kongila/shared-types';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  try {
    const { talentId, stageIndex, action, payload } = req.body;
    if (!talentId || stageIndex === undefined || !action) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const db = await readDbAsync();
    const talentIndex = db.talents.findIndex(t => t.id === talentId);
    if (talentIndex === -1) {
      return res.status(404).json({ error: 'Talent not found' });
    }

    const talent = db.talents[talentIndex];
    let pipeline: VettingStageRecord[] = Array.isArray(talent.vettingPipeline) ? [...talent.vettingPipeline] : [];

    // Ensure pipeline is initialized
    if (pipeline.length === 0) {
      const STAGE_META = [
        { name: 'Application Screening', responsible: 'Talent Manager' },
        { name: 'Skill Assessment', responsible: 'Skill Assessor' },
        { name: 'Behavioural Interview', responsible: 'Talent Manager' },
        { name: 'Personality Test', responsible: 'System (Auto)' },
        { name: 'Remote Readiness', responsible: 'Ops Team' },
        { name: 'Work Simulation', responsible: 'Team Lead' },
        { name: 'Final Review', responsible: 'Review Panel' }
      ];
      pipeline = STAGE_META.map((meta, i) => ({
        stageIndex: i,
        stageName: meta.name,
        status: i === 0 ? 'in_progress' : 'pending',
        assignee: meta.responsible,
        startedAt: i === 0 ? new Date().toISOString() : null
      }));
    }

    const currentStage = pipeline[stageIndex];
    if (!currentStage) {
      return res.status(400).json({ error: 'Invalid stage index' });
    }

    const now = new Date().toISOString();

    if (action === 'SUBMIT_STAGE_5') {
      if (stageIndex !== 4) return res.status(400).json({ error: 'Action mismatch' });
      // Save form data to talent telemetry profile
      talent.internetQuality = payload.internetSpeedMbps ? `${payload.internetSpeedMbps} Mbps` : talent.internetQuality;
      talent.workSetup = payload.hasQuietWorkspace ? 'Quiet Workspace Verified' : talent.workSetup;
      
      currentStage.status = 'passed';
      currentStage.completedAt = now;
      currentStage.notes = 'Remote Readiness form submitted automatically.';
      
      // Advance to Stage 6
      pipeline[5] = { ...pipeline[5], status: 'in_progress', startedAt: now };
    } 
    else if (action === 'START_STAGE_6') {
      if (stageIndex !== 5) return res.status(400).json({ error: 'Action mismatch' });
      // Talent explicitly started the simulation
      currentStage.startedAt = now;
    }
    else if (action === 'SUBMIT_STAGE_6') {
      if (stageIndex !== 5) return res.status(400).json({ error: 'Action mismatch' });
      
      currentStage.status = 'passed';
      currentStage.completedAt = now;
      currentStage.submissionData = payload; // Store the submission payload directly on the pipeline stage
      
      // Advance to Stage 7
      pipeline[6] = { ...pipeline[6], status: 'in_progress', startedAt: now };
    }
    else if (action === 'COMPLETE_STAGE_4') {
      if (stageIndex !== 3) return res.status(400).json({ error: 'Action mismatch' });
      currentStage.status = 'passed';
      currentStage.completedAt = now;
      
      // Advance to Stage 5
      pipeline[4] = { ...pipeline[4], status: 'in_progress', startedAt: now };
    }
    else {
      return res.status(400).json({ error: 'Unknown action' });
    }

    // Save back to DB
    talent.vettingPipeline = pipeline;
    await writeDbAsync(db);

    return res.status(200).json({ success: true, pipeline });

  } catch (error: any) {
    console.error('[API] Vetting advance error:', error);
    return res.status(500).json({ error: error.message });
  }
}
