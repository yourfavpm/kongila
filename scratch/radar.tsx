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

