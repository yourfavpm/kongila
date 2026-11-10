/**
 * Talent profiles, server side.
 *
 * The browser owned this table. `apps/kongila-web/pages/index.tsx` upserted
 * the whole row from three places, `TalentSettingsPanel` updated settings
 * directly, and the onboarding wizard wrote drafts into the bio column. RLS
 * is off on `talent_profiles` in the live database, so all of it landed,
 * including `vetting_status` and `grade`.
 *
 * Every write now goes through here, the caller is resolved from the
 * verified token rather than from the body, and which columns they may
 * touch is decided by `profileFields`, which is tested on its own.
 */

import { getSupabaseClient, signDbFileUrls, readTalentVetting, writeTalentVetting } from './index';
import type { RequestActor as Actor } from './scope';
import { recordAudit } from './audit';
import { notifyTalentManagers, adminPortalUrl } from './notify';
import {
  filterProfilePatch,
  validateProfilePatch,
  normaliseSkills,
  type FieldProblem
} from '@kongila/workflows';
import { buildDefaultVettingPipeline } from '@kongila/matching-engine';

export interface ProfileResult<T = any> {
  ok: boolean;
  status: number;
  error?: string;
  problems?: FieldProblem[];
  data?: T;
  warnings?: string[];
}

function fail(status: number, error: string, problems?: FieldProblem[]): ProfileResult {
  return { ok: false, status, error, problems };
}

/** The profile row this actor is acting on. */
function ownProfileId(actor: Actor): string {
  return String(actor.talentProfileId || actor.userId);
}

async function loadProfile(id: string) {
  const supabase = getSupabaseClient();
  const { data } = await supabase
    .from('talent_profiles').select('*').eq('id', id).maybeSingle();
  return data;
}

function rowToProfile(row: any) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    fullName: row.full_name,
    phone: row.phone,
    country: row.country,
    address: row.address,
    gender: row.gender,
    level: row.level,
    availabilityHours: row.availability_hours,
    salaryMin: row.salary_min === null ? null : Number(row.salary_min),
    salaryMax: row.salary_max === null ? null : Number(row.salary_max),
    salaryExpectation: row.salary_expectation === null ? null : Number(row.salary_expectation),
    experienceYears: row.experience_years,
    timezone: row.timezone,
    bio: row.bio,
    avatarUrl: row.avatar_url,
    governmentIdUrl: row.government_id_url,
    proofOfAddressUrl: row.proof_of_address_url,
    settings: row.settings,
    // Read-only to a candidate. Returned so the portal can show them where
    // they stand, but refused on the way back in.
    vettingStage: row.vetting_stage,
    vettingStatus: row.vetting_status,
    grade: row.grade,
    status: row.status,
    profileIntegrityProgress: row.profile_integrity_progress,
    dateJoined: row.date_joined
  };
}

// ─── Read ────────────────────────────────────────────────────────────────────

export async function getTalentProfile(
  actor: Actor,
  talentId?: string
): Promise<ProfileResult> {
  if (!actor) return fail(401, 'Not authenticated.');

  const id = actor.kind === 'admin' && talentId ? String(talentId) : ownProfileId(actor);

  if (actor.kind === 'talent' && talentId && String(talentId) !== id) {
    return fail(403, 'That is not your profile.');
  }
  if (actor.kind === 'client') return fail(403, 'Clients do not read candidate profiles here.');

  const row = await loadProfile(id);
  if (!row) return fail(404, 'That profile does not exist.');

  const supabase = getSupabaseClient();
  const { data: skills } = await supabase
    .from('talent_skills')
    .select('skill_id, level, skills(name)')
    .eq('talent_id', id);

  // The avatar, the government ID and the proof of address all live in
  // private buckets. Stored URLs look public and are not, so they are
  // swapped for short-lived signed ones here, the same way /api/db does it.
  const data = await signDbFileUrls({
    ...rowToProfile(row),
    skills: (skills || []).map((s: any) => ({
      name: s.skills?.name || null, level: s.level
    })).filter((s: any) => s.name)
  });

  return { ok: true, status: 200, data };
}

