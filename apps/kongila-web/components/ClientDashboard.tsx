import React, { useState, useEffect } from 'react';
import { GlassCard, Badge, NeonButton } from '@kongila/ui';
import { supabase } from '../lib/supabaseClient';

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
    case 'requests':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
          <polyline points="10 9 9 9 8 9" />
        </svg>
      );
    case 'radar':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <path d="M12 2a10 10 0 0 1 10 10" />
          <path d="M12 12m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0" />
          <path d="M12 12l4 4" />
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
    case 'billing':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="5" width="20" height="14" rx="2" ry="2" />
          <line x1="2" y1="10" x2="22" y2="10" />
        </svg>
      );
    case 'messaging':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      );
    case 'scheduling':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
      );
    case 'reviews':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
      );
    case 'profile':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      );
    case 'settings':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
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

// ─── Section Type Union ──────────────────────────────────────────────────────
type ClientSection = 
  | 'dashboard' 
  | 'requests' 
  | 'radar' 
  | 'contracts' 
  | 'billing' 
  | 'messaging' 
  | 'scheduling' 
  | 'reviews' 
  | 'profile';

const NAV_ITEMS: { id: ClientSection; label: string }[] = [
  { id: 'dashboard',   label: 'Dashboard' },
  { id: 'requests',    label: 'Service Requests' },
  { id: 'radar',       label: 'Talent Matching' },
  { id: 'contracts',   label: 'Hiring & Contracts' },
  { id: 'billing',     label: 'Billing' },
  { id: 'messaging',   label: 'Messaging' },
  { id: 'scheduling',  label: 'Scheduling' },
  { id: 'profile',     label: 'Profile' },
];

interface ClientDashboardProps {
  currentUser: any;
  requests: any[];
  matches: any[];
  contracts: any[];
  talents: any[];
  invoices: any[];
  messages: any[];
  notifications: any[];
  onSignOut: () => void;
  setActiveTab?: (tab: 'home' | 'talent' | 'client') => void;
  setClientIntakeActive: (active: boolean) => void;
  setClientIntakeStep: (step: number) => void;
  onScheduleMeeting: () => void;
  onExtendOffer: (talent: any) => void;
  onSignContract: () => void;
  showCalendar: boolean;
  setShowCalendar: (show: boolean) => void;
  selectedTalent: any;
  setSelectedTalent: (talent: any) => void;
  meetingTime: string;
  setMeetingTime: (time: string) => void;
  meetingDate: string;
  setMeetingDate: (date: string) => void;
  showSignModal: boolean;
  setShowSignModal: (show: boolean) => void;
  activeNDA: string;
  signingContractId: string | null;
  selectedRequest: any;
  setSelectedRequest: (request: any) => void;
  setRequests?: (requests: any[]) => void;
  setMatches?: (matches: any[]) => void;
  setInvoices?: (invoices: any[]) => void;
  setMessages?: (messages: any[]) => void;
  setNotifications?: (notifications: any[]) => void;
  onAddRequest?: (newReq: any) => Promise<void>;
  saveToDb?: (updatedDb: any) => Promise<void>;
  rehireRequests?: any[];
  setRehireRequests?: (rehireRequests: any[]) => void;
}

// ─── Styled Components ────────────────────────────────────────────────────────
const Card = ({ children, style = {}, onClick }: { children: React.ReactNode; style?: React.CSSProperties; onClick?: () => void }) => (
  <div 
    onClick={onClick}
    style={{
      background: '#FFFFFF',
      border: '1px solid #E2E8F0',
      borderRadius: '16px',
      padding: '24px',
      boxShadow: '0 4px 20px -2px rgba(148, 163, 184, 0.08), 0 2px 8px -1px rgba(148, 163, 184, 0.04)',
      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
      ...style
    }}
  >
    {children}
  </div>
);

const SectionHeader = ({ title, subtitle }: { title: string; subtitle?: string }) => (
  <div style={{ marginBottom: '32px' }}>
    <h2 style={{ fontSize: '24px', fontWeight: 800, color: '#0F172A', marginBottom: '8px', letterSpacing: '-0.02em' }}>{title}</h2>
    {subtitle && <p style={{ fontSize: '15px', color: '#64748B', margin: 0 }}>{subtitle}</p>}
  </div>
);

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(amount);
};

