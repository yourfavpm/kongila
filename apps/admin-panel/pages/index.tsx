import { apiFetch } from '../lib/apiFetch';
import React, { useState, useEffect, useRef } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, LineChart, Line, AreaChart, Area, Cell, PieChart, Pie, Sector } from 'recharts';
import { supabase } from '../lib/supabaseClient';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { GlassCard, Badge, NeonButton, AgentBadge, Chip, KongilaLoader } from '@kongila/ui';
import ContractsManager from '../components/ContractsManager';
import ComplianceManager from '../components/ComplianceManager';
import FinanceManager from '../components/FinanceManager';
import AdminLogin from '../components/AdminLogin';
import { formatCurrency, formatDate, getGradeColor, viewerTimeZone, wallClockToUtc, interviewInstant, formatInstantInZone } from '@kongila/utils';
import { coerceRequestStatus } from '@kongila/workflows';
import { calculateCompositeVettingGrade, calculateMatchScore, reconcileMatchesForRequest, VETTING_STAGES, advanceTalentStage, validateStageDecision, buildDefaultVettingPipeline } from '@kongila/matching-engine';
import { computePlatformMetrics } from '@kongila/analytics';
import {
  TalentProfile, ServiceRequest, Match, AuditLog, AgentLog, Interview, RehireRequest,
  VettingStageRecord, VettingDecision, Assessment, AssessmentCategory, AssessmentQuestion, AssessmentAssignment
} from '@kongila/shared-types';
import AssessmentWizard from '../components/AssessmentWizard';
import {
  resolveRole,
  isAdminRole,
  canAccessTab,
  canManageUsers,
  ADMIN_ROLES,
  ROLE_LABELS,
  ROLE_DESCRIPTIONS
} from '@kongila/auth';

// The role model lives in @kongila/auth, with its own tests. This file used
// to keep its own list of seven accepted strings, the database CHECK allowed
// twelve, and none of it was enforced: every accepted role opened the same
// thirteen tabs.
const normalizeAdminRole = (role: any) => resolveRole(role) || '';

// Supabase Auth IDs are UUIDs, while the staging seed uses stable IDs in
// public.users. Resolve the role by Auth ID first, then by the verified email
// so the session listener does not immediately sign seeded demo admins out.
async function getAdminRoleForSession(user: any): Promise<string> {
  let { data: userData } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();

  if (!userData && user.email) {
    ({ data: userData } = await supabase
      .from('users')
      .select('role')
      .eq('email', user.email)
      .maybeSingle());
  }

  return normalizeAdminRole(userData?.role || user.user_metadata?.role || user.app_metadata?.role || '');
}

// ─── TYPE DEFINITIONS ───────────────────────────────────────────────────────

