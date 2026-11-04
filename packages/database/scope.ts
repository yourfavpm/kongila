// ─────────────────────────────────────────────────────────────────────────────
// Per-role scoping for /api/db
//
// readDbAsync returns the whole database. These functions cut it down to what
// one caller is allowed to see, and cut an incoming write down to what that
// caller is allowed to change.
//
// Both are pure. No network, no Supabase client, no side effects, so they can
// be unit tested with a plain object.
//
// The rule: default to excluding. A table that is not named in a role's list
// comes back empty rather than whole. When a new table is added to the schema
// it is therefore invisible until someone decides who should see it, which is
// the failure direction we want.
// ─────────────────────────────────────────────────────────────────────────────

export interface RequestActor {
  userId: string;
  email: string | null;
  role: string;
  kind: 'talent' | 'client' | 'admin';
  organizationId: string | null;
  talentProfileId: string | null;
}

const EMPTY: any[] = [];

function arr(v: any): any[] {
  return Array.isArray(v) ? v : EMPTY;
}

function idsOf(rows: any[], key = 'id'): Set<string> {
  const s = new Set<string>();
  for (const r of rows) if (r && r[key] != null) s.add(String(r[key]));
  return s;
}

/**
 * Fields on a talent record that nobody outside Kongila operations should see.
 * Clients reviewing a candidate get the professional profile without the
 * identity documents. Adjust this list rather than the scoping logic below.
 */
const TALENT_PRIVATE_FIELDS = [
  'dateOfBirth',
  'nationalId',
  'passportNo',
  'maritalStatus',
  'gender',
  'address',
  'nationality'
];

function redactTalentForClient(t: any) {
  if (!t) return t;
  const copy = { ...t };
  for (const f of TALENT_PRIVATE_FIELDS) delete copy[f];
  return copy;
}

/** Assessment questions carry the answer key. Never send it to a candidate. */
function stripAnswerKey(q: any) {
  if (!q) return q;
  const copy = { ...q };
  delete copy.correctAnswer;
  delete copy.correct_answer;
  delete copy.answerKey;
  delete copy.answer_key;
  return copy;
}

/**
 * Cut a full database snapshot down to what this actor may read.
 * Admins get everything. Everyone else gets their own slice.
 */
export function scopeDbForUser(db: any, actor: RequestActor): any {
  if (!db) return db;
  if (actor.kind === 'admin') return db;
  if (actor.kind === 'talent') return scopeForTalent(db, actor);
  if (actor.kind === 'client') return scopeForClient(db, actor);
  // Unknown role: nothing.
  return {};
}

// ─── Talent ──────────────────────────────────────────────────────────────────

