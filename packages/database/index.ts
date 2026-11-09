import { 
  TalentProfile, ServiceRequest, Match, MatchBreakdown, Task, Contract, Notification, AuditLog, AgentLog,
  User, Organization, ClientProfile, Skill, TalentSkill, Document, Project, Assignment,
  Invoice, Payment, TalentPayout, Message, Conversation, SupportTicket, SupportMessage, Interview, RehireRequest, RequestActivityLog
} from '@kongila/shared-types';
import { coerceRequestStatus, mapInterviewStatusToDb, mapInterviewStatusFromDb } from '@kongila/workflows';
import * as fs from 'fs';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';

// ─── DB_FILE_PATH is kept only for assessments (not in Supabase yet) ──────────
const DB_FILE_PATH = path.join('/Users/oluwadammilola/benita/kongila', 'db.json');

export interface Schema {
  talents: TalentProfile[];
  clientRequests: ServiceRequest[];
  matches: Match[];
  tasks: Task[];
  contracts: Contract[];
  notifications: Notification[];
  auditLogs: AuditLog[];
  agentLogs: AgentLog[];
  users: User[];
  organizations: Organization[];
  clientProfiles: ClientProfile[];
  skills: Skill[];
  talentSkills: TalentSkill[];
  documents: Document[];
  projects: Project[];
  assignments: Assignment[];
  invoices: Invoice[];
  payments: Payment[];
  talentPayouts: TalentPayout[];
  messages: Message[];
  conversations: Conversation[];
  roles: any[];
  userRoles: any[];
  supportTickets: SupportTicket[];
  supportMessages: SupportMessage[];
  interviews: Interview[];
  rehireRequests?: RehireRequest[];
  requestActivityLogs?: RequestActivityLog[];
  assessments?: any[];
  assessmentCategories?: any[];
  assessmentQuestions?: any[];
  assessmentAssignments?: any[];
  skillAssessmentResults?: any[];
  talentSkillAssessments?: any[];
  workSimulationTasks?: any[];
  platformSettings?: any[];
  tagDictionary?: any[];
  performanceReviews?: any[];
  classificationEvents?: any[];
  workflows?: any[];
}

// ─── Empty baseline — NO seed data ───────────────────────────────────────────
const EMPTY_DB: Schema = {
  talents: [],
  clientRequests: [],
  matches: [],
  tasks: [],
  contracts: [],
  notifications: [],
  auditLogs: [],
  agentLogs: [],
  users: [],
  organizations: [],
  clientProfiles: [],
  skills: [],
  talentSkills: [],
  documents: [],
  projects: [],
  assignments: [],
  invoices: [],
  payments: [],
  talentPayouts: [],
  messages: [],
  conversations: [],
  roles: [],
  userRoles: [],
  supportTickets: [],
  supportMessages: [],
  interviews: [],
  rehireRequests: [],
  assessments: [],
  assessmentCategories: [],
  assessmentQuestions: [],
  assessmentAssignments: [],
  skillAssessmentResults: [],
  talentSkillAssessments: [],
  workSimulationTasks: [],
  platformSettings: [],
  tagDictionary: [],
  performanceReviews: [],
  classificationEvents: [],
  workflows: []
};

// ─── Supabase client ─────────────────────────────────────────────────────────
let supabaseClient: any = null;

export function getSupabaseClient() {
  if (!supabaseClient) {
    // No hardcoded fallback. This used to default to the staging project and
    // its anon key, so a process with no environment configured connected to
    // staging and every call appeared to succeed against the wrong database.
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

    // On the server, use the service role key. readDbAsync and writeDbAsync are
    // only ever called from API routes, which carry no user session, so with the
    // anon key auth.uid() is null and every table with row level security comes
    // back as an empty array rather than an error. That is why the admin portal
    // showed no users and no talents while the rows sat in the database.
    //
    // SUPABASE_SERVICE_ROLE_KEY has no NEXT_PUBLIC_ prefix, so Next.js will not
    // inline it into a browser bundle. If this module is ever imported into
    // client code the variable is undefined there and it falls back to anon.
    //
    // This is a stopgap. The route it serves still hands the whole database to
    // whoever asks. Per-role authorisation arrives with the API routes on day 3.
    const isServer = typeof window === 'undefined';
    const serviceKey = isServer ? process.env.SUPABASE_SERVICE_ROLE_KEY : undefined;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl) {
      throw new Error(
        '[database] NEXT_PUBLIC_SUPABASE_URL is not set. Add it to .env.local in the app you are running.'
      );
    }

    if (isServer && !serviceKey) {
      console.warn(
        '[database] SUPABASE_SERVICE_ROLE_KEY is not set, falling back to the anon key. ' +
        'Every table with row level security will come back empty. ' +
        'Add it to .env.local in the app you are running.'
      );
    }

    // Resolve to a single value so the throw below narrows the type for the
    // createClient call. `serviceKey || anonKey` on its own stays
    // `string | undefined` as far as the compiler is concerned.
    const supabaseKey = serviceKey || anonKey;
    if (!supabaseKey) {
      throw new Error(
        '[database] No Supabase key available. Set SUPABASE_SERVICE_ROLE_KEY (server) ' +
        'or NEXT_PUBLIC_SUPABASE_ANON_KEY. Add it to .env.local in the app you are running.'
      );
    }

    supabaseClient = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false },
    });
  }
  return supabaseClient;
}

// ─── Request authentication ──────────────────────────────────────────────────
// Resolves the caller of an API route from the bearer token the browser sends.
// Returns null for anything that is not a valid, active, known user, and the
// route turns that into a 401. Never trust a user id from a request body.

export type { RequestActor } from './scope';
export { scopeDbForUser, filterWritableDb } from './scope';
export { parseStorageUrl, clearSignedUrlCache } from './signedUrls';

import { signStoredFileUrls } from './signedUrls';

/**
 * Swaps stored storage URLs in a database snapshot for short-lived signed
 * ones. Call this on the way out of an API route, after scoping, so the
 * private documents bucket stays readable to the people entitled to it.
 */
export async function signDbFileUrls(db: any): Promise<any> {
  return signStoredFileUrls(db, getSupabaseClient());
}

import type { RequestActor as Actor } from './scope';

const ADMIN_PORTAL_ROLES = new Set([
  'super_admin',
  'superadmin',
  'admin',
  'account_manager',
  'operations_manager',
  'ops_manager',
  'talent_manager',
  'finance'
]);

function normalizeRoleValue(role: any): string {
  return String(role || '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
}

/**
 * Verifies the bearer token and returns the auth user, without requiring a
 * row in public.users.
 *
 * getRequestUser resolves a role from public.users, so it returns null during
 * signup, before that row exists. Provisioning needs to know who the caller is
 * at exactly that moment, so it uses this instead.
 */
export async function getAuthenticatedUserId(
  req: { headers?: any }
): Promise<{ userId: string; email: string | null } | null> {
  const header = req?.headers?.authorization || req?.headers?.Authorization;
  const token =
    typeof header === 'string' && header.startsWith('Bearer ') ? header.slice(7).trim() : null;
  if (!token) return null;

  const supabase = getSupabaseClient();
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) return null;

  return { userId: data.user.id, email: data.user.email ?? null };
}

export async function getRequestUser(req: { headers?: any }): Promise<Actor | null> {
  const header = req?.headers?.authorization || req?.headers?.Authorization;
  const token =
    typeof header === 'string' && header.startsWith('Bearer ') ? header.slice(7).trim() : null;
  if (!token) return null;

  const supabase = getSupabaseClient();

  // Verifies the JWT signature against the project, so a forged token fails here.
  const { data: authData, error: authError } = await supabase.auth.getUser(token);
  if (authError || !authData?.user) return null;
  const userId = authData.user.id;

  const { data: userRow } = await supabase
    .from('users')
    .select('role, email, status')
    .eq('id', userId)
    .maybeSingle();

  // A suspended account keeps a valid token until it expires. Check the row.
  if (userRow?.status && String(userRow.status).toLowerCase() === 'suspended') return null;

  const role = normalizeRoleValue(userRow?.role || authData.user.user_metadata?.role);
  if (!role) return null;

  let kind: Actor['kind'];
  if (ADMIN_PORTAL_ROLES.has(role)) kind = 'admin';
  else if (role === 'client') kind = 'client';
  else if (role === 'talent') kind = 'talent';
  else return null;

  let organizationId: string | null = null;
  let talentProfileId: string | null = null;

  if (kind === 'client') {
    const { data: cp } = await supabase
      .from('client_profiles')
      .select('organization_id')
      .eq('user_id', userId)
      .maybeSingle();
    organizationId = cp?.organization_id ?? null;
  }

  if (kind === 'talent') {
    const { data: tp } = await supabase
      .from('talent_profiles')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle();
    talentProfileId = tp?.id ?? null;
  }

  return {
    userId,
    email: userRow?.email ?? authData.user.email ?? null,
    role,
    kind,
    organizationId,
    talentProfileId
  };
}

// ─── Targeted vetting access ─────────────────────────────────────────────────
// readDbAsync/writeDbAsync read about thirty tables and rewrite sixteen. For a
// change to one candidate's vetting pipeline that is both slow and destructive:
// it resets every user's password_hash, forces every talent to active, and
// overwrites anything another request changed in between.
//
// These two functions touch exactly one row of talent_profiles, and only its
// bio column, which is where the pipeline actually lives.

// --- Contract status mapping ------------------------------------------------
// The database and the application disagree on vocabulary. This is the only
// place that is reconciled, so a new status cannot be invented at a call site
// and silently fail the whole batch.

