import { apiFetch } from '../../lib/apiFetch';
import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { GlassCard, KongilaLoader } from '@kongila/ui';
import { formatDate, formatCurrency, getGradeColor } from '@kongila/utils';
import { coerceRequestStatus } from '@kongila/workflows';
import { requestTitle, requestRoles, requestHeadcount, isMultiRoleRequest } from '@kongila/shared-types';
import { supabase } from '../../lib/supabaseClient';
import { resolveRole } from '@kongila/auth';
import {
  enrichUsersWithRoleAssignments,
  formatAssignableUserLabel,
  isAccountManagerAssignable,
  isTalentManagerAssignable,
  mergeAuthenticatedUserIntoAssignableUsers,
} from '../../lib/adminRoleFilters';

export default function RequestDetailView() {
  const router = useRouter();
  const { id } = router.query;

  const [request, setRequest] = useState<any>(null);
  const [requestRow, setRequestRow] = useState<any>(null); // the full DB row (not just payload)
  // `client` holds the organisation. The person who filed the request and the
  // company's primary contact are separate, and were not shown at all.
  const [client, setClient] = useState<any>(null);
  const [submittedBy, setSubmittedBy] = useState<any>(null);
  const [primaryContact, setPrimaryContact] = useState<any>(null);
  const [otherRequests, setOtherRequests] = useState<any[]>([]);
  const [adminUsers, setAdminUsers] = useState<any[]>([]);
  const [matches, setMatches] = useState<any[]>([]);
  const [requestConversation, setRequestConversation] = useState<any>(null);
  const [requestMessages, setRequestMessages] = useState<any[]>([]);
  const [currentAdminId, setCurrentAdminId] = useState('');
  const [currentAdminRole, setCurrentAdminRole] = useState('');
  const [messageDraft, setMessageDraft] = useState('');
  const [messageError, setMessageError] = useState('');
  const [messageWarning, setMessageWarning] = useState('');
  const [messageLoadError, setMessageLoadError] = useState('');
  const [messageBusy, setMessageBusy] = useState(false);
  const [assignmentBusy, setAssignmentBusy] = useState(false);
  const [assignmentError, setAssignmentError] = useState('');
  const [requestActionError, setRequestActionError] = useState('');
  const [matchingBusy, setMatchingBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    urgency: '',
    assignedAccountManagerId: '',
    assignedTalentManagerId: '',
    internalNotes: ''
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [callAgenda, setCallAgenda] = useState('');
  const [callTimezone, setCallTimezone] = useState('UTC');
  const [callTimeSelections, setCallTimeSelections] = useState<Record<string, string>>({});
  const [callMeetingLink, setCallMeetingLink] = useState('');
  const [callBusy, setCallBusy] = useState(false);
  const [callError, setCallError] = useState('');

  useEffect(() => {
    if (!id) return;
    fetchAll();
  }, [id]);

  const fetchAll = async () => {
    try {
      setLoading(true);
      const requestId = Array.isArray(id) ? id[0] : id;
      if (!requestId) return;

      // Two calls, both server side.
      //
      // This used to read talent_requests, users, roles, user_roles,
      // client_profiles and matches directly from the browser, plus
      // /api/db on top for a fallback copy of the matches. Six reads with
      // the anon key to render one page, and `users` among them. It also
      // called /api/requests/:id, which does not exist in this app, so the
      // primary fetch always failed and the page ran on the fallback.
      const [detailRes, managersRes, roleRes, { data: { session } }, { data: { user: authUser } }] =
        await Promise.all([
          apiFetch(`/api/requests?id=${encodeURIComponent(requestId)}`),
          apiFetch('/api/clients?view=managers'),
          apiFetch('/api/session'),
          supabase.auth.getSession(),
          supabase.auth.getUser()
        ]);

      if (!detailRes.ok) {
        const detail = await detailRes.json().catch(() => ({}));
        console.error('[requests] detail not loaded:', detail?.error);
        setLoading(false);
        return;
      }

      const payload = await detailRes.json();
      const req = payload.request;
      req.callRequests = payload.callRequests || [];
      if (payload.callRequestWarning) setCallError(payload.callRequestWarning);
      setRequestRow(payload.row || null);

      const resolvedAMId = req.assignedAccountManagerId || '';
      const resolvedTMId = req.assignedTalentManagerId || '';

      setRequest({ ...req, status: coerceRequestStatus(req.status) });
      setFormData({
        urgency: req.urgency || 'Standard',
        assignedAccountManagerId: resolvedAMId,
        assignedTalentManagerId: resolvedTMId,
        internalNotes: req.internalNotes || ''
      });

      setSubmittedBy(payload.client || null);
      setPrimaryContact(payload.primaryContact || null);
      setOtherRequests(Array.isArray(payload.otherRequests) ? payload.otherRequests : []);
      setCurrentAdminId(authUser?.id || session?.user?.id || '');
      const rolePayload = roleRes.ok ? await roleRes.json() : {};
      setCurrentAdminRole(rolePayload.role || '');

      if (payload.organization) {
        setClient(payload.organization);
        // A request with no account manager of its own inherits the
        // company's.
        if (!resolvedAMId && payload.organization.account_manager_id) {
          const inherited = payload.organization.account_manager_id;
          setFormData(prev => ({ ...prev, assignedAccountManagerId: inherited }));
          setRequest((prev: any) => ({ ...prev, assignedAccountManagerId: inherited }));
        }
      }

      const managers = managersRes.ok ? await managersRes.json() : { users: [], roles: [] };
      setAdminUsers(
        mergeAuthenticatedUserIntoAssignableUsers(
          enrichUsersWithRoleAssignments(
            managers.users || [],
            managers.roles || [],
            (managers.users || []).flatMap((u: any) =>
              (u.roleIds || []).map((roleId: string) => ({ user_id: u.id, role_id: roleId }))
            )
          ),
          authUser || session?.user,
        )
      );

      // The route returns each match with the candidate's name, title and
      // grade already attached, so there is no second lookup and no
      // fallback copy to merge.
      setMatches((payload.matches || []).map((m: any) => ({
        ...m,
        talent: m.talentName ? { id: m.talentId, name: m.talentName, title: m.talentTitle } : null
      })));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const loadRequestMessages = async () => {
    const requestId = request?.id;
    if (!requestId) return;
    try {
      const response = await apiFetch('/api/messages');
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || 'Request messages could not be loaded.');
      const conversation = (payload.conversations || []).find((item: any) =>
        ['request', 'service_request', 'talent_request'].includes(
          String(item.contextType || item.context_type || '').toLowerCase()
        ) && String(item.contextId || item.context_id) === String(requestId)
      );
      setRequestConversation(conversation || null);
      setRequestMessages(conversation
        ? (payload.messages || []).filter((item: any) =>
            String(item.conversationId || item.conversation_id) === String(conversation.id)
          )
        : []);
      setMessageLoadError('');
    } catch (error: any) {
      setMessageLoadError(error?.message || 'Request messages could not be loaded.');
    }
  };

  useEffect(() => {
    if (!request?.id) return;
    void loadRequestMessages();
    const interval = setInterval(loadRequestMessages, 5000);
    return () => clearInterval(interval);
  }, [request?.id]);

  useEffect(() => {
    if (!requestConversation || !currentAdminId) return;
    const unread = requestMessages.some((message: any) =>
      String(message.senderId || message.sender_id) !== String(currentAdminId)
      && !(message.isRead ?? message.is_read)
    );
    if (!unread) return;

    apiFetch('/api/messages', {
      method: 'POST',
      body: JSON.stringify({ action: 'markRead', conversationId: requestConversation.id })
    }).then(async (response) => {
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || 'Messages could not be marked as read.');
      setRequestMessages((current) => current.map((message: any) =>
        String(message.senderId || message.sender_id) !== String(currentAdminId)
          ? { ...message, isRead: true, is_read: true }
          : message
      ));
    }).catch((error: any) => {
      setMessageError(error?.message || 'Messages could not be marked as read.');
    });
  }, [requestConversation, requestMessages, currentAdminId]);

  const sendRequestMessage = async () => {
    const content = messageDraft.trim();
    if (!content || messageBusy || !request?.id) return;
    setMessageBusy(true);
    setMessageError('');
    setMessageWarning('');
    try {
      let conversation = requestConversation;
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
        conversation = startBody.data;
        setRequestConversation(conversation);
      }

      const response = await apiFetch('/api/messages', {
        method: 'POST',
        body: JSON.stringify({ conversationId: conversation.id, content })
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body?.error || 'Your message could not be sent.');
      setRequestMessages((current) => [...current, body.data]);
      if (body.warnings?.length) {
        setMessageWarning(`Message sent, but email delivery needs attention: ${body.warnings.join(' ')}`);
      }
      setMessageDraft('');
    } catch (error: any) {
      setMessageError(error?.message || 'Your message could not be sent.');
    } finally {
      setMessageBusy(false);
    }
  };

  const focusRequestMessages = () => {
    document.getElementById('request-messages')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const handleSave = async () => {
    const requestId = Array.isArray(id) ? id[0] : id;

    setIsSubmitting(true);
    try {
      // The roles and user_roles upserts that used to live here are gone.
      // They ran in the browser against tables with RLS off, so an admin
      // panel could grant a role link to any user id it named, and they
      // derived the role id in the browser rather than reading it from the
      // user's own record. The assign route does both, server side.

      const updatedPayload = {
        ...request,
        urgency: formData.urgency,
        internalNotes: formData.internalNotes,
        ...(canManageAssignments ? {
          assignedAccountManagerId: formData.assignedAccountManagerId,
          assignedTalentManagerId: formData.assignedTalentManagerId,
        } : {}),
      };

      const assignResponse = await apiFetch('/api/requests/assign', {
        method: 'POST',
        body: JSON.stringify({
          requestId,
          accountManagerId: canManageAssignments ? formData.assignedAccountManagerId || undefined : undefined,
          talentManagerId: canManageAssignments ? formData.assignedTalentManagerId || undefined : undefined,
          urgency: formData.urgency,
          internalNotes: formData.internalNotes,
          alsoSetClientAccountManager: canManageAssignments && Boolean(formData.assignedAccountManagerId)
        })
      });
      const assignBody = await assignResponse.json().catch(() => ({}));
      if (!assignResponse.ok) throw new Error(assignBody.error || 'Could not save those assignments.');

      // The legacy snapshot sync that used to be here is gone. It read
      // /api/db and posted the whole clientRequests array back, which
      // upserts every request from browser state, on top of the assign
      // route that had just written this one correctly.

      // 5. Refresh local state immediately (no re-fetch needed)
      setRequest(updatedPayload);
      setIsEditing(false);
    } catch (e) {
      console.error(e);
      alert(`Failed to save request: ${e instanceof Error ? e.message : 'Unknown error'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAssignAccountManager = async () => {
    const requestId = Array.isArray(id) ? id[0] : id;
    if (!requestId || !formData.assignedAccountManagerId || assignmentBusy) return;
    setAssignmentBusy(true);
    setAssignmentError('');
    try {
      const response = await apiFetch('/api/requests/assign', {
        method: 'POST',
        body: JSON.stringify({
          requestId,
          accountManagerId: formData.assignedAccountManagerId,
          alsoSetClientAccountManager: true
        })
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || 'The account manager could not be assigned.');
      setRequest((current: any) => ({
        ...current,
        assignedAccountManagerId: body.accountManagerId || formData.assignedAccountManagerId
      }));
      setClient((current: any) => current
        ? { ...current, account_manager_id: body.accountManagerId || formData.assignedAccountManagerId }
        : current);
      if (body.warnings?.length) setAssignmentError(body.warnings.join(' '));
    } catch (error: any) {
      setAssignmentError(error?.message || 'The account manager could not be assigned.');
    } finally {
      setAssignmentBusy(false);
    }
  };

  const handleOpenMatching = async () => {
    if (!request || matchingBusy) return;
    setMatchingBusy(true);
    setRequestActionError('');
    try {
      const status = coerceRequestStatus(request.status);
      const targets = status === 'New Request'
        ? ['Reviewing', 'Sourcing Talent']
        : status === 'Reviewing'
          ? ['Sourcing Talent']
          : [];
      for (const target of targets) {
        const response = await apiFetch('/api/requests/status', {
          method: 'POST',
          body: JSON.stringify({
            requestId: request.id,
            status: target,
            reason: target === 'Sourcing Talent' ? 'Matching started.' : 'Request opened for review.'
          })
        });
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(body.error || `The request could not move to ${target}.`);
        setRequest((current: any) => ({ ...current, status: body.to || target }));
      }
      await router.push(`/matching/${request.id}`);
    } catch (error: any) {
      setRequestActionError(error?.message || 'The matching engine could not be opened.');
    } finally {
      setMatchingBusy(false);
    }
  };

  const handleRequestClientCall = async () => {
    if (!request || callBusy) return;
    setCallBusy(true);
    setCallError('');
    try {
      const response = await apiFetch('/api/requests/call', {
        method: 'POST',
        body: JSON.stringify({
          action: 'request',
          requestId: request.id,
          agenda: callAgenda.trim(),
          timezone: callTimezone
        })
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || 'The call request could not be sent.');
      setRequest((current: any) => ({
        ...current,
        callRequests: [body.callRequest, ...(current.callRequests || [])]
      }));
      setCallAgenda('');
    } catch (error: any) {
      setCallError(error?.message || 'The call request could not be sent.');
    } finally {
      setCallBusy(false);
    }
  };

  const handleScheduleClientCall = async (call: any) => {
    if (callBusy) return;
    const scheduledAt = callTimeSelections[call.id] || call.preferredTimes?.[0] || '';
    setCallBusy(true);
    setCallError('');
    try {
      const response = await apiFetch('/api/requests/call', {
        method: 'POST',
        body: JSON.stringify({
          action: 'schedule',
          callRequestId: call.id,
          scheduledAt,
          meetingLink: callMeetingLink.trim() || undefined
        })
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || 'The call could not be scheduled.');
      setRequest((current: any) => ({
        ...current,
        callRequests: (current.callRequests || []).map((item: any) =>
          item.id === call.id ? body.callRequest : item
        )
      }));
      setCallMeetingLink('');
    } catch (error: any) {
      setCallError(error?.message || 'The call could not be scheduled.');
    } finally {
      setCallBusy(false);
    }
  };

  if (loading) return <KongilaLoader text="Loading request details..." />;
  if (!request) return <div style={{ padding: '40px' }}>Request not found.</div>;

  const calculateSLA = () => {
    const created = new Date(request.createdAt).getTime();
    const now = new Date().getTime();
    const hoursElapsed = (now - created) / (1000 * 60 * 60);
    const slaTarget = 48;
    return {
      hoursElapsed: hoursElapsed.toFixed(1),
      hoursRemaining: (slaTarget - hoursElapsed).toFixed(1),
      isBreached: hoursElapsed > slaTarget,
      isAtRisk: hoursElapsed > slaTarget * 0.75
    };
  };

  const sla = calculateSLA();

  // Resolve display names from adminUsers (covers both editing and view mode)
  const currentRole = resolveRole(currentAdminRole);
  const canManageAssignments = currentRole === 'super_admin' || currentRole === 'ops_manager';
  const currentAMId = isEditing && canManageAssignments
    ? formData.assignedAccountManagerId
    : request.assignedAccountManagerId || client?.account_manager_id;
  const currentTMId = isEditing && canManageAssignments
    ? formData.assignedTalentManagerId
    : request.assignedTalentManagerId;
  const am = adminUsers.find(u => u.id === currentAMId);
  const tm = adminUsers.find(u => u.id === currentTMId);
  const accountManagerOptions = adminUsers.filter(isAccountManagerAssignable);
  const talentManagerOptions = adminUsers.filter(isTalentManagerAssignable);
  const hasClientAccountManager = Boolean(client?.account_manager_id);
  const canOpenMatching = !['Closed', 'Onboarding'].includes(coerceRequestStatus(request.status));

  // Inline AM from the requestRow's joined relation as a richer fallback
  const amDisplay = am?.name || am?.email || requestRow?.account_manager?.name || requestRow?.account_manager?.email || (currentAMId ? `ID: ${currentAMId}` : 'Unassigned');
  const tmDisplay = tm?.name || tm?.email || requestRow?.talent_manager?.name || requestRow?.talent_manager?.email || (currentTMId ? `ID: ${currentTMId}` : 'Unassigned');

  const UserChip = ({ label, name }: { label: string; name: string }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <div style={{
        width: '28px', height: '28px', borderRadius: '50%',
        background: name === 'Unassigned' ? 'var(--bg-elevated)' : '#0047CC',
        color: name === 'Unassigned' ? 'var(--text-muted)' : 'white',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '11px', fontWeight: 700, flexShrink: 0
      }}>
        {name[0].toUpperCase()}
      </div>
      <div>
        <div style={{ fontSize: '13px', fontWeight: name === 'Unassigned' ? 400 : 600, color: name === 'Unassigned' ? 'var(--text-muted)' : 'var(--text-primary)' }}>
          {name}
        </div>
        <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{label}</div>
      </div>
    </div>
  );

  return (
    <div className="app-shell" style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-primary)' }}>
      <div style={{ flex: 1, padding: '40px', overflowY: 'auto' }}>
        <Head>
          <title>{requestTitle(request)} - Kongila Admin</title>
        </Head>

        <button onClick={() => router.push('/?tab=hiring-requests')} className="btn-secondary" style={{ marginBottom: '20px', fontSize: '13px', padding: '6px 14px', borderRadius: '8px' }}>← Back to Request Queue</button>

        <div className="page-header" style={{ marginBottom: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
              {/* The heading was the service type, so every placement request
                  in the portal was titled "Hire Talent" and an operator with
                  two tabs open could not tell them apart. The service type is
                  still here, as a chip beside the status. */}
              <h1 className="page-title" style={{ margin: 0 }}>{requestTitle(request)}</h1>
              <span style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', padding: '4px 10px', borderRadius: '999px', fontSize: '12px', fontWeight: 600 }}>
                {request.serviceType}
              </span>
              {request.urgency === 'ASAP' && (
                <span style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#EF4444', padding: '4px 10px', borderRadius: '999px', fontSize: '12px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ fontSize: '14px' }}>🚩</span> ASAP
                </span>
              )}
              <span style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', padding: '4px 10px', borderRadius: '999px', fontSize: '12px', fontWeight: 600 }}>
                {coerceRequestStatus(request.status)}
              </span>
            </div>
            {/* This said "Submitted by <company>", because the organisation
                was being passed where the person belongs. Both are shown, so
                an operator knows who to reply to. */}
            <p className="page-subtitle">
              {client?.name || request.clientName || 'Unknown company'}
              {submittedBy?.name ? ` · filed by ${submittedBy.name}` : ''}
              {' · '}{formatDate(request.createdAt)}
            </p>
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            {isEditing ? (
              <>
                <button onClick={() => setIsEditing(false)} className="btn-secondary" style={{ padding: '8px 16px', borderRadius: '8px', fontSize: '13px' }}>Cancel</button>
                <button onClick={handleSave} disabled={isSubmitting} className="btn-primary" style={{ padding: '8px 16px', borderRadius: '8px', fontSize: '13px' }}>
                  {isSubmitting ? 'Saving...' : 'Save Changes'}
                </button>
              </>
            ) : (
              <>
                <button onClick={focusRequestMessages} className="btn-secondary" style={{ padding: '8px 16px', borderRadius: '8px', fontSize: '13px' }}>Message Client</button>
                {canOpenMatching && (
                  <button onClick={handleOpenMatching} disabled={matchingBusy} className="btn-primary" style={{ padding: '8px 16px', borderRadius: '8px', fontSize: '13px', background: '#10B981', borderColor: '#10B981' }}>
                    {matchingBusy ? 'Opening Matching...' : 'Open Matching Engine'}
                  </button>
                )}
                <button onClick={() => setIsEditing(true)} className="btn-primary" style={{ padding: '8px 16px', borderRadius: '8px', fontSize: '13px' }}>Manage Request</button>
              </>
            )}
          </div>
        </div>

        {!hasClientAccountManager && canManageAssignments && (
          <GlassCard>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '20px', flexWrap: 'wrap' }}>
              <div>
                <h3 style={{ margin: '0 0 6px', fontSize: '16px', color: '#B45309' }}>Assign an account manager to this client</h3>
                <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)' }}>
                  This client has no account manager on their company record. Assign one to own all of their role requests.
                </p>
              </div>
              <div style={{ display: 'flex', gap: '10px', minWidth: '320px', flex: '1 1 360px' }}>
                <select
                  aria-label="Assign account manager to client"
                  value={formData.assignedAccountManagerId}
                  onChange={(event) => setFormData({ ...formData, assignedAccountManagerId: event.target.value })}
                  style={{ flex: 1, minWidth: 0, padding: '10px', borderRadius: '8px' }}
                >
                  <option value="">Select an account manager</option>
                  {accountManagerOptions.map((user) => (
                    <option key={user.id} value={user.id}>{formatAssignableUserLabel(user)}</option>
                  ))}
                </select>
                <button
                  onClick={handleAssignAccountManager}
                  disabled={!formData.assignedAccountManagerId || assignmentBusy}
                  className="btn-primary"
                  style={{ whiteSpace: 'nowrap' }}
                >
                  {assignmentBusy ? 'Assigning...' : 'Assign to client'}
                </button>
              </div>
            </div>
            {assignmentError && <p role="alert" style={{ color: '#B45309', fontSize: '13px', margin: '12px 0 0' }}>{assignmentError}</p>}
          </GlassCard>
        )}
        {requestActionError && <p role="alert" style={{ color: '#B91C1C', fontSize: '13px' }}>{requestActionError}</p>}

        <GlassCard>
          <div id="request-messages" style={{ scrollMarginTop: '24px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 700, margin: '0 0 6px' }}>
              Messages about {requestTitle(request)}
            </h3>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '0 0 16px' }}>
              This conversation is shared with the client and the account manager assigned to this role.
            </p>
            {messageLoadError && <p role="alert" style={{ color: '#B91C1C', fontSize: '13px' }}>{messageLoadError}</p>}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '340px', overflowY: 'auto', padding: '14px', borderRadius: '10px', background: 'var(--bg-tertiary)' }}>
              {requestMessages.length ? requestMessages.map((message: any) => {
                const mine = String(message.senderId || message.sender_id) === String(currentAdminId);
                return (
                  <div key={message.id} style={{ alignSelf: mine ? 'flex-end' : 'flex-start', maxWidth: '80%' }}>
                    <div style={{ padding: '10px 14px', borderRadius: '12px', whiteSpace: 'pre-wrap', background: mine ? 'var(--kongila-blue)' : 'var(--bg-primary)', color: mine ? '#fff' : 'var(--text-primary)' }}>
                      {message.content}
                    </div>
                    <div style={{ marginTop: '4px', fontSize: '10px', color: 'var(--text-muted)', textAlign: mine ? 'right' : 'left' }}>
                      {message.timestamp ? new Date(message.timestamp).toLocaleString() : ''}
                    </div>
                  </div>
                );
              }) : (
                <div style={{ color: 'var(--text-muted)', fontSize: '13px', textAlign: 'center', padding: '20px' }}>
                  No messages yet. Send the client an update or a question about this role.
                </div>
              )}
            </div>
            {messageError && <p role="alert" style={{ color: '#B91C1C', fontSize: '13px', margin: '10px 0 0' }}>{messageError}</p>}
            {messageWarning && <p role="status" style={{ color: '#92400E', fontSize: '13px', margin: '10px 0 0' }}>{messageWarning}</p>}
            <form onSubmit={(event) => { event.preventDefault(); void sendRequestMessage(); }} style={{ display: 'flex', gap: '10px', marginTop: '12px' }}>
              <textarea
                value={messageDraft}
                onChange={(event) => setMessageDraft(event.target.value)}
                placeholder="Write a message about this role..."
                rows={2}
                style={{ flex: 1, resize: 'vertical', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-subtle)', background: 'var(--bg-primary)', color: 'var(--text-primary)' }}
              />
              <button type="submit" className="btn-primary" disabled={!messageDraft.trim() || messageBusy}>
                {messageBusy ? 'Sending...' : 'Send'}
              </button>
            </form>
          </div>
        </GlassCard>

        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <GlassCard>
              <h3 style={{ fontSize: '18px', fontWeight: 700, margin: '0 0 12px' }}>Client discussion call</h3>
              {(request.callRequests || []).length === 0 && (
                <p style={{ color: 'var(--text-muted)', fontSize: '13px', margin: '0 0 14px' }}>
                  Request a call so the client can send a time that works for them.
                </p>
              )}
              {(request.callRequests || []).map((call: any) => (
                <div key={call.id} style={{ borderTop: '1px solid var(--border-subtle)', padding: '14px 0' }}>
                  <div style={{ fontWeight: 700, textTransform: 'capitalize' }}>{String(call.status).replace(/_/g, ' ')}</div>
                  {call.agenda && <div style={{ fontSize: '13px', marginTop: '4px' }}>Agenda: {call.agenda}</div>}
                  {call.clientNote && <div style={{ fontSize: '13px', marginTop: '4px' }}>Client note: {call.clientNote}</div>}
                  {call.status === 'client_responded' && (
                    <div style={{ display: 'grid', gap: '10px', marginTop: '12px' }}>
                      <label style={{ fontSize: '12px', fontWeight: 600 }}>
                        Select a time proposed by the client ({call.timezone || 'UTC'})
                        <select
                          value={callTimeSelections[call.id] || call.preferredTimes?.[0] || ''}
                          onChange={(event) => setCallTimeSelections((current) => ({ ...current, [call.id]: event.target.value }))}
                          style={{ display: 'block', width: '100%', padding: '9px', marginTop: '5px' }}
                        >
                          {(call.preferredTimes || []).map((time: string) => (
                            <option key={time} value={time}>{new Date(time).toLocaleString()}</option>
                          ))}
                        </select>
                      </label>
                      <label style={{ fontSize: '12px', fontWeight: 600 }}>
                        Meeting link (optional)
                        <input
                          type="url"
                          value={callMeetingLink}
                          onChange={(event) => setCallMeetingLink(event.target.value)}
                          placeholder="https://..."
                          style={{ display: 'block', width: '100%', padding: '9px', marginTop: '5px' }}
                        />
                      </label>
                      <button className="btn-primary" disabled={callBusy} onClick={() => handleScheduleClientCall(call)}>
                        {callBusy ? 'Scheduling...' : 'Confirm call time'}
                      </button>
                    </div>
                  )}
                  {call.status === 'requested' && (
                    <p style={{ color: 'var(--text-muted)', fontSize: '13px', margin: '8px 0 0' }}>Waiting for the client to reply with a preferred time.</p>
                  )}
                  {call.status === 'scheduled' && (
                    <div style={{ fontSize: '13px', marginTop: '8px' }}>
                      Scheduled: {call.scheduledAt ? new Date(call.scheduledAt).toLocaleString() : 'Time not recorded'}
                      {call.meetingLink && <div><a href={call.meetingLink} target="_blank" rel="noreferrer">Open meeting link</a></div>}
                    </div>
                  )}
                </div>
              ))}
              {!(request.callRequests || []).some((call: any) => ['requested', 'client_responded'].includes(call.status)) && (
                <div style={{ display: 'grid', gap: '10px', marginTop: '12px' }}>
                  <textarea
                    value={callAgenda}
                    onChange={(event) => setCallAgenda(event.target.value)}
                    placeholder="What would you like to discuss? (optional)"
                    rows={2}
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', resize: 'vertical' }}
                  />
                  <input
                    value={callTimezone}
                    onChange={(event) => setCallTimezone(event.target.value)}
                    aria-label="Your timezone"
                    placeholder="Timezone, e.g. Africa/Lagos"
                    style={{ width: '100%', padding: '9px', borderRadius: '8px' }}
                  />
                  <button className="btn-primary" disabled={callBusy} onClick={handleRequestClientCall}>
                    {callBusy ? 'Sending...' : 'Request client call'}
                  </button>
                </div>
              )}
              {callError && <p role="alert" style={{ color: '#B91C1C', fontSize: '13px', margin: '10px 0 0' }}>{callError}</p>}
            </GlassCard>

            {/* One request can be for several roles, each sourced and tracked
                on its own. A client hiring across three roles used to file
                three unconnected requests, which arrived on the board looking
                like three unrelated pieces of work. */}
            {isMultiRoleRequest(request) && (
              <GlassCard>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '20px' }}>
                  <h3 style={{ fontSize: '18px', fontWeight: 700, margin: 0 }}>
                    {requestRoles(request).length} roles on this request
                  </h3>
                  <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                    {requestHeadcount(request)} people in total
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {requestRoles(request).map((role, index) => (
                    <div
                      key={role.id}
                      style={{
                        padding: '14px 16px',
                        borderRadius: '10px',
                        border: '1px solid var(--border-glass)',
                        background: 'var(--bg-tertiary)'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', flexWrap: 'wrap' }}>
                        <div style={{ minWidth: '200px' }}>
                          <div style={{ fontSize: '14px', fontWeight: 700 }}>
                            {index + 1}. {role.title}
                          </div>
                          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '3px' }}>
                            {role.count} {role.count === 1 ? 'person' : 'people'}
                            {role.seniorityLevel ? ` · ${role.seniorityLevel}` : ''}
                            {role.commitmentLevel ? ` · ${role.commitmentLevel}` : ''}
                            {(role.filledCount ?? 0) > 0 ? ` · ${role.filledCount} placed` : ''}
                          </div>
                        </div>
                        <span style={{
                          background: 'var(--bg-elevated)',
                          color: 'var(--text-secondary)',
                          padding: '4px 10px',
                          borderRadius: '999px',
                          fontSize: '12px',
                          fontWeight: 600,
                          whiteSpace: 'nowrap'
                        }}>
                          {role.status}
                        </span>
                      </div>

                      {(role.requiredSkills || []).length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '10px' }}>
                          {(role.requiredSkills || []).map((s: string, i: number) => (
                            <span key={i} style={{ background: 'var(--bg-elevated)', padding: '3px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 600 }}>{s}</span>
                          ))}
                        </div>
                      )}

                      {role.description && (
                        <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '10px', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                          {role.description}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </GlassCard>
            )}

            <GlassCard>
              <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '24px' }}>Request Details</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', fontSize: '13px' }}>
                {/* Title and description were collapsed into one field here,
                    labelled "Role Title / Description", which meant whichever
                    of the two the client filled in was the only one anybody
                    saw. They are separate answers and are shown separately. */}
                <div>
                  <div style={{ color: 'var(--text-muted)', marginBottom: '4px' }}>
                    {request.serviceType === 'Project Execution' ? 'Project' : 'Role'}
                  </div>
                  <div style={{ fontWeight: 600 }}>{requestTitle(request)}</div>
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <div style={{ color: 'var(--text-muted)', marginBottom: '4px' }}>What the client described</div>
                  <div style={{ fontWeight: 500, whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
                    {request.roleDescription
                      || request.projectDescription
                      || request.teamDescription
                      || request.description
                      || <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>Nothing written in. Worth asking before sourcing.</span>}
                  </div>
                </div>
                <div>
                  <div style={{ color: 'var(--text-muted)', marginBottom: '4px' }}>People wanted</div>
                  <div style={{ fontWeight: 600 }}>
                    {requestHeadcount(request)}
                    {isMultiRoleRequest(request) && (
                      <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>
                        {' '}across {requestRoles(request).length} roles
                      </span>
                    )}
                  </div>
                </div>
                <div>
                  <div style={{ color: 'var(--text-muted)', marginBottom: '4px' }}>Required Skills</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '6px' }}>
                    {(request.requiredSkills || []).map((s: string, i: number) => (
                      <span key={i} style={{ background: 'var(--bg-tertiary)', padding: '4px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 600 }}>{s}</span>
                    ))}
                    {(!request.requiredSkills || request.requiredSkills.length === 0) && 'Not specified'}
                  </div>
                </div>
                <div>
                  <div style={{ color: 'var(--text-muted)', marginBottom: '4px' }}>Budget</div>
                  <div style={{ fontWeight: 600 }}>
                    {request.budgetMinUsd && request.budgetMaxUsd
                      ? `${formatCurrency(request.budgetMinUsd)} – ${formatCurrency(request.budgetMaxUsd)}`
                      : request.budget ? formatCurrency(request.budget) : 'Not specified'}
                  </div>
                </div>
                <div>
                  <div style={{ color: 'var(--text-muted)', marginBottom: '4px' }}>Duration & Commitment</div>
                  <div style={{ fontWeight: 600 }}>{request.duration || 'N/A'} · {request.commitmentLevel || 'N/A'}</div>
                </div>
                <div>
                  <div style={{ color: 'var(--text-muted)', marginBottom: '4px' }}>Target Start Date</div>
                  <div style={{ fontWeight: 600 }}>{request.startDate ? formatDate(request.startDate) : 'N/A'}</div>
                </div>
              </div>
            </GlassCard>

            <GlassCard>
              <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '16px' }}>Internal Notes</h3>
              {isEditing ? (
                <textarea
                  className="kongila-input"
                  rows={6}
                  value={formData.internalNotes}
                  onChange={(e) => setFormData({ ...formData, internalNotes: e.target.value })}
                  placeholder="Add discovery notes, client constraints, etc."
                  style={{ width: '100%', padding: '12px', borderRadius: '8px', resize: 'vertical' }}
                />
              ) : (
                <p style={{ fontSize: '13px', color: request.internalNotes ? 'var(--text-primary)' : 'var(--text-muted)', whiteSpace: 'pre-wrap', margin: 0 }}>
                  {request.internalNotes || 'No internal notes found.'}
                </p>
              )}
            </GlassCard>

            <GlassCard>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <h3 style={{ fontSize: '18px', fontWeight: 700, margin: 0 }}>Submitted Candidates</h3>
                  <span style={{ background: matches.length > 0 ? '#0047CC15' : 'var(--bg-tertiary)', color: matches.length > 0 ? '#0047CC' : 'var(--text-muted)', padding: '4px 10px', borderRadius: '999px', fontSize: '12px', fontWeight: 600 }}>
                    {matches.length} {matches.length === 1 ? 'Candidate' : 'Candidates'}
                  </span>
                </div>
                {matches.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '32px 20px', color: 'var(--text-muted)', fontSize: '13px' }}>
                    <div style={{ fontSize: '32px', marginBottom: '12px' }}>📭</div>
                    No candidates have been submitted for this request yet.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {matches.map(match => (
                      <div key={match.id} style={{ display: 'flex', gap: '16px', padding: '16px', background: 'var(--bg-tertiary)', borderRadius: '12px', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                          <img
                            src={match.talent?.profilePhotoUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(match.talent?.name || 'T')}&background=0047CC&color=fff&size=50`}
                            alt=""
                            style={{ width: '50px', height: '50px', borderRadius: '50%', objectFit: 'cover' }}
                          />
                          <div>
                            <div style={{ fontWeight: 700, fontSize: '15px' }}>{match.talent?.name || match.talent?.email || `Talent ID: ${match.talentId?.slice(0,8)}...`}</div>
                            <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{match.talent?.title || 'No Title'}</div>
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
                          <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Match Score</div>
                            <div style={{ fontWeight: 700, color: getGradeColor(match.score > 80 ? 'A' : match.score > 60 ? 'B' : 'C') }}>{match.score}%</div>
                          </div>
                          <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Status</div>
                            <div style={{ fontWeight: 600, fontSize: '13px', textTransform: 'capitalize' }}>{match.status}</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </GlassCard>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <GlassCard>
              <h3 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '16px' }}>Triage & Status</h3>

              <div style={{ marginBottom: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '12px' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>SLA Timer (48h target)</span>
                  <span style={{ fontWeight: 600, color: sla.isBreached ? '#EF4444' : (sla.isAtRisk ? '#F59E0B' : '#10B981') }}>
                    {sla.hoursElapsed}h elapsed
                  </span>
                </div>
                <div style={{ height: '8px', background: 'var(--bg-tertiary)', borderRadius: '999px', overflow: 'hidden' }}>
                  <div style={{
                    height: '100%',
                    width: `${Math.min((Number(sla.hoursElapsed) / 48) * 100, 100)}%`,
                    background: sla.isBreached ? '#EF4444' : (sla.isAtRisk ? '#F59E0B' : '#10B981'),
                    transition: 'width 0.3s ease'
                  }} />
                </div>
                {sla.isBreached && <div style={{ fontSize: '11px', color: '#EF4444', marginTop: '6px', fontWeight: 600 }}>SLA Breached</div>}
              </div>

              {isEditing && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>Urgency</label>
                    <select
                      className="kongila-input"
                      value={formData.urgency}
                      onChange={e => setFormData({ ...formData, urgency: e.target.value })}
                      style={{ width: '100%', padding: '10px', borderRadius: '8px' }}
                    >
                      <option value="Standard">Standard</option>
                      <option value="ASAP">ASAP</option>
                    </select>
                  </div>
                </div>
              )}
            </GlassCard>

            {/* The client, as a client.
                An operator opening a new request saw the company's name and
                nothing else: not who the primary contact is, not how to reach
                them, not what else they have asked for. Finding that out
                meant leaving the page for the client list, so in practice
                nobody did, and a fifth request from an existing client read
                exactly like a first one from a stranger. */}
            <GlassCard>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '16px' }}>
                <h3 style={{ fontSize: '15px', fontWeight: 600, margin: 0 }}>The client</h3>
                {client?.id && (
                  <button
                    onClick={() => router.push(`/clients/${client.id}`)}
                    className="btn-secondary"
                    style={{ padding: '4px 10px', borderRadius: '8px', fontSize: '12px' }}
                  >
                    Open company
                  </button>
                )}
              </div>

              <div style={{ fontSize: '15px', fontWeight: 700, marginBottom: '2px' }}>
                {client?.name || request.clientName || 'No company on this request'}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '16px' }}>
                {[client?.industry, client?.company_size, client?.country].filter(Boolean).join(' · ') || 'No company details on file'}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '13px' }}>
                <div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '3px' }}>Filed this request</div>
                  <div style={{ fontWeight: 600 }}>{submittedBy?.name || submittedBy?.email || 'Unknown'}</div>
                  {submittedBy?.email && submittedBy?.name && (
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{submittedBy.email}</div>
                  )}
                </div>

                {/* The person the account belongs to, which is not always the
                    person who filed this particular request. */}
                <div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '3px' }}>Primary contact</div>
                  {primaryContact
                    ? (
                      <>
                        <div style={{ fontWeight: 600 }}>
                          {primaryContact.name || primaryContact.email}
                          {primaryContact.id === submittedBy?.id && (
                            <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}> · filed this one</span>
                          )}
                        </div>
                        {primaryContact.email && primaryContact.name && (
                          <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{primaryContact.email}</div>
                        )}
                      </>
                    )
                    : <div style={{ color: 'var(--text-muted)' }}>Not set on this company</div>}
                </div>

                {(client?.contact_email || client?.contact_phone) && (
                  <div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '3px' }}>Company contact</div>
                    <div style={{ fontWeight: 600 }}>{client.contact_email || client.contact_phone}</div>
                    {client.contact_email && client.contact_phone && (
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{client.contact_phone}</div>
                    )}
                  </div>
                )}

                <div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '6px' }}>
                    {otherRequests.length === 0
                      ? 'Their first request'
                      : `Also open with us (${otherRequests.length})`}
                  </div>
                  {otherRequests.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {otherRequests.slice(0, 5).map((other: any) => (
                        <button
                          key={other.id}
                          onClick={() => router.push(`/requests/${other.id}`)}
                          style={{
                            textAlign: 'left',
                            background: 'var(--bg-tertiary)',
                            border: '1px solid var(--border-glass)',
                            borderRadius: '8px',
                            padding: '8px 10px',
                            cursor: 'pointer',
                            color: 'var(--text-primary)'
                          }}
                        >
                          <div style={{ fontSize: '12px', fontWeight: 600 }}>{requestTitle(other)}</div>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                            {coerceRequestStatus(other.status)} · {formatDate(other.createdAt)}
                          </div>
                        </button>
                      ))}
                      {otherRequests.length > 5 && (
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                          and {otherRequests.length - 5} more on the company page
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </GlassCard>

            <GlassCard>
              <h3 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '16px' }}>Assignments</h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {/* Account Manager */}
                <div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '8px', fontWeight: 600 }}>Account Manager</div>
                  {isEditing && canManageAssignments ? (
                    <select
                      className="kongila-input"
                      value={formData.assignedAccountManagerId}
                      onChange={e => setFormData({ ...formData, assignedAccountManagerId: e.target.value })}
                      style={{ width: '100%', padding: '10px', borderRadius: '8px' }}
                    >
                      <option value="">-- Assign AM --</option>
                      {accountManagerOptions.map(u => <option key={u.id} value={u.id}>{formatAssignableUserLabel(u)}</option>)}
                    </select>
                  ) : (
                    <UserChip label="Account Manager" name={amDisplay} />
                  )}
                </div>

                {/* Talent Manager */}
                <div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '8px', fontWeight: 600 }}>Talent Manager</div>
                  {isEditing && canManageAssignments ? (
                    <select
                      className="kongila-input"
                      value={formData.assignedTalentManagerId}
                      onChange={e => setFormData({ ...formData, assignedTalentManagerId: e.target.value })}
                      style={{ width: '100%', padding: '10px', borderRadius: '8px' }}
                    >
                      <option value="">-- Assign TM for Matching --</option>
                      {talentManagerOptions.map(u => <option key={u.id} value={u.id}>{formatAssignableUserLabel(u)}</option>)}
                    </select>
                  ) : (
                    <UserChip label="Talent Manager" name={tmDisplay} />
                  )}
                </div>
              </div>
            </GlassCard>
          </div>
        </div>
      </div>
    </div>
  );
}