function scopeForTalent(db: any, actor: RequestActor) {
  const uid = actor.userId;
  const tid = actor.talentProfileId;

  // A talent with no talent_profiles row has nothing to show yet. Return the
  // empty shape rather than null so the dashboard renders its empty states.
  const ownTalents = tid ? arr(db.talents).filter((t: any) => String(t.id) === String(tid)) : EMPTY;

  const ownMatches = tid ? arr(db.matches).filter((m: any) => String(m.talentId) === String(tid)) : EMPTY;
  const ownInterviews = tid ? arr(db.interviews).filter((iv: any) => String(iv.talentId) === String(tid)) : EMPTY;
  const ownContracts = tid ? arr(db.contracts).filter((c: any) => String(c.talentId) === String(tid)) : EMPTY;
  const ownTickets = tid ? arr(db.supportTickets).filter((st: any) => String(st.talentId) === String(tid)) : EMPTY;

  // Requests the talent is actually connected to, via a match, interview or
  // contract. These are their opportunities. Every other client request stays
  // invisible.
  const relatedRequestIds = new Set<string>();
  for (const m of ownMatches) if (m.requestId) relatedRequestIds.add(String(m.requestId));
  for (const iv of ownInterviews) if (iv.requestId) relatedRequestIds.add(String(iv.requestId));
  const relatedRequests = arr(db.clientRequests).filter((r: any) => relatedRequestIds.has(String(r.id)));

  // Organisations behind those requests and contracts, so role cards can show
  // a company name.
  const relatedOrgIds = new Set<string>();
  const clientUserIds = new Set<string>();
  for (const r of relatedRequests) if (r.clientId) clientUserIds.add(String(r.clientId));
  for (const c of ownContracts) if (c.clientId) clientUserIds.add(String(c.clientId));
  for (const cp of arr(db.clientProfiles)) {
    if (clientUserIds.has(String(cp.userId)) && cp.organizationId) relatedOrgIds.add(String(cp.organizationId));
  }

  const ownConversations = arr(db.conversations).filter((c: any) =>
    Array.isArray(c.participantIds) && c.participantIds.map(String).includes(String(uid))
  );
  const ownConversationIds = idsOf(ownConversations);
  const ownTicketIds = idsOf(ownTickets);

  return {
    ...emptyShape(db),

    talents: ownTalents,
    users: arr(db.users).filter((u: any) => String(u.id) === String(uid)),
    documents: arr(db.documents).filter((d: any) => String(d.userId) === String(uid)),

    matches: ownMatches,
    interviews: ownInterviews,
    contracts: ownContracts,
    clientRequests: relatedRequests,
    organizations: arr(db.organizations).filter((o: any) => relatedOrgIds.has(String(o.id))),

    notifications: arr(db.notifications).filter((n: any) => String(n.userId) === String(uid)),
    conversations: ownConversations,
    messages: arr(db.messages).filter((m: any) => ownConversationIds.has(String(m.conversationId))),

    supportTickets: ownTickets,
    supportMessages: arr(db.supportMessages).filter((sm: any) => ownTicketIds.has(String(sm.ticketId))),

    talentPayouts: tid ? arr(db.talentPayouts).filter((tp: any) => String(tp.talentId) === String(tid)) : EMPTY,
    talentSkills: tid ? arr(db.talentSkills).filter((ts: any) => String(ts.talentId) === String(tid)) : EMPTY,
    skills: arr(db.skills), // lookup table, no personal data

    // Assessment material the candidate needs in order to sit a test, minus
    // the answer key.
    assessments: arr(db.assessments),
    assessmentCategories: arr(db.assessmentCategories),
    assessmentQuestions: arr(db.assessmentQuestions).map(stripAnswerKey),
    assessmentAssignments: tid
      ? arr(db.assessmentAssignments).filter((a: any) => String(a.talentId ?? a.talent_id) === String(tid))
      : EMPTY,
    talentSkillAssessments: tid
      ? arr(db.talentSkillAssessments).filter((a: any) => String(a.talentId ?? a.talent_id) === String(tid))
      : EMPTY,
    skillAssessmentResults: tid
      ? arr(db.skillAssessmentResults).filter((a: any) => String(a.talentId ?? a.talent_id) === String(tid))
      : EMPTY,
    workSimulationTasks: tid
      ? arr(db.workSimulationTasks).filter((w: any) => String(w.talentId ?? w.talent_id) === String(tid))
      : EMPTY,
    performanceReviews: tid
      ? arr(db.performanceReviews).filter((p: any) => String(p.talentId ?? p.talent_id) === String(tid))
      : EMPTY,

    platformSettings: arr(db.platformSettings),
    tagDictionary: arr(db.tagDictionary)
  };
}

// ─── Client ──────────────────────────────────────────────────────────────────