/**
 * Application status to a value contracts_status_check actually allows.
 *
 * Returns null for anything it does not recognise, and the caller leaves the
 * stored status alone rather than writing a guess. The old version returned
 * 'pending' for everything that fell through, which was the bug: readDbAsync
 * hands back display forms with spaces, so 'Pending Signatures', 'Client
 * Signed' and 'Talent Signed' all missed their case and came back 'pending'.
 * Any unrelated save of the db blob then rewrote those contracts to pending,
 * losing a real signature state that nobody had asked to change.
 */
export function mapContractStatusToDb(status?: string | null): string | null {
  // Display forms carry spaces and capitals; database forms carry
  // underscores. Normalise both to the same shape before matching.
  const key = String(status || '').trim().toLowerCase().replace(/[\s-]+/g, '_');

  switch (key) {
    case 'signed':
    case 'fully_signed':       return 'fully_signed';
    case 'client_signed':      return 'client_signed';
    case 'talent_signed':      return 'talent_signed';
    case 'pending_signatures': return 'pending_signatures';
    case 'pending':
    case 'draft':              return 'pending';
    case 'active':             return 'active';
    case 'completed':
    case 'ended':              return 'ended';
    case 'terminated':         return 'terminated';
    case 'closed':             return 'closed';
    default:                   return null;
  }
}

/**
 * The status field of a contract upsert, or nothing at all.
 *
 * Omitting the key leaves the stored value untouched. An unrecognised status
 * is a bug to fix, not a reason to overwrite a live contract.
 */
function contractStatusPatch(contract: any): { status?: string } {
  const mapped = mapContractStatusToDb(contract?.status);
  if (mapped) return { status: mapped };

  if (contract?.status) {
    console.warn(
      `[DB] contract ${contract.id}: unknown status "${contract.status}", leaving the stored one alone`
    );
  }
  return {};
}

/** Database status to what the portals display. */
export function mapContractStatusFromDb(status?: string | null): string {
  switch (String(status || '').toLowerCase()) {
    case 'fully_signed':       return 'Signed';
    case 'client_signed':      return 'Client Signed';
    case 'talent_signed':      return 'Talent Signed';
    case 'pending_signatures': return 'Pending Signatures';
    case 'active':             return 'Active';
    case 'ended':              return 'Completed';
    case 'terminated':         return 'Terminated';
    case 'closed':             return 'Closed';
    default:                   return 'Pending';
  }
}

export interface TalentVettingSnapshot {
  talentId: string;
  pipeline: any[];
  telemetry: Record<string, any>;
  tags: string[];
  scores: any;
  plainBio: string;
}

/**
 * Unpacks the bio column. Mirrors the parsing in readDbAsync, including the
 * legacy string format, so a row written before the JSON envelope keeps its
 * tags and scores instead of losing them on the next write.
 */
function unpackTalentBio(rawBio: any): { telemetry: any; tags: string[]; scores: any; plainBio: string } {
  let bio = typeof rawBio === 'string' ? rawBio : '';
  let tags: string[] = [];
  let scores: any = null;
  let telemetry: any = {};

  if (bio.startsWith('{"__kongila":')) {
    try {
      const envelope = JSON.parse(bio);
      tags = envelope.tags || [];
      scores = envelope.scores || null;
      telemetry = envelope.telemetry || {};
      bio = envelope.bio || '';
    } catch (e) {
      console.error('[database] failed to parse talent bio envelope:', e);
    }
  } else if (bio.startsWith('Tags:')) {
    const parts = bio.split('\n\nTelemetry:');
    const beforeTelemetry = parts[0];
    const afterTelemetry = parts[1] || '';
    const scoreParts = beforeTelemetry.split('\n\nScores:');
    const tagsLine = scoreParts[0].replace('Tags:', '').trim();
    tags = tagsLine ? tagsLine.split(', ').filter(Boolean) : [];
    if (scoreParts[1]) { try { scores = JSON.parse(scoreParts[1].trim()); } catch (e) {} }
    const bioParts = afterTelemetry.split('\n\nBio:');
    if (bioParts[0]) { try { telemetry = JSON.parse(bioParts[0].trim()); } catch (e) {} }
    bio = (bioParts[1] || '').trim();
  }

  return { telemetry, tags, scores, plainBio: bio };
}

/** Re-packs into the same JSON envelope writeDbAsync produces. */
function packTalentBio(snapshot: TalentVettingSnapshot): string {
  return JSON.stringify({
    __kongila: true,
    tags: snapshot.tags || [],
    scores: snapshot.scores || {},
    telemetry: { ...snapshot.telemetry, vettingPipeline: snapshot.pipeline },
    bio: snapshot.plainBio || ''
  });
}

/** Reads one candidate's vetting state. Returns null when there is no such row. */
export async function readTalentVetting(talentId: string): Promise<TalentVettingSnapshot | null> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('talent_profiles')
    .select('id, bio')
    .eq('id', talentId)
    .maybeSingle();

  if (error) {
    console.error('[database] readTalentVetting failed:', error.message);
    throw new Error(`Failed to read candidate: ${error.message}`);
  }
  if (!data) return null;

  const { telemetry, tags, scores, plainBio } = unpackTalentBio(data.bio);

  return {
    talentId: data.id,
    pipeline: Array.isArray(telemetry.vettingPipeline) ? telemetry.vettingPipeline : [],
    telemetry,
    tags,
    scores,
    plainBio
  };
}

/**
 * Writes one candidate's vetting state back. Only the bio column of that one
 * row is touched, and unlike writeDbAsync the error is returned rather than
 * logged and swallowed, so the route can answer honestly.
 */
