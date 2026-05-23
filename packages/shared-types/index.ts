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
  timezone: string;
  salaryExpectation: number;
  experienceYears: number;
  availability: number; // 0 - 100
  vettingStage: VettingStage;
  vettingStatus: VettingStatus;
  vettingScores: TalentScores;
  grade: CandidateGrade;
  tags: string[];
  bio: string;
  documents?: any[];
  supportTickets?: any[];
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
  status: 'Applied' | 'Shortlisted' | 'Interview Scheduled' | 'Interviewed' | 'Offer Extended' | 'Offer Accepted' | 'Declined';
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

export interface Contract {
  id: string;
  matchId: string;
  clientId: string;
  clientName: string;
  talentId: string;
  talentName: string;
  role: string;
  salary: number;
  startDate: string;
  status: 'Pending' | 'Signed' | 'Expired';
  signedAt?: string;
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

export interface Document {
  id: string;
  userId: string;
  name: string;
  type: string;
  fileUrl?: string;
  fileSize?: string;
  status: string;
  certificateImage?: string;
  uploadedAt: string;
  description?: string;
  signedAt?: string;
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
  status: 'active' | 'completed' | 'paused';
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

