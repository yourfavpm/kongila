import React, { useState, useRef } from 'react';

// ─── Types ───────────────────────────────────────────────────────────────────
interface TalentDashboardProps {
  currentUser: any;
  talentProfile: any;
  contracts: any[];
  matches: any[];
}

type Section =
  | 'profile'
  | 'professional'
  | 'documents'
  | 'contracts'
  | 'pipeline'
  | 'features'
  | 'compliance'
  | 'engagement'
  | 'onboarding';

// ─── Nav Items ────────────────────────────────────────────────────────────────
const NAV_ITEMS: { id: Section; label: string; icon: string }[] = [
  { id: 'profile',      label: 'Profile',              icon: '👤' },
  { id: 'professional', label: 'Professional Details',  icon: '💼' },
  { id: 'documents',    label: 'Documents',             icon: '📄' },
  { id: 'contracts',    label: 'Contract System',       icon: '📝' },
  { id: 'pipeline',     label: 'Application Pipeline',  icon: '🚀' },
  { id: 'features',     label: 'System Features',       icon: '⚙️' },
  { id: 'compliance',   label: 'Compliance',            icon: '🛡️' },
  { id: 'engagement',   label: 'Engagement',            icon: '🤝' },
  { id: 'onboarding',   label: 'Onboarding',            icon: '🎯' },
];

// ─── Shared Sub-Components ────────────────────────────────────────────────────
const Card = ({ children, style = {} }: { children: React.ReactNode; style?: React.CSSProperties }) => (
  <div style={{
    background: '#FFFFFF',
    border: '1px solid #DDE2EC',
    borderRadius: '12px',
    padding: '24px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.02), 0 8px 24px rgba(0,0,0,0.04)',
    ...style
  }}>
    {children}
  </div>
);

const SectionHeader = ({ title, subtitle }: { title: string; subtitle?: string }) => (
  <div style={{ marginBottom: '24px' }}>
    <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#1A2340', marginBottom: '4px' }}>{title}</h2>
    {subtitle && <p style={{ fontSize: '14px', color: '#6B7A99' }}>{subtitle}</p>}
  </div>
);

const FieldRow = ({ label, value }: { label: string; value: string }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid #F5F7FA' }}>
    <span style={{ fontSize: '13px', color: '#6B7A99', fontWeight: 500 }}>{label}</span>
    <span style={{ fontSize: '13px', color: '#1A2340', fontWeight: 600 }}>{value}</span>
  </div>
);

const StatusPill = ({ label, color }: { label: string; color: string }) => (
  <span style={{ background: `${color}15`, color, border: `1px solid ${color}30`, borderRadius: '20px', padding: '4px 12px', fontSize: '12px', fontWeight: 600 }}>
    {label}
  </span>
);

// ─── Section 1: Profile ───────────────────────────────────────────────────────
const ProfileSection = ({ user, profile }: { user: any; profile: any }) => {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(user?.name || '');
  const [phone, setPhone] = useState(profile?.phone || '+234 803 929 1827');
  const [city, setCity] = useState(profile?.location?.split(',')[0] || 'Lagos');
  const [country, setCountry] = useState(profile?.location?.split(',')[1]?.trim() || 'Nigeria');

  return (
    <div>
      <SectionHeader title="Profile" subtitle="Your personal information and contact details." />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '24px' }}>
        {/* Avatar card */}
        <Card style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', textAlign: 'center' }}>
          <div style={{
            width: '80px', height: '80px', borderRadius: '50%',
            background: 'linear-gradient(135deg, #0047CC, #3D7FFF)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '32px', color: '#fff', fontWeight: 800
          }}>
            {(name || 'T').charAt(0).toUpperCase()}
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: '16px', color: '#1A2340' }}>{name}</div>
            <div style={{ fontSize: '13px', color: '#6B7A99', marginTop: '4px' }}>{profile?.title || 'Operations Specialist'}</div>
          </div>
          <StatusPill label={profile?.vettingStatus || 'Under Review'} color="#0047CC" />
        </Card>

        {/* Details card */}
        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ fontWeight: 700, fontSize: '15px', color: '#1A2340' }}>Personal Information</h3>
            <button onClick={() => setEditing(!editing)} style={{
              background: editing ? '#0047CC' : 'transparent',
              color: editing ? '#fff' : '#0047CC',
              border: '1px solid #0047CC', borderRadius: '8px',
              padding: '6px 16px', fontSize: '13px', fontWeight: 600, cursor: 'pointer'
            }}>
              {editing ? 'Save' : 'Edit'}
            </button>
          </div>

          {editing ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {[
                { label: 'Full Name', value: name, setter: setName },
                { label: 'Phone', value: phone, setter: setPhone },
                { label: 'City', value: city, setter: setCity },
                { label: 'Country', value: country, setter: setCountry },
              ].map(f => (
                <div key={f.label}>
                  <label style={{ fontSize: '12px', color: '#6B7A99', fontWeight: 600, display: 'block', marginBottom: '4px' }}>{f.label}</label>
                  <input value={f.value} onChange={e => f.setter(e.target.value)} style={{
                    width: '100%', height: '40px', border: '1px solid #DDE2EC', borderRadius: '8px',
                    padding: '0 12px', fontSize: '13px', color: '#1A2340', boxSizing: 'border-box',
                    outline: 'none'
                  }} />
                </div>
              ))}
            </div>
          ) : (
            <div>
              <FieldRow label="Full Name" value={name} />
              <FieldRow label="Email" value={user?.email || 'talent@kongila.io'} />
              <FieldRow label="Phone" value={phone} />
              <FieldRow label="Location" value={`${city}, ${country}`} />
              <FieldRow label="Timezone" value={profile?.timezone || 'GMT+1'} />
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};

