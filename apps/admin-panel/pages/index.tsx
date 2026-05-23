import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import { GlassCard, Badge, NeonButton, AgentBadge } from '@kongila/ui';
import { formatCurrency, formatDate, getGradeColor } from '@kongila/utils';
import { calculateCompositeVettingGrade, generateMatchesForRequest } from '@kongila/matching-engine';
import { computePlatformMetrics } from '@kongila/analytics';
import { 
  TalentProfile, ServiceRequest, Match, AuditLog, AgentLog
} from '@kongila/shared-types';

export default function AdminPanel() {
  // DB States
  const [talents, setTalents] = useState<TalentProfile[]>([]);
  const [requests, setRequests] = useState<ServiceRequest[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [contracts, setContracts] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [agentLogs, setAgentLogs] = useState<AgentLog[]>([]);
  const [loading, setLoading] = useState(true);

  // UI Navigation
  const [activeTab, setActiveTab] = useState<'overview' | 'vetting' | 'matching'>('overview');
  
  // Selected Objects
  const [selectedTalent, setSelectedTalent] = useState<TalentProfile | null>(null);
  const [selectedRequest, setSelectedRequest] = useState<ServiceRequest | null>(null);

  // Vetting Form State
  const [editScores, setEditScores] = useState({
    technical: 90,
    workSimulation: 90,
    behavioral: 85,
    communication: 85,
    personality: 80,
    remoteReadiness: 90,
    experience: 80
  });

  // Sync filesystem DB
  const syncFromDb = async () => {
    try {
      const res = await fetch('/api/db');
      if (res.ok) {
        const dbData = await res.json();
        setTalents(dbData.talents || []);
        setRequests(dbData.clientRequests || []);
        setMatches(dbData.matches || []);
        setContracts(dbData.contracts || []);
        setAuditLogs(dbData.auditLogs || []);
        setAgentLogs(dbData.agentLogs || []);
      }
    } catch (e) {
      console.error('Failed to sync DB', e);
    } finally {
      setLoading(false);
    }
  };

  const saveToDb = async (updatedDb: any) => {
    try {
      await fetch('/api/db', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedDb)
      });
    } catch (e) {
      console.error('Failed to save DB', e);
    }
  };

  useEffect(() => {
    syncFromDb();
    const interval = setInterval(syncFromDb, 3000);
    return () => clearInterval(interval);
  }, []);

  // Set vetting form values on select
  useEffect(() => {
    if (selectedTalent) {
      setEditScores({
        technical: selectedTalent.vettingScores.technical,
        workSimulation: selectedTalent.vettingScores.workSimulation,
        behavioral: selectedTalent.vettingScores.behavioral,
        communication: selectedTalent.vettingScores.communication,
        personality: selectedTalent.vettingScores.personality,
        remoteReadiness: selectedTalent.vettingScores.remoteReadiness,
        experience: selectedTalent.vettingScores.experience
      });
    }
  }, [selectedTalent]);

  // Vetting Score Update Submit
  const handleVettingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTalent) return;

    // Calculate composite grade
    const calculation = calculateCompositeVettingGrade(editScores);

    const updatedTalents = talents.map(t => 
      t.id === selectedTalent.id 
        ? { 
            ...t, 
            vettingScores: editScores, 
            grade: calculation.grade, 
            vettingStatus: calculation.grade === 'Reject' ? 'Review' as const : 'Vetted' as const
          } 
        : t
    );

    const newAuditLog: AuditLog = {
      id: `audit_${Date.now()}`,
      actor: 'Admin Operator',
      action: 'Update Vetting Scores',
      details: `Recalculated vetting score card for ${selectedTalent.name}. Grade: ${calculation.grade} (${calculation.score}%)`,
      timestamp: new Date().toISOString()
    };

    const newAgentLog: AgentLog = {
      id: `alog_${Date.now()}`,
      agentName: 'Compliance Agent',
      message: `Audit completed: Checked 7-stage scorecard. ${selectedTalent.name} composite score locked at ${calculation.score}%.`,
      timestamp: new Date().toLocaleTimeString(),
      type: calculation.grade === 'Reject' ? 'error' : 'success'
    };

    const updatedDb = {
      talents: updatedTalents,
      clientRequests: requests,
      matches,
      tasks: [],
      contracts: [],
      notifications: [],
      auditLogs: [newAuditLog, ...auditLogs],
      agentLogs: [newAgentLog, ...agentLogs]
    };

    setTalents(updatedTalents);
    setAuditLogs([newAuditLog, ...auditLogs]);
    setAgentLogs([newAgentLog, ...agentLogs]);
    await saveToDb(updatedDb);

    setSelectedTalent(updatedTalents.find(t => t.id === selectedTalent.id) || null);
  };

  // Push shortlists manually to Client marketplace deck
  const handlePushMatch = async (matchId: string) => {
    const updatedMatches = matches.map(m => 
      m.id === matchId ? { ...m, status: 'Shortlisted' as const } : m
    );

    const targetMatch = matches.find(m => m.id === matchId);
    const talentName = targetMatch ? talents.find(t => t.id === targetMatch.talentId)?.name : 'Contractor';

    const newAuditLog: AuditLog = {
      id: `audit_${Date.now()}`,
      actor: 'Admin Operator',
      action: 'Push Match Shortlist',
      details: `Shortlisted candidate ${talentName} pushed to client's matching console.`,
      timestamp: new Date().toISOString()
    };

    const newAgentLog: AgentLog = {
      id: `alog_${Date.now()}`,
      agentName: 'Matching Agent',
      message: `Candidate ${talentName} pushed to client's dashboard shortlist deck.`,
      timestamp: new Date().toLocaleTimeString(),
      type: 'success'
    };

    const updatedDb = {
      talents,
      clientRequests: requests,
      matches: updatedMatches,
      tasks: [],
      contracts: [],
      notifications: [
        {
          id: `notif_${Date.now()}`,
          userId: 'user_client_1',
          title: 'New Matches Shortlisted',
          message: `${talentName} has been vetted and pushed to your matching shortlist deck!`,
          read: false,
          createdAt: new Date().toISOString()
        }
      ],
      auditLogs: [newAuditLog, ...auditLogs],
      agentLogs: [newAgentLog, ...agentLogs]
    };

    setMatches(updatedMatches);
    setAuditLogs([newAuditLog, ...auditLogs]);
    setAgentLogs([newAgentLog, ...agentLogs]);
    await saveToDb(updatedDb);
  };

  // MRR & Payroll Analytics calculations (25% markup markup applied)
  const metrics = computePlatformMetrics(talents, requests, matches, contracts);
  const mrrTotal = metrics.totalRevenue;
  const utilizationRate = metrics.utilizationRate;
  const activeTalentCount = metrics.activeTalentCount;
  const payoutTotal = activeTalentCount * 3600; // Average base payout of $3600 per talent

  return (
    <div className="app-shell">
      <Head>
        <title>Kongila Command — Admin Back-Office Panel</title>
        <meta name="description" content="Operational Command Center for manual vetting approval and matching engine overrides." />
      </Head>


      {/* Sidebar */}
      <div className="sidebar">
        <div className="sidebar-logo">
          <span>❖</span> Admin Core
        </div>

        <div className="sidebar-menu">
          <div 
            className={`menu-item ${activeTab === 'overview' ? 'active' : ''}`}
            onClick={() => setActiveTab('overview')}
          >
            <span>📈</span> Business Audits
          </div>
          <div 
            className={`menu-item ${activeTab === 'vetting' ? 'active' : ''}`}
            onClick={() => setActiveTab('vetting')}
          >
            <span>🛡️</span> Technical Vetting
          </div>
          <div 
            className={`menu-item ${activeTab === 'matching' ? 'active' : ''}`}
            onClick={() => setActiveTab('matching')}
          >
            <span>🤝</span> Request Matches
          </div>
        </div>

        <div className="sidebar-footer">
          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Logged in as:</div>
          <div style={{ fontSize: '14px', fontWeight: 600 }}>Super Admin (Operational)</div>
        </div>
      </div>

      {/* Main Content */}
      <div className="main-content">
        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div>
            <div className="page-header">
              <div>
                <h1 className="page-title">Operational Command Hub</h1>
                <p className="page-subtitle">Monorepo execution analytics, Monthly MRR markups, and audit trails.</p>
              </div>
            </div>

            {/* Stats Card Grid */}
            <div className="stats-card-grid">
              <GlassCard>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Gross platform MRR</div>
                <div className="stat-value">{formatCurrency(mrrTotal)}</div>
                <div style={{ fontSize: '11px', color: 'var(--accent-cyan)', marginTop: '8px' }}>Includes 25% EOR Markup</div>
              </GlassCard>

              <GlassCard>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Contractor Utilization</div>
                <div className="stat-value">{utilizationRate}%</div>
                <div style={{ fontSize: '11px', color: 'var(--accent-green)', marginTop: '8px' }}>{activeTalentCount} of {talents.length} deployed</div>
              </GlassCard>

              <GlassCard>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Monthly EOR Payouts</div>
                <div className="stat-value">{formatCurrency(payoutTotal)}</div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '8px' }}>Vetted local EOR coverage</div>
              </GlassCard>

              <GlassCard>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Active Requests</div>
                <div className="stat-value">{requests.length} Roles</div>
                <div style={{ fontSize: '11px', color: 'var(--accent-gold)', marginTop: '8px' }}>{requests.filter(r=>r.status==='New Request').length} New Intakes</div>
              </GlassCard>
            </div>

            {/* Bottom Audit Timeline */}
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '32px' }}>
              <GlassCard>
                <h3 style={{ fontSize: '16px', marginBottom: '16px' }}>Master Compliance Audit Logs</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {auditLogs.length === 0 ? (
                    <p style={{ color: 'var(--text-muted)' }}>Awaiting action audits...</p>
                  ) : (
                    auditLogs.map(log => (
                      <div key={log.id} style={{ borderBottom: '1px solid var(--border-glass)', paddingBottom: '12px', display: 'flex', gap: '12px', fontSize: '13px' }}>
                        <span style={{ color: 'var(--accent-cyan)', fontWeight: 700 }}>[{log.actor}]</span>
                        <div style={{ flexGrow: 1 }}>
                          <strong>{log.action}:</strong> {log.details}
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>{formatDate(log.timestamp)}</div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </GlassCard>

              {/* Agent Console */}
              <div className="agent-terminal">
                <div className="terminal-header">
                  <div className="terminal-dots">
                    <div className="dot dot-red" />
                    <div className="dot dot-yellow" />
                    <div className="dot dot-green" />
                  </div>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700 }}>LIVE COMPLIANCE AUDITOR</span>
                </div>
                <div className="terminal-body">
                  {agentLogs.map((log) => (
                    <div key={log.id} className="log-entry">
                      <span className="log-time">[{log.timestamp}]</span>
                      <div style={{ flexGrow: 1 }}>
                        <AgentBadge name={log.agentName} />
                        <span className={`log-text log-${log.type}`} style={{ marginLeft: '6px', fontSize: '11px' }}>
                          {log.message}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Technical Vetting Tab */}
        {activeTab === 'vetting' && (
          <div>
            <div className="page-header">
              <div>
                <h1 className="page-title">Technical Vetting Framework</h1>
                <p className="page-subtitle">Evaluate CV screening, behavioral scorecards, and work simulation deliverables.</p>
              </div>
            </div>

            <div className="dashboard-grid">
              <GlassCard>
                <h2 style={{ fontSize: '18px', marginBottom: '16px' }}>Applicant Pools</h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {talents.map(t => (
                    <div 
                      key={t.id} 
                      style={{ 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        alignItems: 'center', 
                        background: selectedTalent?.id === t.id ? 'rgba(0, 255, 204, 0.03)' : 'rgba(0,0,0,0.15)', 
                        padding: '12px 16px', 
                        borderRadius: '10px', 
                        border: selectedTalent?.id === t.id ? '1px solid var(--accent-cyan)' : '1px solid var(--border-glass)',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease'
                      }}
                      onClick={() => setSelectedTalent(t)}
                    >
                      <div>
                        <div style={{ fontSize: '14px', fontWeight: 700 }}>{t.name}</div>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{t.title}</div>
                      </div>
                      <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                        <Badge text={t.vettingStatus} status={t.vettingStatus} />
                        <span style={{ fontWeight: 800, color: getGradeColor(t.grade) }}>{t.grade}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </GlassCard>

              {/* Scorecard Editor */}
              <div>
                {!selectedTalent ? (
                  <GlassCard style={{ textAlign: 'center', padding: '40px' }}>
                    <p style={{ color: 'var(--text-secondary)' }}>Select an applicant from the pool list to view or edit vetting scorecards.</p>
                  </GlassCard>
                ) : (
                  <GlassCard>
                    <h3 style={{ fontSize: '18px', marginBottom: '4px' }}>Edit 7-Stage Vetting</h3>
                    <p style={{ color: 'var(--text-muted)', fontSize: '12px', marginBottom: '20px' }}>Adjust weights. Grades auto-compute instantly.</p>
                    
                    <form onSubmit={handleVettingSubmit}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                        <div>
                          <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span>Technical Assessment (25%)</span>
                            <span>{editScores.technical}%</span>
                          </label>
                          <input 
                            type="range" min="0" max="100" className="form-input" style={{ padding: 0 }}
                            value={editScores.technical}
                            onChange={e => setEditScores({ ...editScores, technical: parseInt(e.target.value) })}
                          />
                        </div>

                        <div>
                          <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span>Work Simulation (20%)</span>
                            <span>{editScores.workSimulation}%</span>
                          </label>
                          <input 
                            type="range" min="0" max="100" className="form-input" style={{ padding: 0 }}
                            value={editScores.workSimulation}
                            onChange={e => setEditScores({ ...editScores, workSimulation: parseInt(e.target.value) })}
                          />
                        </div>

                        <div>
                          <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span>Behavioural Fit (15%)</span>
                            <span>{editScores.behavioral}%</span>
                          </label>
                          <input 
                            type="range" min="0" max="100" className="form-input" style={{ padding: 0 }}
                            value={editScores.behavioral}
                            onChange={e => setEditScores({ ...editScores, behavioral: parseInt(e.target.value) })}
                          />
                        </div>

                        <div>
                          <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span>Communication Skills (15%)</span>
                            <span>{editScores.communication}%</span>
                          </label>
                          <input 
                            type="range" min="0" max="100" className="form-input" style={{ padding: 0 }}
                            value={editScores.communication}
                            onChange={e => setEditScores({ ...editScores, communication: parseInt(e.target.value) })}
                          />
                        </div>

                        <div>
                          <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span>Personality Style (10%)</span>
                            <span>{editScores.personality}%</span>
                          </label>
                          <input 
                            type="range" min="0" max="100" className="form-input" style={{ padding: 0 }}
                            value={editScores.personality}
                            onChange={e => setEditScores({ ...editScores, personality: parseInt(e.target.value) })}
                          />
                        </div>

                        <div>
                          <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span>Remote Readiness (10%)</span>
                            <span>{editScores.remoteReadiness}%</span>
                          </label>
                          <input 
                            type="range" min="0" max="100" className="form-input" style={{ padding: 0 }}
                            value={editScores.remoteReadiness}
                            onChange={e => setEditScores({ ...editScores, remoteReadiness: parseInt(e.target.value) })}
                          />
                        </div>
                      </div>

                      <hr style={{ borderColor: 'var(--border-glass)', margin: '20px 0' }} />

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>COMPOSITE GRADE</div>
                          <div style={{ fontSize: '24px', fontWeight: 800, color: getGradeColor(selectedTalent.grade) }}>
                            {selectedTalent.grade} ({calculateCompositeVettingGrade(selectedTalent.vettingScores).score}%)
                          </div>
                        </div>
                        <NeonButton type="submit">Recalculate Vetting Card</NeonButton>
                      </div>
                    </form>
                  </GlassCard>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Requests & Matches Tab */}
        {activeTab === 'matching' && (
          <div>
            <div className="page-header">
              <div>
                <h1 className="page-title">Intake Request & Shortlist Matcher</h1>
                <p className="page-subtitle">Review client smart intakes, inspect radar matches, and override shortlists.</p>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 2fr', gap: '32px' }}>
              <GlassCard>
                <h2 style={{ fontSize: '18px', marginBottom: '16px' }}>Active Role Intakes</h2>
                {requests.length === 0 ? (
                  <p style={{ color: 'var(--text-muted)' }}>No request intakes logged.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {requests.map(req => (
                      <div 
                        key={req.id}
                        style={{
                          padding: '12px',
                          borderRadius: '10px',
                          border: selectedRequest?.id === req.id ? '1px solid var(--accent-cyan)' : '1px solid var(--border-glass)',
                          background: selectedRequest?.id === req.id ? 'rgba(0, 255, 204, 0.02)' : 'rgba(0,0,0,0.1)',
                          cursor: 'pointer'
                        }}
                        onClick={() => setSelectedRequest(req)}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                          <strong>{req.serviceType}</strong>
                          <Badge text={req.status} status={req.status} />
                        </div>
                        <div style={{ fontSize: '13px', fontWeight: 600 }}>{req.roleDescription}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '6px' }}>
                          Client: {req.clientName}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </GlassCard>

              {/* Candidate Shortlist Overrides */}
              <div>
                {!selectedRequest ? (
                  <GlassCard style={{ textAlign: 'center', padding: '40px' }}>
                    <p style={{ color: 'var(--text-secondary)' }}>Select a client service request to audit matched candidate scorecards.</p>
                  </GlassCard>
                ) : (
                  <div>
                    <h3 style={{ fontSize: '18px', marginBottom: '16px' }}>Radar Matching Shortlists: {selectedRequest.serviceType}</h3>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      {matches.filter(m => m.requestId === selectedRequest.id).map(match => {
                        const talent = talents.find(t => t.id === match.talentId);
                        if (!talent) return null;

                        return (
                          <GlassCard key={match.id}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                              <div>
                                <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '6px' }}>
                                  <h4 style={{ fontSize: '15px' }}>{talent.name}</h4>
                                  <span style={{ fontSize: '14px', fontWeight: 800, color: getGradeColor(talent.grade) }}>
                                    Grade: {talent.grade}
                                  </span>
                                  <Badge text={match.status} status={match.status} />
                                </div>
                                <div style={{ fontSize: '13px', color: 'var(--accent-cyan)', fontWeight: 600, marginBottom: '6px' }}>{talent.title}</div>
                                <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                                  {talent.bio}
                                </p>

                                <div style={{ display: 'flex', gap: '20px', fontSize: '11px', color: 'var(--text-muted)' }}>
                                  <div>Skills: {match.breakdown.skillFit}%</div>
                                  <div>Personality: {match.breakdown.personalityFit}%</div>
                                  <div>Availability: {match.breakdown.availability}%</div>
                                </div>
                              </div>

                              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--accent-green)', marginBottom: '10px' }}>
                                  {match.score}% FIT
                                </div>
                                {match.status === 'Applied' && (
                                  <NeonButton onClick={() => handlePushMatch(match.id)}>
                                    Approve & Shortlist
                                  </NeonButton>
                                )}
                              </div>
                            </div>
                          </GlassCard>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
