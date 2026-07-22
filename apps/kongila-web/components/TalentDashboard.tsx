import React, { useState, useRef, useEffect, useCallback } from 'react';
import { formatCurrency } from '@kongila/utils';
import { GlassCard, Badge, NeonButton, KongilaLoader } from '@kongila/ui';
import type { Interview, Contract } from '@kongila/shared-types';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import TalentMessagesPanel from './TalentMessagesPanel';
import TalentNotificationsPanel from './TalentNotificationsPanel';
import TalentSettingsPanel from './TalentSettingsPanel';
import TalentSupportPanel from './TalentSupportPanel';

export const MOCK_PLATFORM_SETTINGS = {
  globalScoreVisibility: 'full' as 'full' | 'grade-only' | 'hidden',
  interviewOutcomeVisibility: true
};

export const MOCK_TAG_DICTIONARY: Record<string, string> = {
  'Top 1%': 'Ranked in the 99th percentile of all applicants globally based on technical assessments.',
  'React Expert': 'Demonstrated advanced proficiency in React architecture, hooks, and state management.',
  'Fast Communicator': 'Consistently responds to messages and requests within 1 hour.',
  'Enterprise Ready': 'Has successfully navigated complex, multi-stakeholder enterprise projects.',
  'Self-Starter': 'Requires minimal supervision and proactively identifies project blockers.',
  'High-Speed Internet': 'Verified to have consistently high-bandwidth internet suitable for heavy remote operations.'
};

// ─── Types ───────────────────────────────────────────────────────────────────
interface TalentDashboardProps {
  currentUser: any;
  talentProfile: any;
  contracts: any[];
  matches: any[];
  clientRequests?: any[];
  allDocuments?: any[];
  dashboardNotifications?: any[];
  setDashboardNotifications?: (notifications: any[]) => void;
  // Assessment engine props
  assessments?: any[];
  assessmentCategories?: any[];
  assessmentQuestions?: any[];
  talentSkillAssessments?: any[];
  skillAssessmentResults?: any[];
  onSubmitAssessment?: (result: any) => Promise<void>;
  onSignOut?: () => void;
  onUpdateProfile?: (updatedProfile: any) => void;
  onUpdateMatch?: (updatedMatch: any) => void;
  onUpdateDocument?: (updatedDocument: any) => void;
}

type Section =
  | 'dashboard'
  | 'profile'
  | 'compliance'
  | 'vetting_progress'
  | 'scores_grades'
  | 'opportunities'
  | 'interviews'
  | 'contracts'
  | 'earnings'
  | 'tasks'
  | 'messages'
  | 'notifications'
  | 'settings'
  | 'support';

// ─── SVG Navigation Icons Component ──────────────────────────────────────────
const SidebarIcon = ({ id, color = 'currentColor', size = 18 }: { id: string; color?: string; size?: number }) => {
  switch (id) {
    case 'dashboard':
      
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="7" height="9" />
          <rect x="14" y="3" width="7" height="5" />
          <rect x="14" y="12" width="7" height="9" />
          <rect x="3" y="16" width="7" height="5" />
        </svg>
      );
    case 'profile':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      );
    case 'compliance': // Documents
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
          <polyline points="10 9 9 9 8 9" />
        </svg>
      );
    case 'vetting_progress':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          <path d="m9 12 2 2 4-4" />
        </svg>
      );
    case 'scores_grades':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="8" r="7" />
          <polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88" />
        </svg>
      );
    case 'opportunities': // old pipeline
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
          <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
        </svg>
      );
    case 'interviews': // old calendar
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
      );
    case 'contracts':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <path d="m9 15 2 2 4-4" />
        </svg>
      );
    case 'earnings':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="12" y1="1" x2="12" y2="23" />
          <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
        </svg>
      );
    case 'tasks':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="9 11 12 14 22 4" />
          <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
        </svg>
      );
    case 'messages':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      );
    case 'notifications':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
      );
    case 'settings':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      );
    case 'support':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
      );
    case 'logout':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
          <polyline points="16 17 21 12 16 7" />
          <line x1="21" y1="12" x2="9" y2="12" />
        </svg>
      );
    default:
      return null;
  }
};

// ─── Nav Items ────────────────────────────────────────────────────────────────
const NAV_ITEMS: { id: Section; label: string }[] = [
  { id: 'dashboard',        label: 'Home/Overview' },
  { id: 'compliance',       label: 'Documents' },
  { id: 'vetting_progress',  label: 'Vetting Progress' },
  { id: 'scores_grades',    label: 'Scores & Grades' },
  { id: 'opportunities',    label: 'Opportunities' },
  { id: 'interviews',       label: 'Interviews' },
  { id: 'contracts',        label: 'Contracts & Employment History' },
  { id: 'earnings',         label: 'Earnings' },
  { id: 'tasks',            label: 'Tasks' },
  { id: 'messages',         label: 'Messages' },
  { id: 'notifications',     label: 'Notifications' },
  { id: 'profile',          label: 'My Profile' },
  { id: 'settings',         label: 'Settings' },
  { id: 'support',          label: 'Support' },
];

// ─── Shared Sub-Components ────────────────────────────────────────────────────
const Card = ({ children, style = {}, onClick }: { children: React.ReactNode; style?: React.CSSProperties; onClick?: () => void }) => (
  <div 
    onClick={onClick}
    style={{
      background: '#FFFFFF',
      border: '1px solid #DDE2EC',
      borderRadius: '12px',
      padding: '24px',
      boxShadow: '0 1px 3px rgba(0,0,0,0.02), 0 8px 24px rgba(0,0,0,0.04)',
      ...style
    }}
  >
    {children}
  </div>
);

const SectionHeader = ({ title, subtitle }: { title: string; subtitle?: string }) => (
  <div style={{ marginBottom: '24px' }}>
    <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#1A2340', marginBottom: '4px' }}>{title}</h2>
    {subtitle && <p style={{ fontSize: '14px', color: '#6B7A99' }}>{subtitle}</p>}
  </div>
);

const FieldRow = ({ label, value }: { label: string; value: string }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid #F5F7FA' }}>
    <span style={{ fontSize: '13px', color: '#6B7A99', fontWeight: 500 }}>{label}</span>
    <span style={{ fontSize: '13px', color: '#1A2340', fontWeight: 600 }}>{value}</span>
  </div>
);

const StatusPill = ({ label, color }: { label: string; color: string }) => (
  <span style={{ background: `${color}15`, color, border: `1px solid ${color}30`, borderRadius: '20px', padding: '4px 12px', fontSize: '12px', fontWeight: 600 }}>
    {label}
  </span>
);

const DEFAULT_ONBOARDING_VIDEO_URL = 'https://www.w3schools.com/html/mov_bbb.mp4';

const SECONDARY_SKILL_OPTIONS = [
  'Communication',
  'Empathy',
  'Active Listening',
  'Collaboration',
  'Teamwork',
  'Adaptability',
  'Problem Solving',
  'Critical Thinking',
  'Time Management',
  'Emotional Intelligence',
  'Conflict Resolution',
  'Stakeholder Management',
  'Presentation Skills',
  'Negotiation',
  'Customer Service',
  'Attention to Detail',
  'Leadership',
  'Accountability',
  'Resilience',
  'Creativity',
  'Initiative',
  'Organization',
  'Decision Making',
  'Coaching',
  'Mentoring',
  'Facilitation',
  'Work Ethic',
  'Self-Motivation',
  'Cross-Cultural Communication',
  'Relationship Building',
] as const;

const PROFILE_COMPLETION_FIELDS: Array<{ key: string; label: string; test?: (profile: any) => boolean }> = [
  { key: 'name', label: 'Name' },
  { key: 'phone', label: 'Phone' },
  { key: 'dateOfBirth', label: 'Date of Birth' },
  { key: 'gender', label: 'Gender' },
  { key: 'nationality', label: 'Nationality' },
  { key: 'country', label: 'Country' },
  { key: 'city', label: 'City' },
  { key: 'timezone', label: 'Timezone' },
  { key: 'title', label: 'Primary Role' },
  { key: 'primaryRoleCategory', label: 'Role Category' },
  { key: 'seniorityLevel', label: 'Seniority Level' },
  { key: 'experienceYears', label: 'Years of Experience', test: profile => Number(profile?.experienceYears) > 0 },
  { key: 'primarySkills', label: 'Primary Skills', test: profile => Array.isArray(profile?.primarySkills) ? profile.primarySkills.length > 0 : Array.isArray(profile?.skills) ? profile.skills.length > 0 : Boolean(profile?.skills) },
  { key: 'preferredEngagementType', label: 'Engagement Type', test: profile => Boolean(profile?.preferredEngagementType || profile?.employmentPreference) },
  { key: 'preferredWorkHours', label: 'Work Hours', test: profile => Boolean(profile?.preferredWorkHours || profile?.hourlyMonthly) },
  { key: 'preferredProjectType', label: 'Project Type' },
  { key: 'noticePeriod', label: 'Notice Period', test: profile => Boolean(profile?.noticePeriod || profile?.availableStartDate) },
  { key: 'salaryExpectationUsd', label: 'Salary Expectation', test: profile => Number(profile?.salaryExpectationUsd ?? profile?.salaryExpectation ?? 0) > 0 },
  { key: 'bio', label: 'Bio' },
  { key: 'profilePhotoUrl', label: 'Profile Photo', test: profile => Boolean(profile?.profilePhotoUrl || profile?.profilePhotoName) },
  { key: 'cvUrl', label: 'CV Upload', test: profile => Boolean(profile?.cvUrl || (Array.isArray(profile?.documents) && profile.documents.some((doc: any) => String(doc?.name || '').toLowerCase().includes('.pdf')))) },
  { key: 'portfolioUrl', label: 'Portfolio' },
  { key: 'certificationFiles', label: 'Certifications', test: profile => Array.isArray(profile?.certificationFiles) ? profile.certificationFiles.length > 0 : Boolean(profile?.certifications) },
  { key: 'linkedIn', label: 'LinkedIn' },
  { key: 'githubUrl', label: 'GitHub' },
  { key: 'websiteUrl', label: 'Website' },
];

const countProfileCompletion = (profile: any) => {
  const completed = PROFILE_COMPLETION_FIELDS.filter(field => {
    if (field.test) return field.test(profile);
    const value = profile?.[field.key];
    if (Array.isArray(value)) return value.length > 0;
    if (typeof value === 'number') return Number.isFinite(value);
    return Boolean(value && String(value).trim().length > 0);
  });
  return {
    percentage: Math.round((completed.length / PROFILE_COMPLETION_FIELDS.length) * 100),
    incompleteFields: PROFILE_COMPLETION_FIELDS.filter(field => {
      if (field.test) return !field.test(profile);
      const value = profile?.[field.key];
      if (Array.isArray(value)) return value.length === 0;
      if (typeof value === 'number') return !Number.isFinite(value);
      return !(value && String(value).trim().length > 0);
    }).map(field => field.label),
  };
};

const maskClientName = (clientName?: string) => {
  if (!clientName) return 'Client Confidential';
  const parts = clientName.split(' ');
  if (parts.length === 1) {
    return `${parts[0].slice(0, 2)}***`;
  }
  return `${parts[0]} ${parts.slice(1).map(part => `${part.charAt(0)}${'*'.repeat(Math.max(0, part.length - 1))}`).join(' ')}`;
};

const getStageNextAction = (stageIdx: number, status: string) => {
  const actions = [
    'The Talent Manager is screening your application and profile documents.',
    'Complete the skill assessment once it is assigned to you.',
    'Waiting for admin to schedule your live interview.',
    'Complete the personality test when the system sends the invite.',
    'Keep your remote readiness details current for ops review.',
    'Submit the work simulation task before the deadline.',
    'Await final review and deployment approval.',
  ];
  const action = actions[stageIdx] || 'Await the next update from the Kongila team.';
  if (status === 'passed' && stageIdx === 6) {
    return 'You are fully vetted. The matching team can now deploy or shortlist you.';
  }
  if (status === 'failed') {
    return 'Check your notifications for the next steps and any required follow-up.';
  }
  return action;
};

const getStageStateLabel = (stage: any, totalStages: number) => {
  if (!stage) return 'Pending';
  if (stage.status === 'passed') return `Stage ${stage.stageIndex + 1} of ${totalStages} complete`;
  if (stage.status === 'in_progress') return `Stage ${stage.stageIndex + 1} of ${totalStages} active`;
  if (stage.status === 'failed') return `Stage ${stage.stageIndex + 1} of ${totalStages} needs attention`;
  return `Stage ${stage.stageIndex + 1} of ${totalStages}`;
};

const getStageAgeLabel = (stage: any, fallbackDate?: string) => {
  const source = stage?.started_at || stage?.startedAt || stage?.assigned_at || stage?.assignedAt || stage?.created_at || stage?.createdAt || stage?.completed_at || stage?.completedAt || fallbackDate;
  if (!source) return 'Just started';
  const then = new Date(source).getTime();
  if (Number.isNaN(then)) return 'Just started';
  const days = Math.max(0, Math.floor((Date.now() - then) / (1000 * 60 * 60 * 24)));
  return days === 0 ? 'Today' : `${days} day${days === 1 ? '' : 's'} in stage`;
};

const getActiveVettingStage = (profile: any) => {
  const pipeline: any[] = Array.isArray(profile?.vettingPipeline) ? profile.vettingPipeline : [];
  if (pipeline.length === 0) {
    return {
      stageIndex: 0,
      stageName: profile?.vettingStage || 'Application Screening',
      status: profile?.vettingStatus === 'Vetted' ? 'passed' : 'pending',
      nextAction: getStageNextAction(0, profile?.vettingStatus === 'Vetted' ? 'passed' : 'pending'),
    };
  }

  const inProgress = pipeline.find(stage => stage?.status === 'in_progress');
  if (inProgress) {
    return { ...inProgress, nextAction: getStageNextAction(inProgress.stageIndex, inProgress.status), stageIndex: inProgress.stageIndex ?? 0 };
  }

  const firstOpen = pipeline.find(stage => stage?.status !== 'passed' && stage?.status !== 'skipped');
  if (firstOpen) {
    return { ...firstOpen, nextAction: getStageNextAction(firstOpen.stageIndex, firstOpen.status), stageIndex: firstOpen.stageIndex ?? 0 };
  }

  const finalStage = pipeline[pipeline.length - 1];
  return { ...finalStage, nextAction: getStageNextAction(finalStage.stageIndex, finalStage.status), stageIndex: finalStage.stageIndex ?? pipeline.length - 1 };
};

const resolveTalentSkillAssessment = (
  stageAssessmentRef: string | undefined,
  talentId: string | undefined,
  talentSkillAssessments: any[] = []
) => {
  if (!stageAssessmentRef || !talentId) return undefined;
  return talentSkillAssessments.find((t: any) =>
    (t.id === stageAssessmentRef || t.assessment_id === stageAssessmentRef || t.assessmentId === stageAssessmentRef) &&
    (t.talent_id === talentId || t.talentId === talentId)
  );
};

const isAssessmentSubmittable = (
  tsa: any | undefined,
  talentId: string | undefined,
  skillAssessmentResults: any[] = [],
  stageAssessmentRef?: string
) => {
  const ref = stageAssessmentRef || tsa?.assessmentId || tsa?.assessment_id || tsa?.id;
  const hasResult = skillAssessmentResults.some((r: any) =>
    (r.talentId === talentId || r.talent_id === talentId) &&
    (
      (tsa?.id && (r.talentSkillAssessmentId === tsa.id || r.tsaId === tsa.id)) ||
      (ref && (r.assessmentId === ref || r.assessment_id === ref))
    )
  );

  if (hasResult) return false;

  if (tsa) {
    const lockedStatuses = ['submitted', 'graded', 'Passed', 'Failed'];
    if (lockedStatuses.includes(tsa.status)) return false;
    if (tsa.deadline && new Date(tsa.deadline).getTime() < Date.now()) return false;
  }

  return Boolean(ref || tsa);
};

const getNotificationIcon = (title: string) => {
  const value = title.toLowerCase();
  if (value.includes('contract')) return '📄';
  if (value.includes('compliance') || value.includes('document')) return '🛡️';
  if (value.includes('interview')) return '📅';
  if (value.includes('payment') || value.includes('payout') || value.includes('earn')) return '💰';
  if (value.includes('score') || value.includes('grade') || value.includes('assessment')) return '🏅';
  return '🔔';
};

// ─── Section 1: Dashboard Overview (rendered under "Profile" tab) ───────────────────
const ProfileSection = ({
  user,
  profile,
  contracts,
  matches = [],
  pendingDocs = [],
  skillAssessmentResults = [],
  talentSkillAssessments = [],
  dashboardNotifications = [],
  setActiveSection,
  onOpenAssessment,
  onUpdateProfile,
}: {
  user: any;
  profile: any;
  contracts: any[];
  matches?: any[];
  pendingDocs?: any[];
  skillAssessmentResults?: any[];
  talentSkillAssessments?: any[];
  dashboardNotifications?: any[];
  setActiveSection: (sec: Section) => void;
  onOpenAssessment?: (tsaId: string) => void;
  onUpdateProfile?: (updatedProfile: any) => void;
}) => {
  const vettingStatus = profile?.vettingStatus || 'Applied';
  const { percentage: profileCompletion, incompleteFields } = countProfileCompletion(profile);
  const talentContracts = contracts?.filter((c: any) => c.talentId === profile?.id || c.talentName === profile?.name) || [];
  const activeContract = talentContracts.find(c => c.status === 'Active' || c.status === 'Signed') || null;
  const talentMatches = matches?.filter((m: any) => m.talentId === profile?.id || m.talentName === profile?.name) || [];
  
  const pipeline = Array.isArray(profile?.vettingPipeline) ? profile.vettingPipeline : [];
  const vettingInterviews = pipeline
    .filter((s: any) => s.interviewDate && s.status !== 'passed' && s.status !== 'skipped' && s.status !== 'failed')
    .map((s: any) => ({
      id: `vetting-int-${s.stageIndex}`,
      title: s.stageName === 'Behavioural Interview' ? 'Live Interview' : s.stageName,
      status: s.rescheduleRequested ? 'Reschedule Requested' : 'Interview Scheduled',
      requestedDate: s.interviewDate,
      requestedTime: s.interviewTime,
      meetingLink: s.meetingLink,
      isVetting: true,
      stageIndex: s.stageIndex,
    }));

  const matchInterviews = talentMatches
    .filter((m: any) => (m.status === 'Interview Scheduled' || m.status === 'Reschedule Requested') && m.requestedDate);

  const scheduledInterviews = [...matchInterviews, ...vettingInterviews]
    .sort((a: any, b: any) => String(a.requestedDate).localeCompare(String(b.requestedDate)));

  const recentNotifications = (dashboardNotifications ?? []).slice(0, 5);
  const unreadNotifications = recentNotifications.filter((n: any) => !n.read).length;
  const activeVettingStage = getActiveVettingStage(profile);
  const activeStageIndex = Number(activeVettingStage?.stageIndex ?? 0);
  const totalStages = profile?.vettingPipeline?.length || 7;
  const passedCount = pipeline.filter((s: any) => s.status === 'passed').length;
  const hasCompletedVetting = passedCount >= totalStages || ['Vetted', 'Matched', 'Deployed'].includes(vettingStatus);
  const isNewTalent = (() => {
    const createdAt = profile?.createdAt || profile?.created_at;
    if (!createdAt) return vettingStatus === 'Applied' || vettingStatus === 'Review';
    const createdMs = new Date(createdAt).getTime();
    if (Number.isNaN(createdMs)) return vettingStatus === 'Applied' || vettingStatus === 'Review';
    return Date.now() - createdMs < 1000 * 60 * 60 * 24 * 14;
  })();
  const shouldShowOnboardingVideo = !profile?.onboardingVideoSeenAt && isNewTalent;
  const onboardingVideoUrl = profile?.onboardingVideoUrl || DEFAULT_ONBOARDING_VIDEO_URL;
  const upcomingInterviews = scheduledInterviews.slice(0, 3);
  const earningsSummary = {
    totalEarned: Number(activeContract?.totalEarned || 0),
    pendingPayout: Number(activeContract?.pendingPayout || activeContract?.invoicedBalance || 0),
    lastPaymentDate: activeContract?.lastPaymentDate || activeContract?.last_paid_at || '',
    lastPaymentAmount: Number(activeContract?.lastPaymentAmount || activeContract?.last_paid_amount || 0),
  };
  const hasEarningsData = Boolean(activeContract && (earningsSummary.totalEarned > 0 || earningsSummary.pendingPayout > 0 || earningsSummary.lastPaymentDate || earningsSummary.lastPaymentAmount > 0));
  const performanceScore = profile?.performanceScore ?? activeContract?.performanceScore ?? profile?.latestPerformanceScore;
  const previousPerformanceScore = profile?.previousPerformanceScore ?? activeContract?.previousPerformanceScore;
  const showPerformanceWidget = performanceScore != null;
  const scoreTrend = typeof performanceScore === 'number' && typeof previousPerformanceScore === 'number'
    ? performanceScore > previousPerformanceScore ? 'up' : performanceScore < previousPerformanceScore ? 'down' : 'flat'
    : null;
  const scoreDelta = typeof performanceScore === 'number' && typeof previousPerformanceScore === 'number'
    ? performanceScore - previousPerformanceScore
    : null;
  const vettingProgressPercent = Math.round((passedCount / Math.max(1, totalStages)) * 100);
  const vettingProgressLabel = hasCompletedVetting
    ? 'Vetting complete'
    : `Stage ${Math.min(activeStageIndex + 1, totalStages)} of ${totalStages}`;
  const vettingBadgeText = hasCompletedVetting
    ? String(profile?.grade || activeContract?.grade || 'VETTED').toUpperCase()
    : `STAGE ${Math.min(activeStageIndex + 1, totalStages)}`;
  const activeSkillAssessment = resolveTalentSkillAssessment(
    activeVettingStage?.assessmentId,
    profile?.id,
    talentSkillAssessments
  );
  const canStartSkillAssessment = isAssessmentSubmittable(
    activeSkillAssessment,
    profile?.id,
    skillAssessmentResults,
    activeVettingStage?.assessmentId
  );

  const persistProfile = (updates: Record<string, any>) => {
    if (onUpdateProfile) {
      onUpdateProfile({ ...profile, ...updates });
    }
  };

  const displayStatus = hasCompletedVetting 
    ? (vettingStatus === 'Rejected' ? 'Rejected' : `Vetting Complete - ${profile?.grade || activeContract?.grade || 'VETTED'}`)
    : (vettingStatus === 'Applied' && passedCount === 0 && activeVettingStage?.status === 'pending' ? 'Applied' : 'Vetting In Progress');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {profile?.requiresReReview && (
        <div style={{
          background: 'rgba(239, 68, 68, 0.08)',
          border: '1px solid rgba(239, 68, 68, 0.28)',
          borderRadius: '16px',
          padding: '16px 18px',
          color: '#991B1B',
          fontSize: '13px',
          fontWeight: 700
        }}>
          This profile has changed after vetting and requires admin re-review before core updates can be approved.
        </div>
      )}
      {pendingDocs.length > 0 && (
        <div style={{
          background: 'rgba(239, 68, 68, 0.08)',
          border: '1px solid rgba(239, 68, 68, 0.28)',
          borderRadius: '16px',
          padding: '16px 18px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '16px',
          flexWrap: 'wrap',
        }}>
          <div>
            <div style={{ margin: 0, color: '#B91C1C', fontSize: '15px', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
              ⚠️ Pending compliance documents
            </div>
            <p style={{ margin: '4px 0 0 0', color: '#7F1D1D', fontSize: '13px' }}>
              You have {pendingDocs.length} mandatory compliance document{pendingDocs.length > 1 ? 's' : ''} to review before matching can continue.
            </p>
          </div>
          <button
            onClick={() => setActiveSection('compliance')}
            style={{
              background: '#EF4444',
              color: '#fff',
              border: 'none',
              padding: '10px 16px',
              borderRadius: '10px',
              fontWeight: 700,
              cursor: 'pointer',
              fontSize: '13px'
            }}
          >
            Review & Sign
          </button>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: '280px' }}>
          <h1 style={{ fontSize: '30px', fontWeight: 900, color: '#1A2340', margin: '6px 0 8px 0', lineHeight: 1.05 }}>
            Welcome back, {user?.name?.split(' ')[0] || profile?.name?.split(' ')[0] || 'Talent'}
          </h1>
          <p style={{ fontSize: '14px', color: '#6B7A99', margin: 0, maxWidth: '720px' }}>
            Check your current vetting stage, finish what’s pending, and jump directly into the next action.
          </p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            background: '#EEF3FF',
            padding: '10px 16px',
            borderRadius: '999px',
            border: '1px solid rgba(0, 71, 204, 0.15)',
            flexShrink: 0,
          }}>
            <div style={{ width: '9px', height: '9px', borderRadius: '50%', background: '#0047CC' }} />
            <span style={{ fontSize: '13px', fontWeight: 800, color: '#0047CC' }}>
              Status: {displayStatus}
            </span>
          </div>
          {activeContract && (
            <a 
              href={process.env.NODE_ENV === 'development' ? 'http://localhost:3001' : 'https://remotan.kongila.io'}
              target="_blank" 
              rel="noreferrer"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                background: 'linear-gradient(135deg, #0ABFBC, #0284C7)',
                color: '#fff',
                padding: '10px 16px',
                borderRadius: '999px',
                fontSize: '13px',
                fontWeight: 800,
                textDecoration: 'none',
                boxShadow: '0 4px 12px rgba(10, 191, 188, 0.3)',
                transition: 'transform 0.2s'
              }}
            >
              <span>⚡</span> Go to Remotan Workspace
            </a>
          )}
        </div>
      </div>

      <Card style={{
        padding: '22px',
        background: 'linear-gradient(135deg, rgba(0, 71, 204, 0.08), rgba(16, 185, 129, 0.08))',
        border: '1px solid rgba(0, 71, 204, 0.14)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px', flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: '12px', color: '#6B7A99', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Active Vetting Stage</div>
            <div style={{ fontSize: '16px', fontWeight: 900, color: '#1A2340', margin: '6px 0 2px 0' }}>{(activeVettingStage?.stageName === 'Behavioural Interview' ? 'Live Interview' : activeVettingStage?.stageName) || 'Application Screening'}</div>
            <div style={{ fontSize: '12px', color: '#6B7A99', marginBottom: '12px' }}>{getStageAgeLabel(activeVettingStage, profile?.createdAt || profile?.user?.createdAt)}</div>
            <p style={{ fontSize: '13px', color: '#475569', margin: 0, maxWidth: '720px' }}>
              {hasCompletedVetting ? 'Your vetting cycle has been completed. Any future review updates will appear here.' : getStageNextAction(activeStageIndex, activeVettingStage?.status || 'pending')}
            </p>
          </div>
          <div style={{ textAlign: 'right', flexShrink: 0, minWidth: '160px' }}>
            <div style={{ fontSize: '13px', fontWeight: 800, color: '#0047CC', marginBottom: '6px' }}>{vettingProgressLabel}</div>
            <div style={{ height: '8px', background: 'rgba(255,255,255,0.45)', borderRadius: '999px', overflow: 'hidden' }}>
              <div style={{ width: `${vettingProgressPercent}%`, height: '100%', background: 'linear-gradient(90deg, #0047CC, #10B981)', borderRadius: '999px' }} />
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '16px' }}>
          <StatusPill label={hasCompletedVetting ? 'Ready for deployment' : 'Vetting in progress'} color={hasCompletedVetting ? '#10B981' : '#0047CC'} />
          <StatusPill label={`Days: ${getStageAgeLabel(activeVettingStage, profile?.createdAt || profile?.user?.createdAt)}`} color="#6B7280" />
          <StatusPill label={hasCompletedVetting ? `Final status: ${displayStatus}` : `Current status: ${displayStatus}`} color="#0047CC" />
        </div>

        {activeVettingStage?.assessmentId && (
          <div style={{ marginTop: '16px', background: canStartSkillAssessment ? '#F8FAFC' : '#F0FDF4', border: `1px solid ${canStartSkillAssessment ? '#E2E8F0' : '#BBF7D0'}`, borderRadius: '14px', padding: '16px' }}>
            <div style={{ fontSize: '12px', fontWeight: 800, color: canStartSkillAssessment ? '#0047CC' : '#15803D', marginBottom: '6px' }}>Skill Assessment</div>
            {canStartSkillAssessment ? (
              <>
                <p style={{ margin: '0 0 12px 0', fontSize: '13px', color: '#475569' }}>
                  Complete the assigned assessment to move to the next vetting stage.
                  {activeSkillAssessment?.deadline && (
                    <span style={{ display: 'block', color: '#EF4444', fontWeight: 700, marginTop: '4px' }}>
                      ⚠️ Deadline: {new Date(activeSkillAssessment.deadline).toLocaleDateString()}
                    </span>
                  )}
                </p>
                <button
                  onClick={() => onOpenAssessment?.(activeSkillAssessment?.id || activeVettingStage.assessmentId)}
                  style={{
                    background: 'linear-gradient(135deg, #0047CC, #3B82F6)',
                    color: '#fff',
                    border: 'none',
                    padding: '10px 16px',
                    borderRadius: '10px',
                    fontSize: '12px',
                    fontWeight: 800,
                    cursor: 'pointer'
                  }}
                >
                  Start Assessment
                </button>
              </>
            ) : (
              <p style={{ margin: 0, fontSize: '13px', color: '#475569' }}>
                {activeSkillAssessment?.deadline && new Date(activeSkillAssessment.deadline).getTime() < Date.now() && !skillAssessmentResults.some((r: any) => r.talentSkillAssessmentId === activeSkillAssessment?.id) ? (
                  <span style={{ color: '#EF4444', fontWeight: 700 }}>⚠️ The deadline for this assessment has passed. You can no longer submit it.</span>
                ) : (
                  "Your assessment has been submitted and is awaiting review by the vetting team. You will be notified once it has been graded."
                )}
              </p>
            )}
          </div>
        )}
      </Card>

      {profileCompletion < 100 && (
        <Card style={{ padding: '20px', borderLeft: '4px solid #0047CC' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: '12px', color: '#6B7A99', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Profile Completion</div>
              <div style={{ fontSize: '24px', fontWeight: 900, color: '#1A2340', marginTop: '4px' }}>{profileCompletion}% complete</div>
            </div>
            <button
              onClick={() => setActiveSection('profile')}
              style={{
                background: '#0047CC',
                color: '#fff',
                border: 'none',
                borderRadius: '10px',
                padding: '10px 14px',
                fontWeight: 700,
                fontSize: '12px',
                cursor: 'pointer',
              }}
            >
              Continue Profile
            </button>
          </div>
          <div style={{ height: '8px', background: '#EDF2F7', borderRadius: '999px', overflow: 'hidden', marginTop: '14px' }}>
            <div style={{ width: `${profileCompletion}%`, height: '100%', background: 'linear-gradient(90deg, #0047CC, #10B981)', borderRadius: '999px' }} />
          </div>
          {incompleteFields.length > 0 && (
            <div style={{ marginTop: '12px', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {incompleteFields.slice(0, 6).map(field => (
                <span key={field} style={{ fontSize: '11px', padding: '4px 10px', borderRadius: '999px', background: '#F8FAFC', border: '1px solid #E2E8F0', color: '#475569', fontWeight: 600 }}>
                  {field}
                </span>
              ))}
              {incompleteFields.length > 6 && (
                <span style={{ fontSize: '11px', padding: '4px 10px', borderRadius: '999px', background: '#EEF3FF', color: '#0047CC', fontWeight: 700 }}>
                  +{incompleteFields.length - 6} more
                </span>
              )}
            </div>
          )}
        </Card>
      )}


      {shouldShowOnboardingVideo && (
        <Card style={{ padding: 0, overflow: 'hidden', border: '1px solid rgba(0, 71, 204, 0.16)' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'stretch' }}>
            <div style={{
              flex: '1 1 320px',
              minHeight: '240px',
              background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 100%)',
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <video
                src={onboardingVideoUrl}
                controls
                playsInline
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
              />
            </div>
            <div style={{ flex: '2 1 300px', padding: '24px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '10px' }}>
              <div style={{ fontSize: '12px', color: '#0047CC', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Welcome Video</div>
              <h3 style={{ fontSize: '22px', fontWeight: 900, color: '#1A2340', margin: 0 }}>Watch this before your next step</h3>
              <p style={{ fontSize: '14px', color: '#475569', margin: 0, lineHeight: 1.6 }}>
                Watch this quick orientation video to learn how to navigate your dashboard, manage your vetting stages, and get fully onboarded with Kongila.
              </p>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '6px' }}>
                <button
                  onClick={() => persistProfile({ onboardingVideoSeenAt: new Date().toISOString() })}
                  style={{
                    background: '#0047CC',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '10px',
                    padding: '10px 14px',
                    fontWeight: 800,
                    fontSize: '12px',
                    cursor: 'pointer',
                  }}
                >
                  I've watched this
                </button>
                <button
                  onClick={() => setActiveSection('profile')}
                  style={{
                    background: 'transparent',
                    color: '#0047CC',
                    border: '1px solid rgba(0, 71, 204, 0.24)',
                    borderRadius: '10px',
                    padding: '10px 14px',
                    fontWeight: 800,
                    fontSize: '12px',
                    cursor: 'pointer',
                  }}
                >
                  Edit profile
                </button>
              </div>
            </div>
          </div>
        </Card>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
        {activeContract && (
          <Card style={{ padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
              <div>
                <div style={{ fontSize: '12px', color: '#6B7A99', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Active Contract</div>
                <h3 style={{ fontSize: '18px', fontWeight: 900, color: '#1A2340', margin: '6px 0 2px 0' }}>{activeContract.role || 'Active Placement'}</h3>
                <p style={{ fontSize: '13px', color: '#475569', margin: 0 }}>{maskClientName(activeContract.maskedClientName || activeContract.clientName)}</p>
              </div>
              <StatusPill label={activeContract.status} color="#10B981" />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '12px', marginTop: '16px' }}>
              {[
                { label: 'Start date', value: activeContract.startDate ? new Date(activeContract.startDate).toLocaleDateString() : '—' },
                { label: 'Next review', value: activeContract.nextReviewDate ? new Date(activeContract.nextReviewDate).toLocaleDateString() : activeContract.nextPayoutDate ? new Date(activeContract.nextPayoutDate).toLocaleDateString() : '—' },
                { label: 'Rate', value: `${activeContract.currency || 'USD'} ${formatCurrency(Number(activeContract.rateAmount || activeContract.salary || 0))}` },
                { label: 'Performance', value: activeContract.performanceScore != null ? `${activeContract.performanceScore}/100` : '—' },
              ].map(row => (
                <div key={row.label} style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '12px' }}>
                  <div style={{ fontSize: '10px', fontWeight: 800, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>{row.label}</div>
                  <div style={{ fontSize: '13px', fontWeight: 800, color: '#1A2340' }}>{row.value}</div>
                </div>
              ))}
            </div>

            <button
              onClick={() => setActiveSection('contracts')}
              style={{
                marginTop: '14px',
                width: '100%',
                background: '#0047CC',
                color: '#fff',
                border: 'none',
                borderRadius: '10px',
                padding: '10px 14px',
                fontWeight: 800,
                fontSize: '12px',
                cursor: 'pointer',
              }}
            >
              View contract details
            </button>
          </Card>
        )}

        {upcomingInterviews.length > 0 && (
          <Card style={{ padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px' }}>
              <div>
                <div style={{ fontSize: '12px', color: '#6B7A99', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Upcoming Interviews</div>
                <h3 style={{ fontSize: '18px', fontWeight: 900, color: '#1A2340', margin: '6px 0 0 0' }}>Next {upcomingInterviews.length} scheduled {upcomingInterviews.length === 1 ? 'call' : 'calls'}</h3>
              </div>
              <button
                onClick={() => setActiveSection('interviews')}
                style={{ background: 'transparent', border: 'none', color: '#0047CC', fontWeight: 800, fontSize: '12px', cursor: 'pointer' }}
              >
                View all
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '16px' }}>
              {upcomingInterviews.map((match: any) => (
                <div key={match.id} style={{ border: '1px solid #E2E8F0', borderRadius: '12px', padding: '12px 14px', background: '#F8FAFC' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 900, color: '#1A2340' }}>{match.clientName || match.talentName || match.title || 'Interview'}</div>
                      <div style={{ fontSize: '12px', color: '#475569', marginTop: '2px' }}>{match.requestedNotes || match.title || 'Video interview'}</div>
                    </div>
                    <StatusPill label={match.status} color={match.status === 'Reschedule Requested' ? '#F59E0B' : '#0047CC'} />
                  </div>
                  <div style={{ fontSize: '12px', color: '#6B7A99', marginTop: '8px' }}>
                    {match.requestedDate ? new Date(match.requestedDate).toLocaleDateString() : 'TBD'}
                    {' · '}
                    {match.requestedTime || 'TBD'}
                  </div>
                  <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                    {match.meetingLink && match.status !== 'Reschedule Requested' && (
                      <a href={match.meetingLink} target="_blank" rel="noreferrer" style={{ padding: '6px 12px', background: '#0047CC', color: '#fff', borderRadius: '6px', fontSize: '11px', fontWeight: 700, textDecoration: 'none' }}>Join Call</a>
                    )}
                    {match.status !== 'Reschedule Requested' && (
                      <button onClick={() => alert('Reschedule requested for ' + match.title)} style={{ padding: '6px 12px', background: '#EEF2FF', color: '#0047CC', border: 'none', borderRadius: '6px', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}>Request Reschedule</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        <Card style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
            <div>
              <div style={{ fontSize: '12px', color: '#6B7A99', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Recent Notifications</div>
              <h3 style={{ fontSize: '18px', fontWeight: 900, color: '#1A2340', margin: '6px 0 0 0' }}>{unreadNotifications} unread</h3>
            </div>
            <button
              onClick={() => setActiveSection('notifications')}
              style={{ background: 'transparent', border: 'none', color: '#0047CC', fontWeight: 800, fontSize: '12px', cursor: 'pointer' }}
            >
              Open notifications
            </button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '16px' }}>
            {(recentNotifications.length > 0 ? recentNotifications : [
              { title: 'No notifications yet', message: 'Your latest alerts will appear here.', createdAt: new Date().toISOString(), read: true },
            ]).map((notif: any) => (
              <div key={notif.id || notif.title} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', padding: '12px 14px', background: notif.read ? '#F8FAFC' : '#EEF3FF', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: notif.read ? '#E2E8F0' : '#0047CC', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {getNotificationIcon(notif.title || '')}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px' }}>
                    <div style={{ fontSize: '13px', fontWeight: 900, color: '#1A2340' }}>{notif.title || 'Notification'}</div>
                    <div style={{ fontSize: '11px', color: '#6B7A99', whiteSpace: 'nowrap' }}>
                      {notif.createdAt ? new Date(notif.createdAt).toLocaleDateString() : notif.time || ''}
                    </div>
                  </div>
                  <div style={{ fontSize: '12px', color: '#475569', marginTop: '3px', lineHeight: 1.5 }}>{notif.message || ''}</div>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {hasEarningsData && (
          <Card style={{ padding: '20px' }}>
            <div style={{ fontSize: '12px', color: '#6B7A99', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Earnings Summary</div>
            <h3 style={{ fontSize: '18px', fontWeight: 900, color: '#1A2340', margin: '6px 0 0 0' }}>
              {activeContract?.currency || 'USD'} {formatCurrency(earningsSummary.totalEarned)}
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '12px', marginTop: '16px' }}>
              {[
                { label: 'Pending payout', value: formatCurrency(earningsSummary.pendingPayout) },
                { label: 'Last payout', value: earningsSummary.lastPaymentAmount ? `${formatCurrency(earningsSummary.lastPaymentAmount)} · ${earningsSummary.lastPaymentDate ? new Date(earningsSummary.lastPaymentDate).toLocaleDateString() : '—'}` : '—' },
              ].map(row => (
                <div key={row.label} style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '12px' }}>
                  <div style={{ fontSize: '10px', fontWeight: 800, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>{row.label}</div>
                  <div style={{ fontSize: '13px', fontWeight: 800, color: '#1A2340' }}>{row.value}</div>
                </div>
              ))}
            </div>
            <button
              onClick={() => setActiveSection('earnings')}
              style={{
                marginTop: '14px',
                width: '100%',
                background: '#0047CC',
                color: '#fff',
                border: 'none',
                borderRadius: '10px',
                padding: '10px 14px',
                fontWeight: 800,
                fontSize: '12px',
                cursor: 'pointer',
              }}
            >
              View earnings
            </button>
          </Card>
        )}

        {showPerformanceWidget && (
          <Card style={{ padding: '20px' }}>
            <div style={{ fontSize: '12px', color: '#6B7A99', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Performance Score</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: '12px', marginTop: '6px' }}>
              <div>
                <h3 style={{ fontSize: '28px', fontWeight: 900, color: '#1A2340', margin: 0 }}>{performanceScore}/100</h3>
                <div style={{ fontSize: '12px', color: '#6B7A99', marginTop: '2px' }}>
                  {scoreTrend === 'up' ? '▲' : scoreTrend === 'down' ? '▼' : '•'} {scoreDelta != null ? `${scoreDelta > 0 ? '+' : ''}${scoreDelta}` : 'Latest review'}
                </div>
              </div>
              <StatusPill label={profile?.grade || activeContract?.grade || 'N/A'} color="#10B981" />
            </div>
            <button
              onClick={() => setActiveSection('scores_grades')}
              style={{
                marginTop: '14px',
                width: '100%',
                background: 'transparent',
                color: '#0047CC',
                border: '1px solid rgba(0, 71, 204, 0.24)',
                borderRadius: '10px',
                padding: '10px 14px',
                fontWeight: 800,
                fontSize: '12px',
                cursor: 'pointer',
              }}
            >
              View scores & grade
            </button>
          </Card>
        )}
      </div>
    </div>
  );
};

// ─── Section 2: Professional Details ─────────────────────────────────────────
const ProfessionalSection = ({ profile }: { profile: any }) => {
  const skillsArray = Array.isArray(profile?.primarySkills)
    ? profile.primarySkills
    : Array.isArray(profile?.skills)
      ? profile.skills
      : typeof profile?.skills === 'string'
        ? profile.skills.split(',').map((s: string) => s.trim()).filter(Boolean)
        : [];

  return (
    <div>
      <SectionHeader title="Professional Details" subtitle="Your skills, role preferences, and availability." />
      <div className="db-grid-2" style={{}}>
        <Card>
          <h3 style={{ fontWeight: 700, fontSize: '15px', color: '#1A2340', marginBottom: '16px' }}>Skills</h3>
          {skillsArray.length > 0 ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {skillsArray.map((skill: string, i: number) => (
                <span key={i} style={{
                  background: '#F5F7FA', color: '#1A2340', border: '1px solid #DDE2EC',
                  borderRadius: '20px', padding: '6px 14px', fontSize: '12px', fontWeight: 600
                }}>{skill}</span>
              ))}
            </div>
          ) : (
            <div style={{ fontSize: '13px', color: '#6B7A99' }}>No skills saved yet.</div>
          )}
        </Card>

        <Card>
          <h3 style={{ fontWeight: 700, fontSize: '15px', color: '#1A2340', marginBottom: '16px' }}>Role & Availability</h3>
          <FieldRow label="Primary Role" value={profile?.title || 'Senior Operations Manager'} />
          <FieldRow label="Seniority" value={profile?.seniorityLevel || 'Senior'} />
          <FieldRow label="Experience" value={`${profile?.experienceYears || profile?.yearsExperience || 5} years`} />
          <FieldRow label="Employment Type" value={profile?.employmentPreference || 'Full Time'} />
          <FieldRow label="Availability" value={`${profile?.availability || 100}%`} />
        </Card>

        <Card style={{ gridColumn: '1 / -1' }}>
          <h3 style={{ fontWeight: 700, fontSize: '15px', color: '#1A2340', marginBottom: '16px' }}>Salary Expectation</h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
            <div style={{ flex: 1, background: '#F5F7FA', borderRadius: '8px', height: '8px', overflow: 'hidden' }}>
              <div style={{ width: '70%', height: '100%', background: 'linear-gradient(90deg, #0047CC, #3D7FFF)', borderRadius: '8px' }} />
            </div>
            <span style={{ fontWeight: 800, fontSize: '20px', color: '#0047CC' }}>
              ${(profile?.salaryExpectation || 4500).toLocaleString()} / mo
            </span>
          </div>
          <div style={{ fontSize: '12px', color: '#6B7A99', marginTop: '8px' }}>Currency: {profile?.currency || 'USD'} · Basis: {profile?.hourlyMonthly || 'Monthly'}</div>
        </Card>
      </div>
    </div>
  );
};

// ─── Section 2.5: Interviews (KT-INTERVIEW) ─────────────────────────────────────────
const MOCK_INTERVIEWS: Interview[] = [
  {
    id: 'int-1',
    requestId: 'req-1',
    matchId: 'm-1',
    talentId: 't-1',
    talentName: 'Talent User',
    clientName: 'Nexus Health',
    title: 'Lead React Architect',
    date: '2026-07-10',
    time: '15:00',
    status: 'Proposed',
    createdAt: new Date().toISOString()
  },
  {
    id: 'int-2',
    requestId: 'req-2',
    matchId: 'm-2',
    talentId: 't-1',
    talentName: 'Talent User',
    clientName: 'Horizon Fintech',
    title: 'Senior Frontend Engineer',
    date: '2026-07-12',
    time: '10:00',
    status: 'Scheduled',
    meetingLink: 'https://meet.google.com/abc-defg-hij',
    createdAt: new Date().toISOString()
  },
  {
    id: 'int-3',
    requestId: 'req-3',
    matchId: 'm-3',
    talentId: 't-1',
    talentName: 'Talent User',
    clientName: 'Global Corp',
    title: 'React Native Developer',
    date: '2026-07-01',
    time: '14:00',
    status: 'Completed',
    outcome: 'Proceeded',
    talentNotes: 'The technical interview went well. They asked a lot about React Native performance.',
    createdAt: new Date().toISOString()
  }
];

const InterviewsSection = ({ scheduledInterviews }: { scheduledInterviews?: any[] }) => {
  const [activeTab, setActiveTab] = useState<'upcoming'|'reschedules'|'past'>('upcoming');
  const interviews = scheduledInterviews || MOCK_INTERVIEWS;
  const [editingNotesId, setEditingNotesId] = useState<string | null>(null);
  const [notesValue, setNotesValue] = useState('');

  const upcoming = interviews.filter((i: any) => i.status === 'Interview Scheduled' || i.status === 'Scheduled');
  const reschedules = interviews.filter((i: any) => i.status === 'Reschedule Requested');
  const past = interviews.filter((i: any) => i.status === 'Completed' || i.status === 'Cancelled' || i.status === 'failed' || i.status === 'passed');

  const handleSaveNotes = (id: string) => {
    // Implement save notes logic
    setEditingNotesId(null);
  };

  const generateGoogleCalendarLink = (i: any) => {
    const start = new Date(`${i.requestedDate || i.date}T${i.requestedTime || i.time}`).toISOString().replace(/-|:|\.\d\d\d/g, "");
    const end = new Date(new Date(`${i.requestedDate || i.date}T${i.requestedTime || i.time}`).getTime() + 60 * 60 * 1000).toISOString().replace(/-|:|\.\d\d\d/g, "");
    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=Interview+-+${encodeURIComponent(i.title)}&dates=${start}/${end}&details=Meeting+Link:+${encodeURIComponent(i.meetingLink || '')}`;
  };

  return (
    <div style={{ padding: '24px 32px', maxWidth: '1000px', margin: '0 auto', fontFamily: '"Inter", sans-serif' }}>
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: 900, color: '#1A2340', margin: '0 0 8px 0', letterSpacing: '-0.5px' }}>
          Interviews
        </h1>
        <p style={{ color: '#6B7A99', fontSize: '15px', margin: 0 }}>
          Manage your upcoming interviews and requested reschedules.
        </p>
      </div>

      <div style={{ display: 'flex', gap: '32px', borderBottom: '1px solid #DDE2EC', marginBottom: '24px' }}>
        <button 
          onClick={() => setActiveTab('upcoming')}
          style={{ 
            padding: '0 0 12px 0', background: 'none', border: 'none', 
            fontSize: '15px', fontWeight: activeTab === 'upcoming' ? 700 : 500,
            color: activeTab === 'upcoming' ? '#0047CC' : '#6B7A99',
            borderBottom: activeTab === 'upcoming' ? '3px solid #0047CC' : '3px solid transparent',
            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px'
          }}
        >
          Upcoming ({upcoming.length})
        </button>
        <button 
          onClick={() => setActiveTab('reschedules')}
          style={{ 
            padding: '0 0 12px 0', background: 'none', border: 'none', 
            fontSize: '15px', fontWeight: activeTab === 'reschedules' ? 700 : 500,
            color: activeTab === 'reschedules' ? '#0047CC' : '#6B7A99',
            borderBottom: activeTab === 'reschedules' ? '3px solid #0047CC' : '3px solid transparent',
            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px'
          }}
        >
          Reschedules Requested
          {reschedules.length > 0 && (
            <span style={{ background: '#F59E0B', color: '#fff', fontSize: '11px', padding: '2px 8px', borderRadius: '12px' }}>
              {reschedules.length}
            </span>
          )}
        </button>
        <button 
          onClick={() => setActiveTab('past')}
          style={{ 
            padding: '0 0 12px 0', background: 'none', border: 'none', 
            fontSize: '15px', fontWeight: activeTab === 'past' ? 700 : 500,
            color: activeTab === 'past' ? '#0047CC' : '#6B7A99',
            borderBottom: activeTab === 'past' ? '3px solid #0047CC' : '3px solid transparent',
            cursor: 'pointer'
          }}
        >
          Past
        </button>
      </div>

      {activeTab === 'reschedules' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {reschedules.length === 0 ? (
            <Card style={{ padding: '32px', textAlign: 'center', color: '#6B7A99' }}>
              No pending reschedule requests.
            </Card>
          ) : reschedules.map(i => (
            <Card key={i.id} style={{ padding: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
                <div>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: '#D97706', background: '#FEF3C7', display: 'inline-block', padding: '4px 8px', borderRadius: '4px', marginBottom: '8px' }}>
                    Reschedule Requested
                  </div>
                  <div style={{ fontSize: '18px', fontWeight: 800, color: '#1A2340', marginBottom: '4px' }}>
                    {i.title}
                  </div>
                  <div style={{ fontSize: '14px', color: '#6B7A99', display: 'flex', gap: '16px' }}>
                    <span>📅 {i.requestedDate ? new Date(i.requestedDate).toLocaleDateString() : 'TBD'}</span>
                    <span>🕒 {i.requestedTime || 'TBD'} (Your Local Time)</span>
                  </div>
                  {i.requestedNotes && (
                    <div style={{ marginTop: '12px', fontSize: '13px', color: '#475569', background: '#F8FAFC', padding: '8px 12px', borderRadius: '6px' }}>
                      <strong>Reason: </strong> {i.requestedNotes}
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <span style={{ fontSize: '13px', color: '#6B7A99', fontStyle: 'italic' }}>Waiting for Admin</span>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {activeTab === 'upcoming' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {upcoming.length === 0 ? (
            <Card style={{ padding: '32px', textAlign: 'center', color: '#6B7A99' }}>
              No upcoming interviews.
            </Card>
          ) : upcoming.map(i => (
            <Card key={i.id} style={{ padding: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
                <div>
                  <div style={{ fontSize: '18px', fontWeight: 800, color: '#1A2340', marginBottom: '4px' }}>
                    {i.title}
                  </div>
                  <div style={{ fontSize: '14px', color: '#6B7A99', display: 'flex', gap: '16px' }}>
                    <span>📅 {new Date(i.requestedDate || i.date).toLocaleDateString()}</span>
                    <span>🕒 {i.requestedTime || i.time} (Your Local Time)</span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                  {i.meetingLink ? (
                    <a href={i.meetingLink} target="_blank" rel="noopener noreferrer" style={{
                      padding: '10px 16px', background: '#0047CC', color: '#fff', textDecoration: 'none', borderRadius: '8px', fontWeight: 700, display: 'inline-block'
                    }}>
                      Join Video Call
                    </a>
                  ) : (
                    <span style={{ color: '#6B7A99', fontSize: '13px' }}>Link will be provided soon</span>
                  )}
                  <a href={generateGoogleCalendarLink(i)} target="_blank" rel="noopener noreferrer" style={{
                    padding: '10px 16px', background: '#F5F7FA', color: '#1A2340', textDecoration: 'none', borderRadius: '8px', fontWeight: 700, display: 'inline-block'
                  }}>
                    Add to Calendar
                  </a>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {activeTab === 'past' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {past.length === 0 ? (
            <Card style={{ padding: '32px', textAlign: 'center', color: '#6B7A99' }}>
              No past interviews.
            </Card>
          ) : past.map(i => (
            <Card key={i.id} style={{ padding: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
                <div style={{ flex: 1, minWidth: '300px' }}>
                  <div style={{ fontSize: '18px', fontWeight: 800, color: '#1A2340', marginBottom: '4px' }}>
                    {i.title}
                  </div>
                  <div style={{ fontSize: '14px', color: '#6B7A99', display: 'flex', gap: '16px', marginBottom: '16px' }}>
                    <span>📅 {new Date(i.date).toLocaleDateString()}</span>
                    <span>Status: {i.status}</span>
                  </div>
                  
                  <div style={{ background: '#F8FAFC', padding: '16px', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <span style={{ fontSize: '13px', fontWeight: 700, color: '#475569' }}>🔒 My Private Notes</span>
                      {editingNotesId !== i.id && (
                        <button onClick={() => { setEditingNotesId(i.id); setNotesValue(i.talentNotes || ''); }} style={{
                          background: 'none', border: 'none', color: '#0047CC', fontSize: '13px', fontWeight: 700, cursor: 'pointer'
                        }}>
                          {i.talentNotes ? 'Edit' : 'Add Note'}
                        </button>
                      )}
                    </div>
                    {editingNotesId === i.id ? (
                      <div>
                        <textarea 
                          value={notesValue}
                          onChange={e => setNotesValue(e.target.value)}
                          style={{ width: '100%', minHeight: '80px', padding: '8px', borderRadius: '4px', border: '1px solid #CBD5E1', marginBottom: '8px', fontFamily: 'inherit' }}
                          placeholder="Jot down questions they asked, how you felt, or things to follow up on..."
                        />
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button onClick={() => handleSaveNotes(i.id)} style={{ padding: '6px 12px', background: '#0047CC', color: '#fff', border: 'none', borderRadius: '4px', fontWeight: 600, cursor: 'pointer' }}>Save</button>
                          <button onClick={() => setEditingNotesId(null)} style={{ padding: '6px 12px', background: '#E2E8F0', color: '#475569', border: 'none', borderRadius: '4px', fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <div style={{ fontSize: '14px', color: '#1A2340', whiteSpace: 'pre-wrap' }}>
                        {i.talentNotes || <span style={{ color: '#94A3B8', fontStyle: 'italic' }}>No notes added.</span>}
                      </div>
                    )}
                  </div>
                </div>

                {MOCK_PLATFORM_SETTINGS.interviewOutcomeVisibility && i.outcome && (
                  <div style={{ 
                    padding: '6px 12px', borderRadius: '16px', fontSize: '13px', fontWeight: 700,
                    background: i.outcome === 'Proceeded' ? '#DCFCE7' : i.outcome === 'Not Selected' ? '#FEE2E2' : '#FEF3C7',
                    color: i.outcome === 'Proceeded' ? '#166534' : i.outcome === 'Not Selected' ? '#991B1B' : '#92400E'
                  }}>
                    Outcome: {i.outcome}
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

// ─── Section 2.6: Standalone Messages & Inbox Section ───────────────────────────
const MessagesSection = ({ messages = [], setMessages, profile }: { messages: any[]; setMessages?: React.Dispatch<React.SetStateAction<any[]>>; profile: any }) => {
  const [activeThreadId, setActiveThreadId] = useState(1);
  const [replyText, setReplyText] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  const contractorName = profile?.name || 'Chidi Anya';

  const threads = [
    { id: 1, name: 'Amara Anya', role: 'Onboarding Coordinator', status: 'Online', avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&q=80&w=80' },
    { id: 2, name: 'Vetting Officer', role: 'Technical Assessor', status: 'Offline', avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=80' }
  ];

  const activeThread = threads.find(t => t.id === activeThreadId) || threads[0];

  const threadMessages = messages.filter(m => 
    (activeThread.name === 'Amara Anya' && (m.sender === 'Amara Anya' || m.recipient === 'Amara Anya')) ||
    (activeThread.name === 'Vetting Officer' && (m.sender === 'Vetting Officer' || m.recipient === 'Vetting Officer'))
  );

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim() || !setMessages) return;

    const newMsg = {
      id: Date.now(),
      sender: contractorName,
      text: replyText,
      time: 'Just now',
      read: true,
      recipient: activeThread.name
    };

    const updatedMessages = [...messages, newMsg];
    setMessages(updatedMessages);
    setReplyText('');

    // Trigger typing simulation and auto-reply
    setIsTyping(true);
    setTimeout(() => {
      setIsTyping(false);
      let replyStr = '';
      if (activeThread.name === 'Amara Anya') {
        replyStr = `Hi ${contractorName.split(' ')[0]}, thanks for checking in! I've marked your onboarding checklist as completed. Everything is good!`;
      } else {
        replyStr = `Thanks for the message. Your operational assessment is successfully scored (95% Technical). You are fully cleared!`;
      }
      setMessages(prev => [
        ...prev,
        {
          id: Date.now() + 1,
          sender: activeThread.name,
          text: replyStr,
          time: 'Just now',
          read: false
        }
      ]);
    }, 1500);
  };

  return (
    <div style={{ display: 'flex', gap: '24px', height: 'calc(100vh - 140px)', fontFamily: 'var(--font-display, Inter, sans-serif)' }}>
      
      {/* Thread list panel (Left) */}
      <div style={{ width: '280px', display: 'flex', flexDirection: 'column', gap: '16px', flexShrink: 0 }}>
        <Card style={{ padding: '0', display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
          <div style={{ padding: '20px', borderBottom: '1px solid #F5F7FA' }}>
            <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: '#1A2340' }}>Secure Inbox</h3>
            <span style={{ fontSize: '11px', color: '#6B7A99' }}>Encrypted channels with onboarding team</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', overflowY: 'auto', flex: 1, padding: '10px' }}>
            {threads.map(t => {
              const isActive = t.id === activeThreadId;
              const unread = messages.filter(m => m.sender === t.name && !m.read).length;
              return (
                <div
                  key={t.id}
                  onClick={() => setActiveThreadId(t.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '12px',
                    padding: '12px', borderRadius: '8px', cursor: 'pointer',
                    background: isActive ? '#EEF3FF' : 'transparent',
                    transition: 'all 0.15s'
                  }}
                >
                  <div style={{ position: 'relative', width: '36px', height: '36px', flexShrink: 0 }}>
                    <img src={t.avatar} alt={t.name} style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                    <span style={{
                      position: 'absolute', bottom: '0', right: '0', width: '8px', height: '8px', borderRadius: '50%',
                      background: t.status === 'Online' ? '#10B981' : '#6B7A99', border: '2px solid #FFFFFF'
                    }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '12px', fontWeight: 700, color: '#1A2340', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{t.name}</div>
                    <div style={{ fontSize: '10px', color: '#6B7A99', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{t.role}</div>
                  </div>
                  {unread > 0 && (
                    <span style={{ background: '#EF4444', color: '#FFFFFF', fontSize: '9px', fontWeight: 800, width: '16px', height: '16px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {unread}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      {/* Messages panel (Right) */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <Card style={{ padding: '0', display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
          
          {/* Thread Header */}
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #F5F7FA', display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
            <img src={activeThread.avatar} alt={activeThread.name} style={{ width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover' }} />
            <div>
              <div style={{ fontSize: '13px', fontWeight: 800, color: '#1A2340' }}>{activeThread.name}</div>
              <span style={{ fontSize: '11px', color: '#10B981', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: activeThread.status === 'Online' ? '#10B981' : '#6B7A99' }} />
                {activeThread.status === 'Online' ? 'Online' : 'Offline'}
              </span>
            </div>
          </div>

          {/* Messages list */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px', background: '#FAFBFF' }}>
            {threadMessages.map((msg, i) => {
              const isMe = msg.sender === contractorName;
              return (
                <div
                  key={msg.id || i}
                  style={{
                    alignSelf: isMe ? 'flex-end' : 'flex-start',
                    maxWidth: '70%',
                    display: 'flex', flexDirection: 'column',
                    alignItems: isMe ? 'flex-end' : 'flex-start'
                  }}
                >
                  <div style={{
                    background: isMe ? '#0047CC' : '#FFFFFF',
                    color: isMe ? '#FFFFFF' : '#1A2340',
                    border: isMe ? 'none' : '1px solid #DDE2EC',
                    borderRadius: isMe ? '12px 12px 0 12px' : '12px 12px 12px 0',
                    padding: '10px 14px', fontSize: '12px', lineHeight: 1.5
                  }}>
                    {msg.text}
                  </div>
                  <span style={{ fontSize: '9px', color: '#6B7A99', marginTop: '4px' }}>
                    {msg.sender} • {msg.time}
                  </span>
                </div>
              );
            })}
            
            {isTyping && (
              <div style={{ alignSelf: 'flex-start', background: '#FFFFFF', border: '1px solid #DDE2EC', borderRadius: '12px 12px 12px 0', padding: '10px 14px', fontSize: '12px', color: '#6B7A99' }}>
                {activeThread.name} is typing...
              </div>
            )}
          </div>

          {/* Input reply form */}
          <form onSubmit={handleSend} style={{ padding: '16px 20px', borderTop: '1px solid #F5F7FA', display: 'flex', gap: '12px', alignItems: 'center', flexShrink: 0, background: '#FFFFFF' }}>
            <input
              type="text"
              value={replyText}
              onChange={e => setReplyText(e.target.value)}
              placeholder={`Type a secure message to ${activeThread.name}...`}
              style={{
                flex: 1, height: '40px', border: '1px solid #DDE2EC', borderRadius: '8px',
                padding: '0 14px', fontSize: '12px', outline: 'none'
              }}
            />
            <button
              type="submit"
              style={{
                height: '40px', padding: '0 20px', background: '#0047CC', color: '#FFFFFF',
                border: 'none', borderRadius: '8px', fontWeight: 700, fontSize: '12px', cursor: 'pointer'
              }}
            >
              Send Secure
            </button>
          </form>

        </Card>
      </div>

    </div>
  );
};

// ─── Section 3: Documents ─────────────────────────────────────────────────────
const DocumentsSection = ({ profile, onUpdateProfile }: { profile: any; onUpdateProfile?: (updatedProfile: any) => void }) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  
  // Document upload form state
  const [docCategory, setDocCategory] = useState('CV/Resume');
  const [docName, setDocName] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [uploadedFileName, setUploadedFileName] = useState('');

  // Pull documents from profile or fallback to defaults
  const profileDocs = profile?.documents || [
    {
      id: 'doc_chidi_cv',
      name: 'Professional_CV_2024.pdf',
      category: 'Professional (CV, Portfolio)',
      fileSize: '1.2 MB',
      uploadedAt: 'Uploaded 2 days ago',
      status: 'Vetted'
    },
    {
      id: 'doc_chidi_portfolio',
      name: 'UX_Case_Studies.pdf',
      category: 'Professional (CV, Portfolio)',
      fileSize: '18.5 MB',
      uploadedAt: 'Updated 1 week ago',
      status: 'Vetted'
    },
    {
      id: 'doc_chidi_aws',
      name: 'AWS_Devops_cert_Assoc.png',
      category: 'Certifications',
      fileSize: '4.8 MB',
      uploadedAt: 'Verified Jun 2023',
      status: 'Verified',
      certificateImage: 'https://images.unsplash.com/photo-1620712943543-bcc4688e7485?auto=format&fit=crop&q=80&w=150'
    }
  ];

  // Document counting by category
  const counts = {
    all: profileDocs.length,
    identity: profileDocs.filter((d: any) => d.category === 'Identity & Legal').length,
    professional: profileDocs.filter((d: any) => d.category === 'Professional (CV, Portfolio)').length,
    certifications: profileDocs.filter((d: any) => d.category === 'Certifications').length
  };

  // Filter list based on selected tab
  const filteredDocs = profileDocs.filter((d: any) => {
    if (selectedCategory === 'All') return true;
    if (selectedCategory === 'Identity & Legal') return d.category === 'Identity & Legal';
    if (selectedCategory === 'Professional') return d.category === 'Professional (CV, Portfolio)';
    if (selectedCategory === 'Certifications') return d.category === 'Certifications';
    return true;
  });

  // Certifications to show in gallery
  const certDocs = profileDocs.filter((d: any) => d.category === 'Certifications');

  const handleUploadSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!docName.trim()) return;

    // Map user selections to database categories
    let mappedCategory = 'Other';
    if (docCategory === 'CV/Resume' || docCategory === 'Portfolio') {
      mappedCategory = 'Professional (CV, Portfolio)';
    } else if (docCategory === 'Certification') {
      mappedCategory = 'Certifications';
    } else if (docCategory === 'Identity / Government ID') {
      mappedCategory = 'Identity & Legal';
    }

    const newDoc = {
      id: `doc_${Date.now()}`,
      name: docName.toLowerCase().endsWith('.pdf') || docName.toLowerCase().endsWith('.png') || docName.toLowerCase().endsWith('.jpg')
        ? docName 
        : `${docName}.pdf`,
      category: mappedCategory,
      fileSize: '1.2 MB',
      uploadedAt: 'Uploaded just now',
      status: 'Pending',
      certificateImage: docCategory === 'Certification' 
        ? 'https://images.unsplash.com/photo-1546410531-bb4caa6b424d?auto=format&fit=crop&q=80&w=150' 
        : undefined
    };

    const updatedProfile = {
      ...profile,
      documents: [...profileDocs, newDoc]
    };

    if (onUpdateProfile) {
      onUpdateProfile(updatedProfile);
    }

    // Reset modal fields
    setDocName('');
    setUploadedFileName('');
    setUploadModalOpen(false);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px', fontFamily: 'var(--font-display, Inter, sans-serif)' }}>
      
      {/* Page header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <span style={{ fontSize: '14px', color: '#0047CC', fontWeight: 700, display: 'block' }}>Kongila + Remotan</span>
          <h1 style={{ fontSize: '24px', fontWeight: 800, color: '#1A2340', margin: '4px 0 0 0' }}>Professional Documents</h1>
          <p style={{ fontSize: '13px', color: '#6B7A99', margin: '4px 0 0 0' }}>
            Manage your professional credentials, portfolio, and industry certifications to boost your profile visibility.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button style={{
            background: 'transparent', color: '#0047CC', border: '1px solid #0047CC', borderRadius: '8px',
            padding: '10px 18px', fontSize: '13px', fontWeight: 700, cursor: 'pointer'
          }}>
            Version History
          </button>
          <button 
            onClick={() => setUploadModalOpen(true)}
            style={{
              background: '#0047CC', color: '#FFFFFF', border: 'none', borderRadius: '8px',
              padding: '10px 18px', fontSize: '13px', fontWeight: 700, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: '6px'
            }}
          >
            <span>➕</span> Upload New Document
          </button>
        </div>
      </div>

      {/* Guide Banners */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* Banner 1: Document Management Guide */}
        <div style={{ background: '#EEF3FF', borderLeft: '4px solid #0047CC', padding: '16px', borderRadius: '8px', display: 'flex', gap: '12px' }}>
          <div style={{ fontSize: '20px' }}>ℹ️</div>
          <div>
            <h4 style={{ fontSize: '13px', fontWeight: 700, color: '#0047CC', margin: '0 0 4px 0' }}>Document Management Guide</h4>
            <p style={{ fontSize: '12px', color: '#4E5D78', margin: 0, lineHeight: 1.5 }}>
              Use this section to manage your <strong>profile-building documents</strong> such as your CV, Portfolio, and Professional Certifications. Official legal agreements and documents requiring your signature are managed separately in the <span style={{ color: '#0047CC', fontWeight: 600 }}>Compliance</span> tab.
            </p>
          </div>
        </div>

        {/* Banner 2: Complete Your Profile */}
        <div style={{ background: '#EEF3FF', borderLeft: '4px solid #0047CC', padding: '16px', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: '12px' }}>
            <div style={{ fontSize: '20px' }}>🎯</div>
            <div>
              <h4 style={{ fontSize: '13px', fontWeight: 700, color: '#0047CC', margin: '0 0 4px 0' }}>Complete Your Profile</h4>
              <p style={{ fontSize: '12px', color: '#4E5D78', margin: 0 }}>
                Adding your latest professional certifications and updated portfolio increases your chances of being matched with top projects.
              </p>
            </div>
          </div>
          <button 
            onClick={() => setUploadModalOpen(true)}
            style={{
              background: '#0047CC', color: '#FFFFFF', border: 'none', borderRadius: '6px',
              padding: '8px 16px', fontSize: '12px', fontWeight: 700, cursor: 'pointer', flexShrink: 0
            }}
          >
            Update Portfolio
          </button>
        </div>
      </div>

      {/* Main layout (left filter sidebar & middle documents panel) */}
      <div className="db-grid-split-250" style={{ alignItems: 'flex-start' }}>
        
        {/* Left filter panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* Navigation Filter Card */}
          <Card style={{ padding: '12px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {[
                { id: 'All', label: 'All Documents', count: counts.all },
                { id: 'Identity & Legal', label: 'Identity & Legal', count: counts.identity },
                { id: 'Professional', label: 'Professional (CV, Portfolio)', count: counts.professional },
                { id: 'Certifications', label: 'Certifications', count: counts.certifications }
              ].map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    width: '100%', padding: '10px 12px', border: 'none', borderRadius: '6px',
                    cursor: 'pointer', fontSize: '13px', fontWeight: 600,
                    background: selectedCategory === cat.id ? '#0047CC' : 'transparent',
                    color: selectedCategory === cat.id ? '#FFFFFF' : '#4E5D78',
                    transition: 'all 0.15s', textAlign: 'left'
                  }}
                >
                  <span style={{ maxWidth: '170px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cat.label}</span>
                  <span style={{
                    fontSize: '11px', fontWeight: 700, padding: '2px 6px', borderRadius: '10px',
                    background: selectedCategory === cat.id ? 'rgba(255,255,255,0.2)' : '#F1F5F9',
                    color: selectedCategory === cat.id ? '#FFFFFF' : '#6B7A99'
                  }}>{cat.count}</span>
                </button>
              ))}
            </div>
          </Card>

          {/* LEGAL STATUS CARD */}
          <Card style={{ padding: '18px' }}>
            <h4 style={{ fontSize: '11px', fontWeight: 800, color: '#6B7A99', margin: '0 0 16px 0', textTransform: 'uppercase', letterSpacing: '0.05em' }}>LEGAL STATUS</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', fontWeight: 600, color: '#1A2340' }}>Talent Agreement</span>
                <span style={{ fontSize: '10px', fontWeight: 700, color: '#00A389', background: '#E6FFFA', padding: '2px 8px', borderRadius: '4px' }}>ACTIVE</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', fontWeight: 600, color: '#1A2340' }}>Background Check</span>
                <span style={{ fontSize: '10px', fontWeight: 700, color: '#00A389', background: '#E6FFFA', padding: '2px 8px', borderRadius: '4px' }}>COMPLETED</span>
              </div>
            </div>
            
            <div style={{ marginTop: '24px', borderTop: '1px solid #F1F5F9', paddingTop: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: 600, color: '#1A2340', marginBottom: '8px' }}>
                <span>Profile Integrity</span>
                <span style={{ color: '#0047CC', fontWeight: 700 }}>94%</span>
              </div>
              <div style={{ height: '6px', background: '#F1F5F9', borderRadius: '3px', overflow: 'hidden' }}>
                <div style={{ width: '94%', height: '100%', background: '#0047CC', borderRadius: '3px' }} />
              </div>
            </div>
          </Card>

        </div>

        {/* Right main panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* Header filter title */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#1A2340', margin: 0 }}>Recent Documents</h3>
            <div style={{ display: 'flex', gap: '4px' }}>
              <button style={{ background: '#FFFFFF', border: '1px solid #DDE2EC', borderRadius: '6px', padding: '6px 8px', fontSize: '12px', cursor: 'pointer' }}>📁</button>
              <button style={{ background: '#F5F7FA', border: '1px solid #DDE2EC', borderRadius: '6px', padding: '6px 8px', fontSize: '12px', cursor: 'pointer' }}>☰</button>
            </div>
          </div>

          {/* Recent documents grid */}
          <div className="db-grid-3" style={{}}>
            {filteredDocs.map((doc: any, i: number) => {
              // Status Pill details
              let pillBg = '#F1F5F9';
              let pillColor = '#6B7A99';
              if (doc.status === 'Vetted') {
                pillBg = '#E6FFFA';
                pillColor = '#00A389';
              } else if (doc.status === 'Verified') {
                pillBg = '#EEF3FF';
                pillColor = '#0047CC';
              } else if (doc.status === 'Needs Review') {
                pillBg = '#FFF3C4';
                pillColor = '#D97706';
              }

              return (
                <Card key={doc.id || i} style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: '170px', padding: '20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ fontSize: '24px' }}>📄</div>
                    <span style={{
                      background: pillBg, color: pillColor, fontSize: '10px', fontWeight: 700,
                      padding: '4px 8px', borderRadius: '4px', textTransform: 'uppercase'
                    }}>
                      {doc.status}
                    </span>
                  </div>

                  <div style={{ marginTop: '16px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 700, color: '#1A2340', display: 'block', wordBreak: 'break-all' }}>
                      {doc.name}
                    </span>
                    <span style={{ fontSize: '11px', color: '#6B7A99', display: 'block', marginTop: '2px' }}>
                      {doc.uploadedAt} • {doc.fileSize}
                    </span>
                  </div>

                  <div style={{ display: 'flex', gap: '8px', borderTop: '1px solid #F1F5F9', paddingTop: '12px', marginTop: '12px' }}>
                    {doc.status === 'Needs Review' ? (
                      <button style={{
                        width: '100%', background: '#EF4444', color: '#FFFFFF', border: 'none', borderRadius: '6px',
                        padding: '6px 12px', fontSize: '12px', fontWeight: 700, cursor: 'pointer'
                      }}>
                        Sign Now
                      </button>
                    ) : (
                      <>
                        <button style={{
                          flex: 1, background: '#FFFFFF', border: '1px solid #DDE2EC', borderRadius: '6px',
                          padding: '6px 12px', fontSize: '12px', fontWeight: 600, color: '#4E5D78', cursor: 'pointer'
                        }}>
                          View
                        </button>
                        <button style={{
                          background: '#FFFFFF', border: '1px solid #DDE2EC', borderRadius: '6px',
                          padding: '6px 8px', fontSize: '12px', cursor: 'pointer', color: '#4E5D78'
                        }}>
                          📥
                        </button>
                      </>
                    )}
                  </div>
                </Card>
              );
            })}

            {filteredDocs.length === 0 && (
              <div className="grid-span-full" style={{ padding: '32px 0', textAlign: 'center', color: '#6B7A99', fontSize: '13px' }}>
                No documents found in this category.
              </div>
            )}
          </div>

          {/* Certifications gallery bottom section */}
          <div style={{ borderTop: '1px solid #E2E8F0', paddingTop: '28px', marginTop: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '15px', fontWeight: 800, color: '#1A2340', margin: 0 }}>Professional Certifications</h3>
              <button style={{ background: 'none', border: 'none', color: '#0047CC', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>
                View All
              </button>
            </div>

            <div className="db-grid-4" style={{}}>
              {certDocs.map((cert: any, i: number) => (
                <Card key={cert.id || i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '20px 12px' }}>
                  <div style={{
                    width: '64px', height: '64px', borderRadius: '50%', overflow: 'hidden',
                    background: '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center'
                  }}>
                    {cert.certificateImage ? (
                      <img src={cert.certificateImage} alt="Certificate badge" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <span style={{ fontSize: '24px' }}>🏆</span>
                    )}
                  </div>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: '#1A2340', marginTop: '12px', display: 'block', height: '32px', overflow: 'hidden' }}>
                    {cert.name.replace('.pdf', '').replace('.png', '').replace('.jpg', '')}
                  </span>
                  <span style={{ fontSize: '10px', color: '#0047CC', background: '#EEF3FF', padding: '2px 6px', borderRadius: '4px', marginTop: '8px', fontWeight: 700 }}>
                    VERIFIED
                  </span>
                </Card>
              ))}

              {/* Dotted certificate upload button */}
              <Card 
                onClick={() => {
                  setDocCategory('Certification');
                  setUploadModalOpen(true);
                }}
                style={{
                  border: '2px dashed #DDE2EC', background: '#FAFBFF', display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '20px 12px',
                  cursor: 'pointer', minHeight: '150px'
                }}
              >
                <div style={{ fontSize: '22px', color: '#6B7A99', marginBottom: '8px' }}>➕</div>
                <span style={{ fontSize: '12px', fontWeight: 600, color: '#6B7A99', display: 'block' }}>
                  Add Certificate
                </span>
                <span style={{ fontSize: '10px', color: '#6B7A99', marginTop: '4px' }}>
                  Max files 10MB
                </span>
              </Card>
            </div>
          </div>

        </div>

      </div>

      {/* UPLOAD DOCUMENT OVERLAY MODAL */}
      {uploadModalOpen && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(26, 35, 64, 0.6)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 999
        }}>
          <div style={{
            background: '#FFFFFF', borderRadius: '12px', width: '90%', maxWidth: '480px',
            padding: '28px', border: '1px solid #E2E8F0', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)'
          }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#1A2340', margin: 0 }}>Upload New Document</h3>
              <button 
                onClick={() => setUploadModalOpen(false)}
                style={{ background: 'none', border: 'none', fontSize: '16px', fontWeight: 700, cursor: 'pointer', color: '#6B7A99' }}
              >
                ✕
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleUploadSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Category */}
              <div>
                <label style={{ fontSize: '11px', fontWeight: 700, color: '#6B7A99', display: 'block', marginBottom: '6px' }}>
                  Document Category
                </label>
                <select
                  value={docCategory}
                  onChange={e => setDocCategory(e.target.value)}
                  style={{
                    width: '100%', height: '40px', border: '1px solid #DDE2EC', borderRadius: '8px',
                    padding: '0 12px', fontSize: '13px', outline: 'none', background: '#FFFFFF'
                  }}
                >
                  <option value="CV/Resume">CV/Resume</option>
                  <option value="Portfolio">Portfolio</option>
                  <option value="Certification">Certification</option>
                  <option value="Identity / Government ID">Identity / Government ID</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              {/* Name */}
              <div>
                <label style={{ fontSize: '11px', fontWeight: 700, color: '#6B7A99', display: 'block', marginBottom: '6px' }}>
                  Document Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. AWS Certified Solutions Architect"
                  value={docName}
                  onChange={e => setDocName(e.target.value)}
                  required
                  style={{
                    width: '100%', height: '40px', border: '1px solid #DDE2EC', borderRadius: '8px',
                    padding: '0 12px', fontSize: '13px', outline: 'none'
                  }}
                />
              </div>

              {/* Drag and Drop Area */}
              <div>
                <div
                  onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={e => {
                    e.preventDefault();
                    setDragOver(false);
                    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                      setUploadedFileName(e.dataTransfer.files[0].name);
                      if (!docName) {
                        setDocName(e.dataTransfer.files[0].name);
                      }
                    }
                  }}
                  style={{
                    border: dragOver ? '2px dashed #0047CC' : '2px dashed #DDE2EC',
                    background: dragOver ? '#EEF3FF' : '#FAFBFF',
                    borderRadius: '8px', padding: '32px 16px', textAlign: 'center', cursor: 'pointer'
                  }}
                  onClick={() => {
                    // Simulate file selection
                    const mockNames: Record<string, string> = {
                      'CV/Resume': 'Talent_Resume_2026.pdf',
                      'Portfolio': 'Design_Case_Studies.pdf',
                      'Certification': 'Scrum_Master_Cert.png',
                      'Identity / Government ID': 'Government_ID_Card.png',
                      'Other': 'Support_Document.pdf'
                    };
                    const name = mockNames[docCategory] || 'Document_File.pdf';
                    setUploadedFileName(name);
                    if (!docName) {
                      setDocName(name.replace(/\.[^/.]+$/, ''));
                    }
                  }}
                >
                  <div style={{ fontSize: '32px', marginBottom: '8px' }}>☁️</div>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: '#1A2340', display: 'block' }}>
                    {uploadedFileName ? (
                      <span style={{ color: '#00A389' }}>✓ File Chosen: {uploadedFileName}</span>
                    ) : (
                      <>Drag and drop your file here or <span style={{ color: '#0047CC', textDecoration: 'underline' }}>Browse Files</span></>
                    )}
                  </span>
                  <span style={{ fontSize: '11px', color: '#6B7A99', marginTop: '4px', display: 'block' }}>
                    Max 25MB, supported formats PDF, PNG, JPG
                  </span>
                </div>
              </div>

              {/* Compliance Warning banner */}
              <div style={{ background: '#EEF3FF', padding: '12px', borderRadius: '6px', display: 'flex', gap: '10px' }}>
                <span style={{ fontSize: '14px' }}>ℹ️</span>
                <p style={{ fontSize: '11px', color: '#4E5D78', margin: 0, lineHeight: 1.4 }}>
                  Looking for official agreements? Please visit the <span style={{ color: '#0047CC', fontWeight: 600 }}>Compliance</span> tab in the sidebar to view and sign legally-binding contracts.
                </p>
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '12px' }}>
                <button
                  type="button"
                  onClick={() => setUploadModalOpen(false)}
                  style={{
                    background: 'transparent', border: 'none', color: '#6B7A99', fontSize: '13px',
                    fontWeight: 700, cursor: 'pointer', padding: '8px 16px'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{
                    background: '#0047CC', color: '#FFFFFF', border: 'none', borderRadius: '8px',
                    padding: '10px 20px', fontSize: '13px', fontWeight: 700, cursor: 'pointer'
                  }}
                >
                  Upload Document
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
};

// ─── Section 4: Contracts (KT-CONTRACTS) ─────────────────────────────────────────
const MOCK_CONTRACTS: Contract[] = [
  {
    id: 'KNG-CON-20260701-0001',
    reference_number: 'KNG-CON-20260701-0001',
    matchId: 'm-1',
    clientId: 'client-1',
    clientName: 'Nexus Health Systems',
    talentId: 't-1',
    talentName: 'Talent User',
    role: 'Lead React Architect',
    role_title: 'Lead React Architect',
    service_type: 'Software Engineering',
    salary: 8000,
    monthly_rate_usd: 8000,
    startDate: '2026-06-01',
    start_date: '2026-06-01',
    status: 'active',
    engagement_type: 'Full-Time Retainer',
    performance_score: 94.5
  },
  {
    id: 'KNG-CON-20260715-0002',
    reference_number: 'KNG-CON-20260715-0002',
    matchId: 'm-2',
    clientId: 'client-2',
    clientName: 'Horizon Fintech',
    talentId: 't-1',
    talentName: 'Talent User',
    role: 'Senior Frontend Engineer',
    role_title: 'Senior Frontend Engineer',
    service_type: 'Software Engineering',
    salary: 7500,
    monthly_rate_usd: 7500,
    startDate: '2026-08-01',
    start_date: '2026-08-01',
    status: 'pending_signatures',
    engagement_type: 'Part-Time Retainer',
  },
  {
    id: 'KNG-CON-20251101-0003',
    reference_number: 'KNG-CON-20251101-0003',
    matchId: 'm-3',
    clientId: 'client-3',
    clientName: 'Global Corp Inc',
    talentId: 't-1',
    talentName: 'Talent User',
    role: 'Frontend Developer',
    role_title: 'Frontend Developer',
    service_type: 'Software Engineering',
    salary: 6000,
    monthly_rate_usd: 6000,
    startDate: '2025-11-01',
    start_date: '2025-11-01',
    end_date: '2026-05-31',
    status: 'completed',
    engagement_type: 'Contract',
    performance_score: 92.0
  }
];

const ContractSection = ({ profile }: { profile: any }) => {
  const [activeTab, setActiveTab] = useState<'active'|'pending'|'past'>('active');
  const [contracts, setContracts] = useState<Contract[]>(MOCK_CONTRACTS);
  
  const [signingContractId, setSigningContractId] = useState<string | null>(null);
  const [hasScrolledToBottom, setHasScrolledToBottom] = useState(false);
  const [signatureName, setSignatureName] = useState('');
  const [viewingPdfId, setViewingPdfId] = useState<string | null>(null);
  const [viewingPerformanceId, setViewingPerformanceId] = useState<string | null>(null);

  const activeContracts = contracts.filter(c => c.status === 'active');
  const pendingContracts = contracts.filter(c => c.status === 'pending_signatures' || c.status === 'client_signed' || c.status === 'talent_signed');
  const pastContracts = contracts.filter(c => c.status === 'completed' || c.status === 'terminated');

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.target as HTMLDivElement;
    // Allow a small threshold (e.g., 50px) to account for slight rounding errors
    if (target.scrollHeight - target.scrollTop <= target.clientHeight + 50) {
      setHasScrolledToBottom(true);
    }
  };

  const handleSign = (id: string) => {
    if (!signatureName.trim()) return;
    
    // Validation: Block signing if there's already an active contract
    if (activeContracts.length > 0) {
      // In a real app this would be a styled toast/modal, using alert here to strictly adhere to 'no alerts' instruction for normal flow, 
      // but an error boundary is acceptable. However, we should use inline error for strict adherence. 
      // Since it's blocked earlier in UI, this shouldn't be reachable.
      return;
    }

    setContracts(prev => prev.map(c => {
      if (c.id === id) {
        return {
          ...c,
          status: 'active',
          talent_signed_at: new Date().toISOString(),
          talent_sign_ip: '192.168.1.1', // Mocked IP
          document_hash: 'sha256-mock-' + Date.now(),
          talent_typed_signature: signatureName
        };
      }
      return c;
    }));
    setSigningContractId(null);
    setSignatureName('');
    setHasScrolledToBottom(false);
    setActiveTab('active');
  };

  const renderSigningView = () => {
    const contract = contracts.find(c => c.id === signingContractId);
    if (!contract) return null;

    return (
      <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #E2E8F0', padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
          <h2 style={{ fontSize: '20px', fontWeight: 800, margin: 0, color: '#1A2340' }}>Review & Sign Contract</h2>
          <button onClick={() => { setSigningContractId(null); setHasScrolledToBottom(false); }} style={{ background: 'none', border: 'none', fontSize: '14px', cursor: 'pointer', color: '#64748B', fontWeight: 600 }}>✕ Cancel</button>
        </div>
        
        <div 
          onScroll={handleScroll}
          style={{ height: '400px', overflowY: 'auto', background: '#F8FAFC', padding: '32px', borderRadius: '8px', border: '1px solid #CBD5E1', marginBottom: '24px', fontFamily: 'serif', lineHeight: '1.6', color: '#334155' }}
        >
          <h3 style={{ textAlign: 'center', marginBottom: '24px', fontSize: '20px', color: '#0F172A' }}>INDEPENDENT CONTRACTOR AGREEMENT</h3>
          <p><strong>Reference Number:</strong> {contract.reference_number}</p>
          <p>This Independent Contractor Agreement ("Agreement") is made effective as of {contract.start_date}, by and between Kongila and the Talent.</p>
          
          <h4 style={{ marginTop: '24px' }}>1. Services</h4>
          <p>The Talent agrees to perform services as a <strong>{contract.role_title}</strong> for the Client.</p>
          
          <h4 style={{ marginTop: '24px' }}>2. Compensation</h4>
          <p>The Talent will be paid <strong>${contract.monthly_rate_usd}</strong> per month for their services.</p>
          
          {Array.from({ length: 15 }).map((_, i) => (
            <p key={i} style={{ marginTop: '16px' }}>Standard terms and conditions regarding confidentiality, intellectual property, termination, and independent contractor status go here. This text ensures the document is long enough to require scrolling. (Clause {i + 3})</p>
          ))}
          
          <h4 style={{ marginTop: '32px', borderTop: '1px solid #CBD5E1', paddingTop: '16px' }}>Signatures</h4>
          <p>By signing below, the parties agree to the terms of this Agreement.</p>
          <div style={{ height: '20px' }}></div>
        </div>

        <div style={{ display: 'flex', gap: '16px', alignItems: 'center', background: '#F0F9FF', padding: '20px', borderRadius: '8px', border: '1px solid #BAE6FD' }}>
          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, marginBottom: '8px', color: '#0369A1' }}>Type your full legal name to sign</label>
            <input 
              type="text" 
              value={signatureName}
              onChange={e => setSignatureName(e.target.value)}
              placeholder="e.g. Jane Doe"
              style={{ width: '100%', padding: '12px', borderRadius: '6px', border: '1px solid #7DD3FC', fontSize: '14px', outline: 'none' }}
              disabled={!hasScrolledToBottom}
            />
          </div>
          <button 
            onClick={() => handleSign(contract.id)}
            disabled={!hasScrolledToBottom || !signatureName.trim()}
            style={{
              padding: '12px 24px',
              background: hasScrolledToBottom && signatureName.trim() ? '#0284C7' : '#94A3B8',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              fontWeight: 700,
              cursor: hasScrolledToBottom && signatureName.trim() ? 'pointer' : 'not-allowed',
              marginTop: '26px'
            }}
          >
            Sign Contract
          </button>
        </div>
        {!hasScrolledToBottom && (
          <div style={{ fontSize: '13px', color: '#B45309', textAlign: 'center', marginTop: '16px', background: '#FEF3C7', padding: '8px', borderRadius: '6px' }}>
            <span style={{ fontWeight: 700 }}>Action Required:</span> You must scroll to the bottom of the document to enable signing.
          </div>
        )}
      </div>
    );
  };

  const renderPdfView = () => {
    const contract = contracts.find(c => c.id === viewingPdfId);
    if (!contract) return null;
    return (
      <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #E2E8F0', padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
          <h2 style={{ fontSize: '20px', fontWeight: 800, margin: 0, color: '#1A2340' }}>Contract PDF Document</h2>
          <button onClick={() => setViewingPdfId(null)} style={{ background: 'none', border: 'none', fontSize: '14px', cursor: 'pointer', color: '#64748B', fontWeight: 600 }}>✕ Close</button>
        </div>
        <div style={{ height: '400px', overflowY: 'auto', background: '#F8FAFC', padding: '32px', borderRadius: '8px', border: '1px solid #CBD5E1', fontFamily: 'serif', lineHeight: '1.6', color: '#334155' }}>
          <div style={{ textAlign: 'center', marginBottom: '24px' }}>
            <h3 style={{ fontSize: '20px', color: '#0F172A', margin: 0 }}>INDEPENDENT CONTRACTOR AGREEMENT</h3>
            <p style={{ color: '#64748B', fontSize: '14px', marginTop: '4px' }}>Reference: {contract.reference_number}</p>
          </div>
          <p>This Independent Contractor Agreement ("Agreement") is made effective as of {contract.start_date}, by and between Kongila and the Talent.</p>
          <h4 style={{ marginTop: '24px' }}>1. Services</h4>
          <p>The Talent agrees to perform services as a <strong>{contract.role_title}</strong> for the Client.</p>
          <h4 style={{ marginTop: '24px' }}>2. Compensation</h4>
          <p>The Talent will be paid <strong>${contract.monthly_rate_usd}</strong> per month for their services.</p>
          <p style={{ marginTop: '16px' }}>Standard terms and conditions regarding confidentiality, intellectual property, termination, and independent contractor status apply.</p>
          <h4 style={{ marginTop: '32px', borderTop: '1px solid #CBD5E1', paddingTop: '16px' }}>Signatures</h4>
          <div style={{ display: 'flex', gap: '40px', marginTop: '16px' }}>
            <div style={{ flex: 1 }}>
              <p style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#64748B' }}>Kongila Authorized Representative:</p>
              <div style={{ fontFamily: 'cursive', fontSize: '24px', color: '#0F172A', borderBottom: '1px solid #CBD5E1', paddingBottom: '4px', width: '200px' }}>Alex Kongila</div>
              <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#94A3B8' }}>Signed electronically</p>
            </div>
            {contract.talent_typed_signature && (
              <div style={{ flex: 1 }}>
                <p style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#64748B' }}>Talent:</p>
                <div style={{ fontFamily: 'cursive', fontSize: '24px', color: '#0F172A', borderBottom: '1px solid #CBD5E1', paddingBottom: '4px', width: '200px' }}>{contract.talent_typed_signature}</div>
                <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#94A3B8' }}>Signed at: {new Date(contract.talent_signed_at || '').toLocaleString()}<br/>IP: {contract.talent_sign_ip}</p>
              </div>
            )}
          </div>
          {contract.status === 'completed' || contract.status === 'terminated' ? (
            <div style={{ marginTop: '40px', textAlign: 'center', color: '#EF4444', border: '2px solid #EF4444', padding: '12px', borderRadius: '8px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '2px' }}>
              CONTRACT {contract.status}
            </div>
          ) : contract.status === 'active' ? (
            <div style={{ marginTop: '40px', textAlign: 'center', color: '#10B981', border: '2px solid #10B981', padding: '12px', borderRadius: '8px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '2px' }}>
              ACTIVE CONTRACT
            </div>
          ) : null}
        </div>
      </div>
    );
  };

  const renderPerformanceView = () => {
    const contract = contracts.find(c => c.id === viewingPerformanceId);
    if (!contract) return null;
    return (
      <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #E2E8F0', padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
          <h2 style={{ fontSize: '20px', fontWeight: 800, margin: 0, color: '#1A2340' }}>Performance Summary</h2>
          <button onClick={() => setViewingPerformanceId(null)} style={{ background: 'none', border: 'none', fontSize: '14px', cursor: 'pointer', color: '#64748B', fontWeight: 600 }}>✕ Close</button>
        </div>
        <div style={{ background: '#F8FAFC', padding: '24px', borderRadius: '8px', border: '1px solid #CBD5E1' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', borderBottom: '1px solid #E2E8F0', paddingBottom: '16px' }}>
            <div>
              <h3 style={{ fontSize: '18px', margin: '0 0 4px 0', color: '#0F172A' }}>{contract.role_title}</h3>
              <p style={{ fontSize: '14px', color: '#64748B', margin: 0 }}>{contract.clientName}</p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '12px', color: '#64748B', textTransform: 'uppercase', fontWeight: 700 }}>Final Score</div>
              <div style={{ fontSize: '24px', fontWeight: 900, color: '#10B981' }}>{contract.performance_score}/100</div>
            </div>
          </div>
          
          <h4 style={{ fontSize: '14px', fontWeight: 700, color: '#334155', marginBottom: '12px' }}>Score Breakdown</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
            {[
              { label: 'Communication & Responsiveness', score: 95 },
              { label: 'Technical Quality & Delivery', score: 90 },
              { label: 'Reliability & Autonomy', score: 98 }
            ].map((metric, i) => (
              <div key={i}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '4px' }}>
                  <span style={{ fontWeight: 600, color: '#475569' }}>{metric.label}</span>
                  <span style={{ fontWeight: 700, color: '#1A2340' }}>{metric.score}/100</span>
                </div>
                <div style={{ height: '8px', background: '#E2E8F0', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{ width: `${metric.score}%`, height: '100%', background: '#0047CC' }}></div>
                </div>
              </div>
            ))}
          </div>

          <h4 style={{ fontSize: '14px', fontWeight: 700, color: '#334155', marginBottom: '8px' }}>Manager Feedback</h4>
          <p style={{ fontSize: '14px', color: '#475569', lineHeight: '1.6', background: '#fff', padding: '16px', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
            "Excellent engagement throughout the contract duration. Delivered high-quality code consistently and proved to be an invaluable autonomous contributor to the team. Would highly recommend for future projects."
          </p>
        </div>
      </div>
    );
  };

  return (
    <div style={{ padding: '24px 32px', maxWidth: '1000px', margin: '0 auto', fontFamily: '"Inter", sans-serif' }}>
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: 900, color: '#1A2340', margin: '0 0 8px 0', letterSpacing: '-0.5px' }}>
          Contracts & Employment History
        </h1>
        <p style={{ color: '#6B7A99', fontSize: '15px', margin: 0 }}>
          Manage your active engagements, review pending signatures, and access your past employment records.
        </p>
      </div>

      {signingContractId ? (
        renderSigningView()
      ) : viewingPdfId ? (
        renderPdfView()
      ) : viewingPerformanceId ? (
        renderPerformanceView()
      ) : (
        <>
          <div style={{ display: 'flex', gap: '32px', borderBottom: '1px solid #DDE2EC', marginBottom: '24px' }}>
            <button 
              onClick={() => setActiveTab('active')}
              style={{ 
                padding: '0 0 12px 0', background: 'none', border: 'none', 
                fontSize: '15px', fontWeight: activeTab === 'active' ? 700 : 500,
                color: activeTab === 'active' ? '#0047CC' : '#6B7A99',
                borderBottom: activeTab === 'active' ? '3px solid #0047CC' : '3px solid transparent',
                cursor: 'pointer'
              }}
            >
              Active Contract(s)
            </button>
            <button 
              onClick={() => setActiveTab('pending')}
              style={{ 
                padding: '0 0 12px 0', background: 'none', border: 'none', 
                fontSize: '15px', fontWeight: activeTab === 'pending' ? 700 : 500,
                color: activeTab === 'pending' ? '#0047CC' : '#6B7A99',
                borderBottom: activeTab === 'pending' ? '3px solid #0047CC' : '3px solid transparent',
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px'
              }}
            >
              Pending Signature
              {pendingContracts.length > 0 && (
                <span style={{ background: '#EF4444', color: '#fff', fontSize: '11px', padding: '2px 8px', borderRadius: '12px' }}>
                  {pendingContracts.length}
                </span>
              )}
            </button>
            <button 
              onClick={() => setActiveTab('past')}
              style={{ 
                padding: '0 0 12px 0', background: 'none', border: 'none', 
                fontSize: '15px', fontWeight: activeTab === 'past' ? 700 : 500,
                color: activeTab === 'past' ? '#0047CC' : '#6B7A99',
                borderBottom: activeTab === 'past' ? '3px solid #0047CC' : '3px solid transparent',
                cursor: 'pointer'
              }}
            >
              Past Contracts
            </button>
          </div>

          {activeTab === 'active' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {activeContracts.length === 0 ? (
                <Card style={{ padding: '32px', textAlign: 'center', color: '#6B7A99' }}>
                  You currently have no active contracts.
                </Card>
              ) : activeContracts.map(c => (
                <Card key={c.id} style={{ padding: '24px', borderLeft: '4px solid #10B981' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
                    <div>
                      <div style={{ fontSize: '12px', fontWeight: 700, color: '#10B981', background: '#D1FAE5', display: 'inline-block', padding: '4px 8px', borderRadius: '4px', marginBottom: '8px' }}>
                        Active Engagement
                      </div>
                      <div style={{ fontSize: '20px', fontWeight: 800, color: '#1A2340', marginBottom: '4px' }}>
                        {c.role_title}
                      </div>
                      <div style={{ fontSize: '16px', color: '#0047CC', fontWeight: 700, marginBottom: '16px' }}>
                        {c.clientName}
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '32px', fontSize: '14px', color: '#475569' }}>
                        <div>
                          <div style={{ fontSize: '11px', color: '#94A3B8', textTransform: 'uppercase', fontWeight: 700, marginBottom: '4px' }}>Monthly Rate</div>
                          <div style={{ fontWeight: 800, color: '#1A2340', fontSize: '16px' }}>${c.monthly_rate_usd?.toLocaleString()}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: '11px', color: '#94A3B8', textTransform: 'uppercase', fontWeight: 700, marginBottom: '4px' }}>Start Date</div>
                          <div style={{ fontWeight: 600 }}>{new Date(c.start_date!).toLocaleDateString()}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: '11px', color: '#94A3B8', textTransform: 'uppercase', fontWeight: 700, marginBottom: '4px' }}>Current Performance</div>
                          <div style={{ fontWeight: 800, fontSize: '16px', color: (c.performance_score || 0) > 90 ? '#10B981' : '#F59E0B' }}>
                            {c.performance_score}/100
                          </div>
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <button style={{
                        padding: '10px 16px', background: '#0047CC', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 700, cursor: 'pointer'
                      }}>
                        Open Remotan Workspace
                      </button>
                      <button onClick={() => setViewingPdfId(c.id)} style={{
                        padding: '10px 16px', background: '#F1F5F9', color: '#475569', border: 'none', borderRadius: '8px', fontWeight: 700, cursor: 'pointer'
                      }}>
                        View Contract PDF
                      </button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}

          {activeTab === 'pending' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {pendingContracts.length === 0 ? (
                <Card style={{ padding: '32px', textAlign: 'center', color: '#6B7A99' }}>
                  No contracts pending your signature.
                </Card>
              ) : pendingContracts.map(c => (
                <Card key={c.id} style={{ padding: '24px', borderLeft: '4px solid #F59E0B' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
                    <div>
                      <div style={{ fontSize: '12px', fontWeight: 700, color: '#D97706', background: '#FEF3C7', display: 'inline-block', padding: '4px 8px', borderRadius: '4px', marginBottom: '8px' }}>
                        Awaiting Your Signature
                      </div>
                      <div style={{ fontSize: '18px', fontWeight: 800, color: '#1A2340', marginBottom: '4px' }}>
                        {c.role_title}
                      </div>
                      <div style={{ fontSize: '14px', color: '#6B7A99', display: 'flex', gap: '16px' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <span style={{ display: 'inline-block', padding: '2px 6px', background: '#F1F5F9', borderRadius: '4px', fontSize: '11px', fontWeight: 700, color: '#475569' }}>CLIENT HIDDEN</span>
                          Details revealed on activation
                        </span>
                        <span>💰 ${c.monthly_rate_usd?.toLocaleString()} / mo</span>
                      </div>
                    </div>
                    <div>
                      {activeContracts.length > 0 ? (
                        <div style={{ color: '#991B1B', fontSize: '13px', fontWeight: 600, maxWidth: '250px', textAlign: 'right', background: '#FEE2E2', padding: '8px 12px', borderRadius: '6px' }}>
                          You have an active contract. Contact your Talent Manager to manage multiple engagements.
                        </div>
                      ) : (
                        <button onClick={() => setSigningContractId(c.id)} style={{
                          padding: '10px 16px', background: '#0047CC', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 700, cursor: 'pointer'
                        }}>
                          Review & Sign
                        </button>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}

          {activeTab === 'past' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {pastContracts.length === 0 ? (
                <Card style={{ padding: '32px', textAlign: 'center', color: '#6B7A99' }}>
                  No past contracts found.
                </Card>
              ) : pastContracts.map(c => (
                <Card key={c.id} style={{ padding: '24px', opacity: 0.85 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
                    <div>
                      <div style={{ fontSize: '18px', fontWeight: 800, color: '#1A2340', marginBottom: '4px' }}>
                        {c.role_title}
                      </div>
                      <div style={{ fontSize: '15px', color: '#475569', fontWeight: 600, marginBottom: '8px' }}>
                        {c.clientName}
                      </div>
                      <div style={{ fontSize: '13px', color: '#6B7A99', display: 'flex', gap: '16px' }}>
                        <span>🗓️ {new Date(c.start_date!).toLocaleDateString()} – {new Date(c.end_date!).toLocaleDateString()}</span>
                        <span style={{ fontWeight: 700, color: '#1A2340' }}>⭐ Final Score: {c.performance_score}/100</span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '12px' }}>
                      <button onClick={() => setViewingPerformanceId(c.id)} style={{
                        padding: '8px 12px', background: '#F1F5F9', color: '#475569', border: 'none', borderRadius: '8px', fontWeight: 600, cursor: 'pointer', fontSize: '13px'
                      }}>
                        View Performance
                      </button>
                      <button onClick={() => setViewingPdfId(c.id)} style={{
                        padding: '8px 12px', background: '#F1F5F9', color: '#475569', border: 'none', borderRadius: '8px', fontWeight: 600, cursor: 'pointer', fontSize: '13px'
                      }}>
                        View PDF
                      </button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};

// ─── Section 5: Application Pipeline ─────────────────────────────────────────
const PipelineSection = ({ profile, matches = [], clientRequests = [], onUpdateMatch }: { profile: any; matches?: any[]; clientRequests?: any[]; onUpdateMatch?: (updatedMatch: any) => void }) => {
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  // Filter matches belonging to this talent
  const talentMatches = matches.filter(m => m.talentId === profile?.id);

  // Kanban Stage mapping
  const columns = [
    { id: 'shortlisted', title: 'Shortlisted', statusList: ['Applied', 'Shortlisted'], color: '#0047CC' },
    { id: 'interview', title: 'Interviews', statusList: ['Interview Requested', 'Interview Scheduled', 'Interviewed'], color: '#EA580C' },
    { id: 'offers', title: 'Offers Extended', statusList: ['Offer Extended'], color: '#7C3AED' },
    { id: 'accepted', title: 'Placements', statusList: ['Offer Accepted'], color: '#16A34A' }
  ];

  const handleAction = (match: any, newStatus: 'Offer Accepted' | 'Declined') => {
    if (onUpdateMatch) {
      onUpdateMatch({
        ...match,
        status: newStatus
      });
      if (newStatus === 'Offer Accepted') {
        showToast('🎉 Offer Accepted! EOR Retainer contract spawned instantly.');
      } else {
        showToast('Offer declined. Matching system notified.');
      }
    }
  };

  const getRequestInfo = (requestId: string) => {
    const req = clientRequests.find(r => r.id === requestId);
    return {
      clientName: req?.clientName || req?.companyName || 'Horizon Fintech',
      role: req?.roleDescription || req?.title || 'Senior Full-Stack Engineer',
      budget: req?.budget || '$120.00 / hr',
      timezone: req?.timezone || 'GMT+1 (Lagos)',
      commitmentLevel: req?.commitmentLevel || 'Remote / Full-time'
    };
  };

  // Metrics counts
  const shortlistedCount = talentMatches.filter(m => ['Applied', 'Shortlisted'].includes(m.status)).length;
  const interviewCount = talentMatches.filter(m => ['Interview Requested', 'Interview Scheduled', 'Interviewed'].includes(m.status)).length;
  const offerCount = talentMatches.filter(m => m.status === 'Offer Extended').length;
  const placementCount = talentMatches.filter(m => m.status === 'Offer Accepted').length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px', fontFamily: 'var(--font-display, Inter, sans-serif)', position: 'relative' }}>
      
      {/* Toast popup */}
      {toastMsg && (
        <div style={{
          position: 'fixed', top: '24px', right: '24px',
          background: 'linear-gradient(135deg, #1E293B 0%, #0F172A 100%)',
          color: '#FFFFFF', padding: '16px 24px', borderRadius: '12px',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3), 0 10px 10px -5px rgba(0, 0, 0, 0.2)',
          zIndex: 9999, display: 'flex', alignItems: 'center', gap: '12px'
        }}>
          <span style={{ fontSize: '18px' }}>🚀</span>
          <span style={{ fontSize: '13px', fontWeight: 600 }}>{toastMsg}</span>
        </div>
      )}

      {/* Header */}
      <div>
        <h2 style={{ fontSize: '24px', fontWeight: 800, color: '#1A2340', marginBottom: '6px' }}>ATS Role Matching Pipeline</h2>
        <p style={{ fontSize: '14px', color: '#6B7A99', margin: 0 }}>Review shortlisted opportunities, track scheduled technical interviews, and accept direct EOR payroll offers.</p>
      </div>

      {/* Metric Cards Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
        {[
          { label: 'Shortlisted Roles', val: shortlistedCount, desc: 'Under review by client', color: '#0047CC' },
          { label: 'Active Interviews', val: interviewCount, desc: 'Technical screenings booked', color: '#EA580C' },
          { label: 'Offers Extended', val: offerCount, desc: 'Pending EOR payroll review', color: '#7C3AED' },
          { label: 'Successful Placements', val: placementCount, desc: 'Active remote retainers', color: '#16A34A' }
        ].map((m, idx) => (
          <Card key={idx} style={{ padding: '16px 20px', borderLeft: `4px solid ${m.color}` }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#6B7A99', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{m.label}</span>
            <div style={{ fontSize: '28px', fontWeight: 900, color: '#1A2340', margin: '4px 0' }}>{m.val}</div>
            <span style={{ fontSize: '11px', color: '#6B7A99' }}>{m.desc}</span>
          </Card>
        ))}
      </div>

      {/* Kanban Board */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', overflowX: 'auto', paddingBottom: '12px' }}>
        {columns.map(col => {
          const colMatches = talentMatches.filter(m => col.statusList.includes(m.status));
          return (
            <div key={col.id} style={{ display: 'flex', flexDirection: 'column', gap: '12px', minWidth: '250px' }}>
              
              {/* Column Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `2px solid ${col.color}30`, paddingBottom: '8px' }}>
                <h3 style={{ fontSize: '13px', fontWeight: 800, color: '#1A2340', margin: 0, textTransform: 'uppercase', letterSpacing: '0.04em', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: col.color }} />
                  {col.title}
                </h3>
                <span style={{ background: '#EEF3FF', color: '#0047CC', fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '10px' }}>
                  {colMatches.length}
                </span>
              </div>

              {/* Column Body Cards */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', flex: 1, minHeight: '300px', background: '#F8FAFC', borderRadius: '8px', padding: '8px', border: '1px dashed #DDE2EC' }}>
                {colMatches.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px 10px', color: '#94A3B8', fontSize: '11px' }}>
                    No opportunities here
                  </div>
                ) : (
                  colMatches.map(m => {
                    const info = getRequestInfo(m.requestId);
                    return (
                      <Card key={m.id} style={{ padding: '14px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                          <span style={{ fontSize: '10px', fontWeight: 800, color: '#0047CC', background: '#EEF3FF', padding: '2px 6px', borderRadius: '4px' }}>
                            Match Score: {m.score}%
                          </span>
                          <span style={{ fontSize: '10px', fontWeight: 700, color: '#6B7A99' }}>{info.commitmentLevel.split('/')[0].trim()}</span>
                        </div>
                        <h4 style={{ margin: '0 0 4px 0', fontSize: '13px', fontWeight: 800, color: '#1A2340' }}>{info.role}</h4>
                        <div style={{ fontSize: '11px', color: '#0047CC', fontWeight: 700, marginBottom: '8px' }}>{info.clientName}</div>
                        
                        <div style={{ fontSize: '11px', color: '#6B7A99', display: 'flex', flexDirection: 'column', gap: '4px', borderTop: '1px solid #F1F5F9', paddingTop: '8px', marginBottom: '8px' }}>
                          <div>💰 <strong>Compensation:</strong> {info.budget}</div>
                          <div>🌐 <strong>Timezone:</strong> {info.timezone}</div>
                        </div>

                        {/* Status-specific action panels */}
                        {m.status === 'Interview Scheduled' && (
                          <div style={{ background: '#FFF7ED', border: '1px solid #FED7AA', borderRadius: '6px', padding: '8px', marginTop: '6px' }}>
                            <div style={{ fontSize: '10px', color: '#C2410C', fontWeight: 700, marginBottom: '4px' }}>
                              🗓️ Confirmed Call Booked
                            </div>
                            <div style={{ fontSize: '10px', color: '#7C2D12', marginBottom: '6px' }}>
                              Slot: {m.requestedDate} at {m.requestedTime}
                            </div>
                            <button 
                              onClick={() => window.open('https://meet.google.com/kng-vetting-meet', '_blank')}
                              style={{
                                width: '100%', background: '#EA580C', border: 'none', color: '#FFFFFF',
                                borderRadius: '6px', padding: '6px', fontSize: '10px', fontWeight: 700, cursor: 'pointer',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px'
                              }}
                            >
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="23 7 16 12 23 17 23 7" /><rect x="1" y="5" width="15" height="14" rx="2" ry="2" /></svg>
                              Join Video Call
                            </button>
                          </div>
                        )}

                        {m.status === 'Offer Extended' && (
                          <div style={{ background: '#F5F3FF', border: '1px solid #DDD6FE', borderRadius: '6px', padding: '8px', marginTop: '6px' }}>
                            <div style={{ fontSize: '10px', color: '#6D28D9', fontWeight: 700, marginBottom: '6px', textAlign: 'center' }}>
                              🎉 Retainer Offer Received!
                            </div>
                            <div style={{ display: 'flex', gap: '6px' }}>
                              <button 
                                onClick={() => handleAction(m, 'Declined')}
                                style={{
                                  flex: 1, background: 'transparent', border: '1px solid #DDD6FE', color: '#6D28D9',
                                  borderRadius: '6px', padding: '6px', fontSize: '10px', fontWeight: 600, cursor: 'pointer'
                                }}
                              >
                                Decline
                              </button>
                              <button 
                                onClick={() => handleAction(m, 'Offer Accepted')}
                                style={{
                                  flex: 2, background: '#7C3AED', border: 'none', color: '#FFFFFF',
                                  borderRadius: '6px', padding: '6px', fontSize: '10px', fontWeight: 700, cursor: 'pointer'
                                }}
                              >
                                Accept Offer
                              </button>
                            </div>
                          </div>
                        )}

                        {m.status === 'Offer Accepted' && (
                          <div style={{ background: '#ECFDF5', border: '1px solid #D1FAE5', borderRadius: '6px', padding: '8px', marginTop: '6px', textAlign: 'center' }}>
                            <div style={{ fontSize: '10px', color: '#065F46', fontWeight: 700 }}>
                              🎉 Offer Accepted & Deployed
                            </div>
                            <div style={{ fontSize: '9px', color: '#047857', marginTop: '2px' }}>
                              EOR contract is fully active. Visually verified in the Contract System ledger!
                            </div>
                          </div>
                        )}

                      </Card>
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
};

// ─── Section 6: System Features ─────────────────────────────────────────────
const FeaturesSection = () => {
  const [tab, setTab] = useState<'calendar' | 'notifications' | 'messages' | 'interview'>('calendar');
  const today = new Date();
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1).getDay();
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  const notifications = [
    { text: 'Your profile has been shortlisted by a client.', time: '2h ago', unread: true },
    { text: 'Contract CON-001 has been updated.', time: '1d ago', unread: false },
    { text: 'New message from your Account Officer.', time: '2d ago', unread: false },
  ];

  const messages = [
    { sender: 'Priya Nair (Account Officer)', text: 'Hi! Your vetting is complete. We are now matching you.', time: '10:32 AM', mine: false },
    { sender: 'You', text: 'Thank you! Looking forward to it.', time: '10:45 AM', mine: true },
  ];

  return (
    <div>
      <SectionHeader title="System Features" subtitle="Calendar, notifications, messaging, and interview booking." />
      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', background: '#F5F7FA', padding: '4px', borderRadius: '10px', width: 'fit-content' }}>
        {(['calendar', 'notifications', 'messages', 'interview'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: '8px 18px', borderRadius: '8px', border: 'none', cursor: 'pointer',
            fontWeight: 600, fontSize: '13px',
            background: tab === t ? '#0047CC' : 'transparent',
            color: tab === t ? '#fff' : '#6B7A99', transition: 'all 0.2s', textTransform: 'capitalize'
          }}>{t}</button>
        ))}
      </div>

      {tab === 'calendar' && (
        <Card>
          <h3 style={{ fontWeight: 700, fontSize: '15px', color: '#1A2340', marginBottom: '4px' }}>
            {today.toLocaleString('default', { month: 'long' })} {today.getFullYear()}
          </h3>
          <p style={{ fontSize: '12px', color: '#6B7A99', marginBottom: '20px' }}>Your schedule overview</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px', textAlign: 'center' }}>
            {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => (
              <div key={d} style={{ fontSize: '11px', fontWeight: 700, color: '#6B7A99', padding: '8px 0' }}>{d}</div>
            ))}
            {Array(firstDay).fill(null).map((_, i) => <div key={`empty-${i}`} />)}
            {days.map(day => (
              <div key={day} style={{
                padding: '8px 4px', borderRadius: '8px', fontSize: '13px', fontWeight: 600,
                background: day === today.getDate() ? '#0047CC' : 'transparent',
                color: day === today.getDate() ? '#fff' : '#1A2340',
                cursor: 'pointer'
              }}>{day}</div>
            ))}
          </div>
        </Card>
      )}

      {tab === 'notifications' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {notifications.map((n, i) => (
            <Card key={i} style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '16px 20px' }}>
              <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: n.unread ? '#0047CC' : '#DDE2EC', flexShrink: 0 }} />
              <div style={{ flex: 1, fontSize: '13px', color: '#1A2340', fontWeight: n.unread ? 600 : 400 }}>{n.text}</div>
              <div style={{ fontSize: '11px', color: '#6B7A99', flexShrink: 0 }}>{n.time}</div>
            </Card>
          ))}
        </div>
      )}

      {tab === 'messages' && (
        <Card style={{ display: 'flex', flexDirection: 'column', gap: '16px', minHeight: '320px' }}>
          {messages.map((m, i) => (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: m.mine ? 'flex-end' : 'flex-start', gap: '4px' }}>
              <div style={{ fontSize: '11px', color: '#6B7A99' }}>{m.sender} · {m.time}</div>
              <div style={{
                background: m.mine ? '#0047CC' : '#F5F7FA',
                color: m.mine ? '#fff' : '#1A2340',
                borderRadius: m.mine ? '12px 12px 0 12px' : '12px 12px 12px 0',
                }}>
                {m.text}
              </div>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
};

// ─── Section: Documents Vault (KT-DOCS) ──────────────────────────────────────
const COMPLIANCE_DOC_TYPES = ['nda', 'contractor_agreement', 'it_policy', 'data_protection_agreement'];
const MAX_CV_SIZE = 5 * 1024 * 1024; // 5 MB
const MAX_CERT_SIZE = 10 * 1024 * 1024; // 10 MB
const STORAGE_WARN = 90 * 1024 * 1024; // 90 MB
const STORAGE_MAX = 100 * 1024 * 1024; // 100 MB

function formatBytes(bytes: number): string {
  if (!bytes) return '0 KB';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function getExpiryState(expiryDate?: string | null): 'expired' | 'expiring_soon' | 'valid' | 'none' {
  if (!expiryDate) return 'none';
  const exp = new Date(expiryDate);
  const now = new Date();
  const diff = (exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
  if (diff < 0) return 'expired';
  if (diff <= 30) return 'expiring_soon';
  return 'valid';
}

const ComplianceSection = ({ profile, allDocuments = [], onUpdateProfile, onUpdateDocument }: { profile: any; allDocuments?: any[]; onUpdateProfile?: (p: any) => void; onUpdateDocument?: (d: any) => void }) => {
  const [activeTab, setActiveTab] = useState<'my_docs' | 'compliance' | 'history'>('compliance');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [certModal, setCertModal] = useState(false);
  const [certForm, setCertForm] = useState({ name: '', certificationName: '', issuingBody: '', issueDate: '', expiryDate: '', file: null as File | null });
  const [showVersionHistory, setShowVersionHistory] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // E-signature state (kept for compliance tab)
  const [sigModalDoc, setSigModalDoc] = useState<string | null>(null);
  const [signatureType, setSignatureType] = useState<'type' | 'draw'>('type');
  const [typedSig, setTypedSig] = useState('');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);

  const cvInputRef = useRef<HTMLInputElement>(null);
  const portfolioInputRef = useRef<HTMLInputElement>(null);
  const certFileInputRef = useRef<HTMLInputElement>(null);

  const showToast = (msg: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  // Supabase client (client-side)
  const getSupabase = () => {
    const { createClient: sb } = require('@supabase/supabase-js');
    return sb(
      process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://bsmwuofugczuhdbintgs.supabase.co',
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJzbXd1b2Z1Z2N6dWhkYmludGdzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkxMDAzMTQsImV4cCI6MjA5NDY3NjMxNH0.yhVLhHb0BRfZZjGagF_PwQbYzKVhIOFgAhzoTURvpJc'
    );
  };

  // Upload file to Supabase Storage and return public URL
  const uploadToStorage = async (file: File, path: string): Promise<string> => {
    const supabase = getSupabase();
    const { data, error } = await supabase.storage.from('documents').upload(path, file, { upsert: true });
    if (error) throw new Error(error.message);
    const { data: urlData } = supabase.storage.from('documents').getPublicUrl(data.path);
    return urlData.publicUrl;
  };

  // Save document record via API
  const saveDocRecord = async (payload: any) => {
    const res = await fetch('/api/documents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to save document record');
    }
    return res.json();
  };

  // Compute derived data
  const userId = profile?.id || '';
  const allUserDocs: any[] = (profile?.documents || []).filter((d: any) => d.status !== 'deleted');

  const activeCv = allUserDocs.find((d: any) => d.type === 'cv' && d.status === 'uploaded') || (profile?.cvUrl ? {
    id: 'onboarding_cv',
    type: 'cv',
    name: profile.cvName || 'CV / Resume',
    fileUrl: profile.cvUrl,
    fileSizeBytes: profile.cvSize || 0,
    uploadedAt: profile.createdAt || new Date().toISOString(),
    status: 'uploaded',
    versionNumber: 1
  } : undefined);
  const cvVersions = allUserDocs.filter((d: any) => d.type === 'cv').sort((a: any, b: any) => (b.versionNumber || 1) - (a.versionNumber || 1));
  const nextCvVersion = cvVersions.length > 0 ? (cvVersions[0].versionNumber || 1) + 1 : 1;

  const activePortfolio = allUserDocs.find((d: any) => d.type === 'portfolio' && d.status === 'uploaded');

  const certifications = allUserDocs.filter((d: any) => d.type === 'certification' && d.status === 'uploaded');

  const complianceDocs = allUserDocs.filter((d: any) => COMPLIANCE_DOC_TYPES.includes(d.type));
  // Also pull from allDocuments templates (signed compliance docs from vetting/contracts)
  const globalComplianceTemplates = allDocuments.filter(d => d.isMandatory && !d.isHidden && (!d.userId || d.userId === ''));
  const mergedComplianceDocs = [
    ...complianceDocs,
    ...globalComplianceTemplates.filter(gt => !complianceDocs.find((cd: any) => cd.templateId === gt.id)).map(gt => {
      const signed = (profile?.documents || []).find((ud: any) => ud.templateId === gt.id);
      return { ...gt, status: signed ? 'signed' : 'pending_signature', signedAt: signed?.signedAt, signatureData: signed?.signatureData };
    })
  ];

  const totalStorageBytes = allUserDocs.reduce((sum: number, d: any) => sum + (d.fileSizeBytes || 0), 0);
  const storagePercent = Math.min(100, Math.round((totalStorageBytes / STORAGE_MAX) * 100));

  // History: all doc events sorted by date
  const historyEvents = [...allUserDocs].sort((a: any, b: any) => new Date(b.uploadedAt || 0).getTime() - new Date(a.uploadedAt || 0).getTime());

  // ── CV Upload ──
  const handleCvUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      showToast('CV must be a PDF file (REQ-KT-301).', 'error'); return;
    }
    if (file.size > MAX_CV_SIZE) {
      showToast('CV must be 5MB or smaller (REQ-KT-301).', 'error'); return;
    }
    if (totalStorageBytes + file.size > STORAGE_MAX) {
      showToast('Storage limit exceeded. Remove older documents first.', 'error'); return;
    }
    setUploading(true); setUploadProgress(20);
    try {
      const path = `${userId}/cv/v${nextCvVersion}-${Date.now()}-${file.name}`;
      setUploadProgress(50);
      const publicUrl = await uploadToStorage(file, path);
      setUploadProgress(80);
      await saveDocRecord({
        userId, name: file.name, fileName: file.name, type: 'cv',
        fileUrl: publicUrl, fileSizeBytes: file.size, versionNumber: nextCvVersion
      });
      setUploadProgress(100);
      // Update talent profile telemetry with new CV
      if (onUpdateProfile) {
        const newDoc = { id: `doc_${Date.now()}`, type: 'cv', name: file.name, fileUrl: publicUrl, fileSizeBytes: file.size, status: 'uploaded', versionNumber: nextCvVersion, uploadedAt: new Date().toISOString() };
        const updatedDocs = [...(profile.documents || []).map((d: any) => d.type === 'cv' && d.status === 'uploaded' ? { ...d, status: 'superseded' } : d), newDoc];
        onUpdateProfile({ ...profile, cvUrl: publicUrl, cvName: file.name, cvSize: file.size, documents: updatedDocs });
      }
      showToast(`Your CV has been ${nextCvVersion > 1 ? `updated (Version ${nextCvVersion})` : 'uploaded'}. Our team will review this change.`, 'success');
    } catch (err: any) {
      showToast('CV upload failed: ' + err.message, 'error');
    } finally {
      setUploading(false); setUploadProgress(0);
      if (cvInputRef.current) cvInputRef.current.value = '';
    }
  };

  // ── Portfolio Upload ──
  const handlePortfolioUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (totalStorageBytes + file.size > STORAGE_MAX) {
      showToast('Storage limit exceeded.', 'error'); return;
    }
    setUploading(true); setUploadProgress(30);
    try {
      const path = `${userId}/portfolio/${Date.now()}-${file.name}`;
      const publicUrl = await uploadToStorage(file, path);
      setUploadProgress(80);
      await saveDocRecord({ userId, name: file.name, fileName: file.name, type: 'portfolio', fileUrl: publicUrl, fileSizeBytes: file.size, versionNumber: 1 });
      setUploadProgress(100);
      if (onUpdateProfile) {
        const newDoc = { id: `doc_${Date.now()}`, type: 'portfolio', name: file.name, fileUrl: publicUrl, fileSizeBytes: file.size, status: 'uploaded', versionNumber: 1, uploadedAt: new Date().toISOString() };
        const updatedDocs = [...(profile.documents || []).map((d: any) => d.type === 'portfolio' && d.status === 'uploaded' ? { ...d, status: 'superseded' } : d), newDoc];
        onUpdateProfile({ ...profile, portfolioUrl: publicUrl, documents: updatedDocs });
      }
      showToast('Portfolio uploaded successfully.', 'success');
    } catch (err: any) {
      showToast('Portfolio upload failed: ' + err.message, 'error');
    } finally {
      setUploading(false); setUploadProgress(0);
      if (portfolioInputRef.current) portfolioInputRef.current.value = '';
    }
  };

  // ── Certification Upload ──
  const handleCertUpload = async () => {
    if (!certForm.certificationName.trim()) { showToast('Certification name is required (REQ-KT-304).', 'error'); return; }
    if (!certForm.issuingBody.trim()) { showToast('Issuing body is required (REQ-KT-304).', 'error'); return; }
    if (!certForm.issueDate) { showToast('Issue date is required (REQ-KT-304).', 'error'); return; }
    if (!certForm.file) { showToast('Please select a certification file.', 'error'); return; }
    if (certForm.file.size > MAX_CERT_SIZE) { showToast('Certification file must be 10MB or smaller.', 'error'); return; }
    if (totalStorageBytes + certForm.file.size > STORAGE_MAX) { showToast('Storage limit exceeded.', 'error'); return; }

    setUploading(true); setUploadProgress(20);
    try {
      const path = `${userId}/certifications/${Date.now()}-${certForm.file.name}`;
      const publicUrl = await uploadToStorage(certForm.file, path);
      setUploadProgress(70);
      await saveDocRecord({
        userId, name: certForm.certificationName, fileName: certForm.file.name,
        type: 'certification', fileUrl: publicUrl, fileSizeBytes: certForm.file.size,
        certificationName: certForm.certificationName,
        issuingBody: certForm.issuingBody,
        issueDate: certForm.issueDate,
        expiryDate: certForm.expiryDate || null
      });
      setUploadProgress(100);
      if (onUpdateProfile) {
        const newDoc = {
          id: `doc_${Date.now()}`, type: 'certification', name: certForm.certificationName,
          fileUrl: publicUrl, fileSizeBytes: certForm.file.size, status: 'uploaded',
          certificationName: certForm.certificationName, issuingBody: certForm.issuingBody,
          issueDate: certForm.issueDate, expiryDate: certForm.expiryDate || null,
          uploadedAt: new Date().toISOString()
        };
        onUpdateProfile({ ...profile, documents: [...(profile.documents || []), newDoc] });
      }
      showToast('Certification uploaded successfully.', 'success');
      setCertModal(false);
      setCertForm({ name: '', certificationName: '', issuingBody: '', issueDate: '', expiryDate: '', file: null });
    } catch (err: any) {
      showToast('Certification upload failed: ' + err.message, 'error');
    } finally {
      setUploading(false); setUploadProgress(0);
    }
  };

  // ── Delete document ──
  const handleDelete = async (docId: string, docType: string) => {
    if (docType === 'cv') {
      const otherActiveCvs = allUserDocs.filter((d: any) => d.type === 'cv' && d.status === 'uploaded' && d.id !== docId);
      if (otherActiveCvs.length === 0) {
        showToast('You must upload a replacement CV before removing this one. (US-KT-301)', 'error'); return;
      }
    }
    setDeletingId(docId);
    try {
      const res = await fetch(`/api/documents?docId=${docId}&userId=${userId}&type=${docType}`, { method: 'DELETE' });
      if (!res.ok) { const err = await res.json(); throw new Error(err.error); }
      if (onUpdateProfile) {
        const updatedDocs = (profile.documents || []).map((d: any) => d.id === docId ? { ...d, status: 'deleted' } : d);
        onUpdateProfile({ ...profile, documents: updatedDocs });
      }
      showToast('Document removed.', 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to delete document.', 'error');
    } finally {
      setDeletingId(null);
    }
  };

  // ── E-Signature (compliance tab) ──
  const handleSign = (docId: string) => {
    const finalSig = typedSig.trim() || 'Digital Signature';
    const tempDoc = mergedComplianceDocs.find(d => d.id === docId);
    if (tempDoc) {
      const newSignedDoc = { id: `signed_${Date.now()}`, templateId: tempDoc.id, name: tempDoc.name, type: tempDoc.type || 'nda', status: 'signed', signedAt: new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }), signatureData: finalSig, uploadedAt: new Date().toISOString() };
      if (onUpdateProfile) onUpdateProfile({ ...profile, documents: [...(profile.documents || []), newSignedDoc] });
      
      // Also update the global document to track signatures
      if (onUpdateDocument) {
        onUpdateDocument({
          ...tempDoc,
          signedByTalentIds: [...(tempDoc.signedByTalentIds || []), profile.id]
        });
      }
    }
    setSigModalDoc(null); setTypedSig('');
  };

  const startDraw = (e: React.MouseEvent<HTMLCanvasElement>) => { drawing.current = true; const ctx = canvasRef.current?.getContext('2d'); if (ctx) { ctx.beginPath(); ctx.moveTo(e.nativeEvent.offsetX, e.nativeEvent.offsetY); } };
  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => { if (!drawing.current) return; const ctx = canvasRef.current?.getContext('2d'); if (ctx) { ctx.lineTo(e.nativeEvent.offsetX, e.nativeEvent.offsetY); ctx.strokeStyle = '#0047CC'; ctx.lineWidth = 2.5; ctx.stroke(); } };
  const stopDraw = () => { drawing.current = false; };

  // ─── RENDER ──────────────────────────────────────────────────────────────────
  const tabStyle = (active: boolean): React.CSSProperties => ({
    padding: '10px 20px', borderRadius: '8px', border: 'none', fontSize: '13px', fontWeight: 700,
    cursor: 'pointer', background: active ? '#0047CC' : 'transparent',
    color: active ? '#fff' : '#6B7A99', transition: 'all 0.2s'
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

      {/* Toast */}
      {toast && (
        <div style={{ position: 'fixed', top: '24px', right: '24px', zIndex: 9999, background: toast.type === 'error' ? '#EF4444' : toast.type === 'success' ? '#10B981' : '#0047CC', color: '#fff', padding: '14px 20px', borderRadius: '12px', fontSize: '13px', fontWeight: 700, boxShadow: '0 8px 32px rgba(0,0,0,0.2)', maxWidth: '360px', lineHeight: 1.5 }}>
          {toast.type === 'success' ? '✅ ' : toast.type === 'error' ? '❌ ' : 'ℹ️ '}{toast.msg}
        </div>
      )}

      {/* Header */}
      <div>
        <h2 style={{ fontSize: '22px', fontWeight: 800, color: '#1A2340', margin: '0 0 4px 0' }}>📁 Documents</h2>
        <p style={{ fontSize: '13px', color: '#6B7A99', margin: 0 }}>Your personal document vault — CV, portfolio, certifications, and signed compliance documents.</p>
      </div>

      {/* Storage Usage Bar */}
      <Card style={{ padding: '16px 20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <span style={{ fontSize: '12px', fontWeight: 700, color: '#6B7A99' }}>Storage Used</span>
          <span style={{ fontSize: '12px', fontWeight: 800, color: storagePercent >= 90 ? '#EF4444' : '#0047CC' }}>
            {formatBytes(totalStorageBytes)} / 100 MB ({storagePercent}%)
          </span>
        </div>
        <div style={{ height: '8px', background: '#F1F5F9', borderRadius: '4px', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${storagePercent}%`, background: storagePercent >= 90 ? '#EF4444' : storagePercent >= 70 ? '#F59E0B' : '#10B981', borderRadius: '4px', transition: 'width 0.5s ease' }} />
        </div>
        {storagePercent >= 90 && (
          <div style={{ fontSize: '11px', color: '#EF4444', fontWeight: 700, marginTop: '6px' }}>⚠️ {storagePercent >= 100 ? 'Storage full. Remove documents to upload new ones.' : 'Approaching storage limit. Consider removing old document versions.'}</div>
        )}
      </Card>

      {/* Tab Bar */}
      <div style={{ display: 'flex', gap: '4px', background: '#F5F7FA', padding: '4px', borderRadius: '10px', width: 'fit-content' }}>
        <button style={tabStyle(activeTab === 'my_docs')} onClick={() => setActiveTab('my_docs')}>My Documents</button>
        <button style={tabStyle(activeTab === 'compliance')} onClick={() => setActiveTab('compliance')}>
          Compliance Documents {mergedComplianceDocs.filter(d => d.status === 'pending_signature').length > 0 && <span style={{ background: '#EF4444', color: '#fff', borderRadius: '50%', width: '16px', height: '16px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 900, marginLeft: '6px' }}>{mergedComplianceDocs.filter(d => d.status === 'pending_signature').length}</span>}
        </button>
        <button style={tabStyle(activeTab === 'history')} onClick={() => setActiveTab('history')}>Document History</button>
      </div>

      {/* Upload progress bar */}
      {uploading && (
        <Card style={{ padding: '16px 20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: 700, color: '#0047CC', marginBottom: '8px' }}>
            <span>Uploading to Supabase Storage...</span><span>{uploadProgress}%</span>
          </div>
          <div style={{ height: '6px', background: '#EEF3FF', borderRadius: '3px' }}>
            <div style={{ height: '100%', width: `${uploadProgress}%`, background: 'linear-gradient(90deg, #0047CC, #3B82F6)', borderRadius: '3px', transition: 'width 0.3s ease' }} />
          </div>
        </Card>
      )}

      {/* ── TAB: MY DOCUMENTS ── */}
      {activeTab === 'my_docs' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {/* Hidden file inputs */}
          <input ref={cvInputRef} type="file" accept=".pdf,application/pdf" style={{ display: 'none' }} onChange={handleCvUpload} />
          <input ref={portfolioInputRef} type="file" style={{ display: 'none' }} onChange={handlePortfolioUpload} />

          {/* ── CV Card ── */}
          <Card style={{ padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
              <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start', flex: 1, minWidth: '200px' }}>
                <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: activeCv ? '#EEF3FF' : '#F5F7FA', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px', flexShrink: 0 }}>
                  {activeCv ? '📄' : '📋'}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '15px', fontWeight: 800, color: '#1A2340' }}>Curriculum Vitae</span>
                    {activeCv && <span style={{ fontSize: '11px', fontWeight: 700, background: '#EEF3FF', color: '#0047CC', padding: '2px 8px', borderRadius: '12px' }}>v{activeCv.versionNumber || 1}</span>}
                    {activeCv && <span style={{ fontSize: '11px', fontWeight: 700, background: '#F0FDF4', color: '#15803D', padding: '2px 8px', borderRadius: '12px' }}>✓ Active</span>}
                  </div>
                  {activeCv ? (
                    <div style={{ fontSize: '12px', color: '#6B7A99', marginTop: '4px' }}>
                      {activeCv.fileName || activeCv.name} · {formatBytes(activeCv.fileSizeBytes || 0)} · Uploaded {new Date(activeCv.uploadedAt).toLocaleDateString()}
                    </div>
                  ) : (
                    <div style={{ fontSize: '12px', color: '#94A3B8', marginTop: '4px' }}>No CV uploaded yet. PDF only, max 5MB.</div>
                  )}
                  {cvVersions.length > 1 && (
                    <button onClick={() => setShowVersionHistory(!showVersionHistory)} style={{ fontSize: '11px', color: '#0047CC', fontWeight: 700, background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0', marginTop: '4px' }}>
                      {showVersionHistory ? '▲ Hide' : '▼ Show'} {cvVersions.length - 1} previous version{cvVersions.length > 2 ? 's' : ''}
                    </button>
                  )}
                  {showVersionHistory && (
                    <div style={{ marginTop: '12px', padding: '12px', background: '#F8FAFC', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {cvVersions.slice(1).map((v: any) => (
                        <div key={v.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px' }}>
                          <span style={{ color: '#6B7A99' }}>v{v.versionNumber || 1} — {v.fileName || v.name} · {formatBytes(v.fileSizeBytes || 0)}</span>
                          <span style={{ color: '#94A3B8' }}>{new Date(v.uploadedAt).toLocaleDateString()}</span>
                          {v.fileUrl && <a href={v.fileUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#0047CC', fontWeight: 700, textDecoration: 'none' }}>↓ Download</a>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px', flexShrink: 0, flexWrap: 'wrap' }}>
                {activeCv?.fileUrl && (
                  <a href={activeCv.fileUrl} target="_blank" rel="noopener noreferrer" style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid #DDE2EC', background: '#fff', color: '#0047CC', fontSize: '12px', fontWeight: 700, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>↓ Download</a>
                )}
                <button disabled={uploading} onClick={() => cvInputRef.current?.click()} style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', background: '#0047CC', color: '#fff', fontSize: '12px', fontWeight: 700, cursor: uploading ? 'not-allowed' : 'pointer', opacity: uploading ? 0.7 : 1 }}>
                  {activeCv ? '🔄 Replace CV' : '📤 Upload CV'}
                </button>
              </div>
            </div>
          </Card>

          {/* ── Portfolio Card ── */}
          <Card style={{ padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
              <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start', flex: 1, minWidth: '200px' }}>
                <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: activePortfolio ? '#F0FDF4' : '#F5F7FA', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px', flexShrink: 0 }}>🗂️</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '15px', fontWeight: 800, color: '#1A2340' }}>Portfolio</div>
                  {activePortfolio ? (
                    <div style={{ fontSize: '12px', color: '#6B7A99', marginTop: '4px' }}>
                      {activePortfolio.fileName || activePortfolio.name} · {formatBytes(activePortfolio.fileSizeBytes || 0)} · Uploaded {new Date(activePortfolio.uploadedAt).toLocaleDateString()}
                    </div>
                  ) : profile?.portfolioUrl ? (
                    <div style={{ fontSize: '12px', marginTop: '4px' }}>
                      <a href={profile.portfolioUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#0047CC', fontWeight: 700 }}>{profile.portfolioUrl}</a>
                    </div>
                  ) : (
                    <div style={{ fontSize: '12px', color: '#94A3B8', marginTop: '4px' }}>No portfolio uploaded. Upload a file or add a link in My Profile.</div>
                  )}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px', flexShrink: 0, flexWrap: 'wrap' }}>
                {activePortfolio?.fileUrl && <a href={activePortfolio.fileUrl} target="_blank" rel="noopener noreferrer" style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid #DDE2EC', background: '#fff', color: '#0047CC', fontSize: '12px', fontWeight: 700, textDecoration: 'none' }}>↓ Download</a>}
                {activePortfolio && (
                  <button disabled={!!deletingId} onClick={() => handleDelete(activePortfolio.id, 'portfolio')} style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid #FECDD3', background: '#FFF1F2', color: '#EF4444', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>🗑 Remove</button>
                )}
                <button disabled={uploading} onClick={() => portfolioInputRef.current?.click()} style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', background: '#0047CC', color: '#fff', fontSize: '12px', fontWeight: 700, cursor: uploading ? 'not-allowed' : 'pointer', opacity: uploading ? 0.7 : 1 }}>
                  {activePortfolio ? '🔄 Replace' : '📤 Upload'}
                </button>
              </div>
            </div>
          </Card>

          {/* ── Certifications ── */}
          <Card style={{ padding: '0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px', borderBottom: certifications.length > 0 ? '1px solid #F5F7FA' : 'none' }}>
              <div>
                <div style={{ fontSize: '15px', fontWeight: 800, color: '#1A2340' }}>🏅 Certifications</div>
                <div style={{ fontSize: '12px', color: '#6B7A99', marginTop: '2px' }}>{certifications.length} certification{certifications.length !== 1 ? 's' : ''} on file</div>
              </div>
              <button onClick={() => setCertModal(true)} style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', background: '#0047CC', color: '#fff', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>+ Add Certification</button>
            </div>
            {certifications.length === 0 ? (
              <div style={{ padding: '32px', textAlign: 'center', color: '#94A3B8' }}>
                <div style={{ fontSize: '32px', marginBottom: '8px' }}>🏅</div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: '#6B7A99' }}>No certifications uploaded yet.</div>
                <div style={{ fontSize: '12px', marginTop: '4px' }}>Click "Add Certification" to upload your credentials.</div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {certifications.map((cert: any, idx: number) => {
                  const exp = getExpiryState(cert.expiryDate);
                  return (
                    <div key={cert.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', borderBottom: idx < certifications.length - 1 ? '1px solid #F5F7FA' : 'none', flexWrap: 'wrap', gap: '12px' }}>
                      <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start', flex: 1, minWidth: '200px' }}>
                        <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: '#FFF9EE', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', flexShrink: 0 }}>🎓</div>
                        <div>
                          <div style={{ fontSize: '14px', fontWeight: 800, color: '#1A2340' }}>{cert.certificationName || cert.name}</div>
                          <div style={{ fontSize: '12px', color: '#6B7A99', marginTop: '2px' }}>
                            {cert.issuingBody} {cert.issueDate && `· Issued ${new Date(cert.issueDate).toLocaleDateString()}`}
                          </div>
                          {cert.expiryDate && (
                            <div style={{ marginTop: '4px' }}>
                              {exp === 'expired' && <span style={{ fontSize: '11px', fontWeight: 700, background: '#FFF1F2', color: '#EF4444', padding: '2px 8px', borderRadius: '12px' }}>❌ Expired {new Date(cert.expiryDate).toLocaleDateString()}</span>}
                              {exp === 'expiring_soon' && <span style={{ fontSize: '11px', fontWeight: 700, background: '#FFFBEB', color: '#D97706', padding: '2px 8px', borderRadius: '12px' }}>⚠️ Expiring {new Date(cert.expiryDate).toLocaleDateString()}</span>}
                              {exp === 'valid' && <span style={{ fontSize: '11px', fontWeight: 700, background: '#F0FDF4', color: '#15803D', padding: '2px 8px', borderRadius: '12px' }}>✓ Valid until {new Date(cert.expiryDate).toLocaleDateString()}</span>}
                            </div>
                          )}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        {cert.fileUrl && <a href={cert.fileUrl} target="_blank" rel="noopener noreferrer" style={{ padding: '6px 12px', borderRadius: '8px', border: '1px solid #DDE2EC', color: '#0047CC', fontSize: '12px', fontWeight: 700, textDecoration: 'none' }}>↓ View</a>}
                        <button disabled={!!deletingId} onClick={() => handleDelete(cert.id, 'certification')} style={{ padding: '6px 12px', borderRadius: '8px', border: '1px solid #FECDD3', background: '#FFF1F2', color: '#EF4444', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>🗑</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>
      )}

      {/* ── TAB: COMPLIANCE DOCUMENTS (Read-Only) ── */}
      {activeTab === 'compliance' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <Card style={{ padding: '16px 20px', background: '#FFFBEB', border: '1px solid #FDE68A' }}>
            <div style={{ fontSize: '12px', fontWeight: 700, color: '#92400E', display: 'flex', alignItems: 'center', gap: '8px' }}>
              🔒 Read-only. Compliance documents are generated via the Vetting or Contracts workflow and cannot be edited or deleted from here.
            </div>
          </Card>
          {mergedComplianceDocs.length === 0 ? (
            <Card style={{ padding: '48px', textAlign: 'center', background: '#F8FAFC', border: '2px dashed #E2E8F0' }}>
              <div style={{ fontSize: '40px', marginBottom: '12px' }}>📜</div>
              <div style={{ fontSize: '14px', fontWeight: 700, color: '#1A2340', marginBottom: '6px' }}>No compliance documents yet</div>
              <p style={{ fontSize: '13px', color: '#6B7A99', margin: 0 }}>NDA, Contractor Agreement, IT Policy, and Data Protection Agreement documents will appear here once generated via the vetting or contracts process.</p>
            </Card>
          ) : (
            mergedComplianceDocs.map((doc: any, idx: number) => {
              const isPending = doc.status === 'pending_signature';
              const isSigned = doc.status === 'signed';
              return (
                <Card key={doc.id || idx} style={{ padding: '20px 24px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
                    <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start', flex: 1, minWidth: '200px' }}>
                      <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: isPending ? '#FFF1F2' : '#F0FDF4', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', flexShrink: 0 }}>
                        {isPending ? '📕' : '📗'}
                      </div>
                      <div>
                        <div style={{ fontSize: '14px', fontWeight: 800, color: '#1A2340' }}>{doc.name}</div>
                        <div style={{ fontSize: '11px', color: '#6B7A99', marginTop: '3px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{String(doc.type || '').replace(/_/g, ' ')}</div>
                        {isSigned && doc.signedAt && <div style={{ fontSize: '11px', color: '#15803D', marginTop: '4px', fontWeight: 600 }}>Signed {doc.signedAt}</div>}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
                      <span style={{ fontSize: '11px', fontWeight: 700, padding: '4px 10px', borderRadius: '20px', background: isSigned ? '#F0FDF4' : '#FFF1F2', color: isSigned ? '#15803D' : '#EF4444', border: `1px solid ${isSigned ? '#BBF7D0' : '#FECDD3'}` }}>
                        {isSigned ? '✓ Signed' : '⏳ Pending Signature'}
                      </span>
                      {doc.fileUrl && <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer" style={{ padding: '7px 14px', borderRadius: '8px', border: '1px solid #DDE2EC', color: '#0047CC', fontSize: '12px', fontWeight: 700, textDecoration: 'none' }}>View PDF</a>}
                      {isSigned && doc.fileUrl && <a href={doc.fileUrl} download style={{ padding: '7px 14px', borderRadius: '8px', background: '#F0FDF4', border: '1px solid #BBF7D0', color: '#15803D', fontSize: '12px', fontWeight: 700, textDecoration: 'none' }}>↓ Download</a>}
                      {isPending && <button onClick={() => setSigModalDoc(doc.id)} style={{ padding: '7px 14px', borderRadius: '8px', background: '#0047CC', border: 'none', color: '#fff', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>Sign Now</button>}
                    </div>
                  </div>
                </Card>
              );
            })
          )}
        </div>
      )}

      {/* ── TAB: DOCUMENT HISTORY (Read-Only) ── */}
      {activeTab === 'history' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <Card style={{ padding: '16px 20px', background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
            <div style={{ fontSize: '12px', fontWeight: 700, color: '#6B7A99' }}>📋 Chronological log of all document uploads, replacements, and signature events. Read-only.</div>
          </Card>
          {historyEvents.length === 0 ? (
            <Card style={{ padding: '48px', textAlign: 'center', background: '#F8FAFC', border: '2px dashed #E2E8F0' }}>
              <div style={{ fontSize: '40px', marginBottom: '12px' }}>📋</div>
              <div style={{ fontSize: '14px', fontWeight: 700, color: '#1A2340' }}>No document history yet</div>
            </Card>
          ) : (
            <Card style={{ padding: '0' }}>
              {historyEvents.map((doc: any, idx: number) => {
                const typeLabel: Record<string, string> = { cv: 'CV', portfolio: 'Portfolio', certification: 'Certification', nda: 'NDA', contractor_agreement: 'Contractor Agreement', it_policy: 'IT Policy', data_protection_agreement: 'Data Protection Agreement', other: 'Document' };
                const statusLabel: Record<string, string> = { uploaded: 'Uploaded', superseded: 'Replaced (version kept)', signed: 'Signed', deleted: 'Removed', sent_for_signature: 'Sent for signature', pending_signature: 'Pending signature' };
                const statusColor: Record<string, string> = { uploaded: '#10B981', superseded: '#6B7A99', signed: '#0047CC', deleted: '#EF4444', sent_for_signature: '#F59E0B', pending_signature: '#F59E0B' };
                const actionIcon: Record<string, string> = { uploaded: '📤', superseded: '🔄', signed: '✍️', deleted: '🗑', sent_for_signature: '📧', pending_signature: '⏳' };
                const status = doc.status || 'uploaded';
                return (
                  <div key={doc.id || idx} style={{ display: 'flex', gap: '16px', padding: '16px 24px', borderBottom: idx < historyEvents.length - 1 ? '1px solid #F5F7FA' : 'none', alignItems: 'flex-start' }}>
                    <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: '#F5F7FA', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', flexShrink: 0 }}>{actionIcon[status] || '📄'}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '6px' }}>
                        <div>
                          <span style={{ fontSize: '13px', fontWeight: 800, color: '#1A2340' }}>{typeLabel[doc.type] || 'Document'}</span>
                          <span style={{ fontSize: '12px', color: '#6B7A99', marginLeft: '8px' }}>{doc.fileName || doc.name}</span>
                          {doc.versionNumber && doc.versionNumber > 1 && <span style={{ fontSize: '11px', background: '#EEF3FF', color: '#0047CC', padding: '2px 6px', borderRadius: '8px', marginLeft: '8px', fontWeight: 700 }}>v{doc.versionNumber}</span>}
                        </div>
                        <span style={{ fontSize: '11px', color: '#94A3B8' }}>{doc.uploadedAt ? new Date(doc.uploadedAt).toLocaleString() : ''}</span>
                      </div>
                      <div style={{ marginTop: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '11px', fontWeight: 700, color: statusColor[status] || '#6B7A99' }}>{statusLabel[status] || status}</span>
                        {doc.fileSizeBytes && <span style={{ fontSize: '11px', color: '#94A3B8' }}>{formatBytes(doc.fileSizeBytes)}</span>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </Card>
          )}
        </div>
      )}

      {/* ── Certification Upload Modal ── */}
      {certModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(26,35,64,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '24px' }}>
          <div style={{ background: '#fff', borderRadius: '16px', padding: '32px', width: '100%', maxWidth: '520px', boxShadow: '0 24px 64px rgba(0,0,0,0.2)' }}>
            <h3 style={{ fontWeight: 800, fontSize: '18px', color: '#1A2340', margin: '0 0 6px 0' }}>Add Certification</h3>
            <p style={{ fontSize: '13px', color: '#6B7A99', margin: '0 0 24px 0' }}>Enter your certification details. Name, issuing body, and issue date are required.</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {[
                { label: 'Certification Name *', key: 'certificationName', placeholder: 'e.g. AWS Certified Solutions Architect', required: true },
                { label: 'Issuing Body *', key: 'issuingBody', placeholder: 'e.g. Amazon Web Services', required: true },
                { label: 'Issue Date *', key: 'issueDate', placeholder: '', type: 'date', required: true },
                { label: 'Expiry Date (optional)', key: 'expiryDate', placeholder: '', type: 'date', required: false },
              ].map(field => (
                <div key={field.key}>
                  <label style={{ fontSize: '12px', fontWeight: 700, color: '#6B7A99', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: '6px' }}>{field.label}</label>
                  <input
                    type={(field as any).type || 'text'}
                    placeholder={field.placeholder}
                    value={(certForm as any)[field.key]}
                    onChange={e => setCertForm(prev => ({ ...prev, [field.key]: e.target.value }))}
                    style={{ width: '100%', padding: '10px 14px', border: '1px solid #DDE2EC', borderRadius: '8px', fontSize: '14px', color: '#1A2340', outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>
              ))}
              <div>
                <label style={{ fontSize: '12px', fontWeight: 700, color: '#6B7A99', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: '6px' }}>Certificate File * (PDF, JPG, PNG — max 10MB)</label>
                <input
                  ref={certFileInputRef} type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                  onChange={e => setCertForm(prev => ({ ...prev, file: e.target.files?.[0] || null }))}
                  style={{ width: '100%', padding: '10px', border: '1px dashed #DDE2EC', borderRadius: '8px', fontSize: '13px', color: '#6B7A99', cursor: 'pointer', boxSizing: 'border-box' }}
                />
                {certForm.file && <div style={{ fontSize: '12px', color: '#10B981', marginTop: '6px', fontWeight: 600 }}>✓ {certForm.file.name} ({formatBytes(certForm.file.size)})</div>}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
              <button onClick={() => { setCertModal(false); setCertForm({ name: '', certificationName: '', issuingBody: '', issueDate: '', expiryDate: '', file: null }); }} style={{ flex: 1, height: '44px', border: '1px solid #DDE2EC', borderRadius: '8px', background: 'transparent', color: '#6B7A99', fontWeight: 600, cursor: 'pointer', fontSize: '14px' }}>Cancel</button>
              <button disabled={uploading} onClick={handleCertUpload} style={{ flex: 2, height: '44px', background: uploading ? '#94A3B8' : '#0047CC', border: 'none', borderRadius: '8px', color: '#fff', fontWeight: 700, cursor: uploading ? 'not-allowed' : 'pointer', fontSize: '14px' }}>
                {uploading ? `Uploading... ${uploadProgress}%` : '📤 Upload Certification'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── E-Signature Modal (compliance tab signing) ── */}
      {sigModalDoc && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(26,35,64,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '24px' }}>
          <div style={{ background: '#fff', borderRadius: '16px', padding: '32px', width: '100%', maxWidth: '480px', boxShadow: '0 24px 64px rgba(0,0,0,0.15)' }}>
            <h3 style={{ fontWeight: 800, fontSize: '18px', color: '#1A2340', marginBottom: '4px', marginTop: 0 }}>E-Sign Document</h3>
            <p style={{ fontSize: '13px', color: '#6B7A99', marginBottom: '24px' }}>{mergedComplianceDocs.find(d => d.id === sigModalDoc)?.name}</p>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', background: '#F5F7FA', padding: '4px', borderRadius: '8px' }}>
              {(['type', 'draw'] as const).map(t => (
                <button key={t} onClick={() => setSignatureType(t)} style={{ flex: 1, padding: '8px', borderRadius: '6px', border: 'none', background: signatureType === t ? '#0047CC' : 'transparent', color: signatureType === t ? '#fff' : '#6B7A99', fontWeight: 600, fontSize: '13px', cursor: 'pointer', textTransform: 'capitalize' }}>{t} Signature</button>
              ))}
            </div>
            {signatureType === 'type' ? (
              <input value={typedSig} onChange={e => setTypedSig(e.target.value)} placeholder="Type your full legal name" style={{ width: '100%', height: '60px', border: '1px solid #DDE2EC', borderRadius: '8px', padding: '0 16px', fontSize: '22px', fontFamily: 'Georgia, serif', color: '#002B7F', boxSizing: 'border-box', outline: 'none', fontStyle: 'italic' }} />
            ) : (
              <canvas ref={canvasRef} width={416} height={120} onMouseDown={startDraw} onMouseMove={draw} onMouseUp={stopDraw} onMouseLeave={stopDraw} style={{ border: '1px solid #DDE2EC', borderRadius: '8px', width: '100%', cursor: 'crosshair', display: 'block', background: '#FAFAFA' }} />
            )}
            <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
              <button onClick={() => setSigModalDoc(null)} style={{ flex: 1, height: '42px', border: '1px solid #DDE2EC', borderRadius: '8px', background: 'transparent', color: '#6B7A99', fontWeight: 600, cursor: 'pointer', fontSize: '14px' }}>Cancel</button>
              <button onClick={() => handleSign(sigModalDoc)} style={{ flex: 2, height: '42px', background: '#0047CC', border: 'none', borderRadius: '8px', color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: '14px' }}>Confirm & Sign</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

// ─── Section 7: Profile Detail Section ───────────────────────────────────────
const ProfileDetailSection = ({ user, profile, contracts, onUpdateProfile }: { user: any; profile: any; contracts: any[]; onUpdateProfile?: (updatedProfile: any) => void }) => {
  const vettingStatus = profile?.vettingStatus || 'Pending';
  const vettingStage = profile?.vettingStage || 'Application';
  const vettingScores = profile?.vettingScores || { technical: 0, behavioral: 0, personality: 0, remoteReadiness: 0, workSimulation: 0, communication: 0, experience: 0 };
  const tags = profile?.tags || [];
  const vettingPipeline = Array.isArray(profile?.vettingPipeline) ? profile.vettingPipeline : [];
  const vettingStageIndex = Number(vettingPipeline.find((stage: any) => stage?.status === 'in_progress')?.stageIndex ?? vettingPipeline.find((stage: any) => stage?.status !== 'passed' && stage?.status !== 'skipped')?.stageIndex ?? 0);
  const vettingStageCount = profile?.vettingPipeline?.length || 7;
  const passedStageCount = vettingPipeline.filter((stage: any) => stage?.status === 'passed').length;
  const hasCompletedVetting = passedStageCount >= vettingStageCount || ['Vetted', 'Matched', 'Deployed'].includes(vettingStatus);
  const vettingBadgeText = hasCompletedVetting ? 'VETTED' : `STAGE ${Math.min(vettingStageIndex + 1, vettingStageCount)}`;

  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const headerPhotoInputRef = useRef<HTMLInputElement | null>(null);
  const showToast = (msg: string) => { setToastMsg(msg); setTimeout(() => setToastMsg(null), 3000); };

  // ── Header state ──
  const [isEditingHeader, setIsEditingHeader] = useState(false);
  const [fullName, setFullName] = useState(profile?.name || user?.name || '');
  const [title, setTitle] = useState(profile?.title || '');
  const [bio, setBio] = useState(profile?.bio || '');
  const [tagsInput, setTagsInput] = useState(tags.join(', '));
  const [profilePhotoUrl, setProfilePhotoUrl] = useState(profile?.profilePhotoUrl || profile?.avatar || '');
  const [profilePhotoName, setProfilePhotoName] = useState(profile?.profilePhotoName || '');
  const [profilePhotoSize, setProfilePhotoSize] = useState(profile?.profilePhotoSize || 0);

  const handleHeaderPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      showToast('Profile photo must be an image file.');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      showToast('Profile photo must be smaller than 2MB.');
      return;
    }

    const imageUrl = await new Promise<string | null>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.onload = () => {
          if (img.width < 200 || img.height < 200) {
            showToast('Profile photo must be at least 200x200px.');
            resolve(null);
            return;
          }
          resolve(String(reader.result || ''));
        };
        img.onerror = () => {
          showToast('Could not read profile photo.');
          resolve(null);
        };
        img.src = String(reader.result || '');
      };
      reader.readAsDataURL(file);
    });

    if (!imageUrl) return;

    setProfilePhotoUrl(imageUrl);
    setProfilePhotoName(file.name);
    setProfilePhotoSize(file.size);
    if (onUpdateProfile) {
      onUpdateProfile({
        ...profile,
        profilePhotoUrl: imageUrl,
        profilePhotoName: file.name,
        profilePhotoSize: file.size,
      });
    }
    showToast('Profile photo updated!');
  };

  const handleSaveHeader = () => {
    const updatedTags = tagsInput.split(',').map((t: string) => t.trim()).filter((t: string) => t.length > 0);
    if (onUpdateProfile) onUpdateProfile({ ...profile, name: fullName, title, bio, tags: updatedTags, profilePhotoUrl, profilePhotoName, profilePhotoSize });
    showToast('Profile header updated!');
    setIsEditingHeader(false);
  };

  // ── Personal Information ──
  const [isEditingPersonal, setIsEditingPersonal] = useState(false);
  const [phone, setPhone] = useState(profile?.phone || '');
  const [city, setCity] = useState(profile?.city || '');
  const [country, setCountry] = useState(profile?.country || '');
  const [timezone, setTimezone] = useState(profile?.timezone || '');
  const [dateOfBirth, setDateOfBirth] = useState(profile?.dateOfBirth || '');
  const [gender, setGender] = useState(profile?.gender || '');
  const [nationality, setNationality] = useState(profile?.nationality || '');
  const [nationalId, setNationalId] = useState(profile?.nationalId || '');

  const handleSavePersonal = () => {
    if (onUpdateProfile) onUpdateProfile({ ...profile, phone, city, country, timezone, dateOfBirth, gender, nationality, nationalId });
    showToast('Personal information updated!');
    setIsEditingPersonal(false);
  };

  // ── Professional Details ──
  const [isEditingProfessional, setIsEditingProfessional] = useState(false);
  const [primaryRole, setPrimaryRole] = useState(profile?.title || '');
  const [primaryRoleCategory, setPrimaryRoleCategory] = useState(profile?.primaryRoleCategory || '');
  const [seniorityLevel, setSeniorityLevel] = useState(profile?.seniorityLevel || '');
  const [yearsExperience, setYearsExperience] = useState(profile?.experienceYears ?? 0);
  const [primarySkills, setPrimarySkills] = useState(Array.isArray(profile?.primarySkills) ? profile.primarySkills.join(', ') : (Array.isArray(profile?.skills) ? profile.skills.join(', ') : (profile?.skills || '')));
  const [secondarySkills, setSecondarySkills] = useState(Array.isArray(profile?.secondarySkills) ? profile.secondarySkills.join(', ') : '');
  const [secondarySkillSearch, setSecondarySkillSearch] = useState('');
  const [skillLevels, setSkillLevels] = useState(
    Array.isArray(profile?.skillLevels)
      ? profile.skillLevels.map((item: any) => `${item?.skill || item?.name || ''}:${item?.level || item?.proficiency || ''}`).filter(Boolean).join(', ')
      : ''
  );
  const [employmentPreference, setEmploymentPreference] = useState(profile?.employmentPreference || '');
  const [salaryExpectation, setSalaryExpectation] = useState(profile?.salaryExpectation ?? 0);
  const [currency, setCurrency] = useState(profile?.currency || 'USD');
  const [hourlyMonthly, setHourlyMonthly] = useState(profile?.hourlyMonthly || 'Monthly');
  const [availability, setAvailability] = useState(profile?.availability ?? 0);
  const [linkedIn, setLinkedIn] = useState(profile?.linkedIn || '');
  const [githubUrl, setGithubUrl] = useState(profile?.githubUrl || '');
  const [websiteUrl, setWebsiteUrl] = useState(profile?.websiteUrl || '');
  const [cvUrl, setCvUrl] = useState(profile?.cvUrl || '');
  const [cvName, setCvName] = useState(profile?.cvName || '');
  const selectedSecondarySkills = secondarySkills.split(',').map((s: string) => s.trim()).filter((s: string) => s.length > 0);
  const toggleSecondarySkill = (skill: string) => {
    const next = selectedSecondarySkills.includes(skill)
      ? selectedSecondarySkills.filter((item: string) => item !== skill)
      : [...selectedSecondarySkills, skill];
    setSecondarySkills(next.slice(0, 10).join(', '));
  };

  const handleSaveProfessional = () => {
    const normalizedPrimarySkills = primarySkills.split(',').map((s: string) => s.trim()).filter((s: string) => s.length > 0);
    const normalizedSecondarySkills = secondarySkills.split(',').map((s: string) => s.trim()).filter((s: string) => s.length > 0);
    const normalizedSkillLevels = skillLevels
      .split(',')
      .map((entry: string) => entry.trim())
      .filter((entry: string) => entry.length > 0)
      .map((entry: string) => {
        const [skill, level] = entry.split(':').map((part: string) => part.trim());
        return { skill, level };
      })
      .filter((item: any) => Boolean(item.skill));
    if (onUpdateProfile) onUpdateProfile({
      ...profile,
      title: primaryRole,
      primaryRoleCategory,
      seniorityLevel,
      experienceYears: Number(yearsExperience),
      skills: normalizedPrimarySkills,
      primarySkills: normalizedPrimarySkills,
      secondarySkills: normalizedSecondarySkills,
      skillLevels: normalizedSkillLevels,
      employmentPreference,
      salaryExpectation: Number(salaryExpectation),
      currency,
      hourlyMonthly,
      availability: Number(availability),
      linkedIn,
      githubUrl,
      websiteUrl,
      cvUrl,
      cvName,
    });
    showToast('Professional details updated!');
    setIsEditingProfessional(false);
  };

  // ── Work Setup ──
  const [isEditingSetup, setIsEditingSetup] = useState(false);
  const [internetQuality, setInternetQuality] = useState(profile?.internetQuality || '');
  const [workSetup, setWorkSetup] = useState(profile?.workSetup || '');
  const [devices, setDevices] = useState(profile?.devices || '');
  const [communicationTools, setCommunicationTools] = useState(profile?.communicationTools || '');

  const handleSaveSetup = () => {
    if (onUpdateProfile) onUpdateProfile({ ...profile, internetQuality, workSetup, devices, communicationTools });
    showToast('Work setup updated!');
    setIsEditingSetup(false);
  };

  // ── Work Experience ──
  const [workExperience, setWorkExperience] = useState<any[]>(profile?.workExperience && profile.workExperience.length > 0 ? profile.workExperience : []);
  const [isWorkModalOpen, setIsWorkModalOpen] = useState(false);
  const [isEditingWork, setIsEditingWork] = useState(false);
  const [workForm, setWorkForm] = useState({ id: '', company: '', role: '', startDate: '', endDate: '', location: '', description: '' });

  const handleWorkSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    let updated;
    if (isEditingWork) {
      updated = workExperience.map(w => w.id === workForm.id ? { ...workForm } : w);
      showToast('Work experience updated!');
    } else {
      updated = [...workExperience, { ...workForm, id: `we_${Date.now()}` }];
      showToast('Work experience added!');
    }
    setWorkExperience(updated);
    if (onUpdateProfile) onUpdateProfile({ ...profile, workExperience: updated });
    setIsWorkModalOpen(false);
  };

  // ── Education ──
  const [educationList, setEducationList] = useState<any[]>(profile?.educationList && profile.educationList.length > 0 ? profile.educationList : []);
  const [isEduModalOpen, setIsEduModalOpen] = useState(false);
  const [isEditingEdu, setIsEditingEdu] = useState(false);
  const [eduForm, setEduForm] = useState({ id: '', institution: '', degree: '', startYear: '', endYear: '', grade: '', description: '' });

  const handleEduSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    let updated;
    if (isEditingEdu) {
      updated = educationList.map(e => e.id === eduForm.id ? { ...eduForm } : e);
      showToast('Education entry updated!');
    } else {
      updated = [...educationList, { ...eduForm, id: `edu_${Date.now()}` }];
      showToast('Education entry added!');
    }
    setEducationList(updated);
    if (onUpdateProfile) onUpdateProfile({ ...profile, educationList: updated });
    setIsEduModalOpen(false);
  };

  // ── Languages ──
  const [languagesList, setLanguagesList] = useState<any[]>(profile?.languagesList && profile.languagesList.length > 0 ? profile.languagesList : []);
  const [isLangModalOpen, setIsLangModalOpen] = useState(false);
  const [langForm, setLangForm] = useState({ id: '', language: '', proficiency: '' });

  const handleLangSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const updated = [...languagesList, { ...langForm, id: `lang_${Date.now()}` }];
    setLanguagesList(updated);
    if (onUpdateProfile) onUpdateProfile({ ...profile, languagesList: updated });
    showToast('Language added!');
    setIsLangModalOpen(false);
  };

  // ── Emergency Contact ──
  const [isEditingEmergency, setIsEditingEmergency] = useState(false);
  const [emergencyName, setEmergencyName] = useState(profile?.emergencyContact?.name || '');
  const [emergencyRelation, setEmergencyRelation] = useState(profile?.emergencyContact?.relation || '');
  const [emergencyPhone, setEmergencyPhone] = useState(profile?.emergencyContact?.phone || '');
  const [emergencyEmail, setEmergencyEmail] = useState(profile?.emergencyContact?.email || '');

  const handleSaveEmergency = () => {
    if (onUpdateProfile) onUpdateProfile({ ...profile, emergencyContact: { name: emergencyName, relation: emergencyRelation, phone: emergencyPhone, email: emergencyEmail } });
    showToast('Emergency contact updated!');
    setIsEditingEmergency(false);
  };

  // ── Documents ──
  const [documents, setDocuments] = useState<any[]>(profile?.documents && profile.documents.length > 0 ? profile.documents : []);
  const [isDocModalOpen, setIsDocModalOpen] = useState(false);
  const [newDocName, setNewDocName] = useState('');
  const [newDocCategory, setNewDocCategory] = useState('CV / Resume');

  const handleDocUpload = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDocName.trim()) return;
    const newDoc = { id: `doc_${Date.now()}`, name: newDocName.endsWith('.pdf') ? newDocName : `${newDocName}.pdf`, category: newDocCategory, uploadedAt: new Date().toISOString().split('T')[0], fileSize: '1.4 MB', status: 'Verified' };
    const updated = [...documents, newDoc];
    setDocuments(updated);
    if (onUpdateProfile) onUpdateProfile({ ...profile, documents: updated });
    showToast('Document uploaded and verified!');
    setIsDocModalOpen(false);
    setNewDocName('');
  };

  // ── Projects ──
  const [projects, setProjects] = useState<any[]>(profile?.projects && profile.projects.length > 0 ? profile.projects : []);
  const [isProjModalOpen, setIsProjModalOpen] = useState(false);
  const [isEditingProj, setIsEditingProj] = useState(false);
  const [projForm, setProjForm] = useState({ id: '', title: '', role: '', client: '', duration: '', techStack: '', links: '', description: '' });

  const handleProjectSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    let updated;
    if (isEditingProj) {
      updated = projects.map(p => p.id === projForm.id ? { ...projForm } : p);
      showToast('Project updated!');
    } else {
      updated = [...projects, { ...projForm, id: `proj_${Date.now()}` }];
      showToast('Project added!');
    }
    setProjects(updated);
    if (onUpdateProfile) onUpdateProfile({ ...profile, projects: updated });
    setIsProjModalOpen(false);
  };

  // ── Certifications ──
  const [certsList, setCertsList] = useState<any[]>(profile?.certsList && profile.certsList.length > 0 ? profile.certsList : []);
  const [isCertModalOpen, setIsCertModalOpen] = useState(false);
  const [isEditingCert, setIsEditingCert] = useState(false);
  const [certForm, setCertForm] = useState({ id: '', name: '', issuer: '', issueDate: '', expiryDate: '', verificationLink: '', badgeImage: '' });

  const mapCertificationUploads = (currentProfile: any) => {
    const uploaded = Array.isArray(currentProfile?.certificationFiles)
      ? currentProfile.certificationFiles.map((file: any, index: number) => ({
          id: file?.id || `upload_${index}_${file?.name || 'cert'}`,
          name: file?.name || 'Uploaded certification',
          issuer: 'Uploaded file',
          issueDate: '',
          expiryDate: '',
          verificationLink: file?.url || '',
          badgeImage: '',
          fileSize: file?.size,
          fileType: file?.type,
        }))
      : [];
    const manual = Array.isArray(currentProfile?.certsList) ? currentProfile.certsList : [];
    return [...uploaded, ...manual];
  };

  // Sync state with incoming props to prevent displaying stale/hardcoded data when asynchronous data loads
  useEffect(() => {
    if (profile) {
      if (profile.name) setFullName(profile.name);
      if (profile.title !== undefined) {
        setTitle(profile.title || '');
        setPrimaryRole(profile.title || '');
      }
      if (profile.profilePhotoUrl !== undefined) {
        setProfilePhotoUrl(profile.profilePhotoUrl || '');
      } else if (profile.avatar) {
        setProfilePhotoUrl(profile.avatar);
      }
      if (profile.profilePhotoName !== undefined) setProfilePhotoName(profile.profilePhotoName || '');
      if (profile.profilePhotoSize !== undefined) setProfilePhotoSize(profile.profilePhotoSize || 0);
      if (profile.bio !== undefined) setBio(profile.bio || '');
      if (profile.tags !== undefined) setTagsInput(Array.isArray(profile.tags) ? profile.tags.filter(Boolean).join(', ') : String(profile.tags || ''));
      if (profile.phone) setPhone(profile.phone);
      if (profile.city) setCity(profile.city);
      if (profile.country) setCountry(profile.country);
      if (profile.timezone) setTimezone(profile.timezone);
      if (profile.dateOfBirth) setDateOfBirth(profile.dateOfBirth);
      if (profile.gender) setGender(profile.gender);
      if (profile.nationality) setNationality(profile.nationality);
      if (profile.nationalId) setNationalId(profile.nationalId);
      if (profile.primaryRoleCategory) setPrimaryRoleCategory(profile.primaryRoleCategory);
      if (profile.seniorityLevel) setSeniorityLevel(profile.seniorityLevel);
      if (profile.experienceYears !== undefined) setYearsExperience(profile.experienceYears);
      if (profile.primarySkills || profile.skills) setPrimarySkills(Array.isArray(profile.primarySkills) ? profile.primarySkills.join(', ') : Array.isArray(profile.skills) ? profile.skills.join(', ') : profile.skills);
      if (profile.secondarySkills) setSecondarySkills(Array.isArray(profile.secondarySkills) ? profile.secondarySkills.join(', ') : profile.secondarySkills);
      if (profile.skillLevels) {
        setSkillLevels(Array.isArray(profile.skillLevels)
          ? profile.skillLevels.map((item: any) => `${item?.skill || item?.name || ''}:${item?.level || item?.proficiency || ''}`).filter(Boolean).join(', ')
          : '');
      }
      if (profile.employmentPreference) setEmploymentPreference(profile.employmentPreference);
      if (profile.salaryExpectation !== undefined) setSalaryExpectation(profile.salaryExpectation);
      if (profile.currency) setCurrency(profile.currency);
      if (profile.hourlyMonthly) setHourlyMonthly(profile.hourlyMonthly);
      if (profile.availability !== undefined) setAvailability(profile.availability);
      if (profile.linkedIn) setLinkedIn(profile.linkedIn);
      if (profile.githubUrl) setGithubUrl(profile.githubUrl);
      if (profile.websiteUrl) setWebsiteUrl(profile.websiteUrl);
      if (profile.cvUrl) setCvUrl(profile.cvUrl);
      if (profile.cvName) setCvName(profile.cvName);
      if (profile.internetQuality) setInternetQuality(profile.internetQuality);
      if (profile.workSetup) setWorkSetup(profile.workSetup);
      if (profile.devices) setDevices(profile.devices);
      if (profile.communicationTools) setCommunicationTools(profile.communicationTools);
      if (profile.workExperience && profile.workExperience.length > 0) setWorkExperience(profile.workExperience);
      if (profile.educationList && profile.educationList.length > 0) setEducationList(profile.educationList);
      if (profile.languagesList && profile.languagesList.length > 0) setLanguagesList(profile.languagesList);
      if (profile.emergencyContact) {
        if (profile.emergencyContact.name) setEmergencyName(profile.emergencyContact.name);
        if (profile.emergencyContact.relation) setEmergencyRelation(profile.emergencyContact.relation);
        if (profile.emergencyContact.phone) setEmergencyPhone(profile.emergencyContact.phone);
        if (profile.emergencyContact.email) setEmergencyEmail(profile.emergencyContact.email);
      }
      if (profile.documents && profile.documents.length > 0) setDocuments(profile.documents);
      if (profile.projects && profile.projects.length > 0) setProjects(profile.projects);
      setCertsList(mapCertificationUploads(profile));
    }
  }, [profile]);

  const handleCertSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    let updated;
    if (isEditingCert) {
      updated = certsList.map(c => c.id === certForm.id ? { ...certForm } : c);
      showToast('Certification updated!');
    } else {
      updated = [...certsList, { ...certForm, id: `cert_${Date.now()}` }];
      showToast('Certification added!');
    }
    setCertsList(updated);
    if (onUpdateProfile) onUpdateProfile({ ...profile, certsList: updated });
    setIsCertModalOpen(false);
  };

  // ── Styles ──
  const inputStyle: React.CSSProperties = { padding: '10px 14px', borderRadius: '8px', border: '1px solid #DDE2EC', background: '#FFFFFF', fontSize: '13px', color: '#1A2340', width: '100%', boxSizing: 'border-box' };
  const textareaStyle: React.CSSProperties = { ...inputStyle, minHeight: '80px', resize: 'vertical' as const };
  const labelStyle: React.CSSProperties = { fontSize: '10px', fontWeight: 800, color: '#6B7A99', textTransform: 'uppercase' as const, marginBottom: '6px', display: 'block', letterSpacing: '0.05em' };
  const editBtnStyle: React.CSSProperties = { background: '#EEF3FF', border: 'none', color: '#0047CC', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', fontWeight: 700, padding: '5px 12px', borderRadius: '6px' };
  const cancelBtnStyle: React.CSSProperties = { background: 'transparent', border: '1px solid #DDE2EC', color: '#6B7A99', borderRadius: '8px', padding: '8px 16px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' };
  const saveBtnStyle: React.CSSProperties = { background: '#0047CC', color: '#FFF', border: 'none', borderRadius: '8px', padding: '8px 20px', fontSize: '13px', fontWeight: 700, cursor: 'pointer' };

  const InfoGrid = ({ items }: { items: { label: string; value: string }[] }) => (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '20px' }}>
      {items.map((item, i) => (
        <div key={i}>
          <span style={labelStyle}>{item.label}</span>
          <span style={{ fontSize: '14px', fontWeight: 600, color: '#1A2340', display: 'block' }}>{item.value || '\u2014'}</span>
        </div>
      ))}
    </div>
  );

  const SectionCard = ({ title, onAdd, onEdit, children }: { title: string; onAdd?: () => void; onEdit?: () => void; children: React.ReactNode }) => (
    <Card>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', paddingBottom: '14px', borderBottom: '1px solid #F1F5F9' }}>
        <h3 style={{ fontSize: '15px', fontWeight: 800, color: '#1A2340', margin: 0 }}>{title}</h3>
        <div style={{ display: 'flex', gap: '8px' }}>
          {onEdit && <button onClick={onEdit} style={editBtnStyle}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>Edit</button>}
          {onAdd && <button onClick={onAdd} style={{ ...editBtnStyle, background: '#EEF3FF' }}>+ Add</button>}
        </div>
      </div>
      {children}
    </Card>
  );

  const Modal = ({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) => (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div style={{ background: '#fff', borderRadius: '16px', width: '100%', maxWidth: '560px', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 25px 60px rgba(0,0,0,0.2)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '24px 28px', borderBottom: '1px solid #F1F5F9' }}>
          <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 800, color: '#1A2340' }}>{title}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#6B7A99' }}>\u2715</button>
        </div>
        <div style={{ padding: '24px 28px' }}>{children}</div>
      </div>
    </div>
  );

  const proficiencyColors: Record<string, string> = { 'Native / Bilingual': '#0047CC', 'Native': '#0047CC', 'Professional Working Proficiency': '#00A389', 'Full Professional Proficiency': '#6366F1', 'Elementary': '#F59E0B', 'Limited Working Proficiency': '#F59E0B' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px', fontFamily: 'var(--font-display, Inter, sans-serif)' }}>

      {/* Toast */}
      {toastMsg && (
        <div style={{ position: 'fixed', top: '24px', right: '24px', background: '#1E293B', color: '#FFFFFF', padding: '14px 22px', borderRadius: '12px', zIndex: 9999, fontSize: '13px', fontWeight: 600, boxShadow: '0 10px 30px rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
          {toastMsg}
        </div>
      )}

      {/* Profile Header */}
      <Card style={{ padding: '36px', background: 'linear-gradient(135deg, #0F172A 0%, #1E3A5F 50%, #002B7F 100%)', color: '#FFFFFF', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: '-60px', right: '-60px', width: '220px', height: '220px', borderRadius: '50%', background: 'rgba(255,255,255,0.03)' }} />
        <div style={{ position: 'absolute', bottom: '-40px', left: '30%', width: '160px', height: '160px', borderRadius: '50%', background: 'rgba(0,71,204,0.15)' }} />
        {!isEditingHeader ? (
          <div className="profile-header-row" style={{ display: 'flex', alignItems: 'center', gap: '28px', position: 'relative' }}>
            <div className="profile-avatar" style={{ width: '96px', height: '96px', borderRadius: '50%', overflow: 'hidden', background: 'linear-gradient(135deg, #0047CC, #38BDF8)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '36px', fontWeight: 900, flexShrink: 0, border: '3px solid rgba(255,255,255,0.2)' }}>
              {profilePhotoUrl ? (
                <img src={profilePhotoUrl} alt={`${fullName} profile`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                fullName[0]?.toUpperCase()
              )}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px' }}>
                <div>
                  <h1 style={{ fontSize: '26px', fontWeight: 900, margin: '0 0 4px 0', letterSpacing: '-0.5px', color: '#FFFFFF' }}>{fullName}</h1>
                  <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.65)', margin: '0 0 4px 0', fontWeight: 600 }}>{title}</p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'rgba(255,255,255,0.5)' }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>
                    {city}, {country}
                  </div>
                </div>
                <button onClick={() => setIsEditingHeader(true)} style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', fontWeight: 700, padding: '5px 12px', borderRadius: '6px' }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                  Edit
                </button>
              </div>
              {bio.trim() ? (
                <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.7)', margin: '14px 0 16px 0', lineHeight: 1.6, maxWidth: '600px' }}>{bio}</p>
              ) : null}
              {Array.isArray(profile?.tags) && profile.tags.filter(Boolean).length > 0 ? (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {profile.tags.filter(Boolean).map((tag: string, i: number) => (
                    <span key={i} style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '20px', padding: '4px 12px', fontSize: '11px', fontWeight: 600, color: 'rgba(255,255,255,0.85)' }}>{tag}</span>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        ) : (
          <div style={{ position: 'relative' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 800, margin: '0 0 20px 0', color: '#fff' }}>Edit Profile Header</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
              <div><label style={{ ...labelStyle, color: 'rgba(255,255,255,0.5)' }}>Full Name</label><input value={fullName} onChange={e => setFullName(e.target.value)} style={{ ...inputStyle, background: 'rgba(255,255,255,0.08)', color: '#FFF', border: '1px solid rgba(255,255,255,0.15)' }} /></div>
              <div><label style={{ ...labelStyle, color: 'rgba(255,255,255,0.5)' }}>Job Title</label><input value={title} onChange={e => setTitle(e.target.value)} style={{ ...inputStyle, background: 'rgba(255,255,255,0.08)', color: '#FFF', border: '1px solid rgba(255,255,255,0.15)' }} /></div>
            </div>
            <div style={{ marginBottom: '14px' }}>
              <label style={{ ...labelStyle, color: 'rgba(255,255,255,0.5)' }}>Profile Photo</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                <div style={{ width: '72px', height: '72px', borderRadius: '50%', overflow: 'hidden', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)' }}>
                  {profilePhotoUrl ? (
                    <img src={profilePhotoUrl} alt={`${fullName} profile`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : null}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <button
                    type="button"
                    onClick={() => headerPhotoInputRef.current?.click()}
                    style={{ ...editBtnStyle, background: 'rgba(255,255,255,0.1)', color: '#fff', border: '1px solid rgba(255,255,255,0.2)' }}
                  >
                    Upload photo
                  </button>
                  {profilePhotoName ? (
                    <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.65)' }}>
                      {profilePhotoName} · {Math.round(profilePhotoSize / 1024)} KB
                    </span>
                  ) : (
                    <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.45)' }}>
                      PNG, JPG, or WEBP. Minimum 200x200px.
                    </span>
                  )}
                </div>
                <input
                  ref={headerPhotoInputRef}
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={handleHeaderPhotoUpload}
                />
              </div>
            </div>
            <div style={{ marginBottom: '14px' }}><label style={{ ...labelStyle, color: 'rgba(255,255,255,0.5)' }}>Bio / Summary</label><textarea value={bio} onChange={e => setBio(e.target.value)} style={{ ...textareaStyle, background: 'rgba(255,255,255,0.08)', color: '#FFF', border: '1px solid rgba(255,255,255,0.15)' }} /></div>
            <div style={{ marginBottom: '20px' }}><label style={{ ...labelStyle, color: 'rgba(255,255,255,0.5)' }}>Skills / Tags (comma-separated)</label><input value={tagsInput} onChange={e => setTagsInput(e.target.value)} style={{ ...inputStyle, background: 'rgba(255,255,255,0.08)', color: '#FFF', border: '1px solid rgba(255,255,255,0.15)' }} /></div>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button onClick={() => setIsEditingHeader(false)} style={{ ...cancelBtnStyle, background: 'rgba(255,255,255,0.1)', color: '#fff', border: '1px solid rgba(255,255,255,0.2)' }}>Cancel</button>
              <button onClick={handleSaveHeader} style={saveBtnStyle}>Save Changes</button>
            </div>
          </div>
        )}
      </Card>

      {/* Two-column layout */}
      <div className="db-grid-split-320" style={{ gap: '28px', alignItems: 'start' }}>

        {/* LEFT COLUMN */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>

          {/* Personal Information */}
          <SectionCard title="Personal Information" onEdit={() => setIsEditingPersonal(true)}>
            {!isEditingPersonal ? (
              <InfoGrid items={[
                { label: 'Full Name', value: fullName },
                { label: 'Email Address', value: profile?.email || user?.email || 'chidi.anya@kongila.dev' },
                { label: 'Phone Number', value: phone },
                { label: 'Date of Birth', value: dateOfBirth },
                { label: 'Gender', value: gender },
                { label: 'Nationality', value: nationality },
                { label: 'City', value: city },
                { label: 'Country', value: country },
                { label: 'Timezone', value: timezone },
                { label: 'National ID (NIN)', value: nationalId },
              ]} />
            ) : (
              <div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
                  <div><label style={labelStyle}>Phone Number</label><input value={phone} onChange={e => setPhone(e.target.value)} style={inputStyle} /></div>
                  <div><label style={labelStyle}>Date of Birth</label><input type="date" value={dateOfBirth} onChange={e => setDateOfBirth(e.target.value)} style={inputStyle} /></div>
                  <div><label style={labelStyle}>Gender</label><select value={gender} onChange={e => setGender(e.target.value)} style={inputStyle}><option>Male</option><option>Female</option><option>Prefer not to say</option></select></div>
                  <div><label style={labelStyle}>Nationality</label><input value={nationality} onChange={e => setNationality(e.target.value)} style={inputStyle} /></div>
                  <div><label style={labelStyle}>City</label><input value={city} onChange={e => setCity(e.target.value)} style={inputStyle} /></div>
                  <div><label style={labelStyle}>Country</label><input value={country} onChange={e => setCountry(e.target.value)} style={inputStyle} /></div>
                  <div><label style={labelStyle}>Timezone</label><input value={timezone} onChange={e => setTimezone(e.target.value)} style={inputStyle} /></div>
                  <div><label style={labelStyle}>National ID (NIN)</label><input value={nationalId} onChange={e => setNationalId(e.target.value)} style={inputStyle} /></div>
                </div>
                <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '16px', borderTop: '1px solid #F1F5F9', paddingTop: '16px' }}>
                  <button onClick={() => setIsEditingPersonal(false)} style={cancelBtnStyle}>Cancel</button>
                  <button onClick={handleSavePersonal} style={saveBtnStyle}>Save Changes</button>
                </div>
              </div>
            )}
          </SectionCard>

          {/* Professional Details */}
          <SectionCard title="Professional Details" onEdit={() => setIsEditingProfessional(true)}>
            {!isEditingProfessional ? (
              <div>
                <InfoGrid items={[
                  { label: 'Primary Role', value: primaryRole },
                  { label: 'Role Category', value: primaryRoleCategory || 'Not provided' },
                  { label: 'Seniority Level', value: seniorityLevel },
                  { label: 'Years of Experience', value: `${yearsExperience} years` },
                  { label: 'Employment Preference', value: employmentPreference },
                  { label: 'Work Hours Format', value: hourlyMonthly || 'Not provided' },
                  { label: 'Salary Expectation', value: `${currency} ${Number(salaryExpectation).toLocaleString()} / ${hourlyMonthly}` },
                  { label: 'Availability', value: `${availability}%` },
                  { label: 'LinkedIn', value: linkedIn || profile?.linkedinUrl || 'Not provided' },
                  { label: 'GitHub', value: githubUrl || profile?.githubUrl || 'Not provided' },
                  { label: 'Website', value: websiteUrl || profile?.websiteUrl || 'Not provided' },
                  { label: 'CV / Resume', value: cvName || cvUrl || profile?.cvName || profile?.cvUrl || 'Not provided' },
                ]} />
                <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid #F1F5F9' }}>
                  <span style={labelStyle}>Primary Skills</span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '8px' }}>
                    {(primarySkills || '').split(',').map((s: string, i: number) => (
                      <span key={i} style={{ background: '#EEF3FF', color: '#0047CC', border: '1px solid rgba(0,71,204,0.15)', borderRadius: '20px', padding: '4px 12px', fontSize: '12px', fontWeight: 600 }}>{s.trim()}</span>
                    ))}
                  </div>
                </div>
                {secondarySkills && (
                  <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #F1F5F9' }}>
                    <span style={labelStyle}>Secondary Skills</span>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '8px' }}>
                      {secondarySkills.split(',').map((s: string, i: number) => (
                        <span key={i} style={{ background: '#F8FAFC', color: '#475569', border: '1px solid #E2E8F0', borderRadius: '20px', padding: '4px 12px', fontSize: '12px', fontWeight: 600 }}>{s.trim()}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
                  <div><label style={labelStyle}>Primary Role</label><input value={primaryRole} onChange={e => setPrimaryRole(e.target.value)} style={inputStyle} /></div>
                  <div><label style={labelStyle}>Role Category</label><input value={primaryRoleCategory} onChange={e => setPrimaryRoleCategory(e.target.value)} style={inputStyle} /></div>
                  <div><label style={labelStyle}>Seniority Level</label><select value={seniorityLevel} onChange={e => setSeniorityLevel(e.target.value)} style={inputStyle}><option>Junior</option><option>Mid-Level</option><option>Senior</option><option>Lead</option><option>Principal</option><option>Executive</option></select></div>
                  <div><label style={labelStyle}>Years of Experience</label><input type="number" value={yearsExperience} onChange={e => setYearsExperience(Number(e.target.value))} style={inputStyle} /></div>
                  <div><label style={labelStyle}>Employment Preference</label><select value={employmentPreference} onChange={e => setEmploymentPreference(e.target.value)} style={inputStyle}><option>Full Time</option><option>Part Time</option><option>Contract</option><option>Freelance</option></select></div>
                  <div><label style={labelStyle}>Salary Expectation</label><input type="number" value={salaryExpectation} onChange={e => setSalaryExpectation(Number(e.target.value))} style={inputStyle} /></div>
                  <div><label style={labelStyle}>Currency</label><select value={currency} onChange={e => setCurrency(e.target.value)} style={inputStyle}><option>USD</option><option>EUR</option><option>GBP</option><option>NGN</option></select></div>
                  <div><label style={labelStyle}>Hourly / Monthly</label><select value={hourlyMonthly} onChange={e => setHourlyMonthly(e.target.value)} style={inputStyle}><option>Monthly</option><option>Hourly</option></select></div>
                  <div><label style={labelStyle}>Availability (% / week)</label><input type="number" min="0" max="100" value={availability} onChange={e => setAvailability(Number(e.target.value))} style={inputStyle} /></div>
                  <div style={{ gridColumn: '1/-1' }}><label style={labelStyle}>Primary Skills (comma-separated)</label><input value={primarySkills} onChange={e => setPrimarySkills(e.target.value)} style={inputStyle} /></div>
                  <div style={{ gridColumn: '1/-1' }}>
                    <label style={labelStyle}>Secondary Skills</label>
                    <div style={{ border: '1px solid #DDE2EC', borderRadius: '12px', padding: '12px', background: '#FAFBFF' }}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
                        {selectedSecondarySkills.map((skill: string) => (
                          <button
                            key={skill}
                            type="button"
                            onClick={() => toggleSecondarySkill(skill)}
                            style={{
                              border: '1px solid rgba(0,71,204,0.18)',
                              background: '#EEF3FF',
                              color: '#0047CC',
                              borderRadius: '999px',
                              padding: '6px 10px',
                              fontSize: '12px',
                              fontWeight: 700,
                              cursor: 'pointer'
                            }}
                          >
                            {skill} ×
                          </button>
                        ))}
                        {selectedSecondarySkills.length === 0 && (
                          <span style={{ fontSize: '12px', color: '#6B7A99' }}>Pick up to 10 soft skills.</span>
                        )}
                      </div>
                      <input
                        value={secondarySkillSearch}
                        onChange={e => setSecondarySkillSearch(e.target.value)}
                        placeholder="Search or add a soft skill"
                        style={inputStyle}
                      />
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '12px' }}>
                        {SECONDARY_SKILL_OPTIONS
                          .filter(skill => skill.toLowerCase().includes(secondarySkillSearch.toLowerCase()) && !selectedSecondarySkills.includes(skill))
                          .slice(0, 18)
                          .map(skill => (
                            <button
                              key={skill}
                              type="button"
                              onClick={() => {
                                toggleSecondarySkill(skill);
                                setSecondarySkillSearch('');
                              }}
                              style={{
                                border: '1px solid #DDE2EC',
                                background: '#fff',
                                color: '#1A2340',
                                borderRadius: '999px',
                                padding: '6px 10px',
                                fontSize: '12px',
                                fontWeight: 600,
                                cursor: 'pointer'
                              }}
                            >
                              + {skill}
                            </button>
                          ))}
                        {secondarySkillSearch.trim() && !SECONDARY_SKILL_OPTIONS.some(skill => skill.toLowerCase() === secondarySkillSearch.trim().toLowerCase()) && !selectedSecondarySkills.includes(secondarySkillSearch.trim()) && selectedSecondarySkills.length < 10 && (
                          <button
                            type="button"
                            onClick={() => {
                              toggleSecondarySkill(secondarySkillSearch.trim());
                              setSecondarySkillSearch('');
                            }}
                            style={{
                              border: '1px solid rgba(0,71,204,0.25)',
                              background: 'rgba(0,71,204,0.06)',
                              color: '#0047CC',
                              borderRadius: '999px',
                              padding: '6px 10px',
                              fontSize: '12px',
                              fontWeight: 700,
                              cursor: 'pointer'
                            }}
                          >
                            Add "{secondarySkillSearch.trim()}"
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                  <div style={{ gridColumn: '1/-1' }}><label style={labelStyle}>Skill Levels (format: Skill:Level, comma-separated)</label><input value={skillLevels} onChange={e => setSkillLevels(e.target.value)} style={inputStyle} /></div>
                  <div style={{ gridColumn: '1/-1' }}><label style={labelStyle}>LinkedIn URL</label><input value={linkedIn} onChange={e => setLinkedIn(e.target.value)} style={inputStyle} /></div>
                  <div style={{ gridColumn: '1/-1' }}><label style={labelStyle}>GitHub URL</label><input value={githubUrl} onChange={e => setGithubUrl(e.target.value)} style={inputStyle} /></div>
                  <div style={{ gridColumn: '1/-1' }}><label style={labelStyle}>Website URL</label><input value={websiteUrl} onChange={e => setWebsiteUrl(e.target.value)} style={inputStyle} /></div>
                  <div style={{ gridColumn: '1/-1' }}><label style={labelStyle}>CV / Resume URL</label><input value={cvUrl} onChange={e => setCvUrl(e.target.value)} style={inputStyle} /></div>
                  <div style={{ gridColumn: '1/-1' }}><label style={labelStyle}>CV / Resume Name</label><input value={cvName} onChange={e => setCvName(e.target.value)} style={inputStyle} /></div>
                </div>
                <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', borderTop: '1px solid #F1F5F9', paddingTop: '16px' }}>
                  <button onClick={() => setIsEditingProfessional(false)} style={cancelBtnStyle}>Cancel</button>
                  <button onClick={handleSaveProfessional} style={saveBtnStyle}>Save Changes</button>
                </div>
              </div>
            )}
          </SectionCard>

          <SectionCard title="Onboarding Preferences">
            <InfoGrid items={[
              { label: 'Preferred Engagement', value: profile?.preferredEngagementType || profile?.employmentPreference || 'Not provided' },
              { label: 'Work Hours Format', value: profile?.hourlyMonthly || profile?.preferredWorkHours || 'Not provided' },
              { label: 'Project Type', value: profile?.preferredProjectType || 'Not provided' },
              { label: 'Notice Period', value: profile?.noticePeriod || profile?.availableStartDate || 'Not provided' },
              { label: 'Salary Expectation (USD)', value: profile?.salaryExpectationUsd != null ? `$${Number(profile.salaryExpectationUsd).toLocaleString()}` : profile?.salaryExpectation != null ? `$${Number(profile.salaryExpectation).toLocaleString()}` : 'Not provided' },
            ]} />
          </SectionCard>

          {/* Remote Work Setup */}
          <SectionCard title="Remote Work Setup" onEdit={() => setIsEditingSetup(true)}>
            {!isEditingSetup ? (
              <InfoGrid items={[
                { label: 'Internet Quality', value: internetQuality },
                { label: 'Work Setup', value: workSetup },
                { label: 'Devices', value: devices },
                { label: 'Communication Tools', value: communicationTools },
              ]} />
            ) : (
              <div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '14px' }}>
                  <div><label style={labelStyle}>Internet Quality</label><input value={internetQuality} onChange={e => setInternetQuality(e.target.value)} style={inputStyle} /></div>
                  <div><label style={labelStyle}>Work Setup Description</label><input value={workSetup} onChange={e => setWorkSetup(e.target.value)} style={inputStyle} /></div>
                  <div><label style={labelStyle}>Devices</label><input value={devices} onChange={e => setDevices(e.target.value)} style={inputStyle} /></div>
                  <div><label style={labelStyle}>Communication Tools</label><input value={communicationTools} onChange={e => setCommunicationTools(e.target.value)} style={inputStyle} /></div>
                </div>
                <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', borderTop: '1px solid #F1F5F9', paddingTop: '16px' }}>
                  <button onClick={() => setIsEditingSetup(false)} style={cancelBtnStyle}>Cancel</button>
                  <button onClick={handleSaveSetup} style={saveBtnStyle}>Save Changes</button>
                </div>
              </div>
            )}
          </SectionCard>

          {/* Work Experience */}
          <SectionCard title="Work Experience" onAdd={() => { setIsEditingWork(false); setWorkForm({ id: '', company: '', role: '', startDate: '', endDate: '', location: '', description: '' }); setIsWorkModalOpen(true); }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {workExperience.map((we) => (
                <div key={we.id} style={{ borderLeft: '3px solid #0047CC', paddingLeft: '18px', paddingBottom: '16px', borderBottom: '1px solid #F1F5F9' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ fontSize: '15px', fontWeight: 800, color: '#1A2340' }}>{we.role}</div>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: '#0047CC', marginTop: '2px' }}>{we.company}</div>
                      <div style={{ fontSize: '12px', color: '#6B7A99', marginTop: '4px', display: 'flex', gap: '12px' }}>
                        <span>{we.startDate} \u2014 {we.endDate}</span>
                        {we.location && <span>\u00b7 {we.location}</span>}
                      </div>
                    </div>
                    <button onClick={() => { setWorkForm(we); setIsEditingWork(true); setIsWorkModalOpen(true); }} style={{ ...editBtnStyle, fontSize: '11px', padding: '3px 8px' }}>Edit</button>
                  </div>
                  {we.description && <p style={{ fontSize: '13px', color: '#4E5D78', lineHeight: 1.6, marginTop: '10px', marginBottom: 0 }}>{we.description}</p>}
                </div>
              ))}
            </div>
          </SectionCard>

          {/* Education */}
          <SectionCard title="Education" onAdd={() => { setIsEditingEdu(false); setEduForm({ id: '', institution: '', degree: '', startYear: '', endYear: '', grade: '', description: '' }); setIsEduModalOpen(true); }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {educationList.map((edu) => (
                <div key={edu.id} style={{ borderLeft: '3px solid #6366F1', paddingLeft: '18px', paddingBottom: '16px', borderBottom: '1px solid #F1F5F9' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ fontSize: '15px', fontWeight: 800, color: '#1A2340' }}>{edu.degree}</div>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: '#6366F1', marginTop: '2px' }}>{edu.institution}</div>
                      <div style={{ fontSize: '12px', color: '#6B7A99', marginTop: '4px', display: 'flex', gap: '12px' }}>
                        <span>{edu.startYear} \u2014 {edu.endYear}</span>
                        {edu.grade && <span>\u00b7 {edu.grade}</span>}
                      </div>
                    </div>
                    <button onClick={() => { setEduForm(edu); setIsEditingEdu(true); setIsEduModalOpen(true); }} style={{ ...editBtnStyle, fontSize: '11px', padding: '3px 8px' }}>Edit</button>
                  </div>
                  {edu.description && <p style={{ fontSize: '13px', color: '#4E5D78', lineHeight: 1.6, marginTop: '10px', marginBottom: 0 }}>{edu.description}</p>}
                </div>
              ))}
            </div>
          </SectionCard>

          {/* Languages */}
          <SectionCard title="Languages" onAdd={() => { setLangForm({ id: '', language: '', proficiency: '' }); setIsLangModalOpen(true); }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {languagesList.map((lang) => {
                const c = proficiencyColors[lang.proficiency] || '#6B7A99';
                return (
                  <div key={lang.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: '#FAFBFF', border: '1px solid #E8EDFF', borderRadius: '10px' }}>
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                      <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: `${c}15`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" /></svg>
                      </div>
                      <span style={{ fontSize: '14px', fontWeight: 700, color: '#1A2340' }}>{lang.language}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ background: `${c}15`, color: c, border: `1px solid ${c}30`, borderRadius: '20px', padding: '3px 10px', fontSize: '11px', fontWeight: 700 }}>{lang.proficiency}</span>
                      <button onClick={() => { const updated = languagesList.filter(l => l.id !== lang.id); setLanguagesList(updated); if (onUpdateProfile) onUpdateProfile({ ...profile, languagesList: updated }); }} style={{ background: 'none', border: 'none', color: '#EF4444', cursor: 'pointer', fontSize: '14px', padding: '2px 6px' }}>\u2715</button>
                    </div>
                  </div>
                );
              })}
            </div>
          </SectionCard>

          {/* Emergency Contact */}
          <SectionCard title="Emergency Contact" onEdit={() => setIsEditingEmergency(true)}>
            {!isEditingEmergency ? (
              <InfoGrid items={[
                { label: 'Full Name', value: emergencyName },
                { label: 'Relationship', value: emergencyRelation },
                { label: 'Phone Number', value: emergencyPhone },
                { label: 'Email Address', value: emergencyEmail },
              ]} />
            ) : (
              <div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
                  <div><label style={labelStyle}>Full Name</label><input value={emergencyName} onChange={e => setEmergencyName(e.target.value)} style={inputStyle} /></div>
                  <div><label style={labelStyle}>Relationship</label><input value={emergencyRelation} onChange={e => setEmergencyRelation(e.target.value)} style={inputStyle} /></div>
                  <div><label style={labelStyle}>Phone Number</label><input value={emergencyPhone} onChange={e => setEmergencyPhone(e.target.value)} style={inputStyle} /></div>
                  <div><label style={labelStyle}>Email Address</label><input value={emergencyEmail} onChange={e => setEmergencyEmail(e.target.value)} style={inputStyle} /></div>
                </div>
                <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', borderTop: '1px solid #F1F5F9', paddingTop: '16px' }}>
                  <button onClick={() => setIsEditingEmergency(false)} style={cancelBtnStyle}>Cancel</button>
                  <button onClick={handleSaveEmergency} style={saveBtnStyle}>Save Changes</button>
                </div>
              </div>
            )}
          </SectionCard>

          {/* Personal Document Vault */}
          <SectionCard title="Personal Document Vault" onAdd={() => { setNewDocName(''); setNewDocCategory('CV / Resume'); setIsDocModalOpen(true); }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {documents.map(doc => (
                <div key={doc.id} style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '14px 16px', background: '#FAFBFF', border: '1px solid #E8EDFF', borderRadius: '10px' }}>
                  <div style={{ width: '38px', height: '38px', borderRadius: '8px', background: '#EEF3FF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0047CC" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: '#1A2340', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{doc.name}</div>
                    <div style={{ fontSize: '11px', color: '#6B7A99', marginTop: '2px' }}>{doc.category} \u00b7 {doc.fileSize} \u00b7 {doc.uploadedAt}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
                    <span style={{ background: '#E6FFF6', color: '#00A389', border: '1px solid rgba(0,163,137,0.2)', borderRadius: '20px', padding: '3px 10px', fontSize: '10px', fontWeight: 800 }}>VERIFIED</span>
                    <button onClick={() => { const updated = documents.filter(d => d.id !== doc.id); setDocuments(updated); if (onUpdateProfile) onUpdateProfile({ ...profile, documents: updated }); showToast('Document removed.'); }} style={{ background: 'none', border: 'none', color: '#EF4444', cursor: 'pointer', fontSize: '14px', padding: '2px 6px' }}>\u2715</button>
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>

          {/* Project Experience */}
          <SectionCard title="Project Experience" onAdd={() => { setIsEditingProj(false); setProjForm({ id: '', title: '', role: '', client: '', duration: '', techStack: '', links: '', description: '' }); setIsProjModalOpen(true); }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {projects.map(proj => (
                <div key={proj.id} style={{ border: '1px solid #E2E8F0', borderRadius: '12px', padding: '20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                    <div>
                      <div style={{ fontSize: '15px', fontWeight: 800, color: '#1A2340' }}>{proj.title}</div>
                      <div style={{ fontSize: '12px', color: '#6B7A99', marginTop: '4px', display: 'flex', gap: '10px' }}>
                        <span style={{ fontWeight: 600, color: '#0047CC' }}>{proj.role}</span>
                        {proj.client && <span>\u00b7 {proj.client}</span>}
                        {proj.duration && <span>\u00b7 {proj.duration}</span>}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button onClick={() => { setProjForm(proj); setIsEditingProj(true); setIsProjModalOpen(true); }} style={{ ...editBtnStyle, fontSize: '11px', padding: '3px 8px' }}>Edit</button>
                      <button onClick={() => { const updated = projects.filter(p => p.id !== proj.id); setProjects(updated); if (onUpdateProfile) onUpdateProfile({ ...profile, projects: updated }); showToast('Project removed.'); }} style={{ background: '#FFF1F1', color: '#EF4444', border: 'none', borderRadius: '6px', padding: '3px 8px', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}>Remove</button>
                    </div>
                  </div>
                  <p style={{ fontSize: '13px', color: '#4E5D78', lineHeight: 1.6, margin: '0 0 12px 0' }}>{proj.description}</p>
                  {proj.techStack && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '10px' }}>
                      {proj.techStack.split(',').map((t: string, i: number) => (
                        <span key={i} style={{ background: '#F1F5F9', border: '1px solid #E2E8F0', borderRadius: '4px', padding: '3px 8px', fontSize: '11px', fontWeight: 600, color: '#334155' }}>{t.trim()}</span>
                      ))}
                    </div>
                  )}
                  {proj.links && <a href={proj.links} target="_blank" rel="noopener noreferrer" style={{ fontSize: '12px', color: '#0047CC', fontWeight: 600, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></svg>
                    {proj.links}
                  </a>}
                </div>
              ))}
            </div>
          </SectionCard>

          {/* Professional Certifications */}
          <SectionCard title="Professional Certifications" onAdd={() => { setIsEditingCert(false); setCertForm({ id: '', name: '', issuer: '', issueDate: '', expiryDate: '', verificationLink: '', badgeImage: '' }); setIsCertModalOpen(true); }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {Array.isArray(profile?.certificationFiles) && profile.certificationFiles.length > 0 && profile.certificationFiles.map((file: any, index: number) => (
                <div key={file?.id || file?.url || index} style={{ display: 'flex', gap: '16px', padding: '16px', border: '1px solid #E2E8F0', borderRadius: '12px', alignItems: 'center' }}>
                  <div style={{ width: '48px', height: '48px', borderRadius: '10px', background: 'linear-gradient(135deg, #EEF3FF, #E0E7FF)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#0047CC" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '14px', fontWeight: 800, color: '#1A2340', marginBottom: '2px' }}>{file?.name || 'Uploaded certification'}</div>
                    <div style={{ fontSize: '12px', color: '#6B7A99', marginBottom: '4px' }}>Uploaded file{file?.size ? ` · ${Math.round(file.size / 1024)} KB` : ''}</div>
                    {file?.url && <a href={file.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: '11px', color: '#0047CC', fontWeight: 600, textDecoration: 'none' }}>Open file →</a>}
                  </div>
                </div>
              ))}
              {certsList.map(cert => (
                <div key={cert.id} style={{ display: 'flex', gap: '16px', padding: '16px', border: '1px solid #E2E8F0', borderRadius: '12px', alignItems: 'center' }}>
                  <div style={{ width: '48px', height: '48px', borderRadius: '10px', background: 'linear-gradient(135deg, #EEF3FF, #E0E7FF)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#0047CC" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" /><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" /><path d="M4 22h16" /><path d="M10 14.66V17c0 .55-.45 1-1 1H4v2h16v-2h-5c-.55 0-1-.45-1-1v-2.34" /></svg>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '14px', fontWeight: 800, color: '#1A2340', marginBottom: '2px' }}>{cert.name}</div>
                    {cert.issuer && <div style={{ fontSize: '12px', color: '#6B7A99', marginBottom: '4px' }}>{cert.issuer}{cert.issueDate ? ` \u00b7 Issued ${cert.issueDate}` : ''}{cert.expiryDate ? ` \u00b7 Expires ${cert.expiryDate}` : ''}</div>}
                    {cert.verificationLink && <a href={cert.verificationLink} target="_blank" rel="noopener noreferrer" style={{ fontSize: '11px', color: '#0047CC', fontWeight: 600, textDecoration: 'none' }}>Verify Credential \u2192</a>}
                  </div>
                  <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                    <button onClick={() => { setCertForm(cert); setIsEditingCert(true); setIsCertModalOpen(true); }} style={{ ...editBtnStyle, fontSize: '11px', padding: '3px 8px' }}>Edit</button>
                    <button onClick={() => { const updated = certsList.filter(c => c.id !== cert.id); setCertsList(updated); if (onUpdateProfile) onUpdateProfile({ ...profile, certsList: updated }); showToast('Certification removed.'); }} style={{ background: '#FFF1F1', color: '#EF4444', border: 'none', borderRadius: '6px', padding: '3px 8px', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}>Remove</button>
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>

        </div>

        {/* RIGHT COLUMN */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>

          {/* Vetting Framework */}
          <Card style={{ background: 'linear-gradient(135deg, #1A2340, #0F172A)', color: '#FFFFFF' }}>
            <h3 style={{ fontSize: '13px', fontWeight: 800, margin: '0 0 20px 0', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'rgba(255,255,255,0.6)' }}>Vetting Framework</h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '20px' }}>
              <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: hasCompletedVetting ? 'linear-gradient(135deg, #10B981, #38BDF8)' : 'linear-gradient(135deg, #334155, #64748B)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 900, textAlign: 'center', lineHeight: 1.1, flexShrink: 0, border: '3px solid rgba(255,255,255,0.15)', padding: '8px' }}>
                {vettingBadgeText}
              </div>
              <div>
                <div style={{ fontSize: '20px', fontWeight: 900 }}>{vettingStatus}</div>
                <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.55)', marginTop: '4px' }}>Stage: {vettingStage}</div>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {Object.entries(vettingScores).map(([key, val]: [string, any]) => (
                <div key={key}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: 'rgba(255,255,255,0.6)', textTransform: 'capitalize' }}>{key}</span>
                    <span style={{ fontSize: '11px', fontWeight: 800, color: '#38BDF8' }}>{val}/100</span>
                  </div>
                  <div style={{ height: '6px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px' }}>
                    <div style={{ width: `${val}%`, height: '100%', background: 'linear-gradient(90deg, #0047CC, #38BDF8)', borderRadius: '3px' }} />
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Assigned Manager */}
          <Card>
            <h3 style={{ fontSize: '13px', fontWeight: 800, color: '#1A2340', margin: '0 0 16px 0', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Assigned Manager</h3>
            {profile?.assignedManager?.name ? (
              <>
                <div style={{ display: 'flex', gap: '14px', alignItems: 'center', marginBottom: '16px' }}>
                  <div style={{ width: '52px', height: '52px', borderRadius: '50%', background: 'linear-gradient(135deg, #6366F1, #8B5CF6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', fontWeight: 900, color: '#fff', flexShrink: 0 }}>
                    {profile.assignedManager.name[0]}
                  </div>
                  <div>
                    <div style={{ fontSize: '15px', fontWeight: 800, color: '#1A2340' }}>{profile.assignedManager.name}</div>
                    <div style={{ fontSize: '12px', color: '#6B7A99' }}>{profile.assignedManager.role || 'Talent Success Manager'}</div>
                    <div style={{ fontSize: '11px', color: '#10B981', marginTop: '3px', fontWeight: 600 }}>● Online — Avg. response &lt;2h</div>
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12px', color: '#6B7A99', borderTop: '1px solid #F1F5F9', paddingTop: '14px' }}>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" /></svg>
                    {profile.assignedManager.email}
                  </div>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.56 1.18h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.73a16 16 0 0 0 5.99 6l.92-.93a2 2 0 0 1 2.11-.45c.906.338 1.85.573 2.81.7A2 2 0 0 1 21.73 16z" /></svg>
                    {profile.assignedManager.phone || 'N/A'}
                  </div>
                </div>
              </>
            ) : (
              <div style={{ fontSize: '13px', color: '#6B7A99', textAlign: 'center', padding: '16px 0', fontStyle: 'italic' }}>
                No Success Manager assigned yet. Complete screening to trigger mapping.
              </div>
            )}
          </Card>

          {/* Quick Actions */}
          <Card>
            <h3 style={{ fontSize: '13px', fontWeight: 800, color: '#1A2340', margin: '0 0 14px 0', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Quick Actions</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {[
                { label: 'Download Full Profile PDF', icon: '\u2b07', color: '#0047CC' },
                { label: 'Share Profile Link', icon: '\ud83d\udd17', color: '#6366F1' },
                { label: 'Request Profile Review', icon: '\ud83d\udc41', color: '#00A389' },
              ].map((action) => (
                <button key={action.label} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', background: '#F8FAFC', border: '1px solid #E8EDFF', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: 600, color: '#1A2340', textAlign: 'left', width: '100%' }}>
                  <span style={{ color: action.color }}>{action.icon}</span>
                  {action.label}
                </button>
              ))}
            </div>
          </Card>

        </div>
      </div>

      {/* ── Modals ── */}
      {isWorkModalOpen && (
        <Modal title={isEditingWork ? 'Edit Work Experience' : 'Add Work Experience'} onClose={() => setIsWorkModalOpen(false)}>
          <form onSubmit={handleWorkSubmit}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
              <div style={{ gridColumn: '1/-1' }}><label style={labelStyle}>Company / Organisation</label><input required value={workForm.company} onChange={e => setWorkForm(f => ({ ...f, company: e.target.value }))} style={inputStyle} placeholder="e.g. Horizon Fintech Ltd" /></div>
              <div style={{ gridColumn: '1/-1' }}><label style={labelStyle}>Job Title / Role</label><input required value={workForm.role} onChange={e => setWorkForm(f => ({ ...f, role: e.target.value }))} style={inputStyle} placeholder="e.g. Senior Software Engineer" /></div>
              <div><label style={labelStyle}>Start Date</label><input value={workForm.startDate} onChange={e => setWorkForm(f => ({ ...f, startDate: e.target.value }))} style={inputStyle} placeholder="e.g. 2022-01" /></div>
              <div><label style={labelStyle}>End Date</label><input value={workForm.endDate} onChange={e => setWorkForm(f => ({ ...f, endDate: e.target.value }))} style={inputStyle} placeholder="e.g. Present" /></div>
              <div style={{ gridColumn: '1/-1' }}><label style={labelStyle}>Location</label><input value={workForm.location} onChange={e => setWorkForm(f => ({ ...f, location: e.target.value }))} style={inputStyle} placeholder="e.g. Lagos, Nigeria (Remote)" /></div>
              <div style={{ gridColumn: '1/-1' }}><label style={labelStyle}>Description</label><textarea value={workForm.description} onChange={e => setWorkForm(f => ({ ...f, description: e.target.value }))} style={textareaStyle} placeholder="Describe your responsibilities and achievements..." /></div>
            </div>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', borderTop: '1px solid #F1F5F9', paddingTop: '16px' }}>
              <button type="button" onClick={() => setIsWorkModalOpen(false)} style={cancelBtnStyle}>Cancel</button>
              <button type="submit" style={saveBtnStyle}>{isEditingWork ? 'Update' : 'Add'} Experience</button>
            </div>
          </form>
        </Modal>
      )}
      {isEduModalOpen && (
        <Modal title={isEditingEdu ? 'Edit Education' : 'Add Education'} onClose={() => setIsEduModalOpen(false)}>
          <form onSubmit={handleEduSubmit}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
              <div style={{ gridColumn: '1/-1' }}><label style={labelStyle}>Institution</label><input required value={eduForm.institution} onChange={e => setEduForm(f => ({ ...f, institution: e.target.value }))} style={inputStyle} placeholder="e.g. University of Lagos" /></div>
              <div style={{ gridColumn: '1/-1' }}><label style={labelStyle}>Degree / Qualification</label><input required value={eduForm.degree} onChange={e => setEduForm(f => ({ ...f, degree: e.target.value }))} style={inputStyle} placeholder="e.g. B.Sc. Computer Science" /></div>
              <div><label style={labelStyle}>Start Year</label><input value={eduForm.startYear} onChange={e => setEduForm(f => ({ ...f, startYear: e.target.value }))} style={inputStyle} placeholder="e.g. 2009" /></div>
              <div><label style={labelStyle}>End Year</label><input value={eduForm.endYear} onChange={e => setEduForm(f => ({ ...f, endYear: e.target.value }))} style={inputStyle} placeholder="e.g. 2013" /></div>
              <div style={{ gridColumn: '1/-1' }}><label style={labelStyle}>Grade / Classification</label><input value={eduForm.grade} onChange={e => setEduForm(f => ({ ...f, grade: e.target.value }))} style={inputStyle} placeholder="e.g. First Class Honours" /></div>
              <div style={{ gridColumn: '1/-1' }}><label style={labelStyle}>Description (optional)</label><textarea value={eduForm.description} onChange={e => setEduForm(f => ({ ...f, description: e.target.value }))} style={textareaStyle} placeholder="Relevant coursework, thesis, activities..." /></div>
            </div>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', borderTop: '1px solid #F1F5F9', paddingTop: '16px' }}>
              <button type="button" onClick={() => setIsEduModalOpen(false)} style={cancelBtnStyle}>Cancel</button>
              <button type="submit" style={saveBtnStyle}>{isEditingEdu ? 'Update' : 'Add'} Education</button>
            </div>
          </form>
        </Modal>
      )}
      {isLangModalOpen && (
        <Modal title="Add Language" onClose={() => setIsLangModalOpen(false)}>
          <form onSubmit={handleLangSubmit}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '14px' }}>
              <div><label style={labelStyle}>Language</label><input required value={langForm.language} onChange={e => setLangForm(f => ({ ...f, language: e.target.value }))} style={inputStyle} placeholder="e.g. French" /></div>
              <div><label style={labelStyle}>Proficiency Level</label>
                <select required value={langForm.proficiency} onChange={e => setLangForm(f => ({ ...f, proficiency: e.target.value }))} style={inputStyle}>
                  <option value="">Select proficiency...</option>
                  <option>Native / Bilingual</option><option>Full Professional Proficiency</option>
                  <option>Professional Working Proficiency</option><option>Limited Working Proficiency</option><option>Elementary</option>
                </select>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', borderTop: '1px solid #F1F5F9', paddingTop: '16px' }}>
              <button type="button" onClick={() => setIsLangModalOpen(false)} style={cancelBtnStyle}>Cancel</button>
              <button type="submit" style={saveBtnStyle}>Add Language</button>
            </div>
          </form>
        </Modal>
      )}
      {isDocModalOpen && (
        <Modal title="Upload Document" onClose={() => setIsDocModalOpen(false)}>
          <form onSubmit={handleDocUpload}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '14px' }}>
              <div><label style={labelStyle}>Document Name</label><input required value={newDocName} onChange={e => setNewDocName(e.target.value)} style={inputStyle} placeholder="e.g. Work_Reference_Letter_2026.pdf" /></div>
              <div><label style={labelStyle}>Document Category</label>
                <select value={newDocCategory} onChange={e => setNewDocCategory(e.target.value)} style={inputStyle}>
                  <option>CV / Resume</option><option>Identity / Government ID</option><option>Degree Certificate</option>
                  <option>Professional Reference</option><option>Legal / NDA</option><option>Portfolio</option><option>Other</option>
                </select>
              </div>
              <div style={{ border: '2px dashed #DDE2EC', borderRadius: '10px', padding: '30px', textAlign: 'center', cursor: 'pointer', background: '#FAFBFF' }}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#0047CC" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ margin: '0 auto 8px', display: 'block' }}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>
                <p style={{ fontSize: '13px', color: '#6B7A99', margin: 0 }}>Click to upload or drag and drop</p>
                <p style={{ fontSize: '11px', color: '#9CA3AF', margin: '4px 0 0 0' }}>PDF, JPG, PNG up to 10MB</p>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', borderTop: '1px solid #F1F5F9', paddingTop: '16px' }}>
              <button type="button" onClick={() => setIsDocModalOpen(false)} style={cancelBtnStyle}>Cancel</button>
              <button type="submit" style={saveBtnStyle}>Upload Document</button>
            </div>
          </form>
        </Modal>
      )}
      {isProjModalOpen && (
        <Modal title={isEditingProj ? 'Edit Project' : 'Add Project'} onClose={() => setIsProjModalOpen(false)}>
          <form onSubmit={handleProjectSubmit}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
              <div style={{ gridColumn: '1/-1' }}><label style={labelStyle}>Project Title</label><input required value={projForm.title} onChange={e => setProjForm(f => ({ ...f, title: e.target.value }))} style={inputStyle} placeholder="e.g. Payment Gateway Rebuild" /></div>
              <div><label style={labelStyle}>Your Role</label><input value={projForm.role} onChange={e => setProjForm(f => ({ ...f, role: e.target.value }))} style={inputStyle} placeholder="e.g. Lead Architect" /></div>
              <div><label style={labelStyle}>Client / Organisation</label><input value={projForm.client} onChange={e => setProjForm(f => ({ ...f, client: e.target.value }))} style={inputStyle} placeholder="e.g. Horizon Fintech" /></div>
              <div><label style={labelStyle}>Duration</label><input value={projForm.duration} onChange={e => setProjForm(f => ({ ...f, duration: e.target.value }))} style={inputStyle} placeholder="e.g. 4 Months" /></div>
              <div><label style={labelStyle}>Tech Stack</label><input value={projForm.techStack} onChange={e => setProjForm(f => ({ ...f, techStack: e.target.value }))} style={inputStyle} placeholder="e.g. React, Node.js, AWS" /></div>
              <div style={{ gridColumn: '1/-1' }}><label style={labelStyle}>Project Link (optional)</label><input type="url" value={projForm.links} onChange={e => setProjForm(f => ({ ...f, links: e.target.value }))} style={inputStyle} placeholder="https://github.com/..." /></div>
              <div style={{ gridColumn: '1/-1' }}><label style={labelStyle}>Description</label><textarea required value={projForm.description} onChange={e => setProjForm(f => ({ ...f, description: e.target.value }))} style={textareaStyle} placeholder="Describe what you built, your impact, key results..." /></div>
            </div>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', borderTop: '1px solid #F1F5F9', paddingTop: '16px' }}>
              <button type="button" onClick={() => setIsProjModalOpen(false)} style={cancelBtnStyle}>Cancel</button>
              <button type="submit" style={saveBtnStyle}>{isEditingProj ? 'Update' : 'Add'} Project</button>
            </div>
          </form>
        </Modal>
      )}
      {isCertModalOpen && (
        <Modal title={isEditingCert ? 'Edit Certification' : 'Add Certification'} onClose={() => setIsCertModalOpen(false)}>
          <form onSubmit={handleCertSubmit}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
              <div style={{ gridColumn: '1/-1' }}><label style={labelStyle}>Certification Name</label><input required value={certForm.name} onChange={e => setCertForm(f => ({ ...f, name: e.target.value }))} style={inputStyle} placeholder="e.g. AWS Certified Solutions Architect" /></div>
              <div style={{ gridColumn: '1/-1' }}><label style={labelStyle}>Issuing Organisation</label><input value={certForm.issuer} onChange={e => setCertForm(f => ({ ...f, issuer: e.target.value }))} style={inputStyle} placeholder="e.g. Amazon Web Services" /></div>
              <div><label style={labelStyle}>Issue Date</label><input value={certForm.issueDate} onChange={e => setCertForm(f => ({ ...f, issueDate: e.target.value }))} style={inputStyle} placeholder="e.g. 2024-03" /></div>
              <div><label style={labelStyle}>Expiry Date</label><input value={certForm.expiryDate} onChange={e => setCertForm(f => ({ ...f, expiryDate: e.target.value }))} style={inputStyle} placeholder="e.g. 2027-03 or N/A" /></div>
              <div style={{ gridColumn: '1/-1' }}><label style={labelStyle}>Verification Link (optional)</label><input type="url" value={certForm.verificationLink} onChange={e => setCertForm(f => ({ ...f, verificationLink: e.target.value }))} style={inputStyle} placeholder="https://..." /></div>
              <div style={{ gridColumn: '1/-1' }}><label style={labelStyle}>Badge Image URL (optional)</label><input value={certForm.badgeImage} onChange={e => setCertForm(f => ({ ...f, badgeImage: e.target.value }))} style={inputStyle} placeholder="https://..." /></div>
            </div>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', borderTop: '1px solid #F1F5F9', paddingTop: '16px' }}>
              <button type="button" onClick={() => setIsCertModalOpen(false)} style={cancelBtnStyle}>Cancel</button>
              <button type="submit" style={saveBtnStyle}>{isEditingCert ? 'Update' : 'Add'} Certification</button>
            </div>
          </form>
        </Modal>
      )}

    </div>
  );
};

// ─── Section 7.5: Settings Section ───────────────────────────────────────────
const SettingsSection = ({ profile, onUpdateProfile }: { profile: any; onUpdateProfile?: (p: any) => void }) => {
  const [activeTab, setActiveTab] = useState<'account' | 'notifications' | 'privacy'>('account');
  const [email, setEmail] = useState(profile?.user?.email || 'chidi.anya@example.com');
  const [phone, setPhone] = useState(profile?.phone || '+234 809 123 4567');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  useEffect(() => {
    if (profile) {
      if (profile.user?.email) setEmail(profile.user.email);
      if (profile.phone) setPhone(profile.phone);
    }
  }, [profile]);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword && newPassword.length < 12) {
      alert('Password must be at least 12 characters long.');
      return;
    }
    
    if (onUpdateProfile) {
      onUpdateProfile({
        ...profile,
        phone,
        user: profile.user ? { ...profile.user, email } : undefined
      });
    }

    setToastMsg('Settings updated successfully!');
    setCurrentPassword('');
    setNewPassword('');
    
    setTimeout(() => {
      setToastMsg(null);
    }, 4000);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div>
        <h2 style={{ fontSize: '24px', fontWeight: 800, color: '#1A2340', marginBottom: '6px' }}>Settings</h2>
        <p style={{ fontSize: '14px', color: '#6B7A99', margin: 0 }}>
          Manage your account preferences and security protocols.
        </p>
      </div>

      {toastMsg && (
        <div style={{
          background: '#00A3A0', color: '#FFFFFF', padding: '12px 24px',
          borderRadius: '8px', fontSize: '14px', fontWeight: 600,
          boxShadow: '0 4px 12px rgba(0,163,160,0.2)', transition: 'all 0.3s'
        }}>
          ✓ {toastMsg}
        </div>
      )}

      <div style={{ display: 'flex', gap: '32px', flexWrap: 'wrap' }}>
        
        {/* Left Side Tabs */}
        <div style={{ width: '220px', display: 'flex', flexDirection: 'column', gap: '4px', flexShrink: 0 }}>
          {[
            { id: 'account', label: 'Account', icon: '👤' },
            { id: 'notifications', label: 'Notifications', icon: '🔔' },
            { id: 'privacy', label: 'Privacy & Security', icon: '🔒' }
          ].map(tab => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '10px',
                  padding: '12px 16px', borderRadius: '8px', border: 'none',
                  background: isActive ? '#EEF3FF' : 'transparent',
                  color: isActive ? '#0047CC' : '#6B7A99',
                  fontWeight: isActive ? 700 : 500,
                  fontSize: '13px', cursor: 'pointer', textAlign: 'left',
                  transition: 'all 0.15s', width: '100%'
                }}
              >
                <span style={{ fontSize: '15px' }}>{tab.icon}</span>
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Right Side Form Panel */}
        <div style={{ flex: 1, minWidth: '320px' }}>
          <Card style={{ padding: '32px' }}>
            
            {activeTab === 'account' && (
              <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                <div>
                  <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#1A2340', margin: '0 0 6px 0' }}>Account Information</h3>
                  <p style={{ fontSize: '13px', color: '#6B7A99', margin: 0 }}>Update your personal credentials and contact information.</p>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px' }}>
                  <div>
                    <label style={{ fontSize: '11px', fontWeight: 700, color: '#6B7A99', textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>
                      Email Address
                    </label>
                    <input
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      style={{
                        width: '100%', height: '42px', border: '1px solid #DDE2EC', borderRadius: '8px',
                        padding: '0 12px', fontSize: '14px', outline: 'none', color: '#1A2340',
                        boxSizing: 'border-box'
                      }}
                      required
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: '11px', fontWeight: 700, color: '#6B7A99', textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>
                      Phone Number
                    </label>
                    <input
                      type="text"
                      value={phone}
                      onChange={e => setPhone(e.target.value)}
                      style={{
                        width: '100%', height: '42px', border: '1px solid #DDE2EC', borderRadius: '8px',
                        padding: '0 12px', fontSize: '14px', outline: 'none', color: '#1A2340',
                        boxSizing: 'border-box'
                      }}
                      required
                    />
                  </div>
                </div>

                <hr style={{ border: 'none', borderTop: '1px solid #F5F7FA', margin: '8px 0' }} />

                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  <div>
                    <h4 style={{ fontSize: '14px', fontWeight: 700, color: '#1A2340', margin: '0 0 16px 0' }}>Password Management</h4>
                    <label style={{ fontSize: '11px', fontWeight: 700, color: '#6B7A99', textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>
                      Current Password
                    </label>
                    <input
                      type="password"
                      value={currentPassword}
                      onChange={e => setCurrentPassword(e.target.value)}
                      placeholder="••••••••••••"
                      style={{
                        width: '100%', height: '42px', border: '1px solid #DDE2EC', borderRadius: '8px',
                        padding: '0 12px', fontSize: '14px', outline: 'none', color: '#1A2340',
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: '11px', fontWeight: 700, color: '#6B7A99', textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>
                      New Password
                    </label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={e => setNewPassword(e.target.value)}
                      placeholder="Enter new password"
                      style={{
                        width: '100%', height: '42px', border: '1px solid #DDE2EC', borderRadius: '8px',
                        padding: '0 12px', fontSize: '14px', outline: 'none', color: '#1A2340',
                        boxSizing: 'border-box'
                      }}
                    />
                    <span style={{ fontSize: '12px', color: '#6B7A99', display: 'block', marginTop: '6px' }}>
                      Password must be at least 12 characters and include a symbol.
                    </span>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '12px' }}>
                  <button
                    type="button"
                    onClick={() => {
                      setEmail(profile?.user?.email || 'chidi.anya@example.com');
                      setPhone(profile?.phone || '+234 809 123 4567');
                      setCurrentPassword('');
                      setNewPassword('');
                    }}
                    style={{
                      background: 'transparent', border: '1px solid #DDE2EC', borderRadius: '8px',
                      padding: '10px 20px', fontSize: '13px', fontWeight: 600, color: '#6B7A99',
                      cursor: 'pointer'
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    style={{
                      background: '#0047CC', border: 'none', borderRadius: '8px',
                      padding: '10px 24px', fontSize: '13px', fontWeight: 700, color: '#FFFFFF',
                      cursor: 'pointer'
                    }}
                  >
                    Save Changes
                  </button>
                </div>
              </form>
            )}

            {activeTab === 'notifications' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div>
                  <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#1A2340', margin: '0 0 6px 0' }}>Notification Settings</h3>
                  <p style={{ fontSize: '13px', color: '#6B7A99', margin: 0 }}>Configure how and when you receive portal communications.</p>
                </div>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '8px' }}>
                  {[
                    { id: 'notif_payouts', label: 'Payout Alerts', desc: 'Get notified as soon as a payout is approved and processed.' },
                    { id: 'notif_matches', label: 'Project Matches', desc: 'Receive instant notifications when clients shortlist your profile.' },
                    { id: 'notif_compliance', label: 'Compliance & Legal Reminders', desc: 'Alerts when a new agreement requires your digital signature.' },
                    { id: 'notif_messages', label: 'Chat Messages', desc: 'Direct message notifications from clients or administrators.' }
                  ].map(item => (
                    <div key={item.id} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                      <input type="checkbox" defaultChecked id={item.id} style={{ marginTop: '4px', cursor: 'pointer' }} />
                      <label htmlFor={item.id} style={{ cursor: 'pointer' }}>
                        <div style={{ fontSize: '14px', fontWeight: 600, color: '#1A2340' }}>{item.label}</div>
                        <div style={{ fontSize: '12px', color: '#6B7A99', marginTop: '2px' }}>{item.desc}</div>
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'privacy' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div>
                  <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#1A2340', margin: '0 0 6px 0' }}>Privacy & Security</h3>
                  <p style={{ fontSize: '13px', color: '#6B7A99', margin: 0 }}>Manage access security options and login keys.</p>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginTop: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px', background: '#F5F7FA', borderRadius: '12px' }}>
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: 600, color: '#1A2340' }}>Two-Factor Authentication (2FA)</div>
                      <div style={{ fontSize: '12px', color: '#6B7A99', marginTop: '2px' }}>Add an extra layer of protection to your account login.</div>
                    </div>
                    <button style={{ background: '#0047CC', color: '#FFFFFF', border: 'none', borderRadius: '8px', padding: '8px 16px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>
                      Enable 2FA
                    </button>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px', background: '#F5F7FA', borderRadius: '12px' }}>
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: 600, color: '#1A2340' }}>Authorized Sessions</div>
                      <div style={{ fontSize: '12px', color: '#6B7A99', marginTop: '2px' }}>Check and log out of other devices using your credentials.</div>
                    </div>
                    <button style={{ background: 'transparent', border: '1px solid #DDE2EC', borderRadius: '8px', padding: '8px 16px', fontSize: '12px', fontWeight: 600, color: '#1A2340', cursor: 'pointer' }}>
                      View Devices
                    </button>
                  </div>
                </div>
              </div>
            )}

          </Card>
        </div>

      </div>
    </div>
  );
};

// ─── Section 8: Engagement Layer ─────────────────────────────────────────────
const EngagementSection = () => {
  const team = [
    { role: 'Account Officer', name: 'Priya Nair', email: 'priya.nair@kongila.io', avatar: 'P', desc: 'Your primary point of contact for all deployment queries.' },
    { role: 'Team Lead', name: 'Marcus Osei', email: 'marcus.osei@kongila.io', avatar: 'M', desc: 'Oversees your engagement and performance reviews.' },
    { role: 'Support', name: 'Kongila Support', email: 'support@kongila.io', avatar: 'S', desc: 'Raise tickets for technical or operational issues.' },
  ];

  return (
    <div>
      <SectionHeader title="Engagement Layer" subtitle="Your dedicated Kongila team and support contacts." />
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {team.map((member, i) => (
          <Card key={i} style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            <div style={{
              width: '56px', height: '56px', borderRadius: '50%', flexShrink: 0,
              background: 'linear-gradient(135deg, #002B7F, #0047CC)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#fff', fontWeight: 800, fontSize: '20px'
            }}>{member.avatar}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#0047CC', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '2px' }}>{member.role}</div>
              <div style={{ fontWeight: 700, fontSize: '15px', color: '#1A2340' }}>{member.name}</div>
              <div style={{ fontSize: '12px', color: '#6B7A99', marginTop: '2px' }}>{member.desc}</div>
            </div>
            <a href={`mailto:${member.email}`} style={{
              background: '#F5F7FA', border: '1px solid #DDE2EC', borderRadius: '8px',
              padding: '10px 16px', fontSize: '12px', fontWeight: 600, color: '#0047CC',
              textDecoration: 'none', flexShrink: 0
            }}>Contact</a>
          </Card>
        ))}
      </div>
    </div>
  );
};

// ─── Section 9: Onboarding Experience ────────────────────────────────────────
const OnboardingSection = ({ profile }: { profile: any }) => {
  const vettingStatus = profile?.vettingStatus || 'Under Review';
  const progressMap: Record<string, number> = { 'Under Review': 30, 'Pending': 50, 'Vetted': 70, 'Matched': 90, 'Deployed': 100 };
  const progress = progressMap[vettingStatus] ?? 30;

  const steps = [
    { label: 'Account Created', done: true },
    { label: 'Profile Completed', done: progress >= 30 },
    { label: 'Documents Uploaded', done: progress >= 50 },
    { label: 'Vetting Cleared', done: progress >= 70 },
    { label: 'Matched to Client', done: progress >= 90 },
    { label: 'Fully Deployed', done: progress >= 100 },
  ];

  return (
    <div>
      <SectionHeader title="Onboarding Experience" subtitle="Your journey from signup to full deployment." />
      <div className="db-grid-2" style={{ maxWidth: '100%', overflowX: 'hidden' }}>
        {/* Welcome video placeholder */}
        <Card style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{
            background: 'linear-gradient(135deg, #1E1B4B 0%, #312E81 100%)',
            height: '200px', display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: '16px'
          }}>
            <div style={{
              width: '64px', height: '64px', borderRadius: '50%',
              background: 'rgba(255,255,255,0.1)', backdropFilter: 'blur(12px)',
              border: '1px solid rgba(255,255,255,0.2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', transition: 'all 0.2s ease', boxShadow: '0 8px 32px rgba(0,0,0,0.2)'
            }}>
              <div style={{
                width: '0', height: '0', borderStyle: 'solid',
                borderWidth: '10px 0 10px 16px', borderColor: 'transparent transparent transparent #ffffff',
                marginLeft: '4px'
              }}></div>
            </div>
            <span style={{ color: '#FFFFFF', fontSize: '15px', fontWeight: 600, letterSpacing: '0.02em' }}>Welcome to Kongila</span>
          </div>
          <div style={{ padding: '16px 20px' }}>
            <div style={{ fontWeight: 700, fontSize: '14px', color: '#1A2340' }}>Welcome Video</div>
            <div style={{ fontSize: '12px', color: '#6B7A99', marginTop: '4px' }}>A message from our team to you.</div>
          </div>
        </Card>

        {/* Progress tracker */}
        <Card>
          <h3 style={{ fontWeight: 700, fontSize: '15px', color: '#1A2340', marginBottom: '8px' }}>Onboarding Progress</h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
            <div style={{ flex: 1, height: '8px', background: '#F5F7FA', borderRadius: '4px', overflow: 'hidden' }}>
              <div style={{ width: `${progress}%`, height: '100%', background: 'linear-gradient(90deg, #0047CC, #3D7FFF)', borderRadius: '4px', transition: 'width 0.5s ease' }} />
            </div>
            <span style={{ fontWeight: 800, fontSize: '16px', color: '#0047CC', flexShrink: 0 }}>{progress}%</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {steps.map((step, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  width: '22px', height: '22px', borderRadius: '50%', flexShrink: 0,
                  background: step.done ? '#0047CC' : '#F5F7FA',
                  border: step.done ? '2px solid #0047CC' : '2px solid #DDE2EC',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: step.done ? '#fff' : '#DDE2EC', fontSize: '11px', fontWeight: 700
                }}>{step.done ? '✓' : i + 1}</div>
                <span style={{ fontSize: '13px', color: step.done ? '#1A2340' : '#6B7A99', fontWeight: step.done ? 600 : 400 }}>{step.label}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
};

// ─── Section 6: Support Center ────────────────────────────────────────────────
const SupportSection = ({ profile, onUpdateProfile }: { profile: any; onUpdateProfile?: (updatedProfile: any) => void }) => {
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [newTicketModalOpen, setNewTicketModalOpen] = useState(false);
  const [chatAlertOpen, setChatAlertOpen] = useState(false);

  // New Ticket Form State
  const [newTicketSubject, setNewTicketSubject] = useState('');
  const [newTicketCategory, setNewTicketCategory] = useState('Payment Issues');
  const [newTicketPriority, setNewTicketPriority] = useState('High');
  const [newTicketMessage, setNewTicketMessage] = useState('');

  // Reply Form State
  const [replyText, setReplyText] = useState('');

  // Default tickets to load if none exist on the profile
  const tickets = profile?.supportTickets || [];

  // Selected ticket computed detail
  const activeTicket = tickets.find((t: any) => t.id === selectedTicketId);

  // Filtered tickets based on search query
  const filteredTickets = tickets.filter((t: any) => 
    t.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // New ticket creation handler
  const handleCreateTicket = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTicketSubject.trim() || !newTicketMessage.trim()) return;

    const newId = `TK-${Math.floor(10000 + Math.random() * 90000)}`;
    const newTicket = {
      id: newId,
      subject: newTicketSubject,
      category: newTicketCategory,
      status: 'Open',
      priority: newTicketPriority,
      createdAt: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      lastActivity: 'Just now',
      assignedAgent: { name: 'Sarah Kong', role: 'Global Support Lead', avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=80' },
      messages: [
        {
          id: `msg_${Date.now()}`,
          sender: { name: profile?.name || 'Talent User', role: 'Talent', isSupport: false },
          text: newTicketMessage,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]
    };

    const updatedProfile = {
      ...profile,
      supportTickets: [newTicket, ...tickets]
    };

    if (onUpdateProfile) {
      onUpdateProfile(updatedProfile);
    }

    // Reset forms
    setNewTicketSubject('');
    setNewTicketMessage('');
    setNewTicketModalOpen(false);

    // Seed mock automatic support agent response 1.5 seconds later
    setTimeout(() => {
      const dbTickets = updatedProfile.supportTickets || [];
      const updatedTickets = dbTickets.map((t: any) => {
        if (t.id === newId) {
          return {
            ...t,
            status: 'In Progress',
            lastActivity: '1 sec ago',
            messages: [
              ...t.messages,
              {
                id: `msg_reply_${Date.now()}`,
                sender: { name: 'Sarah Kong', role: 'Global Support Lead', isSupport: true, avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=80' },
                text: `Hi ${profile?.name ? profile.name.split(' ')[0] : 'there'}, thanks for submitting your ticket. I have reviewed your query regarding "${newTicketSubject}" and am escalating it to our engineering group. I will update you shortly!`,
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
              }
            ]
          };
        }
        return t;
      });

      if (onUpdateProfile) {
        onUpdateProfile({
          ...profile,
          supportTickets: updatedTickets
        });
      }
    }, 1500);
  };

  // Reply submission handler
  const handleSendReply = (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim() || !activeTicket) return;

    const newReply = {
      id: `msg_${Date.now()}`,
      sender: { name: profile?.name || 'Talent User', role: 'Talent', isSupport: false },
      text: replyText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    const updatedTickets = tickets.map((t: any) => {
      if (t.id === activeTicket.id) {
        return {
          ...t,
          lastActivity: 'Just now',
          messages: [...t.messages, newReply]
        };
      }
      return t;
    });

    if (onUpdateProfile) {
      onUpdateProfile({
        ...profile,
        supportTickets: updatedTickets
      });
    }

    setReplyText('');

    // Trigger secondary mock agent reply 2 seconds later
    setTimeout(() => {
      const dbTickets = updatedTickets || [];
      const latestTickets = dbTickets.map((t: any) => {
        if (t.id === activeTicket.id) {
          return {
            ...t,
            lastActivity: '1 sec ago',
            messages: [
              ...t.messages,
              {
                id: `msg_agent_reply_${Date.now()}`,
                sender: { name: 'Sarah Kong', role: 'Global Support Lead', isSupport: true, avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=80' },
                text: 'Got it. I am verifying this in our system database now. I will post back as soon as I have a status code update.',
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
              }
            ]
          };
        }
        return t;
      });

      if (onUpdateProfile) {
        onUpdateProfile({
          ...profile,
          supportTickets: latestTickets
        });
      }
    }, 2000);
  };

  // Resolve ticket helper
  const handleResolveTicket = () => {
    if (!activeTicket) return;
    const updatedTickets = tickets.map((t: any) => 
      t.id === activeTicket.id ? { ...t, status: 'Resolved', lastActivity: 'Resolved' } : t
    );

    if (onUpdateProfile) {
      onUpdateProfile({
        ...profile,
        supportTickets: updatedTickets
      });
    }
  };

  // Escalate ticket helper
  const handleEscalateTicket = () => {
    if (!activeTicket) return;
    const updatedTickets = tickets.map((t: any) => 
      t.id === activeTicket.id ? { ...t, priority: 'Urgent', lastActivity: 'Escalated' } : t
    );

    if (onUpdateProfile) {
      onUpdateProfile({
        ...profile,
        supportTickets: updatedTickets
      });
    }
  };

  // Return component UI based on mode
  if (selectedTicketId && activeTicket) {
    // ─── TICKET DETAILS SCREEN (SCREEN B) ───
    let statusBg = '#FFF3C4';
    let statusColor = '#D97706';
    if (activeTicket.status === 'Resolved') {
      statusBg = '#E6FFFA';
      statusColor = '#00A389';
    } else if (activeTicket.status === 'Open') {
      statusBg = '#FEE2E2';
      statusColor = '#EF4444';
    }

    return (
      <div className="db-grid-split-300" style={{ fontFamily: 'var(--font-display, Inter, sans-serif)' }}>
        
        {/* Left Column: Conversation Thread */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Breadcrumb Back Row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button 
              onClick={() => setSelectedTicketId(null)}
              style={{
                background: 'none', border: 'none', color: '#0047CC', fontSize: '13px',
                fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px'
              }}
            >
              <span>←</span> Back to Support
            </button>
            <span style={{ color: '#DDE2EC' }}>|</span>
            <span style={{
              background: statusBg, color: statusColor, fontSize: '10px',
              fontWeight: 800, padding: '3px 8px', borderRadius: '4px', textTransform: 'uppercase'
            }}>
              {activeTicket.status}
            </span>
          </div>

          {/* Ticket Header Card */}
          <Card style={{ padding: '24px' }}>
            <span style={{ fontSize: '11px', color: '#6B7A99', fontWeight: 700 }}>TICKET {activeTicket.id}</span>
            <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#1A2340', margin: '4px 0 0 0' }}>
              {activeTicket.subject}
            </h2>
          </Card>

          {/* Chat Messages Log */}
          <Card style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px', minHeight: '350px', maxHeight: '500px', overflowY: 'auto' }}>
            {activeTicket.messages.map((msg: any) => {
              const isAgent = msg.sender.isSupport;
              return (
                <div 
                  key={msg.id} 
                  style={{
                    display: 'flex', gap: '16px', 
                    alignSelf: isAgent ? 'flex-start' : 'flex-end',
                    flexDirection: isAgent ? 'row' : 'row-reverse',
                    maxWidth: '85%'
                  }}
                >
                  {/* Avatar */}
                  <div style={{
                    width: '36px', height: '36px', borderRadius: '50%', overflow: 'hidden',
                    background: isAgent ? '#0047CC' : '#F1F5F9', flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                  }}>
                    {msg.sender.avatar ? (
                      <img src={msg.sender.avatar} alt="Sender avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <span style={{ fontSize: '14px', fontWeight: 700, color: isAgent ? '#fff' : '#6B7A99' }}>
                        {isAgent ? 'S' : 'C'}
                      </span>
                    )}
                  </div>

                  {/* Bubble Content */}
                  <div>
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: '8px', 
                      justifyContent: isAgent ? 'flex-start' : 'flex-end',
                      marginBottom: '4px'
                    }}>
                      <span style={{ fontSize: '12px', fontWeight: 700, color: '#1A2340' }}>{msg.sender.name}</span>
                      <span style={{ fontSize: '10px', color: '#6B7A99' }}>{msg.timestamp}</span>
                    </div>
                    <div style={{
                      background: isAgent ? '#EEF3FF' : '#1A2340',
                      color: isAgent ? '#1A2340' : '#FFFFFF',
                      borderRadius: isAgent ? '0 12px 12px 12px' : '12px 0 12px 12px',
                      padding: '14px 18px', fontSize: '13px', lineHeight: 1.5,
                      boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                    }}>
                      {msg.text}
                    </div>
                  </div>
                </div>
              );
            })}
          </Card>

          {/* Reply Form Section */}
          <Card style={{ padding: '20px 24px' }}>
            <form onSubmit={handleSendReply}>
              {/* Rich editor textbar header */}
              <div style={{ display: 'flex', gap: '14px', borderBottom: '1px solid #F1F5F9', paddingBottom: '10px', marginBottom: '12px' }}>
                {['B', 'I', '🔗', '🖼️', '📎'].map((tool, idx) => (
                  <button 
                    key={idx} 
                    type="button"
                    style={{ background: 'none', border: 'none', color: '#6B7A99', fontSize: '14px', fontWeight: 700, cursor: 'pointer' }}
                  >
                    {tool}
                  </button>
                ))}
              </div>

              {/* Input Area */}
              <textarea
                placeholder="Type your reply here..."
                value={replyText}
                onChange={e => setReplyText(e.target.value)}
                required
                style={{
                  width: '100%', minHeight: '100px', border: 'none', outline: 'none',
                  fontSize: '13px', color: '#1A2340', fontFamily: 'inherit', resize: 'none'
                }}
              />

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #F1F5F9', paddingTop: '12px', marginTop: '12px' }}>
                <span style={{ fontSize: '11px', color: '#6B7A99' }}>Press Cmd+Enter to send</span>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button 
                    type="button" 
                    onClick={() => setReplyText('')}
                    style={{
                      background: 'transparent', border: 'none', color: '#6B7A99',
                      fontSize: '12px', fontWeight: 700, cursor: 'pointer', padding: '6px 12px'
                    }}
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    style={{
                      background: '#0047CC', color: '#FFFFFF', border: 'none', borderRadius: '6px',
                      padding: '8px 16px', fontSize: '12px', fontWeight: 700, cursor: 'pointer'
                    }}
                  >
                    Send Reply
                  </button>
                </div>
              </div>
            </form>
          </Card>

        </div>

        {/* Right Column: Ticket Sidebar Details */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* Ticket Information */}
          <Card style={{ padding: '20px' }}>
            <h4 style={{ fontSize: '11px', fontWeight: 800, color: '#6B7A99', margin: '0 0 16px 0', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              TICKET DETAILS
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '12px', color: '#6B7A99' }}>Category</span>
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#1A2340' }}>{activeTicket.category}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '12px', color: '#6B7A99' }}>Priority</span>
                <span style={{ 
                  fontSize: '11px', fontWeight: 800, 
                  color: activeTicket.priority === 'Urgent' ? '#EF4444' : '#EAB308'
                }}>
                  {activeTicket.priority}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '12px', color: '#6B7A99' }}>Created On</span>
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#1A2340' }}>{activeTicket.createdAt}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '12px', color: '#6B7A99' }}>Response Time</span>
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#1A2340' }}>1h 32m</span>
              </div>
            </div>
          </Card>

          {/* Assigned Agent */}
          <Card style={{ padding: '20px' }}>
            <h4 style={{ fontSize: '11px', fontWeight: 800, color: '#6B7A99', margin: '0 0 16px 0', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              ASSIGNED AGENT
            </h4>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <div style={{
                width: '40px', height: '40px', borderRadius: '50%', overflow: 'hidden',
                background: '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                {activeTicket.assignedAgent?.avatar ? (
                  <img src={activeTicket.assignedAgent.avatar} alt="Agent avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <span style={{ fontSize: '16px' }}>👤</span>
                )}
              </div>
              <div>
                <span style={{ fontSize: '13px', fontWeight: 700, color: '#1A2340', display: 'block' }}>
                  {activeTicket.assignedAgent?.name || 'Support Agent'}
                </span>
                <span style={{ fontSize: '11px', color: '#6B7A99' }}>
                  {activeTicket.assignedAgent?.role || 'Global Support Lead'}
                </span>
              </div>
            </div>
            <button 
              onClick={() => alert('Direct messages with support leads are managed through secure portals. You can chat within this ticket!')}
              style={{
                width: '100%', background: '#F5F7FA', border: '1px solid #DDE2EC', borderRadius: '8px',
                padding: '10px', fontSize: '12px', fontWeight: 700, color: '#1A2340', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px'
              }}
            >
              <span>✉️</span> Direct Message
            </button>
          </Card>

          {/* Ticket Actions */}
          <Card style={{ padding: '20px' }}>
            <h4 style={{ fontSize: '11px', fontWeight: 800, color: '#6B7A99', margin: '0 0 16px 0', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              ACTIONS
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button 
                onClick={handleResolveTicket}
                style={{
                  width: '100%', background: '#FFFFFF', border: '1px solid #DDE2EC', borderRadius: '8px',
                  padding: '10px', fontSize: '12px', fontWeight: 700, color: '#00A389', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px'
                }}
              >
                <span>✓</span> Mark as Resolved
              </button>
              <button 
                onClick={handleEscalateTicket}
                style={{
                  width: '100%', background: 'transparent', border: 'none', color: '#EF4444',
                  fontSize: '12px', fontWeight: 700, cursor: 'pointer', padding: '8px'
                }}
              >
                🚨 Escalate Ticket
              </button>
            </div>
          </Card>

          {/* Pro Tip */}
          <div style={{ background: '#EEF3FF', padding: '16px', borderRadius: '8px', display: 'flex', gap: '12px' }}>
            <div style={{ fontSize: '18px' }}>💡</div>
            <div>
              <h5 style={{ fontSize: '12px', fontWeight: 700, color: '#0047CC', margin: '0 0 4px 0' }}>Pro Tip</h5>
              <p style={{ fontSize: '11px', color: '#4E5D78', margin: 0, lineHeight: 1.4 }}>
                Ensure your bank's international transfer limits are set high enough to receive enterprise-level payments.
              </p>
            </div>
          </div>

        </div>

      </div>
    );
  }

  // ─── SUPPORT DASHBOARD VIEW (SCREEN A) ───
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px', fontFamily: 'var(--font-display, Inter, sans-serif)' }}>
      
      {/* Search Header Banner Section */}
      <div style={{
        background: 'linear-gradient(135deg, #002B7F 0%, #0047CC 100%)',
        borderRadius: '16px', padding: '40px', color: '#FFFFFF', textAlign: 'center',
        position: 'relative', overflow: 'hidden'
      }}>
        {/* Soft background shape */}
        <div style={{
          position: 'absolute', top: '-100px', right: '-100px', width: '300px', height: '300px',
          borderRadius: '50%', background: 'rgba(255,255,255,0.06)', pointerEvents: 'none'
        }} />

        <h1 style={{ fontSize: '28px', fontWeight: 800, margin: '0 0 8px 0' }}>How can we assist you today?</h1>
        <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.8)', margin: '0 0 24px 0' }}>
          Find answers to common questions or connect with our specialized support teams.
        </p>

        {/* Centered Search box */}
        <div style={{ display: 'flex', justifyContent: 'center', margin: '0 auto', maxWidth: '540px', position: 'relative' }}>
          <span style={{ position: 'absolute', left: '16px', top: '12px', color: '#6B7A99', fontSize: '16px' }}>🔍</span>
          <input
            type="text"
            placeholder="Search documentation, FAQs, or tickets..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{
              width: '100%', height: '46px', background: '#FFFFFF', border: 'none', borderRadius: '24px',
              padding: '0 16px 0 46px', fontSize: '14px', color: '#1A2340', outline: 'none',
              boxShadow: '0 8px 16px rgba(0,0,0,0.08)'
            }}
          />
        </div>

        {/* Quick tags */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginTop: '16px', flexWrap: 'wrap' }}>
          {['#AccountActivation', '#PaymentGateway', '#IPIntegration'].map(tag => (
            <button
              key={tag}
              onClick={() => setSearchQuery(tag.replace('#', ''))}
              style={{
                background: 'rgba(255,255,255,0.15)', color: '#FFFFFF', border: 'none',
                borderRadius: '12px', padding: '4px 12px', fontSize: '11px', fontWeight: 600,
                cursor: 'pointer', transition: 'all 0.15s'
              }}
            >
              {tag}
            </button>
          ))}
        </div>
      </div>

      {/* Grid of Categories */}
      <div className="db-grid-4" style={{}}>
        {[
          { label: 'Payment Issues', desc: 'Invoicing, direct deposits, and billing queries.', icon: '💳' },
          { label: 'Technical Support', desc: 'Platform bugs, API issues, and integrations.', icon: '⚙️' },
          { label: 'Verification', desc: 'KYC processes and talent background checks.', icon: '🛡️' },
          { label: 'Guidance', desc: 'Learning modules and platform walkthroughs.', icon: '📖' }
        ].map((item, idx) => (
          <Card 
            key={idx} 
            onClick={() => {
              setNewTicketCategory(item.label);
              setNewTicketModalOpen(true);
            }}
            style={{ 
              padding: '24px', cursor: 'pointer', transition: 'transform 0.15s ease, box-shadow 0.15s ease',
              display: 'flex', flexDirection: 'column', gap: '12px'
            }}
          >
            <div style={{
              width: '40px', height: '40px', borderRadius: '8px', background: '#EEF3FF',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px'
            }}>
              {item.icon}
            </div>
            <div>
              <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#1A2340', margin: '0 0 4px 0' }}>{item.label}</h3>
              <p style={{ fontSize: '12px', color: '#6B7A99', margin: 0, lineHeight: 1.4 }}>{item.desc}</p>
            </div>
          </Card>
        ))}
      </div>

      {/* Split layout (Tickets table & Live Chat pane) */}
      <div className="db-grid-split-320" style={{ alignItems: 'flex-start' }}>
        
        {/* Left Card: My Recent Tickets */}
        <Card style={{ padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 800, color: '#1A2340', margin: 0 }}>My Recent Tickets</h3>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              <button 
                onClick={() => setSearchQuery('')}
                style={{ background: 'none', border: 'none', color: '#0047CC', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}
              >
                View All
              </button>
              <button
                onClick={() => setNewTicketModalOpen(true)}
                style={{
                  background: '#0047CC', color: '#FFFFFF', border: 'none', borderRadius: '6px',
                  padding: '6px 12px', fontSize: '12px', fontWeight: 700, cursor: 'pointer'
                }}
              >
                + New Ticket
              </button>
            </div>
          </div>

          {tickets.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '40px 20px', textAlign: 'center', color: '#6B7A99', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: '48px', marginBottom: '8px' }}>🎫</span>
              <h4 style={{ fontSize: '16px', fontWeight: 800, color: '#1A2340', margin: 0 }}>No Support Tickets Yet</h4>
              <p style={{ fontSize: '13px', color: '#6B7A99', maxWidth: '380px', margin: 0, lineHeight: 1.5 }}>
                Have questions about international payroll, local EOR compliance, or workspace integrations? Submit a new ticket to get in touch with our specialized support desk.
              </p>
              <button
                onClick={() => setNewTicketModalOpen(true)}
                style={{
                  background: '#EEF3FF', color: '#0047CC', border: 'none', borderRadius: '8px',
                  padding: '10px 20px', fontSize: '13px', fontWeight: 700, cursor: 'pointer', marginTop: '8px'
                }}
              >
                Create Your First Ticket
              </button>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #F1F5F9' }}>
                    <th style={{ padding: '12px 8px', fontSize: '11px', fontWeight: 700, color: '#6B7A99', textTransform: 'uppercase' }}>Ticket ID</th>
                    <th style={{ padding: '12px 8px', fontSize: '11px', fontWeight: 700, color: '#6B7A99', textTransform: 'uppercase' }}>Subject</th>
                    <th style={{ padding: '12px 8px', fontSize: '11px', fontWeight: 700, color: '#6B7A99', textTransform: 'uppercase' }}>Status</th>
                    <th style={{ padding: '12px 8px', fontSize: '11px', fontWeight: 700, color: '#6B7A99', textTransform: 'uppercase' }}>Last Activity</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTickets.map((ticket: any) => {
                    let pillBg = '#FFF3C4';
                    let pillColor = '#D97706';
                    if (ticket.status === 'Resolved') {
                      pillBg = '#E6FFFA';
                      pillColor = '#00A389';
                    } else if (ticket.status === 'Open') {
                      pillBg = '#FEE2E2';
                      pillColor = '#EF4444';
                    }

                    return (
                      <tr 
                        key={ticket.id} 
                        onClick={() => setSelectedTicketId(ticket.id)}
                        style={{ borderBottom: '1px solid #F8FAFC', cursor: 'pointer', transition: 'background 0.15s' }}
                        onMouseEnter={e => { e.currentTarget.style.background = '#F9FAFB'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                      >
                        <td style={{ padding: '14px 8px', fontSize: '13px', fontWeight: 700, color: '#0047CC' }}>{ticket.id}</td>
                        <td style={{ padding: '14px 8px' }}>
                          <span style={{ fontSize: '13px', fontWeight: 600, color: '#1A2340', display: 'block' }}>{ticket.subject}</span>
                          <span style={{ fontSize: '10px', color: '#6B7A99' }}>{ticket.category}</span>
                        </td>
                        <td style={{ padding: '14px 8px' }}>
                          <span style={{
                            background: pillBg, color: pillColor, fontSize: '10px', fontWeight: 800,
                            padding: '3px 8px', borderRadius: '4px', textTransform: 'uppercase'
                          }}>
                            {ticket.status}
                          </span>
                        </td>
                        <td style={{ padding: '14px 8px', fontSize: '12px', color: '#6B7A99' }}>{ticket.lastActivity}</td>
                      </tr>
                    );
                  })}
                  {filteredTickets.length === 0 && (
                    <tr>
                      <td colSpan={4} style={{ padding: '24px 8px', textAlign: 'center', color: '#6B7A99', fontSize: '13px' }}>
                        No support tickets found matching your query.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {/* Right Side Cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* Live Support */}
          <Card style={{ padding: '24px', background: 'linear-gradient(135deg, #1A2340 0%, #0D1326 100%)', color: '#FFFFFF' }}>
            <div style={{ fontSize: '24px', marginBottom: '12px' }}>💬</div>
            <h3 style={{ fontSize: '15px', fontWeight: 800, color: '#FFFFFF', margin: '0 0 4px 0' }}>Live Support</h3>
            <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.7)', margin: '0 0 20px 0' }}>
              Average response time: 2 minutes.
            </p>
            <button 
              onClick={() => setChatAlertOpen(true)}
              style={{
                width: '100%', background: '#FFFFFF', color: '#1A2340', border: 'none', borderRadius: '8px',
                padding: '10px', fontSize: '12px', fontWeight: 700, cursor: 'pointer'
              }}
            >
              Start Live Chat
            </button>
          </Card>

          {/* Other Channels */}
          <Card style={{ padding: '20px' }}>
            <h4 style={{ fontSize: '11px', fontWeight: 800, color: '#6B7A99', margin: '0 0 16px 0', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              OTHER CHANNELS
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '16px' }}>✉️</span>
                <div>
                  <span style={{ fontSize: '11px', color: '#6B7A99', display: 'block' }}>Email Support</span>
                  <a href="mailto:support@kongila.com" style={{ fontSize: '12px', fontWeight: 700, color: '#0047CC', textDecoration: 'none' }}>
                    support@kongila.com
                  </a>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '16px' }}>📞</span>
                <div>
                  <span style={{ fontSize: '11px', color: '#6B7A99', display: 'block' }}>Enterprise Hotline</span>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: '#1A2340' }}>
                    +1 (800) KONGILA
                  </span>
                </div>
              </div>
            </div>
            
            <div style={{ borderTop: '1px solid #F1F5F9', marginTop: '16px', paddingTop: '12px', fontSize: '11px', color: '#6B7A99', textAlign: 'center' }}>
              Availability: 24/7 Global Desk
            </div>
          </Card>

        </div>

      </div>

      {/* CREATE NEW SUPPORT TICKET MODAL */}
      {newTicketModalOpen && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(26, 35, 64, 0.6)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 999
        }}>
          <div style={{
            background: '#FFFFFF', borderRadius: '12px', width: '90%', maxWidth: '520px',
            padding: '28px', border: '1px solid #E2E8F0', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)'
          }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#1A2340', margin: 0 }}>Create New Support Ticket</h3>
              <button 
                onClick={() => setNewTicketModalOpen(false)}
                style={{ background: 'none', border: 'none', fontSize: '16px', fontWeight: 700, cursor: 'pointer', color: '#6B7A99' }}
              >
                ✕
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleCreateTicket} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              
              {/* Category */}
              <div>
                <label style={{ fontSize: '11px', fontWeight: 700, color: '#6B7A99', display: 'block', marginBottom: '6px' }}>
                  Category
                </label>
                <select
                  value={newTicketCategory}
                  onChange={e => setNewTicketCategory(e.target.value)}
                  style={{
                    width: '100%', height: '40px', border: '1px solid #DDE2EC', borderRadius: '8px',
                    padding: '0 12px', fontSize: '13px', outline: 'none', background: '#FFFFFF'
                  }}
                >
                  <option value="Payment Issues">Payment Issues</option>
                  <option value="Technical Support">Technical Support</option>
                  <option value="Verification">Verification</option>
                  <option value="Guidance">Guidance</option>
                </select>
              </div>

              {/* Priority */}
              <div>
                <label style={{ fontSize: '11px', fontWeight: 700, color: '#6B7A99', display: 'block', marginBottom: '6px' }}>
                  Priority
                </label>
                <select
                  value={newTicketPriority}
                  onChange={e => setNewTicketPriority(e.target.value)}
                  style={{
                    width: '100%', height: '40px', border: '1px solid #DDE2EC', borderRadius: '8px',
                    padding: '0 12px', fontSize: '13px', outline: 'none', background: '#FFFFFF'
                  }}
                >
                  <option value="Low">Low</option>
                  <option value="Medium">Medium</option>
                  <option value="High">High</option>
                  <option value="Urgent">Urgent</option>
                </select>
              </div>

              {/* Subject */}
              <div>
                <label style={{ fontSize: '11px', fontWeight: 700, color: '#6B7A99', display: 'block', marginBottom: '6px' }}>
                  Subject
                </label>
                <input
                  type="text"
                  placeholder="Summarize your issue"
                  value={newTicketSubject}
                  onChange={e => setNewTicketSubject(e.target.value)}
                  required
                  style={{
                    width: '100%', height: '40px', border: '1px solid #DDE2EC', borderRadius: '8px',
                    padding: '0 12px', fontSize: '13px', outline: 'none'
                  }}
                />
              </div>

              {/* Message */}
              <div>
                <label style={{ fontSize: '11px', fontWeight: 700, color: '#6B7A99', display: 'block', marginBottom: '6px' }}>
                  Message / Details
                </label>
                <textarea
                  placeholder="Provide details about your query..."
                  value={newTicketMessage}
                  onChange={e => setNewTicketMessage(e.target.value)}
                  required
                  style={{
                    width: '100%', minHeight: '120px', border: '1px solid #DDE2EC', borderRadius: '8px',
                    padding: '12px', fontSize: '13px', outline: 'none', fontFamily: 'inherit', resize: 'none'
                  }}
                />
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '12px' }}>
                <button
                  type="button"
                  onClick={() => setNewTicketModalOpen(false)}
                  style={{
                    background: 'transparent', border: 'none', color: '#6B7A99', fontSize: '13px',
                    fontWeight: 700, cursor: 'pointer', padding: '8px 16px'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{
                    background: '#0047CC', color: '#FFFFFF', border: 'none', borderRadius: '8px',
                    padding: '10px 20px', fontSize: '13px', fontWeight: 700, cursor: 'pointer'
                  }}
                >
                  Submit Ticket
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* MOCK CHAT POPUP SCREEN */}
      {chatAlertOpen && (
        <div style={{
          position: 'fixed', bottom: '24px', right: '24px',
          width: '320px', background: '#FFFFFF', borderRadius: '12px',
          border: '1px solid #E2E8F0', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)',
          zIndex: 1000, overflow: 'hidden', fontFamily: 'inherit'
        }}>
          {/* Header */}
          <div style={{ background: '#1A2340', color: '#FFFFFF', padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '13px', fontWeight: 700 }}>Live Support Chat</span>
            <button 
              onClick={() => setChatAlertOpen(false)}
              style={{ background: 'none', border: 'none', color: '#fff', fontSize: '14px', cursor: 'pointer' }}
            >
              ✕
            </button>
          </div>
          {/* Content */}
          <div style={{ padding: '18px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10B981', marginTop: '5px' }} />
              <p style={{ fontSize: '12px', color: '#4E5D78', margin: 0, lineHeight: 1.4 }}>
                <strong>Support Agent:</strong> Hi, thanks for requesting a live chat. We are routing you to an active operator now. Estimated wait time: <strong>1.2 minutes</strong>.
              </p>
            </div>
            <input 
              type="text" 
              placeholder="Type message here..." 
              style={{
                width: '100%', height: '36px', border: '1px solid #DDE2EC', borderRadius: '6px',
                padding: '0 10px', fontSize: '12px', outline: 'none'
              }}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  alert('Thank you! Our live agent is joining.');
                  setChatAlertOpen(false);
                }
              }}
            />
          </div>
        </div>
      )}

    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// SKILL ASSESSMENT ENGINE
// ─────────────────────────────────────────────────────────────────────────────

interface AssessmentEngineProps {
  talentProfile: any;
  talentSkillAssessment: any;    // the TSA record — has assessmentId
  assessment: any;               // the Assessment object
  categories: any[];             // AssessmentCategory[]
  questions: any[];              // AssessmentQuestion[]
  onSubmit: (result: any) => Promise<void>;
  onClose: () => void;
}

type EnginePhase = 'notice' | 'in_progress' | 'submitted';

const SkillAssessmentEngine = ({
  talentProfile,
  talentSkillAssessment,
  assessment,
  categories,
  questions,
  onSubmit,
  onClose
}: AssessmentEngineProps) => {
  const alreadySubmitted = !isAssessmentSubmittable(talentSkillAssessment, talentProfile?.id);

  // ── Phase management
  const [phase, setPhase] = useState<EnginePhase>(alreadySubmitted ? 'submitted' : 'notice');

  // ── Category navigation
  const [categoryIdx, setCategoryIdx] = useState(0);

  // ── Answers: { [questionId]: string | string[] }
  const [answers, setAnswers] = useState<Record<string, any>>({});

  // ── Timer state (seconds)
  const totalSeconds = (assessment.total_time_limit_minutes || 60) * 60;
  const [secondsLeft, setSecondsLeft] = useState(totalSeconds);
  const [startTime, setStartTime] = useState<number | null>(null);
  const timerRef = useRef<any>(null);

  // ── Submission state
  const [submitting, setSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<any>(null);

  // ── Flag: was auto-submitted due to timer?
  const [autoSubmitted, setAutoSubmitted] = useState(false);

  // Get ordered categories for this assessment
  const orderedCategories = (assessment.categories || [])
    .map((catId: string) => categories.find((c: any) => c.id === catId))
    .filter(Boolean);

  const currentCategory = orderedCategories[categoryIdx];
  const categoryQuestions = currentCategory
    ? questions.filter((q: any) => q.category_id === currentCategory.id)
    : [];

  // ── Format time as MM:SS
  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  };

  // ── Compute auto-score (MCQ only)
  const computeAutoScore = useCallback(() => {
    let totalWeight = 0;
    let earnedWeight = 0;

    questions.forEach((q: any) => {
      const catInAssessment = (assessment.categories || []).includes(q.category_id);
      if (!catInAssessment) return;

      if (q.type === 'multiple_choice') {
        totalWeight += q.scoring_weight || 1;
        const answer = answers[q.id];
        const correct = Array.isArray(q.correct_answer) ? q.correct_answer : [q.correct_answer];
        const given = Array.isArray(answer) ? answer : [answer];
        if (correct.length === given.length && correct.every((c: string) => given.includes(c))) {
          earnedWeight += q.scoring_weight || 1;
        }
      }
    });

    if (totalWeight === 0) return null; // no MCQ to auto-score
    return Math.round((earnedWeight / totalWeight) * 100);
  }, [answers, questions, assessment]);

  // ── Handle submission (both manual and auto)
  const handleSubmit = useCallback(async (isAuto = false) => {
    if (submitting) return;
    setSubmitting(true);

    const endTime = Date.now();
    const autoScore = computeAutoScore();

    // Classify questions by type
    const subjectiveAnswers: Record<string, any> = {};
    questions.forEach((q: any) => {
      if (q.type !== 'multiple_choice' && answers[q.id] !== undefined) {
        subjectiveAnswers[q.id] = answers[q.id];
      }
    });

    const result = {
      id: `asr_${Date.now()}`,
      talentSkillAssessmentId: talentSkillAssessment.id,
      assessmentId: assessment.id,
      talentId: talentProfile.id,
      answers,
      subjectiveAnswers,
      autoScore, // This is strictly for multiple_choice
      score: null, // Total score will be set by admin later if subjective questions exist
      passed: null,
      hasSubjective: Object.keys(subjectiveAnswers).length > 0,
      timeTakenSeconds: startTime ? Math.round((endTime - startTime) / 1000) : totalSeconds,
      autoSubmitted: isAuto,
      submittedAt: new Date().toISOString(),
    };

    try {
      await onSubmit(result);
      setSubmitResult(result);
      setPhase('submitted');
      if (isAuto) setAutoSubmitted(true);
    } finally {
      setSubmitting(false);
    }
  }, [submitting, computeAutoScore, answers, questions, talentSkillAssessment, assessment, talentProfile, startTime, totalSeconds, onSubmit]);

  // ── Start timer when phase becomes in_progress
  useEffect(() => {
    if (phase !== 'in_progress') return;
    const now = Date.now();
    setStartTime(now);
    setSecondsLeft(totalSeconds);

    timerRef.current = setInterval(() => {
      setSecondsLeft(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          handleSubmit(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timerRef.current);
  }, [phase]);  // eslint-disable-line react-hooks/exhaustive-deps

  // Cleanup on unmount
  useEffect(() => () => clearInterval(timerRef.current), []);

  // ── Timer colour
  const timerColor = secondsLeft < 120 ? '#EF4444' : secondsLeft < 300 ? '#F59E0B' : '#10B981';
  const timerPct = (secondsLeft / totalSeconds) * 100;

  // ── Answer helpers
  const setAnswer = (qId: string, value: any) =>
    setAnswers(prev => ({ ...prev, [qId]: value }));

  const answeredInCategory = categoryQuestions.filter((q: any) => answers[q.id] !== undefined && answers[q.id] !== '').length;

  // ══════════════════════════════════════════════════════════
  // PHASE: NOTICE (pre-assessment briefing)
  // ══════════════════════════════════════════════════════════
  if (phase === 'notice') {
    return (
      <div style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(15, 23, 42, 0.75)', backdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px'
      }}>
        <div style={{
          background: '#FFFFFF', border: '1px solid #E2E8F0',
          borderRadius: '24px', padding: '48px', maxWidth: '640px', width: '100%',
          boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
          fontFamily: 'Inter, sans-serif',
          maxHeight: '90vh', overflowY: 'auto'
        }}>
          <div style={{ marginBottom: '32px' }}>
            <div style={{ fontSize: '13px', fontWeight: 800, color: '#0047CC', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>
              Skill Assessment
            </div>
            <h2 style={{ fontSize: '32px', fontWeight: 900, color: '#1A2340', margin: '0 0 12px 0', lineHeight: 1.2 }}>
              {assessment.title}
            </h2>
            <p style={{ fontSize: '15px', color: '#4E5D78', margin: 0, lineHeight: 1.6 }}>
              {assessment.description || 'Please review the instructions and structure below. Ensure you have a stable internet connection and a quiet environment before starting.'}
            </p>
          </div>

          <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '16px', padding: '24px', marginBottom: '32px' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 800, color: '#1A2340', margin: '0 0 16px 0' }}>
              Assessment Guidelines
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
              <div>
                <div style={{ fontSize: '12px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', marginBottom: '4px' }}>Time Limit</div>
                <div style={{ fontSize: '14px', fontWeight: 600, color: '#1A2340' }}>{assessment.total_time_limit_minutes || 60} minutes</div>
              </div>
              <div>
                <div style={{ fontSize: '12px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', marginBottom: '4px' }}>Passing Score</div>
                <div style={{ fontSize: '14px', fontWeight: 600, color: '#1A2340' }}>{assessment.passing_score || 70}% required</div>
              </div>
              <div>
                <div style={{ fontSize: '12px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', marginBottom: '4px' }}>Format</div>
                <div style={{ fontSize: '14px', fontWeight: 600, color: '#1A2340' }}>Multiple Choice & Written</div>
              </div>
              <div>
                <div style={{ fontSize: '12px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', marginBottom: '4px' }}>Attempts</div>
                <div style={{ fontSize: '14px', fontWeight: 600, color: '#1A2340' }}>Single attempt only</div>
              </div>
            </div>
            <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #E2E8F0', fontSize: '13px', color: '#4E5D78', lineHeight: 1.6 }}>
              <strong>Important:</strong> The timer cannot be paused once started. If the time expires, your progress will be automatically submitted. Do not refresh the page during the assessment.
            </div>
          </div>

          <div style={{ marginBottom: '36px' }}>
            <div style={{ fontSize: '13px', fontWeight: 800, color: '#1A2340', marginBottom: '16px' }}>Section Breakdown</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {orderedCategories.map((cat: any, i: number) => {
                const catQs = questions.filter((q: any) => q.category_id === cat.id);
                return (
                  <div key={cat.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                      <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: '#F1F5F9', color: '#475569', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 800 }}>{i + 1}</div>
                      <div style={{ fontSize: '14px', color: '#1A2340', fontWeight: 700 }}>{cat.name}</div>
                    </div>
                    <div style={{ fontSize: '13px', color: '#64748B', fontWeight: 600 }}>
                      {catQs.length} question{catQs.length !== 1 ? 's' : ''} {cat.time_limit_minutes ? `· ${cat.time_limit_minutes}m` : ''}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '16px' }}>
            <button onClick={onClose} style={{ flex: 1, padding: '16px', borderRadius: '12px', border: '1px solid #E2E8F0', background: '#FFFFFF', color: '#4E5D78', fontSize: '15px', fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s' }}>
              Back to Dashboard
            </button>
            <button
              onClick={() => setPhase('in_progress')}
              style={{ flex: 2, padding: '16px', borderRadius: '12px', border: 'none', background: '#0047CC', color: '#fff', fontSize: '15px', fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 14px rgba(0,71,204,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }}
            >
              Start Assessment Now
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════
  // PHASE: IN_PROGRESS
  // ══════════════════════════════════════════════════════════
  if (phase === 'in_progress') {
    return (
      <div style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: '#060B18',
        display: 'flex', flexDirection: 'column', fontFamily: 'Inter, sans-serif', overflow: 'hidden'
      }}>
        {/* ── TOP BAR */}
        <div style={{ background: '#0A1120', borderBottom: '1px solid rgba(255,255,255,0.07)', padding: '0 24px', height: '64px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          {/* Left: Title */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: '#0047CC', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 900, fontSize: '16px' }}>K</div>
            <div>
              <div style={{ fontSize: '11px', color: '#64748B', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Skill Assessment</div>
              <div style={{ fontSize: '14px', fontWeight: 700, color: '#F8FAFC' }}>{assessment.title}</div>
            </div>
          </div>

          {/* Centre: Category pills */}
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            {orderedCategories.map((cat: any, i: number) => {
              const catQs = questions.filter((q: any) => q.category_id === cat.id);
              const answered = catQs.filter((q: any) => answers[q.id] !== undefined && answers[q.id] !== '').length;
              const done = answered === catQs.length && catQs.length > 0;
              return (
                <button
                  key={cat.id}
                  onClick={() => setCategoryIdx(i)}
                  style={{
                    padding: '5px 12px', borderRadius: '20px', fontSize: '11px', fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s',
                    border: i === categoryIdx ? '1px solid #38BDF8' : '1px solid rgba(255,255,255,0.1)',
                    background: i === categoryIdx ? 'rgba(56,189,248,0.15)' : done ? 'rgba(16,185,129,0.12)' : 'rgba(255,255,255,0.04)',
                    color: i === categoryIdx ? '#38BDF8' : done ? '#10B981' : '#94A3B8',
                  }}
                >
                  {done ? '✓ ' : ''}{i + 1}. {cat.name}
                </button>
              );
            })}
          </div>

          {/* Right: Timer */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '11px', color: '#64748B', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '2px' }}>Time Remaining</div>
              <div style={{ fontSize: '22px', fontWeight: 900, color: timerColor, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em', transition: 'color 0.5s' }}>
                {formatTime(secondsLeft)}
              </div>
            </div>
            {/* Timer arc */}
            <svg width="44" height="44" viewBox="0 0 44 44" style={{ transform: 'rotate(-90deg)' }}>
              <circle cx="22" cy="22" r="18" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="4" />
              <circle cx="22" cy="22" r="18" fill="none" stroke={timerColor} strokeWidth="4"
                strokeDasharray={`${2 * Math.PI * 18}`}
                strokeDashoffset={`${2 * Math.PI * 18 * (1 - timerPct / 100)}`}
                strokeLinecap="round" style={{ transition: 'stroke-dashoffset 1s linear, stroke 0.5s' }}
              />
            </svg>
          </div>
        </div>

        {/* ── PROGRESS BAR */}
        <div style={{ height: '3px', background: '#0A1120' }}>
          <div style={{ height: '100%', background: `linear-gradient(90deg, #0047CC, #38BDF8)`, width: `${timerPct}%`, transition: 'width 1s linear' }} />
        </div>

        {/* ── MAIN CONTENT */}
        <div style={{ flex: 1, overflow: 'auto', padding: '32px 24px' }}>
          <div style={{ maxWidth: '780px', margin: '0 auto' }}>

            {/* Category Header */}
            {currentCategory && (
              <div style={{ marginBottom: '28px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <div>
                    <div style={{ fontSize: '11px', color: '#38BDF8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '4px' }}>
                      Section {categoryIdx + 1} of {orderedCategories.length}
                    </div>
                    <h2 style={{ fontSize: '22px', fontWeight: 800, color: '#F8FAFC', margin: 0 }}>{currentCategory.name}</h2>
                    {currentCategory.description && <p style={{ fontSize: '13px', color: '#64748B', margin: '6px 0 0 0' }}>{currentCategory.description}</p>}
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: '13px', color: '#64748B' }}>
                      <span style={{ color: answeredInCategory === categoryQuestions.length && categoryQuestions.length > 0 ? '#10B981' : '#F8FAFC', fontWeight: 700 }}>{answeredInCategory}</span>
                      <span> / {categoryQuestions.length} answered</span>
                    </div>
                  </div>
                </div>
                {/* Category progress bar */}
                <div style={{ height: '4px', background: 'rgba(255,255,255,0.06)', borderRadius: '2px', overflow: 'hidden' }}>
                  <div style={{ height: '100%', background: '#10B981', width: categoryQuestions.length > 0 ? `${(answeredInCategory / categoryQuestions.length) * 100}%` : '0%', transition: 'width 0.3s', borderRadius: '2px' }} />
                </div>
              </div>
            )}

            {/* Questions */}
            {categoryQuestions.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px 20px', color: '#64748B' }}>
                <div style={{ fontSize: '40px', marginBottom: '12px' }}>📭</div>
                <div style={{ fontSize: '15px', fontWeight: 600 }}>No questions in this section</div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {categoryQuestions.map((q: any, qIdx: number) => (
                  <QuestionCard
                    key={q.id}
                    question={q}
                    index={qIdx}
                    answer={answers[q.id]}
                    onAnswer={(val) => setAnswer(q.id, val)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── BOTTOM ACTION BAR */}
        <div style={{ background: '#0A1120', borderTop: '1px solid rgba(255,255,255,0.07)', padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <button
            onClick={() => setCategoryIdx(prev => Math.max(0, prev - 1))}
            disabled={categoryIdx === 0}
            style={{ padding: '10px 20px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.12)', background: 'transparent', color: categoryIdx === 0 ? '#334155' : '#94A3B8', fontSize: '13px', fontWeight: 600, cursor: categoryIdx === 0 ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            ← Previous Section
          </button>

          {/* Centre: overall progress */}
          <div style={{ fontSize: '12px', color: '#64748B', textAlign: 'center' }}>
            {Object.keys(answers).length} of {questions.filter((q: any) => (assessment.categories || []).includes(q.category_id)).length} total questions answered
          </div>

          {categoryIdx < orderedCategories.length - 1 ? (
            <button
              onClick={() => setCategoryIdx(prev => prev + 1)}
              style={{ padding: '10px 20px', borderRadius: '8px', border: '1px solid rgba(56,189,248,0.3)', background: 'rgba(56,189,248,0.1)', color: '#38BDF8', fontSize: '13px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              Next Section →
            </button>
          ) : (
            <button
              onClick={() => handleSubmit(false)}
              disabled={submitting}
              style={{ padding: '10px 24px', borderRadius: '8px', border: 'none', background: submitting ? '#334155' : 'linear-gradient(135deg, #10B981, #059669)', color: '#fff', fontSize: '13px', fontWeight: 800, cursor: submitting ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: submitting ? 'none' : '0 4px 12px rgba(16,185,129,0.4)' }}
            >
              {submitting ? '⏳ Submitting...' : '✅ Submit Assessment'}
            </button>
          )}
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════
  // PHASE: SUBMITTED
  // ══════════════════════════════════════════════════════════
  const autoScore = submitResult?.autoScore;
  const passing = assessment.passing_score || 70;
  const passed = autoScore !== null && autoScore >= passing;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(6, 11, 24, 0.96)', backdropFilter: 'blur(12px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px',
      fontFamily: 'Inter, sans-serif'
    }}>
      <div style={{
        background: '#0F172A', border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: '20px', padding: '48px', maxWidth: '520px', width: '100%',
        textAlign: 'center', boxShadow: '0 24px 80px rgba(0,0,0,0.6)'
      }}>
        <div style={{ fontSize: '60px', marginBottom: '20px' }}>
          {autoSubmitted ? '⏰' : '🎉'}
        </div>
        <div style={{ fontSize: '12px', fontWeight: 700, color: '#38BDF8', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '12px' }}>
          Assessment {autoSubmitted ? 'Auto-Submitted' : 'Submitted'}
        </div>
        <h2 style={{ fontSize: '24px', fontWeight: 800, color: '#F8FAFC', margin: '0 0 8px 0' }}>
          {autoSubmitted ? 'Time is up!' : 'Great work!'}
        </h2>
        <p style={{ fontSize: '14px', color: '#94A3B8', margin: '0 0 32px 0' }}>
          {autoSubmitted
            ? 'Your answers have been auto-submitted as your time expired.'
            : 'Your assessment has been submitted and is awaiting review by the vetting team.'}
        </p>

        {/* Score card */}
        {autoScore !== null ? (
          <div style={{ background: passed ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)', border: `1px solid ${passed ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`, borderRadius: '14px', padding: '24px', marginBottom: '24px' }}>
            <div style={{ fontSize: '12px', color: passed ? '#34D399' : '#FCA5A5', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>Auto-Scored (Multiple Choice)</div>
            <div style={{ fontSize: '52px', fontWeight: 900, color: passed ? '#10B981' : '#EF4444', lineHeight: 1 }}>{autoScore}%</div>
            <div style={{ fontSize: '13px', color: '#94A3B8', marginTop: '8px' }}>
              {passed ? '✅ Above passing threshold' : `❌ Below passing threshold of ${passing}%`}
            </div>
          </div>
        ) : (
          <div style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: '14px', padding: '20px', marginBottom: '24px' }}>
            <div style={{ fontSize: '13px', color: '#FCD34D', fontWeight: 700, marginBottom: '6px' }}>📝 Manual Grading Required</div>
            <div style={{ fontSize: '12px', color: '#94A3B8' }}>No auto-scoreable MCQ questions found. Your written answers have been submitted for admin review.</div>
          </div>
        )}

        {submitResult?.hasSubjective && (
          <div style={{ background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.25)', borderRadius: '10px', padding: '14px 18px', marginBottom: '24px', textAlign: 'left', display: 'flex', gap: '12px' }}>
            <span style={{ fontSize: '18px' }}>🔍</span>
            <div>
              <div style={{ fontSize: '12px', fontWeight: 700, color: '#C4B5FD', marginBottom: '3px' }}>Written Answers Pending Review</div>
              <div style={{ fontSize: '11px', color: '#94A3B8' }}>Your written/scenario responses have been sent to our team. They will be reviewed and scored within 24–48 hours.</div>
            </div>
          </div>
        )}

        <div style={{ fontSize: '12px', color: '#475569', marginBottom: '28px' }}>
          Time taken: {submitResult ? `${Math.floor(submitResult.timeTakenSeconds / 60)}m ${submitResult.timeTakenSeconds % 60}s` : '—'}
        </div>

        <button
          onClick={onClose}
          style={{ width: '100%', padding: '14px', borderRadius: '10px', border: 'none', background: 'linear-gradient(135deg, #0047CC, #38BDF8)', color: '#fff', fontSize: '14px', fontWeight: 800, cursor: 'pointer', boxShadow: '0 4px 16px rgba(56,189,248,0.3)' }}
        >
          Back to Dashboard
        </button>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// QUESTION CARD — renders one question based on its type
// ─────────────────────────────────────────────────────────────────────────────
const QuestionCard = ({
  question,
  index,
  answer,
  onAnswer
}: {
  question: any;
  index: number;
  answer: any;
  onAnswer: (val: any) => void;
}) => {
  const isAnswered = answer !== undefined && answer !== '';

  return (
    <div style={{
      background: isAnswered ? 'rgba(16,185,129,0.04)' : 'rgba(255,255,255,0.02)',
      border: `1px solid ${isAnswered ? 'rgba(16,185,129,0.2)' : 'rgba(255,255,255,0.06)'}`,
      borderRadius: '14px', padding: '24px', transition: 'all 0.2s'
    }}>
      {/* Question header */}
      <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start', marginBottom: '20px' }}>
        <div style={{
          width: '28px', height: '28px', borderRadius: '8px', flexShrink: 0,
          background: isAnswered ? '#10B981' : 'rgba(255,255,255,0.06)',
          color: isAnswered ? '#fff' : '#64748B',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '12px', fontWeight: 800, transition: 'all 0.2s'
        }}>
          {isAnswered ? '✓' : index + 1}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
            <span style={{
              fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', padding: '2px 8px', borderRadius: '4px',
              background: question.type === 'multiple_choice' ? 'rgba(56,189,248,0.12)' :
                          question.type === 'short_answer' ? 'rgba(245,158,11,0.12)' :
                          question.type === 'essay' ? 'rgba(139,92,246,0.12)' : 'rgba(249,115,22,0.12)',
              color: question.type === 'multiple_choice' ? '#38BDF8' :
                     question.type === 'short_answer' ? '#F59E0B' :
                     question.type === 'essay' ? '#8B5CF6' : '#F97316'
            }}>
              {question.type === 'multiple_choice' ? 'MCQ' :
               question.type === 'short_answer' ? 'Short Answer' :
               question.type === 'essay' ? 'Essay' : question.type.replace('_', ' ')}
            </span>
            <span style={{ fontSize: '10px', color: '#475569', padding: '2px 8px', background: 'rgba(255,255,255,0.04)', borderRadius: '4px' }}>
              {question.scoring_weight || 1} point{(question.scoring_weight || 1) !== 1 ? 's' : ''}
            </span>
          </div>
          <p style={{ fontSize: '15px', fontWeight: 600, color: '#E2E8F0', margin: 0, lineHeight: 1.6 }}>
            {question.question_text}
          </p>
        </div>
      </div>

      {/* ── MCQ Options */}
      {question.type === 'multiple_choice' && Array.isArray(question.options) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {question.options.map((opt: string, oi: number) => {
            const selected = Array.isArray(answer) ? answer.includes(opt) : answer === opt;
            const isMulti = Array.isArray(question.correct_answer) && question.correct_answer.length > 1;
            return (
              <button
                key={oi}
                onClick={() => {
                  if (isMulti) {
                    const current: string[] = Array.isArray(answer) ? answer : [];
                    onAnswer(current.includes(opt) ? current.filter(a => a !== opt) : [...current, opt]);
                  } else {
                    onAnswer(opt);
                  }
                }}
                style={{
                  display: 'flex', alignItems: 'center', gap: '12px',
                  padding: '12px 16px', borderRadius: '10px', border: `1px solid ${selected ? '#38BDF8' : 'rgba(255,255,255,0.07)'}`,
                  background: selected ? 'rgba(56,189,248,0.1)' : 'rgba(255,255,255,0.02)',
                  cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s', width: '100%'
                }}
              >
                <div style={{
                  width: '20px', height: '20px', borderRadius: isMulti ? '4px' : '50%', flexShrink: 0,
                  border: `2px solid ${selected ? '#38BDF8' : 'rgba(255,255,255,0.2)'}`,
                  background: selected ? '#38BDF8' : 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'all 0.15s'
                }}>
                  {selected && <span style={{ color: '#fff', fontSize: '11px', fontWeight: 900 }}>✓</span>}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: selected ? '#38BDF8' : '#475569', width: '18px' }}>
                    {['A','B','C','D','E','F'][oi]}
                  </span>
                  <span style={{ fontSize: '14px', color: selected ? '#E2E8F0' : '#94A3B8', fontWeight: selected ? 600 : 400, transition: 'all 0.15s' }}>{opt}</span>
                </div>
              </button>
            );
          })}
          {Array.isArray(question.correct_answer) && question.correct_answer.length > 1 && (
            <div style={{ fontSize: '11px', color: '#475569', marginTop: '4px' }}>
              💡 Select all that apply
            </div>
          )}
        </div>
      )}

      {/* ── Short Answer */}
      {question.type === 'short_answer' && (
        <input
          type="text"
          value={answer || ''}
          onChange={e => onAnswer(e.target.value)}
          placeholder="Type your answer here..."
          style={{
            width: '100%', padding: '12px 16px', borderRadius: '10px',
            border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)',
            color: '#E2E8F0', fontSize: '14px', outline: 'none', boxSizing: 'border-box',
            fontFamily: 'Inter, sans-serif'
          }}
        />
      )}

      {/* ── Essay / Scenario */}
      {(question.type === 'essay' || question.type === 'scenario') && (
        <textarea
          value={answer || ''}
          onChange={e => onAnswer(e.target.value)}
          placeholder={question.type === 'scenario'
            ? 'Describe how you would approach this situation...'
            : 'Write your detailed answer here...'}
          rows={6}
          style={{
            width: '100%', padding: '14px 16px', borderRadius: '10px',
            border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)',
            color: '#E2E8F0', fontSize: '14px', outline: 'none', resize: 'vertical',
            boxSizing: 'border-box', lineHeight: 1.6, fontFamily: 'Inter, sans-serif'
          }}
        />
      )}

      {/* ── File Upload (info only) */}
      {question.type === 'file_upload' && (
        <div style={{ border: '2px dashed rgba(255,255,255,0.1)', borderRadius: '10px', padding: '24px', textAlign: 'center' }}>
          <div style={{ fontSize: '24px', marginBottom: '8px' }}>📎</div>
          <div style={{ fontSize: '13px', color: '#94A3B8' }}>File upload will be handled via the submission link. Note your response below:</div>
          <textarea
            value={answer || ''}
            onChange={e => onAnswer(e.target.value)}
            placeholder="Paste your file link or describe your submission..."
            rows={3}
            style={{ width: '100%', marginTop: '12px', padding: '12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)', color: '#E2E8F0', fontSize: '13px', resize: 'none', boxSizing: 'border-box', fontFamily: 'Inter, sans-serif', outline: 'none' }}
          />
        </div>
      )}
    </div>
  );
};

// ─── Section: Vetting Progress (Dedicated Full View) ─────────────────────────
const VettingProgressSection = ({ profile, talentSkillAssessments = [], skillAssessmentResults = [], onOpenAssessment, onUpdateProfile }: { profile: any; talentSkillAssessments?: any[]; skillAssessmentResults?: any[]; onOpenAssessment?: (tsaId: string) => void; onUpdateProfile?: (p: any) => void }) => {
  const STAGE_META = [
    { name: 'Application Screening', color: '#EF4444', icon: '📋', responsible: 'Talent Manager', desc: 'Initial review of your application and submitted documents.' },
    { name: 'Skill Assessment',       color: '#3B82F6', icon: '🧪', responsible: 'Skill Assessor', desc: 'Role-specific technical evaluation assigned by the vetting team.' },
    { name: 'Live Interview',         color: '#8B5CF6', icon: '🎙️', responsible: 'Talent Manager', desc: 'Structured interview covering situational and behavioural competencies.' },
    { name: 'Personality Test',       color: '#10B981', icon: '🧠', responsible: 'System (Auto)', desc: 'Automated psychometric profile assessment via external platform.' },
    { name: 'Remote Readiness',       color: '#F59E0B', icon: '🌐', responsible: 'Ops Team', desc: 'Infrastructure check: internet, device, workspace and timezone compatibility.' },
    { name: 'Work Simulation',        color: '#F97316', icon: '🔬', responsible: 'Team Lead', desc: 'Live task or case-study simulation evaluated by a senior team lead.' },
    { name: 'Final Review',           color: '#EAB308', icon: '⭐', responsible: 'Review Panel', desc: 'Panel-level classification into the Kongila Vetted Talent Pool.' },
  ];

  const [pipeline, setPipeline] = useState<any[]>(profile?.vettingPipeline || STAGE_META.map((s, i) => ({ stageIndex: i, stageName: s.name, status: i===0?'in_progress':'pending', assignee: s.responsible })));
  const [loading, setLoading] = useState(false);
  const [stage5ModalOpen, setStage5ModalOpen] = useState(false);
  const [form5, setForm5] = useState({ speed: '', hardware: false, quiet: false });
  const [stage6Active, setStage6Active] = useState(false);
  const [stage6TimeLeft, setStage6TimeLeft] = useState(0);

  // Initialize and run SLA check on mount
  useEffect(() => {
    let mounted = true;
    const init = async () => {
      try {
        const res = await fetch('/api/vetting/sla-check', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ talentId: profile?.id })
        });
        const data = await res.json();
        if (mounted) {
          if (data.updated && onUpdateProfile) {
            onUpdateProfile({ ...profile, vettingPipeline: data.pipeline });
            setPipeline(data.pipeline);
          } else {
            setPipeline(profile?.vettingPipeline || STAGE_META.map((s, i) => ({ stageIndex: i, stageName: s.name, status: i===0?'in_progress':'pending', assignee: s.responsible })));
          }
          setLoading(false);
        }
      } catch (e) {
        if (mounted) {
          setPipeline(profile?.vettingPipeline || STAGE_META.map((s, i) => ({ stageIndex: i, stageName: s.name, status: i===0?'in_progress':'pending', assignee: s.responsible })));
          setLoading(false);
        }
      }
    };
    init();
    return () => { mounted = false; };
  }, [profile?.id]); // Note: excluding profile?.vettingPipeline to avoid loop

  // Sync prop changes if they happen externally
  useEffect(() => {
    if (!loading && profile?.vettingPipeline) {
      setPipeline(profile.vettingPipeline);
    }
  }, [profile?.vettingPipeline, loading]);

  // Stage 6 Timer
  useEffect(() => {
    let timer: any;
    if (stage6Active && stage6TimeLeft > 0) {
      timer = setInterval(() => setStage6TimeLeft(prev => prev - 1), 1000);
    } else if (stage6Active && stage6TimeLeft <= 0) {
      setStage6Active(false);
      handleAction('SUBMIT_STAGE_6', 5);
    }
    return () => clearInterval(timer);
  }, [stage6Active, stage6TimeLeft]);

  const handleAction = async (action: string, stageIndex: number, payload?: any) => {
    try {
      const res = await fetch('/api/vetting/advance', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ talentId: profile?.id, action, stageIndex, payload })
      });
      const data = await res.json();
      if (data.success && onUpdateProfile) {
        onUpdateProfile({ ...profile, vettingPipeline: data.pipeline });
        setPipeline(data.pipeline);
      }
    } catch (e) {
      console.error('Action failed', e);
    }
  };

  const startStage6 = () => {
    setStage6TimeLeft(3 * 60 * 60); // 3 hours
    setStage6Active(true);
    handleAction('START_STAGE_6', 5);
  };

  const passedCount = pipeline.filter((s: any) => s.status === 'passed' || s.status === 'skipped').length;
  const overallProgress = Math.round((passedCount / 7) * 100);
  const scores = profile?.vettingScores || {};
  const compositeScore = Math.round(((scores.technical||0)*0.25)+((scores.workSimulation||0)*0.20)+((scores.behavioral||0)*0.15)+((scores.communication||0)*0.15)+((scores.personality||0)*0.10)+((scores.remoteReadiness||0)*0.10)+((scores.experience||0)*0.05));
  const grade = compositeScore>=85?'A+':compositeScore>=75?'A':compositeScore>=65?'B':passedCount===0?'—':'C';
  const gradeColor = grade==='A+'?'#10B981':grade==='A'?'#3B82F6':grade==='B'?'#F59E0B':grade==='—'?'#94A3B8':'#EF4444';

  const getStageUI = (sIdx: number, stat: string, color: string, slaBreached: boolean) => {
    const labels: Record<number,Record<string,string>> = {
      0:{pending:'Pending Review',in_progress:'Under Review',passed:'Passed',failed:'Rejected',needs_clarification:'Action Required'},
      1:{pending:'Not Started',in_progress:'In Progress',passed:'Scored',failed:'Failed'},
      2:{pending:'Not Scheduled',in_progress:'Scheduled',passed:'Scored',failed:'Failed'},
      3:{pending:'Not Started',in_progress:'In Progress',passed:'Completed',failed:'Failed',skipped:'Skipped (Auto)'},
      4:{pending:'Not Started',in_progress:'Action Required',passed:'Passed',failed:'Failed'},
      5:{pending:'Not Assigned',in_progress:'Ready to Start',passed:'Evaluated',failed:'Failed'},
      6:{pending:'Pending',in_progress:'Under Final Review',passed:'Classified',failed:'Rejected'},
    };
    const label = labels[sIdx]?.[stat] || stat;
    if (stat==='passed') return {bg:'#F0FDF4',border:'#BBF7D0',text:'#15803D',label:`✅ ${label}`};
    if (stat==='skipped') return {bg:'#F8FAFC',border:'#E2E8F0',text:'#64748B',label:`⏭️ ${label}`};
    if (stat==='failed') return {bg:'#FFF1F2',border:'#FECDD3',text:'#DC2626',label:`❌ ${label}`};
    if (stat==='needs_clarification') return {bg:'#FFFBEB',border:'#FDE68A',text:'#D97706',label:`⚠️ ${label}`};
    if (stat==='in_progress') {
      if (slaBreached) return {bg:'#FFF1F2',border:'#FECDD3',text:'#DC2626',label:`⚠️ Delayed`};
      return {bg:`${color}08`,border:`${color}30`,text:color,label:`⏳ ${label}`};
    }
    return {bg:'#F8FAFC',border:'#E2E8F0',text:'#94A3B8',label:`🔒 ${label}`};
  };

  const formatTime = (sec: number) => {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    return `${h}h ${m}m ${s}s`;
  };

  if (loading) return <KongilaLoader text="Loading Vetting Progress..." />;

  return (
    <div style={{display:'flex',flexDirection:'column',gap:'24px'}}>
      <div>
        <h2 style={{fontSize:'22px',fontWeight:800,color:'#1A2340',margin:'0 0 4px 0'}}>🛡️ Vetting Progress</h2>
        <p style={{fontSize:'13px',color:'#6B7A99',margin:0}}>Track your 7-stage talent vetting pipeline in real-time.</p>
      </div>

      {/* Summary Banner */}
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:'16px'}}>
        {[
          {label:'Stages Passed',val:`${passedCount}/7`,color:'#10B981'},
          {label:'Overall Progress',val:`${overallProgress}%`,color:'#0047CC'},
          {label:'Composite Grade',val:grade,color:gradeColor},
        ].map((m,i)=>(
          <Card key={i} style={{padding:'16px 20px',textAlign:'center',borderTop:`3px solid ${m.color}`}}>
            <div style={{fontSize:'11px',fontWeight:700,color:'#6B7A99',textTransform:'uppercase',letterSpacing:'0.05em',marginBottom:'8px'}}>{m.label}</div>
            <div style={{fontSize:'28px',fontWeight:900,color:m.color}}>{m.val}</div>
          </Card>
        ))}
      </div>

      {/* Progress Bar */}
      <Card style={{padding:'20px 24px'}}>
        <div style={{display:'flex',justifyContent:'space-between',fontSize:'12px',fontWeight:600,color:'#6B7A99',marginBottom:'8px'}}>
          <span>{passedCount} of 7 stages completed</span>
          <span style={{color:'#0047CC',fontWeight:800}}>{overallProgress}%</span>
        </div>
        <div style={{height:'10px',background:'#F1F5F9',borderRadius:'6px',overflow:'hidden'}}>
          <div style={{height:'100%',width:`${overallProgress}%`,background:'linear-gradient(90deg,#0047CC,#10B981)',borderRadius:'6px',transition:'width 0.6s ease'}}/>
        </div>
      </Card>

      {/* Stage Cards */}
      <div style={{display:'flex',flexDirection:'column',gap:'12px'}}>
        {STAGE_META.map((meta,idx)=>{
          const sr=pipeline[idx]||{};
          const stat=sr.status||'pending';
          const isCurrent = stat === 'in_progress' || stat === 'needs_clarification';
          const ss=getStageUI(idx,stat,meta.color,sr.slaBreached);
          const tsa=resolveTalentSkillAssessment(sr.assessmentId, profile?.id, talentSkillAssessments);
          const canStartAssessment=isAssessmentSubmittable(tsa, profile?.id, skillAssessmentResults, sr.assessmentId);
          
          return(
            <Card key={idx} style={{padding:'20px',background:ss.bg,border:`1px solid ${isCurrent?meta.color:ss.border}`,boxShadow:isCurrent?`0 4px 20px ${meta.color}15`:'none', opacity: stat==='pending'?0.7:1}}>
              <div style={{display:'flex',alignItems:'flex-start',gap:'16px'}}>
                <div style={{width:'44px',height:'44px',borderRadius:'12px',flexShrink:0,background:(stat==='passed'||stat==='skipped')?'#10B981':stat==='failed'?'#EF4444':isCurrent?meta.color:'#E2E8F0',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'20px',boxShadow:isCurrent?`0 0 0 4px ${meta.color}20`:'none',color:(stat==='pending'||stat==='skipped')?'#64748B':'#fff'}}>
                  {(stat==='passed'||stat==='skipped')?'✓':stat==='failed'?'✗':stat==='pending'?'🔒':meta.icon}
                </div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',flexWrap:'wrap',gap:'8px'}}>
                    <div>
                      <div style={{fontSize:'14px',fontWeight:800,color:'#1A2340'}}>Stage {idx+1}: {meta.name}</div>
                      <div style={{fontSize:'11px',color:'#6B7A99',marginTop:'2px'}}>{meta.responsible} · {meta.desc}</div>
                    </div>
                    <div style={{display:'flex',alignItems:'center',gap:'8px',flexShrink:0}}>
                      {sr.score!=null&&<span style={{fontSize:'11px',fontWeight:800,color:ss.text,background:ss.bg,border:`1px solid ${ss.border}`,padding:'3px 8px',borderRadius:'20px'}}>{sr.score}/100</span>}
                      <span style={{fontSize:'11px',fontWeight:700,color:ss.text,background:'white',padding:'3px 10px',borderRadius:'20px',border:`1px solid ${ss.border}`}}>
                        {ss.label}
                      </span>
                    </div>
                  </div>
                  
                  {sr.notes&&stat!=='pending'&&<p style={{fontSize:'12px',color:'#6B7A99',margin:'10px 0 0 0',fontStyle:'italic',lineHeight:'1.5'}}>"{sr.notes}"</p>}
                  
                  {/* Stage 1 Clarification */}
                  {idx===0&&stat==='needs_clarification'&&(
                    <div style={{marginTop:'12px',padding:'12px',background:'#FFFBEB',borderRadius:'8px',border:'1px solid #FDE68A'}}>
                      <span style={{fontSize:'12px',color:'#D97706'}}>The Talent Manager requested clarification. Please check your Messages.</span>
                    </div>
                  )}

                  {/* Stage 2 Assessment action */}
                  {idx===1&&sr.assessmentId&&stat==='in_progress'&&canStartAssessment&&(
                    <div style={{marginTop:'12px',padding:'14px',background:'#F0F7FF',borderRadius:'10px',border:'1px solid #BFDBFE'}}>
                      <div style={{fontSize:'12px',fontWeight:700,color:'#1D4ED8',marginBottom:'6px'}}>📋 Skill Assessment Ready</div>
                      <p style={{fontSize:'11px',color:'#6B7A99',margin:'0 0 12px 0'}}>Complete all sections. If disconnected, you have a 15-minute grace period to resume.</p>
                      <button onClick={()=>onOpenAssessment&&onOpenAssessment(tsa?.id||sr.assessmentId)} style={{background:'linear-gradient(135deg,#0047CC,#3B82F6)',color:'#fff',border:'none',padding:'8px 18px',borderRadius:'8px',fontSize:'12px',fontWeight:800,cursor:'pointer',boxShadow:'0 2px 8px rgba(0,71,204,0.3)'}}>Start Assessment →</button>
                    </div>
                  )}

                  {/* Stage 3 Interview action */}
                  {idx===2&&stat==='in_progress'&&(sr.interviewDate||sr.interviewTime)&&(
                    <div style={{marginTop:'12px',padding:'14px',background:'#F8FAFC',borderRadius:'10px',border:'1px solid #E2E8F0'}}>
                      <div style={{fontSize:'12px',fontWeight:700,color:'#1A2340',marginBottom:'8px'}}>📅 Interview Scheduled</div>
                      <div style={{display:'flex',gap:'16px',fontSize:'12px',color:'#6B7A99',marginBottom:'10px'}}>
                        {sr.interviewDate&&<span>Date: <strong>{sr.interviewDate}</strong></span>}
                        {sr.interviewTime&&<span>Time: <strong>{sr.interviewTime}</strong></span>}
                      </div>
                      <div style={{display:'flex',gap:'10px'}}>
                        {sr.meetingLink&&<a href={sr.meetingLink} target="_blank" rel="noopener noreferrer" style={{display:'inline-block',background:'#8B5CF6',color:'#fff',textDecoration:'none',padding:'8px 16px',borderRadius:'8px',fontSize:'12px',fontWeight:700}}>Join Meeting →</a>}
                        <button style={{background:'#F1F5F9',color:'#475569',border:'none',padding:'8px 16px',borderRadius:'8px',fontSize:'12px',fontWeight:700,cursor:'pointer'}}>Request Reschedule</button>
                      </div>
                    </div>
                  )}

                  {/* Stage 4 Personality */}
                  {idx===3&&stat==='in_progress'&&(
                    <div style={{marginTop:'12px',padding:'12px',background:'#F0FDF4',borderRadius:'8px',border:'1px solid #BBF7D0'}}>
                      <button onClick={()=>handleAction('COMPLETE_STAGE_4', 3)} style={{background:'#10B981',color:'#fff',border:'none',padding:'8px 16px',borderRadius:'8px',fontSize:'12px',fontWeight:700,cursor:'pointer'}}>Take Personality Test</button>
                      <span style={{fontSize:'11px',color:'#6B7A99',marginLeft:'12px'}}>Takes ~15 mins. Non-blocking (Auto-advances in 48h).</span>
                    </div>
                  )}

                  {/* Stage 5 Remote Readiness */}
                  {idx===4&&stat==='in_progress'&&(
                    <div style={{marginTop:'12px',padding:'12px',background:'#FFF7ED',borderRadius:'8px',border:'1px solid #FFEDD5'}}>
                      <button onClick={()=>setStage5ModalOpen(true)} style={{background:'#F59E0B',color:'#fff',border:'none',padding:'8px 16px',borderRadius:'8px',fontSize:'12px',fontWeight:700,cursor:'pointer'}}>Submit Readiness Form</button>
                    </div>
                  )}

                  {/* Stage 6 Work Simulation */}
                  {idx===5&&stat==='in_progress'&&(
                    <div style={{marginTop:'12px',padding:'14px',background:'#FFF1F2',borderRadius:'10px',border:'1px solid #FECDD3'}}>
                      <div style={{fontSize:'12px',fontWeight:700,color:'#BE123C',marginBottom:'8px'}}>🔬 Work Simulation Assigned</div>
                      {stage6Active ? (
                        <div>
                          <div style={{fontSize:'24px',fontWeight:900,color:'#E11D48',fontVariantNumeric:'tabular-nums'}}>{formatTime(stage6TimeLeft)}</div>
                          <p style={{fontSize:'11px',color:'#BE123C',margin:'4px 0 12px'}}>Do not close this window. Timer continues server-side.</p>
                          <button onClick={()=>setStage6Active(false)} style={{background:'#E11D48',color:'#fff',border:'none',padding:'8px 16px',borderRadius:'8px',fontSize:'12px',fontWeight:700,cursor:'pointer'}}>Submit Work</button>
                        </div>
                      ) : (
                        <div>
                          <p style={{fontSize:'11px',color:'#9F1239',margin:'0 0 12px 0'}}>You have a 3-hour window. The timer starts immediately upon clicking.</p>
                          <button onClick={startStage6} style={{background:'#E11D48',color:'#fff',border:'none',padding:'8px 16px',borderRadius:'8px',fontSize:'12px',fontWeight:700,cursor:'pointer'}}>Start Simulation</button>
                        </div>
                      )}
                    </div>
                  )}
                  
                  {/* Stage 7 Classification Complete Banner */}
                  {idx===6&&stat==='passed'&&(
                    <div style={{marginTop:'12px',padding:'12px',background:'#F0FDF4',borderRadius:'8px',border:'1px solid #BBF7D0',color:'#15803D',fontSize:'12px',fontWeight:700}}>
                      You're fully vetted! Compliance documents are on their way for signature.
                    </div>
                  )}
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Stage 5 Modal Overlay */}
      {stage5ModalOpen && (
        <div style={{position:'fixed',top:0,left:0,right:0,bottom:0,background:'rgba(15,23,42,0.7)',backdropFilter:'blur(4px)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000}}>
          <Card style={{width:'90%',maxWidth:'500px',padding:'24px',display:'flex',flexDirection:'column',gap:'16px'}}>
            <h3 style={{margin:0,fontSize:'18px',fontWeight:800,color:'#1A2340'}}>Remote Work Readiness</h3>
            <p style={{margin:0,fontSize:'13px',color:'#6B7A99'}}>Complete this checklist to verify your infrastructure.</p>
            
            <div>
              <label style={{display:'block',fontSize:'12px',fontWeight:700,color:'#1A2340',marginBottom:'6px'}}>Internet Speed (Mbps)</label>
              <input type="number" value={form5.speed} onChange={e=>setForm5({...form5,speed:e.target.value})} style={{width:'100%',padding:'10px',borderRadius:'6px',border:'1px solid #E2E8F0'}} placeholder="e.g. 50" />
            </div>
            <label style={{display:'flex',alignItems:'center',gap:'8px',fontSize:'13px',color:'#1A2340'}}>
              <input type="checkbox" checked={form5.hardware} onChange={e=>setForm5({...form5,hardware:e.target.checked})} />
              I have backup power and verified hardware specs.
            </label>
            <label style={{display:'flex',alignItems:'center',gap:'8px',fontSize:'13px',color:'#1A2340'}}>
              <input type="checkbox" checked={form5.quiet} onChange={e=>setForm5({...form5,quiet:e.target.checked})} />
              I have a dedicated quiet workspace.
            </label>
            
            <div style={{display:'flex',justifyContent:'flex-end',gap:'12px',marginTop:'8px'}}>
              <button onClick={()=>setStage5ModalOpen(false)} style={{background:'transparent',border:'none',color:'#64748B',fontWeight:700,cursor:'pointer'}}>Cancel</button>
              <button onClick={()=>{
                handleAction('SUBMIT_STAGE_5', 4, { internetSpeedMbps: form5.speed, hasQuietWorkspace: form5.quiet });
                setStage5ModalOpen(false);
              }} disabled={!form5.speed || !form5.hardware || !form5.quiet} style={{background:'#F59E0B',color:'#fff',border:'none',padding:'8px 16px',borderRadius:'6px',fontWeight:700,cursor:(!form5.speed||!form5.hardware||!form5.quiet)?'not-allowed':'pointer',opacity:(!form5.speed||!form5.hardware||!form5.quiet)?0.5:1}}>
                Submit Form
              </button>
            </div>
          </Card>
        </div>
      )}

      {/* General Callout */}
      <Card style={{padding:'16px 20px',background:passedCount>=7?'#F0FDF4':'#EEF3FF',border:`1px solid ${passedCount>=7?'#BBF7D0':'rgba(0,71,204,0.15)'}`,display:'flex',alignItems:'center',gap:'14px'}}>
        <span style={{fontSize:'24px'}}>{passedCount>=7?'🎉':'📍'}</span>
        <div>
          <div style={{fontSize:'13px',fontWeight:800,color:'#1A2340'}}>{passedCount>=7?'Fully Vetted — Ready for Deployment!':'Your vetting is in progress'}</div>
          <div style={{fontSize:'12px',color:'#6B7A99',marginTop:'2px'}}>{passedCount>=7?'You have cleared all 7 stages. Our matching team will connect you with enterprise clients.':'Your assigned team will guide you through each stage. Check messages for updates.'}</div>
        </div>
      </Card>
    </div>
  );
};

// ─── Section: Scores & Grades ─────────────────────────────────────────────────
const ScoresGradesSection = ({ profile, skillAssessmentResults = [] }: { profile: any; skillAssessmentResults?: any[] }) => {
  const visibility = MOCK_PLATFORM_SETTINGS.globalScoreVisibility;
  if (visibility === 'hidden') return null;

  const scores = profile?.vettingScores || {};
  const compositeScore = Math.round(((scores.technical||0)*0.25)+((scores.workSimulation||0)*0.20)+((scores.behavioral||0)*0.15)+((scores.communication||0)*0.15)+((scores.personality||0)*0.10)+((scores.remoteReadiness||0)*0.10)+((scores.experience||0)*0.05));
  const grade = compositeScore>=85?'A+':compositeScore>=75?'A':compositeScore>=65?'B':compositeScore>=50?'C':'—';
  const gradeColor = grade==='A+'?'#10B981':grade==='A'?'#3B82F6':grade==='B'?'#F59E0B':grade==='C'?'#EF4444':'#94A3B8';

  const isGradeOnly = visibility === 'grade-only';

  const mockReviews = profile?.performanceReviews || [
    { cycleName: 'M1', score: 72, date: '2026-03-01' },
    { cycleName: 'M2', score: 78, date: '2026-04-01' },
    { cycleName: 'M3', score: 85, date: '2026-05-01' }
  ];

  const personality = profile?.personalitySnapshot || {
    workStyle: 'Autonomous Executer',
    communicationPreference: 'Asynchronous / Written',
    topStrengths: ['Analytical Thinking', 'Time Management', 'Adaptability']
  };

  const history = profile?.classificationHistory || [
    { date: '2026-01-15', previousGrade: '—', newGrade: 'B', reason: 'Initial Vetting' },
    { date: '2026-06-01', previousGrade: 'B', newGrade: 'A', reason: '6-Month Re-assessment' }
  ];

  const scoreCategories = [
    {label:'Technical Skill',key:'technical',weight:'25%',icon:'💻',color:'#3B82F6'},
    {label:'Work Simulation',key:'workSimulation',weight:'20%',icon:'🔬',color:'#F97316'},
    {label:'Behavioural',key:'behavioral',weight:'15%',icon:'🎙️',color:'#8B5CF6'},
    {label:'Communication',key:'communication',weight:'15%',icon:'💬',color:'#06B6D4'},
    {label:'Personality',key:'personality',weight:'10%',icon:'🧠',color:'#10B981'},
    {label:'Remote Readiness',key:'remoteReadiness',weight:'10%',icon:'🌐',color:'#F59E0B'},
    {label:'Experience',key:'experience',weight:'5%',icon:'📁',color:'#6B7A99'},
  ];

  const assignedTags = profile?.tags || ['Top 1%', 'React Expert', 'Self-Starter'];
  const isDeployed = profile?.vettingStatus === 'Deployed' || mockReviews.length > 0; // Mock check

  return (
    <div style={{display:'flex',flexDirection:'column',gap:'24px'}}>
      <div>
        <h2 style={{fontSize:'22px',fontWeight:800,color:'#1A2340',margin:'0 0 4px 0'}}>🏅 Scores & Grades</h2>
        <p style={{fontSize:'13px',color:'#6B7A99',margin:0}}>Your permanent, read-only scorecard and long-term performance trend.</p>
      </div>

      <div style={{display:'grid',gridTemplateColumns:'2fr 1fr',gap:'24px',alignItems:'start'}}>
        <div style={{display:'flex',flexDirection:'column',gap:'24px'}}>
          {/* Grade Hero Card */}
          <Card style={{background:'linear-gradient(135deg,#1A2340 0%,#0047CC 100%)',padding:'32px',borderRadius:'16px',display:'flex',alignItems:'center',gap:'32px',color:'white',border:'none'}}>
            <div style={{textAlign:'center',flexShrink:0}}>
              <div style={{fontSize:'72px',fontWeight:900,color:gradeColor,lineHeight:1,textShadow:'0 2px 16px rgba(0,0,0,0.3)'}}>{grade}</div>
              <div style={{fontSize:'12px',fontWeight:700,color:'rgba(255,255,255,0.6)',marginTop:'8px',textTransform:'uppercase',letterSpacing:'0.1em'}}>Overall Grade</div>
            </div>
            
            <div style={{flex:1}}>
              {!isGradeOnly && (
                <>
                  <div style={{fontSize:'14px',fontWeight:700,color:'rgba(255,255,255,0.8)',marginBottom:'6px'}}>Composite Score</div>
                  <div style={{fontSize:'40px',fontWeight:900,color:'white',lineHeight:1}}>{compositeScore}<span style={{fontSize:'20px',color:'rgba(255,255,255,0.5)'}}>/100</span></div>
                  <div style={{marginTop:'14px',height:'8px',background:'rgba(255,255,255,0.15)',borderRadius:'4px',overflow:'hidden'}}>
                    <div style={{height:'100%',width:`${compositeScore}%`,background:'linear-gradient(90deg,#3B82F6,#10B981)',borderRadius:'4px',transition:'width 0.8s ease'}}/>
                  </div>
                  <div style={{fontSize:'12px',color:'rgba(255,255,255,0.5)',marginTop:'8px'}}>Weighted across 7 vetting dimensions</div>
                </>
              )}
              {isGradeOnly && (
                <div style={{fontSize:'14px',color:'rgba(255,255,255,0.8)',lineHeight:1.6}}>
                  Your classification is based on the comprehensive 7-stage evaluation pipeline. Numerical score breakdowns are hidden per platform policy.
                </div>
              )}
            </div>
          </Card>

          {grade === 'B' && (
            <Card style={{padding:'20px',background:'#FFFBEB',border:'1px solid #FDE68A',display:'flex',gap:'16px',alignItems:'flex-start'}}>
              <span style={{fontSize:'24px'}}>📈</span>
              <div>
                <h4 style={{margin:'0 0 6px 0',fontSize:'14px',fontWeight:800,color:'#D97706'}}>Path to Grade A</h4>
                <p style={{margin:0,fontSize:'13px',color:'#92400E',lineHeight:1.6}}>
                  You're currently classified as "Trainable". Based on your evaluation, your biggest opportunity for improvement is in <strong>{scoreCategories.reduce((prev, curr) => (scores[curr.key]||0) < (scores[prev.key]||0) ? curr : prev).label}</strong>. We recommend focusing on upskilling in this area before requesting a re-assessment.
                </p>
              </div>
            </Card>
          )}

          {/* Performance Trend Chart */}
          {isDeployed && mockReviews.length > 0 && (
            <Card style={{padding:'24px'}}>
              <h3 style={{fontSize:'15px',fontWeight:800,color:'#1A2340',margin:'0 0 8px 0'}}>📈 Performance Trend</h3>
              <p style={{fontSize:'12px',color:'#6B7A99',margin:'0 0 24px 0'}}>Your composite performance score across completed Remotan review cycles.</p>
              
              <div style={{height:'250px',width:'100%'}}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={mockReviews} margin={{top:10,right:10,left:-20,bottom:0}}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                    <XAxis dataKey="cycleName" axisLine={false} tickLine={false} tick={{fill:'#6B7A99',fontSize:12,fontWeight:600}} dy={10} />
                    <YAxis domain={[50,100]} axisLine={false} tickLine={false} tick={{fill:'#6B7A99',fontSize:12,fontWeight:600}} />
                    <RechartsTooltip 
                      contentStyle={{borderRadius:'8px',border:'none',boxShadow:'0 4px 20px rgba(0,0,0,0.1)',fontSize:'13px',fontWeight:700,color:'#1A2340'}}
                      itemStyle={{color:'#0047CC'}}
                    />
                    <Line type="monotone" dataKey="score" stroke="#0047CC" strokeWidth={3} dot={{r:4,strokeWidth:2,fill:'#fff',stroke:'#0047CC'}} activeDot={{r:6,fill:'#0047CC'}} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Card>
          )}

          {/* Classification History */}
          {history.length > 1 && (
            <Card style={{padding:'24px'}}>
              <h3 style={{fontSize:'15px',fontWeight:800,color:'#1A2340',margin:'0 0 16px 0'}}>📜 Classification History</h3>
              <div style={{display:'flex',flexDirection:'column',gap:'12px'}}>
                {history.map((h:any, i:number) => (
                  <div key={i} style={{display:'flex',alignItems:'center',justifyContent:'space-between',paddingBottom:'12px',borderBottom:i!==history.length-1?'1px solid #F1F5F9':'none'}}>
                    <div>
                      <div style={{fontSize:'13px',fontWeight:700,color:'#1A2340'}}>{h.reason}</div>
                      <div style={{fontSize:'11px',color:'#6B7A99',marginTop:'4px'}}>{new Date(h.date).toLocaleDateString()}</div>
                    </div>
                    <div style={{display:'flex',alignItems:'center',gap:'8px'}}>
                      {h.previousGrade !== '—' && <span style={{fontSize:'12px',fontWeight:800,color:'#94A3B8'}}>{h.previousGrade}</span>}
                      {h.previousGrade !== '—' && <span style={{fontSize:'12px',color:'#CBD5E1'}}>→</span>}
                      <span style={{fontSize:'14px',fontWeight:900,color:'#10B981'}}>{h.newGrade}</span>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>

        <div style={{display:'flex',flexDirection:'column',gap:'24px'}}>
          {/* Tags */}
          <Card style={{padding:'24px'}}>
            <h3 style={{fontSize:'15px',fontWeight:800,color:'#1A2340',margin:'0 0 16px 0'}}>🏷️ Talent Tags</h3>
            <div style={{display:'flex',flexDirection:'column',gap:'12px'}}>
              {assignedTags.map((tag:string, i:number) => {
                const desc = MOCK_TAG_DICTIONARY[tag] || 'Tag assigned by the vetting team.';
                return (
                  <div key={i} style={{padding:'12px',background:'#F8FAFC',borderRadius:'8px',border:'1px solid #E2E8F0'}}>
                    <div style={{display:'inline-block',background:'#EEF3FF',color:'#0047CC',fontSize:'11px',fontWeight:800,padding:'4px 10px',borderRadius:'6px',marginBottom:'8px'}}>
                      {tag}
                    </div>
                    <p style={{margin:0,fontSize:'12px',color:'#475569',lineHeight:1.5}}>{desc}</p>
                  </div>
                );
              })}
              {assignedTags.length === 0 && (
                <div style={{fontSize:'12px',color:'#94A3B8',fontStyle:'italic'}}>No tags assigned yet.</div>
              )}
            </div>
          </Card>

          {/* Personality Snapshot */}
          <Card style={{padding:'24px',background:'linear-gradient(180deg,#F0FDF4 0%,#FFF 100%)',border:'1px solid #BBF7D0'}}>
            <h3 style={{fontSize:'15px',fontWeight:800,color:'#15803D',margin:'0 0 16px 0'}}>🧠 Personality Snapshot</h3>
            <div style={{display:'flex',flexDirection:'column',gap:'16px'}}>
              <div>
                <div style={{fontSize:'11px',fontWeight:700,color:'#166534',textTransform:'uppercase',letterSpacing:'0.05em',marginBottom:'4px'}}>Work Style</div>
                <div style={{fontSize:'13px',fontWeight:800,color:'#1A2340'}}>{personality.workStyle}</div>
              </div>
              <div>
                <div style={{fontSize:'11px',fontWeight:700,color:'#166534',textTransform:'uppercase',letterSpacing:'0.05em',marginBottom:'4px'}}>Communication</div>
                <div style={{fontSize:'13px',fontWeight:800,color:'#1A2340'}}>{personality.communicationPreference}</div>
              </div>
              <div>
                <div style={{fontSize:'11px',fontWeight:700,color:'#166534',textTransform:'uppercase',letterSpacing:'0.05em',marginBottom:'4px'}}>Top Strengths</div>
                <div style={{display:'flex',flexWrap:'wrap',gap:'6px',marginTop:'4px'}}>
                  {personality.topStrengths.map((str:string, i:number) => (
                    <span key={i} style={{background:'#DCFCE7',color:'#166534',fontSize:'11px',fontWeight:700,padding:'3px 8px',borderRadius:'4px'}}>{str}</span>
                  ))}
                </div>
              </div>
            </div>
          </Card>

          {/* Score Breakdown (Sidebar) */}
          {!isGradeOnly && (
            <Card style={{padding:'24px'}}>
              <h3 style={{fontSize:'15px',fontWeight:800,color:'#1A2340',margin:'0 0 20px 0'}}>Dimension Breakdown</h3>
              <div style={{display:'flex',flexDirection:'column',gap:'14px'}}>
                {scoreCategories.map((cat,i)=>{
                  const val=scores[cat.key as keyof typeof scores]||0;
                  const pct=Math.min(100,Number(val));
                  return(
                    <div key={i}>
                      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'6px'}}>
                        <span style={{fontSize:'13px',fontWeight:700,color:'#1A2340',display:'flex',alignItems:'center',gap:'8px'}}><span>{cat.icon}</span>{cat.label}</span>
                        <div style={{display:'flex',alignItems:'center',gap:'12px'}}>
                          <span style={{fontSize:'11px',color:'#94A3B8',fontWeight:600}}>Wt: {cat.weight}</span>
                          <span style={{fontSize:'13px',fontWeight:800,color:pct>0?cat.color:'#94A3B8'}}>{pct>0?`${pct}`:'—'}</span>
                        </div>
                      </div>
                      <div style={{height:'6px',background:'#F1F5F9',borderRadius:'3px',overflow:'hidden'}}>
                        <div style={{height:'100%',width:`${pct}%`,background:`linear-gradient(90deg,${cat.color}88,${cat.color})`,borderRadius:'3px',transition:'width 0.6s ease'}}/>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── Section: Earnings ────────────────────────────────────────────────────────
const EarningsSection = ({ profile, contracts = [] }: { profile: any; contracts?: any[] }) => {
  const activeContract = contracts.find((c:any)=>c.status==='Signed'||c.status==='Active');
  const totalEarned = contracts.reduce((sum:number,c:any)=>sum+(Number(c.totalEarned)||0),0);
  const nextPayout = activeContract?.nextPayout||0;
  const nextPayoutDate = activeContract?.nextPayoutDate||'—';
  const rateAmount = activeContract?.rateAmount||0;
  const rateType = activeContract?.rateType||'Monthly';

  const summaryCards = [
    {label:'Total Earned',val:`$${totalEarned.toLocaleString()}`,icon:'💰',color:'#10B981',sub:'All-time lifetime earnings'},
    {label:'Active Rate',val:rateAmount?`$${Number(rateAmount).toLocaleString()} / ${rateType}`:'No active contract',icon:'📊',color:'#0047CC',sub:'Current engagement rate'},
    {label:'Next Payout',val:nextPayout?`$${Number(nextPayout).toLocaleString()}`:'—',icon:'📅',color:'#8B5CF6',sub:nextPayoutDate!=='—'?`Due ${new Date(nextPayoutDate).toLocaleDateString()}`:'No upcoming payout'},
    {label:'Invoiced Balance',val:`$${Number(activeContract?.invoicedBalance||0).toLocaleString()}`,icon:'🧾',color:'#F59E0B',sub:'Outstanding invoiced amount'},
  ];

  return (
    <div style={{display:'flex',flexDirection:'column',gap:'24px'}}>
      <div>
        <h2 style={{fontSize:'22px',fontWeight:800,color:'#1A2340',margin:'0 0 4px 0'}}>💰 Earnings</h2>
        <p style={{fontSize:'13px',color:'#6B7A99',margin:0}}>Track your income, active rates, and upcoming payouts.</p>
      </div>

      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(200px,1fr))',gap:'16px'}}>
        {summaryCards.map((c,i)=>(
          <Card key={i} style={{padding:'20px',borderLeft:`4px solid ${c.color}`}}>
            <div style={{fontSize:'22px',marginBottom:'8px'}}>{c.icon}</div>
            <div style={{fontSize:'11px',fontWeight:700,color:'#6B7A99',textTransform:'uppercase',letterSpacing:'0.05em',marginBottom:'6px'}}>{c.label}</div>
            <div style={{fontSize:'22px',fontWeight:900,color:c.color,marginBottom:'4px'}}>{c.val}</div>
            <div style={{fontSize:'11px',color:'#94A3B8'}}>{c.sub}</div>
          </Card>
        ))}
      </div>

      {activeContract?(
        <Card style={{padding:'24px'}}>
          <h3 style={{fontSize:'15px',fontWeight:800,color:'#1A2340',margin:'0 0 16px 0'}}>📑 Active Contract</h3>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'12px'}}>
            {[
              {label:'Client',val:activeContract.clientName||'—'},
              {label:'Role',val:activeContract.role||'—'},
              {label:'Rate',val:`$${Number(activeContract.rateAmount||0).toLocaleString()} / ${activeContract.rateType||'Monthly'}`},
              {label:'Start Date',val:activeContract.startDate?new Date(activeContract.startDate).toLocaleDateString():'—'},
              {label:'Status',val:activeContract.status},
              {label:'Next Payout',val:activeContract.nextPayoutDate?new Date(activeContract.nextPayoutDate).toLocaleDateString():'—'},
            ].map((row,i)=>(
              <div key={i} style={{padding:'12px 16px',background:'#F8FAFC',borderRadius:'8px',border:'1px solid #E2E8F0'}}>
                <div style={{fontSize:'10px',fontWeight:700,color:'#94A3B8',textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:'4px'}}>{row.label}</div>
                <div style={{fontSize:'13px',fontWeight:700,color:'#1A2340'}}>{row.val}</div>
              </div>
            ))}
          </div>
        </Card>
      ):(
        <Card style={{padding:'48px',textAlign:'center',background:'#F8FAFC',border:'2px dashed #E2E8F0'}}>
          <div style={{fontSize:'48px',marginBottom:'12px'}}>💳</div>
          <div style={{fontSize:'15px',fontWeight:700,color:'#1A2340',marginBottom:'6px'}}>No Active Contract</div>
          <p style={{fontSize:'13px',color:'#6B7A99',margin:0}}>Your earnings and payment details will appear here once you have an active placement.</p>
        </Card>
      )}
    </div>
  );
};

// ─── Section: Tasks ───────────────────────────────────────────────────────────
const TasksSection = ({ profile }: { profile: any }) => {
  const sampleTasks = [
    {id:1,title:'Complete Onboarding Documents',desc:'Upload your NDA and background check forms to proceed.',priority:'High',due:'2024-07-15',status:'pending',tag:'Compliance'},
    {id:2,title:'Skill Assessment — Node.js',desc:'Complete your technical evaluation before the deadline.',priority:'High',due:'2024-07-20',status:'in_progress',tag:'Assessment'},
    {id:3,title:'Update Portfolio URL',desc:'Add your latest project links to your profile.',priority:'Medium',due:'2024-07-30',status:'pending',tag:'Profile'},
  ];
  const priorityColor: Record<string,string> = {High:'#EF4444',Medium:'#F59E0B',Low:'#10B981'};
  const statusColor: Record<string,string> = {pending:'#94A3B8',in_progress:'#0047CC',completed:'#10B981'};
  const statusLabel: Record<string,string> = {pending:'Pending',in_progress:'In Progress',completed:'Completed'};

  return (
    <div style={{display:'flex',flexDirection:'column',gap:'24px'}}>
      <div>
        <h2 style={{fontSize:'22px',fontWeight:800,color:'#1A2340',margin:'0 0 4px 0'}}>✅ Tasks</h2>
        <p style={{fontSize:'13px',color:'#6B7A99',margin:0}}>Action items and milestones assigned to you by the Kongila team.</p>
      </div>

      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'12px'}}>
        {[
          {label:'Total Tasks',val:sampleTasks.length,color:'#0047CC'},
          {label:'In Progress',val:sampleTasks.filter(t=>t.status==='in_progress').length,color:'#F59E0B'},
          {label:'Pending',val:sampleTasks.filter(t=>t.status==='pending').length,color:'#EF4444'},
        ].map((m,i)=>(
          <Card key={i} style={{padding:'16px',textAlign:'center',borderTop:`3px solid ${m.color}`}}>
            <div style={{fontSize:'28px',fontWeight:900,color:m.color}}>{m.val}</div>
            <div style={{fontSize:'11px',fontWeight:700,color:'#6B7A99',marginTop:'4px'}}>{m.label}</div>
          </Card>
        ))}
      </div>

      <div style={{display:'flex',flexDirection:'column',gap:'12px'}}>
        {sampleTasks.map(task=>(
          <Card key={task.id} style={{padding:'20px'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',flexWrap:'wrap',gap:'8px'}}>
              <div style={{flex:1,minWidth:0}}>
                <div style={{display:'flex',alignItems:'center',gap:'10px',marginBottom:'6px',flexWrap:'wrap'}}>
                  <span style={{fontSize:'14px',fontWeight:800,color:'#1A2340'}}>{task.title}</span>
                  <span style={{fontSize:'10px',fontWeight:700,padding:'2px 8px',borderRadius:'20px',background:`${priorityColor[task.priority]}15`,color:priorityColor[task.priority],border:`1px solid ${priorityColor[task.priority]}40`}}>{task.priority}</span>
                  <span style={{fontSize:'10px',fontWeight:700,padding:'2px 8px',borderRadius:'20px',background:'#EEF3FF',color:'#0047CC'}}>{task.tag}</span>
                </div>
                <p style={{fontSize:'13px',color:'#6B7A99',margin:'0 0 10px 0',lineHeight:'1.5'}}>{task.desc}</p>
                <div style={{fontSize:'11px',color:'#94A3B8',fontWeight:600}}>⏰ Due: {new Date(task.due).toLocaleDateString()}</div>
              </div>
              <span style={{fontSize:'11px',fontWeight:800,padding:'4px 12px',borderRadius:'20px',background:`${statusColor[task.status]}15`,color:statusColor[task.status],border:`1px solid ${statusColor[task.status]}30`,flexShrink:0}}>{statusLabel[task.status]}</span>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};

// ─── Section: Notifications ───────────────────────────────────────────────────
const NotificationsSection = ({ profile, notifications = [], setNotifications }: { profile: any; notifications?: any[]; setNotifications?: (n: any) => void }) => {
  const iconMap: Record<string,string> = {contract:'📄',compliance:'📋',match:'🎯',interview:'📅',assessment:'🧪',system:'🔔'};
  const colorMap: Record<string,string> = {contract:'#10B981',compliance:'#EF4444',match:'#0047CC',interview:'#8B5CF6',assessment:'#3B82F6',system:'#94A3B8'};
  const unread = notifications.filter((n:any)=>!n.read).length;

  const markAllRead = () => {
    if(setNotifications) setNotifications(notifications.map((n:any)=>({...n,read:true})));
  };

  const markRead = (id:any) => {
    if(setNotifications) setNotifications(notifications.map((n:any)=>n.id===id?{...n,read:true}:n));
  };

  return (
    <div style={{display:'flex',flexDirection:'column',gap:'24px'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-end',flexWrap:'wrap',gap:'12px'}}>
        <div>
          <h2 style={{fontSize:'22px',fontWeight:800,color:'#1A2340',margin:'0 0 4px 0'}}>🔔 Notifications</h2>
          <p style={{fontSize:'13px',color:'#6B7A99',margin:0}}>{unread} unread · {notifications.length} total</p>
        </div>
        {unread>0&&<button onClick={markAllRead} style={{background:'transparent',border:'1px solid #DDE2EC',color:'#6B7A99',padding:'8px 16px',borderRadius:'8px',fontSize:'12px',fontWeight:700,cursor:'pointer'}}>Mark all read</button>}
      </div>

      {notifications.length>0?(
        <div style={{display:'flex',flexDirection:'column',gap:'8px'}}>
          {notifications.map((n:any)=>{
            const type=n.type||'system';
            const bg=!n.read?'#F0F5FF':'#FFFFFF';
            const borderColor=!n.read?'#BFDBFE':'#DDE2EC';
            return(
              <div key={n.id} onClick={()=>markRead(n.id)} style={{display:'flex',alignItems:'flex-start',gap:'14px',padding:'16px 20px',background:bg,border:`1px solid ${borderColor}`,borderRadius:'12px',cursor:'pointer',transition:'all 0.15s'}}>
                <div style={{width:'40px',height:'40px',borderRadius:'10px',background:`${colorMap[type]||'#94A3B8'}15`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:'18px',flexShrink:0}}>{iconMap[type]||'🔔'}</div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:'8px'}}>
                    <div style={{fontSize:'13px',fontWeight:!n.read?800:600,color:'#1A2340'}}>{n.title}</div>
                    <div style={{fontSize:'11px',color:'#94A3B8',flexShrink:0}}>{n.time}</div>
                  </div>
                  <p style={{fontSize:'12px',color:'#6B7A99',margin:'4px 0 0 0',lineHeight:'1.5'}}>{n.message}</p>
                </div>
                {!n.read&&<div style={{width:'8px',height:'8px',borderRadius:'50%',background:'#0047CC',flexShrink:0,marginTop:'6px'}}/>}
              </div>
            );
          })}
        </div>
      ):(
        <Card style={{padding:'56px',textAlign:'center',background:'#F8FAFC',border:'2px dashed #E2E8F0'}}>
          <div style={{fontSize:'48px',marginBottom:'12px'}}>🔔</div>
          <div style={{fontSize:'15px',fontWeight:700,color:'#1A2340',marginBottom:'6px'}}>All Caught Up!</div>
          <p style={{fontSize:'13px',color:'#6B7A99',margin:0}}>You have no new notifications at this time.</p>
        </Card>
      )}
    </div>
  );
};

export default function TalentDashboard({
  currentUser,
  talentProfile,
  contracts,
  matches,
  clientRequests,
  allDocuments = [],
  dashboardNotifications,
  setDashboardNotifications,
  assessments = [],
  assessmentCategories = [],
  assessmentQuestions = [],
  talentSkillAssessments = [],
  skillAssessmentResults = [],
  onSubmitAssessment,
  onSignOut,
  onUpdateProfile,
  onUpdateMatch,
  onUpdateDocument
}: TalentDashboardProps) {

  const [activeSection, setActiveSection] = useState<Section>('dashboard');
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const pipeline = Array.isArray(talentProfile?.vettingPipeline) ? talentProfile.vettingPipeline : [];
  const passedCount = pipeline.filter((s: any) => s.status === 'passed' || s.status === 'skipped').length;
  const activeVettingStage = getActiveVettingStage(talentProfile);


  // ── Assessment engine session state
  const [activeAssessmentSession, setActiveAssessmentSession] = useState<{
    talentSkillAssessment: any;
    assessment: any;
  } | null>(null);

  // Notifications and messages state
  const [notifications, setNotifications] = useState([
    { id: 1, title: 'Contract Signed', message: 'Nexus Health signed your agreement.', time: '2h ago', read: false },
    { id: 2, title: 'Compliance Action', message: 'You have a document requiring review.', time: '5h ago', read: false },
    { id: 3, title: 'Radar Match', message: 'Successfully matched to Horizon Fintech.', time: '1d ago', read: true }
  ]);
  const [conversations, setConversations] = useState<any[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  
  const [showNotifDropdown, setShowNotifDropdown] = useState(false);
  const [showMsgDropdown, setShowMsgDropdown] = useState(false);

  // Reschedule state
  const [rescheduleModalOpen, setRescheduleModalOpen] = useState(false);
  const [rescheduleData, setRescheduleData] = useState<any>(null);
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleTime, setRescheduleTime] = useState('');
  const [rescheduleReason, setRescheduleReason] = useState('');

  const handleRequestReschedule = (interview: any) => {
    setRescheduleData(interview);
    setRescheduleDate('');
    setRescheduleTime('');
    setRescheduleReason('');
    setRescheduleModalOpen(true);
  };

  const submitRescheduleRequest = () => {
    if (onUpdateProfile && rescheduleData?.isVetting) {
      const pipeline = [...(talentProfile?.vettingPipeline || [])];
      pipeline[rescheduleData.stageIndex] = {
        ...pipeline[rescheduleData.stageIndex],
        rescheduleRequested: true,
        rescheduleReason: `${rescheduleDate} ${rescheduleTime} - ${rescheduleReason}`,
      };
      onUpdateProfile({ ...talentProfile, vettingPipeline: pipeline });
    } else if (onUpdateMatch && rescheduleData?.id) {
      onUpdateMatch({
        id: rescheduleData.id,
        status: 'Reschedule Requested',
        requestedDate: rescheduleDate,
        requestedTime: rescheduleTime,
        requestedNotes: rescheduleReason,
      });
    }
    setRescheduleModalOpen(false);
    alert('Reschedule request sent to admin.');
  };

  const effectiveNotifications = dashboardNotifications ?? notifications;
  const unreadNotifsCount = effectiveNotifications.filter(n => !n.read).length;
  const unreadByModule = effectiveNotifications.filter(n => !n.read).reduce((acc: any, n: any) => {
    const t = (n.title || '').toLowerCase();
    const m = (n.message || '').toLowerCase();
    if (t.includes('interview') || m.includes('interview')) acc['interviews'] = (acc['interviews'] || 0) + 1;
    else if (t.includes('contract') || m.includes('contract')) acc['contracts'] = (acc['contracts'] || 0) + 1;
    else if (t.includes('match') || m.includes('match') || t.includes('shortlist') || m.includes('shortlist') || t.includes('opportunity')) acc['opportunities'] = (acc['opportunities'] || 0) + 1;
    else if (t.includes('task') || m.includes('task')) acc['tasks'] = (acc['tasks'] || 0) + 1;
    else if (t.includes('stage') || m.includes('stage') || t.includes('vetting') || m.includes('vetted')) acc['vetting_progress'] = (acc['vetting_progress'] || 0) + 1;
    else if (t.includes('score') || m.includes('score') || t.includes('grad') || m.includes('grad')) acc['scores_grades'] = (acc['scores_grades'] || 0) + 1;
    else if (t.includes('document') || m.includes('document') || t.includes('compliance')) acc['compliance'] = (acc['compliance'] || 0) + 1;
    return acc;
  }, {});
  const unreadMessagesCount = messages.filter(m => !m.read).length;
  const { percentage: talentProfileCompletion, incompleteFields: talentProfileIncompleteFields } = countProfileCompletion(talentProfile);

  useEffect(() => {
    if (dashboardNotifications !== undefined) {
      setNotifications(dashboardNotifications);
    }
  }, [dashboardNotifications]);

  const syncNotifications = (nextNotifications: any[]) => {
    setNotifications(nextNotifications);
    if (setDashboardNotifications) {
      setDashboardNotifications(nextNotifications);
    }
  };

  const markAllNotifsRead = () => {
    const nextNotifications = effectiveNotifications.map(n => ({ ...n, read: true }));
    syncNotifications(nextNotifications);
  };

  const markAllMessagesRead = () => {
    setMessages(messages.map(m => ({ ...m, read: true })));
  };

  const openAssessmentSession = async (tsaId: string) => {
    let tsa = resolveTalentSkillAssessment(tsaId, talentProfile?.id, talentSkillAssessments)
      || talentSkillAssessments.find((t: any) => t.id === tsaId || t.assessmentId === tsaId || t.assessment_id === tsaId);

    const asmntRef = tsa?.assessmentId || tsa?.assessment_id || tsaId || activeVettingStage?.assessmentId;
    let asmnt = assessments.find((a: any) => a.id === asmntRef || a.id === tsaId || a.id === activeVettingStage?.assessmentId);

    if (!asmnt) {
      try {
        const res = await fetch('/api/db');
        if (res.ok) {
          const fetchedData = await res.json();
          const allAsmnts = fetchedData.assessments || [];
          asmnt = allAsmnts.find((a: any) => a.id === asmntRef || a.id === tsaId || a.id === activeVettingStage?.assessmentId)
            || allAsmnts.find((a: any) => a.status === 'published');
        }
      } catch (err) {
        console.error('Failed to fetch fallback assessments:', err);
      }
    }

    if (!asmnt) {
      alert("Unable to load assessment data. Please refresh or contact support.");
      return;
    }

    if (!tsa) {
      tsa = {
        id: `tsa_${talentProfile?.id || 'talent'}_${asmnt.id}`,
        talentId: talentProfile?.id,
        assessmentId: asmnt.id,
        assignedAt: activeVettingStage?.started_at || new Date().toISOString(),
        status: 'assigned'
      };
    }

    if (!isAssessmentSubmittable(tsa, talentProfile?.id, skillAssessmentResults, asmnt.id)) return;

    setActiveAssessmentSession({ talentSkillAssessment: tsa, assessment: asmnt });
  };

  const renderSection = () => {
    const talentContracts = contracts.filter((c: any) => c.talentId === talentProfile?.id || c.talentName === talentProfile?.name);
    const talentMatches = matches.filter((m: any) => m.talentId === talentProfile?.id || m.talentName === talentProfile?.name);

    const globalMandatoryDocs = allDocuments.filter(d => d.isMandatory && !d.isHidden && (!d.userId || d.userId === ''));
    const pendingDocs = globalMandatoryDocs.filter(gdoc => {
      return !talentProfile?.documents?.some((doc: any) => doc.templateId === gdoc.id || doc.name === gdoc.name);
    });

    switch (activeSection) {
      case 'dashboard':    return <ProfileSection
        user={currentUser}
        profile={talentProfile}
        contracts={talentContracts}
        matches={talentMatches}
        pendingDocs={pendingDocs}
        skillAssessmentResults={skillAssessmentResults}
        talentSkillAssessments={talentSkillAssessments}
        dashboardNotifications={effectiveNotifications}
        setActiveSection={setActiveSection}
        onOpenAssessment={openAssessmentSession}
      />;
      case 'profile':          return <ProfileDetailSection user={currentUser} profile={talentProfile} contracts={talentContracts} onUpdateProfile={onUpdateProfile} />;
      case 'compliance':       return <ComplianceSection profile={talentProfile} allDocuments={allDocuments} onUpdateProfile={onUpdateProfile} onUpdateDocument={onUpdateDocument} />;
      case 'vetting_progress':
        return <VettingProgressSection profile={talentProfile} talentSkillAssessments={talentSkillAssessments} skillAssessmentResults={skillAssessmentResults} onOpenAssessment={openAssessmentSession} onUpdateProfile={onUpdateProfile} />;
      case 'scores_grades':    return <ScoresGradesSection profile={talentProfile} skillAssessmentResults={skillAssessmentResults} />;
      case 'opportunities':    return <PipelineSection profile={talentProfile} matches={matches} clientRequests={clientRequests || []} onUpdateMatch={onUpdateMatch} />;
      case 'interviews':       return <InterviewsSection />;
      case 'contracts':        return <ContractSection profile={talentProfile} />;
      case 'earnings':         return <EarningsSection profile={talentProfile} contracts={talentContracts} />;
      case 'tasks':            return <TasksSection profile={talentProfile} />;
      case 'messages':
        return (
          <TalentMessagesPanel
            currentUser={currentUser}
            conversations={conversations}
            messages={messages}
            setMessages={setMessages || (() => {})}
          />
        );
      case 'notifications':
        return (
          <TalentNotificationsPanel
            notifications={effectiveNotifications}
            setNotifications={syncNotifications}
            setActiveSection={setActiveSection}
          />
        );
      case 'settings':         return <TalentSettingsPanel profile={talentProfile} onUpdateProfile={onUpdateProfile} />;
      case 'support':          return <TalentSupportPanel currentUser={currentUser} profile={talentProfile} supportTickets={talentProfile?.supportTickets || []} setSupportTickets={(val) => { if(onUpdateProfile) onUpdateProfile({...talentProfile, supportTickets: typeof val === 'function' ? val(talentProfile?.supportTickets || []) : val}) }} />;
    }
  };

  return (
    <>
    {/* ── Assessment Engine Overlay ── */}
    {activeAssessmentSession && (
      <SkillAssessmentEngine
        talentProfile={talentProfile}
        talentSkillAssessment={activeAssessmentSession.talentSkillAssessment}
        assessment={activeAssessmentSession.assessment}
        categories={assessmentCategories}
        questions={assessmentQuestions}
        onSubmit={async (result) => {
          if (onSubmitAssessment) await onSubmitAssessment(result);
          setActiveAssessmentSession(null);
        }}
        onClose={() => setActiveAssessmentSession(null)}
      />
    )}
    <div className="dashboard-shell" style={{ display: 'flex', minHeight: '100vh', background: '#F5F7FA', fontFamily: 'var(--font-display, Inter, sans-serif)' }}>

      {/* ── Mobile Top Nav ── */}
      <div className="mobile-nav-bar">
        <button className="mobile-hamburger" onClick={() => setMobileSidebarOpen(!mobileSidebarOpen)} style={{ padding: '8px 0' }}>
          <span></span><span></span><span></span>
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 800, color: '#0047CC', fontSize: '18px' }}>
          <div style={{ width: '24px', height: '24px', background: '#0047CC', color: 'white', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px' }}>K</div>
          Kongila
        </div>
        <div 
          style={{ width: '32px', height: '32px', borderRadius: '50%', overflow: 'hidden', border: '1px solid #DDE2EC', cursor: 'pointer', flexShrink: 0 }}
          onClick={() => { setActiveSection('profile'); setMobileSidebarOpen(false); }}
        >
          <img 
            src={talentProfile?.profilePhotoUrl || talentProfile?.avatar || currentUser?.avatar || "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=80"}
            alt="Profile"
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        </div>
      </div>

      {/* ── Mobile Sidebar Drawer ── */}
      {mobileSidebarOpen && (
        <>
          <div 
            onClick={() => setMobileSidebarOpen(false)}
            style={{
              position: 'fixed', inset: 0, background: 'rgba(0, 0, 0, 0.4)', zIndex: 299, backdropFilter: 'blur(4px)'
            }} 
          />
          <aside className="mobile-sidebar-drawer open" style={{
            position: 'fixed', top: 0, bottom: 0, left: 0, width: '280px',
            background: '#FFFFFF', borderRight: '1px solid #DDE2EC',
            display: 'flex', flexDirection: 'column', padding: '24px 16px',
            zIndex: 300, overflowY: 'auto'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', paddingBottom: '16px', borderBottom: '1px solid #F5F7FA' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  width: '32px', height: '32px', borderRadius: '8px', background: '#0047CC',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 900
                }}>K</div>
                <div style={{ fontSize: '14px', fontWeight: 800, color: '#1A2340' }}>Talent Portal</div>
              </div>
              <button onClick={() => setMobileSidebarOpen(false)} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer' }}>✕</button>
            </div>
            
            <nav style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
              {NAV_ITEMS.map(item => {
                if (item.id === 'scores_grades' && MOCK_PLATFORM_SETTINGS.globalScoreVisibility === 'hidden') return null;

                const isLocked = item.id === 'scores_grades' && passedCount < 7;
                const isActive = activeSection === item.id;
                const complianceCount = item.id === 'compliance'
                  ? allDocuments.filter(d => d.isMandatory && !d.isHidden && (!d.userId || d.userId === '')).filter(gdoc => !talentProfile?.documents?.some((doc: any) => doc.templateId === gdoc.id || doc.name === gdoc.name)).length
                  : 0;
                const unreadBadgeCount = item.id === 'notifications' ? unreadNotifsCount : (item.id === 'messages' ? unreadMessagesCount : (unreadByModule[item.id] || 0));
                return (
                  <button
                    key={item.id}
                    title={isLocked ? 'Complete Stage 7 Vetting to unlock' : ''}
                    disabled={isLocked}
                    onClick={() => {
                      if (isLocked) return;
                      setActiveSection(item.id);
                      setMobileSidebarOpen(false);
                    }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '10px',
                      padding: '12px', borderRadius: '8px', border: 'none',
                      background: isActive ? '#EEF3FF' : 'transparent',
                      color: isActive ? '#0047CC' : '#6B7A99',
                      fontWeight: isActive ? 700 : 500,
                      fontSize: '14px', cursor: isLocked ? 'not-allowed' : 'pointer', textAlign: 'left',
                      width: '100%',
                      opacity: isLocked ? 0.4 : 1
                    }}
                  >
                    <SidebarIcon id={item.id} color={isActive ? '#0047CC' : '#6B7A99'} size={16} />
                    {item.label}
                    {isLocked && <span style={{marginLeft:'auto',fontSize:'12px'}}>🔒</span>}
                    {complianceCount > 0 && !isLocked && (
                      <span style={{ marginLeft: 'auto', background: '#EF4444', color: '#fff', fontSize: '10px', fontWeight: 800, padding: '2px 6px', borderRadius: '10px' }}>
                        {complianceCount}
                      </span>
                    )}
                    {unreadBadgeCount > 0 && !isLocked && (
                      <span style={{ marginLeft: 'auto', background: '#EF4444', color: '#fff', fontSize: '10px', fontWeight: 800, padding: '2px 6px', borderRadius: '10px' }}>
                        {unreadBadgeCount}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: 'auto', borderTop: '1px solid #F5F7FA', paddingTop: '16px' }}>
              <button onClick={() => { onSignOut?.(); setMobileSidebarOpen(false); }} style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                background: 'transparent', border: 'none', color: '#EF4444',
                fontSize: '14px', fontWeight: 600, cursor: 'pointer', textAlign: 'left', padding: '8px',
                width: '100%'
              }}>
                <SidebarIcon id="logout" color="#EF4444" size={16} />
                Logout
              </button>
            </div>
          </aside>
        </>
      )}

      {/* ── Desktop Sidebar ── */}
      <aside className="desktop-sidebar" style={{
        width: '240px', flexShrink: 0,
        background: '#FFFFFF',
        borderRight: '1px solid #DDE2EC',
        display: 'flex', flexDirection: 'column',
        padding: '24px 12px',
        position: 'sticky', top: 0, height: '100vh', overflowY: 'auto'
      }}>
        {/* User badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '0 8px 20px', borderBottom: '1px solid #F5F7FA', marginBottom: '12px' }}>
          <div style={{
            width: '36px', height: '36px', borderRadius: '8px',
            background: '#0047CC',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontWeight: 900, fontSize: '20px', flexShrink: 0
          }}>
            K
          </div>
          <div style={{ overflow: 'hidden' }}>
            <div style={{ fontSize: '14px', fontWeight: 800, color: '#1A2340' }}>Talent Portal</div>
            <div style={{ fontSize: '11px', color: '#6B7A99' }}>Enterprise Operations</div>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ display: 'flex', flexDirection: 'column', gap: '2px', flex: 1 }}>
          {NAV_ITEMS.map(item => {
            if (item.id === 'scores_grades' && MOCK_PLATFORM_SETTINGS.globalScoreVisibility === 'hidden') return null;

            const isLocked = item.id === 'scores_grades' && passedCount < 7;
            const isActive = activeSection === item.id;
            const complianceCount = item.id === 'compliance'
              ? allDocuments.filter(d => d.isMandatory && !d.isHidden && (!d.userId || d.userId === '')).filter(gdoc => !talentProfile?.documents?.some((doc: any) => doc.templateId === gdoc.id || doc.name === gdoc.name)).length
              : 0;
            const unreadBadgeCount = item.id === 'notifications' ? unreadNotifsCount : (item.id === 'messages' ? unreadMessagesCount : (unreadByModule[item.id] || 0));
            return (
              <button
                key={item.id}
                title={isLocked ? 'Complete Stage 7 Vetting to unlock' : ''}
                disabled={isLocked}
                onClick={() => {
                  if (!isLocked) setActiveSection(item.id);
                }}
                style={{
                  display: 'flex', alignItems: 'center', gap: '10px',
                  padding: '10px 12px', borderRadius: '8px', border: 'none',
                  background: isActive ? '#EEF3FF' : 'transparent',
                  color: isActive ? '#0047CC' : '#6B7A99',
                  fontWeight: isActive ? 700 : 500,
                  fontSize: '13px', cursor: isLocked ? 'not-allowed' : 'pointer', textAlign: 'left',
                  transition: 'all 0.15s',
                  width: '100%',
                  opacity: isLocked ? 0.4 : 1
                }}
              >
                <SidebarIcon id={item.id} color={isActive ? '#0047CC' : '#6B7A99'} size={15} />
                {item.label}
                {isLocked && <span style={{marginLeft:'auto',fontSize:'12px'}}>🔒</span>}
                {complianceCount > 0 && !isLocked && (
                  <span style={{ marginLeft: 'auto', background: '#EF4444', color: '#fff', fontSize: '10px', fontWeight: 800, padding: '2px 6px', borderRadius: '10px' }}>
                    {complianceCount}
                  </span>
                )}
                {unreadBadgeCount > 0 && !isLocked && (
                  <span style={{ marginLeft: 'auto', background: '#EF4444', color: '#fff', fontSize: '10px', fontWeight: 800, padding: '2px 6px', borderRadius: '10px' }}>
                    {unreadBadgeCount}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Bottom Actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: 'auto' }}>
          {/* Update Availability Button */}
              <button style={{
            background: '#0047CC', color: '#fff', border: 'none', borderRadius: '8px',
            padding: '12px', fontSize: '13px', fontWeight: 700, cursor: 'pointer',
            marginBottom: '16px', width: '100%', textAlign: 'center'
          }}>
            Update Availability
          </button>
          <button onClick={() => onSignOut?.()} style={{
            background: 'transparent', color: '#EF4444', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '8px',
            padding: '12px', fontSize: '13px', fontWeight: 700, cursor: 'pointer',
            width: '100%', textAlign: 'center'
          }}>
            Sign out
          </button>


        </div>

        {/* Bottom label */}
        <div style={{ padding: '16px 8px 0', borderTop: '1px solid #F5F7FA', fontSize: '11px', color: '#6B7A99', marginTop: '12px' }}>
          Kongila Talent Portal · v1.0
        </div>
      </aside>

      {/* ── Main Content Wrapper ── */}
      <div className="dashboard-content-area" style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
        
        {/* ── Top Bar ── */}
        <header className="desktop-header" style={{
          height: '70px', background: '#FFFFFF', borderBottom: '1px solid #DDE2EC',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 48px', flexShrink: 0, position: 'relative', zIndex: 10
        }}>
          {/* Left: Breadcrumbs */}
          <div style={{ fontSize: '13px', color: '#6B7A99', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>Talent Dashboard</span>
            <span style={{ color: '#DDE2EC' }}>›</span>
            <span style={{ color: '#1A2340', fontWeight: 700 }}>
              {NAV_ITEMS.find(n => n.id === activeSection)?.label}
            </span>
          </div>

          {/* Right: Actions, Badges & Profile */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px', position: 'relative' }}>
            
            {/* Messages Icon */}
            <div 
              style={{ position: 'relative', cursor: 'pointer', padding: '6px' }}
              onClick={() => {
                setShowMsgDropdown(!showMsgDropdown);
                setShowNotifDropdown(false);
              }}
            >
              <span style={{ fontSize: '20px' }}>💬</span>
              {unreadMessagesCount > 0 && (
                <span style={{
                  position: 'absolute', top: '0', right: '0',
                  background: '#EF4444', color: '#FFFFFF', fontSize: '9px', fontWeight: 800,
                  width: '15px', height: '15px', borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                  {unreadMessagesCount}
                </span>
              )}

              {/* Messages Dropdown */}
              {showMsgDropdown && (
                <div style={{
                  position: 'absolute', top: '45px', right: '-80px', width: '320px',
                  background: '#FFFFFF', borderRadius: '12px', border: '1px solid #DDE2EC',
                  boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)',
                  padding: '16px', zIndex: 100
                }} onClick={e => e.stopPropagation()}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', borderBottom: '1px solid #F1F5F9', paddingBottom: '8px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 800, color: '#1A2340' }}>Recent Messages</span>
                    <button 
                      onClick={() => { markAllMessagesRead(); setShowMsgDropdown(false); }}
                      style={{ background: 'none', border: 'none', color: '#0047CC', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}
                    >
                      Mark all read
                    </button>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '240px', overflowY: 'auto' }}>
                    {messages.map(msg => (
                      <div key={msg.id} style={{ display: 'flex', gap: '10px', padding: '8px', borderRadius: '6px', background: msg.read ? 'transparent' : '#F4F7FF' }}>
                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: msg.read ? 'transparent' : '#0047CC', marginTop: '5px', flexShrink: 0 }} />
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                            <span style={{ fontSize: '12px', fontWeight: 700, color: '#1A2340' }}>{msg.sender}</span>
                            <span style={{ fontSize: '10px', color: '#6B7A99' }}>{msg.time}</span>
                          </div>
                          <p style={{ fontSize: '11px', color: '#4E5D78', margin: '2px 0 0 0', lineHeight: 1.4 }}>{msg.text}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Notifications Icon */}
            <div 
              style={{ position: 'relative', cursor: 'pointer', padding: '6px' }}
              onClick={() => {
                setShowNotifDropdown(!showNotifDropdown);
                setShowMsgDropdown(false);
              }}
            >
              <span style={{ fontSize: '20px' }}>🔔</span>
              {unreadNotifsCount > 0 && (
                <span style={{
                  position: 'absolute', top: '0', right: '0',
                  background: '#EF4444', color: '#FFFFFF', fontSize: '9px', fontWeight: 800,
                  width: '15px', height: '15px', borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                  {unreadNotifsCount}
                </span>
              )}

              {/* Notifications Dropdown */}
              {showNotifDropdown && (
                <div style={{
                  position: 'absolute', top: '45px', right: '-40px', width: '320px',
                  background: '#FFFFFF', borderRadius: '12px', border: '1px solid #DDE2EC',
                  boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)',
                  padding: '16px', zIndex: 100
                }} onClick={e => e.stopPropagation()}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', borderBottom: '1px solid #F1F5F9', paddingBottom: '8px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 800, color: '#1A2340' }}>Notifications</span>
                    <button 
                      onClick={() => { markAllNotifsRead(); setShowNotifDropdown(false); }}
                      style={{ background: 'none', border: 'none', color: '#0047CC', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}
                    >
                      Mark all read
                    </button>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '240px', overflowY: 'auto' }}>
                    {effectiveNotifications.map(notif => (
                      <div key={notif.id} style={{ display: 'flex', gap: '10px', padding: '8px', borderRadius: '6px', background: notif.read ? 'transparent' : '#F4F7FF' }}>
                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: notif.read ? 'transparent' : '#0047CC', marginTop: '5px', flexShrink: 0 }} />
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                            <span style={{ fontSize: '12px', fontWeight: 700, color: '#1A2340' }}>{notif.title}</span>
                            <span style={{ fontSize: '10px', color: '#6B7A99' }}>{notif.time}</span>
                          </div>
                          <p style={{ fontSize: '11px', color: '#4E5D78', margin: '2px 0 0 0', lineHeight: 1.4 }}>{notif.message}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Profile Avatar */}
            <div 
              style={{ display: 'flex', alignItems: 'center', gap: '10px', borderLeft: '1px solid #DDE2EC', paddingLeft: '20px', cursor: 'pointer' }}
              onClick={() => setActiveSection('profile')}
            >
              <div style={{ position: 'relative' }}>
                <img
                  src={talentProfile?.profilePhotoUrl || talentProfile?.avatar || currentUser?.avatar || "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=80"}
                  alt="Profile"
                  style={{ width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover' }}
                />
                <span style={{
                  position: 'absolute', bottom: '0', right: '0',
                  width: '10px', height: '10px', borderRadius: '50%',
                  background: '#10B981', border: '2px solid #FFFFFF'
                }} />
              </div>
              <span style={{ fontSize: '13px', fontWeight: 700, color: '#1A2340' }}>
                {talentProfile?.name || currentUser?.name || 'Talent User'}
              </span>
              <button
                onClick={() => onSignOut?.()}
                style={{
                  background: 'transparent',
                  color: '#EF4444',
                  border: '1px solid rgba(239, 68, 68, 0.18)',
                  borderRadius: '999px',
                  padding: '8px 12px',
                  fontSize: '12px',
                  fontWeight: 800,
                  cursor: 'pointer',
                }}
              >
                Sign out
              </button>
            </div>

          </div>
        </header>

        {/* ── Main Scroll View ── */}
        <main className="dashboard-main-content" style={{ background: '#F5F7FA' }}>
          {renderSection()}
        </main>

      </div>

      {/* ── Mobile Bottom Nav ── */}
      <div className="mobile-bottom-nav">
        {NAV_ITEMS.slice(0, 4).map(item => {
          const isActive = activeSection === item.id;
          const unreadBadgeCount = item.id === 'notifications' ? unreadNotifsCount : (item.id === 'messages' ? unreadMessagesCount : (unreadByModule[item.id] || 0));
          return (
            <button 
              key={item.id}
              className={`mobile-bottom-nav-item ${isActive ? 'active' : ''}`}
              onClick={() => setActiveSection(item.id)}
              style={{ position: 'relative' }}
            >
              <SidebarIcon id={item.id} color={isActive ? '#0047CC' : '#6B7A99'} size={18} />
              <span style={{ marginTop: '2px', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', width: '100%', textAlign: 'center' }}>
                {item.label.split(' ')[0]}
              </span>
              {unreadBadgeCount > 0 && (
                <span style={{
                  position: 'absolute',
                  top: '6px',
                  right: '18px',
                  background: '#EF4444',
                  color: '#FFFFFF',
                  fontSize: '9px',
                  fontWeight: 800,
                  minWidth: '15px',
                  height: '15px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  {unreadBadgeCount}
                </span>
              )}
            </button>
          );
        })}
        <button className="mobile-bottom-nav-item" onClick={() => setActiveSection('settings')}>
          <SidebarIcon id="settings" color={activeSection === 'settings' ? '#0047CC' : '#6B7A99'} size={18} />
          <span style={{ marginTop: '2px' }}>More</span>
        </button>
      </div>

      {rescheduleModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15,23,42,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '24px' }}>
          <div style={{ background: '#fff', padding: '32px', borderRadius: '24px', width: '100%', maxWidth: '440px' }}>
            <h3 style={{ margin: '0 0 8px 0', fontSize: '20px', fontWeight: 900, color: '#1A2340' }}>Request Reschedule</h3>
            <p style={{ margin: '0 0 24px 0', fontSize: '13px', color: '#6B7A99' }}>Choose a new date and time that works for you, and tell us why you need to reschedule.</p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '24px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 700, color: '#6B7A99', marginBottom: '8px', display: 'block' }}>Preferred New Date</label>
                <input type="date" value={rescheduleDate} onChange={e => setRescheduleDate(e.target.value)} style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #DDE2EC', fontSize: '14px' }} />
              </div>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 700, color: '#6B7A99', marginBottom: '8px', display: 'block' }}>Preferred New Time</label>
                <input type="time" value={rescheduleTime} onChange={e => setRescheduleTime(e.target.value)} style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #DDE2EC', fontSize: '14px' }} />
              </div>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 700, color: '#6B7A99', marginBottom: '8px', display: 'block' }}>Reason for Rescheduling</label>
                <textarea value={rescheduleReason} onChange={e => setRescheduleReason(e.target.value)} rows={3} placeholder="Please explain why you need to reschedule..." style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #DDE2EC', fontSize: '14px', resize: 'none' }} />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button onClick={() => setRescheduleModalOpen(false)} style={{ flex: 1, padding: '12px', background: '#F5F7FA', color: '#475569', border: 'none', borderRadius: '10px', fontWeight: 700, cursor: 'pointer' }}>Cancel</button>
              <button onClick={submitRescheduleRequest} disabled={!rescheduleDate || !rescheduleTime || !rescheduleReason} style={{ flex: 2, padding: '12px', background: (!rescheduleDate || !rescheduleTime || !rescheduleReason) ? '#94A3B8' : '#0047CC', color: '#fff', border: 'none', borderRadius: '10px', fontWeight: 700, cursor: (!rescheduleDate || !rescheduleTime || !rescheduleReason) ? 'not-allowed' : 'pointer' }}>Submit Request</button>
            </div>
          </div>
        </div>
      )}
    </div>
  </>
  );
}
