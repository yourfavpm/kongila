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
