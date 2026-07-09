const fs = require('fs');
const file = '/Users/oluwadammilola/benita/kongila/apps/kongila-web/components/TalentDashboard.tsx';
let content = fs.readFileSync(file, 'utf8');

// Insert State Variables
content = content.replace(
  "const [signatureName, setSignatureName] = useState('');",
  `const [signatureName, setSignatureName] = useState('');
  const [viewingPdfId, setViewingPdfId] = useState<string | null>(null);
  const [viewingPerformanceId, setViewingPerformanceId] = useState<string | null>(null);`
);

// Define Render Methods
const renderMethods = `
  const renderPdfView = () => {
    const contract = contracts.find(c => c.id === viewingPdfId);
    if (!contract) return null;
    return (
      <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #E2E8F0', padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
          <h2 style={{ fontSize: '20px', fontWeight: 800, margin: 0, color: '#1A2340' }}>Contract PDF Document</h2>
          <button onClick={() => setViewingPdfId(null)} style={{ background: 'none', border: 'none', fontSize: '14px', cursor: 'pointer', color: '#64748B', fontWeight: 600 }}>✕ Close</button>
        </div>
        <div style={{ height: '400px', overflowY: 'auto', background: '#F8FAFC', padding: '32px', borderRadius: '8px', border: '1px solid #CBD5E1', fontFamily: 'serif', lineHeight: '1.6', color: '#334155' }}>
          <div style={{ textAlign: 'center', marginBottom: '24px' }}>
            <h3 style={{ fontSize: '20px', color: '#0F172A', margin: 0 }}>INDEPENDENT CONTRACTOR AGREEMENT</h3>
            <p style={{ color: '#64748B', fontSize: '14px', marginTop: '4px' }}>Reference: {contract.reference_number}</p>
          </div>
          <p>This Independent Contractor Agreement ("Agreement") is made effective as of {contract.start_date}, by and between Kongila and the Talent.</p>
          <h4 style={{ marginTop: '24px' }}>1. Services</h4>
          <p>The Talent agrees to perform services as a <strong>{contract.role_title}</strong> for the Client.</p>
          <h4 style={{ marginTop: '24px' }}>2. Compensation</h4>
          <p>The Talent will be paid <strong>\${contract.monthly_rate_usd}</strong> per month for their services.</p>
          <p style={{ marginTop: '16px' }}>Standard terms and conditions regarding confidentiality, intellectual property, termination, and independent contractor status apply.</p>
          <h4 style={{ marginTop: '32px', borderTop: '1px solid #CBD5E1', paddingTop: '16px' }}>Signatures</h4>
          <div style={{ display: 'flex', gap: '40px', marginTop: '16px' }}>
            <div style={{ flex: 1 }}>
              <p style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#64748B' }}>Kongila Authorized Representative:</p>
              <div style={{ fontFamily: 'cursive', fontSize: '24px', color: '#0F172A', borderBottom: '1px solid #CBD5E1', paddingBottom: '4px', width: '200px' }}>Alex Kongila</div>
              <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#94A3B8' }}>Signed electronically</p>
            </div>
            {contract.talent_typed_signature && (
              <div style={{ flex: 1 }}>
                <p style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#64748B' }}>Talent:</p>
                <div style={{ fontFamily: 'cursive', fontSize: '24px', color: '#0F172A', borderBottom: '1px solid #CBD5E1', paddingBottom: '4px', width: '200px' }}>{contract.talent_typed_signature}</div>
                <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#94A3B8' }}>Signed at: {new Date(contract.talent_signed_at || '').toLocaleString()}<br/>IP: {contract.talent_sign_ip}</p>
              </div>
            )}
          </div>
          {contract.status === 'completed' || contract.status === 'terminated' ? (
            <div style={{ marginTop: '40px', textAlign: 'center', color: '#EF4444', border: '2px solid #EF4444', padding: '12px', borderRadius: '8px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '2px' }}>
              CONTRACT {contract.status}
            </div>
          ) : contract.status === 'active' ? (
            <div style={{ marginTop: '40px', textAlign: 'center', color: '#10B981', border: '2px solid #10B981', padding: '12px', borderRadius: '8px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '2px' }}>
              ACTIVE CONTRACT
            </div>
          ) : null}
        </div>
      </div>
    );
  };

  const renderPerformanceView = () => {
    const contract = contracts.find(c => c.id === viewingPerformanceId);
    if (!contract) return null;
    return (
      <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #E2E8F0', padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
          <h2 style={{ fontSize: '20px', fontWeight: 800, margin: 0, color: '#1A2340' }}>Performance Summary</h2>
          <button onClick={() => setViewingPerformanceId(null)} style={{ background: 'none', border: 'none', fontSize: '14px', cursor: 'pointer', color: '#64748B', fontWeight: 600 }}>✕ Close</button>
        </div>
        <div style={{ background: '#F8FAFC', padding: '24px', borderRadius: '8px', border: '1px solid #CBD5E1' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', borderBottom: '1px solid #E2E8F0', paddingBottom: '16px' }}>
            <div>
              <h3 style={{ fontSize: '18px', margin: '0 0 4px 0', color: '#0F172A' }}>{contract.role_title}</h3>
              <p style={{ fontSize: '14px', color: '#64748B', margin: 0 }}>{contract.clientName}</p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '12px', color: '#64748B', textTransform: 'uppercase', fontWeight: 700 }}>Final Score</div>
              <div style={{ fontSize: '24px', fontWeight: 900, color: '#10B981' }}>{contract.performance_score}/100</div>
            </div>
          </div>
          
          <h4 style={{ fontSize: '14px', fontWeight: 700, color: '#334155', marginBottom: '12px' }}>Score Breakdown</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
            {[
              { label: 'Communication & Responsiveness', score: 95 },
              { label: 'Technical Quality & Delivery', score: 90 },
              { label: 'Reliability & Autonomy', score: 98 }
            ].map((metric, i) => (
              <div key={i}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '4px' }}>
                  <span style={{ fontWeight: 600, color: '#475569' }}>{metric.label}</span>
                  <span style={{ fontWeight: 700, color: '#1A2340' }}>{metric.score}/100</span>
                </div>
                <div style={{ height: '8px', background: '#E2E8F0', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{ width: \`\${metric.score}%\`, height: '100%', background: '#0047CC' }}></div>
                </div>
              </div>
            ))}
          </div>

          <h4 style={{ fontSize: '14px', fontWeight: 700, color: '#334155', marginBottom: '8px' }}>Manager Feedback</h4>
          <p style={{ fontSize: '14px', color: '#475569', lineHeight: '1.6', background: '#fff', padding: '16px', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
            "Excellent engagement throughout the contract duration. Delivered high-quality code consistently and proved to be an invaluable autonomous contributor to the team. Would highly recommend for future projects."
          </p>
        </div>
      </div>
    );
  };
`;

