import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { GlassCard, KongilaLoader } from '@kongila/ui';
import { formatDate, formatCurrency, getGradeColor } from '@kongila/utils';
import { normalizeRequestStatus } from '@kongila/workflows';
import { supabase } from '../../lib/supabaseClient';
import {
  enrichUsersWithRoleAssignments,
  formatAssignableUserLabel,
  getDatabaseSafeAdminRole,
  getPrimaryAssignableRoleId,
  isAccountManagerAssignable,
  isTalentManagerAssignable,
  mergeAuthenticatedUserIntoAssignableUsers,
} from '../../lib/adminRoleFilters';

export default function RequestDetailView() {
  const router = useRouter();
  const { id } = router.query;

  const [request, setRequest] = useState<any>(null);
  const [requestRow, setRequestRow] = useState<any>(null); // the full DB row (not just payload)
  const [client, setClient] = useState<any>(null);
  const [adminUsers, setAdminUsers] = useState<any[]>([]);
  const [matches, setMatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    status: '',
    urgency: '',
    assignedAccountManagerId: '',
    assignedTalentManagerId: '',
    internalNotes: ''
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!id) return;
    fetchAll();
  }, [id]);

  const fetchAll = async () => {
    try {
      setLoading(true);
      const requestId = Array.isArray(id) ? id[0] : id;
      if (!requestId) return;

      // Keep this query deliberately simple; detail pages must still open if
      // optional relationship metadata is not present in the Supabase schema.
      const requestPromise = supabase
        .from('talent_requests')
        .select('*')
        .eq('payload->>id', requestId)
        .maybeSingle();

      // Fetch users and role assignments for assignment dropdowns.
      const sessionPromise = supabase.auth.getSession();
      const authUserPromise = supabase.auth.getUser();
      const adminPromise = supabase
        .from('users')
        .select('*');
      const rolesPromise = supabase
        .from('roles')
        .select('id, name');
      const userRolesPromise = supabase
        .from('user_roles')
        .select('user_id, role_id');

      const dbPromise = fetch('/api/db').then(r => r.json());

      const [
        { data: { session } },
        { data: { user: authUser } },
        { data: requestData, error: reqError },
        { data: adminData },
        { data: rolesData, error: rolesError },
        { data: userRolesData, error: userRolesError },
        localDb
      ] = await Promise.all([
        sessionPromise,
        authUserPromise,
        requestPromise,
        adminPromise,
        rolesPromise,
        userRolesPromise,
        dbPromise
      ]);

      if (reqError) {
        console.error('Failed to load request from talent_requests:', reqError);
      }
      if (rolesError) console.error('Failed to load roles:', rolesError);
      if (userRolesError) console.error('Failed to load user roles:', userRolesError);

      if (!reqError && requestData && requestData.payload) {
        const row = requestData;
        const req = row.payload;

        setRequestRow(row);

        // Priority of truth for assignments:
        // 1. dedicated DB column (talent_manager_id / account_manager_id)
        // 2. payload field (legacy / fallback)
        const resolvedAMId = row.account_manager_id || req.assignedAccountManagerId || '';
        const resolvedTMId = row.talent_manager_id || req.assignedTalentManagerId || '';

        // Sync resolved IDs back into the payload object so display code is consistent
        const mergedReq = {
          ...req,
          assignedAccountManagerId: resolvedAMId,
          assignedTalentManagerId: resolvedTMId,
          status: normalizeRequestStatus(req.status),
        };

        setRequest(mergedReq);
        setFormData({
          status: normalizeRequestStatus(req.status),
          urgency: req.urgency || 'Standard',
          assignedAccountManagerId: resolvedAMId,
          assignedTalentManagerId: resolvedTMId,
          internalNotes: req.internalNotes || ''
        });

        // Fetch the client's org — also read account_manager_id from there as additional source
        if (req.clientId) {
          const { data: orgData } = await supabase
            .from('client_profiles')
            .select('organizations(*, account_manager:account_manager_id(id, name, email))')
            .eq('user_id', req.clientId)
            .maybeSingle();

          if (orgData?.organizations) {
            const org = orgData.organizations as any;
            setClient(org);

            // If the request has no AM yet, inherit from the org
            if (!resolvedAMId && org.account_manager_id) {
              setFormData(prev => ({ ...prev, assignedAccountManagerId: org.account_manager_id }));
              setRequest((prev: any) => ({ ...prev, assignedAccountManagerId: org.account_manager_id }));
            }
          }
        }
      } else {
        const fallbackRequest = (localDb?.clientRequests || []).find((req: any) => req.id === requestId);
        if (fallbackRequest) {
          const mergedFallback = {
            ...fallbackRequest,
            status: normalizeRequestStatus(fallbackRequest.status),
          };
          setRequestRow(null);
          setRequest(mergedFallback);
          setFormData({
            status: normalizeRequestStatus(fallbackRequest.status),
            urgency: fallbackRequest.urgency || 'Standard',
            assignedAccountManagerId: fallbackRequest.assignedAccountManagerId || '',
            assignedTalentManagerId: fallbackRequest.assignedTalentManagerId || '',
            internalNotes: fallbackRequest.internalNotes || ''
          });
        }
      }

      setAdminUsers(
        mergeAuthenticatedUserIntoAssignableUsers(
          enrichUsersWithRoleAssignments(adminData || [], rolesData || [], userRolesData || []),
          authUser || session?.user,
        )
      );

      // ── Fetch matches for this request from Supabase (primary source) ──
      const { data: supaMatches } = await supabase
        .from('matches')
        .select('*')
        .eq('request_id', requestId);

      // Normalise to camelCase so UI is consistent
      const supaMatchesNorm = (supaMatches || []).map((m: any) => ({
        ...m,
        requestId: m.request_id || m.requestId,
        talentId: m.talent_id || m.talentId,
      }));

      // Merge local-db matches as fallback (catches any written only to /api/db)
      const localMatches = (localDb?.matches || []).filter((m: any) => m.requestId === requestId);
      const combinedMatches: any[] = [...supaMatchesNorm];
      localMatches.forEach((lm: any) => {
        if (!combinedMatches.find(sm => sm.id === lm.id)) combinedMatches.push(lm);
      });

      // ── Populate talent details ──
      // Prefer Supabase talent_profiles / users for display names
      const talentIds = [...new Set(combinedMatches.map(m => m.talentId || m.talent_id))].filter(Boolean);
      let supabaseTalentMap: Record<string, any> = {};
      if (talentIds.length > 0) {
        const { data: talentUsers } = await supabase
          .from('users')
          .select('id, name, email')
          .in('id', talentIds);
        (talentUsers || []).forEach((u: any) => { supabaseTalentMap[u.id] = u; });
      }

      const populated = combinedMatches.map(m => {
        const tid = m.talentId || m.talent_id;
        const localTalent = (localDb?.talents || []).find((t: any) => t.id === tid);
        const supabaseTalent = supabaseTalentMap[tid];
        const talent = localTalent || (supabaseTalent ? { ...supabaseTalent, name: supabaseTalent.name || supabaseTalent.email } : null);
        return { ...m, talent, talentId: tid };
      });
      setMatches(populated);

    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    const requestId = Array.isArray(id) ? id[0] : id;
    const normalizedStatus = normalizeRequestStatus(formData.status);
    if (normalizedStatus === 'Sourcing Talent' && !formData.assignedTalentManagerId) {
      alert("You must assign a Talent Manager before advancing to 'Sourcing Talent' (Matching).");
      return;
    }

    setIsSubmitting(true);
    try {
      const ensureAssignableUserExists = async (userId: string, label: string) => {
        const user = adminUsers.find(u => u.id === userId);
        if (!user) throw new Error(`Selected ${label} could not be found. Please refresh and try again.`);
        if (!user.email) throw new Error(`Selected ${label} is missing an email address and cannot be saved.`);

        const safeUserRole = getDatabaseSafeAdminRole(user);
        const assignableRoleId = getPrimaryAssignableRoleId(user, safeUserRole);

        const { error: userUpsertError } = await supabase.from('users').upsert({
          id: user.id,
          email: user.email,
          password_hash: 'auth_managed',
          role: safeUserRole,
          status: 'active',
          email_verified: true,
        }, { onConflict: 'id' });

        if (userUpsertError) {
          throw new Error(`Could not prepare ${label} user record: ${userUpsertError.message}`);
        }

        const { error: roleUpsertError } = await supabase.from('roles').upsert({
          id: assignableRoleId,
          name: assignableRoleId,
        }, { onConflict: 'id' });

        if (roleUpsertError) {
          console.error(`Failed to verify ${label} role:`, roleUpsertError);
          return;
        }

        const { error: userRoleError } = await supabase.from('user_roles').upsert({
          id: `ur_${user.id}_${assignableRoleId}`,
          user_id: user.id,
          role_id: assignableRoleId,
        }, { onConflict: 'id' });

        if (userRoleError) console.error(`Failed to verify ${label} user role:`, userRoleError);
      };

      if (formData.assignedAccountManagerId) {
        await ensureAssignableUserExists(formData.assignedAccountManagerId, 'Account Manager');
      }
      if (formData.assignedTalentManagerId) {
        await ensureAssignableUserExists(formData.assignedTalentManagerId, 'Talent Manager');
      }

      const updatedPayload = {
        ...request,
        status: normalizedStatus,
        urgency: formData.urgency,
        assignedAccountManagerId: formData.assignedAccountManagerId,
        assignedTalentManagerId: formData.assignedTalentManagerId,
        internalNotes: formData.internalNotes,
      };

      // 1. Update payload + dedicated columns on talent_requests in one call
      const { error: updateErr } = await supabase
        .from('talent_requests')
        .update({
          payload: updatedPayload,
          talent_manager_id: formData.assignedTalentManagerId || null,
          account_manager_id: formData.assignedAccountManagerId || null,
        })
        .eq('payload->>id', requestId as string);

      if (updateErr) throw updateErr;

      // 2. Also update the organization's account manager
      if (formData.assignedAccountManagerId && client?.id) {
        const { error: orgErr } = await supabase
          .from('organizations')
          .update({ account_manager_id: formData.assignedAccountManagerId })
          .eq('id', client.id);
        if (orgErr) throw new Error(`Failed to update client Account Manager: ${orgErr.message}`);
      }

      // 3. Audit log
      await supabase.from('audit_logs').insert({
        actor: 'Super Admin',
        action: 'Update Service Request',
        details: `Updated request ${requestId} → status: ${normalizedStatus}, AM: ${formData.assignedAccountManagerId}, TM: ${formData.assignedTalentManagerId}`
      });

      // 4. Keep the local snapshot in sync for legacy views and fallback readers.
      try {
        const dbRes = await fetch('/api/db');
        if (dbRes.ok) {
          const db = await dbRes.json();
          const updatedRequests = (db.clientRequests || []).map((req: any) =>
            req.id === requestId ? { ...req, ...updatedPayload } : req
          );
          await fetch('/api/db', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ clientRequests: updatedRequests })
          });
        }
      } catch (syncErr) {
        console.error('Failed to sync request snapshot:', syncErr);
      }

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
  const currentAMId = isEditing ? formData.assignedAccountManagerId : request.assignedAccountManagerId;
  const currentTMId = isEditing ? formData.assignedTalentManagerId : request.assignedTalentManagerId;
  const am = adminUsers.find(u => u.id === currentAMId);
  const tm = adminUsers.find(u => u.id === currentTMId);
  const accountManagerOptions = adminUsers.filter(isAccountManagerAssignable);
  const talentManagerOptions = adminUsers.filter(isTalentManagerAssignable);

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
          <title>Request {request.id?.split('-')[0]} - Kongila Admin</title>
        </Head>

        <button onClick={() => router.push('/?tab=hiring-requests')} className="btn-secondary" style={{ marginBottom: '20px', fontSize: '13px', padding: '6px 14px', borderRadius: '8px' }}>← Back to Request Queue</button>

        <div className="page-header" style={{ marginBottom: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
              <h1 className="page-title" style={{ margin: 0 }}>{request.serviceType}</h1>
              {request.urgency === 'ASAP' && (
                <span style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#EF4444', padding: '4px 10px', borderRadius: '999px', fontSize: '12px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ fontSize: '14px' }}>🚩</span> ASAP
                </span>
              )}
              <span style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', padding: '4px 10px', borderRadius: '999px', fontSize: '12px', fontWeight: 600 }}>
                {normalizeRequestStatus(request.status)}
              </span>
            </div>
            <p className="page-subtitle">Submitted by {client?.name || request.clientName || 'Unknown Client'} on {formatDate(request.createdAt)}</p>
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
                <button className="btn-secondary" style={{ padding: '8px 16px', borderRadius: '8px', fontSize: '13px' }}>Message Client</button>
                {(normalizeRequestStatus(request.status) === 'Sourcing Talent' || normalizeRequestStatus(request.status) === 'Candidates Ready') && (
                  <button onClick={() => router.push(`/matching/${request.id}`)} className="btn-primary" style={{ padding: '8px 16px', borderRadius: '8px', fontSize: '13px', background: '#10B981', borderColor: '#10B981' }}>
                    Open Matching Engine
                  </button>
                )}
                <button onClick={() => setIsEditing(true)} className="btn-primary" style={{ padding: '8px 16px', borderRadius: '8px', fontSize: '13px' }}>Manage Request</button>
              </>
            )}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <GlassCard>
              <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '24px' }}>Request Details</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', fontSize: '13px' }}>
                <div>
                  <div style={{ color: 'var(--text-muted)', marginBottom: '4px' }}>Role Title / Description</div>
                  <div style={{ fontWeight: 600 }}>{request.roleDescription || 'N/A'}</div>
                </div>
                <div>
                  <div style={{ color: 'var(--text-muted)', marginBottom: '4px' }}>Number of Hires</div>
                  <div style={{ fontWeight: 600 }}>{request.numberOfHires || 1}</div>
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
                    {(normalizeRequestStatus(request.status) === 'Sourcing Talent') && (
                      <div style={{ marginTop: '12px' }}>
                        <button onClick={() => router.push(`/matching/${request.id}`)} className="btn-primary" style={{ padding: '8px 16px', borderRadius: '8px', fontSize: '13px', background: '#10B981', borderColor: '#10B981' }}>
                          Open Matching Engine →
                        </button>
                      </div>
                    )}
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
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>Pipeline Status</label>
                    <select
                      className="kongila-input"
                      value={formData.status}
                      onChange={e => setFormData({ ...formData, status: e.target.value })}
                      style={{ width: '100%', padding: '10px', borderRadius: '8px' }}
                    >
                      <option value="New Request">New Request</option>
                      <option value="Reviewing">Reviewing</option>
                      <option value="Sourcing Talent">Sourcing Talent (Matching)</option>
                      <option value="Candidates Ready">Candidates Ready</option>
                      <option value="Client Interview">Client Interview</option>
                      <option value="Offer Accepted">Offer Accepted</option>
                    </select>
                  </div>
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

            <GlassCard>
              <h3 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '16px' }}>Assignments</h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {/* Account Manager */}
                <div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '8px', fontWeight: 600 }}>Account Manager</div>
                  {isEditing ? (
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
                  {isEditing ? (
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
