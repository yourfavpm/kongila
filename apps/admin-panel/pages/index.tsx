import React, { useState, useEffect, useRef } from 'react';
import Head from 'next/head';
import { GlassCard, Badge, NeonButton, AgentBadge } from '@kongila/ui';
import { formatCurrency, formatDate, getGradeColor } from '@kongila/utils';
import { calculateCompositeVettingGrade, generateMatchesForRequest } from '@kongila/matching-engine';
import { computePlatformMetrics } from '@kongila/analytics';
import {
  TalentProfile, ServiceRequest, Match, AuditLog, AgentLog, Interview, RehireRequest
} from '@kongila/shared-types';

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
}

interface Assessment {
  id: string;
  title: string;
  description: string;
  skillTags: string[];
  questionCount: number;
  timeLimit: number;
  passingScore: number;
  status: string;
  assignedTalents?: string[];
  createdAt: string;
}

interface AssessmentResult {
  id: string;
  assessmentId: string;
  talentId: string;
  score: number;
  passed: boolean;
  completedAt: string;
}

// ─── SIDEBAR NAV CONFIG ──────────────────────────────────────────────────────

const KONGILA_NAV = [
  { key: 'overview', label: 'Command Hub' },
  { key: 'talent-pipeline', label: 'Talent Pipeline' },
  { key: 'client-pipeline', label: 'Client Pipeline' },
  { key: 'hiring-requests', label: 'Hiring Requests' },
  { key: 'interviews', label: 'Interviews' },
  { key: 'vetting', label: 'Talent Vetting' },
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
  const [assessmentResults, setAssessmentResults] = useState<AssessmentResult[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [talentPayouts, setTalentPayouts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // ── Navigation
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // ── Selection
  const [selectedTalent, setSelectedTalent] = useState<TalentProfile | null>(null);
  const [selectedRequest, setSelectedRequest] = useState<ServiceRequest | null>(null);
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [selectedContract, setSelectedContract] = useState<any | null>(null);

  // ── Vetting form
  const [editScores, setEditScores] = useState({ technical: 90, workSimulation: 90, behavioral: 85, communication: 85, personality: 80, remoteReadiness: 90, experience: 80 });

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

  // ── Form states
  const [contractForm, setContractForm] = useState({ clientId: '', clientName: '', talentId: '', talentName: '', role: '', rateType: 'Monthly', rateAmount: '', startDate: '', endDate: '', engagementModel: 'Remote / Full-time Retainer', status: 'Draft', currency: 'USD' });
  const [docForm, setDocForm] = useState({ name: '', type: 'NDA', userId: '', adminNotes: '' });
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
        setTalents(db.talents || []);
        setRequests(db.clientRequests || []);
        setMatches(db.matches || []);
        setContracts(db.contracts || []);
        setAuditLogs(db.auditLogs || []);
        setAgentLogs(db.agentLogs || []);
        setRehireRequests(db.rehireRequests || []);
        setUsers(db.users || []);
        setOrganizations(db.organizations || []);
        setClientProfiles(db.clientProfiles || []);
        setDocuments(db.documents || []);
        setSupportTickets(db.supportTickets || []);
        setSupportMessages(db.supportMessages || []);
        setAssessments(db.assessments || []);
        setAssessmentResults(db.skillAssessmentResults || []);
        setInvoices(db.invoices || []);
        setPayments(db.payments || []);
        setTalentPayouts(db.talentPayouts || []);
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
    return () => clearInterval(interval);
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
      await fetch('/api/db', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedDb),
      });
    } catch (e) {
      console.error('Failed to save DB', e);
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
    const newAgentLog: AgentLog = { id: `alog_${Date.now()}`, agentName: 'Compliance Agent', message: `Audit completed: ${selectedTalent.name} composite score locked at ${calculation.score}%.`, timestamp: new Date().toLocaleTimeString(), type: calculation.grade === 'Reject' ? 'error' : 'success' };
    setTalents(updatedTalents);
    setAuditLogs([newAuditLog, ...auditLogs]);
    setAgentLogs([newAgentLog, ...agentLogs]);
    setSelectedTalent(updatedTalents.find(t => t.id === selectedTalent.id) || null);
    await saveToDb({ talents: updatedTalents, clientRequests: requests, matches, contracts, auditLogs: [newAuditLog, ...auditLogs], agentLogs: [newAgentLog, ...agentLogs], interviews, rehireRequests, tasks: [] });
    setSaving(false);
  };

  // Matching
  const handlePushMatch = async (matchId: string) => {
    const updatedMatches = matches.map(m => m.id === matchId ? { ...m, status: 'Shortlisted' as const } : m);
    const targetMatch = matches.find(m => m.id === matchId);
    const talentName = targetMatch ? talents.find(t => t.id === targetMatch.talentId)?.name : 'Contractor';
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

  // Contracts
  const handleCreateContract = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const talent = talents.find(t => t.id === contractForm.talentId);
      const org = organizations.find(o => o.id === contractForm.clientId);
      const payload = {
        ...contractForm,
        talentName: talent?.name || contractForm.talentName,
        clientName: org?.name || contractForm.clientName,
        rateAmount: Number(contractForm.rateAmount),
        salary: Number(contractForm.rateAmount),
      };
      const res = await fetch('/api/contracts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (res.ok) {
        const newContract = await res.json();
        setContracts([...contracts, newContract]);
        setShowContractModal(false);
        setContractForm({ clientId: '', clientName: '', talentId: '', talentName: '', role: '', rateType: 'Monthly', rateAmount: '', startDate: '', endDate: '', engagementModel: 'Remote / Full-time Retainer', status: 'Draft', currency: 'USD' });
        await syncFromDb();
      }
    } catch (e) { console.error(e); }
    setSaving(false);
  };

  const handleUpdateContractStatus = async (contractId: string, newStatus: string) => {
    try {
      const res = await fetch('/api/contracts', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: contractId, status: newStatus, signedAt: newStatus === 'Signed' ? new Date().toISOString() : undefined }) });
      if (res.ok) {
        await syncFromDb();
        if (selectedContract?.id === contractId) setSelectedContract({ ...selectedContract, status: newStatus });
      }
    } catch (e) { console.error(e); }
  };

  // Compliance
  const handleCreateDoc = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const docTemplates: Record<string, string> = {
      NDA: 'Non-Disclosure Agreement',
      agreement: 'Independent Contractor Agreement',
      DPA: 'Data Privacy Addendum (DPA)',
      IT_Ethics_Policy: 'Code of Ethics & Conduct',
      certification: 'Professional Certification',
      CV: 'Curriculum Vitae',
      portfolio: 'Portfolio Document',
    };
    const payload = { ...docForm, name: docTemplates[docForm.type] || docForm.name || docForm.type, fileSize: '—', status: 'pending_signature' };
    try {
      const res = await fetch('/api/compliance', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (res.ok) {
        setShowDocModal(false);
        setDocForm({ name: '', type: 'NDA', userId: '', adminNotes: '' });
        await syncFromDb();
      }
    } catch (e) { console.error(e); }
    setSaving(false);
  };

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

  const filteredTalents = talentFilter === 'All' ? talents : talents.filter(t => t.vettingStatus === talentFilter);
  const filteredRequests = requestFilter === 'All' ? requests : requests.filter(r => r.status === requestFilter);
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

  const Chip = ({ label }: { label: string }) => (
    <span style={{ display: 'inline-flex', alignItems: 'center', padding: '3px 10px', borderRadius: '999px', fontSize: '11px', fontWeight: 600, background: statusBg(label), color: statusColor(label), whiteSpace: 'nowrap' }}>{label}</span>
  );

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

      // ── COMMAND HUB ────────────────────────────────────────────────────────
      case 'overview': return (
        <div>
          <div className="page-header">
            <div>
              <h1 className="page-title">Command Hub</h1>
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

          <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
            {['All', 'Applied', 'Pending', 'Review', 'Vetted'].map(f => (
              <button key={f} onClick={() => { setTalentFilter(f); setSelectedTalent(null); }} style={{ padding: '6px 16px', borderRadius: '999px', border: `1px solid ${talentFilter === f ? 'var(--kongila-blue)' : 'var(--border-glass)'}`, background: talentFilter === f ? 'var(--kongila-blue-glow)' : 'var(--bg-secondary)', color: talentFilter === f ? 'var(--kongila-blue)' : 'var(--text-secondary)', fontWeight: talentFilter === f ? 600 : 400, fontSize: '13px', cursor: 'pointer', transition: 'all 0.2s' }}>{f}</button>
            ))}
            <span style={{ marginLeft: 'auto', fontSize: '12px', color: 'var(--text-muted)', alignSelf: 'center' }}>{filteredTalents.length} talent{filteredTalents.length !== 1 ? 's' : ''}</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: selectedTalent ? '1fr 1.4fr' : '1fr', gap: '24px' }}>
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
                    <tr key={t.id} onClick={() => setSelectedTalent(selectedTalent?.id === t.id ? null : t)} style={{ cursor: 'pointer', background: selectedTalent?.id === t.id ? 'var(--kongila-blue-glow)' : undefined }}>
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
                      <td><span style={{ fontWeight: 800, fontSize: '14px', color: getGradeColor(t.grade) }}>{t.grade}</span></td>
                      <td><Chip label={t.vettingStatus} /></td>
                      <td style={{ fontSize: '12px' }}>{t.experienceYears}y</td>
                      <td style={{ fontSize: '12px', fontWeight: 600 }}>{t.salaryExpectation ? formatCurrency(t.salaryExpectation) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {selectedTalent && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <GlassCard>
                  <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start', marginBottom: '16px' }}>
                    {selectedTalent.avatar ? <img src={selectedTalent.avatar} alt="" style={{ width: '64px', height: '64px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} /> : <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', flexShrink: 0 }}>👤</div>}
                    <div>
                      <h3 style={{ fontSize: '17px', fontWeight: 700 }}>{selectedTalent.name}</h3>
                      <div style={{ fontSize: '13px', color: 'var(--accent-cyan)' }}>{selectedTalent.title}</div>
                      <div style={{ display: 'flex', gap: '8px', marginTop: '8px', flexWrap: 'wrap' }}>
                        <Chip label={selectedTalent.vettingStatus} />
                        <span style={{ fontWeight: 800, color: getGradeColor(selectedTalent.grade) }}>Grade: {selectedTalent.grade}</span>
                      </div>
                    </div>
                  </div>
                  <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '14px' }}>{selectedTalent.bio || 'No bio provided.'}</p>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '12px' }}>
                    {[
                      { label: 'Timezone', val: selectedTalent.timezone },
                      { label: 'Experience', val: `${selectedTalent.experienceYears} years` },
                      { label: 'Expected Rate', val: selectedTalent.salaryExpectation ? formatCurrency(selectedTalent.salaryExpectation) + '/mo' : '—' },
                      { label: 'Availability', val: `${selectedTalent.availability}%` },
                      { label: 'Vetting Stage', val: selectedTalent.vettingStage },
                    ].map(({ label, val }) => (
                      <div key={label}>
                        <div style={{ color: 'var(--text-muted)', marginBottom: '2px' }}>{label}</div>
                        <div style={{ fontWeight: 600 }}>{val}</div>
                      </div>
                    ))}
                  </div>
                  {selectedTalent.tags && selectedTalent.tags.length > 0 && (
                    <div style={{ marginTop: '14px', display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      {selectedTalent.tags.map(tag => <span key={tag} style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '999px', background: 'var(--kongila-blue-glow)', color: 'var(--kongila-blue)', fontWeight: 500 }}>{tag}</span>)}
                    </div>
                  )}
                </GlassCard>

                <GlassCard>
                  <h4 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '14px' }}>7-Stage Vetting Scores</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {Object.entries(selectedTalent.vettingScores).map(([key, val]) => (
                      <div key={key}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '4px' }}>
                          <span style={{ color: 'var(--text-secondary)', textTransform: 'capitalize' }}>{key.replace(/([A-Z])/g, ' $1')}</span>
                          <span style={{ fontWeight: 700 }}>{val}%</span>
                        </div>
                        <div style={{ height: '6px', background: 'var(--bg-tertiary)', borderRadius: '999px', overflow: 'hidden' }}>
                          <div style={{ width: `${val}%`, height: '100%', background: val >= 85 ? 'var(--accent-green)' : val >= 70 ? 'var(--accent-gold)' : 'var(--accent-magenta)', borderRadius: '999px', transition: 'width 0.5s ease' }} />
                        </div>
                      </div>
                    ))}
                  </div>
                  <div style={{ marginTop: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Composite Grade</span>
                    <span style={{ fontSize: '20px', fontWeight: 800, color: getGradeColor(selectedTalent.grade) }}>{selectedTalent.grade} — {calculateCompositeVettingGrade(selectedTalent.vettingScores).score}%</span>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', marginTop: '12px', flexWrap: 'wrap' }}>
                    <button onClick={() => setActiveTab('vetting')} className="btn-primary" style={{ height: '34px', padding: '0 14px', fontSize: '12px', borderRadius: '8px' }}>Edit Scorecard</button>
                    <button onClick={() => setActiveTab('matching')} className="btn-secondary" style={{ height: '34px', padding: '0 14px', fontSize: '12px', borderRadius: '8px' }}>Shortlist</button>
                  </div>
                </GlassCard>
              </div>
            )}
          </div>
        </div>
      );

      // ── CLIENT PIPELINE ────────────────────────────────────────────────────
      case 'client-pipeline': return (
        <div>
          <div className="page-header">
            <div>
              <h1 className="page-title">Client Pipeline</h1>
              <p className="page-subtitle">All registered client organizations — contracts, requests, and profiles.</p>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '20px' }}>
            {organizations.map(org => {
              const orgClients = clientProfiles.filter(cp => cp.organizationId === org.id);
              const orgUserIds = orgClients.map(cp => cp.userId);
              const orgContracts = contracts.filter(c => orgUserIds.includes(c.clientId) || c.clientName === org.name);
              const orgRequests = requests.filter(r => orgUserIds.includes(r.clientId) || r.clientName === org.name);
              const activeContracts = orgContracts.filter(c => c.status === 'Signed' || c.status === 'Active');
              return (
                <GlassCard key={org.id} style={{ cursor: 'default' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '16px' }}>{org.name}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>ID: {org.id}</div>
                    </div>
                    <div style={{ fontSize: '11px', background: 'var(--kongila-blue-glow)', color: 'var(--kongila-blue)', padding: '3px 10px', borderRadius: '999px', fontWeight: 600 }}>Client</div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '12px', marginBottom: '14px' }}>
                    <div style={{ background: 'var(--bg-tertiary)', borderRadius: '8px', padding: '10px' }}>
                      <div style={{ color: 'var(--text-muted)', marginBottom: '2px' }}>Active Contracts</div>
                      <div style={{ fontWeight: 700, fontSize: '18px', color: 'var(--accent-green)' }}>{activeContracts.length}</div>
                    </div>
                    <div style={{ background: 'var(--bg-tertiary)', borderRadius: '8px', padding: '10px' }}>
                      <div style={{ color: 'var(--text-muted)', marginBottom: '2px' }}>Open Requests</div>
                      <div style={{ fontWeight: 700, fontSize: '18px', color: 'var(--accent-gold)' }}>{orgRequests.filter(r => r.status === 'New Request').length}</div>
                    </div>
                  </div>
                  {orgClients.length > 0 && (
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                      <strong>Users:</strong> {orgClients.length} profile{orgClients.length !== 1 ? 's' : ''}
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                    <button onClick={() => { setActiveTab('hiring-requests'); setRequestFilter('All'); }} className="btn-secondary" style={{ fontSize: '11px', height: '30px', padding: '0 12px', borderRadius: '6px' }}>View Requests</button>
                    <button onClick={() => { setActiveTab('contracts'); setContractFilter('All'); }} className="btn-secondary" style={{ fontSize: '11px', height: '30px', padding: '0 12px', borderRadius: '6px' }}>View Contracts</button>
                  </div>
                </GlassCard>
              );
            })}
            {organizations.length === 0 && (
              <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>
                <div style={{ fontSize: '40px', marginBottom: '12px' }}>🏢</div>
                <p>No client organizations registered yet.</p>
              </div>
            )}
          </div>
        </div>
      );

      // ── HIRING REQUESTS ────────────────────────────────────────────────────
      case 'hiring-requests': return (
        <div>
          <div className="page-header">
            <div>
              <h1 className="page-title">Hiring Requests</h1>
              <p className="page-subtitle">All client intake requests — review, update status, and trigger matching.</p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
            {['All', 'New Request', 'In Progress', 'Matched', 'Fulfilled', 'Cancelled'].map(f => (
              <button key={f} onClick={() => setRequestFilter(f)} style={{ padding: '6px 14px', borderRadius: '999px', border: `1px solid ${requestFilter === f ? 'var(--kongila-blue)' : 'var(--border-glass)'}`, background: requestFilter === f ? 'var(--kongila-blue-glow)' : 'var(--bg-secondary)', color: requestFilter === f ? 'var(--kongila-blue)' : 'var(--text-secondary)', fontWeight: requestFilter === f ? 600 : 400, fontSize: '12px', cursor: 'pointer' }}>{f}</button>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 2fr', gap: '24px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {filteredRequests.length === 0 ? (
                <GlassCard style={{ textAlign: 'center', padding: '40px' }}>
                  <div style={{ fontSize: '32px', marginBottom: '8px' }}>📋</div>
                  <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>No requests match this filter.</p>
                </GlassCard>
              ) : filteredRequests.map(req => (
                <div key={req.id} onClick={() => setSelectedRequest(selectedRequest?.id === req.id ? null : req as any)} style={{ background: 'var(--bg-secondary)', border: `1px solid ${selectedRequest?.id === req.id ? 'var(--kongila-blue)' : 'var(--border-glass)'}`, borderRadius: '14px', padding: '16px', cursor: 'pointer', transition: 'all 0.2s' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 700 }}>{req.roleDescription || req.serviceType}</span>
                    <Chip label={req.status} />
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Client: <strong>{req.clientName}</strong></div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Commitment: {req.commitmentLevel} · {req.duration}</div>
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px' }}>{formatDate(req.createdAt)}</div>
                </div>
              ))}

              <GlassCard>
                <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '12px' }}>Re-hire Requests</h3>
                {rehireRequests.filter(r => r.status === 'Pending').length === 0 ? (
                  <p style={{ color: 'var(--text-muted)', fontSize: '12px' }}>No pending re-hire requests.</p>
                ) : rehireRequests.filter(r => r.status === 'Pending').map(rehire => (
                  <div key={rehire.id} style={{ padding: '12px', background: 'var(--bg-tertiary)', borderRadius: '10px', marginBottom: '10px' }}>
                    <div style={{ fontSize: '13px', fontWeight: 700 }}>{rehire.talentName}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Role: {rehire.role} · {formatCurrency(rehire.proposedRate)}/mo</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Start: {rehire.proposedStartDate}</div>
                    <NeonButton onClick={() => handleApproveRehire(rehire.id)} style={{ width: '100%', marginTop: '10px', background: 'var(--accent-cyan)', color: '#000', padding: '6px', fontSize: '11px' }}>Approve Re-hire</NeonButton>
                  </div>
                ))}
              </GlassCard>
            </div>

            <div>
              {!selectedRequest ? (
                <GlassCard style={{ textAlign: 'center', padding: '60px' }}>
                  <div style={{ fontSize: '40px', marginBottom: '12px' }}>📋</div>
                  <p style={{ color: 'var(--text-secondary)' }}>Select a request to view full details and manage it.</p>
                </GlassCard>
              ) : (
                <GlassCard>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
                    <div>
                      <h3 style={{ fontSize: '17px', fontWeight: 700 }}>{selectedRequest.roleDescription || selectedRequest.serviceType}</h3>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>Client: {selectedRequest.clientName} · {formatDate(selectedRequest.createdAt)}</div>
                    </div>
                    <Chip label={selectedRequest.status} />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px', fontSize: '13px' }}>
                    {[
                      { label: 'Service Type', val: selectedRequest.serviceType },
                      { label: 'Commitment', val: selectedRequest.commitmentLevel },
                      { label: 'Duration', val: selectedRequest.duration },
                      { label: 'Hires Needed', val: String(selectedRequest.numberOfHires || 1) },
                      { label: 'Timezone', val: selectedRequest.timezone },
                      { label: 'Priority', val: selectedRequest.priority },
                      { label: 'Budget', val: selectedRequest.budget ? formatCurrency(Number(selectedRequest.budget)) : 'Not specified' },
                      { label: 'Start Date', val: selectedRequest.startDate || 'Flexible' },
                    ].map(({ label, val }) => (
                      <div key={label} style={{ background: 'var(--bg-tertiary)', borderRadius: '8px', padding: '10px' }}>
                        <div style={{ color: 'var(--text-muted)', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '2px' }}>{label}</div>
                        <div style={{ fontWeight: 600 }}>{val}</div>
                      </div>
                    ))}
                  </div>

                  {selectedRequest.requiredSkills && selectedRequest.requiredSkills.length > 0 && (
                    <div style={{ marginBottom: '16px' }}>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '6px' }}>Required Skills</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                        {selectedRequest.requiredSkills.map((skill: string) => <span key={skill} style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '999px', background: 'var(--kongila-blue-glow)', color: 'var(--kongila-blue)' }}>{skill}</span>)}
                      </div>
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <button onClick={() => handleUpdateRequestStatus(selectedRequest.id, 'In Progress')} className="btn-primary" style={{ fontSize: '12px', height: '34px', padding: '0 14px', borderRadius: '8px' }}>Mark In Progress</button>
                    <button onClick={() => handleUpdateRequestStatus(selectedRequest.id, 'Fulfilled')} className="btn-secondary" style={{ fontSize: '12px', height: '34px', padding: '0 14px', borderRadius: '8px', color: 'var(--accent-green)', borderColor: 'var(--accent-green)' }}>Mark Fulfilled</button>
                    <button onClick={() => { setActiveTab('matching'); }} className="btn-secondary" style={{ fontSize: '12px', height: '34px', padding: '0 14px', borderRadius: '8px' }}>Go to Matching</button>
                    <button onClick={() => handleUpdateRequestStatus(selectedRequest.id, 'Cancelled')} className="btn-secondary" style={{ fontSize: '12px', height: '34px', padding: '0 14px', borderRadius: '8px', color: 'var(--accent-magenta)', borderColor: 'var(--accent-magenta)' }}>Cancel Request</button>
                  </div>
                </GlassCard>
              )}
            </div>
          </div>
        </div>
      );

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
          <div className="page-header"><div><h1 className="page-title">Talent Vetting Framework</h1><p className="page-subtitle">Evaluate and recalculate 7-stage vetting scorecards for each applicant.</p></div></div>
          <div className="dashboard-grid">
            <GlassCard>
              <h2 style={{ fontSize: '16px', marginBottom: '16px' }}>Applicant Pool</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {talents.map(t => (
                  <div key={t.id} onClick={() => setSelectedTalent(selectedTalent?.id === t.id ? null : t)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: selectedTalent?.id === t.id ? 'var(--kongila-blue-glow)' : 'var(--bg-tertiary)', padding: '12px 14px', borderRadius: '10px', border: `1px solid ${selectedTalent?.id === t.id ? 'var(--kongila-blue)' : 'var(--border-glass)'}`, cursor: 'pointer', transition: 'all 0.2s' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      {t.avatar ? <img src={t.avatar} alt="" style={{ width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover' }} /> : <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'var(--bg-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px' }}>👤</div>}
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: 700 }}>{t.name}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{t.title}</div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <Chip label={t.vettingStatus} />
                      <span style={{ fontWeight: 800, color: getGradeColor(t.grade) }}>{t.grade}</span>
                    </div>
                  </div>
                ))}
              </div>
            </GlassCard>

            <div>
              {!selectedTalent ? (
                <GlassCard style={{ textAlign: 'center', padding: '40px' }}>
                  <div style={{ fontSize: '32px', marginBottom: '10px' }}>🛡️</div>
                  <p style={{ color: 'var(--text-secondary)' }}>Select an applicant to edit their vetting scorecard.</p>
                </GlassCard>
              ) : (
                <GlassCard>
                  <h3 style={{ fontSize: '16px', marginBottom: '4px' }}>Edit: {selectedTalent.name}</h3>
                  <p style={{ color: 'var(--text-muted)', fontSize: '12px', marginBottom: '20px' }}>Adjust weights — grades auto-compute.</p>
                  <form onSubmit={handleVettingSubmit}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                      {[
                        { key: 'technical', label: 'Technical Assessment (25%)' },
                        { key: 'workSimulation', label: 'Work Simulation (20%)' },
                        { key: 'behavioral', label: 'Behavioural Fit (15%)' },
                        { key: 'communication', label: 'Communication Skills (15%)' },
                        { key: 'personality', label: 'Personality Style (10%)' },
                        { key: 'remoteReadiness', label: 'Remote Readiness (10%)' },
                        { key: 'experience', label: 'Experience Level (5%)' },
                      ].map(({ key, label }) => (
                        <div key={key}>
                          <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span>{label}</span><span>{(editScores as any)[key]}%</span>
                          </label>
                          <input type="range" min="0" max="100" className="form-input" style={{ padding: 0 }} value={(editScores as any)[key]} onChange={e => setEditScores({ ...editScores, [key]: parseInt(e.target.value) })} />
                        </div>
                      ))}
                    </div>
                    <hr style={{ borderColor: 'var(--border-glass)', margin: '20px 0' }} />
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>COMPOSITE GRADE</div>
                        <div style={{ fontSize: '22px', fontWeight: 800, color: getGradeColor(selectedTalent.grade) }}>{selectedTalent.grade} ({calculateCompositeVettingGrade(selectedTalent.vettingScores).score}%)</div>
                      </div>
                      <NeonButton type="submit" style={{ opacity: saving ? 0.6 : 1 }}>{saving ? 'Saving...' : 'Recalculate Vetting Card'}</NeonButton>
                    </div>
                  </form>
                </GlassCard>
              )}
            </div>
          </div>
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
                              <NeonButton onClick={() => handleShortlistCandidate(t.id)} style={{ padding: '6px 12px', fontSize: '11px' }}>+ Shortlist</NeonButton>
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
        <div>
          <div className="page-header">
            <div><h1 className="page-title">Contracts & Offers</h1><p className="page-subtitle">Draft, sign, and manage all talent contracts across clients.</p></div>
            <button onClick={() => setShowContractModal(true)} className="btn-primary" style={{ fontSize: '13px', height: '40px', padding: '0 18px', borderRadius: '10px' }}>+ Draft New Contract</button>
          </div>

          <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
            {['All', 'Draft', 'Signed', 'Active', 'Terminated'].map(f => (
              <button key={f} onClick={() => setContractFilter(f)} style={{ padding: '6px 14px', borderRadius: '999px', border: `1px solid ${contractFilter === f ? 'var(--kongila-blue)' : 'var(--border-glass)'}`, background: contractFilter === f ? 'var(--kongila-blue-glow)' : 'var(--bg-secondary)', color: contractFilter === f ? 'var(--kongila-blue)' : 'var(--text-secondary)', fontWeight: contractFilter === f ? 600 : 400, fontSize: '12px', cursor: 'pointer' }}>{f}</button>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: selectedContract ? '1fr 1.4fr' : '1fr', gap: '24px' }}>
            <div className="table-container">
              <table className="custom-table">
                <thead><tr>{['Contract ID', 'Talent', 'Client', 'Role', 'Rate', 'Status'].map(h => <th key={h}>{h}</th>)}</tr></thead>
                <tbody>
                  {filteredContracts.length === 0 ? (
                    <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '40px' }}>
                      <div style={{ fontSize: '32px', marginBottom: '8px' }}>📄</div>
                      No contracts found.
                    </td></tr>
                  ) : filteredContracts.map(c => (
                    <tr key={c.id} onClick={() => setSelectedContract(selectedContract?.id === c.id ? null : c)} style={{ cursor: 'pointer', background: selectedContract?.id === c.id ? 'var(--kongila-blue-glow)' : undefined }}>
                      <td><span style={{ fontWeight: 700, fontSize: '12px', color: 'var(--kongila-blue)', fontFamily: 'monospace' }}>{c.id}</span></td>
                      <td style={{ fontWeight: 600, fontSize: '13px' }}>{c.talentName}</td>
                      <td style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{c.clientName}</td>
                      <td style={{ fontSize: '12px' }}>{c.role}</td>
                      <td style={{ fontSize: '12px', fontWeight: 600 }}>{c.rateAmount ? formatCurrency(c.rateAmount) : formatCurrency(c.salary || 0)}/{c.rateType === 'Hourly' ? 'hr' : 'mo'}</td>
                      <td><Chip label={c.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {selectedContract && (
              <GlassCard>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
                  <div>
                    <h3 style={{ fontSize: '16px', fontWeight: 700 }}>{selectedContract.role}</h3>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'monospace', marginTop: '2px' }}>{selectedContract.id}</div>
                  </div>
                  <Chip label={selectedContract.status} />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '12px', marginBottom: '20px' }}>
                  {[
                    { label: 'Talent', val: selectedContract.talentName },
                    { label: 'Client', val: selectedContract.clientName },
                    { label: 'Rate', val: `${formatCurrency(selectedContract.rateAmount || selectedContract.salary || 0)} / ${selectedContract.rateType === 'Hourly' ? 'hr' : 'mo'}` },
                    { label: 'Engagement', val: selectedContract.engagementModel || '—' },
                    { label: 'Start Date', val: selectedContract.startDate || '—' },
                    { label: 'End Date', val: selectedContract.endDate || '—' },
                    { label: 'Signed At', val: selectedContract.signedAt ? formatDate(selectedContract.signedAt) : '—' },
                  ].map(({ label, val }) => (
                    <div key={label} style={{ background: 'var(--bg-tertiary)', borderRadius: '8px', padding: '10px' }}>
                      <div style={{ color: 'var(--text-muted)', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '2px' }}>{label}</div>
                      <div style={{ fontWeight: 600 }}>{val}</div>
                    </div>
                  ))}
                </div>

                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {selectedContract.status === 'Draft' && <button onClick={() => handleUpdateContractStatus(selectedContract.id, 'Signed')} className="btn-primary" style={{ fontSize: '12px', height: '34px', padding: '0 14px', borderRadius: '8px' }}>✓ Sign Contract</button>}
                  {(selectedContract.status === 'Draft' || selectedContract.status === 'Signed') && <button onClick={() => handleUpdateContractStatus(selectedContract.id, 'Active')} className="btn-secondary" style={{ fontSize: '12px', height: '34px', padding: '0 14px', borderRadius: '8px', color: 'var(--accent-green)', borderColor: 'var(--accent-green)' }}>Activate</button>}
                  {selectedContract.status !== 'Terminated' && <button onClick={() => handleUpdateContractStatus(selectedContract.id, 'Terminated')} className="btn-secondary" style={{ fontSize: '12px', height: '34px', padding: '0 14px', borderRadius: '8px', color: 'var(--accent-magenta)', borderColor: 'var(--accent-magenta)' }}>Terminate</button>}
                </div>
              </GlassCard>
            )}
          </div>

          {/* Contract Draft Modal */}
          {showContractModal && (
            <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setShowContractModal(false); }}>
              <div className="modal-content" style={{ padding: '32px', maxWidth: '640px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                  <h2 style={{ fontSize: '18px', fontWeight: 700 }}>Draft New Contract</h2>
                  <button onClick={() => setShowContractModal(false)} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: 'var(--text-secondary)' }}>✕</button>
                </div>
                <form onSubmit={handleCreateContract}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div>
                      <label className="form-label">Client Organization</label>
                      <select className="form-select" value={contractForm.clientId} onChange={e => { const org = organizations.find(o => o.id === e.target.value); setContractForm({ ...contractForm, clientId: e.target.value, clientName: org?.name || '' }); }} required>
                        <option value="">Select client...</option>
                        {organizations.map(org => <option key={org.id} value={org.id}>{org.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="form-label">Talent</label>
                      <select className="form-select" value={contractForm.talentId} onChange={e => { const t = talents.find(t => t.id === e.target.value); setContractForm({ ...contractForm, talentId: e.target.value, talentName: t?.name || '' }); }} required>
                        <option value="">Select talent...</option>
                        {talents.map(t => <option key={t.id} value={t.id}>{t.name} — {t.title}</option>)}
                      </select>
                    </div>
                    <div style={{ gridColumn: '1/-1' }}>
                      <label className="form-label">Role / Position</label>
                      <input type="text" className="form-input" value={contractForm.role} onChange={e => setContractForm({ ...contractForm, role: e.target.value })} placeholder="e.g. Senior Full-Stack Engineer" required />
                    </div>
                    <div>
                      <label className="form-label">Rate Type</label>
                      <select className="form-select" value={contractForm.rateType} onChange={e => setContractForm({ ...contractForm, rateType: e.target.value })}>
                        <option>Monthly</option><option>Hourly</option><option>Project-based</option>
                      </select>
                    </div>
                    <div>
                      <label className="form-label">Rate Amount (USD)</label>
                      <input type="number" className="form-input" value={contractForm.rateAmount} onChange={e => setContractForm({ ...contractForm, rateAmount: e.target.value })} placeholder="5000" required />
                    </div>
                    <div>
                      <label className="form-label">Start Date</label>
                      <input type="date" className="form-input" value={contractForm.startDate} onChange={e => setContractForm({ ...contractForm, startDate: e.target.value })} required />
                    </div>
                    <div>
                      <label className="form-label">End Date (optional)</label>
                      <input type="date" className="form-input" value={contractForm.endDate} onChange={e => setContractForm({ ...contractForm, endDate: e.target.value })} />
                    </div>
                    <div style={{ gridColumn: '1/-1' }}>
                      <label className="form-label">Engagement Model</label>
                      <select className="form-select" value={contractForm.engagementModel} onChange={e => setContractForm({ ...contractForm, engagementModel: e.target.value })}>
                        <option>Remote / Full-time Retainer</option>
                        <option>Remote / Part-time</option>
                        <option>Remote / Project-based</option>
                        <option>Hybrid</option>
                        <option>On-site</option>
                      </select>
                    </div>
                    <div style={{ gridColumn: '1/-1' }}>
                      <label className="form-label">Initial Status</label>
                      <select className="form-select" value={contractForm.status} onChange={e => setContractForm({ ...contractForm, status: e.target.value })}>
                        <option value="Draft">Draft</option>
                        <option value="Signed">Signed (immediately active)</option>
                      </select>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
                    <button type="submit" className="btn-primary" style={{ flex: 1, opacity: saving ? 0.7 : 1 }}>{saving ? 'Saving...' : 'Create Contract'}</button>
                    <button type="button" onClick={() => setShowContractModal(false)} className="btn-secondary" style={{ flex: 1 }}>Cancel</button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      );

      // ── COMPLIANCE DOCS ────────────────────────────────────────────────────
      case 'compliance': return (
        <div>
          <div className="page-header">
            <div><h1 className="page-title">Compliance Documents</h1><p className="page-subtitle">Create, assign, and track all legal and compliance documents.</p></div>
            <button onClick={() => setShowDocModal(true)} className="btn-primary" style={{ fontSize: '13px', height: '40px', padding: '0 18px', borderRadius: '10px' }}>+ Create Document</button>
          </div>

          <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
            {['All', 'pending_signature', 'signed', 'verified', 'vetted', 'under_review'].map(f => (
              <button key={f} onClick={() => setDocFilter(f)} style={{ padding: '6px 14px', borderRadius: '999px', border: `1px solid ${docFilter === f ? 'var(--kongila-blue)' : 'var(--border-glass)'}`, background: docFilter === f ? 'var(--kongila-blue-glow)' : 'var(--bg-secondary)', color: docFilter === f ? 'var(--kongila-blue)' : 'var(--text-secondary)', fontWeight: docFilter === f ? 600 : 400, fontSize: '12px', cursor: 'pointer' }}>{f === 'All' ? 'All' : f.replace('_', ' ')}</button>
            ))}
          </div>

          <div className="table-container">
            <table className="custom-table">
              <thead><tr>{['Document', 'Type', 'Assigned To', 'Size', 'Status', 'Uploaded', 'Actions'].map(h => <th key={h}>{h}</th>)}</tr></thead>
              <tbody>
                {filteredDocs.length === 0 ? (
                  <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '40px' }}>
                    <div style={{ fontSize: '32px', marginBottom: '8px' }}>🔒</div>
                    No compliance documents found.
                  </td></tr>
                ) : filteredDocs.map(doc => {
                  const talent = talents.find(t => {
                    const user = users.find(u => u.id === doc.userId);
                    return user && t.id === `talent_${user.id.split('_').pop()}` || t.id === doc.userId;
                  });
                  return (
                    <tr key={doc.id}>
                      <td style={{ fontWeight: 600, fontSize: '13px' }}>{doc.name}</td>
                      <td><Chip label={doc.type} /></td>
                      <td style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{talent?.name || doc.userId || '—'}</td>
                      <td style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{doc.fileSize || '—'}</td>
                      <td><Chip label={doc.status} /></td>
                      <td style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{formatDate(doc.uploadedAt)}</td>
                      <td>
                        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                          {doc.status === 'pending_signature' && <button onClick={() => handleUpdateDocStatus(doc.id, 'signed')} style={{ padding: '3px 8px', borderRadius: '6px', background: 'rgba(16,185,129,0.1)', color: 'var(--accent-green)', border: 'none', cursor: 'pointer', fontSize: '10px', fontWeight: 600 }}>Mark Signed</button>}
                          {doc.status === 'signed' && <button onClick={() => handleUpdateDocStatus(doc.id, 'verified')} style={{ padding: '3px 8px', borderRadius: '6px', background: 'var(--kongila-blue-glow)', color: 'var(--kongila-blue)', border: 'none', cursor: 'pointer', fontSize: '10px', fontWeight: 600 }}>Verify</button>}
                          {doc.status !== 'under_review' && <button onClick={() => handleUpdateDocStatus(doc.id, 'under_review')} style={{ padding: '3px 8px', borderRadius: '6px', background: 'rgba(245,158,11,0.1)', color: 'var(--accent-gold)', border: 'none', cursor: 'pointer', fontSize: '10px', fontWeight: 600 }}>Review</button>}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {showDocModal && (
            <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setShowDocModal(false); }}>
              <div className="modal-content" style={{ padding: '32px', maxWidth: '520px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                  <h2 style={{ fontSize: '18px', fontWeight: 700 }}>Create Compliance Document</h2>
                  <button onClick={() => setShowDocModal(false)} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: 'var(--text-secondary)' }}>✕</button>
                </div>
                <form onSubmit={handleCreateDoc}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div>
                      <label className="form-label">Document Type</label>
                      <select className="form-select" value={docForm.type} onChange={e => setDocForm({ ...docForm, type: e.target.value })} required>
                        <option value="NDA">Non-Disclosure Agreement (NDA)</option>
                        <option value="agreement">Independent Contractor Agreement</option>
                        <option value="DPA">Data Privacy Addendum (DPA)</option>
                        <option value="IT_Ethics_Policy">Code of Ethics & Conduct</option>
                        <option value="certification">Professional Certification</option>
                        <option value="CV">Curriculum Vitae</option>
                      </select>
                    </div>
                    <div>
                      <label className="form-label">Assign to Talent (optional)</label>
                      <select className="form-select" value={docForm.userId} onChange={e => setDocForm({ ...docForm, userId: e.target.value })}>
                        <option value="">Not assigned</option>
                        {talents.map(t => <option key={t.id} value={t.id}>{t.name} — {t.title}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="form-label">Admin Notes (optional)</label>
                      <textarea className="form-textarea" style={{ minHeight: '80px' }} value={docForm.adminNotes} onChange={e => setDocForm({ ...docForm, adminNotes: e.target.value })} placeholder="Any internal notes about this document..." />
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
                    <button type="submit" className="btn-primary" style={{ flex: 1, opacity: saving ? 0.7 : 1 }}>{saving ? 'Creating...' : 'Create Document'}</button>
                    <button type="button" onClick={() => setShowDocModal(false)} className="btn-secondary" style={{ flex: 1 }}>Cancel</button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      );

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
                      {assessment.skillTags.map(tag => <span key={tag} style={{ fontSize: '10px', padding: '2px 7px', borderRadius: '999px', background: 'var(--kongila-blue-glow)', color: 'var(--kongila-blue)', fontWeight: 500 }}>{tag}</span>)}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', fontSize: '11px', marginBottom: '14px' }}>
                      <div style={{ background: 'var(--bg-tertiary)', borderRadius: '6px', padding: '8px', textAlign: 'center' }}>
                        <div style={{ color: 'var(--text-muted)' }}>Questions</div>
                        <div style={{ fontWeight: 700, fontSize: '16px' }}>{assessment.questionCount}</div>
                      </div>
                      <div style={{ background: 'var(--bg-tertiary)', borderRadius: '6px', padding: '8px', textAlign: 'center' }}>
                        <div style={{ color: 'var(--text-muted)' }}>Time Limit</div>
                        <div style={{ fontWeight: 700, fontSize: '16px' }}>{assessment.timeLimit}m</div>
                      </div>
                      <div style={{ background: 'var(--bg-tertiary)', borderRadius: '6px', padding: '8px', textAlign: 'center' }}>
                        <div style={{ color: 'var(--text-muted)' }}>Pass Score</div>
                        <div style={{ fontWeight: 700, fontSize: '16px' }}>{assessment.passingScore}%</div>
                      </div>
                    </div>
                    {results.length > 0 && (
                      <div style={{ marginBottom: '12px', padding: '10px', background: 'var(--bg-tertiary)', borderRadius: '8px', fontSize: '12px' }}>
                        <strong>Results:</strong> {results.length} submitted · {passed} passed ({results.length > 0 ? Math.round((passed / results.length) * 100) : 0}% pass rate)
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: '6px' }}>
                      {assessment.status === 'active' && <button onClick={() => handleArchiveAssessment(assessment.id)} style={{ fontSize: '11px', padding: '4px 10px', borderRadius: '6px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-glass)', cursor: 'pointer', color: 'var(--text-secondary)' }}>Archive</button>}
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
                  <thead><tr>{['Talent', 'Assessment', 'Score', 'Passed', 'Completed'].map(h => <th key={h}>{h}</th>)}</tr></thead>
                  <tbody>
                    {assessmentResults.map(r => {
                      const talent = talents.find(t => t.id === r.talentId);
                      const assessment = assessments.find(a => a.id === r.assessmentId);
                      return (
                        <tr key={r.id}>
                          <td style={{ fontWeight: 600, fontSize: '13px' }}>{talent?.name || r.talentId}</td>
                          <td style={{ fontSize: '12px' }}>{assessment?.title || r.assessmentId}</td>
                          <td style={{ fontWeight: 700, color: r.score >= (assessment?.passingScore || 70) ? 'var(--accent-green)' : 'var(--accent-magenta)', fontSize: '14px' }}>{r.score}%</td>
                          <td><Chip label={r.passed ? 'Passed' : 'Failed'} /></td>
                          <td style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{formatDate(r.completedAt)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Create Assessment Modal */}
          {showAssessmentModal && (
            <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setShowAssessmentModal(false); }}>
              <div className="modal-content" style={{ padding: '32px', maxWidth: '560px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                  <h2 style={{ fontSize: '18px', fontWeight: 700 }}>Create Skill Assessment</h2>
                  <button onClick={() => setShowAssessmentModal(false)} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: 'var(--text-secondary)' }}>✕</button>
                </div>
                <form onSubmit={handleCreateAssessment}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    <div>
                      <label className="form-label">Assessment Title</label>
                      <input type="text" className="form-input" value={assessmentForm.title} onChange={e => setAssessmentForm({ ...assessmentForm, title: e.target.value })} placeholder="e.g. React Senior Technical Test" required />
                    </div>
                    <div>
                      <label className="form-label">Description</label>
                      <textarea className="form-textarea" style={{ minHeight: '80px' }} value={assessmentForm.description} onChange={e => setAssessmentForm({ ...assessmentForm, description: e.target.value })} placeholder="What this assessment evaluates..." />
                    </div>
                    <div>
                      <label className="form-label">Skill Tags (comma-separated)</label>
                      <input type="text" className="form-input" value={assessmentForm.skillTags} onChange={e => setAssessmentForm({ ...assessmentForm, skillTags: e.target.value })} placeholder="React, TypeScript, Node.js" />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                      <div>
                        <label className="form-label">Questions</label>
                        <input type="number" className="form-input" value={assessmentForm.questionCount} onChange={e => setAssessmentForm({ ...assessmentForm, questionCount: e.target.value })} min="1" />
                      </div>
                      <div>
                        <label className="form-label">Time (mins)</label>
                        <input type="number" className="form-input" value={assessmentForm.timeLimit} onChange={e => setAssessmentForm({ ...assessmentForm, timeLimit: e.target.value })} min="1" />
                      </div>
                      <div>
                        <label className="form-label">Pass Score (%)</label>
                        <input type="number" className="form-input" value={assessmentForm.passingScore} onChange={e => setAssessmentForm({ ...assessmentForm, passingScore: e.target.value })} min="0" max="100" />
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
                    <button type="submit" className="btn-primary" style={{ flex: 1, opacity: saving ? 0.7 : 1 }}>{saving ? 'Creating...' : 'Create Assessment'}</button>
                    <button type="button" onClick={() => setShowAssessmentModal(false)} className="btn-secondary" style={{ flex: 1 }}>Cancel</button>
                  </div>
                </form>
              </div>
            </div>
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
                      <input type="number" className="form-input" value={resultForm.score} onChange={e => setResultForm({ ...resultForm, score: e.target.value, passed: Number(e.target.value) >= (assessments.find(a => a.id === resultForm.assessmentId)?.passingScore || 70) })} min="0" max="100" required />
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
          const badge = key === 'interviews' ? interviews.filter(iv => iv.status === 'Scheduled' || iv.status === 'Rescheduled').length
            : key === 'support' ? supportTickets.filter(t => t.status === 'Open').length
            : key === 'hiring-requests' ? requests.filter(r => r.status === 'New Request').length
            : 0;
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
        <title>Kongila Admin — Command Center</title>
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

      {/* Main Content */}
      <div className="main-content">
        {renderTab()}
      </div>
    </div>
  );
}
