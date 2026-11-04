/**
 * A client's own company details.
 *
 * `MyCompanyPanel` updated `organizations` and `client_profiles` straight
 * from the browser, and `ClientSettingsPanel` updated `client_profiles`
 * settings the same way. RLS is off on both tables in the live database, so
 * the update landed on whichever row id the browser supplied — including
 * another company's. The organisation id came from component state, not
 * from anything the server had verified.
 *
 * The organisation is resolved here from the caller's own client_profiles
 * row, so a client can only ever edit their own company.
 */

import { getSupabaseClient } from './index';
import type { RequestActor as Actor } from './scope';

export interface CompanyResult<T = any> {
  ok: boolean;
  status: number;
  error?: string;
  data?: T;
}

function fail(status: number, error: string): CompanyResult {
  return { ok: false, status, error };
}

/** Columns a client may set on their own organisation. */
const ORGANISATION_FIELDS = [
  'name', 'industry', 'company_size', 'country', 'website',
  'how_did_you_hear_about_us', 'contact_phone', 'contact_email'
];

/**
 * Columns a client may set on their own profile row.
 *
 * `permission_level` and `organization_id` are not here. Either one would
 * let a client promote themselves or move into another company.
 */
const PROFILE_FIELDS = ['position', 'phone', 'settings'];

const MAX_TEXT = 255;

function cleanText(value: unknown): string | null | 'bad' {
  if (value === undefined) return null;
  if (value === null) return null;
  if (typeof value !== 'string') return 'bad';
  const text = value.trim();
  if (text.length > MAX_TEXT) return 'bad';
  return text || null;
}

/** The caller's client_profiles row, which says which company they are in. */
async function loadOwnProfile(actor: Actor) {
  const supabase = getSupabaseClient();
  const { data } = await supabase
    .from('client_profiles')
    .select('*')
    .eq('user_id', actor.userId)
    .maybeSingle();
  return data;
}

export async function getCompany(actor: Actor): Promise<CompanyResult> {
  if (!actor) return fail(401, 'Not authenticated.');
  if (actor.kind !== 'client') return fail(403, 'Only a client has a company here.');

  const profile = await loadOwnProfile(actor);
  if (!profile) return fail(404, 'You do not have a company profile yet.');

  const supabase = getSupabaseClient();
  const { data: organization } = profile.organization_id
    ? await supabase.from('organizations').select('*').eq('id', profile.organization_id).maybeSingle()
    : { data: null };

  return {
    ok: true,
    status: 200,
    data: {
      profile: {
        id: profile.id,
        position: profile.position,
        phone: profile.phone,
        permissionLevel: profile.permission_level,
        settings: profile.settings
      },
      organization: organization || null
    }
  };
}

/**
 * Updates the company and the caller's own contact details.
 *
 * Both halves are optional, so the settings panel can send settings alone
 * and the company form can send everything.
 */
export async function updateCompany(
  actor: Actor,
  input: {
    organization?: Record<string, unknown>;
    profile?: Record<string, unknown>;
    settings?: Record<string, unknown>;
  }
): Promise<CompanyResult> {
  if (!actor) return fail(401, 'Not authenticated.');
  if (actor.kind !== 'client') return fail(403, 'Only a client edits a company here.');

  const profile = await loadOwnProfile(actor);
  if (!profile) return fail(404, 'You do not have a company profile yet.');

  const supabase = getSupabaseClient();

  // ── The organisation ─────────────────────────────────────────────────────
  const organizationPatch: Record<string, unknown> = {};
  for (const [field, value] of Object.entries(input.organization || {})) {
    if (value === undefined) continue;
    if (!ORGANISATION_FIELDS.includes(field)) {
      return fail(400, `Not a company field: ${field}.`);
    }
    const text = cleanText(value);
    if (text === 'bad') return fail(422, `${field} is not valid.`);
    organizationPatch[field] = text;
  }

  if (Object.keys(organizationPatch).length > 0) {
    if (!profile.organization_id) {
      return fail(409, 'You are not attached to a company yet.');
    }
    if (organizationPatch.name !== undefined && !organizationPatch.name) {
      return fail(422, 'A company name is required.');
    }
    // Scoped to the organisation on the caller's own profile row, not to an
    // id sent up from the browser.
    const { error } = await supabase
      .from('organizations').update(organizationPatch).eq('id', profile.organization_id);
    if (error) return fail(500, `Your company was not saved: ${error.message}`);
  }

  // ── The caller's own profile ─────────────────────────────────────────────
  const profilePatch: Record<string, unknown> = {};
  const incoming = { ...(input.profile || {}) };
  if (input.settings !== undefined) incoming.settings = input.settings;

  for (const [field, value] of Object.entries(incoming)) {
    if (value === undefined) continue;
    if (!PROFILE_FIELDS.includes(field)) {
      return fail(400, `Not a profile field: ${field}.`);
    }
    if (field === 'settings') {
      if (value !== null && typeof value !== 'object') {
        return fail(422, 'Settings must be an object.');
      }
      profilePatch.settings = value;
      continue;
    }
    const text = cleanText(value);
    if (text === 'bad') return fail(422, `${field} is not valid.`);
    profilePatch[field] = text;
  }

  if (Object.keys(profilePatch).length > 0) {
    const { error } = await supabase
      .from('client_profiles').update(profilePatch).eq('id', profile.id);
    if (error) return fail(500, `Your details were not saved: ${error.message}`);
  }

  return getCompany(actor);
}
