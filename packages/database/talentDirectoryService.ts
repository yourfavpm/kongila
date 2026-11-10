/**
 * The candidate directory, for operations.
 *
 * Three admin screens read every candidate on the platform through
 * `/api/db` and filtered in the browser: the talent detail page, the
 * matching screen and the dashboard. `/api/db` returns about twenty
 * tables, so rendering one candidate's page pulled every contract,
 * invoice and message as well.
 *
 * These are the reads those screens actually need.
 */

import { getSupabaseClient } from './index';
import { canAccessRequest } from './requestAccess';
import type { RequestActor as Actor } from './scope';
import { signDbFileUrls } from './index';

export interface DirectoryResult<T = any> {
  ok: boolean;
  status: number;
  error?: string;
  data?: T;
}

function fail(status: number, error: string): DirectoryResult {
  return { ok: false, status, error };
}

/**
 * Reads the JSON envelope packed into the bio column.
 *
 * Skills, the vetting pipeline and most of the profile live in there. A
 * bio that is plain text is someone who wrote one before the envelope
 * existed; keep the text rather than throwing it away.
 */
function unpack(row: any) {
  let envelope: any = { tags: [], scores: {}, telemetry: {}, bio: '' };
  if (typeof row.bio === 'string' && row.bio.trim()) {
    try {
      const parsed = JSON.parse(row.bio);
      if (parsed && parsed.__kongila) envelope = { ...envelope, ...parsed };
      else envelope.bio = row.bio;
    } catch {
      envelope.bio = row.bio;
    }
  }
  const t = envelope.telemetry || {};
  return {
    id: row.id,
    userId: row.user_id,
    name: row.full_name,
    email: t.email || null,
    title: row.level,
    phone: row.phone,
    country: row.country,
    city: t.city || null,
    timezone: row.timezone,
    gender: row.gender,
    avatar: row.avatar_url,
    availability: row.availability_hours,
    experienceYears: row.experience_years,
    salaryExpectation: row.salary_expectation === null ? null : Number(row.salary_expectation),
    salaryMin: row.salary_min === null ? null : Number(row.salary_min),
    salaryMax: row.salary_max === null ? null : Number(row.salary_max),
    vettingStage: row.vetting_stage,
    vettingStatus: row.vetting_status,
    grade: row.grade,
    status: row.status,
    dateJoined: row.date_joined,
    profileIntegrityProgress: row.profile_integrity_progress,
    bio: envelope.bio,
    tags: envelope.tags || [],
    vettingScores: envelope.scores || {},
    vettingPipeline: t.vettingPipeline || [],
    primarySkills: t.primarySkills || t.skills || [],
    secondarySkills: t.secondarySkills || [],
    skillLevels: t.skillLevels || {},
    requiresReReview: Boolean(t.requiresReReview),
    talentManagerId: t.talentManagerId || null,
    seniorityLevel: t.seniorityLevel || null,
    primaryRoleCategory: t.primaryRoleCategory || null,
    employmentPreference: t.employmentPreference || null,
    preferredEngagementType: t.preferredEngagementType || null,
    noticePeriod: t.noticePeriod || null,
    workSetup: t.workSetup || null,
    internetQuality: t.internetQuality || null,
    portfolioUrl: t.portfolioUrl || null,
    linkedinUrl: t.linkedinUrl || t.linkedIn || null,
    githubUrl: t.githubUrl || null,
    cvUrl: t.cvUrl || null,
    profilePhotoUrl: t.profilePhotoUrl || null,
    certifications: t.certifications || null,
    certificationFiles: t.certificationFiles || [],
    createdAt: t.createdAt || row.date_joined
  };
}

/**
 * The candidate list.
 *
 * `shortlistable=true` narrows it to who may be put in front of a client:
 * A, A+ and the B trainable pool, excluding anyone flagged for re-review.
 * The matching screen used to apply that rule in the browser, against
 * every candidate on the platform.
 */
export async function listTalents(
  actor: Actor,
  options: { shortlistable?: boolean } = {}
): Promise<DirectoryResult> {
  if (!actor) return fail(401, 'Not authenticated.');
  if (actor.kind !== 'admin') return fail(403, 'Not authorised.');

  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('talent_profiles').select('*').order('date_joined', { ascending: false });

  if (error) return fail(500, `Those candidates could not be loaded: ${error.message}`);

  let rows = (data || []).map(unpack);

  if (options.shortlistable) {
    rows = rows.filter((t: any) => {
      if (t.requiresReReview) return false;
      if (t.vettingStage === 'Vetted & Available') return true;
      return t.vettingStatus === 'Vetted' && ['A', 'A+', 'B'].includes(String(t.grade));
    });
  }

  return { ok: true, status: 200, data: await signDbFileUrls(rows) };
}