// ─── Section 2: Professional Details ─────────────────────────────────────────
const ProfessionalSection = ({ profile }: { profile: any }) => {
  const skills = (profile?.skills || ['Operations Management', 'Team Leadership', 'Logistics', 'Process Optimization']);
  const skillsArray = Array.isArray(skills) ? skills : skills.split(',').map((s: string) => s.trim());

  return (
    <div>
      <SectionHeader title="Professional Details" subtitle="Your skills, role preferences, and availability." />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
        <Card>
          <h3 style={{ fontWeight: 700, fontSize: '15px', color: '#1A2340', marginBottom: '16px' }}>Skills</h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {skillsArray.map((skill: string, i: number) => (
              <span key={i} style={{
                background: '#F5F7FA', color: '#1A2340', border: '1px solid #DDE2EC',
                borderRadius: '20px', padding: '6px 14px', fontSize: '12px', fontWeight: 600
              }}>{skill}</span>
            ))}
          </div>
        </Card>

        <Card>
          <h3 style={{ fontWeight: 700, fontSize: '15px', color: '#1A2340', marginBottom: '16px' }}>Role & Availability</h3>
          <FieldRow label="Primary Role" value={profile?.title || 'Senior Operations Manager'} />
          <FieldRow label="Seniority" value={profile?.seniorityLevel || 'Senior'} />
          <FieldRow label="Experience" value={`${profile?.yearsExperience || 5} years`} />
          <FieldRow label="Employment Type" value={profile?.employmentPreference || 'Full Time'} />
          <FieldRow label="Availability" value={`${profile?.availability || 100}%`} />
        </Card>

        <Card style={{ gridColumn: '1 / -1' }}>
          <h3 style={{ fontWeight: 700, fontSize: '15px', color: '#1A2340', marginBottom: '16px' }}>Salary Expectation</h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
            <div style={{ flex: 1, background: '#F5F7FA', borderRadius: '8px', height: '8px', overflow: 'hidden' }}>
              <div style={{ width: '70%', height: '100%', background: 'linear-gradient(90deg, #0047CC, #3D7FFF)', borderRadius: '8px' }} />
            </div>
            <span style={{ fontWeight: 800, fontSize: '20px', color: '#0047CC' }}>
              ${(profile?.salaryExpectation || 4500).toLocaleString()} / mo
            </span>
          </div>
          <div style={{ fontSize: '12px', color: '#6B7A99', marginTop: '8px' }}>Currency: {profile?.currency || 'USD'} · Basis: {profile?.hourlyMonthly || 'Monthly'}</div>
        </Card>
      </div>
    </div>
  );
};

