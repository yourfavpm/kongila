import React, { useState, useRef, useEffect } from 'react';

// ─── Types ───────────────────────────────────────────────────────────────────
interface TalentDashboardProps {
  currentUser: any;
  talentProfile: any;
  contracts: any[];
  matches: any[];
  onSignOut?: () => void;
  onUpdateProfile?: (updatedProfile: any) => void;
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
  | 'onboarding'
  | 'support'
  | 'settings';

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
  { id: 'support',      label: 'Support Center',        icon: '🙋' },
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
const ProfileSection = ({ user, profile, contracts, setActiveSection }: { user: any; profile: any; contracts: any[]; setActiveSection: (sec: Section) => void }) => {
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

  // Get active contract or default
  const activeContract = contracts?.find(c => c.status === 'Active') || contracts?.[0] || {
    employer: 'Horizon Fintech',
    role: profile?.title || 'Senior Full-Stack Engineer',
    salary: profile?.salaryExpectation || 4500,
    startDate: 'Expires Oct 2026',
    rating: 5
  };

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

      {/* Two Column Widget Layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '28px' }}>
        
        {/* Left Column widgets */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
          
          {/* Professional Details */}
          <Card>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#1A2340', margin: 0 }}>Professional Details</h3>
              <button onClick={() => setActiveSection('professional')} style={{
                background: 'none', border: 'none', color: '#0047CC', fontSize: '18px', cursor: 'pointer'
              }}>✏️</button>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#6B7A99', textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>
                Top Skills
              </span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {skillsArray.slice(0, 4).map((skill: string, i: number) => {
                  const levels = ['EXPERT', 'ADVANCED', 'INTERMEDIATE', 'JUNIOR'];
                  const level = levels[i % levels.length];
                  return (
                    <span key={i} style={{
                      background: '#F1F5F9', border: '1px solid #E2E8F0',
                      borderRadius: '6px', padding: '6px 10px', fontSize: '12px', fontWeight: 600,
                      color: '#1E293B', display: 'inline-flex', alignItems: 'center', gap: '6px'
                    }}>
                      {skill}
                      <span style={{ fontSize: '9px', background: '#0047CC', color: '#fff', padding: '2px 4px', borderRadius: '4px' }}>
                        {level}
                      </span>
                    </span>
                  );
                })}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', borderTop: '1px solid #F1F5F9', paddingTop: '20px' }}>
              <div>
                <span style={{ fontSize: '11px', color: '#6B7A99', display: 'block' }}>ROLE PREFERENCE</span>
                <span style={{ fontSize: '13px', fontWeight: 700, color: '#1A2340', marginTop: '4px', display: 'block' }}>
                  {profile?.title || 'Full-stack Developer'}
                </span>
              </div>
              <div>
                <span style={{ fontSize: '11px', color: '#6B7A99', display: 'block' }}>AVAILABILITY</span>
                <span style={{ fontSize: '13px', fontWeight: 700, color: '#0047CC', marginTop: '4px', display: 'block' }}>
                  {profile?.availability ? `${profile.availability}%` : 'Immediate'}
                </span>
              </div>
              <div style={{ marginTop: '8px' }}>
                <span style={{ fontSize: '11px', color: '#6B7A99', display: 'block' }}>EXPECTED RANGE</span>
                <span style={{ fontSize: '13px', fontWeight: 700, color: '#1A2340', marginTop: '4px', display: 'block' }}>
                  ${(profile?.salaryExpectation || 4500).toLocaleString()} USD / mo
                </span>
              </div>
              <div style={{ marginTop: '8px' }}>
                <span style={{ fontSize: '11px', color: '#6B7A99', display: 'block' }}>WORK TYPE</span>
                <span style={{ fontSize: '13px', fontWeight: 700, color: '#1A2340', marginTop: '4px', display: 'block' }}>
                  {profile?.employmentPreference || 'Remote / Hybrid'}
                </span>
              </div>
            </div>
          </Card>

          {/* Document Vault */}
          <Card>
            <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#1A2340', marginBottom: '20px', margin: 0 }}>Document Vault</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
              {[
                { title: 'Curriculum Vitae', desc: 'Updated 2 days ago', icon: '📄' },
                { title: 'Portfolio PDF', desc: 'Case studies (14MB)', icon: '🌐' },
                { title: 'Certifications', desc: '3 AWS, 1 Scrum', icon: '🏆' }
              ].map((doc, idx) => (
                <div key={idx} onClick={() => setActiveSection('documents')} style={{
                  border: '1px solid #E2E8F0', borderRadius: '8px', padding: '16px',
                  display: 'flex', flexDirection: 'column', gap: '8px', cursor: 'pointer',
                  transition: 'border-color 0.2s'
                }}>
                  <span style={{ fontSize: '24px' }}>{doc.icon}</span>
                  <div>
                    <span style={{ fontSize: '13px', fontWeight: 700, color: '#1A2340', display: 'block' }}>{doc.title}</span>
                    <span style={{ fontSize: '11px', color: '#6B7A99', display: 'block', marginTop: '2px' }}>{doc.desc}</span>
                  </div>
                </div>
              ))}
            </div>
          </Card>

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
              <span style={{ background: '#E6FFFA', color: '#00A389', fontSize: '10px', fontWeight: 700, padding: '4px 8px', borderRadius: '4px' }}>
                LIVE
              </span>
            </div>

            <div style={{ border: '1px solid #E2E8F0', borderRadius: '8px', padding: '16px', marginBottom: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <span style={{ fontSize: '14px', fontWeight: 700, color: '#1A2340' }}>{activeContract.employer}</span>
                  <span style={{ fontSize: '12px', color: '#6B7A99', display: 'block', marginTop: '2px' }}>{activeContract.role}</span>
                </div>
                <div style={{ display: 'flex', gap: '2px' }}>
                  {Array.from({ length: 5 }).map((_, i) => (
                    <span key={i} style={{ color: i < (activeContract.rating || 5) ? '#F59E0B' : '#E2E8F0', fontSize: '14px' }}>★</span>
                  ))}
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '16px', borderTop: '1px solid #F1F5F9', paddingTop: '12px' }}>
                <span style={{ fontSize: '13px', fontWeight: 700, color: '#0047CC' }}>
                  ${(activeContract.salary || 4500).toLocaleString()}/mo
                </span>
                <span style={{ fontSize: '12px', color: '#6B7A99' }}>{activeContract.startDate}</span>
              </div>
            </div>

            {/* Next Interview Widget */}
            <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '16px' }}>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '12px' }}>
                <span style={{ fontSize: '20px' }}>📅</span>
                <div>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: '#1A2340', display: 'block' }}>Next Interview</span>
                  <span style={{ fontSize: '11px', color: '#6B7A99' }}>Wednesday, July 17 at 2:00 PM</span>
                </div>
              </div>
              <button onClick={() => setActiveSection('features')} style={{
                width: '100%', background: 'transparent', border: '1px solid #0047CC', color: '#0047CC',
                borderRadius: '8px', padding: '10px', fontSize: '12px', fontWeight: 700, cursor: 'pointer'
              }}>
                Book Interview +
              </button>
            </div>
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
                  <button onClick={() => setActiveSection('features')} style={{
                    background: 'none', border: 'none', color: '#0047CC', fontSize: '16px', cursor: 'pointer'
                  }}>💬</button>
                </div>
              ))}
            </div>
          </Card>

          {/* Welcome Video / Onboarding journey */}
          <Card style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{
              background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
              height: '140px', display: 'flex', alignItems: 'center', justifyContent: 'center',
              position: 'relative'
            }}>
              {/* Play Button Overlay */}
              <div style={{
                width: '44px', height: '44px', borderRadius: '50%',
                background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(8px)',
                border: '2px solid rgba(255,255,255,0.3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '18px', cursor: 'pointer', color: '#FFFFFF', zIndex: 2
              }}>▶</div>
              <span style={{ position: 'absolute', bottom: '12px', left: '16px', color: '#FFFFFF', fontSize: '12px', fontWeight: 600 }}>
                Welcome to Kongila
              </span>
            </div>
            <div style={{ padding: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#1A2340' }}>Onboarding Journey</span>
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#0047CC' }}>{progress}% Complete</span>
              </div>
              <div style={{ height: '6px', background: '#F1F5F9', borderRadius: '3px', overflow: 'hidden', marginBottom: '12px' }}>
                <div style={{ width: `${progress}%`, height: '100%', background: '#0047CC', borderRadius: '3px' }} />
              </div>
              <span style={{ fontSize: '11px', color: '#6B7A99' }}>
                Next step: <strong>Identity Verification</strong>
              </span>
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
      <div style={{ display: 'grid', gridTemplateColumns: '250px 1fr', gap: '24px', alignItems: 'flex-start' }}>
        
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
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
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
              <div style={{ gridColumn: 'span 3', padding: '32px 0', textAlign: 'center', color: '#6B7A99', fontSize: '13px' }}>
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

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
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
            background: '#FFFFFF', borderRadius: '12px', width: '480px',
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

  // Identify active contract or create a dynamic fallback based on profile
  const activeContract = talentContracts.find(c => c.status === 'Signed' || c.status === 'Active') || talentContracts[0] || {
    id: 'KNG-FIN-2024-883',
    clientName: 'Horizon Fintech',
    role: profile?.title || 'Senior Full-Stack Engineer',
    salary: profile?.salaryExpectation || 4500,
    startDate: 'Jan 12, 2024',
    endDate: 'Dec 21, 2024',
    engagementModel: 'Remote / Full-time Retainer',
    rateType: 'Hourly',
    rateAmount: 120.00,
    totalEarned: 54240.00,
    invoicedBalance: 12450.00,
    nextPayout: 6400.00,
    nextPayoutDate: 'Friday, May 24',
    rating: 5,
    qualityOfWork: 4.9,
    communication: 4.8,
    timeliness: 4.9,
    status: 'Signed'
  };

  // Billing display (hourly or monthly depending on choice when hired)
  const isHourly = activeContract.rateType === 'Hourly';
  const rateDisplay = isHourly 
    ? `$${(activeContract.rateAmount || 120).toFixed(2)} / hr`
    : `$${(activeContract.salary || activeContract.rateAmount || 4500).toLocaleString()} / mo`;

  // History list (contains active contract + historical contracts)
  const historyList = talentContracts.length > 0 ? talentContracts : [
    activeContract,
    {
      id: 'KNG-LOG-2023-735',
      clientName: 'Vanguard Logistics',
      role: 'UI Designer (Product)',
      salary: 3800,
      startDate: 'Jan 2023',
      endDate: 'Dec 2023',
      status: 'Closed',
      rating: 5
    },
    {
      id: 'KNG-MED-2023-012',
      clientName: 'Nexus Health',
      role: 'Visual Designer',
      salary: 4100,
      startDate: 'Jan 2023',
      endDate: 'May 2023',
      status: 'Closed',
      rating: 5
    },
    {
      id: 'KNG-TEC-2022-911',
      clientName: 'Skyline Tech',
      role: 'Junior Interaction Designer',
      salary: 2800,
      startDate: 'Aug 2022',
      endDate: 'Dec 2022',
      status: 'Closed',
      rating: 4
    }
  ];

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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px', fontFamily: 'var(--font-display, Inter, sans-serif)' }}>
      
      {/* active contract details header breadcrumb/sub */}
      <div style={{ fontSize: '14px', color: '#0047CC', fontWeight: 700 }}>
        Kongila + Remotan
      </div>

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

          <div style={{ display: 'flex', gap: '40px' }}>
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
          <button style={{
            background: '#0047CC', color: '#FFFFFF', border: 'none', borderRadius: '8px',
            padding: '12px 20px', fontSize: '13px', fontWeight: 700, cursor: 'pointer',
            transition: 'background 0.2s'
          }}>
            Download Contract PDF
          </button>
          <button style={{
            background: 'transparent', color: '#0047CC', border: '1px solid #0047CC', borderRadius: '8px',
            padding: '12px 20px', fontSize: '13px', fontWeight: 700, cursor: 'pointer'
          }}>
            Request Rate Review
          </button>
        </div>
      </Card>

      {/* THREE WIDGETS ROW */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.2fr', gap: '24px' }}>
        
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
                <span style={{ fontSize: '16px', fontWeight: 800, color: '#1A2340' }}>4.9</span>
                <span style={{ fontSize: '11px', color: '#6B7A99' }}>Overall Rating</span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '2px' }}>
              {Array.from({ length: 5 }).map((_, i) => (
                <span key={i} style={{ color: '#F59E0B', fontSize: '14px' }}>★</span>
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
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 2fr', gap: '24px' }}>
        
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
                <button style={{
                  background: '#F5F7FA', border: '1px solid #DDE2EC', borderRadius: '6px',
                  padding: '6px 12px', fontSize: '12px', fontWeight: 600, color: '#0047CC', cursor: 'pointer'
                }}>Message</button>
              </div>
            ))}
          </div>
        </Card>

        {/* Contract Documents */}
        <Card style={{ padding: '24px' }}>
          <h3 style={{ fontSize: '15px', fontWeight: 800, color: '#1A2340', margin: '0 0 20px 0' }}>CONTRACT DOCUMENTS</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            {[
              { name: 'Master Talent Agreement', type: 'PDF • Signed' },
              { name: 'Mutual NDA (Fintech)', type: 'PDF • Signed' },
              { name: 'Data Privacy Addendum', type: 'PDF • Signed' },
              { name: 'Statement of Work (SOW)', type: 'PDF • Signed' }
            ].map((doc, i) => (
              <div key={i} style={{
                border: '1px solid #E2E8F0', borderRadius: '8px', padding: '12px 16px',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center'
              }}>
                <div>
                  <span style={{ fontSize: '13px', fontWeight: 700, color: '#1A2340', display: 'block' }}>{doc.name}</span>
                  <span style={{ fontSize: '11px', color: '#6B7A99', display: 'block', marginTop: '2px' }}>{doc.type}</span>
                </div>
                <button style={{ background: 'none', border: 'none', fontSize: '16px', cursor: 'pointer', color: '#0047CC' }}>👁️</button>
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
          <button style={{ background: 'none', border: 'none', color: '#0047CC', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}>
            Show Full Archives
          </button>
        </div>
      </Card>

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
      id: 'doc_chidi_nda',
      name: 'Non-Disclosure Agreement (NDA)',
      description: 'Confidentiality and proprietary rights for Project Orion.',
      status: 'pending_signature',
      dueDate: 'Due in 3 days'
    },
    {
      id: 'doc_chidi_ip',
      name: 'Intellectual Property Agreement',
      description: 'Master assignment of inventions and copyright.',
      status: 'signed',
      signedAt: 'Dec 12, 2023'
    },
    {
      id: 'doc_chidi_ethics',
      name: 'Code of Ethics & Conduct',
      description: 'Standard corporate behavior and anti-corruption policy.',
      status: 'under_review',
      uploadedAt: 'Jan 05, 2026'
    },
    {
      id: 'doc_chidi_contractor',
      name: 'Independent Contractor Agreement',
      description: 'General service provision terms and payout schedules.',
      status: 'signed',
      signedAt: 'Mar 30, 2023'
    },
    {
      id: 'doc_chidi_dpa',
      name: 'Data Privacy Addendum (DPA)',
      description: 'Compliance with GDPR and regional data protection laws.',
      status: 'pending_signature',
      dueDate: 'Added 2 hours ago'
    }
  ].map(defDoc => {
    const dbDoc = documents.find((d: any) => d.id === defDoc.id);
    return dbDoc ? { ...defDoc, ...dbDoc } : defDoc;
  });

  const pendingDocs = complianceDocs.filter((d: any) => d.status === 'pending_signature');
  const completedDocs = complianceDocs.filter((d: any) => d.status === 'signed' || d.status === 'under_review');
  // Dynamically calculate score: 3 completed = 92%, 4 completed = 96%, 5 completed = 100%
  const complianceScore = 80 + completedDocs.length * 4; 

  const handleSign = (docId: string) => {
    const sig = typedSig.trim() || 'Chidi Anya';
    
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
          userId: 'usr_chidi',
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
              statusText = doc.id === 'doc_chidi_dpa' ? '⏰ Sign Now - Added 2 hours ago' : `⏰ Pending Signature - ${doc.dueDate}`;
              buttonText = 'Sign Now';
              buttonStyle = { background: '#0047CC', color: '#FFFFFF', fontWeight: 700 };
            } else if (isUnderReview) {
              statusColor = '#0047CC';
              statusBg = '#EEF3FF';
              statusText = '⏳ Under Review - Submitted Jan 05';
              buttonText = 'View Only';
              buttonStyle = { background: 'transparent', border: '1px solid #DDE2EC', color: '#1A2340' };
            } else if (isSigned) {
              statusColor = '#00A3A0';
              statusBg = '#F0FBFB';
              statusText = `✓ Signed - ${doc.signedAt || 'Dec 12, 2023'}`;
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
  const tickets = profile?.supportTickets || [
    {
      id: 'TK-88210',
      subject: 'Urgent - API Timeout on Webhooks',
      category: 'Technical Support',
      status: 'Open',
      priority: 'Urgent',
      createdAt: 'Oct 28, 2023',
      lastActivity: '2 mins ago',
      assignedAgent: { name: 'Support System', role: 'Automated Bot', avatar: '' },
      messages: [
        {
          id: 'msg_1',
          sender: { name: profile?.name || 'Chidi Anya', role: 'Talent', isSupport: false },
          text: 'I am getting continuous 504 gateway timeouts when our webhook endpoint is triggered by kongila integration. Please check.',
          timestamp: '10:40 AM'
        }
      ]
    },
    {
      id: 'TK-67842',
      subject: 'Issues with International Wire Transfer - Q3 Earnings',
      category: 'Payment Issues',
      status: 'In Progress',
      priority: 'High',
      createdAt: 'Oct 24, 2023',
      lastActivity: '5 hours ago',
      assignedAgent: { name: 'Sarah Kong', role: 'Global Support Lead', avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=80' },
      messages: [
        {
          id: 'msg_2_1',
          sender: { name: profile?.name || 'Chidi Anya', role: 'Talent', isSupport: false },
          text: 'Hello, I\'m having trouble receiving my payout for the last project (Project: Nebula). The status says \'Sent\' in the dashboard, but I haven\'t seen anything in my account. I checked with my bank and they don\'t see any pending transfers.',
          timestamp: '10:12 AM'
        },
        {
          id: 'msg_2_2',
          sender: { name: 'Sarah Kong', role: 'Global Support Lead', isSupport: true, avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=80' },
          text: 'Hi Alex, I\'ve looked into this for you. It seems there was a slight delay in the intermediary bank processing for international wires this week. I\'ve initiated a trace on the transaction. Could you please confirm if your SWIFT/BIC code has changed recently?',
          timestamp: '10:45 AM'
        }
      ]
    },
    {
      id: 'TK-57115',
      subject: 'Profile Badge Verification',
      category: 'Verification',
      status: 'Resolved',
      priority: 'Medium',
      createdAt: 'Oct 22, 2023',
      lastActivity: '2 days ago',
      assignedAgent: { name: 'Vetting Team', role: 'Compliance Lead', avatar: '' },
      messages: [
        {
          id: 'msg_3_1',
          sender: { name: profile?.name || 'Chidi Anya', role: 'Talent', isSupport: false },
          text: 'Could you please check if my AWS and Scrum Master badges are verified? I uploaded the certificates.',
          timestamp: '9:00 AM'
        },
        {
          id: 'msg_3_2',
          sender: { name: 'Vetting Team', role: 'Compliance Lead', isSupport: true },
          text: 'Hi Chidi, we have verified both certificates. The badges are now live on your profile.',
          timestamp: '2:15 PM'
        }
      ]
    },
    {
      id: 'TK-28301',
      subject: 'New User Onboarding Guide',
      category: 'Guidance',
      status: 'Resolved',
      priority: 'Low',
      createdAt: 'Oct 15, 2023',
      lastActivity: '1 week ago',
      assignedAgent: { name: 'Onboarding Bot', role: 'System Guide', avatar: '' },
      messages: [
        {
          id: 'msg_4_1',
          sender: { name: profile?.name || 'Chidi Anya', role: 'Talent', isSupport: false },
          text: 'Where can I find details about remote retainer agreements?',
          timestamp: '11:00 AM'
        },
        {
          id: 'msg_4_2',
          sender: { name: 'Onboarding Bot', role: 'System Guide', isSupport: true },
          text: 'Welcome to Kongila! You can view all agreement guides in the resources pane or in your documents tab.',
          timestamp: '11:01 AM'
        }
      ]
    }
  ];

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
          sender: { name: profile?.name || 'Chidi Anya', role: 'Talent', isSupport: false },
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
                text: `Hi ${profile?.name || 'Chidi'}, thanks for submitting your ticket. I have reviewed your query regarding "${newTicketSubject}" and am escalating it to our engineering group. I will update you shortly!`,
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
      sender: { name: profile?.name || 'Chidi Anya', role: 'Talent', isSupport: false },
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
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '28px', fontFamily: 'var(--font-display, Inter, sans-serif)' }}>
        
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
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
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
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '24px', alignItems: 'flex-start' }}>
        
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
            background: '#FFFFFF', borderRadius: '12px', width: '520px',
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
export default function TalentDashboard({ currentUser, talentProfile, contracts, matches, onSignOut, onUpdateProfile }: TalentDashboardProps) {
  const [activeSection, setActiveSection] = useState<Section>('profile');

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
    switch (activeSection) {
      case 'profile':      return <ProfileSection user={currentUser} profile={talentProfile} contracts={contracts} setActiveSection={setActiveSection} />;
      case 'professional': return <ProfessionalSection profile={talentProfile} />;
      case 'documents':    return <DocumentsSection profile={talentProfile} onUpdateProfile={onUpdateProfile} />;
      case 'contracts':    return <ContractSection contracts={contracts} profile={talentProfile} />;
      case 'pipeline':     return <PipelineSection profile={talentProfile} />;
      case 'features':     return <FeaturesSection />;
      case 'compliance':   return <ComplianceSection profile={talentProfile} onUpdateProfile={onUpdateProfile} />;
      case 'engagement':   return <EngagementSection />;
      case 'onboarding':   return <OnboardingSection profile={talentProfile} />;
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
        <button className="mobile-hamburger" onClick={() => {
          // simple inline toggle logic can go here or just rely on bottom nav for mobile
        }}>
          <span></span><span></span><span></span>
        </button>
      </div>

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
                <span style={{ fontSize: '15px', flexShrink: 0 }}>{item.icon}</span>
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
              ⚙️ Settings
            </button>
            <button onClick={onSignOut} style={{
              display: 'flex', alignItems: 'center', gap: '10px',
              background: 'transparent', border: 'none', color: '#6B7A99',
              fontSize: '13px', fontWeight: 600, cursor: 'pointer', textAlign: 'left', padding: '6px 8px',
              width: '100%'
            }}>
              🚪 Logout
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
        <header style={{
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
        <main style={{ flex: 1, padding: '40px 48px', overflowY: 'auto', background: '#F5F7FA' }}>
          {renderSection()}
        </main>

      </div>

      {/* ── Mobile Bottom Nav ── */}
      <div className="mobile-bottom-nav">
        {NAV_ITEMS.slice(0, 4).map(item => (
          <button 
            key={item.id}
            className={`mobile-bottom-nav-item ${activeSection === item.id ? 'active' : ''}`}
            onClick={() => setActiveSection(item.id)}
          >
            <span style={{ fontSize: '18px' }}>{item.icon}</span>
            <span style={{ marginTop: '2px', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', width: '100%', textAlign: 'center' }}>
              {item.label.split(' ')[0]}
            </span>
          </button>
        ))}
        <button className="mobile-bottom-nav-item" onClick={() => setActiveSection('settings')}>
          <span style={{ fontSize: '18px' }}>⚙️</span>
          <span style={{ marginTop: '2px' }}>More</span>
        </button>
      </div>

    </div>
  );
}
