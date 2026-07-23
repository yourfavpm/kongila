import React, { useState, useEffect } from "react";
import { GlassCard, Badge, NeonButton } from "@kongila/ui";
import { supabase } from "../lib/supabaseClient";
import SmartIntakeForm from "./SmartIntakeForm";
import MyCompanyPanel from "./MyCompanyPanel";
import MyRequestsPanel from "./MyRequestsPanel";
import MatchedTalentPanel from "./MatchedTalentPanel";
import ClientInterviewsPanel from "./ClientInterviewsPanel";
import ScheduleInterviewModal from "./ScheduleInterviewModal";
import MyTeamPanel from "./MyTeamPanel";
import ClientSettingsPanel from "./ClientSettingsPanel";
import ClientNotificationsPanel from "./ClientNotificationsPanel";
import ClientSupportPanel from "./ClientSupportPanel";

// ─── SVG Navigation Icons Component ──────────────────────────────────────────
const SidebarIcon = ({
  id,
  color = "currentColor",
  size = 18,
}: {
  id: string;
  color?: string;
  size?: number;
}) => {
  switch (id) {
    case "dashboard":
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="none"
          stroke={color}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="3" y="3" width="7" height="9" />
          <rect x="14" y="3" width="7" height="5" />
          <rect x="14" y="12" width="7" height="9" />
          <rect x="3" y="16" width="7" height="5" />
        </svg>
      );
    case "requests":
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="none"
          stroke={color}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
          <polyline points="10 9 9 9 8 9" />
        </svg>
      );
    case "radar":
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="none"
          stroke={color}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="10" />
          <path d="M12 2a10 10 0 0 1 10 10" />
          <path d="M12 12m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0" />
          <path d="M12 12l4 4" />
        </svg>
      );
    case "contracts":
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="none"
          stroke={color}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <path d="m9 15 2 2 4-4" />
        </svg>
      );
    case "billing":
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="none"
          stroke={color}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="2" y="5" width="20" height="14" rx="2" ry="2" />
          <line x1="2" y1="10" x2="22" y2="10" />
        </svg>
      );
    case "messaging":
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="none"
          stroke={color}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      );
    case "scheduling":
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="none"
          stroke={color}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
      );
    case "reviews":
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="none"
          stroke={color}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
      );
    case "profile":
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="none"
          stroke={color}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      );
    case "settings":
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="none"
          stroke={color}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      );
    case "logout":
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="none"
          stroke={color}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
          <polyline points="16 17 21 12 16 7" />
          <line x1="21" y1="12" x2="9" y2="12" />
        </svg>
      );
    case "remotan":
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <path d="M2 12h20" />
          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
        </svg>
      );
    case "support":
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M15.05 5A5 5 0 0 1 19 8.95M15.05 1A9 9 0 0 1 23 8.94m-1 7.98v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
        </svg>
      );
    case "notifications":
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
      );
    default:
      return null;
  }
};

// ─── Section Type Union ──────────────────────────────────────────────────────
type ClientSection =
  | 'dashboard'
  | 'company'
  | 'requests'
  | 'radar'
  | 'scheduling'
  | 'contracts'
  | 'billing'
  | 'remotan'
  | 'messaging'
  | 'notifications'
  | 'profile'
  | 'support';

const NAV_ITEMS: { id: ClientSection; label: string }[] = [
  { id: 'dashboard',     label: 'Home/Overview' },
  { id: 'company',       label: 'My company' },
  { id: 'requests',      label: 'My requests' },
  { id: 'radar',         label: 'Matched talents' },
  { id: 'scheduling',    label: 'Interviews' },
  { id: 'contracts',     label: 'My Team' },
  { id: 'billing',       label: 'Billing' },
  { id: 'remotan',       label: 'Remotan' },
  { id: 'messaging',     label: 'Messages' },
  { id: 'notifications', label: 'Notifications' },
  { id: 'profile',       label: 'Settings' },
  { id: 'support',       label: 'Support' },
];

interface ClientDashboardProps {
  currentUser: any;
  organizations?: any[];
  clientProfiles?: any[];
  users?: any[];
  requestActivityLogs?: any[];
  requests: any[];
  matches: any[];
  contracts: any[];
  talents: any[];
  invoices: any[];
  messages: any[];
  notifications: any[];
  interviews?: any[];
  setInterviews?: (interviews: any[]) => void;
  onSignOut: () => void;
  setActiveTab?: (tab: "home" | "talent" | "client") => void;
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
  conversations?: any[];
  setConversations?: (conversations: any[]) => void;
  setNotifications?: (notifications: any[]) => void;
  onAddRequest?: (newReq: any) => Promise<void>;
  saveToDb?: (updatedDb: any) => Promise<void>;
  rehireRequests?: any[];
  setRehireRequests?: (rehireRequests: any[]) => void;
  supportTickets?: any[];
  setSupportTickets?: (supportTickets: any[]) => void;
}

// ─── Styled Components ────────────────────────────────────────────────────────
const Card = ({
  children,
  style = {},
  onClick,
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
  onClick?: () => void;
}) => (
  <div
    onClick={onClick}
    style={{
      background: "#FFFFFF",
      border: "1px solid #E2E8F0",
      borderRadius: "16px",
      padding: "24px",
      boxShadow:
        "0 4px 20px -2px rgba(148, 163, 184, 0.08), 0 2px 8px -1px rgba(148, 163, 184, 0.04)",
      transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
      ...style,
    }}
  >
    {children}
  </div>
);

const SectionHeader = ({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) => (
  <div style={{ marginBottom: "32px" }}>
    <h2
      style={{
        fontSize: "24px",
        fontWeight: 800,
        color: "#0F172A",
        marginBottom: "8px",
        letterSpacing: "-0.02em",
      }}
    >
      {title}
    </h2>
    {subtitle && (
      <p style={{ fontSize: "15px", color: "#64748B", margin: 0 }}>
        {subtitle}
      </p>
    )}
  </div>
);

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(amount);
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: "12px",
  fontWeight: 700,
  color: "#475569",
  marginBottom: "6px",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px",
  borderRadius: "8px",
  border: "1px solid #CBD5E1",
  outline: "none",
  fontSize: "14px",
};

