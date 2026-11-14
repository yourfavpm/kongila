export type UserRole = 'talent' | 'client' | 'admin';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  platform_access: ('kongila' | 'remotan' | 'admin')[];
  organizationId?: string;
}

export interface Organization {
  id: string;
  name: string;
  subscription_type: 'Free' | 'Basic' | 'Enterprise';
  accountManagerId?: string;
  accountManagerName?: string;
  status?: 'Active' | 'At Risk' | 'Inactive' | string;
  healthScore?: number;
  internalNotes?: string;
  contactEmail?: string;
  contactPhone?: string;
  monthlyRevenue?: number;
  lastActivityAt?: string;
  createdAt?: string;
  industry?: string;
  company_size?: string;
  country?: string;
  website?: string;
  how_did_you_hear_about_us?: string;
  multi_user_enabled?: boolean;
}

export type VettingStage =
  | 'Application Screening'
  | 'Skill Assessment'
  | 'Behavioural Interview'
  | 'Personality Test'
  | 'Remote Readiness'
  | 'Work Simulation'
  | 'Final Review';

export type VettingStatus = 'Applied' | 'Review' | 'Vetted' | 'Matched' | 'Deployed';

export type CandidateGrade = 'A+' | 'A' | 'B' | 'Reject';

export type VettingStageStatus = 'pending' | 'in_progress' | 'submitted' | 'passed' | 'failed' | 'skipped' | 'rejected' | 'needs_clarification';

export type VettingDecision = 'Proceed' | 'Reject' | 'Needs Clarification' | 'Assign';

export interface VettingStageRecord {
  stageIndex: number;
  stageName: string | VettingStage;
  status: VettingStageStatus;
  score?: number | null;          // 0–100, optional (some stages are pass/fail)
  notes?: string;
  assignee?: string;
  decision?: VettingDecision;
  startedAt?: string | null;
  slaDeadline?: string | null;
  slaBreached?: boolean;
  deadline?: string;       // ISO date string
  completedAt?: string | null;    // ISO date string
  assessmentId?: string;   // Reference to a SkillAssessment or TalentSkillAssessment
  assessmentScore?: number; // Auto-calculated score from submitted assessment
  interviewId?: string;    // Reference to an Interview
  rescheduleRequested?: boolean;
  rescheduleReason?: string;
  interviewDate?: string;  // ISO date for the scheduled interview
  interviewTime?: string;
  /** The instant the interview starts, in UTC. interviewDate/Time are naive wall clock. */
  interviewScheduledTime?: string;
  /** IANA zone interviewDate and interviewTime were entered in. */
  interviewTimezone?: string;  // Time string for the scheduled interview
  meetingLink?: string;    // Video meeting link for the interview
  interviewRubricScores?: {
    communication: number;
    behavioral: number;
    cultural: number;
    technical: number;
  };
  taskId?: string;         // Reference to a WorkSimulationTask
  personalityLink?: string; // Legacy external assessment link; new assignments use the in-portal IPIP-50
  personalityScore?: number; // Legacy provider score; new review rating is stored in score
  /** Descriptive IPIP-50 profile. These trait scores are not a hiring rating. */
  personalityAssessment?: {
    instrument: 'IPIP-50';
    version: number;
    completedAt: string;
    scores: Record<'extraversion' | 'agreeableness' | 'conscientiousness' | 'emotionalSensitivity' | 'openness', { score: number; rawScore: number }>;
  };
  /** Candidate-reported device summary and browser-measured network readiness. */
  remoteReadiness?: {
    provider: 'LibreSpeed' | 'browser-only';
    testedAt: string;
    downloadMbps?: number;
    uploadMbps?: number;
    latencyMs?: number;
    jitterMs?: number;
    browser: string;
    operatingSystem: string;
    deviceType: string;
    viewport: string;
    networkEstimate?: { effectiveType?: string; downlinkMbps?: number; rttMs?: number; saveData?: boolean };
    hasBackupPowerAndSuitableHardware: boolean;
    hasQuietWorkspace: boolean;
  };
  assessorId?: string | null;
  reapplicationDate?: string | null;
  submissionData?: any;
}

export interface TalentScores {
  technical: number;
  behavioral: number;
  personality: number;
  remoteReadiness: number;
  workSimulation: number;

  /**
   * @deprecated Dropped from the vetting model on 2 November 2026.
   *
   * Neither of these was ever measured: no vetting stage produced a score,
   * no admin field set one, nothing wrote them. They are kept optional so
   * profiles saved before the decision still read back, but nothing should
   * write them and they carry no weight in the composite grade.
   *
   * Communication is observed in the behavioural interview rubric, which
   * feeds `behavioral`. Years of experience is screened at Application
   * Screening, which is pass or fail by design.
   */
  communication?: number;
  /** @deprecated See `communication`. */
  experience?: number;
}

export interface TalentProfile {
  id: string;
  name: string;
  email: string;
  avatar: string;
  title: string;
  skills: string[];
  primarySkills?: string[];
  secondarySkills?: string[];
  skillLevels?: Record<string, 'Beginner' | 'Intermediate' | 'Expert'>;
  timezone: string;
  salaryExpectation: number;
  salaryExpectationUsd?: number;
  salaryExpectationMinUsd?: number;
  salaryExpectationMaxUsd?: number;
  salaryExpectationCurrency?: string;
  experienceYears: number;
  availability: number; // 0 - 100
  vettingStage: VettingStage;
  vettingStatus: VettingStatus;
  vettingScores: TalentScores;
  grade: CandidateGrade;
  vettingPipeline?: VettingStageRecord[];
  tags: string[];
  bio: string;
  documents?: any[];
  supportTickets?: any[];
  settings?: TalentSettings;
  createdAt?: string;
  onboardingVideoSeenAt?: string | null;
  onboardingVideoUrl?: string;
  performanceScore?: number;
  previousPerformanceScore?: number;
  profileCompletionPercent?: number;
  requiresReReview?: boolean;
  
  // New fields for KT-SCORES
  personalitySnapshot?: PersonalitySnapshot;
  performanceReviews?: PerformanceReview[];
  classificationHistory?: ClassificationEvent[];

