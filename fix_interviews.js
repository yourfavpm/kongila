const fs = require('fs');
const file = '/Users/oluwadammilola/benita/kongila/apps/kongila-web/components/TalentDashboard.tsx';
let content = fs.readFileSync(file, 'utf8');

const startMarker = "// ─── Section 2.5";
const endMarker = "// ─── Section 2.6";

const startIndex = content.indexOf(startMarker);
const endIndex = content.indexOf(endMarker);

if (startIndex === -1 || endIndex === -1) {
  console.log("Could not find markers");
  process.exit(1);
}

const newSection = `// ─── Section 2.5: Interviews (KT-INTERVIEW) ─────────────────────────────────────────
const MOCK_INTERVIEWS: Interview[] = [
  {
    id: 'int-1',
    requestId: 'req-1',
    matchId: 'm-1',
    talentId: 't-1',
    talentName: 'Talent User',
    clientName: 'Nexus Health',
    title: 'Lead React Architect',
    date: '2026-07-10',
    time: '15:00',
    status: 'Proposed',
    createdAt: new Date().toISOString()
  },
  {
    id: 'int-2',
    requestId: 'req-2',
    matchId: 'm-2',
    talentId: 't-1',
    talentName: 'Talent User',
    clientName: 'Horizon Fintech',
    title: 'Senior Frontend Engineer',
    date: '2026-07-12',
    time: '10:00',
    status: 'Scheduled',
    meetingLink: 'https://meet.google.com/abc-defg-hij',
    createdAt: new Date().toISOString()
  },
  {
    id: 'int-3',
    requestId: 'req-3',
    matchId: 'm-3',
    talentId: 't-1',
    talentName: 'Talent User',
    clientName: 'Global Corp',
    title: 'React Native Developer',
    date: '2026-07-01',
    time: '14:00',
    status: 'Completed',
    outcome: 'Proceeded',
    talentNotes: 'The technical interview went well. They asked a lot about React Native performance.',
    createdAt: new Date().toISOString()
  }
];

const InterviewsSection = () => {
  const [activeTab, setActiveTab] = useState<'action'|'upcoming'|'past'>('action');
  const [interviews, setInterviews] = useState<Interview[]>(MOCK_INTERVIEWS);
  const [editingNotesId, setEditingNotesId] = useState<string | null>(null);
  const [notesValue, setNotesValue] = useState('');

  const actionRequired = interviews.filter(i => i.status === 'Proposed');
  const upcoming = interviews.filter(i => i.status === 'Scheduled' || i.status === 'Rescheduled');
  const past = interviews.filter(i => i.status === 'Completed' || i.status === 'Cancelled');

  const handleConfirm = (id: string) => {
    setInterviews(prev => prev.map(i => i.id === id ? { ...i, status: 'Scheduled' } : i));
    alert('Interview confirmed! An email and calendar invite have been sent to you and the client.');
    setActiveTab('upcoming');
  };

  const handleRequestDifferentTime = () => {
    alert('Opening a message thread with your Account Officer to renegotiate the time.');
  };

  const handleSaveNotes = (id: string) => {
    setInterviews(prev => prev.map(i => i.id === id ? { ...i, talentNotes: notesValue } : i));
    setEditingNotesId(null);
  };

  const generateGoogleCalendarLink = (i: Interview) => {
    const start = new Date(\`\${i.date}T\${i.time}\`).toISOString().replace(/-|:|\\.\\d\\d\\d/g, "");
    const end = new Date(new Date(\`\${i.date}T\${i.time}\`).getTime() + 60 * 60 * 1000).toISOString().replace(/-|:|\\.\\d\\d\\d/g, "");
    return \`https://calendar.google.com/calendar/render?action=TEMPLATE&text=Interview+-+\${encodeURIComponent(i.title)}&dates=\${start}/\${end}&details=Meeting+Link:+\${encodeURIComponent(i.meetingLink || '')}\`;
  };

  return (
    <div style={{ padding: '24px 32px', maxWidth: '1000px', margin: '0 auto', fontFamily: '"Inter", sans-serif' }}>
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: 900, color: '#1A2340', margin: '0 0 8px 0', letterSpacing: '-0.5px' }}>
          Interviews
        </h1>
        <p style={{ color: '#6B7A99', fontSize: '15px', margin: 0 }}>
          Manage your upcoming interviews and review past feedback.
        </p>
      </div>

      <div style={{ display: 'flex', gap: '32px', borderBottom: '1px solid #DDE2EC', marginBottom: '24px' }}>
        <button 
          onClick={() => setActiveTab('action')}
          style={{ 
            padding: '0 0 12px 0', background: 'none', border: 'none', 
            fontSize: '15px', fontWeight: activeTab === 'action' ? 700 : 500,
            color: activeTab === 'action' ? '#0047CC' : '#6B7A99',
            borderBottom: activeTab === 'action' ? '3px solid #0047CC' : '3px solid transparent',
            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px'
          }}
        >
          Action Required
          {actionRequired.length > 0 && (
            <span style={{ background: '#EF4444', color: '#fff', fontSize: '11px', padding: '2px 8px', borderRadius: '12px' }}>
              {actionRequired.length}
            </span>
          )}
        </button>
        <button 
          onClick={() => setActiveTab('upcoming')}
          style={{ 
            padding: '0 0 12px 0', background: 'none', border: 'none', 
            fontSize: '15px', fontWeight: activeTab === 'upcoming' ? 700 : 500,
            color: activeTab === 'upcoming' ? '#0047CC' : '#6B7A99',
            borderBottom: activeTab === 'upcoming' ? '3px solid #0047CC' : '3px solid transparent',
            cursor: 'pointer'
          }}
        >
          Upcoming ({upcoming.length})
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
          Past
        </button>
      </div>

      {activeTab === 'action' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {actionRequired.length === 0 ? (
            <Card style={{ padding: '32px', textAlign: 'center', color: '#6B7A99' }}>
              No action required right now.
            </Card>
          ) : actionRequired.map(i => (
            <Card key={i.id} style={{ padding: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
                <div>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: '#D97706', background: '#FEF3C7', display: 'inline-block', padding: '4px 8px', borderRadius: '4px', marginBottom: '8px' }}>
                    Awaiting Your Confirmation
                  </div>
                  <div style={{ fontSize: '18px', fontWeight: 800, color: '#1A2340', marginBottom: '4px' }}>
                    {i.title}
                  </div>
                  <div style={{ fontSize: '14px', color: '#6B7A99', display: 'flex', gap: '16px' }}>
                    <span>📅 {new Date(i.date).toLocaleDateString()}</span>
                    <span>🕒 {i.time} (Your Local Time)</span>
                    <span>⏳ Est. 60 mins</span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <button onClick={handleRequestDifferentTime} style={{
                    padding: '10px 16px', background: '#F5F7FA', color: '#1A2340', border: 'none', borderRadius: '8px', fontWeight: 700, cursor: 'pointer'
                  }}>
                    Request Different Time
                  </button>
                  <button onClick={() => handleConfirm(i.id)} style={{
                    padding: '10px 16px', background: '#0047CC', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 700, cursor: 'pointer'
                  }}>
                    Confirm Slot
                  </button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {activeTab === 'upcoming' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {upcoming.length === 0 ? (
            <Card style={{ padding: '32px', textAlign: 'center', color: '#6B7A99' }}>
              No upcoming interviews.
            </Card>
          ) : upcoming.map(i => (
            <Card key={i.id} style={{ padding: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
                <div>
                  <div style={{ fontSize: '18px', fontWeight: 800, color: '#1A2340', marginBottom: '4px' }}>
                    {i.title}
                  </div>
                  <div style={{ fontSize: '14px', color: '#6B7A99', display: 'flex', gap: '16px' }}>
                    <span>📅 {new Date(i.date).toLocaleDateString()}</span>
                    <span>🕒 {i.time} (Your Local Time)</span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                  {i.meetingLink ? (
                    <a href={i.meetingLink} target="_blank" rel="noopener noreferrer" style={{
                      padding: '10px 16px', background: '#0047CC', color: '#fff', textDecoration: 'none', borderRadius: '8px', fontWeight: 700, display: 'inline-block'
                    }}>
                      Join Video Call
                    </a>
                  ) : (
                    <span style={{ color: '#6B7A99', fontSize: '13px' }}>Link will be provided soon</span>
                  )}
                  <a href={generateGoogleCalendarLink(i)} target="_blank" rel="noopener noreferrer" style={{
                    padding: '10px 16px', background: '#F5F7FA', color: '#1A2340', textDecoration: 'none', borderRadius: '8px', fontWeight: 700, display: 'inline-block'
                  }}>
                    Add to Calendar
                  </a>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {activeTab === 'past' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {past.length === 0 ? (
            <Card style={{ padding: '32px', textAlign: 'center', color: '#6B7A99' }}>
              No past interviews.
            </Card>
          ) : past.map(i => (
            <Card key={i.id} style={{ padding: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
                <div style={{ flex: 1, minWidth: '300px' }}>
                  <div style={{ fontSize: '18px', fontWeight: 800, color: '#1A2340', marginBottom: '4px' }}>
                    {i.title}
                  </div>
                  <div style={{ fontSize: '14px', color: '#6B7A99', display: 'flex', gap: '16px', marginBottom: '16px' }}>
                    <span>📅 {new Date(i.date).toLocaleDateString()}</span>
                    <span>Status: {i.status}</span>
                  </div>
                  
                  <div style={{ background: '#F8FAFC', padding: '16px', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <span style={{ fontSize: '13px', fontWeight: 700, color: '#475569' }}>🔒 My Private Notes</span>
                      {editingNotesId !== i.id && (
                        <button onClick={() => { setEditingNotesId(i.id); setNotesValue(i.talentNotes || ''); }} style={{
                          background: 'none', border: 'none', color: '#0047CC', fontSize: '13px', fontWeight: 700, cursor: 'pointer'
                        }}>
                          {i.talentNotes ? 'Edit' : 'Add Note'}
                        </button>
                      )}
                    </div>
                    {editingNotesId === i.id ? (
                      <div>
                        <textarea 
                          value={notesValue}
                          onChange={e => setNotesValue(e.target.value)}
                          style={{ width: '100%', minHeight: '80px', padding: '8px', borderRadius: '4px', border: '1px solid #CBD5E1', marginBottom: '8px', fontFamily: 'inherit' }}
                          placeholder="Jot down questions they asked, how you felt, or things to follow up on..."
                        />
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button onClick={() => handleSaveNotes(i.id)} style={{ padding: '6px 12px', background: '#0047CC', color: '#fff', border: 'none', borderRadius: '4px', fontWeight: 600, cursor: 'pointer' }}>Save</button>
                          <button onClick={() => setEditingNotesId(null)} style={{ padding: '6px 12px', background: '#E2E8F0', color: '#475569', border: 'none', borderRadius: '4px', fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <div style={{ fontSize: '14px', color: '#1A2340', whiteSpace: 'pre-wrap' }}>
                        {i.talentNotes || <span style={{ color: '#94A3B8', fontStyle: 'italic' }}>No notes added.</span>}
                      </div>
                    )}
                  </div>
                </div>

                {MOCK_PLATFORM_SETTINGS.interviewOutcomeVisibility && i.outcome && (
                  <div style={{ 
                    padding: '6px 12px', borderRadius: '16px', fontSize: '13px', fontWeight: 700,
                    background: i.outcome === 'Proceeded' ? '#DCFCE7' : i.outcome === 'Not Selected' ? '#FEE2E2' : '#FEF3C7',
                    color: i.outcome === 'Proceeded' ? '#166534' : i.outcome === 'Not Selected' ? '#991B1B' : '#92400E'
                  }}>
                    Outcome: {i.outcome}
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

`;

content = content.substring(0, startIndex) + newSection + content.substring(endIndex);
fs.writeFileSync(file, content);
console.log("Replaced successfully!");
