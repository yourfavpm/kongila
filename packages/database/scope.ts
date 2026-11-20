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
  /**
   * What this operator may do, with the super admin's edits applied.
   *
   * Resolved once per request, in getRequestUser, so a route checks a list
   * it already has rather than reading the matrix again. Empty for clients
   * and candidates, who are scoped by ownership rather than by permission.
   */
  permissions?: string[];
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
 * Every id a request may be known by.
 *
 * A request's identity is its row id, and everything written against it — the
 * matches, interviews, offers, contracts and call requests — carries that one.
 * Rows written before that was settled reference the id the intake form put in
 * the payload instead, so both are collected here. Matching on the set rather
 * than on `id` alone is what keeps a client's shortlist from being filtered
 * out of their own dashboard because the row was written under the other name.
 */
function requestIdentities(rows: any[]): Set<string> {
  const s = new Set<string>();
  for (const r of arr(rows)) {
    if (!r) continue;
    for (const value of [r.id, r.rowId, r.payloadId]) {
      if (value != null && value !== '') s.add(String(value));
    }
  }
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
  'nationality',
  // Ways to reach the candidate directly.
  //
  // These were being sent to clients. Kongila introduces the candidate and
  // handles the conversation, and a client who has the email address or the
  // phone number of someone they have not hired can step around all of it.
  // The CV goes for the same reason rather than a different one: a CV header
  // is an email address, a phone number and usually a home address.
  'email',
  'phone',
  'linkedIn',
  'linkedinUrl',
  'cvUrl',
  'cvName',
  'cvSize'
];

function redactTalentForClient(t: any) {
  if (!t) return t;
  const copy = { ...t };
  for (const f of TALENT_PRIVATE_FIELDS) delete copy[f];
  // A self-reported personality profile is for the talent and Kongila's
  // vetting team. It is not part of the professional profile shared with a
  // prospective client.
  delete copy.personalitySnapshot;
  if (Array.isArray(copy.vettingPipeline)) {
    copy.vettingPipeline = copy.vettingPipeline.map((stage: any) => {
      if (!stage || typeof stage !== 'object') return stage;
      const safeStage = { ...stage };
      delete safeStage.personalityAssessment;
      // Remote readiness includes device and network diagnostics used by
      // Kongila's vetting team, not information for prospective clients.
      delete safeStage.remoteReadiness;
      return safeStage;
    });
  }
  return copy;
}

/**
 * The Kongila person looking after this account, as the client may see them.
 *
 * A client's `users` is filtered to their own organisation, and an account
 * manager is an administrator, so they were never in it. The dashboard looked
 * the assignee up in that list, found nothing, and told every client their
 * account manager was "Unassigned" — including the ones who had one.
 *
 * Only what a client needs in order to recognise and contact them: who they
 * are and how to reach them. Not their status, not their internal role, not
 * anything else on the row.
 */