// ─── Write ───────────────────────────────────────────────────────────────────

/**
 * Updates a profile.
 *
 * A refused field is reported rather than dropped. Silently ignoring a
 * write is how a bug survives: the caller believes it worked.
 */
/**
 * Gives a candidate their seven vetting stages, once.
 *
 * Until now nothing created a pipeline. `buildDefaultVettingPipeline` was
 * called in exactly one place, the admin panel, so a candidate's row held an
 * empty pipeline until an operator saved a decision against them. Four
 * different surfaces papered over that in four different ways: the admin
 * page merged defaults over the empty array at render time, the candidate's
 * dashboard built its own seven stages inline in three places, and
 * /api/vetting/advance wrote a fourth set when it found none. None of them
 * was authoritative and they could disagree with each other.
 *
 * The pipeline is created here, server side, the first time a candidate
 * writes a real profile, which is when they finish onboarding. Stage 0 opens
 * as in_progress; the rest wait. Idempotent: a row that already has stages
 * is left exactly as it is, so this cannot overwrite an assessment in
 * progress.
 */
/**
 * The columns a classification rests on.
 *
 * Mirrors PROFILE_CORE_FIELDS in @kongila/shared-types, in the snake_case
 * the table uses. A vetted candidate changing any of these needs the Talent
 * Manager to look again before it reaches clients.
 */
const CORE_COLUMNS = [
  'full_name', 'country', 'phone', 'level', 'seniority_level',
  'experience_years', 'timezone', 'salary_expectation'
];

export async function ensureVettingPipeline(talentId: string): Promise<boolean> {
  // Through readTalentVetting and writeTalentVetting rather than naming
  // vetting_pipeline directly.
  //
  // This used to select and update that column itself. On a database without
  // the 2026-11-09c migration the column does not exist, so both statements
  // were rejected, the warning went to a server log nobody reads, and the
  // function returned false as though the pipeline were already there. The
  // candidate finished onboarding with no pipeline at all: their dashboard
  // had no stage to show, Vetting Progress sat at 0 of 7, and in the admin
  // portal the assessment controls stayed inert because there was no stage
  // record to act on. Those two functions fall back to the bio envelope, so
  // routing through them works with the migration or without it.
  let snapshot;
  try {
    snapshot = await readTalentVetting(talentId);
  } catch (error: any) {
    console.error('[profile] could not read the vetting pipeline:', error?.message || error);
    return false;
  }

  if (!snapshot) return false;
  if (Array.isArray(snapshot.pipeline) && snapshot.pipeline.length > 0) return false;

  const result = await writeTalentVetting({
    ...snapshot,
    pipeline: buildDefaultVettingPipeline()
  });

  if (!result.ok) {
    console.error('[profile] vetting pipeline not created:', result.error);
    return false;
  }

  // Its own column, and nice to have rather than load bearing, so a database
  // that does not have it yet must not fail the pipeline that just saved.
  const { error: startedError } = await getSupabaseClient()
    .from('talent_profiles')
    .update({ vetting_started_at: new Date().toISOString() })
    .eq('id', talentId);
  if (startedError) {
    console.warn('[profile] vetting_started_at not set:', startedError.message);
  }

  return true;
}