/** One candidate, with the records attached to them. */
export async function getTalent(actor: Actor, talentId: string): Promise<DirectoryResult> {
  if (!actor) return fail(401, 'Not authenticated.');
  if (actor.kind !== 'admin') return fail(403, 'Not authorised.');

  const id = String(talentId || '').trim();
  if (!id) return fail(400, 'Which candidate?');

  const supabase = getSupabaseClient();
  const { data: row } = await supabase
    .from('talent_profiles').select('*').eq('id', id).maybeSingle();
  if (!row) return fail(404, 'That candidate does not exist.');

  const [documents, skills, assessments, results, matches, interviews, contracts] = await Promise.all([
    supabase.from('documents').select('*').eq('user_id', row.user_id || id),
    supabase.from('talent_skills').select('skill_id, level, skills(name)').eq('talent_id', id),
    supabase.from('talent_skill_assessments').select('*').eq('talentId', id),
    supabase.from('skill_assessment_results').select('*').eq('talentId', id),
    supabase.from('matches').select('*').eq('talent_id', id),
    supabase.from('interviews').select('*').eq('talent_id', id),
    supabase.from('contracts').select('*').eq('talent_id', id)
  ]);

  const data = {
    talent: unpack(row),
    documents: documents.data || [],
    skills: (skills.data || []).map((s: any) => ({ name: s.skills?.name || null, level: s.level }))
                               .filter((s: any) => s.name),
    assessments: assessments.data || [],
    assessmentResults: results.data || [],
    matches: (matches.data || []).map((m: any) => ({
      id: m.id, requestId: m.request_id, talentId: m.talent_id,
      status: m.status, score: m.score, breakdown: m.breakdown
    })),
    interviews: interviews.data || [],
    contracts: contracts.data || []
  };

  return { ok: true, status: 200, data: await signDbFileUrls(data) };
}

/**
 * Everything the matching screen needs for one request.
 *
 * The request, the candidates who may be shortlisted for it, and the
 * matches already on it. Three reads, scoped, instead of a copy of the
 * whole database.
 */
export async function getMatchingBoard(
  actor: Actor,
  requestId: string
): Promise<DirectoryResult> {
  if (!actor) return fail(401, 'Not authenticated.');
  if (actor.kind !== 'admin') return fail(403, 'Not authorised.');

  const id = String(requestId || '').trim();
  if (!id) return fail(400, 'Which request?');

  const supabase = getSupabaseClient();
  const { data: rows } = await supabase
    .from('talent_requests').select('*')
    .or(`id.eq.${id},payload->>id.eq.${id}`).limit(2);

  if (!rows || rows.length === 0) return fail(404, 'That request does not exist.');
  const row = rows[0];
  try {
    if (!await canAccessRequest(supabase, actor, row)) return fail(404, 'That request does not exist.');
  } catch (accessError: any) {
    return fail(500, `Request ownership could not be verified: ${accessError.message}`);
  }

  const request = {
    ...(row.payload || {}),
    id: row.id,
    payloadId: row.payload?.id || null,
    rowId: row.id,
    clientId: row.client_id,
    serviceType: row.payload?.serviceType || row.service_type,
    status: row.payload?.status || row.status,
    createdAt: row.payload?.createdAt || row.created_at,
    assignedAccountManagerId: row.account_manager_id || row.payload?.assignedAccountManagerId || null,
    assignedTalentManagerId: row.talent_manager_id || row.payload?.assignedTalentManagerId || null
  };

  const candidates = await listTalents(actor, { shortlistable: true });

  const { data: matches } = await supabase
    .from('matches').select('*').eq('request_id', row.id);

  return {
    ok: true,
    status: 200,
    data: {
      request,
      talents: candidates.data || [],
      matches: (matches || []).map((m: any) => ({
        id: m.id, requestId: m.request_id, talentId: m.talent_id,
        status: m.status, score: m.score, breakdown: m.breakdown
      }))
    }
  };
}