function contactCardForClient(u: any) {
  if (!u) return null;
  return {
    id: u.id,
    name: u.name || '',
    email: u.email || null,
    // Marks this user as somebody from Kongila rather than a colleague, so a
    // screen listing people can say which is which without having to infer it
    // from an internal role name.
    isKongilaContact: true
  };
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
/**
 * The resources a portal may ask for through /api/resources.
 *
 * It lived as a copy in each app's route. It belongs here, beside the
 * scoping that decides what each caller actually receives.
 */
export const SCOPED_RESOURCES = [
  'organizations', 'clientProfiles', 'users', 'talents', 'clientRequests', 'matches',
  'notifications', 'rehireRequests', 'supportTickets', 'supportMessages', 'interviews',
  'documents', 'requestActivityLogs', 'assessments', 'assessmentCategories',
  'assessmentQuestions', 'talentSkillAssessments', 'skillAssessmentResults',
  'assessmentAssignments', 'workSimulationTasks', 'contracts', 'contractTemplates',
  'auditLogs', 'agentLogs', 'invoices', 'payments', 'talentPayouts',
  'platformSettings', 'tagDictionary', 'performanceReviews'
] as const;

export type ScopedResource = typeof SCOPED_RESOURCES[number];

const SCOPED_RESOURCE_SET = new Set<string>(SCOPED_RESOURCES);

export function isScopedResource(name: unknown): name is ScopedResource {
  return typeof name === 'string' && SCOPED_RESOURCE_SET.has(name);
}

/**
 * Operations roles that see the whole book of business.
 *
 * Everyone else in operations sees what they are responsible for. That is
 * not a security boundary — every one of these people is an administrator
 * and could widen it — it is so a talent manager with nine candidates opens
 * their dashboard to nine candidates instead of all two hundred.
 */
const SEES_EVERYTHING = new Set([
  'super_admin', 'superadmin', 'admin', 'ops_manager', 'operations_manager'
]);

function normaliseRole(role: unknown): string {
  return String(role || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
}

/**
 * A talent manager's own book.
 *
 * Narrowed by candidate: the candidates they own, and then everything that
 * hangs off those candidates — their interviews, matches, assessments and
 * vetting. Requests and clients are left whole, because a talent manager
 * fills roles across the business and needs to see what is being asked for.
 *
 * An unassigned candidate is visible to everyone in operations. They have to
 * be: somebody has to pick them up, and a candidate nobody can see is a
 * candidate nobody assigns.
 */
function scopeForTalentManager(db: any, actor: RequestActor): any {
  const allTalents = arr(db.talents);
  const mine = allTalents.filter((t: any) => {
    const owner = t?.talentManagerId ? String(t.talentManagerId) : null;
    return owner === String(actor.userId);
  });
  const mineIds = new Set(mine.map((t: any) => String(t.id)));
  const keep = (id: unknown) => mineIds.has(String(id));
  const matches = arr(db.matches).filter((m: any) => keep(m.talentId));
  const interviews = arr(db.interviews).filter((iv: any) => keep(iv.talentId));
  const contracts = arr(db.contracts).filter((c: any) => keep(c.talentId));
  const requestIds = new Set([
    ...matches.map((m: any) => String(m.requestId)),
    ...interviews.map((iv: any) => String(iv.requestId))
  ]);
  const requests = arr(db.clientRequests).filter((r: any) =>
    requestIds.has(String(r.id)) || requestIds.has(String(r.rowId)) || requestIds.has(String(r.payloadId))
  );
  const conversations = arr(db.conversations).filter((c: any) =>
    Array.isArray(c.participantIds) && c.participantIds.map(String).includes(String(actor.userId))
  );
  const conversationIds = idsOf(conversations);
  const ticketIds = new Set(arr(db.supportTickets)
    .filter((ticket: any) => keep(ticket.talentId)).map((ticket: any) => String(ticket.id)));

  return {
    ...db,
    talents: mine,
    interviews,
    matches,
    contracts,
    clientRequests: requests,
    organizations: arr(db.organizations).filter((org: any) => {
      const clientIds = new Set(arr(db.clientProfiles)
        .filter((profile: any) => requestIds.has(String(profile.userId)))
        .map((profile: any) => String(profile.organizationId)));
      return clientIds.has(String(org.id));
    }),
    clientProfiles: arr(db.clientProfiles).filter((profile: any) => requestIds.has(String(profile.userId))),
    notifications: arr(db.notifications).filter((n: any) => String(n.userId) === String(actor.userId)),
    conversations,
    messages: arr(db.messages).filter((m: any) => conversationIds.has(String(m.conversationId))),
    supportTickets: arr(db.supportTickets).filter((ticket: any) => keep(ticket.talentId)),
    supportMessages: arr(db.supportMessages).filter((message: any) => ticketIds.has(String(message.ticketId))),
    documents: arr(db.documents).filter((doc: any) => mine.some((talent: any) => String(talent.userId || talent.id) === String(doc.userId))),
    assignments: arr(db.assignments).filter((assignment: any) => keep(assignment.talentId)),
    talentPayouts: arr(db.talentPayouts).filter((payout: any) => keep(payout.talentId)),
    talentSkills: arr(db.talentSkills).filter((skill: any) => keep(skill.talentId)),
    talentSkillAssessments: arr(db.talentSkillAssessments)
      .filter((a: any) => keep(a.talentId ?? a.talent_id)),
    skillAssessmentResults: arr(db.skillAssessmentResults)
      .filter((r: any) => keep(r.talentId ?? r.talent_id)),
    assessmentAssignments: arr(db.assessmentAssignments).filter((a: any) => keep(a.talentId ?? a.talent_id)),
    workSimulationTasks: arr(db.workSimulationTasks).filter((w: any) => keep(w.talentId ?? w.talent_id)),
    performanceReviews: arr(db.performanceReviews).filter((review: any) => keep(review.talentId))
  };
}

/** Account managers see only their portfolio and the records attached to it. */
function scopeForAccountManager(db: any, actor: RequestActor): any {
  const organizationIds = new Set(arr(db.organizations)
    .filter((org: any) => String(org.accountManagerId || org.account_manager_id || '') === String(actor.userId))
    .map((org: any) => String(org.id)));
  const clientIds = new Set(arr(db.clientProfiles)
    .filter((profile: any) => organizationIds.has(String(profile.organizationId || profile.organization_id)))
    .map((profile: any) => String(profile.userId || profile.user_id)));
  const requests = arr(db.clientRequests).filter((request: any) =>
    clientIds.has(String(request.clientId || request.client_id))
    || String(request.assignedAccountManagerId || request.account_manager_id || '') === String(actor.userId)
  );
  const requestIds = new Set(requests.flatMap((request: any) =>
    [request.id, request.rowId, request.payloadId, request.payload?.id].filter(Boolean).map(String)
  ));
  const matches = arr(db.matches).filter((match: any) => requestIds.has(String(match.requestId)));
  const interviews = arr(db.interviews).filter((interview: any) => requestIds.has(String(interview.requestId)));
  const contracts = arr(db.contracts).filter((contract: any) => clientIds.has(String(contract.clientId)));
  const talentIds = new Set([
    ...matches.map((match: any) => String(match.talentId)),
    ...contracts.map((contract: any) => String(contract.talentId))
  ]);
  const invoiceIds = new Set(arr(db.invoices)
    .filter((invoice: any) => clientIds.has(String(invoice.clientId))).map((invoice: any) => String(invoice.id)));
  const conversations = arr(db.conversations).filter((conversation: any) =>
    Array.isArray(conversation.participantIds) && conversation.participantIds.map(String).includes(String(actor.userId))
  );
  const conversationIds = idsOf(conversations);
  const ticketIds = new Set(arr(db.supportTickets)
    .filter((ticket: any) => clientIds.has(String(ticket.clientId))).map((ticket: any) => String(ticket.id)));
  const ownTalents = arr(db.talents).filter((talent: any) => talentIds.has(String(talent.id)));
  const ownTalentIds = new Set(ownTalents.map((talent: any) => String(talent.id)));
  const ownContracts = new Set(contracts.map((contract: any) => String(contract.id)));

  return {
    ...db,
    organizations: arr(db.organizations).filter((org: any) => organizationIds.has(String(org.id))),
    clientProfiles: arr(db.clientProfiles).filter((profile: any) => clientIds.has(String(profile.userId || profile.user_id))),
    clientRequests: requests,
    matches,
    interviews,
    contracts,
    talents: ownTalents,
    talentSkills: arr(db.talentSkills).filter((row: any) => ownTalentIds.has(String(row.talentId))),
    talentSkillAssessments: arr(db.talentSkillAssessments).filter((row: any) => ownTalentIds.has(String(row.talentId ?? row.talent_id))),
    skillAssessmentResults: arr(db.skillAssessmentResults).filter((row: any) => ownTalentIds.has(String(row.talentId ?? row.talent_id))),
    workSimulationTasks: arr(db.workSimulationTasks).filter((row: any) => ownTalentIds.has(String(row.talentId ?? row.talent_id))),
    assessmentAssignments: arr(db.assessmentAssignments).filter((row: any) => ownTalentIds.has(String(row.talentId ?? row.talent_id))),
    documents: arr(db.documents).filter((row: any) => ownTalentIds.has(String(row.talentId))),
    assignments: arr(db.assignments).filter((row: any) => ownContracts.has(String(row.contractId))),
    invoices: arr(db.invoices).filter((row: any) => clientIds.has(String(row.clientId))),
    payments: arr(db.payments).filter((row: any) => invoiceIds.has(String(row.invoiceId))),
    talentPayouts: arr(db.talentPayouts).filter((row: any) => ownTalentIds.has(String(row.talentId))),
    supportTickets: arr(db.supportTickets).filter((row: any) => ticketIds.has(String(row.id))),
    supportMessages: arr(db.supportMessages).filter((row: any) => ticketIds.has(String(row.ticketId))),
    requestActivityLogs: arr(db.requestActivityLogs).filter((row: any) => requestIds.has(String(row.requestId))),
    conversations,
    messages: arr(db.messages).filter((row: any) => conversationIds.has(String(row.conversationId))),
    notifications: arr(db.notifications).filter((row: any) => String(row.userId) === String(actor.userId))
  };
}

export function scopeDbForUser(db: any, actor: RequestActor): any {
  if (!db) return db;
  if (actor.kind === 'admin') {
    const role = normaliseRole(actor.role);
    if (SEES_EVERYTHING.has(role)) return db;
    if (role === 'talent_manager') return scopeForTalentManager(db, actor);
    if (role === 'account_manager') return scopeForAccountManager(db, actor);
    return db;
  }
  if (actor.kind === 'talent') return scopeForTalent(db, actor);
  if (actor.kind === 'client') return scopeForClient(db, actor);
  // Unknown role: nothing.
  return {};
}

// ─── Talent ──────────────────────────────────────────────────────────────────

function scopeForTalent(db: any, actor: RequestActor) {
  const uid = actor.userId;
  const tid = actor.talentProfileId;
  const talentIds = new Set([tid, uid].filter(Boolean).map(String));

  // A talent with no talent_profiles row has nothing to show yet. Return the
  // empty shape rather than null so the dashboard renders its empty states.
  const ownTalents = tid ? arr(db.talents).filter((t: any) => String(t.id) === String(tid)) : EMPTY;

  const ownMatches = tid ? arr(db.matches).filter((m: any) => String(m.talentId) === String(tid)) : EMPTY;
  const ownInterviews = talentIds.size
    ? arr(db.interviews).filter((iv: any) => talentIds.has(String(iv.talentId)))
    : EMPTY;
  const ownContracts = tid ? arr(db.contracts).filter((c: any) => String(c.talentId) === String(tid)) : EMPTY;
  const ownTickets = tid ? arr(db.supportTickets).filter((st: any) => String(st.talentId) === String(tid)) : EMPTY;

  // Requests the talent is actually connected to, via a match, interview or
  // contract. These are their opportunities. Every other client request stays
  // invisible.
  const relatedRequestIds = new Set<string>();
  for (const m of ownMatches) if (m.requestId) relatedRequestIds.add(String(m.requestId));
  for (const iv of ownInterviews) if (iv.requestId) relatedRequestIds.add(String(iv.requestId));
  const relatedRequests = arr(db.clientRequests).filter((r: any) =>
    [r.id, r.rowId, r.payloadId].some((value) => value != null && relatedRequestIds.has(String(value)))
  );

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

  const talentManagerId = ownTalents[0]?.talentManagerId
    ? String(ownTalents[0].talentManagerId)
    : null;
  const assignedManager = talentManagerId
    ? arr(db.users).find((u: any) => String(u.id) === talentManagerId)
    : null;
  const visibleUsers = arr(db.users).filter((u: any) => String(u.id) === String(uid));
  if (assignedManager && String(assignedManager.id) !== String(uid)) {
    // Talent users need the contact details of their assigned manager, but
    // must not receive a directory of Kongila operator accounts.
    visibleUsers.push({
      id: assignedManager.id,
      name: assignedManager.name || '',
      email: assignedManager.email || null,
      role: assignedManager.role || 'talent_manager',
      isKongilaContact: true
    });
  }

  return {
    ...emptyShape(db),

    talents: ownTalents,
    users: visibleUsers,
    // Universal mandatory documents must reach the talent workspace so the
    // talent can review and sign them. Keep personal documents scoped to the
    // signed-in talent; only ownerless compliance templates are shared.
    documents: arr(db.documents).filter((d: any) =>
      String(d.userId) === String(uid)
      || (!d.userId && Boolean(d.isMandatory) && !d.isHidden)
    ),

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
  const ownRequestIds = requestIdentities(ownRequests);

  // The Kongila people assigned to this account: the organisation's account
  // manager, plus anyone assigned to one of its requests. Collected as ids
  // first so the same person assigned to the organisation and to three
  // requests is one entry.
  const ownOrg = orgId ? arr(db.organizations).find((o: any) => String(o.id) === String(orgId)) : null;
  const kongilaContactIds = new Set<string>();
  if (ownOrg?.accountManagerId) kongilaContactIds.add(String(ownOrg.accountManagerId));
  for (const r of ownRequests) {
    if (r.assignedAccountManagerId) kongilaContactIds.add(String(r.assignedAccountManagerId));
    if (r.assignedTalentManagerId) kongilaContactIds.add(String(r.assignedTalentManagerId));
  }
  // A colleague is never also a Kongila contact; the org filter below covers
  // them in full.
  for (const id of orgUserIds) kongilaContactIds.delete(id);

  const kongilaContacts = arr(db.users)
    .filter((u: any) => kongilaContactIds.has(String(u.id)))
    .map(contactCardForClient)
    .filter(Boolean);

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
    // Colleagues in full, plus a contact card for each Kongila person assigned
    // to this account. Without the second part a client cannot be shown who
    // their account manager is, let alone message them.
    users: [
      ...arr(db.users).filter((u: any) => orgUserIds.has(String(u.id))),
      ...kongilaContacts
    ],

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
    ownRequestIds = requestIdentities(
      arr(existing?.clientRequests).filter((r: any) => orgUserIds.has(String(r.clientId)))
    );
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

// ─── Filtering the snapshot by permission ────────────────────────────────────

/**
 * Which permission each collection in the snapshot belongs to.
 *
 * /api/db hands back about forty collections in one response. It checked
 * that the caller was an operator and nothing else, so a Finance operator —
 * who has no candidate screens at all — still received every candidate
 * profile, every vetting score and every interview in the browser. Hiding
 * the tab was the only thing stopping them reading it, and the tab was
 * never what was stopping them.
 *
 * Anything not named here is sent to every operator: the reference data
 * (skills, settings, the tag dictionary) and the things scoped by ownership
 * rather than by permission (notifications, messages, conversations).
 */
const COLLECTION_PERMISSIONS: Record<string, string> = {
  talents: 'view:talent-pipeline',
  talentSkills: 'view:talent-pipeline',
  documents: 'view:talent-pipeline',
  performanceReviews: 'view:talent-pipeline',
  classificationEvents: 'view:talent-pipeline',

  assessments: 'view:assessments',
  assessmentCategories: 'view:assessments',
  assessmentQuestions: 'view:assessments',
  assessmentAssignments: 'view:assessments',
  skillAssessmentResults: 'view:assessments',
  talentSkillAssessments: 'view:assessments',
  workSimulationTasks: 'view:assessments',

  organizations: 'view:client-pipeline',
  clientProfiles: 'view:client-pipeline',

  clientRequests: 'view:hiring-requests',
  requestActivityLogs: 'view:hiring-requests',
  rehireRequests: 'view:hiring-requests',

  matches: 'view:matching',
  interviews: 'view:interviews',

  contracts: 'view:contracts',
  assignments: 'view:contracts',
  projects: 'view:contracts',
  tasks: 'view:contracts',

  invoices: 'view:finance',
  payments: 'view:finance',
  talentPayouts: 'view:finance',

  supportTickets: 'view:support',
  supportMessages: 'view:support',

  auditLogs: 'view:audit',
  agentLogs: 'view:audit',
  workflows: 'view:workflows'
};

/**
 * Empties the collections this operator has no permission to see.
 *
 * Empties rather than deletes: the portals read `db.talents.filter(...)`
 * in several hundred places, and a missing key is a crash where an empty
 * list is simply a screen with nothing on it — which is exactly what
 * somebody without the permission should get.
 */
export function filterDbByPermissions(db: any, permissions: string[] | undefined): any {
  if (!db) return db;
  const held = new Set(Array.isArray(permissions) ? permissions : []);
  const filtered: any = { ...db };

  for (const [collection, permission] of Object.entries(COLLECTION_PERMISSIONS)) {
    if (held.has(permission)) continue;
    if (Array.isArray(filtered[collection])) filtered[collection] = [];
  }

  // The operator list is a special case: every portal uses it to put a name
  // against an id, so it cannot simply be emptied. Only someone who manages
  // users gets the rows themselves.
  if (!held.has('users.manage') && Array.isArray(filtered.users)) {
    filtered.users = filtered.users.map((user: any) => ({
      id: user?.id,
      name: user?.name,
      email: user?.email,
      role: user?.role
    }));
  }

  return filtered;
}
