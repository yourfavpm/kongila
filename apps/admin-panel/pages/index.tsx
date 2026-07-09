import React, { useState, useEffect, useRef } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, LineChart, Line, AreaChart, Area, Cell, PieChart, Pie, Sector } from 'recharts';
import { supabase } from '../lib/supabaseClient';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { GlassCard, Badge, NeonButton, AgentBadge, Chip } from '@kongila/ui';
import ContractsManager from '../components/ContractsManager';
import ComplianceManager from '../components/ComplianceManager';
import { formatCurrency, formatDate, getGradeColor } from '@kongila/utils';
import { calculateCompositeVettingGrade, generateMatchesForRequest, VETTING_STAGES, advanceTalentStage, buildDefaultVettingPipeline } from '@kongila/matching-engine';
import { computePlatformMetrics } from '@kongila/analytics';
import {
  TalentProfile, ServiceRequest, Match, AuditLog, AgentLog, Interview, RehireRequest,
  VettingStageRecord, VettingDecision, Assessment, AssessmentCategory, AssessmentQuestion, AssessmentAssignment
} from '@kongila/shared-types';
import AssessmentWizard from '../components/AssessmentWizard';

// ─── TYPE DEFINITIONS ───────────────────────────────────────────────────────

type AdminTab =
  | 'overview'
  | 'talent-pipeline'
  | 'client-pipeline'
  | 'hiring-requests'
  | 'interviews'
  | 'vetting'
  | 'matching'
  | 'contracts'
  | 'compliance'
  | 'assessments'
  | 'support'
  | 'audit'
  | 'remotan-overview'
  | 'remotan-clients'
  | 'remotan-talent'
  | 'remotan-payroll';

interface SupportTicket {
  id: string;
  talentId?: string;
  clientId?: string;
  subject: string;
  category: string;
  status: string;
  priority: string;
  createdAt: string;
  lastActivity: string;
}

interface SupportMessage {
  id: string;
  ticketId: string;
  senderName: string;
  senderRole: string;
  isSupport: boolean;
  text: string;
  timestamp: string;
  createdAt: string;
}

interface ComplianceDoc {
  id: string;
  userId?: string;
  name: string;
  type: string;
  fileSize?: string;
  status: string;
  uploadedAt: string;
  adminNotes?: string;
  isMandatory?: boolean;
  fileUrl?: string;
}

// Removing local Assessment type, importing from shared-types instead

const normalizeVettingPipeline = (pipeline?: VettingStageRecord[] | null) => {
  const incoming = Array.isArray(pipeline) ? pipeline : [];
  const defaults = buildDefaultVettingPipeline();
  return defaults.map((stage, index) => ({
    ...stage,
    ...(incoming[index] || {}),
    stageIndex: index,
    stageName: incoming[index]?.stageName || stage.stageName,
  }));
};

const getFileUrl = (doc: any) => doc?.fileUrl || doc?.file_url || doc?.url || doc?.href || '';

const getTalentUploadedDocuments = (talent: any) => {
  const docs: any[] = [];
  if (talent?.cvUrl) {
    docs.push({
      id: 'cv',
      name: talent.cvName || 'CV / Resume',
      type: 'CV',
      category: 'CV / Resume',
      fileUrl: talent.cvUrl,
      fileSize: talent.cvSize ? `${Math.round(Number(talent.cvSize) / 1024)} KB` : '',
      uploadedAt: talent.createdAt || '',
      status: 'uploaded',
    });
  }
  if (Array.isArray(talent?.certificationFiles)) {
    talent.certificationFiles.forEach((file: any, index: number) => {
      docs.push({
        id: file?.id || `cert_${index}`,
        name: file?.name || `Certification ${index + 1}`,
        type: 'certification',
        category: 'Certifications',
        fileUrl: file?.url || file?.fileUrl || '',
        fileSize: file?.size ? `${Math.round(Number(file.size) / 1024)} KB` : '',
        uploadedAt: file?.uploadedAt || talent.createdAt || '',
        status: 'uploaded',
      });
    });
  }
  if (Array.isArray(talent?.documents)) {
    talent.documents.forEach((doc: any) => {
      docs.push({
        ...doc,
        fileUrl: getFileUrl(doc),
        category: doc?.category || doc?.type || 'Document',
      });
    });
  }
  return docs.filter((doc, index, all) => {
    const key = getFileUrl(doc) || `${doc.name}-${doc.type || doc.category}`;
    return key && all.findIndex(item => (getFileUrl(item) || `${item.name}-${item.type || item.category}`) === key) === index;
  });
};

interface AssessmentResult {
  id: string;
  assessmentId: string;
  talentId: string;
  talentSkillAssessmentId?: string;
  score?: number;
  autoScore?: number | null;
  passed?: boolean;
  completedAt?: string;
  submittedAt?: string;
  answers?: Record<string, any>;
  subjectiveAnswers?: Record<string, any>;
  hasSubjective?: boolean;
  timeTakenSeconds?: number;
  autoSubmitted?: boolean;
}

// ─── SIDEBAR NAV CONFIG ──────────────────────────────────────────────────────

const KONGILA_NAV = [
  { key: 'overview', label: 'Dashboard' },
  { key: 'talent-pipeline', label: 'Talent Pipeline' },
  { key: 'vetting', label: 'Talent Vetting' },
  { key: 'client-pipeline', label: 'Client Pipeline' },
  { key: 'hiring-requests', label: 'Hiring Requests' },
  { key: 'interviews', label: 'Interviews' },
  { key: 'matching', label: 'Match & Shortlist' },
  { key: 'contracts', label: 'Contracts & Offers' },
  { key: 'compliance', label: 'Compliance Docs' },
  { key: 'assessments', label: 'Skill Assessments' },
  { key: 'support', label: 'Support Center' },
  { key: 'audit', label: 'Audit Logs' },
] as const;

const REMOTAN_NAV = [
  { key: 'remotan-overview', label: 'Remotan Overview' },
  { key: 'remotan-clients', label: 'Remotan Clients' },
  { key: 'remotan-talent', label: 'Remotan Talent' },
  { key: 'remotan-payroll', label: 'Payroll & EOR' },
] as const;

// ─── MAIN COMPONENT ──────────────────────────────────────────────────────────

