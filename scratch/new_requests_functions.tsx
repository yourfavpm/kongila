  const handleSaveRequestEdit = async (requestId: string) => {
    // Diff changes
    const originalRequest = requests.find(r => r.id === requestId);
    if (!originalRequest) return;
    
    const changes: any = {};
    for (const key in editRequestForm) {
      if (editRequestForm[key] !== originalRequest[key]) {
        changes[key] = { old: originalRequest[key], new: editRequestForm[key] };
      }
    }
    
    if (Object.keys(changes).length === 0) {
      setIsEditingRequest(false);
      return;
    }
    
    // Update request
    const { error } = await supabase.from('talent_requests').update(editRequestForm).eq('id', requestId);
    if (error) {
      console.error('Error updating request:', error);
      return;
    }
    
    // Log activity
    await supabase.from('request_activity_logs').insert({
      request_id: requestId,
      actor_id: currentUser?.id,
      action_type: 'edited',
      field_changes: changes
    });
    
    // Notify admin
    await supabase.from('notifications').insert({
      user_id: 'usr_horizon',
      type: 'request_updated',
      title: 'Request Updated',
      content: `${currentUser?.name || 'Client'} updated request ${originalRequest.roleTitle || originalRequest.serviceType}`,
      read: false
    });
    
    // Update local state if we have a setRequests setter, otherwise relying on real-time/refetch
    if (setRequests) {
      setRequests(requests.map(r => r.id === requestId ? { ...r, ...editRequestForm } : r));
    }
    setIsEditingRequest(false);
  };

  const handleCancelRequest = async (requestId: string) => {
    if (!window.confirm('Are you sure you want to cancel this request? This cannot be undone.')) return;
    
    const { error } = await supabase.from('talent_requests').update({ status: 'cancelled' }).eq('id', requestId);
    if (!error) {
      await supabase.from('request_activity_logs').insert({
        request_id: requestId,
        actor_id: currentUser?.id,
        action_type: 'cancelled'
      });
      if (setRequests) {
        setRequests(requests.map(r => r.id === requestId ? { ...r, status: 'cancelled' } : r));
      }
      setDetailsViewRequestId(null);
    }
  };

  const renderRequests = () => {
    // 1. Bucket filtering logic
    const filteredRequests = clientRequests.filter(req => {
      // Search term
      if (searchRequestsFilter) {
        const term = searchRequestsFilter.toLowerCase();
        const matchesSearch = (req.roleTitle?.toLowerCase().includes(term) || req.serviceType?.toLowerCase().includes(term) || req.id?.toLowerCase().includes(term));
        if (!matchesSearch) return false;
      }
      
      // Tab bucketing
      const status = (req.status || 'new').toLowerCase();
      if (requestTabs === 'Active') {
        if (['closed', 'cancelled', 'hired'].includes(status)) return false;
      } else if (requestTabs === 'Hired') {
        if (status !== 'hired') return false;
      } else if (requestTabs === 'Closed/Cancelled') {
        if (!['closed', 'cancelled'].includes(status)) return false;
      }
      
      return true;
    });

    if (detailsViewRequestId) {
      return renderRequestDetail();
    }

    const activeCount = clientRequests.filter(r => !['closed', 'cancelled', 'hired'].includes((r.status || 'new').toLowerCase())).length;

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
        
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ fontSize: '32px', fontWeight: 800, color: '#1A2340', marginBottom: '8px', letterSpacing: '-0.03em' }}>My Requests</h1>
            <p style={{ fontSize: '15px', color: '#6B7A99', margin: 0 }}>Track and manage all your service and talent requests.</p>
          </div>
          <button 
            onClick={() => { setClientIntakeActive(true); setClientIntakeStep(1); }}
            style={{ 
              display: 'flex', alignItems: 'center', gap: '8px',
              background: '#0047CC', border: 'none', borderRadius: '12px', 
              padding: '14px 24px', color: 'white', fontWeight: 700, 
              cursor: 'pointer', transition: 'background 0.2s', fontSize: '14px',
              boxShadow: '0 4px 12px rgba(0, 71, 204, 0.15)'
            }}
          >
            + New Request
          </button>
        </div>

        {/* Toolbar */}
        <Card style={{ padding: '0', overflow: 'hidden' }}>
          <div style={{ display: 'flex', borderBottom: '1px solid #E2E8F0', background: '#F8FAFC' }}>
            {['All', 'Active', 'Hired', 'Closed/Cancelled'].map(tab => (
              <button
                key={tab}
                onClick={() => setRequestTabs(tab as any)}
                style={{
                  padding: '16px 24px',
                  background: requestTabs === tab ? '#FFFFFF' : 'transparent',
                  border: 'none',
                  borderBottom: requestTabs === tab ? '2px solid #2563EB' : '2px solid transparent',
                  color: requestTabs === tab ? '#2563EB' : '#64748B',
                  fontWeight: requestTabs === tab ? 800 : 600,
                  fontSize: '14px',
                  cursor: 'pointer'
                }}
              >
                {tab} {tab === 'Active' && <span style={{ background: '#EEF2FF', color: '#2563EB', padding: '2px 8px', borderRadius: '12px', fontSize: '12px', marginLeft: '8px' }}>{activeCount}</span>}
              </button>
            ))}
            <div style={{ marginLeft: 'auto', padding: '10px 16px', display: 'flex', alignItems: 'center' }}>
              <input 
                type="text"
                placeholder="Search by title or reference..."
                value={searchRequestsFilter}
                onChange={e => setSearchRequestsFilter(e.target.value)}
                style={{
                  width: '260px', height: '36px', border: '1px solid #E2E8F0',
                  borderRadius: '8px', padding: '0 12px', fontSize: '13px',
                  outline: 'none'
                }}
              />
            </div>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #E2E8F0' }}>
                <th style={{ padding: '16px 24px', fontWeight: 700, color: '#475569', fontSize: '11px', textTransform: 'uppercase' }}>Reference</th>
                <th style={{ padding: '16px 24px', fontWeight: 700, color: '#475569', fontSize: '11px', textTransform: 'uppercase' }}>Role/Title</th>
                <th style={{ padding: '16px 24px', fontWeight: 700, color: '#475569', fontSize: '11px', textTransform: 'uppercase' }}>Date Submitted</th>
                <th style={{ padding: '16px 24px', fontWeight: 700, color: '#475569', fontSize: '11px', textTransform: 'uppercase' }}>Status</th>
                <th style={{ padding: '16px 24px', fontWeight: 700, color: '#475569', fontSize: '11px', textTransform: 'uppercase', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredRequests.length > 0 ? (
                filteredRequests.map(req => {
                  const status = (req.status || 'new').toLowerCase();
                  let statusColor = '#94A3B8';
                  let statusBg = '#F1F5F9';
                  if (status === 'new' || status === 'reviewing') { statusColor = '#F59E0B'; statusBg = '#FEF3C7'; }
                  if (status === 'matching' || status === 'candidates_ready') { statusColor = '#06B6D4'; statusBg = '#CFFAFE'; }
                  if (status === 'interviewing') { statusColor = '#3B82F6'; statusBg = '#DBEAFE'; }
                  if (status === 'hired') { statusColor = '#10B981'; statusBg = '#D1FAE5'; }
                  if (status === 'cancelled') { statusColor = '#EF4444'; statusBg = '#FEE2E2'; }

                  return (
                    <tr key={req.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                      <td style={{ padding: '16px 24px', color: '#64748B', fontSize: '13px', fontFamily: 'monospace' }}>
                        {req.id?.substring(0,8).toUpperCase()}
                      </td>
                      <td style={{ padding: '16px 24px' }}>
                        <div style={{ fontWeight: 800, color: '#0F172A', fontSize: '14px' }}>{req.roleTitle || req.serviceType}</div>
                      </td>
                      <td style={{ padding: '16px 24px', color: '#64748B', fontSize: '13px' }}>
                        {req.createdAt ? new Date(req.createdAt).toLocaleDateString() : 'Recent'}
                      </td>
                      <td style={{ padding: '16px 24px' }}>
                        <span style={{
                          display: 'inline-block', fontSize: '11px', fontWeight: 700,
                          padding: '4px 10px', borderRadius: '12px',
                          background: statusBg, color: statusColor, textTransform: 'uppercase'
                        }}>
                          {status.replace('_', ' ')}
                        </span>
                      </td>
                      <td style={{ padding: '16px 24px', textAlign: 'right' }}>
                        <button 
                          onClick={() => {
                            setSelectedRequest(req);
                            setDetailsViewRequestId(req.id);
                            setActiveRequestTab('Overview');
                          }}
                          style={{ background: 'transparent', border: 'none', color: '#2563EB', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}
                        >
                          View Details →
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={5} style={{ padding: '48px', textAlign: 'center', color: '#64748B' }}>
                    No requests found matching this tab/filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </Card>
      </div>
    );
  };

  const renderRequestDetail = () => {
    const request = clientRequests.find(req => req.id === detailsViewRequestId) || selectedRequest;
    if (!request) return null;

    const reqStatus = (request.status || 'new').toLowerCase();
    const canEdit = reqStatus === 'new' || reqStatus === 'reviewing';

    const requestMatches = matches.filter((m: any) => m.requestId === request.id);
    const requestContracts = contracts.filter((c: any) => c.requestId === request.id);
    const requestInterviews = interviewRequests[request.id] || [];
    const requestMessages = messages.filter((m: any) => m.request_id === request.id);

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {/* Detail Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <button
              onClick={() => setDetailsViewRequestId(null)}
              style={{ background: 'transparent', border: 'none', color: '#64748B', fontSize: '13px', fontWeight: 700, cursor: 'pointer', padding: 0, marginBottom: '12px' }}
            >
              ← Back to My Requests
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <h1 style={{ fontSize: '32px', fontWeight: 800, color: '#0F172A', margin: 0 }}>{request.roleTitle || request.serviceType}</h1>
              <span style={{ fontSize: '11px', fontWeight: 700, padding: '4px 10px', borderRadius: '12px', background: '#F1F5F9', color: '#475569', textTransform: 'uppercase' }}>
                {reqStatus.replace('_', ' ')}
              </span>
            </div>
            <p style={{ fontSize: '14px', color: '#64748B', marginTop: '8px' }}>Ref: {request.id}</p>
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button 
              onClick={() => {
                // Populate intake modal with this request's data
                setClientIntakeActive(true);
                setClientIntakeStep(1);
              }}
              style={{ padding: '10px 16px', background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '8px', color: '#0F172A', fontWeight: 700, fontSize: '13px', cursor: 'pointer' }}
            >
              Duplicate Request
            </button>
            {reqStatus !== 'cancelled' && reqStatus !== 'hired' && reqStatus !== 'closed' && (
              <button 
                onClick={() => handleCancelRequest(request.id)}
                style={{ padding: '10px 16px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '8px', color: '#EF4444', fontWeight: 700, fontSize: '13px', cursor: 'pointer' }}
              >
                Cancel Request
              </button>
            )}
          </div>
        </div>

        {/* Tab Navigation */}
        <Card style={{ padding: '0', overflow: 'hidden' }}>
          <div style={{ display: 'flex', overflowX: 'auto', background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
            {['Overview', 'Request Details', 'Matched Talent', 'Interviews', 'Contracts', 'Messages', 'Activity Log'].map(tab => (
              <button
                key={tab}
                onClick={() => {
                  setActiveRequestTab(tab as any);
                  if (tab === 'Request Details') {
                    setEditRequestForm(request);
                    setIsEditingRequest(false);
                  }
                }}
                style={{
                  padding: '16px 20px', background: activeRequestTab === tab ? '#FFFFFF' : 'transparent',
                  border: 'none', borderBottom: activeRequestTab === tab ? '2px solid #2563EB' : '2px solid transparent',
                  color: activeRequestTab === tab ? '#2563EB' : '#64748B', fontWeight: activeRequestTab === tab ? 800 : 600,
                  fontSize: '13px', cursor: 'pointer', whiteSpace: 'nowrap'
                }}
              >
                {tab}
                {tab === 'Matched Talent' && <span style={{ marginLeft: '8px', background: '#EEF2FF', color: '#2563EB', padding: '2px 6px', borderRadius: '10px', fontSize: '11px' }}>{requestMatches.length}</span>}
                {tab === 'Messages' && <span style={{ marginLeft: '8px', background: '#EEF2FF', color: '#2563EB', padding: '2px 6px', borderRadius: '10px', fontSize: '11px' }}>{requestMessages.length}</span>}
              </button>
            ))}
          </div>

          <div style={{ padding: '24px' }}>
            {/* Overview Tab */}
            {activeRequestTab === 'Overview' && (
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                  <div>
                    <h3 style={{ fontSize: '15px', fontWeight: 800, color: '#0F172A', marginBottom: '8px' }}>Description</h3>
                    <p style={{ fontSize: '14px', color: '#475569', lineHeight: 1.6 }}>{request.roleDescription || 'No description provided.'}</p>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div style={{ padding: '16px', background: '#F8FAFC', borderRadius: '12px' }}>
                      <div style={{ fontSize: '11px', color: '#64748B', textTransform: 'uppercase', marginBottom: '4px' }}>Service Type</div>
                      <div style={{ fontSize: '14px', fontWeight: 700, color: '#0F172A' }}>{request.serviceType}</div>
                    </div>
                    <div style={{ padding: '16px', background: '#F8FAFC', borderRadius: '12px' }}>
                      <div style={{ fontSize: '11px', color: '#64748B', textTransform: 'uppercase', marginBottom: '4px' }}>Budget</div>
                      <div style={{ fontSize: '14px', fontWeight: 700, color: '#0F172A' }}>${request.budget?.toLocaleString() || '0'} / mo</div>
                    </div>
                  </div>
                </div>
                <div>
                  <h3 style={{ fontSize: '15px', fontWeight: 800, color: '#0F172A', marginBottom: '16px' }}>Status Timeline</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {['new', 'reviewing', 'matching', 'candidates_ready', 'interviewing', 'hired'].map((stage, idx) => {
                      const isActive = reqStatus === stage;
                      const isPast = ['new', 'reviewing', 'matching', 'candidates_ready', 'interviewing', 'hired'].indexOf(reqStatus) >= idx;
                      return (
                        <div key={stage} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: isActive ? '#2563EB' : isPast ? '#93C5FD' : '#E2E8F0' }} />
                          <span style={{ fontSize: '13px', fontWeight: isActive ? 800 : 500, color: isActive ? '#0F172A' : '#64748B', textTransform: 'capitalize' }}>
                            {stage.replace('_', ' ')}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* Request Details Tab */}
            {activeRequestTab === 'Request Details' && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                  <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#0F172A' }}>Request Parameters</h3>
                  {canEdit && !isEditingRequest && (
                    <button onClick={() => setIsEditingRequest(true)} style={{ padding: '8px 16px', background: '#F1F5F9', border: 'none', borderRadius: '8px', color: '#2563EB', fontWeight: 700, fontSize: '13px', cursor: 'pointer' }}>
                      Edit Details
                    </button>
                  )}
                  {!canEdit && (
                    <span style={{ fontSize: '12px', color: '#64748B', background: '#F8FAFC', padding: '6px 12px', borderRadius: '8px' }}>Editing locked (status: {reqStatus})</span>
                  )}
                </div>

                {isEditingRequest ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>Role Title</label>
                      <input type="text" value={editRequestForm.roleTitle || ''} onChange={e => setEditRequestForm({...editRequestForm, roleTitle: e.target.value})} style={{ width: '100%', padding: '10px', border: '1px solid #E2E8F0', borderRadius: '8px' }} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>Budget</label>
                      <input type="number" value={editRequestForm.budget || ''} onChange={e => setEditRequestForm({...editRequestForm, budget: Number(e.target.value)})} style={{ width: '100%', padding: '10px', border: '1px solid #E2E8F0', borderRadius: '8px' }} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>Role Description</label>
                      <textarea value={editRequestForm.roleDescription || ''} onChange={e => setEditRequestForm({...editRequestForm, roleDescription: e.target.value})} style={{ width: '100%', padding: '10px', border: '1px solid #E2E8F0', borderRadius: '8px', minHeight: '100px' }} />
                    </div>
                    <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                      <button onClick={() => handleSaveRequestEdit(request.id)} style={{ padding: '10px 24px', background: '#2563EB', border: 'none', borderRadius: '8px', color: 'white', fontWeight: 700, fontSize: '13px', cursor: 'pointer' }}>Save Changes</button>
                      <button onClick={() => { setIsEditingRequest(false); setEditRequestForm(request); }} style={{ padding: '10px 24px', background: 'transparent', border: '1px solid #E2E8F0', borderRadius: '8px', color: '#64748B', fontWeight: 700, fontSize: '13px', cursor: 'pointer' }}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      <div>
                        <div style={{ fontSize: '12px', color: '#64748B', fontWeight: 600 }}>Role Title</div>
                        <div style={{ fontSize: '14px', color: '#0F172A', fontWeight: 700 }}>{request.roleTitle || '-'}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: '12px', color: '#64748B', fontWeight: 600 }}>Budget</div>
                        <div style={{ fontSize: '14px', color: '#0F172A', fontWeight: 700 }}>${request.budget?.toLocaleString() || '0'}</div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      <div>
                        <div style={{ fontSize: '12px', color: '#64748B', fontWeight: 600 }}>Number of Hires</div>
                        <div style={{ fontSize: '14px', color: '#0F172A', fontWeight: 700 }}>{request.numberOfHires || 1}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: '12px', color: '#64748B', fontWeight: 600 }}>Required Skills</div>
                        <div style={{ fontSize: '14px', color: '#0F172A', fontWeight: 700 }}>{(request.requiredSkills || []).join(', ') || '-'}</div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Matched Talent Tab */}
            {activeRequestTab === 'Matched Talent' && (
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#0F172A', marginBottom: '16px' }}>Talent Pipeline</h3>
                {requestMatches.length > 0 ? (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '16px' }}>
                    {requestMatches.map((m: any) => (
                      <div key={m.id} style={{ padding: '16px', border: '1px solid #E2E8F0', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', fontWeight: 800, color: '#2563EB' }}>
                          {m.talentId.substring(0,2).toUpperCase()}
                        </div>
                        <div>
                          <div style={{ fontSize: '14px', fontWeight: 800, color: '#0F172A' }}>{m.talentId}</div>
                          <div style={{ fontSize: '12px', color: '#64748B' }}>Match: {m.matchScore || 90}%</div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p style={{ fontSize: '14px', color: '#64748B' }}>No candidates have been matched yet.</p>
                )}
              </div>
            )}

            {/* Activity Log Tab */}
            {activeRequestTab === 'Activity Log' && (
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#0F172A', marginBottom: '24px' }}>Edit History & Activity</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {requestActivityLogs.length > 0 ? requestActivityLogs.map(log => (
                    <div key={log.id} style={{ display: 'flex', gap: '16px', padding: '16px', background: '#F8FAFC', borderRadius: '12px' }}>
                      <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#2563EB', marginTop: '6px' }} />
                      <div>
                        <div style={{ fontSize: '14px', color: '#0F172A' }}>
                          <span style={{ fontWeight: 800 }}>{log.actor_id === currentUser?.id ? 'You' : 'Account Manager'}</span> {log.action_type} this request.
                        </div>
                        {log.field_changes && (
                          <div style={{ marginTop: '8px', fontSize: '12px', color: '#475569', display: 'grid', gap: '4px' }}>
                            {Object.entries(log.field_changes).map(([k, v]: any) => (
                              <div key={k}>
                                <span style={{ fontWeight: 700 }}>{k}:</span> changed from <i>{String(v.old)}</i> to <i>{String(v.new)}</i>
                              </div>
                            ))}
                          </div>
                        )}
                        <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '8px' }}>{new Date(log.created_at).toLocaleString()}</div>
                      </div>
                    </div>
                  )) : (
                    <p style={{ fontSize: '14px', color: '#64748B' }}>No activity logged yet.</p>
                  )}
                </div>
              </div>
            )}

            {/* Interviews Tab Placeholder */}
            {activeRequestTab === 'Interviews' && (
              <div>
                <p style={{ fontSize: '14px', color: '#64748B' }}>{requestInterviews.length} interviews requested.</p>
              </div>
            )}

            {/* Contracts Tab Placeholder */}
            {activeRequestTab === 'Contracts' && (
              <div>
                <p style={{ fontSize: '14px', color: '#64748B' }}>{requestContracts.length} contracts associated.</p>
              </div>
            )}

            {/* Messages Tab Placeholder */}
            {activeRequestTab === 'Messages' && (
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#0F172A', marginBottom: '16px' }}>Request Discussion</h3>
                {requestMessages.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {requestMessages.map((m: any) => (
                      <div key={m.id} style={{ padding: '12px', background: m.sender_id === currentUser?.id ? '#EEF2FF' : '#F1F5F9', borderRadius: '8px', marginLeft: m.sender_id === currentUser?.id ? 'auto' : '0', marginRight: m.sender_id === currentUser?.id ? '0' : 'auto', maxWidth: '80%' }}>
                        <div style={{ fontSize: '13px', color: '#0F172A' }}>{m.content}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p style={{ fontSize: '14px', color: '#64748B' }}>No messages related to this request yet. Visit the main Messages tab to contact your Account Manager.</p>
                )}
              </div>
            )}

          </div>
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