  phone?: string;
  country?: string;
  city?: string;
  dateOfBirth?: string;
  gender?: string;
  nationality?: string;
  seniorityLevel?: string;
  primaryRoleCategory?: string;
  employmentPreference?: string;
  preferredEngagementType?: string;
  preferredWorkHours?: string;
  preferredProjectType?: string;
  noticePeriod?: string;
  availableStartDate?: string;
  currency?: string;
  hourlyMonthly?: string;
  profilePhotoUrl?: string;
  profilePhotoName?: string;
  profilePhotoSize?: number;
  cvUrl?: string;
  cvName?: string;
  cvSize?: number;
  portfolioUrl?: string;
  githubUrl?: string;
  websiteUrl?: string;
  linkedIn?: string;
  linkedinUrl?: string;
  certifications?: string;
  certificationFiles?: any[];
  internetQuality?: string;
  workSetup?: string;
  devices?: string;
  communicationTools?: string;
  maritalStatus?: string;
  nationalId?: string;
  passportNo?: string;
  address?: string;
  workExperience?: any[];
  talentManagerId?: string;
}

// These fields MUST be filled for onboarding to be considered complete.
// Missing any of these blocks the talent from accessing their dashboard.
export const PROFILE_CORE_FIELDS = [
  'name',
  'country',
  'phone',
  'title',
  'primaryRoleCategory',
  'seniorityLevel',
  'experienceYears',
  'primarySkills',
  'timezone',
  'noticePeriod',
  'salaryExpectationUsd',
  'linkedIn',
] as const;

// These are tracked for profile completeness % but do NOT block onboarding completion.
export const PROFILE_REQUIRED_FIELDS = [
  'name',
  'dateOfBirth',
  'gender',
  'nationality',
  'country',
  'city',
  'phone',
  'avatar',
  'title',
  'primaryRoleCategory',
  'seniorityLevel',
  'experienceYears',
  'bio',
  'primarySkills',
  'preferredWorkHours',
  'timezone',
  'noticePeriod',
  'salaryExpectationUsd',
  'cvUrl',
  'linkedIn',
  'profilePhotoUrl'
] as const;

export function calculateTalentProfileCompletion(profile: Partial<TalentProfile> | null | undefined) {
  const total = PROFILE_REQUIRED_FIELDS.length;
  if (!profile) return { percent: 0, completed: [], incomplete: [...PROFILE_REQUIRED_FIELDS], coreComplete: false, coreIncomplete: [...PROFILE_CORE_FIELDS] };

  const primarySkills = Array.isArray(profile.primarySkills) ? profile.primarySkills : (Array.isArray(profile.skills) ? profile.skills : []);
  const salaryUsd = profile.salaryExpectationUsd ?? profile.salaryExpectation ?? 0;
  const hasValue = (value: any) => {
    if (Array.isArray(value)) return value.length > 0;
    if (typeof value === 'number') return !Number.isNaN(value) && value > 0;
    if (typeof value === 'boolean') return value;
    return Boolean(value && String(value).trim());
  };

  const checks: Record<string, boolean> = {
    name: hasValue(profile.name),
    dateOfBirth: hasValue(profile.dateOfBirth),
    gender: hasValue(profile.gender),
    nationality: hasValue(profile.nationality),
    country: hasValue(profile.country),
    city: hasValue(profile.city),
    phone: hasValue(profile.phone),
    avatar: hasValue(profile.profilePhotoUrl || profile.profilePhotoName),
    title: hasValue(profile.title),
    primaryRoleCategory: hasValue(profile.primaryRoleCategory),
    seniorityLevel: hasValue(profile.seniorityLevel),
    experienceYears: hasValue(profile.experienceYears),
    bio: hasValue(profile.bio),
    primarySkills: primarySkills.length > 0,
    preferredWorkHours: hasValue(profile.preferredWorkHours || profile.hourlyMonthly),
    timezone: hasValue(profile.timezone),
    noticePeriod: hasValue(profile.noticePeriod || profile.availableStartDate),
    linkedIn: hasValue((profile as any).linkedIn || (profile as any).linkedinUrl),
    salaryExpectationUsd: hasValue(salaryUsd),
    cvUrl: hasValue(profile.cvUrl || profile.documents?.find((d: any) => String(d?.name || '').toLowerCase().includes('.pdf'))?.fileUrl),
    profilePhotoUrl: hasValue(profile.profilePhotoUrl || profile.profilePhotoName),
  };

  const completed = PROFILE_REQUIRED_FIELDS.filter(field => checks[field]);
  const incomplete = PROFILE_REQUIRED_FIELDS.filter(field => !checks[field]);
  const coreIncomplete = PROFILE_CORE_FIELDS.filter(field => !checks[field as string]);
  return {
    percent: Math.round((completed.length / total) * 100),
    completed,
    incomplete,
    coreComplete: coreIncomplete.length === 0,
    coreIncomplete
  };
}

export function hasCoreTalentProfileChanges(previous: Partial<TalentProfile> | null | undefined, next: Partial<TalentProfile> | null | undefined) {
  if (!previous || !next) return false;
  const normalize = (value: any) => {
    if (Array.isArray(value)) return value.map(v => String(v).trim()).filter(Boolean).sort().join('|');
    if (value == null) return '';
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value).trim();
  };

  const fieldsToWatch: (keyof TalentProfile)[] = [
    'title',
    'seniorityLevel',
    'primaryRoleCategory',
    'skills',
    'primarySkills',
    'secondarySkills',
    'skillLevels',
    'cvUrl',
    'cvName',
    'cvSize'
  ];

  return fieldsToWatch.some(field => normalize(previous[field]) !== normalize(next[field]));
}

export type ServiceType = 'Hire Talent' | 'Outsource Talent' | 'Managed Workforce' | 'Project Execution' | 'placement' | 'outsourcing' | 'managed_workforce' | 'project';

export type UrgencyType = 'asap' | 'within_2_weeks' | 'flexible' | 'no_rush';

/**
 * @deprecated Superseded by RequestRole. Declared but never referenced
 * anywhere in the product; kept only so an old stored payload still types.
 */
export interface RoleCount {
  role: string;
  count: number;
}

/**
 * Where one role of a request has got to.
 *
 * Deliberately shorter than RequestStatus. A request's status is the
 * commercial conversation, which an operator moves; a role's status is where
 * the sourcing for that one role has got to, and several roles on one request
 * move independently — one filled while another is still being sourced.
 */
export type RequestRoleStatus =
  | 'Open'
  | 'Sourcing'
  | 'Candidates Ready'
  | 'Interviewing'
  | 'Filled'
  | 'On Hold'
  | 'Cancelled';

export const REQUEST_ROLE_STATUSES: RequestRoleStatus[] = [
  'Open', 'Sourcing', 'Candidates Ready', 'Interviewing', 'Filled', 'On Hold', 'Cancelled'
];

