import React, { useState, useRef, useEffect } from 'react';

// ─── Types ───────────────────────────────────────────────────────────────────
interface TalentDashboardProps {
  currentUser: any;
  talentProfile: any;
  contracts: any[];
  matches: any[];
  clientRequests?: any[];
  onSignOut?: () => void;
  onUpdateProfile?: (updatedProfile: any) => void;
  onUpdateMatch?: (updatedMatch: any) => void;
}

type Section =
  | 'dashboard'
  | 'calendar'
  | 'contracts'
  | 'pipeline'
  | 'compliance'
  | 'messages'
  | 'profile'
  | 'support'
  | 'settings';

// ─── SVG Navigation Icons Component ──────────────────────────────────────────
const SidebarIcon = ({ id, color = 'currentColor', size = 18 }: { id: string; color?: string; size?: number }) => {
  switch (id) {
    case 'dashboard':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="7" height="9" />
          <rect x="14" y="3" width="7" height="5" />
          <rect x="14" y="12" width="7" height="9" />
          <rect x="3" y="16" width="7" height="5" />
        </svg>
      );
    case 'calendar':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
      );
    case 'contracts':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <path d="m9 15 2 2 4-4" />
        </svg>
      );
    case 'pipeline':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
        </svg>
      );
    case 'compliance':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
      );
    case 'messages':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      );
    case 'profile':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      );
    case 'support':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
      );
    case 'settings':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      );
    case 'logout':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
          <polyline points="16 17 21 12 16 7" />
          <line x1="21" y1="12" x2="9" y2="12" />
        </svg>
      );
    default:
      return null;
  }
};

// ─── Nav Items ────────────────────────────────────────────────────────────────
const NAV_ITEMS: { id: Section; label: string }[] = [
  { id: 'dashboard',    label: 'Dashboard' },
  { id: 'calendar',     label: 'My Calendar' },
  { id: 'contracts',    label: 'Contract System' },
  { id: 'pipeline',     label: 'Role Matching ATS' },
  { id: 'compliance',   label: 'Compliance' },
  { id: 'messages',     label: 'Messages' },
  { id: 'profile',      label: 'Profile Details' },
  { id: 'support',      label: 'Support Center' },
];

// ─── Shared Sub-Components ────────────────────────────────────────────────────
const Card = ({ children, style = {}, onClick }: { children: React.ReactNode; style?: React.CSSProperties; onClick?: () => void }) => (
  <div 
    onClick={onClick}
    style={{
      background: '#FFFFFF',
      border: '1px solid #DDE2EC',
      borderRadius: '12px',
      padding: '24px',
      boxShadow: '0 1px 3px rgba(0,0,0,0.02), 0 8px 24px rgba(0,0,0,0.04)',
      ...style
    }}
  >
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

// ─── Section 1: Dashboard Overview (rendered under "Profile" tab) ───────────────────
const ProfileSection = ({ user, profile, contracts, matches = [], setActiveSection }: { user: any; profile: any; contracts: any[]; matches?: any[]; setActiveSection: (sec: Section) => void }) => {
  const vettingStatus = profile?.vettingStatus || 'Under Review';
  const progressMap: Record<string, number> = { 'Under Review': 32, 'Pending': 55, 'Vetted': 85, 'Matched': 92, 'Deployed': 100 };
  const progress = progressMap[vettingStatus] ?? 32;

  const stages = [
    { id: 'applied', label: 'Applied' },
    { id: 'review', label: 'Review' },
    { id: 'vetted', label: 'Vetted' },
    { id: 'matched', label: 'Matched' },
    { id: 'deployed', label: 'Deployed' }
  ];
  
  const stageMap: Record<string, number> = { 'Under Review': 1, 'Pending': 1, 'Vetted': 2, 'Matched': 3, 'Deployed': 4 };
  const currentStageIdx = stageMap[vettingStatus] ?? 1;

  const skills = profile?.skills || 'Operations Management, Logistics, Process Optimization';
  const skillsArray = Array.isArray(skills) ? skills : skills.split(',').map((s: string) => s.trim());

  // Filter contracts for this talent profile
  const talentContracts = contracts?.filter(
    (c: any) => c.talentId === profile?.id || c.talentName === profile?.name
  ) || [];

  // Get active contract or null if none
  const activeContract = talentContracts.find(c => c.status === 'Active' || c.status === 'Signed') || talentContracts[0] || null;

  // Filter matches and find the next scheduled interview for this talent profile
  const talentMatches = matches?.filter(
    (m: any) => m.talentId === profile?.id || m.talentName === profile?.name
  ) || [];

  const scheduledInterviews = talentMatches.filter(
    (m: any) => m.status === 'Interview Scheduled' && m.requestedDate
  );
  
  const nextInterview = scheduledInterviews[0] || null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
      
      {/* Welcome Banner */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: 800, color: '#1A2340', margin: 0, fontFamily: 'var(--font-display, Inter, sans-serif)' }}>
            Welcome back, {user?.name?.split(' ')[0] || 'Alex'}
          </h1>
          <p style={{ fontSize: '14px', color: '#6B7A99', marginTop: '6px', margin: 0 }}>
            Ready for your next enterprise mission.
          </p>
        </div>
        <div style={{
          display: 'flex', alignItems: 'center', gap: '10px',
          background: '#EEF3FF', padding: '8px 16px', borderRadius: '30px',
          border: '1px solid rgba(0, 71, 204, 0.15)'
        }}>
          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#0047CC' }} />
          <span style={{ fontSize: '13px', fontWeight: 700, color: '#0047CC' }}>
            Current Status: {vettingStatus} - {progress}% Ready
          </span>
        </div>
      </div>

      {/* Pipeline Status Indicator */}
      <Card style={{ padding: '20px 40px' }}>
        <div style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          {/* Progress bar line */}
          <div style={{
            position: 'absolute', top: '16px', left: '40px', right: '40px',
            height: '4px', background: '#E2E8F0', zIndex: 1
          }}>
            <div style={{
              width: `${(currentStageIdx / 4) * 100}%`, height: '100%',
              background: '#0047CC', transition: 'width 0.4s ease'
            }} />
          </div>

          {stages.map((stage, idx) => {
            const isCompleted = idx < currentStageIdx;
            const isActive = idx === currentStageIdx;
            return (
              <div key={stage.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 2, position: 'relative' }}>
                <div style={{
                  width: '32px', height: '32px', borderRadius: '50%',
                  background: isCompleted || isActive ? '#0047CC' : '#FFFFFF',
                  border: isCompleted || isActive ? '2px solid #0047CC' : '2px solid #CBD5E1',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: isCompleted ? '#FFFFFF' : isActive ? '#FFFFFF' : '#64748B',
                  fontWeight: 700, fontSize: '12px',
                  boxShadow: isActive ? '0 0 0 4px rgba(0, 71, 204, 0.2)' : 'none'
                }}>
                  {isCompleted ? '✓' : idx + 1}
                </div>
                <span style={{
                  fontSize: '12px', fontWeight: isCompleted || isActive ? 700 : 500,
                  color: isCompleted || isActive ? '#1A2340' : '#64748B', marginTop: '8px'
                }}>
                  {stage.label}
                </span>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Onboarding Video Card (Horizontal Flex Banner) */}
      <Card style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'row', flexWrap: 'wrap', border: '1px solid #E2E8F0', boxShadow: '0 4px 20px -2px rgba(148, 163, 184, 0.08)' }}>
        <div style={{
          background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
          width: '320px', minHeight: '160px', display: 'flex', alignItems: 'center', justifyContent: 'center',
          position: 'relative', flexShrink: 0
        }}>
          {/* Play Button Overlay */}
          <div style={{
            width: '48px', height: '48px', borderRadius: '50%',
            background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(8px)',
            border: '2px solid rgba(255,255,255,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '20px', cursor: 'pointer', color: '#FFFFFF', zIndex: 2
          }}>▶</div>
          <span style={{ position: 'absolute', bottom: '12px', left: '16px', color: '#FFFFFF', fontSize: '12px', fontWeight: 600 }}>
            Welcome to Kongila
          </span>
        </div>
        <div style={{ padding: '24px', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', minWidth: '280px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <span style={{ fontSize: '15px', fontWeight: 800, color: '#1A2340' }}>Onboarding Journey</span>
            <span style={{ fontSize: '14px', fontWeight: 700, color: '#0047CC' }}>{progress}% Complete</span>
          </div>
          <div style={{ height: '6px', background: '#F1F5F9', borderRadius: '3px', overflow: 'hidden', marginBottom: '16px' }}>
            <div style={{ width: `${progress}%`, height: '100%', background: '#0047CC', borderRadius: '3px' }} />
          </div>
          <span style={{ fontSize: '13px', color: '#6B7A99' }}>
            Next step: <strong style={{ color: '#0047CC' }}>Identity Verification & Legal Signature</strong>
          </span>
        </div>
      </Card>

      {/* Two Column Widget Layout */}
      <div className="db-grid-split-12" style={{}}>
        
        {/* Left Column widgets */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
          
          {/* Legal Compliance */}
          <Card style={{ background: '#1A2340', color: '#FFFFFF', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
              <span style={{ fontSize: '32px' }}>🛡️</span>
              <div>
                <h4 style={{ fontSize: '15px', fontWeight: 700, margin: 0 }}>Legal Compliance</h4>
                <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.7)', margin: '4px 0 0 0', maxWidth: '300px' }}>
                  Your Talent Agreement (2026) is pending electronic signature to finalize deployment.
                </p>
              </div>
            </div>
            <button onClick={() => setActiveSection('compliance')} style={{
              background: '#FFFFFF', color: '#0047CC', border: 'none', borderRadius: '8px',
              padding: '10px 18px', fontSize: '13px', fontWeight: 700, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: '6px'
            }}>
              Sign Document ✍️
            </button>
          </Card>

        </div>

        {/* Right Column widgets */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
          
          {/* Active Contracts */}
          <Card>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#1A2340', margin: 0 }}>Active Contracts</h3>
              {activeContract && (
                <span style={{ background: '#E6FFFA', color: '#00A389', fontSize: '10px', fontWeight: 700, padding: '4px 8px', borderRadius: '4px' }}>
                  LIVE
                </span>
              )}
            </div>

            {activeContract ? (
              <div style={{ border: '1px solid #E2E8F0', borderRadius: '8px', padding: '16px', marginBottom: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <span style={{ fontSize: '14px', fontWeight: 700, color: '#1A2340' }}>{activeContract.employer || activeContract.clientName || 'Horizon Fintech'}</span>
                    <span style={{ fontSize: '12px', color: '#6B7A99', display: 'block', marginTop: '2px' }}>{activeContract.role || activeContract.jobTitle || 'Senior Contractor'}</span>
                  </div>
                  <div style={{ display: 'flex', gap: '2px' }}>
                    {Array.from({ length: 5 }).map((_, i) => (
                      <span key={i} style={{ color: i < (activeContract.rating || 5) ? '#F59E0B' : '#E2E8F0', fontSize: '14px' }}>★</span>
                    ))}
                  </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '16px', borderTop: '1px solid #F1F5F9', paddingTop: '12px' }}>
                  <span style={{ fontSize: '13px', fontWeight: 700, color: '#0047CC' }}>
                    ${(activeContract.salary || activeContract.proposedRate || activeContract.rate || 4500).toLocaleString()}/mo
                  </span>
                  <span style={{ fontSize: '12px', color: '#6B7A99' }}>{activeContract.startDate || activeContract.proposedStartDate || 'Active'}</span>
                </div>
              </div>
            ) : (
              <div style={{ border: '1px solid #E2E8F0', borderRadius: '8px', padding: '24px', marginBottom: '16px', textAlign: 'center', color: '#6B7A99', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '28px' }}>📄</span>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: '#1A2340' }}>No Active Contracts</div>
                  <div style={{ fontSize: '11px', color: '#6B7A99', marginTop: '2px' }}>Your active contracts will appear here once matched.</div>
                </div>
              </div>
            )}

            {/* Next Interview Widget */}
            {nextInterview ? (
              <div style={{ background: '#F4F7FF', border: '1px solid #E8EDFF', borderRadius: '8px', padding: '16px' }}>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '12px' }}>
                  <span style={{ fontSize: '20px' }}>📅</span>
                  <div>
                    <span style={{ fontSize: '12px', fontWeight: 700, color: '#1A2340', display: 'block' }}>Next Scheduled Interview</span>
                    <span style={{ fontSize: '11px', color: '#0047CC', fontWeight: 600, display: 'block', marginTop: '2px' }}>
                      {new Date(nextInterview.requestedDate).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })} at {nextInterview.requestedTime || '10:00 AM'}
                    </span>
                  </div>
                </div>
                <button onClick={() => setActiveSection('calendar')} style={{
                  width: '100%', background: '#0047CC', border: 'none', color: '#FFFFFF',
                  borderRadius: '8px', padding: '10px', fontSize: '12px', fontWeight: 700, cursor: 'pointer'
                }}>
                  Join Video Session
                </button>
              </div>
            ) : (
              <div style={{ background: '#F8FAFC', border: '1px dashed #DDE2EC', borderRadius: '8px', padding: '16px', textAlign: 'center', color: '#6B7A99' }}>
                <span style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>No upcoming interviews</span>
                <span style={{ fontSize: '11px', display: 'block', marginBottom: '8px' }}>Coordinate with hiring clients to schedule screenings.</span>
                <button onClick={() => setActiveSection('calendar')} style={{
                  width: '100%', background: 'transparent', border: '1px solid #0047CC', color: '#0047CC',
                  borderRadius: '8px', padding: '8px', fontSize: '11px', fontWeight: 700, cursor: 'pointer'
                }}>
                  Go to Calendar
                </button>
              </div>
            )}
          </Card>

          {/* Engagement Team */}
          <Card>
            <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#1A2340', marginBottom: '16px', margin: 0 }}>Engagement Team</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {[
                { name: 'Sarah Jenkins', role: 'Account Officer', avatar: 'S' },
                { name: 'Marcus Thorne', role: 'Team Lead', avatar: 'M' }
              ].map((member, idx) => (
                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <div style={{
                      width: '36px', height: '36px', borderRadius: '50%',
                      background: 'linear-gradient(135deg, #002B7F, #0047CC)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: '#fff', fontWeight: 700, fontSize: '13px'
                    }}>{member.avatar}</div>
                    <div>
                      <span style={{ fontSize: '13px', fontWeight: 700, color: '#1A2340', display: 'block' }}>{member.name}</span>
                      <span style={{ fontSize: '11px', color: '#6B7A99' }}>{member.role}</span>
                    </div>
                  </div>
                  <button onClick={() => setActiveSection('messages')} style={{
                    background: 'none', border: 'none', color: '#0047CC', fontSize: '16px', cursor: 'pointer'
                  }}>💬</button>
                </div>
              ))}
            </div>
          </Card>

        </div>

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
      <div className="db-grid-2" style={{}}>
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

