import type { NextApiRequest, NextApiResponse } from 'next';
import {
  getRequestUser,
  readDbAsync,
  scopeDbForUser,
  signDbFileUrls,
  SCOPED_RESOURCES
} from '@kongila/database';

/**
 * What the server actually sees, end to end.
 *
 * When every screen is empty there are four places it can have gone wrong
 * and they all look identical from the browser: the caller was not
 * recognised, the read came back empty, the scoping filtered everything out,
 * or the signing step threw. This reports each stage separately so the
 * failing one is named rather than guessed at.
 *
 * Counts only. No rows, no names, no addresses — this is a diagnostic, and a
 * diagnostic that leaks the database is a worse problem than the one it
 * solves. It is also authentication-gated like every other route here, so it
 * reports on the caller's own view and nobody else's.
 *
 * Open /api/selftest while signed in.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const stages: Record<string, unknown> = {};
  res.setHeader('Cache-Control', 'private, no-store');

  // ── 1. Is the caller recognised? ────────────────────────────────────────
  let actor;
  try {
    actor = await getRequestUser(req);
  } catch (err: any) {
    return res.status(200).json({
      ok: false,
      failedAt: 'authentication',
      detail: err?.message || String(err),
      meaning:
        'getRequestUser threw. Every protected route will 500 until this is fixed.'
    });
  }

  stages.authentication = actor
    ? { ok: true, kind: actor.kind, hasTalentProfile: Boolean(actor.talentProfileId) }
    : { ok: false };

  if (!actor) {
    return res.status(200).json({
      ok: false,
      failedAt: 'authentication',
      stages,
      meaning:
        'No bearer token reached the server, or it does not match a row in public.users. '
        + 'The browser is signed in but the API does not know who you are, so every '
        + 'resource comes back empty. Check that apiFetch is attaching the Supabase '
        + 'access token and that your user exists in public.users with a role.'
    });
  }

  // ── 2. Does the read return anything? ───────────────────────────────────
  let db: any;
  try {
    db = await readDbAsync();
  } catch (err: any) {
    return res.status(200).json({
      ok: false,
      failedAt: 'read',
      stages,
      detail: err?.message || String(err)
    });
  }

  const countOf = (value: unknown) => (Array.isArray(value) ? value.length : null);
  const interesting = [
    'users', 'organizations', 'clientProfiles', 'talents', 'clientRequests',
    'matches', 'interviews', 'notifications', 'contracts', 'invoices',
    'assessments', 'assessmentQuestions', 'talentSkillAssessments',
    'skillAssessmentResults', 'workSimulationTasks'
  ];

  stages.read = Object.fromEntries(interesting.map(k => [k, countOf(db?.[k])]));

  const totalRead = interesting.reduce((sum, k) => sum + (countOf(db?.[k]) || 0), 0);
  if (totalRead === 0) {
    return res.status(200).json({
      ok: false,
      failedAt: 'read',
      stages,
      meaning:
        'readDbAsync returned an empty database. It swallows errors and returns '
        + 'EMPTY_DB on any throw, so check the server console for a line starting '
        + '"[DB] Critical error reading from Supabase".'
    });
  }

  // ── 3. Does scoping keep anything? ──────────────────────────────────────
  let scoped: any;
  try {
    scoped = scopeDbForUser(db, actor);
  } catch (err: any) {
    return res.status(200).json({
      ok: false,
      failedAt: 'scoping',
      stages,
      detail: err?.message || String(err)
    });
  }

  stages.scoped = Object.fromEntries(interesting.map(k => [k, countOf(scoped?.[k])]));

  // ── 4. Does signing survive? ────────────────────────────────────────────
  let signed: any;
  try {
    signed = await signDbFileUrls(scoped);
  } catch (err: any) {
    return res.status(200).json({
      ok: false,
      failedAt: 'signing',
      stages,
      detail: err?.message || String(err),
      meaning:
        'Scoping worked but signing stored file URLs threw. /api/resources does '
        + 'the same thing and returns a 500, which the portal shows as no data.'
    });
  }

  stages.signed = Object.fromEntries(interesting.map(k => [k, countOf(signed?.[k])]));

  const totalSigned = interesting.reduce((sum, k) => sum + (countOf(signed?.[k]) || 0), 0);

  return res.status(200).json({
    ok: totalSigned > 0,
    failedAt: totalSigned > 0 ? null : 'scoping',
    actorKind: actor.kind,
    resourceCount: SCOPED_RESOURCES.length,
    stages,
    meaning:
      totalSigned > 0
        ? 'The server has data for this account at every stage. If the screens are '
          + 'still empty the problem is in the browser: check the request to '
          + '/api/resources in the network tab for its status code.'
        : 'The read found rows but scoping removed all of them for this account. '
          + 'That is a scoping bug or an account not linked to its organisation.'
  });
}