/**
 * One role within a request.
 *
 * A client hiring a designer, a backend engineer and a QA analyst was filling
 * the six-step wizard three times over, re-entering the same company, budget,
 * timezones and urgency each time, and ending up with three unconnected
 * references that the admin board showed as three unrelated rows.
 *
 * So the request holds the shared context — service type, budget, timezones,
 * urgency, notes — and carries roles. The request is the client's unit: one
 * reference, one account manager, one thread. The role is the unit of sourcing
 * and tracking, which is why it has an id and a status of its own.
 *
 * `count` is how many people of this role, replacing the old top-level
 * numberOfHires for multi-role requests. A single-role request still sets
 * numberOfHires, and `requestRoles` below reconciles the two so no screen has
 * to know which shape it is looking at.
 */
export interface RequestRole {
  /** Stable across edits. Matches and interviews reference it. */
  id: string;
  title: string;
  count: number;
  status: RequestRoleStatus;
  seniorityLevel?: string;
  requiredSkills?: string[];
  description?: string;
  startDate?: string;
  commitmentLevel?: string;
  budgetMinUsd?: number;
  budgetMaxUsd?: number;
  /** How many of `count` are placed. Never inferred — set when a hire is made. */
  filledCount?: number;
}

/**
 * The canonical lifecycle of a client request.
 *
 * These are internal operations stages and the only values ever stored. What
 * a client sees is a shorter journey derived from these: see
 * CLIENT_STATUS_VIEW in @kongila/workflows. Never store a client-facing label.
 *
 * 'Closed' is terminal and reachable from any other state. It backs the
 * Closed/Cancelled tab in the client portal, which previously filtered on
 * statuses that did not exist and so could never populate.
 */
export type RequestStatus =
  | 'New Request'
  | 'Reviewing'
  | 'Sourcing Talent'
  | 'Candidates Ready'
  | 'Client Interview'
  | 'Offer Accepted'
  | 'Onboarding'
  | 'Closed';

export interface ServiceRequest {
  id: string; // request_id UUID
  referenceNumber?: string; // Format KNG-REQ-YYYYMMDD-NNNN
  clientId: string;
  clientName: string;
  serviceType: ServiceType;
  
  // Legacy / Backwards compatibility fields
  roleDescription: string;
  requiredSkills: string[];
  duration: string;
  commitmentLevel: string;
  numberOfHires: number;
  timezone: string;
  startDate: string;
  budget: number;
  priority: 'Low' | 'Medium' | 'High';
  
  // New generalized fields
  title?: string;
  description?: string;
  numOfTalents?: number;
  
  // Step 2A — Hire Talent (Placement)
  roleTitle?: string;
  seniorityLevel?: string;
  keyResponsibilities?: string[];
  /** @deprecated No longer collected. Overlapped requiredSkills and seniorityLevel. */
  mustHaveQualifications?: string;
  
  // Step 2B & 2C — Outsource Talent & Managed Workforce
  teamSize?: number;
  /** @deprecated Never read anywhere. Use `roles`. */
  rolesRequired?: RoleCount[];
  /**
   * @deprecated A request is for one role. Kept so requests stored while it
   * held several still read, and `requestRoles()` still returns them, but
   * nothing writes it: intake now files one request per role.
   */
  roles?: RequestRole[];

  // ── One brief, several roles ───────────────────────────────────────────
  //
  // A client hiring a designer, a backend engineer and a QA analyst answers
  // the shared context once and adds three roles. That used to produce one
  // request carrying three roles, which was wrong: matching, interviews,
  // offers and contracts all happen per role, so a request holding three of
  // them had one status for three different conversations — one role could
  // be at offer while another had not been sourced, and the request could
  // only show one of those.
  //
  // Intake now files three requests and links them with a shared group id.
  // The client still answers once; each role is tracked, progressed, edited
  // and closed on its own.

  /** Shared by every request filed from one intake. Absent on a lone request. */
  requestGroupId?: string;
  /** Which of the group this is, from 1. For display only. */
  groupPosition?: number;
  /** How many requests the group holds, as filed. For display only. */
  groupSize?: number;
  coverageType?: string;
  /** @deprecated No longer collected; its condition never matched, so the field never appeared. */
  customHours?: string;
  teamDescription?: string;
  /** @deprecated Merged into supervisionLevel, which now asks who manages them day to day. */
  reportingStructure?: string;
  supervisionLevel?: string;
  performanceMetrics?: string[];
  serviceDescription?: string;

  // Step 2D — Project Execution
  projectName?: string;
  projectDescription?: string;
  keyDeliverables?: string[];
  /** @deprecated No longer collected. Restated the budget range and deadline, vaguely. */
  estimatedScope?: string;
  projectDeadline?: string;
  referenceFiles?: any[];
  
  // Step 3 — Engagement Details
  /** @deprecated Collected as commitmentLevel now, which is what the product reads. */
  engagementType?: string;
  partTimeHours?: number;
  durationType?: string;
  durationMonths?: number;
  preferredTimezones?: string[];
  
  // Step 4 — Budget
  budgetMinUsd?: number;
  budgetMaxUsd?: number;
  budgetUnknown?: boolean;
  currency?: string;
  
  // Step 5 — Priority & Notes
  urgencyLevel?: UrgencyType;
  /** @deprecated No longer collected. Asked the urgency question a second time. */
  roleCriticality?: string;
  additionalNotes?: string;

  status: RequestStatus;
  createdAt: string;
  urgency?: 'Standard' | 'ASAP';
  assignedTalentManagerId?: string;
  assignedAccountManagerId?: string;
  internalNotes?: string;
}

/**
 * What to call a request on screen.
 *
 * Every view used to show `roleDescription.substring(0, 40)`, which is a
 * paragraph cut off mid-word. Intake collects a real name for the work on each
 * of the four service paths, and they are not the same field: Hire Talent asks
 * for a role title, Outsource and Managed Workforce for a team description,
 * Project Execution for a project name. The stored `title` is written at
 * intake from whichever applies, so that is preferred; the rest of the chain
 * exists for requests filed before the column was read, and for the odd
 * request where the client left the name blank.
 *
 * The description is deliberately last. It is a legitimate fallback — a
 * request has to be called something — but a truncated description is a
 * symptom, not a title, and anything reaching for it means intake let a
 * request through without a name.
 */