type AdminTab =
  | 'overview'
  | 'talent-pipeline'
  | 'client-pipeline'
  | 'hiring-requests'
  | 'interviews'
  | 'vetting'
  | 'matching'
  | 'offers'
  | 'contracts'
  | 'compliance'
  | 'assessments'
  | 'support'
  | 'audit'
  | 'notifications'
  | 'users'
  | 'messages'
  | 'settings'
  | 'finance'
  | 'payroll'
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
  { key: 'offers', label: 'Offer Queue' },
  { key: 'contracts', label: 'Contracts' },
  { key: 'compliance', label: 'Compliance Docs' },
  { key: 'assessments', label: 'Skill Assessments' },
  { key: 'finance', label: 'Financial System' },
  { key: 'support', label: 'Support Center' },
  { key: 'payroll', label: 'Payroll' },
  { key: 'messages', label: 'Messages' },
  { key: 'users', label: 'Users & Roles' },
  { key: 'settings', label: 'Platform Settings' },
  { key: 'notifications', label: 'Notifications' },
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
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  // The signed-in operator's role, which decides every tab they can reach.
  const [currentRole, setCurrentRole] = useState<string>('');
  const [currentAdminId, setCurrentAdminId] = useState<string>('');
  const [authChecking, setAuthChecking] = useState(true);

  // ── Core data
  const [talents, setTalents] = useState<TalentProfile[]>([]);
  const [requests, setRequests] = useState<ServiceRequest[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [contracts, setContracts] = useState<any[]>([]);
  const [contractTemplates, setContractTemplates] = useState<any[]>([]);
  // Offer queue. Read from its own endpoint rather than readDbAsync, which
  // does not read the offers table at all.
  const [offers, setOffers] = useState<any[]>([]);
  const [offersLoading, setOffersLoading] = useState(false);

  const loadOffers = async () => {
    setOffersLoading(true);
    try {
      const res = await apiFetch('/api/offers');
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        console.error('[offers] load failed:', data?.error);
        return;
      }
      setOffers(data.offers || []);
    } finally {
      setOffersLoading(false);
    }
  };

  const decideOffer = async (offerId: string, action: string, note?: string) => {
    const res = await apiFetch('/api/offers/decide', {
      method: 'POST',
      body: JSON.stringify({ offerId, action, note })
    });
    const result = await res.json().catch(() => ({}));
    if (!res.ok || !result?.ok) {
      alert(result?.error || 'Could not update the offer.');
      return;
    }
    if (result.respondBy) {
      alert(`Offer sent. The candidate has until ${new Date(result.respondBy).toLocaleDateString()} to respond.`);
    }
    await loadOffers();
  };
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
  const [assessmentResultReceived, setAssessmentResultReceived] = useState(false);
  const [assessmentSearch, setAssessmentSearch] = useState('');
  const [assessmentDropdownOpen, setAssessmentDropdownOpen] = useState(false);
  const [assessmentResults, setAssessmentResults] = useState<AssessmentResult[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [talentPayouts, setTalentPayouts] = useState<any[]>([]);
  const [feeConfigs, setFeeConfigs] = useState<any[]>([]);
  const [feeAuditLogs, setFeeAuditLogs] = useState<any[]>([]);
  
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
  // Five dimensions, matching the five that a vetting stage actually scores.
  // communication and experience were dropped from the model on 2 Nov 2026.
  const [editScores, setEditScores] = useState({ technical: 90, workSimulation: 90, behavioral: 85, personality: 80, remoteReadiness: 90 });

  // ── Vetting pipeline state
  const [activeVettingStageIdx, setActiveVettingStageIdx] = useState<number | null>(null);
  // Starts empty, not 80. It used to default to 80, and three buttons
  // submitted that 80 as a real technical or personality score with no
  // assessment behind it. An admin who deliberately typed 80 was also
  // ignored, because the code used `!== 80` to mean "the admin typed
  // something". undefined means nothing has been entered.
  const [stageScoreInput, setStageScoreInput] = useState<number | undefined>(undefined);
  const [stageRubricScores, setStageRubricScores] = useState<Record<string, number>>({});
  const [stageNotesInput, setStageNotesInput] = useState<string>('');
  const [stageDeadlineInput, setStageDeadlineInput] = useState<string>('');
  const [stageAssessmentId, setStageAssessmentId] = useState<string>('');
  const [stageInterviewDate, setStageInterviewDate] = useState<string>('');
  const [stageInterviewTime, setStageInterviewTime] = useState<string>('');
  const [stageInterviewLink, setStageInterviewLink] = useState<string>('');
  const [stagePersonalityLink, setStagePersonalityLink] = useState<string>('');
  const [stageTaskTitle, setStageTaskTitle] = useState<string>('');
  const [stageSubmissionType, setStageSubmissionType] = useState<'file' | 'essay' | 'link'>('link');
  const [stageTaskDescription, setStageTaskDescription] = useState<string>('');
  const [editScoresMode, setEditScoresMode] = useState(false);
  const [pendingRejection, setPendingRejection] = useState<{ stageIdx: number; score?: number } | null>(null);
  const [rejectionReasonInput, setRejectionReasonInput] = useState('');
  const [showPrivateNoteModal, setShowPrivateNoteModal] = useState(false);
  const [privateNoteInput, setPrivateNoteInput] = useState('');

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
      const [
        res,
        requestRes,
        supportRes,
        ivRes
      ] = await Promise.all([
        apiFetch('/api/db'),
        apiFetch('/api/requests'),
        apiFetch('/api/support'),
        apiFetch('/api/interviews')
      ]);

      // organizations, client_profiles, audit_logs and matches used to be
      // read straight from the tables here with the anon key, alongside
      // the /api/db call that already carries all four. Reading them
      // directly is exactly what RLS on those tables has to allow, so it
      // was the thing standing between here and turning RLS on.

      if (!res.ok) {
        // A 401 on first paint is expected: the poll can run before the
        // Supabase session has restored and a token is available. The next
        // tick picks the data up. Anything else is a real failure worth a dialog.
        if (res.status === 401) {
          console.info('[api/db] not authenticated yet, retrying on next sync');
        } else {
          const errText = await res.text();
          alert(`API /api/db failed! Status: ${res.status}. Error: ${errText}`);
          console.error('API /api/db failed', errText);
        }
      }

      if (res.ok) {
        const db = await res.json();
        const requestApiBody = requestRes.ok ? await requestRes.json().catch(() => ({})) : {};
        const supportApiBody = supportRes.ok ? await supportRes.json().catch(() => ({})) : {};
        const freshTalents = db.talents || [];
        setTalents(freshTalents);

        // The browser-side organizations query is subject to client RLS. For
        // seeded admin accounts the public.users ID can differ from the Auth
        // UUID, so that query may legitimately return no rows even though the
        // authenticated admin API has the data. Prefer the admin API snapshot.
        setOrganizations(db.organizations || []);

        const localRequests = (db.clientRequests || []).map((request: any) => ({
          ...request,
          status: coerceRequestStatus(request.status)
        }));
        const remoteRequests = (requestApiBody.requests || []).map((request: any) => ({
          ...request,
          status: coerceRequestStatus(request.status),
        }));
        const mergedRequests = new Map<string, any>();
        for (const request of localRequests) {
          if (request?.id) mergedRequests.set(request.id, request);
        }
        for (const request of remoteRequests) {
          if (request?.id) mergedRequests.set(request.id, { ...mergedRequests.get(request.id), ...request });
        }
        setRequests(Array.from(mergedRequests.values()));

        // ── Load matches from Supabase (primary source) so admin always sees submitted candidates ──
        const supaMatches = db.matches;
        if (supaMatches && supaMatches.length > 0) {
          setMatches(supaMatches.map((m: any) => ({
            ...m,
            requestId: m.request_id || m.requestId,
            talentId: m.talent_id || m.talentId,
          })));
        } else {
          setMatches(db.matches || []);
        }
        setClientProfiles(db.clientProfiles || []);
        setAuditLogs(db.auditLogs || []);
        
        setContracts(db.contracts || []);
        setContractTemplates(db.contractTemplates || []);
        setAgentLogs(db.agentLogs || []);
        setRehireRequests(db.rehireRequests || []);
        setUsers(db.users || []);
        setDocuments(db.documents || []);
        setSupportTickets(supportApiBody.tickets || db.supportTickets || []);
        setSupportMessages(supportApiBody.messages || db.supportMessages || []);
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
      if (!ivRes.ok) {
        const errText = await ivRes.text();
        alert(`API /api/interviews failed! Status: ${ivRes.status}. Error: ${errText}`);
        console.error('API /api/interviews failed', errText);
      }
      
      if (ivRes.ok) {
        const ivData = await ivRes.json();
        setInterviews(Array.isArray(ivData) ? ivData : []);
      }
    } catch (e) {
      console.error('Failed to sync DB', e);
    } finally {
      setLoading(false);
      if (typeof window !== 'undefined') sessionStorage.setItem('kongila_admin_loaded', 'true');
    }
  };

  useEffect(() => {
    if (typeof window !== 'undefined' && sessionStorage.getItem('kongila_admin_loaded')) {
      setLoading(false);
    }
    const sessionCheck = Promise.race([
      supabase.auth.getSession(),
      new Promise<any>(resolve => setTimeout(() => resolve({ data: { session: null } }), 5000))
    ]);

    sessionCheck.then(async ({ data: { session } }) => {
      try {
        if (session?.user) {
          const role = await getAdminRoleForSession(session.user);
          // Admin access comes from an existing role in public.users and nothing
          // else. This branch used to auto-provision: any @kongila.co address
          // with no users row was written one with role 'admin' from the
          // browser, and admin@kongila.co was additionally given super_admin.
          // Anyone able to register on that domain became an administrator.
          // Admin accounts are now created deliberately, server-side or in the
          // SQL editor.
          if (isAdminRole(role)) {
            setIsAuthenticated(true);
            // Remembered, because every tab check needs it. The portal used
            // to show the same thirteen tabs to all seven accepted roles.
            setCurrentRole(role);
            setCurrentAdminId(session.user.id);
            if (typeof window !== 'undefined') sessionStorage.setItem('kongila_admin_auth', 'true');
          } else {
            await supabase.auth.signOut();
            setIsAuthenticated(false);
            setCurrentRole('');
            setCurrentAdminId('');
            if (typeof window !== 'undefined') sessionStorage.removeItem('kongila_admin_auth');
          }
        } else {
          setIsAuthenticated(false);
          setCurrentRole('');
          setCurrentAdminId('');
          if (typeof window !== 'undefined') sessionStorage.removeItem('kongila_admin_auth');
        }
      } catch (err) {
        console.error('Auth check failed', err);
      } finally {
        setAuthChecking(false);
      }
    }).catch(err => {
      console.error('getSession failed', err);
      setAuthChecking(false);
    });

    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        const role = await getAdminRoleForSession(session.user);
        // No auto-provisioning here either. See the note on the getSession
        // branch above.
        if (isAdminRole(role)) {
          setIsAuthenticated(true);
          setCurrentRole(role);
          setCurrentAdminId(session.user.id);
        } else {
          await supabase.auth.signOut();
          setIsAuthenticated(false);
          setCurrentRole('');
        }
      } else if (event === 'SIGNED_OUT') {
        setIsAuthenticated(false);
        setCurrentRole('');
        setCurrentAdminId('');
        if (typeof window !== 'undefined') sessionStorage.removeItem('kongila_admin_auth');
      }
    });

    return () => authListener.subscription.unsubscribe();
  }, []);

  // Do not call protected APIs until authentication has completed. Previously
  // this ran on the login screen and repeatedly produced /api/interviews 401s.
  useEffect(() => {
    if (!isAuthenticated) return;

    syncFromDb();
    const interval = setInterval(() => syncFromDb(), 4000);
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
    // syncFromDb is intentionally the current render's authenticated loader.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  useEffect(() => {
    if (selectedTalent) {
      setEditScores({
        technical: selectedTalent.vettingScores.technical,
        workSimulation: selectedTalent.vettingScores.workSimulation,
        behavioral: selectedTalent.vettingScores.behavioral,
        personality: selectedTalent.vettingScores.personality,
        remoteReadiness: selectedTalent.vettingScores.remoteReadiness,
      });
    }
  }, [selectedTalent]);

  useEffect(() => {
    if (router.query.tab) {
      setActiveTab(router.query.tab as AdminTab);
    }
  }, [router.query.tab]);

  // ── Messaging ───────────────────────────────────────────────────────────
  // The admin portal had none, so a candidate or client writing to support
  // was writing into a void.
  const [conversations, setConversations] = useState<any[]>([]);
  const [convoMessages, setConvoMessages] = useState<any[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string>('');
  const [messageDraft, setMessageDraft] = useState('');
  const [messagingLoading, setMessagingLoading] = useState(false);

  const loadMessaging = async () => {
    setMessagingLoading(true);
    try {
      const response = await apiFetch('/api/messages');
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || `Could not load messages (${response.status}).`);
      setConversations(payload.conversations || []);
      setConvoMessages(payload.messages || []);
    } catch (err) {
      console.error('[admin] messages not loaded:', err);
    } finally {
      setMessagingLoading(false);
    }
  };

  const sendAdminMessage = async () => {
    if (!messageDraft.trim() || !activeConversationId) return;
    const text = messageDraft.trim();
    setMessageDraft('');
    try {
      const response = await apiFetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId: activeConversationId, content: text })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || 'Your message was not sent.');
      await loadMessaging();
    } catch (err: any) {
      setMessageDraft(text);
      alert(err?.message || 'Your message was not sent.');
    }
  };

  useEffect(() => {
    if (activeTab === 'messages' && isAuthenticated) loadMessaging();
  }, [activeTab, isAuthenticated]);

  useEffect(() => {
    if (!activeConversationId) return;
    apiFetch('/api/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'markRead', conversationId: activeConversationId })
    }).catch(err => console.error('[admin] could not mark messages read:', err));
  }, [activeConversationId]);

  // ── Platform settings ───────────────────────────────────────────────────
  const [platformSettings, setPlatformSettings] = useState<any[]>([]);
  const [settingsLoading, setSettingsLoading] = useState(false);

  const loadPlatformSettings = async () => {
    setSettingsLoading(true);
    try {
      const response = await apiFetch('/api/settings');
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || `Could not load settings (${response.status}).`);
      setPlatformSettings(payload.settings || []);
    } catch (err) {
      console.error('[admin] settings not loaded:', err);
    } finally {
      setSettingsLoading(false);
    }
  };

  const saveSetting = async (key: string, raw: string) => {
    let value: any;
    try {
      value = JSON.parse(raw);
    } catch {
      // A bare string the operator typed without quotes.
      value = raw;
    }
    try {
      const response = await apiFetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, value })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || 'That setting was not saved.');
      await loadPlatformSettings();
    } catch (err: any) {
      alert(err?.message || 'That setting was not saved.');
      await loadPlatformSettings();
    }
  };

  useEffect(() => {
    if (activeTab === 'settings' && isAuthenticated) loadPlatformSettings();
  }, [activeTab, isAuthenticated]);

  // ── Operator accounts ───────────────────────────────────────────────────
  const [operators, setOperators] = useState<any[]>([]);
  const [operatorsLoading, setOperatorsLoading] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [inviteRole, setInviteRole] = useState<string>('ops_manager');
  const [inviteBusy, setInviteBusy] = useState(false);

  const loadOperators = async () => {
    setOperatorsLoading(true);
    try {
      const response = await apiFetch('/api/users');
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || `Could not load operators (${response.status}).`);
      setOperators(payload.operators || []);
    } catch (err: any) {
      console.error('[admin] operators not loaded:', err);
      alert(err?.message || 'Could not load operators.');
    } finally {
      setOperatorsLoading(false);
    }
  };

  const callUsersApi = async (body: any, successMessage: string) => {
    try {
      const response = await apiFetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || `That did not work (${response.status}).`);
      alert(successMessage);
      await loadOperators();
      return true;
    } catch (err: any) {
      alert(err?.message || 'That did not work.');
      return false;
    }
  };

  const submitInvite = async () => {
    if (!inviteEmail.trim()) return;
    setInviteBusy(true);
    const sent = await callUsersApi(
      { action: 'invite', email: inviteEmail.trim(), name: inviteName.trim(), role: inviteRole },
      `Invitation sent to ${inviteEmail.trim()}. They set their own password from the link.`
    );
    if (sent) { setInviteEmail(''); setInviteName(''); }
    setInviteBusy(false);
  };

  useEffect(() => {
    if (activeTab === 'users' && isAuthenticated) loadOperators();
  }, [activeTab, isAuthenticated]);

  // The operations inbox. The admin portal never read the notifications
  // table, so everything addressed to operations — a replacement request, a
  // candidate declining an offer, a client rejecting a whole shortlist — was
  // written and then seen by nobody.
  const [adminNotifications, setAdminNotifications] = useState<any[]>([]);
  const [adminNotificationsLoading, setAdminNotificationsLoading] = useState(false);

  const loadAdminNotifications = async () => {
    setAdminNotificationsLoading(true);
    try {
      const response = await apiFetch('/api/notifications');
      if (!response.ok) throw new Error(`Could not load notifications (${response.status}).`);
      const payload = await response.json();
      setAdminNotifications(payload.notifications || []);
    } catch (err) {
      console.error('[admin] notifications not loaded:', err);
    } finally {
      setAdminNotificationsLoading(false);
    }
  };

  const markAdminNotificationsRead = async (ids?: string[]) => {
    const target = ids || adminNotifications.filter(n => !n.read).map(n => n.id);
    if (target.length === 0) return;
    setAdminNotifications(adminNotifications.map(n =>
      target.includes(n.id) ? { ...n, read: true } : n
    ));
    try {
      await apiFetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ markRead: true, notificationIds: target })
      });
    } catch (err) {
      console.error('[admin] could not mark notifications read:', err);
    }
  };

  useEffect(() => {
    if (activeTab === 'notifications' && isAuthenticated) loadAdminNotifications();
  }, [activeTab, isAuthenticated]);

  // Refresh the offer queue when its tab is opened. It is not part of the
  // four-second whole-database poll, so it does not add to that load.
  //
  // This has to live up here with the other hooks. It was below the
  // `if (loading) return` guard, so on a render where loading was true React
  // saw one hook fewer than the render before and threw "Rendered more hooks
  // than during the previous render", taking the whole admin console down.
  useEffect(() => {
    if (activeTab === 'offers' && isAuthenticated) loadOffers();
  }, [activeTab, isAuthenticated]);

  // ─── METRICS ────────────────────────────────────────────────────────────────

  const metrics = computePlatformMetrics(talents, requests, matches, contracts);
  // Contract value under management, not "revenue". Revenue needs a
  // platform fee rate, which is not configured anywhere, so the old figure
  // was contract value times a hardcoded 1.25 presented as money earned.
  const mrrTotal = metrics.monthlyContractValue;
  const utilizationRate = metrics.utilizationRate;
  const activeTalentCount = metrics.activeTalentCount;
  /** Renders a metric that may not be computable, rather than showing 0. */
  const orNotAvailable = (value: number | null, suffix = '') =>
    value === null ? 'Not available' : `${value}${suffix}`;

  // ─── HANDLERS ───────────────────────────────────────────────────────────────

  // saveToDb is gone. It posted the browser's whole in-memory copy of the
  // database to /api/db, which upserts about twenty tables from it, so any
  // one action rewrote every row the screen was holding. Every write now
  // goes to the route that owns that thing.

  const updateRequestCollections = (requestId: string, nextStatus: string, patch: Record<string, any> = {}) => {
    const normalizedStatus = coerceRequestStatus(nextStatus);
    const updatedRequests = requests.map(request => (
      request.id === requestId
        ? { ...request, ...patch, status: normalizedStatus }
        : request
    ));
    const updatedSelectedRequest = selectedRequest?.id === requestId
      ? { ...selectedRequest, ...patch, status: normalizedStatus }
      : selectedRequest;
    setRequests(updatedRequests);
    if (updatedSelectedRequest) {
      setSelectedRequest(updatedSelectedRequest as any);
    }
    return updatedRequests;
  };

  /**
   * Status changes go through the server, which checks the move is legal
   * before writing and records who made it. A refused move returns 409 with
   * an explanation and nothing is written.
   *
   * Returns true when the status landed, so callers can avoid showing a
   * success message for a change that did not happen.
   */
  const persistTalentRequestStatus = async (requestId: string, status: string, patch: Record<string, any> = {}): Promise<boolean> => {
    const request = requests.find(r => r.id === requestId);
    if (!request) return false;

    const res = await apiFetch('/api/requests/status', {
      method: 'POST',
      body: JSON.stringify({
        requestId,
        status,
        patch: {
          assignedAccountManagerId: patch.assignedAccountManagerId,
          assignedTalentManagerId: patch.assignedTalentManagerId,
          accountManagerNotes: patch.accountManagerNotes,
          talentManagerNotes: patch.talentManagerNotes
        }
      })
    });
    const result = await res.json().catch(() => ({}));

    if (!res.ok) {
      console.error('[requests] status change refused:', result?.error);
      alert(result?.error || 'Could not update the request status.');
      return false;
    }

    return true;
  };

  // Vetting
  const handleVettingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTalent) return;
    setSaving(true);
    // Through the server. The grade and vetting status used to be computed
    // in the browser and posted with the whole talents array through
    // /api/db, which upserts every candidate's row from whatever the screen
    // was holding. The grade is computed server side from the scores now,
    // and only this candidate's row is written.
    try {
      const res = await apiFetch('/api/vetting', {
        method: 'POST',
        body: JSON.stringify({ action: 'scores', talentId: selectedTalent.id, scores: editScores })
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(result?.error || 'Those scores were not saved.');
        setSaving(false);
        return;
      }

      const updatedTalents = talents.map(t =>
        t.id === selectedTalent.id
          ? { ...t, vettingScores: result.scores, grade: result.grade, vettingStatus: result.vettingStatus }
          : t
      );
      setTalents(updatedTalents);
      setSelectedTalent(updatedTalents.find(t => t.id === selectedTalent.id) || null);
    } catch (e: any) {
      console.error('Failed to save vetting scores', e);
      alert(e?.message || 'Those scores were not saved.');
    }

    setSaving(false);
  };

  /**
   * Tells both sides of an interview what happened, each in their own zone.
   *
   * Nothing used to notify anyone about a reschedule. The candidate set a
   * flag, the admin queue read it, and whatever the admin decided went back
   * into the database with no message to either party.
   */
  const notifyBothPartiesOfInterview = async (
    interview: any,
    kind: 'scheduled' | 'rescheduled' | 'declined'
  ) => {
    const iso = interviewInstant(interview);
    const recipients: Array<{ userId: string; zone: string | null }> = [];
    if (interview.talentId) {
      recipients.push({ userId: interview.talentId, zone: interview.talentTimezone || null });
    }
    if (interview.clientId) {
      recipients.push({ userId: interview.clientId, zone: interview.clientTimezone || null });
    }
    if (recipients.length === 0) return;

    // Through the server. The insert that used to be here wrote to the
    // notifications table from the browser, where RLS is on with no policy,
    // so every write was denied and neither side was ever told. The route
    // sends the email too, in each person's own timezone.
    const event = kind === 'rescheduled' ? 'interview_rescheduled' : 'interview_scheduled';

    try {
      const response = await apiFetch('/api/notifications', {
        method: 'POST',
        body: JSON.stringify({
          event,
          userIds: recipients.map(r => r.userId),
          context: {
            roleTitle: interview.title || undefined,
            when: iso ? formatInstantInZone(iso, 'UTC') + ' (UTC)' : undefined,
            talentName: interview.talentName || undefined,
            joiningDetails: interview.meetingLink || undefined,
            reason: kind === 'declined' ? 'The reschedule request was declined.' : undefined
          }
        })
      });
      if (!response.ok) {
        const detail = await response.json().catch(() => ({}));
        console.error('[interviews] notification not sent:', detail?.error);
      }
    } catch (e) {
      console.error('[interviews] notification not sent:', e);
    }
  };

  // Stage-level vetting decision handler
  const handleStageDecision = async (stageIdx: number, decision: VettingDecision, score: number | undefined, notes: string, forceReasonModal = false) => {
    if (!selectedTalent) return;
    if (decision === 'Reject' && (forceReasonModal || !notes.trim())) {
      setPendingRejection({ stageIdx, score });
      setRejectionReasonInput(notes.trim());
      return;
    }

    // Personality Test, Remote Readiness and Work Simulation used to pass with
    // no score. Between them they are 40% of the composite grade, so a
    // candidate who passed every stage reached 60 and was graded Reject.
    const currentPipelineForCheck: VettingStageRecord[] = normalizeVettingPipeline(selectedTalent.vettingPipeline);
    const scoreProblem = validateStageDecision(stageIdx, decision, score, currentPipelineForCheck);
    if (scoreProblem) {
      alert(scoreProblem);
      return;
    }

    setSaving(true);
    const currentPipeline: VettingStageRecord[] = normalizeVettingPipeline(selectedTalent.vettingPipeline);
    let updatedPipeline: VettingStageRecord[];
    try {
      updatedPipeline = advanceTalentStage(currentPipeline, stageIdx, decision, score, notes);
    } catch (err: any) {
      setSaving(false);
      alert(err?.message || 'That stage decision could not be applied.');
      return;
    }
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
        // The operator enters a wall-clock time in their own zone. Record the
        // instant it refers to, and which zone that was, so both portals can
        // show their own party the right time.
        const adminZone = viewerTimeZone();
        const newInstant = wallClockToUtc(stageInterviewDate, stageInterviewTime, adminZone);
        const existingId = currentPipeline[stageIdx]?.interviewId;
        const existing = existingId
          ? (payload.interviews || interviews).find((i: any) => i.id === existingId)
          : null;

        if (existing) {
          // Rescheduling. This used to fall through to the create branch
          // below, so approving a reschedule minted a second interview row
          // and left the first one Scheduled forever — the admin queue showed
          // two live interviews for one conversation and the candidate got
          // two calendar entries.
          const moved = {
            ...existing,
            date: stageInterviewDate,
            time: stageInterviewTime,
            scheduledTime: newInstant,
            scheduledTimezone: adminZone,
            talentTimezone: existing.talentTimezone || (selectedTalent as any).timezone || null,
            rescheduledFrom: existing.scheduledTime || null,
            status: 'Rescheduled',
            meetingLink: stageInterviewLink || existing.meetingLink,
            rescheduleRequested: false,
            rescheduleReason: null,
            rescheduleRequestedBy: null,
            rescheduleRequestedAt: null,
            proposedNewDate: null,
            proposedNewTime: null,
            proposedTime: null,
            proposedTimezone: null
          };
          payload.interviews = (payload.interviews || interviews).map((i: any) =>
            i.id === existingId ? moved : i
          );
          setInterviews(payload.interviews);
          updatedPipeline[stageIdx].interviewDate = stageInterviewDate;
          updatedPipeline[stageIdx].interviewTime = stageInterviewTime;
          updatedPipeline[stageIdx].interviewScheduledTime = newInstant || undefined;
          updatedPipeline[stageIdx].interviewTimezone = adminZone;
          updatedPipeline[stageIdx].meetingLink = stageInterviewLink || updatedPipeline[stageIdx].meetingLink;
          updatedPipeline[stageIdx].rescheduleRequested = false;
          updatedPipeline[stageIdx].rescheduleReason = undefined;
          notifyBothPartiesOfInterview(moved, 'rescheduled');
        } else {

        // Scheduling for the first time.
        const interview = {
          id: `int_${Date.now()}`,
          talentId: selectedTalent.id,
          talentName: selectedTalent.name,
          clientName: 'Kongila Vetting Panel',
          title: `Behavioural Interview: ${selectedTalent.name}`,
          date: stageInterviewDate,
          time: stageInterviewTime,
          scheduledTime: newInstant,
          scheduledTimezone: adminZone,
          talentTimezone: (selectedTalent as any).timezone || null,
          status: 'Scheduled',
          meetingLink: stageInterviewLink,
          createdAt: timestamp
        };
        updatedPipeline[stageIdx].interviewScheduledTime = newInstant || undefined;
        updatedPipeline[stageIdx].interviewTimezone = adminZone;
        updatedPipeline[stageIdx].interviewId = interview.id;
        // Store these on the stage record so the waiting UI can display them
        updatedPipeline[stageIdx].interviewDate = stageInterviewDate;
        updatedPipeline[stageIdx].interviewTime = stageInterviewTime;
        updatedPipeline[stageIdx].meetingLink = stageInterviewLink;
        updatedPipeline[stageIdx].rescheduleRequested = false;
        updatedPipeline[stageIdx].rescheduleReason = undefined;
        payload.interviews = [...interviews, interview];
        setInterviews(payload.interviews);
        notifyBothPartiesOfInterview(interview, 'scheduled');
        }
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
          submissionType: stageSubmissionType,
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

    // Update interview status to Completed if the stage had an interview
    let updatedInterviews = payload.interviews || interviews;
    if ((decision === 'Proceed' || decision === 'Reject') && currentPipeline[stageIdx]?.interviewId) {
      updatedInterviews = updatedInterviews.map((iv: any) => 
        iv.id === currentPipeline[stageIdx].interviewId
          ? { ...iv, status: 'Completed', outcome: decision }
          : iv
      );
      payload.interviews = updatedInterviews;
      setInterviews(updatedInterviews);
    }

    // Determine new vettingStage name
    const nextInProgressIdx = updatedPipeline.findIndex(s => s.status === 'in_progress');
    const newVettingStage = nextInProgressIdx >= 0
      ? updatedPipeline[nextInProgressIdx].stageName
      : decision === 'Reject' ? 'Application Screening' : 'Final Review';

    const calculation = calculateCompositeVettingGrade(updatedVettingScores);

    // Final Review used to grant Vetted unconditionally, so a composite below
    // the Reject line still produced a deployable candidate. A candidate who
    // finishes the pipeline below grade is held at Review for a human to look
    // at, not quietly passed.
    const passedFinalReview = stageIdx === 6 && calculation.grade !== 'Reject';
    const newVettingStatus = decision === 'Reject'
      ? 'Review' as const
      : stageIdx === 6
        ? (passedFinalReview ? 'Vetted' as const : 'Review' as const)
        : selectedTalent.vettingStatus;

    if (stageIdx === 6 && !passedFinalReview) {
      alert(
        `${selectedTalent.name} finished vetting with a composite of ${calculation.score}%, ` +
        `which grades as Reject. The pipeline is complete but the candidate is held at ` +
        `Review rather than marked Vetted. Reopen a stage to re-assess, or reject.`
      );
    }

    const updatedTalent: any = {
      ...selectedTalent,
      vettingPipeline: updatedPipeline,
      vettingScores: updatedVettingScores,
      vettingStage: newVettingStage,
      vettingStatus: newVettingStatus,
      grade: calculation.grade,
    };

    // AC-T-012 & AC-T-014: tell the candidate.
    //
    // The body sent here was { talentId, type, stage, isRejection, subject,
    // message }, and the route reads { event, userIds, context }. Nothing
    // matched, so `event is required` came back and every stage transition
    // notification was dropped.
    apiFetch('/api/notifications', {
      method: 'POST',
      body: JSON.stringify({
        event: decision === 'Reject' ? 'application_rejected' : 'stage_advanced',
        userIds: [selectedTalent.id],
        context: {
          stageName: VETTING_STAGES[stageIdx]?.name,
          reason: decision === 'Reject' ? notes : undefined
        }
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

    // This candidate's grade or vetting status may have just changed, so
    // every request they appear on is rescored and, if they are no longer
    // eligible, they come off the shortlist. Matches used to be built once at
    // intake and never revisited, so a candidate rejected at vetting stayed
    // in front of the client indefinitely.
    let reconciledMatches = matches;
    const affectedRequestIds = Array.from(new Set(
      matches.filter(m => m.talentId === selectedTalent.id).map(m => m.requestId)
    ));
    for (const reqId of affectedRequestIds) {
      const req = requests.find(r => r.id === reqId);
      if (!req) continue;
      const result = reconcileMatchesForRequest(req, updatedTalents, reconciledMatches);
      reconciledMatches = result.matches as typeof matches;
      if (result.removed > 0 || result.rescored > 0) {
        console.info(
          `[matching] request ${reqId}: ${result.rescored} rescored, ${result.removed} removed, ${result.added} added`
        );
      }
    }
    setMatches(reconciledMatches);

    setTalents(updatedTalents);
    setSelectedTalent(updatedTalent as TalentProfile);
    setAuditLogs([newAuditLog, ...auditLogs]);
    setAgentLogs([newAgentLog, ...agentLogs]);
    setActiveVettingStageIdx(null);
    setStageNotesInput('');
    setStageScoreInput(undefined);
    setStageRubricScores({});
    setStageAssessmentId('');
    setStageInterviewDate('');
    setStageInterviewTime('');
    setStageInterviewLink('');
    setStagePersonalityLink('');
    setStageTaskTitle('');
    setStageSubmissionType('link');
    setStageTaskDescription('');
    setStageDeadlineInput('');
    setPendingRejection(null);
    setRejectionReasonInput('');

    // Through the server. This used to post the whole talents array, every
    // request, every match, the interviews and the assessments back through
    // /api/db, which upserts all of them. One stage decision rewrote the
    // entire database from browser state, repacking every candidate's bio
    // envelope on the way.
    try {
      const res = await apiFetch('/api/vetting', {
        method: 'POST',
        body: JSON.stringify({
          action: 'pipeline',
          talentId: selectedTalent.id,
          pipeline: updatedPipeline,
          vettingStage: newVettingStage,
          vettingStatus: newVettingStatus,
          scores: updatedVettingScores,
          auditAction: `Stage Decision: ${VETTING_STAGES[stageIdx]?.name}`,
          auditDetails: `Decision: ${decision}. Score: ${score ?? 'none'}. Notes: ${notes || 'none'}.`
        })
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(result?.error || 'That decision was not saved.');
        setSaving(false);
        return;
      }
    } catch (e: any) {
      console.error('Failed to save stage decision', e);
      alert(e?.message || 'That decision was not saved.');
      setSaving(false);
      return;
    }

    setSaving(false);
  };

  /**
   * Approving or declining a reschedule, through the server.
   *
   * Both of these used to patch the interviews array in the browser and push
   * it through saveToDb. That route could not check for a clash at the new
   * time, told neither party, and moved only the wall-clock text while
   * leaving the stored timestamp on the original slot, so the two disagreed.
   */
  const decideRescheduleRequest = async (iv: any, approve: boolean) => {
    setSaving(true);
    try {
      const response = await apiFetch('/api/interviews/reschedule-decision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          interviewId: iv.id,
          approve,
          scheduledTime: approve ? (iv.proposedTime || null) : null,
          date: approve ? (iv.proposedNewDate || null) : null,
          time: approve ? (iv.proposedNewTime || null) : null,
          timezone: iv.proposedTimezone || iv.scheduledTimezone || null
        })
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        alert(payload?.error || `Could not apply that decision (${response.status}).`);
        return;
      }

      const updated = payload.interview;
      setInterviews(interviews.map((i: any) => (i.id === iv.id ? { ...i, ...updated } : i)));

      if (payload.warnings?.length) {
        console.warn('[admin] reschedule decision warnings:', payload.warnings);
      }

      // The pipeline stage holds a pointer, so clearing the flag there keeps
      // the vetting drawer in step. The time itself lives on the interview.
      if (iv.talentId) {
        const talent = talents.find((t: any) => t.id === iv.talentId);
        if (talent?.vettingPipeline) {
          const newPipeline = talent.vettingPipeline.map((stage: any) =>
            stage.interviewId === iv.id
              ? { ...stage, rescheduleRequested: false, rescheduleReason: undefined }
              : stage
          );
          const updatedTalent = { ...talent, vettingPipeline: newPipeline };
          const updatedTalents = talents.map((t: any) => (t.id === talent.id ? updatedTalent : t));
          setTalents(updatedTalents);
          if (selectedTalent?.id === talent.id) setSelectedTalent(updatedTalent as TalentProfile);
          const res = await apiFetch('/api/vetting', {
            method: 'POST',
            body: JSON.stringify({
              action: 'pipeline',
              talentId: talent.id,
              pipeline: newPipeline,
              auditAction: 'Clear Reschedule Flag',
              auditDetails: `Reschedule flag cleared on interview ${iv.id}.`
            })
          });
          if (!res.ok) {
            const detail = await res.json().catch(() => ({}));
            console.error('[vetting] pipeline not saved:', detail?.error);
          }
        }
      }
    } finally {
      setSaving(false);
    }
  };

  const handleGlobalApproveReschedule = (iv: any) => decideRescheduleRequest(iv, true);
  const handleGlobalRejectReschedule = (iv: any) => decideRescheduleRequest(iv, false);

  const handleRejectReschedule = async () => {
    if (!selectedTalent) return;
    setSaving(true);
    const currentPipeline = [...(selectedTalent.vettingPipeline || [])];
    if (currentPipeline[2]) {
      currentPipeline[2].rescheduleRequested = false;
      currentPipeline[2].rescheduleReason = undefined;
    }
    
    const updatedTalent = { ...selectedTalent, vettingPipeline: currentPipeline };
    const updatedTalents = talents.map(t => t.id === selectedTalent.id ? updatedTalent : t);
    
    setTalents(updatedTalents);
    setSelectedTalent(updatedTalent as TalentProfile);

    try {
      const res = await apiFetch('/api/vetting', {
        method: 'POST',
        body: JSON.stringify({
          action: 'pipeline',
          talentId: selectedTalent.id,
          pipeline: currentPipeline,
          auditAction: 'Reject Reschedule Request',
          auditDetails: `Reschedule request declined for ${selectedTalent.name}.`
        })
      });
      if (!res.ok) {
        const detail = await res.json().catch(() => ({}));
        alert(detail?.error || 'That decision was not saved.');
      }
    } catch (e: any) {
      console.error('Failed to save pipeline', e);
      alert(e?.message || 'That decision was not saved.');
    }

    setSaving(false);
  };

  const handleReAssess = async (stageIdx: number) => {
    if (!selectedTalent || saving) return;
    setSaving(true);
    
    // Reset the target stage to in_progress, and all subsequent stages to pending.
    const updatedPipeline = (selectedTalent.vettingPipeline || []).map((s, idx) => {
      if (idx === stageIdx) return { ...s, status: 'in_progress', completedAt: undefined, decision: undefined };
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
    
    setTalents(updatedTalents);
    setSelectedTalent(updatedTalent as TalentProfile);

    // Through the server. This used to post the whole talents array and an
    // audit entry attributed to 'Ops Lead' through /api/db.
    try {
      const res = await apiFetch('/api/vetting', {
        method: 'POST',
        body: JSON.stringify({
          action: 'pipeline',
          talentId: selectedTalent.id,
          pipeline: updatedPipeline,
          vettingStage: newVettingStage,
          auditAction: `Re-assess Stage ${stageIdx + 1}`,
          auditDetails: `Reopened stage ${stageIdx + 1} for ${selectedTalent.name}.`
        })
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(result?.error || 'That stage was not reopened.');
        setSaving(false);
        return;
      }
    } catch (e: any) {
      console.error('Failed to reopen stage', e);
      alert(e?.message || 'That stage was not reopened.');
    }

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

    const talentName = talents.find(t => t.id === targetMatch.talentId)?.name || 'Contractor';

    // Through the matching route, which writes the match as 'proposed',
    // moves the request and tells the client. This used to set the status
    // to 'Shortlisted' in title case, which matches_status_check does not
    // allow, and post the whole database through /api/db: the candidate's
    // notification went to a table that denies browser writes, and the
    // client id fell back to the literal string 'usr_horizon'.
    try {
      const res = await apiFetch('/api/matching/submit', {
        method: 'POST',
        body: JSON.stringify({
          requestId: targetMatch.requestId,
          candidates: [{
            talentId: targetMatch.talentId,
            score: (targetMatch as any).score,
            breakdown: (targetMatch as any).breakdown
          }]
        })
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(result?.error || `${talentName} was not pushed to the client.`);
        return;
      }

      setMatches(matches.map(m => m.id === matchId ? { ...m, status: 'proposed' as any } : m));
      if (result.warnings?.length) console.warn('[matching]', result.warnings.join(' '));
      alert(`${talentName} is now in front of the client.`);
    } catch (e: any) {
      console.error('Failed to push match', e);
      alert(e?.message || `${talentName} was not pushed to the client.`);
    }
  };

  const handleRecordResult = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const payload = { type: 'result', ...resultForm, score: Number(resultForm.score) };
    try {
      const res = await apiFetch('/api/assessments', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
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
      await apiFetch('/api/assessments', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: assessmentId, status: 'archived' }) });
      await syncFromDb();
    } catch (e) { console.error(e); }
  };

  // Support
  const handleSupportReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicket || !supportReply.trim()) return;
    setSaving(true);
    try {
      const res = await apiFetch('/api/support', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'message', ticketId: selectedTicket.id, senderName: 'Admin Support', senderRole: 'Support', text: supportReply }) });
      if (res.ok) {
        setSupportReply('');
        await syncFromDb();
      }
    } catch (e) { console.error(e); }
    setSaving(false);
  };

  const handleUpdateTicketStatus = async (ticketId: string, newStatus: string) => {
    try {
      const res = await apiFetch('/api/support', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: ticketId, status: newStatus }) });
      if (res.ok) {
        await syncFromDb();
        if (selectedTicket?.id === ticketId) setSelectedTicket({ ...selectedTicket, status: newStatus });
      }
    } catch (e) { console.error(e); }
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

    // A candidate who has changed something material since being vetted is
    // not shortlistable until an operator has looked again.
    if ((talent as any).requiresReReview) {
      alert(`${talent.name} has edited their profile since being vetted and is flagged for re-review. Clear the flag before shortlisting them.`);
      return;
    }
    // Was a random number between 84 and 98, with random breakdown bars to
    // match, shown to the client as a match score. It is now the real score
    // from the one scoring function, the same number automatic matching and
    // the matching screen produce.
    const { score: matchScore, breakdown: matchBreakdown } = calculateMatchScore(talent, selectedRequest);
    const newMatch: Match = {
      id: `match_${selectedRequest.id}_${talentId}`,
      requestId: selectedRequest.id,
      talentId,
      score: matchScore,
      breakdown: matchBreakdown,
      status: 'Shortlisted'
    };
    // Through the matching route. This built a match with status
    // 'Shortlisted' in title case, which matches_status_check does not
    // allow, and posted the whole database through /api/db: the client's
    // notification went to a table that denies browser writes, and the
    // client id fell back to the literal string 'usr_horizon'. The route
    // writes the match as 'proposed', which is what operations submitting
    // a candidate means, and tells the client.
    try {
      const res = await apiFetch('/api/matching/submit', {
        method: 'POST',
        body: JSON.stringify({
          requestId: selectedRequest.id,
          candidates: [{ talentId, score: matchScore, breakdown: matchBreakdown }]
        })
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(result?.error || `${talent.name} was not shortlisted.`);
        return;
      }
      setMatches([...matches, ...(result.matches || [])]);
      if (result.warnings?.length) console.warn('[matching]', result.warnings.join(' '));
    } catch (e: any) {
      console.error('Failed to shortlist candidate', e);
      alert(e?.message || `${talent.name} was not shortlisted.`);
      return;
    }

    alert(`${talent.name} has been shortlisted successfully.`);
  };

  const handleAcceptInterviewRequest = async (matchId: string) => {
    const match = matches.find(m => m.id === matchId);
    if (!match || !selectedRequest) return;
    const talent = talents.find(t => t.id === match.talentId);
    if (!talent) return;
    const proposedDate = (match as any).requestedDate || new Date().toISOString().split('T')[0];
    const proposedTime = (match as any).requestedTime || '10:00';
    const adminZone = viewerTimeZone();
    const interviewResponse = await apiFetch('/api/interviews', {
      method: 'POST',
      body: JSON.stringify({
        requestId: selectedRequest.id,
        matchId: match.id,
        talentId: match.talentId,
        clientId: selectedRequest.clientId,
        talentName: talent.name,
        talentAvatar: talent.avatar || null,
        clientName: selectedRequest.clientName || null,
        title: `${selectedRequest.serviceType} - Interview with ${talent.name}`,
        date: proposedDate,
        time: proposedTime,
        timezone: adminZone,
        talentTimezone: (talent as any).timezone || null,
        meetingLink: null,
        notes: (match as any).requestedNotes || null
      })
    });
    const interviewBody = await interviewResponse.json().catch(() => ({}));
    if (!interviewResponse.ok || !interviewBody.interview) {
      alert(`Failed to schedule interview: ${interviewBody.error || interviewResponse.status}`);
      return;
    }
    setMatches(matches.map(m => m.id === matchId ? { ...m, status: 'Interview Scheduled' as const } : m));
    setInterviews([interviewBody.interview, ...interviews]);
    await persistTalentRequestStatus(selectedRequest.id, 'Client Interview', selectedRequest);
    alert(`Interview with ${talent.name} scheduled successfully.`);
    return;
  };

  const handleApproveRehire = async (rehireId: string) => {
    const rehire = rehireRequests.find(r => r.id === rehireId);
    if (!rehire) return;

    // Through the contract route. This used to mint a contract in the
    // browser with an id from a timestamp, a salary defaulting to 12400 and
    // status 'Signed', which contracts_status_check does not allow, then
    // post the whole database through /api/db. The contract was refused by
    // Postgres and the client's notification went to a table that denies
    // browser writes, so approving a re-hire did nothing at all.
    try {
      const res = await apiFetch('/api/contracts/status', {
        method: 'POST',
        body: JSON.stringify({
          action: 'create',
          talentId: rehire.talentId,
          clientId: rehire.clientId,
          serviceType: rehire.role,
          rateType: 'Monthly',
          rateAmount: rehire.proposedRate,
          startDate: rehire.proposedStartDate
        })
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(result?.error || `The re-hire for ${rehire.talentName} was not approved.`);
        return;
      }

      setContracts([...contracts, result]);
      setRehireRequests(rehireRequests.map(r =>
        r.id === rehireId ? { ...r, status: 'Approved' as const } : r));

      // The request behind the re-hire moves on with it.
      await persistTalentRequestStatus(rehire.id, 'Onboarding');

      alert(`Re-hire for ${rehire.talentName} approved. The contract is drafted and waiting for signature.`);
    } catch (e: any) {
      console.error('Failed to approve re-hire', e);
      alert(e?.message || `The re-hire for ${rehire.talentName} was not approved.`);
    }
  };

  const handleUpdateRequestStatus = async (requestId: string, newStatus: string) => {
    const targetRequest = requests.find(r => r.id === requestId);
    if (!targetRequest) return;
    // The server decides whether this move is allowed and writes it. The
    // local collections are only updated once it has.
    const landed = await persistTalentRequestStatus(requestId, newStatus);
    if (!landed) return;

    const normalizedStatus = coerceRequestStatus(newStatus);
    updateRequestCollections(requestId, normalizedStatus, targetRequest);

    // The whole-database save that used to follow is gone. The status was
    // already written by the route above, which also records the audit
    // entry against the administrator who made the change; this posted the
    // browser's copy of every talent, request, match and contract back
    // through /api/db on top of it, with the audit entry attributed to
    // 'Admin Operator'.
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
  const ticketSource = (ticket: SupportTicket) => {
    if (ticket.clientId) {
      const client = users.find((u: any) => u.id === ticket.clientId);
      return `Client${client?.name ? ` · ${client.name}` : ''}`;
    }
    if (ticket.talentId) {
      const talent = talents.find((t: any) => t.id === ticket.talentId);
      return `Talent${talent?.name ? ` · ${talent.name}` : ''}`;
    }
    return 'Unknown source';
  };

  // ─── RENDER ──────────────────────────────────────────────────────────────────

  const statusColor = (status: string) => {
    const map: Record<string, string> = { 'Signed': '#10B981', 'Draft': '#6B7A99', 'Active': '#10B981', 'Open': '#3D7FFF', 'In Progress': '#F59E0B', 'Resolved': '#10B981', 'Closed': '#6B7A99', 'Scheduled': '#2563EB', 'Rescheduled': '#7C3AED', 'Completed': '#10B981', 'Cancelled': '#EF4444', 'Urgent': '#EF4444', 'High': '#F59E0B', 'Medium': '#3D7FFF', 'Low': '#10B981', 'pending_signature': '#F59E0B', 'signed': '#10B981', 'verified': '#0047CC', 'vetted': '#10B981', 'under_review': '#F59E0B' };
    return map[status] || '#6B7A99';
  };
  const statusBg = (status: string) => {
    const c = statusColor(status);
    return `${c}18`;
  };

  // Payroll hooks must run before the loading guard below on every render.
  const [payrollPeriod, setPayrollPeriod] = useState(() => {
    const now = new Date();
    const month = now.getUTCMonth();
    return month === 0
      ? `${now.getUTCFullYear() - 1}-12`
      : `${now.getUTCFullYear()}-${String(month).padStart(2, '0')}`;
  });
  const [payrollRun, setPayrollRun] = useState<any>(null);
  const [payrollBusy, setPayrollBusy] = useState(false);
  const [payrollError, setPayrollError] = useState<string | null>(null);
  const [payrollNotice, setPayrollNotice] = useState<string | null>(null);

  const loadPayroll = async (period: string) => {
    setPayrollBusy(true);
    setPayrollError(null);
    try {
      const res = await apiFetch(`/api/payroll?period=${encodeURIComponent(period)}`);
      const body = await res.json().catch(() => ({}));
      if (!res.ok) { setPayrollError(body.error || 'Could not load the run.'); return; }
      setPayrollRun(body);
    } catch (e: any) {
      setPayrollError(e?.message || 'Could not load the run.');
    } finally {
      setPayrollBusy(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'payroll') loadPayroll(payrollPeriod);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, payrollPeriod]);

  // Never hide the sign-in screen behind the data loader. If there is no
  // verified session, the user must be able to authenticate even when an API
  // request is slow or unavailable.
  if (authChecking || (isAuthenticated && loading)) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--bg-primary)' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '32px', marginBottom: '12px', animation: 'spin 1s linear infinite', display: 'inline-block' }}>⚙️</div>
        <KongilaLoader text="Loading Admin Console..." />
        </div>
      </div>
    );
  }

  // ── PAYROLL ────────────────────────────────────────────────────────────────
  //
  // This replaces the workflow orchestration tab, which drove
  // `/api/workflows`: a mock hardcoded to fail every talent_onboarding run
  // at step 3 with "Network timeout contacting WhatsApp API". It
  // orchestrated Remotan, which is not in this launch, and the failures it
  // showed operators were invented.

  const runPayrollAction = async (action: 'generate' | 'approve') => {
    setPayrollBusy(true);
    setPayrollError(null);
    setPayrollNotice(null);
    try {
      const res = await apiFetch('/api/payroll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, period: payrollPeriod })
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) { setPayrollError(body.error || 'The action failed.'); return; }

      setPayrollNotice([body.summary, ...(body.warnings || [])].filter(Boolean).join(' '));
      await loadPayroll(payrollPeriod);
    } catch (e: any) {
      setPayrollError(e?.message || 'The action failed.');
    } finally {
      setPayrollBusy(false);
    }
  };

  const renderPayrollTab = () => {
    const run = payrollRun;
    const money = (amount: number, currency = run?.currency || 'USD') =>
      `${currency === 'MIXED' ? '' : currency + ' '}${Number(amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    return (
      <div>
        <div className="page-header">
          <div>
            <h1 className="page-title">Payroll</h1>
            <p className="page-subtitle">
              Monthly run for managed and outsourced contracts. Placement and project
              engagements are not paid here: a placement candidate is employed by the
              client, and a project is paid against its project fee.
            </p>
          </div>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <input
              type="month"
              value={payrollPeriod}
              onChange={e => setPayrollPeriod(e.target.value)}
              style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border-glass)', background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
            />
            <button onClick={() => runPayrollAction('generate')} disabled={payrollBusy} className="btn-secondary">
              {payrollBusy ? 'Working...' : run ? 'Regenerate' : 'Generate'}
            </button>
            {run?.status === 'draft' && (
              <button onClick={() => runPayrollAction('approve')} disabled={payrollBusy} className="btn-primary">Approve run</button>
            )}
            {run && run.status !== 'draft' && (
              <a href={`/api/payroll?period=${encodeURIComponent(payrollPeriod)}&view=export`} className="btn-secondary" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>Export CSV</a>
            )}
          </div>
        </div>

        {payrollError && (
          <div style={{ background: '#FEE2E2', border: '1px solid #FCA5A5', color: '#991B1B', padding: '12px 16px', borderRadius: '8px', marginBottom: '20px', fontSize: '13px' }}>{payrollError}</div>
        )}
        {payrollNotice && (
          <div style={{ background: '#F0F9FF', border: '1px solid #BAE6FD', color: '#0C4A6E', padding: '12px 16px', borderRadius: '8px', marginBottom: '20px', fontSize: '13px' }}>{payrollNotice}</div>
        )}

        {!run ? (
          <GlassCard>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px', margin: 0 }}>
              No run exists for {payrollPeriod}. Generate one to see who is owed what.
            </p>
          </GlassCard>
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
              {[
                { label: 'Status', value: run.status },
                { label: 'People', value: String(run.entryCount ?? run.entries.length) },
                { label: 'Gross', value: money(run.totalGross) },
                { label: 'Commission', value: money(run.totalCommission) },
                { label: 'Net to pay', value: money(run.totalNet) }
              ].map(tile => (
                <GlassCard key={tile.label}>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{tile.label}</div>
                  <div style={{ fontSize: '22px', fontWeight: 700 }}>{tile.value}</div>
                </GlassCard>
              ))}
            </div>

            {run.currency === 'MIXED' && (
              <div style={{ background: '#FEF3C7', border: '1px solid #FCD34D', color: '#92400E', padding: '12px 16px', borderRadius: '8px', marginBottom: '20px', fontSize: '13px' }}>
                This run spans more than one currency, so the totals above are a sum of
                different units. Check each entry before paying.
              </div>
            )}

            {run.skipped?.length > 0 && (
              <GlassCard style={{ marginBottom: '24px' }}>
                <h3 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '12px', color: '#B45309' }}>
                  Left out of this run ({run.skipped.length})
                </h3>
                <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                  {run.skipped.map((entry: any, index: number) => (
                    <li key={index} style={{ marginBottom: '6px' }}>
                      <strong>{entry.talentName || entry.contractId}</strong>: {entry.reason}
                    </li>
                  ))}
                </ul>
              </GlassCard>
            )}

            <GlassCard>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-glass)', color: 'var(--text-secondary)' }}>
                      <th style={{ padding: '10px 8px' }}>Talent</th>
                      <th style={{ padding: '10px 8px' }}>Client</th>
                      <th style={{ padding: '10px 8px' }}>Rate</th>
                      <th style={{ padding: '10px 8px' }}>Days</th>
                      <th style={{ padding: '10px 8px' }}>Gross</th>
                      <th style={{ padding: '10px 8px' }}>Commission</th>
                      <th style={{ padding: '10px 8px' }}>Net</th>
                      <th style={{ padding: '10px 8px' }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {run.entries.map((entry: any) => (
                      <tr key={entry.id} style={{ borderBottom: '1px solid var(--border-glass)', opacity: entry.status === 'on_hold' ? 0.65 : 1 }}>
                        <td style={{ padding: '10px 8px', fontWeight: 600 }}>{entry.talentName}</td>
                        <td style={{ padding: '10px 8px', color: 'var(--text-secondary)' }}>{entry.clientName || '—'}</td>
                        <td style={{ padding: '10px 8px' }}>{money(entry.monthlyRate, entry.currency)}</td>
                        <td style={{ padding: '10px 8px', color: 'var(--text-secondary)' }}>
                          {entry.daysWorked}/{entry.daysInPeriod}
                          {entry.daysWorked !== entry.daysInPeriod && (
                            <span style={{ color: '#B45309', marginLeft: '4px' }}>prorated</span>
                          )}
                        </td>
                        <td style={{ padding: '10px 8px' }}>{money(entry.grossAmount, entry.currency)}</td>
                        <td style={{ padding: '10px 8px', color: 'var(--text-secondary)' }}>
                          {money(entry.commissionAmount, entry.currency)}
                          <span style={{ fontSize: '11px', marginLeft: '4px' }}>
                            ({(Number(entry.commissionPct) * 100).toFixed(2).replace(/\.00$/, '')}%)
                          </span>
                        </td>
                        <td style={{ padding: '10px 8px', fontWeight: 700 }}>{money(entry.netAmount, entry.currency)}</td>
                        <td style={{ padding: '10px 8px' }}>
                          {entry.status}
                          {entry.holdReason && (
                            <div style={{ color: '#DC2626', fontSize: '11px', marginTop: '4px', maxWidth: '260px' }}>{entry.holdReason}</div>
                          )}
                          {entry.failureReason && (
                            <div style={{ color: '#DC2626', fontSize: '11px', marginTop: '4px' }}>{entry.failureReason}</div>
                          )}
                        </td>
                      </tr>
                    ))}
                    {run.entries.length === 0 && (
                      <tr><td colSpan={8} style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>Nobody is owed anything for {payrollPeriod}.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </GlassCard>
          </>
        )}
      </div>
    );
  };

  const renderTab = () => {
    switch (activeTab) {

      // ── OFFER QUEUE ────────────────────────────────────────────────────────
      case 'offers': return (
        <div>
          <div className="page-header">
            <div>
              <h1 className="page-title">Offer Queue</h1>
              <p className="page-subtitle">Offers submitted by clients, awaiting Kongila approval before they reach a candidate.</p>
            </div>
            <button onClick={loadOffers} className="btn-secondary">
              {offersLoading ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>

          {offers.length === 0 ? (
            <div style={{ padding: '32px', textAlign: 'center', color: '#64748B' }}>
              {offersLoading ? 'Loading offers...' : 'No offers waiting. Submitted offers appear here.'}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {offers.map((offer: any) => (
                <div key={offer.id} style={{
                  background: '#fff',
                  border: offer.isOverdue ? '1px solid rgba(185,28,28,0.4)' : '1px solid rgba(15,23,42,0.1)',
                  borderRadius: '14px',
                  padding: '18px 20px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: '15px', color: '#0F172A' }}>
                        {offer.talentName} for {offer.role_title}
                      </div>
                      <div style={{ fontSize: '13px', color: '#475569', marginTop: '4px' }}>
                        {offer.clientName} · {offer.service_type} · ${Number(offer.proposed_rate_usd || 0).toLocaleString()}
                        {offer.payment_period === 'weekly' ? ' per week' : ' per month'}
                      </div>
                      {offer.client_note_to_admin && (
                        <div style={{ fontSize: '12px', color: '#64748B', marginTop: '6px', fontStyle: 'italic' }}>
                          Client note: {offer.client_note_to_admin}
                        </div>
                      )}
                      {offer.talent_response_deadline && (
                        <div style={{ fontSize: '12px', marginTop: '6px', fontWeight: 700, color: offer.isOverdue ? '#B91C1C' : '#64748B' }}>
                          {offer.isOverdue ? 'Response overdue since ' : 'Candidate must respond by '}
                          {new Date(offer.talent_response_deadline).toLocaleDateString()}
                        </div>
                      )}
                    </div>
                    <div style={{ fontSize: '12px', fontWeight: 800, color: '#334155', whiteSpace: 'nowrap' }}>
                      {String(offer.status).replace(/_/g, ' ')}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '8px', marginTop: '14px', flexWrap: 'wrap' }}>
                    {['submitted', 'revision_requested'].includes(offer.status) && (
                      <button onClick={() => decideOffer(offer.id, 'approve')} className="btn-secondary">Approve</button>
                    )}
                    {['submitted', 'admin_approved', 'revision_requested'].includes(offer.status) && (
                      <>
                        <button onClick={() => decideOffer(offer.id, 'send')} className="btn-primary">Send to candidate</button>
                        <button onClick={() => {
                          const note = window.prompt('What needs changing?') || undefined;
                          if (note) decideOffer(offer.id, 'request_revision', note);
                        }} className="btn-secondary">Request revision</button>
                        <button onClick={() => {
                          const note = window.prompt('Why are you declining this offer?') || undefined;
                          decideOffer(offer.id, 'decline', note);
                        }} className="btn-secondary">Decline</button>
                      </>
                    )}
                    {offer.status === 'sent_to_talent' && (
                      <span style={{ fontSize: '12px', color: '#64748B' }}>Waiting on the candidate.</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      );

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
              { label: 'Contract Value', val: formatCurrency(mrrTotal), sub: `${metrics.activeContractCount} active contracts`, color: 'var(--accent-green)' },
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
                          <div>{org.contact_email || org.contactEmail || 'N/A'}</div>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{org.contact_phone || org.contactPhone || ''}</div>
                        </td>
                        <td style={{ padding: '16px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: 'var(--bg-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px' }}>
                              {((adminUsers.find(u => u.id === org.account_manager_id)?.name || adminUsers.find(u => u.id === org.account_manager_id)?.email) || 'A')[0]}
                            </div>
                            <span>{adminUsers.find(u => u.id === org.account_manager_id)?.name || adminUsers.find(u => u.id === org.account_manager_id)?.email || 'Unassigned'}</span>
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

        // Onboarding is the terminal working stage: a request reaches it once
        // the contract is signed. It was missing, so any request moved there
        // vanished from the board entirely.
        const columns = ['New Request', 'Reviewing', 'Sourcing Talent', 'Candidates Ready', 'Client Interview', 'Offer Accepted', 'Onboarding'];

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
                            {iv.rescheduleRequested && (
                              <div style={{ display: 'flex', gap: '4px', marginTop: '4px', width: '100%' }}>
                                <button onClick={() => handleGlobalApproveReschedule(iv)} style={{ padding: '3px 8px', borderRadius: '6px', background: '#10B981', color: '#fff', border: 'none', cursor: 'pointer', fontSize: '10px', fontWeight: 600 }}>Approve</button>
                                <button onClick={() => handleGlobalRejectReschedule(iv)} style={{ padding: '3px 8px', borderRadius: '6px', background: '#EF4444', color: '#fff', border: 'none', cursor: 'pointer', fontSize: '10px', fontWeight: 600 }}>Reject</button>
                                <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{iv.proposedNewDate} {iv.proposedNewTime} - {iv.rescheduleReason}</div>
                              </div>
                            )}
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
                        setStageScoreInput(undefined);
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
                        {(() => {
                          const calc = calculateCompositeVettingGrade(selectedTalent.vettingScores);
                          return (
                            <>
                              <div style={{
                                width: '70px', height: '70px', borderRadius: '50%',
                                background: `conic-gradient(${getGradeColor(calc.grade)} ${calc.score * 3.6}deg, var(--border-glass) 0deg)`,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                              }}>
                                <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'var(--bg-card)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                                  <span style={{ fontSize: '18px', fontWeight: 800, color: getGradeColor(calc.grade) }}>
                                    {calc.score}
                                  </span>
                                </div>
                              </div>
                              <div>
                                <div style={{ fontSize: '18px', fontWeight: 900, color: getGradeColor(calc.grade), marginBottom: '2px' }}>
                                  {selectedTalent.vettingStatus === 'Vetted' || selectedTalent.vettingStatus === 'Matched' || selectedTalent.vettingStatus === 'Deployed'
                                    ? (calc.grade === 'A+' ? '⭐ A+' : calc.grade === 'A' ? '🏆 A' : calc.grade === 'B' ? '📈 B' : calc.grade)
                                    : `Score: ${calc.score}`}
                                </div>
                                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{selectedTalent.vettingStatus}</div>
                              </div>
                            </>
                          );
                        })()}
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
                                  <div style={{ position: 'relative' }}>
                                    <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '8px', display: 'block' }}>Select Assessment to Assign</label>
                                    <div 
                                      onClick={() => setAssessmentDropdownOpen(!assessmentDropdownOpen)}
                                      className="form-input" 
                                      style={{ width: '100%', fontSize: '14px', padding: '12px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-secondary)', border: '1px solid var(--border-glass)' }}
                                    >
                                      <span style={{ color: stageAssessmentId ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                                        {stageAssessmentId ? skillAssessments.find((sa: any) => sa.id === stageAssessmentId)?.title : '-- Select Role-based Assessment --'}
                                      </span>
                                      <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>▼</span>
                                    </div>
                                    {assessmentDropdownOpen && (
                                      <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--bg-secondary)', border: '1px solid var(--border-glass)', borderRadius: '8px', marginTop: '4px', zIndex: 50, maxHeight: '250px', display: 'flex', flexDirection: 'column', boxShadow: '0 10px 25px rgba(0,0,0,0.1)' }}>
                                        <input 
                                          autoFocus
                                          type="text" 
                                          placeholder="Search assessments..." 
                                          value={assessmentSearch} 
                                          onChange={e => setAssessmentSearch(e.target.value)} 
                                          style={{ padding: '12px', borderBottom: '1px solid var(--border-glass)', borderTop: 'none', borderLeft: 'none', borderRight: 'none', background: 'transparent', color: 'var(--text-primary)', outline: 'none', width: '100%' }}
                                        />
                                        <div style={{ overflowY: 'auto', flex: 1 }}>
                                          {skillAssessments.filter((sa: any) => sa.title.toLowerCase().includes(assessmentSearch.toLowerCase())).map((sa: any) => (
                                            <div 
                                              key={sa.id} 
                                              onClick={() => { setStageAssessmentId(sa.id); setAssessmentDropdownOpen(false); setAssessmentSearch(''); }}
                                              style={{ padding: '10px 12px', cursor: 'pointer', fontSize: '14px', borderBottom: '1px solid var(--border-glass)' }}
                                              onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-tertiary)'}
                                              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                            >
                                              {sa.title} ({sa.total_time_limit_minutes || 0}m)
                                            </div>
                                          ))}
                                          {skillAssessments.filter((sa: any) => sa.title.toLowerCase().includes(assessmentSearch.toLowerCase())).length === 0 && (
                                            <div style={{ padding: '10px 12px', fontSize: '13px', color: 'var(--text-muted)', textAlign: 'center' }}>No assessments found</div>
                                          )}
                                        </div>
                                      </div>
                                    )}
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
                                      {Object.entries(submittedResult.subjectiveAnswers).map(([qId, answer]: [string, any]) => {
                                        const question = assessmentQuestions.find(q => q.id === qId);
                                        return (
                                          <div key={qId} style={{ marginBottom: '12px', paddingBottom: '12px', borderBottom: '1px solid var(--border-glass)' }}>
                                            <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px' }}>Q: {question?.question_text || qId}</div>
                                            <div style={{ fontSize: '13px', color: 'var(--text-primary)', background: 'var(--bg-primary)', padding: '10px', borderRadius: '6px', border: '1px solid var(--border-glass)' }}>
                                              {answer || <em style={{ color: 'var(--text-muted)' }}>No answer provided</em>}
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  )}

                                  {/* Detailed Answers Review */}
                                  {submittedResult?.answers && Object.keys(submittedResult.answers).length > 0 && (
                                    <div style={{ background: 'var(--bg-tertiary)', borderRadius: '10px', padding: '16px', border: '1px solid var(--border-glass)', marginTop: '16px' }}>
                                      <details>
                                        <summary style={{ fontSize: '14px', fontWeight: 800, color: '#10B981', cursor: 'pointer', outline: 'none', padding: '12px', background: 'var(--bg-primary)', borderRadius: '8px', border: '1px solid var(--border-glass)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                          🔍 Click to View Question Breakdown & Correct Answers
                                        </summary>
                                        <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                          {Object.entries(submittedResult.answers).map(([qId, answer]: [string, any]) => {
                                            const question = assessmentQuestions.find(q => q.id === qId);
                                            if (!question) return null;
                                            const isMCQ = question.type === 'multiple_choice';
                                            const correctAnswer: string[] = Array.isArray(question.correct_answer) ? question.correct_answer : (question.correct_answer ? [question.correct_answer] : []);
                                            const givenAnswer: string[] = Array.isArray(answer) ? answer : (answer ? [answer] : []);
                                            
                                            // Check correctness for MCQ
                                            let isCorrect = false;
                                            if (isMCQ) {
                                              isCorrect = correctAnswer.length === givenAnswer.length && correctAnswer.every((c: string) => givenAnswer.includes(c));
                                            }

                                            return (
                                              <div key={qId} style={{ padding: '16px', background: 'var(--bg-primary)', borderRadius: '8px', border: `1px solid ${isMCQ ? (isCorrect ? '#10B98140' : '#EF444440') : 'var(--border-glass)'}` }}>
                                                <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '12px' }}>
                                                  Q: {question.question_text || qId}
                                                </div>
                                                <div style={{ fontSize: '13px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                  <div style={{ display: 'flex', gap: '8px', background: 'var(--bg-tertiary)', padding: '10px', borderRadius: '6px' }}>
                                                    <span style={{ color: 'var(--text-muted)', width: '100px', flexShrink: 0, fontWeight: 600 }}>Talent Answer:</span>
                                                    <span style={{ color: isMCQ ? (isCorrect ? '#10B981' : '#EF4444') : 'var(--text-primary)', fontWeight: 700 }}>
                                                      {givenAnswer.join(', ') || <em style={{ color: 'var(--text-muted)' }}>No answer</em>}
                                                      {isMCQ && (isCorrect ? ' ✅ (Correct)' : ' ❌ (Failed)')}
                                                    </span>
                                                  </div>
                                                  {isMCQ && !isCorrect && (
                                                    <div style={{ display: 'flex', gap: '8px', background: 'var(--bg-tertiary)', padding: '10px', borderRadius: '6px' }}>
                                                      <span style={{ color: 'var(--text-muted)', width: '100px', flexShrink: 0, fontWeight: 600 }}>Correct Answer:</span>
                                                      <span style={{ color: '#10B981', fontWeight: 700 }}>{correctAnswer.join(', ')}</span>
                                                    </div>
                                                  )}
                                                </div>
                                              </div>
                                            );
                                          })}
                                        </div>
                                      </details>
                                    </div>
                                  )}
                                  <div style={{ background: 'var(--bg-tertiary)', padding: '16px', borderRadius: '10px', border: '1px solid var(--border-glass)', marginTop: '16px' }}>
                                    <label style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '8px', display: 'block' }}>Final Assessment Score (0-100%)</label>
                                    <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '12px' }}>Review the auto-scored MCQ and the written answers above, then assign the final composite score for this assessment.</p>
                                    <input 
                                      type="number" 
                                      min="0" max="100" 
                                      value={stageScoreInput ?? stageRecord.assessmentScore ?? ''} 
                                      onChange={e => setStageScoreInput(e.target.value === '' ? undefined : (parseInt(e.target.value) || 0))} 
                                      className="form-input" 
                                      style={{ width: '100%', fontSize: '16px', fontWeight: 800, padding: '12px', border: '2px solid var(--kongila-blue)' }} 
                                      placeholder="e.g. 85" 
                                    />
                                  </div>

                                  <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
                                    <button disabled={saving} onClick={() => handleStageDecision(1, 'Proceed', stageScoreInput ?? stageRecord.assessmentScore, stageNotesInput)} style={{ flex: 2, padding: '14px', borderRadius: '10px', border: 'none', cursor: 'pointer', background: '#10B981', color: '#fff', fontSize: '14px', fontWeight: 800 }}>✅ Confirm Score & Move to Interview</button>
                                    <button disabled={saving} onClick={() => handleStageDecision(1, 'Reject', stageScoreInput ?? stageRecord.assessmentScore, stageNotesInput)} style={{ flex: 1, padding: '14px', borderRadius: '10px', border: '1px solid #EF4444', cursor: 'pointer', background: '#EF444415', color: '#EF4444', fontSize: '14px', fontWeight: 800 }}>❌ Reject</button>
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
                                      <div style={{ marginTop: '12px', display: 'flex', gap: '8px' }}>
                                        <button disabled={saving || !stageInterviewDate || !stageInterviewTime} onClick={() => handleStageDecision(2, 'Assign', undefined, stageNotesInput)} style={{ flex: 2, padding: '12px', borderRadius: '8px', border: 'none', cursor: !stageInterviewDate || !stageInterviewTime ? 'not-allowed' : 'pointer', background: '#F59E0B', color: '#fff', fontSize: '13px', fontWeight: 800 }}>
                                          🔄 Reschedule & Notify Candidate
                                        </button>
                                        <button disabled={saving} onClick={handleRejectReschedule} style={{ flex: 1, padding: '12px', borderRadius: '8px', border: '1px solid #D97706', cursor: 'pointer', background: 'transparent', color: '#D97706', fontSize: '13px', fontWeight: 800 }}>
                                          Keep Original Time
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
                                          let val = parseInt(e.target.value);
                                          if (isNaN(val)) val = 0;
                                          if (val > 100) val = 100;
                                          if (val < 0) val = 0;
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
                                    {stageScoreInput !== undefined && (
                                      <div style={{ fontSize: '13px', color: '#10B981', fontWeight: 700, padding: '12px', background: '#10B98115', borderRadius: '8px', border: '1px solid #10B98140' }}>
                                        Stage Average: {stageScoreInput}% — (This contributes {Math.round(stageScoreInput * 0.3)}% to the final composite score)
                                      </div>
                                    )}
                                  </div>
                                  <div>
                                    <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '8px', display: 'block' }}>Interview Notes & Feedback</label>
                                    <textarea value={stageNotesInput} onChange={e => setStageNotesInput(e.target.value)} placeholder="Summarise interview performance, strengths, concerns..." rows={3} className="form-input" style={{ width: '100%', resize: 'none', fontSize: '14px', padding: '12px' }} />
                                  </div>
                                  <div style={{ display: 'flex', gap: '12px' }}>
                                    <button disabled={saving} onClick={() => setShowPrivateNoteModal(true)} style={{ flex: 2, padding: '14px', borderRadius: '10px', border: 'none', cursor: 'pointer', background: '#10B981', color: '#fff', fontSize: '14px', fontWeight: 800 }}>✅ Interview Done — Move to Personality Test</button>
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
                                  <a href={stageRecord.personalityLink} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-block', background: '#10B981', color: '#fff', padding: '10px 20px', borderRadius: '8px', textDecoration: 'none', fontSize: '13px', fontWeight: 700, marginBottom: '20px' }}>
                                    🔗 View Test Link
                                  </a>

                                  {/* The personality test is administered outside Kongila, so
                                      somebody has to type the result in. There was no field:
                                      "Mark Result Received" submitted whatever stageScoreInput
                                      happened to hold, which used to be a default 80 and is
                                      now undefined, so the stage guard refuses it. */}
                                  <div style={{ maxWidth: '320px', margin: '0 auto 16px', textAlign: 'left' }}>
                                    <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '6px', display: 'block' }}>
                                      Personality score from the provider (0–100)
                                    </label>
                                    <input
                                      type="number" min="0" max="100"
                                      value={stageScoreInput ?? ''}
                                      onChange={e => setStageScoreInput(e.target.value === '' ? undefined : (parseInt(e.target.value) || 0))}
                                      placeholder="Enter the score from the provider's report"
                                      className="form-input"
                                      style={{ width: '100%', fontSize: '14px', padding: '10px' }}
                                    />
                                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '6px' }}>
                                      This is 10% of the composite grade. The stage cannot be passed without it.
                                    </div>
                                  </div>

                                  <button
                                    disabled={saving || stageScoreInput === undefined}
                                    onClick={() => handleStageDecision(3, 'Proceed', stageScoreInput, stageNotesInput || 'Result entered from the provider report.')}
                                    style={{
                                      padding: '10px 20px', borderRadius: '8px',
                                      border: `1px solid ${stageScoreInput === undefined ? 'var(--border-glass)' : '#10B981'}`,
                                      cursor: stageScoreInput === undefined ? 'not-allowed' : 'pointer',
                                      background: 'transparent',
                                      color: stageScoreInput === undefined ? 'var(--text-muted)' : '#10B981',
                                      fontSize: '13px', fontWeight: 700
                                    }}
                                  >
                                    ✅ Record result and move on
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
                                <input type="number" min="0" max="100" value={stageScoreInput ?? ''} onChange={e => setStageScoreInput(e.target.value === '' ? undefined : (parseInt(e.target.value) || 0))} className="form-input" style={{ width: '100%', fontSize: '14px' }} placeholder="0-100" />
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
                                    <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '8px', display: 'block' }}>Submission Type required</label>
                                    <select value={stageSubmissionType} onChange={e => setStageSubmissionType(e.target.value as any)} className="form-input" style={{ width: '100%', fontSize: '14px', padding: '12px', marginBottom: '16px' }}>
                                      <option value="link">Submission Link (e.g., GitHub, Figma, Google Drive)</option>
                                      <option value="essay">Essay / Text Response</option>
                                      <option value="file">File Upload (PDF, Zip, Image, etc.)</option>
                                    </select>
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
                                  {/* The candidate's submission.
                                      advance.ts writes it to the stage record as
                                      submissionData and nothing anywhere read it, so a
                                      reviewer was asked to score work they could not see
                                      and the screen said "Awaiting Submission" even when
                                      one had arrived. */}
                                  {(() => {
                                    const submission = (stageRecord as any).submissionData;
                                    if (!submission) {
                                      return (
                                        <div style={{ background: '#F9731610', borderRadius: '10px', padding: '16px', border: '1px solid #F9731630' }}>
                                          <div style={{ fontSize: '12px', fontWeight: 700, color: '#F97316', marginBottom: '4px' }}>📝 Task Assigned — Awaiting Submission</div>
                                          <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                                            Task ID: {stageRecord.taskId}{stageRecord.deadline && ` · Deadline: ${new Date(stageRecord.deadline).toLocaleDateString()}`}
                                          </div>
                                        </div>
                                      );
                                    }

                                    const text = submission.text || submission.essay || submission.response || submission.notes;
                                    const link = submission.link || submission.url || submission.submissionUrl;
                                    const file = submission.fileUrl || submission.file_url || submission.attachmentUrl;
                                    const submittedAt = submission.submittedAt || submission.submitted_at || stageRecord.completedAt;

                                    return (
                                      <div style={{ background: '#10B98110', borderRadius: '10px', padding: '18px', border: '1px solid #10B98130' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                                          <div style={{ fontSize: '12px', fontWeight: 800, color: '#047857' }}>✅ Submission received</div>
                                          {submittedAt && (
                                            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                              {new Date(submittedAt).toLocaleString()}
                                              {stageRecord.deadline && new Date(submittedAt) > new Date(stageRecord.deadline) && (
                                                <span style={{ color: '#DC2626', fontWeight: 700 }}> · after the deadline</span>
                                              )}
                                            </div>
                                          )}
                                        </div>

                                        {link && (
                                          <div style={{ marginBottom: '10px' }}>
                                            <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px' }}>Submitted link</div>
                                            <a href={link} target="_blank" rel="noopener noreferrer" style={{ fontSize: '13px', color: 'var(--kongila-blue)', wordBreak: 'break-all' }}>{link}</a>
                                          </div>
                                        )}

                                        {file && (
                                          <div style={{ marginBottom: '10px' }}>
                                            <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px' }}>Submitted file</div>
                                            <a href={file} target="_blank" rel="noopener noreferrer" style={{ fontSize: '13px', color: 'var(--kongila-blue)', wordBreak: 'break-all' }}>Open the file</a>
                                          </div>
                                        )}

                                        {text && (
                                          <div>
                                            <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px' }}>Written response</div>
                                            <div style={{ fontSize: '13px', color: 'var(--text-primary)', whiteSpace: 'pre-wrap', background: 'var(--bg-tertiary)', padding: '12px', borderRadius: '8px', maxHeight: '280px', overflowY: 'auto' }}>
                                              {text}
                                            </div>
                                          </div>
                                        )}

                                        {!link && !file && !text && (
                                          <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                                            The candidate submitted, but the response is empty. Ask them to resubmit before scoring.
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })()}
                                  <div>
                                    <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                      <span>Work Simulation Score (0–100)</span>
                                      <span style={{ color: '#F97316', fontWeight: 800 }}>{stageScoreInput ?? '\u2014'}</span>
                                    </label>
                                    <input type="range" min="0" max="100" value={stageScoreInput ?? 0} onChange={e => setStageScoreInput(parseInt(e.target.value))} style={{ width: '100%', accentColor: '#F97316' }} />
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
                                {idx === 1 && stageRecord?.assessmentId && (
                                  (() => {
                                    const sResult = assessmentResults.find((r: any) =>
                                      r.assessmentId === stageRecord.assessmentId &&
                                      (r.talentId === selectedTalent.id || r.talentSkillAssessmentId)
                                    );
                                    if (!sResult) return null;
                                    return (
                                      <div style={{ marginTop: '12px', background: 'var(--bg-tertiary)', borderRadius: '10px', padding: '12px', border: '1px solid var(--border-glass)' }}>
                                        <details>
                                          <summary style={{ fontSize: '12px', fontWeight: 700, color: '#10B981', cursor: 'pointer', outline: 'none', padding: '8px', background: 'var(--bg-primary)', borderRadius: '6px', border: '1px solid var(--border-glass)', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                                            🔍 View Full Assessment Results
                                          </summary>
                                          <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                            {/* Subjective Answers */}
                                            {sResult.subjectiveAnswers && Object.keys(sResult.subjectiveAnswers).length > 0 && (
                                              <div>
                                                <div style={{ fontSize: '11px', fontWeight: 800, color: '#8B5CF6', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Written Answers</div>
                                                {Object.entries(sResult.subjectiveAnswers).map(([qId, answer]: [string, any]) => {
                                                  const question = assessmentQuestions.find(q => q.id === qId);
                                                  return (
                                                    <div key={qId} style={{ marginBottom: '8px' }}>
                                                      <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>Q: {question?.question_text || qId}</div>
                                                      <div style={{ fontSize: '11px', color: 'var(--text-secondary)', background: 'var(--bg-primary)', padding: '8px', borderRadius: '4px', border: '1px solid var(--border-glass)' }}>{answer || <em style={{color: 'var(--text-muted)'}}>No answer provided</em>}</div>
                                                    </div>
                                                  );
                                                })}
                                              </div>
                                            )}
                                            
                                            {/* MCQ Answers */}
                                            {sResult.answers && Object.keys(sResult.answers).length > 0 && (
                                              <div>
                                                <div style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Multiple Choice Answers</div>
                                                {Object.entries(sResult.answers).map(([qId, answer]: [string, any]) => {
                                                  const question = assessmentQuestions.find(q => q.id === qId);
                                                  if (!question || question.type !== 'multiple_choice') return null;
                                                  const correctAnswer: string[] = Array.isArray(question.correct_answer) ? question.correct_answer : (question.correct_answer ? [question.correct_answer] : []);
                                                  const givenAnswer: string[] = Array.isArray(answer) ? answer : (answer ? [answer] : []);
                                                  const isCorrect = correctAnswer.length === givenAnswer.length && correctAnswer.every((c: string) => givenAnswer.includes(c));
                                                  
                                                  return (
                                                    <div key={qId} style={{ padding: '8px', background: 'var(--bg-primary)', borderRadius: '6px', border: `1px solid ${isCorrect ? '#10B98140' : '#EF444440'}`, marginBottom: '6px' }}>
                                                      <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>Q: {question.question_text || qId}</div>
                                                      <div style={{ fontSize: '11px', display: 'flex', gap: '8px' }}>
                                                        <span style={{ color: 'var(--text-muted)' }}>Talent:</span>
                                                        <span style={{ color: isCorrect ? '#10B981' : '#EF4444', fontWeight: 700 }}>{givenAnswer.join(', ') || <em style={{color: 'var(--text-muted)'}}>No answer</em>}</span>
                                                        {!isCorrect && (
                                                          <>
                                                            <span style={{ color: 'var(--text-muted)', marginLeft: '8px' }}>Correct:</span>
                                                            <span style={{ color: '#10B981', fontWeight: 700 }}>{correctAnswer.join(', ')}</span>
                                                          </>
                                                        )}
                                                      </div>
                                                    </div>
                                                  );
                                                })}
                                              </div>
                                            )}
                                          </div>
                                        </details>
                                      </div>
                                    );
                                  })()
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
                            // Through the vetting route, which computes
                            // the grade from the scores. This posted the
                            // whole talents array to /api/db with a grade
                            // worked out in the browser.
                            apiFetch('/api/vetting', {
                              method: 'POST',
                              body: JSON.stringify({ action: 'scores', talentId: selectedTalent.id, scores: editScores })
                            })
                              .then(async (res) => {
                                const result = await res.json().catch(() => ({}));
                                if (!res.ok) {
                                  alert(result?.error || 'Those scores were not saved.');
                                  setSaving(false);
                                  return;
                                }
                                const updatedTalent = {
                                  ...selectedTalent,
                                  vettingScores: result.scores,
                                  grade: result.grade,
                                  vettingStatus: result.vettingStatus
                                } as any;
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
                        { label: 'Skill Assessment', key: 'technical', value: editScoresMode ? editScores.technical : selectedTalent.vettingScores.technical, weight: '30%', color: '#3B82F6' },
                        { label: 'Behavioural Interview', key: 'behavioral', value: editScoresMode ? editScores.behavioral : selectedTalent.vettingScores.behavioral, weight: '30%', color: '#8B5CF6' },
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
          auditLogs={auditLogs}
          setContracts={setContracts}
          setContractTemplates={setContractTemplates}
          setAuditLogs={setAuditLogs}
        />
      );

      // ── FINANCE MANAGER ────────────────────────────────────────────────────
      case 'payroll': return renderPayrollTab();
      case 'finance': return (
        <FinanceManager
          invoices={invoices}
          talentPayouts={talentPayouts}
          feeConfigs={feeConfigs}
          feeAuditLogs={feeAuditLogs}
          talents={talents}
          contracts={contracts}
          documents={documents}
          syncFromDb={syncFromDb}
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
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{ticket.category} · {ticketSource(ticket)} · {formatDate(ticket.createdAt)}</div>
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
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>{selectedTicket.id} · {ticketSource(selectedTicket)} · {selectedTicket.category} · {formatDate(selectedTicket.createdAt)}</div>
                      </div>
                      <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                        <Chip label={selectedTicket.status} /><Chip label={selectedTicket.priority} />
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '6px', marginTop: '10px', flexWrap: 'wrap' }}>
                      {selectedTicket.status !== 'In Progress' && <button onClick={() => handleUpdateTicketStatus(selectedTicket.id, 'In Progress')} style={{ padding: '3px 10px', borderRadius: '6px', background: 'rgba(61,127,255,0.1)', color: '#3D7FFF', border: 'none', cursor: 'pointer', fontSize: '11px', fontWeight: 600 }}>In Progress</button>}
                      {selectedTicket.status !== 'Resolved' && <button onClick={() => handleUpdateTicketStatus(selectedTicket.id, 'Resolved')} style={{ padding: '3px 10px', borderRadius: '6px', background: 'rgba(16,185,129,0.1)', color: 'var(--accent-green)', border: 'none', cursor: 'pointer', fontSize: '11px', fontWeight: 600 }}>Resolve</button>}
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
      case 'messages': return (
        <div>
          <div style={{ marginBottom: '16px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 800, margin: '0 0 4px 0', color: 'var(--text-primary)' }}>Messages</h2>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0 }}>
              Threads with candidates and clients. Operations is a participant in every conversation.
            </p>
          </div>

          {messagingLoading && <div style={{ padding: '20px', color: 'var(--text-secondary)' }}>Loading...</div>}

          {!messagingLoading && conversations.length === 0 && (
            <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-secondary)', border: '1px dashed var(--border-glass)', borderRadius: '12px' }}>
              No conversations yet.
            </div>
          )}

          {conversations.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: '16px', height: '560px' }}>
              <div style={{ border: '1px solid var(--border-glass)', borderRadius: '12px', overflowY: 'auto' }}>
                {conversations.map(convo => {
                  const threadMessages = convoMessages.filter(m => m.conversationId === convo.id);
                  const last = threadMessages[threadMessages.length - 1];
                  const unread = threadMessages.filter(m => !m.isRead && m.senderId !== currentAdminId).length;
                  return (
                    <div
                      key={convo.id}
                      onClick={() => setActiveConversationId(convo.id)}
                      style={{
                        padding: '12px 14px',
                        borderBottom: '1px solid var(--border-glass)',
                        cursor: 'pointer',
                        background: activeConversationId === convo.id ? 'var(--bg-tertiary)' : 'transparent'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', textTransform: 'capitalize' }}>
                          {String(convo.type || '').replace(/_/g, ' ')}
                        </div>
                        {unread > 0 && (
                          <span style={{ background: 'var(--kongila-blue)', color: '#fff', borderRadius: '10px', padding: '1px 6px', fontSize: '10px', fontWeight: 700 }}>{unread}</span>
                        )}
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {last?.content || 'No messages yet'}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div style={{ border: '1px solid var(--border-glass)', borderRadius: '12px', display: 'flex', flexDirection: 'column' }}>
                {!activeConversationId ? (
                  <div style={{ margin: 'auto', color: 'var(--text-secondary)', fontSize: '13px' }}>Pick a conversation.</div>
                ) : (
                  <>
                    <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {convoMessages.filter(m => m.conversationId === activeConversationId).map(m => {
                        const mine = m.senderId === currentAdminId;
                        return (
                          <div key={m.id} style={{ alignSelf: mine ? 'flex-end' : 'flex-start', maxWidth: '70%' }}>
                            <div style={{
                              padding: '10px 14px', borderRadius: '12px', fontSize: '13px',
                              background: mine ? 'var(--kongila-blue)' : 'var(--bg-tertiary)',
                              color: mine ? '#fff' : 'var(--text-primary)'
                            }}>
                              {m.content}
                              {m.attachmentUrl && (
                                <div style={{ marginTop: '6px' }}>
                                  <a href={m.attachmentUrl} target="_blank" rel="noopener noreferrer" style={{ color: mine ? '#fff' : 'var(--kongila-blue)', fontSize: '12px' }}>
                                    {m.attachmentName || 'Attachment'}
                                  </a>
                                </div>
                              )}
                            </div>
                            <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '3px', textAlign: mine ? 'right' : 'left' }}>
                              {m.timestamp ? new Date(m.timestamp).toLocaleString() : ''}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <div style={{ borderTop: '1px solid var(--border-glass)', padding: '12px', display: 'flex', gap: '8px' }}>
                      <input
                        type="text"
                        value={messageDraft}
                        onChange={e => setMessageDraft(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') sendAdminMessage(); }}
                        placeholder="Write a reply"
                        className="form-input"
                        style={{ flex: 1, fontSize: '13px' }}
                      />
                      <button
                        onClick={sendAdminMessage}
                        disabled={!messageDraft.trim()}
                        style={{
                          padding: '8px 16px', borderRadius: '8px', border: 'none', fontSize: '13px', fontWeight: 700,
                          cursor: messageDraft.trim() ? 'pointer' : 'not-allowed',
                          background: messageDraft.trim() ? 'var(--kongila-blue)' : 'var(--bg-tertiary)',
                          color: messageDraft.trim() ? '#fff' : 'var(--text-muted)'
                        }}
                      >
                        Send
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      );

      case 'settings': return (
        <div>
          <div style={{ marginBottom: '20px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 800, margin: '0 0 4px 0', color: 'var(--text-primary)' }}>Platform Settings</h2>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0 }}>
              Numbers the product used to hardcode. Only a super admin can change them, and every change is audited.
            </p>
          </div>

          {settingsLoading && <div style={{ padding: '20px', color: 'var(--text-secondary)' }}>Loading...</div>}

          {!settingsLoading && platformSettings.length === 0 && (
            <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-secondary)', border: '1px dashed var(--border-glass)', borderRadius: '12px' }}>
              No settings found. Run migration 2026-11-02d, which creates the table and its seed values.
            </div>
          )}

          {['finance', 'vetting', 'interviews', 'notifications', 'general'].map(category => {
            const inCategory = platformSettings.filter(s => s.category === category);
            if (inCategory.length === 0) return null;
            return (
              <div key={category} style={{ marginBottom: '24px' }}>
                <div style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>
                  {category}
                </div>
                {inCategory.map(setting => (
                  <div key={setting.key} style={{ border: '1px solid var(--border-glass)', borderRadius: '10px', padding: '14px', marginBottom: '8px' }}>
                    <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'monospace' }}>{setting.key}</div>
                        <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>{setting.description}</div>
                        {setting.updatedBy && (
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '6px' }}>
                            Last changed by {setting.updatedBy}{setting.updatedAt ? ` on ${new Date(setting.updatedAt).toLocaleDateString()}` : ''}
                          </div>
                        )}
                      </div>
                      <div style={{ width: '260px' }}>
                        <input
                          type="text"
                          defaultValue={JSON.stringify(setting.value)}
                          onBlur={e => {
                            if (e.target.value !== JSON.stringify(setting.value)) {
                              saveSetting(setting.key, e.target.value);
                            }
                          }}
                          disabled={!canManageUsers(currentRole)}
                          className="form-input"
                          style={{ width: '100%', fontSize: '12px', fontFamily: 'monospace' }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            );
          })}

          {!canManageUsers(currentRole) && platformSettings.length > 0 && (
            <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              Read only: changing a platform setting needs a super admin.
            </p>
          )}
        </div>
      );

      case 'users': return (
        <div>
          <div style={{ marginBottom: '20px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 800, margin: '0 0 4px 0', color: 'var(--text-primary)' }}>Users & Roles</h2>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0 }}>
              Operators are invited by email and set their own password. Nobody types another person's password.
            </p>
          </div>

          {/* Invite */}
          <div style={{ border: '1px solid var(--border-glass)', borderRadius: '12px', padding: '20px', marginBottom: '24px' }}>
            <div style={{ fontSize: '14px', fontWeight: 800, marginBottom: '12px', color: 'var(--text-primary)' }}>Invite an operator</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1.2fr auto', gap: '10px', alignItems: 'end' }}>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Email</label>
                <input type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} placeholder="name@kongila.co" className="form-input" style={{ width: '100%', fontSize: '13px' }} />
              </div>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Name</label>
                <input type="text" value={inviteName} onChange={e => setInviteName(e.target.value)} placeholder="Optional" className="form-input" style={{ width: '100%', fontSize: '13px' }} />
              </div>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Role</label>
                <select value={inviteRole} onChange={e => setInviteRole(e.target.value)} className="form-input" style={{ width: '100%', fontSize: '13px' }}>
                  {ADMIN_ROLES.map(role => (
                    <option key={role} value={role}>{ROLE_LABELS[role]}</option>
                  ))}
                </select>
              </div>
              <button
                onClick={submitInvite}
                disabled={inviteBusy || !inviteEmail.trim()}
                style={{
                  padding: '10px 18px', borderRadius: '8px', border: 'none', fontSize: '13px', fontWeight: 800,
                  cursor: inviteBusy || !inviteEmail.trim() ? 'not-allowed' : 'pointer',
                  background: inviteBusy || !inviteEmail.trim() ? 'var(--bg-tertiary)' : 'var(--kongila-blue)',
                  color: inviteBusy || !inviteEmail.trim() ? 'var(--text-muted)' : '#fff'
                }}
              >
                {inviteBusy ? 'Sending...' : 'Send invitation'}
              </button>
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '10px' }}>
              {ROLE_DESCRIPTIONS[inviteRole as keyof typeof ROLE_DESCRIPTIONS]}
            </div>
          </div>

          {/* The list */}
          {operatorsLoading && <div style={{ padding: '20px', color: 'var(--text-secondary)' }}>Loading...</div>}

          {!operatorsLoading && operators.length === 0 && (
            <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-secondary)', border: '1px dashed var(--border-glass)', borderRadius: '12px' }}>
              No operator accounts yet.
            </div>
          )}

          {operators.length > 0 && (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ textAlign: 'left', color: 'var(--text-secondary)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  <th style={{ padding: '8px' }}>Name</th>
                  <th style={{ padding: '8px' }}>Email</th>
                  <th style={{ padding: '8px' }}>Role</th>
                  <th style={{ padding: '8px' }}>Status</th>
                  <th style={{ padding: '8px' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {operators.map(op => (
                  <tr key={op.id} style={{ borderTop: '1px solid var(--border-glass)' }}>
                    <td style={{ padding: '10px 8px', fontWeight: 600 }}>{op.name || '—'}</td>
                    <td style={{ padding: '10px 8px', color: 'var(--text-secondary)' }}>{op.email}</td>
                    <td style={{ padding: '10px 8px' }}>
                      <select
                        value={op.role || ''}
                        onChange={e => callUsersApi(
                          { action: 'changeRole', userId: op.id, role: e.target.value },
                          `${op.email} is now ${ROLE_LABELS[e.target.value as keyof typeof ROLE_LABELS]}.`
                        )}
                        className="form-input"
                        style={{ fontSize: '12px', padding: '4px 8px' }}
                      >
                        {ADMIN_ROLES.map(role => (
                          <option key={role} value={role}>{ROLE_LABELS[role]}</option>
                        ))}
                      </select>
                    </td>
                    <td style={{ padding: '10px 8px' }}>
                      <span style={{
                        fontSize: '11px', fontWeight: 700, padding: '3px 8px', borderRadius: '999px',
                        background: op.status === 'suspended' ? '#FEE2E2' : '#D1FAE5',
                        color: op.status === 'suspended' ? '#B91C1C' : '#047857'
                      }}>
                        {op.status}
                      </span>
                    </td>
                    <td style={{ padding: '10px 8px', display: 'flex', gap: '8px' }}>
                      <button
                        onClick={() => callUsersApi({ action: 'resendInvite', userId: op.id }, `Invitation resent to ${op.email}.`)}
                        style={{ fontSize: '11px', fontWeight: 700, padding: '4px 10px', borderRadius: '6px', border: '1px solid var(--border-glass)', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer' }}
                      >
                        Resend invite
                      </button>
                      <button
                        onClick={() => {
                          const next = op.status === 'suspended' ? 'active' : 'suspended';
                          if (next === 'suspended' && !confirm(`Suspend ${op.email}? They will not be able to sign in.`)) return;
                          callUsersApi(
                            { action: 'setStatus', userId: op.id, status: next },
                            `${op.email} ${next === 'suspended' ? 'suspended' : 'restored'}.`
                          );
                        }}
                        style={{
                          fontSize: '11px', fontWeight: 700, padding: '4px 10px', borderRadius: '6px',
                          border: `1px solid ${op.status === 'suspended' ? '#10B981' : '#DC2626'}`,
                          background: 'transparent',
                          color: op.status === 'suspended' ? '#10B981' : '#DC2626',
                          cursor: 'pointer'
                        }}
                      >
                        {op.status === 'suspended' ? 'Restore' : 'Suspend'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '20px' }}>
            Accounts are suspended, never deleted: a deleted operator takes their history out of the audit log with them.
          </p>
        </div>
      );

      case 'notifications': return (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div>
              <h2 style={{ fontSize: '20px', fontWeight: 800, margin: '0 0 4px 0', color: 'var(--text-primary)' }}>Notifications</h2>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0 }}>
                Everything addressed to operations. Until now this table was written to and never read.
              </p>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={loadAdminNotifications} className="btn-secondary" style={{ padding: '8px 14px', fontSize: '13px', fontWeight: 700 }}>
                Refresh
              </button>
              <button
                onClick={() => markAdminNotificationsRead()}
                disabled={adminNotifications.every(n => n.read)}
                style={{
                  padding: '8px 14px', fontSize: '13px', fontWeight: 700, borderRadius: '8px', border: 'none',
                  cursor: adminNotifications.every(n => n.read) ? 'not-allowed' : 'pointer',
                  background: adminNotifications.every(n => n.read) ? 'var(--bg-tertiary)' : 'var(--kongila-blue)',
                  color: adminNotifications.every(n => n.read) ? 'var(--text-muted)' : '#fff'
                }}
              >
                Mark all read
              </button>
            </div>
          </div>

          {adminNotificationsLoading && (
            <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-secondary)' }}>Loading...</div>
          )}

          {!adminNotificationsLoading && adminNotifications.length === 0 && (
            <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-secondary)', border: '1px dashed var(--border-glass)', borderRadius: '12px' }}>
              Nothing for operations yet.
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {adminNotifications.map(n => (
              <div
                key={n.id}
                onClick={() => !n.read && markAdminNotificationsRead([n.id])}
                style={{
                  padding: '14px 16px',
                  borderRadius: '10px',
                  border: '1px solid var(--border-glass)',
                  background: n.read ? 'transparent' : 'var(--bg-tertiary)',
                  cursor: n.read ? 'default' : 'pointer',
                  display: 'flex',
                  gap: '12px',
                  alignItems: 'flex-start'
                }}
              >
                {!n.read && (
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--kongila-blue)', marginTop: '6px', flexShrink: 0 }} />
                )}
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '14px', fontWeight: n.read ? 600 : 800, color: 'var(--text-primary)' }}>
                    {n.title}
                  </div>
                  <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                    {n.message}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '6px', display: 'flex', gap: '10px' }}>
                    {n.module && <span style={{ textTransform: 'capitalize' }}>{n.module}</span>}
                    <span>{n.createdAt ? new Date(n.createdAt).toLocaleString() : ''}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      );

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
              { label: 'Monthly Contract Value', val: formatCurrency(mrrTotal), sub: metrics.monthlyRevenue === null ? 'Revenue needs a fee rate' : `Revenue ${formatCurrency(metrics.monthlyRevenue)}`, color: 'var(--accent-teal)' },
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
      case 'offers':
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
      case 'finance':
        return (
          <svg {...props}>
            <line x1="12" y1="1" x2="12" y2="23" />
            <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
          </svg>
        );
      case 'payroll':
        return (
          <svg {...props}>
            <rect x="2" y="5" width="20" height="14" rx="2" />
            <circle cx="12" cy="12" r="3" />
            <line x1="6" y1="12" x2="6" y2="12" />
            <line x1="18" y1="12" x2="18" y2="12" />
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
      case 'messages':
        return (
          <svg {...props}>
            <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
          </svg>
        );
      case 'settings':
        return (
          <svg {...props}>
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        );
      case 'users':
        return (
          <svg {...props}>
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
        );
      case 'notifications':
        return (
          <svg {...props}>
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
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
      <div className="sidebar-logo" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '4px' }}>
        <img src="/images/kongilalogo.png" alt="Kongila" style={{ width: '130px', height: 'auto', objectFit: 'contain' }} />
        <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Admin Portal</span>
      </div>

      <div className="sidebar-menu">
        {/* KONGILA Section */}
        <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', padding: '4px 8px 6px', marginTop: '4px' }}>KONGILA</div>
        {KONGILA_NAV.filter(({ key }) => canAccessTab(currentRole, key)).map(({ key, label }) => {
          let badge = 0;
          if (key === 'interviews') {
            const rescheduleCount = interviews.filter((iv: any) => iv.rescheduleRequested).length;
            badge = rescheduleCount > 0 ? rescheduleCount : 0;
          }
          else if (key === 'support') badge = supportTickets.filter((t: any) => t.status === 'Open').length;
          else if (key === 'hiring-requests') badge = requests.filter((r: any) => r.status === 'New Request').length;
          else if (key === 'contracts') badge = contracts.filter((c: any) => c.status === 'pending_signatures').length;
          else if (key === 'compliance') {
            const vettedCount = talents.filter((t: any) => t.vettingStatus === 'Vetted' || t.vettingStage === 'Vetted' || t.vettingStage === 'Vetted & Available').length;
            badge = documents.filter((d: any) => d.isMandatory && !d.isHidden && !d.userId && (d.signedByTalentIds?.length || 0) < vettedCount).length;
          }
          else if (key === 'vetting') badge = talents.filter((t: any) => t.vettingStage === 'Application Under Review').length;
          else if ((key as string) === 'matching') badge = matches.filter((m: any) => m.status === 'Draft' || m.status === 'Matched').length;
          else if (key === 'assessments') badge = assessmentResults.filter((r: any) => r.passed == null).length;
          return (
            <div key={key} className={`menu-item ${activeTab === key ? 'active' : ''}`} onClick={() => { setActiveTab(key as AdminTab); setMobileSidebarOpen(false); }}>
              <span style={{ fontSize: '15px', display: 'flex', alignItems: 'center' }}>{renderSidebarIcon(key)}</span>
              <span style={{ flex: 1 }}>{label}</span>
              {badge > 0 && <span style={{ background: key === 'interviews' && interviews.some((iv: any) => iv.rescheduleRequested) ? '#EF4444' : 'var(--kongila-blue)', color: '#fff', borderRadius: '10px', padding: '1px 6px', fontSize: '10px', fontWeight: 700 }}>{badge}</span>}
            </div>
          );
        })}

        {/* REMOTAN Section */}
        <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--accent-teal)', textTransform: 'uppercase', letterSpacing: '0.08em', padding: '12px 8px 6px', marginTop: '8px', borderTop: '1px solid var(--border-glass)' }}>REMOTAN</div>
        {REMOTAN_NAV.filter(({ key }) => canAccessTab(currentRole, key)).map(({ key, label }) => (
          <div key={key} className={`menu-item ${activeTab === key ? 'active' : ''}`} onClick={() => { setActiveTab(key as AdminTab); setMobileSidebarOpen(false); }} style={{ color: activeTab === key ? 'var(--accent-teal)' : undefined, background: activeTab === key ? 'rgba(10,191,188,0.08)' : undefined, borderColor: activeTab === key ? 'rgba(10,191,188,0.2)' : undefined }}>
            <span style={{ fontSize: '15px', display: 'flex', alignItems: 'center' }}>{renderSidebarIcon(key)}</span>
            <span>{label}</span>
          </div>
        ))}
      </div>

      <div className="sidebar-footer">
        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Logged in as</div>
        {/* Was hardcoded "Super Admin" for everyone, whatever they actually were. */}
        <div style={{ fontSize: '13px', fontWeight: 600, marginTop: '2px' }}>
          {ROLE_LABELS[currentRole as keyof typeof ROLE_LABELS] || 'Operator'}
        </div>
        <div style={{ fontSize: '11px', color: 'var(--accent-teal)', marginTop: '2px' }}>Kongila + Remotan</div>
        <button
          onClick={async () => {
            await supabase.auth.signOut();
            setIsAuthenticated(false);
          }}
          style={{
            marginTop: '12px',
            background: 'none',
            border: '1px solid rgba(255,255,255,0.1)',
            color: 'var(--text-secondary)',
            padding: '6px 12px',
            borderRadius: '6px',
            fontSize: '11px',
            cursor: 'pointer',
            width: '100%'
          }}
        >
          Sign Out
        </button>
      </div>
    </>
  );

  // Render check
  if (authChecking) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-primary, #0B0F19)' }}>
        <KongilaLoader text="Loading Admin Portal..." />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <AdminLogin
        onLoginSuccess={(role, userId) => {
          setIsAuthenticated(true);
          setCurrentRole(role);
          setCurrentAdminId(userId);
          if (typeof window !== 'undefined') sessionStorage.setItem('kongila_admin_auth', 'true');
        }}
      />
    );
  }

  return (
    <div className="app-shell">
      <Head>
        <title>Kongila Admin — Dashboard</title>
        <meta name="description" content="Full admin powerhouse managing Kongila and Remotan — vetting, matching, contracts, compliance, support, and payroll." />
      </Head>

      {/* Mobile Top Bar */}
      <div className="mobile-nav-bar" style={{ display: 'none' }}>
        <div className="sidebar-logo" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '2px' }}>
          <img src="/images/kongilalogo.png" alt="Kongila" style={{ width: '110px', height: 'auto', objectFit: 'contain' }} />
          <span style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Admin Portal</span>
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

      {showPrivateNoteModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.72)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
          <div style={{ width: '100%', maxWidth: '520px', background: 'var(--bg-card)', border: '1px solid var(--border-glass)', borderRadius: '12px', padding: '24px', boxShadow: '0 24px 80px rgba(0,0,0,0.35)' }}>
            <div style={{ fontSize: '12px', color: '#8B5CF6', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>Internal Talent Note</div>
            <h3 style={{ fontSize: '20px', fontWeight: 900, color: 'var(--text-primary)', margin: '0 0 8px 0' }}>
              Add a private note (Talent Management Only)
            </h3>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6, margin: '0 0 16px 0' }}>
              This note will only be visible to internal admins and talent managers. It will not be shared with the talent or external clients.
            </p>
            <textarea
              value={privateNoteInput}
              onChange={e => setPrivateNoteInput(e.target.value)}
              rows={4}
              placeholder="Private observations, flags, or notes..."
              className="form-input"
              style={{ width: '100%', resize: 'vertical', fontSize: '14px', padding: '12px', marginBottom: '16px' }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                onClick={() => {
                  setShowPrivateNoteModal(false);
                  setPrivateNoteInput('');
                  handleStageDecision(2, 'Proceed', stageScoreInput, stageNotesInput);
                }}
                style={{ padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border-glass)', background: 'transparent', color: 'var(--text-secondary)', fontSize: '13px', fontWeight: 800, cursor: 'pointer' }}
              >
                Skip
              </button>
              <button
                disabled={saving}
                onClick={() => {
                  const finalNotes = privateNoteInput.trim() ? stageNotesInput + '\n\n--- Private Note (Talent Management Only) ---\n' + privateNoteInput : stageNotesInput;
                  handleStageDecision(2, 'Proceed', stageScoreInput, finalNotes);
                  setShowPrivateNoteModal(false);
                  setPrivateNoteInput('');
                }}
                style={{ padding: '10px 14px', borderRadius: '8px', border: 'none', background: '#10B981', color: '#fff', fontSize: '13px', fontWeight: 800, cursor: 'pointer' }}
              >
                Submit & Proceed
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
