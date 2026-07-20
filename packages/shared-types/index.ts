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

export type VettingStageStatus = 'pending' | 'in_progress' | 'passed' | 'failed' | 'skipped' | 'rejected' | 'needs_clarification';

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
  interviewTime?: string;  // Time string for the scheduled interview
  meetingLink?: string;    // Video meeting link for the interview
  taskId?: string;         // Reference to a WorkSimulationTask
  personalityLink?: string; // Link to the external personality test
  personalityScore?: number; // Score received from personality test provider
  assessorId?: string | null;
  reapplicationDate?: string | null;
}

export interface TalentScores {
  technical: number;
  behavioral: number;
  personality: number;
  remoteReadiness: number;
  workSimulation: number;
  communication: number;
  experience: number;
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
  'preferredEngagementType',
  'timezone',
  'noticePeriod',
  'salaryExpectationUsd',
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
  'preferredEngagementType',
  'preferredWorkHours',
  'timezone',
  'preferredProjectType',
  'noticePeriod',
  'salaryExpectationUsd',
  'cvUrl',
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
    preferredEngagementType: hasValue(profile.preferredEngagementType || profile.employmentPreference),
    preferredWorkHours: hasValue(profile.preferredWorkHours || profile.hourlyMonthly),
    timezone: hasValue(profile.timezone),
    preferredProjectType: hasValue(profile.preferredProjectType),
    noticePeriod: hasValue(profile.noticePeriod || profile.availableStartDate),
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

export interface RoleCount {
  role: string;
  count: number;
}

export type RequestStatus =
  | 'New Request'
  | 'Reviewing'
  | 'Sourcing Talent'
  | 'Candidates Ready'
  | 'Client Interview'
  | 'Offer Accepted'
  | 'Onboarding';

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
  mustHaveQualifications?: string;
  
  // Step 2B & 2C — Outsource Talent & Managed Workforce
  teamSize?: number;
  rolesRequired?: RoleCount[];
  coverageType?: string;
  customHours?: string;
  teamDescription?: string;
  reportingStructure?: string;
  supervisionLevel?: string;
  performanceMetrics?: string[];
  serviceDescription?: string;

  // Step 2D — Project Execution
  projectName?: string;
  projectDescription?: string;
  keyDeliverables?: string[];
  estimatedScope?: string;
  projectDeadline?: string;
  referenceFiles?: any[];
  
  // Step 3 — Engagement Details
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
  roleCriticality?: string;
  additionalNotes?: string;

  status: RequestStatus;
  createdAt: string;
  urgency?: 'Standard' | 'ASAP';
  assignedTalentManagerId?: string;
  assignedAccountManagerId?: string;
  internalNotes?: string;
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
  submissionLink?: string;
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
  requestId: string;
  matchId: string;
  talentId: string;
  talentName: string;
  talentAvatar?: string;
  clientName: string;
  title: string;
  date: string;
  time: string;
  status: 'Proposed' | 'Scheduled' | 'Rescheduled' | 'Completed' | 'Cancelled';
  meetingLink?: string;
  notes?: string;
  talentNotes?: string;
  clientRating?: number;
  clientFeedback?: string;
  outcome?: 'Proceed to Hire' | 'No Fit' | 'Hold' | 'Pending Decision' | 'Proceeded' | 'Not Selected';
  googleCalendarEventId?: string;
  googleCalendarLink?: string;
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
