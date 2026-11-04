import type { NextApiRequest, NextApiResponse } from 'next';
import {
  readDbAsync,
  getRequestUser,
  scopeDbForUser,
  signDbFileUrls
} from '@kongila/database';

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

/**
 * DEPRECATED. Read only, and on its way out.
 *
 * This returns a snapshot of about twenty tables in one response, scoped
 * to the caller. Eleven places in the two portals still hydrate from it,
 * so it cannot be deleted yet, but nothing new should call it.
 *
 * Its POST is gone. It used to accept the browser's whole in-memory copy
 * of the database and hand it to writeDbAsync, which upserts every table
 * in the payload, so any one action rewrote every row the screen was
 * holding and two people working at once overwrote each other.
 *
 * To retire the rest: replace each caller with the resource route for
 * what it actually needs, then delete this file. Tracked in
 * PRODUCTION-READINESS-CHECKLIST.md.
 */

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Every caller must present a valid session. This route used to answer anyone.
  const actor = await getRequestUser(req);
  if (!actor) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  // The response depends on who is asking, so it must never be cached by a
  // shared cache.
  res.setHeader('Cache-Control', 'private, no-store');

  // Read only.
  //
  // POST used to accept the browser's whole in-memory copy of the database
  // and hand it to writeDbAsync, which upserts about twenty tables from it.
  // Any one action in either portal therefore rewrote every row the screen
  // was holding: a vetting decision reposted every candidate, an invoice
  // change reposted every invoice, and two people working at once
  // overwrote each other with no sign that anything had happened.
  //
  // Every write now goes to the route that owns that thing, where the
  // caller is checked, the values are validated against the constraints
  // the column actually has, and the change is audited against the person
  // who made it.
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({
      error: 'This endpoint is read only. Use the route for the thing you are changing.'
    });
  }

  try {
    const data = normalizeDb(await readDbAsync());
    const scoped = scopeDbForUser(data, actor);
    // Scope first, then sign. Signing only ever sees links this caller is
    // already entitled to, so a signed URL can never be minted for someone
    // else's document.
    return res.status(200).json(await signDbFileUrls(scoped));
  } catch (e) {
    return res.status(500).json({ error: 'Failed to read database' });
  }
}
