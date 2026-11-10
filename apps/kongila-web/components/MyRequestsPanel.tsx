import {
  isActiveRequestStatus,
  isHiredRequestStatus,
  isClosedRequestStatus,
  isEditableRequestStatus,
  clientStatusView,
  CLIENT_JOURNEY_STEPS
} from '@kongila/workflows';
import { requestTitle, requestHeadcount } from '@kongila/shared-types';
import React, { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { apiFetch } from "../lib/apiFetch";

interface MyRequestsPanelProps {
  currentUser: any;
  requests: any[];
  matches: any[];
  conversations: any[];
  interviews: any[];
  contracts: any[];
  talents: any[];
  messages: any[];
  requestActivityLogs: any[];
  /** Applies a request the server has just confirmed back into the list. */
  onRequestUpdated?: (request: any) => void;
  setConversations?: (conversations: any[]) => void;
  setMessages?: (messages: any[]) => void;
  onSignContract: () => void;
  onExtendOffer: (talent: any, request: any, match: any) => void;
  onScheduleCandidateInterview: (talent: any, request: any, match: any) => void;
  onRejectCandidate: (match: any, reason: string) => Promise<void>;
  matchingShortlistedState: Record<string, boolean>;
  handleShortlistToggle: (candId: string, candName: string, requestId?: string) => void;
  detailsViewRequestId: string | null;
  setDetailsViewRequestId: (id: string | null) => void;
}

const Card = ({ children, style, onClick }: { children: React.ReactNode, style?: React.CSSProperties, onClick?: () => void }) => (
  <div onClick={onClick} style={{ background: '#FFF', borderRadius: '16px', padding: '24px', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', boxSizing: 'border-box', ...style }}>
    {children}
  </div>
);

const Button = ({ children, variant = 'primary', onClick, style, disabled }: { children: React.ReactNode, variant?: 'primary' | 'outline', onClick?: () => void, style?: React.CSSProperties, disabled?: boolean }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    style={{
      padding: '8px 16px',
      borderRadius: '8px',
      fontSize: '14px',
      fontWeight: 600,
      cursor: disabled ? 'not-allowed' : 'pointer',
      opacity: disabled ? 0.55 : 1,
      border: variant === 'outline' ? '1px solid #CBD5E1' : 'none',
      background: variant === 'outline' ? 'transparent' : '#2563EB',
      color: variant === 'outline' ? '#0F172A' : '#FFF',
      ...style
    }}
  >
    {children}
  </button>
);

const TextInput = ({ label, value, onChange, type = 'text', placeholder, style }: { label?: string, value: any, onChange: (e: React.ChangeEvent<HTMLInputElement>) => void, type?: string, placeholder?: string, style?: React.CSSProperties }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', ...style }}>
    {label && <label style={{ fontSize: '13px', fontWeight: 600, color: '#475569' }}>{label}</label>}
    <input 
      type={type} 
      value={value} 
      onChange={onChange} 
      placeholder={placeholder}
      style={{ padding: '10px 12px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '14px', color: '#0F172A', background: '#FFF' }}
    />
  </div>
);

const Select = ({ label, value, onChange, options }: { label: string, value: any, onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void, options: {label: string, value: string}[] }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
    <label style={{ fontSize: '13px', fontWeight: 600, color: '#475569' }}>{label}</label>
    <select 
      value={value} 
      onChange={onChange}
      style={{ padding: '10px 12px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '14px', color: '#0F172A', background: '#FFF' }}
    >
      <option value="">Select an option</option>
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  </div>
);

const TextArea = ({ label, value, onChange, placeholder, rows = 4, hint }: { label: string, value: any, onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void, placeholder?: string, rows?: number, hint?: string }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
    <label style={{ fontSize: '13px', fontWeight: 600, color: '#475569' }}>{label}</label>
    <textarea
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      rows={rows}
      style={{ padding: '10px 12px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '14px', color: '#0F172A', background: '#FFF', fontFamily: 'inherit', lineHeight: 1.6, resize: 'vertical' }}
    />
    {hint && <div style={{ fontSize: '12px', color: '#64748B' }}>{hint}</div>}
  </div>
);

/**
 * The service types the product accepts, as SERVICE_TYPES in
 * pages/api/requests/index.ts spells them.
 *
 * The edit form used to offer "Technical" and "Design" here. Neither is a
 * service type: the server checks the value against that set and answers 422,
 * so a client who touched this select could not save the request at all, and
 * the failure came back as "check console for details".
 */
const SERVICE_TYPE_OPTIONS = [
  { value: 'Hire Talent', label: 'Hire Talent — a permanent or contract hire' },
  { value: 'Outsource Talent', label: 'Outsource Talent — a team working to your brief' },
  { value: 'Managed Workforce', label: 'Managed Workforce — a team Kongila manages for you' },
  { value: 'Project Execution', label: 'Project Execution — a defined piece of work' }
];

export default function MyRequestsPanel({
  currentUser,
  requests,
  matches,
  conversations,
  interviews,
  contracts,
  talents,
  messages,
  requestActivityLogs,
  onRequestUpdated,
  setConversations,
  setMessages,
  onSignContract,
  onExtendOffer,
  onScheduleCandidateInterview,
  onRejectCandidate,
  matchingShortlistedState,
  handleShortlistToggle,
  detailsViewRequestId,
  setDetailsViewRequestId
}: MyRequestsPanelProps) {
  const [activeTab, setActiveTab] = useState<"All" | "Active" | "Hired" | "Closed/Cancelled">("All");
  const [searchQuery, setSearchQuery] = useState("");
  
  // Detail View State
  const [detailSubTab, setDetailSubTab] = useState<"Overview" | "Request Details" | "Matched Talent" | "Interviews" | "Contracts" | "Messages" | "Activity Log">("Overview");

  // Editing state
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<any>({});
  const [editError, setEditError] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [savedNotice, setSavedNotice] = useState('');
  const [callResponseDate, setCallResponseDate] = useState('');
  const [callResponseNote, setCallResponseNote] = useState('');
  const [respondingToCallId, setRespondingToCallId] = useState<string | null>(null);
  const [callResponseError, setCallResponseError] = useState('');
  const [rejectingMatchId, setRejectingMatchId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [rejectionError, setRejectionError] = useState('');
  const [requestConversations, setRequestConversations] = useState(conversations);
  const [requestMessages, setRequestMessages] = useState(messages);
  const [requestMessageDraft, setRequestMessageDraft] = useState('');
  const [requestMessageError, setRequestMessageError] = useState('');
  const [requestMessageWarning, setRequestMessageWarning] = useState('');
  const [requestMessageLoadError, setRequestMessageLoadError] = useState('');
  const [isSendingRequestMessage, setIsSendingRequestMessage] = useState(false);
  const [isMarkingRequestMessagesRead, setIsMarkingRequestMessagesRead] = useState(false);

  const normalizeConversation = (conversation: any) => ({
    ...conversation,
    context_type: conversation.contextType ?? conversation.context_type,
    context_id: conversation.contextId ?? conversation.context_id,
    participant_ids: conversation.participantIds ?? conversation.participant_ids,
    client_id: conversation.clientId ?? conversation.client_id ?? currentUser?.id
  });

  const normalizeMessage = (message: any) => ({
    ...message,
    conversation_id: message.conversationId ?? message.conversation_id,
    sender_id: message.senderId ?? message.sender_id,
    is_read: message.isRead ?? message.is_read,
    created_at: message.timestamp ?? message.created_at
  });

  const applyMessagingPayload = (payload: any) => {
    const nextConversations = (payload.conversations || []).map(normalizeConversation);
    const nextMessages = (payload.messages || []).map(normalizeMessage);
    setRequestConversations(nextConversations);
    setRequestMessages(nextMessages);
    setConversations?.(nextConversations);
    setMessages?.(nextMessages);
  };

  useEffect(() => {
    setRequestConversations((conversations || []).map(normalizeConversation));
  }, [conversations]);

  useEffect(() => {
    setRequestMessages((messages || []).map(normalizeMessage));
  }, [messages]);

  useEffect(() => {
    let active = true;
    const refreshMessages = async () => {
      try {
        const response = await apiFetch('/api/messages');
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload?.error || 'Request messages could not be loaded.');
        if (active) {
          applyMessagingPayload(payload);
          setRequestMessageLoadError('');
        }
      } catch (error: any) {
        if (active) setRequestMessageLoadError(error?.message || 'Request messages could not be loaded.');
      }
    };

    void refreshMessages();
    const interval = setInterval(refreshMessages, 5000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  const getRequestConversation = (requestId: string) => requestConversations.find((conversation: any) =>
    ['request', 'service_request', 'talent_request'].includes(
      String(conversation.contextType ?? conversation.context_type ?? '').toLowerCase()
    )
    && String(conversation.contextId ?? conversation.context_id) === String(requestId)
  );

  const getRequestUnreadCount = (requestId: string) => {
    const conversation = getRequestConversation(requestId);
    if (!conversation) return 0;
    return requestMessages.filter((message: any) =>
      String(message.conversationId ?? message.conversation_id) === String(conversation.id)
      && String(message.senderId ?? message.sender_id) !== String(currentUser?.id)
      && !(message.isRead ?? message.is_read)
    ).length;
  };

  const sendRequestMessage = async (request: any) => {
    const content = requestMessageDraft.trim();
    if (!content || isSendingRequestMessage) return;
    setIsSendingRequestMessage(true);
    setRequestMessageError('');
    setRequestMessageWarning('');
    try {
      let conversation = getRequestConversation(request.id);
      if (!conversation) {
        const startResponse = await apiFetch('/api/messages', {
          method: 'POST',
          body: JSON.stringify({
            action: 'start',
            type: 'client_admin',
            contextType: 'request',
            contextId: request.id
          })
        });
        const startBody = await startResponse.json().catch(() => ({}));
        if (!startResponse.ok) throw new Error(startBody?.error || 'The role conversation could not be started.');
        conversation = normalizeConversation(startBody.data);
        const next = [...requestConversations.filter((item: any) => item.id !== conversation.id), conversation];
        setRequestConversations(next);
        setConversations?.(next);
      }

      const response = await apiFetch('/api/messages', {
        method: 'POST',
        body: JSON.stringify({ conversationId: conversation.id, content })
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body?.error || 'Your message could not be sent.');
      const nextMessages = [...requestMessages, normalizeMessage(body.data)];
      setRequestMessages(nextMessages);
      setMessages?.(nextMessages);
      if (body.warnings?.length) {
        setRequestMessageWarning(`Message sent, but email delivery needs attention: ${body.warnings.join(' ')}`);
      }
      setRequestMessageDraft('');
    } catch (error: any) {
      setRequestMessageError(error?.message || 'Your message could not be sent.');
    } finally {
      setIsSendingRequestMessage(false);
    }
  };

  const handleRespondToCall = async (request: any, call: any) => {
    if (!callResponseDate || respondingToCallId) return;
    setRespondingToCallId(String(call.id));
    setCallResponseError('');
    try {
      const response = await apiFetch('/api/requests/call', {
        method: 'POST',
        body: JSON.stringify({
          callRequestId: call.id,
          preferredTimes: [new Date(callResponseDate).toISOString()],
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
          note: callResponseNote.trim()
        })
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || 'Your preferred time could not be sent.');
      if (onRequestUpdated) {
        onRequestUpdated({
          ...request,
          callRequests: (request.callRequests || []).map((item: any) =>
            item.id === call.id ? body.callRequest : item
          )
        });
      }
      setCallResponseDate('');
      setCallResponseNote('');
    } catch (error: any) {
      setCallResponseError(error?.message || 'Your preferred time could not be sent.');
    } finally {
      setRespondingToCallId(null);
    }
  };

  const handleRejectCandidate = async (match: any) => {
    if (!rejectionReason || rejectingMatchId !== String(match.id)) return;
    setRejectionError('');
    try {
      await onRejectCandidate(match, rejectionReason);
      setRejectingMatchId(null);
      setRejectionReason('');
    } catch (error: any) {
      setRejectionError(error?.message || 'The candidate rejection could not be saved.');
    }
  };

  const filteredRequests = requests.filter((req: any) => {
    // Tab filtering
    // These tabs used a third status vocabulary of their own, lowercase and
    // underscored, that nothing in the product ever wrote. Active showed only
    // requests sitting at Reviewing, and Hired could never show anything.
    if (activeTab === "Active" && !isActiveRequestStatus(req.status)) return false;
    if (activeTab === "Hired" && !isHiredRequestStatus(req.status)) return false;
    if (activeTab === "Closed/Cancelled" && !isClosedRequestStatus(req.status)) return false;
    
    // Search filtering
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const title = `${requestTitle(req)} ${req.roleDescription || ""}`.toLowerCase();
      const idStr = (req.id || "").toLowerCase();
      if (!title.includes(q) && !idStr.includes(q)) return false;
    }
    return true;
  });

  const handleEditClick = (req: any) => {
    // A request is for one role, so the form edits that request's own
    // fields. It used to normalise the request into a roles array and edit
    // that, which made sense while one request could hold several; now each
    // role is its own request and an array here would be editing a thing
    // that no longer exists.
    setEditForm({ ...req });
    setEditError('');
    setSavedNotice('');
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditForm({});
    setEditError('');
  };

  // Everything a client may change about a request, matching CLIENT_EDITABLE
  // in pages/api/requests/index.ts. Sending a field outside that set is
  // dropped by the server rather than rejected, so the two lists are kept in
  // step deliberately. `status` is absent from both: a request's stage belongs
  // to operations, and cancelling is a separate action further down.
  const EDITABLE_FIELDS = [
    // This request's own role. `roles` is gone: a request is for one role,
    // so there is no array to edit.
    'roleTitle', 'roleDescription', 'seniorityLevel', 'requiredSkills', 'numberOfHires',
    'teamDescription', 'serviceDescription', 'projectName', 'projectDescription',
    'serviceType', 'teamSize',
    'startDate', 'durationType', 'durationMonths', 'commitmentLevel',
    'currency', 'budgetMinUsd', 'budgetMaxUsd', 'budgetUnknown',
    'urgencyLevel', 'additionalNotes'
  ];

  const handleSaveEdit = async () => {
    if (!editForm.id) return;
    setEditError('');
    setIsSavingEdit(true);
    try {
      const selectedReq = requests.find((r) => r.id === editForm.id) || {};

      // Only what actually changed. Sending the whole form back rewrote every
      // field on every save, so an untouched answer was rewritten with
      // whatever the form had coerced it to — a number field read back as a
      // string, an empty select as "".
      const patch: any = {};
      for (const key of EDITABLE_FIELDS) {
        if (!Object.prototype.hasOwnProperty.call(editForm, key)) continue;
        if (JSON.stringify(editForm[key]) === JSON.stringify(selectedReq[key])) continue;
        patch[key] = editForm[key];
      }

      if (Object.prototype.hasOwnProperty.call(patch, 'roleTitle') && !String(patch.roleTitle || '').trim()) {
        setEditError('Please give the role a title.');
        setIsSavingEdit(false);
        return;
      }

      if (Object.keys(patch).length === 0) {
        setIsEditing(false);
        setIsSavingEdit(false);
        return;
      }

      // Requests live in talent_requests, which keeps the whole request in a
      // jsonb payload. This used to update service_requests, which the product
      // never writes to, so edits appeared to save and vanished on reload.
      const response = await apiFetch('/api/requests', {
        method: 'PATCH',
        body: JSON.stringify({ requestId: editForm.id, patch })
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || 'This request could not be updated.');

      // The server returns the saved request. Putting it straight back into
      // the list is what makes the change visible: this used to show an alert
      // telling the client their edit would appear "upon page reload", which
      // is a reload they had no reason to expect and no prompt to perform.
      if (body.request && onRequestUpdated) onRequestUpdated(body.request);

      setSavedNotice('Your changes have been saved and your Kongila team can see them.');
      setIsEditing(false);
    } catch (err: any) {
      // The server explains why — the brief is fixed at this stage, or the
      // stage is not the client's to set. Showing that beats "check console".
      setEditError(err?.message || 'This request could not be updated.');
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleCancelRequest = async (request: any) => {
    const sure = typeof window !== 'undefined' && window.confirm(
      `Cancel this request?\n\nYour Kongila team will stop work on it. This cannot be undone — `
      + `you would need to file a new request to pick it back up.`
    );
    if (!sure) return;
    setEditError('');
    try {
      const response = await apiFetch('/api/requests', {
        method: 'PATCH',
        body: JSON.stringify({ requestId: request.id, patch: { cancel: true } })
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || 'This request could not be cancelled.');
      if (body.request && onRequestUpdated) onRequestUpdated(body.request);
      setSavedNotice('This request has been cancelled.');
    } catch (err: any) {
      setEditError(err?.message || 'This request could not be cancelled.');
    }
  };

  useEffect(() => {
    if (!detailsViewRequestId) return;
    if (getRequestUnreadCount(detailsViewRequestId) > 0) setDetailSubTab('Messages');
  }, [detailsViewRequestId, requestConversations, requestMessages]);

  useEffect(() => {
    if (!detailsViewRequestId || detailSubTab !== 'Messages' || isMarkingRequestMessagesRead) return;
    const conversation = getRequestConversation(detailsViewRequestId);
    if (!conversation) return;
    const hasUnread = getRequestUnreadCount(detailsViewRequestId) > 0;
    if (!hasUnread) return;

    setIsMarkingRequestMessagesRead(true);
    apiFetch('/api/messages', {
      method: 'POST',
      body: JSON.stringify({ action: 'markRead', conversationId: conversation.id })
    }).then(async (response) => {
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body?.error || 'Messages could not be marked as read.');
      const nextMessages = requestMessages.map((message: any) =>
        String(message.conversationId ?? message.conversation_id) === String(conversation.id)
          && String(message.senderId ?? message.sender_id) !== String(currentUser?.id)
          ? { ...message, isRead: true, is_read: true }
          : message
      );
      setRequestMessages(nextMessages);
      setMessages?.(nextMessages);
    }).catch((error: any) => {
      setRequestMessageError(error?.message || 'Messages could not be marked as read.');
    }).finally(() => {
      setIsMarkingRequestMessagesRead(false);
    });
  }, [detailsViewRequestId, detailSubTab, requestConversations, requestMessages, isMarkingRequestMessagesRead]);

  if (detailsViewRequestId) {
    const request = requests.find((r) => r.id === detailsViewRequestId);
    if (!request) return <div>Request not found</div>;

    const isEditable = isEditableRequestStatus(request.status);
    const relatedLogs = requestActivityLogs.filter((log) => log.requestId === request.id).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    const requestMatches = matches.filter((m) => String(m.requestId) === String(request.id));
    const requestInterviews = interviews.filter((interview) =>
      String(interview.requestId) === String(request.id)
    );
    const requestContracts = contracts.filter((c) => c.matchId?.includes(request.id) || requestMatches.some(m => c.matchId === m.id));
    const requestConversation = getRequestConversation(request.id);
    const requestConversationMessages = requestMessages.filter((message: any) =>
      requestConversation
        ? String(message.conversationId ?? message.conversation_id) === String(requestConversation.id)
        : String(message.requestId ?? message.request_id ?? message.threadId) === String(request.id)
    ).sort((a: any, b: any) =>
      new Date(a.timestamp || a.created_at || 0).getTime() - new Date(b.timestamp || b.created_at || 0).getTime()
    );
    const requestUnreadCount = getRequestUnreadCount(request.id);

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "24px", maxWidth: "1200px", margin: "0 auto", padding: "32px" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <button
            onClick={() => setDetailsViewRequestId(null)}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "40px",
              height: "40px",
              borderRadius: "50%",
              backgroundColor: "#F1F5F9",
              color: "#64748B",
            }}
          >
            ←
          </button>
          <div>
            <h2 style={{ fontSize: "24px", fontWeight: 800, color: "#0F172A", margin: 0 }}>
              {requestTitle(request)}
            </h2>
            <div style={{ fontSize: "14px", color: "#64748B", marginTop: "4px" }}>
              Ref: {request.referenceNumber || request.id} • Submitted on {new Date(request.createdAt).toLocaleDateString()}
            </div>
          </div>
          <div style={{ marginLeft: "auto" }}>
            <span
              style={{
                display: "inline-block",
                padding: "6px 12px",
                borderRadius: "20px",
                fontSize: "13px",
                fontWeight: 700,
                backgroundColor: isEditable ? "#DBEAFE" : "#F1F5F9",
                color: isEditable ? "#1E40AF" : "#475569",
              }}
            >
              Status: {request.status || "Reviewing"}
            </span>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div style={{ display: "flex", gap: "8px", borderBottom: "1px solid #E2E8F0", paddingBottom: "16px", overflowX: 'auto' }}>
          {["Overview", "Request Details", `Matched Talent${requestMatches.length ? ` (${requestMatches.length})` : ""}`, "Interviews", "Contracts", `Messages${requestUnreadCount ? ` (${requestUnreadCount} new)` : ""}`, "Activity Log"].map((tab) => (
            <button
              key={tab}
              onClick={() => setDetailSubTab(tab.startsWith("Matched Talent") ? "Matched Talent" : tab.startsWith("Messages") ? "Messages" : tab as any)}
              style={{
                padding: "8px 16px",
                borderRadius: "20px",
                fontSize: "14px",
                fontWeight: (tab.startsWith("Matched Talent") ? detailSubTab === "Matched Talent" : detailSubTab === tab) ? 700 : 500,
                color: (tab.startsWith("Matched Talent") ? detailSubTab === "Matched Talent" : detailSubTab === tab) ? "#FFFFFF" : "#64748B",
                backgroundColor: (tab.startsWith("Matched Talent") ? detailSubTab === "Matched Talent" : detailSubTab === tab) ? "#0F172A" : "transparent",
                border: "none",
                cursor: "pointer",
                transition: "all 0.2s",
                whiteSpace: "nowrap"
              }}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {detailSubTab === "Overview" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
            <Card>
              <h3 style={{ fontSize: "16px", fontWeight: 800, margin: 0, marginBottom: "16px" }}>Request Summary</h3>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                <div>
                  <div style={{ fontSize: "12px", color: "#64748B" }}>Service Type</div>
                  <div style={{ fontSize: "14px", fontWeight: 600 }}>{request.serviceType}</div>
                </div>
                <div>
                  <div style={{ fontSize: "12px", color: "#64748B" }}>Duration</div>
                  <div style={{ fontSize: "14px", fontWeight: 600 }}>{request.duration}</div>
                </div>
                <div>
                  <div style={{ fontSize: "12px", color: "#64748B" }}>Urgency</div>
                  <div style={{ fontSize: "14px", fontWeight: 600 }}>{request.urgency}</div>
                </div>
                <div>
                  <div style={{ fontSize: "12px", color: "#64748B" }}>People wanted</div>
                  <div style={{ fontSize: "14px", fontWeight: 600 }}>
                    {requestHeadcount(request)}
                  </div>
                </div>
              </div>
            </Card>

            {/* The other roles from the same brief.
                A brief with three roles files three requests, and they are
                siblings, not a parent and two children. This used to list
                the other two inside the first, which made them look like
                sub-items of a role they have nothing to do with and gave
                them nowhere of their own to be tracked, closed or edited. */}
            {(() => {
              const siblings = request.requestGroupId
                ? requests.filter((r: any) =>
                    r.requestGroupId === request.requestGroupId && r.id !== request.id)
                : [];
              if (siblings.length === 0) return null;

              return (
                <Card>
                  <h3 style={{ fontSize: "16px", fontWeight: 800, margin: 0, marginBottom: "6px" }}>
                    Filed with this one
                  </h3>
                  <p style={{ fontSize: "13px", color: "#64748B", margin: "0 0 16px 0", lineHeight: 1.6 }}>
                    You asked for these at the same time. Each is sourced separately, so
                    they move at their own pace.
                  </p>
                  <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                    {siblings.map((sibling: any) => {
                      const view = clientStatusView(sibling.status);
                      return (
                        <button
                          key={sibling.id}
                          onClick={() => setDetailsViewRequestId(sibling.id)}
                          style={{
                            textAlign: "left",
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            gap: "12px",
                            flexWrap: "wrap",
                            padding: "14px 16px",
                            borderRadius: "10px",
                            background: "#F8FAFC",
                            border: "1px solid #E2E8F0",
                            cursor: "pointer",
                          }}
                        >
                          <div style={{ minWidth: "180px" }}>
                            <div style={{ fontSize: "14px", fontWeight: 700, color: "#0F172A" }}>
                              {requestTitle(sibling)}
                            </div>
                            <div style={{ fontSize: "12px", color: "#64748B", marginTop: "2px" }}>
                              {requestHeadcount(sibling)}{" "}
                              {requestHeadcount(sibling) === 1 ? "person" : "people"}
                              {sibling.seniorityLevel ? ` · ${sibling.seniorityLevel}` : ""}
                              {" · "}{sibling.referenceNumber || sibling.id}
                            </div>
                          </div>
                          <span
                            style={{
                              padding: "5px 12px",
                              borderRadius: "999px",
                              fontSize: "12px",
                              fontWeight: 700,
                              background: view.pct >= 100 ? "#ECFDF5" : "#EFF6FF",
                              color: view.pct >= 100 ? "#065F46" : "#1E40AF",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {view.label}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </Card>
              );
            })()}
          </div>
        )}

        {detailSubTab === "Request Details" && (
          <Card>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <h3 style={{ fontSize: "16px", fontWeight: 800, margin: 0 }}>Detailed Requirements</h3>
              <div style={{ display: "flex", gap: "8px" }}>
                {isEditable && !isEditing && (
                  <Button variant="outline" onClick={() => handleEditClick(request)}>
                    Edit request
                  </Button>
                )}
                {!isClosedRequestStatus(request.status) && !isEditing && (
                  <Button
                    variant="outline"
                    onClick={() => handleCancelRequest(request)}
                    style={{ borderColor: "#FCA5A5", color: "#B91C1C" }}
                  >
                    Cancel request
                  </Button>
                )}
              </div>
            </div>

            {/* Why the brief is fixed, said before the client tries to change
                it and is refused. isEditableRequestStatus goes false once
                candidates have been sourced against this brief. */}
            {!isEditable && !isEditing && !isClosedRequestStatus(request.status) && (
              <div style={{ fontSize: "13px", color: "#92400E", background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: "8px", padding: "12px", marginBottom: "16px", lineHeight: 1.6 }}>
                This request has reached <strong>{request.status}</strong>, so its brief is now fixed —
                the candidates you are seeing were sourced against it. To change what you are
                looking for, speak to your account manager and they will revise it with you.
              </div>
            )}

            {savedNotice && !isEditing && (
              <div style={{ fontSize: "13px", color: "#065F46", background: "#ECFDF5", border: "1px solid #A7F3D0", borderRadius: "8px", padding: "12px", marginBottom: "16px" }}>
                {savedNotice}
              </div>
            )}
            {editError && (
              <div style={{ fontSize: "13px", color: "#991B1B", background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: "8px", padding: "12px", marginBottom: "16px", lineHeight: 1.6 }}>
                {editError}
              </div>
            )}

            {isEditing ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                {/* The form used to offer three fields — a one-line role
                    description, a service type whose options were not service
                    types, and a hire count. Everything else the client had
                    answered at intake was uneditable, which is how a request
                    with the wrong budget or start date stayed wrong. */}
                <Select
                  label="Service type"
                  options={SERVICE_TYPE_OPTIONS}
                  value={editForm.serviceType || ""}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setEditForm({ ...editForm, serviceType: e.target.value })}
                />

                {/* This request's own role. It used to edit a roles array,
                    which made sense while one request could hold several;
                    now each role is its own request, so there is one role
                    here and adding another means filing another request. */}
                <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "16px" }}>
                  <TextInput
                    label="Role title"
                    value={editForm.roleTitle || ""}
                    placeholder="Senior Backend Engineer"
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditForm({ ...editForm, roleTitle: e.target.value })}
                  />
                  <TextInput
                    label="How many"
                    type="number"
                    value={editForm.numberOfHires ?? 1}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                      // parseInt on an empty field gives NaN, which went into
                      // the payload and came back as null.
                      const n = parseInt(e.target.value, 10);
                      setEditForm({ ...editForm, numberOfHires: Number.isFinite(n) && n > 0 ? n : 1 });
                    }}
                  />
                </div>

                <TextArea
                  label="What they will be doing"
                  value={editForm.roleDescription || ""}
                  rows={4}
                  placeholder="What this person will own, and what a good first six months looks like."
                  hint="This is what your Kongila team sources against, so detail here saves a round trip."
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setEditForm({ ...editForm, roleDescription: e.target.value })}
                />

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                  <Select
                    label="Seniority"
                    options={[
                      { value: 'Junior (1-3 years)', label: 'Junior (1-3 years)' },
                      { value: 'Mid-level (3-6 years)', label: 'Mid-level (3-6 years)' },
                      { value: 'Senior (6-10 years)', label: 'Senior (6-10 years)' },
                      { value: 'Lead (8-15 years)', label: 'Lead (8-15 years)' },
                      { value: 'Executive (12+ years)', label: 'Executive (12+ years)' }
                    ]}
                    value={editForm.seniorityLevel || ""}
                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setEditForm({ ...editForm, seniorityLevel: e.target.value })}
                  />
                  <Select
                    label="Commitment"
                    options={[
                      { value: 'Full-Time', label: 'Full-time' },
                      { value: 'Part-Time', label: 'Part-time' },
                      { value: 'Contract', label: 'Contract' }
                    ]}
                    value={editForm.commitmentLevel || ""}
                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setEditForm({ ...editForm, commitmentLevel: e.target.value })}
                  />
                </div>

                <TextInput
                  label="Skills you need (comma separated)"
                  value={Array.isArray(editForm.requiredSkills) ? editForm.requiredSkills.join(', ') : (editForm.requiredSkills || "")}
                  placeholder="TypeScript, Postgres, AWS"
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditForm({
                    ...editForm,
                    requiredSkills: e.target.value.split(',').map(s => s.trim()).filter(Boolean)
                  })}
                />

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "16px" }}>
                  <TextInput
                    label="Ideal start date"
                    type="date"
                    value={editForm.startDate ? String(editForm.startDate).slice(0, 10) : ""}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditForm({ ...editForm, startDate: e.target.value })}
                  />
                  <TextInput
                    label={`Budget from (${editForm.currency || 'USD'})`}
                    type="number"
                    value={editForm.budgetMinUsd ?? ""}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditForm({ ...editForm, budgetMinUsd: Number(e.target.value) || 0 })}
                  />
                  <TextInput
                    label={`Budget to (${editForm.currency || 'USD'})`}
                    type="number"
                    value={editForm.budgetMaxUsd ?? ""}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditForm({ ...editForm, budgetMaxUsd: Number(e.target.value) || 0 })}
                  />
                </div>

                <Select
                  label="How soon do you need this"
                  options={[
                    { value: 'ASAP', label: 'As soon as possible' },
                    { value: 'Standard', label: 'Standard — within a few weeks' },
                    { value: 'Flexible', label: 'Flexible — no fixed date' }
                  ]}
                  value={editForm.urgencyLevel || ""}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setEditForm({ ...editForm, urgencyLevel: e.target.value })}
                />

                <TextArea
                  label="Anything else your team should know"
                  value={editForm.additionalNotes || ""}
                  rows={3}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setEditForm({ ...editForm, additionalNotes: e.target.value })}
                />

                <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end", marginTop: "16px" }}>
                  <Button variant="outline" onClick={handleCancelEdit} disabled={isSavingEdit}>Cancel</Button>
                  <Button onClick={handleSaveEdit} disabled={isSavingEdit}>
                    {isSavingEdit ? 'Saving…' : 'Save changes'}
                  </Button>
                </div>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                <div>
                  <div style={{ fontSize: "12px", color: "#64748B", marginBottom: "4px" }}>Role Description</div>
                  <div style={{ fontSize: "14px", color: "#0F172A", padding: "12px", backgroundColor: "#F8FAFC", borderRadius: "8px" }}>
                    {request.roleDescription}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: "12px", color: "#64748B", marginBottom: "4px" }}>Required Skills</div>
                  <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                    {(request.requiredSkills || []).map((skill: string) => (
                      <span key={skill} style={{ padding: "4px 10px", backgroundColor: "#E2E8F0", borderRadius: "12px", fontSize: "12px", fontWeight: 500 }}>
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </Card>
        )}

        {detailSubTab === "Matched Talent" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {requestMatches.length > 0 ? requestMatches.map((match: any) => {
              const talent = talents.find(t => t.id === match.talentId) || { name: match.talentId, title: "Candidate", avatar: "" };
              const isShortlisted = String(match.status).toLowerCase() === 'shortlisted'
                || !!matchingShortlistedState[match.talentId];
              const candidateInterviews = requestInterviews.filter((interview: any) =>
                String(interview.matchId || '') === String(match.id)
                || String(interview.talentId) === String(match.talentId)
              );
              const completedInterview = candidateInterviews.some((interview: any) =>
                String(interview.status).toLowerCase() === 'completed'
              );
              const liveOffer = (request.offers || []).find((offer: any) =>
                String(offer.talentId || offer.talent_id) === String(match.talentId)
                && !['declined', 'expired', 'admin_declined'].includes(
                  String(offer.status).toLowerCase()
                )
              );
              return (
                <Card key={match.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                    <img src={talent.avatar || "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=80&q=80"} alt="" style={{ width: "48px", height: "48px", borderRadius: "12px", objectFit: "cover" }} />
                    <div>
                      <div style={{ fontSize: "15px", fontWeight: 700 }}>{talent.name}</div>
                      <div style={{ fontSize: "13px", color: "#64748B" }}>
                        Matched for {requestTitle(request)} · {talent.title} · {match.score}% match
                      </div>
                      <div style={{ fontSize: "12px", color: "#475569", marginTop: "3px" }}>
                        {liveOffer
                          ? `Offer: ${String(liveOffer.status).replace(/_/g, ' ')}`
                          : candidateInterviews.length
                            ? `Interview: ${String(candidateInterviews[candidateInterviews.length - 1].status).replace(/_/g, ' ')}`
                            : `Match: ${String(match.status || 'proposed').replace(/_/g, ' ')}`}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: "12px" }}>
                    {!['rejected', 'accepted'].includes(String(match.status).toLowerCase()) && (
                      <>
                        <Button variant={isShortlisted ? "primary" : "outline"} disabled={isShortlisted} onClick={() => handleShortlistToggle(match.talentId, talent.name, request.id)}>
                          {isShortlisted ? "Shortlisted" : "Shortlist"}
                        </Button>
                        <Button variant="outline" onClick={() => onScheduleCandidateInterview(talent, request, match)}>
                          Request Interview
                        </Button>
                        <Button variant="outline" onClick={() => {
                          setRejectingMatchId(String(match.id));
                          setRejectionReason('');
                          setRejectionError('');
                        }}>
                          Not a Fit
                        </Button>
                        {completedInterview && !liveOffer && (
                          <Button onClick={() => onExtendOffer(talent, request, match)}>
                            Start Offer
                          </Button>
                        )}
                      </>
                    )}
                  </div>
                  {rejectingMatchId === String(match.id) && (
                    <div style={{ display: "grid", gap: "8px", marginTop: "14px" }}>
                      <label style={{ fontSize: "12px", fontWeight: 600, color: "#475569" }}>
                        Why isn't this candidate a fit?
                        <select
                          value={rejectionReason}
                          onChange={(event) => setRejectionReason(event.target.value)}
                          style={{ display: "block", width: "100%", marginTop: "6px", padding: "9px", border: "1px solid #CBD5E1", borderRadius: "8px" }}
                        >
                          <option value="">Select a reason</option>
                          <option value="Skills mismatch">Skills mismatch</option>
                          <option value="Experience level mismatch">Experience level mismatch</option>
                          <option value="Timezone mismatch">Timezone mismatch</option>
                          <option value="Compensation mismatch">Compensation mismatch</option>
                          <option value="Other">Other</option>
                        </select>
                      </label>
                      {rejectionError && <div role="alert" style={{ color: "#B91C1C", fontSize: "13px" }}>{rejectionError}</div>}
                      <div style={{ display: "flex", gap: "8px" }}>
                        <Button variant="outline" onClick={() => setRejectingMatchId(null)}>Cancel</Button>
                        <Button disabled={!rejectionReason} onClick={() => handleRejectCandidate(match)}>Confirm rejection</Button>
                      </div>
                    </div>
                  )}
                </Card>
              )
            }) : (
              <Card>
                <div style={{ textAlign: "center", padding: "40px", color: "#64748B" }}>
                  <div style={{ margin: "0 auto 16px", opacity: 0.5, fontSize: "32px" }}>👥</div>
                  <div>No matched talent yet. We're working on finding the best candidates for you.</div>
                </div>
              </Card>
            )}

            {request.callRequestWarning && (
              <Card>
                <div role="alert" style={{ color: "#92400E", fontSize: "13px" }}>{request.callRequestWarning}</div>
              </Card>
            )}
            {(request.callRequests || []).length > 0 && (
              <Card>
                <h3 style={{ fontSize: "16px", fontWeight: 800, margin: "0 0 12px" }}>Call with your Kongila team</h3>
                {(request.callRequests || []).map((call: any) => (
                  <div key={call.id} style={{ borderTop: "1px solid #E2E8F0", padding: "14px 0" }}>
                    <div style={{ fontWeight: 700 }}>{String(call.status).replace(/_/g, ' ')}</div>
                    <div style={{ fontSize: "13px", color: "#475569", marginTop: "4px" }}>
                      {call.agenda || "Your Kongila team would like to discuss this role."}
                    </div>
                    {call.status === "requested" ? (
                      <div style={{ marginTop: "12px", display: "grid", gap: "10px" }}>
                        <label style={{ fontSize: "13px", fontWeight: 600 }}>
                          A time that works for you ({Intl.DateTimeFormat().resolvedOptions().timeZone || "your local time"})
                          <input
                            type="datetime-local"
                            value={callResponseDate}
                            onChange={(event) => setCallResponseDate(event.target.value)}
                            style={{ display: "block", marginTop: "6px", padding: "9px 10px", border: "1px solid #CBD5E1", borderRadius: "8px" }}
                          />
                        </label>
                        <TextInput
                          label="Anything we should prepare?"
                          value={callResponseNote}
                          onChange={(event) => setCallResponseNote(event.target.value)}
                          placeholder="Optional"
                        />
                        {callResponseError && <div role="alert" style={{ color: "#B91C1C", fontSize: "13px" }}>{callResponseError}</div>}
                        <Button
                          onClick={() => handleRespondToCall(request, call)}
                          disabled={!callResponseDate || respondingToCallId === String(call.id)}
                        >
                          {respondingToCallId === String(call.id) ? "Sending…" : "Send preferred time"}
                        </Button>
                      </div>
                    ) : (
                      <div style={{ fontSize: "13px", color: "#475569", marginTop: "6px" }}>
                        {call.preferredTimes?.length
                          ? `Your preferred time: ${new Date(call.preferredTimes[0]).toLocaleString()}`
                          : call.scheduledAt
                            ? `Scheduled: ${new Date(call.scheduledAt).toLocaleString()}`
                            : "Your Kongila team will follow up."}
                        {call.meetingLink && (
                          <div><a href={call.meetingLink} target="_blank" rel="noreferrer">Join call</a></div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </Card>
            )}
          </div>
        )}

        {detailSubTab === "Interviews" && (
          <Card>
            <h3 style={{ fontSize: "16px", fontWeight: 800, margin: 0, marginBottom: "16px" }}>Requested Interviews</h3>
            {requestInterviews.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {requestInterviews.map((interview: any) => (
                  <div key={interview.id} style={{ padding: "16px", backgroundColor: "#F8FAFC", borderRadius: "12px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <div style={{ fontWeight: 600 }}>{interview.talentName || "Candidate"}</div>
                      <div style={{ fontSize: "12px", color: "#64748B" }}>Role: {requestTitle(request)}</div>
                    </div>
                    <div style={{ fontSize: "13px", color: "#64748B" }}>{String(interview.status).replace(/_/g, ' ')}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ textAlign: "center", padding: "40px", color: "#64748B" }}>
                <div style={{ margin: "0 auto 16px", opacity: 0.5, fontSize: "32px" }}>📅</div>
                <div>No interviews scheduled.</div>
              </div>
            )}
          </Card>
        )}

        {detailSubTab === "Contracts" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {requestContracts.length > 0 ? requestContracts.map((contract: any) => (
              <Card key={contract.id}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontSize: "15px", fontWeight: 700 }}>Contract with {contract.talentName}</div>
                    <div style={{ fontSize: "13px", color: "#64748B" }}>Status: {contract.status} • Rate: ${contract.rateAmount}/{contract.rateType}</div>
                  </div>
                  <Button variant="outline" onClick={onSignContract}>View Contract</Button>
                </div>
              </Card>
            )) : (
              <Card>
                <div style={{ textAlign: "center", padding: "40px", color: "#64748B" }}>
                  <div style={{ margin: "0 auto 16px", opacity: 0.5, fontSize: "32px" }}>📄</div>
                  <div>No contracts generated yet.</div>
                </div>
              </Card>
            )}
          </div>
        )}

        {detailSubTab === "Messages" && (
          <Card>
            <h3 style={{ fontSize: "16px", fontWeight: 800, margin: 0, marginBottom: "16px" }}>Messages about {requestTitle(request)}</h3>
            {requestMessageLoadError && <div role="alert" style={{ color: "#B91C1C", fontSize: "13px", marginBottom: "12px" }}>{requestMessageLoadError}</div>}
            <div style={{ display: "flex", flexDirection: "column", gap: "16px", maxHeight: "400px", overflowY: "auto", padding: "16px", backgroundColor: "#F8FAFC", borderRadius: "12px" }}>
              {requestConversationMessages.length > 0 ? requestConversationMessages.map((msg: any) => {
                const isMine = String(msg.senderId ?? msg.sender_id) === String(currentUser.id);
                return (
                <div key={msg.id} style={{ display: "flex", gap: "12px", flexDirection: isMine ? "row-reverse" : "row" }}>
                  <div style={{ padding: "12px 16px", borderRadius: "16px", backgroundColor: isMine ? "#2563EB" : "#FFFFFF", color: isMine ? "#FFFFFF" : "#0F172A", maxWidth: "80%", boxShadow: "0 1px 2px rgba(0,0,0,0.05)", whiteSpace: "pre-wrap" }}>
                    {msg.content}
                    <div style={{ fontSize: "11px", opacity: 0.72, marginTop: "5px" }}>
                      {new Date(msg.timestamp || msg.created_at).toLocaleString()}
                    </div>
                  </div>
                </div>
              )}) : (
                <div style={{ textAlign: "center", color: "#64748B", padding: "20px" }}>No messages yet. Send a message to your account manager about this role.</div>
              )}
            </div>
            {requestMessageError && <div role="alert" style={{ color: "#B91C1C", fontSize: "13px", marginTop: "12px" }}>{requestMessageError}</div>}
            {requestMessageWarning && <div role="status" style={{ color: "#92400E", fontSize: "13px", marginTop: "12px" }}>{requestMessageWarning}</div>}
            <form onSubmit={(event) => { event.preventDefault(); void sendRequestMessage(request); }} style={{ display: "flex", gap: "12px", marginTop: "16px" }}>
              <TextInput
                value={requestMessageDraft}
                onChange={(event) => setRequestMessageDraft(event.target.value)}
                placeholder="Type a message about this role..."
                style={{ flex: 1 }}
              />
              <Button disabled={!requestMessageDraft.trim() || isSendingRequestMessage}>
                {isSendingRequestMessage ? "Sending..." : "Send"}
              </Button>
            </form>
          </Card>
        )}

        {detailSubTab === "Activity Log" && (
          <Card>
            <h3 style={{ fontSize: "16px", fontWeight: 800, margin: 0, marginBottom: "16px" }}>Audit Trail</h3>
            {relatedLogs.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                {relatedLogs.map((log: any) => (
                  <div key={log.id} style={{ display: "flex", gap: "16px" }}>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                      <div style={{ width: "32px", height: "32px", borderRadius: "50%", backgroundColor: "#E2E8F0", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "14px" }}>
                        🕒
                      </div>
                      <div style={{ width: "2px", flex: 1, backgroundColor: "#E2E8F0", margin: "8px 0" }} />
                    </div>
                    <div style={{ flex: 1, paddingBottom: "16px" }}>
                      <div style={{ fontSize: "14px", fontWeight: 600, color: "#0F172A" }}>{log.actionType}</div>
                      <div style={{ fontSize: "12px", color: "#64748B", marginTop: "4px" }}>
                        {new Date(log.createdAt).toLocaleString()} by {log.actorId}
                      </div>
                      {log.fieldChanges && Object.keys(log.fieldChanges).length > 0 && (
                        <div style={{ marginTop: "8px", padding: "12px", backgroundColor: "#F8FAFC", borderRadius: "8px", fontSize: "13px" }}>
                          {Object.keys(log.fieldChanges).map((key) => (
                            <div key={key}>
                              <strong>{key}:</strong> {JSON.stringify(log.fieldChanges[key].old)} → {JSON.stringify(log.fieldChanges[key].new)}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ textAlign: "center", color: "#64748B", padding: "40px" }}>No activity recorded yet.</div>
            )}
          </Card>
        )}

      </div>
    );
  }

  // --- List View ---
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px", maxWidth: "1200px", margin: "0 auto", padding: "32px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div>
          <h1 style={{ fontSize: "28px", fontWeight: 800, color: "#0F172A", margin: "0 0 8px 0" }}>My Requests</h1>
          <p style={{ color: "#64748B", margin: 0 }}>Track and manage all your talent service requests.</p>
        </div>
      </div>

      {/* Controls */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "16px" }}>
        <div style={{ display: "flex", gap: "8px", background: "#F1F5F9", padding: "4px", borderRadius: "12px" }}>
          {["All", "Active", "Hired", "Closed/Cancelled"].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab as any)}
              style={{
                padding: "8px 16px",
                borderRadius: "8px",
                fontSize: "14px",
                fontWeight: 600,
                border: "none",
                cursor: "pointer",
                background: activeTab === tab ? "#FFFFFF" : "transparent",
                color: activeTab === tab ? "#0F172A" : "#64748B",
                boxShadow: activeTab === tab ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
                transition: "all 0.2s"
              }}
            >
              {tab}
            </button>
          ))}
        </div>
        
        <div style={{ position: "relative", width: "300px" }}>
          <span style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "#64748B", fontSize: "14px" }}>🔍</span>
          <input
            type="text"
            placeholder="Search role or reference..."
            value={searchQuery}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
            style={{
              width: "100%",
              padding: "10px 10px 10px 40px",
              borderRadius: "12px",
              border: "1px solid #E2E8F0",
              fontSize: "14px",
              outline: "none",
              boxSizing: "border-box"
            }}
          />
        </div>
      </div>

      {/* Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: "24px" }}>
        {filteredRequests.map((req: any) => (
          <Card 
            key={req.id} 
            style={{ display: "flex", flexDirection: "column", cursor: "pointer", transition: "transform 0.2s, box-shadow 0.2s" }}
            onClick={() => setDetailsViewRequestId(req.id)}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
              <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                <div style={{ width: "40px", height: "40px", borderRadius: "10px", background: "#EEF2FF", display: "flex", alignItems: "center", justifyContent: "center", color: "#4F46E5", fontSize: "20px" }}>
                  📋
                </div>
                <div>
                  {/* The role title, not the description. The card showed
                      roleDescription, so a request was headed by a paragraph,
                      or by "Untitled Request" when none was written. And the
                      reference the client can quote, not the internal id. */}
                  <h3 style={{ fontSize: "16px", fontWeight: 700, margin: 0, color: "#0F172A" }}>
                    {requestTitle(req)}
                  </h3>
                  {getRequestUnreadCount(req.id) > 0 && (
                    <span style={{ display: "inline-flex", alignItems: "center", gap: "5px", marginTop: "6px", color: "#B91C1C", fontSize: "12px", fontWeight: 700 }}>
                      <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#EF4444" }} />
                      {getRequestUnreadCount(req.id)} new {getRequestUnreadCount(req.id) === 1 ? "message" : "messages"}
                    </span>
                  )}
                  <div style={{ fontSize: "13px", color: "#64748B", marginTop: "4px" }}>
                    {req.referenceNumber || req.id}
                    {req.groupSize > 1 && (
                      <span> · role {req.groupPosition} of {req.groupSize} · separate request</span>
                    )}
                  </div>
                </div>
              </div>
              <span style={{ padding: "4px 10px", borderRadius: "20px", fontSize: "12px", fontWeight: 600, background: "#F1F5F9", color: "#475569" }}>
                {clientStatusView(req.status).label}
              </span>
            </div>

            <div style={{ display: "flex", gap: "16px", marginBottom: "16px", flexWrap: "wrap" }}>
              <div>
                <div style={{ fontSize: "11px", color: "#64748B", textTransform: "uppercase", marginBottom: "4px" }}>Hired / requested</div>
                <div style={{ fontSize: "14px", fontWeight: 600 }}>{req.filledCount || 0} / {requestHeadcount(req)}</div>
              </div>
              <div>
                <div style={{ fontSize: "11px", color: "#64748B", textTransform: "uppercase", marginBottom: "4px" }}>Candidates</div>
                <div style={{ fontSize: "14px", fontWeight: 600 }}>
                  {matches.filter((match) => String(match.requestId) === String(req.id)).length} submitted
                </div>
              </div>
              {req.seniorityLevel && (
                <div>
                  <div style={{ fontSize: "11px", color: "#64748B", textTransform: "uppercase", marginBottom: "4px" }}>Seniority</div>
                  <div style={{ fontSize: "14px", fontWeight: 600 }}>{String(req.seniorityLevel).split(" (")[0]}</div>
                </div>
              )}
              <div>
                <div style={{ fontSize: "11px", color: "#64748B", textTransform: "uppercase", marginBottom: "4px" }}>Created</div>
                <div style={{ fontSize: "14px", fontWeight: 600 }}>{new Date(req.createdAt).toLocaleDateString()}</div>
              </div>
            </div>

            {/* Each role has its own pipeline; sibling roles can be at
                different stages even though they came from the same brief. */}
            {(() => {
              const view = clientStatusView(req.status);
              const closed = isClosedRequestStatus(req.status);
              return (
                <div style={{ marginBottom: "16px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "#64748B", marginBottom: "6px" }}>
                    <span>{closed ? "Closed" : view.label}</span>
                    {!closed && <span>{view.pct}%</span>}
                  </div>
                  <div aria-label={`Hiring pipeline: ${closed ? "Closed" : view.label}`} style={{ display: "grid", gridTemplateColumns: `repeat(${CLIENT_JOURNEY_STEPS.length}, minmax(0, 1fr))`, gap: "4px" }}>
                    {CLIENT_JOURNEY_STEPS.map((step, index) => {
                      const reached = !closed && index <= view.step;
                      const current = !closed && index === view.step;
                      return (
                        <div key={step} style={{ minWidth: 0 }}>
                          <div style={{ height: "5px", borderRadius: "999px", background: reached ? "#4F46E5" : "#E2E8F0" }} />
                          <div style={{ marginTop: "5px", fontSize: "9px", lineHeight: 1.2, color: current ? "#3730A3" : "#64748B", fontWeight: current ? 700 : 500, overflowWrap: "anywhere" }}>
                            {step}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}

            <div style={{ marginTop: "auto", paddingTop: "16px", borderTop: "1px solid #E2E8F0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontSize: "13px", color: "#4F46E5", fontWeight: 600 }}>View Details</div>
              <span style={{ color: "#4F46E5", fontSize: "16px" }}>→</span>
            </div>
          </Card>
        ))}
        {filteredRequests.length === 0 && (
          <div style={{ gridColumn: "1 / -1", textAlign: "center", padding: "60px", color: "#64748B", background: "#F8FAFC", borderRadius: "16px" }}>
            <div style={{ margin: "0 auto 16px", opacity: 0.2, fontSize: "48px" }}>📋</div>
            <div style={{ fontSize: "16px", fontWeight: 600 }}>No requests found</div>
            <p>Try adjusting your search or filters.</p>
          </div>
        )}
      </div>
    </div>
  );
}