export async function updateTalentProfile(
  actor: Actor,
  input: { talentId?: string; patch: Record<string, unknown>; skills?: unknown }
): Promise<ProfileResult> {
  if (!actor) return fail(401, 'Not authenticated.');
  if (actor.kind === 'client') return fail(403, 'Clients cannot edit candidate profiles.');

  const isOperations = actor.kind === 'admin';
  const id = isOperations && input.talentId ? String(input.talentId) : ownProfileId(actor);

  if (!isOperations && input.talentId && String(input.talentId) !== id) {
    return fail(403, 'That is not your profile.');
  }

  const { allowed, refused, unknown } = filterProfilePatch(input.patch || {}, isOperations);

  if (refused.length > 0) {
    return fail(403,
      `${refused.join(', ')} ${refused.length === 1 ? 'is' : 'are'} set by Kongila operations, `
      + 'not by the candidate.');
  }
  if (unknown.length > 0) {
    return fail(400, `Not a profile field: ${unknown.join(', ')}.`);
  }

  const problems = validateProfilePatch(allowed);
  if (problems.length > 0) {
    return fail(422, 'Some of those values cannot be saved.', problems);
  }

  const { skills, problems: skillProblems } = normaliseSkills(input.skills);
  if (skillProblems.length > 0) {
    return fail(422, 'Some of those skills cannot be saved.', skillProblems);
  }

  const supabase = getSupabaseClient();
  const existing = await loadProfile(id);

  if (!existing) {
    // First write for this person. Only a candidate creating their own
    // profile, and the judgement fields start at their initial values
    // here rather than being accepted from the browser.
    if (!isOperations && id !== ownProfileId(actor)) {
      return fail(403, 'That is not your profile.');
    }
    const { error } = await supabase.from('talent_profiles').insert({
      id,
      user_id: actor.userId,
      full_name: allowed.full_name || actor.email || 'Candidate',
      ...allowed,
      vetting_stage: 'Application Screening',
      vetting_status: 'Applied',
      grade: 'Ungraded',
      status: 'active',
      date_joined: new Date().toISOString()
    });
    if (error) return fail(500, `Your profile was not created: ${error.message}`);
  } else if (Object.keys(allowed).length > 0) {
    const { error } = await supabase
      .from('talent_profiles').update(allowed).eq('id', id);
    if (error) return fail(500, `Your profile was not saved: ${error.message}`);
  }

  // A candidate who has written a real profile has finished onboarding, so
  // their vetting pipeline starts here rather than waiting for an operator
  // to open their record.
  if (!isOperations) {
    await ensureVettingPipeline(id);
  }

  const warnings: string[] = [];

  // A vetted candidate changing something their classification rests on.
  //
  // The talent FRD requires the Talent Manager to be told, and nobody was:
  // the flag was computed in the browser, inside handleUpdateProfile, and
  // went into the profile payload with no notification attached. Being set
  // in the browser also made it bypassable — the one place it matters is
  // exactly the place a candidate could skip it.
  //
  // Detecting it here means it holds however the profile was written.
  if (existing && !isOperations) {
    const wasClassified = ['Vetted', 'Matched', 'Deployed'].includes(String(existing.vetting_status || ''));
    const changedCoreFields = CORE_COLUMNS.filter(column =>
      Object.prototype.hasOwnProperty.call(allowed, column)
      && String((allowed as any)[column] ?? '') !== String((existing as any)[column] ?? '')
    );

    if (wasClassified && changedCoreFields.length > 0) {
      const { error: flagError } = await supabase
        .from('talent_profiles').update({ requires_re_review: true }).eq('id', id);
      if (flagError) {
        // The column arrives with a migration that may not have run. The
        // edit itself is saved either way; losing the flag is worth a
        // warning, not a failed save.
        warnings.push('This change needs re-review and the flag could not be set. Tell your Kongila contact.');
      }

      const told = await notifyTalentManagers('profile_rereview_required', {
        talentName: existing.full_name || id,
        reason: `Changed ${changedCoreFields.join(', ')}.`,
        actionUrl: adminPortalUrl(`/talents/${id}`)
      });
      warnings.push(...told.warnings);
    }
  }
  if (input.skills !== undefined) {
    const result = await replaceSkills(id, skills);
    warnings.push(...result.warnings);
  }

  if (isOperations && existing) {
    const changed = Object.keys(allowed)
      .filter(f => ['grade', 'vetting_status', 'vetting_stage', 'status'].includes(f));
    if (changed.length > 0) {
      await recordAudit(actor, {
        action: 'Update Candidate Vetting Fields',
        details: changed.map(f => `${f}: ${existing[f]} to ${allowed[f]}`).join(', '),
        entityType: 'talent_profile',
        entityId: id
      });
    }
  }

  const fresh = await loadProfile(id);
  return { ok: true, status: 200, data: rowToProfile(fresh), warnings };
}

/**
 * Replaces a candidate's skill list.
 *
 * Skills are matched by name, because the table has a unique constraint on
 * it and the same skill must not exist twice under two ids.
 */
