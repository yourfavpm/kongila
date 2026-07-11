  // ─── Interview State (inside component) ─────────────────────────────────────
  const [interviews, setInterviews] = React.useState<any[]>([]);
  const [interviewsLoaded, setInterviewsLoaded] = React.useState(false);
  const [interviewTab, setInterviewTab] = React.useState<'Upcoming' | 'Past' | 'Pending Confirmation'>('Upcoming');
  
  const [showRescheduleModal, setShowRescheduleModal] = React.useState(false);
  const [rescheduleTarget, setRescheduleTarget] = React.useState<any>(null);
  const [rescheduleForm, setRescheduleForm] = React.useState({ date: '', time: '10:00', notes: '' });
  
  const [showRateModal, setShowRateModal] = React.useState(false);
  const [rateTarget, setRateTarget] = React.useState<any>(null);
  const [rateForm, setRateForm] = React.useState({ rating: 0, notes: '' });
  
  const [scheduleLoading, setScheduleLoading] = React.useState(false);

  // Load interviews from Supabase
  React.useEffect(() => {
    async function fetchInterviews() {
      if (!currentUser?.id) return;
      const { data, error } = await supabase
        .from('interviews')
        .select('*')
        .eq('client_id', currentUser.id)
        .order('scheduled_time', { ascending: true });
        
      if (!error && data) {
        setInterviews(data);
      }
      setInterviewsLoaded(true);
    }
    fetchInterviews();
    
    // Set up real-time subscription
    const subscription = supabase.channel('client_interviews_channel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'interviews', filter: `client_id=eq.${currentUser?.id}` }, payload => {
        fetchInterviews();
      })
      .subscribe();
      
    return () => {
      supabase.removeChannel(subscription);
    };
  }, [currentUser?.id]);

  const handleReschedule = async () => {
    if (!rescheduleTarget || !rescheduleForm.date || !rescheduleForm.time) return;
    
    // Check 4-hour window logic
    const scheduledTime = new Date(rescheduleTarget.scheduled_time);
    const now = new Date();
    const diffHours = (scheduledTime.getTime() - now.getTime()) / (1000 * 60 * 60);
    
    if (diffHours < 4 && diffHours > 0) {
      alert('Cannot reschedule within 4 hours of the interview time. Please contact your Account Manager.');
      return;
    }
    
    setScheduleLoading(true);
    const newScheduledTime = new Date(`${rescheduleForm.date}T${rescheduleForm.time}`).toISOString();
    
    const { error } = await supabase.from('interviews').update({
      scheduled_time: newScheduledTime,
      client_notes: rescheduleForm.notes ? `Rescheduled Note: ${rescheduleForm.notes}` : null,
      status: 'pending_confirmation'
    }).eq('id', rescheduleTarget.id);
    
    setScheduleLoading(false);
    
    if (error) {
      alert('Failed to reschedule. Please try again.');
    } else {
      setShowRescheduleModal(false);
      setRescheduleTarget(null);
    }
  };
  
  const handleCancelInterview = async (id: string, scheduledTimeStr: string) => {
    const scheduledTime = new Date(scheduledTimeStr);
    const now = new Date();
    const diffHours = (scheduledTime.getTime() - now.getTime()) / (1000 * 60 * 60);
    
    if (diffHours < 4 && diffHours > 0) {
      alert('Cannot cancel within 4 hours of the interview time. Please contact your Account Manager.');
      return;
    }
    
    if (window.confirm('Are you sure you want to cancel this interview?')) {
      await supabase.from('interviews').update({ status: 'cancelled' }).eq('id', id);
    }
  };

  const handleMarkCompleteAndRate = async () => {
    if (!rateTarget || rateForm.rating === 0) {
      alert('Please select a star rating.');
      return;
    }
    
    setScheduleLoading(true);
    const { error } = await supabase.from('interviews').update({
      status: 'completed',
      client_rating: rateForm.rating,
      client_notes: rateForm.notes
    }).eq('id', rateTarget.id);
    
    setScheduleLoading(false);
    
    if (!error) {
      setShowRateModal(false);
      setRateTarget(null);
      setRateForm({ rating: 0, notes: '' });
      setInterviewTab('Past');
    }
  };

  const renderScheduling = () => {
    
    const upcoming = interviews.filter(iv => iv.status === 'scheduled');
    const past = interviews.filter(iv => ['completed', 'cancelled'].includes(iv.status));
    const pending = interviews.filter(iv => iv.status === 'pending_confirmation');

    let activeList = upcoming;
    if (interviewTab === 'Past') activeList = past;
    if (interviewTab === 'Pending Confirmation') activeList = pending;

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      
        {/* ── Reschedule Modal ─────────────────────────────────────────────── */}
        {showRescheduleModal && rescheduleTarget && (
          <div style={{
            position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(6px)',
            zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px'
          }}>
            <div style={{ background: '#FFFFFF', borderRadius: '20px', padding: '36px', width: '100%', maxWidth: '480px', boxShadow: '0 24px 80px rgba(0,0,0,0.15)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <div>
                  <h2 style={{ fontSize: '20px', fontWeight: 900, color: '#0F172A', margin: '0 0 4px 0' }}>Reschedule Interview</h2>
                  <p style={{ fontSize: '12px', color: '#64748B', margin: 0 }}>{rescheduleTarget.title}</p>
                </div>
                <button onClick={() => { setShowRescheduleModal(false); setRescheduleTarget(null); }} style={{ background: '#F1F5F9', border: 'none', borderRadius: '8px', width: '36px', height: '36px', cursor: 'pointer', fontSize: '16px', color: '#475569' }}>×</button>
              </div>

              <div style={{ background: '#FFF7ED', border: '1px solid #FED7AA', borderRadius: '10px', padding: '12px 16px', marginBottom: '20px', display: 'flex', gap: '10px' }}>
                <span style={{ fontSize: '16px' }}>📌</span>
                <div>
                  <p style={{ fontSize: '11px', fontWeight: 700, color: '#C2410C', margin: '0 0 2px 0', textTransform: 'uppercase' }}>Current Slot</p>
                  <p style={{ fontSize: '13px', color: '#7C2D12', margin: 0, fontWeight: 600 }}>{new Date(rescheduleTarget.scheduled_time).toLocaleString()}</p>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>New Date *</label>
                    <input type="date" value={rescheduleForm.date} min={new Date().toISOString().split('T')[0]} onChange={e => setRescheduleForm(f => ({ ...f, date: e.target.value }))} style={{ width: '100%', padding: '10px', border: '1px solid #E2E8F0', borderRadius: '8px' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>New Time *</label>
                    <input type="time" value={rescheduleForm.time} onChange={e => setRescheduleForm(f => ({ ...f, time: e.target.value }))} style={{ width: '100%', padding: '10px', border: '1px solid #E2E8F0', borderRadius: '8px' }} />
                  </div>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>Reason / Notes</label>
                  <textarea style={{ width: '100%', padding: '10px', border: '1px solid #E2E8F0', borderRadius: '8px', minHeight: '70px', resize: 'vertical' }} placeholder="Reason for rescheduling (optional)" value={rescheduleForm.notes} onChange={e => setRescheduleForm(f => ({ ...f, notes: e.target.value }))} />
                </div>

                <div style={{ display: 'flex', gap: '12px', marginTop: '4px' }}>
                  <button onClick={() => { setShowRescheduleModal(false); setRescheduleTarget(null); }} style={{ flex: 1, padding: '12px', borderRadius: '10px', border: '1px solid #E2E8F0', background: '#FFFFFF', fontWeight: 700, fontSize: '13px', color: '#475569', cursor: 'pointer' }}>Cancel</button>
                  <button onClick={handleReschedule} disabled={scheduleLoading} style={{ flex: 2, padding: '12px', borderRadius: '10px', border: 'none', background: scheduleLoading ? '#A78BFA' : '#7C3AED', fontWeight: 800, fontSize: '13px', color: '#FFFFFF', cursor: scheduleLoading ? 'not-allowed' : 'pointer' }}>
                    {scheduleLoading ? '⏳ Updating...' : '🔄 Confirm Reschedule'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Rate Modal ─────────────────────────────────────────────── */}
        {showRateModal && rateTarget && (
          <div style={{
            position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(6px)',
            zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px'
          }}>
            <div style={{ background: '#FFFFFF', borderRadius: '20px', padding: '36px', width: '100%', maxWidth: '480px', boxShadow: '0 24px 80px rgba(0,0,0,0.15)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <div>
                  <h2 style={{ fontSize: '20px', fontWeight: 900, color: '#0F172A', margin: '0 0 4px 0' }}>Mark Complete & Rate</h2>
                  <p style={{ fontSize: '12px', color: '#64748B', margin: 0 }}>Interview with {rateTarget.talent_id}</p>
                </div>
                <button onClick={() => { setShowRateModal(false); setRateTarget(null); }} style={{ background: '#F1F5F9', border: 'none', borderRadius: '8px', width: '36px', height: '36px', cursor: 'pointer', fontSize: '16px', color: '#475569' }}>×</button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '8px' }}>Star Rating *</label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {[1,2,3,4,5].map(star => (
                      <button 
                        key={star}
                        onClick={() => setRateForm(f => ({ ...f, rating: star }))}
                        style={{ background: 'transparent', border: 'none', fontSize: '32px', cursor: 'pointer', color: rateForm.rating >= star ? '#FBBF24' : '#E2E8F0', padding: 0 }}
                      >★</button>
                    ))}
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>Interview Notes</label>
                  <textarea style={{ width: '100%', padding: '10px', border: '1px solid #E2E8F0', borderRadius: '8px', minHeight: '100px', resize: 'vertical' }} placeholder="Your private notes on this candidate's performance..." value={rateForm.notes} onChange={e => setRateForm(f => ({ ...f, notes: e.target.value }))} />
                </div>

                <button onClick={handleMarkCompleteAndRate} disabled={scheduleLoading} style={{ padding: '12px', borderRadius: '10px', border: 'none', background: scheduleLoading ? '#93C5FD' : '#2563EB', fontWeight: 800, fontSize: '13px', color: '#FFFFFF', cursor: scheduleLoading ? 'not-allowed' : 'pointer' }}>
                  {scheduleLoading ? 'Saving...' : 'Submit Rating'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Header ───────────────────────────────────────────────────────── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h1 style={{ fontSize: '32px', fontWeight: 800, color: '#0F172A', marginBottom: '8px', letterSpacing: '-0.03em' }}>Interviews & Coordination</h1>
            <p style={{ fontSize: '15px', color: '#6B7A99', margin: 0 }}>Manage your schedule and interview feedback.</p>
          </div>
        </div>
        
        {/* Toolbar */}
        <Card style={{ padding: '0', overflow: 'hidden' }}>
          <div style={{ display: 'flex', borderBottom: '1px solid #E2E8F0', background: '#F8FAFC' }}>
            {(['Upcoming', 'Past', 'Pending Confirmation'] as const).map(tab => {
              let count = 0;
              if (tab === 'Upcoming') count = upcoming.length;
              if (tab === 'Past') count = past.length;
              if (tab === 'Pending Confirmation') count = pending.length;
              
              return (
                <button
                  key={tab}
                  onClick={() => setInterviewTab(tab)}
                  style={{
                    padding: '16px 24px',
                    background: interviewTab === tab ? '#FFFFFF' : 'transparent',
                    border: 'none',
                    borderBottom: interviewTab === tab ? '2px solid #2563EB' : '2px solid transparent',
                    color: interviewTab === tab ? '#2563EB' : '#64748B',
                    fontWeight: interviewTab === tab ? 800 : 600,
                    fontSize: '14px',
                    cursor: 'pointer'
                  }}
                >
                  {tab} <span style={{ background: '#EEF2FF', color: '#2563EB', padding: '2px 8px', borderRadius: '12px', fontSize: '12px', marginLeft: '8px' }}>{count}</span>
                </button>
              );
            })}
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #E2E8F0' }}>
                <th style={{ padding: '16px 24px', fontWeight: 700, color: '#475569', fontSize: '11px', textTransform: 'uppercase' }}>Candidate</th>
                <th style={{ padding: '16px 24px', fontWeight: 700, color: '#475569', fontSize: '11px', textTransform: 'uppercase' }}>Details</th>
                <th style={{ padding: '16px 24px', fontWeight: 700, color: '#475569', fontSize: '11px', textTransform: 'uppercase' }}>Date & Time</th>
                <th style={{ padding: '16px 24px', fontWeight: 700, color: '#475569', fontSize: '11px', textTransform: 'uppercase' }}>Status / Admin Outcome</th>
                <th style={{ padding: '16px 24px', fontWeight: 700, color: '#475569', fontSize: '11px', textTransform: 'uppercase', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {!interviewsLoaded ? (
                <tr>
                  <td colSpan={5} style={{ padding: '48px', textAlign: 'center', color: '#64748B' }}>Loading...</td>
                </tr>
              ) : activeList.length > 0 ? (
                activeList.map(iv => {
                  return (
                    <tr key={iv.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                      <td style={{ padding: '16px 24px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', fontWeight: 800, color: '#2563EB' }}>
                            {iv.talent_id?.substring(0,2).toUpperCase() || 'TA'}
                          </div>
                          <div>
                            <div style={{ fontWeight: 800, color: '#0F172A', fontSize: '14px' }}>{iv.talent_id}</div>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '16px 24px' }}>
                        <div style={{ color: '#0F172A', fontWeight: 600, fontSize: '13px' }}>{iv.title || 'Interview'}</div>
                        {interviewTab === 'Past' && iv.client_rating && (
                           <div style={{ fontSize: '12px', color: '#F59E0B', marginTop: '4px' }}>
                             {'★'.repeat(iv.client_rating)}{'☆'.repeat(5 - iv.client_rating)}
                           </div>
                        )}
                      </td>
                      <td style={{ padding: '16px 24px', color: '#475569', fontSize: '13px' }}>
                        {iv.scheduled_time ? new Date(iv.scheduled_time).toLocaleString() : 'N/A'}
                      </td>
                      <td style={{ padding: '16px 24px' }}>
                        <div style={{
                          display: 'inline-block', fontSize: '11px', fontWeight: 700,
                          padding: '4px 10px', borderRadius: '12px',
                          background: iv.status === 'cancelled' ? '#FEE2E2' : '#F1F5F9', 
                          color: iv.status === 'cancelled' ? '#EF4444' : '#475569', textTransform: 'uppercase', marginBottom: '4px'
                        }}>
                          {iv.status.replace('_', ' ')}
                        </div>
                        {iv.admin_outcome && (
                           <div style={{ fontSize: '11px', fontWeight: 700, color: iv.admin_outcome === 'Proceed to Hire' ? '#10B981' : '#64748B', display: 'block' }}>
                             Outcome: {iv.admin_outcome}
                           </div>
                        )}
                      </td>
                      <td style={{ padding: '16px 24px', textAlign: 'right' }}>
                        {interviewTab === 'Upcoming' && (
                          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                            <button 
                              onClick={() => { setRateTarget(iv); setShowRateModal(true); }}
                              style={{ background: '#EEF2FF', border: 'none', color: '#2563EB', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}
                            >
                              Mark Complete & Rate
                            </button>
                            <button 
                              onClick={() => { 
                                const d = new Date(iv.scheduled_time);
                                setRescheduleForm({ date: d.toISOString().split('T')[0], time: d.toTimeString().substring(0,5), notes: '' });
                                setRescheduleTarget(iv); 
                                setShowRescheduleModal(true); 
                              }}
                              style={{ background: 'transparent', border: '1px solid #E2E8F0', color: '#475569', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}
                            >
                              Reschedule
                            </button>
                            <button 
                              onClick={() => handleCancelInterview(iv.id, iv.scheduled_time)}
                              style={{ background: 'transparent', border: '1px solid #FECACA', color: '#EF4444', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}
                            >
                              Cancel
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={5} style={{ padding: '48px', textAlign: 'center', color: '#64748B' }}>
                    No interviews found in this tab.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </Card>
      </div>
    );
  };