export function requestTitle(request: Partial<ServiceRequest> | null | undefined): string {
  if (!request) return 'Untitled request';

  // A request for several roles has no single name, so it is named after the
  // first role and says how many others there are. Without this a three-role
  // request appeared on the board under whichever role happened to be first,
  // with nothing to say the other two existed.
  const roles = Array.isArray(request.roles) ? request.roles.filter(r => r && r.title) : [];
  if (roles.length > 1) {
    const first = String(roles[0].title).trim();
    const name = first.length <= 44 ? first : `${first.slice(0, 41).replace(/\s+\S*$/, '')}…`;
    return `${name} +${roles.length - 1} more role${roles.length - 1 === 1 ? '' : 's'}`;
  }

  const candidates = [
    roles.length === 1 ? roles[0].title : undefined,
    request.title,
    request.roleTitle,
    request.projectName,
    request.teamDescription,
    request.serviceDescription,
    request.roleDescription,
    request.description
  ];

  for (const candidate of candidates) {
    const text = typeof candidate === 'string' ? candidate.trim() : '';
    // A description used as a title is shortened; a real title is not. Cutting
    // at a word boundary keeps it readable where it has to happen at all.
    if (text) return text.length <= 70 ? text : `${text.slice(0, 67).replace(/\s+\S*$/, '')}…`;
  }

  return request.serviceType ? String(request.serviceType) : 'Untitled request';
}

/**
 * The roles on a request, whatever shape it was stored in.
 *
 * Every request that existed before roles did has its one role in the flat
 * fields — roleTitle, seniorityLevel, requiredSkills, numberOfHires — and a
 * client hiring one person still fills those in. Rather than make every screen
 * ask "does this have a roles array?", this returns a role list for all of
 * them: the stored array where there is one, otherwise a single role built
 * from the flat fields.
 *
 * The synthesised role's id is `${request.id}:role-1`, which is stable for a
 * given request, so a match or an interview can reference a role on a request
 * filed before this existed.
 *
 * Nothing is invented. A request with no name for the work gets a role titled
 * from `requestTitle`, which falls back to the service type, and a count of
 * whatever numberOfHires says, defaulting to 1 — not a guess, just the one
 * person a request is for unless it says otherwise.
 */
export function requestRoles(request: Partial<ServiceRequest> | null | undefined): RequestRole[] {
  if (!request) return [];

  const stored = Array.isArray(request.roles) ? request.roles : [];
  const usable = stored.filter(r => r && typeof r === 'object' && String(r.title || '').trim());
  if (usable.length > 0) {
    return usable.map((r, i) => ({
      id: String(r.id || `${request.id || 'request'}:role-${i + 1}`),
      title: String(r.title).trim(),
      count: Number.isFinite(Number(r.count)) && Number(r.count) > 0 ? Math.floor(Number(r.count)) : 1,
      status: (REQUEST_ROLE_STATUSES as string[]).includes(String(r.status))
        ? (r.status as RequestRoleStatus)
        : 'Open',
      seniorityLevel: r.seniorityLevel,
      requiredSkills: Array.isArray(r.requiredSkills) ? r.requiredSkills : [],
      description: r.description,
      startDate: r.startDate,
      commitmentLevel: r.commitmentLevel,
      budgetMinUsd: r.budgetMinUsd,
      budgetMaxUsd: r.budgetMaxUsd,
      filledCount: Number.isFinite(Number(r.filledCount)) ? Number(r.filledCount) : 0
    }));
  }

  const count = Number(request.numberOfHires ?? request.teamSize ?? 1);
  return [{
    id: `${request.id || 'request'}:role-1`,
    title: requestTitle(request),
    count: Number.isFinite(count) && count > 0 ? Math.floor(count) : 1,
    status: 'Open',
    seniorityLevel: request.seniorityLevel,
    requiredSkills: Array.isArray(request.requiredSkills) ? request.requiredSkills : [],
    description: request.roleDescription || request.description,
    startDate: request.startDate,
    commitmentLevel: request.commitmentLevel,
    budgetMinUsd: request.budgetMinUsd,
    budgetMaxUsd: request.budgetMaxUsd,
    filledCount: 0
  }];
}

/** How many people this request is for, across all its roles. */
export function requestHeadcount(request: Partial<ServiceRequest> | null | undefined): number {
  return requestRoles(request).reduce((total, role) => total + role.count, 0);
}

/** True when this request asks for more than one kind of person. */
export function isMultiRoleRequest(request: Partial<ServiceRequest> | null | undefined): boolean {
  return requestRoles(request).length > 1;
}

/** A request cannot carry more roles than an operator could work. */
export const MAX_ROLES_PER_REQUEST = 20;
/** Per role. A client wanting more than this is a conversation, not a form. */
export const MAX_COUNT_PER_ROLE = 100;

/**
 * Is this a roles array the product could have produced?
 *
 * Returns the reason it cannot be stored, or null when it can. `requestRoles`
 * above is forgiving because it reads whatever is already in the database;
 * this is strict, because it guards what goes in. The two are not in tension:
 * read loosely, write carefully.
 *
 * Status is not checked here. A client may not set it at all — the route
 * carries it over from the stored role or sets Open — so a status arriving in
 * a client's payload is ignored rather than refused, and an operator setting
 * one goes through the admin route, which has its own transition rules.
 */
export function validateRequestRoles(roles: unknown): string | null {
  if (!Array.isArray(roles)) return 'Roles must be a list.';
  if (roles.length === 0) return 'A request needs at least one role.';
  if (roles.length > MAX_ROLES_PER_REQUEST) {
    return `A request can carry up to ${MAX_ROLES_PER_REQUEST} roles; this one has ${roles.length}. `
      + 'Split the rest into a second request.';
  }

  const seenTitles = new Set<string>();

  for (let i = 0; i < roles.length; i++) {
    const role = roles[i] as any;
    const position = `Role ${i + 1}`;

    if (!role || typeof role !== 'object' || Array.isArray(role)) return `${position} is not a role.`;

    const title = String(role.title ?? '').trim();
    if (!title) return `${position} needs a title — what is the person you are hiring called?`;
    if (title.length > 120) return `${position}'s title is too long. Put the detail in its description.`;

    // Two roles with the same title cannot be told apart on the board or in a
    // shortlist, and are almost always one role with a higher count.
    const key = title.toLowerCase();
    if (seenTitles.has(key)) {
      return `This request has two roles called "${title}". `
        + 'Use one role and raise how many people you need.';
    }
    seenTitles.add(key);

    if (role.count !== undefined && role.count !== null && role.count !== '') {
      const count = Number(role.count);
      if (!Number.isInteger(count) || count < 1 || count > MAX_COUNT_PER_ROLE) {
        return `${position} asks for ${role.count} people. It must be a whole number between 1 and ${MAX_COUNT_PER_ROLE}.`;
      }
    }

    if (role.requiredSkills !== undefined && role.requiredSkills !== null && !Array.isArray(role.requiredSkills)) {
      return `${position}'s skills must be a list.`;
    }

    for (const field of ['budgetMinUsd', 'budgetMaxUsd'] as const) {
      const value = role[field];
      if (value === undefined || value === null || value === '') continue;
      if (!Number.isFinite(Number(value)) || Number(value) < 0) {
        return `${position}'s budget must be a number that is not negative.`;
      }
    }

    const min = Number(role.budgetMinUsd);
    const max = Number(role.budgetMaxUsd);
    if (Number.isFinite(min) && Number.isFinite(max) && max > 0 && min > max) {
      return `${position}'s budget starts higher than it ends.`;
    }
  }

  return null;
}

