import type { NextApiRequest, NextApiResponse } from 'next';
import { readDbAsync, writeDbAsync } from '@kongila/database';

const DEFAULT_ONBOARDING_VIDEO_URL = 'https://www.w3schools.com/html/mov_bbb.mp4';

function normalizeTalent(talent: any) {
  if (!talent) return talent;
  return {
    ...talent,
    createdAt: talent.createdAt || talent.created_at || new Date().toISOString(),
    onboardingVideoSeenAt: talent.onboardingVideoSeenAt ?? null,
    onboardingVideoUrl: talent.onboardingVideoUrl || DEFAULT_ONBOARDING_VIDEO_URL,
    profileCompletionPercent: talent.profileCompletionPercent || talent.profile_completion_percent || null,
    requiresReReview: talent.requiresReReview || talent.requires_re_review || false,
    primarySkills: talent.primarySkills || talent.skills || [],
    secondarySkills: talent.secondarySkills || [],
    skillLevels: talent.skillLevels || {},
    salaryExpectationUsd: talent.salaryExpectationUsd || talent.salaryExpectation || 0
  };
}

function normalizeDb(db: any) {
  if (!db) return db;
  return {
    ...db,
    talents: Array.isArray(db.talents) ? db.talents.map(normalizeTalent) : []
  };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'POST') {
    try {
      const existing = await readDbAsync();
      const merged = normalizeDb({
        ...existing,
        ...req.body
      });
      await writeDbAsync(merged);
      return res.status(200).json({ success: true });
    } catch (e) {
      return res.status(500).json({ error: 'Failed to write database' });
    }
  }
  
  try {
    const data = normalizeDb(await readDbAsync());
    return res.status(200).json(data);
  } catch (e) {
    return res.status(500).json({ error: 'Failed to read database' });
  }
}
