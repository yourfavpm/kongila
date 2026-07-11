import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { GlassCard, KongilaLoader } from '@kongila/ui';
import { formatDate, formatCurrency, getGradeColor } from '@kongila/utils';
import { supabase } from '../../lib/supabaseClient';

export default function RequestDetailView() {
  const router = useRouter();
  const { id } = router.query;
  
  const [request, setRequest] = useState<any>(null);
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
    const fetchRequest = async () => {
      try {
        
        const requestPromise = supabase
          .from('talent_requests')
          .select('*')
          .eq('payload->>id', id as string)
          .maybeSingle();

        const adminPromise = supabase
          .from('users')
          .select('*')
          .in('role', ['admin', 'ops_manager']);

        const dbPromise = fetch('/api/db').then(r => r.json());

        const [{ data: requestData, error: reqError }, { data: adminData }, localDb] = await Promise.all([
          requestPromise,
          adminPromise,
          dbPromise
        ]);

        if (reqError) {
          console.error(reqError);
          return;
        }

        if (requestData && requestData.payload) {
          const req = requestData.payload;
          setRequest(req);
          setFormData({
            status: req.status || 'New Request',
            urgency: req.urgency || 'Standard',
            assignedAccountManagerId: req.assignedAccountManagerId || '',
            assignedTalentManagerId: req.assignedTalentManagerId || '',
            internalNotes: req.internalNotes || ''
          });
          
          if (req.clientId) {
            const { data: orgData } = await supabase
               .from('client_profiles')
               .select('organizations(*)')
               .eq('user_id', req.clientId)
               .maybeSingle();

            if (orgData && orgData.organizations) {
              setClient(orgData.organizations);
            }
          }
        }
        
        setAdminUsers(adminData || []);

        if (localDb && localDb.matches) {
          const reqMatches = localDb.matches.filter((m: any) => m.requestId === id);
          const populatedMatches = reqMatches.map((m: any) => {
            const talent = (localDb.talents || []).find((t: any) => t.id === m.talentId);
            return { ...m, talent };
          });
          setMatches(populatedMatches);
        }

      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchRequest();
  }, [id]);

  const handleSave = async () => {
    if (formData.status === 'Sourcing Talent' && !formData.assignedTalentManagerId) {
      alert("You must assign a Talent Manager before advancing to 'Sourcing Talent' (Matching).");
      return;
    }

    setIsSubmitting(true);
    try {
      
      const updatedPayload = {
        ...request,
        ...formData
      };
      
      // Update the payload in talent_requests
      const { error: updateErr } = await supabase
        .from('talent_requests')
        .update({ payload: updatedPayload })
        .eq('payload->>id', id as string);

      if (updateErr) throw updateErr;
      
      // Add a real audit log via Supabase
      const { error: auditErr } = await supabase.from('audit_logs').insert({
        actor: 'Super Admin',
        action: 'Update Service Request',
        details: `Updated request ${id} to status ${formData.status}`
      });
      
      if (auditErr) console.error("Audit log error:", auditErr);
      
      setRequest(updatedPayload);
      setIsEditing(false);
    } catch (e) {
      console.error(e);
      alert('Failed to save request.');
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
    const slaTarget = 48; // default 48h
    return {
      hoursElapsed: hoursElapsed.toFixed(1),
      hoursRemaining: (slaTarget - hoursElapsed).toFixed(1),
      isBreached: hoursElapsed > slaTarget,
      isAtRisk: hoursElapsed > slaTarget * 0.75
    };
  };

  const sla = calculateSLA();
  
  const am = adminUsers.find(u => u.id === (isEditing ? formData.assignedAccountManagerId : request.assignedAccountManagerId));
  const tm = adminUsers.find(u => u.id === (isEditing ? formData.assignedTalentManagerId : request.assignedTalentManagerId));

  return (
    <div className="app-shell" style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-primary)' }}>
      <div style={{ flex: 1, padding: '40px', overflowY: 'auto' }}>
        <Head>
          <title>Request {request.id.split('-')[0]} - Kongila Admin</title>
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
                {request.status}
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
                {request.status === 'Sourcing Talent' && (
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
                  <div style={{ fontWeight: 600 }}>{request.budget ? formatCurrency(request.budget) : 'Not specified'}</div>
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

            {matches.length > 0 && (
              <GlassCard>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <h3 style={{ fontSize: '18px', fontWeight: 700, margin: 0 }}>Submitted Candidates</h3>
                  <span style={{ background: 'var(--bg-tertiary)', padding: '4px 10px', borderRadius: '999px', fontSize: '12px', fontWeight: 600 }}>{matches.length} Candidates</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {matches.map(match => (
                    <div key={match.id} style={{ display: 'flex', gap: '16px', padding: '16px', background: 'var(--bg-tertiary)', borderRadius: '12px', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                        <img src={match.talent?.profilePhotoUrl || 'https://via.placeholder.com/50'} alt="" style={{ width: '50px', height: '50px', borderRadius: '50%', objectFit: 'cover' }} />
                        <div>
                          <div style={{ fontWeight: 700, fontSize: '15px' }}>{match.talent?.name || 'Unknown Talent'}</div>
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
                          <div style={{ fontWeight: 600, fontSize: '13px' }}>{match.status}</div>
                        </div>
                        <button onClick={() => window.open(`/talents/${match.talentId}`, '_blank')} className="btn-secondary" style={{ padding: '6px 12px', fontSize: '12px', borderRadius: '6px' }}>
                          View Profile
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </GlassCard>
            )}
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
                {sla.isBreached && (
                  <div style={{ fontSize: '11px', color: '#EF4444', marginTop: '6px', fontWeight: 600 }}>SLA Breached</div>
                )}
              </div>

              {isEditing ? (
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
              ) : null}
            </GlassCard>

            <GlassCard>
              <h3 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '16px' }}>Assignments</h3>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
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
                      {adminUsers.map(u => <option key={u.id} value={u.id}>{u.name || u.email}</option>)}
                    </select>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: 'var(--bg-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 700 }}>
                        {(am?.name || am?.email || 'A')[0]}
                      </div>
                      <span style={{ fontSize: '13px', fontWeight: 500 }}>{am?.name || am?.email || 'Unassigned'}</span>
                    </div>
                  )}
                </div>

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
                      {adminUsers.map(u => <option key={u.id} value={u.id}>{u.name || u.email}</option>)}
                    </select>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: 'var(--bg-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 700 }}>
                        {(tm?.name || tm?.email || 'T')[0]}
                      </div>
                      <span style={{ fontSize: '13px', fontWeight: 500 }}>{tm?.name || tm?.email || 'Unassigned'}</span>
                    </div>
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