export interface MatchBreakdown {
  skillFit: number;
  behaviourFit: number;
  personalityFit: number;
  availability: number;
  pastPerformance: number;
}

export interface RequestActivityLog {
  id: string;
  requestId: string;
  actorId: string | null;
  actionType: string;
  fieldChanges?: Record<string, { old: any; new: any }>;
  createdAt: string;
}

export interface Match {
  id: string;
  requestId: string;
  talentId: string;
  score: number; // 0 - 100
  breakdown: MatchBreakdown;
  status: 'Proposed' | 'Applied' | 'Shortlisted' | 'Interview Requested' | 'Interview Scheduled' | 'Interviewed' | 'Offer Extended' | 'Offer Accepted' | 'Declined' | 'submitted_to_client' | 'rejected_by_client' | 'accepted';
  clientRejectionReason?: string;
  requestedDate?: string;
  requestedTime?: string;
  requestedDuration?: string;
  requestedNotes?: string;
  overrideReason?: string;
  submissionJustification?: string;
}

export type TaskStatus = 'Not Started' | 'In Progress' | 'Blocked' | 'Under Review' | 'Completed';

export interface Task {
  id: string;
  projectId: string;
  projectName: string;
  title: string;
  description: string;
  assigneeId: string;
  assigneeName: string;
  status: TaskStatus;
  priority: 'Low' | 'Medium' | 'High';
  dueDate: string;
  blockerDescription?: string;
  createdAt: string;
}

export interface ContractTemplate {
  id: string;
  type: string;
  name: string;
  body: string;
  version: number;
  status: 'draft' | 'published' | 'archived';
  createdAt: string;
  updatedAt: string;
  lastUpdatedBy?: string;
}

export interface Contract {
  id: string;
  reference_number?: string;
  matchId: string;
  clientId: string;
  clientName: string;
  talentId: string;
  talentName: string;
  role: string;
  service_type?: string;
  role_title?: string;
  salary: number;
  monthly_rate_usd?: number;
  startDate: string;
  start_date?: string;
  end_date?: string;
  engagement_type?: string;
  status: 'draft' | 'pending_signatures' | 'client_signed' | 'talent_signed' | 'active' | 'completed' | 'terminated' | 'Pending' | 'Signed' | 'Expired' | 'Voided';
  performance_score?: number;
  clientMonthlyFeeUsd?: number;
  performanceScore?: number;
  rating?: number;
  rateAmount?: number;
  endDate?: string;
  requestId?: string;
  terminationReason?: string;
  talent_signed_at?: string;
  talent_sign_ip?: string;
  document_hash?: string;
  talent_typed_signature?: string;
  signedAt?: string;
  templateId?: string;
  templateVersion?: number;
  voidReason?: string;
  reminderCount?: number;
  lastReminderSentAt?: string;
  manualSignReason?: string;
  createdAt?: string;
}

export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
  category?: 'Requests' | 'Matches' | 'Interviews' | 'Contracts' | 'Billing' | 'Messages' | 'Marketing' | 'System';
  sourceRecordId?: string;
}

export interface PaymentMethod {
  id: string;
  type: 'card' | 'bank_transfer';
  last4: string;
  brand?: string;
  expiryMonth?: string;
  expiryYear?: string;
  isDefault: boolean;
  addedAt: string;
}

export interface TalentSettings {
  notifications: {
    email: {
      VettingUpdates: boolean;
      InterviewAlerts: boolean;
      PaymentAlerts: boolean;
      Messages: boolean;
      Marketing: boolean;
    };
    whatsapp: {
      VettingUpdates: boolean;
      InterviewAlerts: boolean;
      PaymentAlerts: boolean;
      Messages: boolean;
      Marketing: boolean;
    };
  };
}

export interface ClientSettings {
  notifications: {
    email: {
      Requests: boolean;
      Matches: boolean;
      Interviews: boolean;
      Contracts: boolean;
      Billing: boolean;
      Messages: boolean;
      Marketing: boolean;
    };
    whatsapp: {
      Requests: boolean;
      Matches: boolean;
      Interviews: boolean;
      Contracts: boolean;
      Billing: boolean;
      Messages: boolean;
      Marketing: boolean;
    };
  };
  paymentMethods: PaymentMethod[];
}

export interface AuditLog {
  id: string;
  actor: string;
  action: string;
  details: string;
  timestamp: string;
}

export interface AgentLog {
  id: string;
  agentName: 'Context Agent' | 'Workflow Agent' | 'Matching Agent' | 'Performance Agent' | 'Execution Agent' | 'Finance Agent' | 'Compliance Agent' | 'Insight Agent';
  message: string;
  timestamp: string;
  type: 'info' | 'success' | 'warning' | 'error';
}

export interface ClientProfile {
  id: string;
  userId: string;
  organizationId: string;
  position: string;
  phone: string;
  permissionLevel?: 'Full Access' | 'Billing Only' | 'View Only' | string;
}

export interface Skill {
  id: string;
  name: string;
}

export interface TalentSkill {
  id: string;
  talentId: string;
  skillId: string;
  level: 'beginner' | 'intermediate' | 'expert';
}

export type DocumentType =
  | 'cv'
  | 'portfolio'
  | 'certification'
  | 'nda'
  | 'contractor_agreement'
  | 'it_policy'
  | 'data_protection_agreement'
  | 'other';

export type DocumentStatus =
  | 'uploaded'
  | 'superseded'
  | 'sent_for_signature'
  | 'partially_signed'
  | 'signed'
  | 'expired'
  | 'rejected'
  | 'deleted'
  | 'pending'
  | 'pending_signature';

/** Types that are compliance-only — no manual upload path, read-only in Documents module */
export const COMPLIANCE_DOC_TYPES: DocumentType[] = [
  'nda', 'contractor_agreement', 'it_policy', 'data_protection_agreement'
];