// ─── Section 2.5: Calendar & Coordination Section ──────────────────────────────
const CalendarSection = ({ matches = [], clientRequests = [] }: { matches: any[]; clientRequests?: any[] }) => {
  const [calendarCurrentDate, setCalendarCurrentDate] = useState(new Date());
  const [selectedInterview, setSelectedInterview] = useState<any | null>(null);

  const today = new Date();

  // Generate calendar week days from current date
  const getWeekDays = (date: Date) => {
    const currentDay = date.getDay();
    const weekDaysList = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(date);
      d.setDate(date.getDate() - currentDay + i);
      weekDaysList.push(d);
    }
    return weekDaysList;
  };

  const weekDays = getWeekDays(calendarCurrentDate);

  const formatWeekDay = (d: Date) => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return `${days[d.getDay()]} ${d.getDate()}`;
  };

  // Get scheduled interviews from matches where status is 'Interview Scheduled'
  const getInterviewsForDay = (d: Date) => {
    return matches.filter(m => {
      if (m.status !== 'Interview Scheduled' || !m.requestedDate) return false;
      const y = d.getFullYear();
      const monthStr = String(d.getMonth() + 1).padStart(2, '0');
      const dayStr = String(d.getDate()).padStart(2, '0');
      const formattedCal = `${y}-${monthStr}-${dayStr}`;
      
      if (m.requestedDate.includes(formattedCal)) return true;
      
      try {
        const parsed = new Date(m.requestedDate);
        return parsed.toDateString() === d.toDateString();
      } catch (e) {
        return false;
      }
    });
  };

  const getRequestInfo = (requestId: string) => {
    const req = clientRequests?.find((r: any) => r.id === requestId);
    return {
      clientName: req?.clientName || req?.companyName || 'Nexus Health',
      role: req?.roleDescription || req?.title || 'Lead React Architect',
      budget: req?.budget || '$80 - $120 / hr',
      timezone: req?.timezone || 'GMT -5 (EST)',
      commitmentLevel: req?.commitmentLevel || 'Remote / Part-time Retainer'
    };
  };

  const allInterviews = matches.filter(m => m.status === 'Interview Scheduled');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', fontFamily: 'var(--font-display, Inter, sans-serif)' }}>
      
      {/* Header Row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h2 style={{ fontSize: '24px', fontWeight: 800, color: '#1A2340', marginBottom: '6px' }}>My Coordination Calendar</h2>
          <p style={{ fontSize: '14px', color: '#6B7A99', margin: 0 }}>Track and join scheduled video calls, technical screenings, and interviews with hiring clients.</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: '#FFFFFF', padding: '6px 12px', borderRadius: '8px', border: '1px solid #DDE2EC', fontSize: '12px', fontWeight: 600, color: '#0047CC' }}>
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10B981' }} />
          Auto-Synced with Google Calendar
        </div>
      </div>

      {/* Main Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '24px', alignItems: 'start' }}>
        
        {/* Weekly Calendar Widget */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <Card style={{ padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '15px', fontWeight: 800, color: '#1A2340', margin: 0 }}>
                {calendarCurrentDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
              </h3>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  onClick={() => { const d = new Date(calendarCurrentDate); d.setDate(d.getDate() - 7); setCalendarCurrentDate(d); }}
                  style={{ width: '28px', height: '28px', borderRadius: '6px', border: '1px solid #DDE2EC', background: '#FFFFFF', fontWeight: 800, color: '#6B7A99', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >‹</button>
                <button
                  onClick={() => setCalendarCurrentDate(new Date())}
                  style={{ padding: '0 10px', height: '28px', borderRadius: '6px', border: '1px solid #DDE2EC', background: '#FFFFFF', fontWeight: 700, fontSize: '11px', color: '#0047CC', cursor: 'pointer' }}
                >Today</button>
                <button
                  onClick={() => { const d = new Date(calendarCurrentDate); d.setDate(d.getDate() + 7); setCalendarCurrentDate(d); }}
                  style={{ width: '28px', height: '28px', borderRadius: '6px', border: '1px solid #DDE2EC', background: '#FFFFFF', fontWeight: 800, color: '#6B7A99', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >›</button>
              </div>
            </div>

            <div style={{ border: '1px solid #DDE2EC', borderRadius: '10px', overflow: 'hidden' }}>
              {/* Day headers */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: '1px solid #DDE2EC', background: '#F8FAFC' }}>
                {weekDays.map((d, idx) => {
                  const isToday = d.toDateString() === today.toDateString();
                  return (
                    <div key={idx} style={{ padding: '10px 4px', textAlign: 'center', borderRight: idx < 6 ? '1px solid #DDE2EC' : 'none' }}>
                      <span style={{
                        display: 'inline-block', fontSize: '11px', fontWeight: 700,
                        color: isToday ? '#FFFFFF' : '#6B7A99',
                        background: isToday ? '#0047CC' : 'transparent',
                        padding: isToday ? '2px 6px' : '0', borderRadius: isToday ? '4px' : '0'
                      }}>
                        {formatWeekDay(d)}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Calendar grid slots */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', minHeight: '180px', background: '#FFFFFF' }}>
                {weekDays.map((d, idx) => {
                  const dayInterviews = getInterviewsForDay(d);
                  const isToday = d.toDateString() === today.toDateString();
                  return (
                    <div key={idx} style={{
                      borderRight: idx < 6 ? '1px solid #F5F7FA' : 'none',
                      background: isToday ? '#FAFBFF' : 'transparent',
                      padding: '8px 4px',
                      display: 'flex', flexDirection: 'column', gap: '6px'
                    }}>
                      {dayInterviews.map(iv => {
                        const info = getRequestInfo(iv.requestId);
                        return (
                          <div
                            key={iv.id}
                            style={{
                              background: '#EEF3FF',
                              borderLeft: '3px solid #0047CC',
                              borderRadius: '4px', padding: '6px 8px', cursor: 'pointer',
                              boxShadow: '0 2px 4px rgba(0,71,204,0.05)'
                            }}
                            onClick={() => setSelectedInterview(iv)}
                          >
                            <span style={{ fontSize: '9px', fontWeight: 800, color: '#0047CC', display: 'block' }}>{iv.requestedTime}</span>
                            <span style={{ fontSize: '10px', color: '#1A2340', fontWeight: 600, display: 'block', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{info.clientName}</span>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          </Card>
        </div>

        {/* Coordination Details / Panel */}
        <div>
          <Card style={{ padding: '20px', minHeight: '260px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            {selectedInterview ? (
              (() => {
                const info = getRequestInfo(selectedInterview.requestId);
                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ background: '#E6FFFA', color: '#00A389', padding: '3px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase' }}>Confirmed</span>
                      <button onClick={() => setSelectedInterview(null)} style={{ background: 'none', border: 'none', color: '#6B7A99', fontSize: '14px', cursor: 'pointer' }}>✕</button>
                    </div>
                    <div>
                      <h4 style={{ margin: '0 0 4px 0', fontSize: '14px', fontWeight: 800, color: '#1A2340' }}>{info.role}</h4>
                      <span style={{ fontSize: '12px', color: '#0047CC', fontWeight: 700 }}>{info.clientName}</span>
                    </div>
                    <div style={{ fontSize: '12px', color: '#6B7A99', borderTop: '1px solid #F1F5F9', borderBottom: '1px solid #F1F5F9', padding: '10px 0', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <div>🕒 <strong>Date & Time:</strong> {selectedInterview.requestedDate} at {selectedInterview.requestedTime} ({selectedInterview.requestedDuration || '45'} min)</div>
                      <div>💬 <strong>Notes:</strong> {selectedInterview.requestedNotes || 'Google Meet video call with clinical CTO and Vetting lead.'}</div>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                      <button
                        onClick={() => {
                          window.open('https://meet.google.com/kng-vetting-meet', '_blank');
                        }}
                        style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', background: '#0047CC', color: '#FFFFFF', border: 'none', borderRadius: '8px', padding: '10px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="23 7 16 12 23 17 23 7" /><rect x="1" y="5" width="15" height="14" rx="2" ry="2" /></svg>
                        Join Video Call
                      </button>
                    </div>
                  </div>
                );
              })()
            ) : (
              <div style={{ textAlign: 'center', color: '#6B7A99', padding: '20px 0' }}>
                <div style={{ fontSize: '32px', marginBottom: '8px' }}>🗓️</div>
                <p style={{ fontSize: '13px', fontWeight: 600, margin: '0 0 4px 0', color: '#1A2340' }}>Select an Interview</p>
                <p style={{ fontSize: '11px', margin: 0 }}>Click any interview event card in the weekly grid to inspect details and launch direct Google Meet coordination lines.</p>
              </div>
            )}
          </Card>
        </div>

      </div>
    </div>
  );
};

// ─── Section 2.6: Standalone Messages & Inbox Section ───────────────────────────
const MessagesSection = ({ messages = [], setMessages, profile }: { messages: any[]; setMessages?: React.Dispatch<React.SetStateAction<any[]>>; profile: any }) => {
  const [activeThreadId, setActiveThreadId] = useState(1);
  const [replyText, setReplyText] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  const contractorName = profile?.name || 'Chidi Anya';

  const threads = [
    { id: 1, name: 'Amara Anya', role: 'Onboarding Coordinator', status: 'Online', avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&q=80&w=80' },
    { id: 2, name: 'Vetting Officer', role: 'Technical Assessor', status: 'Offline', avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=80' }
  ];

  const activeThread = threads.find(t => t.id === activeThreadId) || threads[0];

  const threadMessages = messages.filter(m => 
    (activeThread.name === 'Amara Anya' && (m.sender === 'Amara Anya' || m.recipient === 'Amara Anya')) ||
    (activeThread.name === 'Vetting Officer' && (m.sender === 'Vetting Officer' || m.recipient === 'Vetting Officer'))
  );

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim() || !setMessages) return;

    const newMsg = {
      id: Date.now(),
      sender: contractorName,
      text: replyText,
      time: 'Just now',
      read: true,
      recipient: activeThread.name
    };

    const updatedMessages = [...messages, newMsg];
    setMessages(updatedMessages);
    setReplyText('');

    // Trigger typing simulation and auto-reply
    setIsTyping(true);
    setTimeout(() => {
      setIsTyping(false);
      let replyStr = '';
      if (activeThread.name === 'Amara Anya') {
        replyStr = `Hi ${contractorName.split(' ')[0]}, thanks for checking in! I've marked your onboarding checklist as completed. Everything is good!`;
      } else {
        replyStr = `Thanks for the message. Your operational assessment is successfully scored (95% Technical). You are fully cleared!`;
      }
      setMessages(prev => [
        ...prev,
        {
          id: Date.now() + 1,
          sender: activeThread.name,
          text: replyStr,
          time: 'Just now',
          read: false
        }
      ]);
    }, 1500);
  };

  return (
    <div style={{ display: 'flex', gap: '24px', height: 'calc(100vh - 140px)', fontFamily: 'var(--font-display, Inter, sans-serif)' }}>
      
      {/* Thread list panel (Left) */}
      <div style={{ width: '280px', display: 'flex', flexDirection: 'column', gap: '16px', flexShrink: 0 }}>
        <Card style={{ padding: '0', display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
          <div style={{ padding: '20px', borderBottom: '1px solid #F5F7FA' }}>
            <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: '#1A2340' }}>Secure Inbox</h3>
            <span style={{ fontSize: '11px', color: '#6B7A99' }}>Encrypted channels with onboarding team</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', overflowY: 'auto', flex: 1, padding: '10px' }}>
            {threads.map(t => {
              const isActive = t.id === activeThreadId;
              const unread = messages.filter(m => m.sender === t.name && !m.read).length;
              return (
                <div
                  key={t.id}
                  onClick={() => setActiveThreadId(t.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '12px',
                    padding: '12px', borderRadius: '8px', cursor: 'pointer',
                    background: isActive ? '#EEF3FF' : 'transparent',
                    transition: 'all 0.15s'
                  }}
                >
                  <div style={{ position: 'relative', width: '36px', height: '36px', flexShrink: 0 }}>
                    <img src={t.avatar} alt={t.name} style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                    <span style={{
                      position: 'absolute', bottom: '0', right: '0', width: '8px', height: '8px', borderRadius: '50%',
                      background: t.status === 'Online' ? '#10B981' : '#6B7A99', border: '2px solid #FFFFFF'
                    }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '12px', fontWeight: 700, color: '#1A2340', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{t.name}</div>
                    <div style={{ fontSize: '10px', color: '#6B7A99', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{t.role}</div>
                  </div>
                  {unread > 0 && (
                    <span style={{ background: '#EF4444', color: '#FFFFFF', fontSize: '9px', fontWeight: 800, width: '16px', height: '16px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {unread}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      {/* Messages panel (Right) */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <Card style={{ padding: '0', display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
          
          {/* Thread Header */}
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #F5F7FA', display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
            <img src={activeThread.avatar} alt={activeThread.name} style={{ width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover' }} />
            <div>
              <div style={{ fontSize: '13px', fontWeight: 800, color: '#1A2340' }}>{activeThread.name}</div>
              <span style={{ fontSize: '11px', color: '#10B981', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: activeThread.status === 'Online' ? '#10B981' : '#6B7A99' }} />
                {activeThread.status === 'Online' ? 'Online' : 'Offline'}
              </span>
            </div>
          </div>

          {/* Messages list */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px', background: '#FAFBFF' }}>
            {threadMessages.map((msg, i) => {
              const isMe = msg.sender === contractorName;
              return (
                <div
                  key={msg.id || i}
                  style={{
                    alignSelf: isMe ? 'flex-end' : 'flex-start',
                    maxWidth: '70%',
                    display: 'flex', flexDirection: 'column',
                    alignItems: isMe ? 'flex-end' : 'flex-start'
                  }}
                >
                  <div style={{
                    background: isMe ? '#0047CC' : '#FFFFFF',
                    color: isMe ? '#FFFFFF' : '#1A2340',
                    border: isMe ? 'none' : '1px solid #DDE2EC',
                    borderRadius: isMe ? '12px 12px 0 12px' : '12px 12px 12px 0',
                    padding: '10px 14px', fontSize: '12px', lineHeight: 1.5
                  }}>
                    {msg.text}
                  </div>
                  <span style={{ fontSize: '9px', color: '#6B7A99', marginTop: '4px' }}>
                    {msg.sender} • {msg.time}
                  </span>
                </div>
              );
            })}
            
            {isTyping && (
              <div style={{ alignSelf: 'flex-start', background: '#FFFFFF', border: '1px solid #DDE2EC', borderRadius: '12px 12px 12px 0', padding: '10px 14px', fontSize: '12px', color: '#6B7A99' }}>
                {activeThread.name} is typing...
              </div>
            )}
          </div>

          {/* Input reply form */}
          <form onSubmit={handleSend} style={{ padding: '16px 20px', borderTop: '1px solid #F5F7FA', display: 'flex', gap: '12px', alignItems: 'center', flexShrink: 0, background: '#FFFFFF' }}>
            <input
              type="text"
              value={replyText}
              onChange={e => setReplyText(e.target.value)}
              placeholder={`Type a secure message to ${activeThread.name}...`}
              style={{
                flex: 1, height: '40px', border: '1px solid #DDE2EC', borderRadius: '8px',
                padding: '0 14px', fontSize: '12px', outline: 'none'
              }}
            />
            <button
              type="submit"
              style={{
                height: '40px', padding: '0 20px', background: '#0047CC', color: '#FFFFFF',
                border: 'none', borderRadius: '8px', fontWeight: 700, fontSize: '12px', cursor: 'pointer'
              }}
            >
              Send Secure
            </button>
          </form>

        </Card>
      </div>

    </div>
  );
};

// ─── Section 3: Documents ─────────────────────────────────────────────────────
const DocumentsSection = ({ profile, onUpdateProfile }: { profile: any; onUpdateProfile?: (updatedProfile: any) => void }) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  
  // Document upload form state
  const [docCategory, setDocCategory] = useState('CV/Resume');
  const [docName, setDocName] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [uploadedFileName, setUploadedFileName] = useState('');

  // Pull documents from profile or fallback to defaults
  const profileDocs = profile?.documents || [
    {
      id: 'doc_chidi_cv',
      name: 'Professional_CV_2024.pdf',
      category: 'Professional (CV, Portfolio)',
      fileSize: '1.2 MB',
      uploadedAt: 'Uploaded 2 days ago',
      status: 'Vetted'
    },
    {
      id: 'doc_chidi_portfolio',
      name: 'UX_Case_Studies.pdf',
      category: 'Professional (CV, Portfolio)',
      fileSize: '18.5 MB',
      uploadedAt: 'Updated 1 week ago',
      status: 'Vetted'
    },
    {
      id: 'doc_chidi_aws',
      name: 'AWS_Devops_cert_Assoc.png',
      category: 'Certifications',
      fileSize: '4.8 MB',
      uploadedAt: 'Verified Jun 2023',
      status: 'Verified',
      certificateImage: 'https://images.unsplash.com/photo-1620712943543-bcc4688e7485?auto=format&fit=crop&q=80&w=150'
    }
  ];

  // Document counting by category
  const counts = {
    all: profileDocs.length,
    identity: profileDocs.filter((d: any) => d.category === 'Identity & Legal').length,
    professional: profileDocs.filter((d: any) => d.category === 'Professional (CV, Portfolio)').length,
    certifications: profileDocs.filter((d: any) => d.category === 'Certifications').length
  };

  // Filter list based on selected tab
  const filteredDocs = profileDocs.filter((d: any) => {
    if (selectedCategory === 'All') return true;
    if (selectedCategory === 'Identity & Legal') return d.category === 'Identity & Legal';
    if (selectedCategory === 'Professional') return d.category === 'Professional (CV, Portfolio)';
    if (selectedCategory === 'Certifications') return d.category === 'Certifications';
    return true;
  });

  // Certifications to show in gallery
  const certDocs = profileDocs.filter((d: any) => d.category === 'Certifications');

  const handleUploadSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!docName.trim()) return;

    // Map user selections to database categories
    let mappedCategory = 'Other';
    if (docCategory === 'CV/Resume' || docCategory === 'Portfolio') {
      mappedCategory = 'Professional (CV, Portfolio)';
    } else if (docCategory === 'Certification') {
      mappedCategory = 'Certifications';
    } else if (docCategory === 'Identity / Government ID') {
      mappedCategory = 'Identity & Legal';
    }

    const newDoc = {
      id: `doc_${Date.now()}`,
      name: docName.toLowerCase().endsWith('.pdf') || docName.toLowerCase().endsWith('.png') || docName.toLowerCase().endsWith('.jpg')
        ? docName 
        : `${docName}.pdf`,
      category: mappedCategory,
      fileSize: '1.2 MB',
      uploadedAt: 'Uploaded just now',
      status: 'Pending',
      certificateImage: docCategory === 'Certification' 
        ? 'https://images.unsplash.com/photo-1546410531-bb4caa6b424d?auto=format&fit=crop&q=80&w=150' 
        : undefined
    };

    const updatedProfile = {
      ...profile,
      documents: [...profileDocs, newDoc]
    };

    if (onUpdateProfile) {
      onUpdateProfile(updatedProfile);
    }

    // Reset modal fields
    setDocName('');
    setUploadedFileName('');
    setUploadModalOpen(false);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px', fontFamily: 'var(--font-display, Inter, sans-serif)' }}>
      
      {/* Page header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <span style={{ fontSize: '14px', color: '#0047CC', fontWeight: 700, display: 'block' }}>Kongila + Remotan</span>
          <h1 style={{ fontSize: '24px', fontWeight: 800, color: '#1A2340', margin: '4px 0 0 0' }}>Professional Documents</h1>
          <p style={{ fontSize: '13px', color: '#6B7A99', margin: '4px 0 0 0' }}>
            Manage your professional credentials, portfolio, and industry certifications to boost your profile visibility.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button style={{
            background: 'transparent', color: '#0047CC', border: '1px solid #0047CC', borderRadius: '8px',
            padding: '10px 18px', fontSize: '13px', fontWeight: 700, cursor: 'pointer'
          }}>
            Version History
          </button>
          <button 
            onClick={() => setUploadModalOpen(true)}
            style={{
              background: '#0047CC', color: '#FFFFFF', border: 'none', borderRadius: '8px',
              padding: '10px 18px', fontSize: '13px', fontWeight: 700, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: '6px'
            }}
          >
            <span>➕</span> Upload New Document
          </button>
        </div>
      </div>

      {/* Guide Banners */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* Banner 1: Document Management Guide */}
        <div style={{ background: '#EEF3FF', borderLeft: '4px solid #0047CC', padding: '16px', borderRadius: '8px', display: 'flex', gap: '12px' }}>
          <div style={{ fontSize: '20px' }}>ℹ️</div>
          <div>
            <h4 style={{ fontSize: '13px', fontWeight: 700, color: '#0047CC', margin: '0 0 4px 0' }}>Document Management Guide</h4>
            <p style={{ fontSize: '12px', color: '#4E5D78', margin: 0, lineHeight: 1.5 }}>
              Use this section to manage your <strong>profile-building documents</strong> such as your CV, Portfolio, and Professional Certifications. Official legal agreements and documents requiring your signature are managed separately in the <span style={{ color: '#0047CC', fontWeight: 600 }}>Compliance</span> tab.
            </p>
          </div>
        </div>

        {/* Banner 2: Complete Your Profile */}
        <div style={{ background: '#EEF3FF', borderLeft: '4px solid #0047CC', padding: '16px', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: '12px' }}>
            <div style={{ fontSize: '20px' }}>🎯</div>
            <div>
              <h4 style={{ fontSize: '13px', fontWeight: 700, color: '#0047CC', margin: '0 0 4px 0' }}>Complete Your Profile</h4>
              <p style={{ fontSize: '12px', color: '#4E5D78', margin: 0 }}>
                Adding your latest professional certifications and updated portfolio increases your chances of being matched with top projects.
              </p>
            </div>
          </div>
          <button 
            onClick={() => setUploadModalOpen(true)}
            style={{
              background: '#0047CC', color: '#FFFFFF', border: 'none', borderRadius: '6px',
              padding: '8px 16px', fontSize: '12px', fontWeight: 700, cursor: 'pointer', flexShrink: 0
            }}
          >
            Update Portfolio
          </button>
        </div>
      </div>

      {/* Main layout (left filter sidebar & middle documents panel) */}
      <div className="db-grid-split-250" style={{ alignItems: 'flex-start' }}>
        
        {/* Left filter panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* Navigation Filter Card */}
          <Card style={{ padding: '12px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {[
                { id: 'All', label: 'All Documents', count: counts.all },
                { id: 'Identity & Legal', label: 'Identity & Legal', count: counts.identity },
                { id: 'Professional', label: 'Professional (CV, Portfolio)', count: counts.professional },
                { id: 'Certifications', label: 'Certifications', count: counts.certifications }
              ].map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    width: '100%', padding: '10px 12px', border: 'none', borderRadius: '6px',
                    cursor: 'pointer', fontSize: '13px', fontWeight: 600,
                    background: selectedCategory === cat.id ? '#0047CC' : 'transparent',
                    color: selectedCategory === cat.id ? '#FFFFFF' : '#4E5D78',
                    transition: 'all 0.15s', textAlign: 'left'
                  }}
                >
                  <span style={{ maxWidth: '170px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cat.label}</span>
                  <span style={{
                    fontSize: '11px', fontWeight: 700, padding: '2px 6px', borderRadius: '10px',
                    background: selectedCategory === cat.id ? 'rgba(255,255,255,0.2)' : '#F1F5F9',
                    color: selectedCategory === cat.id ? '#FFFFFF' : '#6B7A99'
                  }}>{cat.count}</span>
                </button>
              ))}
            </div>
          </Card>

          {/* LEGAL STATUS CARD */}
          <Card style={{ padding: '18px' }}>
            <h4 style={{ fontSize: '11px', fontWeight: 800, color: '#6B7A99', margin: '0 0 16px 0', textTransform: 'uppercase', letterSpacing: '0.05em' }}>LEGAL STATUS</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', fontWeight: 600, color: '#1A2340' }}>Talent Agreement</span>
                <span style={{ fontSize: '10px', fontWeight: 700, color: '#00A389', background: '#E6FFFA', padding: '2px 8px', borderRadius: '4px' }}>ACTIVE</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', fontWeight: 600, color: '#1A2340' }}>Background Check</span>
                <span style={{ fontSize: '10px', fontWeight: 700, color: '#00A389', background: '#E6FFFA', padding: '2px 8px', borderRadius: '4px' }}>COMPLETED</span>
              </div>
            </div>
            
            <div style={{ marginTop: '24px', borderTop: '1px solid #F1F5F9', paddingTop: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: 600, color: '#1A2340', marginBottom: '8px' }}>
                <span>Profile Integrity</span>
                <span style={{ color: '#0047CC', fontWeight: 700 }}>94%</span>
              </div>
              <div style={{ height: '6px', background: '#F1F5F9', borderRadius: '3px', overflow: 'hidden' }}>
                <div style={{ width: '94%', height: '100%', background: '#0047CC', borderRadius: '3px' }} />
              </div>
            </div>
          </Card>

        </div>

        {/* Right main panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* Header filter title */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#1A2340', margin: 0 }}>Recent Documents</h3>
            <div style={{ display: 'flex', gap: '4px' }}>
              <button style={{ background: '#FFFFFF', border: '1px solid #DDE2EC', borderRadius: '6px', padding: '6px 8px', fontSize: '12px', cursor: 'pointer' }}>📁</button>
              <button style={{ background: '#F5F7FA', border: '1px solid #DDE2EC', borderRadius: '6px', padding: '6px 8px', fontSize: '12px', cursor: 'pointer' }}>☰</button>
            </div>
          </div>

          {/* Recent documents grid */}
          <div className="db-grid-3" style={{}}>
            {filteredDocs.map((doc: any, i: number) => {
              // Status Pill details
              let pillBg = '#F1F5F9';
              let pillColor = '#6B7A99';
              if (doc.status === 'Vetted') {
                pillBg = '#E6FFFA';
                pillColor = '#00A389';
              } else if (doc.status === 'Verified') {
                pillBg = '#EEF3FF';
                pillColor = '#0047CC';
              } else if (doc.status === 'Needs Review') {
                pillBg = '#FFF3C4';
                pillColor = '#D97706';
              }

              return (
                <Card key={doc.id || i} style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: '170px', padding: '20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ fontSize: '24px' }}>📄</div>
                    <span style={{
                      background: pillBg, color: pillColor, fontSize: '10px', fontWeight: 700,
                      padding: '4px 8px', borderRadius: '4px', textTransform: 'uppercase'
                    }}>
                      {doc.status}
                    </span>
                  </div>

                  <div style={{ marginTop: '16px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 700, color: '#1A2340', display: 'block', wordBreak: 'break-all' }}>
                      {doc.name}
                    </span>
                    <span style={{ fontSize: '11px', color: '#6B7A99', display: 'block', marginTop: '2px' }}>
                      {doc.uploadedAt} • {doc.fileSize}
                    </span>
                  </div>

                  <div style={{ display: 'flex', gap: '8px', borderTop: '1px solid #F1F5F9', paddingTop: '12px', marginTop: '12px' }}>
                    {doc.status === 'Needs Review' ? (
                      <button style={{
                        width: '100%', background: '#EF4444', color: '#FFFFFF', border: 'none', borderRadius: '6px',
                        padding: '6px 12px', fontSize: '12px', fontWeight: 700, cursor: 'pointer'
                      }}>
                        Sign Now
                      </button>
                    ) : (
                      <>
                        <button style={{
                          flex: 1, background: '#FFFFFF', border: '1px solid #DDE2EC', borderRadius: '6px',
                          padding: '6px 12px', fontSize: '12px', fontWeight: 600, color: '#4E5D78', cursor: 'pointer'
                        }}>
                          View
                        </button>
                        <button style={{
                          background: '#FFFFFF', border: '1px solid #DDE2EC', borderRadius: '6px',
                          padding: '6px 8px', fontSize: '12px', cursor: 'pointer', color: '#4E5D78'
                        }}>
                          📥
                        </button>
                      </>
                    )}
                  </div>
                </Card>
              );
            })}

            {filteredDocs.length === 0 && (
              <div className="grid-span-full" style={{ padding: '32px 0', textAlign: 'center', color: '#6B7A99', fontSize: '13px' }}>
                No documents found in this category.
              </div>
            )}
          </div>

          {/* Certifications gallery bottom section */}
          <div style={{ borderTop: '1px solid #E2E8F0', paddingTop: '28px', marginTop: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '15px', fontWeight: 800, color: '#1A2340', margin: 0 }}>Professional Certifications</h3>
              <button style={{ background: 'none', border: 'none', color: '#0047CC', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>
                View All
              </button>
            </div>

            <div className="db-grid-4" style={{}}>
              {certDocs.map((cert: any, i: number) => (
                <Card key={cert.id || i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '20px 12px' }}>
                  <div style={{
                    width: '64px', height: '64px', borderRadius: '50%', overflow: 'hidden',
                    background: '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center'
                  }}>
                    {cert.certificateImage ? (
                      <img src={cert.certificateImage} alt="Certificate badge" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <span style={{ fontSize: '24px' }}>🏆</span>
                    )}
                  </div>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: '#1A2340', marginTop: '12px', display: 'block', height: '32px', overflow: 'hidden' }}>
                    {cert.name.replace('.pdf', '').replace('.png', '').replace('.jpg', '')}
                  </span>
                  <span style={{ fontSize: '10px', color: '#0047CC', background: '#EEF3FF', padding: '2px 6px', borderRadius: '4px', marginTop: '8px', fontWeight: 700 }}>
                    VERIFIED
                  </span>
                </Card>
              ))}

              {/* Dotted certificate upload button */}
              <Card 
                onClick={() => {
                  setDocCategory('Certification');
                  setUploadModalOpen(true);
                }}
                style={{
                  border: '2px dashed #DDE2EC', background: '#FAFBFF', display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '20px 12px',
                  cursor: 'pointer', minHeight: '150px'
                }}
              >
                <div style={{ fontSize: '22px', color: '#6B7A99', marginBottom: '8px' }}>➕</div>
                <span style={{ fontSize: '12px', fontWeight: 600, color: '#6B7A99', display: 'block' }}>
                  Add Certificate
                </span>
                <span style={{ fontSize: '10px', color: '#6B7A99', marginTop: '4px' }}>
                  Max files 10MB
                </span>
              </Card>
            </div>
          </div>

        </div>

      </div>

      {/* UPLOAD DOCUMENT OVERLAY MODAL */}
      {uploadModalOpen && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(26, 35, 64, 0.6)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 999
        }}>
          <div style={{
            background: '#FFFFFF', borderRadius: '12px', width: '90%', maxWidth: '480px',
            padding: '28px', border: '1px solid #E2E8F0', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)'
          }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#1A2340', margin: 0 }}>Upload New Document</h3>
              <button 
                onClick={() => setUploadModalOpen(false)}
                style={{ background: 'none', border: 'none', fontSize: '16px', fontWeight: 700, cursor: 'pointer', color: '#6B7A99' }}
              >
                ✕
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleUploadSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Category */}
              <div>
                <label style={{ fontSize: '11px', fontWeight: 700, color: '#6B7A99', display: 'block', marginBottom: '6px' }}>
                  Document Category
                </label>
                <select
                  value={docCategory}
                  onChange={e => setDocCategory(e.target.value)}
                  style={{
                    width: '100%', height: '40px', border: '1px solid #DDE2EC', borderRadius: '8px',
                    padding: '0 12px', fontSize: '13px', outline: 'none', background: '#FFFFFF'
                  }}
                >
                  <option value="CV/Resume">CV/Resume</option>
                  <option value="Portfolio">Portfolio</option>
                  <option value="Certification">Certification</option>
                  <option value="Identity / Government ID">Identity / Government ID</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              {/* Name */}
              <div>
                <label style={{ fontSize: '11px', fontWeight: 700, color: '#6B7A99', display: 'block', marginBottom: '6px' }}>
                  Document Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. AWS Certified Solutions Architect"
                  value={docName}
                  onChange={e => setDocName(e.target.value)}
                  required
                  style={{
                    width: '100%', height: '40px', border: '1px solid #DDE2EC', borderRadius: '8px',
                    padding: '0 12px', fontSize: '13px', outline: 'none'
                  }}
                />
              </div>

              {/* Drag and Drop Area */}
              <div>
                <div
                  onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={e => {
                    e.preventDefault();
                    setDragOver(false);
                    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                      setUploadedFileName(e.dataTransfer.files[0].name);
                      if (!docName) {
                        setDocName(e.dataTransfer.files[0].name);
                      }
                    }
                  }}
                  style={{
                    border: dragOver ? '2px dashed #0047CC' : '2px dashed #DDE2EC',
                    background: dragOver ? '#EEF3FF' : '#FAFBFF',
                    borderRadius: '8px', padding: '32px 16px', textAlign: 'center', cursor: 'pointer'
                  }}
                  onClick={() => {
                    // Simulate file selection
                    const mockNames: Record<string, string> = {
                      'CV/Resume': 'Talent_Resume_2026.pdf',
                      'Portfolio': 'Design_Case_Studies.pdf',
                      'Certification': 'Scrum_Master_Cert.png',
                      'Identity / Government ID': 'Government_ID_Card.png',
                      'Other': 'Support_Document.pdf'
                    };
                    const name = mockNames[docCategory] || 'Document_File.pdf';
                    setUploadedFileName(name);
                    if (!docName) {
                      setDocName(name.replace(/\.[^/.]+$/, ''));
                    }
                  }}
                >
                  <div style={{ fontSize: '32px', marginBottom: '8px' }}>☁️</div>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: '#1A2340', display: 'block' }}>
                    {uploadedFileName ? (
                      <span style={{ color: '#00A389' }}>✓ File Chosen: {uploadedFileName}</span>
                    ) : (
                      <>Drag and drop your file here or <span style={{ color: '#0047CC', textDecoration: 'underline' }}>Browse Files</span></>
                    )}
                  </span>
                  <span style={{ fontSize: '11px', color: '#6B7A99', marginTop: '4px', display: 'block' }}>
                    Max 25MB, supported formats PDF, PNG, JPG
                  </span>
                </div>
              </div>

              {/* Compliance Warning banner */}
              <div style={{ background: '#EEF3FF', padding: '12px', borderRadius: '6px', display: 'flex', gap: '10px' }}>
                <span style={{ fontSize: '14px' }}>ℹ️</span>
                <p style={{ fontSize: '11px', color: '#4E5D78', margin: 0, lineHeight: 1.4 }}>
                  Looking for official agreements? Please visit the <span style={{ color: '#0047CC', fontWeight: 600 }}>Compliance</span> tab in the sidebar to view and sign legally-binding contracts.
                </p>
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '12px' }}>
                <button
                  type="button"
                  onClick={() => setUploadModalOpen(false)}
                  style={{
                    background: 'transparent', border: 'none', color: '#6B7A99', fontSize: '13px',
                    fontWeight: 700, cursor: 'pointer', padding: '8px 16px'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{
                    background: '#0047CC', color: '#FFFFFF', border: 'none', borderRadius: '8px',
                    padding: '10px 20px', fontSize: '13px', fontWeight: 700, cursor: 'pointer'
                  }}
                >
                  Upload Document
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
};

// ─── Section 4: Contract System ───────────────────────────────────────────────
const ContractSection = ({ contracts, profile }: { contracts: any[]; profile: any }) => {
  const [historyFilter, setHistoryFilter] = useState<'All' | 'Active' | 'Open' | 'Closed'>('All');
  const [searchQuery, setSearchQuery] = useState('');

  // Filter contracts for this talent profile
  const talentContracts = contracts.filter(
    (c: any) => c.talentId === profile?.id || c.talentName === profile?.name
  );

  const activeEngagements = talentContracts.filter(
    (c: any) => c.status === 'Signed' || c.status === 'Active'
  );

  const [selectedContractId, setSelectedContractId] = useState<string | null>(null);
  const [rateReviewModalOpen, setRateReviewModalOpen] = useState(false);
  const [archivesVaultOpen, setArchivesVaultOpen] = useState(false);
  
  // Rate Review state fields
  const [proposedRate, setProposedRate] = useState('');
  const [proposedRateType, setProposedRateType] = useState<'Hourly' | 'Monthly'>('Hourly');
  const [effectiveDate, setEffectiveDate] = useState('');
  const [justification, setJustification] = useState('');
  
  // Local storage persisted Rate Reviews collection
  const [rateReviews, setRateReviews] = useState<any[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('kongila_rate_reviews');
      return saved ? JSON.parse(saved) : [];
    }
    return [];
  });
  
  const saveRateReviews = (newReviews: any[]) => {
    setRateReviews(newReviews);
    if (typeof window !== 'undefined') {
      localStorage.setItem('kongila_rate_reviews', JSON.stringify(newReviews));
    }
  };

  // Archive search and filters
  const [archiveSearchQuery, setArchiveSearchQuery] = useState('');
  const [archiveStatusFilter, setArchiveStatusFilter] = useState<'All' | 'Active' | 'Closed'>('All');
  const [selectedArchiveContract, setSelectedArchiveContract] = useState<any | null>(null);

  // Identify active contract or return null if none
  const activeContract = talentContracts.find(c => c.id === selectedContractId) ||
                         talentContracts.find(c => c.status === 'Signed' || c.status === 'Active') ||
                         talentContracts[0] || null;

  // Billing display (hourly or monthly depending on choice when hired)
  const isHourly = activeContract ? activeContract.rateType === 'Hourly' : false;
  const rateDisplay = activeContract 
    ? (isHourly 
      ? `$${(activeContract.rateAmount || 120).toFixed(2)} / hr`
      : `$${(activeContract.salary || activeContract.rateAmount || 4500).toLocaleString()} / mo`)
    : '';

  // History list (contains active contracts + historical contracts)
  const historyList = talentContracts;

  // Filtering logic
  const filteredHistory = historyList.filter((c: any) => {
    // Search filter
    const matchesSearch = 
      c.role?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.clientName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.id?.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    // Status filter
    if (historyFilter === 'All') return true;
    if (historyFilter === 'Active') return c.status === 'Signed' || c.status === 'Active';
    if (historyFilter === 'Open') return c.status === 'Pending';
    if (historyFilter === 'Closed') return c.status === 'Closed' || c.status === 'Expired';
    return true;
  });

  // Check for pending rate reviews on the active contract
  const pendingReview = activeContract ? rateReviews.find((r: any) => r.contractId === activeContract.id && r.status === 'Pending') : null;

  // Submit Rate Review
  const handleRateReviewSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeContract) return;
    const newRequest = {
      id: `REV-${Date.now().toString().slice(-4)}`,
      contractId: activeContract.id,
      clientName: activeContract.clientName || activeContract.employer,
      currentRate: isHourly ? activeContract.rateAmount : activeContract.salary,
      currentRateType: activeContract.rateType,
      proposedRate: Number(proposedRate),
      rateType: proposedRateType,
      justification,
      effectiveDate,
      status: 'Pending',
      requestedAt: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    };
    const updated = [newRequest, ...rateReviews];
    saveRateReviews(updated);
    
    // Reset forms & close
    setProposedRate('');
    setJustification('');
    setRateReviewModalOpen(false);
    
    alert(`Success! Rate review request submitted to ${activeContract.clientName || activeContract.employer} for ID: ${activeContract.id}.`);
  };

  const signedAgreements = (profile?.documents || []).filter(
    (d: any) => d.status === 'signed' || d.type === 'agreement'
  );

  const docTemplates = signedAgreements.length > 0 
    ? signedAgreements.map((d: any) => ({ name: d.name, type: `PDF • ${d.status === 'signed' ? 'Signed' : 'Verified'}` }))
    : [
      { name: 'Master Talent Agreement (Pending)', type: 'PDF • Unsigned' },
      { name: 'Mutual NDA Agreement (Pending)', type: 'PDF • Unsigned' }
    ];

  if (!activeContract) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', padding: '48px', background: '#FFFFFF', borderRadius: '16px', border: '1px solid #E2E8F0', textAlign: 'center', color: '#6B7A99', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontSize: '56px', marginBottom: '16px' }}>📄</span>
        <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#1A2340', margin: '0 0 8px 0' }}>No Active Contracts Found</h2>
        <p style={{ fontSize: '14px', color: '#6B7A99', maxWidth: '420px', margin: '0 0 0 0', lineHeight: 1.5 }}>
          You do not have any active or signed employment agreements under your Kongila account yet. Contracts and payouts will appear here in real time once matched and deployed by clients.
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px', fontFamily: 'var(--font-display, Inter, sans-serif)' }}>
      
      {/* active contract details header breadcrumb/sub */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: '14px', color: '#0047CC', fontWeight: 700 }}>
          Kongila + Remotan / Contract System
        </div>
      </div>

      {/* ACTIVE ENGAGEMENTS SWITCHER */}
      {activeEngagements.length > 1 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{
              background: '#EEF3FF', color: '#0047CC', fontSize: '11px', fontWeight: 850,
              padding: '4px 10px', borderRadius: '12px', letterSpacing: '0.05em', textTransform: 'uppercase'
            }}>
              {activeEngagements.length} Active Engagements
            </span>
            <span style={{ fontSize: '12px', color: '#6B7A99', fontWeight: 600 }}>
              Select an engagement to view details, financial ledgers, or request compensation reviews.
            </span>
          </div>
          
          <div className="db-grid-2" style={{ gap: '16px' }}>
            {activeEngagements.map((eng: any) => {
              const isSelected = activeContract.id === eng.id;
              const engRate = eng.rateType === 'Hourly'
                ? `$${(eng.rateAmount || 120).toFixed(2)} / hr`
                : `$${(eng.salary || eng.rateAmount || 4500).toLocaleString()} / mo`;
              return (
                <div
                  key={eng.id}
                  onClick={() => setSelectedContractId(eng.id)}
                  style={{
                    background: '#FFFFFF',
                    border: isSelected ? '2px solid #0047CC' : '1px solid #E2E8F0',
                    borderRadius: '12px',
                    padding: '16px 20px',
                    cursor: 'pointer',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    boxShadow: isSelected ? '0 10px 25px -5px rgba(0, 71, 204, 0.08), 0 8px 10px -6px rgba(0, 71, 204, 0.08)' : '0 1px 3px 0 rgba(0, 0, 0, 0.05)',
                    transition: 'all 0.2s ease-in-out',
                    transform: isSelected ? 'translateY(-2px)' : 'none'
                  }}
                >
                  <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
                    <div style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '8px',
                      background: isSelected ? '#0047CC' : '#F5F7FA',
                      color: isSelected ? '#FFFFFF' : '#0047CC',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 800,
                      fontSize: '16px'
                    }}>
                      {eng.clientName?.charAt(0) || 'C'}
                    </div>
                    <div>
                      <span style={{ fontSize: '11px', color: '#6B7A99', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        ID: {eng.id}
                      </span>
                      <h4 style={{ fontSize: '14px', fontWeight: 800, color: '#1A2340', margin: '2px 0 0 0' }}>
                        {eng.role}
                      </h4>
                      <span style={{ fontSize: '12px', color: '#0047CC', fontWeight: 600 }}>
                        {eng.clientName}
                      </span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'end', gap: '4px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 800, color: '#1A2340' }}>
                      {engRate}
                    </span>
                    <span style={{
                      background: '#E6FFFA',
                      color: '#00A389',
                      fontSize: '10px',
                      fontWeight: 800,
                      padding: '2px 6px',
                      borderRadius: '4px',
                      textTransform: 'uppercase'
                    }}>
                      Active
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* PENDING RATE REVIEW NOTIFICATION BANNER */}
      {pendingReview && (
        <div style={{
          background: '#FFFBEB',
          border: '1px solid #FCD34D',
          borderRadius: '12px',
          padding: '16px 20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
        }}>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <span style={{ fontSize: '20px' }}>⚠️</span>
            <div>
              <h4 style={{ fontSize: '14px', fontWeight: 800, color: '#92400E', margin: 0 }}>
                Rate Review Request Pending
              </h4>
              <p style={{ fontSize: '12px', color: '#B45309', margin: '4px 0 0 0', fontWeight: 550, lineHeight: 1.4 }}>
                You requested a rate adjustment to <strong style={{ fontWeight: 700 }}>${pendingReview.proposedRate.toLocaleString()} / {pendingReview.rateType === 'Hourly' ? 'hr' : 'mo'}</strong> on {pendingReview.requestedAt}. 
                Reason: "{pendingReview.justification.slice(0, 100)}{pendingReview.justification.length > 100 ? '...' : ''}"
              </p>
            </div>
          </div>
          <span style={{
            background: '#FCD34D',
            color: '#78350F',
            fontSize: '10px',
            fontWeight: 800,
            padding: '4px 10px',
            borderRadius: '12px',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            whiteSpace: 'nowrap'
          }}>
            In Review
          </span>
        </div>
      )}

      {/* ACTIVE CONTRACT CARD */}
      <Card style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '24px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <span style={{ fontSize: '11px', fontWeight: 800, color: '#0047CC', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
              ACTIVE CONTRACT • ID: {activeContract.id}
            </span>
            <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#1A2340', margin: '4px 0 0 0' }}>
              {activeContract.role} @ <span style={{ color: '#0047CC' }}>{activeContract.clientName}</span>
            </h2>
          </div>

          <div style={{ display: 'flex', gap: '40px', flexWrap: 'wrap' }}>
            <div>
              <span style={{ fontSize: '11px', color: '#6B7A99', display: 'block', fontWeight: 600 }}>START DATE</span>
              <span style={{ fontSize: '14px', fontWeight: 700, color: '#1A2340', marginTop: '2px', display: 'block' }}>{activeContract.startDate}</span>
            </div>
            <div>
              <span style={{ fontSize: '11px', color: '#6B7A99', display: 'block', fontWeight: 600 }}>PROJECTED END DATE</span>
              <span style={{ fontSize: '14px', fontWeight: 700, color: '#1A2340', marginTop: '2px', display: 'block' }}>{activeContract.endDate || 'Dec 21, 2024'}</span>
            </div>
            <div>
              <span style={{ fontSize: '11px', color: '#6B7A99', display: 'block', fontWeight: 600 }}>ENGAGEMENT MODEL</span>
              <span style={{ fontSize: '14px', fontWeight: 700, color: '#1A2340', marginTop: '2px', display: 'block' }}>{activeContract.engagementModel || 'Remote / Full-time Retainer'}</span>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', minWidth: '180px' }}>
          <button 
            onClick={() => alert(`Downloading verified Contract PDF for ID: ${activeContract.id}...`)}
            style={{
              background: '#0047CC', color: '#FFFFFF', border: 'none', borderRadius: '8px',
              padding: '12px 20px', fontSize: '13px', fontWeight: 700, cursor: 'pointer',
              transition: 'background 0.2s'
            }}
          >
            Download Contract PDF
          </button>
          <button 
            onClick={() => setRateReviewModalOpen(true)}
            style={{
              background: 'transparent', color: '#0047CC', border: '1px solid #0047CC', borderRadius: '8px',
              padding: '12px 20px', fontSize: '13px', fontWeight: 700, cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            Request Rate Review
          </button>
        </div>
      </Card>

      {/* THREE WIDGETS ROW */}
      <div className="db-grid-3" style={{}}>
        
        {/* Earnings Overview */}
        <Card style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '24px' }}>
          <div>
            <span style={{ fontSize: '11px', color: '#6B7A99', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>EARNINGS OVERVIEW</span>
            <div style={{ fontSize: '24px', fontWeight: 800, color: '#0047CC', marginTop: '12px' }}>
              {rateDisplay}
            </div>
          </div>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #F1F5F9', paddingTop: '16px', marginTop: '20px' }}>
            <div>
              <span style={{ fontSize: '11px', color: '#6B7A99', display: 'block' }}>TOTAL EARNED</span>
              <span style={{ fontSize: '14px', fontWeight: 800, color: '#1A2340', marginTop: '2px', display: 'block' }}>
                ${(activeContract.totalEarned || 54240).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
            <div>
              <span style={{ fontSize: '11px', color: '#6B7A99', display: 'block' }}>INVOICED BALANCE</span>
              <span style={{
                background: '#EEF3FF', color: '#0047CC', fontSize: '12px', fontWeight: 700,
                padding: '4px 8px', borderRadius: '6px', display: 'inline-block', marginTop: '4px'
              }}>
                ${(activeContract.invoicedBalance || 12450).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        </Card>

        {/* Next Payout Card */}
        <Card style={{ background: '#0047CC', color: '#FFFFFF', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '24px' }}>
          <div>
            <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.7)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>NEXT PAYOUT</span>
            <div style={{ fontSize: '28px', fontWeight: 800, color: '#FFFFFF', marginTop: '12px' }}>
              ${(activeContract.nextPayout || 6400).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>

          <div style={{ borderTop: '1px solid rgba(255,255,255,0.15)', paddingTop: '16px', marginTop: '20px' }}>
            <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.7)', display: 'block', fontWeight: 600 }}>PAYMENT SCHEDULED</span>
            <span style={{ fontSize: '13px', fontWeight: 700, color: '#FFFFFF', marginTop: '2px', display: 'block' }}>
              {activeContract.nextPayoutDate || 'Friday, May 24'}
            </span>
          </div>
        </Card>

        {/* Performance Metrics */}
        <Card style={{ padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div>
              <span style={{ fontSize: '11px', color: '#6B7A99', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>PERFORMANCE METRICS</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                <span style={{ fontSize: '16px', fontWeight: 800, color: '#1A2340' }}>{(activeContract.rating || 5.0).toFixed(1)}</span>
                <span style={{ fontSize: '11px', color: '#6B7A99' }}>Overall Rating</span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '2px' }}>
              {Array.from({ length: 5 }).map((_, i) => (
                <span key={i} style={{ color: i < (activeContract.rating || 5) ? '#F59E0B' : '#E2E8F0', fontSize: '14px' }}>★</span>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {[
              { label: 'Quality of Work', val: activeContract.qualityOfWork || 4.9 },
              { label: 'Communication', val: activeContract.communication || 4.8 },
              { label: 'Timeliness', val: activeContract.timeliness || 4.9 }
            ].map((metric, i) => (
              <div key={i}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#6B7A99', marginBottom: '4px' }}>
                  <span>{metric.label}</span>
                  <span style={{ fontWeight: 700 }}>{metric.val.toFixed(1)}/5.0</span>
                </div>
                <div style={{ height: '6px', background: '#F1F5F9', borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{ width: `${(metric.val / 5) * 100}%`, height: '100%', background: '#0047CC', borderRadius: '3px' }} />
                </div>
              </div>
            ))}
          </div>
        </Card>

      </div>

      {/* TEAM AND DOCUMENTS ROW */}
      <div className="db-grid-split-12-20" style={{}}>
        
        {/* Engagement Team */}
        <Card style={{ padding: '24px' }}>
          <h3 style={{ fontSize: '15px', fontWeight: 800, color: '#1A2340', margin: '0 0 20px 0' }}>ENGAGEMENT TEAM</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            {[
              { name: 'Sarah Jenkins', role: 'Lead Account Officer', avatar: 'S' },
              { name: 'David Chen', role: 'Contract Specialist', avatar: 'D' }
            ].map((member, idx) => (
              <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                  <div style={{
                    width: '38px', height: '38px', borderRadius: '50%',
                    background: 'linear-gradient(135deg, #002B7F, #0047CC)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#FFFFFF', fontWeight: 700, fontSize: '14px'
                  }}>{member.avatar}</div>
                  <div>
                    <span style={{ fontSize: '13px', fontWeight: 700, color: '#1A2340', display: 'block' }}>{member.name}</span>
                    <span style={{ fontSize: '11px', color: '#6B7A99' }}>{member.role}</span>
                  </div>
                </div>
                <button 
                  onClick={() => alert(`Direct chat session initialized with ${member.name}.`)}
                  style={{
                    background: '#F5F7FA', border: '1px solid #DDE2EC', borderRadius: '6px',
                    padding: '6px 12px', fontSize: '12px', fontWeight: 600, color: '#0047CC', cursor: 'pointer'
                  }}
                >
                  Message
                </button>
              </div>
            ))}
          </div>
        </Card>

        {/* Contract Documents */}
        <Card style={{ padding: '24px' }}>
          <h3 style={{ fontSize: '15px', fontWeight: 800, color: '#1A2340', margin: '0 0 20px 0' }}>CONTRACT DOCUMENTS</h3>
          <div className="db-grid-2" style={{}}>
            {docTemplates.map((doc: any, i: number) => (
              <div key={i} style={{
                border: '1px solid #E2E8F0', borderRadius: '8px', padding: '12px 16px',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center'
              }}>
                <div>
                  <span style={{ fontSize: '13px', fontWeight: 700, color: '#1A2340', display: 'block' }}>{doc.name}</span>
                  <span style={{ fontSize: '11px', color: '#6B7A99', display: 'block', marginTop: '2px' }}>{doc.type}</span>
                </div>
                <button 
                  onClick={() => alert(`Opening compliance file viewer for ${doc.name}...`)}
                  style={{ background: 'none', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#0047CC' }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        </Card>

      </div>

      {/* CONTRACT HISTORY TABLE */}
      <Card style={{ padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#1A2340', margin: 0 }}>Contract History</h3>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <input
              type="text"
              placeholder="Search history..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{
                height: '36px', border: '1px solid #DDE2EC', borderRadius: '8px',
                padding: '0 12px', fontSize: '12px', outline: 'none', width: '180px'
              }}
            />
          </div>
        </div>

        {/* Categories / Filter tabs */}
        <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid #F1F5F9', paddingBottom: '12px', marginBottom: '16px' }}>
          {(['All', 'Active', 'Open', 'Closed'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setHistoryFilter(tab)}
              style={{
                background: 'transparent', border: 'none', cursor: 'pointer',
                fontSize: '13px', fontWeight: historyFilter === tab ? 700 : 500,
                color: historyFilter === tab ? '#0047CC' : '#6B7A99',
                borderBottom: historyFilter === tab ? '2px solid #0047CC' : 'none',
                padding: '4px 12px 10px 12px',
                marginBottom: '-14px',
                transition: 'all 0.15s'
              }}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Table representation */}
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #F1F5F9' }}>
                <th style={{ padding: '12px 8px', fontSize: '11px', fontWeight: 700, color: '#6B7A99', textTransform: 'uppercase' }}>Role</th>
                <th style={{ padding: '12px 8px', fontSize: '11px', fontWeight: 700, color: '#6B7A99', textTransform: 'uppercase' }}>Company</th>
                <th style={{ padding: '12px 8px', fontSize: '11px', fontWeight: 700, color: '#6B7A99', textTransform: 'uppercase' }}>Period</th>
                <th style={{ padding: '12px 8px', fontSize: '11px', fontWeight: 700, color: '#6B7A99', textTransform: 'uppercase' }}>Status</th>
                <th style={{ padding: '12px 8px', fontSize: '11px', fontWeight: 700, color: '#6B7A99', textTransform: 'uppercase' }}>Final Rating</th>
              </tr>
            </thead>
            <tbody>
              {filteredHistory.map((item: any, idx: number) => (
                <tr key={idx} style={{ borderBottom: '1px solid #F8FAFC' }}>
                  <td style={{ padding: '14px 8px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 700, color: '#1A2340', display: 'block' }}>{item.role}</span>
                    <span style={{ fontSize: '10px', color: '#6B7A99' }}>Contract {item.id}</span>
                  </td>
                  <td style={{ padding: '14px 8px', fontSize: '13px', color: '#1A2340', fontWeight: 600 }}>{item.clientName || item.employer}</td>
                  <td style={{ padding: '14px 8px', fontSize: '12px', color: '#6B7A99' }}>
                    {item.startDate} - {item.endDate?.includes('202') ? item.endDate : 'Dec 2023'}
                  </td>
                  <td style={{ padding: '14px 8px' }}>
                    <span style={{
                      background: item.status === 'Signed' || item.status === 'Active' ? '#E6FFFA' : '#F1F5F9',
                      color: item.status === 'Signed' || item.status === 'Active' ? '#00A389' : '#64748B',
                      fontSize: '10px', fontWeight: 700, padding: '4px 8px', borderRadius: '4px', textTransform: 'uppercase'
                    }}>
                      {item.status === 'Signed' ? 'Active' : item.status}
                    </span>
                  </td>
                  <td style={{ padding: '14px 8px' }}>
                    <div style={{ display: 'flex', gap: '2px' }}>
                      {Array.from({ length: 5 }).map((_, i) => (
                        <span key={i} style={{ color: i < (item.rating || 5) ? '#F59E0B' : '#E2E8F0', fontSize: '12px' }}>★</span>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
              {filteredHistory.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ padding: '24px 8px', textAlign: 'center', color: '#6B7A99', fontSize: '13px' }}>
                    No contracts match your search parameters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', marginTop: '20px' }}>
          <button 
            onClick={() => setArchivesVaultOpen(true)}
            style={{ background: 'none', border: 'none', color: '#0047CC', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}
          >
            Show Full Archives
          </button>
        </div>
      </Card>


      {/* ─── RATE REVIEW MODAL ────────────────────────────────────── */}
      {rateReviewModalOpen && (
        <div
          onClick={() => setRateReviewModalOpen(false)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(10,20,50,0.55)',
            backdropFilter: 'blur(4px)', zIndex: 1000,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '20px'
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: '#FFFFFF', borderRadius: '16px', width: '100%', maxWidth: '520px',
              boxShadow: '0 24px 60px rgba(0,0,0,0.18)', overflow: 'hidden'
            }}
          >
            {/* Modal header */}
            <div style={{ background: 'linear-gradient(135deg, #002B7F, #0047CC)', padding: '24px 28px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ color: '#FFFFFF', fontSize: '18px', fontWeight: 800, margin: 0 }}>Request Rate Review</h3>
                <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '13px', margin: '4px 0 0 0' }}>
                  Contract {activeContract.id} · {activeContract.clientName}
                </p>
              </div>
              <button
                onClick={() => setRateReviewModalOpen(false)}
                style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: '8px', color: '#fff', width: '32px', height: '32px', fontSize: '18px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >×</button>
            </div>

            {/* Current rate banner */}
            <div style={{ background: '#EEF3FF', borderBottom: '1px solid #DDE2EC', padding: '14px 28px', display: 'flex', gap: '20px' }}>
              <div>
                <span style={{ fontSize: '11px', color: '#6B7A99', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block' }}>CURRENT RATE</span>
                <span style={{ fontSize: '16px', fontWeight: 800, color: '#1A2340' }}>{rateDisplay}</span>
              </div>
              <div style={{ width: '1px', background: '#DDE2EC' }} />
              <div>
                <span style={{ fontSize: '11px', color: '#6B7A99', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block' }}>ENGAGEMENT</span>
                <span style={{ fontSize: '14px', fontWeight: 700, color: '#0047CC' }}>{activeContract.engagementModel || 'Remote / Full-time Retainer'}</span>
              </div>
            </div>

            {/* Form body */}
            <form onSubmit={handleRateReviewSubmit} style={{ padding: '28px', display: 'flex', flexDirection: 'column', gap: '20px' }}>

              {/* Proposed rate row */}
              <div style={{ display: 'flex', gap: '12px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '12px', fontWeight: 700, color: '#1A2340', display: 'block', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Proposed Rate *
                  </label>
                  <div style={{ position: 'relative' }}>
                    <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#6B7A99', fontWeight: 700, fontSize: '14px' }}>$</span>
                    <input
                      required
                      type="number"
                      min="1"
                      step="0.01"
                      placeholder="0.00"
                      value={proposedRate}
                      onChange={e => setProposedRate(e.target.value)}
                      style={{
                        width: '100%', height: '44px', border: '1.5px solid #DDE2EC', borderRadius: '10px',
                        paddingLeft: '28px', paddingRight: '12px', fontSize: '15px', fontWeight: 700,
                        outline: 'none', boxSizing: 'border-box', color: '#1A2340'
                      }}
                    />
                  </div>
                </div>
                <div style={{ minWidth: '130px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 700, color: '#1A2340', display: 'block', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Rate Type
                  </label>
                  <div style={{ display: 'flex', border: '1.5px solid #DDE2EC', borderRadius: '10px', overflow: 'hidden', height: '44px' }}>
                    {(['Hourly', 'Monthly'] as const).map(type => (
                      <button
                        key={type} type="button"
                        onClick={() => setProposedRateType(type)}
                        style={{
                          flex: 1, border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 700,
                          background: proposedRateType === type ? '#0047CC' : '#FFFFFF',
                          color: proposedRateType === type ? '#FFFFFF' : '#6B7A99',
                          transition: 'all 0.2s'
                        }}
                      >{type}</button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Effective date */}
              <div>
                <label style={{ fontSize: '12px', fontWeight: 700, color: '#1A2340', display: 'block', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Requested Effective Date *
                </label>
                <input
                  required
                  type="date"
                  value={effectiveDate}
                  onChange={e => setEffectiveDate(e.target.value)}
                  style={{
                    width: '100%', height: '44px', border: '1.5px solid #DDE2EC', borderRadius: '10px',
                    padding: '0 14px', fontSize: '14px', outline: 'none', boxSizing: 'border-box', color: '#1A2340'
                  }}
                />
              </div>

              {/* Justification */}
              <div>
                <label style={{ fontSize: '12px', fontWeight: 700, color: '#1A2340', display: 'block', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Justification *
                </label>
                <textarea
                  required
                  rows={4}
                  placeholder="Describe why this rate adjustment is warranted — e.g. expanded responsibilities, market benchmarking, performance record..."
                  value={justification}
                  onChange={e => setJustification(e.target.value)}
                  style={{
                    width: '100%', border: '1.5px solid #DDE2EC', borderRadius: '10px',
                    padding: '12px 14px', fontSize: '13px', outline: 'none', resize: 'vertical',
                    boxSizing: 'border-box', color: '#1A2340', lineHeight: 1.6, fontFamily: 'inherit'
                  }}
                />
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', paddingTop: '4px' }}>
                <button
                  type="button"
                  onClick={() => setRateReviewModalOpen(false)}
                  style={{ height: '44px', padding: '0 24px', border: '1.5px solid #DDE2EC', borderRadius: '10px', background: '#fff', fontSize: '14px', fontWeight: 700, color: '#6B7A99', cursor: 'pointer' }}
                >Cancel</button>
                <button
                  type="submit"
                  style={{ height: '44px', padding: '0 28px', border: 'none', borderRadius: '10px', background: 'linear-gradient(135deg, #002B7F, #0047CC)', color: '#FFFFFF', fontSize: '14px', fontWeight: 800, cursor: 'pointer', boxShadow: '0 4px 14px rgba(0,71,204,0.3)' }}
                >Submit Request</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── ARCHIVES VAULT SLIDE-OUT ─────────────────────────────── */}
      {archivesVaultOpen && (
        <div
          onClick={() => setArchivesVaultOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(10,20,50,0.55)', backdropFilter: 'blur(4px)', zIndex: 1000, display: 'flex', justifyContent: 'flex-end' }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              width: '100%', maxWidth: '680px', height: '100%', background: '#FFFFFF',
              boxShadow: '-16px 0 48px rgba(0,0,0,0.12)', display: 'flex', flexDirection: 'column',
              animation: 'slideInRight 0.3s ease'
            }}
          >
            {/* Vault header */}
            <div style={{ background: 'linear-gradient(135deg, #002B7F, #0047CC)', padding: '28px 28px 24px', flexShrink: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.6)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>CONTRACT VAULT</span>
                  <h2 style={{ color: '#FFFFFF', fontSize: '22px', fontWeight: 800, margin: '4px 0 0 0' }}>Full Archives</h2>
                  <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '13px', margin: '4px 0 0 0' }}>Complete engagement history · {historyList.length} records</p>
                </div>
                <button
                  onClick={() => setArchivesVaultOpen(false)}
                  style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: '8px', color: '#fff', width: '36px', height: '36px', fontSize: '20px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >×</button>
              </div>

              {/* Search and filter */}
              <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                <div style={{ flex: 1, position: 'relative' }}>
                  <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#6B7A99', fontSize: '14px' }}>🔍</span>
                  <input
                    type="text"
                    placeholder="Search by role, company, or ID..."
                    value={archiveSearchQuery}
                    onChange={e => setArchiveSearchQuery(e.target.value)}
                    style={{
                      width: '100%', height: '40px', border: 'none', borderRadius: '8px',
                      paddingLeft: '36px', paddingRight: '12px', fontSize: '13px', outline: 'none',
                      background: 'rgba(255,255,255,0.12)', color: '#FFFFFF', boxSizing: 'border-box'
                    }}
                  />
                </div>
                <div style={{ display: 'flex', background: 'rgba(255,255,255,0.12)', borderRadius: '8px', overflow: 'hidden' }}>
                  {(['All', 'Active', 'Closed'] as const).map(f => (
                    <button
                      key={f} type="button"
                      onClick={() => setArchiveStatusFilter(f)}
                      style={{
                        border: 'none', cursor: 'pointer', padding: '0 14px', fontSize: '12px', fontWeight: 700,
                        background: archiveStatusFilter === f ? 'rgba(255,255,255,0.25)' : 'transparent',
                        color: '#FFFFFF', transition: 'all 0.2s'
                      }}
                    >{f}</button>
                  ))}
                </div>
              </div>
            </div>

            {/* Archive list */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px 28px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {historyList
                .filter((c: any) => {
                  const q = archiveSearchQuery.toLowerCase();
                  const matchQ = !q || c.role?.toLowerCase().includes(q) || c.clientName?.toLowerCase().includes(q) || c.id?.toLowerCase().includes(q);
                  const matchF = archiveStatusFilter === 'All' ||
                    (archiveStatusFilter === 'Active' && (c.status === 'Signed' || c.status === 'Active')) ||
                    (archiveStatusFilter === 'Closed' && (c.status === 'Closed' || c.status === 'Expired'));
                  return matchQ && matchF;
                })
                .map((c: any, idx: number) => {
                  const isActive = c.status === 'Signed' || c.status === 'Active';
                  const isExpanded = selectedArchiveContract?.id === c.id;
                  const cRate = c.rateType === 'Hourly' ? `$${(c.rateAmount || 120).toFixed(2)}/hr` : `$${(c.salary || c.rateAmount || 0).toLocaleString()}/mo`;
                  return (
                    <div key={idx}>
                      <div
                        onClick={() => setSelectedArchiveContract(isExpanded ? null : c)}
                        style={{
                          border: isExpanded ? '2px solid #0047CC' : '1px solid #E2E8F0',
                          borderRadius: isExpanded ? '12px 12px 0 0' : '12px',
                          padding: '16px 20px',
                          background: isExpanded ? '#EEF3FF' : '#FFFFFF',
                          cursor: 'pointer',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          transition: 'all 0.2s'
                        }}
                      >
                        <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
                          <div style={{
                            width: '44px', height: '44px', borderRadius: '10px', flexShrink: 0,
                            background: isActive ? 'linear-gradient(135deg, #002B7F, #0047CC)' : '#F1F5F9',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            color: isActive ? '#FFFFFF' : '#6B7A99', fontWeight: 800, fontSize: '16px'
                          }}>
                            {c.clientName?.charAt(0) || 'C'}
                          </div>
                          <div>
                            <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 800, color: '#1A2340' }}>{c.role}</h4>
                            <span style={{ fontSize: '12px', color: '#0047CC', fontWeight: 600 }}>{c.clientName}</span>
                            <span style={{ fontSize: '11px', color: '#6B7A99', display: 'block' }}>
                              {c.startDate} – {c.endDate || 'Present'} · {c.id}
                            </span>
                          </div>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
                          <span style={{
                            background: isActive ? '#E6FFFA' : '#F1F5F9',
                            color: isActive ? '#00A389' : '#64748B',
                            fontSize: '10px', fontWeight: 800, padding: '3px 8px',
                            borderRadius: '4px', textTransform: 'uppercase'
                          }}>
                            {isActive ? 'Active' : c.status}
                          </span>
                          <span style={{ fontSize: '12px', fontWeight: 700, color: '#1A2340' }}>{cRate}</span>
                          <span style={{ fontSize: '16px', color: '#0047CC', transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>⌄</span>
                        </div>
                      </div>

                      {/* Expanded audit detail */}
                      {isExpanded && (
                        <div style={{
                          border: '2px solid #0047CC', borderTop: '1px solid #C7D7F5',
                          borderRadius: '0 0 12px 12px',
                          padding: '20px 24px',
                          background: '#FFFFFF',
                          display: 'flex', flexDirection: 'column', gap: '16px'
                        }}>
                          {/* Earnings row */}
                          <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
                            {[
                              { label: 'Total Earned', value: `$${(c.totalEarned || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` },
                              { label: 'Rate', value: cRate },
                              { label: 'Duration', value: `${c.startDate} – ${c.endDate || 'Present'}` }
                            ].map((item, i) => (
                              <div key={i} style={{ flex: 1, minWidth: '100px' }}>
                                <span style={{ fontSize: '10px', color: '#6B7A99', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block' }}>{item.label}</span>
                                <span style={{ fontSize: '14px', fontWeight: 800, color: '#1A2340' }}>{item.value}</span>
                              </div>
                            ))}
                          </div>

                          {/* Performance row */}
                          <div style={{ background: '#F8FAFC', borderRadius: '8px', padding: '14px 16px' }}>
                            <span style={{ fontSize: '11px', color: '#6B7A99', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '10px' }}>Performance Metrics</span>
                            <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
                              {[
                                { label: 'Quality', val: c.qualityOfWork },
                                { label: 'Communication', val: c.communication },
                                { label: 'Timeliness', val: c.timeliness }
                              ].map((m, i) => m.val && (
                                <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                                  <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: '#EEF3FF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 800, color: '#0047CC' }}>
                                    {m.val.toFixed(1)}
                                  </div>
                                  <span style={{ fontSize: '10px', color: '#6B7A99', fontWeight: 600 }}>{m.label}</span>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Star rating + download */}
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                              {Array.from({ length: 5 }).map((_, i) => (
                                <span key={i} style={{ color: i < (c.rating || 5) ? '#F59E0B' : '#E2E8F0', fontSize: '18px' }}>★</span>
                              ))}
                              <span style={{ fontSize: '12px', color: '#6B7A99', marginLeft: '6px', fontWeight: 600 }}>Client Rating</span>
                            </div>
                            <button
                              onClick={() => alert(`Downloading contract audit report for ${c.id}...`)}
                              style={{ background: '#0047CC', color: '#fff', border: 'none', borderRadius: '8px', padding: '8px 18px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}
                            >
                              ↓ Download Audit
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}

              {historyList.filter((c: any) => {
                const q = archiveSearchQuery.toLowerCase();
                const matchQ = !q || c.role?.toLowerCase().includes(q) || c.clientName?.toLowerCase().includes(q) || c.id?.toLowerCase().includes(q);
                const matchF = archiveStatusFilter === 'All' ||
                  (archiveStatusFilter === 'Active' && (c.status === 'Signed' || c.status === 'Active')) ||
                  (archiveStatusFilter === 'Closed' && (c.status === 'Closed' || c.status === 'Expired'));
                return matchQ && matchF;
              }).length === 0 && (
                <div style={{ textAlign: 'center', padding: '60px 20px', color: '#6B7A99' }}>
                  <div style={{ fontSize: '40px', marginBottom: '12px' }}>📂</div>
                  <p style={{ fontSize: '14px', fontWeight: 600 }}>No matching contract records found.</p>
                  <p style={{ fontSize: '12px' }}>Try adjusting your search or filter.</p>
                </div>
              )}
            </div>

            {/* Vault footer */}
            <div style={{ borderTop: '1px solid #E2E8F0', padding: '16px 28px', flexShrink: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '12px', color: '#6B7A99' }}>{historyList.length} total contract record{historyList.length !== 1 ? 's' : ''} on file</span>
              <button
                onClick={() => alert('Exporting full archive to CSV...')}
                style={{ border: '1.5px solid #0047CC', background: 'transparent', color: '#0047CC', borderRadius: '8px', padding: '8px 20px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}
              >Export All Records</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

// ─── Section 5: Application Pipeline ─────────────────────────────────────────
const PipelineSection = ({ profile, matches = [], clientRequests = [], onUpdateMatch }: { profile: any; matches?: any[]; clientRequests?: any[]; onUpdateMatch?: (updatedMatch: any) => void }) => {
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  // Filter matches belonging to this talent
  const talentMatches = matches.filter(m => m.talentId === profile?.id);

  // Kanban Stage mapping
  const columns = [
    { id: 'shortlisted', title: 'Shortlisted', statusList: ['Applied', 'Shortlisted'], color: '#0047CC' },
    { id: 'interview', title: 'Interviews', statusList: ['Interview Requested', 'Interview Scheduled', 'Interviewed'], color: '#EA580C' },
    { id: 'offers', title: 'Offers Extended', statusList: ['Offer Extended'], color: '#7C3AED' },
    { id: 'accepted', title: 'Placements', statusList: ['Offer Accepted'], color: '#16A34A' }
  ];

  const handleAction = (match: any, newStatus: 'Offer Accepted' | 'Declined') => {
    if (onUpdateMatch) {
      onUpdateMatch({
        ...match,
        status: newStatus
      });
      if (newStatus === 'Offer Accepted') {
        showToast('🎉 Offer Accepted! EOR Retainer contract spawned instantly.');
      } else {
        showToast('Offer declined. Matching system notified.');
      }
    }
  };

  const getRequestInfo = (requestId: string) => {
    const req = clientRequests.find(r => r.id === requestId);
    return {
      clientName: req?.clientName || req?.companyName || 'Horizon Fintech',
      role: req?.roleDescription || req?.title || 'Senior Full-Stack Engineer',
      budget: req?.budget || '$120.00 / hr',
      timezone: req?.timezone || 'GMT+1 (Lagos)',
      commitmentLevel: req?.commitmentLevel || 'Remote / Full-time'
    };
  };

  // Metrics counts
  const shortlistedCount = talentMatches.filter(m => ['Applied', 'Shortlisted'].includes(m.status)).length;
  const interviewCount = talentMatches.filter(m => ['Interview Requested', 'Interview Scheduled', 'Interviewed'].includes(m.status)).length;
  const offerCount = talentMatches.filter(m => m.status === 'Offer Extended').length;
  const placementCount = talentMatches.filter(m => m.status === 'Offer Accepted').length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px', fontFamily: 'var(--font-display, Inter, sans-serif)', position: 'relative' }}>
      
      {/* Toast popup */}
      {toastMsg && (
        <div style={{
          position: 'fixed', top: '24px', right: '24px',
          background: 'linear-gradient(135deg, #1E293B 0%, #0F172A 100%)',
          color: '#FFFFFF', padding: '16px 24px', borderRadius: '12px',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3), 0 10px 10px -5px rgba(0, 0, 0, 0.2)',
          zIndex: 9999, display: 'flex', alignItems: 'center', gap: '12px'
        }}>
          <span style={{ fontSize: '18px' }}>🚀</span>
          <span style={{ fontSize: '13px', fontWeight: 600 }}>{toastMsg}</span>
        </div>
      )}

      {/* Header */}
      <div>
        <h2 style={{ fontSize: '24px', fontWeight: 800, color: '#1A2340', marginBottom: '6px' }}>ATS Role Matching Pipeline</h2>
        <p style={{ fontSize: '14px', color: '#6B7A99', margin: 0 }}>Review shortlisted opportunities, track scheduled technical interviews, and accept direct EOR payroll offers.</p>
      </div>

      {/* Metric Cards Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
        {[
          { label: 'Shortlisted Roles', val: shortlistedCount, desc: 'Under review by client', color: '#0047CC' },
          { label: 'Active Interviews', val: interviewCount, desc: 'Technical screenings booked', color: '#EA580C' },
          { label: 'Offers Extended', val: offerCount, desc: 'Pending EOR payroll review', color: '#7C3AED' },
          { label: 'Successful Placements', val: placementCount, desc: 'Active remote retainers', color: '#16A34A' }
        ].map((m, idx) => (
          <Card key={idx} style={{ padding: '16px 20px', borderLeft: `4px solid ${m.color}` }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#6B7A99', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{m.label}</span>
            <div style={{ fontSize: '28px', fontWeight: 900, color: '#1A2340', margin: '4px 0' }}>{m.val}</div>
            <span style={{ fontSize: '11px', color: '#6B7A99' }}>{m.desc}</span>
          </Card>
        ))}
      </div>

      {/* Kanban Board */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', overflowX: 'auto', paddingBottom: '12px' }}>
        {columns.map(col => {
          const colMatches = talentMatches.filter(m => col.statusList.includes(m.status));
          return (
            <div key={col.id} style={{ display: 'flex', flexDirection: 'column', gap: '12px', minWidth: '250px' }}>
              
              {/* Column Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `2px solid ${col.color}30`, paddingBottom: '8px' }}>
                <h3 style={{ fontSize: '13px', fontWeight: 800, color: '#1A2340', margin: 0, textTransform: 'uppercase', letterSpacing: '0.04em', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: col.color }} />
                  {col.title}
                </h3>
                <span style={{ background: '#EEF3FF', color: '#0047CC', fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '10px' }}>
                  {colMatches.length}
                </span>
              </div>

              {/* Column Body Cards */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', flex: 1, minHeight: '300px', background: '#F8FAFC', borderRadius: '8px', padding: '8px', border: '1px dashed #DDE2EC' }}>
                {colMatches.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px 10px', color: '#94A3B8', fontSize: '11px' }}>
                    No opportunities here
                  </div>
                ) : (
                  colMatches.map(m => {
                    const info = getRequestInfo(m.requestId);
                    return (
                      <Card key={m.id} style={{ padding: '14px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                          <span style={{ fontSize: '10px', fontWeight: 800, color: '#0047CC', background: '#EEF3FF', padding: '2px 6px', borderRadius: '4px' }}>
                            Match Score: {m.score}%
                          </span>
                          <span style={{ fontSize: '10px', fontWeight: 700, color: '#6B7A99' }}>{info.commitmentLevel.split('/')[0].trim()}</span>
                        </div>
                        <h4 style={{ margin: '0 0 4px 0', fontSize: '13px', fontWeight: 800, color: '#1A2340' }}>{info.role}</h4>
                        <div style={{ fontSize: '11px', color: '#0047CC', fontWeight: 700, marginBottom: '8px' }}>{info.clientName}</div>
                        
                        <div style={{ fontSize: '11px', color: '#6B7A99', display: 'flex', flexDirection: 'column', gap: '4px', borderTop: '1px solid #F1F5F9', paddingTop: '8px', marginBottom: '8px' }}>
                          <div>💰 <strong>Compensation:</strong> {info.budget}</div>
                          <div>🌐 <strong>Timezone:</strong> {info.timezone}</div>
                        </div>

                        {/* Status-specific action panels */}
                        {m.status === 'Interview Scheduled' && (
                          <div style={{ background: '#FFF7ED', border: '1px solid #FED7AA', borderRadius: '6px', padding: '8px', marginTop: '6px' }}>
                            <div style={{ fontSize: '10px', color: '#C2410C', fontWeight: 700, marginBottom: '4px' }}>
                              🗓️ Confirmed Call Booked
                            </div>
                            <div style={{ fontSize: '10px', color: '#7C2D12', marginBottom: '6px' }}>
                              Slot: {m.requestedDate} at {m.requestedTime}
                            </div>
                            <button 
                              onClick={() => window.open('https://meet.google.com/kng-vetting-meet', '_blank')}
                              style={{
                                width: '100%', background: '#EA580C', border: 'none', color: '#FFFFFF',
                                borderRadius: '6px', padding: '6px', fontSize: '10px', fontWeight: 700, cursor: 'pointer',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px'
                              }}
                            >
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="23 7 16 12 23 17 23 7" /><rect x="1" y="5" width="15" height="14" rx="2" ry="2" /></svg>
                              Join Video Call
                            </button>
                          </div>
                        )}

                        {m.status === 'Offer Extended' && (
                          <div style={{ background: '#F5F3FF', border: '1px solid #DDD6FE', borderRadius: '6px', padding: '8px', marginTop: '6px' }}>
                            <div style={{ fontSize: '10px', color: '#6D28D9', fontWeight: 700, marginBottom: '6px', textAlign: 'center' }}>
                              🎉 Retainer Offer Received!
                            </div>
                            <div style={{ display: 'flex', gap: '6px' }}>
                              <button 
                                onClick={() => handleAction(m, 'Declined')}
                                style={{
                                  flex: 1, background: 'transparent', border: '1px solid #DDD6FE', color: '#6D28D9',
                                  borderRadius: '6px', padding: '6px', fontSize: '10px', fontWeight: 600, cursor: 'pointer'
                                }}
                              >
                                Decline
                              </button>
                              <button 
                                onClick={() => handleAction(m, 'Offer Accepted')}
                                style={{
                                  flex: 2, background: '#7C3AED', border: 'none', color: '#FFFFFF',
                                  borderRadius: '6px', padding: '6px', fontSize: '10px', fontWeight: 700, cursor: 'pointer'
                                }}
                              >
                                Accept Offer
                              </button>
                            </div>
                          </div>
                        )}

                        {m.status === 'Offer Accepted' && (
                          <div style={{ background: '#ECFDF5', border: '1px solid #D1FAE5', borderRadius: '6px', padding: '8px', marginTop: '6px', textAlign: 'center' }}>
                            <div style={{ fontSize: '10px', color: '#065F46', fontWeight: 700 }}>
                              🎉 Offer Accepted & Deployed
                            </div>
                            <div style={{ fontSize: '9px', color: '#047857', marginTop: '2px' }}>
                              EOR contract is fully active. Visually verified in the Contract System ledger!
                            </div>
                          </div>
                        )}

                      </Card>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>

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
const ComplianceSection = ({ profile, onUpdateProfile }: { profile: any; onUpdateProfile?: (p: any) => void }) => {
  const [sigModalDoc, setSigModalDoc] = useState<string | null>(null);
  const [signatureType, setSignatureType] = useState<'type' | 'draw'>('type');
  const [typedSig, setTypedSig] = useState('');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);

  const documents = profile?.documents || [];
  
  // High fidelity compliance items matching the design layout
  const complianceDocs = [
    {
      id: 'doc_nda',
      name: 'Non-Disclosure Agreement (NDA)',
      description: 'Confidentiality and proprietary rights for Project Orion.',
      status: 'pending_signature',
      dueDate: 'Due in 3 days'
    },
    {
      id: 'doc_ip',
      name: 'Intellectual Property Agreement',
      description: 'Master assignment of inventions and copyright.',
      status: 'pending_signature',
      dueDate: 'Immediate'
    },
    {
      id: 'doc_ethics',
      name: 'Code of Ethics & Conduct',
      description: 'Standard corporate behavior and anti-corruption policy.',
      status: 'pending_signature',
      dueDate: 'Immediate'
    },
    {
      id: 'doc_contractor',
      name: 'Independent Contractor Agreement',
      description: 'General EOR contractor agreement and payout schedules.',
      status: 'pending_signature',
      dueDate: 'Immediate'
    },
    {
      id: 'doc_dpa',
      name: 'Data Privacy Addendum (DPA)',
      description: 'Compliance with GDPR and regional data protection laws.',
      status: 'pending_signature',
      dueDate: 'Immediate'
    }
  ].map(defDoc => {
    const dbDoc = documents.find((d: any) => d.id === defDoc.id);
    return dbDoc ? { ...defDoc, ...dbDoc } : defDoc;
  });

  const pendingDocs = complianceDocs.filter((d: any) => d.status === 'pending_signature');
  const completedDocs = complianceDocs.filter((d: any) => d.status === 'signed' || d.status === 'under_review');
  // Dynamically calculate score: 0 completed = 0%, 5 completed = 100%
  const complianceScore = Math.round((completedDocs.length / complianceDocs.length) * 100); 

  const handleSign = (docId: string) => {
    const sig = typedSig.trim() || profile?.name || 'Talent User';
    
    // Check if the document already exists in the profile documents list
    let docExists = documents.some((d: any) => d.id === docId);
    let updatedDocs;
    
    if (docExists) {
      updatedDocs = documents.map((d: any) => {
        if (d.id === docId) {
          return {
            ...d,
            status: 'signed',
            signedAt: new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }),
            uploadedAt: 'Signed today'
          };
        }
        return d;
      });
    } else {
      // Find the template document
      const tempDoc = complianceDocs.find((d: any) => d.id === docId);
      updatedDocs = [
        ...documents,
        {
          id: docId,
          userId: profile?.id || 'talent_user',
          name: tempDoc?.name || 'Document',
          type: 'agreement',
          fileSize: '1.5 MB',
          status: 'signed',
          uploadedAt: 'Signed today',
          description: tempDoc?.description,
          signedAt: new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })
        }
      ];
    }

    if (onUpdateProfile) {
      onUpdateProfile({
        ...profile,
        documents: updatedDocs
      });
    }

    setSigModalDoc(null);
    setTypedSig('');
  };

  const startDraw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    drawing.current = true;
    const ctx = canvasRef.current?.getContext('2d');
    if (ctx) {
      ctx.beginPath();
      ctx.moveTo(e.nativeEvent.offsetX, e.nativeEvent.offsetY);
    }
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    const ctx = canvasRef.current?.getContext('2d');
    if (ctx) {
      ctx.lineTo(e.nativeEvent.offsetX, e.nativeEvent.offsetY);
      ctx.strokeStyle = '#0047CC';
      ctx.lineWidth = 2.5;
      ctx.stroke();
    }
  };

  const stopDraw = () => {
    drawing.current = false;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* Header and Gauge Row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
        <div style={{ flex: 1, minWidth: '300px' }}>
          <h2 style={{ fontSize: '24px', fontWeight: 800, color: '#1A2340', marginBottom: '6px' }}>Compliance & Legal</h2>
          <p style={{ fontSize: '14px', color: '#6B7A99', lineHeight: 1.5, margin: 0 }}>
            Manage your legal obligations, review active contracts, and ensure your talent profile remains fully compliant with global regulations.
          </p>
        </div>
        
        {/* Progress Gauge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', background: '#FFFFFF', padding: '12px 24px', borderRadius: '12px', border: '1px solid #DDE2EC' }}>
          <div style={{ textAlign: 'right' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#6B7A99', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Compliance Score</span>
            <div style={{ fontSize: '24px', fontWeight: 900, color: '#0047CC' }}>{complianceScore}%</div>
          </div>
          <div style={{ position: 'relative', width: '56px', height: '56px' }}>
            <svg width="56" height="56" viewBox="0 0 36 36" style={{ transform: 'rotate(-90deg)' }}>
              <circle cx="18" cy="18" r="15.915" fill="none" stroke="#EEF3FF" strokeWidth="3" />
              <circle cx="18" cy="18" r="15.915" fill="none" stroke="#0047CC" strokeWidth="3.5"
                strokeDasharray={`${complianceScore} 100`}
                strokeLinecap="round"
                style={{ transition: 'stroke-dasharray 0.5s ease' }}
              />
            </svg>
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 700, color: '#0047CC' }}>
              ✓
            </div>
          </div>
        </div>
      </div>

      {/* Stats and Info widgets grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '20px' }}>
        
        {/* Widget 1: Pending Actions (Blue Card) */}
        <div style={{
          background: 'linear-gradient(135deg, #0047CC 0%, #002B7F 100%)',
          borderRadius: '16px', padding: '24px', color: '#FFFFFF',
          display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
          minHeight: '130px', boxShadow: '0 10px 20px rgba(0,71,204,0.15)'
        }}>
          <div>
            <div style={{ fontSize: '12px', fontWeight: 700, opacity: 0.8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Pending Actions</div>
            <div style={{ fontSize: '32px', fontWeight: 900, marginTop: '8px' }}>{pendingDocs.length}</div>
          </div>
          <div style={{ fontSize: '13px', fontWeight: 600, opacity: 0.9 }}>
            {pendingDocs.length > 0 ? `${pendingDocs.length} Requires immediate signature` : 'All agreements fully signed'}
          </div>
        </div>

        {/* Widget 2: Policy Updates */}
        <div style={{
          background: '#FFFFFF', border: '1px solid #DDE2EC', borderRadius: '16px', padding: '20px 24px',
          display: 'flex', flexDirection: 'column', gap: '12px'
        }}>
          <span style={{ fontSize: '12px', fontWeight: 700, color: '#6B7A99', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Policy Updates</span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
              <span style={{ fontSize: '12px', color: '#0047CC' }}>•</span>
              <span style={{ fontSize: '13px', color: '#1A2340', fontWeight: 500 }}>
                Global Ethics Policy updated <span style={{ color: '#6B7A99', fontSize: '12px' }}>v2.4 (Jan 2026)</span>
              </span>
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
              <span style={{ fontSize: '12px', color: '#0047CC' }}>•</span>
              <span style={{ fontSize: '13px', color: '#1A2340', fontWeight: 500 }}>
                Remote Work Guidelines revised
              </span>
            </div>
          </div>
        </div>

        {/* Widget 3: Certifications */}
        <div style={{
          background: '#FFFFFF', border: '1px solid #DDE2EC', borderRadius: '16px', padding: '20px 24px',
          display: 'flex', flexDirection: 'column', gap: '12px'
        }}>
          <span style={{ fontSize: '12px', fontWeight: 700, color: '#6B7A99', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Certifications</span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '4px' }}>
            <span style={{ background: '#EEF3FF', color: '#0047CC', border: '1px solid #0047CC33', borderRadius: '20px', padding: '4px 12px', fontSize: '12px', fontWeight: 600 }}>
              GDPR Certified
            </span>
            <span style={{ background: '#F0FBFB', color: '#00A3A0', border: '1px solid #00A3A033', borderRadius: '20px', padding: '4px 12px', fontSize: '12px', fontWeight: 600 }}>
              SOC2 Aware
            </span>
            <span style={{ background: '#F4F5F7', color: '#6B7A99', border: '1px solid #DDE2EC', borderRadius: '20px', padding: '4px 12px', fontSize: '12px', fontWeight: 600 }}>
              +2 More
            </span>
          </div>
        </div>

      </div>

      {/* Document Repository list */}
      <Card style={{ padding: '0px' }}>
        {/* Repository Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '24px', borderBottom: '1px solid #F5F7FA' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#1A2340', margin: 0 }}>Legal Document Repository</h3>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button style={{
              background: '#FFFFFF', border: '1px solid #DDE2EC', borderRadius: '8px',
              padding: '8px 16px', fontSize: '13px', fontWeight: 600, color: '#1A2340',
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px'
            }}>
              🔍 Filter
            </button>
            <button style={{
              background: '#0047CC', border: 'none', borderRadius: '8px',
              padding: '8px 16px', fontSize: '13px', fontWeight: 700, color: '#FFFFFF',
              cursor: 'pointer'
            }}>
              📤 Upload Signed
            </button>
          </div>
        </div>

        {/* Repository Table List */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {complianceDocs.map((doc, idx) => {
            const isPending = doc.status === 'pending_signature';
            const isUnderReview = doc.status === 'under_review';
            const isSigned = doc.status === 'signed';

            let statusColor = '#6B7A99';
            let statusBg = '#F5F7FA';
            let statusText = 'Unknown';
            let buttonText = 'View Only';
            let buttonStyle: React.CSSProperties = { background: '#F4F5F7', color: '#1A2340' };

            if (isPending) {
              statusColor = '#E05A47';
              statusBg = '#FDF2F0';
              statusText = `⏰ Pending Signature - ${doc.dueDate || 'Immediate'}`;
              buttonText = 'Sign Now';
              buttonStyle = { background: '#0047CC', color: '#FFFFFF', fontWeight: 700 };
            } else if (isUnderReview) {
              statusColor = '#0047CC';
              statusBg = '#EEF3FF';
              statusText = `⏳ Under Review - Submitted ${doc.uploadedAt || 'recently'}`;
              buttonText = 'View Only';
              buttonStyle = { background: 'transparent', border: '1px solid #DDE2EC', color: '#1A2340' };
            } else if (isSigned) {
              statusColor = '#00A3A0';
              statusBg = '#F0FBFB';
              statusText = `✓ Signed - ${doc.signedAt || 'Verified'}`;
              buttonText = 'Download';
              buttonStyle = { background: 'transparent', border: '1px solid #DDE2EC', color: '#0047CC' };
            }

            return (
              <div key={doc.id} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '20px 24px', borderBottom: idx === complianceDocs.length - 1 ? 'none' : '1px solid #F5F7FA',
                flexWrap: 'wrap', gap: '16px'
              }}>
                {/* Info block */}
                <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flex: 1, minWidth: '260px' }}>
                  <div style={{
                    width: '40px', height: '40px', background: isPending ? '#FDF2F0' : '#EEF3FF',
                    borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '18px', flexShrink: 0
                  }}>
                    {isPending ? '📕' : '📘'}
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '14px', color: '#1A2340' }}>{doc.name}</div>
                    <div style={{ fontSize: '12px', color: '#6B7A99', marginTop: '4px', lineHeight: 1.4 }}>{doc.description}</div>
                  </div>
                </div>

                {/* Status Badges & Buttons */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap' }}>
                  {/* Status Pill */}
                  <span style={{
                    background: statusBg, color: statusColor, padding: '6px 12px',
                    borderRadius: '20px', fontSize: '12px', fontWeight: 600, whiteSpace: 'nowrap'
                  }}>
                    {statusText}
                  </span>

                  {/* Action Trigger */}
                  <button
                    onClick={() => {
                      if (isPending) {
                        setSigModalDoc(doc.id);
                      }
                    }}
                    style={{
                      border: 'none', borderRadius: '8px', padding: '8px 16px',
                      fontSize: '13px', fontWeight: 600, cursor: 'pointer',
                      transition: 'all 0.2s', ...buttonStyle
                    }}
                  >
                    {buttonText}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* E-Signature Modal */}
      {sigModalDoc && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(26,35,64,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '24px' }}>
          <div style={{ background: '#fff', borderRadius: '16px', padding: '32px', width: '100%', maxWidth: '480px', boxShadow: '0 24px 64px rgba(0,0,0,0.15)' }}>
            <h3 style={{ fontWeight: 800, fontSize: '18px', color: '#1A2340', marginBottom: '4px', marginTop: 0 }}>E-Sign Document</h3>
            <p style={{ fontSize: '13px', color: '#6B7A99', marginBottom: '24px' }}>{complianceDocs.find(d => d.id === sigModalDoc)?.name}</p>

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
                style={{ border: '1px solid #DDE2EC', borderRadius: '8px', width: '100%', cursor: 'crosshair', display: 'block', background: '#FAFAFA' }}
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

// ─── Section 7: Profile Detail Section ───────────────────────────────────────
const ProfileDetailSection = ({ user, profile, contracts, onUpdateProfile }: { user: any; profile: any; contracts: any[]; onUpdateProfile?: (updatedProfile: any) => void }) => {
  const vettingStatus = profile?.vettingStatus || 'Under Review';
  const vettingStage = profile?.vettingStage || 'Final Review';
  const grade = profile?.grade || 'A';
  const vettingScores = profile?.vettingScores || { cognitive: 92, technical: 95, communication: 90 };
  const tags = profile?.tags || ['PostgreSQL', 'Node.js', 'React', 'Docker'];

  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const showToast = (msg: string) => { setToastMsg(msg); setTimeout(() => setToastMsg(null), 3000); };

  // ── Header state ──
  const [isEditingHeader, setIsEditingHeader] = useState(false);
  const [fullName, setFullName] = useState(profile?.name || user?.name || 'Chidi Anya');
  const [title, setTitle] = useState(profile?.title || 'Senior Software Engineer');
  const [bio, setBio] = useState(profile?.bio || 'Passionate engineer specialized in scalable system designs and low-latency database engines.');
  const [tagsInput, setTagsInput] = useState(tags.join(', '));

  const handleSaveHeader = () => {
    const updatedTags = tagsInput.split(',').map((t: string) => t.trim()).filter((t: string) => t.length > 0);
    if (onUpdateProfile) onUpdateProfile({ ...profile, name: fullName, title, bio, tags: updatedTags });
    showToast('Profile header updated!');
    setIsEditingHeader(false);
  };

  // ── Personal Information ──
  const [isEditingPersonal, setIsEditingPersonal] = useState(false);
  const [phone, setPhone] = useState(profile?.phone || '+234 809 123 4567');
  const [city, setCity] = useState(profile?.city || 'Lagos');
  const [country, setCountry] = useState(profile?.country || 'Nigeria');
  const [timezone, setTimezone] = useState(profile?.timezone || 'GMT+1 (Lagos)');
  const [dateOfBirth, setDateOfBirth] = useState(profile?.dateOfBirth || '1990-04-14');
  const [gender, setGender] = useState(profile?.gender || 'Male');
  const [nationality, setNationality] = useState(profile?.nationality || 'Nigerian');
  const [maritalStatus, setMaritalStatus] = useState(profile?.maritalStatus || 'Single');
  const [nationalId, setNationalId] = useState(profile?.nationalId || 'NIN-9234-8812-XXXX');
  const [passportNo, setPassportNo] = useState(profile?.passportNo || 'A12345678');
  const [address, setAddress] = useState(profile?.address || '14 Ahmadu Bello Way, Victoria Island, Lagos');

  const handleSavePersonal = () => {
    if (onUpdateProfile) onUpdateProfile({ ...profile, phone, city, country, timezone, dateOfBirth, gender, nationality, maritalStatus, nationalId, passportNo, address });
    showToast('Personal information updated!');
    setIsEditingPersonal(false);
  };

  // ── Professional Details ──
  const [isEditingProfessional, setIsEditingProfessional] = useState(false);
  const [primaryRole, setPrimaryRole] = useState(profile?.title || 'Senior Software Engineer');
  const [seniorityLevel, setSeniorityLevel] = useState(profile?.seniorityLevel || 'Senior');
  const [yearsExperience, setYearsExperience] = useState(profile?.experienceYears ?? 7);
  const [skills, setSkills] = useState(Array.isArray(profile?.skills) ? profile.skills.join(', ') : (profile?.skills || 'PostgreSQL, Node.js, React, Docker, Kubernetes'));
  const [employmentPreference, setEmploymentPreference] = useState(profile?.employmentPreference || 'Full Time');
  const [salaryExpectation, setSalaryExpectation] = useState(profile?.salaryExpectation ?? 4500);
  const [currency, setCurrency] = useState(profile?.currency || 'USD');
  const [hourlyMonthly, setHourlyMonthly] = useState(profile?.hourlyMonthly || 'Monthly');
  const [availability, setAvailability] = useState(profile?.availability ?? 100);
  const [linkedIn, setLinkedIn] = useState(profile?.linkedIn || 'https://linkedin.com/in/chidi-anya');
  const [portfolioUrl, setPortfolioUrl] = useState(profile?.portfolioUrl || 'https://github.com/chidi-anya');

  const handleSaveProfessional = () => {
    if (onUpdateProfile) onUpdateProfile({ ...profile, title: primaryRole, seniorityLevel, experienceYears: Number(yearsExperience), skills: skills.split(',').map((s: string) => s.trim()), employmentPreference, salaryExpectation: Number(salaryExpectation), currency, hourlyMonthly, availability: Number(availability), linkedIn, portfolioUrl });
    showToast('Professional details updated!');
    setIsEditingProfessional(false);
  };

  // ── Work Setup ──
  const [isEditingSetup, setIsEditingSetup] = useState(false);
  const [internetQuality, setInternetQuality] = useState(profile?.internetQuality || 'Fiber Optic (Primary) + LTE (Backup)');
  const [workSetup, setWorkSetup] = useState(profile?.workSetup || 'Dedicated ergonomic workspace with UPS battery backup');
  const [devices, setDevices] = useState(profile?.devices || 'MacBook Pro 16", Dual 27" 4K Monitors');
  const [communicationTools, setCommunicationTools] = useState(profile?.communicationTools || 'Slack, Zoom, Teams, Loom');

  const handleSaveSetup = () => {
    if (onUpdateProfile) onUpdateProfile({ ...profile, internetQuality, workSetup, devices, communicationTools });
    showToast('Work setup updated!');
    setIsEditingSetup(false);
  };

  // ── Work Experience ──
  const [workExperience, setWorkExperience] = useState<any[]>(profile?.workExperience && profile.workExperience.length > 0 ? profile.workExperience : [
    { id: 'we_1', company: 'Horizon Fintech Ltd', role: 'Senior Software Engineer', startDate: '2022-01', endDate: 'Present', location: 'Lagos, Nigeria (Remote)', description: 'Led architecture of microservices payment gateway processing over $5M daily. Managed a team of 8 engineers across 3 time zones.' },
    { id: 'we_2', company: 'Nebula Systems Inc.', role: 'Full-Stack Engineer', startDate: '2019-03', endDate: '2021-12', location: 'Abuja, Nigeria', description: 'Built and maintained core ledger synchronization systems with PostgreSQL, achieving 99.99% uptime SLA.' },
  ]);
  const [isWorkModalOpen, setIsWorkModalOpen] = useState(false);
  const [isEditingWork, setIsEditingWork] = useState(false);
  const [workForm, setWorkForm] = useState({ id: '', company: '', role: '', startDate: '', endDate: '', location: '', description: '' });

  const handleWorkSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    let updated;
    if (isEditingWork) {
      updated = workExperience.map(w => w.id === workForm.id ? { ...workForm } : w);
      showToast('Work experience updated!');
    } else {
      updated = [...workExperience, { ...workForm, id: `we_${Date.now()}` }];
      showToast('Work experience added!');
    }
    setWorkExperience(updated);
    if (onUpdateProfile) onUpdateProfile({ ...profile, workExperience: updated });
    setIsWorkModalOpen(false);
  };

  // ── Education ──
  const [educationList, setEducationList] = useState<any[]>(profile?.educationList && profile.educationList.length > 0 ? profile.educationList : [
    { id: 'edu_1', institution: 'University of Lagos', degree: 'B.Sc. Computer Science', startYear: '2009', endYear: '2013', grade: 'First Class Honours', description: 'Focused on distributed systems, algorithms, and software engineering practices.' },
  ]);
  const [isEduModalOpen, setIsEduModalOpen] = useState(false);
  const [isEditingEdu, setIsEditingEdu] = useState(false);
  const [eduForm, setEduForm] = useState({ id: '', institution: '', degree: '', startYear: '', endYear: '', grade: '', description: '' });

  const handleEduSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    let updated;
    if (isEditingEdu) {
      updated = educationList.map(e => e.id === eduForm.id ? { ...eduForm } : e);
      showToast('Education entry updated!');
    } else {
      updated = [...educationList, { ...eduForm, id: `edu_${Date.now()}` }];
      showToast('Education entry added!');
    }
    setEducationList(updated);
    if (onUpdateProfile) onUpdateProfile({ ...profile, educationList: updated });
    setIsEduModalOpen(false);
  };

  // ── Languages ──
  const [languagesList, setLanguagesList] = useState<any[]>(profile?.languagesList && profile.languagesList.length > 0 ? profile.languagesList : [
    { id: 'lang_1', language: 'English', proficiency: 'Native / Bilingual' },
    { id: 'lang_2', language: 'French', proficiency: 'Professional Working Proficiency' },
    { id: 'lang_3', language: 'Yoruba', proficiency: 'Native' },
  ]);
  const [isLangModalOpen, setIsLangModalOpen] = useState(false);
  const [langForm, setLangForm] = useState({ id: '', language: '', proficiency: '' });

  const handleLangSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const updated = [...languagesList, { ...langForm, id: `lang_${Date.now()}` }];
    setLanguagesList(updated);
    if (onUpdateProfile) onUpdateProfile({ ...profile, languagesList: updated });
    showToast('Language added!');
    setIsLangModalOpen(false);
  };

  // ── Emergency Contact ──
  const [isEditingEmergency, setIsEditingEmergency] = useState(false);
  const [emergencyName, setEmergencyName] = useState(profile?.emergencyContact?.name || 'Adaeze Anya');
  const [emergencyRelation, setEmergencyRelation] = useState(profile?.emergencyContact?.relation || 'Spouse');
  const [emergencyPhone, setEmergencyPhone] = useState(profile?.emergencyContact?.phone || '+234 802 456 7890');
  const [emergencyEmail, setEmergencyEmail] = useState(profile?.emergencyContact?.email || 'adaeze.anya@gmail.com');

  const handleSaveEmergency = () => {
    if (onUpdateProfile) onUpdateProfile({ ...profile, emergencyContact: { name: emergencyName, relation: emergencyRelation, phone: emergencyPhone, email: emergencyEmail } });
    showToast('Emergency contact updated!');
    setIsEditingEmergency(false);
  };

  // ── Documents ──
  const [documents, setDocuments] = useState<any[]>(profile?.documents && profile.documents.length > 0 ? profile.documents : [
    { id: 'doc_1', name: 'Chidi_Anya_Resume_2026.pdf', category: 'CV / Resume', uploadedAt: '2026-05-15', fileSize: '1.2 MB', status: 'Verified' },
    { id: 'doc_2', name: 'Government_Passport_ID.pdf', category: 'Identity / Government ID', uploadedAt: '2026-05-18', fileSize: '2.4 MB', status: 'Verified' },
    { id: 'doc_3', name: 'Degree_Certificate_Computer_Science.pdf', category: 'Degree Certificate', uploadedAt: '2026-05-10', fileSize: '3.1 MB', status: 'Verified' },
    { id: 'doc_4', name: 'NDA_Signed_Horizon_Fintech.pdf', category: 'Legal / NDA', uploadedAt: '2026-05-20', fileSize: '0.8 MB', status: 'Verified' },
  ]);
  const [isDocModalOpen, setIsDocModalOpen] = useState(false);
  const [newDocName, setNewDocName] = useState('');
  const [newDocCategory, setNewDocCategory] = useState('CV / Resume');

  const handleDocUpload = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDocName.trim()) return;
    const newDoc = { id: `doc_${Date.now()}`, name: newDocName.endsWith('.pdf') ? newDocName : `${newDocName}.pdf`, category: newDocCategory, uploadedAt: new Date().toISOString().split('T')[0], fileSize: '1.4 MB', status: 'Verified' };
    const updated = [...documents, newDoc];
    setDocuments(updated);
    if (onUpdateProfile) onUpdateProfile({ ...profile, documents: updated });
    showToast('Document uploaded and verified!');
    setIsDocModalOpen(false);
    setNewDocName('');
  };

  // ── Projects ──
  const [projects, setProjects] = useState<any[]>(profile?.projects && profile.projects.length > 0 ? profile.projects : [
    { id: 'proj_1', title: 'Nebula Core Ledger Sync', role: 'Lead Architect', client: 'Nebula Systems', duration: '6 Months', techStack: 'PostgreSQL, Go, Redis', links: 'https://github.com/nebula-systems/core-sync', description: 'Designed and implemented a low-latency transactions synchronization ledger engine handling 12,000 req/s with complete consistency guarantees.' },
    { id: 'proj_2', title: 'Horizon Retain Portal', role: 'Senior Full-Stack Engineer', client: 'Horizon Fintech', duration: '4 Months', techStack: 'React, Node.js, AWS', links: 'https://horizon.com/portal', description: 'Rebuilt the customer payment retainer subsystem, decreasing subscription churn rate by 14% and resolving complex timezone alignment scheduling.' },
  ]);
  const [isProjModalOpen, setIsProjModalOpen] = useState(false);
  const [isEditingProj, setIsEditingProj] = useState(false);
  const [projForm, setProjForm] = useState({ id: '', title: '', role: '', client: '', duration: '', techStack: '', links: '', description: '' });

  const handleProjectSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    let updated;
    if (isEditingProj) {
      updated = projects.map(p => p.id === projForm.id ? { ...projForm } : p);
      showToast('Project updated!');
    } else {
      updated = [...projects, { ...projForm, id: `proj_${Date.now()}` }];
      showToast('Project added!');
    }
    setProjects(updated);
    if (onUpdateProfile) onUpdateProfile({ ...profile, projects: updated });
    setIsProjModalOpen(false);
  };

  // ── Certifications ──
  const [certsList, setCertsList] = useState<any[]>(profile?.certsList && profile.certsList.length > 0 ? profile.certsList : [
    { id: 'cert_1', name: 'AWS Certified Solutions Architect \u2013 Professional', issuer: 'Amazon Web Services', issueDate: '2024-03', expiryDate: '2027-03', verificationLink: 'https://aws.amazon.com/verification/12984-aws-cert', badgeImage: '' },
    { id: 'cert_2', name: 'Google Cloud Professional Cloud Architect', issuer: 'Google Cloud', issueDate: '2023-11', expiryDate: '2025-11', verificationLink: 'https://cloud.google.com/verification/83942-gcp-cert', badgeImage: '' },
    { id: 'cert_3', name: 'Certified Scrum Master (CSM)', issuer: 'Scrum Alliance', issueDate: '2023-06', expiryDate: '2025-06', verificationLink: 'https://scrumalliance.org/verify/1234567', badgeImage: '' },
  ]);
  const [isCertModalOpen, setIsCertModalOpen] = useState(false);
  const [isEditingCert, setIsEditingCert] = useState(false);
  const [certForm, setCertForm] = useState({ id: '', name: '', issuer: '', issueDate: '', expiryDate: '', verificationLink: '', badgeImage: '' });

  const handleCertSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    let updated;
    if (isEditingCert) {
      updated = certsList.map(c => c.id === certForm.id ? { ...certForm } : c);
      showToast('Certification updated!');
    } else {
      updated = [...certsList, { ...certForm, id: `cert_${Date.now()}` }];
      showToast('Certification added!');
    }
    setCertsList(updated);
    if (onUpdateProfile) onUpdateProfile({ ...profile, certsList: updated });
    setIsCertModalOpen(false);
  };

  // ── Styles ──
  const inputStyle: React.CSSProperties = { padding: '10px 14px', borderRadius: '8px', border: '1px solid #DDE2EC', background: '#FFFFFF', fontSize: '13px', color: '#1A2340', width: '100%', boxSizing: 'border-box' };
  const textareaStyle: React.CSSProperties = { ...inputStyle, minHeight: '80px', resize: 'vertical' as const };
  const labelStyle: React.CSSProperties = { fontSize: '10px', fontWeight: 800, color: '#6B7A99', textTransform: 'uppercase' as const, marginBottom: '6px', display: 'block', letterSpacing: '0.05em' };
  const editBtnStyle: React.CSSProperties = { background: '#EEF3FF', border: 'none', color: '#0047CC', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', fontWeight: 700, padding: '5px 12px', borderRadius: '6px' };
  const cancelBtnStyle: React.CSSProperties = { background: 'transparent', border: '1px solid #DDE2EC', color: '#6B7A99', borderRadius: '8px', padding: '8px 16px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' };
  const saveBtnStyle: React.CSSProperties = { background: '#0047CC', color: '#FFF', border: 'none', borderRadius: '8px', padding: '8px 20px', fontSize: '13px', fontWeight: 700, cursor: 'pointer' };

  const InfoGrid = ({ items }: { items: { label: string; value: string }[] }) => (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '20px' }}>
      {items.map((item, i) => (
        <div key={i}>
          <span style={labelStyle}>{item.label}</span>
          <span style={{ fontSize: '14px', fontWeight: 600, color: '#1A2340', display: 'block' }}>{item.value || '\u2014'}</span>
        </div>
      ))}
    </div>
  );

  const SectionCard = ({ title, onAdd, onEdit, children }: { title: string; onAdd?: () => void; onEdit?: () => void; children: React.ReactNode }) => (
    <Card>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', paddingBottom: '14px', borderBottom: '1px solid #F1F5F9' }}>
        <h3 style={{ fontSize: '15px', fontWeight: 800, color: '#1A2340', margin: 0 }}>{title}</h3>
        <div style={{ display: 'flex', gap: '8px' }}>
          {onEdit && <button onClick={onEdit} style={editBtnStyle}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>Edit</button>}
          {onAdd && <button onClick={onAdd} style={{ ...editBtnStyle, background: '#EEF3FF' }}>+ Add</button>}
        </div>
      </div>
      {children}
    </Card>
  );

  const Modal = ({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) => (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div style={{ background: '#fff', borderRadius: '16px', width: '100%', maxWidth: '560px', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 25px 60px rgba(0,0,0,0.2)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '24px 28px', borderBottom: '1px solid #F1F5F9' }}>
          <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 800, color: '#1A2340' }}>{title}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#6B7A99' }}>\u2715</button>
        </div>
        <div style={{ padding: '24px 28px' }}>{children}</div>
      </div>
    </div>
  );

  const proficiencyColors: Record<string, string> = { 'Native / Bilingual': '#0047CC', 'Native': '#0047CC', 'Professional Working Proficiency': '#00A389', 'Full Professional Proficiency': '#6366F1', 'Elementary': '#F59E0B', 'Limited Working Proficiency': '#F59E0B' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px', fontFamily: 'var(--font-display, Inter, sans-serif)' }}>

      {/* Toast */}
      {toastMsg && (
        <div style={{ position: 'fixed', top: '24px', right: '24px', background: '#1E293B', color: '#FFFFFF', padding: '14px 22px', borderRadius: '12px', zIndex: 9999, fontSize: '13px', fontWeight: 600, boxShadow: '0 10px 30px rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
          {toastMsg}
        </div>
      )}

      {/* Profile Header */}
      <Card style={{ padding: '36px', background: 'linear-gradient(135deg, #0F172A 0%, #1E3A5F 50%, #002B7F 100%)', color: '#FFFFFF', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: '-60px', right: '-60px', width: '220px', height: '220px', borderRadius: '50%', background: 'rgba(255,255,255,0.03)' }} />
        <div style={{ position: 'absolute', bottom: '-40px', left: '30%', width: '160px', height: '160px', borderRadius: '50%', background: 'rgba(0,71,204,0.15)' }} />
        {!isEditingHeader ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '28px', position: 'relative' }}>
            <div style={{ width: '96px', height: '96px', borderRadius: '50%', background: 'linear-gradient(135deg, #0047CC, #38BDF8)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '36px', fontWeight: 900, flexShrink: 0, border: '3px solid rgba(255,255,255,0.2)' }}>
              {fullName[0]?.toUpperCase()}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px' }}>
                <div>
                  <h1 style={{ fontSize: '26px', fontWeight: 900, margin: '0 0 4px 0', letterSpacing: '-0.5px', color: '#FFFFFF' }}>{fullName}</h1>
                  <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.65)', margin: '0 0 4px 0', fontWeight: 600 }}>{title}</p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'rgba(255,255,255,0.5)' }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>
                    {city}, {country}
                  </div>
                </div>
                <button onClick={() => setIsEditingHeader(true)} style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', fontWeight: 700, padding: '5px 12px', borderRadius: '6px' }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                  Edit
                </button>
              </div>
              <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.7)', margin: '14px 0 16px 0', lineHeight: 1.6, maxWidth: '600px' }}>{bio}</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {(Array.isArray(profile?.tags) ? profile.tags : tagsInput.split(',').map((t: string) => t.trim())).map((tag: string, i: number) => (
                  <span key={i} style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '20px', padding: '4px 12px', fontSize: '11px', fontWeight: 600, color: 'rgba(255,255,255,0.85)' }}>{tag}</span>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div style={{ position: 'relative' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 800, margin: '0 0 20px 0', color: '#fff' }}>Edit Profile Header</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
              <div><label style={{ ...labelStyle, color: 'rgba(255,255,255,0.5)' }}>Full Name</label><input value={fullName} onChange={e => setFullName(e.target.value)} style={{ ...inputStyle, background: 'rgba(255,255,255,0.08)', color: '#FFF', border: '1px solid rgba(255,255,255,0.15)' }} /></div>
              <div><label style={{ ...labelStyle, color: 'rgba(255,255,255,0.5)' }}>Job Title</label><input value={title} onChange={e => setTitle(e.target.value)} style={{ ...inputStyle, background: 'rgba(255,255,255,0.08)', color: '#FFF', border: '1px solid rgba(255,255,255,0.15)' }} /></div>
            </div>
            <div style={{ marginBottom: '14px' }}><label style={{ ...labelStyle, color: 'rgba(255,255,255,0.5)' }}>Bio / Summary</label><textarea value={bio} onChange={e => setBio(e.target.value)} style={{ ...textareaStyle, background: 'rgba(255,255,255,0.08)', color: '#FFF', border: '1px solid rgba(255,255,255,0.15)' }} /></div>
            <div style={{ marginBottom: '20px' }}><label style={{ ...labelStyle, color: 'rgba(255,255,255,0.5)' }}>Skills / Tags (comma-separated)</label><input value={tagsInput} onChange={e => setTagsInput(e.target.value)} style={{ ...inputStyle, background: 'rgba(255,255,255,0.08)', color: '#FFF', border: '1px solid rgba(255,255,255,0.15)' }} /></div>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button onClick={() => setIsEditingHeader(false)} style={{ ...cancelBtnStyle, background: 'rgba(255,255,255,0.1)', color: '#fff', border: '1px solid rgba(255,255,255,0.2)' }}>Cancel</button>
              <button onClick={handleSaveHeader} style={saveBtnStyle}>Save Changes</button>
            </div>
          </div>
        )}
      </Card>

      {/* Two-column layout */}
      <div className="db-grid-split-320" style={{ gap: '28px', alignItems: 'start' }}>

        {/* LEFT COLUMN */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>

          {/* Personal Information */}
          <SectionCard title="Personal Information" onEdit={() => setIsEditingPersonal(true)}>
            {!isEditingPersonal ? (
              <InfoGrid items={[
                { label: 'Full Name', value: fullName },
                { label: 'Email Address', value: profile?.email || user?.email || 'chidi.anya@kongila.dev' },
                { label: 'Phone Number', value: phone },
                { label: 'Date of Birth', value: dateOfBirth },
                { label: 'Gender', value: gender },
                { label: 'Nationality', value: nationality },
                { label: 'Marital Status', value: maritalStatus },
                { label: 'City', value: city },
                { label: 'Country', value: country },
                { label: 'Timezone', value: timezone },
                { label: 'National ID (NIN)', value: nationalId },
                { label: 'Passport Number', value: passportNo },
                { label: 'Residential Address', value: address },
              ]} />
            ) : (
              <div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
                  <div><label style={labelStyle}>Phone Number</label><input value={phone} onChange={e => setPhone(e.target.value)} style={inputStyle} /></div>
                  <div><label style={labelStyle}>Date of Birth</label><input type="date" value={dateOfBirth} onChange={e => setDateOfBirth(e.target.value)} style={inputStyle} /></div>
                  <div><label style={labelStyle}>Gender</label><select value={gender} onChange={e => setGender(e.target.value)} style={inputStyle}><option>Male</option><option>Female</option><option>Prefer not to say</option></select></div>
                  <div><label style={labelStyle}>Nationality</label><input value={nationality} onChange={e => setNationality(e.target.value)} style={inputStyle} /></div>
                  <div><label style={labelStyle}>Marital Status</label><select value={maritalStatus} onChange={e => setMaritalStatus(e.target.value)} style={inputStyle}><option>Single</option><option>Married</option><option>Divorced</option><option>Widowed</option></select></div>
                  <div><label style={labelStyle}>City</label><input value={city} onChange={e => setCity(e.target.value)} style={inputStyle} /></div>
                  <div><label style={labelStyle}>Country</label><input value={country} onChange={e => setCountry(e.target.value)} style={inputStyle} /></div>
                  <div><label style={labelStyle}>Timezone</label><input value={timezone} onChange={e => setTimezone(e.target.value)} style={inputStyle} /></div>
                  <div><label style={labelStyle}>National ID (NIN)</label><input value={nationalId} onChange={e => setNationalId(e.target.value)} style={inputStyle} /></div>
                  <div><label style={labelStyle}>Passport Number</label><input value={passportNo} onChange={e => setPassportNo(e.target.value)} style={inputStyle} /></div>
                </div>
                <div style={{ marginBottom: '14px' }}><label style={labelStyle}>Residential Address</label><input value={address} onChange={e => setAddress(e.target.value)} style={inputStyle} /></div>
                <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '16px', borderTop: '1px solid #F1F5F9', paddingTop: '16px' }}>
                  <button onClick={() => setIsEditingPersonal(false)} style={cancelBtnStyle}>Cancel</button>
                  <button onClick={handleSavePersonal} style={saveBtnStyle}>Save Changes</button>
                </div>
              </div>
            )}
          </SectionCard>

          {/* Professional Details */}
          <SectionCard title="Professional Details" onEdit={() => setIsEditingProfessional(true)}>
            {!isEditingProfessional ? (
              <div>
                <InfoGrid items={[
                  { label: 'Primary Role', value: primaryRole },
                  { label: 'Seniority Level', value: seniorityLevel },
                  { label: 'Years of Experience', value: `${yearsExperience} years` },
                  { label: 'Employment Preference', value: employmentPreference },
                  { label: 'Salary Expectation', value: `${currency} ${Number(salaryExpectation).toLocaleString()} / ${hourlyMonthly}` },
                  { label: 'Availability', value: `${availability}%` },
                  { label: 'LinkedIn', value: linkedIn },
                  { label: 'Portfolio / GitHub', value: portfolioUrl },
                ]} />
                <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid #F1F5F9' }}>
                  <span style={labelStyle}>Core Skills</span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '8px' }}>
                    {skills.split(',').map((s: string, i: number) => (
                      <span key={i} style={{ background: '#EEF3FF', color: '#0047CC', border: '1px solid rgba(0,71,204,0.15)', borderRadius: '20px', padding: '4px 12px', fontSize: '12px', fontWeight: 600 }}>{s.trim()}</span>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
                  <div><label style={labelStyle}>Primary Role</label><input value={primaryRole} onChange={e => setPrimaryRole(e.target.value)} style={inputStyle} /></div>
                  <div><label style={labelStyle}>Seniority Level</label><select value={seniorityLevel} onChange={e => setSeniorityLevel(e.target.value)} style={inputStyle}><option>Junior</option><option>Mid-Level</option><option>Senior</option><option>Lead</option><option>Principal</option><option>Executive</option></select></div>
                  <div><label style={labelStyle}>Years of Experience</label><input type="number" value={yearsExperience} onChange={e => setYearsExperience(Number(e.target.value))} style={inputStyle} /></div>
                  <div><label style={labelStyle}>Employment Preference</label><select value={employmentPreference} onChange={e => setEmploymentPreference(e.target.value)} style={inputStyle}><option>Full Time</option><option>Part Time</option><option>Contract</option><option>Freelance</option></select></div>
                  <div><label style={labelStyle}>Salary Expectation</label><input type="number" value={salaryExpectation} onChange={e => setSalaryExpectation(Number(e.target.value))} style={inputStyle} /></div>
                  <div><label style={labelStyle}>Currency</label><select value={currency} onChange={e => setCurrency(e.target.value)} style={inputStyle}><option>USD</option><option>EUR</option><option>GBP</option><option>NGN</option></select></div>
                  <div><label style={labelStyle}>Hourly / Monthly</label><select value={hourlyMonthly} onChange={e => setHourlyMonthly(e.target.value)} style={inputStyle}><option>Monthly</option><option>Hourly</option></select></div>
                  <div><label style={labelStyle}>Availability (% / week)</label><input type="number" min="0" max="100" value={availability} onChange={e => setAvailability(Number(e.target.value))} style={inputStyle} /></div>
                  <div style={{ gridColumn: '1/-1' }}><label style={labelStyle}>LinkedIn URL</label><input value={linkedIn} onChange={e => setLinkedIn(e.target.value)} style={inputStyle} /></div>
                  <div style={{ gridColumn: '1/-1' }}><label style={labelStyle}>Portfolio / GitHub URL</label><input value={portfolioUrl} onChange={e => setPortfolioUrl(e.target.value)} style={inputStyle} /></div>
                  <div style={{ gridColumn: '1/-1' }}><label style={labelStyle}>Core Skills (comma-separated)</label><input value={skills} onChange={e => setSkills(e.target.value)} style={inputStyle} /></div>
                </div>
                <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', borderTop: '1px solid #F1F5F9', paddingTop: '16px' }}>
                  <button onClick={() => setIsEditingProfessional(false)} style={cancelBtnStyle}>Cancel</button>
                  <button onClick={handleSaveProfessional} style={saveBtnStyle}>Save Changes</button>
                </div>
              </div>
            )}
          </SectionCard>

          {/* Remote Work Setup */}
          <SectionCard title="Remote Work Setup" onEdit={() => setIsEditingSetup(true)}>
            {!isEditingSetup ? (
              <InfoGrid items={[
                { label: 'Internet Quality', value: internetQuality },
                { label: 'Work Setup', value: workSetup },
                { label: 'Devices', value: devices },
                { label: 'Communication Tools', value: communicationTools },
              ]} />
            ) : (
              <div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '14px' }}>
                  <div><label style={labelStyle}>Internet Quality</label><input value={internetQuality} onChange={e => setInternetQuality(e.target.value)} style={inputStyle} /></div>
                  <div><label style={labelStyle}>Work Setup Description</label><input value={workSetup} onChange={e => setWorkSetup(e.target.value)} style={inputStyle} /></div>
                  <div><label style={labelStyle}>Devices</label><input value={devices} onChange={e => setDevices(e.target.value)} style={inputStyle} /></div>
                  <div><label style={labelStyle}>Communication Tools</label><input value={communicationTools} onChange={e => setCommunicationTools(e.target.value)} style={inputStyle} /></div>
                </div>
                <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', borderTop: '1px solid #F1F5F9', paddingTop: '16px' }}>
                  <button onClick={() => setIsEditingSetup(false)} style={cancelBtnStyle}>Cancel</button>
                  <button onClick={handleSaveSetup} style={saveBtnStyle}>Save Changes</button>
                </div>
              </div>
            )}
          </SectionCard>

          {/* Work Experience */}
          <SectionCard title="Work Experience" onAdd={() => { setIsEditingWork(false); setWorkForm({ id: '', company: '', role: '', startDate: '', endDate: '', location: '', description: '' }); setIsWorkModalOpen(true); }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {workExperience.map((we) => (
                <div key={we.id} style={{ borderLeft: '3px solid #0047CC', paddingLeft: '18px', paddingBottom: '16px', borderBottom: '1px solid #F1F5F9' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ fontSize: '15px', fontWeight: 800, color: '#1A2340' }}>{we.role}</div>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: '#0047CC', marginTop: '2px' }}>{we.company}</div>
                      <div style={{ fontSize: '12px', color: '#6B7A99', marginTop: '4px', display: 'flex', gap: '12px' }}>
                        <span>{we.startDate} \u2014 {we.endDate}</span>
                        {we.location && <span>\u00b7 {we.location}</span>}
                      </div>
                    </div>
                    <button onClick={() => { setWorkForm(we); setIsEditingWork(true); setIsWorkModalOpen(true); }} style={{ ...editBtnStyle, fontSize: '11px', padding: '3px 8px' }}>Edit</button>
                  </div>
                  {we.description && <p style={{ fontSize: '13px', color: '#4E5D78', lineHeight: 1.6, marginTop: '10px', marginBottom: 0 }}>{we.description}</p>}
                </div>
              ))}
            </div>
          </SectionCard>

          {/* Education */}
          <SectionCard title="Education" onAdd={() => { setIsEditingEdu(false); setEduForm({ id: '', institution: '', degree: '', startYear: '', endYear: '', grade: '', description: '' }); setIsEduModalOpen(true); }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {educationList.map((edu) => (
                <div key={edu.id} style={{ borderLeft: '3px solid #6366F1', paddingLeft: '18px', paddingBottom: '16px', borderBottom: '1px solid #F1F5F9' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ fontSize: '15px', fontWeight: 800, color: '#1A2340' }}>{edu.degree}</div>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: '#6366F1', marginTop: '2px' }}>{edu.institution}</div>
                      <div style={{ fontSize: '12px', color: '#6B7A99', marginTop: '4px', display: 'flex', gap: '12px' }}>
                        <span>{edu.startYear} \u2014 {edu.endYear}</span>
                        {edu.grade && <span>\u00b7 {edu.grade}</span>}
                      </div>
                    </div>
                    <button onClick={() => { setEduForm(edu); setIsEditingEdu(true); setIsEduModalOpen(true); }} style={{ ...editBtnStyle, fontSize: '11px', padding: '3px 8px' }}>Edit</button>
                  </div>
                  {edu.description && <p style={{ fontSize: '13px', color: '#4E5D78', lineHeight: 1.6, marginTop: '10px', marginBottom: 0 }}>{edu.description}</p>}
                </div>
              ))}
            </div>
          </SectionCard>

          {/* Languages */}
          <SectionCard title="Languages" onAdd={() => { setLangForm({ id: '', language: '', proficiency: '' }); setIsLangModalOpen(true); }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {languagesList.map((lang) => {
                const c = proficiencyColors[lang.proficiency] || '#6B7A99';
                return (
                  <div key={lang.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: '#FAFBFF', border: '1px solid #E8EDFF', borderRadius: '10px' }}>
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                      <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: `${c}15`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" /></svg>
                      </div>
                      <span style={{ fontSize: '14px', fontWeight: 700, color: '#1A2340' }}>{lang.language}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ background: `${c}15`, color: c, border: `1px solid ${c}30`, borderRadius: '20px', padding: '3px 10px', fontSize: '11px', fontWeight: 700 }}>{lang.proficiency}</span>
                      <button onClick={() => { const updated = languagesList.filter(l => l.id !== lang.id); setLanguagesList(updated); if (onUpdateProfile) onUpdateProfile({ ...profile, languagesList: updated }); }} style={{ background: 'none', border: 'none', color: '#EF4444', cursor: 'pointer', fontSize: '14px', padding: '2px 6px' }}>\u2715</button>
                    </div>
                  </div>
                );
              })}
            </div>
          </SectionCard>

          {/* Emergency Contact */}
          <SectionCard title="Emergency Contact" onEdit={() => setIsEditingEmergency(true)}>
            {!isEditingEmergency ? (
              <InfoGrid items={[
                { label: 'Full Name', value: emergencyName },
                { label: 'Relationship', value: emergencyRelation },
                { label: 'Phone Number', value: emergencyPhone },
                { label: 'Email Address', value: emergencyEmail },
              ]} />
            ) : (
              <div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
                  <div><label style={labelStyle}>Full Name</label><input value={emergencyName} onChange={e => setEmergencyName(e.target.value)} style={inputStyle} /></div>
                  <div><label style={labelStyle}>Relationship</label><input value={emergencyRelation} onChange={e => setEmergencyRelation(e.target.value)} style={inputStyle} /></div>
                  <div><label style={labelStyle}>Phone Number</label><input value={emergencyPhone} onChange={e => setEmergencyPhone(e.target.value)} style={inputStyle} /></div>
                  <div><label style={labelStyle}>Email Address</label><input value={emergencyEmail} onChange={e => setEmergencyEmail(e.target.value)} style={inputStyle} /></div>
                </div>
                <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', borderTop: '1px solid #F1F5F9', paddingTop: '16px' }}>
                  <button onClick={() => setIsEditingEmergency(false)} style={cancelBtnStyle}>Cancel</button>
                  <button onClick={handleSaveEmergency} style={saveBtnStyle}>Save Changes</button>
                </div>
              </div>
            )}
          </SectionCard>

          {/* Personal Document Vault */}
          <SectionCard title="Personal Document Vault" onAdd={() => { setNewDocName(''); setNewDocCategory('CV / Resume'); setIsDocModalOpen(true); }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {documents.map(doc => (
                <div key={doc.id} style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '14px 16px', background: '#FAFBFF', border: '1px solid #E8EDFF', borderRadius: '10px' }}>
                  <div style={{ width: '38px', height: '38px', borderRadius: '8px', background: '#EEF3FF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0047CC" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: '#1A2340', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{doc.name}</div>
                    <div style={{ fontSize: '11px', color: '#6B7A99', marginTop: '2px' }}>{doc.category} \u00b7 {doc.fileSize} \u00b7 {doc.uploadedAt}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
                    <span style={{ background: '#E6FFF6', color: '#00A389', border: '1px solid rgba(0,163,137,0.2)', borderRadius: '20px', padding: '3px 10px', fontSize: '10px', fontWeight: 800 }}>VERIFIED</span>
                    <button onClick={() => { const updated = documents.filter(d => d.id !== doc.id); setDocuments(updated); if (onUpdateProfile) onUpdateProfile({ ...profile, documents: updated }); showToast('Document removed.'); }} style={{ background: 'none', border: 'none', color: '#EF4444', cursor: 'pointer', fontSize: '14px', padding: '2px 6px' }}>\u2715</button>
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>

          {/* Project Experience */}
          <SectionCard title="Project Experience" onAdd={() => { setIsEditingProj(false); setProjForm({ id: '', title: '', role: '', client: '', duration: '', techStack: '', links: '', description: '' }); setIsProjModalOpen(true); }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {projects.map(proj => (
                <div key={proj.id} style={{ border: '1px solid #E2E8F0', borderRadius: '12px', padding: '20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                    <div>
                      <div style={{ fontSize: '15px', fontWeight: 800, color: '#1A2340' }}>{proj.title}</div>
                      <div style={{ fontSize: '12px', color: '#6B7A99', marginTop: '4px', display: 'flex', gap: '10px' }}>
                        <span style={{ fontWeight: 600, color: '#0047CC' }}>{proj.role}</span>
                        {proj.client && <span>\u00b7 {proj.client}</span>}
                        {proj.duration && <span>\u00b7 {proj.duration}</span>}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button onClick={() => { setProjForm(proj); setIsEditingProj(true); setIsProjModalOpen(true); }} style={{ ...editBtnStyle, fontSize: '11px', padding: '3px 8px' }}>Edit</button>
                      <button onClick={() => { const updated = projects.filter(p => p.id !== proj.id); setProjects(updated); if (onUpdateProfile) onUpdateProfile({ ...profile, projects: updated }); showToast('Project removed.'); }} style={{ background: '#FFF1F1', color: '#EF4444', border: 'none', borderRadius: '6px', padding: '3px 8px', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}>Remove</button>
                    </div>
                  </div>
                  <p style={{ fontSize: '13px', color: '#4E5D78', lineHeight: 1.6, margin: '0 0 12px 0' }}>{proj.description}</p>
                  {proj.techStack && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '10px' }}>
                      {proj.techStack.split(',').map((t: string, i: number) => (
                        <span key={i} style={{ background: '#F1F5F9', border: '1px solid #E2E8F0', borderRadius: '4px', padding: '3px 8px', fontSize: '11px', fontWeight: 600, color: '#334155' }}>{t.trim()}</span>
                      ))}
                    </div>
                  )}
                  {proj.links && <a href={proj.links} target="_blank" rel="noopener noreferrer" style={{ fontSize: '12px', color: '#0047CC', fontWeight: 600, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></svg>
                    {proj.links}
                  </a>}
                </div>
              ))}
            </div>
          </SectionCard>

          {/* Professional Certifications */}
          <SectionCard title="Professional Certifications" onAdd={() => { setIsEditingCert(false); setCertForm({ id: '', name: '', issuer: '', issueDate: '', expiryDate: '', verificationLink: '', badgeImage: '' }); setIsCertModalOpen(true); }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {certsList.map(cert => (
                <div key={cert.id} style={{ display: 'flex', gap: '16px', padding: '16px', border: '1px solid #E2E8F0', borderRadius: '12px', alignItems: 'center' }}>
                  <div style={{ width: '48px', height: '48px', borderRadius: '10px', background: 'linear-gradient(135deg, #EEF3FF, #E0E7FF)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#0047CC" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" /><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" /><path d="M4 22h16" /><path d="M10 14.66V17c0 .55-.45 1-1 1H4v2h16v-2h-5c-.55 0-1-.45-1-1v-2.34" /></svg>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '14px', fontWeight: 800, color: '#1A2340', marginBottom: '2px' }}>{cert.name}</div>
                    {cert.issuer && <div style={{ fontSize: '12px', color: '#6B7A99', marginBottom: '4px' }}>{cert.issuer}{cert.issueDate ? ` \u00b7 Issued ${cert.issueDate}` : ''}{cert.expiryDate ? ` \u00b7 Expires ${cert.expiryDate}` : ''}</div>}
                    {cert.verificationLink && <a href={cert.verificationLink} target="_blank" rel="noopener noreferrer" style={{ fontSize: '11px', color: '#0047CC', fontWeight: 600, textDecoration: 'none' }}>Verify Credential \u2192</a>}
                  </div>
                  <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                    <button onClick={() => { setCertForm(cert); setIsEditingCert(true); setIsCertModalOpen(true); }} style={{ ...editBtnStyle, fontSize: '11px', padding: '3px 8px' }}>Edit</button>
                    <button onClick={() => { const updated = certsList.filter(c => c.id !== cert.id); setCertsList(updated); if (onUpdateProfile) onUpdateProfile({ ...profile, certsList: updated }); showToast('Certification removed.'); }} style={{ background: '#FFF1F1', color: '#EF4444', border: 'none', borderRadius: '6px', padding: '3px 8px', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}>Remove</button>
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>

        </div>

        {/* RIGHT COLUMN */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>

          {/* Vetting Framework */}
          <Card style={{ background: 'linear-gradient(135deg, #1A2340, #0F172A)', color: '#FFFFFF' }}>
            <h3 style={{ fontSize: '13px', fontWeight: 800, margin: '0 0 20px 0', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'rgba(255,255,255,0.6)' }}>Vetting Framework</h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '20px' }}>
              <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'linear-gradient(135deg, #0047CC, #38BDF8)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '28px', fontWeight: 900, flexShrink: 0, border: '3px solid rgba(255,255,255,0.15)' }}>
                {grade}
              </div>
              <div>
                <div style={{ fontSize: '20px', fontWeight: 900 }}>{vettingStatus}</div>
                <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.55)', marginTop: '4px' }}>Stage: {vettingStage}</div>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {Object.entries(vettingScores).map(([key, val]: [string, any]) => (
                <div key={key}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: 'rgba(255,255,255,0.6)', textTransform: 'capitalize' }}>{key}</span>
                    <span style={{ fontSize: '11px', fontWeight: 800, color: '#38BDF8' }}>{val}/100</span>
                  </div>
                  <div style={{ height: '6px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px' }}>
                    <div style={{ width: `${val}%`, height: '100%', background: 'linear-gradient(90deg, #0047CC, #38BDF8)', borderRadius: '3px' }} />
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Assigned Manager */}
          <Card>
            <h3 style={{ fontSize: '13px', fontWeight: 800, color: '#1A2340', margin: '0 0 16px 0', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Assigned Manager</h3>
            <div style={{ display: 'flex', gap: '14px', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ width: '52px', height: '52px', borderRadius: '50%', background: 'linear-gradient(135deg, #6366F1, #8B5CF6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', fontWeight: 900, color: '#fff', flexShrink: 0 }}>
                {(profile?.assignedManager?.name || 'Sarah Chen')[0]}
              </div>
              <div>
                <div style={{ fontSize: '15px', fontWeight: 800, color: '#1A2340' }}>{profile?.assignedManager?.name || 'Sarah Chen'}</div>
                <div style={{ fontSize: '12px', color: '#6B7A99' }}>{profile?.assignedManager?.role || 'Senior Talent Success Manager'}</div>
                <div style={{ fontSize: '11px', color: '#10B981', marginTop: '3px', fontWeight: 600 }}>\u25cf Online \u2014 Avg. response &lt;2h</div>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12px', color: '#6B7A99', borderTop: '1px solid #F1F5F9', paddingTop: '14px' }}>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" /></svg>
                {profile?.assignedManager?.email || 's.chen@kongila.com'}
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.56 1.18h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.73a16 16 0 0 0 5.99 6l.92-.93a2 2 0 0 1 2.11-.45c.906.338 1.85.573 2.81.7A2 2 0 0 1 21.73 16z" /></svg>
                {profile?.assignedManager?.phone || '+44 20 7946 0958'}
              </div>
            </div>
          </Card>

          {/* Account Status */}
          <Card>
            <h3 style={{ fontSize: '13px', fontWeight: 800, color: '#1A2340', margin: '0 0 16px 0', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Account Status</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {[
                { label: 'Profile Completeness', value: '94%', color: '#0047CC', progress: 94 },
                { label: 'Document Verification', value: 'Complete', color: '#10B981', progress: 100 },
                { label: 'Identity Verified', value: 'Verified', color: '#10B981', progress: 100 },
                { label: 'Background Check', value: 'Pending', color: '#F59E0B', progress: 40 },
              ].map((item) => (
                <div key={item.label}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ fontSize: '12px', color: '#6B7A99', fontWeight: 500 }}>{item.label}</span>
                    <span style={{ fontSize: '12px', fontWeight: 700, color: item.color }}>{item.value}</span>
                  </div>
                  <div style={{ height: '5px', background: '#F1F5F9', borderRadius: '3px' }}>
                    <div style={{ width: `${item.progress}%`, height: '100%', background: item.color, borderRadius: '3px' }} />
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Quick Actions */}
          <Card>
            <h3 style={{ fontSize: '13px', fontWeight: 800, color: '#1A2340', margin: '0 0 14px 0', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Quick Actions</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {[
                { label: 'Download Full Profile PDF', icon: '\u2b07', color: '#0047CC' },
                { label: 'Share Profile Link', icon: '\ud83d\udd17', color: '#6366F1' },
                { label: 'Request Profile Review', icon: '\ud83d\udc41', color: '#00A389' },
              ].map((action) => (
                <button key={action.label} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', background: '#F8FAFC', border: '1px solid #E8EDFF', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: 600, color: '#1A2340', textAlign: 'left', width: '100%' }}>
                  <span style={{ color: action.color }}>{action.icon}</span>
                  {action.label}
                </button>
              ))}
            </div>
          </Card>

        </div>
      </div>

      {/* ── Modals ── */}
      {isWorkModalOpen && (
        <Modal title={isEditingWork ? 'Edit Work Experience' : 'Add Work Experience'} onClose={() => setIsWorkModalOpen(false)}>
          <form onSubmit={handleWorkSubmit}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
              <div style={{ gridColumn: '1/-1' }}><label style={labelStyle}>Company / Organisation</label><input required value={workForm.company} onChange={e => setWorkForm(f => ({ ...f, company: e.target.value }))} style={inputStyle} placeholder="e.g. Horizon Fintech Ltd" /></div>
              <div style={{ gridColumn: '1/-1' }}><label style={labelStyle}>Job Title / Role</label><input required value={workForm.role} onChange={e => setWorkForm(f => ({ ...f, role: e.target.value }))} style={inputStyle} placeholder="e.g. Senior Software Engineer" /></div>
              <div><label style={labelStyle}>Start Date</label><input value={workForm.startDate} onChange={e => setWorkForm(f => ({ ...f, startDate: e.target.value }))} style={inputStyle} placeholder="e.g. 2022-01" /></div>
              <div><label style={labelStyle}>End Date</label><input value={workForm.endDate} onChange={e => setWorkForm(f => ({ ...f, endDate: e.target.value }))} style={inputStyle} placeholder="e.g. Present" /></div>
              <div style={{ gridColumn: '1/-1' }}><label style={labelStyle}>Location</label><input value={workForm.location} onChange={e => setWorkForm(f => ({ ...f, location: e.target.value }))} style={inputStyle} placeholder="e.g. Lagos, Nigeria (Remote)" /></div>
              <div style={{ gridColumn: '1/-1' }}><label style={labelStyle}>Description</label><textarea value={workForm.description} onChange={e => setWorkForm(f => ({ ...f, description: e.target.value }))} style={textareaStyle} placeholder="Describe your responsibilities and achievements..." /></div>
            </div>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', borderTop: '1px solid #F1F5F9', paddingTop: '16px' }}>
              <button type="button" onClick={() => setIsWorkModalOpen(false)} style={cancelBtnStyle}>Cancel</button>
              <button type="submit" style={saveBtnStyle}>{isEditingWork ? 'Update' : 'Add'} Experience</button>
            </div>
          </form>
        </Modal>
      )}
      {isEduModalOpen && (
        <Modal title={isEditingEdu ? 'Edit Education' : 'Add Education'} onClose={() => setIsEduModalOpen(false)}>
          <form onSubmit={handleEduSubmit}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
              <div style={{ gridColumn: '1/-1' }}><label style={labelStyle}>Institution</label><input required value={eduForm.institution} onChange={e => setEduForm(f => ({ ...f, institution: e.target.value }))} style={inputStyle} placeholder="e.g. University of Lagos" /></div>
              <div style={{ gridColumn: '1/-1' }}><label style={labelStyle}>Degree / Qualification</label><input required value={eduForm.degree} onChange={e => setEduForm(f => ({ ...f, degree: e.target.value }))} style={inputStyle} placeholder="e.g. B.Sc. Computer Science" /></div>
              <div><label style={labelStyle}>Start Year</label><input value={eduForm.startYear} onChange={e => setEduForm(f => ({ ...f, startYear: e.target.value }))} style={inputStyle} placeholder="e.g. 2009" /></div>
              <div><label style={labelStyle}>End Year</label><input value={eduForm.endYear} onChange={e => setEduForm(f => ({ ...f, endYear: e.target.value }))} style={inputStyle} placeholder="e.g. 2013" /></div>
              <div style={{ gridColumn: '1/-1' }}><label style={labelStyle}>Grade / Classification</label><input value={eduForm.grade} onChange={e => setEduForm(f => ({ ...f, grade: e.target.value }))} style={inputStyle} placeholder="e.g. First Class Honours" /></div>
              <div style={{ gridColumn: '1/-1' }}><label style={labelStyle}>Description (optional)</label><textarea value={eduForm.description} onChange={e => setEduForm(f => ({ ...f, description: e.target.value }))} style={textareaStyle} placeholder="Relevant coursework, thesis, activities..." /></div>
            </div>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', borderTop: '1px solid #F1F5F9', paddingTop: '16px' }}>
              <button type="button" onClick={() => setIsEduModalOpen(false)} style={cancelBtnStyle}>Cancel</button>
              <button type="submit" style={saveBtnStyle}>{isEditingEdu ? 'Update' : 'Add'} Education</button>
            </div>
          </form>
        </Modal>
      )}
      {isLangModalOpen && (
        <Modal title="Add Language" onClose={() => setIsLangModalOpen(false)}>
          <form onSubmit={handleLangSubmit}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '14px' }}>
              <div><label style={labelStyle}>Language</label><input required value={langForm.language} onChange={e => setLangForm(f => ({ ...f, language: e.target.value }))} style={inputStyle} placeholder="e.g. French" /></div>
              <div><label style={labelStyle}>Proficiency Level</label>
                <select required value={langForm.proficiency} onChange={e => setLangForm(f => ({ ...f, proficiency: e.target.value }))} style={inputStyle}>
                  <option value="">Select proficiency...</option>
                  <option>Native / Bilingual</option><option>Full Professional Proficiency</option>
                  <option>Professional Working Proficiency</option><option>Limited Working Proficiency</option><option>Elementary</option>
                </select>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', borderTop: '1px solid #F1F5F9', paddingTop: '16px' }}>
              <button type="button" onClick={() => setIsLangModalOpen(false)} style={cancelBtnStyle}>Cancel</button>
              <button type="submit" style={saveBtnStyle}>Add Language</button>
            </div>
          </form>
        </Modal>
      )}
      {isDocModalOpen && (
        <Modal title="Upload Document" onClose={() => setIsDocModalOpen(false)}>
          <form onSubmit={handleDocUpload}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '14px' }}>
              <div><label style={labelStyle}>Document Name</label><input required value={newDocName} onChange={e => setNewDocName(e.target.value)} style={inputStyle} placeholder="e.g. Work_Reference_Letter_2026.pdf" /></div>
              <div><label style={labelStyle}>Document Category</label>
                <select value={newDocCategory} onChange={e => setNewDocCategory(e.target.value)} style={inputStyle}>
                  <option>CV / Resume</option><option>Identity / Government ID</option><option>Degree Certificate</option>
                  <option>Professional Reference</option><option>Legal / NDA</option><option>Portfolio</option><option>Other</option>
                </select>
              </div>
              <div style={{ border: '2px dashed #DDE2EC', borderRadius: '10px', padding: '30px', textAlign: 'center', cursor: 'pointer', background: '#FAFBFF' }}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#0047CC" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ margin: '0 auto 8px', display: 'block' }}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>
                <p style={{ fontSize: '13px', color: '#6B7A99', margin: 0 }}>Click to upload or drag and drop</p>
                <p style={{ fontSize: '11px', color: '#9CA3AF', margin: '4px 0 0 0' }}>PDF, JPG, PNG up to 10MB</p>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', borderTop: '1px solid #F1F5F9', paddingTop: '16px' }}>
              <button type="button" onClick={() => setIsDocModalOpen(false)} style={cancelBtnStyle}>Cancel</button>
              <button type="submit" style={saveBtnStyle}>Upload Document</button>
            </div>
          </form>
        </Modal>
      )}
      {isProjModalOpen && (
        <Modal title={isEditingProj ? 'Edit Project' : 'Add Project'} onClose={() => setIsProjModalOpen(false)}>
          <form onSubmit={handleProjectSubmit}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
              <div style={{ gridColumn: '1/-1' }}><label style={labelStyle}>Project Title</label><input required value={projForm.title} onChange={e => setProjForm(f => ({ ...f, title: e.target.value }))} style={inputStyle} placeholder="e.g. Payment Gateway Rebuild" /></div>
              <div><label style={labelStyle}>Your Role</label><input value={projForm.role} onChange={e => setProjForm(f => ({ ...f, role: e.target.value }))} style={inputStyle} placeholder="e.g. Lead Architect" /></div>
              <div><label style={labelStyle}>Client / Organisation</label><input value={projForm.client} onChange={e => setProjForm(f => ({ ...f, client: e.target.value }))} style={inputStyle} placeholder="e.g. Horizon Fintech" /></div>
              <div><label style={labelStyle}>Duration</label><input value={projForm.duration} onChange={e => setProjForm(f => ({ ...f, duration: e.target.value }))} style={inputStyle} placeholder="e.g. 4 Months" /></div>
              <div><label style={labelStyle}>Tech Stack</label><input value={projForm.techStack} onChange={e => setProjForm(f => ({ ...f, techStack: e.target.value }))} style={inputStyle} placeholder="e.g. React, Node.js, AWS" /></div>
              <div style={{ gridColumn: '1/-1' }}><label style={labelStyle}>Project Link (optional)</label><input type="url" value={projForm.links} onChange={e => setProjForm(f => ({ ...f, links: e.target.value }))} style={inputStyle} placeholder="https://github.com/..." /></div>
              <div style={{ gridColumn: '1/-1' }}><label style={labelStyle}>Description</label><textarea required value={projForm.description} onChange={e => setProjForm(f => ({ ...f, description: e.target.value }))} style={textareaStyle} placeholder="Describe what you built, your impact, key results..." /></div>
            </div>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', borderTop: '1px solid #F1F5F9', paddingTop: '16px' }}>
              <button type="button" onClick={() => setIsProjModalOpen(false)} style={cancelBtnStyle}>Cancel</button>
              <button type="submit" style={saveBtnStyle}>{isEditingProj ? 'Update' : 'Add'} Project</button>
            </div>
          </form>
        </Modal>
      )}
      {isCertModalOpen && (
        <Modal title={isEditingCert ? 'Edit Certification' : 'Add Certification'} onClose={() => setIsCertModalOpen(false)}>
          <form onSubmit={handleCertSubmit}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
              <div style={{ gridColumn: '1/-1' }}><label style={labelStyle}>Certification Name</label><input required value={certForm.name} onChange={e => setCertForm(f => ({ ...f, name: e.target.value }))} style={inputStyle} placeholder="e.g. AWS Certified Solutions Architect" /></div>
              <div style={{ gridColumn: '1/-1' }}><label style={labelStyle}>Issuing Organisation</label><input value={certForm.issuer} onChange={e => setCertForm(f => ({ ...f, issuer: e.target.value }))} style={inputStyle} placeholder="e.g. Amazon Web Services" /></div>
              <div><label style={labelStyle}>Issue Date</label><input value={certForm.issueDate} onChange={e => setCertForm(f => ({ ...f, issueDate: e.target.value }))} style={inputStyle} placeholder="e.g. 2024-03" /></div>
              <div><label style={labelStyle}>Expiry Date</label><input value={certForm.expiryDate} onChange={e => setCertForm(f => ({ ...f, expiryDate: e.target.value }))} style={inputStyle} placeholder="e.g. 2027-03 or N/A" /></div>
              <div style={{ gridColumn: '1/-1' }}><label style={labelStyle}>Verification Link (optional)</label><input type="url" value={certForm.verificationLink} onChange={e => setCertForm(f => ({ ...f, verificationLink: e.target.value }))} style={inputStyle} placeholder="https://..." /></div>
              <div style={{ gridColumn: '1/-1' }}><label style={labelStyle}>Badge Image URL (optional)</label><input value={certForm.badgeImage} onChange={e => setCertForm(f => ({ ...f, badgeImage: e.target.value }))} style={inputStyle} placeholder="https://..." /></div>
            </div>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', borderTop: '1px solid #F1F5F9', paddingTop: '16px' }}>
              <button type="button" onClick={() => setIsCertModalOpen(false)} style={cancelBtnStyle}>Cancel</button>
              <button type="submit" style={saveBtnStyle}>{isEditingCert ? 'Update' : 'Add'} Certification</button>
            </div>
          </form>
        </Modal>
      )}

    </div>
  );
};

// ─── Section 7.5: Settings Section ───────────────────────────────────────────
const SettingsSection = ({ profile, onUpdateProfile }: { profile: any; onUpdateProfile?: (p: any) => void }) => {
  const [activeTab, setActiveTab] = useState<'account' | 'notifications' | 'privacy'>('account');
  const [email, setEmail] = useState(profile?.user?.email || 'chidi.anya@example.com');
  const [phone, setPhone] = useState(profile?.phone || '+234 809 123 4567');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  useEffect(() => {
    if (profile) {
      if (profile.user?.email) setEmail(profile.user.email);
      if (profile.phone) setPhone(profile.phone);
    }
  }, [profile]);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword && newPassword.length < 12) {
      alert('Password must be at least 12 characters long.');
      return;
    }
    
    if (onUpdateProfile) {
      onUpdateProfile({
        ...profile,
        phone,
        user: profile.user ? { ...profile.user, email } : undefined
      });
    }

    setToastMsg('Settings updated successfully!');
    setCurrentPassword('');
    setNewPassword('');
    
    setTimeout(() => {
      setToastMsg(null);
    }, 4000);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div>
        <h2 style={{ fontSize: '24px', fontWeight: 800, color: '#1A2340', marginBottom: '6px' }}>Settings</h2>
        <p style={{ fontSize: '14px', color: '#6B7A99', margin: 0 }}>
          Manage your account preferences and security protocols.
        </p>
      </div>

      {toastMsg && (
        <div style={{
          background: '#00A3A0', color: '#FFFFFF', padding: '12px 24px',
          borderRadius: '8px', fontSize: '14px', fontWeight: 600,
          boxShadow: '0 4px 12px rgba(0,163,160,0.2)', transition: 'all 0.3s'
        }}>
          ✓ {toastMsg}
        </div>
      )}

      <div style={{ display: 'flex', gap: '32px', flexWrap: 'wrap' }}>
        
        {/* Left Side Tabs */}
        <div style={{ width: '220px', display: 'flex', flexDirection: 'column', gap: '4px', flexShrink: 0 }}>
          {[
            { id: 'account', label: 'Account', icon: '👤' },
            { id: 'notifications', label: 'Notifications', icon: '🔔' },
            { id: 'privacy', label: 'Privacy & Security', icon: '🔒' }
          ].map(tab => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '10px',
                  padding: '12px 16px', borderRadius: '8px', border: 'none',
                  background: isActive ? '#EEF3FF' : 'transparent',
                  color: isActive ? '#0047CC' : '#6B7A99',
                  fontWeight: isActive ? 700 : 500,
                  fontSize: '13px', cursor: 'pointer', textAlign: 'left',
                  transition: 'all 0.15s', width: '100%'
                }}
              >
                <span style={{ fontSize: '15px' }}>{tab.icon}</span>
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Right Side Form Panel */}
        <div style={{ flex: 1, minWidth: '320px' }}>
          <Card style={{ padding: '32px' }}>
            
            {activeTab === 'account' && (
              <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                <div>
                  <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#1A2340', margin: '0 0 6px 0' }}>Account Information</h3>
                  <p style={{ fontSize: '13px', color: '#6B7A99', margin: 0 }}>Update your personal credentials and contact information.</p>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px' }}>
                  <div>
                    <label style={{ fontSize: '11px', fontWeight: 700, color: '#6B7A99', textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>
                      Email Address
                    </label>
                    <input
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      style={{
                        width: '100%', height: '42px', border: '1px solid #DDE2EC', borderRadius: '8px',
                        padding: '0 12px', fontSize: '14px', outline: 'none', color: '#1A2340',
                        boxSizing: 'border-box'
                      }}
                      required
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: '11px', fontWeight: 700, color: '#6B7A99', textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>
                      Phone Number
                    </label>
                    <input
                      type="text"
                      value={phone}
                      onChange={e => setPhone(e.target.value)}
                      style={{
                        width: '100%', height: '42px', border: '1px solid #DDE2EC', borderRadius: '8px',
                        padding: '0 12px', fontSize: '14px', outline: 'none', color: '#1A2340',
                        boxSizing: 'border-box'
                      }}
                      required
                    />
                  </div>
                </div>

                <hr style={{ border: 'none', borderTop: '1px solid #F5F7FA', margin: '8px 0' }} />

                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  <div>
                    <h4 style={{ fontSize: '14px', fontWeight: 700, color: '#1A2340', margin: '0 0 16px 0' }}>Password Management</h4>
                    <label style={{ fontSize: '11px', fontWeight: 700, color: '#6B7A99', textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>
                      Current Password
                    </label>
                    <input
                      type="password"
                      value={currentPassword}
                      onChange={e => setCurrentPassword(e.target.value)}
                      placeholder="••••••••••••"
                      style={{
                        width: '100%', height: '42px', border: '1px solid #DDE2EC', borderRadius: '8px',
                        padding: '0 12px', fontSize: '14px', outline: 'none', color: '#1A2340',
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: '11px', fontWeight: 700, color: '#6B7A99', textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>
                      New Password
                    </label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={e => setNewPassword(e.target.value)}
                      placeholder="Enter new password"
                      style={{
                        width: '100%', height: '42px', border: '1px solid #DDE2EC', borderRadius: '8px',
                        padding: '0 12px', fontSize: '14px', outline: 'none', color: '#1A2340',
                        boxSizing: 'border-box'
                      }}
                    />
                    <span style={{ fontSize: '12px', color: '#6B7A99', display: 'block', marginTop: '6px' }}>
                      Password must be at least 12 characters and include a symbol.
                    </span>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '12px' }}>
                  <button
                    type="button"
                    onClick={() => {
                      setEmail(profile?.user?.email || 'chidi.anya@example.com');
                      setPhone(profile?.phone || '+234 809 123 4567');
                      setCurrentPassword('');
                      setNewPassword('');
                    }}
                    style={{
                      background: 'transparent', border: '1px solid #DDE2EC', borderRadius: '8px',
                      padding: '10px 20px', fontSize: '13px', fontWeight: 600, color: '#6B7A99',
                      cursor: 'pointer'
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    style={{
                      background: '#0047CC', border: 'none', borderRadius: '8px',
                      padding: '10px 24px', fontSize: '13px', fontWeight: 700, color: '#FFFFFF',
                      cursor: 'pointer'
                    }}
                  >
                    Save Changes
                  </button>
                </div>
              </form>
            )}

            {activeTab === 'notifications' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div>
                  <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#1A2340', margin: '0 0 6px 0' }}>Notification Settings</h3>
                  <p style={{ fontSize: '13px', color: '#6B7A99', margin: 0 }}>Configure how and when you receive portal communications.</p>
                </div>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '8px' }}>
                  {[
                    { id: 'notif_payouts', label: 'Payout Alerts', desc: 'Get notified as soon as a payout is approved and processed.' },
                    { id: 'notif_matches', label: 'Project Matches', desc: 'Receive instant notifications when clients shortlist your profile.' },
                    { id: 'notif_compliance', label: 'Compliance & Legal Reminders', desc: 'Alerts when a new agreement requires your digital signature.' },
                    { id: 'notif_messages', label: 'Chat Messages', desc: 'Direct message notifications from clients or administrators.' }
                  ].map(item => (
                    <div key={item.id} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                      <input type="checkbox" defaultChecked id={item.id} style={{ marginTop: '4px', cursor: 'pointer' }} />
                      <label htmlFor={item.id} style={{ cursor: 'pointer' }}>
                        <div style={{ fontSize: '14px', fontWeight: 600, color: '#1A2340' }}>{item.label}</div>
                        <div style={{ fontSize: '12px', color: '#6B7A99', marginTop: '2px' }}>{item.desc}</div>
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'privacy' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div>
                  <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#1A2340', margin: '0 0 6px 0' }}>Privacy & Security</h3>
                  <p style={{ fontSize: '13px', color: '#6B7A99', margin: 0 }}>Manage access security options and login keys.</p>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginTop: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px', background: '#F5F7FA', borderRadius: '12px' }}>
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: 600, color: '#1A2340' }}>Two-Factor Authentication (2FA)</div>
                      <div style={{ fontSize: '12px', color: '#6B7A99', marginTop: '2px' }}>Add an extra layer of protection to your account login.</div>
                    </div>
                    <button style={{ background: '#0047CC', color: '#FFFFFF', border: 'none', borderRadius: '8px', padding: '8px 16px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>
                      Enable 2FA
                    </button>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px', background: '#F5F7FA', borderRadius: '12px' }}>
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: 600, color: '#1A2340' }}>Authorized Sessions</div>
                      <div style={{ fontSize: '12px', color: '#6B7A99', marginTop: '2px' }}>Check and log out of other devices using your credentials.</div>
                    </div>
                    <button style={{ background: 'transparent', border: '1px solid #DDE2EC', borderRadius: '8px', padding: '8px 16px', fontSize: '12px', fontWeight: 600, color: '#1A2340', cursor: 'pointer' }}>
                      View Devices
                    </button>
                  </div>
                </div>
              </div>
            )}

          </Card>
        </div>

      </div>
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
      <div className="db-grid-2" style={{}}>
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

// ─── Section 6: Support Center ────────────────────────────────────────────────
const SupportSection = ({ profile, onUpdateProfile }: { profile: any; onUpdateProfile?: (updatedProfile: any) => void }) => {
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [newTicketModalOpen, setNewTicketModalOpen] = useState(false);
  const [chatAlertOpen, setChatAlertOpen] = useState(false);

  // New Ticket Form State
  const [newTicketSubject, setNewTicketSubject] = useState('');
  const [newTicketCategory, setNewTicketCategory] = useState('Payment Issues');
  const [newTicketPriority, setNewTicketPriority] = useState('High');
  const [newTicketMessage, setNewTicketMessage] = useState('');

  // Reply Form State
  const [replyText, setReplyText] = useState('');

  // Default tickets to load if none exist on the profile
  const tickets = profile?.supportTickets || [];

  // Selected ticket computed detail
  const activeTicket = tickets.find((t: any) => t.id === selectedTicketId);

  // Filtered tickets based on search query
  const filteredTickets = tickets.filter((t: any) => 
    t.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // New ticket creation handler
  const handleCreateTicket = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTicketSubject.trim() || !newTicketMessage.trim()) return;

    const newId = `TK-${Math.floor(10000 + Math.random() * 90000)}`;
    const newTicket = {
      id: newId,
      subject: newTicketSubject,
      category: newTicketCategory,
      status: 'Open',
      priority: newTicketPriority,
      createdAt: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      lastActivity: 'Just now',
      assignedAgent: { name: 'Sarah Kong', role: 'Global Support Lead', avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=80' },
      messages: [
        {
          id: `msg_${Date.now()}`,
          sender: { name: profile?.name || 'Talent User', role: 'Talent', isSupport: false },
          text: newTicketMessage,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]
    };

    const updatedProfile = {
      ...profile,
      supportTickets: [newTicket, ...tickets]
    };

    if (onUpdateProfile) {
      onUpdateProfile(updatedProfile);
    }

    // Reset forms
    setNewTicketSubject('');
    setNewTicketMessage('');
    setNewTicketModalOpen(false);

    // Seed mock automatic support agent response 1.5 seconds later
    setTimeout(() => {
      const dbTickets = updatedProfile.supportTickets || [];
      const updatedTickets = dbTickets.map((t: any) => {
        if (t.id === newId) {
          return {
            ...t,
            status: 'In Progress',
            lastActivity: '1 sec ago',
            messages: [
              ...t.messages,
              {
                id: `msg_reply_${Date.now()}`,
                sender: { name: 'Sarah Kong', role: 'Global Support Lead', isSupport: true, avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=80' },
                text: `Hi ${profile?.name ? profile.name.split(' ')[0] : 'there'}, thanks for submitting your ticket. I have reviewed your query regarding "${newTicketSubject}" and am escalating it to our engineering group. I will update you shortly!`,
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
              }
            ]
          };
        }
        return t;
      });

      if (onUpdateProfile) {
        onUpdateProfile({
          ...profile,
          supportTickets: updatedTickets
        });
      }
    }, 1500);
  };

  // Reply submission handler
  const handleSendReply = (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim() || !activeTicket) return;

    const newReply = {
      id: `msg_${Date.now()}`,
      sender: { name: profile?.name || 'Talent User', role: 'Talent', isSupport: false },
      text: replyText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    const updatedTickets = tickets.map((t: any) => {
      if (t.id === activeTicket.id) {
        return {
          ...t,
          lastActivity: 'Just now',
          messages: [...t.messages, newReply]
        };
      }
      return t;
    });

    if (onUpdateProfile) {
      onUpdateProfile({
        ...profile,
        supportTickets: updatedTickets
      });
    }

    setReplyText('');

    // Trigger secondary mock agent reply 2 seconds later
    setTimeout(() => {
      const dbTickets = updatedTickets || [];
      const latestTickets = dbTickets.map((t: any) => {
        if (t.id === activeTicket.id) {
          return {
            ...t,
            lastActivity: '1 sec ago',
            messages: [
              ...t.messages,
              {
                id: `msg_agent_reply_${Date.now()}`,
                sender: { name: 'Sarah Kong', role: 'Global Support Lead', isSupport: true, avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=80' },
                text: 'Got it. I am verifying this in our system database now. I will post back as soon as I have a status code update.',
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
              }
            ]
          };
        }
        return t;
      });

      if (onUpdateProfile) {
        onUpdateProfile({
          ...profile,
          supportTickets: latestTickets
        });
      }
    }, 2000);
  };

  // Resolve ticket helper
  const handleResolveTicket = () => {
    if (!activeTicket) return;
    const updatedTickets = tickets.map((t: any) => 
      t.id === activeTicket.id ? { ...t, status: 'Resolved', lastActivity: 'Resolved' } : t
    );

    if (onUpdateProfile) {
      onUpdateProfile({
        ...profile,
        supportTickets: updatedTickets
      });
    }
  };

  // Escalate ticket helper
  const handleEscalateTicket = () => {
    if (!activeTicket) return;
    const updatedTickets = tickets.map((t: any) => 
      t.id === activeTicket.id ? { ...t, priority: 'Urgent', lastActivity: 'Escalated' } : t
    );

    if (onUpdateProfile) {
      onUpdateProfile({
        ...profile,
        supportTickets: updatedTickets
      });
    }
  };

  // Return component UI based on mode
  if (selectedTicketId && activeTicket) {
    // ─── TICKET DETAILS SCREEN (SCREEN B) ───
    let statusBg = '#FFF3C4';
    let statusColor = '#D97706';
    if (activeTicket.status === 'Resolved') {
      statusBg = '#E6FFFA';
      statusColor = '#00A389';
    } else if (activeTicket.status === 'Open') {
      statusBg = '#FEE2E2';
      statusColor = '#EF4444';
    }

    return (
      <div className="db-grid-split-300" style={{ fontFamily: 'var(--font-display, Inter, sans-serif)' }}>
        
        {/* Left Column: Conversation Thread */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Breadcrumb Back Row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button 
              onClick={() => setSelectedTicketId(null)}
              style={{
                background: 'none', border: 'none', color: '#0047CC', fontSize: '13px',
                fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px'
              }}
            >
              <span>←</span> Back to Support
            </button>
            <span style={{ color: '#DDE2EC' }}>|</span>
            <span style={{
              background: statusBg, color: statusColor, fontSize: '10px',
              fontWeight: 800, padding: '3px 8px', borderRadius: '4px', textTransform: 'uppercase'
            }}>
              {activeTicket.status}
            </span>
          </div>

          {/* Ticket Header Card */}
          <Card style={{ padding: '24px' }}>
            <span style={{ fontSize: '11px', color: '#6B7A99', fontWeight: 700 }}>TICKET {activeTicket.id}</span>
            <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#1A2340', margin: '4px 0 0 0' }}>
              {activeTicket.subject}
            </h2>
          </Card>

          {/* Chat Messages Log */}
          <Card style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px', minHeight: '350px', maxHeight: '500px', overflowY: 'auto' }}>
            {activeTicket.messages.map((msg: any) => {
              const isAgent = msg.sender.isSupport;
              return (
                <div 
                  key={msg.id} 
                  style={{
                    display: 'flex', gap: '16px', 
                    alignSelf: isAgent ? 'flex-start' : 'flex-end',
                    flexDirection: isAgent ? 'row' : 'row-reverse',
                    maxWidth: '85%'
                  }}
                >
                  {/* Avatar */}
                  <div style={{
                    width: '36px', height: '36px', borderRadius: '50%', overflow: 'hidden',
                    background: isAgent ? '#0047CC' : '#F1F5F9', flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                  }}>
                    {msg.sender.avatar ? (
                      <img src={msg.sender.avatar} alt="Sender avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <span style={{ fontSize: '14px', fontWeight: 700, color: isAgent ? '#fff' : '#6B7A99' }}>
                        {isAgent ? 'S' : 'C'}
                      </span>
                    )}
                  </div>

                  {/* Bubble Content */}
                  <div>
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: '8px', 
                      justifyContent: isAgent ? 'flex-start' : 'flex-end',
                      marginBottom: '4px'
                    }}>
                      <span style={{ fontSize: '12px', fontWeight: 700, color: '#1A2340' }}>{msg.sender.name}</span>
                      <span style={{ fontSize: '10px', color: '#6B7A99' }}>{msg.timestamp}</span>
                    </div>
                    <div style={{
                      background: isAgent ? '#EEF3FF' : '#1A2340',
                      color: isAgent ? '#1A2340' : '#FFFFFF',
                      borderRadius: isAgent ? '0 12px 12px 12px' : '12px 0 12px 12px',
                      padding: '14px 18px', fontSize: '13px', lineHeight: 1.5,
                      boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                    }}>
                      {msg.text}
                    </div>
                  </div>
                </div>
              );
            })}
          </Card>

          {/* Reply Form Section */}
          <Card style={{ padding: '20px 24px' }}>
            <form onSubmit={handleSendReply}>
              {/* Rich editor textbar header */}
              <div style={{ display: 'flex', gap: '14px', borderBottom: '1px solid #F1F5F9', paddingBottom: '10px', marginBottom: '12px' }}>
                {['B', 'I', '🔗', '🖼️', '📎'].map((tool, idx) => (
                  <button 
                    key={idx} 
                    type="button"
                    style={{ background: 'none', border: 'none', color: '#6B7A99', fontSize: '14px', fontWeight: 700, cursor: 'pointer' }}
                  >
                    {tool}
                  </button>
                ))}
              </div>

              {/* Input Area */}
              <textarea
                placeholder="Type your reply here..."
                value={replyText}
                onChange={e => setReplyText(e.target.value)}
                required
                style={{
                  width: '100%', minHeight: '100px', border: 'none', outline: 'none',
                  fontSize: '13px', color: '#1A2340', fontFamily: 'inherit', resize: 'none'
                }}
              />

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #F1F5F9', paddingTop: '12px', marginTop: '12px' }}>
                <span style={{ fontSize: '11px', color: '#6B7A99' }}>Press Cmd+Enter to send</span>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button 
                    type="button" 
                    onClick={() => setReplyText('')}
                    style={{
                      background: 'transparent', border: 'none', color: '#6B7A99',
                      fontSize: '12px', fontWeight: 700, cursor: 'pointer', padding: '6px 12px'
                    }}
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    style={{
                      background: '#0047CC', color: '#FFFFFF', border: 'none', borderRadius: '6px',
                      padding: '8px 16px', fontSize: '12px', fontWeight: 700, cursor: 'pointer'
                    }}
                  >
                    Send Reply
                  </button>
                </div>
              </div>
            </form>
          </Card>

        </div>

        {/* Right Column: Ticket Sidebar Details */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* Ticket Information */}
          <Card style={{ padding: '20px' }}>
            <h4 style={{ fontSize: '11px', fontWeight: 800, color: '#6B7A99', margin: '0 0 16px 0', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              TICKET DETAILS
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '12px', color: '#6B7A99' }}>Category</span>
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#1A2340' }}>{activeTicket.category}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '12px', color: '#6B7A99' }}>Priority</span>
                <span style={{ 
                  fontSize: '11px', fontWeight: 800, 
                  color: activeTicket.priority === 'Urgent' ? '#EF4444' : '#EAB308'
                }}>
                  {activeTicket.priority}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '12px', color: '#6B7A99' }}>Created On</span>
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#1A2340' }}>{activeTicket.createdAt}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '12px', color: '#6B7A99' }}>Response Time</span>
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#1A2340' }}>1h 32m</span>
              </div>
            </div>
          </Card>

          {/* Assigned Agent */}
          <Card style={{ padding: '20px' }}>
            <h4 style={{ fontSize: '11px', fontWeight: 800, color: '#6B7A99', margin: '0 0 16px 0', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              ASSIGNED AGENT
            </h4>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <div style={{
                width: '40px', height: '40px', borderRadius: '50%', overflow: 'hidden',
                background: '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                {activeTicket.assignedAgent?.avatar ? (
                  <img src={activeTicket.assignedAgent.avatar} alt="Agent avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <span style={{ fontSize: '16px' }}>👤</span>
                )}
              </div>
              <div>
                <span style={{ fontSize: '13px', fontWeight: 700, color: '#1A2340', display: 'block' }}>
                  {activeTicket.assignedAgent?.name || 'Support Agent'}
                </span>
                <span style={{ fontSize: '11px', color: '#6B7A99' }}>
                  {activeTicket.assignedAgent?.role || 'Global Support Lead'}
                </span>
              </div>
            </div>
            <button 
              onClick={() => alert('Direct messages with support leads are managed through secure portals. You can chat within this ticket!')}
              style={{
                width: '100%', background: '#F5F7FA', border: '1px solid #DDE2EC', borderRadius: '8px',
                padding: '10px', fontSize: '12px', fontWeight: 700, color: '#1A2340', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px'
              }}
            >
              <span>✉️</span> Direct Message
            </button>
          </Card>

          {/* Ticket Actions */}
          <Card style={{ padding: '20px' }}>
            <h4 style={{ fontSize: '11px', fontWeight: 800, color: '#6B7A99', margin: '0 0 16px 0', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              ACTIONS
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button 
                onClick={handleResolveTicket}
                style={{
                  width: '100%', background: '#FFFFFF', border: '1px solid #DDE2EC', borderRadius: '8px',
                  padding: '10px', fontSize: '12px', fontWeight: 700, color: '#00A389', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px'
                }}
              >
                <span>✓</span> Mark as Resolved
              </button>
              <button 
                onClick={handleEscalateTicket}
                style={{
                  width: '100%', background: 'transparent', border: 'none', color: '#EF4444',
                  fontSize: '12px', fontWeight: 700, cursor: 'pointer', padding: '8px'
                }}
              >
                🚨 Escalate Ticket
              </button>
            </div>
          </Card>

          {/* Pro Tip */}
          <div style={{ background: '#EEF3FF', padding: '16px', borderRadius: '8px', display: 'flex', gap: '12px' }}>
            <div style={{ fontSize: '18px' }}>💡</div>
            <div>
              <h5 style={{ fontSize: '12px', fontWeight: 700, color: '#0047CC', margin: '0 0 4px 0' }}>Pro Tip</h5>
              <p style={{ fontSize: '11px', color: '#4E5D78', margin: 0, lineHeight: 1.4 }}>
                Ensure your bank's international transfer limits are set high enough to receive enterprise-level payments.
              </p>
            </div>
          </div>

        </div>

      </div>
    );
  }

  // ─── SUPPORT DASHBOARD VIEW (SCREEN A) ───
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px', fontFamily: 'var(--font-display, Inter, sans-serif)' }}>
      
      {/* Search Header Banner Section */}
      <div style={{
        background: 'linear-gradient(135deg, #002B7F 0%, #0047CC 100%)',
        borderRadius: '16px', padding: '40px', color: '#FFFFFF', textAlign: 'center',
        position: 'relative', overflow: 'hidden'
      }}>
        {/* Soft background shape */}
        <div style={{
          position: 'absolute', top: '-100px', right: '-100px', width: '300px', height: '300px',
          borderRadius: '50%', background: 'rgba(255,255,255,0.06)', pointerEvents: 'none'
        }} />

        <h1 style={{ fontSize: '28px', fontWeight: 800, margin: '0 0 8px 0' }}>How can we assist you today?</h1>
        <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.8)', margin: '0 0 24px 0' }}>
          Find answers to common questions or connect with our specialized support teams.
        </p>

        {/* Centered Search box */}
        <div style={{ display: 'flex', justifyContent: 'center', margin: '0 auto', maxWidth: '540px', position: 'relative' }}>
          <span style={{ position: 'absolute', left: '16px', top: '12px', color: '#6B7A99', fontSize: '16px' }}>🔍</span>
          <input
            type="text"
            placeholder="Search documentation, FAQs, or tickets..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{
              width: '100%', height: '46px', background: '#FFFFFF', border: 'none', borderRadius: '24px',
              padding: '0 16px 0 46px', fontSize: '14px', color: '#1A2340', outline: 'none',
              boxShadow: '0 8px 16px rgba(0,0,0,0.08)'
            }}
          />
        </div>

        {/* Quick tags */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginTop: '16px', flexWrap: 'wrap' }}>
          {['#AccountActivation', '#PaymentGateway', '#IPIntegration'].map(tag => (
            <button
              key={tag}
              onClick={() => setSearchQuery(tag.replace('#', ''))}
              style={{
                background: 'rgba(255,255,255,0.15)', color: '#FFFFFF', border: 'none',
                borderRadius: '12px', padding: '4px 12px', fontSize: '11px', fontWeight: 600,
                cursor: 'pointer', transition: 'all 0.15s'
              }}
            >
              {tag}
            </button>
          ))}
        </div>
      </div>

      {/* Grid of Categories */}
      <div className="db-grid-4" style={{}}>
        {[
          { label: 'Payment Issues', desc: 'Invoicing, direct deposits, and billing queries.', icon: '💳' },
          { label: 'Technical Support', desc: 'Platform bugs, API issues, and integrations.', icon: '⚙️' },
          { label: 'Verification', desc: 'KYC processes and talent background checks.', icon: '🛡️' },
          { label: 'Guidance', desc: 'Learning modules and platform walkthroughs.', icon: '📖' }
        ].map((item, idx) => (
          <Card 
            key={idx} 
            onClick={() => {
              setNewTicketCategory(item.label);
              setNewTicketModalOpen(true);
            }}
            style={{ 
              padding: '24px', cursor: 'pointer', transition: 'transform 0.15s ease, box-shadow 0.15s ease',
              display: 'flex', flexDirection: 'column', gap: '12px'
            }}
          >
            <div style={{
              width: '40px', height: '40px', borderRadius: '8px', background: '#EEF3FF',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px'
            }}>
              {item.icon}
            </div>
            <div>
              <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#1A2340', margin: '0 0 4px 0' }}>{item.label}</h3>
              <p style={{ fontSize: '12px', color: '#6B7A99', margin: 0, lineHeight: 1.4 }}>{item.desc}</p>
            </div>
          </Card>
        ))}
      </div>

      {/* Split layout (Tickets table & Live Chat pane) */}
      <div className="db-grid-split-320" style={{ alignItems: 'flex-start' }}>
        
        {/* Left Card: My Recent Tickets */}
        <Card style={{ padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 800, color: '#1A2340', margin: 0 }}>My Recent Tickets</h3>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              <button 
                onClick={() => setSearchQuery('')}
                style={{ background: 'none', border: 'none', color: '#0047CC', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}
              >
                View All
              </button>
              <button
                onClick={() => setNewTicketModalOpen(true)}
                style={{
                  background: '#0047CC', color: '#FFFFFF', border: 'none', borderRadius: '6px',
                  padding: '6px 12px', fontSize: '12px', fontWeight: 700, cursor: 'pointer'
                }}
              >
                + New Ticket
              </button>
            </div>
          </div>

          {tickets.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '40px 20px', textAlign: 'center', color: '#6B7A99', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: '48px', marginBottom: '8px' }}>🎫</span>
              <h4 style={{ fontSize: '16px', fontWeight: 800, color: '#1A2340', margin: 0 }}>No Support Tickets Yet</h4>
              <p style={{ fontSize: '13px', color: '#6B7A99', maxWidth: '380px', margin: 0, lineHeight: 1.5 }}>
                Have questions about international payroll, local EOR compliance, or workspace integrations? Submit a new ticket to get in touch with our specialized support desk.
              </p>
              <button
                onClick={() => setNewTicketModalOpen(true)}
                style={{
                  background: '#EEF3FF', color: '#0047CC', border: 'none', borderRadius: '8px',
                  padding: '10px 20px', fontSize: '13px', fontWeight: 700, cursor: 'pointer', marginTop: '8px'
                }}
              >
                Create Your First Ticket
              </button>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #F1F5F9' }}>
                    <th style={{ padding: '12px 8px', fontSize: '11px', fontWeight: 700, color: '#6B7A99', textTransform: 'uppercase' }}>Ticket ID</th>
                    <th style={{ padding: '12px 8px', fontSize: '11px', fontWeight: 700, color: '#6B7A99', textTransform: 'uppercase' }}>Subject</th>
                    <th style={{ padding: '12px 8px', fontSize: '11px', fontWeight: 700, color: '#6B7A99', textTransform: 'uppercase' }}>Status</th>
                    <th style={{ padding: '12px 8px', fontSize: '11px', fontWeight: 700, color: '#6B7A99', textTransform: 'uppercase' }}>Last Activity</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTickets.map((ticket: any) => {
                    let pillBg = '#FFF3C4';
                    let pillColor = '#D97706';
                    if (ticket.status === 'Resolved') {
                      pillBg = '#E6FFFA';
                      pillColor = '#00A389';
                    } else if (ticket.status === 'Open') {
                      pillBg = '#FEE2E2';
                      pillColor = '#EF4444';
                    }

                    return (
                      <tr 
                        key={ticket.id} 
                        onClick={() => setSelectedTicketId(ticket.id)}
                        style={{ borderBottom: '1px solid #F8FAFC', cursor: 'pointer', transition: 'background 0.15s' }}
                        onMouseEnter={e => { e.currentTarget.style.background = '#F9FAFB'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                      >
                        <td style={{ padding: '14px 8px', fontSize: '13px', fontWeight: 700, color: '#0047CC' }}>{ticket.id}</td>
                        <td style={{ padding: '14px 8px' }}>
                          <span style={{ fontSize: '13px', fontWeight: 600, color: '#1A2340', display: 'block' }}>{ticket.subject}</span>
                          <span style={{ fontSize: '10px', color: '#6B7A99' }}>{ticket.category}</span>
                        </td>
                        <td style={{ padding: '14px 8px' }}>
                          <span style={{
                            background: pillBg, color: pillColor, fontSize: '10px', fontWeight: 800,
                            padding: '3px 8px', borderRadius: '4px', textTransform: 'uppercase'
                          }}>
                            {ticket.status}
                          </span>
                        </td>
                        <td style={{ padding: '14px 8px', fontSize: '12px', color: '#6B7A99' }}>{ticket.lastActivity}</td>
                      </tr>
                    );
                  })}
                  {filteredTickets.length === 0 && (
                    <tr>
                      <td colSpan={4} style={{ padding: '24px 8px', textAlign: 'center', color: '#6B7A99', fontSize: '13px' }}>
                        No support tickets found matching your query.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {/* Right Side Cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* Live Support */}
          <Card style={{ padding: '24px', background: 'linear-gradient(135deg, #1A2340 0%, #0D1326 100%)', color: '#FFFFFF' }}>
            <div style={{ fontSize: '24px', marginBottom: '12px' }}>💬</div>
            <h3 style={{ fontSize: '15px', fontWeight: 800, color: '#FFFFFF', margin: '0 0 4px 0' }}>Live Support</h3>
            <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.7)', margin: '0 0 20px 0' }}>
              Average response time: 2 minutes.
            </p>
            <button 
              onClick={() => setChatAlertOpen(true)}
              style={{
                width: '100%', background: '#FFFFFF', color: '#1A2340', border: 'none', borderRadius: '8px',
                padding: '10px', fontSize: '12px', fontWeight: 700, cursor: 'pointer'
              }}
            >
              Start Live Chat
            </button>
          </Card>

          {/* Other Channels */}
          <Card style={{ padding: '20px' }}>
            <h4 style={{ fontSize: '11px', fontWeight: 800, color: '#6B7A99', margin: '0 0 16px 0', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              OTHER CHANNELS
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '16px' }}>✉️</span>
                <div>
                  <span style={{ fontSize: '11px', color: '#6B7A99', display: 'block' }}>Email Support</span>
                  <a href="mailto:support@kongila.com" style={{ fontSize: '12px', fontWeight: 700, color: '#0047CC', textDecoration: 'none' }}>
                    support@kongila.com
                  </a>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '16px' }}>📞</span>
                <div>
                  <span style={{ fontSize: '11px', color: '#6B7A99', display: 'block' }}>Enterprise Hotline</span>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: '#1A2340' }}>
                    +1 (800) KONGILA
                  </span>
                </div>
              </div>
            </div>
            
            <div style={{ borderTop: '1px solid #F1F5F9', marginTop: '16px', paddingTop: '12px', fontSize: '11px', color: '#6B7A99', textAlign: 'center' }}>
              Availability: 24/7 Global Desk
            </div>
          </Card>

        </div>

      </div>

      {/* CREATE NEW SUPPORT TICKET MODAL */}
      {newTicketModalOpen && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(26, 35, 64, 0.6)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 999
        }}>
          <div style={{
            background: '#FFFFFF', borderRadius: '12px', width: '90%', maxWidth: '520px',
            padding: '28px', border: '1px solid #E2E8F0', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)'
          }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#1A2340', margin: 0 }}>Create New Support Ticket</h3>
              <button 
                onClick={() => setNewTicketModalOpen(false)}
                style={{ background: 'none', border: 'none', fontSize: '16px', fontWeight: 700, cursor: 'pointer', color: '#6B7A99' }}
              >
                ✕
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleCreateTicket} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              
              {/* Category */}
              <div>
                <label style={{ fontSize: '11px', fontWeight: 700, color: '#6B7A99', display: 'block', marginBottom: '6px' }}>
                  Category
                </label>
                <select
                  value={newTicketCategory}
                  onChange={e => setNewTicketCategory(e.target.value)}
                  style={{
                    width: '100%', height: '40px', border: '1px solid #DDE2EC', borderRadius: '8px',
                    padding: '0 12px', fontSize: '13px', outline: 'none', background: '#FFFFFF'
                  }}
                >
                  <option value="Payment Issues">Payment Issues</option>
                  <option value="Technical Support">Technical Support</option>
                  <option value="Verification">Verification</option>
                  <option value="Guidance">Guidance</option>
                </select>
              </div>

              {/* Priority */}
              <div>
                <label style={{ fontSize: '11px', fontWeight: 700, color: '#6B7A99', display: 'block', marginBottom: '6px' }}>
                  Priority
                </label>
                <select
                  value={newTicketPriority}
                  onChange={e => setNewTicketPriority(e.target.value)}
                  style={{
                    width: '100%', height: '40px', border: '1px solid #DDE2EC', borderRadius: '8px',
                    padding: '0 12px', fontSize: '13px', outline: 'none', background: '#FFFFFF'
                  }}
                >
                  <option value="Low">Low</option>
                  <option value="Medium">Medium</option>
                  <option value="High">High</option>
                  <option value="Urgent">Urgent</option>
                </select>
              </div>

              {/* Subject */}
              <div>
                <label style={{ fontSize: '11px', fontWeight: 700, color: '#6B7A99', display: 'block', marginBottom: '6px' }}>
                  Subject
                </label>
                <input
                  type="text"
                  placeholder="Summarize your issue"
                  value={newTicketSubject}
                  onChange={e => setNewTicketSubject(e.target.value)}
                  required
                  style={{
                    width: '100%', height: '40px', border: '1px solid #DDE2EC', borderRadius: '8px',
                    padding: '0 12px', fontSize: '13px', outline: 'none'
                  }}
                />
              </div>

              {/* Message */}
              <div>
                <label style={{ fontSize: '11px', fontWeight: 700, color: '#6B7A99', display: 'block', marginBottom: '6px' }}>
                  Message / Details
                </label>
                <textarea
                  placeholder="Provide details about your query..."
                  value={newTicketMessage}
                  onChange={e => setNewTicketMessage(e.target.value)}
                  required
                  style={{
                    width: '100%', minHeight: '120px', border: '1px solid #DDE2EC', borderRadius: '8px',
                    padding: '12px', fontSize: '13px', outline: 'none', fontFamily: 'inherit', resize: 'none'
                  }}
                />
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '12px' }}>
                <button
                  type="button"
                  onClick={() => setNewTicketModalOpen(false)}
                  style={{
                    background: 'transparent', border: 'none', color: '#6B7A99', fontSize: '13px',
                    fontWeight: 700, cursor: 'pointer', padding: '8px 16px'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{
                    background: '#0047CC', color: '#FFFFFF', border: 'none', borderRadius: '8px',
                    padding: '10px 20px', fontSize: '13px', fontWeight: 700, cursor: 'pointer'
                  }}
                >
                  Submit Ticket
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* MOCK CHAT POPUP SCREEN */}
      {chatAlertOpen && (
        <div style={{
          position: 'fixed', bottom: '24px', right: '24px',
          width: '320px', background: '#FFFFFF', borderRadius: '12px',
          border: '1px solid #E2E8F0', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)',
          zIndex: 1000, overflow: 'hidden', fontFamily: 'inherit'
        }}>
          {/* Header */}
          <div style={{ background: '#1A2340', color: '#FFFFFF', padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '13px', fontWeight: 700 }}>Live Support Chat</span>
            <button 
              onClick={() => setChatAlertOpen(false)}
              style={{ background: 'none', border: 'none', color: '#fff', fontSize: '14px', cursor: 'pointer' }}
            >
              ✕
            </button>
          </div>
          {/* Content */}
          <div style={{ padding: '18px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10B981', marginTop: '5px' }} />
              <p style={{ fontSize: '12px', color: '#4E5D78', margin: 0, lineHeight: 1.4 }}>
                <strong>Support Agent:</strong> Hi, thanks for requesting a live chat. We are routing you to an active operator now. Estimated wait time: <strong>1.2 minutes</strong>.
              </p>
            </div>
            <input 
              type="text" 
              placeholder="Type message here..." 
              style={{
                width: '100%', height: '36px', border: '1px solid #DDE2EC', borderRadius: '6px',
                padding: '0 10px', fontSize: '12px', outline: 'none'
              }}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  alert('Thank you! Our live agent is joining.');
                  setChatAlertOpen(false);
                }
              }}
            />
          </div>
        </div>
      )}

    </div>
  );
};
export default function TalentDashboard({ currentUser, talentProfile, contracts, matches, clientRequests, onSignOut, onUpdateProfile, onUpdateMatch }: TalentDashboardProps) {
  const [activeSection, setActiveSection] = useState<Section>('dashboard');
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // Notifications and messages state
  const [notifications, setNotifications] = useState([
    { id: 1, title: 'Contract Signed', message: 'Nexus Health signed your agreement.', time: '2h ago', read: false },
    { id: 2, title: 'Compliance Action', message: 'You have a document requiring review.', time: '5h ago', read: false },
    { id: 3, title: 'Radar Match', message: 'Successfully matched to Horizon Fintech.', time: '1d ago', read: true }
  ]);
  const [messages, setMessages] = useState([
    { id: 1, sender: 'Amara Anya', text: 'Can you upload your updated ID card?', time: '10m ago', read: false },
    { id: 2, sender: 'Vetting Officer', text: 'Operational Assessment sandbox scoring complete.', time: '2d ago', read: true }
  ]);
  
  const [showNotifDropdown, setShowNotifDropdown] = useState(false);
  const [showMsgDropdown, setShowMsgDropdown] = useState(false);

  const unreadNotifsCount = notifications.filter(n => !n.read).length;
  const unreadMessagesCount = messages.filter(m => !m.read).length;

  const markAllNotifsRead = () => {
    setNotifications(notifications.map(n => ({ ...n, read: true })));
  };

  const markAllMessagesRead = () => {
    setMessages(messages.map(m => ({ ...m, read: true })));
  };

  const renderSection = () => {
    const talentContracts = contracts.filter((c: any) => c.talentId === talentProfile?.id || c.talentName === talentProfile?.name);
    const talentMatches = matches.filter((m: any) => m.talentId === talentProfile?.id || m.talentName === talentProfile?.name);

    switch (activeSection) {
      case 'dashboard':    return <ProfileSection user={currentUser} profile={talentProfile} contracts={talentContracts} matches={talentMatches} setActiveSection={setActiveSection} />;
      case 'calendar':     return <CalendarSection matches={talentMatches} clientRequests={clientRequests} />;
      case 'contracts':    return <ContractSection contracts={talentContracts} profile={talentProfile} />;
      case 'pipeline':     return <PipelineSection profile={talentProfile} matches={matches} clientRequests={clientRequests || []} onUpdateMatch={onUpdateMatch} />;
      case 'compliance':   return <ComplianceSection profile={talentProfile} onUpdateProfile={onUpdateProfile} />;
      case 'messages':     return <MessagesSection messages={messages} setMessages={setMessages} profile={talentProfile} />;
      case 'profile':      return <ProfileDetailSection user={currentUser} profile={talentProfile} contracts={talentContracts} onUpdateProfile={onUpdateProfile} />;
      case 'support':      return <SupportSection profile={talentProfile} onUpdateProfile={onUpdateProfile} />;
      case 'settings':     return <SettingsSection profile={talentProfile} onUpdateProfile={onUpdateProfile} />;
    }
  };

  return (
    <div className="dashboard-shell" style={{ display: 'flex', minHeight: '100vh', background: '#F5F7FA', fontFamily: 'var(--font-display, Inter, sans-serif)' }}>

      {/* ── Mobile Top Nav ── */}
      <div className="mobile-nav-bar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 800, color: '#0047CC', fontSize: '18px' }}>
          <div style={{ width: '24px', height: '24px', background: '#0047CC', color: 'white', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px' }}>K</div>
          Kongila
        </div>
        <button className="mobile-hamburger" onClick={() => setMobileSidebarOpen(!mobileSidebarOpen)}>
          <span></span><span></span><span></span>
        </button>
      </div>

      {/* ── Mobile Sidebar Drawer ── */}
      {mobileSidebarOpen && (
        <>
          <div 
            onClick={() => setMobileSidebarOpen(false)}
            style={{
              position: 'fixed', inset: 0, background: 'rgba(0, 0, 0, 0.4)', zIndex: 299, backdropFilter: 'blur(4px)'
            }} 
          />
          <aside className="mobile-sidebar-drawer open" style={{
            position: 'fixed', top: 0, bottom: 0, left: 0, width: '280px',
            background: '#FFFFFF', borderRight: '1px solid #DDE2EC',
            display: 'flex', flexDirection: 'column', padding: '24px 16px',
            zIndex: 300, overflowY: 'auto'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', paddingBottom: '16px', borderBottom: '1px solid #F5F7FA' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  width: '32px', height: '32px', borderRadius: '8px', background: '#0047CC',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 900
                }}>K</div>
                <div style={{ fontSize: '14px', fontWeight: 800, color: '#1A2340' }}>Talent Portal</div>
              </div>
              <button onClick={() => setMobileSidebarOpen(false)} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer' }}>✕</button>
            </div>
            
            <nav style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
              {NAV_ITEMS.map(item => {
                const isActive = activeSection === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      setActiveSection(item.id);
                      setMobileSidebarOpen(false);
                    }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '10px',
                      padding: '12px', borderRadius: '8px', border: 'none',
                      background: isActive ? '#EEF3FF' : 'transparent',
                      color: isActive ? '#0047CC' : '#6B7A99',
                      fontWeight: isActive ? 700 : 500,
                      fontSize: '14px', cursor: 'pointer', textAlign: 'left',
                      width: '100%'
                    }}
                  >
                    <SidebarIcon id={item.id} color={isActive ? '#0047CC' : '#6B7A99'} size={16} />
                    {item.label}
                  </button>
                );
              })}
            </nav>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: 'auto', borderTop: '1px solid #F5F7FA', paddingTop: '16px' }}>
              <button 
                onClick={() => { setActiveSection('settings'); setMobileSidebarOpen(false); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: '10px',
                  background: activeSection === 'settings' ? '#EEF3FF' : 'transparent',
                  border: 'none', color: activeSection === 'settings' ? '#0047CC' : '#6B7A99',
                  fontSize: '14px', fontWeight: 600, cursor: 'pointer', textAlign: 'left',
                  padding: '8px', borderRadius: '8px', width: '100%'
                }}
              >
                <SidebarIcon id="settings" color={activeSection === 'settings' ? '#0047CC' : '#6B7A99'} size={16} />
                Settings
              </button>
              <button onClick={() => { onSignOut?.(); setMobileSidebarOpen(false); }} style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                background: 'transparent', border: 'none', color: '#EF4444',
                fontSize: '14px', fontWeight: 600, cursor: 'pointer', textAlign: 'left', padding: '8px',
                width: '100%'
              }}>
                <SidebarIcon id="logout" color="#EF4444" size={16} />
                Logout
              </button>
            </div>
          </aside>
        </>
      )}

      {/* ── Desktop Sidebar ── */}
      <aside className="desktop-sidebar" style={{
        width: '240px', flexShrink: 0,
        background: '#FFFFFF',
        borderRight: '1px solid #DDE2EC',
        display: 'flex', flexDirection: 'column',
        padding: '24px 12px',
        position: 'sticky', top: 0, height: '100vh', overflowY: 'auto'
      }}>
        {/* User badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '0 8px 20px', borderBottom: '1px solid #F5F7FA', marginBottom: '12px' }}>
          <div style={{
            width: '36px', height: '36px', borderRadius: '8px',
            background: '#0047CC',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontWeight: 900, fontSize: '20px', flexShrink: 0
          }}>
            K
          </div>
          <div style={{ overflow: 'hidden' }}>
            <div style={{ fontSize: '14px', fontWeight: 800, color: '#1A2340' }}>Talent Portal</div>
            <div style={{ fontSize: '11px', color: '#6B7A99' }}>Enterprise Operations</div>
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
                <SidebarIcon id={item.id} color={isActive ? '#0047CC' : '#6B7A99'} size={15} />
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Bottom Actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: 'auto' }}>
          {/* Update Availability Button */}
          <button style={{
            background: '#0047CC', color: '#fff', border: 'none', borderRadius: '8px',
            padding: '12px', fontSize: '13px', fontWeight: 700, cursor: 'pointer',
            marginBottom: '16px', width: '100%', textAlign: 'center'
          }}>
            Update Availability
          </button>

          {/* Settings & Logout */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', borderTop: '1px solid #F5F7FA', paddingTop: '12px' }}>
            <button 
              onClick={() => setActiveSection('settings')}
              style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                background: activeSection === 'settings' ? '#EEF3FF' : 'transparent',
                border: 'none',
                color: activeSection === 'settings' ? '#0047CC' : '#6B7A99',
                fontSize: '13px',
                fontWeight: activeSection === 'settings' ? 700 : 600,
                cursor: 'pointer',
                textAlign: 'left',
                padding: '6px 8px',
                borderRadius: '8px',
                width: '100%'
              }}
            >
              <SidebarIcon id="settings" color={activeSection === 'settings' ? '#0047CC' : '#6B7A99'} size={15} />
              Settings
            </button>
            <button onClick={onSignOut} style={{
              display: 'flex', alignItems: 'center', gap: '10px',
              background: 'transparent', border: 'none', color: '#6B7A99',
              fontSize: '13px', fontWeight: 600, cursor: 'pointer', textAlign: 'left', padding: '6px 8px',
              width: '100%'
            }}>
              <SidebarIcon id="logout" color="#6B7A99" size={15} />
              Logout
            </button>
          </div>
        </div>

        {/* Bottom label */}
        <div style={{ padding: '16px 8px 0', borderTop: '1px solid #F5F7FA', fontSize: '11px', color: '#6B7A99', marginTop: '12px' }}>
          Kongila Talent Portal · v1.0
        </div>
      </aside>

      {/* ── Main Content Wrapper ── */}
      <div className="dashboard-content-area" style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
        
        {/* ── Top Bar ── */}
        <header className="desktop-header" style={{
          height: '70px', background: '#FFFFFF', borderBottom: '1px solid #DDE2EC',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 48px', flexShrink: 0, position: 'relative', zIndex: 10
        }}>
          {/* Left: Breadcrumbs */}
          <div style={{ fontSize: '13px', color: '#6B7A99', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>Talent Dashboard</span>
            <span style={{ color: '#DDE2EC' }}>›</span>
            <span style={{ color: '#1A2340', fontWeight: 700 }}>
              {NAV_ITEMS.find(n => n.id === activeSection)?.label}
            </span>
          </div>

          {/* Right: Actions, Badges & Profile */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px', position: 'relative' }}>
            
            {/* Messages Icon */}
            <div 
              style={{ position: 'relative', cursor: 'pointer', padding: '6px' }}
              onClick={() => {
                setShowMsgDropdown(!showMsgDropdown);
                setShowNotifDropdown(false);
              }}
            >
              <span style={{ fontSize: '20px' }}>💬</span>
              {unreadMessagesCount > 0 && (
                <span style={{
                  position: 'absolute', top: '0', right: '0',
                  background: '#EF4444', color: '#FFFFFF', fontSize: '9px', fontWeight: 800,
                  width: '15px', height: '15px', borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                  {unreadMessagesCount}
                </span>
              )}

              {/* Messages Dropdown */}
              {showMsgDropdown && (
                <div style={{
                  position: 'absolute', top: '45px', right: '-80px', width: '320px',
                  background: '#FFFFFF', borderRadius: '12px', border: '1px solid #DDE2EC',
                  boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)',
                  padding: '16px', zIndex: 100
                }} onClick={e => e.stopPropagation()}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', borderBottom: '1px solid #F1F5F9', paddingBottom: '8px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 800, color: '#1A2340' }}>Recent Messages</span>
                    <button 
                      onClick={() => { markAllMessagesRead(); setShowMsgDropdown(false); }}
                      style={{ background: 'none', border: 'none', color: '#0047CC', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}
                    >
                      Mark all read
                    </button>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '240px', overflowY: 'auto' }}>
                    {messages.map(msg => (
                      <div key={msg.id} style={{ display: 'flex', gap: '10px', padding: '8px', borderRadius: '6px', background: msg.read ? 'transparent' : '#F4F7FF' }}>
                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: msg.read ? 'transparent' : '#0047CC', marginTop: '5px', flexShrink: 0 }} />
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                            <span style={{ fontSize: '12px', fontWeight: 700, color: '#1A2340' }}>{msg.sender}</span>
                            <span style={{ fontSize: '10px', color: '#6B7A99' }}>{msg.time}</span>
                          </div>
                          <p style={{ fontSize: '11px', color: '#4E5D78', margin: '2px 0 0 0', lineHeight: 1.4 }}>{msg.text}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Notifications Icon */}
            <div 
              style={{ position: 'relative', cursor: 'pointer', padding: '6px' }}
              onClick={() => {
                setShowNotifDropdown(!showNotifDropdown);
                setShowMsgDropdown(false);
              }}
            >
              <span style={{ fontSize: '20px' }}>🔔</span>
              {unreadNotifsCount > 0 && (
                <span style={{
                  position: 'absolute', top: '0', right: '0',
                  background: '#EF4444', color: '#FFFFFF', fontSize: '9px', fontWeight: 800,
                  width: '15px', height: '15px', borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                  {unreadNotifsCount}
                </span>
              )}

              {/* Notifications Dropdown */}
              {showNotifDropdown && (
                <div style={{
                  position: 'absolute', top: '45px', right: '-40px', width: '320px',
                  background: '#FFFFFF', borderRadius: '12px', border: '1px solid #DDE2EC',
                  boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)',
                  padding: '16px', zIndex: 100
                }} onClick={e => e.stopPropagation()}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', borderBottom: '1px solid #F1F5F9', paddingBottom: '8px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 800, color: '#1A2340' }}>Notifications</span>
                    <button 
                      onClick={() => { markAllNotifsRead(); setShowNotifDropdown(false); }}
                      style={{ background: 'none', border: 'none', color: '#0047CC', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}
                    >
                      Mark all read
                    </button>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '240px', overflowY: 'auto' }}>
                    {notifications.map(notif => (
                      <div key={notif.id} style={{ display: 'flex', gap: '10px', padding: '8px', borderRadius: '6px', background: notif.read ? 'transparent' : '#F4F7FF' }}>
                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: notif.read ? 'transparent' : '#0047CC', marginTop: '5px', flexShrink: 0 }} />
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                            <span style={{ fontSize: '12px', fontWeight: 700, color: '#1A2340' }}>{notif.title}</span>
                            <span style={{ fontSize: '10px', color: '#6B7A99' }}>{notif.time}</span>
                          </div>
                          <p style={{ fontSize: '11px', color: '#4E5D78', margin: '2px 0 0 0', lineHeight: 1.4 }}>{notif.message}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Profile Avatar */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', borderLeft: '1px solid #DDE2EC', paddingLeft: '20px' }}>
              <div style={{ position: 'relative' }}>
                <img 
                  src={talentProfile?.avatar || currentUser?.avatar || "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=80"} 
                  alt="Profile" 
                  style={{ width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover' }} 
                />
                <span style={{
                  position: 'absolute', bottom: '0', right: '0',
                  width: '10px', height: '10px', borderRadius: '50%',
                  background: '#10B981', border: '2px solid #FFFFFF'
                }} />
              </div>
              <span style={{ fontSize: '13px', fontWeight: 700, color: '#1A2340' }}>
                {talentProfile?.name || currentUser?.name || 'Talent User'}
              </span>
            </div>

          </div>
        </header>

        {/* ── Main Scroll View ── */}
        <main className="dashboard-main-content" style={{ background: '#F5F7FA' }}>
          {renderSection()}
        </main>

      </div>

      {/* ── Mobile Bottom Nav ── */}
      <div className="mobile-bottom-nav">
        {NAV_ITEMS.slice(0, 4).map(item => {
          const isActive = activeSection === item.id;
          return (
            <button 
              key={item.id}
              className={`mobile-bottom-nav-item ${isActive ? 'active' : ''}`}
              onClick={() => setActiveSection(item.id)}
            >
              <SidebarIcon id={item.id} color={isActive ? '#0047CC' : '#6B7A99'} size={18} />
              <span style={{ marginTop: '2px', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', width: '100%', textAlign: 'center' }}>
                {item.label.split(' ')[0]}
              </span>
            </button>
          );
        })}
        <button className="mobile-bottom-nav-item" onClick={() => setActiveSection('settings')}>
          <SidebarIcon id="settings" color={activeSection === 'settings' ? '#0047CC' : '#6B7A99'} size={18} />
          <span style={{ marginTop: '2px' }}>More</span>
        </button>
      </div>

    </div>
  );
}
