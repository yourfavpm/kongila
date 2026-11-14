import type { NextApiRequest, NextApiResponse } from 'next';
import {
  readTalentVetting,
  writeTalentVetting,
  getRequestUser,
  ensureVettingPipeline
} from '@kongila/database';
import { VettingStageRecord } from '@kongila/shared-types';

/**
 * Stages a candidate may drive themselves, and the stage index each action
 * belongs to. Anything not in this map is rejected.
 */
const TALENT_ACTIONS: Record<string, number> = {
  SUBMIT_STAGE_5: 4, // Remote Readiness
  START_STAGE_6: 5 // Work Simulation, begin
};

// The stage list used to be copied here, and a third time in the talent
// dashboard. It lives in @kongila/matching-engine, which is also what writes
// the pipeline, so there is nothing left to copy.

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

    // A candidate with no pipeline used to have one invented here, which is
    // how four different surfaces ended up each making their own. The
    // pipeline is created in one place, when onboarding completes. A
    // candidate who predates that gets theirs created now, by the same
    // function, rather than by a copy of it living in this route.
    let stages = snapshot.pipeline;
    if (stages.length === 0) {
      await ensureVettingPipeline(String(talentId));
      const reread = await readTalentVetting(String(talentId));
      stages = reread?.pipeline || [];
      if (stages.length === 0) {
        return res.status(409).json({
          error: 'Your vetting has not started yet. Finish onboarding first; if you already have, reload and try again.'
        });
      }
    }

    const pipeline: VettingStageRecord[] = [...stages];

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
      const report = payload?.remoteReadiness;
      const finiteInRange = (value: unknown, max: number) => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= max;
      if (!report || !['LibreSpeed', 'browser-only'].includes(report.provider) || typeof report.testedAt !== 'string' || Number.isNaN(Date.parse(report.testedAt)) ||
          !finiteInRange(report.downloadMbps, 10000) || typeof report.browser !== 'string' || typeof report.operatingSystem !== 'string' ||
          typeof report.deviceType !== 'string' || typeof report.viewport !== 'string' ||
          typeof payload?.hasBackupPowerAndSuitableHardware !== 'boolean' || typeof payload?.hasQuietWorkspace !== 'boolean') {
        return res.status(400).json({ error: 'Complete the connection and workspace checks before submitting.' });
      }
      if (report.provider === 'LibreSpeed' && (!finiteInRange(report.uploadMbps, 10000) || !finiteInRange(report.latencyMs, 60000) || !finiteInRange(report.jitterMs, 60000))) {
        return res.status(400).json({ error: 'The connection test results are incomplete. Run the test again.' });
      }

      // Keep a typed, coarse report with the stage. Deliberately exclude IP,
      // raw user-agent strings, and any LibreSpeed telemetry/test identifier.
      currentStage.remoteReadiness = {
        provider: report.provider,
        testedAt: report.testedAt,
        downloadMbps: report.downloadMbps,
        uploadMbps: report.uploadMbps,
        latencyMs: report.latencyMs,
        jitterMs: report.jitterMs,
        browser: report.browser.slice(0, 40),
        operatingSystem: report.operatingSystem.slice(0, 40),
        deviceType: report.deviceType.slice(0, 20),
        viewport: report.viewport.slice(0, 24),
        networkEstimate: report.networkEstimate && {
          effectiveType: typeof report.networkEstimate.effectiveType === 'string' ? report.networkEstimate.effectiveType.slice(0, 16) : undefined,
          downlinkMbps: finiteInRange(report.networkEstimate.downlinkMbps, 10000) ? report.networkEstimate.downlinkMbps : undefined,
          rttMs: finiteInRange(report.networkEstimate.rttMs, 60000) ? report.networkEstimate.rttMs : undefined,
          saveData: typeof report.networkEstimate.saveData === 'boolean' ? report.networkEstimate.saveData : undefined,
        },
        hasBackupPowerAndSuitableHardware: payload.hasBackupPowerAndSuitableHardware,
        hasQuietWorkspace: payload.hasQuietWorkspace,
      };
      telemetry.internetQuality = `${report.downloadMbps} Mbps${report.provider === 'LibreSpeed' ? ` down / ${report.uploadMbps} up` : ' (self-reported)'}`;
      telemetry.workSetup = payload.hasQuietWorkspace ? 'Quiet Workspace Verified' : 'Quiet Workspace Not Confirmed';
      telemetry.remoteReadiness = currentStage.remoteReadiness;

      currentStage.status = 'passed';
      currentStage.completedAt = now;
      currentStage.notes = 'Remote Readiness form submitted automatically.';

      // Advance to Stage 6
      pipeline[5] = { ...pipeline[5], status: 'in_progress', startedAt: now };
    } else if (action === 'START_STAGE_6') {
      // Talent explicitly started the simulation
      currentStage.startedAt = now;
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