export interface Document {
  id: string;
  userId: string;
  name: string;
  type: DocumentType | string;
  fileUrl?: string;
  fileName?: string;
  fileSizeBytes?: number;
  /** Legacy field — kept for backward compat */
  fileSize?: string;
  status: DocumentStatus | string;
  /** Incremented on every re-upload of same type+name; previous versions kept with status='superseded' */
  versionNumber?: number;
  // Certification-specific fields (required when type === 'certification')
  certificationName?: string;
  issuingBody?: string;
  issueDate?: string;
  expiryDate?: string;
  // Audit
  uploadedAt: string;
  updatedAt?: string;
  // Compliance / template linking
  isMandatory?: boolean;
  isHidden?: boolean;
  templateId?: string;
  signatureData?: string;
  signedAt?: string;
  requiresReReview?: boolean;
  expirationDate?: string; // added for Expiry Monitor
  // Compliance tracking for universal documents
  signedByTalentIds?: string[];
  /** A universal template every candidate signs, rather than one person's file. */
  isTemplate?: boolean;
  lastUpdatedBy?: string;
  lastUpdatedAt?: string;
  // Legacy fields used by existing compliance flow
  certificateImage?: string;
  description?: string;
  dueDate?: string;
  needsSignature?: boolean;
}


export interface Project {
  id: string;
  clientId: string;
  name: string;
  description: string;
  startDate: string;
  endDate: string;
}

export interface AssessmentCategoryOverride {
  categoryId: string;
  timeLimitMinutes?: number;
}

export interface Assessment {
  id: string;
  title: string;
  role_targeted: string;
  description: string;
  total_time_limit_minutes: number;
  passing_score: number;
  categories: string[]; // category IDs
  category_overrides?: AssessmentCategoryOverride[]; // For linked categories
  status: 'draft' | 'published' | 'archived';
  created_by: string;
  created_at: string;
}

export interface AssessmentCategory {
  id: string;
  name: string;
  description: string;
  time_limit_minutes: number;
  is_reusable: boolean;
  tags: string[];
  questions: string[]; // question IDs
  created_at: string;
  created_by: string;
  is_linked?: boolean; // Front-end helper flag
}

export type QuestionType = 'multiple_choice' | 'short_answer' | 'essay' | 'scenario' | 'file_upload';

export interface AssessmentQuestion {
  id: string;
  category_id: string;
  type: QuestionType;
  question_text: string;
  options?: string[]; // for MCQ
  correct_answer?: string | string[]; // for MCQ
  correct_options?: string | string[]; // legacy MCQ answer key
  expected_answer?: string; // for subjective
  scoring_weight: number;
  max_score: number;
}

export interface CategoryScore {
  category_id: string;
  score: number;
}

export interface AssessmentAssignment {
  id: string;
  assessment_id: string;
  talent_id: string;
  status: 'not_started' | 'in_progress' | 'completed' | 'expired';
  start_time?: string;
  end_time?: string;
  score?: number;
  category_scores?: CategoryScore[];
  answers?: Record<string, string | string[]>; // question_id -> answer
}

export interface TalentSkillAssessment {
  id: string;
  talentId: string;
  assessmentId: string;
  assignedAt: string;
  status: 'assigned' | 'in_progress' | 'submitted' | 'graded';
  score?: number;
  submittedAt?: string;
}

export interface WorkSimulationTask {
  id: string;
  talentId: string;
  title: string;
  description: string;
  assignedAt: string;
  deadline: string;
  status: 'assigned' | 'submitted' | 'graded' | 'closed';
  /** The server's vocabulary. 'essay' appears on rows written before 2026-11-10. */
  submissionType?: 'file' | 'text' | 'link' | 'essay';
  submissionLink?: string;
  submissionFileUrl?: string;
  submissionText?: string;
  submittedAt?: string;
  score?: number;
}

export interface Assignment {
  id: string;
  talentId: string;
  projectId?: string;
  contractId: string;
  role: string;
  startDate: string;
  endDate: string;
  status: 'active' | 'completed' | 'paused';
}

export interface Invoice {
  id: string;
  clientId: string;
  invoiceNumber?: string;
  amount: number;
  subtotalUsd?: number;
  taxAmountUsd?: number;
  totalUsd?: number;
  status: 'draft' | 'sent' | 'paid' | 'overdue' | 'void';
  dueDate: string;
  isDisputed?: boolean;
  disputeReason?: string;
  createdAt?: string;
}

export interface Payment {
  id: string;
  invoiceId: string;
  amount: number;
  paymentMethod: string;
  status: 'pending' | 'paid' | 'failed';
  paidAt?: string;
}

export interface TalentPayout {
  id: string;
  talentId: string;
  contractId: string;
  invoiceId?: string;
  amount: number;
  grossAmount?: number;
  commissionPct?: number;
  netAmount?: number;
  status: 'pending' | 'approved' | 'processing' | 'paid' | 'failed';
  paymentMethod?: string;
  failureReason?: string;
  paidAt?: string;
  createdAt?: string;
}

export interface FeeConfig {
  id: string;
  contractType: string;
  clientFeePct: number;
  talentCommissionPct: number;
  updatedBy?: string;
  updatedAt?: string;
}

export interface FeeAuditLog {
  id: string;
  configId: string;
  changedBy?: string;
  previousClientFeePct?: number;
  newClientFeePct: number;
  previousTalentCommissionPct?: number;
  newTalentCommissionPct: number;
  changedAt: string;
}

export interface Conversation {
  id: string;
  type: 'talent_admin' | 'client_admin';
  participantIds: string[];
  contextType?: 'vetting' | 'request' | 'contract';
  contextId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  attachmentUrl?: string;
  attachmentName?: string;
  timestamp: string;
  isRead: boolean;
  readAt?: string;
}

export interface SupportTicket {
  id: string;
  talentId?: string;
  clientId?: string;
  linkedContractId?: string;
  assignedTo?: string; // e.g. Account Manager UUID or name
  subject: string;
  category: 'Payment Issues' | 'Technical Support' | 'Verification' | 'Guidance' | 'Billing Issue' | 'Talent Performance Concern' | 'Contract Question' | 'Technical Bug' | 'Other' | 'Payment Issue' | 'Account Access' | 'Vetting Question';
  status: 'Open' | 'In Progress' | 'Resolved' | 'open' | 'in_progress' | 'awaiting_client_response' | 'resolved' | 'closed';
  priority: 'Low' | 'Medium' | 'High' | 'Urgent';
  createdAt: string;
  lastActivity: string;
}

export interface SupportMessage {
  id: string;
  ticketId: string;
  senderName: string;
  senderRole: string;
  isSupport: boolean;
  avatarUrl?: string;
  text: string;
  timestamp: string;
  createdAt: string;
}