content = content.replace(
  "return (",
  `${renderMethods}\n  return (`
);

// Update render block
content = content.replace(
  `{signingContractId ? (
        renderSigningView()
      ) : (`,
  `{signingContractId ? (
        renderSigningView()
      ) : viewingPdfId ? (
        renderPdfView()
      ) : viewingPerformanceId ? (
        renderPerformanceView()
      ) : (`
);

// Hook up buttons in Active Contracts
content = content.replace(
  `Download Contract PDF`,
  `View Contract PDF`
);
content = content.replace(
  `button style={{
                        padding: '10px 16px', background: '#F1F5F9', color: '#475569', border: 'none', borderRadius: '8px', fontWeight: 700, cursor: 'pointer'
                      }}>
                        View Contract PDF`,
  `button onClick={() => setViewingPdfId(c.id)} style={{
                        padding: '10px 16px', background: '#F1F5F9', color: '#475569', border: 'none', borderRadius: '8px', fontWeight: 700, cursor: 'pointer'
                      }}>
                        View Contract PDF`
);

// Hook up buttons in Past Contracts
content = content.replace(
  `button style={{
                        padding: '8px 12px', background: '#F1F5F9', color: '#475569', border: 'none', borderRadius: '8px', fontWeight: 600, cursor: 'pointer', fontSize: '13px'
                      }}>
                        View Performance Summary`,
  `button onClick={() => setViewingPerformanceId(c.id)} style={{
                        padding: '8px 12px', background: '#F1F5F9', color: '#475569', border: 'none', borderRadius: '8px', fontWeight: 600, cursor: 'pointer', fontSize: '13px'
                      }}>
                        View Performance Summary`
);

content = content.replace(
  `button style={{
                        padding: '8px 12px', background: '#F1F5F9', color: '#475569', border: 'none', borderRadius: '8px', fontWeight: 600, cursor: 'pointer', fontSize: '13px'
                      }}>
                        View Performance`,
  `button onClick={() => setViewingPerformanceId(c.id)} style={{
                        padding: '8px 12px', background: '#F1F5F9', color: '#475569', border: 'none', borderRadius: '8px', fontWeight: 600, cursor: 'pointer', fontSize: '13px'
                      }}>
                        View Performance`
);

content = content.replace(
  `button style={{
                        padding: '8px 12px', background: '#F1F5F9', color: '#475569', border: 'none', borderRadius: '8px', fontWeight: 600, cursor: 'pointer', fontSize: '13px'
                      }}>
                        View PDF`,
  `button onClick={() => setViewingPdfId(c.id)} style={{
                        padding: '8px 12px', background: '#F1F5F9', color: '#475569', border: 'none', borderRadius: '8px', fontWeight: 600, cursor: 'pointer', fontSize: '13px'
                      }}>
                        View PDF`
);


fs.writeFileSync(file, content);
console.log("Replaced successfully!");