// ─── Section 3: Documents ─────────────────────────────────────────────────────
const DocumentsSection = ({ profile }: { profile: any }) => {
  const docs = [
    { label: 'Curriculum Vitae', filename: profile?.cvName || 'CV_Operations_Lead.pdf', icon: '📄', status: 'Uploaded' },
    { label: 'Portfolio / Work Samples', filename: profile?.portfolioUrl || 'https://github.com/talent-profile', icon: '🌐', status: 'Linked' },
    { label: 'Certifications', filename: profile?.certifications || 'Certified Operations Professional', icon: '🏆', status: 'Verified' },
  ];

  return (
    <div>
      <SectionHeader title="Documents" subtitle="Upload and manage your career documents." />
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {docs.map((doc, i) => (
          <Card key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{ width: '48px', height: '48px', background: '#F5F7FA', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px' }}>
                {doc.icon}
              </div>
              <div>
                <div style={{ fontWeight: 600, fontSize: '14px', color: '#1A2340' }}>{doc.label}</div>
                <div style={{ fontSize: '12px', color: '#6B7A99', marginTop: '2px' }}>{doc.filename}</div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <StatusPill label={doc.status} color="#0ABFBC" />
              <button style={{
                background: '#F5F7FA', border: '1px solid #DDE2EC', borderRadius: '8px',
                padding: '8px 16px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', color: '#1A2340'
              }}>Replace</button>
            </div>
          </Card>
        ))}
        <Card style={{ border: '2px dashed #DDE2EC', background: '#FAFBFF', textAlign: 'center', padding: '32px', cursor: 'pointer' }}>
          <div style={{ fontSize: '28px', marginBottom: '8px' }}>+</div>
          <div style={{ fontWeight: 600, fontSize: '14px', color: '#6B7A99' }}>Upload additional document</div>
        </Card>
      </div>
    </div>
  );
};

// ─── Section 4: Contract System ───────────────────────────────────────────────
const ContractSection = ({ contracts, profile }: { contracts: any[]; profile: any }) => {
  const [contractTab, setContractTab] = useState<'active' | 'open' | 'closed'>('active');

  const mockContracts = contracts.length > 0 ? contracts : [
    { id: 'CON-001', employer: 'Vanguard Corp', role: 'Senior Operations Manager', status: 'Active', startDate: '2024-01-15', salary: 4500, rating: 5 },
  ];

  const STARS = [1, 2, 3, 4, 5];

  return (
    <div>
      <SectionHeader title="Contract System" subtitle="Review your active and historical contracts." />

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', background: '#F5F7FA', padding: '4px', borderRadius: '10px', width: 'fit-content' }}>
        {(['active', 'open', 'closed'] as const).map(tab => (
          <button key={tab} onClick={() => setContractTab(tab)} style={{
            padding: '8px 20px', borderRadius: '8px', border: 'none', cursor: 'pointer',
            fontWeight: 600, fontSize: '13px',
            background: contractTab === tab ? '#0047CC' : 'transparent',
            color: contractTab === tab ? '#fff' : '#6B7A99',
            transition: 'all 0.2s'
          }}>
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {mockContracts.map((c: any) => (
          <Card key={c.id}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: '15px', color: '#1A2340' }}>{c.role}</div>
                <div style={{ fontSize: '13px', color: '#6B7A99', marginTop: '4px' }}>{c.employer}</div>
              </div>
              <StatusPill label={c.status} color={c.status === 'Active' ? '#0047CC' : '#6B7A99'} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginTop: '20px' }}>
              <div style={{ background: '#F5F7FA', borderRadius: '8px', padding: '12px' }}>
                <div style={{ fontSize: '11px', color: '#6B7A99', fontWeight: 600, marginBottom: '4px' }}>START DATE</div>
                <div style={{ fontSize: '13px', color: '#1A2340', fontWeight: 700 }}>{c.startDate}</div>
              </div>
              <div style={{ background: '#F5F7FA', borderRadius: '8px', padding: '12px' }}>
                <div style={{ fontSize: '11px', color: '#6B7A99', fontWeight: 600, marginBottom: '4px' }}>MONTHLY RATE</div>
                <div style={{ fontSize: '13px', color: '#0047CC', fontWeight: 700 }}>${c.salary?.toLocaleString()}</div>
              </div>
              <div style={{ background: '#F5F7FA', borderRadius: '8px', padding: '12px' }}>
                <div style={{ fontSize: '11px', color: '#6B7A99', fontWeight: 600, marginBottom: '4px' }}>PERFORMANCE</div>
                <div style={{ display: 'flex', gap: '2px' }}>
                  {STARS.map(s => (
                    <span key={s} style={{ color: s <= (c.rating || 4) ? '#F59E0B' : '#DDE2EC', fontSize: '14px' }}>★</span>
                  ))}
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};

// ─── Section 5: Application Pipeline ─────────────────────────────────────────
const PipelineSection = ({ profile }: { profile: any }) => {
  const stages = [
    { id: 'applied',   label: 'Applied',   desc: 'Profile submitted to Kongila.' },
    { id: 'review',    label: 'Review',    desc: 'Application under evaluation.' },
    { id: 'vetted',    label: 'Vetted',    desc: 'Cleared for client matching.' },
    { id: 'matched',   label: 'Matched',   desc: 'Presented to employer.' },
    { id: 'deployed',  label: 'Deployed',  desc: 'Active on client engagement.' },
  ];

  const vettingStatus = profile?.vettingStatus || 'Under Review';
  const stageMap: Record<string, number> = { 'Under Review': 1, 'Pending': 1, 'Vetted': 2, 'Matched': 3, 'Deployed': 4 };
  const currentStageIdx = stageMap[vettingStatus] ?? 1;

  return (
    <div>
      <SectionHeader title="Application Status Pipeline" subtitle="Track your journey from application to deployment." />
      <Card>
        {/* Progress rail */}
        <div style={{ position: 'relative', padding: '32px 0 16px' }}>
          {/* Line */}
          <div style={{ position: 'absolute', top: '52px', left: '10%', right: '10%', height: '3px', background: '#DDE2EC', borderRadius: '3px' }}>
            <div style={{
              width: `${(currentStageIdx / (stages.length - 1)) * 100}%`,
              height: '100%', background: 'linear-gradient(90deg, #0047CC, #3D7FFF)',
              borderRadius: '3px', transition: 'width 0.5s ease'
            }} />
          </div>

          {/* Stages */}
          <div style={{ display: 'flex', justifyContent: 'space-between', position: 'relative', zIndex: 1 }}>
            {stages.map((stage, i) => {
              const done = i <= currentStageIdx;
              const active = i === currentStageIdx;
              return (
                <div key={stage.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', flex: 1 }}>
                  <div style={{
                    width: '40px', height: '40px', borderRadius: '50%',
                    background: done ? '#0047CC' : '#F5F7FA',
                    border: active ? '3px solid #3D7FFF' : done ? '3px solid #0047CC' : '2px solid #DDE2EC',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: done ? '#fff' : '#6B7A99', fontWeight: 800, fontSize: '14px',
                    boxShadow: active ? '0 0 0 6px rgba(0,71,204,0.12)' : 'none',
                    transition: 'all 0.3s'
                  }}>
                    {done && !active ? '✓' : i + 1}
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '13px', fontWeight: active ? 700 : 600, color: done ? '#0047CC' : '#6B7A99' }}>{stage.label}</div>
                    <div style={{ fontSize: '11px', color: '#6B7A99', marginTop: '2px', maxWidth: '80px' }}>{stage.desc}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Current status banner */}
        <div style={{ marginTop: '24px', background: '#F5F7FA', borderRadius: '10px', padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#0047CC', flexShrink: 0 }} />
          <div>
            <span style={{ fontWeight: 700, color: '#1A2340', fontSize: '14px' }}>Current Status: </span>
            <span style={{ color: '#0047CC', fontSize: '14px', fontWeight: 600 }}>{vettingStatus}</span>
            <p style={{ fontSize: '12px', color: '#6B7A99', marginTop: '2px', margin: 0 }}>Your profile is actively being reviewed by our matching team.</p>
          </div>
        </div>
      </Card>
    </div>
  );
};

// ─── Section 6: System Features ─────────────────────────────────────────────
const FeaturesSection = () => {
  const [tab, setTab] = useState<'calendar' | 'notifications' | 'messages' | 'interview'>('calendar');
  const today = new Date();
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1).getDay();
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  const notifications = [
    { text: 'Your profile has been shortlisted by a client.', time: '2h ago', unread: true },
    { text: 'Contract CON-001 has been updated.', time: '1d ago', unread: false },
    { text: 'New message from your Account Officer.', time: '2d ago', unread: false },
  ];

  const messages = [
    { sender: 'Priya Nair (Account Officer)', text: 'Hi! Your vetting is complete. We are now matching you.', time: '10:32 AM', mine: false },
    { sender: 'You', text: 'Thank you! Looking forward to it.', time: '10:45 AM', mine: true },
  ];

  return (
    <div>
      <SectionHeader title="System Features" subtitle="Calendar, notifications, messaging, and interview booking." />
      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', background: '#F5F7FA', padding: '4px', borderRadius: '10px', width: 'fit-content' }}>
        {(['calendar', 'notifications', 'messages', 'interview'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: '8px 18px', borderRadius: '8px', border: 'none', cursor: 'pointer',
            fontWeight: 600, fontSize: '13px',
            background: tab === t ? '#0047CC' : 'transparent',
            color: tab === t ? '#fff' : '#6B7A99', transition: 'all 0.2s', textTransform: 'capitalize'
          }}>{t}</button>
        ))}
      </div>

      {tab === 'calendar' && (
        <Card>
          <h3 style={{ fontWeight: 700, fontSize: '15px', color: '#1A2340', marginBottom: '4px' }}>
            {today.toLocaleString('default', { month: 'long' })} {today.getFullYear()}
          </h3>
          <p style={{ fontSize: '12px', color: '#6B7A99', marginBottom: '20px' }}>Your schedule overview</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px', textAlign: 'center' }}>
            {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => (
              <div key={d} style={{ fontSize: '11px', fontWeight: 700, color: '#6B7A99', padding: '8px 0' }}>{d}</div>
            ))}
            {Array(firstDay).fill(null).map((_, i) => <div key={`empty-${i}`} />)}
            {days.map(day => (
              <div key={day} style={{
                padding: '8px 4px', borderRadius: '8px', fontSize: '13px', fontWeight: 600,
                background: day === today.getDate() ? '#0047CC' : 'transparent',
                color: day === today.getDate() ? '#fff' : '#1A2340',
                cursor: 'pointer'
              }}>{day}</div>
            ))}
          </div>
        </Card>
      )}

      {tab === 'notifications' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {notifications.map((n, i) => (
            <Card key={i} style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '16px 20px' }}>
              <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: n.unread ? '#0047CC' : '#DDE2EC', flexShrink: 0 }} />
              <div style={{ flex: 1, fontSize: '13px', color: '#1A2340', fontWeight: n.unread ? 600 : 400 }}>{n.text}</div>
              <div style={{ fontSize: '11px', color: '#6B7A99', flexShrink: 0 }}>{n.time}</div>
            </Card>
          ))}
        </div>
      )}

      {tab === 'messages' && (
        <Card style={{ display: 'flex', flexDirection: 'column', gap: '16px', minHeight: '320px' }}>
          {messages.map((m, i) => (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: m.mine ? 'flex-end' : 'flex-start', gap: '4px' }}>
              <div style={{ fontSize: '11px', color: '#6B7A99' }}>{m.sender} · {m.time}</div>
              <div style={{
                background: m.mine ? '#0047CC' : '#F5F7FA',
                color: m.mine ? '#fff' : '#1A2340',
                borderRadius: m.mine ? '12px 12px 0 12px' : '12px 12px 12px 0',
                padding: '10px 16px', fontSize: '13px', maxWidth: '70%'
              }}>{m.text}</div>
            </div>
          ))}
          <div style={{ marginTop: 'auto', display: 'flex', gap: '8px' }}>
            <input placeholder="Type a message..." style={{
              flex: 1, height: '40px', border: '1px solid #DDE2EC', borderRadius: '8px',
              padding: '0 12px', fontSize: '13px', outline: 'none'
            }} />
            <button style={{ background: '#0047CC', color: '#fff', border: 'none', borderRadius: '8px', padding: '0 20px', fontWeight: 600, cursor: 'pointer', fontSize: '13px' }}>Send</button>
          </div>
        </Card>
      )}

      {tab === 'interview' && (
        <Card>
          <h3 style={{ fontWeight: 700, fontSize: '15px', color: '#1A2340', marginBottom: '20px' }}>Book an Interview Slot</h3>
          {[{ label: 'Preferred Date', type: 'date' }, { label: 'Preferred Time', type: 'time' }].map(f => (
            <div key={f.label} style={{ marginBottom: '16px' }}>
              <label style={{ fontSize: '12px', fontWeight: 600, color: '#6B7A99', display: 'block', marginBottom: '6px' }}>{f.label}</label>
              <input type={f.type} style={{ width: '100%', height: '40px', border: '1px solid #DDE2EC', borderRadius: '8px', padding: '0 12px', fontSize: '13px', boxSizing: 'border-box', outline: 'none' }} />
            </div>
          ))}
          <button style={{ background: '#0047CC', color: '#fff', border: 'none', borderRadius: '8px', height: '42px', width: '100%', fontWeight: 700, fontSize: '14px', cursor: 'pointer', marginTop: '8px' }}>Request Interview Slot</button>
        </Card>
      )}
    </div>
  );
};

