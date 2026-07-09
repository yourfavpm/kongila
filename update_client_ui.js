const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'apps/admin-panel/pages/index.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Update client-pipeline rendering
const cpBlockStart = content.indexOf(`case 'client-pipeline':`);
const cpBlockEnd = content.indexOf(`case 'hiring-requests':`, cpBlockStart);
let cpBlock = content.slice(cpBlockStart, cpBlockEnd);

const oldGridStart = cpBlock.indexOf(`<div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '20px' }}>`);
const oldGridEnd = cpBlock.lastIndexOf(`</div>\n        </div>\n      );`);

const cpOldContent = cpBlock.substring(oldGridStart, oldGridEnd);

const cpNewContent = `          {selectedClient ? (() => {
            const clientProfilesList = clientProfiles.filter(cp => cp.organizationId === selectedClient.id);
            const orgUserIds = clientProfilesList.map(cp => cp.userId);
            const clientRequests = requests.filter(r => orgUserIds.includes(r.clientId) || r.clientName === selectedClient.name);
            const clientContracts = contracts.filter(c => orgUserIds.includes(c.clientId) || c.clientName === selectedClient.name);
            return (
              <div>
                <button onClick={() => setSelectedClient(null)} className="btn-secondary" style={{ marginBottom: '20px', fontSize: '13px', padding: '6px 14px', borderRadius: '8px' }}>← Back to Clients</button>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '24px' }}>
                  <GlassCard>
                    <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '8px' }}>{selectedClient.name}</h3>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '16px' }}>Client ID: {selectedClient.id}</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '13px' }}>
                      <div><strong style={{ color: 'var(--text-secondary)' }}>Status:</strong> Active</div>
                      <div><strong style={{ color: 'var(--text-secondary)' }}>Total Requests:</strong> {clientRequests.length}</div>
                      <div><strong style={{ color: 'var(--text-secondary)' }}>Active Contracts:</strong> {clientContracts.filter(c => c.status === 'Signed' || c.status === 'Active').length}</div>
                    </div>
                  </GlassCard>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                    <GlassCard>
                      <h4 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '16px' }}>Hiring Requests</h4>
                      {clientRequests.length === 0 ? <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>No hiring requests found.</p> : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                          {clientRequests.map(req => (
                            <div key={req.id} style={{ border: '1px solid var(--border-glass)', padding: '12px', borderRadius: '8px' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                <strong style={{ fontSize: '14px' }}>{req.serviceType}</strong>
                                <Chip label={req.status} />
                              </div>
                              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{req.duration} · {req.commitmentLevel}</div>
                            </div>
                          ))}
                        </div>
                      )}
                    </GlassCard>

                    <GlassCard>
                      <h4 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '16px' }}>Contracts</h4>
                      {clientContracts.length === 0 ? <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>No contracts found.</p> : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                          {clientContracts.map(c => (
                            <div key={c.id} style={{ border: '1px solid var(--border-glass)', padding: '12px', borderRadius: '8px' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                <strong style={{ fontSize: '14px' }}>{c.role}</strong>
                                <Chip label={c.status} />
                              </div>
                              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Talent: {c.talentName}</div>
                            </div>
                          ))}
                        </div>
                      )}
                    </GlassCard>
                  </div>
                </div>
              </div>
            );
          })() : (
            <>
              <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', alignItems: 'center' }}>
                <input 
                  type="text" 
                  placeholder="Search organizations..." 
                  value={clientSearchQuery} 
                  onChange={(e) => setClientSearchQuery(e.target.value)}
                  style={{ padding: '8px 16px', borderRadius: '999px', border: '1px solid var(--border-glass)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', outline: 'none', minWidth: '250px', fontSize: '13px' }} 
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '20px' }}>
                {filteredOrganizations.map(org => {
                  const orgClients = clientProfiles.filter(cp => cp.organizationId === org.id);
                  const orgUserIds = orgClients.map(cp => cp.userId);
                  const orgContracts = contracts.filter(c => orgUserIds.includes(c.clientId) || c.clientName === org.name);
                  const orgRequests = requests.filter(r => orgUserIds.includes(r.clientId) || r.clientName === org.name);
                  const activeContracts = orgContracts.filter(c => c.status === 'Signed' || c.status === 'Active');
                  return (
                    <GlassCard key={org.id} style={{ cursor: 'pointer' }} onClick={() => setSelectedClient(org)}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: '16px' }}>{org.name}</div>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>ID: {org.id}</div>
                        </div>
                        <div style={{ fontSize: '11px', background: 'var(--kongila-blue-glow)', color: 'var(--kongila-blue)', padding: '3px 10px', borderRadius: '999px', fontWeight: 600 }}>Client</div>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '12px', marginBottom: '14px' }}>
                        <div style={{ background: 'var(--bg-tertiary)', borderRadius: '8px', padding: '10px' }}>
                          <div style={{ color: 'var(--text-muted)', marginBottom: '2px' }}>Active Contracts</div>
                          <div style={{ fontWeight: 700, fontSize: '18px', color: 'var(--accent-green)' }}>{activeContracts.length}</div>
                        </div>
                        <div style={{ background: 'var(--bg-tertiary)', borderRadius: '8px', padding: '10px' }}>
                          <div style={{ color: 'var(--text-muted)', marginBottom: '2px' }}>Open Requests</div>
                          <div style={{ fontWeight: 700, fontSize: '18px', color: 'var(--accent-gold)' }}>{orgRequests.filter(r => r.status === 'New Request').length}</div>
                        </div>
                      </div>
                      {orgClients.length > 0 && (
                        <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                          <strong>Users:</strong> {orgClients.length} profile{orgClients.length !== 1 ? 's' : ''}
                        </div>
                      )}
                    </GlassCard>
                  );
                })}
                {filteredOrganizations.length === 0 && (
                  <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>
                    <div style={{ fontSize: '40px', marginBottom: '12px' }}>🏢</div>
                    <p>No client organizations matching search.</p>
                  </div>
                )}
              </div>
            </>
          )}\n`;