async function replaceSkills(
  talentId: string,
  skills: { name: string; level: string }[]
): Promise<{ warnings: string[] }> {
  const supabase = getSupabaseClient();
  const warnings: string[] = [];

  if (skills.length === 0) {
    await supabase.from('talent_skills').delete().eq('talent_id', talentId);
    return { warnings };
  }

  const names = skills.map(s => s.name);
  const { data: existing } = await supabase
    .from('skills').select('id, name').in('name', names);

  const byName = new Map((existing || []).map((s: any) => [String(s.name).toLowerCase(), s.id]));
  const missing = skills.filter(s => !byName.has(s.name.toLowerCase()));

  if (missing.length > 0) {
    const rows = missing.map(s => ({
      id: `skill_${s.name.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`,
      name: s.name
    }));
    const { error } = await supabase.from('skills').upsert(rows, { onConflict: 'name' });
    if (error) warnings.push(`Some skills were not created: ${error.message}`);

    const { data: refreshed } = await supabase
      .from('skills').select('id, name').in('name', missing.map(s => s.name));
    for (const row of refreshed || []) {
      byName.set(String(row.name).toLowerCase(), row.id);
    }
  }

  await supabase.from('talent_skills').delete().eq('talent_id', talentId);

  const links = skills
    .map(s => ({ skillId: byName.get(s.name.toLowerCase()), level: s.level, name: s.name }))
    .filter(s => s.skillId)
    .map(s => ({
      id: `ts_${talentId}_${s.skillId}`,
      talent_id: talentId,
      skill_id: s.skillId,
      level: s.level
    }));

  if (links.length > 0) {
    const { error } = await supabase.from('talent_skills').upsert(links);
    if (error) warnings.push(`Your skills were not saved: ${error.message}`);
  }

  return { warnings };
}

// ─── Onboarding drafts ───────────────────────────────────────────────────────

/**
 * Saves a part-finished onboarding wizard.
 *
 * The draft lived in the bio column as a JSON envelope, written from the
 * browser. Same place, written here, so a half-finished signup cannot also
 * set a grade on the way past.
 */
export async function saveOnboardingDraft(
  actor: Actor,
  input: { step: number; data: Record<string, unknown> }
): Promise<ProfileResult> {
  if (!actor) return fail(401, 'Not authenticated.');
  if (actor.kind !== 'talent') return fail(403, 'Only a candidate has an onboarding draft.');

  const id = ownProfileId(actor);
  const supabase = getSupabaseClient();

  const draft = JSON.stringify({
    __kongila_draft: true,
    wizardStep: Number(input.step) || 1,
    onboardingData: input.data || {},
    savedAt: new Date().toISOString()
  });

  const existing = await loadProfile(id);
  const fullName = String((input.data as any)?.fullName || '').trim()
    || existing?.full_name || actor.email || 'Candidate';

  const { error } = existing
    ? await supabase.from('talent_profiles')
        .update({ full_name: fullName, bio: draft }).eq('id', id)
    : await supabase.from('talent_profiles').insert({
        id, user_id: actor.userId, full_name: fullName, bio: draft,
        vetting_stage: 'Application Screening', vetting_status: 'Applied',
        grade: 'Ungraded', status: 'active', date_joined: new Date().toISOString()
      });

  if (error) return fail(500, `Your progress was not saved: ${error.message}`);
  return { ok: true, status: 200, data: { saved: true, step: input.step } };
}

// ─── Settings ────────────────────────────────────────────────────────────────

export async function updateTalentSettings(
  actor: Actor,
  settings: Record<string, unknown>
): Promise<ProfileResult> {
  if (!actor) return fail(401, 'Not authenticated.');
  if (actor.kind !== 'talent') return fail(403, 'Only a candidate has these settings.');
  if (typeof settings !== 'object' || settings === null) {
    return fail(400, 'Expected a settings object.');
  }

  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from('talent_profiles').update({ settings }).eq('id', ownProfileId(actor));

  if (error) return fail(500, `Your settings were not saved: ${error.message}`);
  return { ok: true, status: 200, data: { settings } };
}