function scopeForClient(db: any, actor: RequestActor) {
  const uid = actor.userId;
  const orgId = actor.organizationId;

  // Everyone in the same organisation. A client with no organisation row sees
  // only their own records.
  const orgProfiles = orgId
    ? arr(db.clientProfiles).filter((cp: any) => String(cp.organizationId) === String(orgId))
    : arr(db.clientProfiles).filter((cp: any) => String(cp.userId) === String(uid));
  const orgUserIds = new Set<string>(orgProfiles.map((cp: any) => String(cp.userId)));
  orgUserIds.add(String(uid));

  const ownRequests = arr(db.clientRequests).filter((r: any) => orgUserIds.has(String(r.clientId)));
  const ownRequestIds = idsOf(ownRequests);

  const ownMatches = arr(db.matches).filter((m: any) => ownRequestIds.has(String(m.requestId)));
  const matchedTalentIds = new Set<string>(ownMatches.map((m: any) => String(m.talentId)));

  const ownContracts = arr(db.contracts).filter((c: any) => orgUserIds.has(String(c.clientId)));
  for (const c of ownContracts) if (c.talentId) matchedTalentIds.add(String(c.talentId));

  const ownInvoices = arr(db.invoices).filter((inv: any) => orgUserIds.has(String(inv.clientId)));
  const ownInvoiceIds = idsOf(ownInvoices);

  const ownConversations = arr(db.conversations).filter((c: any) =>
    Array.isArray(c.participantIds) && c.participantIds.map(String).includes(String(uid))
  );
  const ownConversationIds = idsOf(ownConversations);

  const ownTickets = arr(db.supportTickets).filter((st: any) => orgUserIds.has(String(st.clientId)));
  const ownTicketIds = idsOf(ownTickets);

  // Candidates this client has a real relationship with, with identity
  // documents removed.
  const visibleTalents = arr(db.talents)
    .filter((t: any) => matchedTalentIds.has(String(t.id)))
    .map(redactTalentForClient);
  const visibleTalentUserIds = new Set<string>(); // talents expose no userId, so none

  return {
    ...emptyShape(db),

    talents: visibleTalents,
    clientRequests: ownRequests,
    matches: ownMatches,
    interviews: arr(db.interviews).filter((iv: any) => ownRequestIds.has(String(iv.requestId))),
    contracts: ownContracts,

    organizations: orgId ? arr(db.organizations).filter((o: any) => String(o.id) === String(orgId)) : EMPTY,
    clientProfiles: orgProfiles,
    users: arr(db.users).filter((u: any) => orgUserIds.has(String(u.id))),

    invoices: ownInvoices,
    payments: arr(db.payments).filter((p: any) => ownInvoiceIds.has(String(p.invoiceId))),

    notifications: arr(db.notifications).filter((n: any) => String(n.userId) === String(uid)),
    conversations: ownConversations,
    messages: arr(db.messages).filter((m: any) => ownConversationIds.has(String(m.conversationId))),

    supportTickets: ownTickets,
    supportMessages: arr(db.supportMessages).filter((sm: any) => ownTicketIds.has(String(sm.ticketId))),

    documents: arr(db.documents).filter((d: any) =>
      orgUserIds.has(String(d.userId)) || visibleTalentUserIds.has(String(d.userId))
    ),

    rehireRequests: arr(db.rehireRequests).filter((r: any) => orgUserIds.has(String(r.clientId))),
    requestActivityLogs: arr(db.requestActivityLogs).filter((l: any) => ownRequestIds.has(String(l.requestId))),

    platformSettings: arr(db.platformSettings),
    tagDictionary: arr(db.tagDictionary)
  };
}

/**
 * Every key the schema has, set to an empty array, so a scoped response has
 * the same shape as an unscoped one and no screen hits `undefined.map`.
 */
function emptyShape(db: any) {
  const out: Record<string, any> = {};
  for (const key of Object.keys(db)) {
    out[key] = Array.isArray(db[key]) ? [] : db[key];
  }
  return out;
}

// ─── Writes ──────────────────────────────────────────────────────────────────

/**
 * Tables each role may write through /api/db, and how to tell whether a given
 * row belongs to the caller. A table absent from the map cannot be written by
 * that role at all.
 *
 * `users`, `roles`, `userRoles` and `auditLogs` are deliberately absent from
 * both non-admin maps. Writing `users` through this route was an unauthenticated
 * path to super_admin.
 */
type OwnershipTest = (row: any, actor: RequestActor) => boolean;

