  // ─── Team / Contracts State ─────────────────────────────────────
  const [teamContracts, setTeamContracts] = React.useState<any[]>([]);
  const [showReplacementModal, setShowReplacementModal] = React.useState(false);
  const [replacementTarget, setReplacementTarget] = React.useState<any>(null);
  const [replacementForm, setReplacementForm] = React.useState({ reason: 'Performance', notes: '' });
  const [teamLoading, setTeamLoading] = React.useState(false);

  React.useEffect(() => {
    async function fetchContracts() {
      if (!currentUser?.id) return;
      const { data, error } = await supabase
        .from('contracts')
        .select('*')
        .eq('client_id', currentUser.id)
        .order('start_date', { ascending: false });
        
      if (!error && data) {
        setTeamContracts(data);
      }
    }
    fetchContracts();
    
    // Set up real-time subscription
    const subscription = supabase.channel('client_contracts_channel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'contracts', filter: `client_id=eq.${currentUser?.id}` }, payload => {
        fetchContracts();
      })
      .subscribe();
      
    return () => {
      supabase.removeChannel(subscription);
    };
  }, [currentUser?.id]);

  // Mock Remotan Live Performance Score (Fluctuates every 5 mins per talent)
  const getLivePerformanceScore = (talentId: string, baseScore: number = 85) => {
    const seed = talentId.charCodeAt(0) + Math.floor(Date.now() / 300000);
    // Varies by +/- 4 points based on 5-minute seed
    const variation = (seed % 9) - 4;
    return Math.min(100, Math.max(0, baseScore + variation));
  };

  const handleRequestReplacement = async () => {
    if (!replacementTarget) return;
    
    setTeamLoading(true);
    // REQ-KC-703: Auto-provision a new internal ServiceRequest
    const { data: newRequest, error: reqErr } = await supabase.from('talent_requests').insert({
      client_id: currentUser?.id,
      title: `${replacementTarget.role_title} (Replacement)`,
      service_type: 'Replacement',
      status: 'reviewing',
      budget: replacementTarget.client_monthly_fee_usd || 0,
      payload: {
        original_contract_id: replacementTarget.id,
        reason: replacementForm.reason,
        notes: replacementForm.notes,
        is_replacement: true
      }
    }).select().single();

    setTeamLoading(false);

    if (reqErr) {
      alert('Failed to submit replacement request. Please try again or contact your Account Manager.');
      return;
    }

    setShowReplacementModal(false);
    setReplacementTarget(null);
    setReplacementForm({ reason: 'Performance', notes: '' });
    
    // Simulate notifying Ops Manager and Account Manager
    triggerBanner("Your replacement request has been received. We'll begin sourcing immediately — typical replacement time is 10 business days.", 'success');
  };

  const renderContracts = () => {
    // Separate active and past contracts
    const activeContractsList = teamContracts.filter(c => ['active', 'pending'].includes(c.status));
    const pastContractsList = teamContracts.filter(c => !['active', 'pending'].includes(c.status));

    // Calculate Team Performance Summary
    let totalSpend = 0;
    let totalScore = 0;
    activeContractsList.forEach(c => {
      totalSpend += Number(c.client_monthly_fee_usd) || 0;
      // using a deterministic base score for consistency across renders based on role length
      const base = 85 + (c.role_title?.length % 10);
      totalScore += getLivePerformanceScore(c.talent_id, base);
    });
    const avgScore = activeContractsList.length > 0 ? Math.round(totalScore / activeContractsList.length) : 0;

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      
        {/* ── Replacement Modal ─────────────────────────────────────────────── */}
        {showReplacementModal && replacementTarget && (
          <div style={{
            position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(6px)',
            zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px'
          }}>
            <div style={{ background: '#FFFFFF', borderRadius: '20px', padding: '36px', width: '100%', maxWidth: '480px', boxShadow: '0 24px 80px rgba(0,0,0,0.15)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <div>
                  <h2 style={{ fontSize: '20px', fontWeight: 900, color: '#0F172A', margin: '0 0 4px 0' }}>Request Replacement</h2>
                  <p style={{ fontSize: '12px', color: '#64748B', margin: 0 }}>{replacementTarget.talent_id} • {replacementTarget.role_title}</p>
                </div>
                <button onClick={() => { setShowReplacementModal(false); setReplacementTarget(null); }} style={{ background: '#F1F5F9', border: 'none', borderRadius: '8px', width: '36px', height: '36px', cursor: 'pointer', fontSize: '16px', color: '#475569' }}>×</button>
              </div>

              <div style={{ background: '#F8FAFC', border: '1px dashed #CBD5E1', borderRadius: '10px', padding: '12px 16px', marginBottom: '20px' }}>
                <p style={{ fontSize: '12px', color: '#64748B', margin: 0 }}>
                  A replacement request does not immediately terminate the original contract — the original talent continues working until the replacement is activated to avoid a coverage gap.
                </p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <label style={labelStyle}>Reason</label>
                  <select 
                    value={replacementForm.reason} 
                    onChange={e => setReplacementForm(f => ({ ...f, reason: e.target.value }))}
                    style={inputStyle}
                  >
                    <option value="Performance">Performance</option>
                    <option value="Skill Mismatch">Skill Mismatch</option>
                    <option value="Communication Issues">Communication Issues</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Additional Notes</label>
                  <textarea 
                    style={{ width: '100%', padding: '10px', border: '1px solid #E2E8F0', borderRadius: '8px', minHeight: '70px', resize: 'vertical' }} 
                    placeholder="Optional details to help us find a better match..." 
                    value={replacementForm.notes} 
                    onChange={e => setReplacementForm(f => ({ ...f, notes: e.target.value }))} 
                  />
                </div>

                <div style={{ display: 'flex', gap: '12px', marginTop: '4px' }}>
                  <button onClick={() => { setShowReplacementModal(false); setReplacementTarget(null); }} style={{ flex: 1, padding: '12px', borderRadius: '10px', border: '1px solid #E2E8F0', background: '#FFFFFF', fontWeight: 700, fontSize: '13px', color: '#475569', cursor: 'pointer' }}>Cancel</button>
                  <button onClick={handleRequestReplacement} disabled={teamLoading} style={{ flex: 2, padding: '12px', borderRadius: '10px', border: 'none', background: teamLoading ? '#93C5FD' : '#2563EB', fontWeight: 800, fontSize: '13px', color: '#FFFFFF', cursor: teamLoading ? 'not-allowed' : 'pointer' }}>
                    {teamLoading ? 'Submitting...' : 'Submit Request'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Header ───────────────────────────────────────────────────────── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ fontSize: '32px', fontWeight: 800, color: '#0F172A', marginBottom: '8px', letterSpacing: '-0.03em' }}>My Team</h1>
            <p style={{ fontSize: '15px', color: '#64748B', margin: 0 }}>Command center for your distributed workforce.</p>
          </div>
        </div>

        {/* ── Team Performance Summary ───────────────────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px' }}>
          <Card style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ fontSize: '13px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>Avg Performance Score</div>
            <div style={{ fontSize: '36px', fontWeight: 900, color: avgScore >= 80 ? '#10B981' : (avgScore >= 60 ? '#F59E0B' : '#EF4444') }}>
              {activeContractsList.length > 0 ? avgScore : '--'}
            </div>
            <div style={{ fontSize: '12px', color: '#94A3B8' }}>Live from Remotan (updated 5m ago)</div>
          </Card>
          <Card style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ fontSize: '13px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>Active Headcount</div>
            <div style={{ fontSize: '36px', fontWeight: 900, color: '#0F172A' }}>{activeContractsList.length}</div>
            <div style={{ fontSize: '12px', color: '#94A3B8' }}>Across all regions</div>
          </Card>
          <Card style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ fontSize: '13px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>Monthly Spend</div>
            <div style={{ fontSize: '36px', fontWeight: 900, color: '#0F172A' }}>${totalSpend.toLocaleString()}</div>
            <div style={{ fontSize: '12px', color: '#94A3B8' }}>Total inclusive of EOR fees</div>
          </Card>
        </div>

        {/* ── Active Team Grid ─────────────────────────────────────────────── */}
        <Card style={{ padding: '0', overflow: 'hidden' }}>
          <div style={{ padding: '24px', borderBottom: '1px solid #E2E8F0', background: '#F8FAFC' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#0F172A', margin: 0 }}>Active Team</h3>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #E2E8F0' }}>
                <th style={{ padding: '16px 24px', fontWeight: 700, color: '#475569', fontSize: '11px', textTransform: 'uppercase' }}>Talent</th>
                <th style={{ padding: '16px 24px', fontWeight: 700, color: '#475569', fontSize: '11px', textTransform: 'uppercase' }}>Role & Commitment</th>
                <th style={{ padding: '16px 24px', fontWeight: 700, color: '#475569', fontSize: '11px', textTransform: 'uppercase' }}>Performance</th>
                <th style={{ padding: '16px 24px', fontWeight: 700, color: '#475569', fontSize: '11px', textTransform: 'uppercase' }}>Monthly Cost</th>
                <th style={{ padding: '16px 24px', fontWeight: 700, color: '#475569', fontSize: '11px', textTransform: 'uppercase', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {activeContractsList.length > 0 ? (
                activeContractsList.map(c => {
                  const base = 85 + (c.role_title?.length % 10);
                  const pScore = getLivePerformanceScore(c.talent_id, base);
                  const isLowScore = pScore < 75;

                  return (
                    <tr key={c.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                      <td style={{ padding: '16px 24px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', fontWeight: 800, color: '#2563EB' }}>
                            {c.talent_id?.substring(0,2).toUpperCase()}
                          </div>
                          <div>
                            <div style={{ fontWeight: 800, color: '#0F172A', fontSize: '14px' }}>{c.talent_id}</div>
                            <div style={{ fontSize: '12px', color: '#64748B', marginTop: '2px' }}>Started: {c.start_date ? new Date(c.start_date).toLocaleDateString() : 'Pending'}</div>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '16px 24px' }}>
                        <div style={{ color: '#0F172A', fontWeight: 600, fontSize: '13px' }}>{c.role_title}</div>
                        <div style={{ fontSize: '12px', color: '#64748B', marginTop: '2px' }}>{c.engagement_type}</div>
                      </td>
                      <td style={{ padding: '16px 24px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{ 
                            width: '32px', height: '32px', borderRadius: '8px', 
                            background: pScore >= 80 ? '#ECFDF5' : (pScore >= 60 ? '#FFFBEB' : '#FEF2F2'),
                            color: pScore >= 80 ? '#10B981' : (pScore >= 60 ? '#F59E0B' : '#EF4444'),
                            display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '13px',
                            border: isLowScore ? '1px solid #EF4444' : 'none'
                          }}>
                            {pScore}
                          </div>
                          {isLowScore && <span style={{ fontSize: '12px', color: '#EF4444', fontWeight: 700 }}>Needs Attention</span>}
                        </div>
                      </td>
                      <td style={{ padding: '16px 24px', fontWeight: 700, color: '#0F172A' }}>
                        ${Number(c.client_monthly_fee_usd).toLocaleString()}
                      </td>
                      <td style={{ padding: '16px 24px', textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                          <button style={{ background: '#F1F5F9', border: 'none', color: '#475569', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>
                            Remotan
                          </button>
                          <button onClick={() => {
                            // REQ-KC-702 Minimum Engagement Gate
                            if (!c.start_date) return;
                            const started = new Date(c.start_date);
                            const now = new Date();
                            const daysDiff = (now.getTime() - started.getTime()) / (1000 * 60 * 60 * 24);
                            
                            if (daysDiff < 30) {
                              const eligibleDate = new Date(started.getTime() + (30 * 24 * 60 * 60 * 1000)).toLocaleDateString();
                              alert(`Replacement requests are available after ${eligibleDate} (30-day minimum engagement). Contact your Account Manager for urgent concerns.`);
                            } else {
                              setReplacementTarget(c);
                              setShowReplacementModal(true);
                            }
                          }} style={{ background: 'transparent', border: '1px solid #E2E8F0', color: '#0F172A', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>
                            Replace
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={5} style={{ padding: '48px', textAlign: 'center', color: '#64748B' }}>
                    No active team members.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </Card>

        {/* ── Past Team Members ────────────────────────────────────────────── */}
        {pastContractsList.length > 0 && (
          <Card style={{ padding: '0', overflow: 'hidden' }}>
            <div style={{ padding: '24px', borderBottom: '1px solid #E2E8F0', background: '#F8FAFC' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#0F172A', margin: 0 }}>Past Team Members</h3>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #E2E8F0' }}>
                  <th style={{ padding: '16px 24px', fontWeight: 700, color: '#475569', fontSize: '11px', textTransform: 'uppercase' }}>Talent</th>
                  <th style={{ padding: '16px 24px', fontWeight: 700, color: '#475569', fontSize: '11px', textTransform: 'uppercase' }}>Role</th>
                  <th style={{ padding: '16px 24px', fontWeight: 700, color: '#475569', fontSize: '11px', textTransform: 'uppercase' }}>Duration</th>
                  <th style={{ padding: '16px 24px', fontWeight: 700, color: '#475569', fontSize: '11px', textTransform: 'uppercase' }}>Final Status</th>
                  <th style={{ padding: '16px 24px', fontWeight: 700, color: '#475569', fontSize: '11px', textTransform: 'uppercase', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {pastContractsList.map(c => {
                  return (
                    <tr key={c.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                      <td style={{ padding: '16px 24px' }}>
                        <div style={{ fontWeight: 800, color: '#0F172A', fontSize: '14px' }}>{c.talent_id}</div>
                      </td>
                      <td style={{ padding: '16px 24px', color: '#475569', fontSize: '13px' }}>
                        {c.role_title}
                      </td>
                      <td style={{ padding: '16px 24px', color: '#475569', fontSize: '13px' }}>
                        {c.start_date ? new Date(c.start_date).toLocaleDateString() : 'N/A'} - {c.end_date ? new Date(c.end_date).toLocaleDateString() : 'Present'}
                      </td>
                      <td style={{ padding: '16px 24px' }}>
                        <span style={{ fontSize: '11px', fontWeight: 700, background: '#F1F5F9', color: '#475569', padding: '3px 8px', borderRadius: '12px', textTransform: 'uppercase' }}>
                          {c.status}
                        </span>
                      </td>
                      <td style={{ padding: '16px 24px', textAlign: 'right' }}>
                        <button style={{ background: 'transparent', border: '1px solid #E2E8F0', color: '#475569', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>
                          View Contract
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>
        )}
      </div>
    );
  };