export async function writeTalentVetting(
  snapshot: TalentVettingSnapshot
): Promise<{ ok: boolean; error?: string }> {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from('talent_profiles')
    .update({ bio: packTalentBio(snapshot) })
    .eq('id', snapshot.talentId);

  if (error) {
    console.error('[database] writeTalentVetting failed:', error.message);
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

// ─── In-memory cache — used as fallback when Supabase is unreachable ──────────
let _lastSuccessfulRead: Schema | null = null;

// ─── Local file helpers REMOVED since Assessments are now in Supabase ────

export function readDb(): Schema {
  return { ...EMPTY_DB };
}

export function writeDb(db: Schema): void {
  // Deprecated synchronous write. All data goes to Supabase via async methods.
}

// ─── Legacy no-op wrappers (keep API surface intact) ─────────────────────────
export async function fetchDbClient(): Promise<Schema> {
  try {
    const res = await fetch('/api/db');
    if (res.ok) return await res.json();
  } catch (e) {}
  return EMPTY_DB;
}

export async function writeDbClient(db: Schema): Promise<void> {
  try {
    await fetch('/api/db', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(db)
    });
  } catch (e) {}
}

// ─── Helper functions that still use legacy readDb() / writeDb() ──────────────
export function getTalents(): TalentProfile[] { return []; }
export function updateTalent(_talent: TalentProfile): void {}
export function getClientRequests(): ServiceRequest[] { return []; }
export function createClientRequest(req: Omit<ServiceRequest, 'id' | 'createdAt'>): ServiceRequest {
  return { ...req, id: `req_${Date.now()}`, createdAt: new Date().toISOString() } as ServiceRequest;
}
export function updateRequestStatus(_id: string, _status: ServiceRequest['status']): void {}
export function getMatches(): Match[] { return []; }
export function createMatches(_matches: Match[]): void {}
// updateMatchStatus used to be a no-op stub here, and it shadowed the
// real one in matchService through the barrel export. A route that
// imported it got a function that did nothing and returned nothing.
export function getTasks(): Task[] { return []; }
export function createTask(task: Omit<Task, 'id' | 'createdAt'>): Task {
  return { ...task, id: `task_${Date.now()}`, createdAt: new Date().toISOString() } as Task;
}
export function updateTaskStatus(_id: string, _status: Task['status'], _blockerDescription?: string): void {}
export function getContracts(): Contract[] { return []; }
// createContract used to be a stub here that returned an object and wrote
// nothing, with status 'Pending', which contracts_status_check does not
// allow. It shadowed the real one in contractStatusService through the
// barrel export, exactly as the updateMatchStatus stub did. The rest of
// the no-op helpers below have no callers; anything new must not reuse
// one of their names.
export function getNotifications(_userId: string): Notification[] { return []; }
export function addNotification(_userId: string, _title: string, _message: string): void {}
export function getAuditLogs(): AuditLog[] { return []; }
export function addAuditLog(_actor: string, _action: string, _details: string): void {}
export function getAgentLogs(): AgentLog[] { return []; }
export function addAgentLog(_agentName: AgentLog['agentName'], _message: string, _type: AgentLog['type'] = 'info'): void {}
export function getInterviews(): Interview[] { return []; }
export function createInterview(data: Omit<Interview, 'id' | 'createdAt'>): Interview {
  return { ...data, id: `interview_${Date.now()}`, createdAt: new Date().toISOString() };
}
export function updateInterview(_id: string, _updates: Partial<Interview>): Interview | null { return null; }
export function deleteInterview(_id: string): void {}

// ─── MAIN: readDbAsync — Supabase ONLY, no local db merge ────────────────────
export async function readDbAsync(): Promise<Schema> {
  const supabase = getSupabaseClient();

  try {
    let rUsers, rOrgs, rClientProfiles, rTalents, rSkills, rTalentSkills, rDocs, rRequests;
    let rMatches, rProjects, rTasks, rContracts, rAssignments, rInvoices, rPayments, rPayouts;
    let rMessages, rNotifs, rAudit, rAgent, rTickets, rSupportMessages, rInterviews, rRequestActivityLogs, rConversations;
    let rAssessments, rAssessmentCategories, rAssessmentQuestions, rAssessmentAssignments, rSkillAssessmentResults, rTalentSkillAssessments;
    // Roles and the links to them. These came back as hardcoded empty
    // arrays, so four admin screens read the two tables straight from
    // the browser to get at them.
    let rRoles: any, rUserRoles: any;

    // 1. Attempt to fetch everything using the unified RPC stored procedure
    const { data: rpcData, error: rpcError } = await supabase.rpc('get_full_db_state');

    if (rpcData && !rpcError) {
      // Safely ensure arrays. Postgres json_build_object might return the string "[]" if COALESCE returned '[]' instead of '[]'::json.
      const ensureArray = (val: any) => {
        if (typeof val === 'string') {
          try { return JSON.parse(val) || []; } catch { return []; }
        }
        return Array.isArray(val) ? val : (val || []);
      };

      // Successfully fetched via RPC! Map the JSON directly to the expected result objects.
      rUsers = { data: ensureArray(rpcData.users), error: null };
      rOrgs = { data: ensureArray(rpcData.organizations), error: null };
      rClientProfiles = { data: ensureArray(rpcData.client_profiles), error: null };
      rTalents = { data: ensureArray(rpcData.talent_profiles), error: null };
      rSkills = { data: ensureArray(rpcData.skills), error: null };
      rTalentSkills = { data: ensureArray(rpcData.talent_skills), error: null };
      rDocs = { data: ensureArray(rpcData.documents), error: null };
      // talent_requests is the only request table the portals write. The RPC
      // predates that and may still only carry service_requests, so the table
      // is read directly here rather than trusted to the stored procedure.
      if (rpcData.talent_requests !== undefined) {
        rRequests = { data: ensureArray(rpcData.talent_requests), error: null };
      } else {
        rRequests = await supabase.from('talent_requests').select('*');
      }

      rMatches = { data: ensureArray(rpcData.matches), error: null };
      rProjects = { data: ensureArray(rpcData.projects), error: null };
      rTasks = { data: ensureArray(rpcData.tasks), error: null };
      rContracts = { data: ensureArray(rpcData.contracts), error: null };
      rAssignments = { data: ensureArray(rpcData.assignments), error: null };
      rInvoices = { data: ensureArray(rpcData.invoices), error: null };
      rPayments = { data: ensureArray(rpcData.payments), error: null };
      rPayouts = { data: ensureArray(rpcData.talent_payouts), error: null };

      rMessages = { data: ensureArray(rpcData.messages), error: null };
      rNotifs = { data: ensureArray(rpcData.notifications), error: null };
      rAudit = { data: ensureArray(rpcData.audit_logs), error: null };
      rAgent = { data: ensureArray(rpcData.agent_logs), error: null };
      rTickets = { data: ensureArray(rpcData.support_tickets), error: null };
      rSupportMessages = { data: ensureArray(rpcData.support_messages), error: null };
      rInterviews = { data: ensureArray(rpcData.interviews), error: null };
      rRequestActivityLogs = { data: ensureArray(rpcData.request_activity_logs), error: null };
      rConversations = { data: ensureArray(rpcData.conversations), error: null };

      rAssessments = { data: ensureArray(rpcData.assessments), error: null };
      rAssessmentCategories = { data: ensureArray(rpcData.assessment_categories), error: null };
      rAssessmentQuestions = { data: ensureArray(rpcData.assessment_questions), error: null };
      rAssessmentAssignments = { data: ensureArray(rpcData.assessment_assignments), error: null };
      rSkillAssessmentResults = { data: ensureArray(rpcData.skill_assessment_results), error: null };
      rTalentSkillAssessments = { data: ensureArray(rpcData.talent_skill_assessments), error: null };
      // The RPC may predate these two. An empty array is the same as
      // what the code did before, so an older RPC still works.
      rRoles = { data: ensureArray(rpcData.roles), error: null };
      rUserRoles = { data: ensureArray(rpcData.user_roles), error: null };
    } else {
      // 2. Fallback: If RPC doesn't exist or fails, fall back to individual table queries
      if (rpcError) {
        console.warn('[DB] RPC get_full_db_state failed/missing, falling back to batch Promise.all:', rpcError.message);
      }

      const batch1 = await Promise.all([
        supabase.from('users').select('*'),
        supabase.from('organizations').select('*'),
        supabase.from('client_profiles').select('*'),
        supabase.from('talent_profiles').select('*'),
        supabase.from('skills').select('*'),
        supabase.from('talent_skills').select('*'),
        supabase.from('documents').select('*'),
        supabase.from('talent_requests').select('*'),
      ]);

      const batch2 = await Promise.all([
        supabase.from('matches').select('*'),
        supabase.from('projects').select('*'),
        supabase.from('tasks').select('*'),
        supabase.from('contracts').select('*'),
        supabase.from('assignments').select('*'),
        supabase.from('invoices').select('*'),
        supabase.from('payments').select('*'),
        supabase.from('talent_payouts').select('*'),
      ]);

      const batch3 = await Promise.all([
        supabase.from('messages').select('*'),
        supabase.from('notifications').select('*'),
        supabase.from('audit_logs').select('*'),
        supabase.from('agent_logs').select('*'),
        supabase.from('support_tickets').select('*'),
        supabase.from('support_messages').select('*'),
        supabase.from('interviews').select('*'),
        supabase.from('request_activity_logs').select('*'),
        supabase.from('conversations').select('*'),
      ]);

      const batch4 = await Promise.all([
        supabase.from('assessments').select('*'),
        supabase.from('assessment_categories').select('*'),
        supabase.from('assessment_questions').select('*'),
        supabase.from('assessment_assignments').select('*'),
        supabase.from('skill_assessment_results').select('*'),
        supabase.from('talent_skill_assessments').select('*'),
        supabase.from('roles').select('id, name'),
        supabase.from('user_roles').select('id, user_id, role_id')
      ]);

      [
        rUsers, rOrgs, rClientProfiles, rTalents, rSkills, rTalentSkills, rDocs, rRequests
      ] = batch1;
      
      [
        rMatches, rProjects, rTasks, rContracts, rAssignments, rInvoices, rPayments, rPayouts
      ] = batch2;
      
      [
        rMessages, rNotifs, rAudit, rAgent, rTickets, rSupportMessages, rInterviews, rRequestActivityLogs, rConversations
      ] = batch3;
      
      [
        rAssessments, rAssessmentCategories, rAssessmentQuestions, rAssessmentAssignments, rSkillAssessmentResults, rTalentSkillAssessments,
        rRoles, rUserRoles
      ] = batch4;
    }

    if (rUsers.error) {
      console.error('[DB] Supabase users query failed:', rUsers.error.message);
    }

    if (rTalents.error) {
      console.error('[DB] Supabase talent_profiles query failed:', rTalents.error.message);
    }

    if (rAssessments.error) {
      console.error('[DB] Supabase assessments query failed:', rAssessments.error.message);
    }
    if (rAssessmentCategories.error) {
      console.error('[DB] Supabase assessment_categories query failed:', rAssessmentCategories.error.message);
    }
    if (rAssessmentQuestions.error) {
      console.error('[DB] Supabase assessment_questions query failed:', rAssessmentQuestions.error.message);
    }

    // ── Map users ──────────────────────────────────────────────────────────────
    const users: User[] = (rUsers.data || []).map((u: any) => ({
      id: u.id,
      email: u.email,
      role: u.role,
      status: u.status,
      emailVerified: u.email_verified,
      createdAt: u.created_at,
      updatedAt: u.updated_at
    }));
    const userMap = new Map<string, User>(users.map(u => [u.id, u]));

    // ── Map organizations ──────────────────────────────────────────────────────
    const organizations: Organization[] = (rOrgs.data || []).map((o: any) => ({
      id: o.id,
      name: o.name,
      created_by: o.created_by,
      created_at: o.created_at,
      // Nothing is invented here any more. These used to default to a random
      // health score, random monthly revenue, a made-up contact email built
      // from the company name, a placeholder phone number and 'usr_admin' as
      // the account manager. Operations read those as real figures, and the
      // numbers changed on every page load. Null means not set.
      accountManagerId: o.account_manager_id || null,
      accountManagerName: o.account_manager_name || null,
      status: o.status || 'Active',
      healthScore: o.health_score ?? null,
      internalNotes: o.internal_notes || '',
      contactEmail: o.contact_email || null,
      contactPhone: o.contact_phone || null,
      monthlyRevenue: o.monthly_revenue ?? null,
      lastActivityAt: o.last_activity_at || new Date().toISOString(),
      industry: o.industry,
      company_size: o.company_size,
      country: o.country,
      website: o.website,
      how_did_you_hear_about_us: o.how_did_you_hear_about_us,
      multi_user_enabled: o.multi_user_enabled || false
    }));

    // ── Map client profiles ────────────────────────────────────────────────────
    const clientProfiles: ClientProfile[] = (rClientProfiles.data || []).map((cp: any) => ({
      id: cp.id,
      userId: cp.user_id,
      organizationId: cp.organization_id,
      position: cp.position,
      phone: cp.phone,
      permissionLevel: cp.permission_level || 'Full Access',
      settings: cp.settings || {
        notifications: {
          email: { Requests: true, Matches: true, Interviews: true, Contracts: true, Billing: true, Messages: true, Marketing: false },
          whatsapp: { Requests: false, Matches: true, Interviews: true, Contracts: false, Billing: true, Messages: true, Marketing: false }
        },
        paymentMethods: []
      }
    }));

    // ── Map documents ──────────────────────────────────────────────────────
    // Who has signed each template comes from document_signatures. It used
    // to be a signedByTalentIds array that only ever existed in browser
    // memory, so the admin's signature progress bar always read zero and the
    // two compliance checks that used it were reading nothing.
    const signedByDocument = new Map<string, string[]>();
    try {
      const { data: docSignatures } = await supabase
        .from('document_signatures')
        .select('document_id, talent_id');

      for (const row of (docSignatures || []) as any[]) {
        const key = String(row.document_id);
        const list = signedByDocument.get(key) || [];
        list.push(String(row.talent_id));
        signedByDocument.set(key, list);
      }
    } catch (err: any) {
      console.warn('[DB] could not read document signatures:', err?.message);
    }

    const documents: Document[] = (rDocs.data || []).map((doc: any) => ({
      id: doc.id,
      userId: doc.user_id,
      name: doc.name,
      fileName: doc.file_name || doc.name,
      type: doc.type,
      fileUrl: doc.file_url,
      fileSize: doc.file_size,
      fileSizeBytes: doc.file_size_bytes || 0,
      status: doc.status,
      versionNumber: doc.version_number || 1,
      certificationName: doc.certification_name || null,
      issuingBody: doc.issuing_body || null,
      issueDate: doc.issue_date || null,
      expiryDate: doc.expiry_date || null,
      uploadedAt: doc.uploaded_at,
      updatedAt: doc.updated_at || null,
      isMandatory: doc.is_mandatory || false,
      isHidden: doc.is_hidden || false,
      templateId: doc.template_id || null,
      signatureData: doc.signature_data || null,
      isTemplate: doc.is_template || false,
      signedByTalentIds: signedByDocument.get(String(doc.id)) || [],
      signedAt: doc.signed_at || null,
      requiresReReview: doc.requires_re_review || false,
      description: doc.description || null
    }));

    // ── Map skills ─────────────────────────────────────────────────────────────
    const skills: Skill[] = (rSkills.data || []).map((s: any) => ({
      id: s.id,
      name: s.name
    }));

    const talentSkills: TalentSkill[] = (rTalentSkills.data || []).map((ts: any) => ({
      id: ts.id,
      talentId: ts.talent_id,
      skillId: ts.skill_id,
      level: ts.level
    }));

    const talentSkillsMap = new Map<string, string[]>();
    for (const ts of talentSkills) {
      const skillName = skills.find(s => s.id === ts.skillId)?.name;
      if (skillName) {
        if (!talentSkillsMap.has(ts.talentId)) talentSkillsMap.set(ts.talentId, []);
        talentSkillsMap.get(ts.talentId)!.push(skillName);
      }
    }



    // ── Map talent profiles ────────────────────────────────────────────────────
    const talents: TalentProfile[] = (rTalents.data || []).map((t: any) => {
      let bio = t.bio || '';
      let tags: string[] = [];
      let vettingScores: any = null;
      let telemetry: any = {};

      // Try new JSON envelope format first
      if (bio.startsWith('{"__kongila":')) {
        try {
          const envelope = JSON.parse(bio);
          tags = envelope.tags || [];
          vettingScores = envelope.scores || null;
          telemetry = envelope.telemetry || {};
          bio = envelope.bio || '';
        } catch (e) {
          console.error('[DB] Failed to parse JSON bio envelope:', e);
        }
      } else if (bio.startsWith('Tags:')) {
        // Legacy string format — parse best-effort
        const parts = bio.split('\n\nTelemetry:');
        const beforeTelemetry = parts[0];
        const afterTelemetry = parts[1] || '';
        const scoreParts = beforeTelemetry.split('\n\nScores:');
        const tagsLine = scoreParts[0].replace('Tags:', '').trim();
        tags = tagsLine ? tagsLine.split(', ').filter(Boolean) : [];
        if (scoreParts[1]) { try { vettingScores = JSON.parse(scoreParts[1].trim()); } catch (e) {} }
        const bioParts = afterTelemetry.split('\n\nBio:');
        if (bioParts[0]) { try { telemetry = JSON.parse(bioParts[0].trim()); } catch (e) {} }
        bio = (bioParts[1] || '').trim();
      }

      const talentDocs = documents.filter(d => (d as any).userId === t.user_id);

      return {
        id: t.id,
        name: t.full_name || '',
        email: userMap.get(t.user_id)?.email || '',
        avatar: t.avatar_url || null,
        title: t.level || telemetry.title || '',
        skills: telemetry.skills || talentSkillsMap.get(t.id) || [],
        primarySkills: telemetry.primarySkills || talentSkillsMap.get(t.id) || [],
        secondarySkills: telemetry.secondarySkills || [],
        skillLevels: telemetry.skillLevels || {},
        timezone: t.timezone || telemetry.timezone || '',
        salaryExpectation: t.salary_expectation ? Number(t.salary_expectation) : (t.salary_max ? Number(t.salary_max) : null),
        salaryExpectationUsd: telemetry.salaryExpectationUsd || (t.salary_expectation ? Number(t.salary_expectation) : null),
        salaryExpectationMinUsd: telemetry.salaryExpectationMinUsd || null,
        salaryExpectationMaxUsd: telemetry.salaryExpectationMaxUsd || null,
        salaryExpectationCurrency: telemetry.salaryExpectationCurrency || t.currency || 'USD',
        experienceYears: t.experience_years ? Number(t.experience_years) : (telemetry.yearsExperience ?? null),
        availability: t.availability_hours ? Number(t.availability_hours) : (telemetry.availability ?? null),
        vettingStage: t.vetting_stage || 'Application Screening',
        vettingStatus: t.vetting_status || 'Applied',
        vettingScores: vettingScores || { technical: 0, behavioral: 0, personality: 0, remoteReadiness: 0, workSimulation: 0, communication: 0, experience: 0 },
        grade: t.grade || null,
        tags,
        bio,
        documents: talentDocs,
        // Personal & onboarding telemetry
        phone: t.phone || telemetry.phone || '',
        phoneCode: telemetry.phoneCode || '',
        city: t.city || telemetry.city || '',
        country: t.country || telemetry.country || '',
        dateOfBirth: t.date_of_birth || telemetry.dateOfBirth || '',
        gender: t.gender || telemetry.gender || '',
        nationality: telemetry.nationality || t.nationality || '',
        profilePhotoUrl: t.avatar_url || telemetry.profilePhotoUrl || '',
        profilePhotoName: telemetry.profilePhotoName || '',
        profilePhotoSize: telemetry.profilePhotoSize || null,
        cvUrl: telemetry.cvUrl || '',
        cvName: telemetry.cvName || '',
        cvSize: telemetry.cvSize || null,
        certificationFiles: telemetry.certificationFiles || [],
        hasLaptop: telemetry.hasLaptop || false,
        hasInternet: telemetry.hasInternet || false,
        hasPowerBackup: telemetry.hasPowerBackup || false,
        settings: t.settings || {
          notifications: {
            email: { VettingUpdates: true, InterviewAlerts: true, PaymentAlerts: true, Messages: true, Marketing: false },
            whatsapp: { VettingUpdates: true, InterviewAlerts: true, PaymentAlerts: true, Messages: true, Marketing: false }
          }
        },
        classificationHistory: telemetry.classificationHistory || [],
        seniorityLevel: t.seniority_level || telemetry.seniorityLevel || '',
        primaryRoleCategory: telemetry.primaryRoleCategory || '',
        employmentPreference: telemetry.employmentPreference || '',
        preferredEngagementType: telemetry.preferredEngagementType || telemetry.employmentPreference || '',
        preferredWorkHours: telemetry.preferredWorkHours || telemetry.hourlyMonthly || '',
        preferredProjectType: telemetry.preferredProjectType || '',
        noticePeriod: telemetry.noticePeriod || telemetry.availableStartDate || '',
        availableStartDate: telemetry.availableStartDate || telemetry.noticePeriod || '',
        currency: t.currency || telemetry.currency || '',
        hourlyMonthly: telemetry.hourlyMonthly || '',
        portfolioUrl: t.portfolio_url || telemetry.portfolioUrl || '',
        githubUrl: telemetry.githubUrl || '',
        websiteUrl: telemetry.websiteUrl || '',
        linkedIn: telemetry.linkedIn || telemetry.linkedinUrl || '',
        linkedinUrl: telemetry.linkedinUrl || '',
        certifications: telemetry.certifications || '',
        internetQuality: telemetry.internetQuality || '',
        workSetup: telemetry.workSetup || '',
        devices: telemetry.devices || '',
        communicationTools: telemetry.communicationTools || '',
        maritalStatus: telemetry.maritalStatus || '',
        nationalId: telemetry.nationalId || '',
        passportNo: telemetry.passportNo || '',
        address: t.address || telemetry.address || '',
        workExperience: telemetry.workExperience || [],
        professionalSummary: t.professional_summary || telemetry.professionalSummary || '',
        languages: telemetry.languages || [],
        educations: telemetry.educations || [],
        vettingPipeline: telemetry.vettingPipeline || undefined,
        requiresReReview: telemetry.requiresReReview || false,
        profileCompletionPercent: telemetry.profileCompletionPercent || null,
        createdAt: telemetry.createdAt || t.created_at || undefined,
        onboardingVideoSeenAt: telemetry.onboardingVideoSeenAt ?? null,
        onboardingVideoUrl: telemetry.onboardingVideoUrl || ''
      } as any;
    });

    // ── Map client requests ────────────────────────────────────────────────────
    //
    // These come from talent_requests, which stores the whole request as a
    // camelCase jsonb payload. This used to read service_requests, a second,
    // older shape that nothing writes successfully: its title is NOT NULL and
    // never sent, four of the columns written to it do not exist, and both of
    // its CHECK constraints are narrower than the statuses and service types
    // the product uses. Every write to it failed, so it held nothing.
    //
    // A request has two ids: the row's own primary key, and payload.id, which
    // the client portal generates and uses everywhere. payload.id wins so the
    // two portals agree on what a request is called; the row id is kept as
    // rowId for the places that update by primary key.
    const clientRequests: ServiceRequest[] = (rRequests?.data || []).map((r: any) => {
      const payload = (r && typeof r.payload === 'object' && r.payload) || {};

      // Resolve the company name if the payload did not carry one.
      let clientName = payload.clientName || '';
      if (!clientName) {
        const clientProfile = clientProfiles.find(cp => cp.userId === r.client_id);
        const org = organizations.find(o => o.id === clientProfile?.organizationId);
        clientName = org?.name || '';
      }

      return {
        ...payload,
        id: payload.id || r.id,
        rowId: r.id,
        clientId: r.client_id || payload.clientId,
        clientName,
        serviceType: r.service_type || payload.serviceType,
        roleDescription: payload.roleDescription || r.role_description || '',
        requiredSkills: payload.requiredSkills || [],
        duration: payload.duration,
        commitmentLevel: payload.commitmentLevel,
        numberOfHires: payload.numberOfHires ?? 1,
        timezone: payload.timezone || '',
        startDate: payload.startDate,
        budget: payload.budget ?? 0,
        priority: payload.priority || 'Medium',
        status: coerceRequestStatus(payload.status ?? r.status),
        createdAt: payload.createdAt || r.created_at,
        // Was randomly marked ASAP for one request in five, which changed on
        // every page load. Unset means Standard, not maybe-urgent.
        urgency: payload.urgency || 'Standard',
        assignedTalentManagerId: r.talent_manager_id || payload.assignedTalentManagerId || null,
        assignedAccountManagerId: r.account_manager_id || payload.assignedAccountManagerId || null,
        internalNotes: payload.internalNotes || ''
      } as any;
    });

    // ── Map matches ────────────────────────────────────────────────────────────
    const matches: Match[] = (rMatches.data || []).map((m: any) => {
      let breakdown: MatchBreakdown = { skillFit: 0, behaviourFit: 0, personalityFit: 0, availability: 0, pastPerformance: 0 };
      if (m.breakdown && typeof m.breakdown === 'object') {
        breakdown = {
          skillFit: Number(m.breakdown.skillFit || m.breakdown.skill_fit_score || 0),
          behaviourFit: Number(m.breakdown.behaviourFit || m.breakdown.behaviour_fit_score || m.breakdown.behaviorFit || 0),
          personalityFit: Number(m.breakdown.personalityFit || m.breakdown.personality_fit_score || 0),
          availability: Number(m.breakdown.availability || m.breakdown.availability_score || 0),
          pastPerformance: Number(m.breakdown.pastPerformance || m.breakdown.performance_history_score || 0)
        };
      }
      return {
        id: m.id,
        requestId: m.request_id,
        talentId: m.talent_id,
        status: m.status === 'proposed' ? 'Proposed' : (m.status || 'Applied'),
        score: m.score || m.match_score || 0,
        breakdown,
        clientRejectionReason: m.client_rejection_reason || undefined,
        createdAt: m.created_at || new Date().toISOString()
      } as any;
    });

    // ── Map projects ───────────────────────────────────────────────────────────
    const projects: Project[] = (rProjects.data || []).map((p: any) => ({
      id: p.id,
      clientId: p.client_id,
      name: p.name,
      description: p.description,
      startDate: p.start_date,
      endDate: p.end_date,
      status: p.status
    }));

    // ── Map tasks ──────────────────────────────────────────────────────────────
    const tasks: Task[] = (rTasks.data || []).map((t: any) => {
      const proj = projects.find(p => p.id === t.project_id);
      const userRec = users.find(u => u.id === t.assigned_to);
      const talentRec = talents.find(tal => tal.id === t.assigned_to || tal.email === userRec?.email);
      return {
        id: t.id,
        projectId: t.project_id,
        projectName: proj?.name || 'General Project',
        title: t.title,
        description: t.description,
        assigneeId: t.assigned_to,
        assigneeName: talentRec?.name || userRec?.email || 'Unassigned',
        status: t.status === 'in_progress' ? 'In Progress' : (t.status === 'done' ? 'Completed' : 'To Do'),
        priority: t.priority || 'Medium',
        dueDate: t.due_date || new Date().toISOString().split('T')[0],
        createdAt: t.created_at || new Date().toISOString()
      } as any;
    });

    // ── Map contracts ──────────────────────────────────────────────────────────
    const contracts: Contract[] = (rContracts.data || []).map((c: any) => {
      const talent = talents.find(t => t.id === c.talent_id);
      const clientProfile = clientProfiles.find(cp => cp.userId === c.client_id);
      const org = organizations.find(o => o.id === clientProfile?.organizationId);
      return {
        id: c.id,
        matchId: c.match_id || `match_${c.talent_id}`,
        clientId: c.client_id,
        clientName: org?.name || '',
        talentId: c.talent_id,
        talentName: talent?.name || '',
        role: c.service_type || 'Contractor',
        salary: Number(c.rate_amount || 0),
        startDate: c.start_date || '',
        status: mapContractStatusFromDb(c.status),
        signedAt: c.signed_at,
        rateType: c.rate_type || 'Monthly',
        rateAmount: Number(c.rate_amount || 0),
        totalEarned: Number(c.total_earned || 0),
        invoicedBalance: Number(c.invoiced_balance || 0),
        nextPayout: Number(c.next_payout || 0),
        nextPayoutDate: c.next_payout_date || '',
        endDate: c.end_date || '',
        engagementModel: c.engagement_model || null,
        rating: Number(c.rating || 0),
        qualityOfWork: Number(c.quality_of_work || 0),
        communication: Number(c.communication || 0),
        timeliness: Number(c.timeliness || 0),
        terminationReason: c.termination_reason || undefined,
        clientMonthlyFeeUsd: Number(c.client_monthly_fee_usd || 0),
        performanceScore: Number(c.performance_score || 0)
      };
    });

    // ── Map other entities ─────────────────────────────────────────────────────
    const assignments: Assignment[] = (rAssignments.data || []).map((a: any) => ({
      id: a.id, talentId: a.talent_id, projectId: a.project_id, contractId: a.contract_id,
      role: a.role, status: a.status
    }));

    const invoices: Invoice[] = (rInvoices.data || []).map((inv: any) => ({
      id: inv.id, clientId: inv.client_id, amount: Number(inv.amount || 0),
      status: inv.status, dueDate: inv.due_date
    }));

    const payments: Payment[] = (rPayments.data || []).map((p: any) => ({
      id: p.id, invoiceId: p.invoice_id, amount: Number(p.amount || 0),
      paymentMethod: p.payment_method, status: p.status, paidAt: p.paid_at
    }));

    const talentPayouts: TalentPayout[] = (rPayouts.data || []).map((tp: any) => ({
      id: tp.id, talentId: tp.talent_id, contractId: tp.contract_id,
      amount: Number(tp.amount || 0), status: tp.status, paidAt: tp.paid_at
    }));

    const conversations: Conversation[] = (rConversations.data || []).map((conv: any) => ({
      id: conv.id, type: conv.type, participantIds: conv.participant_ids || [],
      contextType: conv.context_type, contextId: conv.context_id,
      createdAt: conv.created_at, updatedAt: conv.updated_at
    }));

    const messages: Message[] = (rMessages.data || []).map((msg: any) => ({
      id: msg.id, conversationId: msg.conversation_id, senderId: msg.sender_id,
      content: msg.content, attachmentUrl: msg.attachment_url, attachmentName: msg.attachment_name,
      timestamp: msg.timestamp, isRead: msg.is_read || msg.read_status || false, readAt: msg.read_at
    }));

    const notifications: Notification[] = (rNotifs.data || []).map((n: any) => ({
      id: n.id, userId: n.user_id, title: n.title, message: n.message,
      read: n.read, createdAt: n.created_at, category: n.category, sourceRecordId: n.source_record_id
    }));

    const auditLogs: AuditLog[] = (rAudit.data || []).map((al: any) => ({
      id: al.id, actor: al.actor, action: al.action, details: al.details, timestamp: al.timestamp
    }));

    const agentLogs: AgentLog[] = (rAgent.data || []).map((ag: any) => ({
      id: ag.id, agentName: ag.agent_name, message: ag.message,
      timestamp: ag.timestamp, type: ag.type
    }));

    const supportTickets: SupportTicket[] = (rTickets.data || []).map((st: any) => ({
      id: st.id, talentId: st.talent_id, clientId: st.client_id, linkedContractId: st.linked_contract_id,
      assignedTo: st.assigned_to, subject: st.subject, category: st.category,
      status: st.status, priority: st.priority, createdAt: st.created_at, lastActivity: st.last_activity || 'Active'
    }));

    const supportMessages: SupportMessage[] = (rSupportMessages.data || []).map((sm: any) => ({
      id: sm.id, ticketId: sm.ticket_id, senderName: sm.sender_name,
      senderRole: sm.sender_role, isSupport: sm.is_support, avatarUrl: sm.avatar_url,
      text: sm.text, timestamp: sm.timestamp, createdAt: sm.created_at
    }));

    const interviews: Interview[] = (rInterviews.data || []).map((iv: any) => ({
      id: iv.id, requestId: iv.request_id, matchId: iv.match_id, talentId: iv.talent_id,
      talentName: iv.talent_name, talentAvatar: iv.talent_avatar, clientName: iv.client_name,
      title: iv.title, date: iv.date, time: iv.time,
      status: mapInterviewStatusFromDb(iv),
      meetingLink: iv.meeting_link, notes: iv.notes, talentNotes: iv.talent_notes,
      clientRating: iv.client_rating, clientFeedback: iv.client_feedback, outcome: iv.outcome,
      googleCalendarEventId: iv.google_calendar_event_id,
      googleCalendarLink: iv.google_calendar_link,
      rescheduleRequested: iv.reschedule_requested,
      rescheduleReason: iv.reschedule_reason,
      proposedNewDate: iv.proposed_new_date,
      proposedNewTime: iv.proposed_new_time,
      // The instant and the zones. date and time are naive wall clock and
      // mean nothing on their own; these are what the portals render from.
      scheduledTime: iv.scheduled_time,
      scheduledTimezone: iv.scheduled_timezone,
      clientTimezone: iv.client_timezone,
      talentTimezone: iv.talent_timezone,
      proposedTime: iv.proposed_time,
      proposedTimezone: iv.proposed_timezone,
      rescheduleRequestedBy: iv.reschedule_requested_by,
      rescheduleRequestedAt: iv.reschedule_requested_at,
      rescheduledFrom: iv.rescheduled_from,
      createdAt: iv.created_at
    }));

    const requestActivityLogs: RequestActivityLog[] = (rRequestActivityLogs.data || []).map((al: any) => ({
      id: al.id,
      requestId: al.request_id,
      actorId: al.actor_id,
      actionType: al.action_type,
      fieldChanges: al.field_changes,
      createdAt: al.created_at
    }));

    const result: Schema = {
      talents,
      clientRequests,
      matches,
      tasks,
      contracts,
      notifications,
      auditLogs,
      agentLogs,
      users,
      organizations,
      clientProfiles,
      skills,
      talentSkills,
      documents,
      projects,
      assignments,
      invoices,
      payments,
      talentPayouts,
      messages,
      conversations,
      roles: (rRoles?.data || []) as any[],
      userRoles: ((rUserRoles?.data || []) as any[]).map((ur: any) => ({
        id: ur.id, userId: ur.user_id, roleId: ur.role_id
      })),
      supportTickets,
      supportMessages,
      interviews,
      requestActivityLogs,
      // Re-hire requests arrive as talent_requests with service_type
      // 'Re-hire'. This was a hardcoded empty array, so the re-hire
      // queue in the admin panel was always empty and its approve
      // handler was unreachable.
      rehireRequests: clientRequests
        .filter((r: any) => String(r.serviceType || '').toLowerCase() === 're-hire')
        .map((r: any) => ({
          id: r.id,
          rowId: (r as any).rowId,
          clientId: r.clientId,
          clientName: (r as any).clientName,
          talentId: (r as any).talentId,
          talentName: (r as any).talentName,
          role: (r as any).role || (r as any).roleDescription,
          proposedRate: (r as any).rate || (r as any).budget,
          proposedStartDate: (r as any).startDate,
          status: (r as any).rehireStatus || r.status,
          createdAt: r.createdAt
        })) as any,
      assessments: rAssessments?.data || [],
      assessmentCategories: rAssessmentCategories?.data || [],
      assessmentQuestions: rAssessmentQuestions?.data || [],
      assessmentAssignments: rAssessmentAssignments?.data || [],
      skillAssessmentResults: rSkillAssessmentResults?.data || [],
      talentSkillAssessments: rTalentSkillAssessments?.data || []
    };
    // Cache the successful result for fallback
    _lastSuccessfulRead = result;
    return result;

  } catch (err) {
    console.error('[DB] Critical error reading from Supabase:', err);
    if (_lastSuccessfulRead) {
      console.warn('[DB] Returning cached data due to network error.');
      return _lastSuccessfulRead;
    }
    return EMPTY_DB;
  }
}

// ─── writeDbAsync — writes ONLY to Supabase ───────────────────────────────────
export async function writeDbAsync(db: Schema): Promise<void> {
  // Persist assessments locally (not yet in Supabase)
  writeDb(db);

  const supabase = getSupabaseClient();

  try {
    if (db.users && db.users.length > 0) {
      const rows = db.users.map((u: any) => ({
        id: u.id,
        email: u.email,
        password_hash: 'auth_managed',
        role: u.role,
        status: u.status || 'active',
        email_verified: u.emailVerified || false
      }));
      const { error } = await supabase.from('users').upsert(rows);
      if (error) console.error('[DB] users upsert error:', error.message);
    }

    if (db.organizations && db.organizations.length > 0) {
      const rows = db.organizations.map((o: any) => ({
        id: o.id, name: o.name, created_by: o.created_by || null,
        industry: o.industry,
        company_size: o.company_size,
        country: o.country,
        website: o.website,
        how_did_you_hear_about_us: o.how_did_you_hear_about_us,
        multi_user_enabled: o.multi_user_enabled,
        account_manager_id: o.accountManagerId,
        status: o.status,
        internal_notes: o.internalNotes,
        contact_email: o.contactEmail,
        contact_phone: o.contactPhone,
        monthly_revenue: o.monthlyRevenue,
        last_activity_at: o.lastActivityAt
      }));
      const { error } = await supabase.from('organizations').upsert(rows);
      if (error) console.error('[DB] organizations upsert error:', error.message);
    }

    if (db.clientProfiles && db.clientProfiles.length > 0) {
      const rows = db.clientProfiles.map((cp: any) => ({
        id: cp.id, user_id: cp.userId, organization_id: cp.organizationId,
        position: cp.position || 'Admin', phone: cp.phone, permission_level: cp.permissionLevel, settings: cp.settings
      }));
      const { error } = await supabase.from('client_profiles').upsert(rows);
      if (error) console.error('[DB] client_profiles upsert error:', error.message);
    }

    if (db.talents && db.talents.length > 0) {
      const rows = db.talents.map((t: any) => {
        // Pack all complex fields as a JSON envelope into bio
        const telemetry = {
          createdAt: t.createdAt,
          onboardingVideoSeenAt: t.onboardingVideoSeenAt,
          onboardingVideoUrl: t.onboardingVideoUrl,
          profileCompletionPercent: t.profileCompletionPercent,
          requiresReReview: t.requiresReReview,
          fullName: t.name,
          phone: t.phone, phoneCode: t.phoneCode, city: t.city, country: t.country,
          timezone: t.timezone,
          dateOfBirth: t.dateOfBirth, gender: t.gender, nationality: t.nationality,
          profilePhotoUrl: t.profilePhotoUrl, profilePhotoName: t.profilePhotoName, profilePhotoSize: t.profilePhotoSize,
          cvUrl: t.cvUrl, cvName: t.cvName, cvSize: t.cvSize,
          title: t.title,
          yearsExperience: t.experienceYears,
          availability: t.availability,
          seniorityLevel: t.seniorityLevel, primaryRoleCategory: t.primaryRoleCategory,
          employmentPreference: t.employmentPreference, preferredEngagementType: t.preferredEngagementType,
          preferredWorkHours: t.preferredWorkHours, preferredProjectType: t.preferredProjectType,
          noticePeriod: t.noticePeriod, availableStartDate: t.availableStartDate, currency: t.currency, salaryExpectationUsd: t.salaryExpectationUsd,
          salaryExpectationMinUsd: t.salaryExpectationMinUsd, salaryExpectationMaxUsd: t.salaryExpectationMaxUsd,
          salaryExpectationCurrency: t.salaryExpectationCurrency, hourlyMonthly: t.hourlyMonthly, portfolioUrl: t.portfolioUrl,
          githubUrl: t.githubUrl, websiteUrl: t.websiteUrl, linkedIn: t.linkedIn, linkedinUrl: t.linkedinUrl,
          certifications: t.certifications, certificationFiles: t.certificationFiles, internetQuality: t.internetQuality, workSetup: t.workSetup,
          devices: t.devices, communicationTools: t.communicationTools, workExperience: t.workExperience,
          professionalSummary: t.professionalSummary, languages: t.languages, educations: t.educations,
          vettingPipeline: t.vettingPipeline, primarySkills: t.primarySkills, secondarySkills: t.secondarySkills,
          skills: t.skills, skillLevels: t.skillLevels, bio: t.bio
        };
        // Use JSON envelope — eliminates fragile string-splitting on read
        const packedBio = JSON.stringify({
          __kongila: true,
          tags: t.tags || [],
          scores: t.vettingScores || {},
          telemetry,
          bio: (typeof t.bio === 'string' && !t.bio.startsWith('{"__kongila":')) ? t.bio : ''
        });

        return {
          id: t.id,
          user_id: t.id,
          full_name: t.name || null,
          avatar_url: t.avatar || null,
          level: t.title || null,
          timezone: t.timezone || null,
          salary_expectation: t.salaryExpectation || null,
          experience_years: t.experienceYears || null,
          availability_hours: t.availability || null,
          vetting_stage: t.vettingStage || 'Application Screening',
          vetting_status: t.vettingStatus || 'Applied',
          grade: t.grade || null,
          country: t.country || null,
          phone: t.phone || null,
          gender: t.gender || null,
          address: t.address || null,
          bio: packedBio,
          status: 'active'
        };
      });
      const { error } = await supabase.from('talent_profiles').upsert(rows);
      if (error) console.error('[DB] talent_profiles upsert error:', error.message);
    }

    if (db.clientRequests && db.clientRequests.length > 0) {
      // talent_requests keeps the whole request in a jsonb payload and carries
      // only a few columns of its own. rowId is the primary key when the
      // request came from the database; a request created in memory has none,
      // so the row id is left to the column default and payload.id stays the
      // identifier the portals use.
      const rows = db.clientRequests.map((r: any) => {
        const { rowId, ...payload } = r as any;
        const row: any = {
          client_id: r.clientId,
          service_type: r.serviceType,
          payload: { ...payload, status: coerceRequestStatus(r.status) },
          status: coerceRequestStatus(r.status),
          role_description: r.roleDescription || null,
          title: r.title || r.roleDescription || null,
          talent_manager_id: r.assignedTalentManagerId || null,
          account_manager_id: r.assignedAccountManagerId || null
        };
        if (rowId) row.id = rowId;
        return row;
      });

      // A row with no primary key would be inserted again on every write, so
      // those go through insert and the rest through upsert.
      const withId = rows.filter((row: any) => row.id);
      const withoutId = rows.filter((row: any) => !row.id);

      if (withId.length > 0) {
        const { error } = await supabase.from('talent_requests').upsert(withId);
        if (error) console.error('[DB] talent_requests upsert error:', error.message);
      }
      if (withoutId.length > 0) {
        const { error } = await supabase.from('talent_requests').insert(withoutId);
        if (error) console.error('[DB] talent_requests insert error:', error.message);
      }
    }

    if (db.contracts && db.contracts.length > 0) {
      const rows = db.contracts.map((c: any) => ({
        id: c.id,
        talent_id: c.talentId,
        client_id: c.clientId,
        service_type: c.role,
        rate_type: c.rateType || 'Monthly',
        rate_amount: c.rateAmount || c.salary || 0,
        start_date: c.startDate,
        end_date: c.endDate,
        // contracts_status_check allows: pending, active, ended, terminated,
        // closed, pending_signatures, client_signed, talent_signed,
        // fully_signed. 'signed' and 'completed' are not in that list, so
        // every contract carrying either failed the whole batch upsert.
        ...contractStatusPatch(c),
        signed_at: c.signedAt || null,
        // termination_reason and client_monthly_fee_usd do not exist on this
        // table. Sending them rejected the entire batch, so no contract has
        // ever been written through this path.
        performance_score: c.performanceScore || 0
      }));
      const { error } = await supabase.from('contracts').upsert(rows);
      if (error) console.error('[DB] contracts upsert error:', error.message);
    }

    // ── Finance ───────────────────────────────────────────────────────
    // There were no branches for any of these three, so every finance
    // action was lost on reload: an invoice marked paid came back unpaid,
    // a recorded payment vanished, and a payout approval was never saved.

    if (db.invoices && db.invoices.length > 0) {
      const rows = db.invoices.map((inv: any) => ({
        id: inv.id,
        invoice_number: inv.invoiceNumber || null,
        client_id: inv.clientId,
        contract_id: inv.contractId || null,
        period: inv.period || null,
        service_line: inv.serviceLine || null,
        amount: Number(inv.amount || inv.totalUsd || 0),
        subtotal_usd: inv.subtotalUsd ?? inv.amount ?? 0,
        tax_amount_usd: inv.taxAmountUsd ?? 0,
        total_usd: inv.totalUsd ?? inv.amount ?? 0,
        status: inv.status || 'draft',
        due_date: inv.dueDate || null,
        is_disputed: inv.isDisputed || false,
        dispute_reason: inv.disputeReason || null,
        currency: inv.currency || 'USD',
        usd_rate: inv.usdRate ?? 1,
        rate_source: inv.rateSource || null,
        total_amount_usd: inv.totalAmountUsd ?? inv.totalUsd ?? inv.amount ?? 0,
        created_at: inv.createdAt || new Date().toISOString()
      }));
      const { error } = await supabase.from('invoices').upsert(rows);
      if (error) console.error('[DB] invoices upsert error:', error.message);
    }

    if (db.payments && db.payments.length > 0) {
      const rows = db.payments.map((p: any) => ({
        id: p.id,
        invoice_id: p.invoiceId,
        amount: Number(p.amount || 0),
        payment_method: p.paymentMethod || null,
        status: p.status || 'pending',
        paid_at: p.paidAt || null
      }));
      const { error } = await supabase.from('payments').upsert(rows);
      if (error) console.error('[DB] payments upsert error:', error.message);
    }

    if (db.talentPayouts && db.talentPayouts.length > 0) {
      const rows = db.talentPayouts.map((tp: any) => ({
        id: tp.id,
        talent_id: tp.talentId,
        contract_id: tp.contractId,
        invoice_id: tp.invoiceId || null,
        period: tp.period || null,
        gross_amount: tp.grossAmount ?? null,
        commission_pct: tp.commissionPct ?? null,
        net_amount: tp.netAmount ?? tp.amount ?? 0,
        amount: Number(tp.amount ?? tp.netAmount ?? 0),
        status: tp.status || 'pending',
        payment_method: tp.paymentMethod || null,
        failure_reason: tp.failureReason || null,
        currency: tp.currency || 'USD',
        usd_rate: tp.usdRate ?? 1,
        rate_source: tp.rateSource || null,
        net_amount_usd: tp.netAmountUsd ?? tp.netAmount ?? tp.amount ?? 0,
        paid_at: tp.paidAt || null,
        created_at: tp.createdAt || new Date().toISOString()
      }));
      const { error } = await supabase.from('talent_payouts').upsert(rows);
      if (error) console.error('[DB] talent_payouts upsert error:', error.message);
    }

    if (db.documents && db.documents.length > 0) {
      const rows = db.documents.map((d: any) => ({
        id: d.id,
        user_id: d.userId || null,
        name: d.name,
        file_name: d.fileName || d.name || null,
        type: d.type || 'other',
        file_url: d.fileUrl || null,
        file_size: d.fileSize || null,
        file_size_bytes: d.fileSizeBytes || 0,
        status: d.status || 'uploaded',
        version_number: d.versionNumber || 1,
        certification_name: d.certificationName || null,
        issuing_body: d.issuingBody || null,
        issue_date: d.issueDate || null,
        expiry_date: d.expiryDate || null,
        uploaded_at: d.uploadedAt || new Date().toISOString(),
        updated_at: d.updatedAt || new Date().toISOString(),
        is_mandatory: d.isMandatory || false,
        is_hidden: d.isHidden || false,
        // Survives the first candidate signing it. The old flow wrote the
        // signer's user_id onto the template, which quietly took it out of
        // the required set for everyone else.
        is_template: d.isTemplate ?? (d.isMandatory && !d.userId) ?? false,
        template_id: d.templateId || null,
        signature_data: d.signatureData || null,
        signed_at: d.signedAt || null,
        requires_re_review: d.requiresReReview || false,
        description: d.description || null
      }));
      const { error } = await supabase.from('documents').upsert(rows);
      if (error) console.error('[DB] documents upsert error:', error.message);
    }

    if (db.matches && db.matches.length > 0) {
      const rows = db.matches.map((m: any) => ({
        id: m.id,
        request_id: m.requestId,
        talent_id: m.talentId,
        status: m.status?.toLowerCase() || 'proposed',
        score: m.score || 0,
        breakdown: m.breakdown || null
      }));
      const { error } = await supabase.from('matches').upsert(rows);
      if (error) console.error('[DB] matches upsert error:', error.message);
    }

    if (db.supportTickets && db.supportTickets.length > 0) {
      const rows = db.supportTickets.map((st: any) => ({
        id: st.id, talent_id: st.talentId, client_id: st.clientId, linked_contract_id: st.linkedContractId,
        assigned_to: st.assignedTo, subject: st.subject,
        category: st.category, status: st.status, priority: st.priority,
        created_at: st.createdAt, last_activity: st.lastActivity
      }));
      const { error } = await supabase.from('support_tickets').upsert(rows);
      if (error) console.error('[DB] support_tickets upsert error:', error.message);
    }

    if (db.supportMessages && db.supportMessages.length > 0) {
      const rows = db.supportMessages.map((sm: any) => ({
        id: sm.id, ticket_id: sm.ticketId, sender_name: sm.senderName,
        sender_role: sm.senderRole, is_support: sm.isSupport, avatar_url: sm.avatarUrl,
        text: sm.text, timestamp: sm.timestamp,
        created_at: sm.createdAt ? new Date(sm.createdAt).toISOString() : new Date().toISOString()
      }));
      const { error } = await supabase.from('support_messages').upsert(rows);
      if (error) console.error('[DB] support_messages upsert error:', error.message);
    }

    if (db.auditLogs && db.auditLogs.length > 0) {
      const rows = db.auditLogs.map((al: any) => ({
        id: al.id, actor: al.actor, action: al.action,
        details: al.details, timestamp: al.timestamp
      }));
      const { error } = await supabase.from('audit_logs').upsert(rows);
      if (error) console.error('[DB] audit_logs upsert error:', error.message);
    }

    if (db.notifications && db.notifications.length > 0) {
      const rows = db.notifications.map((n: any) => ({
        id: n.id, user_id: n.userId, title: n.title,
        message: n.message, read: n.read || false,
        category: n.category, source_record_id: n.sourceRecordId,
        created_at: n.createdAt || new Date().toISOString()
      }));
      const { error } = await supabase.from('notifications').upsert(rows);
      if (error) console.error('[DB] notifications upsert error:', error.message);
    }

    if (db.conversations && db.conversations.length > 0) {
      const rows = db.conversations.map((c: any) => ({
        id: c.id, type: c.type, participant_ids: c.participantIds,
        context_type: c.contextType, context_id: c.contextId,
        created_at: c.createdAt, updated_at: c.updatedAt
      }));
      const { error } = await supabase.from('conversations').upsert(rows);
      if (error) console.error('[DB] conversations upsert error:', error.message);
    }

    if (db.messages && db.messages.length > 0) {
      const rows = db.messages.map((m: any) => ({
        id: m.id, conversation_id: m.conversationId, sender_id: m.senderId,
        content: m.content, attachment_url: m.attachmentUrl, attachment_name: m.attachmentName,
        timestamp: m.timestamp, is_read: m.isRead, read_at: m.readAt
      }));
      const { error } = await supabase.from('messages').upsert(rows);
      if (error) console.error('[DB] messages upsert error:', error.message);
    }

    if (db.talentSkillAssessments && db.talentSkillAssessments.length > 0) {
      // There was no branch for this table at all, so an assessment the admin
      // assigned during vetting was held in memory and lost on reload. The
      // columns are quoted camelCase, which is why the keys look like this.
      const rows = db.talentSkillAssessments.map((a: any) => ({
        id: a.id,
        talentId: a.talentId,
        assessmentId: a.assessmentId,
        status: a.status || 'assigned',
        score: a.score ?? null,
        assignedAt: a.assignedAt || null,
        answers: a.answers || null,
        subjectiveAnswers: a.subjectiveAnswers || null,
        submittedAt: a.submittedAt || null
      }));
      const { error } = await supabase.from('talent_skill_assessments').upsert(rows);
      if (error) console.error('[DB] talent_skill_assessments upsert error:', error.message);
    }

    if (db.agentLogs && db.agentLogs.length > 0) {
      const rows = db.agentLogs.map((ag: any) => {
        // Ensure timestamp is a valid ISO string, not a locale time string like "7:10 PM"
        let ts = ag.timestamp;
        if (ts && !ts.includes('T') && !ts.includes('-')) {
          ts = new Date().toISOString(); // fallback
        }
        return {
          id: ag.id, agent_name: ag.agentName, message: ag.message,
          timestamp: ts, type: ag.type || 'info'
        };
      });
      const { error } = await supabase.from('agent_logs').upsert(rows);
      if (error) console.error('[DB] agent_logs upsert error:', error.message);
    }

    if (db.interviews && db.interviews.length > 0) {
      // client_id is NOT NULL. This used to default to the string 'system',
      // which overwrote the real client on any interview that reached this
      // writer without one. Defaulting to null instead would reject the whole
      // batch, taking every other interview with it, so a row with no client
      // is skipped and named in the log rather than guessed at or silently
      // corrupted.
      const writable = db.interviews.filter((iv: any) => {
        if (iv.clientId) return true;
        console.error(`[DB] interview ${iv.id} has no clientId and was not saved.`);
        return false;
      });

      const rows = writable.map((iv: any) => ({
        id: iv.id,
        request_id: iv.requestId || null,
        match_id: iv.matchId || null,
        client_id: iv.clientId,
        talent_id: iv.talentId,
        talent_name: iv.talentName,
        talent_avatar: iv.talentAvatar || null,
        client_name: iv.clientName,
        title: iv.title,
        date: iv.date,
        time: iv.time,
        // 'Rescheduled' and 'Scheduled' are both legal values, so neither
        // needs collapsing. This used to flatten all three to 'scheduled'
        // and the reader only restored 'Scheduled', so a rescheduled
        // interview reverted on every save and the admin's Rescheduled
        // counter read zero after any reload.
        status: mapInterviewStatusToDb(iv.status),
        meeting_link: iv.meetingLink || null,
        notes: iv.notes || null,
        talent_notes: iv.talentNotes || null,
        client_rating: iv.clientRating || null,
        client_feedback: iv.clientFeedback || null,
        outcome: iv.outcome || null,
        google_calendar_event_id: iv.googleCalendarEventId || null,
        google_calendar_link: iv.googleCalendarLink || null,
        reschedule_requested: iv.rescheduleRequested || false,
        reschedule_reason: iv.rescheduleReason || null,
        proposed_new_date: iv.proposedNewDate || null,
        proposed_new_time: iv.proposedNewTime || null,
        // Never derived from date and time here. If an interview reaches this
        // writer without an instant, the instant is missing upstream and
        // inventing one from a zoneless wall clock is how the whole problem
        // started. It is left null and the reader says "not scheduled".
        scheduled_time: iv.scheduledTime || null,
        scheduled_timezone: iv.scheduledTimezone || null,
        client_timezone: iv.clientTimezone || null,
        talent_timezone: iv.talentTimezone || null,
        proposed_time: iv.proposedTime || null,
        proposed_timezone: iv.proposedTimezone || null,
        reschedule_requested_by: iv.rescheduleRequestedBy || null,
        reschedule_requested_at: iv.rescheduleRequestedAt || null,
        rescheduled_from: iv.rescheduledFrom || null,
        created_at: iv.createdAt || new Date().toISOString()
      }));
      if (rows.length > 0) {
        const { error } = await supabase.from('interviews').upsert(rows);
        if (error) console.error('[DB] interviews upsert error:', (error as any).message);
      }
    }

    // Persist local assessments (not in Supabase yet)
    writeDb(db);

  } catch (err) {
    console.error('[DB] writeDbAsync error:', err);
  }
}

export async function logRequestActivityAsync(
  requestId: string,
  actorId: string | null,
  actionType: string,
  fieldChanges?: Record<string, { old: any; new: any }>
): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase.from('request_activity_logs').insert({
    request_id: requestId,
    actor_id: actorId,
    action_type: actionType,
    field_changes: fieldChanges || null
  });
  if (error) {
    console.error('[DB] Failed to log request activity:', error);
    throw error;
  }
}