export default function AdminPanel() {
  // ── Core data
  const [talents, setTalents] = useState<TalentProfile[]>([]);
  const [requests, setRequests] = useState<ServiceRequest[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [contracts, setContracts] = useState<any[]>([]);
  const [contractTemplates, setContractTemplates] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [agentLogs, setAgentLogs] = useState<AgentLog[]>([]);
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [rehireRequests, setRehireRequests] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [organizations, setOrganizations] = useState<any[]>([]);
  const [clientProfiles, setClientProfiles] = useState<any[]>([]);
  const [documents, setDocuments] = useState<ComplianceDoc[]>([]);
  const [supportTickets, setSupportTickets] = useState<SupportTicket[]>([]);
  const [supportMessages, setSupportMessages] = useState<SupportMessage[]>([]);
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [assessmentCategories, setAssessmentCategories] = useState<AssessmentCategory[]>([]);
  const [assessmentQuestions, setAssessmentQuestions] = useState<AssessmentQuestion[]>([]);
  const [assessmentAssignments, setAssessmentAssignments] = useState<AssessmentAssignment[]>([]);
  const [assessmentResults, setAssessmentResults] = useState<AssessmentResult[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [talentPayouts, setTalentPayouts] = useState<any[]>([]);
  
  // New stage-specific collections
  const [skillAssessments, setSkillAssessments] = useState<any[]>([]);
  const [talentSkillAssessments, setTalentSkillAssessments] = useState<any[]>([]);
  const [workSimulationTasks, setWorkSimulationTasks] = useState<any[]>([]);
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  // ── Navigation
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // ── Selection
  const [selectedTalent, setSelectedTalent] = useState<TalentProfile | null>(null);
  const [selectedRequest, setSelectedRequest] = useState<ServiceRequest | null>(null);
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [selectedContract, setSelectedContract] = useState<any | null>(null);
  const [selectedClient, setSelectedClient] = useState<any | null>(null);

  // ── Search states
  const [talentSearchQuery, setTalentSearchQuery] = useState('');
  const [clientSearchQuery, setClientSearchQuery] = useState('');
  const [requestSearchQuery, setRequestSearchQuery] = useState('');

  // ── Vetting form
  const [editScores, setEditScores] = useState({ technical: 90, workSimulation: 90, behavioral: 85, communication: 85, personality: 80, remoteReadiness: 90, experience: 80 });

  // ── Vetting pipeline state
  const [activeVettingStageIdx, setActiveVettingStageIdx] = useState<number | null>(null);
  const [stageScoreInput, setStageScoreInput] = useState<number>(80);
  const [stageRubricScores, setStageRubricScores] = useState<Record<string, number>>({});
  const [stageNotesInput, setStageNotesInput] = useState<string>('');
  const [stageDeadlineInput, setStageDeadlineInput] = useState<string>('');
  const [stageAssessmentId, setStageAssessmentId] = useState<string>('');
  const [stageInterviewDate, setStageInterviewDate] = useState<string>('');
  const [stageInterviewTime, setStageInterviewTime] = useState<string>('');
  const [stageInterviewLink, setStageInterviewLink] = useState<string>('');
  const [stagePersonalityLink, setStagePersonalityLink] = useState<string>('');
  const [stageTaskTitle, setStageTaskTitle] = useState<string>('');
  const [stageTaskDescription, setStageTaskDescription] = useState<string>('');
  const [editScoresMode, setEditScoresMode] = useState(false);
  const [pendingRejection, setPendingRejection] = useState<{ stageIdx: number; score?: number } | null>(null);
  const [rejectionReasonInput, setRejectionReasonInput] = useState('');

  // ── Filter states
  const [talentFilter, setTalentFilter] = useState('All');
  const [requestFilter, setRequestFilter] = useState('All');
  const [ticketFilter, setTicketFilter] = useState('All');
  const [priorityFilter, setPriorityFilter] = useState('All');
  const [contractFilter, setContractFilter] = useState('All');
  const [docFilter, setDocFilter] = useState('All');

  // ── Modal states
  const [showContractModal, setShowContractModal] = useState(false);
  const [showDocModal, setShowDocModal] = useState(false);
  const [showAssessmentModal, setShowAssessmentModal] = useState(false);
  const [showResultModal, setShowResultModal] = useState(false);
  const [showGradingModal, setShowGradingModal] = useState(false);
  const [selectedAssessmentResultForReview, setSelectedAssessmentResultForReview] = useState<any>(null);
  const [gradingScores, setGradingScores] = useState<Record<string, number>>({});
  const [assessmentToEdit, setAssessmentToEdit] = useState<any>(null);

  // ── Form states
  const [contractForm, setContractForm] = useState({ clientId: '', clientName: '', talentId: '', talentName: '', role: '', rateType: 'Monthly', rateAmount: '', startDate: '', endDate: '', engagementModel: 'Remote / Full-time Retainer', status: 'Draft', currency: 'USD' });
  const [docForm, setDocForm] = useState({ name: '', type: 'NDA', userId: '', adminNotes: '', isMandatory: false, file: null as File | null });
  const [assessmentForm, setAssessmentForm] = useState({ title: '', description: '', skillTags: '', questionCount: '10', timeLimit: '60', passingScore: '70', assignedTalents: [] as string[] });
  const [resultForm, setResultForm] = useState({ assessmentId: '', talentId: '', score: '', passed: true });
  const [supportReply, setSupportReply] = useState('');

  // ── Submit loading
  const [saving, setSaving] = useState(false);

  // ─── DATA SYNC ──────────────────────────────────────────────────────────────

  const syncFromDb = async () => {
    try {
      const res = await fetch('/api/db');
      if (res.ok) {
        const db = await res.json();
        const freshTalents = db.talents || [];
        setTalents(freshTalents);

        // Fetch organizations from Supabase
        const { data: supabaseOrgs } = await supabase.from('organizations').select('*');
        setOrganizations(supabaseOrgs || []);

        // Fetch client requests from Supabase
        const { data: supabaseRequests } = await supabase.from('talent_requests').select('payload').order('created_at', { ascending: false });
        if (supabaseRequests && supabaseRequests.length > 0) {
          setRequests(supabaseRequests.map(r => r.payload));
        } else {
          setRequests([]);
        }

        setMatches(db.matches || []);
        
        // Fetch client profiles
        const { data: supabaseClientProfiles } = await supabase.from('client_profiles').select('*');
        setClientProfiles(supabaseClientProfiles || []);
        
        setContracts(db.contracts || []);
        setContractTemplates(db.contractTemplates || []);
        setAuditLogs(db.auditLogs || []);
        setAgentLogs(db.agentLogs || []);
        setRehireRequests(db.rehireRequests || []);
        setUsers(db.users || []);
        setDocuments(db.documents || []);
        setSupportTickets(db.supportTickets || []);
        setSupportMessages(db.supportMessages || []);
        setAssessments(db.assessments || []);
        setAssessmentCategories(db.assessmentCategories || []);
        setAssessmentQuestions(db.assessmentQuestions || []);
        setAssessmentAssignments(db.assessmentAssignments || []);
        setAssessmentResults(db.skillAssessmentResults || []);
        setInvoices(db.invoices || []);
        setPayments(db.payments || []);
        setTalentPayouts(db.talentPayouts || []);
        setSkillAssessments(db.assessments || []);
        setTalentSkillAssessments(db.talentSkillAssessments || []);
        setWorkSimulationTasks(db.workSimulationTasks || []);

        // CRITICAL: keep selectedTalent in sync with the latest DB state.
        // This prevents the poll from resetting the vetting stage to the old value.
        setSelectedTalent(prev => {
          if (!prev) return prev;
          const freshMatch = freshTalents.find((t: any) => t.id === prev.id);
          if (!freshMatch) return prev;
          // Only update if pipeline has actually changed in DB, otherwise keep local state
          const dbPipeline = freshMatch.vettingPipeline;
          const localPipeline = prev.vettingPipeline;
          const dbStage = freshMatch.vettingStage;
          const localStage = prev.vettingStage;
          // If local is ahead (just saved), keep local to avoid snapback
          if (localStage !== dbStage || JSON.stringify(localPipeline) !== JSON.stringify(dbPipeline)) {
            // Only take DB version if DB is newer (has more passed stages)
            const dbPassed = (dbPipeline || []).filter((s: any) => s.status === 'passed').length;
            const localPassed = (localPipeline || []).filter((s: any) => s.status === 'passed').length;
            if (dbPassed >= localPassed) return freshMatch;
            return prev; // local is ahead, keep it
          }
          return { ...freshMatch, vettingPipeline: localPipeline || dbPipeline };
        });
      }
      const ivRes = await fetch('/api/interviews');
      if (ivRes.ok) {
        const ivData = await ivRes.json();
        setInterviews(Array.isArray(ivData) ? ivData : []);
      }
    } catch (e) {
      console.error('Failed to sync DB', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    syncFromDb();
    const interval = setInterval(syncFromDb, 4000);
    
    // Realtime subscriptions
    const reqChannel = supabase.channel('admin_talent_requests')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'talent_requests' }, () => syncFromDb())
      .subscribe();
      
    const orgChannel = supabase.channel('admin_organizations')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'organizations' }, () => syncFromDb())
      .subscribe();

    return () => {
      clearInterval(interval);
      supabase.removeChannel(reqChannel);
      supabase.removeChannel(orgChannel);
    };
  }, []);

  useEffect(() => {
    if (selectedTalent) {
      setEditScores({
        technical: selectedTalent.vettingScores.technical,
        workSimulation: selectedTalent.vettingScores.workSimulation,
        behavioral: selectedTalent.vettingScores.behavioral,
        communication: selectedTalent.vettingScores.communication,
        personality: selectedTalent.vettingScores.personality,
        remoteReadiness: selectedTalent.vettingScores.remoteReadiness,
        experience: selectedTalent.vettingScores.experience,
      });
    }
  }, [selectedTalent]);

  // ─── METRICS ────────────────────────────────────────────────────────────────

  const metrics = computePlatformMetrics(talents, requests, matches, contracts);
  const mrrTotal = metrics.totalRevenue;
  const utilizationRate = metrics.utilizationRate;
  const activeTalentCount = metrics.activeTalentCount;

  // ─── HANDLERS ───────────────────────────────────────────────────────────────

  const saveToDb = async (updatedDb: any) => {
    try {
      const res = await fetch('/api/db', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedDb),
      });
      if (!res.ok) {
        const err = await res.json();
        alert(`Database Save Error: ${err.error || 'Failed to sync with Supabase'}`);
      }
    } catch (e) {
      console.error('Failed to save DB', e);
      alert('Failed to save to Database. Check console for details.');
    }
  };

  // Vetting
  const handleVettingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTalent) return;
    setSaving(true);
    const calculation = calculateCompositeVettingGrade(editScores);
    const updatedTalents = talents.map(t =>
      t.id === selectedTalent.id
        ? { ...t, vettingScores: editScores, grade: calculation.grade, vettingStatus: calculation.grade === 'Reject' ? 'Review' as const : 'Vetted' as const }
        : t
    );
    const newAuditLog: AuditLog = { id: `audit_${Date.now()}`, actor: 'Admin Operator', action: 'Update Vetting Scores', details: `Recalculated vetting score for ${selectedTalent.name}. Grade: ${calculation.grade} (${calculation.score}%)`, timestamp: new Date().toISOString() };
    const newAgentLog: AgentLog = { id: `alog_${Date.now()}`, agentName: 'Compliance Agent', message: `Audit completed: ${selectedTalent.name} composite score locked at ${calculation.score}%.`, timestamp: new Date().toISOString(), type: calculation.grade === 'Reject' ? 'error' : 'success' };
    setTalents(updatedTalents);
    setAuditLogs([newAuditLog, ...auditLogs]);
    setAgentLogs([newAgentLog, ...agentLogs]);
    setSelectedTalent(updatedTalents.find(t => t.id === selectedTalent.id) || null);
    await saveToDb({ talents: updatedTalents, clientRequests: requests, matches, contracts, auditLogs: [newAuditLog, ...auditLogs], agentLogs: [newAgentLog, ...agentLogs], interviews, rehireRequests, tasks: [] });
    setSaving(false);
  };

  // Stage-level vetting decision handler
  const handleStageDecision = async (stageIdx: number, decision: VettingDecision, score: number | undefined, notes: string, forceReasonModal = false) => {
    if (!selectedTalent) return;
    if (decision === 'Reject' && (forceReasonModal || !notes.trim())) {
      setPendingRejection({ stageIdx, score });
      setRejectionReasonInput(notes.trim());
      return;
    }

    setSaving(true);
    const currentPipeline: VettingStageRecord[] = normalizeVettingPipeline(selectedTalent.vettingPipeline);
    const updatedPipeline = advanceTalentStage(currentPipeline, stageIdx, decision, score, notes);
    if (!updatedPipeline[stageIdx]) {
      updatedPipeline[stageIdx] = { ...buildDefaultVettingPipeline()[stageIdx], status: 'in_progress' };
    }

    // AC-T-012: Store rejection reason securely
    if (decision === 'Reject') {
      (updatedPipeline[stageIdx] as any).rejectionReason = notes;
    }

    // Apply stage-specific deadline if set
    if (stageDeadlineInput) {
      updatedPipeline[stageIdx].deadline = stageDeadlineInput;
    }

    let payload: any = {};
    const timestamp = new Date().toISOString();

    // Side-effects based on stage and decision
    if (decision === 'Assign' || (decision === 'Proceed' && !currentPipeline[stageIdx]?.assessmentId && !currentPipeline[stageIdx]?.taskId && !currentPipeline[stageIdx]?.interviewId && !currentPipeline[stageIdx]?.personalityLink)) {
      if (stageIdx === 1 && stageAssessmentId) {
        // Assign Assessment
        const tsa = {
          id: `tsa_${Date.now()}`,
          talentId: selectedTalent.id,
          assessmentId: stageAssessmentId,
          assignedAt: timestamp,
          status: 'assigned'
        };
        updatedPipeline[stageIdx].assessmentId = tsa.id;
        updatedPipeline[stageIdx].deadline = stageDeadlineInput || undefined;
        payload.talentSkillAssessments = [...talentSkillAssessments, tsa];
        setTalentSkillAssessments(payload.talentSkillAssessments);
      }
      if (stageIdx === 2 && stageInterviewDate && stageInterviewTime) {
        // Schedule Interview
        const interview = {
          id: `int_${Date.now()}`,
          requestId: 'system_vetting',
          matchId: 'system_vetting',
          talentId: selectedTalent.id,
          talentName: selectedTalent.name,
          clientName: 'Kongila Vetting Panel',
          title: `Behavioural Interview: ${selectedTalent.name}`,
          date: stageInterviewDate,
          time: stageInterviewTime,
          status: 'Scheduled',
          meetingLink: stageInterviewLink,
          createdAt: timestamp
        };
        updatedPipeline[stageIdx].interviewId = interview.id;
        // Store these on the stage record so the waiting UI can display them
        updatedPipeline[stageIdx].interviewDate = stageInterviewDate;
        updatedPipeline[stageIdx].interviewTime = stageInterviewTime;
        updatedPipeline[stageIdx].meetingLink = stageInterviewLink;
        updatedPipeline[stageIdx].rescheduleRequested = false;
        updatedPipeline[stageIdx].rescheduleReason = undefined;
        payload.interviews = [...interviews, interview];
        setInterviews(payload.interviews);
      }
      if (stageIdx === 3 && stagePersonalityLink) {
        // Stage 4: Personality Test Link
        updatedPipeline[stageIdx].personalityLink = stagePersonalityLink;
      }
      if (stageIdx === 5 && stageTaskTitle) {
        // Assign Work Simulation Task
        const task = {
          id: `wst_${Date.now()}`,
          talentId: selectedTalent.id,
          title: stageTaskTitle,
          description: stageTaskDescription,
          assignedAt: timestamp,
          deadline: stageDeadlineInput || timestamp,
          status: 'assigned'
        };
        updatedPipeline[stageIdx].taskId = task.id;
        updatedPipeline[stageIdx].deadline = stageDeadlineInput || undefined;
        payload.workSimulationTasks = [...workSimulationTasks, task];
        setWorkSimulationTasks(payload.workSimulationTasks);
      }
    }

    // Map stage score to talent's vettingScores field
    const stageConfig = VETTING_STAGES[stageIdx];
    let updatedVettingScores = { ...selectedTalent.vettingScores };
    if (stageConfig?.scoreKey && score !== undefined) {
      updatedVettingScores = { ...updatedVettingScores, [stageConfig.scoreKey]: score };
    }

    // Determine new vettingStage name
    const nextInProgressIdx = updatedPipeline.findIndex(s => s.status === 'in_progress');
    const newVettingStage = nextInProgressIdx >= 0
      ? updatedPipeline[nextInProgressIdx].stageName
      : decision === 'Reject' ? 'Application Screening' : 'Final Review';

    const calculation = calculateCompositeVettingGrade(updatedVettingScores);
    const newVettingStatus = decision === 'Reject'
      ? 'Review' as const
      : stageIdx === 6 ? 'Vetted' as const
      : selectedTalent.vettingStatus;

    const updatedTalent: any = {
      ...selectedTalent,
      vettingPipeline: updatedPipeline,
      vettingScores: updatedVettingScores,
      vettingStage: newVettingStage,
      vettingStatus: newVettingStatus,
      grade: calculation.grade,
    };

    // AC-T-012 & AC-T-014: Fire notification
    fetch('/api/notifications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        talentId: selectedTalent.id,
        type: 'stage_transition',
        stage: VETTING_STAGES[stageIdx]?.name,
        isRejection: decision === 'Reject',
        subject: decision === 'Reject' 
          ? `Update on your ${VETTING_STAGES[stageIdx]?.name}`
          : `You've advanced to ${newVettingStage}!`,
        message: decision === 'Reject' 
          ? `We have reviewed your profile and unfortunately cannot proceed with your application at this time. Reason: ${notes}`
          : `Congratulations, your status has been updated. Please log in to your dashboard to view the next steps.`
      })
    }).catch(e => console.error("Notification failed:", e));

    const updatedTalents = talents.map(t => t.id === selectedTalent.id ? updatedTalent : t);
    const newAuditLog: AuditLog = {
      id: `audit_${Date.now()}`,
      actor: 'Admin Operator',
      action: `Stage Decision: ${VETTING_STAGES[stageIdx]?.name}`,
      details: `Decision: ${decision} | Score: ${score ?? 'N/A'} | Notes: "${notes}" | New Grade: ${calculation.grade} (${calculation.score}%)`,
      timestamp: new Date().toISOString(),
    };
    const newAgentLog: AgentLog = {
      id: `alog_${Date.now()}`,
      agentName: 'Compliance Agent',
      message: `${selectedTalent.name} — Stage ${stageIdx + 1} (${VETTING_STAGES[stageIdx]?.name}): ${decision}.`,
      timestamp: new Date().toISOString(),
      type: decision === 'Reject' ? 'error' : decision === 'Proceed' ? 'success' : 'warning',
    };

    setTalents(updatedTalents);
    setSelectedTalent(updatedTalent as TalentProfile);
    setAuditLogs([newAuditLog, ...auditLogs]);
    setAgentLogs([newAgentLog, ...agentLogs]);
    setActiveVettingStageIdx(null);
    setStageNotesInput('');
    setStageScoreInput(80);
    setStageRubricScores({});
    setStageAssessmentId('');
    setStageInterviewDate('');
    setStageInterviewTime('');
    setStageInterviewLink('');
    setStagePersonalityLink('');
    setStageTaskTitle('');
    setStageTaskDescription('');
    setStageDeadlineInput('');
    setPendingRejection(null);
    setRejectionReasonInput('');

    await saveToDb({
      talents: updatedTalents,
      clientRequests: requests,
      matches,
      contracts,
      auditLogs: [newAuditLog, ...auditLogs],
      agentLogs: [newAgentLog, ...agentLogs],
      interviews: payload.interviews || interviews,
      rehireRequests,
      talentSkillAssessments: payload.talentSkillAssessments || talentSkillAssessments,
      workSimulationTasks: payload.workSimulationTasks || workSimulationTasks,
      tasks: [],
    });
    setSaving(false);
  };

  const handleReAssess = async (stageIdx: number) => {
    if (!selectedTalent || saving) return;
    setSaving(true);
    
    // Reset the target stage to in_progress, and all subsequent stages to pending.
    const updatedPipeline = (selectedTalent.vettingPipeline || []).map((s, idx) => {
      if (idx === stageIdx) return { ...s, status: 'in_progress', completedAt: undefined, decision: undefined };
      if (idx > stageIdx) return { ...s, status: 'pending', completedAt: undefined, decision: undefined };
      return s;
    });

    // Update vetting stage name based on the re-opened stage
    const newVettingStage = updatedPipeline[stageIdx].stageName;

    const updatedTalent: any = {
      ...selectedTalent,
      vettingPipeline: updatedPipeline,
      vettingStage: newVettingStage,
    };
    const updatedTalents = talents.map(t => t.id === selectedTalent.id ? updatedTalent : t);
    
    const newAuditLog: AuditLog = {
      id: `audit_${Date.now()}`,
      actor: 'Ops Lead',
      action: `Ops Override: Re-Assess Stage ${stageIdx + 1}`,
      details: `Re-opened stage ${stageIdx + 1} for re-assessment. Subsequent stages reset to pending.`,
      timestamp: new Date().toISOString(),
    };

    setTalents(updatedTalents);
    setSelectedTalent(updatedTalent as TalentProfile);
    setAuditLogs([newAuditLog, ...auditLogs]);

    await saveToDb({
      talents: updatedTalents,
      auditLogs: [newAuditLog, ...auditLogs],
    });
    setSaving(false);
  };

  const handleSubmitGrading = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAssessmentResultForReview) return;
    alert("Grading submitted!");
    setShowGradingModal(false);
  };

  // Matching
  const handlePushMatch = async (matchId: string) => {
    const targetMatch = matches.find(m => m.id === matchId);
    if (!targetMatch) return;
    
    // Check compliance
    const pendingDocs = documents.filter((d: any) => d.isMandatory && !d.isHidden && !d.userId && (!d.signedByTalentIds || !d.signedByTalentIds.includes(targetMatch.talentId)));
    if (pendingDocs.length > 0) {
      alert(`Cannot push this match. The candidate has ${pendingDocs.length} pending mandatory compliance document(s) to sign.`);
      return;
    }

    const updatedMatches = matches.map(m => m.id === matchId ? { ...m, status: 'Shortlisted' as const } : m);
    const talentName = talents.find(t => t.id === targetMatch.talentId)?.name || 'Contractor';
    const newAuditLog: AuditLog = { id: `audit_${Date.now()}`, actor: 'Admin Operator', action: 'Push Match Shortlist', details: `Shortlisted candidate ${talentName} pushed to client dashboard.`, timestamp: new Date().toISOString() };
    const newAgentLog: AgentLog = { id: `alog_${Date.now()}`, agentName: 'Matching Agent', message: `Candidate ${talentName} pushed to client shortlist deck.`, timestamp: new Date().toLocaleTimeString(), type: 'success' };
    setMatches(updatedMatches);
    setAuditLogs([newAuditLog, ...auditLogs]);
    await saveToDb({ talents, clientRequests: requests, matches: updatedMatches, contracts, notifications: [{ id: `notif_${Date.now()}`, userId: 'usr_horizon', title: 'New Matches Shortlisted', message: `${talentName} has been pushed to your shortlist!`, read: false, createdAt: new Date().toISOString() }], auditLogs: [newAuditLog, ...auditLogs], agentLogs: [newAgentLog, ...agentLogs], interviews, rehireRequests, tasks: [] });
  };

  const handleShortlistCandidate = async (talentId: string) => {
    if (!selectedRequest) return;
    const exists = matches.some(m => m.requestId === selectedRequest.id && m.talentId === talentId);
    if (exists) { alert('Candidate is already shortlisted for this request.'); return; }
    
    // Check compliance
    const pendingDocs = documents.filter((d: any) => d.isMandatory && !d.isHidden && !d.userId && (!d.signedByTalentIds || !d.signedByTalentIds.includes(talentId)));
    if (pendingDocs.length > 0) {
      alert(`Cannot shortlist this candidate. They have ${pendingDocs.length} pending mandatory compliance document(s) to sign.`);
      return;
    }

    const talent = talents.find(t => t.id === talentId);
    if (!talent) return;
    const newMatch: Match = { id: `match_${Date.now()}_${talentId}`, requestId: selectedRequest.id, talentId, score: Math.floor(Math.random() * 15) + 84, breakdown: { skillFit: Math.floor(Math.random() * 15) + 80, behaviorFit: Math.floor(Math.random() * 15) + 80, personalityFit: Math.floor(Math.random() * 15) + 80, availability: Math.floor(Math.random() * 15) + 80, pastPerformance: Math.floor(Math.random() * 15) + 80 }, status: 'Shortlisted' };
    const newAuditLog: AuditLog = { id: `audit_${Date.now()}`, actor: 'Admin Operator', action: 'Shortlist Candidate', details: `Manually shortlisted ${talent.name} for request ${selectedRequest.serviceType}.`, timestamp: new Date().toISOString() };
    const newAgentLog: AgentLog = { id: `alog_${Date.now()}`, agentName: 'Matching Agent', message: `Candidate ${talent.name} shortlisted. Score: ${newMatch.score}% Fit.`, timestamp: new Date().toLocaleTimeString(), type: 'success' };
    const updatedMatches = [...matches, newMatch];
    setMatches(updatedMatches);
    setAuditLogs([newAuditLog, ...auditLogs]);
    await saveToDb({ talents, clientRequests: requests, matches: updatedMatches, contracts, notifications: [{ id: `notif_${Date.now()}`, userId: selectedRequest.clientId || 'usr_horizon', title: 'Candidate Shortlisted', message: `"${talent.name}" shortlisted for "${selectedRequest.serviceType}"!`, read: false, createdAt: new Date().toISOString() }], auditLogs: [newAuditLog, ...auditLogs], agentLogs: [newAgentLog, ...agentLogs], interviews, rehireRequests, tasks: [] });
    alert(`${talent.name} has been shortlisted successfully.`);
  };

  const handleAcceptInterviewRequest = async (matchId: string) => {
    const match = matches.find(m => m.id === matchId);
    if (!match || !selectedRequest) return;
    const talent = talents.find(t => t.id === match.talentId);
    if (!talent) return;
    const proposedDate = (match as any).requestedDate || new Date().toISOString().split('T')[0];
    const proposedTime = (match as any).requestedTime || '10:00';
    const confCode = `${Math.random().toString(36).substring(2, 5)}-${Math.random().toString(36).substring(2, 6)}-${Math.random().toString(36).substring(2, 5)}`;
    const meetingLink = `https://meet.google.com/${confCode}`;
    const calEventId = `gcal_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const calendarTitle = encodeURIComponent(`${selectedRequest.serviceType} - Interview with ${talent.name}`);
    const googleCalendarLink = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${calendarTitle}&dates=${proposedDate.replace(/-/g, '')}T${proposedTime.replace(':', '')}00Z/${proposedDate.replace(/-/g, '')}T${proposedTime.replace(':', '')}00Z&location=${encodeURIComponent(meetingLink)}`;
    const newInterview: Interview = { id: `interview_${Date.now()}`, requestId: selectedRequest.id, matchId: match.id, talentId: match.talentId, talentName: talent.name, talentAvatar: talent.avatar || '', clientName: selectedRequest.clientName || '', title: `${selectedRequest.serviceType} - Interview with ${talent.name}`, date: proposedDate, time: proposedTime, status: 'Scheduled', meetingLink, googleCalendarEventId: calEventId, googleCalendarLink, notes: (match as any).requestedNotes || '', createdAt: new Date().toISOString() };
    const updatedMatches = matches.map(m => m.id === matchId ? { ...m, status: 'Interview Scheduled' as const } : m);
    const updatedInterviews = [newInterview, ...interviews];
    const newAuditLog: AuditLog = { id: `audit_${Date.now()}`, actor: 'Admin Operator', action: 'Confirm Interview', details: `Scheduled interview for ${talent.name} on ${proposedDate} at ${proposedTime}.`, timestamp: new Date().toISOString() };
    const newAgentLog: AgentLog = { id: `alog_${Date.now()}`, agentName: 'Workflow Agent', message: `Interview confirmed with ${talent.name}. Calendar synced.`, timestamp: new Date().toLocaleTimeString(), type: 'success' };
    setMatches(updatedMatches);
    setInterviews(updatedInterviews);
    setAuditLogs([newAuditLog, ...auditLogs]);
    await saveToDb({ talents, clientRequests: requests, matches: updatedMatches, contracts, notifications: [{ id: `notif_${Date.now()}`, userId: selectedRequest.clientId || 'usr_horizon', title: 'Interview Confirmed', message: `Interview with "${talent.name}" confirmed for ${proposedDate} at ${proposedTime}!`, read: false, createdAt: new Date().toISOString() }], auditLogs: [newAuditLog, ...auditLogs], agentLogs: [newAgentLog, ...agentLogs], interviews: updatedInterviews, rehireRequests, tasks: [] });
    alert(`Interview with ${talent.name} scheduled successfully.`);
  };

  const handleApproveRehire = async (rehireId: string) => {
    const rehire = rehireRequests.find(r => r.id === rehireId);
    if (!rehire) return;
    const newContract: any = { id: `cnt_rehire_${Date.now()}`, matchId: `match_rehire_${Date.now()}`, clientId: rehire.clientId, clientName: rehire.clientName, talentId: rehire.talentId, talentName: rehire.talentName, role: rehire.role, salary: Number(rehire.proposedRate || 12400), startDate: rehire.proposedStartDate, status: 'Signed', signedAt: new Date().toISOString() };
    const updatedRehires = rehireRequests.map(r => r.id === rehireId ? { ...r, status: 'Approved' as const } : r);
    const updatedContracts = [...contracts, newContract];
    setRehireRequests(updatedRehires);
    setContracts(updatedContracts);
    await saveToDb({ talents, clientRequests: requests, matches, contracts: updatedContracts, notifications: [{ id: `notif_${Date.now()}`, userId: rehire.clientId, title: 'Re-hire Approved!', message: `Your re-hire request for "${rehire.talentName}" has been approved!`, read: false, createdAt: new Date().toISOString() }], auditLogs: [{ id: `audit_${Date.now()}`, actor: 'Admin Operator', action: 'Approve Re-hire', details: `Approved re-hire of ${rehire.talentName} as ${rehire.role}.`, timestamp: new Date().toISOString() }, ...auditLogs], agentLogs, interviews, rehireRequests: updatedRehires, tasks: [] });
    alert(`Re-hire for ${rehire.talentName} approved!`);
  };

  // Compliance
  const handleUpdateDocStatus = async (docId: string, newStatus: string) => {
    try {
      const res = await fetch('/api/compliance', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: docId, status: newStatus }) });
      if (res.ok) await syncFromDb();
    } catch (e) { console.error(e); }
  };

  // Assessments
  const handleCreateAssessment = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const payload = { ...assessmentForm, skillTags: assessmentForm.skillTags.split(',').map(s => s.trim()).filter(Boolean), questionCount: Number(assessmentForm.questionCount), timeLimit: Number(assessmentForm.timeLimit), passingScore: Number(assessmentForm.passingScore) };
    try {
      const res = await fetch('/api/assessments', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (res.ok) {
        setShowAssessmentModal(false);
        setAssessmentForm({ title: '', description: '', skillTags: '', questionCount: '10', timeLimit: '60', passingScore: '70', assignedTalents: [] });
        await syncFromDb();
      }
    } catch (e) { console.error(e); }
    setSaving(false);
  };

  const handleRecordResult = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const payload = { type: 'result', ...resultForm, score: Number(resultForm.score) };
    try {
      const res = await fetch('/api/assessments', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (res.ok) {
        setShowResultModal(false);
        setResultForm({ assessmentId: '', talentId: '', score: '', passed: true });
        await syncFromDb();
      }
    } catch (e) { console.error(e); }
    setSaving(false);
  };

  const handleArchiveAssessment = async (assessmentId: string) => {
    try {
      await fetch('/api/assessments', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: assessmentId, status: 'archived' }) });
      await syncFromDb();
    } catch (e) { console.error(e); }
  };

  // Support
  const handleSupportReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicket || !supportReply.trim()) return;
    setSaving(true);
    try {
      const res = await fetch('/api/support', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'message', ticketId: selectedTicket.id, senderName: 'Admin Support', senderRole: 'Support', text: supportReply }) });
      if (res.ok) {
        setSupportReply('');
        await syncFromDb();
      }
    } catch (e) { console.error(e); }
    setSaving(false);
  };

  const handleUpdateTicketStatus = async (ticketId: string, newStatus: string) => {
    try {
      const res = await fetch('/api/support', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: ticketId, status: newStatus }) });
      if (res.ok) {
        await syncFromDb();
        if (selectedTicket?.id === ticketId) setSelectedTicket({ ...selectedTicket, status: newStatus });
      }
    } catch (e) { console.error(e); }
  };

  const handleUpdateRequestStatus = async (requestId: string, newStatus: string) => {
    const updatedRequests = requests.map(r => r.id === requestId ? { ...r, status: newStatus as any } : r);
    setRequests(updatedRequests);
    await saveToDb({ talents, clientRequests: updatedRequests, matches, contracts, auditLogs: [{ id: `audit_${Date.now()}`, actor: 'Admin Operator', action: 'Update Request Status', details: `Request ${requestId} updated to "${newStatus}".`, timestamp: new Date().toISOString() }, ...auditLogs], agentLogs, interviews, rehireRequests, tasks: [] });
  };

  // ─── HELPERS ─────────────────────────────────────────────────────────────────

  const getTalentForUser = (userId: string) => talents.find(t => t.id === userId);
  const getOrgForUser = (userId: string) => {
    const profile = clientProfiles.find(p => p.userId === userId);
    if (!profile) return null;
    return organizations.find(o => o.id === profile.organizationId);
  };

  const filteredTalents = talents.filter(t => 
    (talentFilter === 'All' || t.vettingStatus === talentFilter) &&
    (t.name.toLowerCase().includes(talentSearchQuery.toLowerCase()) || 
     t.title?.toLowerCase().includes(talentSearchQuery.toLowerCase()) ||
     t.tags?.some(tag => tag.toLowerCase().includes(talentSearchQuery.toLowerCase())))
  );

  const filteredRequests = requests.filter(r => 
    (requestFilter === 'All' || r.status === requestFilter) &&
    (r.serviceType?.toLowerCase().includes(requestSearchQuery.toLowerCase()) ||
     r.roleDescription?.toLowerCase().includes(requestSearchQuery.toLowerCase()) ||
     r.clientName?.toLowerCase().includes(requestSearchQuery.toLowerCase()))
  );

  const filteredOrganizations = organizations.filter(org => 
    org.name.toLowerCase().includes(clientSearchQuery.toLowerCase())
  );
  const filteredTickets = supportTickets.filter(t => {
    const matchStatus = ticketFilter === 'All' || t.status === ticketFilter;
    const matchPriority = priorityFilter === 'All' || t.priority === priorityFilter;
    return matchStatus && matchPriority;
  });
  const filteredContracts = contractFilter === 'All' ? contracts : contracts.filter(c => c.status === contractFilter);
  const filteredDocs = docFilter === 'All' ? documents : documents.filter(d => d.status === docFilter);

  const clientUsers = users.filter(u => u.role === 'client');
  const talentUsers = users.filter(u => u.role === 'talent');

  // ─── RENDER ──────────────────────────────────────────────────────────────────

  const statusColor = (status: string) => {
    const map: Record<string, string> = { 'Signed': '#10B981', 'Draft': '#6B7A99', 'Active': '#10B981', 'Open': '#3D7FFF', 'In Progress': '#F59E0B', 'Resolved': '#10B981', 'Closed': '#6B7A99', 'Scheduled': '#2563EB', 'Rescheduled': '#7C3AED', 'Completed': '#10B981', 'Cancelled': '#EF4444', 'Urgent': '#EF4444', 'High': '#F59E0B', 'Medium': '#3D7FFF', 'Low': '#10B981', 'pending_signature': '#F59E0B', 'signed': '#10B981', 'verified': '#0047CC', 'vetted': '#10B981', 'under_review': '#F59E0B' };
    return map[status] || '#6B7A99';
  };
  const statusBg = (status: string) => {
    const c = statusColor(status);
    return `${c}18`;
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--bg-primary)' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '32px', marginBottom: '12px', animation: 'spin 1s linear infinite', display: 'inline-block' }}>⚙️</div>
          <div style={{ fontSize: '16px', color: 'var(--text-secondary)' }}>Loading Admin Console...</div>
        </div>
      </div>
    );
  }

  const renderTab = () => {
    switch (activeTab) {

      // ── DASHBOARD ──────────────────────────────────────────────────────────
      case 'overview': return (
        <div>
          <div className="page-header">
            <div>
              <h1 className="page-title">Dashboard</h1>
              <p className="page-subtitle">Platform overview — MRR, talent activity, audit trail, and agent console.</p>
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', background: 'var(--bg-tertiary)', border: '1px solid var(--border-glass)', borderRadius: '8px', padding: '6px 14px' }}>
              ● Live sync every 4s
            </div>
          </div>

          <div className="stats-card-grid" style={{ gridTemplateColumns: 'repeat(6, 1fr)' }}>
            {[
              { label: 'Total Talents', val: talents.length, sub: `${activeTalentCount} active`, color: 'var(--accent-cyan)' },
              { label: 'Gross MRR', val: formatCurrency(mrrTotal), sub: '25% EOR markup', color: 'var(--accent-green)' },
              { label: 'Active Contracts', val: contracts.filter(c => c.status === 'Signed' || c.status === 'Active').length, sub: 'Running now', color: 'var(--kongila-blue)' },
              { label: 'Open Requests', val: requests.filter(r => r.status === 'New Request').length, sub: `${requests.length} total`, color: 'var(--accent-gold)' },
              { label: 'Interviews', val: interviews.filter(iv => iv.status === 'Scheduled').length, sub: 'Scheduled', color: '#7C3AED' },
              { label: 'Support Tickets', val: supportTickets.filter(t => t.status === 'Open' || t.status === 'In Progress').length, sub: 'Open / Active', color: 'var(--accent-magenta)' },
            ].map(({ label, val, sub, color }) => (
              <GlassCard key={label}>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
                <div style={{ fontSize: '26px', fontWeight: 700, color, marginTop: '6px', letterSpacing: '-0.02em' }}>{val}</div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>{sub}</div>
              </GlassCard>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px', marginBottom: '24px' }}>
            <GlassCard>
              <h3 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '16px' }}>Master Audit Trail</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '320px', overflowY: 'auto' }}>
                {auditLogs.length === 0 ? (
                  <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>No audit entries yet.</p>
                ) : auditLogs.slice(0, 20).map(log => (
                  <div key={log.id} style={{ borderBottom: '1px solid var(--border-glass)', paddingBottom: '10px', display: 'flex', gap: '10px', fontSize: '12px' }}>
                    <span style={{ color: 'var(--kongila-blue)', fontWeight: 700, flexShrink: 0 }}>[{log.actor}]</span>
                    <div style={{ flexGrow: 1 }}>
                      <strong>{log.action}:</strong> {log.details}
                      <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>{formatDate(log.timestamp)}</div>
                    </div>
                  </div>
                ))}
              </div>
            </GlassCard>

            <div className="agent-terminal">
              <div className="terminal-header">
                <div className="terminal-dots"><div className="dot dot-red" /><div className="dot dot-yellow" /><div className="dot dot-green" /></div>
                <span style={{ fontSize: '10px', color: '#64748b', fontWeight: 700 }}>LIVE AGENT CONSOLE</span>
              </div>
              <div className="terminal-body">
                {agentLogs.length === 0 ? (
                  <div style={{ color: '#64748b', fontSize: '11px' }}>Awaiting agent activity...</div>
                ) : agentLogs.slice(0, 20).map(log => (
                  <div key={log.id} className="log-entry">
                    <span className="log-time">[{log.timestamp}]</span>
                    <div style={{ flexGrow: 1 }}>
                      <AgentBadge name={log.agentName} />
                      <span className={`log-text log-${log.type}`} style={{ marginLeft: '6px', fontSize: '11px' }}>{log.message}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <GlassCard>
            <h3 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '16px' }}>Quick Actions</h3>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
              {[
                { label: '+ New Contract', tab: 'contracts', action: () => { setActiveTab('contracts'); setShowContractModal(true); } },
                { label: '+ New Compliance Doc', tab: 'compliance', action: () => { setActiveTab('compliance'); setShowDocModal(true); } },
                { label: '+ New Assessment', tab: 'assessments', action: () => { setActiveTab('assessments'); setShowAssessmentModal(true); } },
                { label: 'View Hiring Requests', tab: 'hiring-requests', action: () => setActiveTab('hiring-requests') },
                { label: 'Support Center', tab: 'support', action: () => setActiveTab('support') },
              ].map(({ label, action }) => (
                <button key={label} onClick={action} className="btn-primary" style={{ height: '36px', padding: '0 16px', fontSize: '13px', borderRadius: '8px' }}>{label}</button>
              ))}
            </div>
          </GlassCard>
        </div>
      );

      // ── TALENT PIPELINE ────────────────────────────────────────────────────
      case 'talent-pipeline': return (
        <div>
          <div className="page-header">
            <div>
              <h1 className="page-title">Talent Pipeline</h1>
              <p className="page-subtitle">All registered talent — vetting status, grade, profiles, and details.</p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap', alignItems: 'center' }}>
            <input 
                  type="text" 
                  placeholder="Search by name, title, or tags..." 
                  value={talentSearchQuery} 
                  onChange={(e) => setTalentSearchQuery(e.target.value)}
                  style={{ padding: '8px 16px', borderRadius: '999px', border: '1px solid var(--border-glass)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', outline: 'none', minWidth: '250px', fontSize: '13px' }} 
                />
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {['All', 'Applied', 'Pending', 'Review', 'Vetted'].map(f => (
                    <button key={f} onClick={() => setTalentFilter(f)} style={{ padding: '6px 16px', borderRadius: '999px', border: `1px solid ${talentFilter === f ? 'var(--kongila-blue)' : 'var(--border-glass)'}`, background: talentFilter === f ? 'var(--kongila-blue-glow)' : 'var(--bg-secondary)', color: talentFilter === f ? 'var(--kongila-blue)' : 'var(--text-secondary)', fontWeight: talentFilter === f ? 600 : 400, fontSize: '13px', cursor: 'pointer', transition: 'all 0.2s' }}>{f}</button>
                  ))}
                </div>
                <span style={{ marginLeft: 'auto', fontSize: '12px', color: 'var(--text-muted)' }}>{filteredTalents.length} talent{filteredTalents.length !== 1 ? 's' : ''}</span>
              </div>
              <div className="table-container">
              <table className="custom-table">
                <thead>
                  <tr>
                    {['Talent', 'Title', 'Grade', 'Status', 'Exp', 'Rate/mo'].map(h => <th key={h}>{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {filteredTalents.length === 0 ? (
                    <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '32px' }}>No talent matching this filter.</td></tr>
                  ) : filteredTalents.map(t => (
                    <tr key={t.id} onClick={() => router.push(`/talents/${t.id}`)} style={{ cursor: 'pointer' }}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          {t.avatar ? <img src={t.avatar} alt="" style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} /> : <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', flexShrink: 0 }}>👤</div>}
                          <div>
                            <div style={{ fontWeight: 600, fontSize: '13px' }}>{t.name}</div>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{t.timezone}</div>
                          </div>
                        </div>
                      </td>
                      <td style={{ fontSize: '12px' }}>{t.title}</td>
                      <td><span style={{ fontWeight: 800, fontSize: '14px', color: getGradeColor(t.grade || '') }}>{t.grade || '—'}</span></td>
                      <td><Chip label={t.vettingStatus} /></td>
                      <td style={{ fontSize: '12px' }}>{t.experienceYears}y</td>
                      <td style={{ fontSize: '12px', fontWeight: 600 }}>{t.salaryExpectation ? formatCurrency(t.salaryExpectation) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
      );

      // ── CLIENT PIPELINE ────────────────────────────────────────────────────
      case 'client-pipeline': {
        const adminUsers = users.filter(u => u.role === 'admin' || u.role === 'ops_manager');
        return (
        <div>
          <div className="page-header" style={{ marginBottom: '24px' }}>
            <div>
              <h1 className="page-title">Client Management</h1>
              <p className="page-subtitle">All registered client organizations — contracts, requests, billing, and CRM.</p>
            </div>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button className="btn-secondary" style={{ padding: '8px 16px', borderRadius: '8px', fontSize: '13px' }}>Export CSV</button>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', alignItems: 'center' }}>
            <input 
                  type="text" 
                  placeholder="Search organizations..." 
                  value={clientSearchQuery} 
                  onChange={(e) => setClientSearchQuery(e.target.value)}
                  style={{ padding: '8px 16px', borderRadius: '999px', border: '1px solid var(--border-glass)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', outline: 'none', minWidth: '300px', fontSize: '13px' }} 
                />
            <select className="kongila-input" style={{ padding: '8px 16px', borderRadius: '999px', width: 'auto' }}>
              <option value="All">All Statuses</option>
              <option value="Active">Active</option>
              <option value="At Risk">At Risk</option>
              <option value="Inactive">Inactive</option>
            </select>
            <select className="kongila-input" style={{ padding: '8px 16px', borderRadius: '999px', width: 'auto' }}>
              <option value="All">All Account Managers</option>
              {adminUsers.map(u => (
                <option key={u.id} value={u.id}>{u.name || u.email}</option>
              ))}
            </select>
          </div>
          
          <GlassCard style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-glass)', background: 'var(--bg-tertiary)' }}>
                    <th style={{ padding: '16px', fontWeight: 600, color: 'var(--text-secondary)' }}>Organization</th>
                    <th style={{ padding: '16px', fontWeight: 600, color: 'var(--text-secondary)' }}>Contact</th>
                    <th style={{ padding: '16px', fontWeight: 600, color: 'var(--text-secondary)' }}>Account Manager</th>
                    <th style={{ padding: '16px', fontWeight: 600, color: 'var(--text-secondary)' }}>Active Hires</th>
                    <th style={{ padding: '16px', fontWeight: 600, color: 'var(--text-secondary)' }}>Monthly Rev.</th>
                    <th style={{ padding: '16px', fontWeight: 600, color: 'var(--text-secondary)' }}>Health</th>
                    <th style={{ padding: '16px', fontWeight: 600, color: 'var(--text-secondary)' }}>Last Activity</th>
                    <th style={{ padding: '16px', fontWeight: 600, color: 'var(--text-secondary)' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredOrganizations.map(org => {
                    const orgClients = clientProfiles.filter(cp => cp.organizationId === org.id);
                    const orgUserIds = orgClients.map(cp => cp.userId);
                    const orgContracts = contracts.filter(c => orgUserIds.includes(c.clientId) || c.clientName === org.name);
                    const activeContracts = orgContracts.filter(c => c.status === 'Signed' || c.status === 'Active');
                    const isAtRisk = org.status === 'At Risk' || (org.healthScore && org.healthScore < 75);
                    return (
                      <tr key={org.id} style={{ borderBottom: '1px solid var(--border-glass)' }}>
                        <td style={{ padding: '16px' }}>
                          <div style={{ fontWeight: 600 }}>{org.name}</div>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>ID: {org.id.split('-')[0]}...</div>
                        </td>
                        <td style={{ padding: '16px' }}>
                          <div>{org.contactEmail || 'N/A'}</div>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{org.contactPhone || ''}</div>
                        </td>
                        <td style={{ padding: '16px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: 'var(--bg-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px' }}>
                              {(org.accountManagerName || 'AM')[0]}
                            </div>
                            <span>{org.accountManagerName || 'Unassigned'}</span>
                          </div>
                        </td>
                        <td style={{ padding: '16px', fontWeight: 600, color: activeContracts.length > 0 ? 'var(--accent-green)' : 'var(--text-secondary)' }}>
                          {activeContracts.length}
                        </td>
                        <td style={{ padding: '16px', fontWeight: 600 }}>
                          {formatCurrency(org.monthlyRevenue || 0)}
                        </td>
                        <td style={{ padding: '16px' }}>
                          <span style={{ 
                            background: isAtRisk ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)', 
                            color: isAtRisk ? '#EF4444' : '#10B981', 
                            padding: '4px 10px', 
                            borderRadius: '999px', 
                            fontSize: '11px', 
                            fontWeight: 600 
                          }}>
                            {org.healthScore || 100} — {isAtRisk ? 'At Risk' : 'Healthy'}
                          </span>
                        </td>
                        <td style={{ padding: '16px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                          {formatDate(org.lastActivityAt || org.created_at)}
                        </td>
                        <td style={{ padding: '16px', textAlign: 'right' }}>
                          <button onClick={() => router.push(`/clients/${org.id}`)} className="btn-secondary" style={{ padding: '6px 12px', fontSize: '12px', borderRadius: '6px' }}>View CRM</button>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredOrganizations.length === 0 && (
                    <tr>
                      <td colSpan={8} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                        No client organizations matching criteria.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </GlassCard>
        </div>
        );
      }

      // ── SERVICE REQUESTS (KANBAN PIPELINE) ────────────────────────────────────────────────────
      case 'hiring-requests': {
        // Calculate SLA for a request
        const getSLA = (createdAt: string) => {
          const created = new Date(createdAt).getTime();
          const now = new Date().getTime();
          const hoursElapsed = (now - created) / (1000 * 60 * 60);
          return { hoursElapsed: hoursElapsed.toFixed(1), isBreached: hoursElapsed > 48, isAtRisk: hoursElapsed > 36 };
        };

        const urgentFilterActive = requestFilter === 'Urgent';

        const kanbanRequests = requests.filter(r => {
          const matchesSearch = r.serviceType?.toLowerCase().includes(requestSearchQuery.toLowerCase()) || r.clientName?.toLowerCase().includes(requestSearchQuery.toLowerCase());
          if (!matchesSearch) return false;
          if (urgentFilterActive) {
            const sla = getSLA(r.createdAt);
            return r.urgency === 'ASAP' || sla.isBreached || sla.isAtRisk;
          }
          return true;
        });

        const columns = ['New Request', 'Reviewing', 'Sourcing Talent', 'Candidates Ready', 'Client Interview', 'Offer Accepted'];

        return (
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
            <div className="page-header" style={{ marginBottom: '24px', flexShrink: 0 }}>
              <div>
                <h1 className="page-title">Service Requests Pipeline</h1>
                <p className="page-subtitle">Cross-client operational view. Prioritize by urgency and SLA.</p>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap', alignItems: 'center', flexShrink: 0 }}>
              <input 
                type="text" 
                placeholder="Search by role or client..." 
                value={requestSearchQuery} 
                onChange={(e) => setRequestSearchQuery(e.target.value)}
                style={{ padding: '8px 16px', borderRadius: '999px', border: '1px solid var(--border-glass)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', outline: 'none', minWidth: '250px', fontSize: '13px' }} 
              />
              <button 
                onClick={() => setRequestFilter(requestFilter === 'Urgent' ? 'All' : 'Urgent')} 
                style={{ 
                  padding: '8px 16px', borderRadius: '999px', 
                  border: `1px solid ${requestFilter === 'Urgent' ? '#EF4444' : 'var(--border-glass)'}`, 
                  background: requestFilter === 'Urgent' ? 'rgba(239, 68, 68, 0.1)' : 'var(--bg-secondary)', 
                  color: requestFilter === 'Urgent' ? '#EF4444' : 'var(--text-secondary)', 
                  fontWeight: requestFilter === 'Urgent' ? 600 : 400, 
                  fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' 
                }}>
                <span style={{ fontSize: '14px' }}>🚨</span> {requestFilter === 'Urgent' ? 'Viewing Urgent/Overdue' : 'Filter Urgent/Overdue'}
              </button>
            </div>

            <div style={{ display: 'flex', gap: '16px', overflowX: 'auto', paddingBottom: '16px', flex: 1 }}>
              {columns.map(colStatus => {
                const colRequests = kanbanRequests.filter(r => r.status === colStatus)
                  .sort((a, b) => {
                    // Sort by urgency first, then SLA elapsed
                    if (a.urgency === 'ASAP' && b.urgency !== 'ASAP') return -1;
                    if (b.urgency === 'ASAP' && a.urgency !== 'ASAP') return 1;
                    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
                  });

                return (
                  <div key={colStatus} style={{ minWidth: '320px', maxWidth: '320px', background: 'var(--bg-secondary)', borderRadius: '12px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px', border: '1px solid var(--border-glass)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <h3 style={{ fontSize: '14px', fontWeight: 600, margin: 0 }}>{colStatus}</h3>
                      <span style={{ background: 'var(--bg-tertiary)', padding: '2px 8px', borderRadius: '999px', fontSize: '11px', fontWeight: 600 }}>{colRequests.length}</span>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', overflowY: 'auto', flex: 1, paddingRight: '4px' }}>
                      {colRequests.length === 0 ? (
                        <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px', border: '1px dashed var(--border-glass)', borderRadius: '8px' }}>
                          No requests
                        </div>
                      ) : (
                        colRequests.map(req => {
                          const sla = getSLA(req.createdAt);
                          const isASAP = req.urgency === 'ASAP';
                          return (
                            <div 
                              key={req.id} 
                              onClick={() => router.push(`/requests/${req.id}`)}
                              style={{ 
                                background: 'var(--bg-primary)', 
                                border: `1px solid ${isASAP ? 'rgba(239, 68, 68, 0.5)' : 'var(--border-glass)'}`, 
                                borderRadius: '10px', 
                                padding: '14px', 
                                cursor: 'pointer', 
                                transition: 'transform 0.1s, box-shadow 0.1s',
                                boxShadow: isASAP ? '0 4px 12px rgba(239, 68, 68, 0.1)' : '0 2px 8px rgba(0,0,0,0.2)'
                              }}
                              onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
                              onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                            >
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                                <div style={{ fontSize: '13px', fontWeight: 700, lineHeight: 1.3, color: isASAP ? '#EF4444' : 'var(--text-primary)' }}>
                                  {isASAP && '🚩 '}{req.roleDescription?.substring(0, 40) || req.serviceType}
                                </div>
                              </div>
                              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '12px' }}>
                                {req.clientName || 'Unknown Client'}
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: 'var(--bg-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', fontWeight: 700, border: req.assignedAccountManagerId ? '1px solid var(--kongila-blue)' : '1px dashed var(--text-muted)' }}>
                                    {req.assignedAccountManagerId ? 'AM' : '?'}
                                  </div>
                                  <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: 'var(--bg-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', fontWeight: 700, border: req.assignedTalentManagerId ? '1px solid var(--accent-gold)' : '1px dashed var(--text-muted)' }}>
                                    {req.assignedTalentManagerId ? 'TM' : '?'}
                                  </div>
                                </div>
                                <div style={{ 
                                  fontSize: '10px', 
                                  fontWeight: 600, 
                                  padding: '2px 6px', 
                                  borderRadius: '4px',
                                  background: sla.isBreached ? 'rgba(239, 68, 68, 0.1)' : (sla.isAtRisk ? 'rgba(245, 158, 11, 0.1)' : 'rgba(16, 185, 129, 0.1)'),
                                  color: sla.isBreached ? '#EF4444' : (sla.isAtRisk ? '#F59E0B' : '#10B981')
                                }}>
                                  {sla.hoursElapsed}h
                                </div>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      }

      // ── INTERVIEWS ────────────────────────────────────────────────────────
      case 'interviews': return (
        <div>
          <div className="page-header">
            <div>
              <h1 className="page-title">Interviews</h1>
              <p className="page-subtitle">All interview sessions — scheduled, rescheduled, and completed.</p>
            </div>
          </div>
          <div className="stats-card-grid" style={{ marginBottom: '24px' }}>
            {[
              { label: 'Total', val: interviews.length, color: 'var(--kongila-blue)' },
              { label: 'Scheduled', val: interviews.filter(iv => iv.status === 'Scheduled').length, color: '#2563EB' },
              { label: 'Rescheduled', val: interviews.filter(iv => iv.status === 'Rescheduled').length, color: '#7C3AED' },
              { label: 'Completed', val: interviews.filter(iv => iv.status === 'Completed').length, color: 'var(--accent-green)' },
            ].map(({ label, val, color }) => (
              <GlassCard key={label}>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>{label}</div>
                <div style={{ fontSize: '28px', fontWeight: 700, color, marginTop: '6px' }}>{val}</div>
              </GlassCard>
            ))}
          </div>
          <GlassCard>
            <h3 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '16px' }}>All Interviews</h3>
            {interviews.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)' }}>
                <div style={{ fontSize: '40px', marginBottom: '10px' }}>📅</div>
                <p>No interviews yet. They appear here once clients book from their Scheduling module.</p>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table className="custom-table">
                  <thead><tr>{['Title', 'Candidate', 'Client', 'Date & Time', 'Status', 'Actions'].map(h => <th key={h}>{h}</th>)}</tr></thead>
                  <tbody>
                    {interviews.map(iv => (
                      <tr key={iv.id}>
                        <td>
                          <div style={{ fontWeight: 600, fontSize: '13px' }}>{iv.title}</div>
                          {iv.notes && <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{iv.notes.slice(0, 50)}{iv.notes.length > 50 ? '…' : ''}</div>}
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            {iv.talentAvatar && <img src={iv.talentAvatar} alt="" style={{ width: '28px', height: '28px', borderRadius: '50%', objectFit: 'cover' }} />}
                            <span style={{ fontSize: '13px', fontWeight: 600 }}>{iv.talentName}</span>
                          </div>
                        </td>
                        <td style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{iv.clientName || '—'}</td>
                        <td>
                          <div style={{ fontSize: '13px', fontWeight: 600 }}>{iv.date}</div>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{iv.time}</div>
                        </td>
                        <td><Chip label={iv.status} /></td>
                        <td>
                          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                            {iv.meetingLink && <a href={iv.meetingLink} target="_blank" rel="noreferrer" style={{ padding: '3px 8px', borderRadius: '6px', background: '#2563EB', color: '#fff', fontWeight: 600, fontSize: '10px', textDecoration: 'none' }}>Join</a>}
                            {iv.googleCalendarLink && <a href={iv.googleCalendarLink} target="_blank" rel="noreferrer" style={{ padding: '3px 8px', borderRadius: '6px', border: '1px solid var(--border-glass)', color: 'var(--text-secondary)', fontSize: '10px', textDecoration: 'none' }}>📅 Cal</a>}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </GlassCard>
        </div>
      );

      // ── VETTING ────────────────────────────────────────────────────────────
      case 'vetting': return (
        <div>
          <div className="page-header">
            <div>
              <h1 className="page-title">Talent Vetting Framework</h1>
              <p className="page-subtitle">7-stage pipeline — screen, assess, interview, and grade every applicant.</p>
            </div>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
              <input 
                type="text" 
                placeholder="Search by name, title, or tags..." 
                value={talentSearchQuery} 
                onChange={(e) => setTalentSearchQuery(e.target.value)}
                style={{ padding: '8px 16px', borderRadius: '999px', border: '1px solid var(--border-glass)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', outline: 'none', minWidth: '250px', fontSize: '13px' }} 
              />
              {(['All','Applied','Review','Vetted','Matched','Deployed'] as const).map(f => (
                <button key={f} onClick={() => setTalentFilter(f)} style={{
                  padding: '6px 14px', borderRadius: '20px', fontSize: '11px', fontWeight: 700, cursor: 'pointer',
                  background: talentFilter === f ? 'var(--kongila-blue)' : 'var(--bg-tertiary)',
                  color: talentFilter === f ? '#fff' : 'var(--text-secondary)',
                  border: `1px solid ${talentFilter === f ? 'var(--kongila-blue)' : 'var(--border-glass)'}`,
                  transition: 'all 0.2s'
                }}>{f}</button>
              ))}
            </div>
          </div>

          {!selectedTalent ? (
            /* ── LIST VIEW ─────────────────────────────────────────── */
            <div style={{ background: 'var(--bg-primary)', borderRadius: '12px', border: '1px solid var(--border-glass)', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: 'var(--bg-tertiary)', borderBottom: '1px solid var(--border-glass)' }}>
                    <th style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--text-secondary)' }}>Talent</th>
                    <th style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--text-secondary)' }}>Role</th>
                    <th style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--text-secondary)' }}>Status</th>
                    <th style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--text-secondary)' }}>Current Stage</th>
                    <th style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--text-secondary)' }}>Grade</th>
                    <th style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--text-secondary)', textAlign: 'right' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {talents.filter(t => talentFilter === 'All' || t.vettingStatus === talentFilter).map(t => {
                    const calc = calculateCompositeVettingGrade(t.vettingScores);
                    const pipeline = t.vettingPipeline || [];
                    let currentStageIdx = pipeline.findIndex(s => s.status !== 'passed');
                    if (currentStageIdx === -1 && pipeline.length > 0) currentStageIdx = pipeline.length - 1;
                    const currentStage = VETTING_STAGES[currentStageIdx >= 0 ? currentStageIdx : 0];
                    return (
                      <tr key={t.id} style={{ borderBottom: '1px solid var(--border-glass)', transition: 'background 0.2s', cursor: 'pointer' }} onClick={() => {
                        setSelectedTalent(t);
                        setActiveVettingStageIdx(null);
                        setStageNotesInput('');
                        setStageScoreInput(80);
                        setStageRubricScores({});
                      }}>
                        <td style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                          {t.avatar ? <img src={t.avatar} alt="" style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover' }} /> : <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>👤</div>}
                          <div>
                            <div style={{ fontWeight: 700 }}>{t.name}</div>
                            <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{t.email}</div>
                          </div>
                        </td>
                        <td style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>{t.title}</td>
                        <td style={{ padding: '12px 16px' }}><Chip label={t.vettingStatus} /></td>
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span>{currentStage?.icon}</span>
                            <span style={{ color: currentStage?.color, fontWeight: 600 }}>{currentStage?.name || t.vettingStage}</span>
                          </div>
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <span style={{ fontWeight: 800, color: getGradeColor(t.grade || '') }}>{t.grade || '—'}</span> {calc.score > 0 && <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>({calc.score}%)</span>}
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                          <button style={{ background: 'var(--kongila-blue)', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '6px', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}>Review & Vet →</button>
                        </td>
                      </tr>
                    )
                  })}
                  {talents.filter(t => talentFilter === 'All' || t.vettingStatus === talentFilter).length === 0 && (
                    <tr><td colSpan={6} style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>No applicants match this filter.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            /* ── DETAIL VIEW ───────────────────────────────────────── */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div>
                <button onClick={() => setSelectedTalent(null)} style={{ background: 'transparent', border: 'none', color: 'var(--kongila-blue)', cursor: 'pointer', fontSize: '13px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  ← Back to Pipeline List
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                
                {/* ── TOP: HORIZONTAL PROFILE HEADER ── */}
                <GlassCard style={{ padding: '24px', display: 'flex', flexWrap: 'wrap', gap: '24px', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
                    {selectedTalent.avatar
                      ? <img src={selectedTalent.avatar} alt="" style={{ width: '80px', height: '80px', borderRadius: '50%', objectFit: 'cover', border: `3px solid var(--border-glass)` }} />
                      : <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'var(--bg-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '32px' }}>👤</div>
                    }
                    <div>
                      <h2 style={{ fontSize: '20px', fontWeight: 800, margin: '0 0 4px 0' }}>{selectedTalent.name}</h2>
                      <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{selectedTalent.title}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>{selectedTalent.email}</div>
                      <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
                        <span style={{ fontSize: '11px', padding: '4px 10px', background: 'var(--bg-tertiary)', borderRadius: '20px', fontWeight: 600 }}>{selectedTalent.experienceYears} Years Exp.</span>
                        <span style={{ fontSize: '11px', padding: '4px 10px', background: 'var(--bg-tertiary)', borderRadius: '20px', fontWeight: 600 }}>${selectedTalent.salaryExpectation}/mo</span>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'flex-end' }}>
                      <button onClick={() => router.push(`/talents/${selectedTalent.id}?return=vetting`)} style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid var(--kongila-blue)', background: 'var(--kongila-blue)', color: '#fff', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}>Open Full Profile</button>
                      {selectedTalent.cvUrl && (
                        <a href={selectedTalent.cvUrl} target="_blank" rel="noopener noreferrer" style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid var(--kongila-blue)', background: 'var(--kongila-blue-glow)', color: 'var(--kongila-blue)', fontSize: '11px', fontWeight: 700, cursor: 'pointer', textDecoration: 'none' }}>View Resume / CV</a>
                      )}
                      {selectedTalent.portfolioUrl && (
                        <a href={selectedTalent.portfolioUrl} target="_blank" rel="noopener noreferrer" style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid var(--border-glass)', background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', fontSize: '11px', fontWeight: 700, cursor: 'pointer', textDecoration: 'none' }}>Open Portfolio</a>
                      )}
                    </div>

                    <div style={{ height: '60px', width: '1px', background: 'var(--border-glass)' }}></div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                      <div style={{
                        width: '70px', height: '70px', borderRadius: '50%',
                        background: `conic-gradient(${getGradeColor(selectedTalent.grade)} ${calculateCompositeVettingGrade(selectedTalent.vettingScores).score * 3.6}deg, var(--border-glass) 0deg)`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'var(--bg-card)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                          <span style={{ fontSize: '18px', fontWeight: 800, color: getGradeColor(selectedTalent.grade) }}>
                            {calculateCompositeVettingGrade(selectedTalent.vettingScores).score}
                          </span>
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: '18px', fontWeight: 900, color: getGradeColor(selectedTalent.grade), marginBottom: '2px' }}>
                          {selectedTalent.grade === 'A+' ? '⭐ A+' : selectedTalent.grade === 'A' ? '🏆 A' : selectedTalent.grade === 'B' ? '📈 B' : 'Ungraded'}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{selectedTalent.vettingStatus}</div>
                      </div>
                    </div>
                  </div>
                </GlassCard>

                {/* ── MIDDLE: ACTIVE VETTING STEP ── */}
                <div>
                  {(() => {
                    const pipeline: any[] = selectedTalent.vettingPipeline || [];
                    const currentStageIdx = pipeline.findIndex((s: any) => s.status !== 'passed' && s.status !== 'skipped' && s.status !== 'failed');
                    const activeIdx = currentStageIdx === -1 && pipeline.length > 0 ? VETTING_STAGES.length : (currentStageIdx === -1 ? 0 : currentStageIdx);

                    if (activeIdx >= VETTING_STAGES.length) {
                      return (
                        <GlassCard style={{ textAlign: 'center', padding: '40px', background: '#10B98110', borderColor: '#10B98140' }}>
                          <div style={{ fontSize: '48px', marginBottom: '16px' }}>🎉</div>
                          <h3 style={{ fontSize: '24px', color: '#10B981', fontWeight: 800, marginBottom: '8px' }}>Vetting Complete!</h3>
                          <p style={{ color: 'var(--text-secondary)' }}>All required stages have been passed. This talent is ready for matching.</p>
                        </GlassCard>
                      );
                    }

                    const stageMeta = VETTING_STAGES[activeIdx];
                    const stageRecord: any = pipeline[activeIdx] || { status: 'in_progress' };
                    const actType = stageMeta.activityType;

                    // Determine sub-state within stage
                    const assessmentAssigned = actType === 'assign_assessment' && !!stageRecord.assessmentId;
                    // Check both stageRecord.assessmentScore AND the skillAssessmentResults collection
                    const submittedResult = assessmentAssigned
                      ? assessmentResults.find((r: any) =>
                          r.assessmentId === stageRecord.assessmentId &&
                          (r.talentId === selectedTalent.id || r.talentSkillAssessmentId)
                        )
                      : null;
                    // Merge submitted result score into stageRecord if available
                    if (submittedResult && stageRecord.assessmentScore == null) {
                      stageRecord.assessmentScore = submittedResult.autoScore ?? submittedResult.score ?? null;
                    }
                    const assessmentResultReceived = assessmentAssigned && stageRecord.assessmentScore != null;
                    const interviewScheduled = actType === 'schedule_interview' && !!stageRecord.interviewId;
                    const personalitySent = actType === 'send_personality' && !!stageRecord.personalityLink;
                    const personalityResultReceived = personalitySent && stageRecord.personalityScore != null;
                    const uploadedDocs = getTalentUploadedDocuments(selectedTalent);

                    return (
                      <GlassCard style={{ padding: '0', overflow: 'hidden', border: `2px solid ${stageMeta.color}80`, background: `${stageMeta.color}05` }}>
                        {/* Stage Header */}
                        <div style={{ background: `${stageMeta.color}15`, padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `1px solid ${stageMeta.color}30` }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                            <div style={{ fontSize: '28px' }}>{stageMeta.icon}</div>
                            <div>
                              <div style={{ fontSize: '11px', color: stageMeta.color, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                                Active Step — Stage {activeIdx + 1} of {VETTING_STAGES.length}
                              </div>
                              <h3 style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-primary)', margin: '4px 0 0 0' }}>{stageMeta.name}</h3>
                            </div>
                          </div>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)', background: 'var(--bg-tertiary)', padding: '4px 10px', borderRadius: '20px', fontWeight: 600 }}>
                            {stageMeta.responsible}
                          </div>
                        </div>

                        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
                          {/* Stage description */}
                          <div style={{ fontSize: '13px', color: 'var(--text-secondary)', background: 'var(--bg-tertiary)', padding: '12px 16px', borderRadius: '8px', borderLeft: `3px solid ${stageMeta.color}` }}>
                            {stageMeta.description}
                          </div>

                          {/* ── STAGE 0: Application Screening ── No score */}
                          {actType === 'profile_review' && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                {[
                                  { label: 'Skills', value: Array.isArray(selectedTalent.skills) ? selectedTalent.skills.slice(0, 4).join(', ') || 'N/A' : selectedTalent.skills || 'N/A' },
                                  { label: 'Experience', value: selectedTalent.experienceYears ? `${selectedTalent.experienceYears} years` : 'N/A' },
                                  { label: 'Availability', value: selectedTalent.availability ? `${selectedTalent.availability}%` : 'N/A' },
                                  { label: 'Salary Expectation', value: selectedTalent.salaryExpectation ? `${selectedTalent.currency || 'USD'} ${Number(selectedTalent.salaryExpectation).toLocaleString()}/mo` : 'N/A' },
                                  { label: 'Location', value: [selectedTalent.city, selectedTalent.country].filter(Boolean).join(', ') || 'N/A' },
                                  { label: 'Documents', value: uploadedDocs.length ? `${uploadedDocs.length} uploaded` : 'None uploaded' },
                                ].map((row, i) => (
                                  <div key={i} style={{ background: 'var(--bg-tertiary)', borderRadius: '8px', padding: '10px 14px' }}>
                                    <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 700, marginBottom: '4px', textTransform: 'uppercase' }}>{row.label}</div>
                                    <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>{row.value}</div>
                                  </div>
                                ))}
                              </div>
                              {uploadedDocs.length > 0 && (
                                <div style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-glass)', borderRadius: '10px', padding: '14px' }}>
                                  <div style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '10px' }}>Uploaded Documents</div>
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    {uploadedDocs.map((doc: any) => {
                                      const fileUrl = getFileUrl(doc);
                                      return (
                                        <div key={doc.id || fileUrl || doc.name} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', background: 'var(--bg-primary)', border: '1px solid var(--border-glass)', borderRadius: '8px' }}>
                                          <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{doc.name}</div>
                                            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{doc.category || doc.type || 'Document'}{doc.fileSize ? ` · ${doc.fileSize}` : ''}</div>
                                          </div>
                                          {fileUrl ? (
                                            <>
                                              <a href={fileUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: '11px', fontWeight: 800, color: 'var(--kongila-blue)', textDecoration: 'none' }}>View</a>
                                              <a href={fileUrl} download style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-secondary)', textDecoration: 'none' }}>Download</a>
                                            </>
                                          ) : (
                                            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>No file URL</span>
                                          )}
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}
                              <div>
                                <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '8px', display: 'block' }}>Screening Notes</label>
                                <textarea value={stageNotesInput} onChange={e => setStageNotesInput(e.target.value)} placeholder="Add profile review observations..." rows={3} className="form-input" style={{ width: '100%', resize: 'none', fontSize: '14px', padding: '12px' }} />
                              </div>
                              <div style={{ display: 'flex', gap: '12px' }}>
                                <button disabled={saving} onClick={() => handleStageDecision(0, 'Proceed', undefined, stageNotesInput)} style={{ flex: 2, padding: '14px', borderRadius: '10px', border: 'none', cursor: 'pointer', background: '#10B981', color: '#fff', fontSize: '14px', fontWeight: 800, boxShadow: '0 4px 12px rgba(16,185,129,0.3)', opacity: saving ? 0.6 : 1 }}>
                                  ✅ Profile Approved — Proceed to Skill Assessment
                                </button>
                                <button disabled={saving} onClick={() => handleStageDecision(0, 'Reject', undefined, stageNotesInput, true)} style={{ flex: 1, padding: '14px', borderRadius: '10px', border: '1px solid #EF4444', cursor: 'pointer', background: '#EF444415', color: '#EF4444', fontSize: '14px', fontWeight: 800, opacity: saving ? 0.6 : 1 }}>
                                  ❌ Reject
                                </button>
                              </div>
                            </div>
                          )}

                          {/* ── STAGE 1: Skill Assessment ── Assign → Wait for result → Score override → Mark done */}
                          {actType === 'assign_assessment' && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                              {!assessmentAssigned ? (
                                <>
                                  <div>
                                    <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '8px', display: 'block' }}>Select Assessment to Assign</label>
                                    <select value={stageAssessmentId} onChange={e => setStageAssessmentId(e.target.value)} className="form-input" style={{ width: '100%', fontSize: '14px', padding: '12px' }}>
                                      <option value="">-- Select Role-based Assessment --</option>
                                      {skillAssessments.map((sa: any) => <option key={sa.id} value={sa.id}>{sa.title} ({sa.total_time_limit_minutes || 0}m)</option>)}
                                    </select>
                                  </div>
                                  <div>
                                    <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '8px', display: 'block' }}>Deadline for Submission</label>
                                    <input type="date" value={stageDeadlineInput} onChange={e => setStageDeadlineInput(e.target.value)} className="form-input" style={{ width: '100%', fontSize: '14px', padding: '12px' }} />
                                  </div>
                                  <div>
                                    <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '8px', display: 'block' }}>Notes to Candidate</label>
                                    <textarea value={stageNotesInput} onChange={e => setStageNotesInput(e.target.value)} placeholder="Optional message included in the notification email..." rows={2} className="form-input" style={{ width: '100%', resize: 'none', fontSize: '14px', padding: '12px' }} />
                                  </div>
                                  <div style={{ display: 'flex', gap: '12px' }}>
                                    <button disabled={saving || !stageAssessmentId} onClick={() => handleStageDecision(1, 'Assign', undefined, stageNotesInput)} style={{ flex: 2, padding: '14px', borderRadius: '10px', border: 'none', cursor: !stageAssessmentId ? 'not-allowed' : 'pointer', background: !stageAssessmentId ? '#94A3B8' : 'var(--kongila-blue)', color: '#fff', fontSize: '14px', fontWeight: 800, opacity: saving ? 0.6 : 1 }}>
                                      📋 Assign Assessment & Notify Candidate
                                    </button>
                                    <button disabled={saving} onClick={() => handleStageDecision(1, 'Reject', undefined, stageNotesInput)} style={{ flex: 1, padding: '14px', borderRadius: '10px', border: '1px solid #EF4444', cursor: 'pointer', background: '#EF444415', color: '#EF4444', fontSize: '14px', fontWeight: 800, opacity: saving ? 0.6 : 1 }}>❌ Reject</button>
                                  </div>
                                </>
                              ) : !assessmentResultReceived ? (
                                <div style={{ textAlign: 'center', padding: '32px 24px', background: 'var(--bg-tertiary)', borderRadius: '12px', border: '1px dashed var(--border-glass)' }}>
                                  <div style={{ fontSize: '36px', marginBottom: '12px' }}>⏳</div>
                                  <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '6px' }}>Assessment Assigned — Awaiting Candidate Submission</div>
                                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '20px' }}>The candidate has been notified. Results will appear here automatically once they complete the assessment.{stageRecord.deadline && ` Deadline: ${new Date(stageRecord.deadline).toLocaleDateString()}.`}</div>
                                  <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
                                    <button disabled={saving} onClick={() => handleStageDecision(1, 'Proceed', stageScoreInput, 'Admin manually marked assessment as complete.')} style={{ padding: '10px 20px', borderRadius: '8px', border: 'none', cursor: 'pointer', background: '#10B981', color: '#fff', fontSize: '13px', fontWeight: 700 }}>
                                      ✅ Mark Complete Manually
                                    </button>
                                    <button disabled={saving} onClick={() => handleStageDecision(1, 'Reject', undefined, stageNotesInput)} style={{ padding: '10px 20px', borderRadius: '8px', border: '1px solid #EF4444', cursor: 'pointer', background: 'transparent', color: '#EF4444', fontSize: '13px', fontWeight: 700 }}>❌ Reject Talent</button>
                                  </div>
                                </div>
                              ) : (
                                <>
                                  <div style={{ background: '#10B98110', borderRadius: '10px', padding: '16px', border: '1px solid #10B98130' }}>
                                    <div style={{ fontSize: '12px', fontWeight: 700, color: '#10B981', marginBottom: '8px' }}>📊 Assessment Submitted</div>
                                    {stageRecord.assessmentScore != null ? (
                                      <>
                                        <div style={{ fontSize: '28px', fontWeight: 900, color: 'var(--text-primary)' }}>{stageRecord.assessmentScore}%</div>
                                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>Auto-scored from MCQ answers.</div>
                                      </>
                                    ) : (
                                      <div style={{ fontSize: '13px', color: '#F59E0B', fontWeight: 700 }}>📝 No MCQ — written answers require manual grading below.</div>
                                    )}
                                    {submittedResult?.timeTakenSeconds && (
                                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '6px' }}>
                                        ⏱️ Time taken: {Math.floor(submittedResult.timeTakenSeconds / 60)}m {submittedResult.timeTakenSeconds % 60}s
                                        {submittedResult.autoSubmitted && <span style={{ color: '#EF4444', fontWeight: 700 }}> — Auto-submitted (time expired)</span>}
                                      </div>
                                    )}
                                  </div>

                                  {/* Subjective answers for admin review */}
                                  {submittedResult?.hasSubjective && submittedResult.subjectiveAnswers && Object.keys(submittedResult.subjectiveAnswers).length > 0 && (
                                    <div style={{ background: 'var(--bg-tertiary)', borderRadius: '10px', padding: '16px', border: '1px solid var(--border-glass)' }}>
                                      <div style={{ fontSize: '12px', fontWeight: 700, color: '#8B5CF6', marginBottom: '12px' }}>📝 Written Answers — Requires Manual Grading</div>
                                      {Object.entries(submittedResult.subjectiveAnswers).map(([qId, answer]: [string, any]) => (
                                        <div key={qId} style={{ marginBottom: '12px', paddingBottom: '12px', borderBottom: '1px solid var(--border-glass)' }}>
                                          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px', fontFamily: 'monospace' }}>Q: {qId}</div>
                                          <div style={{ fontSize: '13px', color: 'var(--text-primary)', background: 'var(--bg-primary)', padding: '10px', borderRadius: '6px', border: '1px solid var(--border-glass)' }}>
                                            {answer || <em style={{ color: 'var(--text-muted)' }}>No answer provided</em>}
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  )}

                                  <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
                                    <button disabled={saving} onClick={() => handleStageDecision(1, 'Proceed', stageRecord.assessmentScore, stageNotesInput)} style={{ flex: 2, padding: '14px', borderRadius: '10px', border: 'none', cursor: 'pointer', background: '#10B981', color: '#fff', fontSize: '14px', fontWeight: 800 }}>✅ Confirm Score & Move to Interview</button>
                                    <button disabled={saving} onClick={() => handleStageDecision(1, 'Reject', stageRecord.assessmentScore, stageNotesInput)} style={{ flex: 1, padding: '14px', borderRadius: '10px', border: '1px solid #EF4444', cursor: 'pointer', background: '#EF444415', color: '#EF4444', fontSize: '14px', fontWeight: 800 }}>❌ Reject</button>
                                  </div>
                                </>
                              )}
                            </div>
                          )}

                          {/* ── STAGE 2: Behavioural Interview ── Schedule → Enter rubric scores → Mark done */}
                          {actType === 'schedule_interview' && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                              {!interviewScheduled ? (
                                <>
                                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                    <div>
                                      <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '8px', display: 'block' }}>Interview Date</label>
                                      <input type="date" value={stageInterviewDate} onChange={e => setStageInterviewDate(e.target.value)} className="form-input" style={{ width: '100%', fontSize: '14px', padding: '12px' }} />
                                    </div>
                                    <div>
                                      <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '8px', display: 'block' }}>Interview Time</label>
                                      <input type="time" value={stageInterviewTime} onChange={e => setStageInterviewTime(e.target.value)} className="form-input" style={{ width: '100%', fontSize: '14px', padding: '12px' }} />
                                    </div>
                                    <div style={{ gridColumn: '1 / -1' }}>
                                      <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '8px', display: 'block' }}>Video Meeting Link</label>
                                      <input type="url" value={stageInterviewLink} onChange={e => setStageInterviewLink(e.target.value)} placeholder="https://meet.google.com/..." className="form-input" style={{ width: '100%', fontSize: '14px', padding: '12px' }} />
                                    </div>
                                  </div>
                                  <div style={{ display: 'flex', gap: '12px' }}>
                                    <button disabled={saving || !stageInterviewDate || !stageInterviewTime} onClick={() => handleStageDecision(2, 'Assign', undefined, stageNotesInput)} style={{ flex: 2, padding: '14px', borderRadius: '10px', border: 'none', cursor: !stageInterviewDate || !stageInterviewTime ? 'not-allowed' : 'pointer', background: !stageInterviewDate || !stageInterviewTime ? '#94A3B8' : 'var(--kongila-blue)', color: '#fff', fontSize: '14px', fontWeight: 800, opacity: saving ? 0.6 : 1 }}>
                                      📅 Schedule Interview & Notify Candidate
                                    </button>
                                    <button disabled={saving} onClick={() => handleStageDecision(2, 'Reject', undefined, stageNotesInput)} style={{ flex: 1, padding: '14px', borderRadius: '10px', border: '1px solid #EF4444', cursor: 'pointer', background: '#EF444415', color: '#EF4444', fontSize: '14px', fontWeight: 800, opacity: saving ? 0.6 : 1 }}>❌ Reject</button>
                                  </div>
                                </>
                              ) : (
                                <>
                                  {stageRecord.rescheduleRequested && (
                                    <div style={{ background: '#FEF3C7', padding: '16px', borderRadius: '10px', border: '1px solid #F59E0B', marginBottom: '16px' }}>
                                      <div style={{ fontSize: '12px', fontWeight: 800, color: '#D97706', marginBottom: '6px' }}>⚠️ Reschedule Requested by Candidate</div>
                                      <div style={{ fontSize: '13px', color: '#92400E', marginBottom: '12px' }}>Reason / Preferred Time: <strong>{stageRecord.rescheduleReason}</strong></div>
                                      
                                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                        <div>
                                          <label style={{ fontSize: '12px', fontWeight: 700, color: '#92400E', marginBottom: '8px', display: 'block' }}>New Interview Date</label>
                                          <input type="date" value={stageInterviewDate} onChange={e => setStageInterviewDate(e.target.value)} className="form-input" style={{ width: '100%', fontSize: '14px', padding: '10px', borderColor: '#FCD34D', background: '#FFFBEB' }} />
                                        </div>
                                        <div>
                                          <label style={{ fontSize: '12px', fontWeight: 700, color: '#92400E', marginBottom: '8px', display: 'block' }}>New Interview Time</label>
                                          <input type="time" value={stageInterviewTime} onChange={e => setStageInterviewTime(e.target.value)} className="form-input" style={{ width: '100%', fontSize: '14px', padding: '10px', borderColor: '#FCD34D', background: '#FFFBEB' }} />
                                        </div>
                                        <div style={{ gridColumn: '1 / -1' }}>
                                          <label style={{ fontSize: '12px', fontWeight: 700, color: '#92400E', marginBottom: '8px', display: 'block' }}>Meeting Link</label>
                                          <input type="url" value={stageInterviewLink} onChange={e => setStageInterviewLink(e.target.value)} placeholder="https://meet.google.com/..." className="form-input" style={{ width: '100%', fontSize: '14px', padding: '10px', borderColor: '#FCD34D', background: '#FFFBEB' }} />
                                        </div>
                                      </div>
                                      <div style={{ marginTop: '12px' }}>
                                        <button disabled={saving || !stageInterviewDate || !stageInterviewTime} onClick={() => handleStageDecision(2, 'Assign', undefined, stageNotesInput)} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: 'none', cursor: !stageInterviewDate || !stageInterviewTime ? 'not-allowed' : 'pointer', background: '#F59E0B', color: '#fff', fontSize: '13px', fontWeight: 800 }}>
                                          🔄 Reschedule & Notify Candidate
                                        </button>
                                      </div>
                                    </div>
                                  )}
                                  
                                  <div style={{ background: '#8B5CF610', borderRadius: '10px', padding: '16px', border: '1px solid #8B5CF630', display: 'flex', gap: '16px', alignItems: 'center', marginBottom: '16px' }}>
                                    <div style={{ fontSize: '28px' }}>📅</div>
                                    <div>
                                      <div style={{ fontSize: '12px', fontWeight: 700, color: '#8B5CF6', marginBottom: '4px' }}>Interview Scheduled</div>
                                      <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>{stageRecord.interviewDate} at {stageRecord.interviewTime}</div>
                                      {stageRecord.meetingLink && <a href={stageRecord.meetingLink} target="_blank" rel="noopener noreferrer" style={{ fontSize: '12px', color: '#8B5CF6', textDecoration: 'none', fontWeight: 600 }}>🔗 Join Meeting</a>}
                                    </div>
                                  </div>
                                  <div>
                                    <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '12px' }}>Interview Rubric Scores (enter after interview)</div>
                                    {[
                                      { key: 'communication', label: 'Communication & Clarity', hint: 'Fluency, articulation, listening' },
                                      { key: 'behavioral', label: 'Behavioural Competencies', hint: 'STAR responses, problem-solving' },
                                      { key: 'cultural', label: 'Cultural Fit & Attitude', hint: 'Values, collaboration, initiative' },
                                      { key: 'technical', label: 'Domain Knowledge', hint: 'Role-specific expertise depth' },
                                    ].map(rubric => (
                                      <div key={rubric.key} style={{ marginBottom: '14px' }}>
                                        <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                                          <span>{rubric.label} <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>— {rubric.hint}</span></span>
                                        </label>
                                        <input type="number" min="0" max="100" value={stageRubricScores[rubric.key] !== undefined ? stageRubricScores[rubric.key] : ''} onChange={e => {
                                          const val = parseInt(e.target.value) || 0;
                                          const newScores = { ...stageRubricScores, [rubric.key]: val };
                                          setStageRubricScores(newScores);
                                          
                                          // Auto-calculate average for the overall stage score
                                          const keys = ['communication', 'behavioral', 'cultural', 'technical'];
                                          let total = 0;
                                          let count = 0;
                                          keys.forEach(k => {
                                            if (newScores[k] !== undefined) {
                                              total += newScores[k];
                                              count++;
                                            }
                                          });
                                          if (count > 0) setStageScoreInput(Math.round(total / count));
                                        }} className="form-input" style={{ width: '100%', fontSize: '14px' }} placeholder="0-100" />
                                      </div>
                                    ))}
                                  </div>
                                  <div>
                                    <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '8px', display: 'block' }}>Interview Notes & Feedback</label>
                                    <textarea value={stageNotesInput} onChange={e => setStageNotesInput(e.target.value)} placeholder="Summarise interview performance, strengths, concerns..." rows={3} className="form-input" style={{ width: '100%', resize: 'none', fontSize: '14px', padding: '12px' }} />
                                  </div>
                                  <div style={{ display: 'flex', gap: '12px' }}>
                                    <button disabled={saving} onClick={() => handleStageDecision(2, 'Proceed', stageScoreInput, stageNotesInput)} style={{ flex: 2, padding: '14px', borderRadius: '10px', border: 'none', cursor: 'pointer', background: '#10B981', color: '#fff', fontSize: '14px', fontWeight: 800 }}>✅ Interview Done — Move to Personality Test</button>
                                    <button disabled={saving} onClick={() => handleStageDecision(2, 'Reject', stageScoreInput, stageNotesInput)} style={{ flex: 1, padding: '14px', borderRadius: '10px', border: '1px solid #EF4444', cursor: 'pointer', background: '#EF444415', color: '#EF4444', fontSize: '14px', fontWeight: 800 }}>❌ Reject</button>
                                  </div>
                                </>
                              )}
                            </div>
                          )}

                          {/* ── STAGE 3: Personality Test ── Send link → Waiting for system result */}
                          {actType === 'send_personality' && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                              {!personalitySent ? (
                                <>
                                  <div>
                                    <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '8px', display: 'block' }}>Personality Test Link</label>
                                    <input type="url" value={stagePersonalityLink} onChange={e => setStagePersonalityLink(e.target.value)} placeholder="https://personality-provider.com/test?ref=..." className="form-input" style={{ width: '100%', fontSize: '14px', padding: '12px' }} />
                                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '6px' }}>The candidate will see this link in their dashboard and receive an email notification.</div>
                                  </div>
                                  <div style={{ display: 'flex', gap: '12px' }}>
                                    <button disabled={saving || !stagePersonalityLink} onClick={() => handleStageDecision(3, 'Assign', undefined, stageNotesInput)} style={{ flex: 2, padding: '14px', borderRadius: '10px', border: 'none', cursor: !stagePersonalityLink ? 'not-allowed' : 'pointer', background: !stagePersonalityLink ? '#94A3B8' : '#10B981', color: '#fff', fontSize: '14px', fontWeight: 800, opacity: saving ? 0.6 : 1 }}>
                                      🔗 Send Personality Test Link to Candidate
                                    </button>
                                    <button disabled={saving} onClick={() => handleStageDecision(3, 'Reject', undefined, stageNotesInput)} style={{ flex: 1, padding: '14px', borderRadius: '10px', border: '1px solid #EF4444', cursor: 'pointer', background: '#EF444415', color: '#EF4444', fontSize: '14px', fontWeight: 800 }}>❌ Reject</button>
                                  </div>
                                </>
                              ) : !personalityResultReceived ? (
                                <div style={{ textAlign: 'center', padding: '32px 24px', background: 'var(--bg-tertiary)', borderRadius: '12px', border: '1px dashed var(--border-glass)' }}>
                                  <div style={{ fontSize: '36px', marginBottom: '12px' }}>⏳</div>
                                  <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '6px' }}>Test Link Sent — Awaiting Candidate Completion</div>
                                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '20px' }}>The candidate can see this test in their dashboard. This stage will auto-advance when the provider sends results.</div>
                                  <a href={stageRecord.personalityLink} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-block', background: '#10B981', color: '#fff', padding: '10px 20px', borderRadius: '8px', textDecoration: 'none', fontSize: '13px', fontWeight: 700, marginRight: '12px' }}>
                                    🔗 View Test Link
                                  </a>
                                  <button disabled={saving} onClick={() => handleStageDecision(3, 'Proceed', stageScoreInput, 'Results received manually.')} style={{ padding: '10px 20px', borderRadius: '8px', border: '1px solid #10B981', cursor: 'pointer', background: 'transparent', color: '#10B981', fontSize: '13px', fontWeight: 700 }}>
                                    ✅ Mark Result Received
                                  </button>
                                </div>
                              ) : (
                                <div style={{ display: 'flex', gap: '12px' }}>
                                  <button disabled={saving} onClick={() => handleStageDecision(3, 'Proceed', stageRecord.personalityScore, stageNotesInput)} style={{ flex: 2, padding: '14px', borderRadius: '10px', border: 'none', cursor: 'pointer', background: '#10B981', color: '#fff', fontSize: '14px', fontWeight: 800 }}>✅ Results Received — Move to Remote Readiness</button>
                                  <button disabled={saving} onClick={() => handleStageDecision(3, 'Reject', undefined, stageNotesInput)} style={{ flex: 1, padding: '14px', borderRadius: '10px', border: '1px solid #EF4444', cursor: 'pointer', background: '#EF444415', color: '#EF4444', fontSize: '14px', fontWeight: 800 }}>❌ Reject</button>
                                </div>
                              )}
                            </div>
                          )}

                          {/* ── STAGE 4: Remote Readiness ── Checklist + score */}
                          {actType === 'remote_readiness' && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                              <div>
                                <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '12px' }}>Remote Readiness Checklist</div>
                                {[
                                  { label: 'Stable Internet Connection (≥10 Mbps)', key: 'internet' },
                                  { label: 'Adequate Laptop / Desktop Hardware', key: 'hardware' },
                                  { label: 'Power Backup (UPS / Generator)', key: 'power' },
                                  { label: 'Quiet, Professional Workspace', key: 'workspace' },
                                  { label: 'Communication Tools Installed (Slack, Zoom, etc.)', key: 'comms' },
                                  { label: 'Available for Overlap Hours', key: 'hours' },
                                ].map((item, i) => (
                                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 0', borderBottom: i < 5 ? '1px solid var(--border-glass)' : 'none' }}>
                                    <input type="checkbox" id={`rr_${item.key}`} style={{ width: '16px', height: '16px', accentColor: '#F59E0B' }} />
                                    <label htmlFor={`rr_${item.key}`} style={{ fontSize: '13px', color: 'var(--text-secondary)', cursor: 'pointer' }}>{item.label}</label>
                                  </div>
                                ))}
                              </div>
                              <div>
                                <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                  <span>Remote Readiness Score (0–100)</span>
                                </label>
                                <input type="number" min="0" max="100" value={stageScoreInput} onChange={e => setStageScoreInput(parseInt(e.target.value) || 0)} className="form-input" style={{ width: '100%', fontSize: '14px' }} placeholder="0-100" />
                              </div>
                              <div>
                                <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '8px', display: 'block' }}>Notes</label>
                                <textarea value={stageNotesInput} onChange={e => setStageNotesInput(e.target.value)} placeholder="Note any concerns about remote readiness..." rows={3} className="form-input" style={{ width: '100%', resize: 'none', fontSize: '14px', padding: '12px' }} />
                              </div>
                              <div style={{ display: 'flex', gap: '12px' }}>
                                <button disabled={saving} onClick={() => handleStageDecision(4, 'Proceed', stageScoreInput, stageNotesInput)} style={{ flex: 2, padding: '14px', borderRadius: '10px', border: 'none', cursor: 'pointer', background: '#10B981', color: '#fff', fontSize: '14px', fontWeight: 800 }}>✅ Remote Ready — Move to Work Simulation</button>
                                <button disabled={saving} onClick={() => handleStageDecision(4, 'Reject', stageScoreInput, stageNotesInput)} style={{ flex: 1, padding: '14px', borderRadius: '10px', border: '1px solid #EF4444', cursor: 'pointer', background: '#EF444415', color: '#EF4444', fontSize: '14px', fontWeight: 800 }}>❌ Reject</button>
                              </div>
                            </div>
                          )}

                          {/* ── STAGE 5: Work Simulation ── Assign task → Wait for submission → Score → Mark done */}
                          {actType === 'assign_task' && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                              {!stageRecord.taskId ? (
                                <>
                                  <div>
                                    <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '8px', display: 'block' }}>Task Title</label>
                                    <input type="text" value={stageTaskTitle} onChange={e => setStageTaskTitle(e.target.value)} placeholder="e.g. Build a REST API for User Management" className="form-input" style={{ width: '100%', fontSize: '14px', padding: '12px' }} />
                                  </div>
                                  <div>
                                    <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '8px', display: 'block' }}>Task Requirements</label>
                                    <textarea value={stageTaskDescription} onChange={e => setStageTaskDescription(e.target.value)} placeholder="Describe what the candidate must build, deliver, or demonstrate..." rows={4} className="form-input" style={{ width: '100%', resize: 'none', fontSize: '14px', padding: '12px' }} />
                                  </div>
                                  <div>
                                    <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '8px', display: 'block' }}>Submission Deadline</label>
                                    <input type="date" value={stageDeadlineInput} onChange={e => setStageDeadlineInput(e.target.value)} className="form-input" style={{ width: '100%', fontSize: '14px', padding: '12px' }} />
                                  </div>
                                  <div style={{ display: 'flex', gap: '12px' }}>
                                    <button disabled={saving || !stageTaskTitle} onClick={() => handleStageDecision(5, 'Assign', undefined, stageNotesInput)} style={{ flex: 2, padding: '14px', borderRadius: '10px', border: 'none', cursor: !stageTaskTitle ? 'not-allowed' : 'pointer', background: !stageTaskTitle ? '#94A3B8' : '#F97316', color: '#fff', fontSize: '14px', fontWeight: 800, opacity: saving ? 0.6 : 1 }}>
                                      📝 Assign Task & Notify Candidate
                                    </button>
                                    <button disabled={saving} onClick={() => handleStageDecision(5, 'Reject', undefined, stageNotesInput)} style={{ flex: 1, padding: '14px', borderRadius: '10px', border: '1px solid #EF4444', cursor: 'pointer', background: '#EF444415', color: '#EF4444', fontSize: '14px', fontWeight: 800 }}>❌ Reject</button>
                                  </div>
                                </>
                              ) : (
                                <>
                                  <div style={{ background: '#F9731610', borderRadius: '10px', padding: '16px', border: '1px solid #F9731630' }}>
                                    <div style={{ fontSize: '12px', fontWeight: 700, color: '#F97316', marginBottom: '4px' }}>📝 Task Assigned — Awaiting Submission</div>
                                    <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Task ID: {stageRecord.taskId}{stageRecord.deadline && ` · Deadline: ${new Date(stageRecord.deadline).toLocaleDateString()}`}</div>
                                  </div>
                                  <div>
                                    <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                      <span>Work Simulation Score (0–100)</span>
                                      <span style={{ color: '#F97316', fontWeight: 800 }}>{stageScoreInput}</span>
                                    </label>
                                    <input type="range" min="0" max="100" value={stageScoreInput} onChange={e => setStageScoreInput(parseInt(e.target.value))} style={{ width: '100%', accentColor: '#F97316' }} />
                                  </div>
                                  <div>
                                    <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '8px', display: 'block' }}>Reviewer Notes</label>
                                    <textarea value={stageNotesInput} onChange={e => setStageNotesInput(e.target.value)} placeholder="Evaluate quality, correctness, approach..." rows={3} className="form-input" style={{ width: '100%', resize: 'none', fontSize: '14px', padding: '12px' }} />
                                  </div>
                                  <div style={{ display: 'flex', gap: '12px' }}>
                                    <button disabled={saving} onClick={() => handleStageDecision(5, 'Proceed', stageScoreInput, stageNotesInput)} style={{ flex: 2, padding: '14px', borderRadius: '10px', border: 'none', cursor: 'pointer', background: '#10B981', color: '#fff', fontSize: '14px', fontWeight: 800 }}>✅ Mark Submission Reviewed — Move to Final Review</button>
                                    <button disabled={saving} onClick={() => handleStageDecision(5, 'Reject', stageScoreInput, stageNotesInput)} style={{ flex: 1, padding: '14px', borderRadius: '10px', border: '1px solid #EF4444', cursor: 'pointer', background: '#EF444415', color: '#EF4444', fontSize: '14px', fontWeight: 800 }}>❌ Reject</button>
                                  </div>
                                </>
                              )}
                            </div>
                          )}

                          {/* ── STAGE 6: Final Review ── Compliance + lock grade */}
                          {actType === 'final_review' && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                              <div>
                                <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '12px' }}>Final Compliance Checklist</div>
                                {[
                                  'References checked and verified',
                                  'Identity documents validated',
                                  'No red flags in background check',
                                  'Talent Agreement signed',
                                  'Composite grade confirmed by review panel',
                                ].map((item, i) => (
                                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 0', borderBottom: i < 4 ? '1px solid var(--border-glass)' : 'none' }}>
                                    <input type="checkbox" id={`fr_${i}`} style={{ width: '16px', height: '16px', accentColor: '#EAB308' }} />
                                    <label htmlFor={`fr_${i}`} style={{ fontSize: '13px', color: 'var(--text-secondary)', cursor: 'pointer' }}>{item}</label>
                                  </div>
                                ))}
                              </div>
                              <div style={{ background: 'var(--bg-tertiary)', borderRadius: '10px', padding: '16px' }}>
                                <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '8px' }}>Composite Vetting Score (Auto-calculated)</div>
                                <div style={{ fontSize: '28px', fontWeight: 900, color: getGradeColor(selectedTalent.grade) }}>{calculateCompositeVettingGrade(selectedTalent.vettingScores).score}/100 — {selectedTalent.grade || 'Ungraded'}</div>
                              </div>
                              <div>
                                <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '8px', display: 'block' }}>Final Review Notes</label>
                                <textarea value={stageNotesInput} onChange={e => setStageNotesInput(e.target.value)} placeholder="Add final panel comments and recommendations..." rows={3} className="form-input" style={{ width: '100%', resize: 'none', fontSize: '14px', padding: '12px' }} />
                              </div>
                              <div style={{ display: 'flex', gap: '12px' }}>
                                <button disabled={saving} onClick={() => handleStageDecision(6, 'Proceed', undefined, stageNotesInput)} style={{ flex: 2, padding: '14px', borderRadius: '10px', border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg, #EAB308, #D97706)', color: '#fff', fontSize: '14px', fontWeight: 800, boxShadow: '0 4px 12px rgba(234,179,8,0.3)' }}>
                                  ⭐ Mark Fully Vetted — Lock Grade & Status
                                </button>
                                <button disabled={saving} onClick={() => handleStageDecision(6, 'Reject', undefined, stageNotesInput)} style={{ flex: 1, padding: '14px', borderRadius: '10px', border: '1px solid #EF4444', cursor: 'pointer', background: '#EF444415', color: '#EF4444', fontSize: '14px', fontWeight: 800 }}>❌ Reject</button>
                              </div>
                            </div>
                          )}

                        </div>
                      </GlassCard>
                    );
                  })()}
                </div>




                {/* ── BOTTOM: HISTORY & BREAKDOWN ── */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '24px', alignItems: 'start' }}>
                  {/* Left Column: History & Upcoming */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <h3 style={{ fontSize: '16px', fontWeight: 800, margin: '0' }}>Vetting Pipeline Journey</h3>
                    
                    <div style={{ background: 'var(--bg-primary)', borderRadius: '12px', border: '1px solid var(--border-glass)', padding: '20px' }}>
                      {VETTING_STAGES.map((stageMeta, idx) => {
                        const pipeline = selectedTalent.vettingPipeline || [];
                        const stageRecord = pipeline[idx];
                        const isPassed = stageRecord?.status === 'passed' || stageRecord?.status === 'skipped';
                        const isFailed = stageRecord?.status === 'failed';
                        const currentStageIdx = pipeline.findIndex(s => s.status !== 'passed' && s.status !== 'skipped');
                        const activeIdx = currentStageIdx === -1 && pipeline.length > 0 ? VETTING_STAGES.length : (currentStageIdx === -1 ? 0 : currentStageIdx);
                        const isUpcoming = idx > activeIdx;
                        const isActive = idx === activeIdx;

                        if (isActive) return null; // Don't show active in the history log, it's above

                        if (isUpcoming) {
                          // Greyed out locked item
                          return (
                            <div key={idx} style={{ display: 'flex', gap: '16px', padding: '12px 0', borderBottom: idx < VETTING_STAGES.length - 1 ? '1px solid var(--border-glass)' : 'none', opacity: 0.5 }}>
                              <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>🔒</div>
                              <div>
                                <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>Stage {idx + 1}: {stageMeta.name}</div>
                                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Locked — Complete previous stages</div>
                              </div>
                            </div>
                          );
                        }

                        // Passed or Failed historical item
                        return (
                          <div key={idx} style={{ display: 'flex', gap: '16px', padding: '16px 0', borderBottom: idx < VETTING_STAGES.length - 1 ? '1px solid var(--border-glass)' : 'none' }}>
                            <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: isPassed ? '#10B98120' : '#EF444420', color: isPassed ? '#10B981' : '#EF4444', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: '14px' }}>
                              {isPassed ? '✅' : '❌'}
                            </div>
                            <div style={{ flex: 1 }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <div>
                                  <div style={{ fontSize: '14px', fontWeight: 800 }}>Stage {idx + 1}: {stageMeta.name}</div>
                                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                                    {stageRecord?.completedAt ? new Date(stageRecord.completedAt).toLocaleDateString() : 'Completed'}
                                    {stageRecord?.score != null && <span style={{ marginLeft: '12px', fontWeight: 700, color: stageMeta.color }}>Score: {stageRecord.score}/100</span>}
                                  </div>
                                </div>
                                <Chip label={stageRecord?.status === 'skipped' ? 'Skipped' : isPassed ? 'Passed' : 'Rejected'} />
                              </div>
                                {stageRecord?.notes && (
                                  <div style={{ marginTop: '8px', fontSize: '12px', color: 'var(--text-secondary)', background: 'var(--bg-tertiary)', padding: '10px 12px', borderRadius: '8px', borderLeft: `3px solid ${isPassed ? '#10B981' : '#EF4444'}` }}>
                                    "{stageRecord.notes}"
                                  </div>
                                )}
                                <div style={{ marginTop: '12px' }}>
                                  <button onClick={() => handleReAssess(idx)} disabled={saving} style={{ background: 'transparent', border: '1px solid #DDE2EC', color: '#6B7A99', fontSize: '11px', fontWeight: 700, padding: '4px 8px', borderRadius: '4px', cursor: 'pointer' }}>
                                    🔄 Ops Lead Override: Re-Assess
                                  </button>
                                </div>
                              </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Right Column: Score Breakdown */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <GlassCard style={{ padding: '20px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                        <div style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Manual Score Override</div>
                        <button onClick={() => {
                          if (!editScoresMode) {
                            setEditScores({ ...selectedTalent.vettingScores });
                            setEditScoresMode(true);
                          } else {
                            setSaving(true);
                            const updatedTalent = { ...selectedTalent, vettingScores: editScores, grade: calculateCompositeVettingGrade(editScores).grade };
                            fetch('/api/db', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ talents: talents.map(t => t.id === selectedTalent.id ? updatedTalent : t) }) })
                              .then(() => {
                                setTalents(prev => prev.map(t => t.id === selectedTalent.id ? updatedTalent : t));
                                setSelectedTalent(updatedTalent);
                                setEditScoresMode(false);
                                setSaving(false);
                              });
                          }
                        }} style={{ fontSize: '11px', fontWeight: 800, color: editScoresMode ? '#10B981' : 'var(--kongila-blue)', background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}>
                          {editScoresMode ? 'Save Scores' : 'Edit Override'}
                        </button>
                      </div>
                      <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '16px', lineHeight: 1.5 }}>
                        Scores are automatically updated when passing stages. You can manually override them below if needed.
                      </p>
                      {[
                        { label: 'Application Screening', key: 'experience', value: editScoresMode ? editScores.experience : selectedTalent.vettingScores.experience, weight: '10%', color: '#EF4444' },
                        { label: 'Skill Assessment', key: 'technical', value: editScoresMode ? editScores.technical : selectedTalent.vettingScores.technical, weight: '30%', color: '#3B82F6' },
                        { label: 'Behavioural Interview', key: 'behavioral', value: editScoresMode ? editScores.behavioral : selectedTalent.vettingScores.behavioral, weight: '20%', color: '#8B5CF6' },
                        { label: 'Personality Test', key: 'personality', value: editScoresMode ? editScores.personality : selectedTalent.vettingScores.personality, weight: '10%', color: '#10B981' },
                        { label: 'Remote Readiness', key: 'remoteReadiness', value: editScoresMode ? editScores.remoteReadiness : selectedTalent.vettingScores.remoteReadiness, weight: '10%', color: '#F59E0B' },
                        { label: 'Work Simulation', key: 'workSimulation', value: editScoresMode ? editScores.workSimulation : selectedTalent.vettingScores.workSimulation, weight: '20%', color: '#F97316' },
                      ].map(({ label, key, value, weight, color }) => (
                        <div key={label} style={{ marginBottom: '10px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', marginBottom: '4px' }}>
                            <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{label} <span style={{ color: 'var(--text-muted)' }}>({weight})</span></span>
                            {editScoresMode ? (
                              <input type="number" min="0" max="100" value={value} onChange={e => setEditScores(prev => ({ ...prev, [key]: parseInt(e.target.value) || 0 }))} style={{ width: '40px', background: 'var(--bg-primary)', border: '1px solid var(--border-glass)', color: '#fff', fontSize: '11px', padding: '2px 4px', borderRadius: '4px', textAlign: 'right' }} />
                            ) : (
                              <span style={{ fontWeight: 800, color }}>{value ?? '—'}</span>
                            )}
                          </div>
                          <div style={{ height: '4px', background: 'var(--border-glass)', borderRadius: '2px', overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${value || 0}%`, background: color }} />
                          </div>
                        </div>
                      ))}
                    </GlassCard>

                    {/* Compliance Documents Summary */}
                    <GlassCard style={{ padding: '20px' }}>
                      <div style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '16px' }}>Compliance Documents</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {documents.filter(d => d.userId === selectedTalent.id || (d.isMandatory && !d.userId)).length === 0 ? (
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>No compliance documents assigned.</span>
                        ) : (
                          documents.filter(d => d.userId === selectedTalent.id || (d.isMandatory && !d.userId)).map(doc => {
                            const isSigned = doc.status === 'signed' || doc.status === 'verified';
                            return (
                              <div key={doc.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px', background: 'var(--bg-tertiary)', borderRadius: '8px', fontSize: '11px' }}>
                                <span style={{ fontWeight: 600 }}>{doc.name}</span>
                                <Chip label={isSigned ? 'Signed' : 'Pending'} />
                              </div>
                            );
                          })
                        )}
                      </div>
                    </GlassCard>

                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      );

      // ── MATCHING ────────────────────────────────────────────────────────────
      case 'matching': return (
        <div>
          <div className="page-header"><div><h1 className="page-title">Intake Request & Shortlist Matcher</h1><p className="page-subtitle">Review client intakes, inspect matches, override shortlists.</p></div></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 2fr', gap: '32px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <GlassCard>
                <h2 style={{ fontSize: '16px', marginBottom: '14px' }}>Active Role Intakes</h2>
                {requests.length === 0 ? <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>No requests logged.</p> : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {requests.map(req => (
                      <div key={req.id} onClick={() => setSelectedRequest(selectedRequest?.id === req.id ? null : req as any)} style={{ padding: '12px', borderRadius: '10px', border: `1px solid ${selectedRequest?.id === req.id ? 'var(--kongila-blue)' : 'var(--border-glass)'}`, background: selectedRequest?.id === req.id ? 'var(--kongila-blue-glow)' : 'var(--bg-tertiary)', cursor: 'pointer' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}><strong>{req.serviceType}</strong><Chip label={req.status} /></div>
                        <div style={{ fontSize: '13px', fontWeight: 600 }}>{req.roleDescription}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>Client: {req.clientName}</div>
                      </div>
                    ))}
                  </div>
                )}
              </GlassCard>

              <GlassCard>
                <h2 style={{ fontSize: '16px', marginBottom: '14px' }}>Pending Re-hire Requests</h2>
                {rehireRequests.filter(r => r.status === 'Pending').length === 0 ? <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>None pending.</p> : rehireRequests.filter(r => r.status === 'Pending').map(rehire => (
                  <div key={rehire.id} style={{ padding: '14px', background: 'var(--bg-tertiary)', borderRadius: '10px', marginBottom: '10px' }}>
                    <div style={{ fontSize: '11px', color: 'var(--accent-cyan)', fontWeight: 700, textTransform: 'uppercase', marginBottom: '4px' }}>Re-hire Proposal · {rehire.commitmentLevel}</div>
                    <div style={{ fontWeight: 700, fontSize: '14px' }}>{rehire.talentName}</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Role: {rehire.role} · {formatCurrency(rehire.proposedRate)}/mo</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Start: {rehire.proposedStartDate}</div>
                    {rehire.notes && <div style={{ background: 'var(--bg-primary)', borderRadius: '6px', padding: '8px', fontSize: '11px', color: 'var(--text-muted)', marginTop: '8px' }}><em>Notes:</em> "{rehire.notes}"</div>}
                    <NeonButton onClick={() => handleApproveRehire(rehire.id)} style={{ width: '100%', marginTop: '12px', background: 'var(--accent-cyan)', color: '#000', padding: '7px', fontSize: '11px' }}>Approve & Schedule Re-hire</NeonButton>
                  </div>
                ))}
              </GlassCard>
            </div>

            <div>
              {!selectedRequest ? (
                <GlassCard style={{ textAlign: 'center', padding: '40px' }}><div style={{ fontSize: '40px', marginBottom: '12px' }}>🤝</div><p style={{ color: 'var(--text-secondary)' }}>Select a client request to audit matched candidates.</p></GlassCard>
              ) : (
                <div>
                  <h3 style={{ fontSize: '17px', fontWeight: 700, marginBottom: '16px' }}>Matches: {selectedRequest.serviceType}</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    {matches.filter(m => m.requestId === selectedRequest.id).map(match => {
                      const talent = talents.find(t => t.id === match.talentId);
                      if (!talent) return null;
                      return (
                        <GlassCard key={match.id}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div style={{ flex: 1, paddingRight: '16px' }}>
                              <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '6px' }}>
                                {talent.avatar && <img src={talent.avatar} alt="" style={{ width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover' }} />}
                                <div>
                                  <div style={{ fontWeight: 700, fontSize: '14px' }}>{talent.name}</div>
                                  <div style={{ fontSize: '12px', color: 'var(--accent-cyan)' }}>{talent.title}</div>
                                </div>
                                <span style={{ fontWeight: 800, color: getGradeColor(talent.grade), fontSize: '13px' }}>Grade: {talent.grade}</span>
                                <Chip label={match.status} />
                              </div>
                              <div style={{ display: 'flex', gap: '16px', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '10px' }}>
                                <span>Skills: {match.breakdown.skillFit}%</span>
                                <span>Personality: {match.breakdown.personalityFit}%</span>
                                <span>Availability: {match.breakdown.availability}%</span>
                              </div>
                              {(match as any).status === 'Interview Requested' && (
                                <div style={{ padding: '10px', background: 'rgba(0,71,204,0.05)', border: '1px solid rgba(0,71,204,0.15)', borderRadius: '8px', fontSize: '12px', marginTop: '8px' }}>
                                  <strong style={{ color: 'var(--kongila-blue)' }}>📅 Proposed:</strong> {(match as any).requestedDate} at {(match as any).requestedTime} ({(match as any).requestedDuration} mins)
                                  {(match as any).requestedNotes && <p style={{ margin: '4px 0 0', color: 'var(--text-secondary)' }}><em>Notes:</em> "{(match as any).requestedNotes}"</p>}
                                </div>
                              )}
                            </div>
                            <div style={{ textAlign: 'right', flexShrink: 0 }}>
                              <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--accent-green)', marginBottom: '8px' }}>{match.score}% FIT</div>
                              {match.status === 'Applied' && <NeonButton onClick={() => handlePushMatch(match.id)}>Approve & Shortlist</NeonButton>}
                              {(match as any).status === 'Interview Requested' && <NeonButton onClick={() => handleAcceptInterviewRequest(match.id)} style={{ background: 'var(--accent-cyan)', color: '#000' }}>Accept & Schedule</NeonButton>}
                              {(match as any).status === 'Interview Scheduled' && <Chip label="✓ Scheduled" />}
                            </div>
                          </div>
                        </GlassCard>
                      );
                    })}
                    {matches.filter(m => m.requestId === selectedRequest.id).length === 0 && <p style={{ color: 'var(--text-muted)', fontSize: '13px', textAlign: 'center', padding: '16px' }}>No candidates shortlisted yet.</p>}
                  </div>

                  <div style={{ marginTop: '32px', borderTop: '1px solid var(--border-glass)', paddingTop: '24px' }}>
                    <h3 style={{ fontSize: '16px', marginBottom: '8px' }}>Vetted Candidates Directory</h3>
                    <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '16px' }}>Manually shortlist candidates for this request.</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {talents.filter(t => (t.vettingStatus === 'Vetted' || t.grade === 'A' || t.grade === 'B' || t.grade === 'A+') && !matches.some(m => m.requestId === selectedRequest.id && m.talentId === t.id)).map(t => (
                        <GlassCard key={t.id} style={{ padding: '14px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              {t.avatar && <img src={t.avatar} alt="" style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover' }} />}
                              <div>
                                <div style={{ fontWeight: 600, fontSize: '13px' }}>{t.name}</div>
                                <div style={{ fontSize: '11px', color: 'var(--accent-cyan)' }}>{t.title}</div>
                                <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>{t.skills.slice(0, 4).join(', ')}</div>
                              </div>
                            </div>
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                              <span style={{ fontWeight: 800, color: getGradeColor(t.grade), fontSize: '12px' }}>{t.grade}</span>
                              <NeonButton onClick={() => handleShortlistCandidate(t.id)} disabled={t.vettingStatus !== 'Vetted'} style={{ padding: '6px 12px', fontSize: '11px', opacity: t.vettingStatus !== 'Vetted' ? 0.5 : 1, cursor: t.vettingStatus !== 'Vetted' ? 'not-allowed' : 'pointer' }}>+ Shortlist</NeonButton>
                            </div>
                          </div>
                        </GlassCard>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      );

      // ── CONTRACTS ──────────────────────────────────────────────────────────
      case 'contracts': return (
        <ContractsManager
          contracts={contracts}
          contractTemplates={contractTemplates}
          talents={talents}
          organizations={organizations}
          requests={requests}
          saveToDb={saveToDb}
          auditLogs={auditLogs}
          setContracts={setContracts}
          setContractTemplates={setContractTemplates}
          setAuditLogs={setAuditLogs}
        />
      );

      // ── COMPLIANCE DOCS ────────────────────────────────────────────────────

      // ── SKILL ASSESSMENTS ──────────────────────────────────────────────────
      case 'assessments': return (
        <div>
          <div className="page-header">
            <div><h1 className="page-title">Skill Assessments</h1><p className="page-subtitle">Create and manage technical assessments — assign to talents, track results.</p></div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => setShowResultModal(true)} className="btn-secondary" style={{ fontSize: '13px', height: '40px', padding: '0 16px', borderRadius: '10px' }}>Record Result</button>
              <button onClick={() => setShowAssessmentModal(true)} className="btn-primary" style={{ fontSize: '13px', height: '40px', padding: '0 18px', borderRadius: '10px' }}>+ Create Assessment</button>
            </div>
          </div>

          {assessments.length === 0 ? (
            <GlassCard style={{ textAlign: 'center', padding: '60px' }}>
              <div style={{ fontSize: '48px', marginBottom: '12px' }}>🎯</div>
              <h3 style={{ fontSize: '17px', fontWeight: 600, marginBottom: '8px' }}>No Assessments Yet</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '20px' }}>Create skill assessments to evaluate talent technical proficiency.</p>
              <button onClick={() => setShowAssessmentModal(true)} className="btn-primary" style={{ height: '40px', padding: '0 20px', borderRadius: '10px' }}>Create First Assessment</button>
            </GlassCard>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '20px' }}>
              {assessments.map(assessment => {
                const results = assessmentResults.filter(r => r.assessmentId === assessment.id);
                const passed = results.filter(r => r.passed).length;
                
                // Calculate question count dynamically
                let qCount = 0;
                let totalTime = assessment.total_time_limit_minutes || 0;
                assessment.categories?.forEach(catId => {
                  const cat = assessmentCategories.find(c => c.id === catId);
                  if (cat && cat.questions) {
                    qCount += cat.questions.length;
                  } else {
                     // check questions list directly
                     qCount += assessmentQuestions.filter(q => q.category_id === catId).length;
                  }
                  if (!assessment.total_time_limit_minutes && cat) {
                    totalTime += cat.time_limit_minutes || 0;
                  }
                });

                return (
                  <GlassCard key={assessment.id}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                      <div>
                        <h3 style={{ fontSize: '15px', fontWeight: 700 }}>{assessment.title}</h3>
                        <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>{assessment.description}</p>
                      </div>
                      <Chip label={assessment.status} />
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '12px' }}>
                      <span style={{ fontSize: '10px', padding: '2px 7px', borderRadius: '999px', background: 'var(--kongila-blue-glow)', color: 'var(--kongila-blue)', fontWeight: 500 }}>Target: {assessment.role_targeted}</span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', fontSize: '11px', marginBottom: '14px' }}>
                      <div style={{ background: 'var(--bg-tertiary)', borderRadius: '6px', padding: '8px', textAlign: 'center' }}>
                        <div style={{ color: 'var(--text-muted)' }}>Questions</div>
                        <div style={{ fontWeight: 700, fontSize: '16px' }}>{qCount}</div>
                      </div>
                      <div style={{ background: 'var(--bg-tertiary)', borderRadius: '6px', padding: '8px', textAlign: 'center' }}>
                        <div style={{ color: 'var(--text-muted)' }}>Time Limit</div>
                        <div style={{ fontWeight: 700, fontSize: '16px' }}>{totalTime}m</div>
                      </div>
                      <div style={{ background: 'var(--bg-tertiary)', borderRadius: '6px', padding: '8px', textAlign: 'center' }}>
                        <div style={{ color: 'var(--text-muted)' }}>Pass Score</div>
                        <div style={{ fontWeight: 700, fontSize: '16px' }}>{assessment.passing_score}%</div>
                      </div>
                    </div>
                    {results.length > 0 && (
                      <div style={{ marginBottom: '12px', padding: '10px', background: 'var(--bg-tertiary)', borderRadius: '8px', fontSize: '12px' }}>
                        <strong>Results:</strong> {results.length} submitted · {passed} passed ({results.length > 0 ? Math.round((passed / results.length) * 100) : 0}% pass rate)
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button onClick={() => {
                        // Check if it has results
                        if (results.length > 0) {
                           // If has results, we want to clone and archive
                           if (window.confirm("This assessment has already been taken. Editing it will create a new version and archive this one so that existing results are not affected. Proceed?")) {
                             const newTitle = assessment.title + " (Edited)";
                             setAssessmentToEdit({ ...assessment, id: undefined, title: newTitle, status: 'draft' });
                             setShowAssessmentModal(true);
                           }
                        } else {
                          // No results, can edit directly
                          setAssessmentToEdit(assessment);
                          setShowAssessmentModal(true);
                        }
                      }} style={{ fontSize: '11px', padding: '4px 10px', borderRadius: '6px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-glass)', cursor: 'pointer', color: 'var(--kongila-blue)' }}>Edit</button>
                      {assessment.status === 'published' && <button onClick={() => {}} style={{ fontSize: '11px', padding: '4px 10px', borderRadius: '6px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-glass)', cursor: 'pointer', color: 'var(--text-secondary)' }}>Archive</button>}
                    </div>
                  </GlassCard>
                );
              })}
            </div>
          )}

          {/* Assessment Results Table */}
          {assessmentResults.length > 0 && (
            <div style={{ marginTop: '32px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px' }}>All Assessment Results</h3>
              <div className="table-container">
                <table className="custom-table">
                  <thead><tr>{['Talent', 'Assessment', 'Score', 'Passed', 'Completed', 'Actions'].map(h => <th key={h}>{h}</th>)}</tr></thead>
                  <tbody>
                    {assessmentResults.map(r => {
                      const talent = talents.find(t => t.id === r.talentId);
                      const assessment = assessments.find(a => a.id === r.assessmentId);
                      
                      // Calculate displayed score
                      let dispScore = r.score;
                      if (dispScore == null) {
                         dispScore = r.autoScore ?? undefined;
                      }

                      let isPassed = false;
                      if (r.passed != null) {
                        isPassed = r.passed;
                      } else if (r.autoScore != null && !r.hasSubjective) {
                         isPassed = r.autoScore >= (assessment?.passing_score || 70);
                      }

                      return (
                        <tr key={r.id}>
                          <td style={{ fontWeight: 600, fontSize: '13px' }}>{talent?.name || r.talentId}</td>
                          <td style={{ fontSize: '12px' }}>{assessment?.title || r.assessmentId}</td>
                          <td style={{ fontWeight: 700, color: (dispScore ?? 0) >= (assessment?.passing_score || 70) ? 'var(--accent-green)' : 'var(--accent-magenta)', fontSize: '14px' }}>{dispScore ?? '—'}%</td>
                          <td><Chip label={r.passed != null ? (r.passed ? 'Passed' : 'Failed') : (r.autoScore != null && !r.hasSubjective ? (isPassed ? 'Passed' : 'Failed') : 'Pending Review')} /></td>
                          <td style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{formatDate(r.submittedAt || r.completedAt || '')}</td>
                          <td>
                            <button 
                              onClick={() => {
                                setSelectedAssessmentResultForReview(r);
                                setGradingScores((r as any).subjectiveScores || {});
                                setShowGradingModal(true);
                              }}
                              style={{ fontSize: '11px', padding: '4px 10px', borderRadius: '6px', background: 'var(--kongila-blue-glow)', color: 'var(--kongila-blue)', border: '1px solid rgba(0, 71, 204, 0.2)', cursor: 'pointer', fontWeight: 600 }}
                            >
                              Review Submission
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {showAssessmentModal && (
            <AssessmentWizard
              globalCategories={assessmentCategories}
              globalQuestions={assessmentQuestions}
              initialAssessment={assessmentToEdit}
              onClose={() => {
                setShowAssessmentModal(false);
                setAssessmentToEdit(null);
              }}
              onSuccess={() => {
                setShowAssessmentModal(false);
                setAssessmentToEdit(null);
                syncFromDb();
              }}
            />
          )}

          {/* Record Result Modal */}
          {showResultModal && (
            <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setShowResultModal(false); }}>
              <div className="modal-content" style={{ padding: '32px', maxWidth: '480px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                  <h2 style={{ fontSize: '18px', fontWeight: 700 }}>Record Assessment Result</h2>
                  <button onClick={() => setShowResultModal(false)} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: 'var(--text-secondary)' }}>✕</button>
                </div>
                <form onSubmit={handleRecordResult}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    <div>
                      <label className="form-label">Assessment</label>
                      <select className="form-select" value={resultForm.assessmentId} onChange={e => setResultForm({ ...resultForm, assessmentId: e.target.value })} required>
                        <option value="">Select assessment...</option>
                        {assessments.map(a => <option key={a.id} value={a.id}>{a.title}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="form-label">Talent</label>
                      <select className="form-select" value={resultForm.talentId} onChange={e => setResultForm({ ...resultForm, talentId: e.target.value })} required>
                        <option value="">Select talent...</option>
                        {talents.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="form-label">Score (%)</label>
                      <input type="number" className="form-input" value={resultForm.score} onChange={e => setResultForm({ ...resultForm, score: e.target.value, passed: Number(e.target.value) >= (assessments.find(a => a.id === resultForm.assessmentId)?.passing_score || 70) })} min="0" max="100" required />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <input type="checkbox" id="passed" checked={resultForm.passed} onChange={e => setResultForm({ ...resultForm, passed: e.target.checked })} style={{ width: '16px', height: '16px' }} />
                      <label htmlFor="passed" style={{ fontSize: '13px', fontWeight: 500 }}>Mark as Passed</label>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
                    <button type="submit" className="btn-primary" style={{ flex: 1, opacity: saving ? 0.7 : 1 }}>{saving ? 'Saving...' : 'Record Result'}</button>
                    <button type="button" onClick={() => setShowResultModal(false)} className="btn-secondary" style={{ flex: 1 }}>Cancel</button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Grading Modal */}
          {showGradingModal && selectedAssessmentResultForReview && (() => {
             const r = selectedAssessmentResultForReview;
             const asmnt = assessments.find((a: any) => a.id === r.assessmentId);
             const talent = talents.find(t => t.id === r.talentId);
             const cats = asmnt?.categories?.map((catId: string) => assessmentCategories.find(c => c.id === catId)).filter(Boolean) || [];

             return (
              <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setShowGradingModal(false); }}>
                <div className="modal-content" style={{ padding: '32px', maxWidth: '800px', maxHeight: '90vh', overflowY: 'auto', background: 'var(--bg-secondary)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', borderBottom: '1px solid var(--border-glass)', paddingBottom: '16px' }}>
                    <div>
                      <h2 style={{ fontSize: '20px', fontWeight: 800 }}>Review Submission</h2>
                      <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                        {talent?.name} · {asmnt?.title}
                      </div>
                    </div>
                    <button onClick={() => setShowGradingModal(false)} style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', color: 'var(--text-secondary)' }}>✕</button>
                  </div>
                  
                  <form onSubmit={handleSubmitGrading}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
                      {cats.map((cat: any, i: number) => {
                        const qs = assessmentQuestions.filter(q => q.category_id === cat.id);
                        return (
                          <div key={cat.id} style={{ background: 'var(--bg-primary)', padding: '20px', borderRadius: '12px', border: '1px solid var(--border-glass)' }}>
                            <div style={{ fontSize: '15px', fontWeight: 700, marginBottom: '16px', color: 'var(--kongila-blue)' }}>{i + 1}. {cat.name}</div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                              {qs.map((q: any, j: number) => {
                                const isMCQ = q.type === 'multiple_choice';
                                const userAns = r.answers?.[q.id];
                                let isCorrect = false;
                                if (isMCQ && userAns) {
                                  isCorrect = Array.isArray(userAns) ? 
                                    userAns.sort().join(',') === (q.correct_options || []).sort().join(',') : 
                                    userAns === q.correct_options?.[0];
                                }
                                
                                return (
                                  <div key={q.id} style={{ padding: '16px', background: 'var(--bg-tertiary)', borderRadius: '8px' }}>
                                    <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '12px' }}>Q{j + 1}: {q.text}</div>
                                    
                                    {isMCQ ? (
                                      <div>
                                        <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '8px' }}>Answers (Auto-scored):</div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                          {(q.options || []).map((opt: string) => {
                                            const isSelected = Array.isArray(userAns) ? userAns.includes(opt) : userAns === opt;
                                            const isActualCorrect = (q.correct_options || []).includes(opt);
                                            let bg = 'transparent';
                                            let border = '1px solid var(--border-glass)';
                                            if (isSelected && isActualCorrect) { bg = 'rgba(16,185,129,0.1)'; border = '1px solid var(--accent-green)'; }
                                            else if (isSelected && !isActualCorrect) { bg = 'rgba(239,68,68,0.1)'; border = '1px solid var(--accent-magenta)'; }
                                            else if (!isSelected && isActualCorrect) { border = '1px dashed var(--accent-green)'; }
                                            
                                            return (
                                              <div key={opt} style={{ padding: '8px 12px', borderRadius: '6px', fontSize: '12px', background: bg, border }}>
                                                {opt} {isSelected && ' (Selected)'} {isActualCorrect && ' (Correct)'}
                                              </div>
                                            );
                                          })}
                                        </div>
                                        <div style={{ marginTop: '10px', fontSize: '12px', fontWeight: 600, color: isCorrect ? 'var(--accent-green)' : 'var(--accent-magenta)' }}>
                                          {isCorrect ? '✅ Correct' : '❌ Incorrect'} ({q.max_score || 10} pts max)
                                        </div>
                                      </div>
                                    ) : (
                                      <div>
                                        <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '8px' }}>Talent's Answer:</div>
                                        <div style={{ padding: '12px', background: 'var(--bg-primary)', borderRadius: '6px', fontSize: '13px', border: '1px solid var(--border-glass)', whiteSpace: 'pre-wrap', marginBottom: '12px' }}>
                                          {r.subjectiveAnswers?.[q.id] || r.answers?.[q.id] || <span style={{ color: 'var(--text-muted)' }}>No answer provided.</span>}
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                          <label style={{ fontSize: '12px', fontWeight: 600 }}>Assign Score (Max {q.max_score || 10}):</label>
                                          <input 
                                            type="number" 
                                            min="0" 
                                            max={q.max_score || 10} 
                                            required
                                            value={gradingScores[q.id] ?? ''}
                                            onChange={e => setGradingScores({ ...gradingScores, [q.id]: Number(e.target.value) })}
                                            style={{ width: '80px', padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--border-glass)', background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
                                          />
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    
                    <div style={{ display: 'flex', gap: '12px', marginTop: '32px', position: 'sticky', bottom: '-32px', background: 'var(--bg-secondary)', padding: '16px 0', borderTop: '1px solid var(--border-glass)' }}>
                      <button type="submit" className="btn-primary" style={{ flex: 1, opacity: saving ? 0.7 : 1 }}>{saving ? 'Saving...' : 'Submit Final Grades'}</button>
                      <button type="button" onClick={() => setShowGradingModal(false)} className="btn-secondary" style={{ flex: 1 }}>Cancel</button>
                    </div>
                  </form>
                </div>
              </div>
             );
          })()}
        </div>
      );

      // ── SUPPORT CENTER ─────────────────────────────────────────────────────
      case 'support': return (
        <div>
          <div className="page-header">
            <div><h1 className="page-title">Support Center</h1><p className="page-subtitle">Manage all support tickets — reply, resolve, and escalate.</p></div>
          </div>

          <div className="stats-card-grid" style={{ marginBottom: '24px' }}>
            {[
              { label: 'Total Tickets', val: supportTickets.length, color: 'var(--kongila-blue)' },
              { label: 'Open', val: supportTickets.filter(t => t.status === 'Open').length, color: 'var(--accent-gold)' },
              { label: 'In Progress', val: supportTickets.filter(t => t.status === 'In Progress').length, color: '#3D7FFF' },
              { label: 'Resolved', val: supportTickets.filter(t => t.status === 'Resolved').length, color: 'var(--accent-green)' },
            ].map(({ label, val, color }) => (
              <GlassCard key={label}><div style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>{label}</div><div style={{ fontSize: '28px', fontWeight: 700, color, marginTop: '6px' }}>{val}</div></GlassCard>
            ))}
          </div>

          <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
            {['All', 'Open', 'In Progress', 'Resolved', 'Closed'].map(f => (
              <button key={f} onClick={() => setTicketFilter(f)} style={{ padding: '5px 12px', borderRadius: '999px', border: `1px solid ${ticketFilter === f ? 'var(--kongila-blue)' : 'var(--border-glass)'}`, background: ticketFilter === f ? 'var(--kongila-blue-glow)' : 'var(--bg-secondary)', color: ticketFilter === f ? 'var(--kongila-blue)' : 'var(--text-secondary)', fontWeight: ticketFilter === f ? 600 : 400, fontSize: '12px', cursor: 'pointer' }}>{f}</button>
            ))}
            <div style={{ display: 'flex', gap: '6px', marginLeft: '4px' }}>
              {['All', 'Urgent', 'High', 'Medium', 'Low'].map(p => (
                <button key={p} onClick={() => setPriorityFilter(p)} style={{ padding: '5px 12px', borderRadius: '999px', border: `1px solid ${priorityFilter === p ? statusColor(p) : 'var(--border-glass)'}`, background: priorityFilter === p ? statusBg(p) : 'var(--bg-secondary)', color: priorityFilter === p ? statusColor(p) : 'var(--text-secondary)', fontWeight: priorityFilter === p ? 600 : 400, fontSize: '12px', cursor: 'pointer' }}>{p}</button>
              ))}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.6fr', gap: '24px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '70vh', overflowY: 'auto' }}>
              {filteredTickets.length === 0 ? (
                <GlassCard style={{ textAlign: 'center', padding: '40px' }}>
                  <div style={{ fontSize: '32px', marginBottom: '8px' }}>🎧</div>
                  <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>No tickets match these filters.</p>
                </GlassCard>
              ) : filteredTickets.map(ticket => (
                <div key={ticket.id} onClick={() => setSelectedTicket(selectedTicket?.id === ticket.id ? null : ticket)} style={{ background: 'var(--bg-secondary)', border: `1px solid ${selectedTicket?.id === ticket.id ? 'var(--kongila-blue)' : 'var(--border-glass)'}`, borderLeft: `4px solid ${statusColor(ticket.priority)}`, borderRadius: '12px', padding: '14px', cursor: 'pointer', transition: 'all 0.2s' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <span style={{ fontSize: '11px', fontFamily: 'monospace', color: 'var(--text-muted)', fontWeight: 600 }}>{ticket.id}</span>
                    <div style={{ display: 'flex', gap: '4px' }}><Chip label={ticket.status} /><Chip label={ticket.priority} /></div>
                  </div>
                  <div style={{ fontWeight: 600, fontSize: '13px', marginBottom: '4px' }}>{ticket.subject}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{ticket.category} · {formatDate(ticket.createdAt)}</div>
                </div>
              ))}
            </div>

            <div>
              {!selectedTicket ? (
                <GlassCard style={{ textAlign: 'center', padding: '60px' }}>
                  <div style={{ fontSize: '40px', marginBottom: '12px' }}>🎧</div>
                  <p style={{ color: 'var(--text-secondary)' }}>Select a ticket to view the conversation and reply.</p>
                </GlassCard>
              ) : (
                <GlassCard style={{ padding: '0', overflow: 'hidden', display: 'flex', flexDirection: 'column', height: '70vh' }}>
                  {/* Ticket Header */}
                  <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-glass)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '14px' }}>{selectedTicket.subject}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>{selectedTicket.id} · {selectedTicket.category} · {formatDate(selectedTicket.createdAt)}</div>
                      </div>
                      <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                        <Chip label={selectedTicket.status} /><Chip label={selectedTicket.priority} />
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '6px', marginTop: '10px', flexWrap: 'wrap' }}>
                      {selectedTicket.status !== 'In Progress' && <button onClick={() => handleUpdateTicketStatus(selectedTicket.id, 'In Progress')} style={{ padding: '3px 10px', borderRadius: '6px', background: 'rgba(61,127,255,0.1)', color: '#3D7FFF', border: 'none', cursor: 'pointer', fontSize: '11px', fontWeight: 600 }}>In Progress</button>}
                      {selectedTicket.status !== 'Resolved' && <button onClick={() => handleUpdateTicketStatus(selectedTicket.id, 'Resolved')} style={{ padding: '3px 10px', borderRadius: '6px', background: 'rgba(16,185,129,0.1)', color: 'var(--accent-green)', border: 'none', cursor: 'pointer', fontSize: '11px', fontWeight: 600 }}>Resolve</button>}
                      {selectedTicket.status !== 'Closed' && <button onClick={() => handleUpdateTicketStatus(selectedTicket.id, 'Closed')} style={{ padding: '3px 10px', borderRadius: '6px', background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', border: '1px solid var(--border-glass)', cursor: 'pointer', fontSize: '11px', fontWeight: 600 }}>Close</button>}
                    </div>
                  </div>

                  {/* Messages */}
                  <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {supportMessages.filter(m => m.ticketId === selectedTicket.id).length === 0 ? (
                      <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px', marginTop: '40px' }}>No messages yet.</div>
                    ) : supportMessages.filter(m => m.ticketId === selectedTicket.id).map(msg => (
                      <div key={msg.id} style={{ display: 'flex', gap: '10px', flexDirection: msg.isSupport ? 'row-reverse' : 'row' }}>
                        <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: msg.isSupport ? 'var(--kongila-blue)' : 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', flexShrink: 0, color: msg.isSupport ? '#fff' : 'var(--text-secondary)' }}>
                          {msg.isSupport ? '🛡' : '👤'}
                        </div>
                        <div style={{ maxWidth: '75%' }}>
                          <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '4px', textAlign: msg.isSupport ? 'right' : 'left' }}>{msg.senderName} · {msg.timestamp}</div>
                          <div style={{ background: msg.isSupport ? 'var(--kongila-blue)' : 'var(--bg-tertiary)', color: msg.isSupport ? '#fff' : 'var(--text-primary)', padding: '10px 14px', borderRadius: msg.isSupport ? '12px 12px 2px 12px' : '12px 12px 12px 2px', fontSize: '13px', lineHeight: 1.5 }}>{msg.text}</div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Reply Box */}
                  {selectedTicket.status !== 'Closed' && selectedTicket.status !== 'Resolved' && (
                    <form onSubmit={handleSupportReply} style={{ padding: '14px 20px', borderTop: '1px solid var(--border-glass)', display: 'flex', gap: '10px' }}>
                      <input type="text" className="form-input" style={{ flex: 1, height: '40px' }} value={supportReply} onChange={e => setSupportReply(e.target.value)} placeholder="Type your reply as admin support..." />
                      <button type="submit" className="btn-primary" style={{ height: '40px', padding: '0 18px', fontSize: '13px', borderRadius: '10px', flexShrink: 0, opacity: saving ? 0.7 : 1 }}>{saving ? '...' : 'Send'}</button>
                    </form>
                  )}
                </GlassCard>
              )}
            </div>
          </div>
        </div>
      );

      // ── AUDIT LOGS ─────────────────────────────────────────────────────────
      case 'audit': return (
        <div>
          <div className="page-header"><div><h1 className="page-title">Audit Logs</h1><p className="page-subtitle">Full chronological audit trail of all platform actions.</p></div></div>
          <GlassCard>
            <div style={{ overflowX: 'auto' }}>
              <table className="custom-table">
                <thead><tr>{['Actor', 'Action', 'Details', 'Timestamp'].map(h => <th key={h}>{h}</th>)}</tr></thead>
                <tbody>
                  {auditLogs.length === 0 ? (
                    <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '40px' }}>No audit entries yet.</td></tr>
                  ) : auditLogs.map(log => (
                    <tr key={log.id}>
                      <td><span style={{ fontWeight: 600, color: 'var(--kongila-blue)', fontSize: '12px' }}>{log.actor}</span></td>
                      <td><span style={{ fontWeight: 600, fontSize: '12px' }}>{log.action}</span></td>
                      <td style={{ fontSize: '12px', color: 'var(--text-secondary)', maxWidth: '400px' }}>{log.details}</td>
                      <td style={{ fontSize: '11px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{formatDate(log.timestamp)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </GlassCard>
        </div>
      );

      // ── REMOTAN OVERVIEW ───────────────────────────────────────────────────
      case 'remotan-overview': return (
        <div>
          <div className="page-header">
            <div>
              <h1 className="page-title" style={{ color: 'var(--accent-teal)' }}>Remotan Overview</h1>
              <p className="page-subtitle">Remotan Employer-of-Record OS — platform metrics and global talent coverage.</p>
            </div>
            <div style={{ fontSize: '12px', background: 'rgba(10,191,188,0.1)', border: '1px solid rgba(10,191,188,0.3)', color: 'var(--accent-teal)', borderRadius: '8px', padding: '6px 14px', fontWeight: 600 }}>
              Remotan OS
            </div>
          </div>
          <div className="stats-card-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
            {[
              { label: 'EOR Talent Pool', val: talents.length, sub: 'Globally managed', color: 'var(--accent-teal)' },
              { label: 'Active EOR Contracts', val: contracts.filter(c => c.status === 'Signed' || c.status === 'Active').length, sub: 'Running now', color: 'var(--accent-green)' },
              { label: 'Monthly EOR Revenue', val: formatCurrency(mrrTotal), sub: 'Gross with markup', color: 'var(--accent-teal)' },
              { label: 'Active Clients', val: organizations.length, sub: 'Client orgs', color: '#7C3AED' },
            ].map(({ label, val, sub, color }) => (
              <GlassCard key={label}>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>{label}</div>
                <div style={{ fontSize: '26px', fontWeight: 700, color, marginTop: '6px' }}>{val}</div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>{sub}</div>
              </GlassCard>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
            <GlassCard>
              <h3 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '14px' }}>EOR Coverage by Region</h3>
              {[
                { region: 'West Africa', count: talents.filter(t => t.timezone?.includes('Lagos') || t.timezone?.includes('Accra') || t.timezone?.includes('Dakar')).length, color: 'var(--accent-teal)' },
                { region: 'East Africa', count: talents.filter(t => t.timezone?.includes('Nairobi')).length, color: '#2563EB' },
                { region: 'Southern Africa', count: talents.filter(t => t.timezone?.includes('Johannesburg')).length, color: '#7C3AED' },
                { region: 'GMT+1 (Europe)', count: talents.filter(t => t.timezone?.includes('GMT+1') && !t.timezone?.includes('Lagos')).length, color: 'var(--accent-gold)' },
              ].map(({ region, count, color }) => (
                <div key={region} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--border-glass)' }}>
                  <span style={{ fontSize: '13px' }}>{region}</span>
                  <span style={{ fontWeight: 700, color, fontSize: '16px' }}>{count}</span>
                </div>
              ))}
            </GlassCard>
            <GlassCard>
              <h3 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '14px' }}>Recent Payouts</h3>
              {talentPayouts.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>No payout records yet.</p>
              ) : talentPayouts.slice(0, 8).map(payout => {
                const talent = talents.find(t => t.id === payout.talentId);
                return (
                  <div key={payout.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--border-glass)' }}>
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 600 }}>{talent?.name || payout.talentId}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{formatDate(payout.paidAt)}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: 700, color: 'var(--accent-teal)' }}>{formatCurrency(payout.amount)}</div>
                      <Chip label={payout.status} />
                    </div>
                  </div>
                );
              })}
            </GlassCard>
          </div>
        </div>
      );

      // ── REMOTAN CLIENTS ────────────────────────────────────────────────────
      case 'remotan-clients': return (
        <div>
          <div className="page-header"><div><h1 className="page-title" style={{ color: 'var(--accent-teal)' }}>Remotan Clients</h1><p className="page-subtitle">Client organizations under Remotan EOR management.</p></div></div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
            {organizations.map(org => {
              const orgContracts = contracts.filter(c => c.clientName === org.name);
              const active = orgContracts.filter(c => c.status === 'Signed' || c.status === 'Active');
              return (
                <GlassCard key={org.id} style={{ borderTop: '3px solid var(--accent-teal)' }}>
                  <h3 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '4px' }}>{org.name}</h3>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '14px' }}>Client since {formatDate(org.created_at)}</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '12px' }}>
                    <div style={{ background: 'rgba(10,191,188,0.08)', borderRadius: '8px', padding: '10px', textAlign: 'center' }}>
                      <div style={{ color: 'var(--text-muted)', fontSize: '10px' }}>Active Contracts</div>
                      <div style={{ fontWeight: 700, fontSize: '20px', color: 'var(--accent-teal)' }}>{active.length}</div>
                    </div>
                    <div style={{ background: 'var(--bg-tertiary)', borderRadius: '8px', padding: '10px', textAlign: 'center' }}>
                      <div style={{ color: 'var(--text-muted)', fontSize: '10px' }}>Total Contracts</div>
                      <div style={{ fontWeight: 700, fontSize: '20px' }}>{orgContracts.length}</div>
                    </div>
                  </div>
                </GlassCard>
              );
            })}
          </div>
        </div>
      );

      // ── REMOTAN TALENT ─────────────────────────────────────────────────────
      case 'remotan-talent': return (
        <div>
          <div className="page-header"><div><h1 className="page-title" style={{ color: 'var(--accent-teal)' }}>Remotan Talent</h1><p className="page-subtitle">EOR-managed talent network across Africa and beyond.</p></div></div>
          <div className="table-container">
            <table className="custom-table">
              <thead><tr>{['Talent', 'Title', 'Grade', 'Status', 'Timezone', 'Rate/mo'].map(h => <th key={h}>{h}</th>)}</tr></thead>
              <tbody>
                {talents.map(t => (
                  <tr key={t.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        {t.avatar ? <img src={t.avatar} alt="" style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover' }} /> : <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>👤</div>}
                        <span style={{ fontWeight: 600, fontSize: '13px' }}>{t.name}</span>
                      </div>
                    </td>
                    <td style={{ fontSize: '12px' }}>{t.title}</td>
                    <td><span style={{ fontWeight: 800, color: getGradeColor(t.grade) }}>{t.grade}</span></td>
                    <td><Chip label={t.vettingStatus} /></td>
                    <td style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{t.timezone}</td>
                    <td style={{ fontWeight: 600, fontSize: '12px' }}>{t.salaryExpectation ? formatCurrency(t.salaryExpectation) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      );

      // ── REMOTAN PAYROLL ────────────────────────────────────────────────────
      case 'remotan-payroll': return (
        <div>
          <div className="page-header"><div><h1 className="page-title" style={{ color: 'var(--accent-teal)' }}>Payroll & EOR</h1><p className="page-subtitle">Talent payout records, invoice tracking, and payment history.</p></div></div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '24px' }}>
            <GlassCard>
              <h3 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '14px' }}>Talent Payouts</h3>
              {talentPayouts.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>
                  <div style={{ fontSize: '32px', marginBottom: '8px' }}>💸</div>
                  <p style={{ fontSize: '13px' }}>No payout records yet.</p>
                </div>
              ) : (
                <div className="table-container" style={{ margin: 0, border: 'none', borderRadius: 0, boxShadow: 'none' }}>
                  <table className="custom-table" style={{ margin: 0 }}>
                    <thead><tr>{['Talent', 'Amount', 'Status', 'Date'].map(h => <th key={h} style={{ padding: '8px 12px' }}>{h}</th>)}</tr></thead>
                    <tbody>
                      {talentPayouts.map(p => {
                        const talent = talents.find(t => t.id === p.talentId);
                        return (
                          <tr key={p.id}>
                            <td style={{ padding: '8px 12px', fontSize: '12px', fontWeight: 600 }}>{talent?.name || p.talentId}</td>
                            <td style={{ padding: '8px 12px', fontWeight: 700, color: 'var(--accent-teal)' }}>{formatCurrency(p.amount)}</td>
                            <td style={{ padding: '8px 12px' }}><Chip label={p.status} /></td>
                            <td style={{ padding: '8px 12px', fontSize: '11px', color: 'var(--text-muted)' }}>{formatDate(p.paidAt)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </GlassCard>

            <GlassCard>
              <h3 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '14px' }}>Invoices & Payments</h3>
              {invoices.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>
                  <div style={{ fontSize: '32px', marginBottom: '8px' }}>🧾</div>
                  <p style={{ fontSize: '13px' }}>No invoice records yet.</p>
                </div>
              ) : invoices.map(inv => {
                const payment = payments.find(p => p.invoiceId === inv.id);
                return (
                  <div key={inv.id} style={{ padding: '12px', background: 'var(--bg-tertiary)', borderRadius: '10px', marginBottom: '10px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span style={{ fontWeight: 700, fontSize: '14px' }}>{formatCurrency(inv.amount)}</span>
                      <Chip label={inv.status} />
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Due: {formatDate(inv.dueDate)}</div>
                    {payment && <div style={{ fontSize: '12px', color: 'var(--accent-green)', marginTop: '4px' }}>✓ Paid via {payment.paymentMethod} on {formatDate(payment.paidAt)}</div>}
                  </div>
                );
              })}
            </GlassCard>
          </div>

          <GlassCard>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '15px', fontWeight: 600 }}>EOR Financial Summary</h3>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', fontSize: '13px' }}>
              <div style={{ background: 'rgba(10,191,188,0.08)', borderRadius: '12px', padding: '16px', textAlign: 'center' }}>
                <div style={{ color: 'var(--text-muted)', fontSize: '11px', marginBottom: '4px' }}>Total Talent Payouts</div>
                <div style={{ fontWeight: 700, fontSize: '22px', color: 'var(--accent-teal)' }}>{formatCurrency(talentPayouts.reduce((s, p) => s + (p.amount || 0), 0))}</div>
              </div>
              <div style={{ background: 'rgba(56,161,105,0.08)', borderRadius: '12px', padding: '16px', textAlign: 'center' }}>
                <div style={{ color: 'var(--text-muted)', fontSize: '11px', marginBottom: '4px' }}>Total Invoiced</div>
                <div style={{ fontWeight: 700, fontSize: '22px', color: 'var(--accent-green)' }}>{formatCurrency(invoices.reduce((s, i) => s + (i.amount || 0), 0))}</div>
              </div>
              <div style={{ background: 'var(--kongila-blue-glow)', borderRadius: '12px', padding: '16px', textAlign: 'center' }}>
                <div style={{ color: 'var(--text-muted)', fontSize: '11px', marginBottom: '4px' }}>Gross MRR</div>
                <div style={{ fontWeight: 700, fontSize: '22px', color: 'var(--kongila-blue)' }}>{formatCurrency(mrrTotal)}</div>
              </div>
            </div>
          </GlassCard>
        </div>
      );

      default: return <div style={{ padding: '40px', color: 'var(--text-muted)' }}>Tab not found.</div>;
    }
  };

  // ─── SIDEBAR ──────────────────────────────────────────────────────────────

  // Helper to render high-fidelity monochrome SVG icons for the sidebar
  const renderSidebarIcon = (key: string) => {
    const props = {
      width: 16,
      height: 16,
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: 2,
      strokeLinecap: "round" as const,
      strokeLinejoin: "round" as const,
      style: { display: 'inline-block', verticalAlign: 'middle' }
    };

    switch (key) {
      case 'overview':
        return (
          <svg {...props}>
            <line x1="18" y1="20" x2="18" y2="10" />
            <line x1="12" y1="20" x2="12" y2="4" />
            <line x1="6" y1="20" x2="6" y2="14" />
          </svg>
        );
      case 'talent-pipeline':
        return (
          <svg {...props}>
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
        );
      case 'client-pipeline':
      case 'remotan-clients':
        return (
          <svg {...props}>
            <rect x="4" y="2" width="16" height="20" rx="2" ry="2" />
            <line x1="9" y1="22" x2="9" y2="16" />
            <line x1="15" y1="22" x2="15" y2="16" />
            <line x1="9" y1="16" x2="15" y2="16" />
            <path d="M8 6h2v2H8V6zm0 4h2v2H8v-2zm0 4h2v2H8v-2zm8-8h2v2h-2V6zm0 4h2v2h-2v-2zm0 4h2v2h-2v-2z" />
          </svg>
        );
      case 'hiring-requests':
        return (
          <svg {...props}>
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
            <polyline points="10 9 9 9 8 9" />
          </svg>
        );
      case 'interviews':
        return (
          <svg {...props}>
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
        );
      case 'vetting':
        return (
          <svg {...props}>
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            <path d="m9 11 2 2 4-4" />
          </svg>
        );
      case 'matching':
        return (
          <svg {...props}>
            <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <polyline points="16 11 18 13 22 9" />
          </svg>
        );
      case 'contracts':
        return (
          <svg {...props}>
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
            <polyline points="10 9 9 9 8 9" />
          </svg>
        );
      case 'compliance':
        return (
          <svg {...props}>
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        );
      case 'assessments':
        return (
          <svg {...props}>
            <circle cx="12" cy="12" r="10" />
            <circle cx="12" cy="12" r="6" />
            <circle cx="12" cy="12" r="2" />
          </svg>
        );
      case 'support':
        return (
          <svg {...props}>
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        );
      case 'audit':
        return (
          <svg {...props}>
            <line x1="8" y1="6" x2="21" y2="6" />
            <line x1="8" y1="12" x2="21" y2="12" />
            <line x1="8" y1="18" x2="21" y2="18" />
            <line x1="3" y1="6" x2="3.01" y2="6" />
            <line x1="3" y1="12" x2="3.01" y2="12" />
            <line x1="3" y1="18" x2="3.01" y2="18" />
          </svg>
        );
      case 'remotan-overview':
        return (
          <svg {...props}>
            <circle cx="12" cy="12" r="10" />
            <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
            <path d="M2 12h20" />
          </svg>
        );
      case 'remotan-talent':
        return (
          <svg {...props}>
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
        );
      case 'remotan-payroll':
        return (
          <svg {...props}>
            <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
            <line x1="1" y1="10" x2="23" y2="10" />
          </svg>
        );
      default:
        return null;
    }
  };

  const SidebarContent = () => (
    <>
      <div className="sidebar-logo">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M12 2L3 7v10l9 5 9-5V7L12 2z" fill="var(--accent-purple)" opacity="0.9"/></svg>
        Admin Core
      </div>

      <div className="sidebar-menu">
        {/* KONGILA Section */}
        <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', padding: '4px 8px 6px', marginTop: '4px' }}>KONGILA</div>
        {KONGILA_NAV.map(({ key, label }) => {
          let badge = 0;
          if (key === 'interviews') badge = interviews.filter((iv: any) => iv.status === 'Scheduled' || iv.status === 'Rescheduled').length;
          else if (key === 'support') badge = supportTickets.filter((t: any) => t.status === 'Open').length;
          else if (key === 'hiring-requests') badge = requests.filter((r: any) => r.status === 'New Request').length;
          else if (key === 'contracts') badge = contracts.filter((c: any) => c.status === 'pending_signatures').length;
          else if (key === 'compliance') {
            const vettedCount = talents.filter((t: any) => t.vettingStatus === 'Vetted' || t.vettingStage === 'Vetted' || t.vettingStage === 'Vetted & Available').length;
            badge = documents.filter((d: any) => d.isMandatory && !d.isHidden && !d.userId && (d.signedByTalentIds?.length || 0) < vettedCount).length;
          }
          else if (key === 'vetting') badge = talents.filter((t: any) => t.vettingStage === 'Application Under Review').length;
          else if (key === 'matching') badge = matches.filter((m: any) => m.status === 'Draft' || m.status === 'Matched').length;
          else if (key === 'assessments') badge = assessmentResults.filter((r: any) => r.passed == null).length;
          return (
            <div key={key} className={`menu-item ${activeTab === key ? 'active' : ''}`} onClick={() => { setActiveTab(key as AdminTab); setMobileSidebarOpen(false); }}>
              <span style={{ fontSize: '15px', display: 'flex', alignItems: 'center' }}>{renderSidebarIcon(key)}</span>
              <span style={{ flex: 1 }}>{label}</span>
              {badge > 0 && <span style={{ background: 'var(--kongila-blue)', color: '#fff', borderRadius: '10px', padding: '1px 6px', fontSize: '10px', fontWeight: 700 }}>{badge}</span>}
            </div>
          );
        })}

        {/* REMOTAN Section */}
        <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--accent-teal)', textTransform: 'uppercase', letterSpacing: '0.08em', padding: '12px 8px 6px', marginTop: '8px', borderTop: '1px solid var(--border-glass)' }}>REMOTAN</div>
        {REMOTAN_NAV.map(({ key, label }) => (
          <div key={key} className={`menu-item ${activeTab === key ? 'active' : ''}`} onClick={() => { setActiveTab(key as AdminTab); setMobileSidebarOpen(false); }} style={{ color: activeTab === key ? 'var(--accent-teal)' : undefined, background: activeTab === key ? 'rgba(10,191,188,0.08)' : undefined, borderColor: activeTab === key ? 'rgba(10,191,188,0.2)' : undefined }}>
            <span style={{ fontSize: '15px', display: 'flex', alignItems: 'center' }}>{renderSidebarIcon(key)}</span>
            <span>{label}</span>
          </div>
        ))}
      </div>

      <div className="sidebar-footer">
        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Logged in as</div>
        <div style={{ fontSize: '13px', fontWeight: 600, marginTop: '2px' }}>Super Admin</div>
        <div style={{ fontSize: '11px', color: 'var(--accent-teal)', marginTop: '2px' }}>Kongila + Remotan</div>
      </div>
    </>
  );

  return (
    <div className="app-shell">
      <Head>
        <title>Kongila Admin — Dashboard</title>
        <meta name="description" content="Full admin powerhouse managing Kongila and Remotan — vetting, matching, contracts, compliance, support, and payroll." />
      </Head>

      {/* Mobile Top Bar */}
      <div className="mobile-nav-bar" style={{ display: 'none' }}>
        <div className="sidebar-logo" style={{ fontSize: '17px' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M12 2L3 7v10l9 5 9-5V7L12 2z" fill="var(--accent-purple)" opacity="0.9"/></svg>
          Admin Core
        </div>
        <button className="mobile-hamburger" onClick={() => setMobileSidebarOpen(true)}>
          <span /><span /><span />
        </button>
      </div>

      {/* Mobile Sidebar Overlay */}
      {mobileSidebarOpen && (
        <div className="mobile-sidebar-overlay" style={{ display: 'block' }} onClick={() => setMobileSidebarOpen(false)}>
          <div className="mobile-sidebar-drawer open" onClick={e => e.stopPropagation()} style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <SidebarContent />
          </div>
        </div>
      )}

      {/* Desktop Sidebar */}
      <div className="sidebar">
        <SidebarContent />
      </div>

      {pendingRejection && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.72)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
          <div style={{ width: '100%', maxWidth: '520px', background: 'var(--bg-card)', border: '1px solid var(--border-glass)', borderRadius: '12px', padding: '24px', boxShadow: '0 24px 80px rgba(0,0,0,0.35)' }}>
            <div style={{ fontSize: '12px', color: '#EF4444', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>Reject Application</div>
            <h3 style={{ fontSize: '20px', fontWeight: 900, color: 'var(--text-primary)', margin: '0 0 8px 0' }}>
              Add rejection reason
            </h3>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6, margin: '0 0 16px 0' }}>
              This reason will be stored on the stage record and included in the talent notification.
            </p>
            <textarea
              value={rejectionReasonInput}
              onChange={e => setRejectionReasonInput(e.target.value)}
              rows={5}
              placeholder="Explain why this application is being rejected..."
              className="form-input"
              style={{ width: '100%', resize: 'vertical', fontSize: '14px', padding: '12px', marginBottom: '16px' }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                onClick={() => {
                  setPendingRejection(null);
                  setRejectionReasonInput('');
                }}
                style={{ padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border-glass)', background: 'transparent', color: 'var(--text-secondary)', fontSize: '13px', fontWeight: 800, cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                disabled={saving || !rejectionReasonInput.trim()}
                onClick={() => {
                  const pending = pendingRejection;
                  if (!pending || !rejectionReasonInput.trim()) return;
                  handleStageDecision(pending.stageIdx, 'Reject', pending.score, rejectionReasonInput.trim(), false);
                }}
                style={{ padding: '10px 16px', borderRadius: '8px', border: 'none', background: !rejectionReasonInput.trim() ? '#94A3B8' : '#EF4444', color: '#fff', fontSize: '13px', fontWeight: 900, cursor: !rejectionReasonInput.trim() ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}
              >
                {saving ? 'Rejecting...' : 'Reject and Notify Talent'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="main-content">
        {renderTab()}
      </div>
    </div>
  );
}
