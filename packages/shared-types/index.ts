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
  status?: 'Active' | 'At Risk' | 'Inactive';
  healthScore?: number;
  internalNotes?: string;
  contactEmail?: string;
  contactPhone?: string;
  monthlyRevenue?: number;
  lastActivityAt?: string;
  createdAt?: string;
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
  if (!profile) return { percent: 0, completed: [], incomplete: [...PROFILE_REQUIRED_FIELDS] };

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
  return {
    percent: Math.round((completed.length / total) * 100),
    completed,
    incomplete
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

export type ServiceType = 'Hire Talent' | 'Outsource Talent' | 'Managed Workforce' | 'Project Execution';

export type RequestStatus =
  | 'New Request'
  | 'Reviewing'
  | 'Sourcing Talent'
  | 'Candidates Ready'
  | 'Client Interview'
  | 'Offer Accepted'
  | 'Onboarding';

export interface ServiceRequest {
  id: string;
  clientId: string;
  clientName: string;
  serviceType: ServiceType;
  roleDescription: string;
  requiredSkills: string[];
  duration: string;
  commitmentLevel: string;
  numberOfHires: number;
  timezone: string;
  startDate: string;
  budget: number;
  priority: 'Low' | 'Medium' | 'High';
  status: RequestStatus;
  createdAt: string;
  urgency?: 'Standard' | 'ASAP';
  assignedTalentManagerId?: string;
  assignedAccountManagerId?: string;
  internalNotes?: string;
}

export interface MatchBreakdown {
  skillFit: number;
  behaviorFit: number;
  personalityFit: number;
  availability: number;
  pastPerformance: number;
}

export interface Match {
  id: string;
  requestId: string;
  talentId: string;
  score: number; // 0 - 100
  breakdown: MatchBreakdown;
  status: 'Applied' | 'Shortlisted' | 'Interview Requested' | 'Interview Scheduled' | 'Interviewed' | 'Offer Extended' | 'Offer Accepted' | 'Declined';
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
  amount: number;
  status: 'draft' | 'sent' | 'paid' | 'overdue';
  dueDate: string;
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
  amount: number;
  status: 'pending' | 'paid';
  paidAt?: string;
}

export interface Message {
  id: string;
  senderId: string;
  receiverId: string;
  content: string;
  timestamp: string;
  readStatus: boolean;
}

export interface SupportTicket {
  id: string;
  talentId: string;
  subject: string;
  category: 'Payment Issues' | 'Technical Support' | 'Verification' | 'Guidance';
  status: 'Open' | 'In Progress' | 'Resolved';
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
  outcome?: 'Proceeded' | 'Not Selected' | 'Pending Decision';
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

