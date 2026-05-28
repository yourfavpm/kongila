import sys

TARGET = 'apps/kongila-web/components/TalentDashboard.tsx'
START_MARKER = '// ─── Section 7: Profile Detail Section ───────────────────────────────────────'
END_MARKER = '// ─── Section 7.5: Settings Section ───────────────────────────────────────────'

NEW_SECTION = r"""// ─── Section 7: Profile Detail Section ───────────────────────────────────────
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
                  <h1 style={{ fontSize: '26px', fontWeight: 900, margin: '0 0 4px 0', letterSpacing: '-0.5px' }}>{fullName}</h1>
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

"""

with open(TARGET, 'r') as f:
    content = f.read()

start_idx = content.find(START_MARKER)
end_idx = content.find(END_MARKER)

if start_idx == -1 or end_idx == -1:
    print(f"ERROR: Could not find markers. start={start_idx}, end={end_idx}")
    sys.exit(1)

new_content = content[:start_idx] + NEW_SECTION + content[end_idx:]

with open(TARGET, 'w') as f:
    f.write(new_content)

print(f"SUCCESS: Replaced ProfileDetailSection ({end_idx - start_idx} chars) with new section ({len(NEW_SECTION)} chars)")
print(f"New file size: {len(new_content)} bytes")