// ─── Interviews, server side ───────────────────────────────
// Every create or change to an interview goes through this, from both
// portals, so the conflict check, the invitation and the audit entry cannot
// be bypassed by writing to the table from a browser.
export * from './interviewService';

// ─── Notifications ───────────────────────────────────
// One call writes the in-app row and sends the email, so the two cannot
// drift apart the way they did when every call site wrote its own.
export * from './notify';

// ─── Audit and operator accounts ───────────────────────
// Both are server side only: the audit log cannot be written from a browser
// at all, and only a super admin can change who has access.
export * from './audit';
export * from './userService';

// ─── Support and settings ────────────────────────────
export * from './supportService';
export * from './settingsService';

export * from './messagingService';

// -- Signatures and the compliance gate ---------------
// Signing is append-only and hashed, and every gated path calls
// complianceGate rather than implementing its own check.
export * from './signatureService';

// -- Billing ------------------------------------------
// Fees, invoice generation and payouts. The decisions live in
// @kongila/workflows/billing; this is the part that writes rows.
export * from './financeService';

// -- Payroll ------------------------------------------
// The monthly run for managed and outsourced contracts. The Remotan
// payroll_entries table is left alone; this uses Kongila tables.
export * from './payrollService';

// -- Invoice delivery and ageing ----------------------
// Numbering, due dates from contract terms, the PDF, sending, and
// the nightly pass that moves a sent invoice to overdue.
export * from './invoiceDelivery';