const TALENT_WRITABLE: Record<string, OwnershipTest> = {
  talents: (r, a) => String(r?.id) === String(a.talentProfileId),
  documents: (r, a) => String(r?.userId) === String(a.userId),
  notifications: (r, a) => String(r?.userId) === String(a.userId),
  supportTickets: (r, a) => String(r?.talentId) === String(a.talentProfileId),
  supportMessages: () => true, // scoped by ticket on the way in; see note below
  conversations: (r, a) =>
    Array.isArray(r?.participantIds) && r.participantIds.map(String).includes(String(a.userId)),
  messages: (r, a) => String(r?.senderId) === String(a.userId),
  talentSkillAssessments: (r, a) => String(r?.talentId ?? r?.talent_id) === String(a.talentProfileId),
  skillAssessmentResults: (r, a) => String(r?.talentId ?? r?.talent_id) === String(a.talentProfileId),
  workSimulationTasks: (r, a) => String(r?.talentId ?? r?.talent_id) === String(a.talentProfileId)
};

const CLIENT_WRITABLE: Record<string, OwnershipTest> = {
  clientRequests: (r, a) => String(r?.clientId) === String(a.userId),
  matches: () => true, // narrowed below against the caller's own request ids
  interviews: () => true, // narrowed below against the caller's own request ids
  notifications: (r, a) => String(r?.userId) === String(a.userId),
  supportTickets: (r, a) => String(r?.clientId) === String(a.userId),
  supportMessages: () => true,
  conversations: (r, a) =>
    Array.isArray(r?.participantIds) && r.participantIds.map(String).includes(String(a.userId)),
  messages: (r, a) => String(r?.senderId) === String(a.userId),
  clientProfiles: (r, a) => String(r?.userId) === String(a.userId),
  organizations: (r, a) => String(r?.id) === String(a.organizationId),
  rehireRequests: (r, a) => String(r?.clientId) === String(a.userId)
};

/**
 * Reduce an incoming POST body to the rows this actor is allowed to write.
 * Returns the filtered body plus a list of what was dropped, so the route can
 * log a rejection rather than failing silently.
 *
 * `existing` is the current database snapshot, used to check that a client only
 * touches matches and interviews belonging to their own requests.
 */
export function filterWritableDb(
  incoming: any,
  actor: RequestActor,
  existing: any
): { body: any; rejected: string[] } {
  if (!incoming || typeof incoming !== 'object') return { body: {}, rejected: [] };
  if (actor.kind === 'admin') return { body: incoming, rejected: [] };

  const map = actor.kind === 'talent' ? TALENT_WRITABLE : CLIENT_WRITABLE;
  const rejected: string[] = [];
  const body: Record<string, any> = {};

  // For a client, matches and interviews are owned transitively through the
  // request they belong to.
  let ownRequestIds: Set<string> | null = null;
  if (actor.kind === 'client') {
    const orgProfiles = actor.organizationId
      ? arr(existing?.clientProfiles).filter((cp: any) => String(cp.organizationId) === String(actor.organizationId))
      : [];
    const orgUserIds = new Set<string>(orgProfiles.map((cp: any) => String(cp.userId)));
    orgUserIds.add(String(actor.userId));
    ownRequestIds = idsOf(arr(existing?.clientRequests).filter((r: any) => orgUserIds.has(String(r.clientId))));
  }

  for (const key of Object.keys(incoming)) {
    const test = map[key];
    if (!test) {
      rejected.push(key);
      continue;
    }
    const rows = incoming[key];
    if (!Array.isArray(rows)) {
      rejected.push(key);
      continue;
    }

    const kept = rows.filter((row: any) => {
      if (!test(row, actor)) return false;
      if (ownRequestIds && (key === 'matches' || key === 'interviews')) {
        return ownRequestIds.has(String(row?.requestId));
      }
      return true;
    });

    if (kept.length !== rows.length) rejected.push(`${key} (${rows.length - kept.length} row(s))`);
    if (kept.length > 0) body[key] = kept;
  }

  return { body, rejected };
}