// ─── Section 7: Compliance + E-Signature ─────────────────────────────────────
const ComplianceSection = () => {
  const [sigModalDoc, setSigModalDoc] = useState<string | null>(null);
  const [signatureType, setSignatureType] = useState<'type' | 'draw'>('type');
  const [typedSig, setTypedSig] = useState('');
  const [signedDocs, setSignedDocs] = useState<Record<string, string>>({});
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);

  const docs = [
    { id: 'nda', label: 'Non-Disclosure Agreement (NDA)', desc: 'Confidentiality agreement between you and Kongila.' },
    { id: 'talent_agreement', label: 'Talent Agreement', desc: 'Your terms of engagement and compensation structure.' },
    { id: 'data_protection', label: 'Data Protection Policy', desc: 'How your personal data is stored and processed.' },
    { id: 'it_policy', label: 'IT & Security Policy', desc: 'Acceptable use of client systems and data security.' },
  ];

  const handleSign = (docId: string) => {
    const sig = typedSig.trim() || 'Drawn Signature';
    if (!sig) return;
    const timestamp = new Date().toLocaleString();
    setSignedDocs(prev => ({ ...prev, [docId]: `Signed: "${sig}" — ${timestamp}` }));
    setSigModalDoc(null);
    setTypedSig('');
  };

  const startDraw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    drawing.current = true;
    const ctx = canvasRef.current?.getContext('2d');
    if (ctx) { ctx.beginPath(); ctx.moveTo(e.nativeEvent.offsetX, e.nativeEvent.offsetY); }
  };
  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    const ctx = canvasRef.current?.getContext('2d');
    if (ctx) { ctx.lineTo(e.nativeEvent.offsetX, e.nativeEvent.offsetY); ctx.strokeStyle = '#0047CC'; ctx.lineWidth = 2; ctx.stroke(); }
  };
  const stopDraw = () => { drawing.current = false; };

  return (
    <div>
      <SectionHeader title="Compliance" subtitle="Review and e-sign all required legal documents." />
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {docs.map(doc => (
          <Card key={doc.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
              <div style={{ width: '44px', height: '44px', background: '#F5F7FA', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>🛡️</div>
              <div>
                <div style={{ fontWeight: 700, fontSize: '14px', color: '#1A2340' }}>{doc.label}</div>
                <div style={{ fontSize: '12px', color: '#6B7A99', marginTop: '2px' }}>{doc.desc}</div>
                {signedDocs[doc.id] && <div style={{ fontSize: '11px', color: '#0ABFBC', marginTop: '4px', fontWeight: 600 }}>✓ {signedDocs[doc.id]}</div>}
              </div>
            </div>
            <button onClick={() => setSigModalDoc(doc.id)} style={{
              background: signedDocs[doc.id] ? '#F5F7FA' : '#0047CC',
              color: signedDocs[doc.id] ? '#6B7A99' : '#fff',
              border: 'none', borderRadius: '8px', padding: '10px 20px',
              fontWeight: 600, fontSize: '13px', cursor: 'pointer', flexShrink: 0
            }}>{signedDocs[doc.id] ? 'Re-sign' : 'E-Sign'}</button>
          </Card>
        ))}
      </div>

      {/* E-Signature Modal */}
      {sigModalDoc && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(26,35,64,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '24px' }}>
          <div style={{ background: '#fff', borderRadius: '16px', padding: '32px', width: '100%', maxWidth: '480px', boxShadow: '0 24px 64px rgba(0,0,0,0.15)' }}>
            <h3 style={{ fontWeight: 800, fontSize: '18px', color: '#1A2340', marginBottom: '4px' }}>Sign Document</h3>
            <p style={{ fontSize: '13px', color: '#6B7A99', marginBottom: '24px' }}>{docs.find(d => d.id === sigModalDoc)?.label}</p>

            <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', background: '#F5F7FA', padding: '4px', borderRadius: '8px' }}>
              {(['type', 'draw'] as const).map(t => (
                <button key={t} onClick={() => setSignatureType(t)} style={{
                  flex: 1, padding: '8px', borderRadius: '6px', border: 'none',
                  background: signatureType === t ? '#0047CC' : 'transparent',
                  color: signatureType === t ? '#fff' : '#6B7A99',
                  fontWeight: 600, fontSize: '13px', cursor: 'pointer', textTransform: 'capitalize'
                }}>{t} Signature</button>
              ))}
            </div>

            {signatureType === 'type' ? (
              <input
                value={typedSig}
                onChange={e => setTypedSig(e.target.value)}
                placeholder="Type your full legal name"
                style={{
                  width: '100%', height: '60px', border: '1px solid #DDE2EC', borderRadius: '8px',
                  padding: '0 16px', fontSize: '22px', fontFamily: 'Georgia, serif', color: '#002B7F',
                  boxSizing: 'border-box', outline: 'none', fontStyle: 'italic'
                }}
              />
            ) : (
              <canvas
                ref={canvasRef} width={416} height={120}
                onMouseDown={startDraw} onMouseMove={draw} onMouseUp={stopDraw} onMouseLeave={stopDraw}
                style={{ border: '1px solid #DDE2EC', borderRadius: '8px', width: '100%', cursor: 'crosshair', display: 'block' }}
              />
            )}

            <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
              <button onClick={() => setSigModalDoc(null)} style={{ flex: 1, height: '42px', border: '1px solid #DDE2EC', borderRadius: '8px', background: 'transparent', color: '#6B7A99', fontWeight: 600, cursor: 'pointer', fontSize: '14px' }}>Cancel</button>
              <button onClick={() => handleSign(sigModalDoc)} style={{ flex: 2, height: '42px', background: '#0047CC', border: 'none', borderRadius: '8px', color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: '14px' }}>Confirm & Sign</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Section 8: Engagement Layer ─────────────────────────────────────────────
const EngagementSection = () => {
  const team = [
    { role: 'Account Officer', name: 'Priya Nair', email: 'priya.nair@kongila.io', avatar: 'P', desc: 'Your primary point of contact for all deployment queries.' },
    { role: 'Team Lead', name: 'Marcus Osei', email: 'marcus.osei@kongila.io', avatar: 'M', desc: 'Oversees your engagement and performance reviews.' },
    { role: 'Support', name: 'Kongila Support', email: 'support@kongila.io', avatar: 'S', desc: 'Raise tickets for technical or operational issues.' },
  ];

  return (
    <div>
      <SectionHeader title="Engagement Layer" subtitle="Your dedicated Kongila team and support contacts." />
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {team.map((member, i) => (
          <Card key={i} style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            <div style={{
              width: '56px', height: '56px', borderRadius: '50%', flexShrink: 0,
              background: 'linear-gradient(135deg, #002B7F, #0047CC)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#fff', fontWeight: 800, fontSize: '20px'
            }}>{member.avatar}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#0047CC', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '2px' }}>{member.role}</div>
              <div style={{ fontWeight: 700, fontSize: '15px', color: '#1A2340' }}>{member.name}</div>
              <div style={{ fontSize: '12px', color: '#6B7A99', marginTop: '2px' }}>{member.desc}</div>
            </div>
            <a href={`mailto:${member.email}`} style={{
              background: '#F5F7FA', border: '1px solid #DDE2EC', borderRadius: '8px',
              padding: '10px 16px', fontSize: '12px', fontWeight: 600, color: '#0047CC',
              textDecoration: 'none', flexShrink: 0
            }}>Contact</a>
          </Card>
        ))}
      </div>
    </div>
  );
};

// ─── Section 9: Onboarding Experience ────────────────────────────────────────
const OnboardingSection = ({ profile }: { profile: any }) => {
  const vettingStatus = profile?.vettingStatus || 'Under Review';
  const progressMap: Record<string, number> = { 'Under Review': 30, 'Pending': 50, 'Vetted': 70, 'Matched': 90, 'Deployed': 100 };
  const progress = progressMap[vettingStatus] ?? 30;

  const steps = [
    { label: 'Account Created', done: true },
    { label: 'Profile Completed', done: progress >= 30 },
    { label: 'Documents Uploaded', done: progress >= 50 },
    { label: 'Vetting Cleared', done: progress >= 70 },
    { label: 'Matched to Client', done: progress >= 90 },
    { label: 'Fully Deployed', done: progress >= 100 },
  ];

  return (
    <div>
      <SectionHeader title="Onboarding Experience" subtitle="Your journey from signup to full deployment." />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
        {/* Welcome video placeholder */}
        <Card style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{
            background: 'linear-gradient(135deg, #002B7F 0%, #0047CC 100%)',
            height: '200px', display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: '12px'
          }}>
            <div style={{
              width: '60px', height: '60px', borderRadius: '50%',
              background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(8px)',
              border: '2px solid rgba(255,255,255,0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '24px', cursor: 'pointer'
            }}>▶</div>
            <span style={{ color: 'rgba(255,255,255,0.8)', fontSize: '13px', fontWeight: 600 }}>Welcome to Kongila</span>
          </div>
          <div style={{ padding: '16px 20px' }}>
            <div style={{ fontWeight: 700, fontSize: '14px', color: '#1A2340' }}>Welcome Video</div>
            <div style={{ fontSize: '12px', color: '#6B7A99', marginTop: '4px' }}>A message from our team to you.</div>
          </div>
        </Card>

        {/* Progress tracker */}
        <Card>
          <h3 style={{ fontWeight: 700, fontSize: '15px', color: '#1A2340', marginBottom: '8px' }}>Onboarding Progress</h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
            <div style={{ flex: 1, height: '8px', background: '#F5F7FA', borderRadius: '4px', overflow: 'hidden' }}>
              <div style={{ width: `${progress}%`, height: '100%', background: 'linear-gradient(90deg, #0047CC, #3D7FFF)', borderRadius: '4px', transition: 'width 0.5s ease' }} />
            </div>
            <span style={{ fontWeight: 800, fontSize: '16px', color: '#0047CC', flexShrink: 0 }}>{progress}%</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {steps.map((step, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  width: '22px', height: '22px', borderRadius: '50%', flexShrink: 0,
                  background: step.done ? '#0047CC' : '#F5F7FA',
                  border: step.done ? '2px solid #0047CC' : '2px solid #DDE2EC',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: step.done ? '#fff' : '#DDE2EC', fontSize: '11px', fontWeight: 700
                }}>{step.done ? '✓' : i + 1}</div>
                <span style={{ fontSize: '13px', color: step.done ? '#1A2340' : '#6B7A99', fontWeight: step.done ? 600 : 400 }}>{step.label}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
};

// ─── Main Dashboard Shell ─────────────────────────────────────────────────────
export default function TalentDashboard({ currentUser, talentProfile, contracts, matches }: TalentDashboardProps) {
  const [activeSection, setActiveSection] = useState<Section>('onboarding');

  const renderSection = () => {
    switch (activeSection) {
      case 'profile':      return <ProfileSection user={currentUser} profile={talentProfile} />;
      case 'professional': return <ProfessionalSection profile={talentProfile} />;
      case 'documents':    return <DocumentsSection profile={talentProfile} />;
      case 'contracts':    return <ContractSection contracts={contracts} profile={talentProfile} />;
      case 'pipeline':     return <PipelineSection profile={talentProfile} />;
      case 'features':     return <FeaturesSection />;
      case 'compliance':   return <ComplianceSection />;
      case 'engagement':   return <EngagementSection />;
      case 'onboarding':   return <OnboardingSection profile={talentProfile} />;
    }
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#F5F7FA', fontFamily: 'var(--font-display, Inter, sans-serif)' }}>

      {/* ── Sidebar ── */}
      <aside style={{
        width: '240px', flexShrink: 0,
        background: '#FFFFFF',
        borderRight: '1px solid #DDE2EC',
        display: 'flex', flexDirection: 'column',
        padding: '24px 12px',
        position: 'sticky', top: 0, height: '100vh', overflowY: 'auto'
      }}>
        {/* User badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '0 8px 20px', borderBottom: '1px solid #F5F7FA', marginBottom: '12px' }}>
          <div style={{
            width: '36px', height: '36px', borderRadius: '50%',
            background: 'linear-gradient(135deg, #0047CC, #3D7FFF)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontWeight: 800, fontSize: '15px', flexShrink: 0
          }}>
            {(currentUser?.name || 'T').charAt(0).toUpperCase()}
          </div>
          <div style={{ overflow: 'hidden' }}>
            <div style={{ fontSize: '13px', fontWeight: 700, color: '#1A2340', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {currentUser?.name || 'Talent User'}
            </div>
            <div style={{ fontSize: '11px', color: '#6B7A99' }}>Talent Portal</div>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ display: 'flex', flexDirection: 'column', gap: '2px', flex: 1 }}>
          {NAV_ITEMS.map(item => {
            const isActive = activeSection === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveSection(item.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '10px',
                  padding: '10px 12px', borderRadius: '8px', border: 'none',
                  background: isActive ? '#EEF3FF' : 'transparent',
                  color: isActive ? '#0047CC' : '#6B7A99',
                  fontWeight: isActive ? 700 : 500,
                  fontSize: '13px', cursor: 'pointer', textAlign: 'left',
                  transition: 'all 0.15s',
                  width: '100%'
                }}
              >
                <span style={{ fontSize: '15px', flexShrink: 0 }}>{item.icon}</span>
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Bottom label */}
        <div style={{ padding: '16px 8px 0', borderTop: '1px solid #F5F7FA', fontSize: '11px', color: '#6B7A99', marginTop: '12px' }}>
          Kongila Talent Portal · v1.0
        </div>
      </aside>

      {/* ── Main Content ── */}
      <main style={{ flex: 1, padding: '40px 48px', overflowY: 'auto' }}>
        {/* Breadcrumb */}
        <div style={{ fontSize: '12px', color: '#6B7A99', marginBottom: '24px' }}>
          Talent Dashboard
          <span style={{ color: '#DDE2EC', margin: '0 8px' }}>›</span>
          <span style={{ color: '#1A2340', fontWeight: 600 }}>
            {NAV_ITEMS.find(n => n.id === activeSection)?.label}
          </span>
        </div>

        {renderSection()}
      </main>
    </div>
  );
}
