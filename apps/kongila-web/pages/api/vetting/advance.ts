import type { NextApiRequest, NextApiResponse } from 'next';
import { readTalentVetting, writeTalentVetting, getRequestUser } from '@kongila/database';
import { VettingStageRecord } from '@kongila/shared-types';

/**
 * Stages a candidate may drive themselves, and the stage index each action
 * belongs to. Anything not in this map is rejected.
 */
const TALENT_ACTIONS: Record<string, number> = {
  COMPLETE_STAGE_4: 3, // Personality Test
  SUBMIT_STAGE_5: 4, // Remote Readiness
  START_STAGE_6: 5, // Work Simulation, begin
  SUBMIT_STAGE_6: 5 // Work Simulation, submit
};

const STAGE_META = [
  { name: 'Application Screening', responsible: 'Talent Manager' },
  { name: 'Skill Assessment', responsible: 'Skill Assessor' },
  { name: 'Behavioural Interview', responsible: 'Talent Manager' },
  { name: 'Personality Test', responsible: 'System (Auto)' },
  { name: 'Remote Readiness', responsible: 'Ops Team' },
  { name: 'Work Simulation', responsible: 'Team Lead' },
  { name: 'Final Review', responsible: 'Review Panel' }
];

/** A stage is behind us only if it passed or was deliberately skipped. */
const COMPLETED_STATUSES = new Set(['passed', 'skipped']);

/**
 * Returns an error message if any stage before stageIndex is still open, or
 * null if the pipeline has genuinely reached this stage.
 *
 * Without this, a POST naming stage 6 moved a candidate sitting at stage 1
 * straight to Final Review.
 */
function findIncompletePriorStage(pipeline: VettingStageRecord[], stageIndex: number): string | null {
  for (let i = 0; i < stageIndex; i++) {
    const stage = pipeline[i];
    if (!stage || !COMPLETED_STATUSES.has(String(stage.status))) {
      const name = stage?.stageName || `stage ${i + 1}`;
      const status = stage?.status || 'missing';
      return `Cannot act on stage ${stageIndex + 1} while ${name} is ${status}`;
    }
  }
  return null;
}

function buildDefaultPipeline(): VettingStageRecord[] {
  const now = new Date().toISOString();
  return STAGE_META.map((meta, i) => ({
    stageIndex: i,
    stageName: meta.name,
    status: i === 0 ? 'in_progress' : 'pending',
    assignee: meta.responsible,
    startedAt: i === 0 ? now : null
  })) as VettingStageRecord[];
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  // This route used to accept any request carrying a talent id.
  const actor = await getRequestUser(req);
  if (!actor) return res.status(401).json({ error: 'Not authenticated' });
  if (actor.kind === 'client') return res.status(403).json({ error: 'Not authorised' });

  try {
    const { talentId, stageIndex, action, payload } = req.body;
    if (!talentId || stageIndex === undefined || !action) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // A candidate may only drive their own pipeline. Operations may act on
    // anyone's. The talent id is never taken on trust from the body.
    if (actor.kind === 'talent' && String(actor.talentProfileId) !== String(talentId)) {
      console.warn(
        `[vetting/advance] talent ${actor.userId} attempted to act on talent ${talentId}`
      );
      return res.status(403).json({ error: 'Not authorised for this candidate' });
    }

    const expectedStage = TALENT_ACTIONS[action];
    if (expectedStage === undefined) {
      return res.status(400).json({ error: 'Unknown action' });
    }
    if (Number(stageIndex) !== expectedStage) {
      return res.status(400).json({ error: 'Action mismatch' });
    }

    // One row, not the whole database.
    const snapshot = await readTalentVetting(String(talentId));
    if (!snapshot) {
      return res.status(404).json({ error: 'Talent not found' });
    }

    const pipeline: VettingStageRecord[] =
      snapshot.pipeline.length > 0 ? [...snapshot.pipeline] : buildDefaultPipeline();

    const currentStage = pipeline[Number(stageIndex)];
    if (!currentStage) {
      return res.status(400).json({ error: 'Invalid stage index' });
    }

    // The stage has to be the one actually open. This is what stops a stage
    // being jumped to, and what stops a passed stage being re-submitted, which
    // used to reset its completion time and reopen the stage after it.
    if (String(currentStage.status) !== 'in_progress') {
      return res.status(409).json({
        error: `Stage ${Number(stageIndex) + 1} is ${currentStage.status}, not in progress`
      });
    }

    const priorProblem = findIncompletePriorStage(pipeline, Number(stageIndex));
    if (priorProblem) {
      console.warn(`[vetting/advance] ${actor.kind} ${actor.userId}: ${priorProblem}`);
      return res.status(409).json({ error: priorProblem });
    }

    const now = new Date().toISOString();
    const telemetry = { ...snapshot.telemetry };

    if (action === 'SUBMIT_STAGE_5') {
      // Remote readiness answers live in the telemetry envelope alongside the
      // pipeline, so they go back in the same single-row write.
      if (payload?.internetSpeedMbps) {
        telemetry.internetQuality = `${payload.internetSpeedMbps} Mbps`;
      }
      if (payload?.hasQuietWorkspace) {
        telemetry.workSetup = 'Quiet Workspace Verified';
      }

      currentStage.status = 'passed';
      currentStage.completedAt = now;
      currentStage.notes = 'Remote Readiness form submitted automatically.';

      // Advance to Stage 6
      pipeline[5] = { ...pipeline[5], status: 'in_progress', startedAt: now };
    } else if (action === 'START_STAGE_6') {
      // Talent explicitly started the simulation
      currentStage.startedAt = now;
    } else if (action === 'SUBMIT_STAGE_6') {
      currentStage.status = 'passed';
      currentStage.completedAt = now;
      currentStage.submissionData = payload; // Store the submission payload directly on the pipeline stage

      // Advance to Stage 7
      pipeline[6] = { ...pipeline[6], status: 'in_progress', startedAt: now };
    } else if (action === 'COMPLETE_STAGE_4') {
      currentStage.status = 'passed';
      currentStage.completedAt = now;

      // Advance to Stage 5
      pipeline[4] = { ...pipeline[4], status: 'in_progress', startedAt: now };
    }

    // Save the one row. A failure here is reported, not swallowed.
    const saved = await writeTalentVetting({ ...snapshot, pipeline, telemetry });
    if (!saved.ok) {
      return res.status(500).json({ error: saved.error || 'Failed to save vetting pipeline' });
    }

    return res.status(200).json({ success: true, pipeline });
  } catch (error: any) {
    console.error('[API] Vetting advance error:', error);
    return res.status(500).json({ error: error.message });
  }
}