export interface Interview {
  id: string;
  requestId?: string;
  matchId?: string;
  talentId: string;
  talentName: string;
  talentAvatar?: string;
  clientName: string;
  title: string;
  date: string;
  time: string;
  scheduledTime?: string;
  scheduledTimezone?: string;
  talentTimezone?: string;
  rescheduledFrom?: string;
  /**
   * The five original values did not include the states the product can
   * actually reach. 'Reschedule Requested' is what the reader returns when
   * the reschedule_requested flag is set, and the two talent_ values are the
   * candidate's answer, which until now nothing could record.
   */
  status:
    | 'Proposed'
    | 'Scheduled'
    | 'Rescheduled'
    | 'Completed'
    | 'Cancelled'
    | 'Reschedule Requested'
    | 'talent_accepted'
    | 'talent_declined';
  meetingLink?: string;
  notes?: string;
  talentNotes?: string;
  clientRating?: number;
  clientFeedback?: string;
  outcome?: 'Proceed to Hire' | 'No Fit' | 'Hold' | 'Pending Decision' | 'Proceeded' | 'Not Selected';
  googleCalendarEventId?: string;
  googleCalendarLink?: string;
  rescheduleRequested?: boolean;
  rescheduleReason?: string;
  proposedNewDate?: string;
  proposedNewTime?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface RehireRequest {
  id: string;
  clientId: string;
  clientName: string;
  talentId: string;
  talentName: string;
  role: string;
  proposedRate: number;
  proposedStartDate: string;
  commitmentLevel: 'Full-Time' | 'Part-Time';
  notes?: string;
  status: 'Pending' | 'Approved' | 'Rejected';
  createdAt: string;
}

export interface Stage5ReadinessForm {
  internetSpeedMbps?: number;
  internetScreenshotUrl?: string;
  hasBackupPower?: boolean;
  hasQuietWorkspace?: boolean;
  toolFamiliarity?: string[];
  workspaceVideoUrl?: string;
  submittedAt?: string;
}

// KT-SCORES Models
export interface PlatformSettings {
  id: string;
  globalScoreVisibility: 'full' | 'grade-only' | 'hidden';
  interviewOutcomeVisibility: boolean;
  updatedAt: string;
}

export interface TalentTagDefinition {
  id: string;
  tag: string;
  description: string;
  category?: string;
}

export interface PerformanceReview {
  id: string;
  talentId: string;
  cycleName: string; // e.g., 'Q3 2026', 'Month 3'
  score: number;
  date: string;
  reviewerId?: string;
  feedback?: string;
}

export interface ClassificationEvent {
  id: string;
  talentId: string;
  date: string;
  previousGrade?: CandidateGrade | '—';
  newGrade: CandidateGrade;
  reason?: string;
}

export interface PersonalitySnapshot {
  workStyle: string;
  communicationPreference: string;
  topStrengths: string[];
}

// ─── REMOTAN PLATFORM TYPES ──────────────────────────────────────────────────

export type WorkspaceOrigin = 'kongila_contract' | 'external_subscription';
export type SubscriptionTier = 'starter' | 'growth' | 'scale' | 'enterprise';
export type SubscriptionStatus = 'trial' | 'active' | 'past_due' | 'cancelled' | 'archived';
export type WorkspaceMemberRole = 'workspace_admin' | 'project_manager' | 'team_member' | 'supervisor' | 'finance';
export type WorkspaceMemberStatus = 'active' | 'pending' | 'offboarded' | 'suspended';
export type RemotanProjectStatus = 'planning' | 'active' | 'on_hold' | 'completed' | 'cancelled';
export type RemotanTaskStatus = string; // Made dynamic instead of union

export interface RemotanBoardColumn {
  id: string;
  workspace_id: string;
  project_id?: string;
  name: string; // The display name, e.g., 'In Progress'
  status_key: string; // The internal key, e.g., 'in_progress'
  color: string;
  order_index: number;
}
export type TimeLogStatus = 'active' | 'stopped' | 'approved' | 'disputed';
export type GdprConsentStatus = 'pending' | 'granted' | 'denied' | 'revoked';
export type CalendarEventType = 'meeting' | 'deadline' | 'milestone' | 'review' | 'other';
export type PayrollEntryStatus = 'draft' | 'approved' | 'processing' | 'paid' | 'failed';
export type ComplianceRecordType = 'gdpr_consent' | 'data_retention' | 'access_log' | 'offboarding';
export type AcademyResourceType = 'video' | 'article' | 'quiz' | 'course';
export type AcademyResourceStatus = 'draft' | 'published' | 'archived';
export type ReviewCycleFrequency = 'weekly' | 'monthly' | 'quarterly';

export interface RemotanWorkspace {
  id: string;
  organization_id?: string; // FK to Kongila organizations, null for external
  workspace_origin: WorkspaceOrigin;
  kongila_managed: boolean;
  name: string;
  logo_url?: string;
  default_timezone: string;
  working_hours_start?: string; // e.g. '09:00'
  working_hours_end?: string;   // e.g. '18:00'
  working_days?: string[];      // e.g. ['Mon','Tue','Wed','Thu','Fri']
  date_format?: string;         // e.g. 'DD/MM/YYYY'
  subscription_tier: SubscriptionTier;
  subscription_status: SubscriptionStatus;
  max_seats: number;
  current_seats: number;
  trial_end_date?: string;
  payment_method_on_file: boolean;
  kongila_supervisor_id?: string;
  gdpr_mode_enabled: boolean;
  last_activity_at?: string;
  provisioned_by: 'system_auto' | 'admin_manual';
  setup_wizard_completed: boolean;
  created_at: string;
  remotan_enabled?: boolean;
  website?: string;
}

export interface WorkspaceMember {
  id: string;
  workspace_id: string;
  talent_id?: string;       // Link to Kongila TalentProfile if kongila_managed
  user_id?: string;
  name: string;
  email: string;
  avatar?: string;
  role: WorkspaceMemberRole;
  department?: string;
  job_title?: string;
  status: WorkspaceMemberStatus;
  gdpr_consent_status: GdprConsentStatus;
  gdpr_consent_date?: string;
  last_active_at?: string;
  joined_at: string;
  offboarded_at?: string;
}

export interface WorkspaceInvitation {
  id: string;
  workspace_id: string;
  email: string;
  role: WorkspaceMemberRole;
  department?: string;
  job_title?: string;
  token: string;
  expires_at: string;
  accepted_at?: string;
  status: 'pending' | 'accepted' | 'expired' | 'revoked';
  sent_by: string;
  created_at: string;
}

export interface RemotanProject {
  id: string;
  workspace_id: string;
  name: string;
  description?: string;
  status: RemotanProjectStatus;
  start_date?: string;
  end_date?: string;
  member_ids: string[];
  manager_id?: string;
  color?: string; // hex color for visual distinction
  created_by: string;
  created_at: string;
}

export interface RemotanProjectMilestone {
  id: string;
  project_id: string;
  title: string;
  due_date?: string;
  owner_id?: string;
  weight: number; // 0-100
  status: 'not_started' | 'in_progress' | 'completed' | 'overdue';
}

export interface RemotanTaskDependency {
  task_id: string;
  depends_on_task_id: string;
}

export interface RemotanTaskComment {
  id: string;
  task_id: string;
  author_id: string;
  content: string;
  is_internal_note: boolean;
  created_at: string;
  edited_at?: string;
}

export interface RemotanTaskActivityLog {
  id: string;
  task_id: string;
  actor_id: string;
  action_type: string;
  old_value?: string;
  new_value?: string;
  created_at: string;
}

export interface RemotanTask {
  id: string;
  workspace_id: string;
  project_id: string;
  project_name: string;
  parent_task_id?: string;
  milestone_id?: string;
  title: string;
  description: string;
  assignee_id: string;
  assignee_name: string;
  assignee_avatar?: string;
  reviewer_id?: string;
  status: RemotanTaskStatus;
  priority: 'low' | 'medium' | 'high' | 'critical';
  tags?: string[];
  due_date?: string;
  blocker_category?: 'Waiting on Client' | 'Tech Issue' | 'Access Required' | 'Dependency' | 'Other';
  blocker_description?: string;
  blocker_reported_at?: string;
  blocker_escalated?: boolean;
  estimated_hours?: number;
  actual_hours?: number; // computed
  time_logged_minutes?: number;
  submission_link?: string;
  review_notes?: string;
  unassigned_flag?: boolean; // set when talent offboarded
  created_at: string;
  updated_at?: string;
  completed_at?: string;
}

export interface RemotanTimeLog {
  id: string;
  workspace_id: string;
  member_id: string;
  member_name: string;
  task_id: string;
  log_date: string; // YYYY-MM-DD
  hours_logged: number;
  notes?: string;
  log_type: 'manual' | 'timer';
  is_approved: boolean;
  approved_by?: string;
  approved_at?: string;
  feeds_payroll: boolean; // computed
  created_at: string;
}

export interface RemotanActivityLog {
  id: string;
  workspace_id: string;
  member_id: string;
  time_log_id?: string;
  activity_score?: number; // 0-100
  screenshots?: { timestamp: string; app_name: string; score: number }[];
  recorded_at: string;
}

export interface GdprConsentRecord {
  id: string;
  workspace_id: string;
  member_id: string;
  member_name: string;
  feature: 'activity_monitoring' | 'screenshot_capture' | 'keystroke_logging';
  status: GdprConsentStatus;
  requested_at: string;
  responded_at?: string;
  ip_address?: string;
  notes?: string;
}

export interface PerformanceReviewCycle {
  id: string;
  workspace_id: string;
  name: string;  // e.g. 'Q3 2026 Review', 'Week 12'
  frequency: ReviewCycleFrequency;
  start_date: string;
  end_date: string;
  member_ids: string[];
  reviewer_ids: string[];
  status: 'upcoming' | 'active' | 'completed';
  created_at: string;
}

export interface RemotanPerformanceReview {
  id: string;
  workspace_id: string;
  cycle_id: string;
  member_id: string;
  reviewer_id: string;
  task_efficiency: number;    // 0-100
  work_quality: number;       // 0-100
  reliability: number;        // 0-100
  communication: number;      // 0-100
  collaboration: number;      // 0-100
  overall_score: number;      // calculated avg
  feedback: string;
  strengths?: string[];
  improvement_areas?: string[];
  pip_triggered: boolean;
  pip_notes?: string;
  submitted_at: string;
}

export interface CalendarEvent {
  id: string;
  workspace_id: string;
  title: string;
  description?: string;
  type: CalendarEventType;
  start_datetime: string;
  end_datetime?: string;
  all_day?: boolean;
  attendee_ids?: string[];
  project_id?: string;
  task_id?: string;
  meeting_link?: string;
  location?: string;
  created_by: string;
  created_at: string;
}

export interface WorkspaceMessage {
  id: string;
  workspace_id: string;
  channel: 'announcements' | 'general' | string; // channel name or DM id
  sender_id: string;
  sender_name: string;
  sender_avatar?: string;
  content: string;
  attachment_url?: string;
  attachment_name?: string;
  is_announcement?: boolean;
  is_pinned?: boolean;
  read_by_ids?: string[];
  timestamp: string;
}

export interface PayrollEntry {
  id: string;
  workspace_id: string;
  member_id: string;
  member_name: string;
  period_start: string;
  period_end: string;
  gross_amount: number;
  currency: string;
  deductions?: { label: string; amount: number }[];
  net_amount: number;
  status: PayrollEntryStatus;
  payment_method?: string;
  payment_reference?: string;
  notes?: string;
  approved_by?: string;
  paid_at?: string;
  created_at: string;
}

export interface ComplianceRecord {
  id: string;
  workspace_id: string;
  type: ComplianceRecordType;
  title: string;
  description: string;
  status: 'active' | 'resolved' | 'flagged';
  created_at: string;
  resolved_at?: string;
}

export interface AcademyResource {
  id: string;
  title: string;
  description: string;
  type: AcademyResourceType;
  category: string;   // e.g. 'Technical Skills', 'Communication', 'Remote Work'
  skill_tags: string[];
  url?: string;       // external link or video embed
  content?: string;   // markdown content for articles
  duration_minutes?: number;
  thumbnail_url?: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  min_grade_required?: 'A+' | 'A' | 'B' | 'B-'; // grade gate
  status: AcademyResourceStatus;
  created_at: string;
  published_at?: string;
  enrolled_count?: number;
  completion_count?: number;
}

export interface AcademyEnrollment {
  id: string;
  resource_id: string;
  talent_id: string;
  enrolled_at: string;
  progress_percent: number;
  completed_at?: string;
  quiz_score?: number;
}

export interface RemotanAgentLog {
  id: string;
  workspace_id: string;
  agent: 'Workspace Agent' | 'Workflow Agent' | 'Performance Agent' | 'Compliance Agent' | 'Payroll Agent' | 'Analytics Agent' | 'Academy Agent';
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  timestamp: string;
}

export type WorkflowType = 'talent_onboarding' | 'performance_review_cycle' | 'contract_renewal_alert' | 'invoice_generation' | 'talent_replacement' | 'workspace_offboarding' | 'trial_expiry' | 'payroll_generation';

export type WorkflowState = 'pending' | 'in_progress' | 'failed' | 'completed' | 'cancelled';

export interface WorkflowInstance {
  workflow_instance_id: string;
  workflow_type: WorkflowType;
  state: WorkflowState;
  trigger_event: string;
  trigger_entity_id: string;
  last_step_completed: number;
  failed_at_step?: number;
  failure_reason?: string;
  created_at: string;
  updated_at: string;
}
