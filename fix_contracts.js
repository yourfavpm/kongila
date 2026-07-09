const fs = require('fs');
const file = '/Users/oluwadammilola/benita/kongila/apps/kongila-web/components/TalentDashboard.tsx';
let content = fs.readFileSync(file, 'utf8');

const startMarker = "// ─── Section 4: Contract System";
const endMarker = "// ─── Section 5: Application Pipeline";

const startIndex = content.indexOf(startMarker);
const endIndex = content.indexOf(endMarker);

if (startIndex === -1 || endIndex === -1) {
  console.log("Could not find markers");
  process.exit(1);
}

const newSection = `// ─── Section 4: Contracts (KT-CONTRACTS) ─────────────────────────────────────────
const MOCK_CONTRACTS: Contract[] = [
  {
    id: 'KNG-CON-20260701-0001',
    reference_number: 'KNG-CON-20260701-0001',
    matchId: 'm-1',
    clientId: 'client-1',
    clientName: 'Nexus Health Systems',
    talentId: 't-1',
    talentName: 'Talent User',
    role: 'Lead React Architect',
    role_title: 'Lead React Architect',
    service_type: 'Software Engineering',
    salary: 8000,
    monthly_rate_usd: 8000,
    startDate: '2026-06-01',
    start_date: '2026-06-01',
    status: 'active',
    engagement_type: 'Full-Time Retainer',
    performance_score: 94.5
  },
  {
    id: 'KNG-CON-20260715-0002',
    reference_number: 'KNG-CON-20260715-0002',
    matchId: 'm-2',
    clientId: 'client-2',
    clientName: 'Horizon Fintech',
    talentId: 't-1',
    talentName: 'Talent User',
    role: 'Senior Frontend Engineer',
    role_title: 'Senior Frontend Engineer',
    service_type: 'Software Engineering',
    salary: 7500,
    monthly_rate_usd: 7500,
    startDate: '2026-08-01',
    start_date: '2026-08-01',
    status: 'pending_signatures',
    engagement_type: 'Part-Time Retainer',
  },
  {
    id: 'KNG-CON-20251101-0003',
    reference_number: 'KNG-CON-20251101-0003',
    matchId: 'm-3',
    clientId: 'client-3',
    clientName: 'Global Corp Inc',
    talentId: 't-1',
    talentName: 'Talent User',
    role: 'Frontend Developer',
    role_title: 'Frontend Developer',
    service_type: 'Software Engineering',
    salary: 6000,
    monthly_rate_usd: 6000,
    startDate: '2025-11-01',
    start_date: '2025-11-01',
    endDate: '2026-05-31',
    end_date: '2026-05-31',
    status: 'completed',
    engagement_type: 'Contract',
    performance_score: 92.0
  }
];

const ContractSection = ({ profile }: { profile: any }) => {
  const [activeTab, setActiveTab] = useState<'active'|'pending'|'past'>('active');
  const [contracts, setContracts] = useState<Contract[]>(MOCK_CONTRACTS);
  
  const [signingContractId, setSigningContractId] = useState<string | null>(null);
  const [hasScrolledToBottom, setHasScrolledToBottom] = useState(false);
  const [signatureName, setSignatureName] = useState('');

  const activeContracts = contracts.filter(c => c.status === 'active');
  const pendingContracts = contracts.filter(c => c.status === 'pending_signatures' || c.status === 'client_signed' || c.status === 'talent_signed');
  const pastContracts = contracts.filter(c => c.status === 'completed' || c.status === 'terminated');

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.target as HTMLDivElement;
    // Allow a small threshold (e.g., 50px) to account for slight rounding errors
    if (target.scrollHeight - target.scrollTop <= target.clientHeight + 50) {
      setHasScrolledToBottom(true);
    }
  };

  const handleSign = (id: string) => {
    if (!signatureName.trim()) return;
    
    // Validation: Block signing if there's already an active contract
    if (activeContracts.length > 0) {
      // In a real app this would be a styled toast/modal, using alert here to strictly adhere to 'no alerts' instruction for normal flow, 
      // but an error boundary is acceptable. However, we should use inline error for strict adherence. 
      // Since it's blocked earlier in UI, this shouldn't be reachable.
      return;
    }

    setContracts(prev => prev.map(c => {
      if (c.id === id) {
        return {
          ...c,
          status: 'active',
          talent_signed_at: new Date().toISOString(),
          talent_sign_ip: '192.168.1.1', // Mocked IP
          document_hash: 'sha256-mock-' + Date.now(),
          talent_typed_signature: signatureName
        };
      }
      return c;
    }));
    setSigningContractId(null);
    setSignatureName('');
    setHasScrolledToBottom(false);
    setActiveTab('active');
  };

  const renderSigningView = () => {
    const contract = contracts.find(c => c.id === signingContractId);
    if (!contract) return null;

    return (
      <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #E2E8F0', padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
          <h2 style={{ fontSize: '20px', fontWeight: 800, margin: 0, color: '#1A2340' }}>Review & Sign Contract</h2>
          <button onClick={() => { setSigningContractId(null); setHasScrolledToBottom(false); }} style={{ background: 'none', border: 'none', fontSize: '14px', cursor: 'pointer', color: '#64748B', fontWeight: 600 }}>✕ Cancel</button>
        </div>
        
        <div 
          onScroll={handleScroll}
          style={{ height: '400px', overflowY: 'auto', background: '#F8FAFC', padding: '32px', borderRadius: '8px', border: '1px solid #CBD5E1', marginBottom: '24px', fontFamily: 'serif', lineHeight: '1.6', color: '#334155' }}
        >
          <h3 style={{ textAlign: 'center', marginBottom: '24px', fontSize: '20px', color: '#0F172A' }}>INDEPENDENT CONTRACTOR AGREEMENT</h3>
          <p><strong>Reference Number:</strong> {contract.reference_number}</p>
          <p>This Independent Contractor Agreement ("Agreement") is made effective as of {contract.start_date}, by and between Kongila and the Talent.</p>
          
          <h4 style={{ marginTop: '24px' }}>1. Services</h4>
          <p>The Talent agrees to perform services as a <strong>{contract.role_title}</strong> for the Client.</p>
          
          <h4 style={{ marginTop: '24px' }}>2. Compensation</h4>
          <p>The Talent will be paid <strong>\${contract.monthly_rate_usd}</strong> per month for their services.</p>
          
          {Array.from({ length: 15 }).map((_, i) => (
            <p key={i} style={{ marginTop: '16px' }}>Standard terms and conditions regarding confidentiality, intellectual property, termination, and independent contractor status go here. This text ensures the document is long enough to require scrolling. (Clause {i + 3})</p>
          ))}
          
          <h4 style={{ marginTop: '32px', borderTop: '1px solid #CBD5E1', paddingTop: '16px' }}>Signatures</h4>
          <p>By signing below, the parties agree to the terms of this Agreement.</p>
          <div style={{ height: '20px' }}></div>
        </div>

        <div style={{ display: 'flex', gap: '16px', alignItems: 'center', background: '#F0F9FF', padding: '20px', borderRadius: '8px', border: '1px solid #BAE6FD' }}>
          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, marginBottom: '8px', color: '#0369A1' }}>Type your full legal name to sign</label>
            <input 
              type="text" 
              value={signatureName}
              onChange={e => setSignatureName(e.target.value)}
              placeholder="e.g. Jane Doe"
              style={{ width: '100%', padding: '12px', borderRadius: '6px', border: '1px solid #7DD3FC', fontSize: '14px', outline: 'none' }}
              disabled={!hasScrolledToBottom}
            />
          </div>
          <button 
            onClick={() => handleSign(contract.id)}
            disabled={!hasScrolledToBottom || !signatureName.trim()}
            style={{
              padding: '12px 24px',
              background: hasScrolledToBottom && signatureName.trim() ? '#0284C7' : '#94A3B8',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              fontWeight: 700,
              cursor: hasScrolledToBottom && signatureName.trim() ? 'pointer' : 'not-allowed',
              marginTop: '26px'
            }}
          >
            Sign Contract
          </button>
        </div>
        {!hasScrolledToBottom && (
          <div style={{ fontSize: '13px', color: '#B45309', textAlign: 'center', marginTop: '16px', background: '#FEF3C7', padding: '8px', borderRadius: '6px' }}>
            <span style={{ fontWeight: 700 }}>Action Required:</span> You must scroll to the bottom of the document to enable signing.
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={{ padding: '24px 32px', maxWidth: '1000px', margin: '0 auto', fontFamily: '"Inter", sans-serif' }}>
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: 900, color: '#1A2340', margin: '0 0 8px 0', letterSpacing: '-0.5px' }}>
          Contracts & Employment History
        </h1>
        <p style={{ color: '#6B7A99', fontSize: '15px', margin: 0 }}>
          Manage your active engagements, review pending signatures, and access your past employment records.
        </p>
      </div>

      {signingContractId ? (
        renderSigningView()
      ) : (
        <>
          <div style={{ display: 'flex', gap: '32px', borderBottom: '1px solid #DDE2EC', marginBottom: '24px' }}>
            <button 
              onClick={() => setActiveTab('active')}
              style={{ 
                padding: '0 0 12px 0', background: 'none', border: 'none', 
                fontSize: '15px', fontWeight: activeTab === 'active' ? 700 : 500,
                color: activeTab === 'active' ? '#0047CC' : '#6B7A99',
                borderBottom: activeTab === 'active' ? '3px solid #0047CC' : '3px solid transparent',
                cursor: 'pointer'
              }}
            >
              Active Contract(s)
            </button>
            <button 
              onClick={() => setActiveTab('pending')}
              style={{ 
                padding: '0 0 12px 0', background: 'none', border: 'none', 
                fontSize: '15px', fontWeight: activeTab === 'pending' ? 700 : 500,
                color: activeTab === 'pending' ? '#0047CC' : '#6B7A99',
                borderBottom: activeTab === 'pending' ? '3px solid #0047CC' : '3px solid transparent',
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px'
              }}
            >
              Pending Signature
              {pendingContracts.length > 0 && (
                <span style={{ background: '#EF4444', color: '#fff', fontSize: '11px', padding: '2px 8px', borderRadius: '12px' }}>
                  {pendingContracts.length}
                </span>
              )}
            </button>
            <button 
              onClick={() => setActiveTab('past')}
              style={{ 
                padding: '0 0 12px 0', background: 'none', border: 'none', 
                fontSize: '15px', fontWeight: activeTab === 'past' ? 700 : 500,
                color: activeTab === 'past' ? '#0047CC' : '#6B7A99',
                borderBottom: activeTab === 'past' ? '3px solid #0047CC' : '3px solid transparent',
                cursor: 'pointer'
              }}
            >
              Past Contracts
            </button>
          </div>

          {activeTab === 'active' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {activeContracts.length === 0 ? (
                <Card style={{ padding: '32px', textAlign: 'center', color: '#6B7A99' }}>
                  You currently have no active contracts.
                </Card>
              ) : activeContracts.map(c => (
                <Card key={c.id} style={{ padding: '24px', borderLeft: '4px solid #10B981' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
                    <div>
                      <div style={{ fontSize: '12px', fontWeight: 700, color: '#10B981', background: '#D1FAE5', display: 'inline-block', padding: '4px 8px', borderRadius: '4px', marginBottom: '8px' }}>
                        Active Engagement
                      </div>
                      <div style={{ fontSize: '20px', fontWeight: 800, color: '#1A2340', marginBottom: '4px' }}>
                        {c.role_title}
                      </div>
                      <div style={{ fontSize: '16px', color: '#0047CC', fontWeight: 700, marginBottom: '16px' }}>
                        {c.clientName}
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '32px', fontSize: '14px', color: '#475569' }}>
                        <div>
                          <div style={{ fontSize: '11px', color: '#94A3B8', textTransform: 'uppercase', fontWeight: 700, marginBottom: '4px' }}>Monthly Rate</div>
                          <div style={{ fontWeight: 800, color: '#1A2340', fontSize: '16px' }}>\${c.monthly_rate_usd?.toLocaleString()}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: '11px', color: '#94A3B8', textTransform: 'uppercase', fontWeight: 700, marginBottom: '4px' }}>Start Date</div>
                          <div style={{ fontWeight: 600 }}>{new Date(c.start_date!).toLocaleDateString()}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: '11px', color: '#94A3B8', textTransform: 'uppercase', fontWeight: 700, marginBottom: '4px' }}>Current Performance</div>
                          <div style={{ fontWeight: 800, fontSize: '16px', color: (c.performance_score || 0) > 90 ? '#10B981' : '#F59E0B' }}>
                            {c.performance_score}/100
                          </div>
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <button style={{
                        padding: '10px 16px', background: '#0047CC', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 700, cursor: 'pointer'
                      }}>
                        Open Remotan Workspace
                      </button>
                      <button style={{
                        padding: '10px 16px', background: '#F1F5F9', color: '#475569', border: 'none', borderRadius: '8px', fontWeight: 700, cursor: 'pointer'
                      }}>
                        View Contract PDF
                      </button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}

          {activeTab === 'pending' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {pendingContracts.length === 0 ? (
                <Card style={{ padding: '32px', textAlign: 'center', color: '#6B7A99' }}>
                  No contracts pending your signature.
                </Card>
              ) : pendingContracts.map(c => (
                <Card key={c.id} style={{ padding: '24px', borderLeft: '4px solid #F59E0B' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
                    <div>
                      <div style={{ fontSize: '12px', fontWeight: 700, color: '#D97706', background: '#FEF3C7', display: 'inline-block', padding: '4px 8px', borderRadius: '4px', marginBottom: '8px' }}>
                        Awaiting Your Signature
                      </div>
                      <div style={{ fontSize: '18px', fontWeight: 800, color: '#1A2340', marginBottom: '4px' }}>
                        {c.role_title}
                      </div>
                      <div style={{ fontSize: '14px', color: '#6B7A99', display: 'flex', gap: '16px' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <span style={{ display: 'inline-block', padding: '2px 6px', background: '#F1F5F9', borderRadius: '4px', fontSize: '11px', fontWeight: 700, color: '#475569' }}>CLIENT HIDDEN</span>
                          Details revealed on activation
                        </span>
                        <span>💰 \${c.monthly_rate_usd?.toLocaleString()} / mo</span>
                      </div>
                    </div>
                    <div>
                      {activeContracts.length > 0 ? (
                        <div style={{ color: '#991B1B', fontSize: '13px', fontWeight: 600, maxWidth: '250px', textAlign: 'right', background: '#FEE2E2', padding: '8px 12px', borderRadius: '6px' }}>
                          You have an active contract. Contact your Talent Manager to manage multiple engagements.
                        </div>
                      ) : (
                        <button onClick={() => setSigningContractId(c.id)} style={{
                          padding: '10px 16px', background: '#0047CC', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 700, cursor: 'pointer'
                        }}>
                          Review & Sign
                        </button>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}

          {activeTab === 'past' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {pastContracts.length === 0 ? (
                <Card style={{ padding: '32px', textAlign: 'center', color: '#6B7A99' }}>
                  No past contracts found.
                </Card>
              ) : pastContracts.map(c => (
                <Card key={c.id} style={{ padding: '24px', opacity: 0.85 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
                    <div>
                      <div style={{ fontSize: '18px', fontWeight: 800, color: '#1A2340', marginBottom: '4px' }}>
                        {c.role_title}
                      </div>
                      <div style={{ fontSize: '15px', color: '#475569', fontWeight: 600, marginBottom: '8px' }}>
                        {c.clientName}
                      </div>
                      <div style={{ fontSize: '13px', color: '#6B7A99', display: 'flex', gap: '16px' }}>
                        <span>🗓️ {new Date(c.start_date!).toLocaleDateString()} – {new Date(c.end_date!).toLocaleDateString()}</span>
                        <span style={{ fontWeight: 700, color: '#1A2340' }}>⭐ Final Score: {c.performance_score}/100</span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '12px' }}>
                      <button style={{
                        padding: '8px 12px', background: '#F1F5F9', color: '#475569', border: 'none', borderRadius: '8px', fontWeight: 600, cursor: 'pointer', fontSize: '13px'
                      }}>
                        View Performance
                      </button>
                      <button style={{
                        padding: '8px 12px', background: '#F1F5F9', color: '#475569', border: 'none', borderRadius: '8px', fontWeight: 600, cursor: 'pointer', fontSize: '13px'
                      }}>
                        View PDF
                      </button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};

`;

content = content.substring(0, startIndex) + newSection + content.substring(endIndex);
fs.writeFileSync(file, content);
console.log("Replaced successfully!");