cpBlock = cpBlock.replace(cpOldContent, cpNewContent);
content = content.substring(0, cpBlockStart) + cpBlock + content.substring(cpBlockEnd);


// 2. Update hiring-requests search bar
const hrBlockStart = content.indexOf(`case 'hiring-requests':`);
const hrOldHeader = `          <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
            {['All', 'New Request', 'In Progress', 'Matched', 'Fulfilled', 'Cancelled'].map(f => (
              <button key={f} onClick={() => setRequestFilter(f)}`;

const hrNewHeader = `          <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap', alignItems: 'center' }}>
            <input 
              type="text" 
              placeholder="Search requests..." 
              value={requestSearchQuery} 
              onChange={(e) => setRequestSearchQuery(e.target.value)}
              style={{ padding: '8px 16px', borderRadius: '999px', border: '1px solid var(--border-glass)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', outline: 'none', minWidth: '250px', fontSize: '13px' }} 
            />
            {['All', 'New Request', 'In Progress', 'Matched', 'Fulfilled', 'Cancelled'].map(f => (
              <button key={f} onClick={() => setRequestFilter(f)}`;

content = content.replace(hrOldHeader, hrNewHeader);

// 3. Update talent-vetting if needed
const tvBlockStart = content.indexOf(`case 'vetting':`);
const tvOldHeader = `          <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
            {['All', 'Applied', 'Pending', 'Review', 'Vetted'].map(f => (
              <button key={f} onClick={() => { setTalentFilter(f); setSelectedTalent(null); }}`;

if (tvBlockStart !== -1 && content.indexOf(tvOldHeader) !== -1) {
  const tvNewHeader = `          <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap', alignItems: 'center' }}>
            <input 
              type="text" 
              placeholder="Search by name, title, or tags..." 
              value={talentSearchQuery} 
              onChange={(e) => setTalentSearchQuery(e.target.value)}
              style={{ padding: '8px 16px', borderRadius: '999px', border: '1px solid var(--border-glass)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', outline: 'none', minWidth: '250px', fontSize: '13px' }} 
            />
            {['All', 'Applied', 'Pending', 'Review', 'Vetted'].map(f => (
              <button key={f} onClick={() => { setTalentFilter(f); setSelectedTalent(null); }}`;
  content = content.replace(tvOldHeader, tvNewHeader);
}

// 4. In vetting, also replace the split view if it is present.
// The vetting tab is very similar to talent-pipeline so we should restructure it.
// Let's find if vetting uses the same layout.
const tvBlockEnd = content.indexOf(`case 'client-pipeline':`, tvBlockStart);
if (tvBlockStart !== -1 && tvBlockEnd !== -1) {
  let tvBlock = content.slice(tvBlockStart, tvBlockEnd);
  
  const oldTvGridStart = tvBlock.indexOf(`<div style={{ display: 'grid', gridTemplateColumns: selectedTalent ? '1fr 1.6fr' : '1fr', gap: '24px' }}>`);
  
  if (oldTvGridStart !== -1) {
      // we need to wrap the whole selectedTalent logic and table logic
      // This might be too complex for simple string replace. Let's just do search bar for now on vetting, 
      // the user explicitly asked for "talent pipeline page" to be full space. "Redesign the talent pipeline page".
  }
}

fs.writeFileSync(filePath, content);
console.log('Successfully updated client pipeline and hiring requests UI');