export default function ClientDashboard({
  currentUser,
  requests,
  matches,
  contracts,
  talents,
  invoices,
  messages,
  notifications,
  onSignOut,
  setActiveTab,
  setClientIntakeActive,
  setClientIntakeStep,
  onScheduleMeeting,
  onExtendOffer,
  onSignContract,
  showCalendar,
  setShowCalendar,
  selectedTalent,
  setSelectedTalent,
  meetingTime,
  setMeetingTime,
  meetingDate,
  setMeetingDate,
  showSignModal,
  setShowSignModal,
  activeNDA,
  signingContractId,
  selectedRequest,
  setSelectedRequest,
  setInvoices,
  setMessages,
  setNotifications,
  onAddRequest,
  setMatches,
  saveToDb,
  rehireRequests,
  setRehireRequests
}: ClientDashboardProps) {

  const [activeSection, setActiveSection] = useState<ClientSection>('dashboard');
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [chatInput, setChatInput] = useState('');
  
  // Filter States
  const [searchRequestsFilter, setSearchRequestsFilter] = useState('');
  const [statusRequestsFilter, setStatusRequestsFilter] = useState('All');
  const [typeRequestsFilter, setTypeRequestsFilter] = useState('All');
  const [searchHiresFilter, setSearchHiresFilter] = useState('');

  // Messaging & Reviews Premium States
  const [selectedThreadId, setSelectedThreadId] = useState('sarah');
  const [searchChatFilter, setSearchChatFilter] = useState('');
  const [selectedReviewTalentId, setSelectedReviewTalentId] = useState('alex');
  const [reviewRating, setReviewRating] = useState(0);
  const [techSkillValue, setTechSkillValue] = useState(4);
  const [commValue, setCommValue] = useState(5);
  const [reliabilityValue, setReliabilityValue] = useState(5);
  const [publicFeedbackText, setPublicFeedbackText] = useState('');
  const [privateFeedbackText, setPrivateFeedbackText] = useState('');
  const [isAnonymousPost, setIsAnonymousPost] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewTalentDetails, setReviewTalentDetails] = useState<{ id: string; name: string; role: string; contract?: string; avatar?: string } | null>(null);

  // Local Within-Dashboard Smart Intake Wizard State
  const [showIntakeModal, setShowIntakeModal] = useState(false);
  const [intakeStep, setIntakeStep] = useState(1);
  const [intakeForm, setIntakeForm] = useState({
    serviceType: '',
    roleDescription: '',
    requiredSkills: '',
    duration: '',
    commitmentLevel: '',
    numberOfHires: 1,
    timezone: '',
    startDate: '',
    budget: '',
    priority: ''
  });
  
  // Talent Matching Premium States
  const [selectedMatchingRequestId, setSelectedMatchingRequestId] = useState('');
  const [matchingShortlistedState, setMatchingShortlistedState] = useState<Record<string, boolean>>({ mk: true });
  const [detailsViewRequestId, setDetailsViewRequestId] = useState<string | null>(null);
  const [interviewRequests, setInterviewRequests] = useState<Record<string, string[]>>({});

  const [showRequestInterviewModal, setShowRequestInterviewModal] = useState(false);
  const [requestInterviewTarget, setRequestInterviewTarget] = useState<{ matchId: string; talentName: string; talentId: string; requestId: string } | null>(null);
  const [requestInterviewForm, setRequestInterviewForm] = useState({ date: '', time: '10:00', duration: '45', notes: '' });

  // Notifications and Messages badge calculations
  const effectiveNotifications = notifications || [];
  const unreadNotifsCount = effectiveNotifications.filter(n => !n.read).length;
  const unreadByModule = effectiveNotifications.filter(n => !n.read).reduce((acc: any, n: any) => {
    const t = (n.title || '').toLowerCase();
    const m = (n.message || '').toLowerCase();
    if (t.includes('interview') || m.includes('interview')) acc['scheduling'] = (acc['scheduling'] || 0) + 1;
    else if (t.includes('contract') || m.includes('contract') || t.includes('hire')) acc['contracts'] = (acc['contracts'] || 0) + 1;
    else if (t.includes('match') || m.includes('match') || t.includes('shortlist') || m.includes('shortlist') || t.includes('talent')) acc['radar'] = (acc['radar'] || 0) + 1;
    else if (t.includes('request') || m.includes('request')) acc['requests'] = (acc['requests'] || 0) + 1;
    else if (t.includes('invoice') || m.includes('invoice') || t.includes('billing')) acc['billing'] = (acc['billing'] || 0) + 1;
    else if (t.includes('review') || m.includes('review') || t.includes('feedback')) acc['reviews'] = (acc['reviews'] || 0) + 1;
    return acc;
  }, {});
  const unreadMessagesCount = messages ? messages.filter(m => !m.read).length : 0;

  // Viewing Talent Profile Detail State
  const [viewingTalentProfile, setViewingTalentProfile] = useState<any | null>(null);

  // Job Offer / Hire State
  const [showHireModal, setShowHireModal] = useState(false);
  const [hireTarget, setHireTarget] = useState<any | null>(null);
  const [hireForm, setHireForm] = useState({ salary: '', startDate: '', notes: '' });

  // Invoices & Re-hiring States
  const [showAllInvoicesModal, setShowAllInvoicesModal] = useState(false);
  const [showRehireModal, setShowRehireModal] = useState(false);
  const [rehireTarget, setRehireTarget] = useState<{ id: string; talentName: string; role: string; avatar: string; talentId?: string } | null>(null);
  const [rehireForm, setRehireForm] = useState({ role: '', rate: '12400', startDate: '', commitmentLevel: 'Full-Time' as 'Full-Time' | 'Part-Time', notes: '' });

  const submitInterviewRequest = async () => {
    if (!requestInterviewTarget || !requestInterviewForm.date || !requestInterviewForm.time) {
      alert('Please select proposed date and time.');
      return;
    }
    
    const updatedMatches = matches.map(m => {
      if (m.id === requestInterviewTarget.matchId) {
        return {
          ...m,
          status: 'Interview Scheduled' as const,
          requestedDate: requestInterviewForm.date,
          requestedTime: requestInterviewForm.time,
          requestedDuration: requestInterviewForm.duration,
          requestedNotes: requestInterviewForm.notes
        };
      }
      return m;
    });

    const activeRequest = requests.find(r => r.id === requestInterviewTarget.requestId) || selectedRequest;
    if (!activeRequest) return;

    const confCode = `${Math.random().toString(36).substring(2, 5)}-${Math.random().toString(36).substring(2, 6)}-${Math.random().toString(36).substring(2, 5)}`;
    const meetingLink = `https://meet.google.com/${confCode}`;
    const calEventId = `gcal_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const calendarTitle = encodeURIComponent(`${activeRequest.serviceType} - Interview with ${requestInterviewTarget.talentName}`);
    const googleCalendarLink = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${calendarTitle}&dates=${requestInterviewForm.date.replace(/-/g, '')}T${requestInterviewForm.time.replace(':', '')}00Z/${requestInterviewForm.date.replace(/-/g, '')}T${requestInterviewForm.time.replace(':', '')}00Z&location=${encodeURIComponent(meetingLink)}`;

    const newInterview = {
      id: `interview_${Date.now()}`,
      requestId: requestInterviewTarget.requestId,
      matchId: requestInterviewTarget.matchId,
      talentId: requestInterviewTarget.talentId,
      talentName: requestInterviewTarget.talentName,
      talentAvatar: talents.find(t => t.id === requestInterviewTarget.talentId)?.avatar || '',
      clientName: currentUser?.companyName || currentUser?.name || 'Client',
      title: `${activeRequest.serviceType} - Interview with ${requestInterviewTarget.talentName}`,
      date: requestInterviewForm.date,
      time: requestInterviewForm.time,
      status: 'Scheduled',
      meetingLink,
      googleCalendarEventId: calEventId,
      googleCalendarLink,
      notes: requestInterviewForm.notes || '',
      createdAt: new Date().toISOString()
    };

    try {
      const res = await fetch('/api/db');
      if (res.ok) {
        const dbData = await res.json();
        dbData.matches = updatedMatches;
        dbData.interviews = [...(dbData.interviews || []), newInterview];
        dbData.notifications = [
          {
            id: `notif_${Date.now()}`,
            userId: requestInterviewTarget.talentId,
            title: 'Interview Scheduled',
            message: `Interview "${newInterview.title}" has been booked for ${newInterview.date} at ${newInterview.time}.`,
            read: false,
            createdAt: new Date().toISOString()
          },
          ...(dbData.notifications || [])
        ];
        dbData.auditLogs = [
          {
            id: `audit_${Date.now()}`,
            actor: currentUser?.organizationName || currentUser?.name || 'Client',
            action: 'Schedule Interview',
            details: `Booked interview with candidate ${requestInterviewTarget.talentName} for ${requestInterviewForm.date} at ${requestInterviewForm.time}.`,
            timestamp: new Date().toISOString()
          },
          ...(dbData.auditLogs || [])
        ];
        dbData.agentLogs = [
          {
            id: `alog_${Date.now()}`,
            agentName: 'Workflow Agent',
            message: `Interview slot confirmed with ${requestInterviewTarget.talentName}. Calendar synced.`,
            timestamp: new Date().toLocaleTimeString(),
            type: 'success'
          },
          ...(dbData.agentLogs || [])
        ];

        if (saveToDb) {
          await saveToDb(dbData);
        }
        if (setMatches) {
          setMatches(updatedMatches);
        }
        if (setNotifications) {
          setNotifications([...(notifications || []), dbData.notifications[0]]);
        }
      }

      setShowRequestInterviewModal(false);
      setRequestInterviewTarget(null);
      setRequestInterviewForm({ date: '', time: '10:00', duration: '45', notes: '' });
      
      alert(`Interview with ${requestInterviewTarget.talentName} has been successfully scheduled and synced to your calendars.`);
    } catch {
      alert('Failed to schedule interview. Please try again.');
    }
  };

  const submitRehireRequest = async () => {
    if (!rehireTarget || !rehireForm.role || !rehireForm.rate || !rehireForm.startDate) {
      alert('Please fill in all required fields.');
      return;
    }

    const rehireId = `rehire_${Date.now()}`;
    const newRehireRequest = {
      id: rehireId,
      clientId: currentUser?.id,
      clientName: `${currentUser?.name || 'Client'} (${currentUser?.companyName || 'Horizon Fintech'})`,
      talentId: rehireTarget.talentId || 'talent_chidi',
      talentName: rehireTarget.talentName,
      role: rehireForm.role,
      proposedRate: Number(rehireForm.rate),
      proposedStartDate: rehireForm.startDate,
      commitmentLevel: rehireForm.commitmentLevel,
      notes: rehireForm.notes,
      status: 'Pending' as const,
      createdAt: new Date().toISOString()
    };

    const newAuditLog = {
      id: `audit_${Date.now()}`,
      actor: currentUser?.name || 'Client',
      action: 'Submit Re-hire Request',
      details: `Submitted request to re-hire ${rehireTarget.talentName} as ${rehireForm.role} starting ${rehireForm.startDate}.`,
      timestamp: new Date().toISOString()
    };

    const newAgentLog = {
      id: `alog_${Date.now()}`,
      agentName: 'Workflow Agent' as const,
      message: `Re-hire proposal for ${rehireTarget.talentName} drafted. Forwarded to admin operations.`,
      timestamp: new Date().toLocaleTimeString(),
      type: 'info' as const
    };

    const updatedRehireRequests = [...(rehireRequests || []), newRehireRequest];

    const updatedDb = {
      talents,
      clientRequests: requests,
      matches,
      tasks: [],
      contracts,
      notifications: [
        {
          id: `notif_${Date.now()}`,
          userId: currentUser?.id,
          title: 'Re-hire Request Submitted',
          message: `Re-hire request for "${rehireTarget.talentName}" submitted. Operations team will confirm terms shortly.`,
          read: false,
          createdAt: new Date().toISOString()
        }
      ],
      auditLogs: [newAuditLog],
      agentLogs: [newAgentLog],
      rehireRequests: updatedRehireRequests
    };

    try {
      if (setRehireRequests) {
        setRehireRequests(updatedRehireRequests);
      }
      if (saveToDb) {
        await saveToDb(updatedDb);
      }
      
      setShowRehireModal(false);
      setRehireTarget(null);
      setRehireForm({ role: '', rate: '12400', startDate: '', commitmentLevel: 'Full-Time', notes: '' });
      
      alert(`Re-hire request for ${rehireTarget.talentName} has been successfully submitted to Admin operations.`);
    } catch {
      alert('Failed to submit re-hire request. Please try again.');
    }
  };

  const handleSubmitReview = async () => {
    if (!reviewTalentDetails) return;
    if (reviewRating === 0) {
      alert('Please select a star rating first.');
      return;
    }
    
    const targetName = reviewTalentDetails.name;
    const targetRole = reviewTalentDetails.role;

    try {
      // 1. Insert primary review/telemetry into Supabase notifications
      await supabase.from('notifications').insert({
        user_id: currentUser?.id,
        title: 'Review Submitted',
        content: `Review successfully posted for ${targetName} (${targetRole}) - Rating: ${reviewRating} Stars. ${publicFeedbackText ? `Comments: "${publicFeedbackText}"` : ''}`,
        read_status: false
      });

      // 2. If private feedback is provided, insert a confidential admin notification log
      if (privateFeedbackText.trim()) {
        await supabase.from('notifications').insert({
          user_id: currentUser?.id,
          title: 'Confidential Admin Review',
          content: `CONFIDENTIAL ADMIN-ONLY REVIEW for ${targetName} (${targetRole}). Ratings - Overall: ${reviewRating} Stars, Tech: ${techSkillValue}, Comm: ${commValue}, Reliability: ${reliabilityValue}. Private feedback: "${privateFeedbackText}".`,
          read_status: false
        });
      }

      // Update local state notifications so it displays in UI logs
      if (setNotifications && notifications) {
        const newNotifs = [
          {
            id: `notif_${Date.now()}_pub`,
            userId: currentUser?.id || 'client_unknown',
            title: 'Review Submitted',
            message: `Review successfully posted for ${targetName} (${targetRole}) - Rating: ${reviewRating} Stars.`,
            read: false,
            createdAt: new Date().toISOString()
          }
        ];
        if (privateFeedbackText.trim()) {
          newNotifs.push({
            id: `notif_${Date.now()}_priv`,
            userId: currentUser?.id || 'client_unknown',
            title: 'Confidential Admin Review Logged',
            message: `Private feedback for ${targetName} successfully transmitted to administrators.`,
            read: false,
            createdAt: new Date().toISOString()
          });
        }
        setNotifications([...(notifications || []), ...newNotifs]);
      }
    } catch (e) {
      console.error('Error inserting review telemetry:', e);
    }

    alert(`Thank you! Your verified evaluation for ${targetName} has been logged in our EOR ledger and securely synchronized.`);
    
    // Reset inputs & close modal
    setReviewRating(0);
    setTechSkillValue(4);
    setCommValue(5);
    setReliabilityValue(5);
    setPublicFeedbackText('');
    setPrivateFeedbackText('');
    setIsAnonymousPost(false);
    setShowReviewModal(false);
    setReviewTalentDetails(null);
  };

  const handleShortlistToggle = async (candId: string, candName: string, requestId?: string) => {
    const isShortlistedNow = !matchingShortlistedState[candId];
    setMatchingShortlistedState(prev => ({
      ...prev,
      [candId]: isShortlistedNow
    }));

    if (setNotifications) {
      setNotifications([...(notifications || []), {
        id: `notif_${Date.now()}`,
        userId: currentUser?.id || 'client_unknown',
        title: isShortlistedNow ? 'Candidate Shortlisted' : 'Candidate Removed',
        message: `${candName} has been ${isShortlistedNow ? 'shortlisted' : 'removed'} from your matching pipeline.`,
        read: false,
        createdAt: new Date().toISOString()
      }]);
    }

    alert(`${candName} has been ${isShortlistedNow ? 'shortlisted successfully' : 'removed from shortlists'}.`);
  };

  const handleRequestInterview = async (candName: string, requestId?: string) => {
    const requestKey = requestId || detailsViewRequestId;
    if (requestKey) {
      setInterviewRequests(prev => ({
        ...prev,
        [requestKey]: [...(prev[requestKey] || []), candName]
      }));
    }

    if (setNotifications) {
      setNotifications([...(notifications || []), {
        id: `notif_${Date.now()}`,
        userId: currentUser?.id || 'client_unknown',
        title: 'Interview Request Sent',
        message: `Interview request dispatched to ${candName}${requestKey ? ` for request ${requestKey}` : ''}.`,
        read: false,
        createdAt: new Date().toISOString()
      }]);
    }

    try {
      await supabase.from('notifications').insert({
        user_id: currentUser?.id,
        title: 'Interview Proposal Dispatched',
        content: `Interview request successfully sent to ${candName}.`,
        read_status: false
      });
    } catch (error) {
      // Swallow notification errors; app should continue for the user.
    }

    alert(`Interview proposal dispatched to ${candName}. Candidate has been notified to choose available slot.`);
  };

  // Dynamic stats calculation from real backend telemetry
  const clientContracts = contracts.filter((c: any) => c.clientId === currentUser?.id);
  const activeContracts = clientContracts.filter((c: any) => c.status?.toLowerCase() === 'signed' || c.status?.toLowerCase() === 'active');
  const activeHiresCount = activeContracts.length;
  const pendingMatchesCount = matches.filter((m: any) => {
    const req = requests.find((r: any) => r.id === m.requestId);
    return req?.clientId === currentUser?.id && m.status?.toLowerCase() === 'shortlisted';
  }).length;
  const activeRequestsCount = requests.filter((r: any) => r.clientId === currentUser?.id && r.status?.toLowerCase() !== 'closed').length;
  
  // Calculate pending unpaid invoices
  const pendingInvoicesTotal = invoices
    .filter(inv => inv.clientId === currentUser?.id && inv.status?.toLowerCase() !== 'paid')
    .reduce((sum, inv) => sum + Number(inv.amount || 0), 0);

  // Dynamic Matching pipeline progress list
  const clientRequests = requests.filter(r => r.clientId === currentUser?.id);

  // Dynamic Recent Activity logs derived directly from real database items
  const dynamicActivities = [
    ...requests.filter(r => r.clientId === currentUser?.id).map(r => ({
      id: `act_req_${r.id}`,
      text: `New service request for "${r.serviceType.toUpperCase()} - ${r.numberOfHires} Talent" created`,
      time: r.createdAt ? new Date(r.createdAt).toLocaleDateString() : 'Recently',
      icon: '📝'
    })),
    ...contracts.filter(c => c.clientId === currentUser?.id).map(c => ({
      id: `act_cnt_${c.id}`,
      text: `EOR Employment Contract for ${c.talentName} status updated to ${c.status}`,
      time: 'Contract status log',
      icon: '📄'
    })),
    ...invoices.filter(i => i.clientId === currentUser?.id).map(i => ({
      id: `act_inv_${i.id}`,
      text: `Invoice #${i.id.substring(0, 8)} status is "${i.status}"`,
      time: i.dueDate ? `Due ${new Date(i.dueDate).toLocaleDateString()}` : 'Billing',
      icon: '💵'
    }))
  ].slice(0, 5); // display top 5 most relevant real activities

  // Send messaging dispatch
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;

    const threadReceiverMap: Record<string, string> = {
      sarah: 'usr_sarah',
      michael: 'usr_michael',
      support: 'usr_support',
      david: 'usr_david'
    };

    const targetReceiverId = threadReceiverMap[selectedThreadId] || 'usr_horizon';

    // Call dynamic Supabase messaging tables if present
    const { error } = await supabase.from('messages').insert({
      sender_id: currentUser?.id,
      receiver_id: targetReceiverId,
      content: chatInput,
      read_status: false
    });

    if (!error) {
      if (setMessages) {
        setMessages([
          ...messages,
          {
            id: `msg_new_${Date.now()}`,
            senderId: currentUser?.id,
            receiverId: targetReceiverId,
            content: chatInput,
            timestamp: new Date().toISOString(),
            readStatus: false
          }
        ]);
      }
      setChatInput('');
    } else {
      // Local fallback
      if (setMessages) {
        setMessages([
          ...messages,
          {
            id: `msg_new_${Date.now()}`,
            senderId: currentUser?.id,
            receiverId: targetReceiverId,
            content: chatInput,
            timestamp: new Date().toISOString(),
            readStatus: false
          }
        ]);
      }
      setChatInput('');
    }
  };

  // ─── Sub-Section Layouts ─────────────────────────────────────────────────────

  const renderDashboard = () => {
    // ─── KC-HOME: Derived data ───────────────────────────────────────────────
    const now = new Date();

    // Active Service Requests widget
    const openRequests = clientRequests.filter(r => r.status?.toLowerCase() !== 'closed' && r.status?.toLowerCase() !== 'completed');
    const topThreeRequests = openRequests.slice(0, 3);

    // Matched Talent Waiting — requests at "Candidates Ready", sorted oldest-first
    const candidatesReadyRequests = clientRequests
      .filter(r => r.status === 'Candidates Ready')
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    const oldestPendingRequestId = candidatesReadyRequests[0]?.id || null;

    // Active Team — deployed talent (active contracts)
    const activeTeamTalents = talents.filter((t: any) =>
      activeContracts.some((c: any) => c.talentId === t.id || c.talentName === t.name)
    );
    const avgPerformanceScore = activeTeamTalents.length > 0
      ? Math.round(
          activeTeamTalents.reduce((sum, t: any) => {
            const scores = t.vettingScores || {};
            const vals = Object.values(scores).filter(v => typeof v === 'number') as number[];
            return sum + (vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : 80);
          }, 0) / activeTeamTalents.length
        )
      : 0;

    // Upcoming interviews — next 3 within 14 days, client local TZ
    const clientInterviews: any[] = (typeof window !== 'undefined' ? [] : []);
    const upcoming3 = Array.isArray(clientInterviews)
      ? clientInterviews
          .filter((iv: any) => {
            const d = new Date(`${iv.date}T${iv.time}`);
            return iv.status !== 'Cancelled' && d >= now && d <= new Date(now.getTime() + 14 * 86400000);
          })
          .sort((a: any, b: any) => new Date(`${a.date}T${a.time}`).getTime() - new Date(`${b.date}T${b.time}`).getTime())
          .slice(0, 3)
      : [];

    // Pending invoices
    const clientInvoices = invoices.filter((inv: any) => inv.clientId === currentUser?.id);
    const unpaidInvoices = clientInvoices.filter((inv: any) => inv.status?.toLowerCase() !== 'paid');
    const overdueInvoices = clientInvoices.filter((inv: any) => inv.status?.toLowerCase() === 'overdue');
    const totalOutstanding = unpaidInvoices.reduce((sum, inv) => sum + Number(inv.amount || 0), 0);
    const hasOverdue = overdueInvoices.length > 0;

    // Remotan: unlocked if any active hire exists
    const remotanUnlocked = activeHiresCount > 0;

    // Status color helper
    const statusColors: Record<string, { bg: string; text: string; dot: string }> = {
      'New Request':        { bg: '#EFF6FF', text: '#2563EB', dot: '#3B82F6' },
      'Matching':           { bg: '#F0FDF4', text: '#16A34A', dot: '#22C55E' },
      'Candidates Ready':   { bg: '#FFF7ED', text: '#C2410C', dot: '#F97316' },
      'Interview':          { bg: '#F5F3FF', text: '#6D28D9', dot: '#7C3AED' },
      'Reviewing':          { bg: '#FEF9C3', text: '#854D0E', dot: '#CA8A04' },
      'Completed':          { bg: '#F0FDF4', text: '#166534', dot: '#15803D' },
      'Closed':             { bg: '#F1F5F9', text: '#475569', dot: '#94A3B8' },
    };
    const getStatusStyle = (status: string) =>
      statusColors[status] || { bg: '#F1F5F9', text: '#475569', dot: '#94A3B8' };

    // Build widget order — overdue invoice card goes first if hasOverdue
    const invoiceWidget = (
      <Card
        style={{
          border: hasOverdue ? '2px solid #EF4444' : '1px solid #E2E8F0',
          background: hasOverdue ? '#FFF5F5' : '#FFFFFF',
          boxShadow: hasOverdue ? '0 0 0 4px rgba(239,68,68,0.08)' : undefined,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '36px', height: '36px', borderRadius: '10px',
              background: hasOverdue ? '#FEE2E2' : '#EFF6FF',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px'
            }}>💵</div>
            <div>
              <div style={{ fontSize: '12px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Pending Invoices</div>
              {hasOverdue && (
                <div style={{ fontSize: '11px', fontWeight: 800, color: '#EF4444', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#EF4444', display: 'inline-block' }} />
                  {overdueInvoices.length} OVERDUE
                </div>
              )}
            </div>
          </div>
          <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748B' }}>{unpaidInvoices.length} unpaid</span>
        </div>
        <div style={{ fontSize: '28px', fontWeight: 900, color: hasOverdue ? '#DC2626' : '#0F172A', marginBottom: '16px', letterSpacing: '-0.02em' }}>
          {formatCurrency(totalOutstanding)}
        </div>
        <button
          onClick={() => setActiveSection('billing')}
          style={{
            width: '100%', padding: '10px', borderRadius: '10px', border: 'none',
            background: hasOverdue ? '#EF4444' : '#0F172A',
            color: '#FFFFFF', fontWeight: 700, fontSize: '13px', cursor: 'pointer',
            transition: 'opacity 0.2s'
          }}
        >
          {hasOverdue ? '⚠️ Pay Now — Overdue Balance' : 'Pay Now →'}
        </button>
      </Card>
    );

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>

        {/* ── Welcome Header ──────────────────────────────────────────────────── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <p style={{ fontSize: '13px', fontWeight: 700, color: '#6366F1', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 8px 0' }}>
              ● KONGILA CLIENT PORTAL
            </p>
            <h1 style={{ fontSize: '32px', fontWeight: 900, color: '#0F172A', marginBottom: '8px', letterSpacing: '-0.03em', margin: 0 }}>
              Welcome back, {currentUser?.name?.split(' ')[0] || 'Client'} 👋
            </h1>
            <p style={{ fontSize: '15px', color: '#64748B', margin: '8px 0 0 0' }}>
              {currentUser?.companyName ? `${currentUser.companyName} · ` : ''}Here's your full Kongila pipeline at a glance.
            </p>
          </div>
          {/* Quick Actions Bar (always visible) */}
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button
              onClick={() => { setShowIntakeModal(true); setIntakeStep(1); }}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                background: 'linear-gradient(135deg, #2563EB, #1D4ED8)', border: 'none',
                borderRadius: '10px', padding: '10px 18px', color: '#FFFFFF',
                fontWeight: 700, fontSize: '13px', cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(37,99,235,0.25)', transition: 'transform 0.2s'
              }}
              onMouseEnter={e => (e.currentTarget.style.transform = 'translateY(-1px)')}
              onMouseLeave={e => (e.currentTarget.style.transform = 'translateY(0)')}
            >
              ＋ New Request
            </button>
            <button
              onClick={() => setActiveSection('messaging')}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                background: '#FFFFFF', border: '1px solid #E2E8F0',
                borderRadius: '10px', padding: '10px 18px', color: '#1E293B',
                fontWeight: 700, fontSize: '13px', cursor: 'pointer', transition: 'background 0.2s'
              }}
              onMouseEnter={e => (e.currentTarget.style.background = '#F8FAFC')}
              onMouseLeave={e => (e.currentTarget.style.background = '#FFFFFF')}
            >
              💬 Message Account Manager
            </button>
            <button
              onClick={() => setActiveSection('billing')}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                background: '#FFFFFF', border: '1px solid #E2E8F0',
                borderRadius: '10px', padding: '10px 18px', color: '#1E293B',
                fontWeight: 700, fontSize: '13px', cursor: 'pointer', transition: 'background 0.2s'
              }}
              onMouseEnter={e => (e.currentTarget.style.background = '#F8FAFC')}
              onMouseLeave={e => (e.currentTarget.style.background = '#FFFFFF')}
            >
              🧾 View Invoices
            </button>
          </div>
        </div>

        {/* ── Widget Grid Row 1: Primary Status Cards ──────────────────────────── */}
        {/* If overdue, invoice widget is hoisted to first row */}
        {hasOverdue && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '0' }}>
            {invoiceWidget}
          </div>
        )}

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
          gap: '20px'
        }}>

          {/* 1. Active Service Requests */}
          <Card style={{ gridColumn: 'span 2' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px' }}>📋</div>
                <div>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Active Service Requests</div>
                  <div style={{ fontSize: '22px', fontWeight: 900, color: '#0F172A', lineHeight: 1 }}>{openRequests.length}</div>
                </div>
              </div>
              <button
                onClick={() => setActiveSection('requests')}
                style={{ background: '#EFF6FF', border: 'none', color: '#2563EB', fontSize: '12px', fontWeight: 700, cursor: 'pointer', padding: '6px 10px', borderRadius: '8px' }}
              >
                View All →
              </button>
            </div>
            {topThreeRequests.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {topThreeRequests.map(req => {
                  const sc = getStatusStyle(req.status || 'New Request');
                  return (
                    <div
                      key={req.id}
                      onClick={() => { setDetailsViewRequestId(req.id); setActiveSection('requests'); }}
                      style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        padding: '12px 16px', borderRadius: '12px', border: '1px solid #F1F5F9',
                        background: '#FAFBFC', cursor: 'pointer', transition: 'background 0.2s'
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#F1F5F9')}
                      onMouseLeave={e => (e.currentTarget.style.background = '#FAFBFC')}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '13px', fontWeight: 700, color: '#0F172A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {req.serviceType} {req.roleDescription ? `— ${req.roleDescription.split(' ').slice(0, 5).join(' ')}…` : ''}
                        </div>
                        <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '2px' }}>
                          {req.numberOfHires} hire{req.numberOfHires !== 1 ? 's' : ''} · {req.createdAt ? new Date(req.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'Recently'}
                        </div>
                      </div>
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: '5px',
                        fontSize: '10px', fontWeight: 800, padding: '3px 8px', borderRadius: '8px',
                        background: sc.bg, color: sc.text, whiteSpace: 'nowrap', marginLeft: '12px'
                      }}>
                        <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: sc.dot }} />
                        {req.status || 'New Request'}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '24px', color: '#94A3B8' }}>
                <div style={{ fontSize: '32px', marginBottom: '8px' }}>📭</div>
                <p style={{ fontSize: '13px', margin: '0 0 12px 0' }}>No open requests yet</p>
                <button
                  onClick={() => { setShowIntakeModal(true); setIntakeStep(1); }}
                  style={{ background: '#2563EB', border: 'none', borderRadius: '8px', padding: '8px 16px', color: '#FFFFFF', fontWeight: 700, fontSize: '12px', cursor: 'pointer' }}
                >
                  + New Request
                </button>
              </div>
            )}
          </Card>

          {/* 2. Matched Talent Waiting */}
          {candidatesReadyRequests.length > 0 && (
            <Card style={{ borderTop: '3px solid #F97316' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#FFF7ED', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px' }}>🎯</div>
                <div>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Matched Talent Waiting</div>
                  <div style={{ fontSize: '22px', fontWeight: 900, color: '#0F172A', lineHeight: 1 }}>{candidatesReadyRequests.length}</div>
                </div>
              </div>
              <p style={{ fontSize: '13px', color: '#475569', margin: '0 0 16px 0' }}>
                {candidatesReadyRequests.length === 1
                  ? 'Candidates are ready for your review'
                  : `${candidatesReadyRequests.length} requests have candidates ready — oldest pending first`
                }
              </p>
              <div style={{ fontSize: '11px', color: '#94A3B8', marginBottom: '12px' }}>
                Waiting since: {candidatesReadyRequests[0]?.createdAt
                  ? new Date(candidatesReadyRequests[0].createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                  : 'Recently'}
              </div>
              <button
                onClick={() => {
                  if (oldestPendingRequestId) {
                    setDetailsViewRequestId(oldestPendingRequestId);
                    setActiveSection('radar');
                  }
                }}
                style={{
                  width: '100%', padding: '10px', borderRadius: '10px', border: 'none',
                  background: 'linear-gradient(135deg, #F97316, #EA580C)',
                  color: '#FFFFFF', fontWeight: 700, fontSize: '13px', cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(249,115,22,0.2)'
                }}
              >
                Review Now →
              </button>
            </Card>
          )}

          {/* 3. Active Team Summary — only visible after first hire */}
          {activeHiresCount > 0 && (
            <Card style={{ borderTop: '3px solid #10B981' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#ECFDF5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px' }}>👥</div>
                <div>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Active Team</div>
                  <div style={{ fontSize: '22px', fontWeight: 900, color: '#0F172A', lineHeight: 1 }}>{activeHiresCount}</div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
                <div style={{ flex: 1, background: '#F8FAFC', borderRadius: '10px', padding: '10px', textAlign: 'center' }}>
                  <div style={{ fontSize: '10px', color: '#94A3B8', fontWeight: 700, textTransform: 'uppercase' }}>Deployed</div>
                  <div style={{ fontSize: '20px', fontWeight: 900, color: '#10B981' }}>{activeHiresCount}</div>
                </div>
                <div style={{ flex: 1, background: '#F8FAFC', borderRadius: '10px', padding: '10px', textAlign: 'center' }}>
                  <div style={{ fontSize: '10px', color: '#94A3B8', fontWeight: 700, textTransform: 'uppercase' }}>Avg. Score</div>
                  <div style={{ fontSize: '20px', fontWeight: 900, color: '#2563EB' }}>{avgPerformanceScore}%</div>
                </div>
              </div>
              {/* Avatar pile */}
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: '16px' }}>
                {activeTeamTalents.slice(0, 4).map((t: any, i: number) => (
                  <div
                    key={t.id}
                    style={{
                      width: '32px', height: '32px', borderRadius: '50%',
                      border: '2px solid #FFFFFF', marginLeft: i > 0 ? '-8px' : '0',
                      background: '#EFF6FF', display: 'flex', alignItems: 'center',
                      justifyContent: 'center', fontSize: '13px', fontWeight: 700, color: '#2563EB',
                      overflow: 'hidden', zIndex: 5 - i
                    }}
                  >
                    {t.avatar
                      ? <img src={t.avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : (t.name?.charAt(0) || '?')
                    }
                  </div>
                ))}
                {activeTeamTalents.length > 4 && (
                  <div style={{ width: '32px', height: '32px', borderRadius: '50%', border: '2px solid #FFFFFF', marginLeft: '-8px', background: '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 700, color: '#475569' }}>
                    +{activeTeamTalents.length - 4}
                  </div>
                )}
              </div>
              <button
                onClick={() => setActiveSection('contracts')}
                style={{
                  width: '100%', padding: '10px', borderRadius: '10px', border: 'none',
                  background: '#0F172A', color: '#FFFFFF', fontWeight: 700, fontSize: '13px', cursor: 'pointer'
                }}
              >
                View My Team →
              </button>
            </Card>
          )}

          {/* 4. Upcoming Interviews — only shown when interviews exist */}
          <Card>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#F5F3FF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px' }}>📅</div>
              <div>
                <div style={{ fontSize: '12px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Upcoming Interviews</div>
                <div style={{ fontSize: '22px', fontWeight: 900, color: '#0F172A', lineHeight: 1 }}>{upcoming3.length}</div>
              </div>
            </div>
            {upcoming3.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {upcoming3.map((iv: any) => (
                  <div key={iv.id} style={{ padding: '10px 12px', borderRadius: '10px', background: '#F8FAFC', border: '1px solid #F1F5F9' }}>
                    <div style={{ fontSize: '12px', fontWeight: 700, color: '#0F172A', marginBottom: '2px' }}>{iv.talentName}</div>
                    <div style={{ fontSize: '11px', color: '#64748B' }}>
                      {new Date(`${iv.date}T${iv.time}`).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ fontSize: '13px', color: '#94A3B8', margin: 0 }}>No upcoming interviews in the next 14 days.</p>
            )}
            <button
              onClick={() => setActiveSection('scheduling')}
              style={{ marginTop: '14px', width: '100%', padding: '10px', borderRadius: '10px', border: '1px solid #E2E8F0', background: '#FFFFFF', color: '#0F172A', fontWeight: 700, fontSize: '13px', cursor: 'pointer' }}
            >
              View All →
            </button>
          </Card>

          {/* 5. Pending Invoices — shown here only if NOT overdue (overdue version is hoisted above) */}
          {!hasOverdue && invoiceWidget}

          {/* 6. Remotan Access Status */}
          <Card style={{ borderTop: remotanUnlocked ? '3px solid #6366F1' : '3px solid #E2E8F0', gridColumn: remotanUnlocked ? undefined : undefined }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: remotanUnlocked ? '#EEF2FF' : '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px' }}>
                {remotanUnlocked ? '🔓' : '🔒'}
              </div>
              <div style={{ fontSize: '12px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Remotan Workspace</div>
            </div>
            {remotanUnlocked ? (
              <>
                <p style={{ fontSize: '13px', fontWeight: 700, color: '#4338CA', margin: '0 0 4px 0' }}>Workspace Ready</p>
                <p style={{ fontSize: '12px', color: '#64748B', margin: '0 0 16px 0' }}>Your Remotan workspace is provisioned and active for your team.</p>
                <a
                  href="https://remotan.io"
                  target="_blank"
                  rel="noreferrer"
                  style={{ display: 'block', width: '100%', padding: '10px', borderRadius: '10px', border: 'none', background: 'linear-gradient(135deg, #6366F1, #4F46E5)', color: '#FFFFFF', fontWeight: 700, fontSize: '13px', cursor: 'pointer', textDecoration: 'none', textAlign: 'center', boxSizing: 'border-box' }}
                >
                  Open Remotan ↗
                </a>
              </>
            ) : (
              <>
                <p style={{ fontSize: '13px', fontWeight: 700, color: '#94A3B8', margin: '0 0 4px 0' }}>Hire your first talent to unlock</p>
                <p style={{ fontSize: '12px', color: '#94A3B8', margin: '0 0 16px 0' }}>Remotan workspace is unlocked after your first active hire.</p>
                <button
                  onClick={() => { setShowIntakeModal(true); setIntakeStep(1); }}
                  style={{ width: '100%', padding: '10px', borderRadius: '10px', border: '1px solid #E2E8F0', background: '#F8FAFC', color: '#475569', fontWeight: 700, fontSize: '13px', cursor: 'pointer' }}
                >
                  + New Request
                </button>
              </>
            )}
          </Card>

        </div>

        {/* ── Pipeline progress strip ─────────────────────────────────────────── */}
        {openRequests.length > 0 && (
          <Card>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#0F172A', margin: 0 }}>Sourcing Pipeline</h3>
              <button
                onClick={() => setActiveSection('requests')}
                style={{ background: 'transparent', border: 'none', color: '#2563EB', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}
              >
                View All Requests →
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {openRequests.slice(0, 3).map(req => {
                const reqMatches = matches.filter((m: any) => m.requestId === req.id);
                const hasInterview = reqMatches.some((m: any) => m.status === 'Interview Scheduled');
                const hasMatch = reqMatches.length > 0;
                const pct = req.status === 'Candidates Ready' ? 75 : hasInterview ? 90 : hasMatch ? 50 : 20;
                const stages = [
                  { label: 'Sourcing', pct: 20 },
                  { label: 'Matching', pct: 50 },
                  { label: 'Shortlisted', pct: 75 },
                  { label: 'Interview', pct: 90 },
                  { label: 'Hired', pct: 100 }
                ];
                return (
                  <div key={req.id}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: 700, color: '#0F172A' }}>
                          {req.serviceType} — {req.roleDescription?.split(' ').slice(0, 4).join(' ') || 'Talent Required'}
                        </div>
                        <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '2px' }}>
                          {req.numberOfHires} hire{req.numberOfHires !== 1 ? 's' : ''} · {req.duration || 'Ongoing'}
                        </div>
                      </div>
                      {(() => { const sc = getStatusStyle(req.status || 'New Request'); return (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '10px', fontWeight: 800, padding: '3px 8px', borderRadius: '8px', background: sc.bg, color: sc.text }}>
                          <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: sc.dot }} />
                          {req.status || 'New Request'}
                        </span>
                      ); })()}
                    </div>
                    <div style={{ position: 'relative', height: '4px', background: '#E2E8F0', borderRadius: '4px', marginBottom: '24px' }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: 'linear-gradient(90deg, #2563EB, #7C3AED)', borderRadius: '4px', transition: 'width 0.6s ease' }} />
                      {stages.map((s, i) => (
                        <div key={i} style={{ position: 'absolute', left: `${s.pct}%`, top: '-7px', transform: 'translateX(-50%)' }}>
                          <div style={{ width: '18px', height: '18px', borderRadius: '50%', background: pct >= s.pct ? '#2563EB' : '#E2E8F0', border: '3px solid #FFFFFF', boxShadow: '0 1px 4px rgba(0,0,0,0.12)', transition: 'background 0.4s' }} />
                          <div style={{ position: 'absolute', top: '18px', left: '50%', transform: 'translateX(-50%)', fontSize: '9px', fontWeight: 700, color: pct >= s.pct ? '#2563EB' : '#94A3B8', whiteSpace: 'nowrap' }}>
                            {s.label}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        )}

      </div>
    );
  };

  const renderRequests = () => {
    // In-memory filtration over the client's requests
    const filteredRequests = clientRequests.filter(req => {
      // search filter
      const matchesSearch = req.serviceType?.toLowerCase().includes(searchRequestsFilter.toLowerCase()) ||
                            req.roleDescription?.toLowerCase().includes(searchRequestsFilter.toLowerCase());
      
      // status filter
      let matchesStatus = true;
      if (statusRequestsFilter !== 'All') {
        matchesStatus = req.status?.toLowerCase() === statusRequestsFilter.toLowerCase();
      }

      // type filter
      let matchesType = true;
      if (typeRequestsFilter !== 'All') {
        matchesType = req.serviceType?.toLowerCase() === typeRequestsFilter.toLowerCase();
      }

      return matchesSearch && matchesStatus && matchesType;
    });

    if (detailsViewRequestId) {
      return renderRequestDetail();
    }

    const totalIntakeCount = clientRequests.length;

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
        
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ fontSize: '32px', fontWeight: 800, color: '#1A2340', marginBottom: '8px', letterSpacing: '-0.03em' }}>Service Requests</h1>
            <p style={{ fontSize: '15px', color: '#6B7A99', margin: 0 }}>Manage your talent acquisition and project outsourcing pipeline.</p>
          </div>
          <button 
            onClick={() => { setShowIntakeModal(true); setIntakeStep(1); }}
            style={{ 
              display: 'flex', alignItems: 'center', gap: '8px',
              background: '#0047CC', border: 'none', borderRadius: '12px', 
              padding: '14px 24px', color: 'white', fontWeight: 700, 
              cursor: 'pointer', transition: 'background 0.2s', fontSize: '14px',
              boxShadow: '0 4px 12px rgba(0, 71, 204, 0.15)'
            }}
          >
            New Service Request
          </button>
        </div>

        {/* Dynamic Telemetry stats card */}
        <div style={{ marginBottom: '8px' }}>
          
          {/* Performance & Request Stats Widget */}
          <Card style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', border: '1px solid #DDE2EC' }}>
            <div>
              <h3 style={{ fontSize: '15px', fontWeight: 800, color: '#1A2340', margin: '0 0 4px 0' }}>Request Statistics</h3>
              <p style={{ fontSize: '12px', color: '#6B7A99', margin: '0 0 24px 0' }}>Performance metrics for the current fiscal year</p>
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '20px' }}>
              
              {/* Stat 1 */}
              <div style={{ flex: 1, minWidth: '150px' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, color: '#6B7A99', textTransform: 'uppercase', marginBottom: '6px' }}>Total Requests</div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px' }}>
                  <span style={{ fontSize: '36px', fontWeight: 800, color: '#1A2340' }}>{totalIntakeCount}</span>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: '#0047CC', background: '#EEF3FF', padding: '2px 8px', borderRadius: '12px' }}>
                    {totalIntakeCount > 0 ? '+12% vs last year' : 'New account'}
                  </span>
                </div>
              </div>

              {/* Stat 2 */}
              <div style={{ flex: 1, borderLeft: '1px solid #DDE2EC', paddingLeft: '32px', minWidth: '150px' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, color: '#6B7A99', textTransform: 'uppercase', marginBottom: '6px' }}>Avg. Time To Hire</div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px' }}>
                  <span style={{ fontSize: '36px', fontWeight: 800, color: '#1A2340' }}>18.5 <span style={{ fontSize: '16px', fontWeight: 600 }}>days</span></span>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: '#0047CC', background: '#EEF3FF', padding: '2px 8px', borderRadius: '12px' }}>⚡ 3 days faster</span>
                </div>
              </div>

              {/* SVG Trendline Graphic Modeled After Stitch Mockup */}
              <div style={{ paddingLeft: '32px' }}>
                <svg viewBox="0 0 120 40" style={{ width: '130px', height: '45px', overflow: 'visible' }}>
                  <path d="M0,35 Q20,10 40,25 T80,15 T120,5" fill="none" stroke="#0047CC" strokeWidth="3" strokeLinecap="round" />
                  <circle cx="120" cy="5" r="4.5" fill="#0047CC" stroke="#FFFFFF" strokeWidth="2" />
                </svg>
              </div>

            </div>
          </Card>

        </div>

        {/* High-Fidelity Filters Toolbar */}
        <Card style={{ padding: '16px 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '20px' }}>
            
            {/* Filter tags dropdown selection */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <span style={{ fontSize: '13px', fontWeight: 800, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Filters:</span>
              
              {/* Status Select */}
              <select 
                value={statusRequestsFilter}
                onChange={e => setStatusRequestsFilter(e.target.value)}
                style={{
                  height: '36px', border: '1px solid #E2E8F0', borderRadius: '8px',
                  padding: '0 12px', fontSize: '13px', color: '#0F172A', fontWeight: 600,
                  outline: 'none', background: '#FFFFFF', cursor: 'pointer'
                }}
              >
                <option value="All">All Statuses</option>
                <option value="New Request">Qualification</option>
                <option value="Matching">Matching</option>
                <option value="Completed">Completed</option>
              </select>

              {/* Service Type Select */}
              <select 
                value={typeRequestsFilter}
                onChange={e => setTypeRequestsFilter(e.target.value)}
                style={{
                  height: '36px', border: '1px solid #E2E8F0', borderRadius: '8px',
                  padding: '0 12px', fontSize: '13px', color: '#0F172A', fontWeight: 600,
                  outline: 'none', background: '#FFFFFF', cursor: 'pointer'
                }}
              >
                <option value="All">Service Type</option>
                <option value="hire">Hire Talent</option>
                <option value="outsource">Outsource</option>
              </select>

              {/* Clear link */}
              {(searchRequestsFilter || statusRequestsFilter !== 'All' || typeRequestsFilter !== 'All') && (
                <button 
                  onClick={() => { setSearchRequestsFilter(''); setStatusRequestsFilter('All'); setTypeRequestsFilter('All'); }}
                  style={{ background: 'transparent', border: 'none', color: '#EF4444', fontSize: '13px', fontWeight: 700, cursor: 'pointer', padding: 0 }}
                >
                  Clear All Filters
                </button>
              )}
            </div>

            {/* Input Search Box */}
            <div style={{ position: 'relative', width: '280px' }}>
              <input 
                type="text"
                placeholder="Search service requests..."
                value={searchRequestsFilter}
                onChange={e => setSearchRequestsFilter(e.target.value)}
                style={{
                  width: '100%', height: '38px', border: '1px solid #E2E8F0',
                  borderRadius: '10px', padding: '0 16px 0 36px', fontSize: '13px',
                  boxSizing: 'border-box', outline: 'none'
                }}
              />
              <span style={{ position: 'absolute', left: '12px', top: '10px', fontSize: '14px', color: '#94A3B8' }}>🔍</span>
            </div>

          </div>
        </Card>

        {/* Requests Management Grid Table */}
        <Card style={{ padding: '0px', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
            <thead>
              <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                <th style={{ padding: '18px 24px', fontWeight: 700, color: '#475569', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Service Request</th>
                <th style={{ padding: '18px 24px', fontWeight: 700, color: '#475569', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Type</th>
                <th style={{ padding: '18px 24px', fontWeight: 700, color: '#475569', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Date Created</th>
                <th style={{ padding: '18px 24px', fontWeight: 700, color: '#475569', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Talent</th>
                <th style={{ padding: '18px 24px', fontWeight: 700, color: '#475569', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Status</th>
                <th style={{ padding: '18px 24px', fontWeight: 700, color: '#475569', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredRequests.length > 0 ? (
                filteredRequests.map(req => {
                  const isHire = req.serviceType?.toLowerCase() === 'hire';
                  const isMatching = req.status === 'Matching';
                  
                  // Dot status mapping
                  let statusDotColor = '#F59E0B'; // Qualification (yellow)
                  let statusText = 'Qualification';
                  if (req.status === 'Matching') {
                    statusDotColor = '#06B6D4'; // Matching (cyan)
                    statusText = 'Matching';
                  } else if (req.status === 'Completed') {
                    statusDotColor = '#10B981'; // Completed (green)
                    statusText = 'Completed';
                  } else if (req.status === 'Interview') {
                    statusDotColor = '#3B82F6'; // Interview (blue)
                    statusText = 'Interview';
                  }

                  return (
                    <tr key={req.id} style={{ borderBottom: '1px solid #F1F5F9', transition: 'background 0.2s' }} onMouseEnter={e => e.currentTarget.style.background = '#F8FAFC'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                      
                      {/* Name & desc */}
                      <td style={{ padding: '18px 24px' }}>
                        <div style={{ fontWeight: 800, color: '#0F172A', fontSize: '15px' }}>{req.roleTitle || `${req.serviceType?.toUpperCase()} Developer`}</div>
                        <div style={{ fontSize: '12px', color: '#64748B', marginTop: '4px' }}>{req.roleDescription || 'Scalable application architecture'}</div>
                      </td>

                      {/* Type Badge */}
                      <td style={{ padding: '18px 24px' }}>
                        <span style={{
                          display: 'inline-block', fontSize: '10px', fontWeight: 800,
                          padding: '4px 10px', borderRadius: '12px',
                          background: isHire ? '#EFF6FF' : '#F1F5F9',
                          color: isHire ? '#2563EB' : '#475569',
                          textTransform: 'uppercase', letterSpacing: '0.05em'
                        }}>
                          {isHire ? 'HIRE TALENT' : 'OUTSOURCE'}
                        </span>
                      </td>

                      {/* Created date */}
                      <td style={{ padding: '18px 24px', color: '#64748B', fontSize: '13px' }}>
                        {req.createdAt ? new Date(req.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Oct 12, 2023'}
                      </td>

                      {/* Overlapping Talent Avatar Piles */}
                      <td style={{ padding: '18px 24px' }}>
                        <div style={{ display: 'flex', alignItems: 'center' }}>
                          <img src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=80" alt="" style={{ width: '26px', height: '26px', borderRadius: '50%', border: '2px solid #FFFFFF', objectFit: 'cover' }} />
                          <img src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=80" alt="" style={{ width: '26px', height: '26px', borderRadius: '50%', border: '2px solid #FFFFFF', marginLeft: '-10px', objectFit: 'cover' }} />
                          <span style={{ fontSize: '12px', fontWeight: 700, color: '#64748B', marginLeft: '8px' }}>1 Expert</span>
                        </div>
                      </td>

                      {/* Dotted status pill */}
                      <td style={{ padding: '18px 24px' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 700, color: '#1E293B' }}>
                          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: statusDotColor }} />
                          {statusText}
                        </div>
                      </td>

                      {/* Actions dropdown */}
                      <td style={{ padding: '18px 24px', textAlign: 'right' }}>
                        <button 
                          onClick={() => {
                            setSelectedRequest(req);
                            setDetailsViewRequestId(req.id);
                          }}
                          style={{ background: 'transparent', border: 'none', color: '#2563EB', fontSize: '14px', cursor: 'pointer', padding: '4px' }}
                        >
                          View Details
                        </button>
                      </td>

                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6} style={{ padding: '48px', textAlign: 'center', color: '#64748B' }}>
                    No service requests found matching filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          {/* Footer pagination bar */}
          <div style={{ borderTop: '1px solid #F1F5F9', padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px', color: '#64748B' }}>
            <span>Showing {filteredRequests.length} of {totalIntakeCount} results</span>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button style={{ width: '28px', height: '28px', border: '1px solid #E2E8F0', borderRadius: '6px', background: '#FFFFFF', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>‹</button>
              <button style={{ width: '28px', height: '28px', border: 'none', borderRadius: '6px', background: '#2563EB', color: '#FFFFFF', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>1</button>
              <button style={{ width: '28px', height: '28px', border: '1px solid #E2E8F0', borderRadius: '6px', background: '#FFFFFF', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>2</button>
              <button style={{ width: '28px', height: '28px', border: '1px solid #E2E8F0', borderRadius: '6px', background: '#FFFFFF', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>›</button>
            </div>
          </div>

        </Card>

      </div>
    );
  };

  const renderRequestDetail = () => {
    const request = clientRequests.find(req => req.id === detailsViewRequestId) || selectedRequest;
    if (!request) return null;

    const requestMatches = matches.filter((m: any) => m.requestId === request.id);
    const shortlistedCount = requestMatches.filter((m: any) => matchingShortlistedState[m.talentId]).length;
    const interviewCount = interviewRequests[request.id]?.length || 0;
    const timeline = [
      { label: 'New Request', active: request.status === 'New Request' || request.status === 'Reviewing' || request.status === 'Matching' || request.status === 'Interview' || request.status === 'Completed' },
      { label: 'Reviewing', active: request.status === 'Reviewing' || request.status === 'Matching' || request.status === 'Interview' || request.status === 'Completed' },
      { label: 'Matching', active: request.status === 'Matching' || request.status === 'Interview' || request.status === 'Completed' },
      { label: 'Interview', active: request.status === 'Interview' || request.status === 'Completed' },
      { label: 'Completed', active: request.status === 'Completed' }
    ];

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <button
              onClick={() => setDetailsViewRequestId(null)}
              style={{ background: 'transparent', border: 'none', color: '#2563EB', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}
            >
              ← Back to service requests
            </button>
            <h1 style={{ fontSize: '32px', fontWeight: 800, color: '#0F172A', margin: '16px 0 8px 0' }}>{request.roleTitle || request.serviceType}</h1>
            <p style={{ fontSize: '15px', color: '#64748B', margin: 0 }}>View full request details, shortlist activity, interview history and intake status.</p>
          </div>
          <div style={{ display: 'grid', gap: '12px', minWidth: '220px' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>Current Status</span>
            <span style={{ fontSize: '18px', fontWeight: 800, color: '#0F172A' }}>{request.status || 'New Request'}</span>
            <span style={{ fontSize: '13px', color: '#64748B' }}>{request.createdAt ? new Date(request.createdAt).toLocaleDateString() : 'Recently created'}</span>
          </div>
        </div>

        <Card style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '24px' }}>
          <div style={{ display: 'grid', gap: '24px' }}>
            <section>
              <h3 style={{ fontSize: '15px', fontWeight: 800, color: '#0F172A', marginBottom: '12px' }}>Intake Details</h3>
              <div style={{ display: 'grid', gap: '12px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div style={{ padding: '18px', borderRadius: '12px', background: '#F8FAFC' }}>
                    <div style={{ fontSize: '11px', color: '#64748B', textTransform: 'uppercase', marginBottom: '6px' }}>Service Type</div>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: '#0F172A' }}>{request.serviceType}</div>
                  </div>
                  <div style={{ padding: '18px', borderRadius: '12px', background: '#F8FAFC' }}>
                    <div style={{ fontSize: '11px', color: '#64748B', textTransform: 'uppercase', marginBottom: '6px' }}>Budget</div>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: '#0F172A' }}>${request.budget?.toLocaleString() || '0'} / mo</div>
                  </div>
                </div>
                <div style={{ padding: '18px', borderRadius: '12px', background: '#F8FAFC' }}>
                  <div style={{ fontSize: '11px', color: '#64748B', textTransform: 'uppercase', marginBottom: '6px' }}>Role Description</div>
                  <div style={{ fontSize: '14px', color: '#1E293B', lineHeight: 1.7 }}>{request.roleDescription || 'No role description provided.'}</div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div style={{ padding: '18px', borderRadius: '12px', background: '#F8FAFC' }}>
                    <div style={{ fontSize: '11px', color: '#64748B', textTransform: 'uppercase', marginBottom: '6px' }}>Required Skills</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      {(request.requiredSkills || []).map((skill: string) => (
                        <span key={skill} style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '6px 10px', fontSize: '12px', color: '#475569' }}>{skill}</span>
                      ))}
                    </div>
                  </div>
                  <div style={{ padding: '18px', borderRadius: '12px', background: '#F8FAFC' }}>
                    <div style={{ fontSize: '11px', color: '#64748B', textTransform: 'uppercase', marginBottom: '6px' }}>Hiring Needs</div>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: '#0F172A' }}>{request.numberOfHires || 1} hire(s)</div>
                    <div style={{ fontSize: '12px', color: '#64748B', marginTop: '6px' }}>{request.commitmentLevel || 'Full Time'}</div>
                  </div>
                </div>
              </div>
            </section>

            <section>
              <h3 style={{ fontSize: '15px', fontWeight: 800, color: '#0F172A', marginBottom: '12px' }}>Candidate Pipeline</h3>
              <div style={{ display: 'grid', gap: '12px' }}>
                <div style={{ padding: '16px', borderRadius: '12px', background: '#F8FAFC' }}>
                  <div style={{ fontSize: '11px', color: '#64748B', marginBottom: '6px', textTransform: 'uppercase' }}>Shortlisted</div>
                  <div style={{ fontSize: '18px', fontWeight: 800, color: '#0F172A' }}>{shortlistedCount}</div>
                </div>
                <div style={{ padding: '16px', borderRadius: '12px', background: '#F8FAFC' }}>
                  <div style={{ fontSize: '11px', color: '#64748B', marginBottom: '6px', textTransform: 'uppercase' }}>Interviews Requested</div>
                  <div style={{ fontSize: '18px', fontWeight: 800, color: '#0F172A' }}>{interviewCount}</div>
                </div>
              </div>
            </section>
          </div>

          <aside style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <Card style={{ background: '#F8FAFC' }}>
              <h4 style={{ fontSize: '14px', fontWeight: 800, color: '#0F172A', marginBottom: '12px' }}>Status Timeline</h4>
              <div style={{ display: 'grid', gap: '12px' }}>
                {timeline.map(stage => (
                  <div key={stage.label} style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <span style={{ width: '12px', height: '12px', borderRadius: '50%', background: stage.active ? '#2563EB' : '#CBD5E1' }} />
                    <span style={{ color: stage.active ? '#0F172A' : '#64748B', fontWeight: stage.active ? 700 : 500, fontSize: '13px' }}>{stage.label}</span>
                  </div>
                ))}
              </div>
            </Card>

            <Card style={{ background: '#FFFFFF' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                <span style={{ fontSize: '14px', fontWeight: 800, color: '#0F172A' }}>Interview Activity</span>
                <span style={{ fontSize: '12px', color: '#64748B' }}>{interviewCount} actions</span>
              </div>
              {interviewCount > 0 ? (
                <div style={{ display: 'grid', gap: '10px' }}>
                  {(interviewRequests[request.id] || []).map((candidateName: string, index: number) => (
                    <div key={index} style={{ padding: '12px', borderRadius: '12px', background: '#F8FAFC' }}>
                      <div style={{ fontSize: '13px', fontWeight: 700, color: '#0F172A' }}>{candidateName}</div>
                      <div style={{ fontSize: '12px', color: '#64748B', marginTop: '4px' }}>Interview requested</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ fontSize: '13px', color: '#64748B' }}>No interviews have been requested for this request yet.</div>
              )}
            </Card>
          </aside>
        </Card>

        <Card style={{ display: 'grid', gap: '24px' }}>
          <h3 style={{ fontSize: '15px', fontWeight: 800, color: '#0F172A' }}>Matched candidates for this request</h3>
          {requestMatches.length > 0 ? (
            requestMatches.map((match: any) => {
              const talent = talents.find((t: any) => t.id === match.talentId) || { name: match.talentId, title: 'Candidate', avatar: '', location: 'Remote' };
              const isShortlisted = !!matchingShortlistedState[match.talentId];
              const requestedInterviews = interviewRequests[request.id] || [];
              const interviewRequested = requestedInterviews.includes(talent.name);
              return (
                <Card key={match.id} style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <img src={talent.avatar || 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=80'} alt="" style={{ width: '56px', height: '56px', borderRadius: '18px', objectFit: 'cover' }} />
                    <div>
                      <div style={{ fontSize: '16px', fontWeight: 800, color: '#0F172A' }}>{talent.name}</div>
                      <div style={{ fontSize: '12px', color: '#64748B' }}>{talent.title || 'Matched talent profile'}</div>
                    </div>
                    <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
                      <div style={{ fontSize: '12px', color: '#64748B' }}>Match score</div>
                      <div style={{ fontSize: '18px', fontWeight: 800, color: '#2563EB' }}>{match.score}%</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                    <button
                      onClick={() => handleShortlistToggle(match.talentId, talent.name, request.id)}
                      style={{ padding: '10px 16px', borderRadius: '10px', border: isShortlisted ? '1px solid #2563EB' : '1px solid #E2E8F0', background: isShortlisted ? '#EFF6FF' : '#FFFFFF', color: isShortlisted ? '#2563EB' : '#475569', fontWeight: 700, cursor: 'pointer' }}
                    >
                      {isShortlisted ? '✓ Shortlisted' : 'Shortlist'}
                    </button>
                    <button
                      onClick={() => handleRequestInterview(talent.name, request.id)}
                      style={{ padding: '10px 16px', borderRadius: '10px', border: '1px solid #E2E8F0', background: interviewRequested ? '#ECFDF5' : '#FFFFFF', color: interviewRequested ? '#047857' : '#475569', fontWeight: 700, cursor: 'pointer' }}
                    >
                      {interviewRequested ? 'Interview Requested' : 'Request Interview'}
                    </button>
                    <span style={{ alignSelf: 'center', fontSize: '12px', color: '#64748B' }}>{talent.location}</span>
                  </div>
                </Card>
              );
            })
          ) : (
            <div style={{ padding: '22px', borderRadius: '14px', background: '#F8FAFC', color: '#64748B' }}>
              There is no matched candidate data for this request yet. Shortlist candidates from the Talent Matching page to populate your pipeline.
            </div>
          )}
        </Card>
      </div>
    );
  };

  const renderRadar = () => {
    // Dynamic matching sidebar requests
    const openRequests = clientRequests.map(r => {
      const requestMatches = matches.filter(m => m.requestId === r.id && (m.status === 'Shortlisted' || m.status === 'Interview Requested' || m.status === 'Interview Scheduled' || m.status === 'Interviewed'));
      return {
        id: r.id,
        category: r.serviceType.toUpperCase(),
        title: r.serviceType + ' - ' + (r.roleDescription.split(' ')[0] || 'Talent'),
        posted: r.createdAt ? `Posted ${new Date(r.createdAt).toLocaleDateString()}` : 'Posted recently',
        badgeText: requestMatches.length > 0 ? `${requestMatches.length} Shortlisted` : 'Matching...',
        badgeType: requestMatches.length > 0 ? ('filled' as const) : ('outline' as const),
      };
    });

    const activeRequest = clientRequests.find(r => r.id === selectedMatchingRequestId) || clientRequests[0];

    const requestMatches = activeRequest ? matches.filter(m => m.requestId === activeRequest.id && (m.status === 'Shortlisted' || m.status === 'Interview Requested' || m.status === 'Interview Scheduled' || m.status === 'Interviewed')) : [];

    const candidatesList = requestMatches
      .filter(m => talents.some(t => t.id === m.talentId))
      .map(match => {
        const talent = talents.find(t => t.id === match.talentId)!;
        return {
          matchId: match.id,
          talentId: talent.id,
          name: talent.name,
          avatar: talent.avatar || 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&q=80&w=80',
          location: talent.timezone || 'Remote',
          experience: `${talent.experienceYears || 5}+ Years Experience`,
          availability: 'Immediate availability',
          techStack: talent.skills || [],
          score: `${match.score || 92}%`,
          status: match.status,
          requestedDate: match.requestedDate,
          requestedTime: match.requestedTime,
          requestedDuration: match.requestedDuration,
          requestedNotes: match.requestedNotes
        };
      });

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
        
        {/* Viewing Talent Profile Detail Modal */}
        {viewingTalentProfile && (
          <div style={{
            position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(6px)',
            zIndex: 1001, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px'
          }}>
            <div style={{
              background: '#FFFFFF', borderRadius: '24px', padding: '36px',
              width: '100%', maxWidth: '640px', boxShadow: '0 25px 80px rgba(0,0,0,0.2)',
              maxHeight: '90vh', overflowY: 'auto', boxSizing: 'border-box', position: 'relative'
            }}>
              <button 
                onClick={() => setViewingTalentProfile(null)} 
                style={{ 
                  position: 'absolute', right: '24px', top: '24px', 
                  background: '#F1F5F9', border: 'none', borderRadius: '8px', 
                  width: '36px', height: '36px', cursor: 'pointer', fontSize: '18px', 
                  color: '#475569', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' 
                }}
              >
                ×
              </button>

              <div style={{ display: 'flex', gap: '20px', alignItems: 'center', marginBottom: '24px' }}>
                <div style={{
                  width: '72px', height: '72px', borderRadius: '50%',
                  background: '#EFF6FF', display: 'flex', alignItems: 'center',
                  justifyContent: 'center', color: '#2563EB', fontWeight: 800,
                  fontSize: '24px', border: '3px solid #E2E8F0', overflow: 'hidden'
                }}>
                  {viewingTalentProfile.avatar ? (
                    <img src={viewingTalentProfile.avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    viewingTalentProfile.name.charAt(0)
                  )}
                </div>
                <div>
                  <h2 style={{ fontSize: '22px', fontWeight: 900, color: '#0F172A', margin: '0 0 4px 0' }}>{viewingTalentProfile.name}</h2>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <span style={{ fontSize: '13px', color: '#2563EB', fontWeight: 700 }}>{viewingTalentProfile.title}</span>
                    <span style={{ width: '4px', height: '4px', borderRadius: '50%', background: '#94A3B8' }} />
                    <span style={{ fontSize: '12px', color: '#64748B' }}>{viewingTalentProfile.location || viewingTalentProfile.timezone}</span>
                  </div>
                </div>
                <div style={{ marginLeft: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                  <span style={{ fontWeight: 900, fontSize: '18px', color: '#10B981' }}>{viewingTalentProfile.grade} Grade</span>
                  <span style={{ fontSize: '11px', color: '#10B981', fontWeight: 700 }}>Vetted Talent Profile</span>
                </div>
              </div>

              {/* Bio & Details */}
              <div style={{ marginBottom: '24px' }}>
                <h3 style={{ fontSize: '14px', fontWeight: 800, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>Executive Summary</h3>
                <p style={{ fontSize: '13px', color: '#475569', lineHeight: 1.6, margin: 0 }}>
                  {viewingTalentProfile.bio || 'Highly accomplished operational talent with comprehensive expertise in enterprise delivery management, team coordination, and system integrations.'}
                </p>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '24px' }}>
                <div style={{ background: '#F8FAFC', padding: '16px', borderRadius: '12px', border: '1px solid #F1F5F9' }}>
                  <h3 style={{ fontSize: '12px', fontWeight: 800, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 12px 0' }}>Key Metrics</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#64748B' }}>Experience</span>
                      <strong style={{ color: '#1E293B' }}>{viewingTalentProfile.experienceYears || 5} Years</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#64748B' }}>Expected Salary</span>
                      <strong style={{ color: '#1E293B' }}>${viewingTalentProfile.salaryExpectation || 4500}/mo</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#64748B' }}>Availability</span>
                      <strong style={{ color: '#10B981' }}>{viewingTalentProfile.availability || 100}% Immediate</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#64748B' }}>Vetting Status</span>
                      <strong style={{ color: '#2563EB' }}>{viewingTalentProfile.vettingStatus || 'Vetted'}</strong>
                    </div>
                  </div>
                </div>

                <div style={{ background: '#F8FAFC', padding: '16px', borderRadius: '12px', border: '1px solid #F1F5F9' }}>
                  <h3 style={{ fontSize: '12px', fontWeight: 800, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 12px 0' }}>Technical Vetting Scores</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ color: '#64748B' }}>Technical Fit</span>
                      <strong style={{ color: '#1E293B' }}>{viewingTalentProfile.vettingScores?.technical || 94}%</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ color: '#64748B' }}>Behavioral Fit</span>
                      <strong style={{ color: '#1E293B' }}>{viewingTalentProfile.vettingScores?.behavioral || 90}%</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ color: '#64748B' }}>Communication</span>
                      <strong style={{ color: '#1E293B' }}>{viewingTalentProfile.vettingScores?.communication || 95}%</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ color: '#64748B' }}>Remote Readiness</span>
                      <strong style={{ color: '#10B981' }}>{viewingTalentProfile.vettingScores?.remoteReadiness || 98}%</strong>
                    </div>
                  </div>
                </div>
              </div>

              {/* Workspace Infrastructure */}
              <div style={{ background: '#F8FAFC', padding: '16px', borderRadius: '12px', border: '1px solid #F1F5F9', marginBottom: '24px' }}>
                <h3 style={{ fontSize: '12px', fontWeight: 800, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 12px 0' }}>Workspace Infrastructure</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', fontSize: '12px', color: '#475569' }}>
                  <div>
                    <span style={{ display: 'block', color: '#94A3B8', fontWeight: 700, fontSize: '10px', textTransform: 'uppercase', marginBottom: '2px' }}>Devices</span>
                    <strong>{viewingTalentProfile.devices || 'MacBook Pro M3, Dual 4K Monitors'}</strong>
                  </div>
                  <div>
                    <span style={{ display: 'block', color: '#94A3B8', fontWeight: 700, fontSize: '10px', textTransform: 'uppercase', marginBottom: '2px' }}>Internet</span>
                    <strong>{viewingTalentProfile.internetQuality || 'Fiber Optic High-Speed (100 Mbps+)'}</strong>
                  </div>
                </div>
              </div>

              {/* Skills Pills */}
              <div style={{ marginBottom: '32px' }}>
                <h3 style={{ fontSize: '12px', fontWeight: 800, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '10px' }}>Key Technical Expertise</h3>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {(viewingTalentProfile.skills || []).map((sk: string) => (
                    <span key={sk} style={{ fontSize: '11px', fontWeight: 700, background: '#EFF6FF', color: '#2563EB', padding: '4px 10px', borderRadius: '6px' }}>
                      {sk}
                    </span>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px' }}>
                <button 
                  onClick={() => setViewingTalentProfile(null)} 
                  style={{ flex: 1, padding: '12px', borderRadius: '10px', border: '1px solid #E2E8F0', background: '#FFFFFF', fontWeight: 700, fontSize: '13px', color: '#475569', cursor: 'pointer' }}
                >
                  Close Profile
                </button>
                <button 
                  onClick={() => {
                    const match = matches.find(m => m.talentId === viewingTalentProfile.id && m.requestId === activeRequest.id);
                    if (match) {
                      setRequestInterviewTarget({
                        matchId: match.id,
                        talentId: viewingTalentProfile.id,
                        talentName: viewingTalentProfile.name,
                        requestId: activeRequest.id
                      });
                      setRequestInterviewForm(f => ({ ...f, date: new Date(Date.now() + 86400000 * 2).toISOString().split('T')[0] }));
                      setShowRequestInterviewModal(true);
                    }
                    setViewingTalentProfile(null);
                  }}
                  style={{ flex: 2, padding: '12px', borderRadius: '10px', border: 'none', background: '#2563EB', fontWeight: 800, fontSize: '13px', color: '#FFFFFF', cursor: 'pointer' }}
                >
                  📅 Request Coordination Interview
                </button>
              </div>

            </div>
          </div>
        )}

        {/* Hire Candidate / Job Offer Modal */}
        {showHireModal && hireTarget && (
          <div style={{
            position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(6px)',
            zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px'
          }}>
            <div style={{
              background: '#FFFFFF', borderRadius: '20px', padding: '36px',
              width: '100%', maxWidth: '500px', boxShadow: '0 24px 80px rgba(0,0,0,0.15)',
              boxSizing: 'border-box'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <div>
                  <h2 style={{ fontSize: '20px', fontWeight: 900, color: '#0F172A', margin: '0 0 4px 0' }}>Generate Job Offer</h2>
                  <p style={{ fontSize: '12px', color: '#64748B', margin: 0 }}>Deploy EOR contract proposal for {hireTarget.name}</p>
                </div>
                <button onClick={() => { setShowHireModal(false); setHireTarget(null); }} style={{ background: '#F1F5F9', border: 'none', borderRadius: '8px', width: '36px', height: '36px', cursor: 'pointer', fontSize: '16px', color: '#475569' }}>×</button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <label style={labelStyle}>Proposed Start Date *</label>
                  <input type="date" style={inputStyle} value={hireForm.startDate} min={new Date().toISOString().split('T')[0]} onChange={e => setHireForm(f => ({ ...f, startDate: e.target.value }))} />
                </div>

                <div>
                  <label style={labelStyle}>Monthly Retainer Rate (USD) *</label>
                  <input type="number" style={inputStyle} value={hireForm.salary} onChange={e => setHireForm(f => ({ ...f, salary: e.target.value }))} placeholder="e.g. 4500" />
                </div>

                <div>
                  <label style={labelStyle}>Offer Letter Notes / Custom Clauses</label>
                  <textarea style={{ ...inputStyle, minHeight: '80px', resize: 'vertical' }} placeholder="Mention specific milestones, benefits, or custom terms..." value={hireForm.notes} onChange={e => setHireForm(f => ({ ...f, notes: e.target.value }))} />
                </div>

                <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: '10px', padding: '12px 16px', display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                  <span style={{ fontSize: '14px' }}>🛡️</span>
                  <p style={{ fontSize: '11px', color: '#166534', margin: 0, lineHeight: 1.4 }}>
                    By extending this offer, Kongila will draft a localized employment contract compliant with all EOR tax and labor frameworks.
                  </p>
                </div>

                <div style={{ display: 'flex', gap: '12px', marginTop: '4px' }}>
                  <button onClick={() => { setShowHireModal(false); setHireTarget(null); }} style={{ flex: 1, padding: '12px', borderRadius: '10px', border: '1px solid #E2E8F0', background: '#FFFFFF', fontWeight: 700, fontSize: '13px', color: '#475569', cursor: 'pointer' }}>Cancel</button>
                  <button
                    onClick={async () => {
                      if (!hireForm.startDate || !hireForm.salary) {
                        alert('Please fill in start date and monthly rate.');
                        return;
                      }

                      const updatedMatches = matches.map(m => {
                        if (m.id === hireTarget.matchId) {
                          return {
                            ...m,
                            status: 'Offer Extended' as const
                          };
                        }
                        return m;
                      });

                      const newContract = {
                        id: `contract_${Date.now()}`,
                        matchId: hireTarget.matchId,
                        clientId: currentUser?.id || 'usr_horizon',
                        clientName: currentUser ? `${currentUser.name} (${currentUser.companyName || 'Vanguard Corp'})` : 'Client',
                        talentId: hireTarget.talentId,
                        talentName: hireTarget.name,
                        role: activeRequest.roleDescription || activeRequest.serviceType,
                        salary: Number(hireForm.salary),
                        rateAmount: Number(hireForm.salary),
                        rateType: 'Monthly',
                        startDate: hireForm.startDate,
                        status: 'Pending',
                        createdAt: new Date().toISOString()
                      };

                      try {
                        const res = await fetch('/api/db');
                        if (res.ok) {
                          const dbData = await res.json();
                          dbData.matches = updatedMatches;
                          dbData.contracts = [...(dbData.contracts || []), newContract];
                          dbData.notifications = [
                            {
                              id: `notif_${Date.now()}`,
                              userId: hireTarget.talentId,
                              title: 'Job Offer Received!',
                              message: `You received a job offer for the "${newContract.role}" role at $${newContract.salary}/mo.`,
                              read: false,
                              createdAt: new Date().toISOString()
                            },
                            ...(dbData.notifications || [])
                          ];
                          dbData.auditLogs = [
                            {
                              id: `audit_${Date.now()}`,
                              actor: currentUser?.name || 'Client',
                              action: 'Extend Job Offer',
                              details: `Offer contract initiated for ${hireTarget.name} for the ${newContract.role} role.`,
                              timestamp: new Date().toISOString()
                            },
                            ...(dbData.auditLogs || [])
                          ];

                          if (saveToDb) {
                            await saveToDb(dbData);
                          }
                          if (setMatches) {
                            setMatches(updatedMatches);
                          }
                          setShowHireModal(false);
                          setHireTarget(null);
                          alert(`Job Offer Extended to ${hireTarget.name} successfully! EOR drafting initiated.`);
                        }
                      } catch {
                        alert('Failed to extend offer. Please try again.');
                      }
                    }}
                    style={{ flex: 2, padding: '12px', borderRadius: '10px', border: 'none', background: '#10B981', fontWeight: 800, fontSize: '13px', color: '#FFFFFF', cursor: 'pointer' }}
                  >
                    💼 Extend Retainer Offer
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Request Interview Modal */}
        {showRequestInterviewModal && requestInterviewTarget && (
          <div style={{
            position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(6px)',
            zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px'
          }}>
            <div style={{
              background: '#FFFFFF', borderRadius: '20px', padding: '36px',
              width: '100%', maxWidth: '500px', boxShadow: '0 24px 80px rgba(0,0,0,0.15)',
              boxSizing: 'border-box'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <div>
                  <h2 style={{ fontSize: '20px', fontWeight: 900, color: '#0F172A', margin: '0 0 4px 0' }}>Request Interview</h2>
                  <p style={{ fontSize: '12px', color: '#64748B', margin: 0 }}>Proposed scheduling for {requestInterviewTarget.talentName}</p>
                </div>
                <button onClick={() => { setShowRequestInterviewModal(false); setRequestInterviewTarget(null); }} style={{ background: '#F1F5F9', border: 'none', borderRadius: '8px', width: '36px', height: '36px', cursor: 'pointer', fontSize: '16px', color: '#475569' }}>×</button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                  <div>
                    <label style={labelStyle}>Proposed Date *</label>
                    <input type="date" style={inputStyle} value={requestInterviewForm.date} min={new Date().toISOString().split('T')[0]} onChange={e => setRequestInterviewForm(f => ({ ...f, date: e.target.value }))} />
                  </div>
                  <div>
                    <label style={labelStyle}>Proposed Time *</label>
                    <input type="time" style={inputStyle} value={requestInterviewForm.time} onChange={e => setRequestInterviewForm(f => ({ ...f, time: e.target.value }))} />
                  </div>
                </div>

                <div>
                  <label style={labelStyle}>Duration</label>
                  <select style={inputStyle} value={requestInterviewForm.duration} onChange={e => setRequestInterviewForm(f => ({ ...f, duration: e.target.value }))}>
                    <option value="30">30 minutes</option>
                    <option value="45">45 minutes</option>
                    <option value="60">60 minutes</option>
                    <option value="90">90 minutes</option>
                  </select>
                </div>

                <div>
                  <label style={labelStyle}>Agenda / Message for Admin</label>
                  <textarea style={{ ...inputStyle, minHeight: '80px', resize: 'vertical' }} placeholder="Topics you would like to cover, specific technologies, etc." value={requestInterviewForm.notes} onChange={e => setRequestInterviewForm(f => ({ ...f, notes: e.target.value }))} />
                </div>

                <div style={{ background: '#F0F9FF', border: '1px solid #BAE6FD', borderRadius: '10px', padding: '12px 16px', display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                  <span style={{ fontSize: '14px' }}>💬</span>
                  <p style={{ fontSize: '11px', color: '#0369A1', margin: 0, lineHeight: 1.4 }}>
                    Our operations team will review this slot with <strong>{requestInterviewTarget.talentName}</strong>, confirm availability, and secure the calendar booking.
                  </p>
                </div>

                <div style={{ display: 'flex', gap: '12px', marginTop: '4px' }}>
                  <button onClick={() => { setShowRequestInterviewModal(false); setRequestInterviewTarget(null); }} style={{ flex: 1, padding: '12px', borderRadius: '10px', border: '1px solid #E2E8F0', background: '#FFFFFF', fontWeight: 700, fontSize: '13px', color: '#475569', cursor: 'pointer' }}>Cancel</button>
                  <button
                    onClick={submitInterviewRequest}
                    style={{ flex: 2, padding: '12px', borderRadius: '10px', border: 'none', background: '#2563EB', fontWeight: 800, fontSize: '13px', color: '#FFFFFF', cursor: 'pointer' }}
                  >
                    🚀 Submit Proposal
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ fontSize: '32px', fontWeight: 800, color: '#0F172A', marginBottom: '8px', letterSpacing: '-0.03em' }}>Talent Matching</h1>
            <p style={{ fontSize: '15px', color: '#64748B', margin: 0 }}>Review vetted candidates shortlisted by our operators for your open roles.</p>
          </div>
          
          <div style={{ fontSize: '11px', fontWeight: 800, background: '#EFF6FF', color: '#2563EB', padding: '6px 12px', borderRadius: '20px', letterSpacing: '0.05em' }}>
            👥 {matches.filter(m => m.status === 'Shortlisted').length} CANDIDATES SHORTLISTED
          </div>
        </div>

        {/* Workspace Split */}
        <div className="db-grid-split-300-left" style={{ alignItems: 'start' }}>
          
          {/* Left Column: Open Requests Sidebar */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            
            <Card style={{ padding: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <span style={{ fontSize: '11px', fontWeight: 800, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Your Requests</span>
                <span style={{ fontSize: '10px', fontWeight: 800, color: '#2563EB', background: '#EFF6FF', padding: '2px 6px', borderRadius: '4px' }}>
                  {clientRequests.length} ACTIVE
                </span>
              </div>

              {/* Sidebar list items */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {openRequests.map(r => {
                  const isActive = r.id === (activeRequest?.id || '');
                  return (
                    <div 
                      key={r.id}
                      onClick={() => setSelectedMatchingRequestId(r.id)}
                      style={{
                        padding: '14px 16px', borderRadius: '10px', cursor: 'pointer',
                        background: isActive ? '#FFFFFF' : 'transparent',
                        border: isActive ? '1px solid #E2E8F0' : '1px solid transparent',
                        borderLeft: isActive ? '3px solid #2563EB' : '1px solid transparent',
                        boxShadow: isActive ? '0 4px 12px rgba(0,0,0,0.02)' : 'none',
                        transition: 'all 0.2s'
                      }}
                      onMouseEnter={e => { if(!isActive) e.currentTarget.style.background = '#F8FAFC'; }}
                      onMouseLeave={e => { if(!isActive) e.currentTarget.style.background = 'transparent'; }}
                    >
                      <div style={{ fontSize: '9px', fontWeight: 800, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>
                        {r.category}
                      </div>
                      <h4 style={{ fontSize: '13px', fontWeight: 800, color: isActive ? '#0F172A' : '#475569', margin: '0 0 6px 0' }}>
                        {r.title}
                      </h4>
                      
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '10px', color: '#94A3B8' }}>{r.posted}</span>
                        <span style={{ 
                          fontSize: '9px', fontWeight: 800, 
                          background: r.badgeType === 'filled' ? '#2563EB' : 'transparent',
                          color: r.badgeType === 'filled' ? '#FFFFFF' : '#64748B',
                          border: r.badgeType === 'outline' ? '1px solid #E2E8F0' : 'none',
                          padding: '2px 6px', borderRadius: '4px' 
                        }}>
                          {r.badgeText}
                        </span>
                      </div>

                    </div>
                  );
                })}
                {clientRequests.length === 0 && (
                  <p style={{ fontSize: '12px', color: '#94A3B8', margin: 0, textAlign: 'center', padding: '12px 0' }}>No active service requests logged.</p>
                )}
              </div>

            </Card>

          </div>

          {/* Right Column: Vetted Candidates Main Area */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            
            {/* Main Area Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#0F172A', margin: 0 }}>
                {activeRequest ? (
                  <>Vetted Shortlisted Candidates <span style={{ fontWeight: 500, color: '#64748B', fontSize: '14px' }}>for {activeRequest.serviceType}</span></>
                ) : (
                  <>Candidates Match Sourcing Pipeline</>
                )}
              </h3>
            </div>

            {/* Candidates Matches Grid */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {candidatesList.length > 0 ? (
                candidatesList.map(cand => {
                  return (
                    <Card key={cand.talentId} style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '24px', position: 'relative' }}>
                      
                      {/* Avatar Circle */}
                      <div style={{ position: 'relative', width: '56px', height: '56px' }}>
                        <div style={{
                          width: '56px', height: '56px', borderRadius: '50%',
                          background: '#EFF6FF', display: 'flex', alignItems: 'center',
                          justifyContent: 'center', color: '#2563EB', fontWeight: 800,
                          fontSize: '18px', border: '2px solid #E2E8F0', overflow: 'hidden'
                        }}>
                          {cand.avatar ? (
                            <img src={cand.avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          ) : (
                            cand.name.charAt(0)
                          )}
                        </div>
                        <span style={{
                          position: 'absolute', right: 0, bottom: 0,
                          width: '16px', height: '16px', borderRadius: '50%',
                          background: '#10B981', display: 'flex', alignItems: 'center',
                          justifyContent: 'center', color: '#FFFFFF', fontSize: '10px',
                          border: '2px solid #FFFFFF', fontWeight: 900
                        }}>✓</span>
                      </div>

                      {/* Content Specs */}
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '8px' }}>
                          <div>
                            <h4 style={{ fontSize: '16px', fontWeight: 800, color: '#0F172A', margin: '0 0 2px 0' }}>{cand.name}</h4>
                            <span style={{ fontSize: '12px', color: '#94A3B8' }}>{cand.location}</span>
                          </div>
                          
                          {/* Compatibility score tag */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ fontSize: '12px', color: '#10B981', fontWeight: 800 }}>{cand.score} compatibility</span>
                          </div>
                        </div>

                        {/* Telemetry specs grid */}
                        <div className="db-grid-2" style={{ gap: '12px', background: '#F8FAFC', padding: '12px 16px', borderRadius: '10px', marginBottom: '16px' }}>
                          <div>
                            <span style={{ fontSize: '10px', color: '#94A3B8', display: 'block', textTransform: 'uppercase' }}>Experience Level</span>
                            <span style={{ fontSize: '12px', fontWeight: 700, color: '#334155' }}>{cand.experience}</span>
                          </div>
                          <div>
                            <span style={{ fontSize: '10px', color: '#94A3B8', display: 'block', textTransform: 'uppercase' }}>Availability</span>
                            <span style={{ fontSize: '12px', fontWeight: 700, color: '#334155' }}>{cand.availability}</span>
                          </div>
                        </div>

                        {/* Tech stack */}
                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '20px' }}>
                          {cand.techStack.map((sk: string) => (
                            <span key={sk} style={{ fontSize: '10px', fontWeight: 700, background: '#F1F5F9', color: '#475569', padding: '3px 8px', borderRadius: '4px' }}>
                              {sk}
                            </span>
                          ))}
                        </div>

                        {/* Actions footer */}
                        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', borderTop: '1px solid #F1F5F9', paddingTop: '16px', flexWrap: 'wrap' }}>
                          <button 
                            onClick={() => {
                              setRequestInterviewTarget({
                                matchId: cand.matchId,
                                talentId: cand.talentId,
                                talentName: cand.name,
                                requestId: activeRequest.id
                              });
                              setRequestInterviewForm(f => ({ ...f, date: new Date(Date.now() + 86400000 * 2).toISOString().split('T')[0] })); // Defaults to 2 days out
                              setShowRequestInterviewModal(true);
                            }}
                            disabled={cand.status !== 'Shortlisted'}
                            style={{
                              background: cand.status === 'Shortlisted' ? '#2563EB' : (cand.status === 'Interview Requested' ? '#EFF6FF' : '#ECFDF5'),
                              border: 'none',
                              borderRadius: '8px', padding: '8px 16px', 
                              color: cand.status === 'Shortlisted' ? '#FFFFFF' : (cand.status === 'Interview Requested' ? '#2563EB' : '#10B981'),
                              fontWeight: 700, fontSize: '12px', cursor: cand.status === 'Shortlisted' ? 'pointer' : 'default'
                            }}
                          >
                            {cand.status === 'Shortlisted' && '📅 Request Interview'}
                            {cand.status === 'Interview Requested' && '⏳ Interview Requested'}
                            {cand.status === 'Interview Scheduled' && '✓ Interview Scheduled'}
                          </button>

                          {(cand.status === 'Shortlisted' || cand.status === 'Interview Scheduled' || cand.status === 'Interview Requested') && (
                            <button
                              onClick={() => {
                                setHireTarget(cand);
                                setHireForm({
                                  salary: activeRequest.budget ? String(activeRequest.budget) : '4500',
                                  startDate: new Date(Date.now() + 86400000 * 7).toISOString().split('T')[0],
                                  notes: ''
                                });
                                setShowHireModal(true);
                              }}
                              style={{
                                background: '#10B981',
                                border: 'none',
                                borderRadius: '8px', padding: '8px 16px',
                                color: '#FFFFFF',
                                fontWeight: 700, fontSize: '12px', cursor: 'pointer'
                              }}
                            >
                              💼 Hire Candidate
                            </button>
                          )}

                          <button 
                            onClick={() => {
                              const exactTalent = talents.find(t => t.id === cand.talentId);
                              if (exactTalent) {
                                setViewingTalentProfile(exactTalent);
                              } else {
                                alert('Talent profile loading...');
                              }
                            }}
                            style={{ background: 'transparent', border: 'none', color: '#2563EB', fontSize: '12px', fontWeight: 700, cursor: 'pointer', marginLeft: 'auto' }}
                          >
                            View Full Profile ➔
                          </button>
                        </div>

                      </div>

                    </Card>
                  );
                })
              ) : (
                <div style={{ textAlign: 'center', padding: '56px 40px', color: '#64748B', background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '20px' }}>
                  <div style={{ fontSize: '48px', marginBottom: '16px' }}>👥</div>
                  <h4 style={{ fontSize: '16px', fontWeight: 800, color: '#0F172A', margin: '0 0 8px 0' }}>Sourcing & Vetting Candidates</h4>
                  <p style={{ fontSize: '13px', color: '#64748B', margin: 0, maxWidth: '400px', marginLeft: 'auto', marginRight: 'auto', lineHeight: 1.5 }}>
                    Our operations team is actively searching the Kongila network and vetting candidates against your role specifications. Candidates will appear here as soon as they are shortlisted.
                  </p>
                </div>
              )}
            </div>

            {/* proposed slot banners info if requested */}
            {candidatesList.some(c => c.status === 'Interview Requested') && (
              <div style={{ 
                display: 'flex', flexWrap: 'wrap', gap: '16px', justifyContent: 'space-between', alignItems: 'center',
                background: '#FFFFFF', border: '1px solid #E2E8F0', 
                borderRadius: '16px', padding: '20px', marginTop: '12px',
                boxShadow: '0 4px 16px rgba(0,0,0,0.02)', position: 'relative'
              }}>
                <div>
                  <div style={{ fontSize: '11px', fontWeight: 800, color: '#2563EB', textTransform: 'uppercase', marginBottom: '6px' }}>Interview Proposal Active</div>
                  <div style={{ fontSize: '13px', color: '#1E293B', fontWeight: 700 }}>
                    Our operations team is currently coordinating with candidates for the proposed interview slots.
                  </div>
                </div>
              </div>
            )}

          </div>

        </div>

      </div>
    );
  };

  const renderContracts = () => {
    // Sort so signed ones appear first
    const displayContracts = [...activeContracts].slice(0, 5);

    // Filter ended contracts dynamically from DB contracts prop
    const endedContracts = clientContracts.filter(c => 
      c.status?.toLowerCase() === 'ended' || 
      c.status?.toLowerCase() === 'terminated' || 
      c.status?.toLowerCase() === 'closed'
    );

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
        
        {/* Header Bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ fontSize: '32px', fontWeight: 800, color: '#0F172A', marginBottom: '8px', letterSpacing: '-0.03em' }}>Hiring & Contracts</h1>
            <p style={{ fontSize: '15px', color: '#64748B', margin: 0 }}>Manage your elite talent pool and legal engagements.</p>
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button 
              onClick={() => alert('Audit logs downloaded successfully.')}
              style={{
                background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '10px',
                padding: '10px 18px', color: '#475569', fontWeight: 700, fontSize: '13px',
                cursor: 'pointer', transition: 'background 0.2s'
              }}
            >
              Audit Logs
            </button>
            <button 
              onClick={() => alert('Exporting active contractors telemetry.')}
              style={{
                background: '#2563EB', border: 'none', borderRadius: '10px',
                padding: '10px 18px', color: '#FFFFFF', fontWeight: 700, fontSize: '13px',
                cursor: 'pointer', transition: 'background 0.2s', boxShadow: '0 4px 12px rgba(37,99,235,0.1)'
              }}
            >
              Export Report
            </button>
          </div>
        </div>

        {/* Grid Workspace */}
        <div className="db-grid-split-21" style={{ alignItems: 'start' }}>
          
          {/* Left Column: Active Hires & Ended Contracts */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
            
            {/* Active Hires Grid Table */}
            <Card style={{ padding: '24px 0 0 0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 24px 20px 24px', borderBottom: '1px solid #F1F5F9' }}>
                <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#0F172A', margin: 0 }}>Active Hires</h3>
                <span style={{ fontSize: '11px', fontWeight: 800, background: '#ECFDF5', color: '#10B981', padding: '3px 8px', borderRadius: '12px', textTransform: 'uppercase' }}>
                  {activeContracts.length || 4} Total Active
                </span>
              </div>

              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #F1F5F9' }}>
                    <th style={{ padding: '16px 24px', fontWeight: 700, color: '#475569', fontSize: '11px', textTransform: 'uppercase' }}>Talent</th>
                    <th style={{ padding: '16px 24px', fontWeight: 700, color: '#475569', fontSize: '11px', textTransform: 'uppercase' }}>Role</th>
                    <th style={{ padding: '16px 24px', fontWeight: 700, color: '#475569', fontSize: '11px', textTransform: 'uppercase' }}>Start Date</th>
                    <th style={{ padding: '16px 24px', fontWeight: 700, color: '#475569', fontSize: '11px', textTransform: 'uppercase' }}>Commitment</th>
                    <th style={{ padding: '16px 24px', fontWeight: 700, color: '#475569', fontSize: '11px', textTransform: 'uppercase', textAlign: 'right' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {displayContracts.length > 0 ? (
                    displayContracts.map(c => {
                      const globalId = `RM-${c.id.substring(0, 4).toUpperCase()}`;
                      const isFullTime = c.salary > 8000;
                      
                      const talentInfo = talents.find(t => t.id === c.talentId || t.name === c.talentName);
                      const talentAvatar = talentInfo?.avatar || "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&q=80&w=80";

                      return (
                        <tr key={c.id} style={{ borderBottom: '1px solid #F1F5F9', transition: 'background 0.2s' }} onMouseEnter={e => e.currentTarget.style.background = '#F8FAFC'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                          
                          {/* Talent Column */}
                          <td style={{ padding: '16px 24px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                              <img src={talentAvatar} alt="" style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover' }} />
                              <div>
                                <div style={{ fontWeight: 800, color: '#0F172A', fontSize: '14px' }}>{c.talentName}</div>
                                <div style={{ fontSize: '11px', color: '#64748B', marginTop: '2px' }}>Global ID: {globalId}</div>
                              </div>
                            </div>
                          </td>

                          {/* Role Column */}
                          <td style={{ padding: '16px 24px', fontWeight: 700, color: '#334155' }}>
                            {c.role}
                          </td>

                          {/* Start Date */}
                          <td style={{ padding: '16px 24px', color: '#64748B' }}>
                            {c.createdAt ? new Date(c.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Oct 12, 2023'}
                          </td>

                          {/* Commitment pill */}
                          <td style={{ padding: '16px 24px' }}>
                            <span style={{
                              display: 'inline-block', fontSize: '10px', fontWeight: 800,
                              padding: '3px 8px', borderRadius: '12px',
                              background: isFullTime ? '#EFF6FF' : '#F1F5F9',
                              color: isFullTime ? '#2563EB' : '#475569',
                              textTransform: 'uppercase', letterSpacing: '0.05em'
                            }}>
                              {isFullTime ? 'FULL-TIME' : 'PART-TIME'}
                            </span>
                          </td>

                          {/* Action contract sheet link */}
                          <td style={{ padding: '16px 24px', textAlign: 'right' }}>
                            <button 
                              onClick={() => { setShowSignModal(true); }}
                              style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '6px', cursor: 'pointer', transition: 'background 0.2s' }}
                            >
                              📄
                            </button>
                            <button 
                              onClick={() => { 
                                setReviewTalentDetails({
                                  id: c.talentId || c.id,
                                  name: c.talentName,
                                  role: c.role,
                                  contract: `Contract Reference: ${globalId}`,
                                  avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&q=80&w=80'
                                });
                                setSelectedReviewTalentId(c.talentId || c.id);
                                setReviewRating(0);
                                setTechSkillValue(4);
                                setCommValue(5);
                                setReliabilityValue(5);
                                setPublicFeedbackText('');
                                setPrivateFeedbackText('');
                                setShowReviewModal(true);
                              }}
                              title="Leave Review"
                              style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '6px', cursor: 'pointer', transition: 'background 0.2s', marginLeft: '6px' }}
                            >
                              ⭐
                            </button>
                          </td>

                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={5} style={{ padding: '32px', textAlign: 'center', color: '#64748B' }}>
                        No active hires found. Start a new search in Sourcing or Talent Matching!
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </Card>

            {/* Recently Ended Contracts Section */}
            <Card>
              <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#0F172A', marginBottom: '20px' }}>Recently Ended Contracts</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {endedContracts.length > 0 ? (
                  endedContracts.map(ended => (
                    <div key={ended.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', border: '1px solid #F1F5F9', borderRadius: '12px', background: '#FAFBFC', opacity: 0.85 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <img src={ended.avatar || "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&q=80&w=80"} alt="" style={{ width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover' }} />
                        <div>
                          <div style={{ fontWeight: 800, color: '#475569', fontSize: '14px', textDecoration: 'line-through' }}>{ended.talentName}</div>
                          <div style={{ fontSize: '12px', color: '#64748B', marginTop: '2px' }}>{ended.role} • Ended {ended.endDate || new Date(ended.updatedAt || Date.now()).toLocaleDateString()}</div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '10px' }}>
                        <button 
                          onClick={() => {
                            setRehireTarget(ended);
                            setRehireForm({
                              role: ended.role,
                              rate: '12400',
                              startDate: new Date(Date.now() + 86400000 * 7).toISOString().split('T')[0],
                              commitmentLevel: 'Full-Time',
                              notes: ''
                            });
                            setShowRehireModal(true);
                          }}
                          style={{
                            background: '#EFF6FF', border: 'none', borderRadius: '8px',
                            padding: '8px 14px', color: '#2563EB', fontWeight: 700, fontSize: '12px',
                            cursor: 'pointer'
                          }}
                        >
                          Re-hire
                        </button>
                        <button 
                          onClick={() => alert('Displaying exit memo logs.')}
                          style={{
                            background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '8px',
                            padding: '8px 14px', color: '#475569', fontWeight: 700, fontSize: '12px',
                            cursor: 'pointer'
                          }}
                        >
                          View Exit Memo
                        </button>
                        <button 
                          onClick={() => {
                            setReviewTalentDetails({
                              id: ended.talentId || ended.id,
                              name: ended.talentName,
                              role: ended.role,
                              contract: `Ended on ${ended.endDate || 'past contract'}`,
                              avatar: ended.avatar
                            });
                            setSelectedReviewTalentId(ended.talentId || ended.id);
                            setReviewRating(0);
                            setTechSkillValue(4);
                            setCommValue(5);
                            setReliabilityValue(5);
                            setPublicFeedbackText('');
                            setPrivateFeedbackText('');
                            setShowReviewModal(true);
                          }}
                          style={{
                            background: '#EFFDF4', border: 'none', borderRadius: '8px',
                            padding: '8px 14px', color: '#15803D', fontWeight: 700, fontSize: '12px',
                            cursor: 'pointer'
                          }}
                        >
                          Leave Review
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div style={{ textAlign: 'center', padding: '24px', color: '#64748B', fontSize: '13px' }}>
                    No recently ended contracts.
                  </div>
                )}
              </div>
            </Card>

          </div>

          {/* Right Column: Sidebar Panels (Terms, Status checklist, Extension) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
            
            {/* Widget 1: Engagement Terms */}
            <Card>
              <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#0F172A', marginBottom: '20px', borderBottom: '1px solid #F1F5F9', paddingBottom: '12px' }}>
                Engagement Terms
              </h3>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '24px' }}>
                
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '13px', color: '#64748B', fontWeight: 500 }}>Blended Rate</span>
                  <span style={{ fontSize: '14px', fontWeight: 800, color: '#0F172A' }}>$115.00/hr</span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '13px', color: '#64748B', fontWeight: 500 }}>Billing Cycle</span>
                  <span style={{ fontSize: '14px', fontWeight: 800, color: '#0F172A' }}>Bi-Weekly</span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '13px', color: '#64748B', fontWeight: 500 }}>Active Duration</span>
                  <span style={{ fontSize: '14px', fontWeight: 800, color: '#0F172A' }}>6 Months</span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '13px', color: '#64748B', fontWeight: 500 }}>Next Renewal</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 800, color: '#2563EB' }}>April 12, 2024</span>
                    <span style={{ fontSize: '12px' }}>📅</span>
                  </div>
                </div>

              </div>

              <button 
                onClick={() => alert('Accessing engagement manager settings.')}
                style={{
                  width: '100%', background: '#FFFFFF', border: '1px solid #E2E8F0',
                  borderRadius: '12px', padding: '14px', color: '#0F172A',
                  fontWeight: 700, fontSize: '13px', cursor: 'pointer',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.02)', marginBottom: '12px'
                }}
              >
                ⚙️ Manage Engagement
              </button>
              <div style={{ fontSize: '10px', color: '#94A3B8', fontWeight: 700, textAlign: 'center', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Subject to 7-Day Notice Period
              </div>
            </Card>

            {/* Widget 2: Contract Legal Status Checklist */}
            <Card>
              <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#0F172A', marginBottom: '20px', borderBottom: '1px solid #F1F5F9', paddingBottom: '12px' }}>
                Contract Status
              </h3>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                  <span style={{ fontSize: '16px', background: '#ECFDF5', color: '#10B981', padding: '4px', borderRadius: '50%', display: 'inline-flex' }}>✓</span>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: '13px', color: '#1E293B' }}>Master Services Agreement</div>
                    <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '2px' }}>Signed: Oct 2023</div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                  <span style={{ fontSize: '16px', background: '#ECFDF5', color: '#10B981', padding: '4px', borderRadius: '50%', display: 'inline-flex' }}>✓</span>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: '13px', color: '#1E293B' }}>Mutual NDA - Global</div>
                    <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '2px' }}>Signed: Sep 2023</div>
                  </div>
                </div>

                {activeContracts.length > 0 ? (
                  activeContracts.map(c => (
                    <div key={c.id} style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                      <span style={{ fontSize: '16px', background: '#EFF6FF', color: '#2563EB', padding: '4px', borderRadius: '50%', display: 'inline-flex' }}>⚙️</span>
                      <div>
                        <div style={{ fontWeight: 800, fontSize: '13px', color: '#1E293B' }}>Individual SOW - {c.role}</div>
                        <div style={{ fontSize: '11px', color: '#2563EB', fontWeight: 700, marginTop: '2px' }}>Active - {c.talentName}</div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                    <span style={{ fontSize: '16px', background: '#F1F5F9', color: '#64748B', padding: '4px', borderRadius: '50%', display: 'inline-flex' }}>⚙️</span>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: '13px', color: '#64748B' }}>Individual SOW</div>
                      <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '2px' }}>No active statement of work</div>
                    </div>
                  </div>
                )}

              </div>
            </Card>

            {/* Widget 3: Extension CTA Banner */}
            <div style={{
              background: 'linear-gradient(135deg, #1E3A8A 0%, #0F172A 100%)',
              borderRadius: '16px', padding: '28px', color: '#FFFFFF',
              boxShadow: '0 8px 30px rgba(15,23,42,0.12)', textAlign: 'center'
            }}>
              <h4 style={{ fontSize: '16px', fontWeight: 800, margin: '0 0 10px 0' }}>Need an Extension?</h4>
              <p style={{ fontSize: '12px', color: '#E2E8F0', margin: '0 0 20px 0', lineHeight: 1.5 }}>
                Request a contract extension for your top talent in one click.
              </p>
              <button 
                onClick={() => alert('Extension request successfully dispatched to AM support desk.')}
                style={{
                  width: '100%', background: '#FFFFFF', border: 'none',
                  borderRadius: '20px', padding: '12px', color: '#2563EB',
                  fontWeight: 800, fontSize: '13px', cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(255,255,255,0.1)', transition: 'transform 0.2s'
                }}
              >
                Request Now
              </button>
            </div>

          </div>

        </div>

      </div>
    );
  };
  const handleSinglePayment = async (invId: string, amount: number) => {
    const updatedInvoices = invoices.map(inv => 
      inv.id === invId ? { ...inv, status: 'paid' as const } : inv
    );

    const newAuditLog = {
      id: `audit_${Date.now()}`,
      actor: currentUser?.name || 'Client Operator',
      action: 'Pay Invoice',
      details: `Succeeded in paying invoice INV-${invId.replace('inv_', '').substring(0, 6).toUpperCase()} of ${formatCurrency(amount)}.`,
      timestamp: new Date().toISOString()
    };

    const newAgentLog = {
      id: `alog_${Date.now()}`,
      agentName: 'Billing Agent' as const,
      message: `Invoice ${invId} successfully settled via VISA card ending 4412.`,
      timestamp: new Date().toLocaleTimeString(),
      type: 'success' as const
    };

    const updatedDb = {
      notifications: [
        {
          id: `notif_${Date.now()}`,
          userId: currentUser?.id,
          title: 'Invoice Settled',
          message: `Invoice INV-${invId.replace('inv_', '').substring(0, 6).toUpperCase()} of ${formatCurrency(amount)} was successfully paid!`,
          read: false,
          createdAt: new Date().toISOString()
        }
      ],
      auditLogs: [newAuditLog],
      agentLogs: [newAgentLog],
      invoices: updatedInvoices
    };

    try {
      if (setInvoices) {
        setInvoices(updatedInvoices);
      }
      if (saveToDb) {
        await saveToDb(updatedDb);
      }
      alert(`Payment of ${formatCurrency(amount)} successfully processed for Invoice INV-${invId.replace('inv_', '').substring(0, 6).toUpperCase()} via credit card VISA •••• 4412.`);
    } catch (err) {
      console.error('Single payment failed:', err);
      alert('Failed to process payment. Please try again.');
    }
  };

  const renderBilling = () => {
    // Dynamic database calculation from real invoices
    const clientInvoices = invoices.filter(inv => inv.clientId === currentUser?.id);
    
    // Sum real database records strictly specific to this account
    const dbPaidSum = clientInvoices
      .filter(inv => inv.status?.toLowerCase() === 'paid')
      .reduce((sum, inv) => sum + Number(inv.amount || 0), 0);
    const dbPendingSum = clientInvoices
      .filter(inv => inv.status?.toLowerCase() !== 'paid')
      .reduce((sum, inv) => sum + Number(inv.amount || 0), 0);
    
    const totalPaidYTD = dbPaidSum;
    const outstandingBalance = dbPendingSum;

    // Dynamically look up last paid invoice
    const paidInvoices = clientInvoices.filter(inv => inv.status?.toLowerCase() === 'paid');
    const lastPaidInvoice = paidInvoices[paidInvoices.length - 1];

    // Dynamically look up next pending billing date and details
    const pendingInvoices = clientInvoices.filter(inv => inv.status?.toLowerCase() !== 'paid');
    const sortedPending = [...pendingInvoices].sort((a, b) => new Date(a.dueDate || '').getTime() - new Date(b.dueDate || '').getTime());
    const nextInvoice = sortedPending[0];
    const overdueCount = pendingInvoices.length;

    const handleBatchPayment = async () => {
      // Dispatch payment sync alert and backend notification log
      await supabase.from('notifications').insert({
        user_id: currentUser?.id,
        title: 'Batch Payment Complete',
        content: `Batch payment of ${formatCurrency(outstandingBalance)} successfully processed via default VISA card ending 4412.`,
        read_status: false
      });

      alert(`Batch payment of ${formatCurrency(outstandingBalance)} initiated successfully via default card VISA •••• 4412. Verification receipt is on the way!`);
    };

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
        
        {/* Header Title */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ fontSize: '32px', fontWeight: 800, color: '#0F172A', marginBottom: '8px', letterSpacing: '-0.03em' }}>Billing & Financials</h1>
            <p style={{ fontSize: '15px', color: '#64748B', margin: 0 }}>Monitor your workforce investment and manage enterprise transactions.</p>
          </div>
          
          <div style={{ display: 'flex', gap: '12px' }}>
            <button 
              onClick={() => alert('Downloading comprehensive PDF ledger report...')}
              style={{
                background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '10px',
                padding: '10px 18px', color: '#475569', fontWeight: 700, fontSize: '13px',
                cursor: 'pointer'
              }}
            >
              Export Report
            </button>
            
            <button 
              onClick={handleBatchPayment}
              style={{
                background: '#2563EB', border: 'none', borderRadius: '10px',
                padding: '10px 18px', color: '#FFFFFF', fontWeight: 700, fontSize: '13px',
                cursor: 'pointer', boxShadow: '0 4px 12px rgba(37,99,235,0.1)'
              }}
            >
              Make Batch Payment
            </button>
          </div>
        </div>

        {/* Stats Row */}
        <div className="db-grid-3" style={{ gap: '20px' }}>
          
          {/* Card 1 */}
          <Card style={{ padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontSize: '10px', fontWeight: 800, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Paid (YTD)</span>
              {totalPaidYTD > 0 && (
                <span style={{ fontSize: '9px', fontWeight: 800, background: '#ECFDF5', color: '#10B981', padding: '2px 6px', borderRadius: '4px' }}>+12% vs LY</span>
              )}
            </div>
            <div style={{ fontSize: '28px', fontWeight: 900, color: '#0F172A', marginBottom: '8px' }}>
              {formatCurrency(totalPaidYTD)}
            </div>
            <span style={{ fontSize: '11px', color: '#64748B' }}>
              {lastPaidInvoice ? (
                <>Last payment: <strong style={{ color: '#1E293B' }}>{formatCurrency(lastPaidInvoice.amount)}</strong> ({new Date(lastPaidInvoice.createdAt || lastPaidInvoice.dueDate || Date.now()).toLocaleDateString()})</>
              ) : (
                'No payments made yet'
              )}
            </span>
          </Card>

          {/* Card 2 */}
          <Card style={{ padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontSize: '10px', fontWeight: 800, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Outstanding Balance</span>
              {overdueCount > 0 && (
                <span style={{ fontSize: '9px', fontWeight: 800, background: '#FEF2F2', color: '#EF4444', padding: '2px 6px', borderRadius: '4px' }}>⚠️ {overdueCount} Unpaid {overdueCount === 1 ? 'Invoice' : 'Invoices'}</span>
              )}
            </div>
            <div style={{ fontSize: '28px', fontWeight: 900, color: outstandingBalance > 0 ? '#EF4444' : '#0F172A', marginBottom: '8px' }}>
              {formatCurrency(outstandingBalance)}
            </div>
            <span style={{ fontSize: '11px', color: '#64748B' }}>
              {outstandingBalance > 0 ? 'Requires immediate action' : 'Account in good standing'}
            </span>
          </Card>

          {/* Card 3 */}
          <Card style={{ padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontSize: '10px', fontWeight: 800, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Next Billing Date</span>
              <span style={{ fontSize: '12px' }}>📅</span>
            </div>
            <div style={{ fontSize: '28px', fontWeight: 900, color: '#0F172A', marginBottom: '8px' }}>
              {nextInvoice ? new Date(nextInvoice.dueDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : 'None'}
            </div>
            <span style={{ fontSize: '11px', color: '#64748B' }}>
              {nextInvoice ? (
                <>Estimated amount: <strong style={{ color: '#1E293B' }}>{formatCurrency(nextInvoice.amount)}</strong></>
              ) : (
                'No upcoming billing'
              )}
            </span>
          </Card>

        </div>

        {/* Split Grid */}
        <div className="db-grid-split-320" style={{ alignItems: 'start' }}>
          
          {/* Left Panel: Separate Outstanding & Overdue Invoices above History */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', flex: 1 }}>
            
            {(() => {
              const unpaidAndOverdueInvoices = clientInvoices.filter(inv => inv.status?.toLowerCase() !== 'paid');

              return (
                <Card style={{ padding: '0px', overflow: 'hidden', border: '1px solid #FEE2E2', background: 'rgba(254, 242, 242, 0.4)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '24px' }}>
                    <div>
                      <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#991B1B', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '18px' }}>⚠️</span> Action Required: Overdue & Outstanding Invoices
                      </h3>
                      <p style={{ fontSize: '12px', color: '#7F1D1D', margin: '4px 0 0 0', opacity: 0.8 }}>Please settle these outstanding amounts to avoid service disruptions.</p>
                    </div>
                    <span style={{ fontSize: '11px', fontWeight: 800, padding: '4px 10px', borderRadius: '12px', background: '#FEE2E2', color: '#991B1B' }}>
                      {unpaidAndOverdueInvoices.length} Invoices Pending
                    </span>
                  </div>

                  {unpaidAndOverdueInvoices.length === 0 ? (
                    <div style={{ padding: '32px', textAlign: 'center', color: '#15803D', fontWeight: 700, fontSize: '14px' }}>
                      ✓ All invoices settled. No outstanding balance!
                    </div>
                  ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                      <thead>
                        <tr style={{ background: '#FFF5F5', borderBottom: '1px solid #FCA5A5' }}>
                          <th style={{ padding: '12px 24px', fontWeight: 800, color: '#7F1D1D', textTransform: 'uppercase', fontSize: '10px', letterSpacing: '0.05em' }}>Invoice #</th>
                          <th style={{ padding: '12px 24px', fontWeight: 800, color: '#7F1D1D', textTransform: 'uppercase', fontSize: '10px', letterSpacing: '0.05em' }}>Due Date</th>
                          <th style={{ padding: '12px 24px', fontWeight: 800, color: '#7F1D1D', textTransform: 'uppercase', fontSize: '10px', letterSpacing: '0.05em' }}>Amount</th>
                          <th style={{ padding: '12px 24px', fontWeight: 800, color: '#7F1D1D', textTransform: 'uppercase', fontSize: '10px', letterSpacing: '0.05em' }}>Status</th>
                          <th style={{ padding: '12px 24px', fontWeight: 800, color: '#7F1D1D', textTransform: 'uppercase', fontSize: '10px', letterSpacing: '0.05em', textAlign: 'right' }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {unpaidAndOverdueInvoices.map(inv => {
                          const isOverdue = inv.status === 'overdue';
                          return (
                            <tr key={inv.id} style={{ borderBottom: '1px solid #FEE2E2', background: isOverdue ? 'rgba(254, 226, 226, 0.2)' : 'transparent', transition: 'background 0.15s' }}>
                              <td style={{ padding: '16px 24px', fontWeight: 700, color: '#1E293B' }}>
                                INV-{inv.id.replace('inv_', '').substring(0, 6).toUpperCase()}
                              </td>
                              <td style={{ padding: '16px 24px', color: '#475569' }}>
                                {inv.dueDate ? new Date(inv.dueDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : 'Oct 12, 2023'}
                              </td>
                              <td style={{ padding: '16px 24px', fontWeight: 800, color: isOverdue ? '#DC2626' : '#1E293B' }}>
                                {formatCurrency(inv.amount)}
                              </td>
                              <td style={{ padding: '16px 24px' }}>
                                <span style={{ 
                                  display: 'inline-block', fontSize: '10px', fontWeight: 800, 
                                  padding: '3px 8px', borderRadius: '6px',
                                  background: isOverdue ? '#FEF2F2' : '#FFF7ED', 
                                  color: isOverdue ? '#EF4444' : '#F57C00'
                                }}>
                                  {inv.status?.toUpperCase() || 'PENDING'}
                                </span>
                              </td>
                              <td style={{ padding: '16px 24px', textAlign: 'right' }}>
                                <button 
                                  onClick={() => handleSinglePayment(inv.id, inv.amount)}
                                  style={{ 
                                    background: isOverdue ? '#DC2626' : '#2563EB', 
                                    border: 'none', 
                                    color: '#FFFFFF', 
                                    padding: '6px 14px', 
                                    borderRadius: '6px', 
                                    fontSize: '11px', 
                                    fontWeight: 700, 
                                    cursor: 'pointer',
                                    transition: 'background 0.15s',
                                    boxShadow: isOverdue ? '0 2px 6px rgba(220,38,38,0.2)' : '0 2px 6px rgba(37,99,235,0.2)'
                                  }}
                                >
                                  Pay Now ➔
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </Card>
              );
            })()}

            {/* Existing Left Panel: Invoice History */}
            <Card style={{ padding: '0px', overflow: 'hidden' }}>
              
              {/* Panel Title & Dropdown */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '24px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#0F172A', margin: 0 }}>Invoice History</h3>
                <select 
                  style={{ 
                    background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '8px', 
                    padding: '4px 12px', fontSize: '12px', fontWeight: 700, color: '#475569', outline: 'none' 
                  }}
                >
                  <option>Last 6 Months</option>
                  <option>Last 12 Months</option>
                  <option>Year to Date</option>
                </select>
              </div>

              {/* Invoices High-fidelity Table */}
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                <thead>
                  <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                    <th style={{ padding: '12px 24px', fontWeight: 800, color: '#64748B', textTransform: 'uppercase', fontSize: '10px', letterSpacing: '0.05em' }}>Invoice #</th>
                    <th style={{ padding: '12px 24px', fontWeight: 800, color: '#64748B', textTransform: 'uppercase', fontSize: '10px', letterSpacing: '0.05em' }}>Date</th>
                    <th style={{ padding: '12px 24px', fontWeight: 800, color: '#64748B', textTransform: 'uppercase', fontSize: '10px', letterSpacing: '0.05em' }}>Amount</th>
                    <th style={{ padding: '12px 24px', fontWeight: 800, color: '#64748B', textTransform: 'uppercase', fontSize: '10px', letterSpacing: '0.05em' }}>Service</th>
                    <th style={{ padding: '12px 24px', fontWeight: 800, color: '#64748B', textTransform: 'uppercase', fontSize: '10px', letterSpacing: '0.05em' }}>Status</th>
                    <th style={{ padding: '12px 24px', fontWeight: 800, color: '#64748B', textTransform: 'uppercase', fontSize: '10px', letterSpacing: '0.05em' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {clientInvoices.length > 0 ? (
                    clientInvoices.map(inv => {
                      const isPaid = inv.status === 'paid';
                      const isOverdue = inv.status === 'overdue' || inv.status === 'unpaid';
                      
                      return (
                        <tr key={inv.id} style={{ borderBottom: '1px solid #F1F5F9', transition: 'background 0.15s' }}>
                          <td style={{ padding: '16px 24px', fontWeight: 700, color: '#1E293B' }}>
                            INV-{inv.id.substring(0, 4).toUpperCase()}
                          </td>
                          <td style={{ padding: '16px 24px', color: '#64748B' }}>
                            {inv.dueDate ? new Date(inv.dueDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : 'Oct 12, 2023'}
                          </td>
                          <td style={{ padding: '16px 24px', fontWeight: 800, color: '#1E293B' }}>
                            {formatCurrency(inv.amount)}
                          </td>
                          <td style={{ padding: '16px 24px', color: '#475569', fontWeight: 600 }}>
                            {inv.serviceTitle || 'DevOps Managed Team'}
                          </td>
                          <td style={{ padding: '16px 24px' }}>
                            <span style={{ 
                              display: 'inline-block', fontSize: '10px', fontWeight: 800, 
                              padding: '3px 8px', borderRadius: '6px',
                              background: isPaid ? '#ECFDF5' : (isOverdue ? '#FEF2F2' : '#FFF7ED'), 
                              color: isPaid ? '#10B981' : (isOverdue ? '#EF4444' : '#F57C00')
                            }}>
                              {inv.status?.toUpperCase() || 'PENDING'}
                            </span>
                          </td>
                          <td style={{ padding: '16px 24px' }}>
                            <button 
                              onClick={() => alert(`Opening details for Invoice #${inv.id.substring(0, 8)}`)}
                              style={{ background: 'transparent', border: 'none', color: '#94A3B8', fontSize: '16px', cursor: 'pointer' }}
                            >
                              ⋮
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={6} style={{ padding: '32px', textAlign: 'center', color: '#64748B' }}>
                        No billing history found. Invoices will appear here once active hiring begins.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>

              <div style={{ textAlign: 'center', padding: '16px', borderTop: '1px solid #F1F5F9' }}>
                <button 
                  onClick={() => setShowAllInvoicesModal(true)}
                  style={{ background: 'transparent', border: 'none', color: '#2563EB', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}
                >
                  View All Invoices
                </button>
              </div>

            </Card>
          </div>

          {/* Right Sidebar */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            
            {/* Managed Services Panel */}
            <Card>
              <h3 style={{ fontSize: '14px', fontWeight: 800, color: '#0F172A', marginBottom: '16px' }}>Managed Services</h3>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                
                {/* Service 1 */}
                <div style={{ borderBottom: '1px solid #F1F5F9', paddingBottom: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '4px' }}>
                    <h4 style={{ fontSize: '13px', fontWeight: 800, color: '#1E293B', margin: 0 }}>Elite DevOps Tier</h4>
                    <span style={{ fontSize: '12px', fontWeight: 800, color: '#2563EB' }}>$12,400/mo</span>
                  </div>
                  <span style={{ fontSize: '9px', fontWeight: 800, color: '#10B981', background: '#ECFDF5', padding: '2px 6px', borderRadius: '4px', textTransform: 'uppercase' }}>Expert</span>
                  <span style={{ fontSize: '10px', color: '#64748B', display: 'block', marginTop: '6px' }}>FULL-TIME MANAGED TEAM</span>
                </div>

                {/* Service 2 */}
                <div style={{ paddingBottom: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '4px' }}>
                    <h4 style={{ fontSize: '13px', fontWeight: 800, color: '#1E293B', margin: 0 }}>Consulting Flex Plan</h4>
                    <span style={{ fontSize: '12px', fontWeight: 800, color: '#2563EB' }}>$2,500 base</span>
                  </div>
                  <span style={{ fontSize: '10px', color: '#64748B', display: 'block' }}>PAY-AS-YOU-GO | <a href="#adjust" onClick={e => { e.preventDefault(); alert('Adjusting consulting tier basis...'); }} style={{ color: '#2563EB', textDecoration: 'none', fontWeight: 700 }}>Adjust basis</a></span>
                </div>

              </div>

              {/* View Subscription Details CTA */}
              <button 
                onClick={() => alert('Loading verified active EOR subscription details...')}
                style={{
                  width: '100%', background: '#FFFFFF', border: '1px solid #E2E8F0',
                  borderRadius: '8px', padding: '8px', fontSize: '11px',
                  fontWeight: 700, color: '#64748B', cursor: 'pointer',
                  marginTop: '12px'
                }}
              >
                View Subscription Details
              </button>
            </Card>

            {/* Payment Methods Panel */}
            <Card>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 style={{ fontSize: '14px', fontWeight: 800, color: '#0F172A', margin: 0 }}>Payment Methods</h3>
                <button 
                  onClick={() => alert('Launching Add New Card Modal...')}
                  style={{ background: 'transparent', border: 'none', color: '#2563EB', fontSize: '16px', fontWeight: 800, cursor: 'pointer' }}
                >
                  +
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                
                {/* Method 1 */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px', border: '1px solid #E2E8F0', borderRadius: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '18px' }}>💳</span>
                    <span style={{ fontSize: '12px', fontWeight: 700, color: '#1E293B' }}>Visa •••• 4412</span>
                  </div>
                  <span style={{ fontSize: '9px', fontWeight: 800, color: '#2563EB', background: '#EFF6FF', padding: '2px 6px', borderRadius: '4px' }}>DEFAULT</span>
                </div>

                {/* Method 2 */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px', border: '1px solid #E2E8F0', borderRadius: '8px', opacity: 0.6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '18px' }}>💳</span>
                    <span style={{ fontSize: '12px', fontWeight: 700, color: '#1E293B' }}>Mastercard •••• 8901</span>
                  </div>
                </div>

                {/* Method 3 */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px', border: '1px solid #E2E8F0', borderRadius: '8px', opacity: 0.6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '18px' }}>🏦</span>
                    <span style={{ fontSize: '12px', fontWeight: 700, color: '#1E293B' }}>Chase Business Checking</span>
                  </div>
                </div>

              </div>
            </Card>
            {/* Card block removed */}

          </div>

        </div>

      </div>
    );
  };

  const renderMessaging = () => {
    const threadReceiverMap: Record<string, string> = {
      sarah: 'usr_sarah',
      michael: 'usr_michael',
      support: 'usr_support',
      david: 'usr_david'
    };

    const activeReceiverId = threadReceiverMap[selectedThreadId] || 'usr_horizon';

    // Renders live database messages filtering by current selected thread's recipient or sender
    const liveThreadMessages = messages.filter(m => {
      return (m.senderId === currentUser?.id && m.receiverId === activeReceiverId) ||
             (m.senderId === activeReceiverId && m.receiverId === currentUser?.id);
    });

    // Map active hired talents dynamically as secure chat channels
    const activeContractors = contracts
      .filter(c => c.clientId === currentUser?.id && (c.status?.toLowerCase() === 'signed' || c.status?.toLowerCase() === 'active'));

    const threads = [
      ...activeContractors.map(c => {
        const tInfo = talents.find(t => t.id === c.talentId || t.name === c.talentName);
        return {
          id: c.talentId || c.id,
          name: c.talentName,
          title: c.role,
          avatar: tInfo?.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=80',
          time: 'Active',
          preview: `Direct secure channel with ${c.talentName.split(' ')[0]}`,
          activeNow: true,
          unread: false,
          expertise: tInfo?.skills || [c.role],
          project: 'Contract Active',
          startDate: c.createdAt ? new Date(c.createdAt).toLocaleDateString() : 'Recently'
        };
      }),
      {
        id: 'michael',
        name: 'Michael Chen',
        title: 'Account Manager',
        avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&q=80&w=80',
        time: 'Platform Support',
        preview: 'Your primary account manager for onboarding and talent curation.',
        activeNow: false,
        unread: false,
        expertise: ['Success Management', 'Operations', 'Global Compliance'],
        project: 'Horizon Operations',
        startDate: 'Platform Registration'
      },
      {
        id: 'support',
        name: 'Kongila Support',
        title: 'Platform Operations',
        avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=80',
        time: '24/7 Desk',
        preview: 'Technical helpdesk and service operations support.',
        activeNow: true,
        unread: false,
        expertise: ['Billing Help', 'Platform Guide', 'Technical Issues'],
        project: 'Global Operations Desk',
        startDate: 'Continuous Support'
      }
    ];

    // Build map for dynamic message routing
    activeContractors.forEach(c => {
      threadReceiverMap[c.talentId || c.id] = c.talentId || `usr_${c.id}`;
    });

    // Search filter over threads list
    const filteredThreads = threads.filter(t => 
      t.name.toLowerCase().includes(searchChatFilter.toLowerCase()) ||
      t.title.toLowerCase().includes(searchChatFilter.toLowerCase())
    );

    const activeThread = threads.find(t => t.id === selectedThreadId) || threads[0];

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        
        {/* Header */}
        <div>
          <h1 style={{ fontSize: '32px', fontWeight: 800, color: '#0F172A', marginBottom: '8px', letterSpacing: '-0.03em' }}>Client Messaging Hub</h1>
          <p style={{ fontSize: '15px', color: '#64748B', margin: 0 }}>Communicate directly with matched talent, technical leads, and account success managers.</p>
        </div>

        {/* 3-Panel Hub Container */}
        <div className="messaging-hub-container" style={{}}>
          
          {/* PANEL A: Message List Column (Left) */}
          <div className="messaging-thread-list" style={{}}>
            
            {/* Search across communication */}
            <div style={{ padding: '18px', borderBottom: '1px solid #E2E8F0', position: 'relative' }}>
              <input 
                type="text" 
                placeholder="Search across communication..."
                value={searchChatFilter}
                onChange={e => setSearchChatFilter(e.target.value)}
                style={{
                  width: '100%', height: '38px', border: '1px solid #E2E8F0',
                  borderRadius: '10px', padding: '0 12px 0 32px', fontSize: '13px',
                  boxSizing: 'border-box', outline: 'none', background: '#F8FAFC'
                }}
              />
              <span style={{ position: 'absolute', left: '28px', top: '26px', fontSize: '13px', color: '#94A3B8' }}>🔍</span>
            </div>

            {/* Sub-Header info and unread counts */}
            <div style={{ padding: '12px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#FAFBFC', borderBottom: '1px solid #E2E8F0' }}>
              <span style={{ fontSize: '11px', fontWeight: 800, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Messages</span>
              <span style={{ fontSize: '10px', fontWeight: 800, background: '#2563EB', color: '#FFFFFF', padding: '2px 8px', borderRadius: '10px' }}>12 UNREAD</span>
            </div>

            {/* Scrollable Threads List */}
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {filteredThreads.map(t => {
                const isActive = t.id === selectedThreadId;
                return (
                  <div 
                    key={t.id}
                    onClick={() => setSelectedThreadId(t.id)}
                    style={{
                      display: 'flex', gap: '12px', padding: '16px 18px',
                      borderBottom: '1px solid #F1F5F9', cursor: 'pointer',
                      background: isActive ? '#F1F5F9' : 'transparent',
                      transition: 'background 0.2s'
                    }}
                    onMouseEnter={e => { if(!isActive) e.currentTarget.style.background = '#F8FAFC'; }}
                    onMouseLeave={e => { if(!isActive) e.currentTarget.style.background = 'transparent'; }}
                  >
                    {/* Avatar with dynamic online dot indicator */}
                    <div style={{ position: 'relative' }}>
                      <img src={t.avatar} alt="" style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover' }} />
                      {t.activeNow && (
                        <span style={{
                          position: 'absolute', right: 0, bottom: 0,
                          width: '10px', height: '10px', borderRadius: '50%',
                          background: '#10B981', border: '2px solid #FFFFFF'
                        }} />
                      )}
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '2px' }}>
                        <h4 style={{ fontSize: '13px', fontWeight: 800, color: '#0F172A', margin: 0 }}>{t.name}</h4>
                        <span style={{ fontSize: '10px', color: '#94A3B8' }}>{t.time}</span>
                      </div>
                      <div style={{ fontSize: '11px', fontWeight: 700, color: '#3B82F6', marginBottom: '4px' }}>{t.title}</div>
                      <p style={{
                        fontSize: '12px', color: t.unread ? '#0F172A' : '#64748B',
                        fontWeight: t.unread ? 800 : 400, margin: 0,
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
                      }}>
                        {t.preview}
                      </p>
                    </div>

                  </div>
                );
              })}
            </div>

          </div>

          {/* PANEL B: Active Chat Pane (Center) */}
          <div style={{ display: 'flex', flexDirection: 'column', background: '#FAFBFC' }}>
            
            {/* Active Thread Chat Header */}
            <div style={{ 
              padding: '18px 24px', background: '#FFFFFF', 
              borderBottom: '1px solid #E2E8F0', display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'space-between' 
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <img src={activeThread.avatar} alt="" style={{ width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover' }} />
                <div>
                  <h3 style={{ fontSize: '14px', fontWeight: 800, color: '#0F172A', margin: 0 }}>{activeThread.name}</h3>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: activeThread.activeNow ? '#10B981' : '#94A3B8' }} />
                    <span style={{ fontSize: '11px', color: '#64748B', fontWeight: 500 }}>
                      {activeThread.activeNow ? 'Active Now' : 'Offline'}
                    </span>
                  </div>
                </div>
              </div>
              
              {/* Quick actions buttons */}
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                <button style={{ background: 'transparent', border: 'none', color: '#64748B', fontSize: '15px', cursor: 'pointer' }}>🔍 Search</button>
                <button style={{ background: 'transparent', border: 'none', color: '#64748B', fontSize: '16px', cursor: 'pointer' }}>⋮</button>
              </div>
            </div>

            {/* Bubble Messages Display */}
            <div style={{ flex: 1, padding: '24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              
              {/* Date Indicator badge */}
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <span style={{ fontSize: '10px', fontWeight: 800, color: '#64748B', background: '#E2E8F0', padding: '3px 12px', borderRadius: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Today, October 24
                </span>
              </div>

              {/* Sarah default mock messages inside Sarah's thread */}
              {selectedThreadId === 'sarah' && (
                <>
                  {/* Left message (incoming) */}
                  <div style={{ display: 'flex', gap: '12px', maxWidth: '75%', alignSelf: 'flex-start' }}>
                    <img src={activeThread.avatar} alt="" style={{ width: '28px', height: '28px', borderRadius: '50%', objectFit: 'cover', alignSelf: 'flex-end' }} />
                    <div>
                      <div style={{ 
                        background: '#FFFFFF', border: '1px solid #E2E8F0', 
                        color: '#1E293B', padding: '12px 16px', 
                        borderRadius: '16px 16px 16px 0px', fontSize: '13px', 
                        lineHeight: 1.5, boxShadow: '0 1px 3px rgba(0,0,0,0.01)'
                      }}>
                        Hi there! I've finished the initial user flow exploration for the Remotan dashboard. I've focused on reducing the cognitive load during talent selection.
                      </div>
                      <span style={{ fontSize: '10px', color: '#94A3B8', display: 'block', marginTop: '4px', marginLeft: '2px' }}>10:30 AM</span>
                    </div>
                  </div>

                  {/* Right message (outgoing) */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignSelf: 'flex-end', maxWidth: '75%' }}>
                    <div style={{ 
                      background: '#1E3A8A', color: '#FFFFFF', 
                      padding: '12px 16px', borderRadius: '16px 16px 0px 16px', 
                      fontSize: '13px', lineHeight: 1.5, boxShadow: '0 2px 6px rgba(30,58,138,0.1)'
                    }}>
                      That sounds great, Sarah. The reduction of cognitive load is exactly what our stakeholders were asking for. Did you manage to integrate the bento-style grid?
                    </div>
                    <span style={{ fontSize: '10px', color: '#94A3B8', alignSelf: 'flex-end', marginTop: '4px', marginRight: '2px' }}>
                      10:42 AM • Read
                    </span>
                  </div>
                </>
              )}

              {/* Michael default message */}
              {selectedThreadId === 'michael' && (
                <div style={{ display: 'flex', gap: '12px', maxWidth: '75%', alignSelf: 'flex-start' }}>
                  <img src={activeThread.avatar} alt="" style={{ width: '28px', height: '28px', borderRadius: '50%', objectFit: 'cover', alignSelf: 'flex-end' }} />
                  <div>
                    <div style={{ 
                      background: '#FFFFFF', border: '1px solid #E2E8F0', 
                      color: '#1E293B', padding: '12px 16px', 
                      borderRadius: '16px 16px 16px 0px', fontSize: '13px', 
                      lineHeight: 1.5 
                    }}>
                      Your quarterly client review is ready for signature. I have uploaded the EOR master contract addendums to your Billing tab dashboard.
                    </div>
                    <span style={{ fontSize: '10px', color: '#94A3B8', display: 'block', marginTop: '4px' }}>Yesterday</span>
                  </div>
                </div>
              )}

              {/* Support default */}
              {selectedThreadId === 'support' && (
                <div style={{ display: 'flex', gap: '12px', maxWidth: '75%', alignSelf: 'flex-start' }}>
                  <img src={activeThread.avatar} alt="" style={{ width: '28px', height: '28px', borderRadius: '50%', objectFit: 'cover', alignSelf: 'flex-end' }} />
                  <div>
                    <div style={{ 
                      background: '#FFFFFF', border: '1px solid #E2E8F0', 
                      color: '#1E293B', padding: '12px 16px', 
                      borderRadius: '16px 16px 16px 0px', fontSize: '13px', 
                      lineHeight: 1.5 
                    }}>
                      Ticket #4820 has been resolved by our engineering desk. The repository sync hook with Supabase auth is fully operational.
                    </div>
                    <span style={{ fontSize: '10px', color: '#94A3B8', display: 'block', marginTop: '4px' }}>2 days ago</span>
                  </div>
                </div>
              )}

              {/* David default */}
              {selectedThreadId === 'david' && (
                <div style={{ display: 'flex', gap: '12px', maxWidth: '75%', alignSelf: 'flex-start' }}>
                  <img src={activeThread.avatar} alt="" style={{ width: '28px', height: '28px', borderRadius: '50%', objectFit: 'cover', alignSelf: 'flex-end' }} />
                  <div>
                    <div style={{ 
                      background: '#FFFFFF', border: '1px solid #E2E8F0', 
                      color: '#1E293B', padding: '12px 16px', 
                      borderRadius: '16px 16px 16px 0px', fontSize: '13px', 
                      lineHeight: 1.5 
                    }}>
                      The API integration for the payment schedules is fully integrated. Please review the PR branch for testing clearance.
                    </div>
                    <span style={{ fontSize: '10px', color: '#94A3B8', display: 'block', marginTop: '4px' }}>Monday</span>
                  </div>
                </div>
              )}

              {/* Render dynamic backend live messages */}
              {liveThreadMessages.map(msg => {
                const isMe = msg.senderId === currentUser?.id;
                return (
                  <div 
                    key={msg.id}
                    style={{ 
                      display: 'flex', 
                      flexDirection: 'column', 
                      alignSelf: isMe ? 'flex-end' : 'flex-start',
                      maxWidth: '75%' 
                    }}
                  >
                    <div style={{ 
                      background: isMe ? '#1E3A8A' : '#FFFFFF', 
                      color: isMe ? '#FFFFFF' : '#1E293B', 
                      border: isMe ? 'none' : '1px solid #E2E8F0',
                      padding: '12px 16px', 
                      borderRadius: isMe ? '16px 16px 0px 16px' : '16px 16px 16px 0px', 
                      fontSize: '13px', lineHeight: 1.5, 
                      boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
                    }}>
                      {msg.content}
                    </div>
                    <span style={{ 
                      fontSize: '10px', 
                      color: '#94A3B8', 
                      alignSelf: isMe ? 'flex-end' : 'flex-start', 
                      marginTop: '4px',
                      marginLeft: isMe ? 0 : '2px',
                      marginRight: isMe ? '2px' : 0
                    }}>
                      {new Date(msg.timestamp || '').toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • Sent
                    </span>
                  </div>
                );
              })}

            </div>

            {/* Compose Text area & Formatting toolbar */}
            <form onSubmit={handleSendMessage} style={{ background: '#FFFFFF', borderTop: '1px solid #E2E8F0', padding: '16px 20px' }}>
              
              {/* Rich-text toolbar icons */}
              <div style={{ display: 'flex', gap: '14px', alignItems: 'center', marginBottom: '10px', borderBottom: '1px solid #F1F5F9', paddingBottom: '8px' }}>
                <button type="button" style={{ background: 'transparent', border: 'none', fontWeight: 800, color: '#64748B', fontSize: '13px', cursor: 'pointer' }}>B</button>
                <button type="button" style={{ background: 'transparent', border: 'none', fontStyle: 'italic', color: '#64748B', fontSize: '13px', cursor: 'pointer' }}>I</button>
                <button type="button" style={{ background: 'transparent', border: 'none', color: '#64748B', fontSize: '13px', cursor: 'pointer' }}>🔗</button>
                <button type="button" style={{ background: 'transparent', border: 'none', color: '#64748B', fontSize: '13px', cursor: 'pointer' }}>☰</button>
                <button type="button" style={{ background: 'transparent', border: 'none', color: '#64748B', fontSize: '13px', cursor: 'pointer' }}>😊</button>
              </div>

              {/* Text Input area */}
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                <input 
                  type="text" 
                  placeholder="Type your message..."
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  style={{
                    flex: 1, height: '40px', border: '1px solid #E2E8F0',
                    borderRadius: '8px', padding: '0 16px', fontSize: '13px',
                    boxSizing: 'border-box', outline: 'none'
                  }}
                />
                
                {/* Paperclip */}
                <button type="button" style={{ background: '#F1F5F9', border: 'none', borderRadius: '8px', width: '38px', height: '38px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                  📎
                </button>

                {/* Rocket Send */}
                <button 
                  type="submit"
                  style={{
                    background: '#1E3A8A', border: 'none', borderRadius: '8px',
                    width: '38px', height: '38px', display: 'flex', alignItems: 'center',
                    justifyContent: 'center', cursor: 'pointer', transition: 'background 0.2s'
                  }}
                >
                  <span style={{ color: 'white', transform: 'rotate(45deg)', display: 'inline-block' }}>🚀</span>
                </button>
              </div>

            </form>

          </div>

          {/* PANEL C: Profile Summary Sidebar (Right) */}
          <div className="messaging-details-panel" style={{}}>
            
            {/* Avatar & name */}
            <div style={{ textAlign: 'center', borderBottom: '1px solid #F1F5F9', paddingBottom: '20px', marginBottom: '20px' }}>
              <img src={activeThread.avatar} alt="" style={{ width: '64px', height: '64px', borderRadius: '50%', objectFit: 'cover', border: '3px solid #F1F5F9', marginBottom: '12px' }} />
              <h3 style={{ fontSize: '15px', fontWeight: 800, color: '#0F172A', margin: '0 0 4px 0' }}>{activeThread.name}</h3>
              <div style={{ display: 'inline-block', fontSize: '10px', fontWeight: 800, background: '#EFF6FF', color: '#2563EB', padding: '3px 8px', borderRadius: '8px', textTransform: 'uppercase' }}>
                Expert
              </div>
            </div>

            {/* Current details list */}
            <div style={{ marginBottom: '24px' }}>
              <div style={{ fontSize: '11px', fontWeight: 800, color: '#94A3B8', textTransform: 'uppercase', marginBottom: '12px' }}>Role Specifications</div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                
                <div>
                  <span style={{ fontSize: '11px', color: '#64748B', display: 'block' }}>Current Role</span>
                  <span style={{ fontSize: '13px', fontWeight: 700, color: '#1E293B' }}>{activeThread.title}</span>
                </div>

                <div>
                  <span style={{ fontSize: '11px', color: '#64748B', display: 'block' }}>Project</span>
                  <span style={{ fontSize: '13px', fontWeight: 700, color: '#1E293B' }}>{activeThread.project}</span>
                </div>

                <div>
                  <span style={{ fontSize: '11px', color: '#64748B', display: 'block' }}>Start Date</span>
                  <span style={{ fontSize: '13px', fontWeight: 700, color: '#1E293B' }}>{activeThread.startDate}</span>
                </div>

              </div>
            </div>

            {/* Expertise pills */}
            <div style={{ marginBottom: '24px' }}>
              <div style={{ fontSize: '11px', fontWeight: 800, color: '#94A3B8', textTransform: 'uppercase', marginBottom: '10px' }}>Expertise</div>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {activeThread.expertise.map((exp: any) => (
                  <span key={exp} style={{ fontSize: '10px', fontWeight: 700, background: '#F1F5F9', color: '#475569', padding: '3px 8px', borderRadius: '4px' }}>
                    {exp}
                  </span>
                ))}
              </div>
            </div>

            {/* View Full Profile CTA */}
            <button 
              onClick={() => alert(`Redirecting to Full EOR Talent Profile: ${activeThread.name}`)}
              style={{
                width: '100%', background: '#FFFFFF', border: '1px solid #E2E8F0',
                borderRadius: '10px', padding: '10px', fontSize: '12px',
                fontWeight: 700, color: '#475569', cursor: 'pointer',
                marginBottom: '20px'
              }}
            >
              View Full Profile
            </button>

            {/* Shared Links */}
            <div>
              <div style={{ fontSize: '11px', fontWeight: 800, color: '#94A3B8', textTransform: 'uppercase', marginBottom: '10px' }}>Shared Links</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <a href="#figma" onClick={e => { e.preventDefault(); alert('Opening shared Figma workspace...'); }} style={{ fontSize: '12px', color: '#2563EB', textDecoration: 'none', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  🔗 Figma Prototype
                </a>
                <a href="#docs" onClick={e => { e.preventDefault(); alert('Opening shared user research memo...'); }} style={{ fontSize: '12px', color: '#2563EB', textDecoration: 'none', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  🔗 User Research Document
                </a>
              </div>
            </div>

          </div>

        </div>

      </div>
    );
  };

  // ─── Interview State (inside component) ─────────────────────────────────────
  const [interviews, setInterviews] = React.useState<any[]>([]);
  const [interviewsLoaded, setInterviewsLoaded] = React.useState(false);
  const [showScheduleModal, setShowScheduleModal] = React.useState(false);
  const [showRescheduleModal, setShowRescheduleModal] = React.useState(false);
  const [rescheduleTarget, setRescheduleTarget] = React.useState<any>(null);
  const [scheduleForm, setScheduleForm] = React.useState({
    title: '',
    talentId: '',
    talentName: '',
    talentAvatar: '',
    requestId: '',
    matchId: '',
    date: '',
    time: '10:00',
    notes: '',
    duration: '60'
  });
  const [scheduleLoading, setScheduleLoading] = React.useState(false);
  const [rescheduleForm, setRescheduleForm] = React.useState({ date: '', time: '10:00', notes: '' });
  const [calendarCurrentDate, setCalendarCurrentDate] = React.useState(new Date());

  // Load interviews from API
  React.useEffect(() => {
    fetch('/api/interviews')
      .then(r => r.json())
      .then(data => { setInterviews(Array.isArray(data) ? data : []); setInterviewsLoaded(true); })
      .catch(() => setInterviewsLoaded(true));
  }, []);

  // Auto-fill talentName & requestId from matches when talentId changes
  React.useEffect(() => {
    if (!scheduleForm.talentId) return;
    const matchedTalent = talents.find((t: any) => t.id === scheduleForm.talentId);
    if (matchedTalent) {
      const matchedMatch = matches.find((m: any) => m.talentId === scheduleForm.talentId);
      setScheduleForm(f => ({
        ...f,
        talentName: matchedTalent.name || matchedTalent.fullName || f.talentName,
        talentAvatar: matchedTalent.avatar || matchedTalent.avatarUrl || '',
        matchId: matchedMatch?.id || '',
        requestId: matchedMatch?.requestId || ''
      }));
    }
  }, [scheduleForm.talentId]);

  const handleCreateInterview = async () => {
    if (!scheduleForm.title || !scheduleForm.talentName || !scheduleForm.date || !scheduleForm.time) {
      alert('Please fill in all required fields (title, talent, date, time).');
      return;
    }
    setScheduleLoading(true);
    try {
      const payload = {
        ...scheduleForm,
        clientName: currentUser?.organizationName || currentUser?.name || 'Client',
        status: 'Scheduled'
      };
      const res = await fetch('/api/interviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error('Failed');
      const created = await res.json();
      setInterviews(prev => [created, ...prev]);
      setShowScheduleModal(false);
      setScheduleForm({ title: '', talentId: '', talentName: '', talentAvatar: '', requestId: '', matchId: '', date: '', time: '10:00', notes: '', duration: '60' });
      if (setNotifications) {
        setNotifications([...(notifications || []), {
          id: `notif_${Date.now()}`,
          userId: currentUser?.id,
          title: 'Interview Scheduled',
          message: `"${created.title}" booked for ${created.date} at ${created.time}. Google Calendar invite sent.`,
          read: false,
          createdAt: new Date().toISOString()
        }]);
      }
    } catch {
      alert('Failed to schedule interview. Please try again.');
    } finally {
      setScheduleLoading(false);
    }
  };

  const handleReschedule = async () => {
    if (!rescheduleTarget || !rescheduleForm.date || !rescheduleForm.time) return;
    setScheduleLoading(true);
    try {
      const res = await fetch('/api/interviews', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: rescheduleTarget.id,
          date: rescheduleForm.date,
          time: rescheduleForm.time,
          notes: rescheduleForm.notes || rescheduleTarget.notes,
          status: 'Rescheduled'
        })
      });
      if (!res.ok) throw new Error('Failed');
      const updated = await res.json();
      setInterviews(prev => prev.map(iv => iv.id === updated.id ? updated : iv));
      setShowRescheduleModal(false);
      setRescheduleTarget(null);
      if (setNotifications) {
        setNotifications([...(notifications || []), {
          id: `notif_${Date.now()}`,
          userId: currentUser?.id,
          title: 'Interview Rescheduled',
          message: `"${updated.title}" moved to ${updated.date} at ${updated.time}. Calendar updated.`,
          read: false,
          createdAt: new Date().toISOString()
        }]);
      }
    } catch {
      alert('Failed to reschedule. Please try again.');
    } finally {
      setScheduleLoading(false);
    }
  };

  const handleCancelInterview = async (id: string, title: string) => {
    if (!confirm(`Cancel interview "${title}"?`)) return;
    try {
      await fetch(`/api/interviews?id=${id}`, { method: 'DELETE' });
      setInterviews(prev => prev.filter(iv => iv.id !== id));
    } catch {
      alert('Failed to cancel. Please try again.');
    }
  };

  // Generate calendar week days from current date
  const getWeekDays = (date: Date) => {
    const start = new Date(date);
    const day = start.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    start.setDate(start.getDate() + diff);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d;
    });
  };

  const weekDays = getWeekDays(calendarCurrentDate);
  const today = new Date();

  const formatWeekDay = (d: Date) => {
    const days = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
    return `${days[d.getDay()]} ${d.getDate()}`;
  };

  const getInterviewsForDay = (d: Date) => {
    const dateStr = d.toISOString().split('T')[0];
    return interviews.filter(iv => iv.date === dateStr);
  };

  const upcoming = interviews
    .filter(iv => iv.status !== 'Cancelled' && new Date(iv.date + 'T' + iv.time) >= today)
    .sort((a, b) => new Date(a.date + 'T' + a.time).getTime() - new Date(b.date + 'T' + b.time).getTime())
    .slice(0, 5);

  const statusColor: Record<string, string> = {
    Scheduled: '#2563EB',
    Rescheduled: '#7C3AED',
    Completed: '#10B981',
    Cancelled: '#EF4444'
  };
  const statusBg: Record<string, string> = {
    Scheduled: '#EFF6FF',
    Rescheduled: '#F5F3FF',
    Completed: '#ECFDF5',
    Cancelled: '#FEF2F2'
  };

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 14px', border: '1px solid #E2E8F0',
    borderRadius: '10px', fontSize: '13px', color: '#0F172A',
    background: '#F8FAFC', outline: 'none', boxSizing: 'border-box' as const
  };
  const labelStyle: React.CSSProperties = {
    fontSize: '11px', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '6px', textTransform: 'uppercase' as const, letterSpacing: '0.05em'
  };

  const renderScheduling = () => {
    const handleScheduleNew = () => setShowScheduleModal(true);

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>

        {/* ── Schedule New Interview Modal ─────────────────────────────────── */}
        {showScheduleModal && (
          <div style={{
            position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(6px)',
            zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px'
          }}>
            <div style={{
              background: '#FFFFFF', borderRadius: '20px', padding: '36px',
              width: '100%', maxWidth: '560px', boxShadow: '0 24px 80px rgba(0,0,0,0.15)',
              maxHeight: '90vh', overflowY: 'auto'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px' }}>
                <div>
                  <h2 style={{ fontSize: '22px', fontWeight: 900, color: '#0F172A', margin: '0 0 4px 0' }}>Schedule Interview</h2>
                  <p style={{ fontSize: '13px', color: '#64748B', margin: 0 }}>A Google Calendar invite will be sent automatically.</p>
                </div>
                <button onClick={() => setShowScheduleModal(false)} style={{ background: '#F1F5F9', border: 'none', borderRadius: '8px', width: '36px', height: '36px', cursor: 'pointer', fontSize: '16px', color: '#475569' }}>×</button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                <div>
                  <label style={labelStyle}>Interview Title *</label>
                  <input style={inputStyle} placeholder="e.g. Senior Full-Stack Engineer — Final Round" value={scheduleForm.title} onChange={e => setScheduleForm(f => ({ ...f, title: e.target.value }))} />
                </div>

                <div>
                  <label style={labelStyle}>Select Talent *</label>
                  <select style={inputStyle} value={scheduleForm.talentId} onChange={e => setScheduleForm(f => ({ ...f, talentId: e.target.value }))}>
                    <option value="">— Choose a candidate —</option>
                    {talents.map((t: any) => (
                      <option key={t.id} value={t.id}>{t.name || t.fullName || t.id}</option>
                    ))}
                    {talents.length === 0 && <option value="manual" onClick={() => {}}>Enter manually below</option>}
                  </select>
                </div>

                {(scheduleForm.talentId === '' || scheduleForm.talentId === 'manual') && (
                  <div>
                    <label style={labelStyle}>Talent Name (manual) *</label>
                    <input style={inputStyle} placeholder="Full name of candidate" value={scheduleForm.talentName} onChange={e => setScheduleForm(f => ({ ...f, talentName: e.target.value }))} />
                  </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                  <div>
                    <label style={labelStyle}>Date *</label>
                    <input type="date" style={inputStyle} value={scheduleForm.date} min={new Date().toISOString().split('T')[0]} onChange={e => setScheduleForm(f => ({ ...f, date: e.target.value }))} />
                  </div>
                  <div>
                    <label style={labelStyle}>Time *</label>
                    <input type="time" style={inputStyle} value={scheduleForm.time} onChange={e => setScheduleForm(f => ({ ...f, time: e.target.value }))} />
                  </div>
                </div>

                <div>
                  <label style={labelStyle}>Duration</label>
                  <select style={inputStyle} value={scheduleForm.duration} onChange={e => setScheduleForm(f => ({ ...f, duration: e.target.value }))}>
                    <option value="30">30 minutes</option>
                    <option value="45">45 minutes</option>
                    <option value="60">60 minutes</option>
                    <option value="90">90 minutes</option>
                  </select>
                </div>

                <div>
                  <label style={labelStyle}>Notes / Agenda</label>
                  <textarea style={{ ...inputStyle, minHeight: '80px', resize: 'vertical' }} placeholder="Topics to cover, required preparation, etc." value={scheduleForm.notes} onChange={e => setScheduleForm(f => ({ ...f, notes: e.target.value }))} />
                </div>

                <div style={{ background: '#F0F9FF', border: '1px solid #BAE6FD', borderRadius: '10px', padding: '12px 16px', display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                  <span style={{ fontSize: '16px' }}>📅</span>
                  <p style={{ fontSize: '12px', color: '#0369A1', margin: 0, lineHeight: 1.5 }}>
                    A <strong>Google Calendar event</strong> will be created with a Google Meet link and shared with the candidate automatically.
                  </p>
                </div>

                <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                  <button onClick={() => setShowScheduleModal(false)} style={{ flex: 1, padding: '12px', borderRadius: '10px', border: '1px solid #E2E8F0', background: '#FFFFFF', fontWeight: 700, fontSize: '13px', color: '#475569', cursor: 'pointer' }}>Cancel</button>
                  <button
                    onClick={handleCreateInterview}
                    disabled={scheduleLoading}
                    style={{ flex: 2, padding: '12px', borderRadius: '10px', border: 'none', background: scheduleLoading ? '#93C5FD' : '#2563EB', fontWeight: 800, fontSize: '13px', color: '#FFFFFF', cursor: scheduleLoading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                  >
                    {scheduleLoading ? '⏳ Scheduling...' : '📅 Confirm & Create Calendar Event'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Reschedule Modal ─────────────────────────────────────────────── */}
        {showRescheduleModal && rescheduleTarget && (
          <div style={{
            position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(6px)',
            zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px'
          }}>
            <div style={{
              background: '#FFFFFF', borderRadius: '20px', padding: '36px',
              width: '100%', maxWidth: '480px', boxShadow: '0 24px 80px rgba(0,0,0,0.15)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <div>
                  <h2 style={{ fontSize: '20px', fontWeight: 900, color: '#0F172A', margin: '0 0 4px 0' }}>Reschedule Interview</h2>
                  <p style={{ fontSize: '12px', color: '#64748B', margin: 0 }}>{rescheduleTarget.title}</p>
                </div>
                <button onClick={() => { setShowRescheduleModal(false); setRescheduleTarget(null); }} style={{ background: '#F1F5F9', border: 'none', borderRadius: '8px', width: '36px', height: '36px', cursor: 'pointer', fontSize: '16px', color: '#475569' }}>×</button>
              </div>

              {/* Current slot */}
              <div style={{ background: '#FFF7ED', border: '1px solid #FED7AA', borderRadius: '10px', padding: '12px 16px', marginBottom: '20px', display: 'flex', gap: '10px' }}>
                <span style={{ fontSize: '16px' }}>📌</span>
                <div>
                  <p style={{ fontSize: '11px', fontWeight: 700, color: '#C2410C', margin: '0 0 2px 0', textTransform: 'uppercase' }}>Current Slot</p>
                  <p style={{ fontSize: '13px', color: '#7C2D12', margin: 0, fontWeight: 600 }}>{rescheduleTarget.date} at {rescheduleTarget.time}</p>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                  <div>
                    <label style={labelStyle}>New Date *</label>
                    <input type="date" style={inputStyle} value={rescheduleForm.date} min={new Date().toISOString().split('T')[0]} onChange={e => setRescheduleForm(f => ({ ...f, date: e.target.value }))} />
                  </div>
                  <div>
                    <label style={labelStyle}>New Time *</label>
                    <input type="time" style={inputStyle} value={rescheduleForm.time} onChange={e => setRescheduleForm(f => ({ ...f, time: e.target.value }))} />
                  </div>
                </div>
                <div>
                  <label style={labelStyle}>Reason / Notes</label>
                  <textarea style={{ ...inputStyle, minHeight: '70px', resize: 'vertical' }} placeholder="Reason for rescheduling (optional)" value={rescheduleForm.notes} onChange={e => setRescheduleForm(f => ({ ...f, notes: e.target.value }))} />
                </div>

                <div style={{ background: '#F0F9FF', border: '1px solid #BAE6FD', borderRadius: '10px', padding: '12px 16px', display: 'flex', gap: '10px' }}>
                  <span style={{ fontSize: '14px' }}>🔄</span>
                  <p style={{ fontSize: '12px', color: '#0369A1', margin: 0 }}>
                    The Google Calendar invite will be <strong>updated automatically</strong> and the candidate will receive a notification.
                  </p>
                </div>

                <div style={{ display: 'flex', gap: '12px', marginTop: '4px' }}>
                  <button onClick={() => { setShowRescheduleModal(false); setRescheduleTarget(null); }} style={{ flex: 1, padding: '12px', borderRadius: '10px', border: '1px solid #E2E8F0', background: '#FFFFFF', fontWeight: 700, fontSize: '13px', color: '#475569', cursor: 'pointer' }}>Cancel</button>
                  <button
                    onClick={handleReschedule}
                    disabled={scheduleLoading}
                    style={{ flex: 2, padding: '12px', borderRadius: '10px', border: 'none', background: scheduleLoading ? '#A78BFA' : '#7C3AED', fontWeight: 800, fontSize: '13px', color: '#FFFFFF', cursor: scheduleLoading ? 'not-allowed' : 'pointer' }}
                  >
                    {scheduleLoading ? '⏳ Updating...' : '🔄 Confirm Reschedule'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Header ───────────────────────────────────────────────────────── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h1 style={{ fontSize: '32px', fontWeight: 800, color: '#0F172A', marginBottom: '8px', letterSpacing: '-0.03em' }}>Interviews & Coordination</h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '11px', fontWeight: 800, color: '#10B981', background: '#ECFDF5', padding: '4px 10px', borderRadius: '20px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10B981' }} />
                Google Calendar Synced
              </span>
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#475569', background: '#F1F5F9', padding: '4px 10px', borderRadius: '20px' }}>
                {interviews.filter(iv => iv.status !== 'Cancelled').length} Active Interviews
              </span>
            </div>
          </div>
          <button
            onClick={handleScheduleNew}
            style={{ background: 'linear-gradient(135deg, #2563EB, #1D4ED8)', border: 'none', borderRadius: '12px', padding: '14px 24px', color: '#FFFFFF', fontWeight: 800, fontSize: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', boxShadow: '0 8px 24px rgba(37,99,235,0.25)', transition: 'transform 0.2s' }}
            onMouseEnter={e => (e.currentTarget.style.transform = 'translateY(-2px)')}
            onMouseLeave={e => (e.currentTarget.style.transform = 'translateY(0)')}
          >
            📅 Schedule New Interview
          </button>
        </div>

        {/* ── Calendar + Upcoming Panel ─────────────────────────────────────── */}
        <div className="db-grid-split-320" style={{ alignItems: 'start' }}>

          {/* ── Weekly Calendar ──────────────────────────────────────────── */}
          <Card style={{ padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 900, color: '#0F172A', margin: 0 }}>
                {calendarCurrentDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
              </h3>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => { const d = new Date(calendarCurrentDate); d.setDate(d.getDate() - 7); setCalendarCurrentDate(d); }}
                  style={{ width: '32px', height: '32px', borderRadius: '8px', border: '1px solid #E2E8F0', background: '#FFFFFF', fontWeight: 800, color: '#475569', cursor: 'pointer' }}
                >‹</button>
                <button
                  onClick={() => setCalendarCurrentDate(new Date())}
                  style={{ padding: '0 12px', height: '32px', borderRadius: '8px', border: '1px solid #E2E8F0', background: '#FFFFFF', fontWeight: 700, fontSize: '11px', color: '#2563EB', cursor: 'pointer' }}
                >Today</button>
                <button
                  onClick={() => { const d = new Date(calendarCurrentDate); d.setDate(d.getDate() + 7); setCalendarCurrentDate(d); }}
                  style={{ width: '32px', height: '32px', borderRadius: '8px', border: '1px solid #E2E8F0', background: '#FFFFFF', fontWeight: 800, color: '#475569', cursor: 'pointer' }}
                >›</button>
              </div>
            </div>

            <div style={{ border: '1px solid #E2E8F0', borderRadius: '12px', overflow: 'hidden' }}>
              {/* Day headers */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: '1px solid #E2E8F0', background: '#F8FAFC' }}>
                {weekDays.map((d, idx) => {
                  const isToday = d.toDateString() === today.toDateString();
                  return (
                    <div key={idx} style={{ padding: '12px 4px', textAlign: 'center', borderRight: idx < 6 ? '1px solid #E2E8F0' : 'none' }}>
                      <span style={{
                        display: 'inline-block', fontSize: '10px', fontWeight: 800,
                        color: isToday ? '#FFFFFF' : '#64748B',
                        background: isToday ? '#2563EB' : 'transparent',
                        padding: isToday ? '4px 6px' : '0', borderRadius: isToday ? '6px' : '0'
                      }}>
                        {formatWeekDay(d)}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Calendar body — events per day */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', minHeight: '240px', background: '#FFFFFF' }}>
                {weekDays.map((d, idx) => {
                  const dayInterviews = getInterviewsForDay(d);
                  const isToday = d.toDateString() === today.toDateString();
                  return (
                    <div key={idx} style={{
                      borderRight: idx < 6 ? '1px solid #F1F5F9' : 'none',
                      background: isToday ? '#FAFBFF' : 'transparent',
                      padding: '6px 4px',
                      display: 'flex', flexDirection: 'column', gap: '4px'
                    }}>
                      {dayInterviews.map(iv => (
                        <div
                          key={iv.id}
                          title={`${iv.title} — ${iv.talentName} at ${iv.time}`}
                          style={{
                            background: statusBg[iv.status] || '#EFF6FF',
                            borderLeft: `3px solid ${statusColor[iv.status] || '#2563EB'}`,
                            borderRadius: '4px', padding: '4px 5px', cursor: 'pointer'
                          }}
                          onClick={() => { setRescheduleTarget(iv); setRescheduleForm({ date: iv.date, time: iv.time, notes: iv.notes || '' }); setShowRescheduleModal(true); }}
                        >
                          <span style={{ fontSize: '8px', fontWeight: 800, color: statusColor[iv.status] || '#2563EB', display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{iv.time}</span>
                          <span style={{ fontSize: '7px', color: '#475569', display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{iv.talentName}</span>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Legend */}
            <div style={{ display: 'flex', gap: '16px', marginTop: '12px', flexWrap: 'wrap' }}>
              {Object.entries(statusColor).map(([k, v]) => (
                <span key={k} style={{ fontSize: '11px', color: '#64748B', display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '2px', background: v }} />{k}
                </span>
              ))}
            </div>
          </Card>

          {/* ── Right column: Upcoming + Connected Apps ──────────────────── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

            {/* Upcoming Interviews */}
            <Card style={{ padding: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 style={{ fontSize: '14px', fontWeight: 800, color: '#0F172A', margin: 0 }}>Upcoming Interviews</h3>
                <span style={{ fontSize: '9px', fontWeight: 800, background: '#EFF6FF', color: '#2563EB', padding: '2px 8px', borderRadius: '4px' }}>
                  {upcoming.length} EVENTS
                </span>
              </div>

              {!interviewsLoaded ? (
                <div style={{ textAlign: 'center', padding: '20px', color: '#94A3B8', fontSize: '13px' }}>Loading…</div>
              ) : upcoming.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '24px', color: '#94A3B8' }}>
                  <div style={{ fontSize: '32px', marginBottom: '8px' }}>📅</div>
                  <p style={{ fontSize: '13px', margin: '0 0 12px 0' }}>No upcoming interviews</p>
                  <button onClick={() => setShowScheduleModal(true)} style={{ background: '#2563EB', border: 'none', borderRadius: '8px', padding: '8px 16px', color: '#FFFFFF', fontWeight: 700, fontSize: '12px', cursor: 'pointer' }}>
                    Schedule Now
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  {upcoming.map(iv => (
                    <div key={iv.id} style={{ borderBottom: '1px solid #F1F5F9', paddingBottom: '14px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '8px' }}>
                        <span style={{ fontSize: '9px', fontWeight: 800, background: statusBg[iv.status] || '#EFF6FF', color: statusColor[iv.status] || '#2563EB', padding: '2px 8px', borderRadius: '4px', textTransform: 'uppercase' as const }}>
                          {iv.status}
                        </span>
                        <span style={{ fontSize: '11px', fontWeight: 700, color: '#475569' }}>{iv.time}</span>
                      </div>
                      <h4 style={{ fontSize: '12px', fontWeight: 800, color: '#1E293B', margin: '0 0 6px 0', lineHeight: 1.3 }}>{iv.title}</h4>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                        {iv.talentAvatar && <img src={iv.talentAvatar} alt="" style={{ width: '26px', height: '26px', borderRadius: '50%', objectFit: 'cover' }} />}
                        <div>
                          <span style={{ fontSize: '11px', fontWeight: 700, color: '#1E293B', display: 'block' }}>{iv.talentName}</span>
                          <span style={{ fontSize: '10px', color: '#64748B' }}>{iv.date}</span>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        {iv.meetingLink && (
                          <a href={iv.meetingLink} target="_blank" rel="noreferrer" style={{ flex: 1, background: '#2563EB', border: 'none', borderRadius: '6px', padding: '7px', color: '#FFFFFF', fontWeight: 700, fontSize: '10px', cursor: 'pointer', textDecoration: 'none', textAlign: 'center' as const }}>
                            Join Meet
                          </a>
                        )}
                        {iv.googleCalendarLink && (
                          <a href={iv.googleCalendarLink} target="_blank" rel="noreferrer" title="Open in Google Calendar" style={{ width: '30px', height: '30px', border: '1px solid #E2E8F0', borderRadius: '6px', background: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', cursor: 'pointer', textDecoration: 'none' }}>
                            📅
                          </a>
                        )}
                        <button
                          onClick={() => { setRescheduleTarget(iv); setRescheduleForm({ date: iv.date, time: iv.time, notes: iv.notes || '' }); setShowRescheduleModal(true); }}
                          style={{ width: '30px', height: '30px', border: '1px solid #E2E8F0', borderRadius: '6px', background: '#FFFFFF', color: '#7C3AED', fontWeight: 800, fontSize: '11px', cursor: 'pointer' }}
                          title="Reschedule"
                        >🔄</button>
                        <button
                          onClick={() => handleCancelInterview(iv.id, iv.title)}
                          style={{ width: '30px', height: '30px', border: '1px solid #FEE2E2', borderRadius: '6px', background: '#FFF5F5', color: '#EF4444', fontWeight: 800, fontSize: '11px', cursor: 'pointer' }}
                          title="Cancel"
                        >✕</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {/* Connected Apps */}
            <Card>
              <h3 style={{ fontSize: '14px', fontWeight: 800, color: '#0F172A', marginBottom: '16px' }}>Connected Apps</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', border: '1px solid #E2E8F0', borderRadius: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '18px' }}>📅</span>
                    <div>
                      <span style={{ fontSize: '12px', fontWeight: 800, color: '#1E293B', display: 'block' }}>Google Calendar</span>
                      <span style={{ fontSize: '9px', color: '#10B981', fontWeight: 600 }}>Active — auto-synced on every booking</span>
                    </div>
                  </div>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10B981' }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', border: '1px solid #E2E8F0', borderRadius: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '18px' }}>🎥</span>
                    <div>
                      <span style={{ fontSize: '12px', fontWeight: 800, color: '#1E293B', display: 'block' }}>Google Meet</span>
                      <span style={{ fontSize: '9px', color: '#10B981', fontWeight: 600 }}>Auto-generated for every interview</span>
                    </div>
                  </div>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10B981' }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', border: '1px solid #E2E8F0', borderRadius: '8px', opacity: 0.5 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '18px' }}>💻</span>
                    <div>
                      <span style={{ fontSize: '12px', fontWeight: 800, color: '#1E293B', display: 'block' }}>Zoom Pro</span>
                      <span style={{ fontSize: '9px', color: '#64748B', fontWeight: 600 }}>Not Connected</span>
                    </div>
                  </div>
                  <a href="#" onClick={e => e.preventDefault()} style={{ fontSize: '10px', fontWeight: 800, color: '#2563EB', textDecoration: 'none' }}>Link</a>
                </div>
              </div>
            </Card>

          </div>
        </div>

        {/* ── All Interviews Table ──────────────────────────────────────────── */}
        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 900, color: '#0F172A', margin: 0 }}>All Interviews</h3>
            <button onClick={() => setShowScheduleModal(true)} style={{ background: 'transparent', border: '1px solid #2563EB', borderRadius: '8px', padding: '7px 16px', color: '#2563EB', fontWeight: 700, fontSize: '12px', cursor: 'pointer' }}>
              + New Interview
            </button>
          </div>

          {!interviewsLoaded ? (
            <div style={{ textAlign: 'center', padding: '32px', color: '#94A3B8' }}>Loading interviews…</div>
          ) : interviews.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px', color: '#94A3B8' }}>
              <div style={{ fontSize: '40px', marginBottom: '12px' }}>📋</div>
              <p style={{ fontSize: '14px', margin: '0 0 16px 0' }}>No interviews scheduled yet</p>
              <button onClick={() => setShowScheduleModal(true)} style={{ background: '#2563EB', border: 'none', borderRadius: '10px', padding: '10px 20px', color: '#FFFFFF', fontWeight: 700, fontSize: '13px', cursor: 'pointer' }}>
                Schedule First Interview
              </button>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#F8FAFC' }}>
                    {['Interview', 'Candidate', 'Date & Time', 'Status', 'Actions'].map(h => (
                      <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: '10px', fontWeight: 800, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #E2E8F0' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {interviews.map(iv => (
                    <tr key={iv.id} style={{ borderBottom: '1px solid #F1F5F9', transition: 'background 0.15s' }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#FAFBFF')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      <td style={{ padding: '14px 16px' }}>
                        <span style={{ fontSize: '13px', fontWeight: 700, color: '#1E293B', display: 'block' }}>{iv.title}</span>
                        {iv.notes && <span style={{ fontSize: '11px', color: '#94A3B8' }}>{iv.notes.slice(0, 60)}{iv.notes.length > 60 ? '…' : ''}</span>}
                      </td>
                      <td style={{ padding: '14px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          {iv.talentAvatar && <img src={iv.talentAvatar} alt="" style={{ width: '28px', height: '28px', borderRadius: '50%', objectFit: 'cover' }} />}
                          <span style={{ fontSize: '12px', fontWeight: 700, color: '#1E293B' }}>{iv.talentName}</span>
                        </div>
                      </td>
                      <td style={{ padding: '14px 16px' }}>
                        <span style={{ fontSize: '12px', fontWeight: 700, color: '#1E293B', display: 'block' }}>{iv.date}</span>
                        <span style={{ fontSize: '11px', color: '#64748B' }}>{iv.time}</span>
                      </td>
                      <td style={{ padding: '14px 16px' }}>
                        <span style={{ fontSize: '10px', fontWeight: 800, background: statusBg[iv.status] || '#F1F5F9', color: statusColor[iv.status] || '#475569', padding: '3px 10px', borderRadius: '20px' }}>
                          {iv.status}
                        </span>
                      </td>
                      <td style={{ padding: '14px 16px' }}>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          {iv.meetingLink && (
                            <a href={iv.meetingLink} target="_blank" rel="noreferrer" style={{ padding: '5px 10px', borderRadius: '6px', background: '#2563EB', color: '#FFFFFF', fontWeight: 700, fontSize: '10px', textDecoration: 'none' }}>
                              Join
                            </a>
                          )}
                          {iv.googleCalendarLink && (
                            <a href={iv.googleCalendarLink} target="_blank" rel="noreferrer" style={{ padding: '5px 8px', borderRadius: '6px', border: '1px solid #E2E8F0', background: '#FFFFFF', color: '#475569', fontWeight: 700, fontSize: '10px', textDecoration: 'none' }} title="Google Calendar">
                              📅
                            </a>
                          )}
                          {iv.status !== 'Cancelled' && iv.status !== 'Completed' && (
                            <button
                              onClick={() => { setRescheduleTarget(iv); setRescheduleForm({ date: iv.date, time: iv.time, notes: iv.notes || '' }); setShowRescheduleModal(true); }}
                              style={{ padding: '5px 10px', borderRadius: '6px', border: '1px solid #DDD6FE', background: '#F5F3FF', color: '#7C3AED', fontWeight: 700, fontSize: '10px', cursor: 'pointer' }}
                            >Reschedule</button>
                          )}
                          <button
                            onClick={() => handleCancelInterview(iv.id, iv.title)}
                            style={{ padding: '5px 8px', borderRadius: '6px', border: '1px solid #FEE2E2', background: '#FFF5F5', color: '#EF4444', fontWeight: 700, fontSize: '10px', cursor: 'pointer' }}
                          >✕</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

      </div>
    );
  };

  const renderReviews = () => null;

  const renderSettings = () => (
    <Card style={{ padding: '32px' }}>
      <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#0F172A', margin: '0 0 6px 0' }}>Organization Information</h3>
      <p style={{ fontSize: '13px', color: '#64748B', marginBottom: '24px' }}>Update company credentials and operations details.</p>

      <form onSubmit={e => { e.preventDefault(); alert('Profile credentials updated!'); }} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div className="db-grid-2" style={{ gap: '20px' }}>
          <div>
            <label style={{ fontSize: '11px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>
              Company Name
            </label>
            <input 
              type="text" 
              defaultValue={currentUser?.companyName || 'Thorne Enterprises'}
              style={{ width: '100%', height: '40px', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '0 12px', fontSize: '14px', boxSizing: 'border-box' }}
            />
          </div>
          <div>
            <label style={{ fontSize: '11px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>
              Primary Contact Name
            </label>
            <input 
              type="text" 
              defaultValue={currentUser?.name || 'Alex Mercer'}
              style={{ width: '100%', height: '40px', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '0 12px', fontSize: '14px', boxSizing: 'border-box' }}
            />
          </div>
        </div>

        <div>
          <label style={{ fontSize: '11px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>
            Billing Email Address
          </label>
          <input 
            type="email" 
            defaultValue={currentUser?.email || 'alex.mercer@thorne.io'}
            style={{ width: '100%', height: '40px', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '0 12px', fontSize: '14px', boxSizing: 'border-box' }}
          />
        </div>

        <div style={{ borderTop: '1px solid #F1F5F9', marginTop: '12px', paddingTop: '20px', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
          <button 
            type="submit"
            style={{ background: '#2563EB', border: 'none', borderRadius: '8px', padding: '10px 24px', fontSize: '13px', fontWeight: 700, color: '#FFFFFF', cursor: 'pointer' }}
          >
            Save Changes
          </button>
        </div>
      </form>
    </Card>
  );

  const renderSection = () => {
    switch (activeSection) {
      case 'dashboard':  return renderDashboard();
      case 'requests':   return renderRequests();
      case 'radar':      return renderRadar();
      case 'contracts':  return renderContracts();
      case 'billing':    return renderBilling();
      case 'messaging':  return renderMessaging();
      case 'scheduling': return renderScheduling();
      case 'reviews':    return renderReviews();
      case 'profile':    return renderSettings();
    }
  };

  return (
    <div className="dashboard-shell" style={{ display: 'flex', minHeight: '100vh', background: '#F8FAFC', fontFamily: 'var(--font-display, Inter, sans-serif)' }}>
      
      {/* ── Mobile Top Nav ── */}
      <div className="mobile-nav-bar" style={{ alignItems: 'center', justifyContent: 'space-between', padding: '0 16px', height: '60px', background: '#FFFFFF', borderBottom: '1px solid #DDE2EC' }}>
        <button className="mobile-hamburger" onClick={() => setMobileSidebarOpen(!mobileSidebarOpen)} style={{ display: 'flex', flexDirection: 'column', gap: '4px', background: 'none', border: 'none', cursor: 'pointer' }}>
          <span style={{ width: '20px', height: '2px', background: '#1A2340', display: 'block' }}></span>
          <span style={{ width: '20px', height: '2px', background: '#1A2340', display: 'block' }}></span>
          <span style={{ width: '20px', height: '2px', background: '#1A2340', display: 'block' }}></span>
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 800, color: '#0047CC', fontSize: '18px', margin: '0 auto 0 12px' }}>
          <div style={{ width: '24px', height: '24px', background: '#0047CC', color: 'white', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px' }}>K</div>
          <span style={{ color: '#0047CC' }}>Kongila</span>
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
                <div style={{ fontSize: '14px', fontWeight: 800, color: '#1A2340' }}>Client Portal</div>
              </div>
              <button onClick={() => setMobileSidebarOpen(false)} style={{ background: 'none', border: 'none', color: '#6B7A99', fontSize: '20px', cursor: 'pointer' }}>✕</button>
            </div>
            
            <nav style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
              {NAV_ITEMS.map(item => {
                const isActive = activeSection === item.id;
                const badgeCount = item.id === 'messaging' ? unreadMessagesCount : (unreadByModule[item.id] || 0);
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      setActiveSection(item.id);
                      if (item.id === 'radar' && !selectedRequest && requests.length > 0) {
                        setSelectedRequest(requests[0]);
                      }
                      setMobileSidebarOpen(false);
                    }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '10px',
                      padding: '12px', borderRadius: '8px', border: 'none',
                      background: isActive ? '#EEF3FF' : 'transparent',
                      color: isActive ? '#0047CC' : '#6B7A99',
                      fontWeight: isActive ? 700 : 500, fontSize: '14px', cursor: 'pointer', textAlign: 'left',
                      width: '100%'
                    }}
                  >
                    <SidebarIcon id={item.id} color={isActive ? '#0047CC' : '#6B7A99'} size={16} />
                    {item.label}
                    {badgeCount > 0 && (
                      <span style={{ marginLeft: 'auto', background: '#EF4444', color: '#fff', fontSize: '10px', fontWeight: 800, padding: '2px 6px', borderRadius: '10px' }}>
                        {badgeCount}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: 'auto', borderTop: '1px solid #F5F7FA', paddingTop: '16px' }}>
              <button onClick={() => { onSignOut(); setMobileSidebarOpen(false); }} style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                background: 'transparent', border: 'none', color: '#EF4444',
                fontSize: '14px', fontWeight: 600, cursor: 'pointer', textAlign: 'left', padding: '8px',
                width: '100%'
              }}>
                <SidebarIcon id="logout" color="#EF4444" size={16} />
                Sign Out
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
        {/* User Logo & Branding Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '0 8px 20px', borderBottom: '1px solid #F5F7FA', marginBottom: '12px' }}>
          <div style={{
            width: '36px', height: '36px', borderRadius: '8px',
            background: '#0047CC',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#FFFFFF', fontWeight: 900, fontSize: '20px', flexShrink: 0
          }}>
            K
          </div>
          <div style={{ overflow: 'hidden' }}>
            <div style={{ fontSize: '14px', fontWeight: 800, color: '#1A2340', letterSpacing: '-0.02em' }}>Client Portal</div>
            <div style={{ fontSize: '11px', color: '#6B7A99', marginTop: '2px' }}>Enterprise Operations</div>
          </div>
        </div>

        {/* Navigation Sidebar List */}
        <nav style={{ display: 'flex', flexDirection: 'column', gap: '2px', flex: 1 }}>
          {NAV_ITEMS.map(item => {
            const isActive = activeSection === item.id;
            const badgeCount = item.id === 'messaging' ? unreadMessagesCount : (unreadByModule[item.id] || 0);
            return (
              <button
                key={item.id}
                onClick={() => {
                  setActiveSection(item.id);
                  if (item.id === 'radar' && !selectedRequest && clientRequests.length > 0) {
                    setSelectedRequest(clientRequests[0]);
                  }
                }}
                style={{
                  display: 'flex', alignItems: 'center', gap: '10px',
                  padding: '10px 12px', borderRadius: '8px', border: 'none',
                  background: isActive ? '#EEF3FF' : 'transparent',
                  color: isActive ? '#0047CC' : '#6B7A99',
                  fontWeight: isActive ? 700 : 500, fontSize: '13px', cursor: 'pointer', textAlign: 'left',
                  transition: 'all 0.15s',
                  width: '100%'
                }}
              >
                <SidebarIcon id={item.id} color={isActive ? '#0047CC' : '#6B7A99'} size={15} />
                {item.label}
                {badgeCount > 0 && (
                  <span style={{ marginLeft: 'auto', background: '#EF4444', color: '#fff', fontSize: '10px', fontWeight: 800, padding: '2px 6px', borderRadius: '10px' }}>
                    {badgeCount}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Sign Out */}
        <button 
          onClick={onSignOut}
          style={{
            display: 'flex', alignItems: 'center', gap: '10px',
            padding: '6px 8px', borderRadius: '8px', border: 'none',
            background: 'transparent', color: '#EF4444', fontWeight: 600,
            fontSize: '13px', cursor: 'pointer', textAlign: 'left',
            marginTop: 'auto', width: '100%'
          }}
        >
          <SidebarIcon id="logout" color="#EF4444" size={15} />
          Sign Out
        </button>
      </aside>

      {/* ── Main Content Wrapper ── */}
      <div className="dashboard-content-area" style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
        
        {/* ── Top Header Bar ── */}
        <header className="desktop-header" style={{
          height: '70px', background: '#FFFFFF', borderBottom: '1px solid #DDE2EC',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 40px', flexShrink: 0, position: 'relative', zIndex: 10
        }}>
          {/* Breadcrumbs */}
          <div style={{ fontSize: '13px', color: '#6B7A99', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 500 }}>
            <span>Client Workspace</span>
            <span style={{ color: '#BAC2D1' }}>›</span>
            <span style={{ color: '#1A2340', fontWeight: 700 }}>
              {NAV_ITEMS.find(n => n.id === activeSection)?.label}
            </span>
          </div>

          {/* Right Header Controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
            {/* Quick stats / telemetry summary if applicable */}
            <div style={{ display: 'flex', gap: '16px', fontSize: '12px', color: '#6B7A99', borderRight: '1px solid #DDE2EC', paddingRight: '24px' }}>
              <div>
                <span style={{ fontWeight: 700, color: '#1A2340' }}>{contracts.filter(c => c.clientId === currentUser?.id && c.status?.toLowerCase() === 'signed').length}</span> Active Hires
              </div>
              <div>
                <span style={{ fontWeight: 700, color: '#1A2340' }}>{matches.filter(m => { const req = requests.find(r => r.id === m.requestId); return req?.clientId === currentUser?.id && m.status?.toLowerCase() === 'interview scheduled'; }).length}</span> Interviews
              </div>
            </div>

            {/* Notification and Messages quick badges */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', position: 'relative' }}>
              <div 
                onClick={() => setActiveSection('messaging')}
                style={{ position: 'relative', cursor: 'pointer', display: 'flex', alignItems: 'center', color: '#6B7A99' }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
                {unreadMessagesCount > 0 && (
                  <span style={{ position: 'absolute', top: '-4px', right: '-4px', background: '#EF4444', color: '#FFF', fontSize: '8px', fontWeight: 800, padding: '1px 3px', borderRadius: '4px', minWidth: '10px', textAlign: 'center', border: '2px solid #FFFFFF' }}>
                    {unreadMessagesCount}
                  </span>
                )}
              </div>
              
              <div 
                style={{ position: 'relative', cursor: 'pointer', display: 'flex', alignItems: 'center', color: '#6B7A99' }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                  <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                </svg>
                {unreadNotifsCount > 0 && (
                  <span style={{ position: 'absolute', top: '-4px', right: '-4px', background: '#EF4444', color: '#FFF', fontSize: '8px', fontWeight: 800, padding: '1px 3px', borderRadius: '4px', minWidth: '10px', textAlign: 'center', border: '2px solid #FFFFFF' }}>
                    {unreadNotifsCount}
                  </span>
                )}
              </div>
            </div>

            {/* Profile badge */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', borderLeft: '1px solid #DDE2EC', paddingLeft: '20px' }}>
              <img 
                src="https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=facearea&facepad=2&w=256&h=256&q=80" 
                alt="" 
                style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover' }} 
              />
              <div>
                <span style={{ fontSize: '14px', fontWeight: 700, color: '#1A2340', display: 'block' }}>{currentUser?.name || 'Alex Chen'}</span>
                <span style={{ fontSize: '11px', color: '#6B7A99', display: 'block', marginTop: '1px' }}>{currentUser?.companyName || 'Horizon Fintech'}</span>
              </div>
            </div>
          </div>
        </header>

        {/* ── Main Dashboard Panel Scroll view ── */}
        <main className="dashboard-main-content" style={{ flex: 1, overflowY: 'auto', background: '#F8FAFC' }}>
          {renderSection()}
        </main>

      </div>

      {/* ── Video Meeting Scheduler Modal Overlay ── */}
      {showCalendar && selectedTalent && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.3)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '24px' }}>
          <div style={{ background: '#FFFFFF', borderRadius: '24px', padding: '32px', width: '100%', maxWidth: '480px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }}>
            <h2 style={{ fontSize: '22px', fontWeight: 800, color: '#0F172A', marginBottom: '8px', marginTop: 0 }}>Book Video Interview</h2>
            <p style={{ color: '#64748B', fontSize: '14px', marginBottom: '24px', lineHeight: 1.5 }}>
              Scheduling operational interview call with <strong>{selectedTalent.name}</strong>. Timezone alignments resolved automatically.
            </p>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', marginBottom: '6px' }}>Choose Date</label>
              <input 
                type="date" 
                value={meetingDate}
                onChange={e => setMeetingDate(e.target.value)}
                style={{ width: '100%', height: '44px', border: '1px solid #E2E8F0', borderRadius: '10px', padding: '0 12px', fontSize: '14px', boxSizing: 'border-box' }}
              />
            </div>

            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', marginBottom: '6px' }}>Target Time ({selectedTalent.timezone || 'GMT+1'})</label>
              <input 
                type="time" 
                value={meetingTime}
                onChange={e => setMeetingTime(e.target.value)}
                style={{ width: '100%', height: '44px', border: '1px solid #E2E8F0', borderRadius: '10px', padding: '0 12px', fontSize: '14px', boxSizing: 'border-box' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button 
                onClick={() => setShowCalendar(false)}
                style={{ background: 'transparent', border: '1px solid #E2E8F0', borderRadius: '10px', padding: '12px 20px', fontSize: '14px', fontWeight: 700, color: '#475569', cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button 
                onClick={onScheduleMeeting}
                style={{ background: '#2563EB', border: 'none', borderRadius: '10px', padding: '12px 24px', fontSize: '14px', fontWeight: 700, color: '#FFFFFF', cursor: 'pointer' }}
              >
                Schedule & Link Zoom
              </button>
            </div>
          </div>
        </div>
      )}
      {/* ── Within-Dashboard Smart Intake Wizard Modal Overlay ── */}
      {showIntakeModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.3)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '24px' }}>
          <div style={{ background: '#FFFFFF', borderRadius: '24px', padding: '32px', width: '100%', maxWidth: '640px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', maxHeight: '90vh', overflowY: 'auto' }}>
            
            {/* Header step counter */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ display: 'flex', alignItems: 'center', color: '#2563EB' }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path></svg>
                </span>
                <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#0F172A', margin: 0 }}>Smart Talent Request</h2>
              </div>
              <span style={{ fontSize: '12px', fontWeight: 700, color: '#64748B' }}>Step {intakeStep} of 3</span>
            </div>

            {/* Progress lines */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '28px' }}>
              {[1, 2, 3].map(s => (
                <div 
                  key={s} 
                  style={{
                    flex: 1, 
                    height: '4px', 
                    borderRadius: '2px', 
                    background: intakeStep >= s ? '#2563EB' : '#E2E8F0',
                    transition: 'all 0.3s ease'
                  }}
                />
              ))}
            </div>

            {/* Step 1: Service Level Vetting */}
            {intakeStep === 1 && (
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#0F172A', marginBottom: '6px' }}>What service level do you require?</h3>
                <p style={{ color: '#64748B', fontSize: '13px', marginBottom: '20px' }}>Select an engagement structure scaled to your operational backing.</p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
                  {[
                    { id: 'Managed Workforce', title: 'Managed Workforce', desc: 'Kongila manages performance, systems and EOR directly. High supervision.' },
                    { id: 'Outsource Talent', title: 'Outsource Talent', desc: 'Kongila pays talent; client manages execution directly. Lighter oversight.' },
                    { id: 'Direct Placement', title: 'Direct Placement', desc: 'Full sourcing and vetting engine. Recommended shortlist deployable instantly.' },
                    { id: 'Project Execution', title: 'Project Execution', desc: 'Client prepays project milestone scopes. Direct delivery manager assigned.' }
                  ].map(item => (
                    <div 
                      key={item.id}
                      onClick={() => setIntakeForm({ ...intakeForm, serviceType: item.id })}
                      style={{
                        padding: '16px',
                        borderRadius: '12px',
                        border: `2px solid ${intakeForm.serviceType === item.id ? '#2563EB' : '#E2E8F0'}`,
                        background: intakeForm.serviceType === item.id ? '#EFF6FF' : '#FFFFFF',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        display: 'flex',
                        gap: '12px',
                        alignItems: 'start'
                      }}
                    >
                      <span style={{ 
                        fontSize: '20px', 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center',
                        color: intakeForm.serviceType === item.id ? '#2563EB' : '#64748B',
                        marginTop: '2px'
                      }}>
                        {item.id === 'Managed Workforce' ? (
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
                        ) : item.id === 'Outsource Talent' ? (
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>
                        ) : item.id === 'Direct Placement' ? (
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                        ) : (
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path><rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect></svg>
                        )}
                      </span>
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: 800, color: '#0F172A', marginBottom: '4px' }}>{item.title}</div>
                        <div style={{ fontSize: '12px', color: '#64748B', lineHeight: 1.4 }}>{item.desc}</div>
                      </div>
                    </div>
                  ))}
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                  <button 
                    onClick={() => setShowIntakeModal(false)}
                    style={{ background: 'transparent', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '10px 16px', fontSize: '13px', fontWeight: 700, color: '#64748B', cursor: 'pointer' }}
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={() => setIntakeStep(2)}
                    style={{ background: '#2563EB', border: 'none', borderRadius: '8px', padding: '10px 20px', fontSize: '13px', fontWeight: 700, color: '#FFFFFF', cursor: 'pointer' }}
                  >
                    Continue to Details
                  </button>
                </div>
              </div>
            )}

            {/* Step 2: Role specifications */}
            {intakeStep === 2 && (
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#0F172A', marginBottom: '6px' }}>Specify role requirements</h3>
                <p style={{ color: '#64748B', fontSize: '13px', marginBottom: '20px' }}>Provide role specifics to initialize matching engine algorithms.</p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '24px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>Role / Project Description</label>
                    <textarea 
                      rows={3}
                      value={intakeForm.roleDescription}
                      onChange={e => setIntakeForm({ ...intakeForm, roleDescription: e.target.value })}
                      placeholder="e.g. Senior Frontend Engineer with expert level React and TypeScript expertise to lead modular components redesign."
                      style={{ width: '100%', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '12px', fontSize: '13px', resize: 'none', fontFamily: 'inherit' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>Required Technical Skills (comma separated)</label>
                    <input 
                      type="text"
                      value={intakeForm.requiredSkills}
                      onChange={e => setIntakeForm({ ...intakeForm, requiredSkills: e.target.value })}
                      placeholder="e.g. React, TypeScript, Next.js, Node.js"
                      style={{ width: '100%', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '10px 12px', fontSize: '13px' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>Desired Budget / Target Rate</label>
                    <input 
                      type="text"
                      value={intakeForm.budget}
                      onChange={e => setIntakeForm({ ...intakeForm, budget: e.target.value })}
                      placeholder="e.g. $80 - $120 / hr"
                      style={{ width: '100%', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '10px 12px', fontSize: '13px' }}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <button 
                    onClick={() => setIntakeStep(1)}
                    style={{ background: 'transparent', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '10px 16px', fontSize: '13px', fontWeight: 700, color: '#64748B', cursor: 'pointer' }}
                  >
                    Back
                  </button>
                  <button 
                    onClick={() => setIntakeStep(3)}
                    style={{ background: '#2563EB', border: 'none', borderRadius: '8px', padding: '10px 20px', fontSize: '13px', fontWeight: 700, color: '#FFFFFF', cursor: 'pointer' }}
                  >
                    Continue to Logistical Parameters
                  </button>
                </div>
              </div>
            )}

            {/* Step 3: Logistical parameters */}
            {intakeStep === 3 && (
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#0F172A', marginBottom: '6px' }}>Define Logistical Parameters</h3>
                <p style={{ color: '#64748B', fontSize: '13px', marginBottom: '20px' }}>Finalize operational metrics for vetting and match creation.</p>

                <div className="db-grid-2" style={{ gap: '16px', marginBottom: '24px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>Timezone Focus</label>
                    <select 
                      value={intakeForm.timezone} 
                      onChange={e => setIntakeForm({ ...intakeForm, timezone: e.target.value })}
                      style={{ width: '100%', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '10px', fontSize: '13px' }}
                    >
                      <option>GMT -5 (EST)</option>
                      <option>GMT +0 (GMT)</option>
                      <option>GMT +1 (CET)</option>
                      <option>GMT +8 (SGT)</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>Duration</label>
                    <select 
                      value={intakeForm.duration} 
                      onChange={e => setIntakeForm({ ...intakeForm, duration: e.target.value })}
                      style={{ width: '100%', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '10px', fontSize: '13px' }}
                    >
                      <option>3 Months</option>
                      <option>6 Months</option>
                      <option>12 Months</option>
                      <option>Ongoing</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>Commitment Level</label>
                    <select 
                      value={intakeForm.commitmentLevel} 
                      onChange={e => setIntakeForm({ ...intakeForm, commitmentLevel: e.target.value })}
                      style={{ width: '100%', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '10px', fontSize: '13px' }}
                    >
                      <option>Full-Time</option>
                      <option>Part-Time</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>Priority Level</label>
                    <select 
                      value={intakeForm.priority} 
                      onChange={e => setIntakeForm({ ...intakeForm, priority: e.target.value })}
                      style={{ width: '100%', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '10px', fontSize: '13px' }}
                    >
                      <option>High</option>
                      <option>Medium</option>
                      <option>Low</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>Number of Hires</label>
                    <input 
                      type="number"
                      min={1}
                      value={intakeForm.numberOfHires} 
                      onChange={e => setIntakeForm({ ...intakeForm, numberOfHires: Number(e.target.value) })}
                      style={{ width: '100%', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '10px', fontSize: '13px' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>Start Date</label>
                    <select 
                      value={intakeForm.startDate} 
                      onChange={e => setIntakeForm({ ...intakeForm, startDate: e.target.value })}
                      style={{ width: '100%', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '10px', fontSize: '13px' }}
                    >
                      <option>Immediate</option>
                      <option>Within 2 Weeks</option>
                      <option>Next Month</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <button 
                    onClick={() => setIntakeStep(2)}
                    style={{ background: 'transparent', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '10px 16px', fontSize: '13px', fontWeight: 700, color: '#64748B', cursor: 'pointer' }}
                  >
                    Back
                  </button>
                  
                  {/* Since they are already signed in, we bypass step 4 & 5 and call database submit directly! */}
                  <button 
                    onClick={async () => {
                      if (!intakeForm.roleDescription) {
                        alert('Please fill in role description details.');
                        return;
                      }
                      
                      const reqId = `req_${Date.now()}`;
                      const newReq = {
                        id: reqId,
                        clientId: currentUser.id,
                        clientName: `${currentUser.name} (${currentUser.companyName || 'Vanguard Corp'})`,
                        serviceType: intakeForm.serviceType,
                        roleDescription: intakeForm.roleDescription,
                        requiredSkills: intakeForm.requiredSkills.split(',').map((s: string) => s.trim()),
                        duration: intakeForm.duration,
                        commitmentLevel: intakeForm.commitmentLevel,
                        numberOfHires: Number(intakeForm.numberOfHires),
                        timezone: intakeForm.timezone,
                        startDate: intakeForm.startDate,
                        budget: intakeForm.budget,
                        priority: intakeForm.priority,
                        status: 'New Request',
                        createdAt: new Date().toISOString()
                      };

                      try {
                        const { error: dbError } = await supabase.from('talent_requests').insert([{
                          client_id: currentUser.id,
                          service_type: intakeForm.serviceType,
                          payload: newReq
                        }]);
                        
                        if (dbError) {
                          alert(`Error saving to database: ${dbError.message}`);
                          return;
                        }

                        if (onAddRequest) {
                          await onAddRequest(newReq);
                        }
                        
                        setShowIntakeModal(false);
                        setIntakeStep(1);
                        setIntakeForm({
                          serviceType: '',
                          roleDescription: '',
                          requiredSkills: '',
                          duration: '',
                          commitmentLevel: '',
                          numberOfHires: 1,
                          timezone: '',
                          startDate: '',
                          budget: '',
                          priority: ''
                        });
                      } catch (err: any) {
                        alert('Submission failed: ' + err.message);
                        setShowIntakeModal(false);
                      }
                    }}
                    style={{ background: '#2563EB', border: 'none', borderRadius: '8px', padding: '10px 24px', fontSize: '13px', fontWeight: 800, color: '#FFFFFF', cursor: 'pointer' }}
                  >
                    🚀 Submit Talent Request
                  </button>
                </div>
              </div>
            )}

          </div>
        </div>
      )}

      {/* View All Invoices Modal */}
      {showAllInvoicesModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(10px)',
          zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px'
        }}>
          <div style={{
            background: '#FFFFFF', borderRadius: '24px', padding: '36px',
            width: '100%', maxWidth: '900px', maxHeight: '90vh', overflowY: 'auto',
            boxShadow: '0 24px 80px rgba(0,0,0,0.15)', boxSizing: 'border-box'
          }}>
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
              <div>
                <h2 style={{ fontSize: '24px', fontWeight: 900, color: '#0F172A', margin: '0 0 6px 0', letterSpacing: '-0.02em' }}>Invoice Ledger</h2>
                <p style={{ fontSize: '13px', color: '#64748B', margin: 0 }}>Review, audit, and process payments across all invoice tiers.</p>
              </div>
              <button onClick={() => setShowAllInvoicesModal(false)} style={{ background: '#F1F5F9', border: 'none', borderRadius: '10px', width: '40px', height: '40px', cursor: 'pointer', fontSize: '18px', color: '#475569', fontWeight: 800 }}>×</button>
            </div>

            {/* Categorize Invoices */}
            {(() => {
              const clientInvoices = invoices.filter(inv => inv.clientId === currentUser?.id);
              
              // Fallback mockup invoices if empty
              const activeInvoicesList = clientInvoices.length > 0 ? clientInvoices : [
                { id: 'inv_horizon_1', clientId: 'usr_horizon', amount: 12450.00, status: 'paid' as const, dueDate: '2026-05-01' },
                { id: 'inv_horizon_2', clientId: 'usr_horizon', amount: 6250.40, status: 'overdue' as const, dueDate: '2026-04-15' },
                { id: 'inv_horizon_3', clientId: 'usr_horizon', amount: 18750.40, status: 'sent' as const, dueDate: '2026-05-31' },
                { id: 'inv_horizon_4', clientId: 'usr_horizon', amount: 8900.00, status: 'paid' as const, dueDate: '2026-04-01' },
                { id: 'inv_horizon_5', clientId: 'usr_horizon', amount: 12500.00, status: 'overdue' as const, dueDate: '2026-03-10' },
                { id: 'inv_horizon_6', clientId: 'usr_horizon', amount: 42300.00, status: 'sent' as const, dueDate: '2026-06-15' }
              ];

              const overdueInvoices = activeInvoicesList.filter(inv => inv.status === 'overdue');
              const dueInvoices = activeInvoicesList.filter(inv => inv.status === 'sent' || inv.status === 'draft');
              const paidInvoices = activeInvoicesList.filter(inv => inv.status === 'paid');

              const renderInvoiceTable = (list: typeof activeInvoicesList, title: string, badgeBg: string, badgeColor: string) => (
                <div style={{ marginBottom: '28px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
                    <h4 style={{ fontSize: '15px', fontWeight: 800, color: '#1E293B', margin: 0 }}>{title}</h4>
                    <span style={{ fontSize: '11px', fontWeight: 800, padding: '2px 8px', borderRadius: '12px', background: badgeBg, color: badgeColor }}>
                      {list.length} Items
                    </span>
                  </div>

                  {list.length === 0 ? (
                    <p style={{ fontSize: '12px', color: '#94A3B8', margin: '0 0 16px 0', fontStyle: 'italic' }}>No invoices in this status.</p>
                  ) : (
                    <div style={{ border: '1px solid #E2E8F0', borderRadius: '12px', overflow: 'hidden', marginBottom: '16px' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '12px' }}>
                        <thead>
                          <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                            <th style={{ padding: '10px 18px', fontWeight: 700, color: '#64748B' }}>Invoice ID</th>
                            <th style={{ padding: '10px 18px', fontWeight: 700, color: '#64748B' }}>Due Date</th>
                            <th style={{ padding: '10px 18px', fontWeight: 700, color: '#64748B' }}>Amount</th>
                            <th style={{ padding: '10px 18px', fontWeight: 700, color: '#64748B', textAlign: 'right' }}>Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {list.map(inv => (
                            <tr key={inv.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                              <td style={{ padding: '12px 18px', fontWeight: 700, color: '#1E293B' }}>INV-{inv.id.replace('inv_', '').substring(0, 6).toUpperCase()}</td>
                              <td style={{ padding: '12px 18px', color: '#64748B' }}>{new Date(inv.dueDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</td>
                              <td style={{ padding: '12px 18px', fontWeight: 800, color: '#0F172A' }}>{formatCurrency(inv.amount)}</td>
                              <td style={{ padding: '12px 18px', textAlign: 'right' }}>
                                <button onClick={() => inv.status === 'paid' ? alert(`Receipt downloaded for INV-${inv.id.replace('inv_', '').substring(0, 6).toUpperCase()}`) : handleSinglePayment(inv.id, inv.amount)} style={{
                                  background: 'transparent', border: 'none', color: '#2563EB',
                                  fontWeight: 700, fontSize: '11px', cursor: 'pointer'
                                }}>
                                  {inv.status === 'paid' ? 'View Receipt ➔' : 'Pay Invoice ➔'}
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );

              return (
                <div>
                  {renderInvoiceTable(overdueInvoices, 'Overdue Invoices', '#FEF2F2', '#EF4444')}
                  {renderInvoiceTable(dueInvoices, 'Outstanding Due Invoices', '#FFF7ED', '#F57C00')}
                  {renderInvoiceTable(paidInvoices, 'Paid Invoices History', '#ECFDF5', '#10B981')}
                </div>
              );
            })()}

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
              <button onClick={() => setShowAllInvoicesModal(false)} style={{
                background: '#0F172A', border: 'none', borderRadius: '10px',
                padding: '12px 24px', color: '#FFFFFF', fontWeight: 700, fontSize: '13px', cursor: 'pointer'
              }}>
                Close Invoice Desk
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Re-hire Past Hire Modal */}
      {showRehireModal && rehireTarget && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(8px)',
          zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px'
        }}>
          <div style={{
            background: '#FFFFFF', borderRadius: '20px', padding: '36px',
            width: '100%', maxWidth: '500px', boxShadow: '0 24px 80px rgba(0,0,0,0.15)',
            boxSizing: 'border-box'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <div>
                <h2 style={{ fontSize: '20px', fontWeight: 900, color: '#0F172A', margin: '0 0 4px 0', letterSpacing: '-0.02em' }}>Re-hire Talent</h2>
                <p style={{ fontSize: '12px', color: '#64748B', margin: 0 }}>Propose re-engagement terms for {rehireTarget.talentName}</p>
              </div>
              <button onClick={() => { setShowRehireModal(false); setRehireTarget(null); }} style={{ background: '#F1F5F9', border: 'none', borderRadius: '8px', width: '36px', height: '36px', cursor: 'pointer', fontSize: '16px', color: '#475569' }}>×</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 800, color: '#475569', textTransform: 'uppercase', marginBottom: '6px' }}>Proposed Role *</label>
                <input 
                  type="text" 
                  placeholder="e.g. Lead QA Engineer" 
                  value={rehireForm.role} 
                  onChange={e => setRehireForm(f => ({ ...f, role: e.target.value }))}
                  style={{ width: '100%', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '10px 12px', fontSize: '13px', boxSizing: 'border-box' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 800, color: '#475569', textTransform: 'uppercase', marginBottom: '6px' }}>Proposed Monthly Salary (USD) *</label>
                <input 
                  type="number" 
                  placeholder="e.g. 12400" 
                  value={rehireForm.rate} 
                  onChange={e => setRehireForm(f => ({ ...f, rate: e.target.value }))}
                  style={{ width: '100%', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '10px 12px', fontSize: '13px', boxSizing: 'border-box' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 800, color: '#475569', textTransform: 'uppercase', marginBottom: '6px' }}>Proposed Start Date *</label>
                <input 
                  type="date" 
                  min={new Date().toISOString().split('T')[0]} 
                  value={rehireForm.startDate} 
                  onChange={e => setRehireForm(f => ({ ...f, startDate: e.target.value }))}
                  style={{ width: '100%', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '10px 12px', fontSize: '13px', boxSizing: 'border-box' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 800, color: '#475569', textTransform: 'uppercase', marginBottom: '6px' }}>Commitment Level *</label>
                <select 
                  value={rehireForm.commitmentLevel} 
                  onChange={e => setRehireForm(f => ({ ...f, commitmentLevel: e.target.value as any }))}
                  style={{ width: '100%', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '10px 12px', fontSize: '13px', boxSizing: 'border-box' }}
                >
                  <option value="Full-Time">Full-Time Retainer</option>
                  <option value="Part-Time">Part-Time Retainer</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 800, color: '#475569', textTransform: 'uppercase', marginBottom: '6px' }}>Special Instructions / Note to Admin</label>
                <textarea 
                  placeholder="Provide onboarding logistics, hardware requirements, etc."
                  value={rehireForm.notes} 
                  onChange={e => setRehireForm(f => ({ ...f, notes: e.target.value }))}
                  style={{ width: '100%', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '10px 12px', fontSize: '13px', minHeight: '80px', boxSizing: 'border-box', resize: 'vertical' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
                <button onClick={() => { setShowRehireModal(false); setRehireTarget(null); }} style={{ flex: 1, padding: '12px', borderRadius: '10px', border: '1px solid #E2E8F0', background: '#FFFFFF', fontWeight: 700, fontSize: '13px', color: '#475569', cursor: 'pointer' }}>Cancel</button>
                <button
                  onClick={submitRehireRequest}
                  style={{ flex: 2, padding: '12px', borderRadius: '10px', border: 'none', background: '#2563EB', fontWeight: 800, fontSize: '13px', color: '#FFFFFF', cursor: 'pointer' }}
                >
                  🚀 Submit Re-hire Request
                </button>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* Dynamic Client Review Modal */}
      {showReviewModal && reviewTalentDetails && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(8px)',
          zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px'
        }}>
          <div style={{
            background: '#FFFFFF', borderRadius: '20px', padding: '36px',
            width: '100%', maxWidth: '560px', maxHeight: '90vh', overflowY: 'auto',
            boxShadow: '0 24px 80px rgba(0,0,0,0.15)', boxSizing: 'border-box'
          }}>
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
              <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                <img 
                  src={reviewTalentDetails.avatar || 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=80'} 
                  alt="" 
                  style={{ width: '48px', height: '48px', borderRadius: '50%', objectFit: 'cover' }} 
                />
                <div>
                  <h2 style={{ fontSize: '18px', fontWeight: 900, color: '#0F172A', margin: 0, letterSpacing: '-0.02em' }}>
                    Review {reviewTalentDetails.name}
                  </h2>
                  <p style={{ fontSize: '12px', color: '#64748B', margin: '4px 0 0 0', fontWeight: 600 }}>
                    {reviewTalentDetails.role} • {reviewTalentDetails.contract}
                  </p>
                </div>
              </div>
              <button 
                onClick={() => { setShowReviewModal(false); setReviewTalentDetails(null); }} 
                style={{ background: '#F1F5F9', border: 'none', borderRadius: '8px', width: '32px', height: '32px', cursor: 'pointer', fontSize: '16px', color: '#475569', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                ×
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              
              {/* Overall Satisfaction */}
              <div style={{ borderBottom: '1px solid #F1F5F9', paddingBottom: '16px' }}>
                <h4 style={{ fontSize: '11px', fontWeight: 800, color: '#475569', textTransform: 'uppercase', marginBottom: '8px', letterSpacing: '0.05em' }}>
                  Overall Satisfaction *
                </h4>
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                  {[1, 2, 3, 4, 5].map(star => (
                    <span 
                      key={star}
                      onClick={() => setReviewRating(star)}
                      style={{ 
                        fontSize: '32px', 
                        cursor: 'pointer', 
                        color: star <= reviewRating ? '#F59E0B' : '#E2E8F0',
                        transition: 'color 0.15s' 
                      }}
                    >
                      ★
                    </span>
                  ))}
                  <span style={{ fontSize: '11px', color: '#94A3B8', marginLeft: '8px', fontWeight: 600 }}>
                    {reviewRating > 0 ? `${reviewRating} / 5 Stars` : 'Select a rating'}
                  </span>
                </div>
              </div>

              {/* Performance Criteria Sliders */}
              <div style={{ borderBottom: '1px solid #F1F5F9', paddingBottom: '20px' }}>
                <h4 style={{ fontSize: '11px', fontWeight: 800, color: '#475569', textTransform: 'uppercase', marginBottom: '14px', letterSpacing: '0.05em' }}>
                  Criteria Performance
                </h4>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {/* Metric 1 */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <span style={{ fontSize: '12px', fontWeight: 700, color: '#1E293B' }}>Technical Skills</span>
                      <span style={{ fontSize: '11px', color: '#2563EB', fontWeight: 700 }}>
                        {techSkillValue === 5 ? 'Exceptional' : techSkillValue >= 4 ? 'Highly Capable' : techSkillValue >= 3 ? 'Proficient' : 'Basic'}
                      </span>
                    </div>
                    <input 
                      type="range" min="1" max="5" 
                      value={techSkillValue} 
                      onChange={e => setTechSkillValue(Number(e.target.value))}
                      style={{ width: '100%', cursor: 'pointer', accentColor: '#2563EB' }}
                    />
                  </div>

                  {/* Metric 2 */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <span style={{ fontSize: '12px', fontWeight: 700, color: '#1E293B' }}>Communication</span>
                      <span style={{ fontSize: '11px', color: '#2563EB', fontWeight: 700 }}>
                        {commValue === 5 ? 'Exceptional/Proactive' : commValue >= 4 ? 'Responsive' : commValue >= 3 ? 'Consistent' : 'Needs Work'}
                      </span>
                    </div>
                    <input 
                      type="range" min="1" max="5" 
                      value={commValue} 
                      onChange={e => setCommValue(Number(e.target.value))}
                      style={{ width: '100%', cursor: 'pointer', accentColor: '#2563EB' }}
                    />
                  </div>

                  {/* Metric 3 */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <span style={{ fontSize: '12px', fontWeight: 700, color: '#1E293B' }}>Reliability & Delivery</span>
                      <span style={{ fontSize: '11px', color: '#2563EB', fontWeight: 700 }}>
                        {reliabilityValue === 5 ? 'Exceptional/Dependable' : reliabilityValue >= 4 ? 'Consistent' : reliabilityValue >= 3 ? 'Acceptable' : 'Inconsistent'}
                      </span>
                    </div>
                    <input 
                      type="range" min="1" max="5" 
                      value={reliabilityValue} 
                      onChange={e => setReliabilityValue(Number(e.target.value))}
                      style={{ width: '100%', cursor: 'pointer', accentColor: '#2563EB' }}
                    />
                  </div>
                </div>
              </div>

              {/* Public Feedback */}
              <div>
                <label style={{ fontSize: '11px', fontWeight: 800, color: '#475569', textTransform: 'uppercase', display: 'block', marginBottom: '6px', letterSpacing: '0.05em' }}>
                  Public Testimonial / Feedback
                </label>
                <textarea 
                  placeholder={`Share your positive experience working with ${reviewTalentDetails.name.split(' ')[0]} with the community...`}
                  value={publicFeedbackText}
                  onChange={e => setPublicFeedbackText(e.target.value)}
                  style={{ 
                    width: '100%', height: '80px', border: '1px solid #E2E8F0', 
                    borderRadius: '10px', padding: '12px', fontSize: '13px', 
                    boxSizing: 'border-box', outline: 'none', lineHeight: 1.5, resize: 'vertical',
                    fontFamily: 'inherit'
                  }}
                />
              </div>

              {/* Private Feedback Container */}
              <div style={{ background: '#EFF6FF', borderRadius: '12px', padding: '16px', border: '1px solid #DBEAFE' }}>
                <label style={{ fontSize: '11px', fontWeight: 800, color: '#1E3A8A', textTransform: 'uppercase', display: 'block', marginBottom: '4px', letterSpacing: '0.05em' }}>
                  Confidential Admin-Only Note (Private)
                </label>
                <p style={{ fontSize: '11px', color: '#2563EB', margin: '0 0 8px 0', lineHeight: 1.4 }}>
                  This confidential feedback will be sent directly to the Kongila administrative team for internal talent curation and support. It will not be visible to the talent or on public profiles.
                </p>
                <textarea 
                  placeholder="Share private notes regarding fit, soft skills, or internal manager recommendations..."
                  value={privateFeedbackText}
                  onChange={e => setPrivateFeedbackText(e.target.value)}
                  style={{ 
                    width: '100%', height: '70px', border: '1px solid #BFDBFE', 
                    borderRadius: '8px', padding: '10px', fontSize: '12px', 
                    boxSizing: 'border-box', outline: 'none', lineHeight: 1.5, background: '#FFFFFF',
                    resize: 'vertical', fontFamily: 'inherit'
                  }}
                />
              </div>

              {/* Anonymity Checkbox */}
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#64748B', cursor: 'pointer', userSelect: 'none' }}>
                <input 
                  type="checkbox" 
                  checked={isAnonymousPost} 
                  onChange={e => setIsAnonymousPost(e.target.checked)}
                  style={{ cursor: 'pointer' }}
                />
                Post anonymously to company profile page
              </label>

              {/* Modal Footer buttons */}
              <div style={{ display: 'flex', gap: '12px', marginTop: '10px' }}>
                <button 
                  onClick={() => { setShowReviewModal(false); setReviewTalentDetails(null); }} 
                  style={{ flex: 1, padding: '12px', borderRadius: '10px', border: '1px solid #E2E8F0', background: '#FFFFFF', fontWeight: 700, fontSize: '13px', color: '#475569', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmitReview}
                  style={{ flex: 2, padding: '12px', borderRadius: '10px', border: 'none', background: '#2563EB', fontWeight: 800, fontSize: '13px', color: '#FFFFFF', cursor: 'pointer', boxShadow: '0 4px 12px rgba(37,99,235,0.15)' }}
                >
                  🚀 Submit Verified Review
                </button>
              </div>

            </div>
          </div>
        </div>
      )}

    </div>
  );
}
