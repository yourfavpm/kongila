import { 
  TalentProfile, ServiceRequest, Match, MatchBreakdown, Task, Contract, Notification, AuditLog, AgentLog,
  User, Organization, ClientProfile, Skill, TalentSkill, Document, Project, Assignment,
  Invoice, Payment, TalentPayout, Message, Conversation, SupportTicket, SupportMessage, Interview, RehireRequest, RequestActivityLog
} from '@kongila/shared-types';
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
const defaultSupabaseUrl = 'https://bsmwuofugczuhdbintgs.supabase.co';
const defaultSupabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJzbXd1b2Z1Z2N6dWhkYmludGdzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkxMDAzMTQsImV4cCI6MjA5NDY3NjMxNH0.yhVLhHb0BRfZZjGagF_PwQbYzKVhIOFgAhzoTURvpJc';

export function getSupabaseClient() {
  if (!supabaseClient) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || defaultSupabaseUrl;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || defaultSupabaseAnonKey;
    supabaseClient = createClient(supabaseUrl, supabaseAnonKey);
  }
  return supabaseClient;
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
export function updateMatchStatus(_matchId: string, _status: Match['status']): void {}
export function getTasks(): Task[] { return []; }
export function createTask(task: Omit<Task, 'id' | 'createdAt'>): Task {
  return { ...task, id: `task_${Date.now()}`, createdAt: new Date().toISOString() } as Task;
}
export function updateTaskStatus(_id: string, _status: Task['status'], _blockerDescription?: string): void {}
export function getContracts(): Contract[] { return []; }
export function createContract(contract: Omit<Contract, 'id' | 'status'>): Contract {
  return { ...contract, id: `contract_${Date.now()}`, status: 'Pending' } as Contract;
}
export function signContract(_id: string): void {}
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
    const batch1 = await Promise.all([
      supabase.from('users').select('*'),
      supabase.from('organizations').select('*'),
      supabase.from('client_profiles').select('*'),
      supabase.from('talent_profiles').select('*'),
      supabase.from('skills').select('*'),
      supabase.from('talent_skills').select('*'),
      supabase.from('documents').select('*'),
      supabase.from('service_requests').select('*'),
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
      supabase.from('talent_skill_assessments').select('*')
    ]);

    const [
      rUsers, rOrgs, rClientProfiles, rTalents, rSkills, rTalentSkills, rDocs, rRequests
    ] = batch1;
    const [
      rMatches, rProjects, rTasks, rContracts, rAssignments, rInvoices, rPayments, rPayouts
    ] = batch2;
    const [
      rMessages, rNotifs, rAudit, rAgent, rTickets, rSupportMessages, rInterviews, rRequestActivityLogs, rConversations
    ] = batch3;
    const [
      rAssessments, rAssessmentCategories, rAssessmentQuestions, rAssessmentAssignments, rSkillAssessmentResults, rTalentSkillAssessments
    ] = batch4;

    if (rUsers.error) {
      console.error('[DB] Supabase users query failed:', rUsers.error.message);
      if (_lastSuccessfulRead) {
        console.warn('[DB] Returning cached data due to Supabase failure.');
        return _lastSuccessfulRead;
      }
      return EMPTY_DB;
    }

    if (rTalents.error) {
      console.error('[DB] Supabase talent_profiles query failed:', rTalents.error.message);
      if (_lastSuccessfulRead) {
        console.warn('[DB] Returning cached data due to Supabase failure.');
        return _lastSuccessfulRead;
      }
      return EMPTY_DB;
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
      accountManagerId: o.account_manager_id || 'usr_admin', // Default mock
      accountManagerName: o.account_manager_name || 'Admin', // Default mock
      status: o.status || 'Active',
      healthScore: o.health_score || Math.floor(Math.random() * 30) + 70, // Mock 70-100 if not present
      internalNotes: o.internal_notes || '',
      contactEmail: o.contact_email || 'contact@' + o.name.toLowerCase().replace(/\s/g, '') + '.com',
      contactPhone: o.contact_phone || '+1234567890',
      monthlyRevenue: o.monthly_revenue || Math.floor(Math.random() * 50000) + 10000,
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
    const clientRequests: ServiceRequest[] = (rRequests.data || []).map((r: any) => {
      let roleDescription = r.description || '';
      let requiredSkills: string[] = [];
      let priority = 'Medium';
      let timezone = '';
      let budget = 0;
      let clientName = '';

      // Try to resolve client name from orgs
      const clientProfile = clientProfiles.find(cp => cp.userId === r.client_id);
      const org = organizations.find(o => o.id === clientProfile?.organizationId);
      clientName = org?.name || '';

      try {
        const parsed = JSON.parse(r.description);
        if (parsed && typeof parsed === 'object') {
          roleDescription = parsed.roleDescription || '';
          requiredSkills = parsed.requiredSkills || [];
          priority = parsed.priority || 'Medium';
          timezone = parsed.timezone || '';
          budget = parsed.budget || 0;
          if (!clientName) clientName = parsed.clientName || '';
        }
      } catch (e) {}

      return {
        id: r.id,
        clientId: r.client_id,
        clientName,
        serviceType: r.service_type,
        roleDescription,
        requiredSkills,
        duration: r.duration,
        commitmentLevel: r.commitment_level,
        numberOfHires: r.num_of_talents,
        timezone,
        startDate: r.start_date,
        budget,
        priority,
        status: r.status === 'new' ? 'New Request' : (r.status || 'Reviewing'),
        createdAt: r.created_at,
        urgency: r.urgency || (Math.random() > 0.8 ? 'ASAP' : 'Standard'),
        assignedTalentManagerId: r.assigned_talent_manager_id || null,
        assignedAccountManagerId: r.assigned_account_manager_id || null,
        internalNotes: r.internal_notes || ''
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
        status: c.status === 'signed' ? 'Signed' : 'Pending',
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
      title: iv.title, date: iv.date, time: iv.time, status: iv.status,
      meetingLink: iv.meeting_link, notes: iv.notes, talentNotes: iv.talent_notes,
      clientRating: iv.client_rating, clientFeedback: iv.client_feedback, outcome: iv.outcome,
      googleCalendarEventId: iv.google_calendar_event_id,
      googleCalendarLink: iv.google_calendar_link, createdAt: iv.created_at
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
      roles: [],
      userRoles: [],
      supportTickets,
      supportMessages,
      interviews,
      requestActivityLogs,
      rehireRequests: [],
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
      const rows = db.clientRequests.map((r: any) => ({
        id: r.id,
        client_id: r.clientId,
        service_type: r.serviceType,
        description: JSON.stringify({
          roleDescription: r.roleDescription,
          requiredSkills: r.requiredSkills,
          priority: r.priority,
          timezone: r.timezone,
          budget: r.budget,
          clientName: r.clientName
        }),
        duration: r.duration,
        commitment_level: r.commitmentLevel,
        num_of_talents: r.numberOfHires,
        start_date: r.startDate,
        status: r.status === 'New Request' ? 'new' : r.status,
        urgency: r.urgency,
        assigned_talent_manager_id: r.assignedTalentManagerId,
        assigned_account_manager_id: r.assignedAccountManagerId,
        internal_notes: r.internalNotes
      }));
      const { error } = await supabase.from('service_requests').upsert(rows);
      if (error) console.error('[DB] service_requests upsert error:', error.message);
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
        status: c.status === 'Signed' ? 'signed' : (c.status === 'terminated' ? 'terminated' : (c.status === 'completed' ? 'completed' : 'pending')),
        signed_at: c.signedAt || null,
        termination_reason: c.terminationReason || null,
        client_monthly_fee_usd: c.clientMonthlyFeeUsd || 0,
        performance_score: c.performanceScore || 0
      }));
      const { error } = await supabase.from('contracts').upsert(rows);
      if (error) console.error('[DB] contracts upsert error:', error.message);
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
      const rows = db.interviews.map((iv: any) => ({
        id: iv.id,
        request_id: iv.requestId || null,
        match_id: iv.matchId || null,
        talent_id: iv.talentId,
        talent_name: iv.talentName,
        talent_avatar: iv.talentAvatar || null,
        client_name: iv.clientName,
        title: iv.title,
        date: iv.date,
        time: iv.time,
        status: iv.status,
        meeting_link: iv.meetingLink || null,
        notes: iv.notes || null,
        talent_notes: iv.talentNotes || null,
        client_rating: iv.clientRating || null,
        client_feedback: iv.clientFeedback || null,
        outcome: iv.outcome || null,
        google_calendar_event_id: iv.googleCalendarEventId || null,
        google_calendar_link: iv.googleCalendarLink || null,
        created_at: iv.createdAt || new Date().toISOString()
      }));
      const { error } = await supabase.from('interviews').upsert(rows).catch(() => ({ error: null }));
      if (error) console.error('[DB] interviews upsert error:', (error as any).message);
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