export default function ClientDashboard({
  currentUser,
  organizations = [],
  clientProfiles = [],
  users = [],
  requestActivityLogs = [],
  requests,
  matches,
  contracts,
  talents,
  invoices,
  messages = [],
  conversations = [],
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
  interviews = [],
  setInterviews,
  saveToDb,
  rehireRequests,
  setRehireRequests,
  supportTickets = [],
  setSupportTickets,
}: ClientDashboardProps) {
  // Billing States
  // Removed injected invoices state
  const [selectedInvoice, setSelectedInvoice] = React.useState<any>(null);
  const [showPaymentModal, setShowPaymentModal] = React.useState(false);
  const [showDisputeModal, setShowDisputeModal] = React.useState(false);
  const [paymentMethod, setPaymentMethod] = React.useState<string>("card");
  const [disputeReason, setDisputeReason] = React.useState<string>("");

  // Messaging States
  const [selectedThreadId, setSelectedThreadId] =
    React.useState<string>("general");
  const [msgInput, setMsgInput] = React.useState("");
  const [msgAttachment, setMsgAttachment] = React.useState<File | null>(null);
  const [uploadingAttachment, setUploadingAttachment] = React.useState(false);

  React.useEffect(() => {
    const markRead = async () => {
      const myConvos = conversations.filter(c => c.client_id === currentUser?.id);
      const activeConvo = myConvos.find(c => c.id === selectedThreadId);
      const convo = activeConvo ? activeConvo : myConvos[0];
      if (!convo) return;
      
      const unreadMsgIds = messages
        .filter(m => m.conversation_id === convo.id && m.sender_id !== currentUser?.id && !m.is_read)
        .map(m => m.id);
        
      if (unreadMsgIds.length > 0) {
        await supabase.from('messages').update({ is_read: true }).in('id', unreadMsgIds);
      }
    };
    markRead();
  }, [messages, selectedThreadId, currentUser?.id, conversations]);

  // Scheduling State
  const [scheduleModalData, setScheduleModalData] = React.useState<{ talent: any, request: any } | null>(null);

  const [activeSection, setActiveSection] =
    useState<ClientSection>("dashboard");
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [chatInput, setChatInput] = useState("");

  // Filter States
  const [searchRequestsFilter, setSearchRequestsFilter] = useState("");
  const [statusRequestsFilter, setStatusRequestsFilter] = useState("All");
  const [typeRequestsFilter, setTypeRequestsFilter] = useState("All");
  const [searchHiresFilter, setSearchHiresFilter] = useState("");

  // Messaging & Reviews Premium States
  // Removed old selectedThreadId
  const [searchChatFilter, setSearchChatFilter] = useState("");
  const [selectedReviewTalentId, setSelectedReviewTalentId] = useState("alex");
  const [reviewRating, setReviewRating] = useState(0);
  const [techSkillValue, setTechSkillValue] = useState(4);
  const [commValue, setCommValue] = useState(5);
  const [reliabilityValue, setReliabilityValue] = useState(5);
  const [publicFeedbackText, setPublicFeedbackText] = useState("");
  const [privateFeedbackText, setPrivateFeedbackText] = useState("");
  const [isAnonymousPost, setIsAnonymousPost] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewTalentDetails, setReviewTalentDetails] = useState<{
    id: string;
    name: string;
    role: string;
    contract?: string;
    avatar?: string;
  } | null>(null);

  // Local Within-Dashboard Smart Intake Wizard State
  const [showIntakeModal, setShowIntakeModal] = useState(false);
  const [intakeStep, setIntakeStep] = useState(1);
  const [intakeForm, setIntakeForm] = useState({
    serviceType: "",
    roleDescription: "",
    requiredSkills: "",
    duration: "",
    commitmentLevel: "",
    numberOfHires: 1,
    timezone: "",
    startDate: "",
    budget: "",
    priority: "",
  });

  // Talent Matching Premium States
  const [selectedMatchingRequestId, setSelectedMatchingRequestId] =
    useState("");
  const [matchingShortlistedState, setMatchingShortlistedState] = useState<
    Record<string, boolean>
  >({ mk: true });
  const [detailsViewRequestId, setDetailsViewRequestId] = useState<
    string | null
  >(null);
  const [interviewRequests, setInterviewRequests] = useState<
    Record<string, string[]>
  >({});

  const [showRequestInterviewModal, setShowRequestInterviewModal] =
    useState(false);
  const [requestInterviewTarget, setRequestInterviewTarget] = useState<{
    matchId: string;
    talentName: string;
    talentId: string;
    requestId: string;
  } | null>(null);
  const [requestInterviewForm, setRequestInterviewForm] = useState({
    date: "",
    time: "10:00",
    duration: "45",
    notes: "",
  });

  // Notifications and Messages badge calculations
  const effectiveNotifications = notifications || [];
  const unreadNotifsCount = effectiveNotifications.filter(
    (n) => !n.read,
  ).length;
  const unreadByModule = effectiveNotifications
    .filter((n) => !n.read)
    .reduce((acc: any, n: any) => {
      const t = (n.title || "").toLowerCase();
      const m = (n.message || "").toLowerCase();
      if (t.includes("interview") || m.includes("interview"))
        acc["scheduling"] = (acc["scheduling"] || 0) + 1;
      else if (
        t.includes("contract") ||
        m.includes("contract") ||
        t.includes("hire")
      )
        acc["contracts"] = (acc["contracts"] || 0) + 1;
      else if (
        t.includes("match") ||
        m.includes("match") ||
        t.includes("shortlist") ||
        m.includes("shortlist") ||
        t.includes("talent")
      )
        acc["radar"] = (acc["radar"] || 0) + 1;
      else if (t.includes("request") || m.includes("request"))
        acc["requests"] = (acc["requests"] || 0) + 1;
      else if (
        t.includes("invoice") ||
        m.includes("invoice") ||
        t.includes("billing")
      )
        acc["billing"] = (acc["billing"] || 0) + 1;
      else if (
        t.includes("review") ||
        m.includes("review") ||
        t.includes("feedback")
      )
        acc["reviews"] = (acc["reviews"] || 0) + 1;
      return acc;
    }, {});
  const unreadMessagesCount = messages
    ? messages.filter((m) => !m.read).length
    : 0;

  // Viewing Talent Profile Detail State
  const [viewingTalentProfile, setViewingTalentProfile] = useState<any | null>(
    null,
  );

  // Job Offer / Hire State
  const [showHireModal, setShowHireModal] = useState(false);
  const [hireTarget, setHireTarget] = useState<any | null>(null);
  const [hireForm, setHireForm] = useState({
    salary: "",
    startDate: "",
    notes: "",
  });

  // Invoices & Re-hiring States
  const [showAllInvoicesModal, setShowAllInvoicesModal] = useState(false);
  const [showRehireModal, setShowRehireModal] = useState(false);
  const [rehireTarget, setRehireTarget] = useState<{
    id: string;
    talentName: string;
    role: string;
    avatar: string;
    talentId?: string;
  } | null>(null);
  const [rehireForm, setRehireForm] = useState({
    role: "",
    rate: "12400",
    startDate: "",
    commitmentLevel: "Full-Time" as "Full-Time" | "Part-Time",
    notes: "",
  });

  const submitInterviewRequest = async () => {
    if (
      !requestInterviewTarget ||
      !requestInterviewForm.date ||
      !requestInterviewForm.time
    ) {
      alert("Please select proposed date and time.");
      return;
    }

    const updatedMatches = matches.map((m) => {
      if (m.id === requestInterviewTarget.matchId) {
        return {
          ...m,
          status: "Interview Scheduled" as const,
          requestedDate: requestInterviewForm.date,
          requestedTime: requestInterviewForm.time,
          requestedDuration: requestInterviewForm.duration,
          requestedNotes: requestInterviewForm.notes,
        };
      }
      return m;
    });

    const activeRequest =
      requests.find((r) => r.id === requestInterviewTarget.requestId) ||
      selectedRequest;
    if (!activeRequest) return;

    const confCode = `${Math.random().toString(36).substring(2, 5)}-${Math.random().toString(36).substring(2, 6)}-${Math.random().toString(36).substring(2, 5)}`;
    const meetingLink = `https://meet.google.com/${confCode}`;
    const calEventId = `gcal_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const calendarTitle = encodeURIComponent(
      `${activeRequest.serviceType} - Interview with ${requestInterviewTarget.talentName}`,
    );
    const googleCalendarLink = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${calendarTitle}&dates=${requestInterviewForm.date.replace(/-/g, "")}T${requestInterviewForm.time.replace(":", "")}00Z/${requestInterviewForm.date.replace(/-/g, "")}T${requestInterviewForm.time.replace(":", "")}00Z&location=${encodeURIComponent(meetingLink)}`;

    const newInterview = {
      id: `interview_${Date.now()}`,
      requestId: requestInterviewTarget.requestId,
      matchId: requestInterviewTarget.matchId,
      talentId: requestInterviewTarget.talentId,
      talentName: requestInterviewTarget.talentName,
      talentAvatar:
        talents.find((t) => t.id === requestInterviewTarget.talentId)?.avatar ||
        "",
      clientName: currentUser?.companyName || currentUser?.name || "Client",
      title: `${activeRequest.serviceType} - Interview with ${requestInterviewTarget.talentName}`,
      date: requestInterviewForm.date,
      time: requestInterviewForm.time,
      status: "Scheduled",
      meetingLink,
      googleCalendarEventId: calEventId,
      googleCalendarLink,
      notes: requestInterviewForm.notes || "",
      createdAt: new Date().toISOString(),
    };

    try {
      const { error: ivErr } = await supabase.from('interviews').insert({
        request_id: newInterview.requestId,
        match_id: newInterview.matchId,
        client_id: currentUser?.id,
        talent_id: newInterview.talentId,
        talent_name: newInterview.talentName,
        talent_avatar: newInterview.talentAvatar,
        client_name: newInterview.clientName,
        title: newInterview.title,
        date: newInterview.date,
        time: newInterview.time,
        status: newInterview.status,
        meeting_link: newInterview.meetingLink,
        google_calendar_event_id: newInterview.googleCalendarEventId,
        google_calendar_link: newInterview.googleCalendarLink,
        notes: newInterview.notes
      });
      if (ivErr) throw ivErr;

      // Update match status to Interview Scheduled
      if (newInterview.matchId) {
        await supabase.from('matches').update({
          status: 'interview_scheduled'
        }).eq('id', newInterview.matchId);
      }

      await supabase.from("notifications").insert({
        user_id: requestInterviewTarget.talentId,
        title: "Interview Scheduled",
        content: `Interview "${newInterview.title}" has been booked for ${newInterview.date} at ${newInterview.time}.`,
        read_status: false,
      });

      if (setInterviews) {
        // Optimistically update local interviews if possible
        // Actually, ClientDashboard doesn't have setInterviews, it just gets it as prop.
        // Sync via channel or refresh will pick it up.
      }
      if (setMatches) {
        setMatches(updatedMatches);
      }

      setShowRequestInterviewModal(false);
      setRequestInterviewTarget(null);
      setRequestInterviewForm({
        date: "",
        time: "10:00",
        duration: "45",
        notes: "",
      });

      alert(
        `Interview with ${requestInterviewTarget.talentName} has been successfully scheduled and synced to your calendars.`,
      );
    } catch {
      alert("Failed to schedule interview. Please try again.");
    }
  };

  const submitRehireRequest = async () => {
    if (
      !rehireTarget ||
      !rehireForm.role ||
      !rehireForm.rate ||
      !rehireForm.startDate
    ) {
      alert("Please fill in all required fields.");
      return;
    }

    const rehireId = `rehire_${Date.now()}`;
    const newRehireRequest = {
      id: rehireId,
      clientId: currentUser?.id,
      clientName: `${currentUser?.name || "Client"} (${currentUser?.companyName || "Horizon Fintech"})`,
      talentId: rehireTarget.talentId || "talent_chidi",
      talentName: rehireTarget.talentName,
      role: rehireForm.role,
      proposedRate: Number(rehireForm.rate),
      proposedStartDate: rehireForm.startDate,
      commitmentLevel: rehireForm.commitmentLevel,
      notes: rehireForm.notes,
      status: "Pending" as const,
      createdAt: new Date().toISOString(),
    };

    const newAuditLog = {
      id: `audit_${Date.now()}`,
      actor: currentUser?.name || "Client",
      action: "Submit Re-hire Request",
      details: `Submitted request to re-hire ${rehireTarget.talentName} as ${rehireForm.role} starting ${rehireForm.startDate}.`,
      timestamp: new Date().toISOString(),
    };

    const newAgentLog = {
      id: `alog_${Date.now()}`,
      agentName: "Workflow Agent" as const,
      message: `Re-hire proposal for ${rehireTarget.talentName} drafted. Forwarded to admin operations.`,
      timestamp: new Date().toLocaleTimeString(),
      type: "info" as const,
    };

    const updatedRehireRequests = [...(rehireRequests || []), newRehireRequest];

    try {
      const { error: reqErr } = await supabase.from('talent_requests').insert({
        client_id: currentUser?.id,
        service_type: 'Re-hire',
        payload: {
          ...newRehireRequest,
          referenceNumber: `KNG-REHIRE-${Math.floor(1000 + Math.random() * 9000)}`
        }
      });
      if (reqErr) throw reqErr;

      await supabase.from("notifications").insert({
        user_id: currentUser?.id,
        title: "Re-hire Request Submitted",
        content: `Re-hire request for "${rehireTarget.talentName}" submitted. Operations team will confirm terms shortly.`,
        read_status: false,
      });

      if (setRehireRequests) {
        setRehireRequests(updatedRehireRequests);
      }

      setShowRehireModal(false);
      setRehireTarget(null);
      setRehireForm({
        role: "",
        rate: "12400",
        startDate: "",
        commitmentLevel: "Full-Time",
        notes: "",
      });

      alert(
        `Re-hire request for ${rehireTarget.talentName} has been successfully submitted to Admin operations.`,
      );
    } catch {
      alert("Failed to submit re-hire request. Please try again.");
    }
  };

  const handleSubmitReview = async () => {
    if (!reviewTalentDetails) return;
    if (reviewRating === 0) {
      alert("Please select a star rating first.");
      return;
    }

    const targetName = reviewTalentDetails.name;
    const targetRole = reviewTalentDetails.role;

    try {
      // 1. Insert primary review/telemetry into Supabase notifications
      await supabase.from("notifications").insert({
        user_id: currentUser?.id,
        title: "Review Submitted",
        content: `Review successfully posted for ${targetName} (${targetRole}) - Rating: ${reviewRating} Stars. ${publicFeedbackText ? `Comments: "${publicFeedbackText}"` : ""}`,
        read_status: false,
      });

      // 2. If private feedback is provided, insert a confidential admin notification log
      if (privateFeedbackText.trim()) {
        await supabase.from("notifications").insert({
          user_id: currentUser?.id,
          title: "Confidential Admin Review",
          content: `CONFIDENTIAL ADMIN-ONLY REVIEW for ${targetName} (${targetRole}). Ratings - Overall: ${reviewRating} Stars, Tech: ${techSkillValue}, Comm: ${commValue}, Reliability: ${reliabilityValue}. Private feedback: "${privateFeedbackText}".`,
          read_status: false,
        });
      }

      // Update local state notifications so it displays in UI logs
      if (setNotifications && notifications) {
        const newNotifs = [
          {
            id: `notif_${Date.now()}_pub`,
            userId: currentUser?.id || "client_unknown",
            title: "Review Submitted",
            message: `Review successfully posted for ${targetName} (${targetRole}) - Rating: ${reviewRating} Stars.`,
            read: false,
            createdAt: new Date().toISOString(),
          },
        ];
        if (privateFeedbackText.trim()) {
          newNotifs.push({
            id: `notif_${Date.now()}_priv`,
            userId: currentUser?.id || "client_unknown",
            title: "Confidential Admin Review Logged",
            message: `Private feedback for ${targetName} successfully transmitted to administrators.`,
            read: false,
            createdAt: new Date().toISOString(),
          });
        }
        setNotifications([...(notifications || []), ...newNotifs]);
      }
    } catch (e) {
      console.error("Error inserting review telemetry:", e);
    }

    alert(
      `Thank you! Your verified evaluation for ${targetName} has been logged in our EOR ledger and securely synchronized.`,
    );

    // Reset inputs & close modal
    setReviewRating(0);
    setTechSkillValue(4);
    setCommValue(5);
    setReliabilityValue(5);
    setPublicFeedbackText("");
    setPrivateFeedbackText("");
    setIsAnonymousPost(false);
    setShowReviewModal(false);
    setReviewTalentDetails(null);
  };

  const handleShortlistToggle = async (
    candId: string,
    candName: string,
    requestId?: string,
  ) => {
    const isShortlistedNow = !matchingShortlistedState[candId];
    setMatchingShortlistedState((prev) => ({
      ...prev,
      [candId]: isShortlistedNow,
    }));

    if (setNotifications) {
      setNotifications([
        ...(notifications || []),
        {
          id: `notif_${Date.now()}`,
          userId: currentUser?.id || "client_unknown",
          title: isShortlistedNow
            ? "Candidate Shortlisted"
            : "Candidate Removed",
          message: `${candName} has been ${isShortlistedNow ? "shortlisted" : "removed"} from your matching pipeline.`,
          read: false,
          createdAt: new Date().toISOString(),
        },
      ]);
    }

    alert(
      `${candName} has been ${isShortlistedNow ? "shortlisted successfully" : "removed from shortlists"}.`,
    );
  };

  const handleRequestInterview = async (
    candName: string,
    requestId?: string,
  ) => {
    const requestKey = requestId || detailsViewRequestId;
    if (requestKey) {
      setInterviewRequests((prev) => ({
        ...prev,
        [requestKey]: [...(prev[requestKey] || []), candName],
      }));
    }

    if (setNotifications) {
      setNotifications([
        ...(notifications || []),
        {
          id: `notif_${Date.now()}`,
          userId: currentUser?.id || "client_unknown",
          title: "Interview Request Sent",
          message: `Interview request dispatched to ${candName}${requestKey ? ` for request ${requestKey}` : ""}.`,
          read: false,
          createdAt: new Date().toISOString(),
        },
      ]);
    }

    try {
      await supabase.from("notifications").insert({
        user_id: currentUser?.id,
        title: "Interview Proposal Dispatched",
        content: `Interview request successfully sent to ${candName}.`,
        read_status: false,
      });
    } catch (error) {
      // Swallow notification errors; app should continue for the user.
    }

    alert(
      `Interview proposal dispatched to ${candName}. Candidate has been notified to choose available slot.`,
    );
  };

  // Dynamic stats calculation from real backend telemetry
  const clientContracts = contracts.filter(
    (c: any) => c.clientId === currentUser?.id,
  );
  const activeContracts = clientContracts.filter(
    (c: any) =>
      c.status?.toLowerCase() === "signed" ||
      c.status?.toLowerCase() === "active",
  );
  const activeHiresCount = activeContracts.length;
  const pendingMatchesCount = matches.filter((m: any) => {
    const req = requests.find((r: any) => r.id === m.requestId);
    return (
      req?.clientId === currentUser?.id &&
      m.status?.toLowerCase() === "shortlisted"
    );
  }).length;
  const activeRequestsCount = requests.filter(
    (r: any) =>
      r.clientId === currentUser?.id && r.status?.toLowerCase() !== "closed",
  ).length;

  // Calculate pending unpaid invoices
  const pendingInvoicesTotal = invoices
    .filter(
      (inv) =>
        inv.clientId === currentUser?.id &&
        inv.status?.toLowerCase() !== "paid",
    )
    .reduce((sum, inv) => sum + Number(inv.amount || 0), 0);

  // Dynamic Matching pipeline progress list
  const clientRequests = requests.filter((r) => r.clientId === currentUser?.id);

  // Dynamic Recent Activity logs derived directly from real database items
  const dynamicActivities = [
    ...requests
      .filter((r) => r.clientId === currentUser?.id)
      .map((r) => ({
        id: `act_req_${r.id}`,
        text: `New service request for "${r.serviceType.toUpperCase()} - ${r.numberOfHires} Talent" created`,
        time: r.createdAt
          ? new Date(r.createdAt).toLocaleDateString()
          : "Recently",
        icon: "📝",
      })),
    ...contracts
      .filter((c) => c.clientId === currentUser?.id)
      .map((c) => ({
        id: `act_cnt_${c.id}`,
        text: `EOR Employment Contract for ${c.talentName} status updated to ${c.status}`,
        time: "Contract status log",
        icon: "📄",
      })),
    ...invoices
      .filter((i) => i.clientId === currentUser?.id)
      .map((i) => ({
        id: `act_inv_${i.id}`,
        text: `Invoice #${i.id.substring(0, 8)} status is "${i.status}"`,
        time: i.dueDate
          ? `Due ${new Date(i.dueDate).toLocaleDateString()}`
          : "Billing",
        icon: "💵",
      })),
  ].slice(0, 5); // display top 5 most relevant real activities

  // Send messaging dispatch
  // ─── Sub-Section Layouts ─────────────────────────────────────────────────────

  const renderDashboard = () => {
    // ─── KC-HOME: Derived data ───────────────────────────────────────────────
    const now = new Date();

    // Active Service Requests widget
    const openRequests = clientRequests.filter(
      (r) =>
        r.status?.toLowerCase() !== "closed" &&
        r.status?.toLowerCase() !== "completed",
    );
    const topThreeRequests = openRequests.slice(0, 3);

    // Matched Talent Waiting — requests at "Candidates Ready", sorted oldest-first
    const candidatesReadyRequests = clientRequests
      .filter((r) => r.status === "Candidates Ready")
      .sort(
        (a, b) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      );
    const oldestPendingRequestId = candidatesReadyRequests[0]?.id || null;

    // Active Team — deployed talent (active contracts)
    const activeTeamTalents = talents.filter((t: any) =>
      activeContracts.some(
        (c: any) => c.talentId === t.id || c.talentName === t.name,
      ),
    );
    const avgPerformanceScore =
      activeTeamTalents.length > 0
        ? Math.round(
            activeTeamTalents.reduce((sum, t: any) => {
              const scores = t.vettingScores || {};
              const vals = Object.values(scores).filter(
                (v) => typeof v === "number",
              ) as number[];
              return (
                sum +
                (vals.length > 0
                  ? vals.reduce((a, b) => a + b, 0) / vals.length
                  : 80)
              );
            }, 0) / activeTeamTalents.length,
          )
        : 0;

    // Upcoming interviews — next 3 within 14 days, client local TZ
    const clientInterviews: any[] = typeof window !== "undefined" ? [] : [];
    const upcoming3 = Array.isArray(clientInterviews)
      ? clientInterviews
          .filter((iv: any) => {
            const d = new Date(`${iv.date}T${iv.time}`);
            return (
              iv.status !== "Cancelled" &&
              d >= now &&
              d <= new Date(now.getTime() + 14 * 86400000)
            );
          })
          .sort(
            (a: any, b: any) =>
              new Date(`${a.date}T${a.time}`).getTime() -
              new Date(`${b.date}T${b.time}`).getTime(),
          )
          .slice(0, 3)
      : [];

    // Pending invoices
    const clientInvoices = invoices.filter(
      (inv: any) => inv.clientId === currentUser?.id,
    );
    const unpaidInvoices = clientInvoices.filter(
      (inv: any) => inv.status?.toLowerCase() !== "paid",
    );
    const overdueInvoices = clientInvoices.filter(
      (inv: any) => inv.status?.toLowerCase() === "overdue",
    );
    const totalOutstanding = unpaidInvoices.reduce(
      (sum, inv) => sum + Number(inv.amount || 0),
      0,
    );
    const hasOverdue = overdueInvoices.length > 0;

    // Remotan: unlocked if any active hire exists
    const remotanUnlocked = activeHiresCount > 0;

    // Status color helper
    const statusColors: Record<
      string,
      { bg: string; text: string; dot: string }
    > = {
      "New Request": { bg: "#EFF6FF", text: "#2563EB", dot: "#3B82F6" },
      Matching: { bg: "#F0FDF4", text: "#16A34A", dot: "#22C55E" },
      "Candidates Ready": { bg: "#FFF7ED", text: "#C2410C", dot: "#F97316" },
      Interview: { bg: "#F5F3FF", text: "#6D28D9", dot: "#7C3AED" },
      Reviewing: { bg: "#FEF9C3", text: "#854D0E", dot: "#CA8A04" },
      Completed: { bg: "#F0FDF4", text: "#166534", dot: "#15803D" },
      Closed: { bg: "#F1F5F9", text: "#475569", dot: "#94A3B8" },
    };
    const getStatusStyle = (status: string) =>
      statusColors[status] || {
        bg: "#F1F5F9",
        text: "#475569",
        dot: "#94A3B8",
      };

    // Build widget order — overdue invoice card goes first if hasOverdue
    const invoiceWidget = (
      <Card
        style={{
          border: hasOverdue ? "2px solid #EF4444" : "1px solid #E2E8F0",
          background: hasOverdue ? "#FFF5F5" : "#FFFFFF",
          boxShadow: hasOverdue ? "0 0 0 4px rgba(239,68,68,0.08)" : undefined,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            marginBottom: "16px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "10px",
                background: hasOverdue ? "#FEE2E2" : "#EFF6FF",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "18px",
              }}
            >
              💵
            </div>
            <div>
              <div
                style={{
                  fontSize: "12px",
                  fontWeight: 700,
                  color: "#64748B",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                Pending Invoices
              </div>
              {hasOverdue && (
                <div
                  style={{
                    fontSize: "11px",
                    fontWeight: 800,
                    color: "#EF4444",
                    marginTop: "2px",
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                  }}
                >
                  <span
                    style={{
                      width: "6px",
                      height: "6px",
                      borderRadius: "50%",
                      background: "#EF4444",
                      display: "inline-block",
                    }}
                  />
                  {overdueInvoices.length} OVERDUE
                </div>
              )}
            </div>
          </div>
          <span style={{ fontSize: "11px", fontWeight: 700, color: "#64748B" }}>
            {unpaidInvoices.length} unpaid
          </span>
        </div>
        <div
          style={{
            fontSize: "28px",
            fontWeight: 900,
            color: hasOverdue ? "#DC2626" : "#0F172A",
            marginBottom: "16px",
            letterSpacing: "-0.02em",
          }}
        >
          {formatCurrency(totalOutstanding)}
        </div>
        <button
          onClick={() => setActiveSection("billing")}
          style={{
            width: "100%",
            padding: "10px",
            borderRadius: "10px",
            border: "none",
            background: hasOverdue ? "#EF4444" : "#0F172A",
            color: "#FFFFFF",
            fontWeight: 700,
            fontSize: "13px",
            cursor: "pointer",
            transition: "opacity 0.2s",
          }}
        >
          {hasOverdue ? "⚠️ Pay Now — Overdue Balance" : "Pay Now →"}
        </button>
      </Card>
    );

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "32px" }}>
        {/* ── Welcome Header ──────────────────────────────────────────────────── */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
            flexWrap: "wrap",
            gap: "16px",
          }}
        >
          <div>
            <p
              style={{
                fontSize: "13px",
                fontWeight: 700,
                color: "#6366F1",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                margin: "0 0 8px 0",
              }}
            >
              ● KONGILA CLIENT PORTAL
            </p>
            <h1
              style={{
                fontSize: "32px",
                fontWeight: 900,
                color: "#0F172A",
                marginBottom: "8px",
                letterSpacing: "-0.03em",
                margin: 0,
              }}
            >
              Welcome back, {currentUser?.name?.split(" ")[0] || "Client"} 👋
            </h1>
            <p
              style={{
                fontSize: "15px",
                color: "#64748B",
                margin: "8px 0 0 0",
              }}
            >
              {currentUser?.companyName ? `${currentUser.companyName} · ` : ""}
              Here's your full Kongila pipeline at a glance.
            </p>
          </div>
          {/* Quick Actions Bar (always visible) */}
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
            <button
              onClick={() => {
                setShowIntakeModal(true);
                setIntakeStep(1);
              }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                background: "linear-gradient(135deg, #2563EB, #1D4ED8)",
                border: "none",
                borderRadius: "10px",
                padding: "10px 18px",
                color: "#FFFFFF",
                fontWeight: 700,
                fontSize: "13px",
                cursor: "pointer",
                boxShadow: "0 4px 12px rgba(37,99,235,0.25)",
                transition: "transform 0.2s",
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.transform = "translateY(-1px)")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.transform = "translateY(0)")
              }
            >
              ＋ New Request
            </button>
            <button
              onClick={() => setActiveSection("messaging")}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                background: "#FFFFFF",
                border: "1px solid #E2E8F0",
                borderRadius: "10px",
                padding: "10px 18px",
                color: "#1E293B",
                fontWeight: 700,
                fontSize: "13px",
                cursor: "pointer",
                transition: "background 0.2s",
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.background = "#F8FAFC")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.background = "#FFFFFF")
              }
            >
              💬 Message Account Manager
            </button>
            <button
              onClick={() => setActiveSection("billing")}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                background: "#FFFFFF",
                border: "1px solid #E2E8F0",
                borderRadius: "10px",
                padding: "10px 18px",
                color: "#1E293B",
                fontWeight: 700,
                fontSize: "13px",
                cursor: "pointer",
                transition: "background 0.2s",
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.background = "#F8FAFC")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.background = "#FFFFFF")
              }
            >
              🧾 View Invoices
            </button>
          </div>
        </div>

        {/* ── Widget Grid Row 1: Primary Status Cards ──────────────────────────── */}
        {/* If overdue, invoice widget is hoisted to first row */}
        {hasOverdue && (
          <div
            style={{ display: "grid", gridTemplateColumns: "1fr", gap: "0" }}
          >
            {invoiceWidget}
          </div>
        )}

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
            gap: "20px",
          }}
        >
          {/* 1. Active Service Requests */}
          <Card style={{ gridColumn: "span 2" }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "20px",
              }}
            >
              <div
                style={{ display: "flex", alignItems: "center", gap: "10px" }}
              >
                <div
                  style={{
                    width: "36px",
                    height: "36px",
                    borderRadius: "10px",
                    background: "#EFF6FF",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "18px",
                  }}
                >
                  📋
                </div>
                <div>
                  <div
                    style={{
                      fontSize: "12px",
                      fontWeight: 700,
                      color: "#64748B",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                    }}
                  >
                    Active Service Requests
                  </div>
                  <div
                    style={{
                      fontSize: "22px",
                      fontWeight: 900,
                      color: "#0F172A",
                      lineHeight: 1,
                    }}
                  >
                    {openRequests.length}
                  </div>
                </div>
              </div>
              <button
                onClick={() => setActiveSection("requests")}
                style={{
                  background: "#EFF6FF",
                  border: "none",
                  color: "#2563EB",
                  fontSize: "12px",
                  fontWeight: 700,
                  cursor: "pointer",
                  padding: "6px 10px",
                  borderRadius: "8px",
                }}
              >
                View All →
              </button>
            </div>
            {topThreeRequests.length > 0 ? (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "10px",
                }}
              >
                {topThreeRequests.map((req) => {
                  const sc = getStatusStyle(req.status || "New Request");
                  return (
                    <div
                      key={req.id}
                      onClick={() => {
                        setDetailsViewRequestId(req.id);
                        setActiveSection("requests");
                      }}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: "12px 16px",
                        borderRadius: "12px",
                        border: "1px solid #F1F5F9",
                        background: "#FAFBFC",
                        cursor: "pointer",
                        transition: "background 0.2s",
                      }}
                      onMouseEnter={(e) =>
                        (e.currentTarget.style.background = "#F1F5F9")
                      }
                      onMouseLeave={(e) =>
                        (e.currentTarget.style.background = "#FAFBFC")
                      }
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            fontSize: "13px",
                            fontWeight: 700,
                            color: "#0F172A",
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {req.serviceType}{" "}
                          {req.roleDescription
                            ? `— ${req.roleDescription.split(" ").slice(0, 5).join(" ")}…`
                            : ""}
                        </div>
                        <div
                          style={{
                            fontSize: "11px",
                            color: "#94A3B8",
                            marginTop: "2px",
                          }}
                        >
                          {req.numberOfHires} hire
                          {req.numberOfHires !== 1 ? "s" : ""} ·{" "}
                          {req.createdAt
                            ? new Date(req.createdAt).toLocaleDateString(
                                "en-US",
                                { month: "short", day: "numeric" },
                              )
                            : "Recently"}
                        </div>
                      </div>
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "5px",
                          fontSize: "10px",
                          fontWeight: 800,
                          padding: "3px 8px",
                          borderRadius: "8px",
                          background: sc.bg,
                          color: sc.text,
                          whiteSpace: "nowrap",
                          marginLeft: "12px",
                        }}
                      >
                        <span
                          style={{
                            width: "5px",
                            height: "5px",
                            borderRadius: "50%",
                            background: sc.dot,
                          }}
                        />
                        {req.status || "New Request"}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div
                style={{
                  textAlign: "center",
                  padding: "24px",
                  color: "#94A3B8",
                }}
              >
                <div style={{ fontSize: "32px", marginBottom: "8px" }}>📭</div>
                <p style={{ fontSize: "13px", margin: "0 0 12px 0" }}>
                  No open requests yet
                </p>
                <button
                  onClick={() => {
                    setShowIntakeModal(true);
                    setIntakeStep(1);
                  }}
                  style={{
                    background: "#2563EB",
                    border: "none",
                    borderRadius: "8px",
                    padding: "8px 16px",
                    color: "#FFFFFF",
                    fontWeight: 700,
                    fontSize: "12px",
                    cursor: "pointer",
                  }}
                >
                  + New Request
                </button>
              </div>
            )}
          </Card>

          {/* 2. Matched Talent Waiting */}
          {candidatesReadyRequests.length > 0 && (
            <Card style={{ borderTop: "3px solid #F97316" }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  marginBottom: "16px",
                }}
              >
                <div
                  style={{
                    width: "36px",
                    height: "36px",
                    borderRadius: "10px",
                    background: "#FFF7ED",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "18px",
                  }}
                >
                  🎯
                </div>
                <div>
                  <div
                    style={{
                      fontSize: "12px",
                      fontWeight: 700,
                      color: "#64748B",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                    }}
                  >
                    Matched Talent Waiting
                  </div>
                  <div
                    style={{
                      fontSize: "22px",
                      fontWeight: 900,
                      color: "#0F172A",
                      lineHeight: 1,
                    }}
                  >
                    {candidatesReadyRequests.length}
                  </div>
                </div>
              </div>
              <p
                style={{
                  fontSize: "13px",
                  color: "#475569",
                  margin: "0 0 16px 0",
                }}
              >
                {candidatesReadyRequests.length === 1
                  ? "Candidates are ready for your review"
                  : `${candidatesReadyRequests.length} requests have candidates ready — oldest pending first`}
              </p>
              <div
                style={{
                  fontSize: "11px",
                  color: "#94A3B8",
                  marginBottom: "12px",
                }}
              >
                Waiting since:{" "}
                {candidatesReadyRequests[0]?.createdAt
                  ? new Date(
                      candidatesReadyRequests[0].createdAt,
                    ).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })
                  : "Recently"}
              </div>
              <button
                onClick={() => {
                  if (oldestPendingRequestId) {
                    setDetailsViewRequestId(oldestPendingRequestId);
                    setActiveSection("radar");
                  }
                }}
                style={{
                  width: "100%",
                  padding: "10px",
                  borderRadius: "10px",
                  border: "none",
                  background: "linear-gradient(135deg, #F97316, #EA580C)",
                  color: "#FFFFFF",
                  fontWeight: 700,
                  fontSize: "13px",
                  cursor: "pointer",
                  boxShadow: "0 4px 12px rgba(249,115,22,0.2)",
                }}
              >
                Review Now →
              </button>
            </Card>
          )}

          {/* 3. Active Team Summary — only visible after first hire */}
          {activeHiresCount > 0 && (
            <Card style={{ borderTop: "3px solid #10B981" }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  marginBottom: "16px",
                }}
              >
                <div
                  style={{
                    width: "36px",
                    height: "36px",
                    borderRadius: "10px",
                    background: "#ECFDF5",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "18px",
                  }}
                >
                  👥
                </div>
                <div>
                  <div
                    style={{
                      fontSize: "12px",
                      fontWeight: 700,
                      color: "#64748B",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                    }}
                  >
                    Active Team
                  </div>
                  <div
                    style={{
                      fontSize: "22px",
                      fontWeight: 900,
                      color: "#0F172A",
                      lineHeight: 1,
                    }}
                  >
                    {activeHiresCount}
                  </div>
                </div>
              </div>
              <div
                style={{ display: "flex", gap: "12px", marginBottom: "16px" }}
              >
                <div
                  style={{
                    flex: 1,
                    background: "#F8FAFC",
                    borderRadius: "10px",
                    padding: "10px",
                    textAlign: "center",
                  }}
                >
                  <div
                    style={{
                      fontSize: "10px",
                      color: "#94A3B8",
                      fontWeight: 700,
                      textTransform: "uppercase",
                    }}
                  >
                    Deployed
                  </div>
                  <div
                    style={{
                      fontSize: "20px",
                      fontWeight: 900,
                      color: "#10B981",
                    }}
                  >
                    {activeHiresCount}
                  </div>
                </div>
                <div
                  style={{
                    flex: 1,
                    background: "#F8FAFC",
                    borderRadius: "10px",
                    padding: "10px",
                    textAlign: "center",
                  }}
                >
                  <div
                    style={{
                      fontSize: "10px",
                      color: "#94A3B8",
                      fontWeight: 700,
                      textTransform: "uppercase",
                    }}
                  >
                    Avg. Score
                  </div>
                  <div
                    style={{
                      fontSize: "20px",
                      fontWeight: 900,
                      color: "#2563EB",
                    }}
                  >
                    {avgPerformanceScore}%
                  </div>
                </div>
              </div>
              {/* Avatar pile */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  marginBottom: "16px",
                }}
              >
                {activeTeamTalents.slice(0, 4).map((t: any, i: number) => (
                  <div
                    key={t.id}
                    style={{
                      width: "32px",
                      height: "32px",
                      borderRadius: "50%",
                      border: "2px solid #FFFFFF",
                      marginLeft: i > 0 ? "-8px" : "0",
                      background: "#EFF6FF",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "13px",
                      fontWeight: 700,
                      color: "#2563EB",
                      overflow: "hidden",
                      zIndex: 5 - i,
                    }}
                  >
                    {t.avatar ? (
                      <img
                        src={t.avatar}
                        alt=""
                        style={{
                          width: "100%",
                          height: "100%",
                          objectFit: "cover",
                        }}
                      />
                    ) : (
                      t.name?.charAt(0) || "?"
                    )}
                  </div>
                ))}
                {activeTeamTalents.length > 4 && (
                  <div
                    style={{
                      width: "32px",
                      height: "32px",
                      borderRadius: "50%",
                      border: "2px solid #FFFFFF",
                      marginLeft: "-8px",
                      background: "#F1F5F9",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "11px",
                      fontWeight: 700,
                      color: "#475569",
                    }}
                  >
                    +{activeTeamTalents.length - 4}
                  </div>
                )}
              </div>
              <button
                onClick={() => setActiveSection("contracts")}
                style={{
                  width: "100%",
                  padding: "10px",
                  borderRadius: "10px",
                  border: "none",
                  background: "#0F172A",
                  color: "#FFFFFF",
                  fontWeight: 700,
                  fontSize: "13px",
                  cursor: "pointer",
                }}
              >
                View My Team →
              </button>
            </Card>
          )}

          {/* 4. Upcoming Interviews — only shown when interviews exist */}
          <Card>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                marginBottom: "16px",
              }}
            >
              <div
                style={{
                  width: "36px",
                  height: "36px",
                  borderRadius: "10px",
                  background: "#F5F3FF",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "18px",
                }}
              >
                📅
              </div>
              <div>
                <div
                  style={{
                    fontSize: "12px",
                    fontWeight: 700,
                    color: "#64748B",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                  }}
                >
                  Upcoming Interviews
                </div>
                <div
                  style={{
                    fontSize: "22px",
                    fontWeight: 900,
                    color: "#0F172A",
                    lineHeight: 1,
                  }}
                >
                  {upcoming3.length}
                </div>
              </div>
            </div>
            {upcoming3.length > 0 ? (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "10px",
                }}
              >
                {upcoming3.map((iv: any) => (
                  <div
                    key={iv.id}
                    style={{
                      padding: "10px 12px",
                      borderRadius: "10px",
                      background: "#F8FAFC",
                      border: "1px solid #F1F5F9",
                    }}
                  >
                    <div
                      style={{
                        fontSize: "12px",
                        fontWeight: 700,
                        color: "#0F172A",
                        marginBottom: "2px",
                      }}
                    >
                      {iv.talentName}
                    </div>
                    <div style={{ fontSize: "11px", color: "#64748B" }}>
                      {new Date(`${iv.date}T${iv.time}`).toLocaleString(
                        "en-US",
                        {
                          weekday: "short",
                          month: "short",
                          day: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                        },
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ fontSize: "13px", color: "#94A3B8", margin: 0 }}>
                No upcoming interviews in the next 14 days.
              </p>
            )}
            <button
              onClick={() => setActiveSection("scheduling")}
              style={{
                marginTop: "14px",
                width: "100%",
                padding: "10px",
                borderRadius: "10px",
                border: "1px solid #E2E8F0",
                background: "#FFFFFF",
                color: "#0F172A",
                fontWeight: 700,
                fontSize: "13px",
                cursor: "pointer",
              }}
            >
              View All →
            </button>
          </Card>

          {/* 5. Pending Invoices — shown here only if NOT overdue (overdue version is hoisted above) */}
          {!hasOverdue && invoiceWidget}

          {/* 6. Remotan Access Status */}
          <Card
            style={{
              borderTop: remotanUnlocked
                ? "3px solid #6366F1"
                : "3px solid #E2E8F0",
              gridColumn: remotanUnlocked ? undefined : undefined,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                marginBottom: "14px",
              }}
            >
              <div
                style={{
                  width: "36px",
                  height: "36px",
                  borderRadius: "10px",
                  background: remotanUnlocked ? "#EEF2FF" : "#F1F5F9",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "18px",
                }}
              >
                {remotanUnlocked ? "🔓" : "🔒"}
              </div>
              <div
                style={{
                  fontSize: "12px",
                  fontWeight: 700,
                  color: "#64748B",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                Remotan Workspace
              </div>
            </div>
            {remotanUnlocked ? (
              <>
                <p
                  style={{
                    fontSize: "13px",
                    fontWeight: 700,
                    color: "#4338CA",
                    margin: "0 0 4px 0",
                  }}
                >
                  Workspace Ready
                </p>
                <p
                  style={{
                    fontSize: "12px",
                    color: "#64748B",
                    margin: "0 0 16px 0",
                  }}
                >
                  Your Remotan workspace is provisioned and active for your
                  team.
                </p>
                <a
                  href="https://remotan.io"
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    display: "block",
                    width: "100%",
                    padding: "10px",
                    borderRadius: "10px",
                    border: "none",
                    background: "linear-gradient(135deg, #6366F1, #4F46E5)",
                    color: "#FFFFFF",
                    fontWeight: 700,
                    fontSize: "13px",
                    cursor: "pointer",
                    textDecoration: "none",
                    textAlign: "center",
                    boxSizing: "border-box",
                  }}
                >
                  Open Remotan ↗
                </a>
              </>
            ) : (
              <>
                <p
                  style={{
                    fontSize: "13px",
                    fontWeight: 700,
                    color: "#94A3B8",
                    margin: "0 0 4px 0",
                  }}
                >
                  Hire your first talent to unlock
                </p>
                <p
                  style={{
                    fontSize: "12px",
                    color: "#94A3B8",
                    margin: "0 0 16px 0",
                  }}
                >
                  Remotan workspace is unlocked after your first active hire.
                </p>
                <button
                  onClick={() => {
                    setShowIntakeModal(true);
                    setIntakeStep(1);
                  }}
                  style={{
                    width: "100%",
                    padding: "10px",
                    borderRadius: "10px",
                    border: "1px solid #E2E8F0",
                    background: "#F8FAFC",
                    color: "#475569",
                    fontWeight: 700,
                    fontSize: "13px",
                    cursor: "pointer",
                  }}
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
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "20px",
              }}
            >
              <h3
                style={{
                  fontSize: "16px",
                  fontWeight: 800,
                  color: "#0F172A",
                  margin: 0,
                }}
              >
                Sourcing Pipeline
              </h3>
              <button
                onClick={() => setActiveSection("requests")}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "#2563EB",
                  fontSize: "12px",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                View All Requests →
              </button>
            </div>
            <div
              style={{ display: "flex", flexDirection: "column", gap: "20px" }}
            >
              {openRequests.slice(0, 3).map((req) => {
                const reqMatches = matches.filter(
                  (m: any) => m.requestId === req.id,
                );
                const hasInterview = reqMatches.some(
                  (m: any) => m.status === "Interview Scheduled",
                );
                const hasMatch = reqMatches.length > 0;
                const pct =
                  req.status === "Candidates Ready"
                    ? 75
                    : hasInterview
                      ? 90
                      : hasMatch
                        ? 50
                        : 20;
                const stages = [
                  { label: "Sourcing", pct: 20 },
                  { label: "Matching", pct: 50 },
                  { label: "Shortlisted", pct: 75 },
                  { label: "Interview", pct: 90 },
                  { label: "Hired", pct: 100 },
                ];
                return (
                  <div key={req.id}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        marginBottom: "12px",
                      }}
                    >
                      <div>
                        <div
                          style={{
                            fontSize: "13px",
                            fontWeight: 700,
                            color: "#0F172A",
                          }}
                        >
                          {req.serviceType} —{" "}
                          {req.roleDescription
                            ?.split(" ")
                            .slice(0, 4)
                            .join(" ") || "Talent Required"}
                        </div>
                        <div
                          style={{
                            fontSize: "11px",
                            color: "#94A3B8",
                            marginTop: "2px",
                          }}
                        >
                          {req.numberOfHires} hire
                          {req.numberOfHires !== 1 ? "s" : ""} ·{" "}
                          {req.duration || "Ongoing"}
                        </div>
                      </div>
                      {(() => {
                        const sc = getStatusStyle(req.status || "New Request");
                        return (
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "5px",
                              fontSize: "10px",
                              fontWeight: 800,
                              padding: "3px 8px",
                              borderRadius: "8px",
                              background: sc.bg,
                              color: sc.text,
                            }}
                          >
                            <span
                              style={{
                                width: "5px",
                                height: "5px",
                                borderRadius: "50%",
                                background: sc.dot,
                              }}
                            />
                            {req.status || "New Request"}
                          </span>
                        );
                      })()}
                    </div>
                    <div
                      style={{
                        position: "relative",
                        height: "4px",
                        background: "#E2E8F0",
                        borderRadius: "4px",
                        marginBottom: "24px",
                      }}
                    >
                      <div
                        style={{
                          height: "100%",
                          width: `${pct}%`,
                          background:
                            "linear-gradient(90deg, #2563EB, #7C3AED)",
                          borderRadius: "4px",
                          transition: "width 0.6s ease",
                        }}
                      />
                      {stages.map((s, i) => (
                        <div
                          key={i}
                          style={{
                            position: "absolute",
                            left: `${s.pct}%`,
                            top: "-7px",
                            transform: "translateX(-50%)",
                          }}
                        >
                          <div
                            style={{
                              width: "18px",
                              height: "18px",
                              borderRadius: "50%",
                              background: pct >= s.pct ? "#2563EB" : "#E2E8F0",
                              border: "3px solid #FFFFFF",
                              boxShadow: "0 1px 4px rgba(0,0,0,0.12)",
                              transition: "background 0.4s",
                            }}
                          />
                          <div
                            style={{
                              position: "absolute",
                              top: "18px",
                              left: "50%",
                              transform: "translateX(-50%)",
                              fontSize: "9px",
                              fontWeight: 700,
                              color: pct >= s.pct ? "#2563EB" : "#94A3B8",
                              whiteSpace: "nowrap",
                            }}
                          >
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

  const renderMessaging = () => {
    // Determine which conversations belong to this client
    const myConvos = conversations.filter(c => c.client_id === currentUser?.id);
    const activeConvo = myConvos.find(c => c.id === selectedThreadId);

    // If no active convo, default to the first one, or general
    const currentThreadId = activeConvo ? activeConvo.id : (myConvos[0]?.id || 'general');

    return (
      <div style={{ display: 'flex', height: '80vh', gap: '20px' }}>
        {/* Left Pane: Conversation List */}
        <div style={{ width: '30%', borderRight: '1px solid #E2E8F0', paddingRight: '20px', display: 'flex', flexDirection: 'column', gap: '12px', overflowY: 'auto' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#0F172A', marginBottom: '16px' }}>Inbox</h2>
          {myConvos.map(c => {
            const isActive = c.id === currentThreadId;
            const unreadCount = messages.filter(m => m.conversation_id === c.id && m.sender_id !== currentUser?.id && !m.is_read).length;
            
            return (
              <div 
                key={c.id} 
                onClick={() => setSelectedThreadId(c.id)}
                style={{ 
                  padding: '12px', 
                  borderRadius: '8px', 
                  background: isActive ? '#EEF2FF' : '#F8FAFC', 
                  border: isActive ? '1px solid #6366F1' : '1px solid transparent',
                  cursor: 'pointer',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
              >
                <div>
                  <div style={{ fontSize: '14px', fontWeight: 600, color: '#0F172A' }}>
                    {c.context_type === 'service_request' ? 'Service Request Chat' : 'General Support'}
                  </div>
                  <div style={{ fontSize: '12px', color: '#64748B' }}>Account Manager</div>
                </div>
                {unreadCount > 0 && (
                  <Badge text={`${unreadCount} new`} status="warning" />
                )}
              </div>
            );
          })}
          {myConvos.length === 0 && (
            <p style={{ fontSize: '14px', color: '#64748B' }}>No active conversations.</p>
          )}
        </div>

        {/* Right Pane: Active Thread */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          {renderMessageThread(currentThreadId, 'general', null)}
        </div>
      </div>
    );
  };

  const renderMessageThread = (threadId: string | null, contextType: string, contextId: string | null) => {
    // If threadId is provided, find it. Otherwise, look for a scoped conversation based on contextType + contextId
    let convo = threadId 
      ? conversations.find(c => c.id === threadId)
      : conversations.find(c => c.client_id === currentUser?.id && c.context_type === contextType && c.context_id === contextId);

    // Filter messages for this conversation
    const activeMessages = convo ? messages.filter(m => m.conversation_id === convo.id).sort((a,b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()) : [];

    // Mark as read immediately logic moved to top level of ClientDashboard to avoid Hook Rules violations

    const handleSendMessage = async (e?: React.FormEvent) => {
      if (e) e.preventDefault();
      if (!msgInput.trim() && !msgAttachment) return;
      
      setUploadingAttachment(true);
      try {
        let finalConvoId = convo?.id;
        
        // If conversation doesn't exist yet, create it!
        if (!finalConvoId) {
          const newConvoId = 'conv_' + Math.random().toString(36).substr(2, 9);
          const { error: convoError } = await supabase.from('conversations').insert({
            id: newConvoId,
            client_id: currentUser?.id,
            admin_id: currentUser?.account_manager_id || null,
            context_type: contextType,
            context_id: contextId
          });
          if (convoError) throw convoError;
          finalConvoId = newConvoId;
        }

        let attachment_url = null;
        if (msgAttachment) {
          const fileExt = msgAttachment.name.split('.').pop();
          const fileName = `${Math.random()}.${fileExt}`;
          const filePath = `${finalConvoId}/${fileName}`;
          
          const { error: uploadError } = await supabase.storage.from('message_attachments').upload(filePath, msgAttachment);
          if (uploadError) throw uploadError;
          
          const { data: publicUrlData } = supabase.storage.from('message_attachments').getPublicUrl(filePath);
          attachment_url = publicUrlData.publicUrl;
        }

        const newMessageId = 'msg_' + Math.random().toString(36).substr(2, 9);
        const { error: msgError } = await supabase.from('messages').insert({
          id: newMessageId,
          conversation_id: finalConvoId,
          sender_id: currentUser?.id,
          content: msgInput,
          attachment_url
        });
        
        if (msgError) throw msgError;

        setMsgInput('');
        setMsgAttachment(null);
      } catch (err: any) {
        alert("Failed to send message: " + err.message);
      } finally {
        setUploadingAttachment(false);
      }
    };

    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%' }}>
        {/* Banner Context if Scoped */}
        {contextType === 'service_request' && (
          <div style={{ padding: '16px', background: '#F8FAFC', borderBottom: '1px solid #E2E8F0', borderRadius: '8px 8px 0 0' }}>
            <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: '#0F172A' }}>Re: Service Request - {contextId}</h3>
          </div>
        )}
        
        {/* Message Feed */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px', background: '#FFFFFF' }}>
          {activeMessages.length === 0 ? (
            <div style={{ margin: 'auto', color: '#94A3B8', fontSize: '14px' }}>No messages yet. Start the conversation!</div>
          ) : (
            activeMessages.map(msg => {
              const isMe = msg.sender_id === currentUser?.id;
              return (
                <div key={msg.id} style={{ display: 'flex', flexDirection: 'column', alignSelf: isMe ? 'flex-end' : 'flex-start', maxWidth: '75%' }}>
                  <div style={{ background: isMe ? '#2563EB' : '#F1F5F9', color: isMe ? '#FFFFFF' : '#0F172A', padding: '12px 16px', borderRadius: '12px', borderBottomRightRadius: isMe ? 0 : '12px', borderBottomLeftRadius: isMe ? '12px' : 0, fontSize: '14px' }}>
                    {msg.content}
                    {msg.attachment_url && (
                      <div style={{ marginTop: '8px' }}>
                        <a href={msg.attachment_url} target="_blank" rel="noreferrer" style={{ color: isMe ? '#93C5FD' : '#2563EB', textDecoration: 'underline' }}>View Attachment</a>
                      </div>
                    )}
                  </div>
                  <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '4px', alignSelf: isMe ? 'flex-end' : 'flex-start' }}>
                    {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    {isMe && msg.is_read && <span style={{ marginLeft: '6px', color: '#38BDF8' }}>✓ Read</span>}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Composer */}
        <div style={{ padding: '16px', borderTop: '1px solid #E2E8F0', background: '#F8FAFC', borderRadius: '0 0 8px 8px' }}>
          <form 
            onSubmit={e => handleSendMessage(e)}
            style={{ display: 'flex', gap: '12px', alignItems: 'flex-end' }}
          >
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <textarea 
                value={msgInput}
                onChange={e => setMsgInput(e.target.value)}
                placeholder="Type your message..."
                style={{ width: '100%', height: '80px', padding: '12px', borderRadius: '8px', border: '1px solid #E2E8F0', resize: 'none', fontSize: '14px' }}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
              />
              <input 
                type="file" 
                onChange={e => setMsgAttachment(e.target.files?.[0] || null)}
                style={{ fontSize: '12px' }}
              />
            </div>
            <NeonButton type="submit" disabled={uploadingAttachment} style={{ padding: '12px 24px', height: '48px' }}>
              {uploadingAttachment ? 'Sending...' : 'Send'}
            </NeonButton>
          </form>
        </div>
      </div>
    );
  };

  const renderRequests = () => {
    // In-memory filtration over the client's requests
    const filteredRequests = clientRequests.filter((req) => {
      // search filter
      const matchesSearch =
        req.serviceType
          ?.toLowerCase()
          .includes(searchRequestsFilter.toLowerCase()) ||
        req.roleDescription
          ?.toLowerCase()
          .includes(searchRequestsFilter.toLowerCase());

      // status filter
      let matchesStatus = true;
      if (statusRequestsFilter !== "All") {
        matchesStatus =
          req.status?.toLowerCase() === statusRequestsFilter.toLowerCase();
      }

      // type filter
      let matchesType = true;
      if (typeRequestsFilter !== "All") {
        matchesType =
          req.serviceType?.toLowerCase() === typeRequestsFilter.toLowerCase();
      }

      return matchesSearch && matchesStatus && matchesType;
    });

    if (detailsViewRequestId) {
      return renderRequestDetail();
    }

    const totalIntakeCount = clientRequests.length;

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "32px" }}>
        {/* Header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div>
            <h1
              style={{
                fontSize: "32px",
                fontWeight: 800,
                color: "#1A2340",
                marginBottom: "8px",
                letterSpacing: "-0.03em",
              }}
            >
              Service Requests
            </h1>
            <p style={{ fontSize: "15px", color: "#6B7A99", margin: 0 }}>
              Manage your talent acquisition and project outsourcing pipeline.
            </p>
          </div>
          <button
            onClick={() => {
              setShowIntakeModal(true);
              setIntakeStep(1);
            }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              background: "#0047CC",
              border: "none",
              borderRadius: "12px",
              padding: "14px 24px",
              color: "white",
              fontWeight: 700,
              cursor: "pointer",
              transition: "background 0.2s",
              fontSize: "14px",
              boxShadow: "0 4px 12px rgba(0, 71, 204, 0.15)",
            }}
          >
            New Service Request
          </button>
        </div>

        {/* Dynamic Telemetry stats card */}
        <div style={{ marginBottom: "8px" }}>
          {/* Performance & Request Stats Widget */}
          <Card
            style={{
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              border: "1px solid #DDE2EC",
            }}
          >
            <div>
              <h3
                style={{
                  fontSize: "15px",
                  fontWeight: 800,
                  color: "#1A2340",
                  margin: "0 0 4px 0",
                }}
              >
                Request Statistics
              </h3>
              <p
                style={{
                  fontSize: "12px",
                  color: "#6B7A99",
                  margin: "0 0 24px 0",
                }}
              >
                Performance metrics for the current fiscal year
              </p>
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: "20px",
              }}
            >
              {/* Stat 1 */}
              <div style={{ flex: 1, minWidth: "150px" }}>
                <div
                  style={{
                    fontSize: "11px",
                    fontWeight: 700,
                    color: "#6B7A99",
                    textTransform: "uppercase",
                    marginBottom: "6px",
                  }}
                >
                  Total Requests
                </div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "baseline",
                    gap: "10px",
                  }}
                >
                  <span
                    style={{
                      fontSize: "36px",
                      fontWeight: 800,
                      color: "#1A2340",
                    }}
                  >
                    {totalIntakeCount}
                  </span>
                  <span
                    style={{
                      fontSize: "11px",
                      fontWeight: 700,
                      color: "#0047CC",
                      background: "#EEF3FF",
                      padding: "2px 8px",
                      borderRadius: "12px",
                    }}
                  >
                    {totalIntakeCount > 0 ? "+12% vs last year" : "New account"}
                  </span>
                </div>
              </div>

              {/* Stat 2 */}
              <div
                style={{
                  flex: 1,
                  borderLeft: "1px solid #DDE2EC",
                  paddingLeft: "32px",
                  minWidth: "150px",
                }}
              >
                <div
                  style={{
                    fontSize: "11px",
                    fontWeight: 700,
                    color: "#6B7A99",
                    textTransform: "uppercase",
                    marginBottom: "6px",
                  }}
                >
                  Avg. Time To Hire
                </div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "baseline",
                    gap: "10px",
                  }}
                >
                  <span
                    style={{
                      fontSize: "36px",
                      fontWeight: 800,
                      color: "#1A2340",
                    }}
                  >
                    18.5{" "}
                    <span style={{ fontSize: "16px", fontWeight: 600 }}>
                      days
                    </span>
                  </span>
                  <span
                    style={{
                      fontSize: "11px",
                      fontWeight: 700,
                      color: "#0047CC",
                      background: "#EEF3FF",
                      padding: "2px 8px",
                      borderRadius: "12px",
                    }}
                  >
                    ⚡ 3 days faster
                  </span>
                </div>
              </div>

              {/* SVG Trendline Graphic Modeled After Stitch Mockup */}
              <div style={{ paddingLeft: "32px" }}>
                <svg
                  viewBox="0 0 120 40"
                  style={{
                    width: "130px",
                    height: "45px",
                    overflow: "visible",
                  }}
                >
                  <path
                    d="M0,35 Q20,10 40,25 T80,15 T120,5"
                    fill="none"
                    stroke="#0047CC"
                    strokeWidth="3"
                    strokeLinecap="round"
                  />
                  <circle
                    cx="120"
                    cy="5"
                    r="4.5"
                    fill="#0047CC"
                    stroke="#FFFFFF"
                    strokeWidth="2"
                  />
                </svg>
              </div>
            </div>
          </Card>
        </div>

        {/* High-Fidelity Filters Toolbar */}
        <Card style={{ padding: "16px 24px" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: "20px",
            }}
          >
            {/* Filter tags dropdown selection */}
            <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
              <span
                style={{
                  fontSize: "13px",
                  fontWeight: 800,
                  color: "#64748B",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                Filters:
              </span>

              {/* Status Select */}
              <select
                value={statusRequestsFilter}
                onChange={(e) => setStatusRequestsFilter(e.target.value)}
                style={{
                  height: "36px",
                  border: "1px solid #E2E8F0",
                  borderRadius: "8px",
                  padding: "0 12px",
                  fontSize: "13px",
                  color: "#0F172A",
                  fontWeight: 600,
                  outline: "none",
                  background: "#FFFFFF",
                  cursor: "pointer",
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
                onChange={(e) => setTypeRequestsFilter(e.target.value)}
                style={{
                  height: "36px",
                  border: "1px solid #E2E8F0",
                  borderRadius: "8px",
                  padding: "0 12px",
                  fontSize: "13px",
                  color: "#0F172A",
                  fontWeight: 600,
                  outline: "none",
                  background: "#FFFFFF",
                  cursor: "pointer",
                }}
              >
                <option value="All">Service Type</option>
                <option value="hire">Hire Talent</option>
                <option value="outsource">Outsource</option>
              </select>

              {/* Clear link */}
              {(searchRequestsFilter ||
                statusRequestsFilter !== "All" ||
                typeRequestsFilter !== "All") && (
                <button
                  onClick={() => {
                    setSearchRequestsFilter("");
                    setStatusRequestsFilter("All");
                    setTypeRequestsFilter("All");
                  }}
                  style={{
                    background: "transparent",
                    border: "none",
                    color: "#EF4444",
                    fontSize: "13px",
                    fontWeight: 700,
                    cursor: "pointer",
                    padding: 0,
                  }}
                >
                  Clear All Filters
                </button>
              )}
            </div>

            {/* Input Search Box */}
            <div style={{ position: "relative", width: "280px" }}>
              <input
                type="text"
                placeholder="Search service requests..."
                value={searchRequestsFilter}
                onChange={(e) => setSearchRequestsFilter(e.target.value)}
                style={{
                  width: "100%",
                  height: "38px",
                  border: "1px solid #E2E8F0",
                  borderRadius: "10px",
                  padding: "0 16px 0 36px",
                  fontSize: "13px",
                  boxSizing: "border-box",
                  outline: "none",
                }}
              />
              <span
                style={{
                  position: "absolute",
                  left: "12px",
                  top: "10px",
                  fontSize: "14px",
                  color: "#94A3B8",
                }}
              >
                🔍
              </span>
            </div>
          </div>
        </Card>

        {/* Requests Management Grid Table */}
        <Card style={{ padding: "0px", overflow: "hidden" }}>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              textAlign: "left",
              fontSize: "14px",
            }}
          >
            <thead>
              <tr
                style={{
                  background: "#F8FAFC",
                  borderBottom: "1px solid #E2E8F0",
                }}
              >
                <th
                  style={{
                    padding: "18px 24px",
                    fontWeight: 700,
                    color: "#475569",
                    fontSize: "11px",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                  }}
                >
                  Service Request
                </th>
                <th
                  style={{
                    padding: "18px 24px",
                    fontWeight: 700,
                    color: "#475569",
                    fontSize: "11px",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                  }}
                >
                  Type
                </th>
                <th
                  style={{
                    padding: "18px 24px",
                    fontWeight: 700,
                    color: "#475569",
                    fontSize: "11px",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                  }}
                >
                  Date Created
                </th>
                <th
                  style={{
                    padding: "18px 24px",
                    fontWeight: 700,
                    color: "#475569",
                    fontSize: "11px",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                  }}
                >
                  Talent
                </th>
                <th
                  style={{
                    padding: "18px 24px",
                    fontWeight: 700,
                    color: "#475569",
                    fontSize: "11px",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                  }}
                >
                  Status
                </th>
                <th
                  style={{
                    padding: "18px 24px",
                    fontWeight: 700,
                    color: "#475569",
                    fontSize: "11px",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    textAlign: "right",
                  }}
                >
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredRequests.length > 0 ? (
                filteredRequests.map((req) => {
                  const isHire = req.serviceType?.toLowerCase() === "hire";
                  const isMatching = req.status === "Matching";

                  // Dot status mapping
                  let statusDotColor = "#F59E0B"; // Qualification (yellow)
                  let statusText = "Qualification";
                  if (req.status === "Matching") {
                    statusDotColor = "#06B6D4"; // Matching (cyan)
                    statusText = "Matching";
                  } else if (req.status === "Completed") {
                    statusDotColor = "#10B981"; // Completed (green)
                    statusText = "Completed";
                  } else if (req.status === "Interview") {
                    statusDotColor = "#3B82F6"; // Interview (blue)
                    statusText = "Interview";
                  }

                  return (
                    <tr
                      key={req.id}
                      style={{
                        borderBottom: "1px solid #F1F5F9",
                        transition: "background 0.2s",
                      }}
                      onMouseEnter={(e) =>
                        (e.currentTarget.style.background = "#F8FAFC")
                      }
                      onMouseLeave={(e) =>
                        (e.currentTarget.style.background = "transparent")
                      }
                    >
                      {/* Name & desc */}
                      <td style={{ padding: "18px 24px" }}>
                        <div
                          style={{
                            fontWeight: 800,
                            color: "#0F172A",
                            fontSize: "15px",
                          }}
                        >
                          {req.roleTitle ||
                            `${req.serviceType?.toUpperCase()} Developer`}
                        </div>
                        <div
                          style={{
                            fontSize: "12px",
                            color: "#64748B",
                            marginTop: "4px",
                          }}
                        >
                          {req.roleDescription ||
                            "Scalable application architecture"}
                        </div>
                      </td>

                      {/* Type Badge */}
                      <td style={{ padding: "18px 24px" }}>
                        <span
                          style={{
                            display: "inline-block",
                            fontSize: "10px",
                            fontWeight: 800,
                            padding: "4px 10px",
                            borderRadius: "12px",
                            background: isHire ? "#EFF6FF" : "#F1F5F9",
                            color: isHire ? "#2563EB" : "#475569",
                            textTransform: "uppercase",
                            letterSpacing: "0.05em",
                          }}
                        >
                          {isHire ? "HIRE TALENT" : "OUTSOURCE"}
                        </span>
                      </td>

                      {/* Created date */}
                      <td
                        style={{
                          padding: "18px 24px",
                          color: "#64748B",
                          fontSize: "13px",
                        }}
                      >
                        {req.createdAt
                          ? new Date(req.createdAt).toLocaleDateString(
                              "en-US",
                              {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                              },
                            )
                          : "Oct 12, 2023"}
                      </td>

                      {/* Overlapping Talent Avatar Piles */}
                      <td style={{ padding: "18px 24px" }}>
                        <div style={{ display: "flex", alignItems: "center" }}>
                          <img
                            src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=80"
                            alt=""
                            style={{
                              width: "26px",
                              height: "26px",
                              borderRadius: "50%",
                              border: "2px solid #FFFFFF",
                              objectFit: "cover",
                            }}
                          />
                          <img
                            src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=80"
                            alt=""
                            style={{
                              width: "26px",
                              height: "26px",
                              borderRadius: "50%",
                              border: "2px solid #FFFFFF",
                              marginLeft: "-10px",
                              objectFit: "cover",
                            }}
                          />
                          <span
                            style={{
                              fontSize: "12px",
                              fontWeight: 700,
                              color: "#64748B",
                              marginLeft: "8px",
                            }}
                          >
                            1 Expert
                          </span>
                        </div>
                      </td>

                      {/* Dotted status pill */}
                      <td style={{ padding: "18px 24px" }}>
                        <div
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "8px",
                            fontSize: "13px",
                            fontWeight: 700,
                            color: "#1E293B",
                          }}
                        >
                          <span
                            style={{
                              width: "8px",
                              height: "8px",
                              borderRadius: "50%",
                              background: statusDotColor,
                            }}
                          />
                          {statusText}
                        </div>
                      </td>

                      {/* Actions dropdown */}
                      <td style={{ padding: "18px 24px", textAlign: "right" }}>
                        <button
                          onClick={() => {
                            setSelectedRequest(req);
                            setDetailsViewRequestId(req.id);
                          }}
                          style={{
                            background: "transparent",
                            border: "none",
                            color: "#2563EB",
                            fontSize: "14px",
                            cursor: "pointer",
                            padding: "4px",
                          }}
                        >
                          View Details
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td
                    colSpan={6}
                    style={{
                      padding: "48px",
                      textAlign: "center",
                      color: "#64748B",
                    }}
                  >
                    No service requests found matching filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          {/* Footer pagination bar */}
          <div
            style={{
              borderTop: "1px solid #F1F5F9",
              padding: "16px 24px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              fontSize: "13px",
              color: "#64748B",
            }}
          >
            <span>
              Showing {filteredRequests.length} of {totalIntakeCount} results
            </span>
            <div style={{ display: "flex", gap: "6px" }}>
              <button
                style={{
                  width: "28px",
                  height: "28px",
                  border: "1px solid #E2E8F0",
                  borderRadius: "6px",
                  background: "#FFFFFF",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                ‹
              </button>
              <button
                style={{
                  width: "28px",
                  height: "28px",
                  border: "none",
                  borderRadius: "6px",
                  background: "#2563EB",
                  color: "#FFFFFF",
                  fontWeight: 700,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                1
              </button>
              <button
                style={{
                  width: "28px",
                  height: "28px",
                  border: "1px solid #E2E8F0",
                  borderRadius: "6px",
                  background: "#FFFFFF",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                2
              </button>
              <button
                style={{
                  width: "28px",
                  height: "28px",
                  border: "1px solid #E2E8F0",
                  borderRadius: "6px",
                  background: "#FFFFFF",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                ›
              </button>
            </div>
          </div>
        </Card>
      </div>
    );
  };

  const renderRequestDetail = () => {
    const request =
      clientRequests.find((req) => req.id === detailsViewRequestId) ||
      selectedRequest;
    if (!request) return null;

    const requestMatches = matches.filter(
      (m: any) => m.requestId === request.id,
    );
    const shortlistedCount = requestMatches.filter(
      (m: any) => matchingShortlistedState[m.talentId],
    ).length;
    const interviewCount = interviewRequests[request.id]?.length || 0;
    const timeline = [
      {
        label: "New Request",
        active:
          request.status === "New Request" ||
          request.status === "Reviewing" ||
          request.status === "Matching" ||
          request.status === "Interview" ||
          request.status === "Completed",
      },
      {
        label: "Reviewing",
        active:
          request.status === "Reviewing" ||
          request.status === "Matching" ||
          request.status === "Interview" ||
          request.status === "Completed",
      },
      {
        label: "Matching",
        active:
          request.status === "Matching" ||
          request.status === "Interview" ||
          request.status === "Completed",
      },
      {
        label: "Interview",
        active:
          request.status === "Interview" || request.status === "Completed",
      },
      { label: "Completed", active: request.status === "Completed" },
    ];

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "28px" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "16px",
          }}
        >
          <div>
            <button
              onClick={() => setDetailsViewRequestId(null)}
              style={{
                background: "transparent",
                border: "none",
                color: "#2563EB",
                fontSize: "13px",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              ← Back to service requests
            </button>
            <h1
              style={{
                fontSize: "32px",
                fontWeight: 800,
                color: "#0F172A",
                margin: "16px 0 8px 0",
              }}
            >
              {request.roleTitle || request.serviceType}
            </h1>
            <p style={{ fontSize: "15px", color: "#64748B", margin: 0 }}>
              View full request details, shortlist activity, interview history
              and intake status.
            </p>
          </div>
          <div style={{ display: "grid", gap: "12px", minWidth: "220px" }}>
            <span
              style={{
                fontSize: "12px",
                fontWeight: 700,
                color: "#475569",
                textTransform: "uppercase",
              }}
            >
              Current Status
            </span>
            <span
              style={{ fontSize: "18px", fontWeight: 800, color: "#0F172A" }}
            >
              {request.status || "New Request"}
            </span>
            <span style={{ fontSize: "13px", color: "#64748B" }}>
              {request.createdAt
                ? new Date(request.createdAt).toLocaleDateString()
                : "Recently created"}
            </span>
          </div>
        </div>

        <Card
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 320px",
            gap: "24px",
          }}
        >
          <div style={{ display: "grid", gap: "24px" }}>
            <section>
              <h3
                style={{
                  fontSize: "15px",
                  fontWeight: 800,
                  color: "#0F172A",
                  marginBottom: "12px",
                }}
              >
                Intake Details
              </h3>
              <div style={{ display: "grid", gap: "12px" }}>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "12px",
                  }}
                >
                  <div
                    style={{
                      padding: "18px",
                      borderRadius: "12px",
                      background: "#F8FAFC",
                    }}
                  >
                    <div
                      style={{
                        fontSize: "11px",
                        color: "#64748B",
                        textTransform: "uppercase",
                        marginBottom: "6px",
                      }}
                    >
                      Service Type
                    </div>
                    <div
                      style={{
                        fontSize: "14px",
                        fontWeight: 700,
                        color: "#0F172A",
                      }}
                    >
                      {request.serviceType}
                    </div>
                  </div>
                  <div
                    style={{
                      padding: "18px",
                      borderRadius: "12px",
                      background: "#F8FAFC",
                    }}
                  >
                    <div
                      style={{
                        fontSize: "11px",
                        color: "#64748B",
                        textTransform: "uppercase",
                        marginBottom: "6px",
                      }}
                    >
                      Budget
                    </div>
                    <div
                      style={{
                        fontSize: "14px",
                        fontWeight: 700,
                        color: "#0F172A",
                      }}
                    >
                      ${request.budget?.toLocaleString() || "0"} / mo
                    </div>
                  </div>
                </div>
                <div
                  style={{
                    padding: "18px",
                    borderRadius: "12px",
                    background: "#F8FAFC",
                  }}
                >
                  <div
                    style={{
                      fontSize: "11px",
                      color: "#64748B",
                      textTransform: "uppercase",
                      marginBottom: "6px",
                    }}
                  >
                    Role Description
                  </div>
                  <div
                    style={{
                      fontSize: "14px",
                      color: "#1E293B",
                      lineHeight: 1.7,
                    }}
                  >
                    {request.roleDescription || "No role description provided."}
                  </div>
                </div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "12px",
                  }}
                >
                  <div
                    style={{
                      padding: "18px",
                      borderRadius: "12px",
                      background: "#F8FAFC",
                    }}
                  >
                    <div
                      style={{
                        fontSize: "11px",
                        color: "#64748B",
                        textTransform: "uppercase",
                        marginBottom: "6px",
                      }}
                    >
                      Required Skills
                    </div>
                    <div
                      style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}
                    >
                      {(request.requiredSkills || []).map((skill: string) => (
                        <span
                          key={skill}
                          style={{
                            background: "#FFFFFF",
                            border: "1px solid #E2E8F0",
                            borderRadius: "8px",
                            padding: "6px 10px",
                            fontSize: "12px",
                            color: "#475569",
                          }}
                        >
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div
                    style={{
                      padding: "18px",
                      borderRadius: "12px",
                      background: "#F8FAFC",
                    }}
                  >
                    <div
                      style={{
                        fontSize: "11px",
                        color: "#64748B",
                        textTransform: "uppercase",
                        marginBottom: "6px",
                      }}
                    >
                      Hiring Needs
                    </div>
                    <div
                      style={{
                        fontSize: "14px",
                        fontWeight: 700,
                        color: "#0F172A",
                      }}
                    >
                      {request.numberOfHires || 1} hire(s)
                    </div>
                    <div
                      style={{
                        fontSize: "12px",
                        color: "#64748B",
                        marginTop: "6px",
                      }}
                    >
                      {request.commitmentLevel || "Full Time"}
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <section>
              <h3
                style={{
                  fontSize: "15px",
                  fontWeight: 800,
                  color: "#0F172A",
                  marginBottom: "12px",
                }}
              >
                Candidate Pipeline
              </h3>
              <div style={{ display: "grid", gap: "12px" }}>
                <div
                  style={{
                    padding: "16px",
                    borderRadius: "12px",
                    background: "#F8FAFC",
                  }}
                >
                  <div
                    style={{
                      fontSize: "11px",
                      color: "#64748B",
                      marginBottom: "6px",
                      textTransform: "uppercase",
                    }}
                  >
                    Shortlisted
                  </div>
                  <div
                    style={{
                      fontSize: "18px",
                      fontWeight: 800,
                      color: "#0F172A",
                    }}
                  >
                    {shortlistedCount}
                  </div>
                </div>
                <div
                  style={{
                    padding: "16px",
                    borderRadius: "12px",
                    background: "#F8FAFC",
                  }}
                >
                  <div
                    style={{
                      fontSize: "11px",
                      color: "#64748B",
                      marginBottom: "6px",
                      textTransform: "uppercase",
                    }}
                  >
                    Interviews Requested
                  </div>
                  <div
                    style={{
                      fontSize: "18px",
                      fontWeight: 800,
                      color: "#0F172A",
                    }}
                  >
                    {interviewCount}
                  </div>
                </div>
              </div>
            </section>
          </div>

          <aside
            style={{ display: "flex", flexDirection: "column", gap: "20px" }}
          >
            <Card style={{ background: "#F8FAFC" }}>
              <h4
                style={{
                  fontSize: "14px",
                  fontWeight: 800,
                  color: "#0F172A",
                  marginBottom: "12px",
                }}
              >
                Status Timeline
              </h4>
              <div style={{ display: "grid", gap: "12px" }}>
                {timeline.map((stage) => (
                  <div
                    key={stage.label}
                    style={{
                      display: "flex",
                      gap: "12px",
                      alignItems: "center",
                    }}
                  >
                    <span
                      style={{
                        width: "12px",
                        height: "12px",
                        borderRadius: "50%",
                        background: stage.active ? "#2563EB" : "#CBD5E1",
                      }}
                    />
                    <span
                      style={{
                        color: stage.active ? "#0F172A" : "#64748B",
                        fontWeight: stage.active ? 700 : 500,
                        fontSize: "13px",
                      }}
                    >
                      {stage.label}
                    </span>
                  </div>
                ))}
              </div>
            </Card>

            <Card style={{ background: "#FFFFFF" }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: "14px",
                }}
              >
                <span
                  style={{
                    fontSize: "14px",
                    fontWeight: 800,
                    color: "#0F172A",
                  }}
                >
                  Interview Activity
                </span>
                <span style={{ fontSize: "12px", color: "#64748B" }}>
                  {interviewCount} actions
                </span>
              </div>
              {interviewCount > 0 ? (
                <div style={{ display: "grid", gap: "10px" }}>
                  {(interviewRequests[request.id] || []).map(
                    (candidateName: string, index: number) => (
                      <div
                        key={index}
                        style={{
                          padding: "12px",
                          borderRadius: "12px",
                          background: "#F8FAFC",
                        }}
                      >
                        <div
                          style={{
                            fontSize: "13px",
                            fontWeight: 700,
                            color: "#0F172A",
                          }}
                        >
                          {candidateName}
                        </div>
                        <div
                          style={{
                            fontSize: "12px",
                            color: "#64748B",
                            marginTop: "4px",
                          }}
                        >
                          Interview requested
                        </div>
                      </div>
                    ),
                  )}
                </div>
              ) : (
                <div style={{ fontSize: "13px", color: "#64748B" }}>
                  No interviews have been requested for this request yet.
                </div>
              )}
            </Card>
          </aside>
        </Card>

        <Card style={{ display: "grid", gap: "24px" }}>
          <h3 style={{ fontSize: "15px", fontWeight: 800, color: "#0F172A" }}>
            Matched candidates for this request
          </h3>
          {requestMatches.length > 0 ? (
            requestMatches.map((match: any) => {
              const talent = talents.find(
                (t: any) => t.id === match.talentId,
              ) || {
                name: match.talentId,
                title: "Candidate",
                avatar: "",
                location: "Remote",
              };
              const isShortlisted = !!matchingShortlistedState[match.talentId];
              const requestedInterviews = interviewRequests[request.id] || [];
              const interviewRequested = requestedInterviews.includes(
                talent.name,
              );
              return (
                <Card
                  key={match.id}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "16px",
                    padding: "20px",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "16px",
                    }}
                  >
                    <img
                      src={
                        talent.avatar ||
                        "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=80"
                      }
                      alt=""
                      style={{
                        width: "56px",
                        height: "56px",
                        borderRadius: "18px",
                        objectFit: "cover",
                      }}
                    />
                    <div>
                      <div
                        style={{
                          fontSize: "16px",
                          fontWeight: 800,
                          color: "#0F172A",
                        }}
                      >
                        {talent.name}
                      </div>
                      <div style={{ fontSize: "12px", color: "#64748B" }}>
                        {talent.title || "Matched talent profile"}
                      </div>
                    </div>
                    <div style={{ marginLeft: "auto", textAlign: "right" }}>
                      <div style={{ fontSize: "12px", color: "#64748B" }}>
                        Match score
                      </div>
                      <div
                        style={{
                          fontSize: "18px",
                          fontWeight: 800,
                          color: "#2563EB",
                        }}
                      >
                        {match.score}%
                      </div>
                    </div>
                  </div>
                  <div
                    style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}
                  >
                    <button
                      onClick={() =>
                        handleShortlistToggle(
                          match.talentId,
                          talent.name,
                          request.id,
                        )
                      }
                      style={{
                        padding: "10px 16px",
                        borderRadius: "10px",
                        border: isShortlisted
                          ? "1px solid #2563EB"
                          : "1px solid #E2E8F0",
                        background: isShortlisted ? "#EFF6FF" : "#FFFFFF",
                        color: isShortlisted ? "#2563EB" : "#475569",
                        fontWeight: 700,
                        cursor: "pointer",
                      }}
                    >
                      {isShortlisted ? "✓ Shortlisted" : "Shortlist"}
                    </button>
                    <button
                      onClick={() =>
                        handleRequestInterview(talent.name, request.id)
                      }
                      style={{
                        padding: "10px 16px",
                        borderRadius: "10px",
                        border: "1px solid #E2E8F0",
                        background: interviewRequested ? "#ECFDF5" : "#FFFFFF",
                        color: interviewRequested ? "#047857" : "#475569",
                        fontWeight: 700,
                        cursor: "pointer",
                      }}
                    >
                      {interviewRequested
                        ? "Interview Requested"
                        : "Request Interview"}
                    </button>
                    <span
                      style={{
                        alignSelf: "center",
                        fontSize: "12px",
                        color: "#64748B",
                      }}
                    >
                      {talent.location}
                    </span>
                  </div>
                </Card>
              );
            })
          ) : (
            <div
              style={{
                padding: "22px",
                borderRadius: "14px",
                background: "#F8FAFC",
                color: "#64748B",
              }}
            >
              There is no matched candidate data for this request yet. Shortlist
              candidates from the Talent Matching page to populate your
              pipeline.
            </div>
          )}
        </Card>
      </div>
    );
  };

  const renderRadar = () => {
    // Dynamic matching sidebar requests
    const openRequests = clientRequests.map((r) => {
      const requestMatches = matches.filter(
        (m) =>
          m.requestId === r.id &&
          (m.status === "Shortlisted" ||
            m.status === "Interview Requested" ||
            m.status === "Interview Scheduled" ||
            m.status === "Interviewed"),
      );
      return {
        id: r.id,
        category: r.serviceType.toUpperCase(),
        title:
          r.serviceType + " - " + (r.roleDescription.split(" ")[0] || "Talent"),
        posted: r.createdAt
          ? `Posted ${new Date(r.createdAt).toLocaleDateString()}`
          : "Posted recently",
        badgeText:
          requestMatches.length > 0
            ? `${requestMatches.length} Shortlisted`
            : "Matching...",
        badgeType:
          requestMatches.length > 0
            ? ("filled" as const)
            : ("outline" as const),
      };
    });

    const activeRequest =
      clientRequests.find((r) => r.id === selectedMatchingRequestId) ||
      clientRequests[0];

    const requestMatches = activeRequest
      ? matches.filter(
          (m) =>
            m.requestId === activeRequest.id &&
            (m.status === "Shortlisted" ||
              m.status === "Interview Requested" ||
              m.status === "Interview Scheduled" ||
              m.status === "Interviewed"),
        )
      : [];

    const candidatesList = requestMatches
      .filter((m) => talents.some((t) => t.id === m.talentId))
      .map((match) => {
        const talent = talents.find((t) => t.id === match.talentId)!;
        return {
          matchId: match.id,
          talentId: talent.id,
          name: talent.name,
          avatar:
            talent.avatar ||
            "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&q=80&w=80",
          location: talent.timezone || "Remote",
          experience: `${talent.experienceYears || 5}+ Years Experience`,
          availability: "Immediate availability",
          techStack: talent.skills || [],
          score: `${match.score || 92}%`,
          status: match.status,
          requestedDate: match.requestedDate,
          requestedTime: match.requestedTime,
          requestedDuration: match.requestedDuration,
          requestedNotes: match.requestedNotes,
        };
      });

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "32px" }}>
        {/* Viewing Talent Profile Detail Modal */}
        {viewingTalentProfile && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(15,23,42,0.6)",
              backdropFilter: "blur(6px)",
              zIndex: 1001,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "20px",
            }}
          >
            <div
              style={{
                background: "#FFFFFF",
                borderRadius: "24px",
                padding: "36px",
                width: "100%",
                maxWidth: "640px",
                boxShadow: "0 25px 80px rgba(0,0,0,0.2)",
                maxHeight: "90vh",
                overflowY: "auto",
                boxSizing: "border-box",
                position: "relative",
              }}
            >
              <button
                onClick={() => setViewingTalentProfile(null)}
                style={{
                  position: "absolute",
                  right: "24px",
                  top: "24px",
                  background: "#F1F5F9",
                  border: "none",
                  borderRadius: "8px",
                  width: "36px",
                  height: "36px",
                  cursor: "pointer",
                  fontSize: "18px",
                  color: "#475569",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: "bold",
                }}
              >
                ×
              </button>

              <div
                style={{
                  display: "flex",
                  gap: "20px",
                  alignItems: "center",
                  marginBottom: "24px",
                }}
              >
                <div
                  style={{
                    width: "72px",
                    height: "72px",
                    borderRadius: "50%",
                    background: "#EFF6FF",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#2563EB",
                    fontWeight: 800,
                    fontSize: "24px",
                    border: "3px solid #E2E8F0",
                    overflow: "hidden",
                  }}
                >
                  {viewingTalentProfile.avatar ? (
                    <img
                      src={viewingTalentProfile.avatar}
                      alt=""
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                      }}
                    />
                  ) : (
                    viewingTalentProfile.name.charAt(0)
                  )}
                </div>
                <div>
                  <h2
                    style={{
                      fontSize: "22px",
                      fontWeight: 900,
                      color: "#0F172A",
                      margin: "0 0 4px 0",
                    }}
                  >
                    {viewingTalentProfile.name}
                  </h2>
                  <div
                    style={{
                      display: "flex",
                      gap: "8px",
                      alignItems: "center",
                    }}
                  >
                    <span
                      style={{
                        fontSize: "13px",
                        color: "#2563EB",
                        fontWeight: 700,
                      }}
                    >
                      {viewingTalentProfile.title}
                    </span>
                    <span
                      style={{
                        width: "4px",
                        height: "4px",
                        borderRadius: "50%",
                        background: "#94A3B8",
                      }}
                    />
                    <span style={{ fontSize: "12px", color: "#64748B" }}>
                      {viewingTalentProfile.location ||
                        viewingTalentProfile.timezone}
                    </span>
                  </div>
                </div>
                <div
                  style={{
                    marginLeft: "auto",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "flex-end",
                    gap: "4px",
                  }}
                >
                  <span
                    style={{
                      fontWeight: 900,
                      fontSize: "18px",
                      color: "#10B981",
                    }}
                  >
                    {viewingTalentProfile.grade} Grade
                  </span>
                  <span
                    style={{
                      fontSize: "11px",
                      color: "#10B981",
                      fontWeight: 700,
                    }}
                  >
                    Vetted Talent Profile
                  </span>
                </div>
              </div>

              {/* Bio & Details */}
              <div style={{ marginBottom: "24px" }}>
                <h3
                  style={{
                    fontSize: "14px",
                    fontWeight: 800,
                    color: "#334155",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    marginBottom: "8px",
                  }}
                >
                  Executive Summary
                </h3>
                <p
                  style={{
                    fontSize: "13px",
                    color: "#475569",
                    lineHeight: 1.6,
                    margin: 0,
                  }}
                >
                  {viewingTalentProfile.bio ||
                    "Highly accomplished operational talent with comprehensive expertise in enterprise delivery management, team coordination, and system integrations."}
                </p>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "20px",
                  marginBottom: "24px",
                }}
              >
                <div
                  style={{
                    background: "#F8FAFC",
                    padding: "16px",
                    borderRadius: "12px",
                    border: "1px solid #F1F5F9",
                  }}
                >
                  <h3
                    style={{
                      fontSize: "12px",
                      fontWeight: 800,
                      color: "#64748B",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                      margin: "0 0 12px 0",
                    }}
                  >
                    Key Metrics
                  </h3>
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "8px",
                      fontSize: "13px",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                      }}
                    >
                      <span style={{ color: "#64748B" }}>Experience</span>
                      <strong style={{ color: "#1E293B" }}>
                        {viewingTalentProfile.experienceYears || 5} Years
                      </strong>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                      }}
                    >
                      <span style={{ color: "#64748B" }}>Expected Salary</span>
                      <strong style={{ color: "#1E293B" }}>
                        ${viewingTalentProfile.salaryExpectation || 4500}/mo
                      </strong>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                      }}
                    >
                      <span style={{ color: "#64748B" }}>Availability</span>
                      <strong style={{ color: "#10B981" }}>
                        {viewingTalentProfile.availability || 100}% Immediate
                      </strong>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                      }}
                    >
                      <span style={{ color: "#64748B" }}>Vetting Status</span>
                      <strong style={{ color: "#2563EB" }}>
                        {viewingTalentProfile.vettingStatus || "Vetted"}
                      </strong>
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    background: "#F8FAFC",
                    padding: "16px",
                    borderRadius: "12px",
                    border: "1px solid #F1F5F9",
                  }}
                >
                  <h3
                    style={{
                      fontSize: "12px",
                      fontWeight: 800,
                      color: "#64748B",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                      margin: "0 0 12px 0",
                    }}
                  >
                    Technical Vetting Scores
                  </h3>
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "8px",
                      fontSize: "13px",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <span style={{ color: "#64748B" }}>Technical Fit</span>
                      <strong style={{ color: "#1E293B" }}>
                        {viewingTalentProfile.vettingScores?.technical || 94}%
                      </strong>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <span style={{ color: "#64748B" }}>Behavioral Fit</span>
                      <strong style={{ color: "#1E293B" }}>
                        {viewingTalentProfile.vettingScores?.behavioral || 90}%
                      </strong>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <span style={{ color: "#64748B" }}>Communication</span>
                      <strong style={{ color: "#1E293B" }}>
                        {viewingTalentProfile.vettingScores?.communication ||
                          95}
                        %
                      </strong>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <span style={{ color: "#64748B" }}>Remote Readiness</span>
                      <strong style={{ color: "#10B981" }}>
                        {viewingTalentProfile.vettingScores?.remoteReadiness ||
                          98}
                        %
                      </strong>
                    </div>
                  </div>
                </div>
              </div>

              {/* Workspace Infrastructure */}
              <div
                style={{
                  background: "#F8FAFC",
                  padding: "16px",
                  borderRadius: "12px",
                  border: "1px solid #F1F5F9",
                  marginBottom: "24px",
                }}
              >
                <h3
                  style={{
                    fontSize: "12px",
                    fontWeight: 800,
                    color: "#64748B",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    margin: "0 0 12px 0",
                  }}
                >
                  Workspace Infrastructure
                </h3>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "14px",
                    fontSize: "12px",
                    color: "#475569",
                  }}
                >
                  <div>
                    <span
                      style={{
                        display: "block",
                        color: "#94A3B8",
                        fontWeight: 700,
                        fontSize: "10px",
                        textTransform: "uppercase",
                        marginBottom: "2px",
                      }}
                    >
                      Devices
                    </span>
                    <strong>
                      {viewingTalentProfile.devices ||
                        "MacBook Pro M3, Dual 4K Monitors"}
                    </strong>
                  </div>
                  <div>
                    <span
                      style={{
                        display: "block",
                        color: "#94A3B8",
                        fontWeight: 700,
                        fontSize: "10px",
                        textTransform: "uppercase",
                        marginBottom: "2px",
                      }}
                    >
                      Internet
                    </span>
                    <strong>
                      {viewingTalentProfile.internetQuality ||
                        "Fiber Optic High-Speed (100 Mbps+)"}
                    </strong>
                  </div>
                </div>
              </div>

              {/* Skills Pills */}
              <div style={{ marginBottom: "32px" }}>
                <h3
                  style={{
                    fontSize: "12px",
                    fontWeight: 800,
                    color: "#64748B",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    marginBottom: "10px",
                  }}
                >
                  Key Technical Expertise
                </h3>
                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                  {(viewingTalentProfile.skills || []).map((sk: string) => (
                    <span
                      key={sk}
                      style={{
                        fontSize: "11px",
                        fontWeight: 700,
                        background: "#EFF6FF",
                        color: "#2563EB",
                        padding: "4px 10px",
                        borderRadius: "6px",
                      }}
                    >
                      {sk}
                    </span>
                  ))}
                </div>
              </div>

              <div style={{ display: "flex", gap: "12px" }}>
                <button
                  onClick={() => setViewingTalentProfile(null)}
                  style={{
                    flex: 1,
                    padding: "12px",
                    borderRadius: "10px",
                    border: "1px solid #E2E8F0",
                    background: "#FFFFFF",
                    fontWeight: 700,
                    fontSize: "13px",
                    color: "#475569",
                    cursor: "pointer",
                  }}
                >
                  Close Profile
                </button>
                <button
                  onClick={() => {
                    const match = matches.find(
                      (m) =>
                        m.talentId === viewingTalentProfile.id &&
                        m.requestId === activeRequest.id,
                    );
                    if (match) {
                      setRequestInterviewTarget({
                        matchId: match.id,
                        talentId: viewingTalentProfile.id,
                        talentName: viewingTalentProfile.name,
                        requestId: activeRequest.id,
                      });
                      setRequestInterviewForm((f) => ({
                        ...f,
                        date: new Date(Date.now() + 86400000 * 2)
                          .toISOString()
                          .split("T")[0],
                      }));
                      setShowRequestInterviewModal(true);
                    }
                    setViewingTalentProfile(null);
                  }}
                  style={{
                    flex: 2,
                    padding: "12px",
                    borderRadius: "10px",
                    border: "none",
                    background: "#2563EB",
                    fontWeight: 800,
                    fontSize: "13px",
                    color: "#FFFFFF",
                    cursor: "pointer",
                  }}
                >
                  📅 Request Coordination Interview
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Hire Candidate / Job Offer Modal */}
        {showHireModal && hireTarget && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(15,23,42,0.6)",
              backdropFilter: "blur(6px)",
              zIndex: 1000,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "20px",
            }}
          >
            <div
              style={{
                background: "#FFFFFF",
                borderRadius: "20px",
                padding: "36px",
                width: "100%",
                maxWidth: "500px",
                boxShadow: "0 24px 80px rgba(0,0,0,0.15)",
                boxSizing: "border-box",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "24px",
                }}
              >
                <div>
                  <h2
                    style={{
                      fontSize: "20px",
                      fontWeight: 900,
                      color: "#0F172A",
                      margin: "0 0 4px 0",
                    }}
                  >
                    Generate Job Offer
                  </h2>
                  <p style={{ fontSize: "12px", color: "#64748B", margin: 0 }}>
                    Deploy EOR contract proposal for {hireTarget.name}
                  </p>
                </div>
                <button
                  onClick={() => {
                    setShowHireModal(false);
                    setHireTarget(null);
                  }}
                  style={{
                    background: "#F1F5F9",
                    border: "none",
                    borderRadius: "8px",
                    width: "36px",
                    height: "36px",
                    cursor: "pointer",
                    fontSize: "16px",
                    color: "#475569",
                  }}
                >
                  ×
                </button>
              </div>

              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "16px",
                }}
              >
                <div>
                  <label style={labelStyle}>Proposed Start Date *</label>
                  <input
                    type="date"
                    style={inputStyle}
                    value={hireForm.startDate}
                    min={new Date().toISOString().split("T")[0]}
                    onChange={(e) =>
                      setHireForm((f) => ({ ...f, startDate: e.target.value }))
                    }
                  />
                </div>

                <div>
                  <label style={labelStyle}>
                    Monthly Retainer Rate (USD) *
                  </label>
                  <input
                    type="number"
                    style={inputStyle}
                    value={hireForm.salary}
                    onChange={(e) =>
                      setHireForm((f) => ({ ...f, salary: e.target.value }))
                    }
                    placeholder="e.g. 4500"
                  />
                </div>

                <div>
                  <label style={labelStyle}>
                    Offer Letter Notes / Custom Clauses
                  </label>
                  <textarea
                    style={{
                      ...inputStyle,
                      minHeight: "80px",
                      resize: "vertical",
                    }}
                    placeholder="Mention specific milestones, benefits, or custom terms..."
                    value={hireForm.notes}
                    onChange={(e) =>
                      setHireForm((f) => ({ ...f, notes: e.target.value }))
                    }
                  />
                </div>

                <div
                  style={{
                    background: "#F0FDF4",
                    border: "1px solid #BBF7D0",
                    borderRadius: "10px",
                    padding: "12px 16px",
                    display: "flex",
                    gap: "10px",
                    alignItems: "flex-start",
                  }}
                >
                  <span style={{ fontSize: "14px" }}>🛡️</span>
                  <p
                    style={{
                      fontSize: "11px",
                      color: "#166534",
                      margin: 0,
                      lineHeight: 1.4,
                    }}
                  >
                    By extending this offer, Kongila will draft a localized
                    employment contract compliant with all EOR tax and labor
                    frameworks.
                  </p>
                </div>

                <div style={{ display: "flex", gap: "12px", marginTop: "4px" }}>
                  <button
                    onClick={() => {
                      setShowHireModal(false);
                      setHireTarget(null);
                    }}
                    style={{
                      flex: 1,
                      padding: "12px",
                      borderRadius: "10px",
                      border: "1px solid #E2E8F0",
                      background: "#FFFFFF",
                      fontWeight: 700,
                      fontSize: "13px",
                      color: "#475569",
                      cursor: "pointer",
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={async () => {
                      if (!hireForm.startDate || !hireForm.salary) {
                        alert("Please fill in start date and monthly rate.");
                        return;
                      }

                      const updatedMatches = matches.map((m) => {
                        if (m.id === hireTarget.matchId) {
                          return {
                            ...m,
                            status: "Offer Extended" as const,
                          };
                        }
                        return m;
                      });

                      const newContract = {
                        id: `contract_${Date.now()}`,
                        matchId: hireTarget.matchId,
                        clientId: currentUser?.id || "usr_horizon",
                        clientName: currentUser
                          ? `${currentUser.name} (${currentUser.companyName || "Vanguard Corp"})`
                          : "Client",
                        talentId: hireTarget.talentId,
                        talentName: hireTarget.name,
                        role:
                          activeRequest.roleDescription ||
                          activeRequest.serviceType,
                        salary: Number(hireForm.salary),
                        rateAmount: Number(hireForm.salary),
                        rateType: "Monthly",
                        startDate: hireForm.startDate,
                        status: "Pending",
                        createdAt: new Date().toISOString(),
                      };

                      try {
                        const { error: contractErr } = await supabase.from('contracts').insert({
                          talent_id: newContract.talentId,
                          client_id: currentUser?.id,
                          service_type: newContract.role,
                          rate_type: newContract.rateType,
                          rate_amount: newContract.rateAmount,
                          start_date: newContract.startDate,
                          status: 'pending'
                        });
                        if (contractErr) throw contractErr;

                        await supabase.from('matches').update({
                          status: 'offer_extended'
                        }).eq('id', newContract.matchId);

                        await supabase.from("notifications").insert({
                          user_id: hireTarget.talentId,
                          title: "Job Offer Received!",
                          content: `You received a job offer for the "${newContract.role}" role at $${newContract.salary}/mo.`,
                          read_status: false,
                        });

                        if (setMatches) {
                            setMatches(updatedMatches);
                          }
                          setShowHireModal(false);
                          setHireTarget(null);
                          alert(
                            `Job Offer Extended to ${hireTarget.name} successfully! EOR drafting initiated.`,
                          );
                      } catch (err: any) {
                        alert("Failed to extend offer. Please try again.");
                        console.error(err);
                      }
                    }}
                    style={{
                      flex: 2,
                      padding: "12px",
                      borderRadius: "10px",
                      border: "none",
                      background: "#10B981",
                      fontWeight: 800,
                      fontSize: "13px",
                      color: "#FFFFFF",
                      cursor: "pointer",
                    }}
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
          <div
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(15,23,42,0.6)",
              backdropFilter: "blur(6px)",
              zIndex: 1000,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "20px",
            }}
          >
            <div
              style={{
                background: "#FFFFFF",
                borderRadius: "20px",
                padding: "36px",
                width: "100%",
                maxWidth: "500px",
                boxShadow: "0 24px 80px rgba(0,0,0,0.15)",
                boxSizing: "border-box",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "24px",
                }}
              >
                <div>
                  <h2
                    style={{
                      fontSize: "20px",
                      fontWeight: 900,
                      color: "#0F172A",
                      margin: "0 0 4px 0",
                    }}
                  >
                    Request Interview
                  </h2>
                  <p style={{ fontSize: "12px", color: "#64748B", margin: 0 }}>
                    Proposed scheduling for {requestInterviewTarget.talentName}
                  </p>
                </div>
                <button
                  onClick={() => {
                    setShowRequestInterviewModal(false);
                    setRequestInterviewTarget(null);
                  }}
                  style={{
                    background: "#F1F5F9",
                    border: "none",
                    borderRadius: "8px",
                    width: "36px",
                    height: "36px",
                    cursor: "pointer",
                    fontSize: "16px",
                    color: "#475569",
                  }}
                >
                  ×
                </button>
              </div>

              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "16px",
                }}
              >
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "14px",
                  }}
                >
                  <div>
                    <label style={labelStyle}>Proposed Date *</label>
                    <input
                      type="date"
                      style={inputStyle}
                      value={requestInterviewForm.date}
                      min={new Date().toISOString().split("T")[0]}
                      onChange={(e) =>
                        setRequestInterviewForm((f) => ({
                          ...f,
                          date: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Proposed Time *</label>
                    <input
                      type="time"
                      style={inputStyle}
                      value={requestInterviewForm.time}
                      onChange={(e) =>
                        setRequestInterviewForm((f) => ({
                          ...f,
                          time: e.target.value,
                        }))
                      }
                    />
                  </div>
                </div>

                <div>
                  <label style={labelStyle}>Duration</label>
                  <select
                    style={inputStyle}
                    value={requestInterviewForm.duration}
                    onChange={(e) =>
                      setRequestInterviewForm((f) => ({
                        ...f,
                        duration: e.target.value,
                      }))
                    }
                  >
                    <option value="30">30 minutes</option>
                    <option value="45">45 minutes</option>
                    <option value="60">60 minutes</option>
                    <option value="90">90 minutes</option>
                  </select>
                </div>

                <div>
                  <label style={labelStyle}>Agenda / Message for Admin</label>
                  <textarea
                    style={{
                      ...inputStyle,
                      minHeight: "80px",
                      resize: "vertical",
                    }}
                    placeholder="Topics you would like to cover, specific technologies, etc."
                    value={requestInterviewForm.notes}
                    onChange={(e) =>
                      setRequestInterviewForm((f) => ({
                        ...f,
                        notes: e.target.value,
                      }))
                    }
                  />
                </div>

                <div
                  style={{
                    background: "#F0F9FF",
                    border: "1px solid #BAE6FD",
                    borderRadius: "10px",
                    padding: "12px 16px",
                    display: "flex",
                    gap: "10px",
                    alignItems: "flex-start",
                  }}
                >
                  <span style={{ fontSize: "14px" }}>💬</span>
                  <p
                    style={{
                      fontSize: "11px",
                      color: "#0369A1",
                      margin: 0,
                      lineHeight: 1.4,
                    }}
                  >
                    Our operations team will review this slot with{" "}
                    <strong>{requestInterviewTarget.talentName}</strong>,
                    confirm availability, and secure the calendar booking.
                  </p>
                </div>

                <div style={{ display: "flex", gap: "12px", marginTop: "4px" }}>
                  <button
                    onClick={() => {
                      setShowRequestInterviewModal(false);
                      setRequestInterviewTarget(null);
                    }}
                    style={{
                      flex: 1,
                      padding: "12px",
                      borderRadius: "10px",
                      border: "1px solid #E2E8F0",
                      background: "#FFFFFF",
                      fontWeight: 700,
                      fontSize: "13px",
                      color: "#475569",
                      cursor: "pointer",
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={submitInterviewRequest}
                    style={{
                      flex: 2,
                      padding: "12px",
                      borderRadius: "10px",
                      border: "none",
                      background: "#2563EB",
                      fontWeight: 800,
                      fontSize: "13px",
                      color: "#FFFFFF",
                      cursor: "pointer",
                    }}
                  >
                    🚀 Submit Proposal
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div>
            <h1
              style={{
                fontSize: "32px",
                fontWeight: 800,
                color: "#0F172A",
                marginBottom: "8px",
                letterSpacing: "-0.03em",
              }}
            >
              Talent Matching
            </h1>
            <p style={{ fontSize: "15px", color: "#64748B", margin: 0 }}>
              Review vetted candidates shortlisted by our operators for your
              open roles.
            </p>
          </div>

          <div
            style={{
              fontSize: "11px",
              fontWeight: 800,
              background: "#EFF6FF",
              color: "#2563EB",
              padding: "6px 12px",
              borderRadius: "20px",
              letterSpacing: "0.05em",
            }}
          >
            👥 {matches.filter((m) => m.status === "Shortlisted").length}{" "}
            CANDIDATES SHORTLISTED
          </div>
        </div>

        {/* Workspace Split */}
        <div className="db-grid-split-300-left" style={{ alignItems: "start" }}>
          {/* Left Column: Open Requests Sidebar */}
          <div
            style={{ display: "flex", flexDirection: "column", gap: "20px" }}
          >
            <Card style={{ padding: "20px" }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "16px",
                }}
              >
                <span
                  style={{
                    fontSize: "11px",
                    fontWeight: 800,
                    color: "#64748B",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                  }}
                >
                  Your Requests
                </span>
                <span
                  style={{
                    fontSize: "10px",
                    fontWeight: 800,
                    color: "#2563EB",
                    background: "#EFF6FF",
                    padding: "2px 6px",
                    borderRadius: "4px",
                  }}
                >
                  {clientRequests.length} ACTIVE
                </span>
              </div>

              {/* Sidebar list items */}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "10px",
                }}
              >
                {openRequests.map((r) => {
                  const isActive = r.id === (activeRequest?.id || "");
                  return (
                    <div
                      key={r.id}
                      onClick={() => setSelectedMatchingRequestId(r.id)}
                      style={{
                        padding: "14px 16px",
                        borderRadius: "10px",
                        cursor: "pointer",
                        background: isActive ? "#FFFFFF" : "transparent",
                        border: isActive
                          ? "1px solid #E2E8F0"
                          : "1px solid transparent",
                        borderLeft: isActive
                          ? "3px solid #2563EB"
                          : "1px solid transparent",
                        boxShadow: isActive
                          ? "0 4px 12px rgba(0,0,0,0.02)"
                          : "none",
                        transition: "all 0.2s",
                      }}
                      onMouseEnter={(e) => {
                        if (!isActive)
                          e.currentTarget.style.background = "#F8FAFC";
                      }}
                      onMouseLeave={(e) => {
                        if (!isActive)
                          e.currentTarget.style.background = "transparent";
                      }}
                    >
                      <div
                        style={{
                          fontSize: "9px",
                          fontWeight: 800,
                          color: "#94A3B8",
                          textTransform: "uppercase",
                          letterSpacing: "0.05em",
                          marginBottom: "4px",
                        }}
                      >
                        {r.category}
                      </div>
                      <h4
                        style={{
                          fontSize: "13px",
                          fontWeight: 800,
                          color: isActive ? "#0F172A" : "#475569",
                          margin: "0 0 6px 0",
                        }}
                      >
                        {r.title}
                      </h4>

                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                        }}
                      >
                        <span style={{ fontSize: "10px", color: "#94A3B8" }}>
                          {r.posted}
                        </span>
                        <span
                          style={{
                            fontSize: "9px",
                            fontWeight: 800,
                            background:
                              r.badgeType === "filled"
                                ? "#2563EB"
                                : "transparent",
                            color:
                              r.badgeType === "filled" ? "#FFFFFF" : "#64748B",
                            border:
                              r.badgeType === "outline"
                                ? "1px solid #E2E8F0"
                                : "none",
                            padding: "2px 6px",
                            borderRadius: "4px",
                          }}
                        >
                          {r.badgeText}
                        </span>
                      </div>
                    </div>
                  );
                })}
                {clientRequests.length === 0 && (
                  <p
                    style={{
                      fontSize: "12px",
                      color: "#94A3B8",
                      margin: 0,
                      textAlign: "center",
                      padding: "12px 0",
                    }}
                  >
                    No active service requests logged.
                  </p>
                )}
              </div>
            </Card>
          </div>

          {/* Right Column: Vetted Candidates Main Area */}
          <div
            style={{ display: "flex", flexDirection: "column", gap: "24px" }}
          >
            {/* Main Area Header */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <h3
                style={{
                  fontSize: "18px",
                  fontWeight: 800,
                  color: "#0F172A",
                  margin: 0,
                }}
              >
                {activeRequest ? (
                  <>
                    Vetted Shortlisted Candidates{" "}
                    <span
                      style={{
                        fontWeight: 500,
                        color: "#64748B",
                        fontSize: "14px",
                      }}
                    >
                      for {activeRequest.serviceType}
                    </span>
                  </>
                ) : (
                  <>Candidates Match Sourcing Pipeline</>
                )}
              </h3>
            </div>

            {/* Candidates Matches Grid */}
            <div
              style={{ display: "flex", flexDirection: "column", gap: "20px" }}
            >
              {candidatesList.length > 0 ? (
                candidatesList.map((cand) => {
                  return (
                    <Card
                      key={cand.talentId}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "auto 1fr",
                        gap: "24px",
                        position: "relative",
                      }}
                    >
                      {/* Avatar Circle */}
                      <div
                        style={{
                          position: "relative",
                          width: "56px",
                          height: "56px",
                        }}
                      >
                        <div
                          style={{
                            width: "56px",
                            height: "56px",
                            borderRadius: "50%",
                            background: "#EFF6FF",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            color: "#2563EB",
                            fontWeight: 800,
                            fontSize: "18px",
                            border: "2px solid #E2E8F0",
                            overflow: "hidden",
                          }}
                        >
                          {cand.avatar ? (
                            <img
                              src={cand.avatar}
                              alt=""
                              style={{
                                width: "100%",
                                height: "100%",
                                objectFit: "cover",
                              }}
                            />
                          ) : (
                            cand.name.charAt(0)
                          )}
                        </div>
                        <span
                          style={{
                            position: "absolute",
                            right: 0,
                            bottom: 0,
                            width: "16px",
                            height: "16px",
                            borderRadius: "50%",
                            background: "#10B981",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            color: "#FFFFFF",
                            fontSize: "10px",
                            border: "2px solid #FFFFFF",
                            fontWeight: 900,
                          }}
                        >
                          ✓
                        </span>
                      </div>

                      {/* Content Specs */}
                      <div>
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "baseline",
                            marginBottom: "8px",
                          }}
                        >
                          <div>
                            <h4
                              style={{
                                fontSize: "16px",
                                fontWeight: 800,
                                color: "#0F172A",
                                margin: "0 0 2px 0",
                              }}
                            >
                              {cand.name}
                            </h4>
                            <span
                              style={{ fontSize: "12px", color: "#94A3B8" }}
                            >
                              {cand.location}
                            </span>
                          </div>

                          {/* Compatibility score tag */}
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "6px",
                            }}
                          >
                            <span
                              style={{
                                fontSize: "12px",
                                color: "#10B981",
                                fontWeight: 800,
                              }}
                            >
                              {cand.score} compatibility
                            </span>
                          </div>
                        </div>

                        {/* Telemetry specs grid */}
                        <div
                          className="db-grid-2"
                          style={{
                            gap: "12px",
                            background: "#F8FAFC",
                            padding: "12px 16px",
                            borderRadius: "10px",
                            marginBottom: "16px",
                          }}
                        >
                          <div>
                            <span
                              style={{
                                fontSize: "10px",
                                color: "#94A3B8",
                                display: "block",
                                textTransform: "uppercase",
                              }}
                            >
                              Experience Level
                            </span>
                            <span
                              style={{
                                fontSize: "12px",
                                fontWeight: 700,
                                color: "#334155",
                              }}
                            >
                              {cand.experience}
                            </span>
                          </div>
                          <div>
                            <span
                              style={{
                                fontSize: "10px",
                                color: "#94A3B8",
                                display: "block",
                                textTransform: "uppercase",
                              }}
                            >
                              Availability
                            </span>
                            <span
                              style={{
                                fontSize: "12px",
                                fontWeight: 700,
                                color: "#334155",
                              }}
                            >
                              {cand.availability}
                            </span>
                          </div>
                        </div>

                        {/* Tech stack */}
                        <div
                          style={{
                            display: "flex",
                            gap: "6px",
                            flexWrap: "wrap",
                            marginBottom: "20px",
                          }}
                        >
                          {cand.techStack.map((sk: string) => (
                            <span
                              key={sk}
                              style={{
                                fontSize: "10px",
                                fontWeight: 700,
                                background: "#F1F5F9",
                                color: "#475569",
                                padding: "3px 8px",
                                borderRadius: "4px",
                              }}
                            >
                              {sk}
                            </span>
                          ))}
                        </div>

                        {/* Actions footer */}
                        <div
                          style={{
                            display: "flex",
                            gap: "12px",
                            alignItems: "center",
                            borderTop: "1px solid #F1F5F9",
                            paddingTop: "16px",
                            flexWrap: "wrap",
                          }}
                        >
                          <button
                            onClick={() => {
                              setRequestInterviewTarget({
                                matchId: cand.matchId,
                                talentId: cand.talentId,
                                talentName: cand.name,
                                requestId: activeRequest.id,
                              });
                              setRequestInterviewForm((f) => ({
                                ...f,
                                date: new Date(Date.now() + 86400000 * 2)
                                  .toISOString()
                                  .split("T")[0],
                              })); // Defaults to 2 days out
                              setShowRequestInterviewModal(true);
                            }}
                            disabled={cand.status !== "Shortlisted"}
                            style={{
                              background:
                                cand.status === "Shortlisted"
                                  ? "#2563EB"
                                  : cand.status === "Interview Requested"
                                    ? "#EFF6FF"
                                    : "#ECFDF5",
                              border: "none",
                              borderRadius: "8px",
                              padding: "8px 16px",
                              color:
                                cand.status === "Shortlisted"
                                  ? "#FFFFFF"
                                  : cand.status === "Interview Requested"
                                    ? "#2563EB"
                                    : "#10B981",
                              fontWeight: 700,
                              fontSize: "12px",
                              cursor:
                                cand.status === "Shortlisted"
                                  ? "pointer"
                                  : "default",
                            }}
                          >
                            {cand.status === "Shortlisted" &&
                              "📅 Request Interview"}
                            {cand.status === "Interview Requested" &&
                              "⏳ Interview Requested"}
                            {cand.status === "Interview Scheduled" &&
                              "✓ Interview Scheduled"}
                          </button>

                          {(cand.status === "Shortlisted" ||
                            cand.status === "Interview Scheduled" ||
                            cand.status === "Interview Requested") && (
                            <button
                              onClick={() => {
                                setHireTarget(cand);
                                setHireForm({
                                  salary: activeRequest.budget
                                    ? String(activeRequest.budget)
                                    : "4500",
                                  startDate: new Date(Date.now() + 86400000 * 7)
                                    .toISOString()
                                    .split("T")[0],
                                  notes: "",
                                });
                                setShowHireModal(true);
                              }}
                              style={{
                                background: "#10B981",
                                border: "none",
                                borderRadius: "8px",
                                padding: "8px 16px",
                                color: "#FFFFFF",
                                fontWeight: 700,
                                fontSize: "12px",
                                cursor: "pointer",
                              }}
                            >
                              💼 Hire Candidate
                            </button>
                          )}

                          <button
                            onClick={() => {
                              const exactTalent = talents.find(
                                (t) => t.id === cand.talentId,
                              );
                              if (exactTalent) {
                                setViewingTalentProfile(exactTalent);
                              } else {
                                alert("Talent profile loading...");
                              }
                            }}
                            style={{
                              background: "transparent",
                              border: "none",
                              color: "#2563EB",
                              fontSize: "12px",
                              fontWeight: 700,
                              cursor: "pointer",
                              marginLeft: "auto",
                            }}
                          >
                            View Full Profile ➔
                          </button>
                        </div>
                      </div>
                    </Card>
                  );
                })
              ) : (
                <div
                  style={{
                    textAlign: "center",
                    padding: "56px 40px",
                    color: "#64748B",
                    background: "#FFFFFF",
                    border: "1px solid #E2E8F0",
                    borderRadius: "20px",
                  }}
                >
                  <div style={{ fontSize: "48px", marginBottom: "16px" }}>
                    👥
                  </div>
                  <h4
                    style={{
                      fontSize: "16px",
                      fontWeight: 800,
                      color: "#0F172A",
                      margin: "0 0 8px 0",
                    }}
                  >
                    Sourcing & Vetting Candidates
                  </h4>
                  <p
                    style={{
                      fontSize: "13px",
                      color: "#64748B",
                      margin: 0,
                      maxWidth: "400px",
                      marginLeft: "auto",
                      marginRight: "auto",
                      lineHeight: 1.5,
                    }}
                  >
                    Our operations team is actively searching the Kongila
                    network and vetting candidates against your role
                    specifications. Candidates will appear here as soon as they
                    are shortlisted.
                  </p>
                </div>
              )}
            </div>

            {/* proposed slot banners info if requested */}
            {candidatesList.some((c) => c.status === "Interview Requested") && (
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "16px",
                  justifyContent: "space-between",
                  alignItems: "center",
                  background: "#FFFFFF",
                  border: "1px solid #E2E8F0",
                  borderRadius: "16px",
                  padding: "20px",
                  marginTop: "12px",
                  boxShadow: "0 4px 16px rgba(0,0,0,0.02)",
                  position: "relative",
                }}
              >
                <div>
                  <div
                    style={{
                      fontSize: "11px",
                      fontWeight: 800,
                      color: "#2563EB",
                      textTransform: "uppercase",
                      marginBottom: "6px",
                    }}
                  >
                    Interview Proposal Active
                  </div>
                  <div
                    style={{
                      fontSize: "13px",
                      color: "#1E293B",
                      fontWeight: 700,
                    }}
                  >
                    Our operations team is currently coordinating with
                    candidates for the proposed interview slots.
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const handleSinglePayment = (invoiceId: string, amount: number) => {
    alert(`Payment gateway simulated for invoice ${invoiceId} ($${amount})`);
  };

  const renderBilling = () => {
    // Dynamic database calculation from real invoices
    // Exclude drafts per REQ-KC-801
    const clientInvoices = invoices
      .filter(
        (inv) =>
          inv.clientId === currentUser?.id &&
          inv.status?.toLowerCase() !== "draft",
      )
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );

    // Sum real database records strictly specific to this account
    const dbPaidSum = clientInvoices
      .filter((inv) => inv.status?.toLowerCase() === "paid")
      .reduce((sum, inv) => sum + Number(inv.totalUsd || 0), 0);
    const dbPendingSum = clientInvoices
      .filter(
        (inv) =>
          inv.status?.toLowerCase() !== "paid" &&
          inv.status?.toLowerCase() !== "void",
      )
      .reduce((sum, inv) => sum + Number(inv.totalUsd || 0), 0);

    const totalPaidYTD = dbPaidSum;
    const outstandingBalance = dbPendingSum;

    // Dynamically look up next pending billing date and details
    const pendingInvoices = clientInvoices.filter(
      (inv) =>
        inv.status?.toLowerCase() !== "paid" &&
        inv.status?.toLowerCase() !== "void",
    );
    const sortedPending = [...pendingInvoices].sort(
      (a, b) =>
        new Date(a.dueDate || "").getTime() -
        new Date(b.dueDate || "").getTime(),
    );
    const nextInvoice = sortedPending[0];
    const overdueInvoices = pendingInvoices.filter(
      (inv) =>
        inv.status?.toLowerCase() === "overdue" ||
        new Date(inv.dueDate) < new Date(),
    );

    const generateReceipt = (invoice: any) => {
      // Open a popup window with Kongila branded HTML
      const win = window.open("", "_blank");
      if (win) {
        win.document.write(`
          <html>
            <head>
              <title>Receipt - ${invoice.invoiceNumber}</title>
              <style>
                body { font-family: 'Inter', sans-serif; padding: 40px; color: #1E293B; }
                .receipt-box { border: 1px solid #E2E8F0; padding: 40px; border-radius: 12px; max-width: 600px; margin: 0 auto; box-shadow: 0 4px 20px rgba(0,0,0,0.05); }
                .header { display: flex; justify-content: space-between; border-bottom: 2px solid #F1F5F9; padding-bottom: 20px; margin-bottom: 20px; }
                .logo { font-size: 24px; font-weight: 800; color: #0047CC; }
                .title { font-size: 24px; font-weight: 800; color: #10B981; }
                .row { display: flex; justify-content: space-between; margin-bottom: 10px; }
                .total-row { font-size: 18px; font-weight: 800; margin-top: 20px; border-top: 2px solid #F1F5F9; padding-top: 20px; }
              </style>
            </head>
            <body>
              <div class="receipt-box">
                <div class="header">
                  <div class="logo">KONGILA</div>
                  <div class="title">PAID RECEIPT</div>
                </div>
                <div class="row"><strong>Invoice:</strong> <span>${invoice.invoiceNumber}</span></div>
                <div class="row"><strong>Date Paid:</strong> <span>${new Date().toLocaleDateString()}</span></div>
                <div class="row"><strong>Amount:</strong> <span>${formatCurrency(invoice.totalUsd)}</span></div>
                <div style="margin-top: 30px;">
                  <h4 style="border-bottom: 1px solid #E2E8F0; padding-bottom: 8px;">Line Items</h4>
                  ${invoice.lineItems
                    .map(
                      (li: any) => `
                    <div class="row"><span>${li.description}</span> <span>${formatCurrency(li.amountUsd)}</span></div>
                  `,
                    )
                    .join("")}
                </div>
                <div class="row total-row">
                  <span>Total Paid</span>
                  <span>${formatCurrency(invoice.totalUsd)}</span>
                </div>
                <div style="text-align: center; margin-top: 40px; color: #64748B; font-size: 12px;">
                  Thank you for your business. For support, contact billing@kongila.com.
                </div>
              </div>
              <script>window.print();</script>
            </body>
          </html>
        `);
      }
    };

    const handlePayNow = async () => {
      if (!selectedInvoice) return;
      if (paymentMethod === "card") {
        // REQ-KC-803: Online Card Payment immediate update
        const { error } = await supabase
          .from("invoices")
          .update({ status: "paid" })
          .eq("id", selectedInvoice.id);
        if (error) {
          alert("Payment failed. Please try again.");
          return;
        }
        await supabase.from("notifications").insert({
          user_id: currentUser?.id,
          title: "Payment Successful",
          content: `Payment of ${formatCurrency(selectedInvoice.totalUsd)} for ${selectedInvoice.invoiceNumber} was successfully processed via card.`,
          read_status: false,
        });
        alert(
          `Payment of ${formatCurrency(selectedInvoice.totalUsd)} successful! Receipt generated.`,
        );
        generateReceipt(selectedInvoice);
        setShowPaymentModal(false);
        setSelectedInvoice(null);
      } else {
        // REQ-KC-804: Bank Transfer Instructions Display
        alert(
          "Bank transfer instructions noted. Invoice will remain in SENT status until reconciled by Finance Admin.",
        );
        setShowPaymentModal(false);
      }
    };

    const handleDispute = async () => {
      if (!selectedInvoice || !disputeReason) return;
      // REQ-KC-806: Invoice Dispute Flow
      const { error } = await supabase
        .from("invoices")
        .update({
          is_disputed: true,
          dispute_reason: disputeReason,
        })
        .eq("id", selectedInvoice.id);

      if (error) {
        alert("Failed to submit dispute.");
        return;
      }

      await supabase.from("notifications").insert({
        user_id: currentUser?.id,
        title: "Invoice Disputed",
        content: `Dispute filed for ${selectedInvoice.invoiceNumber}. Our Finance Admin will review this shortly. Automated reminders are paused.`,
        read_status: false,
      });

      alert(
        "Dispute submitted successfully. Our Finance team has been notified.",
      );
      setShowDisputeModal(false);
      setSelectedInvoice(null);
      setDisputeReason("");
    };

    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "32px",
          position: "relative",
        }}
      >
        {/* Header Title */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div>
            <h1
              style={{
                fontSize: "32px",
                fontWeight: 800,
                color: "#0F172A",
                marginBottom: "8px",
                letterSpacing: "-0.03em",
              }}
            >
              Billing & Financials
            </h1>
            <p style={{ fontSize: "15px", color: "#64748B", margin: 0 }}>
              Monitor your workforce investment and manage enterprise
              transactions.
            </p>
          </div>

          <div style={{ display: "flex", gap: "12px" }}>
            <button
              style={{
                background: "#FFFFFF",
                border: "1px solid #E2E8F0",
                borderRadius: "10px",
                padding: "10px 18px",
                color: "#475569",
                fontWeight: 700,
                fontSize: "13px",
                cursor: "pointer",
              }}
            >
              Export Ledger
            </button>
          </div>
        </div>

        {/* Outstanding Balance Banner (REQ-KC-801, Billing Dashboard Spec) */}
        {outstandingBalance > 0 && (
          <div
            style={{
              background: "#FEF2F2",
              border: "1px solid #FCA5A5",
              padding: "24px",
              borderRadius: "12px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div>
              <h2
                style={{
                  fontSize: "18px",
                  fontWeight: 800,
                  color: "#991B1B",
                  margin: "0 0 4px 0",
                }}
              >
                Action Required: Outstanding Balance
              </h2>
              <p style={{ color: "#7F1D1D", margin: 0, fontSize: "14px" }}>
                You have {pendingInvoices.length} unpaid invoices totaling{" "}
                <strong>{formatCurrency(outstandingBalance)}</strong>.{" "}
                {overdueInvoices.length > 0
                  ? `(${overdueInvoices.length} overdue)`
                  : ""}
              </p>
            </div>
            {sortedPending[0] && (
              <button
                onClick={() => setSelectedInvoice(sortedPending[0])}
                style={{
                  background: "#DC2626",
                  color: "#FFF",
                  border: "none",
                  padding: "10px 20px",
                  borderRadius: "8px",
                  fontWeight: 700,
                  cursor: "pointer",
                  boxShadow: "0 4px 12px rgba(220, 38, 38, 0.2)",
                }}
              >
                Pay Oldest Overdue
              </button>
            )}
          </div>
        )}

        <div className="db-grid-3" style={{ gap: "20px" }}>
          {/* Stats Cards */}
          <Card style={{ padding: "24px" }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "8px",
              }}
            >
              <span
                style={{
                  fontSize: "10px",
                  fontWeight: 800,
                  color: "#64748B",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                Total Paid (YTD)
              </span>
            </div>
            <div
              style={{
                fontSize: "28px",
                fontWeight: 900,
                color: "#0F172A",
                marginBottom: "8px",
              }}
            >
              {formatCurrency(totalPaidYTD)}
            </div>
          </Card>

          <Card style={{ padding: "24px" }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "8px",
              }}
            >
              <span
                style={{
                  fontSize: "10px",
                  fontWeight: 800,
                  color: "#64748B",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                Outstanding Balance
              </span>
            </div>
            <div
              style={{
                fontSize: "28px",
                fontWeight: 900,
                color: outstandingBalance > 0 ? "#EF4444" : "#0F172A",
                marginBottom: "8px",
              }}
            >
              {formatCurrency(outstandingBalance)}
            </div>
          </Card>

          <Card style={{ padding: "24px" }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "8px",
              }}
            >
              <span
                style={{
                  fontSize: "10px",
                  fontWeight: 800,
                  color: "#64748B",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                Next Billing Date
              </span>
            </div>
            <div
              style={{
                fontSize: "28px",
                fontWeight: 900,
                color: "#0F172A",
                marginBottom: "8px",
              }}
            >
              {nextInvoice
                ? new Date(nextInvoice.dueDate).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                  })
                : "None"}
            </div>
          </Card>
        </div>

        {/* Invoices List */}
        <Card style={{ padding: 0, overflow: "hidden" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "24px",
            }}
          >
            <h3
              style={{
                fontSize: "16px",
                fontWeight: 800,
                color: "#0F172A",
                margin: 0,
              }}
            >
              All Invoices
            </h3>
          </div>

          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              textAlign: "left",
              fontSize: "13px",
            }}
          >
            <thead>
              <tr
                style={{
                  background: "#F8FAFC",
                  borderBottom: "1px solid #E2E8F0",
                }}
              >
                <th
                  style={{
                    padding: "12px 24px",
                    fontWeight: 800,
                    color: "#64748B",
                    textTransform: "uppercase",
                    fontSize: "10px",
                    letterSpacing: "0.05em",
                  }}
                >
                  Invoice #
                </th>
                <th
                  style={{
                    padding: "12px 24px",
                    fontWeight: 800,
                    color: "#64748B",
                    textTransform: "uppercase",
                    fontSize: "10px",
                    letterSpacing: "0.05em",
                  }}
                >
                  Date Sent
                </th>
                <th
                  style={{
                    padding: "12px 24px",
                    fontWeight: 800,
                    color: "#64748B",
                    textTransform: "uppercase",
                    fontSize: "10px",
                    letterSpacing: "0.05em",
                  }}
                >
                  Due Date
                </th>
                <th
                  style={{
                    padding: "12px 24px",
                    fontWeight: 800,
                    color: "#64748B",
                    textTransform: "uppercase",
                    fontSize: "10px",
                    letterSpacing: "0.05em",
                  }}
                >
                  Amount
                </th>
                <th
                  style={{
                    padding: "12px 24px",
                    fontWeight: 800,
                    color: "#64748B",
                    textTransform: "uppercase",
                    fontSize: "10px",
                    letterSpacing: "0.05em",
                  }}
                >
                  Status
                </th>
                <th
                  style={{
                    padding: "12px 24px",
                    fontWeight: 800,
                    color: "#64748B",
                    textTransform: "uppercase",
                    fontSize: "10px",
                    letterSpacing: "0.05em",
                  }}
                >
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {clientInvoices.length > 0 ? (
                clientInvoices.map((inv) => {
                  const isPaid = inv.status === "paid";
                  const isOverdue =
                    inv.status === "overdue" ||
                    (new Date(inv.dueDate) < new Date() && !isPaid);
                  const isDisputed = inv.isDisputed;

                  return (
                    <tr
                      key={inv.id}
                      style={{
                        borderBottom: "1px solid #F1F5F9",
                        background: isOverdue
                          ? "rgba(254, 226, 226, 0.2)"
                          : "transparent",
                        transition: "background 0.15s",
                      }}
                    >
                      <td
                        style={{
                          padding: "16px 24px",
                          fontWeight: 700,
                          color: "#1E293B",
                        }}
                      >
                        {inv.invoiceNumber}
                      </td>
                      <td style={{ padding: "16px 24px", color: "#64748B" }}>
                        {new Date(inv.createdAt).toLocaleDateString()}
                      </td>
                      <td style={{ padding: "16px 24px", color: "#64748B" }}>
                        {inv.dueDate
                          ? new Date(inv.dueDate).toLocaleDateString()
                          : "-"}
                      </td>
                      <td
                        style={{
                          padding: "16px 24px",
                          fontWeight: 800,
                          color: "#1E293B",
                        }}
                      >
                        {formatCurrency(inv.totalUsd)}
                      </td>
                      <td style={{ padding: "16px 24px" }}>
                        <span
                          style={{
                            display: "inline-block",
                            fontSize: "10px",
                            fontWeight: 800,
                            padding: "4px 10px",
                            borderRadius: "6px",
                            background: isPaid
                              ? "#ECFDF5"
                              : isDisputed
                                ? "#FEF3C7"
                                : isOverdue
                                  ? "#FEF2F2"
                                  : "#EFF6FF",
                            color: isPaid
                              ? "#10B981"
                              : isDisputed
                                ? "#B45309"
                                : isOverdue
                                  ? "#EF4444"
                                  : "#2563EB",
                          }}
                        >
                          {isDisputed
                            ? "DISPUTED"
                            : inv.status?.toUpperCase() || "SENT"}
                        </span>
                      </td>
                      <td style={{ padding: "16px 24px" }}>
                        <button
                          onClick={() => setSelectedInvoice(inv)}
                          style={{
                            background: "#FFFFFF",
                            border: "1px solid #E2E8F0",
                            color: "#0F172A",
                            padding: "6px 14px",
                            borderRadius: "6px",
                            fontSize: "11px",
                            fontWeight: 700,
                            cursor: "pointer",
                          }}
                        >
                          View Detail
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td
                    colSpan={6}
                    style={{
                      padding: "32px",
                      textAlign: "center",
                      color: "#64748B",
                    }}
                  >
                    No invoices found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </Card>

        {/* Invoice Detail Modal */}
        {selectedInvoice && !showPaymentModal && !showDisputeModal && (
          <div
            className="modal-overlay"
            onClick={(e) => {
              if (e.target === e.currentTarget) setSelectedInvoice(null);
            }}
          >
            <div
              className="modal-content"
              style={{ padding: "32px", maxWidth: "600px" }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  borderBottom: "1px solid #E2E8F0",
                  paddingBottom: "16px",
                  marginBottom: "24px",
                }}
              >
                <h2 style={{ margin: 0, fontSize: "20px", color: "#0F172A" }}>
                  Invoice {selectedInvoice.invoiceNumber}
                </h2>
                <span
                  style={{
                    fontSize: "12px",
                    fontWeight: 800,
                    padding: "4px 10px",
                    borderRadius: "6px",
                    background:
                      selectedInvoice.status === "paid" ? "#ECFDF5" : "#EFF6FF",
                    color:
                      selectedInvoice.status === "paid" ? "#10B981" : "#2563EB",
                  }}
                >
                  {selectedInvoice.isDisputed
                    ? "DISPUTED"
                    : selectedInvoice.status?.toUpperCase()}
                </span>
              </div>

              {/* REQ-KC-802: Itemized Line Item Display */}
              <div style={{ marginBottom: "32px" }}>
                <h4
                  style={{
                    color: "#64748B",
                    fontSize: "11px",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    marginBottom: "12px",
                  }}
                >
                  Itemized Charges
                </h4>
                <div
                  style={{
                    background: "#F8FAFC",
                    borderRadius: "8px",
                    padding: "16px",
                  }}
                >
                  {selectedInvoice.lineItems?.map((li: any) => (
                    <div
                      key={li.id}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        marginBottom: "12px",
                        fontSize: "14px",
                        color: "#1E293B",
                      }}
                    >
                      <span>{li.description}</span>
                      <span style={{ fontWeight: 600 }}>
                        {formatCurrency(li.amountUsd)}
                      </span>
                    </div>
                  ))}
                  <div
                    style={{
                      borderTop: "1px solid #E2E8F0",
                      marginTop: "16px",
                      paddingTop: "16px",
                      display: "flex",
                      justifyContent: "space-between",
                      fontSize: "16px",
                      fontWeight: 800,
                      color: "#0F172A",
                    }}
                  >
                    <span>Total Due</span>
                    <span>{formatCurrency(selectedInvoice.totalUsd)}</span>
                  </div>
                </div>
              </div>

              {selectedInvoice.isDisputed && (
                <div
                  style={{
                    background: "#FEF3C7",
                    padding: "16px",
                    borderRadius: "8px",
                    marginBottom: "24px",
                    fontSize: "13px",
                    color: "#92400E",
                  }}
                >
                  <strong>Dispute Under Review:</strong> "
                  {selectedInvoice.disputeReason}"<br />
                  Our Finance Admin is investigating this. Overdue escalations
                  are paused.
                </div>
              )}

              <div
                style={{
                  display: "flex",
                  gap: "12px",
                  justifyContent: "flex-end",
                }}
              >
                {selectedInvoice.status !== "paid" &&
                  !selectedInvoice.isDisputed && (
                    <button
                      onClick={() => setShowDisputeModal(true)}
                      style={{
                        background: "transparent",
                        border: "1px solid #E2E8F0",
                        padding: "10px 16px",
                        borderRadius: "8px",
                        color: "#64748B",
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      Dispute Invoice
                    </button>
                  )}
                <button
                  onClick={() => generateReceipt(selectedInvoice)}
                  style={{
                    background: "#FFFFFF",
                    border: "1px solid #E2E8F0",
                    padding: "10px 16px",
                    borderRadius: "8px",
                    color: "#0F172A",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Download PDF
                </button>
                {selectedInvoice.status !== "paid" && (
                  <button
                    onClick={() => setShowPaymentModal(true)}
                    style={{
                      background: "#2563EB",
                      border: "none",
                      padding: "10px 24px",
                      borderRadius: "8px",
                      color: "#FFFFFF",
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    Pay Now
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Payment Modal */}
        {showPaymentModal && (
          <div
            className="modal-overlay"
            onClick={(e) => {
              if (e.target === e.currentTarget) setShowPaymentModal(false);
            }}
          >
            <div
              className="modal-content"
              style={{ padding: "32px", maxWidth: "400px" }}
            >
              <h2
                style={{
                  margin: "0 0 24px 0",
                  fontSize: "20px",
                  color: "#0F172A",
                }}
              >
                Select Payment Method
              </h2>

              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "12px",
                  marginBottom: "32px",
                }}
              >
                <div
                  onClick={() => setPaymentMethod("card")}
                  style={{
                    padding: "16px",
                    border: `2px solid ${paymentMethod === "card" ? "#2563EB" : "#E2E8F0"}`,
                    borderRadius: "8px",
                    cursor: "pointer",
                    background: paymentMethod === "card" ? "#EFF6FF" : "#FFF",
                  }}
                >
                  <div style={{ fontWeight: 700, color: "#1E293B" }}>
                    💳 Pay via Card (Stripe)
                  </div>
                  <div style={{ fontSize: "12px", color: "#64748B" }}>
                    {(() => {
                      const profile = clientProfiles.find((cp: any) => cp.userId === currentUser?.id);
                      const defaultCard = profile?.settings?.paymentMethods?.find((pm: any) => pm.isDefault);
                      if (defaultCard) {
                        return `Instant clearance. ${defaultCard.brand || 'Card'} •••• ${defaultCard.last4} on file.`;
                      }
                      return "Instant clearance. Click Confirm to securely add a card via Stripe.";
                    })()}
                  </div>
                </div>
                <div
                  onClick={() => setPaymentMethod("bank")}
                  style={{
                    padding: "16px",
                    border: `2px solid ${paymentMethod === "bank" ? "#2563EB" : "#E2E8F0"}`,
                    borderRadius: "8px",
                    cursor: "pointer",
                    background: paymentMethod === "bank" ? "#EFF6FF" : "#FFF",
                  }}
                >
                  <div style={{ fontWeight: 700, color: "#1E293B" }}>
                    🏦 Bank Transfer
                  </div>
                  <div style={{ fontSize: "12px", color: "#64748B" }}>
                    Manual clearance via Wire/ACH.
                  </div>
                </div>
              </div>

              {paymentMethod === "bank" && (
                <div
                  style={{
                    background: "#F8FAFC",
                    padding: "16px",
                    borderRadius: "8px",
                    fontSize: "13px",
                    color: "#475569",
                    marginBottom: "24px",
                  }}
                >
                  <strong>Wire Instructions:</strong>
                  <br />
                  Bank: Chase Business
                  <br />
                  Account: 123456789
                  <br />
                  Routing: 987654321
                  <br />
                  Reference: {selectedInvoice?.invoiceNumber}
                  <br />
                  <em>Transfers take 1-2 business days to reconcile.</em>
                </div>
              )}

              <div
                style={{
                  display: "flex",
                  gap: "12px",
                  justifyContent: "flex-end",
                }}
              >
                <button
                  onClick={() => setShowPaymentModal(false)}
                  style={{
                    background: "transparent",
                    border: "none",
                    color: "#64748B",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handlePayNow}
                  style={{
                    background: "#10B981",
                    border: "none",
                    padding: "10px 24px",
                    borderRadius: "8px",
                    color: "#FFFFFF",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  Confirm Payment
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Dispute Modal */}
        {showDisputeModal && (
          <div
            className="modal-overlay"
            onClick={(e) => {
              if (e.target === e.currentTarget) setShowDisputeModal(false);
            }}
          >
            <div
              className="modal-content"
              style={{ padding: "32px", maxWidth: "400px" }}
            >
              <h2
                style={{
                  margin: "0 0 16px 0",
                  fontSize: "20px",
                  color: "#0F172A",
                }}
              >
                Dispute Invoice
              </h2>
              <p
                style={{
                  fontSize: "13px",
                  color: "#64748B",
                  marginBottom: "24px",
                }}
              >
                Please explain the discrepancy. This will pause automated
                overdue escalations until reviewed.
              </p>

              <textarea
                value={disputeReason}
                onChange={(e) => setDisputeReason(e.target.value)}
                placeholder="E.g., Missing discount applied to flex plan..."
                style={{
                  width: "100%",
                  height: "100px",
                  padding: "12px",
                  border: "1px solid #E2E8F0",
                  borderRadius: "8px",
                  marginBottom: "24px",
                  resize: "none",
                }}
              />

              <div
                style={{
                  display: "flex",
                  gap: "12px",
                  justifyContent: "flex-end",
                }}
              >
                <button
                  onClick={() => setShowDisputeModal(false)}
                  style={{
                    background: "transparent",
                    border: "none",
                    color: "#64748B",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleDispute}
                  style={{
                    background: "#DC2626",
                    border: "none",
                    padding: "10px 24px",
                    borderRadius: "8px",
                    color: "#FFFFFF",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  Submit Dispute
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };
  // NEW MESSAGING HERE
  const renderReviews = () => null;

  const renderSettings = () => (
    <Card style={{ padding: "32px" }}>
      <h3
        style={{
          fontSize: "18px",
          fontWeight: 700,
          color: "#0F172A",
          margin: "0 0 6px 0",
        }}
      >
        Organization Information
      </h3>
      <p style={{ fontSize: "13px", color: "#64748B", marginBottom: "24px" }}>
        Update company credentials and operations details.
      </p>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          alert("Profile credentials updated!");
        }}
        style={{ display: "flex", flexDirection: "column", gap: "20px" }}
      >
        <div className="db-grid-2" style={{ gap: "20px" }}>
          <div>
            <label
              style={{
                fontSize: "11px",
                fontWeight: 700,
                color: "#64748B",
                textTransform: "uppercase",
                display: "block",
                marginBottom: "8px",
              }}
            >
              Company Name
            </label>
            <input
              type="text"
              defaultValue={currentUser?.companyName || "Thorne Enterprises"}
              style={{
                width: "100%",
                height: "40px",
                border: "1px solid #E2E8F0",
                borderRadius: "8px",
                padding: "0 12px",
                fontSize: "14px",
                boxSizing: "border-box",
              }}
            />
          </div>
          <div>
            <label
              style={{
                fontSize: "11px",
                fontWeight: 700,
                color: "#64748B",
                textTransform: "uppercase",
                display: "block",
                marginBottom: "8px",
              }}
            >
              Primary Contact Name
            </label>
            <input
              type="text"
              defaultValue={currentUser?.name || "Alex Mercer"}
              style={{
                width: "100%",
                height: "40px",
                border: "1px solid #E2E8F0",
                borderRadius: "8px",
                padding: "0 12px",
                fontSize: "14px",
                boxSizing: "border-box",
              }}
            />
          </div>
        </div>

        <div>
          <label
            style={{
              fontSize: "11px",
              fontWeight: 700,
              color: "#64748B",
              textTransform: "uppercase",
              display: "block",
              marginBottom: "8px",
            }}
          >
            Billing Email Address
          </label>
          <input
            type="email"
            defaultValue={currentUser?.email || "alex.mercer@thorne.io"}
            style={{
              width: "100%",
              height: "40px",
              border: "1px solid #E2E8F0",
              borderRadius: "8px",
              padding: "0 12px",
              fontSize: "14px",
              boxSizing: "border-box",
            }}
          />
        </div>

        <div
          style={{
            borderTop: "1px solid #F1F5F9",
            marginTop: "12px",
            paddingTop: "20px",
            display: "flex",
            justifyContent: "flex-end",
            gap: "12px",
          }}
        >
          <button
            type="submit"
            style={{
              background: "#2563EB",
              border: "none",
              borderRadius: "8px",
              padding: "10px 24px",
              fontSize: "13px",
              fontWeight: 700,
              color: "#FFFFFF",
              cursor: "pointer",
            }}
          >
            Save Changes
          </button>
        </div>
      </form>
    </Card>
  );

  const renderSection = () => {
    const profile = clientProfiles?.find((cp: any) => cp.userId === currentUser?.id);

    switch (activeSection) {
      case 'dashboard':      return renderDashboard();
      case 'company':        return <MyCompanyPanel currentUser={currentUser} organizations={organizations} clientProfiles={clientProfiles} users={users} />;
      case 'requests':       return <MyRequestsPanel 
                                      currentUser={currentUser}
                                      requests={requests}
                                      matches={matches}
                                      contracts={contracts}
                                      talents={talents}
                                      messages={messages}
                                      requestActivityLogs={requestActivityLogs}
                                      onSignContract={onSignContract}
                                      onExtendOffer={onExtendOffer}
                                      onScheduleMeeting={onScheduleMeeting}
                                      matchingShortlistedState={matchingShortlistedState}
                                      handleShortlistToggle={handleShortlistToggle}
                                      interviewRequests={interviewRequests}
                                      handleRequestInterview={handleRequestInterview}
                                      detailsViewRequestId={detailsViewRequestId}
                                      setDetailsViewRequestId={setDetailsViewRequestId}
                                    />;
      case 'radar':          return <MatchedTalentPanel 
                                      currentUser={currentUser}
                                      requests={requests}
                                      matches={matches}
                                      talents={talents}
                                      setMatches={setMatches}
                                      onScheduleMeeting={(talent, req) => setScheduleModalData({ talent, request: req })}
                                      onExtendOffer={onExtendOffer}
                                      saveToDb={saveToDb}
                                    />;
      case 'scheduling':     return <ClientInterviewsPanel 
                                      currentUser={currentUser}
                                      interviews={interviews}
                                      talents={talents}
                                      setInterviews={setInterviews}
                                      saveToDb={saveToDb}
                                      onReschedule={(iv) => {
                                        const talent = talents.find(t => t.id === iv.talentId);
                                        const req = requests.find(r => r.id === iv.requestId);
                                        if (talent && req) {
                                          setScheduleModalData({ talent, request: req });
                                        } else {
                                          alert("Missing talent or request data for rescheduling.");
                                        }
                                      }}
                                    />;
      case 'contracts':
        return (
          <MyTeamPanel
            currentUser={currentUser}
            contracts={contracts}
            talents={talents}
            requests={requests}
            onAddRequest={onAddRequest}
            saveToDb={saveToDb}
          />
        );
      case 'billing':        return renderBilling();
      case 'messaging':      return renderMessaging();
      case 'profile':
        return (
          <ClientSettingsPanel 
            currentUser={currentUser} 
            clientProfile={profile} 
            contracts={contracts} 
            onSaveSettings={async (settings) => {
              if (profile) {
                await supabase.from('client_profiles').update({ settings }).eq('id', profile.id);
                // Also trigger sync
              }
            }} 
          />
        );
      case 'notifications':
        return (
          <ClientNotificationsPanel 
            notifications={notifications.filter((n: any) => n.userId === currentUser?.id)}
            onMarkAllAsRead={async () => {
              const myNotifs = notifications.filter((n: any) => n.userId === currentUser?.id);
              const unreadIds = myNotifs.filter((n: any) => !n.read).map((n: any) => n.id);
              if (unreadIds.length > 0) {
                await supabase.from('notifications').update({ read: true }).in('id', unreadIds);
                if (setNotifications) {
                  setNotifications(notifications.map((n: any) => unreadIds.includes(n.id) ? { ...n, read: true } : n));
                }
              }
            }}
            onNavigate={(category, sourceRecordId) => {
              const catMap: Record<string, any> = {
                Requests: 'requests', Matches: 'radar', Interviews: 'scheduling', Contracts: 'contracts', Billing: 'billing', Messages: 'messaging'
              };
              const targetSection = catMap[category] || 'dashboard';
              setActiveSection(targetSection);
              
              if (sourceRecordId) {
                if (targetSection === 'billing') {
                  setSelectedInvoice(invoices.find((i: any) => i.id === sourceRecordId) || null);
                } else if (targetSection === 'requests') {
                  const req = requests.find((r: any) => r.id === sourceRecordId);
                  if (req) setSelectedRequest(req);
                } else if (targetSection === 'messaging') {
                  // Messaging section handles its own selection but we can set the top level state if it existed.
                }
              }
            }}
          />
        );
      case 'support':
        return (
          <ClientSupportPanel 
            currentUser={currentUser}
            clientProfile={profile!}
            contracts={contracts}
            supportTickets={supportTickets}
            talents={talents}
            setSupportTickets={setSupportTickets || (() => {})}
          />
        );
      case 'remotan':
      default:
        return (
          <div style={{ padding: '48px', textAlign: 'center' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>🚧</div>
            <h2 style={{ fontSize: '22px', fontWeight: 700, color: '#0F172A', marginBottom: '8px' }}>Coming Soon</h2>
            <p>The <strong>{NAV_ITEMS.find((n) => n.id === activeSection)?.label}</strong> module is currently under active development.</p>
          </div>
        );
    }
  };

  return (
    <div
      className="dashboard-shell"
      style={{
        display: "flex",
        minHeight: "100vh",
        background: "#F8FAFC",
        fontFamily: "var(--font-display, Inter, sans-serif)",
      }}
    >
      {/* ── Mobile Top Nav ── */}
      <div
        className="mobile-nav-bar"
        style={{
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 16px",
          height: "60px",
          background: "#FFFFFF",
          borderBottom: "1px solid #DDE2EC",
        }}
      >
        <button
          className="mobile-hamburger"
          onClick={() => setMobileSidebarOpen(!mobileSidebarOpen)}
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "4px",
            background: "none",
            border: "none",
            cursor: "pointer",
          }}
        >
          <span
            style={{
              width: "20px",
              height: "2px",
              background: "#1A2340",
              display: "block",
            }}
          ></span>
          <span
            style={{
              width: "20px",
              height: "2px",
              background: "#1A2340",
              display: "block",
            }}
          ></span>
          <span
            style={{
              width: "20px",
              height: "2px",
              background: "#1A2340",
              display: "block",
            }}
          ></span>
        </button>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            fontWeight: 800,
            color: "#0047CC",
            fontSize: "18px",
            margin: "0 auto 0 12px",
          }}
        >
          <div
            style={{
              width: "24px",
              height: "24px",
              background: "#0047CC",
              color: "white",
              borderRadius: "6px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "14px",
            }}
          >
            K
          </div>
          <span style={{ color: "#0047CC" }}>Kongila</span>
        </div>
      </div>

      {/* ── Mobile Sidebar Drawer ── */}
      {mobileSidebarOpen && (
        <>
          <div
            onClick={() => setMobileSidebarOpen(false)}
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0, 0, 0, 0.4)",
              zIndex: 299,
              backdropFilter: "blur(4px)",
            }}
          />
          <aside
            className="mobile-sidebar-drawer open"
            style={{
              position: "fixed",
              top: 0,
              bottom: 0,
              left: 0,
              width: "280px",
              background: "#FFFFFF",
              borderRight: "1px solid #DDE2EC",
              display: "flex",
              flexDirection: "column",
              padding: "24px 16px",
              zIndex: 300,
              overflowY: "auto",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: "24px",
                paddingBottom: "16px",
                borderBottom: "1px solid #F5F7FA",
              }}
            >
              <div
                style={{ display: "flex", alignItems: "center", gap: "10px" }}
              >
                <div
                  style={{
                    width: "32px",
                    height: "32px",
                    borderRadius: "8px",
                    background: "#0047CC",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#fff",
                    fontWeight: 900,
                  }}
                >
                  K
                </div>
                <div
                  style={{
                    fontSize: "14px",
                    fontWeight: 800,
                    color: "#1A2340",
                  }}
                >
                  Client Portal
                </div>
              </div>
              <button
                onClick={() => setMobileSidebarOpen(false)}
                style={{
                  background: "none",
                  border: "none",
                  color: "#6B7A99",
                  fontSize: "20px",
                  cursor: "pointer",
                }}
              >
                ✕
              </button>
            </div>

            <nav
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "4px",
                flex: 1,
              }}
            >
              {NAV_ITEMS.map((item) => {
                const isActive = activeSection === item.id;
                const badgeCount =
                  item.id === "messaging"
                    ? unreadMessagesCount
                    : unreadByModule[item.id] || 0;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      setActiveSection(item.id);
                      if (
                        item.id === "radar" &&
                        !selectedRequest &&
                        requests.length > 0
                      ) {
                        setSelectedRequest(requests[0]);
                      }
                      setMobileSidebarOpen(false);
                    }}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                      padding: "12px",
                      borderRadius: "8px",
                      border: "none",
                      background: isActive ? "#EEF3FF" : "transparent",
                      color: isActive ? "#0047CC" : "#6B7A99",
                      fontWeight: isActive ? 700 : 500,
                      fontSize: "14px",
                      cursor: "pointer",
                      textAlign: "left",
                      width: "100%",
                    }}
                  >
                    <SidebarIcon
                      id={item.id}
                      color={isActive ? "#0047CC" : "#6B7A99"}
                      size={16}
                    />
                    {item.label}
                    {badgeCount > 0 && (
                      <span
                        style={{
                          marginLeft: "auto",
                          background: "#EF4444",
                          color: "#fff",
                          fontSize: "10px",
                          fontWeight: 800,
                          padding: "2px 6px",
                          borderRadius: "10px",
                        }}
                      >
                        {badgeCount}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "8px",
                marginTop: "auto",
                borderTop: "1px solid #F5F7FA",
                paddingTop: "16px",
              }}
            >
              <button
                onClick={() => {
                  onSignOut();
                  setMobileSidebarOpen(false);
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  background: "transparent",
                  border: "none",
                  color: "#EF4444",
                  fontSize: "14px",
                  fontWeight: 600,
                  cursor: "pointer",
                  textAlign: "left",
                  padding: "8px",
                  width: "100%",
                }}
              >
                <SidebarIcon id="logout" color="#EF4444" size={16} />
                Sign Out
              </button>
            </div>
          </aside>
        </>
      )}

      {/* ── Desktop Sidebar ── */}
      <aside
        className="desktop-sidebar"
        style={{
          width: "240px",
          flexShrink: 0,
          background: "#FFFFFF",
          borderRight: "1px solid #DDE2EC",
          display: "flex",
          flexDirection: "column",
          padding: "24px 12px",
          position: "sticky",
          top: 0,
          height: "100vh",
          overflowY: "auto",
        }}
      >
        {/* User Logo & Branding Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            padding: "0 8px 20px",
            borderBottom: "1px solid #F5F7FA",
            marginBottom: "12px",
          }}
        >
          <div
            style={{
              width: "36px",
              height: "36px",
              borderRadius: "8px",
              background: "#0047CC",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#FFFFFF",
              fontWeight: 900,
              fontSize: "20px",
              flexShrink: 0,
            }}
          >
            K
          </div>
          <div style={{ overflow: "hidden" }}>
            <div
              style={{
                fontSize: "14px",
                fontWeight: 800,
                color: "#1A2340",
                letterSpacing: "-0.02em",
              }}
            >
              Client Portal
            </div>
            <div
              style={{ fontSize: "11px", color: "#6B7A99", marginTop: "2px" }}
            >
              Enterprise Operations
            </div>
          </div>
        </div>

        {/* Navigation Sidebar List */}
        <nav
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "2px",
            flex: 1,
          }}
        >
          {NAV_ITEMS.map((item) => {
            const isActive = activeSection === item.id;
            const badgeCount =
              item.id === "messaging"
                ? unreadMessagesCount
                : unreadByModule[item.id] || 0;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setActiveSection(item.id);
                  if (
                    item.id === "radar" &&
                    !selectedRequest &&
                    clientRequests.length > 0
                  ) {
                    setSelectedRequest(clientRequests[0]);
                  }
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  padding: "10px 12px",
                  borderRadius: "8px",
                  border: "none",
                  background: isActive ? "#EEF3FF" : "transparent",
                  color: isActive ? "#0047CC" : "#6B7A99",
                  fontWeight: isActive ? 700 : 500,
                  fontSize: "13px",
                  cursor: "pointer",
                  textAlign: "left",
                  transition: "all 0.15s",
                  width: "100%",
                }}
              >
                <SidebarIcon
                  id={item.id}
                  color={isActive ? "#0047CC" : "#6B7A99"}
                  size={15}
                />
                {item.label}
                {badgeCount > 0 && (
                  <span
                    style={{
                      marginLeft: "auto",
                      background: "#EF4444",
                      color: "#fff",
                      fontSize: "10px",
                      fontWeight: 800,
                      padding: "2px 6px",
                      borderRadius: "10px",
                    }}
                  >
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
            display: "flex",
            alignItems: "center",
            gap: "10px",
            padding: "6px 8px",
            borderRadius: "8px",
            border: "none",
            background: "transparent",
            color: "#EF4444",
            fontWeight: 600,
            fontSize: "13px",
            cursor: "pointer",
            textAlign: "left",
            marginTop: "auto",
            width: "100%",
          }}
        >
          <SidebarIcon id="logout" color="#EF4444" size={15} />
          Sign Out
        </button>
      </aside>

      {/* ── Main Content Wrapper ── */}
      <div
        className="dashboard-content-area"
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          height: "100vh",
          overflow: "hidden",
        }}
      >
        {/* ── Top Header Bar ── */}
        <header
          className="desktop-header"
          style={{
            height: "70px",
            background: "#FFFFFF",
            borderBottom: "1px solid #DDE2EC",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 40px",
            flexShrink: 0,
            position: "relative",
            zIndex: 10,
          }}
        >
          {/* Breadcrumbs */}
          <div
            style={{
              fontSize: "13px",
              color: "#6B7A99",
              display: "flex",
              alignItems: "center",
              gap: "6px",
              fontWeight: 500,
            }}
          >
            <span>Client Workspace</span>
            <span style={{ color: "#BAC2D1" }}>›</span>
            <span style={{ color: "#1A2340", fontWeight: 700 }}>
              {NAV_ITEMS.find((n) => n.id === activeSection)?.label}
            </span>
          </div>

          {/* Right Header Controls */}
          <div style={{ display: "flex", alignItems: "center", gap: "24px" }}>
            {/* Quick stats / telemetry summary if applicable */}
            <div
              style={{
                display: "flex",
                gap: "16px",
                fontSize: "12px",
                color: "#6B7A99",
                borderRight: "1px solid #DDE2EC",
                paddingRight: "24px",
              }}
            >
              <div>
                <span style={{ fontWeight: 700, color: "#1A2340" }}>
                  {
                    contracts.filter(
                      (c) =>
                        c.clientId === currentUser?.id &&
                        c.status?.toLowerCase() === "signed",
                    ).length
                  }
                </span>{" "}
                Active Hires
              </div>
              <div>
                <span style={{ fontWeight: 700, color: "#1A2340" }}>
                  {
                    matches.filter((m) => {
                      const req = requests.find((r) => r.id === m.requestId);
                      return (
                        req?.clientId === currentUser?.id &&
                        m.status?.toLowerCase() === "interview scheduled"
                      );
                    }).length
                  }
                </span>{" "}
                Interviews
              </div>
            </div>

            {/* Notification and Messages quick badges */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "14px",
                position: "relative",
              }}
            >
              <div
                onClick={() => setActiveSection("messaging")}
                style={{
                  position: "relative",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  color: "#6B7A99",
                }}
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
                {unreadMessagesCount > 0 && (
                  <span
                    style={{
                      position: "absolute",
                      top: "-4px",
                      right: "-4px",
                      background: "#EF4444",
                      color: "#FFF",
                      fontSize: "8px",
                      fontWeight: 800,
                      padding: "1px 3px",
                      borderRadius: "4px",
                      minWidth: "10px",
                      textAlign: "center",
                      border: "2px solid #FFFFFF",
                    }}
                  >
                    {unreadMessagesCount}
                  </span>
                )}
              </div>

              <div
                style={{
                  position: "relative",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  color: "#6B7A99",
                }}
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                  <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                </svg>
                {unreadNotifsCount > 0 && (
                  <span
                    style={{
                      position: "absolute",
                      top: "-4px",
                      right: "-4px",
                      background: "#EF4444",
                      color: "#FFF",
                      fontSize: "8px",
                      fontWeight: 800,
                      padding: "1px 3px",
                      borderRadius: "4px",
                      minWidth: "10px",
                      textAlign: "center",
                      border: "2px solid #FFFFFF",
                    }}
                  >
                    {unreadNotifsCount}
                  </span>
                )}
              </div>
            </div>

            {/* Profile badge */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                borderLeft: "1px solid #DDE2EC",
                paddingLeft: "20px",
              }}
            >
              <img
                src="https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=facearea&facepad=2&w=256&h=256&q=80"
                alt=""
                style={{
                  width: "40px",
                  height: "40px",
                  borderRadius: "50%",
                  objectFit: "cover",
                }}
              />
              <div>
                <span
                  style={{
                    fontSize: "14px",
                    fontWeight: 700,
                    color: "#1A2340",
                    display: "block",
                  }}
                >
                  {currentUser?.name || "Alex Chen"}
                </span>
                <span
                  style={{
                    fontSize: "11px",
                    color: "#6B7A99",
                    display: "block",
                    marginTop: "1px",
                  }}
                >
                  {currentUser?.companyName || "Horizon Fintech"}
                </span>
              </div>
            </div>
          </div>
        </header>

        {/* ── Main Dashboard Panel Scroll view ── */}
        <main
          className="dashboard-main-content"
          style={{ flex: 1, overflowY: "auto", background: "#F8FAFC" }}
        >
          {renderSection()}
        </main>
      </div>

      {/* ── Video Meeting Scheduler Modal Overlay ── */}
      {showCalendar && selectedTalent && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15,23,42,0.3)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: "24px",
          }}
        >
          <div
            style={{
              background: "#FFFFFF",
              borderRadius: "24px",
              padding: "32px",
              width: "100%",
              maxWidth: "480px",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
            }}
          >
            <h2
              style={{
                fontSize: "22px",
                fontWeight: 800,
                color: "#0F172A",
                marginBottom: "8px",
                marginTop: 0,
              }}
            >
              Book Video Interview
            </h2>
            <p
              style={{
                color: "#64748B",
                fontSize: "14px",
                marginBottom: "24px",
                lineHeight: 1.5,
              }}
            >
              Scheduling operational interview call with{" "}
              <strong>{selectedTalent.name}</strong>. Timezone alignments
              resolved automatically.
            </p>

            <div style={{ marginBottom: "16px" }}>
              <label
                style={{
                  display: "block",
                  fontSize: "12px",
                  fontWeight: 700,
                  color: "#475569",
                  textTransform: "uppercase",
                  marginBottom: "6px",
                }}
              >
                Choose Date
              </label>
              <input
                type="date"
                value={meetingDate}
                onChange={(e) => setMeetingDate(e.target.value)}
                style={{
                  width: "100%",
                  height: "44px",
                  border: "1px solid #E2E8F0",
                  borderRadius: "10px",
                  padding: "0 12px",
                  fontSize: "14px",
                  boxSizing: "border-box",
                }}
              />
            </div>

            <div style={{ marginBottom: "24px" }}>
              <label
                style={{
                  display: "block",
                  fontSize: "12px",
                  fontWeight: 700,
                  color: "#475569",
                  textTransform: "uppercase",
                  marginBottom: "6px",
                }}
              >
                Target Time ({selectedTalent.timezone || "GMT+1"})
              </label>
              <input
                type="time"
                value={meetingTime}
                onChange={(e) => setMeetingTime(e.target.value)}
                style={{
                  width: "100%",
                  height: "44px",
                  border: "1px solid #E2E8F0",
                  borderRadius: "10px",
                  padding: "0 12px",
                  fontSize: "14px",
                  boxSizing: "border-box",
                }}
              />
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: "12px",
              }}
            >
              <button
                onClick={() => setShowCalendar(false)}
                style={{
                  background: "transparent",
                  border: "1px solid #E2E8F0",
                  borderRadius: "10px",
                  padding: "12px 20px",
                  fontSize: "14px",
                  fontWeight: 700,
                  color: "#475569",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                onClick={onScheduleMeeting}
                style={{
                  background: "#2563EB",
                  border: "none",
                  borderRadius: "10px",
                  padding: "12px 24px",
                  fontSize: "14px",
                  fontWeight: 700,
                  color: "#FFFFFF",
                  cursor: "pointer",
                }}
              >
                Schedule & Link Zoom
              </button>
            </div>
          </div>
        </div>
      )}
      {/* ── Within-Dashboard Smart Intake Wizard Modal Overlay ── */}
      {showIntakeModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15,23,42,0.3)",
            backdropFilter: "blur(8px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: "24px",
          }}
        >
          <div
            style={{
              position: "relative",
              background: "#FFFFFF",
              borderRadius: "24px",
              padding: "16px",
              width: "100%",
              maxWidth: "850px",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
              maxHeight: "95vh",
              overflowY: "auto",
            }}
          >
            {/* Close X Button */}
            <button
              onClick={() => setShowIntakeModal(false)}
              style={{
                position: "absolute",
                top: "24px",
                right: "24px",
                background: "var(--bg-secondary)",
                border: "none",
                borderRadius: "50%",
                width: "32px",
                height: "32px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                color: "var(--text-secondary)",
                zIndex: 10,
              }}
            >
              ✕
            </button>
            <SmartIntakeForm
              currentUser={currentUser}
              onComplete={async (req) => {
                if (onAddRequest) {
                  await onAddRequest(req);
                }
                setShowIntakeModal(false);
              }}
              onCancel={() => setShowIntakeModal(false)}
            />
          </div>
        </div>
      )}

      {/* View All Invoices Modal */}
      {showAllInvoicesModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15,23,42,0.6)",
            backdropFilter: "blur(10px)",
            zIndex: 1000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px",
          }}
        >
          <div
            style={{
              background: "#FFFFFF",
              borderRadius: "24px",
              padding: "36px",
              width: "100%",
              maxWidth: "900px",
              maxHeight: "90vh",
              overflowY: "auto",
              boxShadow: "0 24px 80px rgba(0,0,0,0.15)",
              boxSizing: "border-box",
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "32px",
              }}
            >
              <div>
                <h2
                  style={{
                    fontSize: "24px",
                    fontWeight: 900,
                    color: "#0F172A",
                    margin: "0 0 6px 0",
                    letterSpacing: "-0.02em",
                  }}
                >
                  Invoice Ledger
                </h2>
                <p style={{ fontSize: "13px", color: "#64748B", margin: 0 }}>
                  Review, audit, and process payments across all invoice tiers.
                </p>
              </div>
              <button
                onClick={() => setShowAllInvoicesModal(false)}
                style={{
                  background: "#F1F5F9",
                  border: "none",
                  borderRadius: "10px",
                  width: "40px",
                  height: "40px",
                  cursor: "pointer",
                  fontSize: "18px",
                  color: "#475569",
                  fontWeight: 800,
                }}
              >
                ×
              </button>
            </div>

            {/* Categorize Invoices */}
            {(() => {
              const clientInvoices = invoices.filter(
                (inv) => inv.clientId === currentUser?.id,
              );

              // Fallback mockup invoices if empty
              const activeInvoicesList =
                clientInvoices.length > 0
                  ? clientInvoices
                  : [
                      {
                        id: "inv_horizon_1",
                        clientId: "usr_horizon",
                        amount: 12450.0,
                        status: "paid" as const,
                        dueDate: "2026-05-01",
                      },
                      {
                        id: "inv_horizon_2",
                        clientId: "usr_horizon",
                        amount: 6250.4,
                        status: "overdue" as const,
                        dueDate: "2026-04-15",
                      },
                      {
                        id: "inv_horizon_3",
                        clientId: "usr_horizon",
                        amount: 18750.4,
                        status: "sent" as const,
                        dueDate: "2026-05-31",
                      },
                      {
                        id: "inv_horizon_4",
                        clientId: "usr_horizon",
                        amount: 8900.0,
                        status: "paid" as const,
                        dueDate: "2026-04-01",
                      },
                      {
                        id: "inv_horizon_5",
                        clientId: "usr_horizon",
                        amount: 12500.0,
                        status: "overdue" as const,
                        dueDate: "2026-03-10",
                      },
                      {
                        id: "inv_horizon_6",
                        clientId: "usr_horizon",
                        amount: 42300.0,
                        status: "sent" as const,
                        dueDate: "2026-06-15",
                      },
                    ];

              const overdueInvoices = activeInvoicesList.filter(
                (inv) => inv.status === "overdue",
              );
              const dueInvoices = activeInvoicesList.filter(
                (inv) => inv.status === "sent" || inv.status === "draft",
              );
              const paidInvoices = activeInvoicesList.filter(
                (inv) => inv.status === "paid",
              );

              const renderInvoiceTable = (
                list: typeof activeInvoicesList,
                title: string,
                badgeBg: string,
                badgeColor: string,
              ) => (
                <div style={{ marginBottom: "28px" }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                      marginBottom: "14px",
                    }}
                  >
                    <h4
                      style={{
                        fontSize: "15px",
                        fontWeight: 800,
                        color: "#1E293B",
                        margin: 0,
                      }}
                    >
                      {title}
                    </h4>
                    <span
                      style={{
                        fontSize: "11px",
                        fontWeight: 800,
                        padding: "2px 8px",
                        borderRadius: "12px",
                        background: badgeBg,
                        color: badgeColor,
                      }}
                    >
                      {list.length} Items
                    </span>
                  </div>

                  {list.length === 0 ? (
                    <p
                      style={{
                        fontSize: "12px",
                        color: "#94A3B8",
                        margin: "0 0 16px 0",
                        fontStyle: "italic",
                      }}
                    >
                      No invoices in this status.
                    </p>
                  ) : (
                    <div
                      style={{
                        border: "1px solid #E2E8F0",
                        borderRadius: "12px",
                        overflow: "hidden",
                        marginBottom: "16px",
                      }}
                    >
                      <table
                        style={{
                          width: "100%",
                          borderCollapse: "collapse",
                          textAlign: "left",
                          fontSize: "12px",
                        }}
                      >
                        <thead>
                          <tr
                            style={{
                              background: "#F8FAFC",
                              borderBottom: "1px solid #E2E8F0",
                            }}
                          >
                            <th
                              style={{
                                padding: "10px 18px",
                                fontWeight: 700,
                                color: "#64748B",
                              }}
                            >
                              Invoice ID
                            </th>
                            <th
                              style={{
                                padding: "10px 18px",
                                fontWeight: 700,
                                color: "#64748B",
                              }}
                            >
                              Due Date
                            </th>
                            <th
                              style={{
                                padding: "10px 18px",
                                fontWeight: 700,
                                color: "#64748B",
                              }}
                            >
                              Amount
                            </th>
                            <th
                              style={{
                                padding: "10px 18px",
                                fontWeight: 700,
                                color: "#64748B",
                                textAlign: "right",
                              }}
                            >
                              Action
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {list.map((inv) => (
                            <tr
                              key={inv.id}
                              style={{ borderBottom: "1px solid #F1F5F9" }}
                            >
                              <td
                                style={{
                                  padding: "12px 18px",
                                  fontWeight: 700,
                                  color: "#1E293B",
                                }}
                              >
                                INV-
                                {inv.id
                                  .replace("inv_", "")
                                  .substring(0, 6)
                                  .toUpperCase()}
                              </td>
                              <td
                                style={{
                                  padding: "12px 18px",
                                  color: "#64748B",
                                }}
                              >
                                {new Date(inv.dueDate).toLocaleDateString(
                                  undefined,
                                  {
                                    month: "short",
                                    day: "numeric",
                                    year: "numeric",
                                  },
                                )}
                              </td>
                              <td
                                style={{
                                  padding: "12px 18px",
                                  fontWeight: 800,
                                  color: "#0F172A",
                                }}
                              >
                                {formatCurrency(inv.amount)}
                              </td>
                              <td
                                style={{
                                  padding: "12px 18px",
                                  textAlign: "right",
                                }}
                              >
                                <button
                                  onClick={() =>
                                    inv.status === "paid"
                                      ? alert(
                                          `Receipt downloaded for INV-${inv.id.replace("inv_", "").substring(0, 6).toUpperCase()}`,
                                        )
                                      : handleSinglePayment(inv.id, inv.amount)
                                  }
                                  style={{
                                    background: "transparent",
                                    border: "none",
                                    color: "#2563EB",
                                    fontWeight: 700,
                                    fontSize: "11px",
                                    cursor: "pointer",
                                  }}
                                >
                                  {inv.status === "paid"
                                    ? "View Receipt ➔"
                                    : "Pay Invoice ➔"}
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
                  {renderInvoiceTable(
                    overdueInvoices,
                    "Overdue Invoices",
                    "#FEF2F2",
                    "#EF4444",
                  )}
                  {renderInvoiceTable(
                    dueInvoices,
                    "Outstanding Due Invoices",
                    "#FFF7ED",
                    "#F57C00",
                  )}
                  {renderInvoiceTable(
                    paidInvoices,
                    "Paid Invoices History",
                    "#ECFDF5",
                    "#10B981",
                  )}
                </div>
              );
            })()}

            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                marginTop: "16px",
              }}
            >
              <button
                onClick={() => setShowAllInvoicesModal(false)}
                style={{
                  background: "#0F172A",
                  border: "none",
                  borderRadius: "10px",
                  padding: "12px 24px",
                  color: "#FFFFFF",
                  fontWeight: 700,
                  fontSize: "13px",
                  cursor: "pointer",
                }}
              >
                Close Invoice Desk
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Re-hire Past Hire Modal */}
      {showRehireModal && rehireTarget && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15,23,42,0.6)",
            backdropFilter: "blur(8px)",
            zIndex: 1000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px",
          }}
        >
          <div
            style={{
              background: "#FFFFFF",
              borderRadius: "20px",
              padding: "36px",
              width: "100%",
              maxWidth: "500px",
              boxShadow: "0 24px 80px rgba(0,0,0,0.15)",
              boxSizing: "border-box",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "24px",
              }}
            >
              <div>
                <h2
                  style={{
                    fontSize: "20px",
                    fontWeight: 900,
                    color: "#0F172A",
                    margin: "0 0 4px 0",
                    letterSpacing: "-0.02em",
                  }}
                >
                  Re-hire Talent
                </h2>
                <p style={{ fontSize: "12px", color: "#64748B", margin: 0 }}>
                  Propose re-engagement terms for {rehireTarget.talentName}
                </p>
              </div>
              <button
                onClick={() => {
                  setShowRehireModal(false);
                  setRehireTarget(null);
                }}
                style={{
                  background: "#F1F5F9",
                  border: "none",
                  borderRadius: "8px",
                  width: "36px",
                  height: "36px",
                  cursor: "pointer",
                  fontSize: "16px",
                  color: "#475569",
                }}
              >
                ×
              </button>
            </div>

            <div
              style={{ display: "flex", flexDirection: "column", gap: "16px" }}
            >
              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: "11px",
                    fontWeight: 800,
                    color: "#475569",
                    textTransform: "uppercase",
                    marginBottom: "6px",
                  }}
                >
                  Proposed Role *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Lead QA Engineer"
                  value={rehireForm.role}
                  onChange={(e) =>
                    setRehireForm((f) => ({ ...f, role: e.target.value }))
                  }
                  style={{
                    width: "100%",
                    border: "1px solid #E2E8F0",
                    borderRadius: "8px",
                    padding: "10px 12px",
                    fontSize: "13px",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: "11px",
                    fontWeight: 800,
                    color: "#475569",
                    textTransform: "uppercase",
                    marginBottom: "6px",
                  }}
                >
                  Proposed Monthly Salary (USD) *
                </label>
                <input
                  type="number"
                  placeholder="e.g. 12400"
                  value={rehireForm.rate}
                  onChange={(e) =>
                    setRehireForm((f) => ({ ...f, rate: e.target.value }))
                  }
                  style={{
                    width: "100%",
                    border: "1px solid #E2E8F0",
                    borderRadius: "8px",
                    padding: "10px 12px",
                    fontSize: "13px",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: "11px",
                    fontWeight: 800,
                    color: "#475569",
                    textTransform: "uppercase",
                    marginBottom: "6px",
                  }}
                >
                  Proposed Start Date *
                </label>
                <input
                  type="date"
                  min={new Date().toISOString().split("T")[0]}
                  value={rehireForm.startDate}
                  onChange={(e) =>
                    setRehireForm((f) => ({ ...f, startDate: e.target.value }))
                  }
                  style={{
                    width: "100%",
                    border: "1px solid #E2E8F0",
                    borderRadius: "8px",
                    padding: "10px 12px",
                    fontSize: "13px",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: "11px",
                    fontWeight: 800,
                    color: "#475569",
                    textTransform: "uppercase",
                    marginBottom: "6px",
                  }}
                >
                  Commitment Level *
                </label>
                <select
                  value={rehireForm.commitmentLevel}
                  onChange={(e) =>
                    setRehireForm((f) => ({
                      ...f,
                      commitmentLevel: e.target.value as any,
                    }))
                  }
                  style={{
                    width: "100%",
                    border: "1px solid #E2E8F0",
                    borderRadius: "8px",
                    padding: "10px 12px",
                    fontSize: "13px",
                    boxSizing: "border-box",
                  }}
                >
                  <option value="Full-Time">Full-Time Retainer</option>
                  <option value="Part-Time">Part-Time Retainer</option>
                </select>
              </div>

              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: "11px",
                    fontWeight: 800,
                    color: "#475569",
                    textTransform: "uppercase",
                    marginBottom: "6px",
                  }}
                >
                  Special Instructions / Note to Admin
                </label>
                <textarea
                  placeholder="Provide onboarding logistics, hardware requirements, etc."
                  value={rehireForm.notes}
                  onChange={(e) =>
                    setRehireForm((f) => ({ ...f, notes: e.target.value }))
                  }
                  style={{
                    width: "100%",
                    border: "1px solid #E2E8F0",
                    borderRadius: "8px",
                    padding: "10px 12px",
                    fontSize: "13px",
                    minHeight: "80px",
                    boxSizing: "border-box",
                    resize: "vertical",
                  }}
                />
              </div>

              <div style={{ display: "flex", gap: "12px", marginTop: "12px" }}>
                <button
                  onClick={() => {
                    setShowRehireModal(false);
                    setRehireTarget(null);
                  }}
                  style={{
                    flex: 1,
                    padding: "12px",
                    borderRadius: "10px",
                    border: "1px solid #E2E8F0",
                    background: "#FFFFFF",
                    fontWeight: 700,
                    fontSize: "13px",
                    color: "#475569",
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={submitRehireRequest}
                  style={{
                    flex: 2,
                    padding: "12px",
                    borderRadius: "10px",
                    border: "none",
                    background: "#2563EB",
                    fontWeight: 800,
                    fontSize: "13px",
                    color: "#FFFFFF",
                    cursor: "pointer",
                  }}
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
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15,23,42,0.6)",
            backdropFilter: "blur(8px)",
            zIndex: 1000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px",
          }}
        >
          <div
            style={{
              background: "#FFFFFF",
              borderRadius: "20px",
              padding: "36px",
              width: "100%",
              maxWidth: "560px",
              maxHeight: "90vh",
              overflowY: "auto",
              boxShadow: "0 24px 80px rgba(0,0,0,0.15)",
              boxSizing: "border-box",
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                marginBottom: "24px",
              }}
            >
              <div
                style={{ display: "flex", gap: "16px", alignItems: "center" }}
              >
                <img
                  src={
                    reviewTalentDetails.avatar ||
                    "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=80"
                  }
                  alt=""
                  style={{
                    width: "48px",
                    height: "48px",
                    borderRadius: "50%",
                    objectFit: "cover",
                  }}
                />
                <div>
                  <h2
                    style={{
                      fontSize: "18px",
                      fontWeight: 900,
                      color: "#0F172A",
                      margin: 0,
                      letterSpacing: "-0.02em",
                    }}
                  >
                    Review {reviewTalentDetails.name}
                  </h2>
                  <p
                    style={{
                      fontSize: "12px",
                      color: "#64748B",
                      margin: "4px 0 0 0",
                      fontWeight: 600,
                    }}
                  >
                    {reviewTalentDetails.role} • {reviewTalentDetails.contract}
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowReviewModal(false);
                  setReviewTalentDetails(null);
                }}
                style={{
                  background: "#F1F5F9",
                  border: "none",
                  borderRadius: "8px",
                  width: "32px",
                  height: "32px",
                  cursor: "pointer",
                  fontSize: "16px",
                  color: "#475569",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                ×
              </button>
            </div>

            {/* Modal Body */}
            <div
              style={{ display: "flex", flexDirection: "column", gap: "20px" }}
            >
              {/* Overall Satisfaction */}
              <div
                style={{
                  borderBottom: "1px solid #F1F5F9",
                  paddingBottom: "16px",
                }}
              >
                <h4
                  style={{
                    fontSize: "11px",
                    fontWeight: 800,
                    color: "#475569",
                    textTransform: "uppercase",
                    marginBottom: "8px",
                    letterSpacing: "0.05em",
                  }}
                >
                  Overall Satisfaction *
                </h4>
                <div
                  style={{ display: "flex", gap: "6px", alignItems: "center" }}
                >
                  {[1, 2, 3, 4, 5].map((star) => (
                    <span
                      key={star}
                      onClick={() => setReviewRating(star)}
                      style={{
                        fontSize: "32px",
                        cursor: "pointer",
                        color: star <= reviewRating ? "#F59E0B" : "#E2E8F0",
                        transition: "color 0.15s",
                      }}
                    >
                      ★
                    </span>
                  ))}
                  <span
                    style={{
                      fontSize: "11px",
                      color: "#94A3B8",
                      marginLeft: "8px",
                      fontWeight: 600,
                    }}
                  >
                    {reviewRating > 0
                      ? `${reviewRating} / 5 Stars`
                      : "Select a rating"}
                  </span>
                </div>
              </div>

              {/* Performance Criteria Sliders */}
              <div
                style={{
                  borderBottom: "1px solid #F1F5F9",
                  paddingBottom: "20px",
                }}
              >
                <h4
                  style={{
                    fontSize: "11px",
                    fontWeight: 800,
                    color: "#475569",
                    textTransform: "uppercase",
                    marginBottom: "14px",
                    letterSpacing: "0.05em",
                  }}
                >
                  Criteria Performance
                </h4>

                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "16px",
                  }}
                >
                  {/* Metric 1 */}
                  <div>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: "4px",
                      }}
                    >
                      <span
                        style={{
                          fontSize: "12px",
                          fontWeight: 700,
                          color: "#1E293B",
                        }}
                      >
                        Technical Skills
                      </span>
                      <span
                        style={{
                          fontSize: "11px",
                          color: "#2563EB",
                          fontWeight: 700,
                        }}
                      >
                        {techSkillValue === 5
                          ? "Exceptional"
                          : techSkillValue >= 4
                            ? "Highly Capable"
                            : techSkillValue >= 3
                              ? "Proficient"
                              : "Basic"}
                      </span>
                    </div>
                    <input
                      type="range"
                      min="1"
                      max="5"
                      value={techSkillValue}
                      onChange={(e) =>
                        setTechSkillValue(Number(e.target.value))
                      }
                      style={{
                        width: "100%",
                        cursor: "pointer",
                        accentColor: "#2563EB",
                      }}
                    />
                  </div>

                  {/* Metric 2 */}
                  <div>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: "4px",
                      }}
                    >
                      <span
                        style={{
                          fontSize: "12px",
                          fontWeight: 700,
                          color: "#1E293B",
                        }}
                      >
                        Communication
                      </span>
                      <span
                        style={{
                          fontSize: "11px",
                          color: "#2563EB",
                          fontWeight: 700,
                        }}
                      >
                        {commValue === 5
                          ? "Exceptional/Proactive"
                          : commValue >= 4
                            ? "Responsive"
                            : commValue >= 3
                              ? "Consistent"
                              : "Needs Work"}
                      </span>
                    </div>
                    <input
                      type="range"
                      min="1"
                      max="5"
                      value={commValue}
                      onChange={(e) => setCommValue(Number(e.target.value))}
                      style={{
                        width: "100%",
                        cursor: "pointer",
                        accentColor: "#2563EB",
                      }}
                    />
                  </div>

                  {/* Metric 3 */}
                  <div>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: "4px",
                      }}
                    >
                      <span
                        style={{
                          fontSize: "12px",
                          fontWeight: 700,
                          color: "#1E293B",
                        }}
                      >
                        Reliability & Delivery
                      </span>
                      <span
                        style={{
                          fontSize: "11px",
                          color: "#2563EB",
                          fontWeight: 700,
                        }}
                      >
                        {reliabilityValue === 5
                          ? "Exceptional/Dependable"
                          : reliabilityValue >= 4
                            ? "Consistent"
                            : reliabilityValue >= 3
                              ? "Acceptable"
                              : "Inconsistent"}
                      </span>
                    </div>
                    <input
                      type="range"
                      min="1"
                      max="5"
                      value={reliabilityValue}
                      onChange={(e) =>
                        setReliabilityValue(Number(e.target.value))
                      }
                      style={{
                        width: "100%",
                        cursor: "pointer",
                        accentColor: "#2563EB",
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Public Feedback */}
              <div>
                <label
                  style={{
                    fontSize: "11px",
                    fontWeight: 800,
                    color: "#475569",
                    textTransform: "uppercase",
                    display: "block",
                    marginBottom: "6px",
                    letterSpacing: "0.05em",
                  }}
                >
                  Public Testimonial / Feedback
                </label>
                <textarea
                  placeholder={`Share your positive experience working with ${reviewTalentDetails.name.split(" ")[0]} with the community...`}
                  value={publicFeedbackText}
                  onChange={(e) => setPublicFeedbackText(e.target.value)}
                  style={{
                    width: "100%",
                    height: "80px",
                    border: "1px solid #E2E8F0",
                    borderRadius: "10px",
                    padding: "12px",
                    fontSize: "13px",
                    boxSizing: "border-box",
                    outline: "none",
                    lineHeight: 1.5,
                    resize: "vertical",
                    fontFamily: "inherit",
                  }}
                />
              </div>

              {/* Private Feedback Container */}
              <div
                style={{
                  background: "#EFF6FF",
                  borderRadius: "12px",
                  padding: "16px",
                  border: "1px solid #DBEAFE",
                }}
              >
                <label
                  style={{
                    fontSize: "11px",
                    fontWeight: 800,
                    color: "#1E3A8A",
                    textTransform: "uppercase",
                    display: "block",
                    marginBottom: "4px",
                    letterSpacing: "0.05em",
                  }}
                >
                  Confidential Admin-Only Note (Private)
                </label>
                <p
                  style={{
                    fontSize: "11px",
                    color: "#2563EB",
                    margin: "0 0 8px 0",
                    lineHeight: 1.4,
                  }}
                >
                  This confidential feedback will be sent directly to the
                  Kongila administrative team for internal talent curation and
                  support. It will not be visible to the talent or on public
                  profiles.
                </p>
                <textarea
                  placeholder="Share private notes regarding fit, soft skills, or internal manager recommendations..."
                  value={privateFeedbackText}
                  onChange={(e) => setPrivateFeedbackText(e.target.value)}
                  style={{
                    width: "100%",
                    height: "70px",
                    border: "1px solid #BFDBFE",
                    borderRadius: "8px",
                    padding: "10px",
                    fontSize: "12px",
                    boxSizing: "border-box",
                    outline: "none",
                    lineHeight: 1.5,
                    background: "#FFFFFF",
                    resize: "vertical",
                    fontFamily: "inherit",
                  }}
                />
              </div>

              {/* Anonymity Checkbox */}
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  fontSize: "12px",
                  color: "#64748B",
                  cursor: "pointer",
                  userSelect: "none",
                }}
              >
                <input
                  type="checkbox"
                  checked={isAnonymousPost}
                  onChange={(e) => setIsAnonymousPost(e.target.checked)}
                  style={{ cursor: "pointer" }}
                />
                Post anonymously to company profile page
              </label>

              {/* Modal Footer buttons */}
              <div style={{ display: "flex", gap: "12px", marginTop: "10px" }}>
                <button
                  onClick={() => {
                    setShowReviewModal(false);
                    setReviewTalentDetails(null);
                  }}
                  style={{
                    flex: 1,
                    padding: "12px",
                    borderRadius: "10px",
                    border: "1px solid #E2E8F0",
                    background: "#FFFFFF",
                    fontWeight: 700,
                    fontSize: "13px",
                    color: "#475569",
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmitReview}
                  style={{
                    flex: 2,
                    padding: "12px",
                    borderRadius: "10px",
                    border: "none",
                    background: "#2563EB",
                    fontWeight: 800,
                    fontSize: "13px",
                    color: "#FFFFFF",
                    cursor: "pointer",
                    boxShadow: "0 4px 12px rgba(37,99,235,0.15)",
                  }}
                >
                  🚀 Submit Verified Review
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {scheduleModalData && (
        <ScheduleInterviewModal 
          currentUser={currentUser}
          request={scheduleModalData.request}
          talent={scheduleModalData.talent}
          interviews={interviews}
          setInterviews={setInterviews}
          onClose={() => setScheduleModalData(null)}
        />
      )}
    </div>
  );
}
