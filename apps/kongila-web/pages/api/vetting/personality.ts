import type { NextApiRequest, NextApiResponse } from 'next';
import { getRequestUser, readTalentVetting, writeTalentVetting, ensureVettingPipeline } from '@kongila/database';
import type { VettingStageRecord } from '@kongila/shared-types';
import { scorePersonalityAnswers } from '../../../lib/personalityScoring';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const actor = await getRequestUser(req);
  if (!actor) return res.status(401).json({ error: 'Not authenticated' });
  if (actor.kind !== 'talent' || !actor.talentProfileId) return res.status(403).json({ error: 'Talent account required.' });

  const talentId = String(actor.talentProfileId);
  try {
    let snapshot = await readTalentVetting(talentId);
    if (!snapshot) return res.status(404).json({ error: 'Talent profile not found.' });
    if (snapshot.pipeline.length === 0) {
      await ensureVettingPipeline(talentId);
      snapshot = await readTalentVetting(talentId);
    }
    if (!snapshot || !snapshot.pipeline[3]) return res.status(409).json({ error: 'Your vetting stage is not ready yet.' });

    const pipeline: VettingStageRecord[] = [...snapshot.pipeline];
    const stage = { ...pipeline[3] } as VettingStageRecord & { personalityAssessment?: any };
    if (stage.status !== 'in_progress') return res.status(409).json({ error: 'The Personality Assessment is not currently open.' });
    if (stage.personalityAssessment?.completedAt) return res.status(409).json({ error: 'Your assessment has already been submitted.' });
    if (pipeline.slice(0, 3).some(previous => !['passed', 'skipped'].includes(String(previous?.status)))) {
      return res.status(409).json({ error: 'Complete the earlier vetting stages before taking this assessment.' });
    }

    const result = scorePersonalityAnswers(req.body?.answers);
    stage.personalityAssessment = result;
    stage.notes = 'Candidate completed the IPIP-50 personality profile. Awaiting human review.';
    pipeline[3] = stage;

    const saved = await writeTalentVetting({ ...snapshot, pipeline });
    if (!saved.ok) return res.status(500).json({ error: saved.error || 'Your assessment could not be saved.' });
    return res.status(200).json({ success: true, pipeline, assessment: result });
  } catch (error: any) {
    const message = String(error?.message || 'The assessment could not be submitted.');
    const status = /answer all|invalid/i.test(message) ? 422 : 500;
    return res.status(status).json({ error: message });
  }
}