// -- Document versions and expiry ---------------------
export * from './documentService';

// -- Talent profiles ----------------------------------
// Every write to talent_profiles and talent_skills. The browser used
// to upsert the whole row, grade and vetting status included.
export * from './profileService';

// -- Skill assessments --------------------------------
// Submission and marking. The browser used to post its own score.
export * from './assessmentService';

// -- Matches ------------------------------------------
// A client shortlisting, rejecting or accepting a candidate, and the
// notifications that go with it.
export * from './matchService';

// -- Company ------------------------------------------
// A client editing their own organisation and contact details.
export * from './companyService';

// -- Reviews ------------------------------------------
// Client reviews of a placed candidate. They were written into the
// notifications table as message text and never landed.
export * from './reviewService';

// -- Assignments --------------------------------------
// Giving a client or a request an account or talent manager. The admin
// panel used to upsert roles and user_roles from the browser to do it.
export * from './assignmentService';

// -- Matching -----------------------------------------
// Operations submitting a shortlist to a client.
export * from './matchingService';

// -- Contract status ----------------------------------
// Moving a contract through signature, activation and termination.
export * from './contractStatusService';

// -- Contract templates -------------------------------
// Drafts, publishing and versioning. Never stored anywhere before.
export * from './templateService';

// -- Vetting ------------------------------------------
// Scores, grade and the stage pipeline. The panel ran all of it in
// browser state and posted the whole talents array back.
export * from './vettingService';

// -- Uploads ------------------------------------------
// Signed upload URLs. The browser used to pick its own object path.
export * from './uploadService';

// -- Directories --------------------------------------
// The client and candidate reads the admin screens need, so they stop
// pulling the whole database through /api/db and filtering in the browser.
export * from './clientService';
export * from './talentDirectoryService';
