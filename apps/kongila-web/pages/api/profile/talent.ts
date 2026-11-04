import type { NextApiRequest, NextApiResponse } from 'next';
import {
  getRequestUser,
  getTalentProfile,
  updateTalentProfile,
  saveOnboardingDraft,
  updateTalentSettings
} from '@kongila/database';

/**
 * A candidate's own profile.
 *
 * The portal used to upsert the whole `talent_profiles` row from the
 * browser with the anon key, and RLS is off on that table in the live
 * database, so `vetting_status` and `grade` landed exactly as posted. A
 * candidate could mark themselves Deployed and A+ and appear in the admin
 * pipeline as assessed.
 *
 * The caller is resolved from the verified token. Which columns they may
 * write is decided by `profileFields` in @kongila/workflows, and a refused
 * field comes back named rather than being dropped quietly.
 *
 * GET    ?talentId=   the profile (operations may name another)
 * PATCH  { patch, skills }          facts about themselves
 * PATCH  { action: 'draft', ... }   a part-finished onboarding wizard
 * PATCH  { action: 'settings', ... } notification settings
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const actor = await getRequestUser(req);
  if (!actor) return res.status(401).json({ error: 'Not authenticated' });

  if (req.method === 'GET') {
    const talentId = typeof req.query.talentId === 'string' ? req.query.talentId : undefined;
    const result = await getTalentProfile(actor, talentId);
    if (!result.ok) return res.status(result.status).json({ error: result.error });
    return res.status(200).json(result.data);
  }

  if (req.method === 'PATCH' || req.method === 'POST') {
    const body = (req.body || {}) as Record<string, any>;

    if (body.action === 'draft') {
      const result = await saveOnboardingDraft(actor, {
        step: Number(body.step) || 1,
        data: body.data || {}
      });
      if (!result.ok) return res.status(result.status).json({ error: result.error });
      return res.status(200).json(result.data);
    }

    if (body.action === 'settings') {
      const result = await updateTalentSettings(actor, body.settings || {});
      if (!result.ok) return res.status(result.status).json({ error: result.error });
      return res.status(200).json(result.data);
    }

    const result = await updateTalentProfile(actor, {
      talentId: body.talentId,
      patch: body.patch || {},
      skills: body.skills
    });

    if (!result.ok) {
      return res.status(result.status).json({ error: result.error, problems: result.problems });
    }
    return res.status(200).json({ profile: result.data, warnings: result.warnings });
  }

  res.setHeader('Allow', 'GET, PATCH, POST');
  return res.status(405).json({ error: 'Method not allowed' });
}
