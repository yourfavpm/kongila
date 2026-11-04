/**
 * Who may change which field on a talent profile.
 *
 * The browser wrote the whole row. `apps/kongila-web/pages/index.tsx`
 * built a payload containing `vetting_stage`, `vetting_status` and `grade`
 * and upserted it straight to `talent_profiles` with the anon key, and RLS
 * is off on that table in the live database. So a candidate could set
 * their own grade to A+ and their own vetting status to Deployed, and the
 * admin pipeline would show them as a vetted, deployable candidate that
 * nobody had assessed.
 *
 * Splitting the columns is the whole fix. A candidate owns the facts about
 * themselves. Operations owns the judgements about them. Nothing in the
 * first list can change the second.
 *
 * This file imports nothing, so it can be tested on its own.
 */

/** Facts a candidate states about themselves. */
export const TALENT_WRITABLE_FIELDS = [
  'full_name', 'phone', 'country', 'address', 'gender', 'level',
  'availability_hours', 'salary_min', 'salary_max', 'salary_expectation',
  'experience_years', 'timezone', 'bio', 'avatar_url',
  'government_id_url', 'proof_of_address_url', 'settings'
] as const;

/**
 * Judgements operations makes about a candidate.
 *
 * A candidate writing any of these is the hole. They are listed separately
 * rather than simply left out of the allowlist so a refusal can name the
 * field, which turns a silent drop into something a developer notices.
 */
export const OPERATIONS_ONLY_FIELDS = [
  'vetting_stage', 'vetting_status', 'grade', 'status',
  'profile_integrity_progress', 'date_joined', 'user_id', 'id'
] as const;

export type ProfileField = string;

export interface FieldFilterResult {
  /** The columns that may be written, in database form. */
  allowed: Record<string, unknown>;
  /** Fields refused because the caller is not operations. */
  refused: string[];
  /** Fields nobody may write through this route. */
  unknown: string[];
}

const TALENT_SET = new Set<string>(TALENT_WRITABLE_FIELDS);
const OPS_SET = new Set<string>(OPERATIONS_ONLY_FIELDS);

/** Fields only operations may set, which a candidate may still read. */
export function isOperationsOnly(field: string): boolean {
  return OPS_SET.has(field);
}

/**
 * Reduces a patch to what this caller is allowed to write.
 *
 * `isOperations` is resolved from the verified session by the caller, never
 * from anything in the request body.
 */
export function filterProfilePatch(
  patch: Record<string, unknown>,
  isOperations: boolean
): FieldFilterResult {
  const allowed: Record<string, unknown> = {};
  const refused: string[] = [];
  const unknown: string[] = [];

  for (const [field, value] of Object.entries(patch || {})) {
    if (value === undefined) continue;

    if (TALENT_SET.has(field)) { allowed[field] = value; continue; }

    if (OPS_SET.has(field)) {
      // id and user_id are never writable through a patch, by anyone. They
      // identify the row; changing one moves the profile to another person.
      if (field === 'id' || field === 'user_id') { refused.push(field); continue; }
      if (isOperations) allowed[field] = value;
      else refused.push(field);
      continue;
    }

    unknown.push(field);
  }

  return { allowed, refused, unknown };
}

// ─── Validation ──────────────────────────────────────────────────────────────

export interface FieldProblem {
  field: string;
  message: string;
}

const MAX_TEXT = 2000;

/**
 * Checks the values, not just the field names.
 *
 * A negative salary or 400 available hours a week is not a rendering bug to
 * find later, it is a row that makes every downstream figure wrong.
 */
export function validateProfilePatch(patch: Record<string, unknown>): FieldProblem[] {
  const problems: FieldProblem[] = [];
  const add = (field: string, message: string) => problems.push({ field, message });

  const text = (field: string, max = 255) => {
    const value = patch[field];
    if (value === undefined || value === null) return;
    if (typeof value !== 'string') return add(field, 'Expected text.');
    if (value.length > max) add(field, `Keep this under ${max} characters.`);
  };

  const number = (field: string, min: number, max: number) => {
    const raw = patch[field];
    if (raw === undefined || raw === null || raw === '') return;
    const value = Number(raw);
    if (!Number.isFinite(value)) return add(field, 'Expected a number.');
    if (value < min || value > max) add(field, `Expected between ${min} and ${max}.`);
  };

  text('full_name');
  text('phone', 40);
  text('country');
  text('address', 500);
  text('gender', 40);
  text('level', 80);
  text('timezone', 80);
  text('bio', 20000);
  text('avatar_url', 1000);
  text('government_id_url', 1000);
  text('proof_of_address_url', 1000);

  number('availability_hours', 0, 80);
  number('experience_years', 0, 60);
  number('salary_min', 0, 1_000_000);
  number('salary_max', 0, 1_000_000);
  number('salary_expectation', 0, 1_000_000);

  const min = Number(patch.salary_min);
  const max = Number(patch.salary_max);
  if (Number.isFinite(min) && Number.isFinite(max) && min > max) {
    add('salary_min', 'The minimum cannot be above the maximum.');
  }

  if (patch.full_name !== undefined && !String(patch.full_name || '').trim()) {
    add('full_name', 'A name is required.');
  }

  if (patch.settings !== undefined && patch.settings !== null
      && typeof patch.settings !== 'object') {
    add('settings', 'Expected an object.');
  }

  if (String(patch.bio || '').length > MAX_TEXT * 10) {
    add('bio', 'That is too long to store.');
  }

  return problems;
}

// ─── Skills ──────────────────────────────────────────────────────────────────

export const SKILL_LEVELS = ['beginner', 'intermediate', 'expert'];

export interface SkillClaim {
  name: string;
  level: string;
}

/**
 * Cleans a list of claimed skills.
 *
 * Deduplicated case-insensitively, because "React" and "react" arriving as
 * two rows gives a candidate two of the same skill and double weight in
 * any matching that counts them.
 */
export function normaliseSkills(raw: unknown): { skills: SkillClaim[]; problems: FieldProblem[] } {
  const problems: FieldProblem[] = [];
  if (raw === undefined || raw === null) return { skills: [], problems };

  if (!Array.isArray(raw)) {
    return { skills: [], problems: [{ field: 'skills', message: 'Expected a list.' }] };
  }

  if (raw.length > 50) {
    problems.push({ field: 'skills', message: 'That is more than 50 skills.' });
  }

  const seen = new Set<string>();
  const skills: SkillClaim[] = [];

  for (const entry of raw.slice(0, 50)) {
    const name = String(
      (typeof entry === 'string' ? entry : (entry as any)?.name) || ''
    ).trim();
    if (!name) continue;
    if (name.length > 80) {
      problems.push({ field: 'skills', message: `"${name.slice(0, 20)}..." is too long.` });
      continue;
    }

    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    const claimed = String((entry as any)?.level || 'intermediate').toLowerCase();
    skills.push({
      name,
      level: SKILL_LEVELS.includes(claimed) ? claimed : 'intermediate'
    });
  }

  return { skills, problems };
}
