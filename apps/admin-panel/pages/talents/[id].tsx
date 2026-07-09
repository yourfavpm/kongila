import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { GlassCard } from '@kongila/ui';
import { formatCurrency, getGradeColor } from '@kongila/utils';
import { calculateCompositeVettingGrade } from '@kongila/matching-engine';
import { calculateTalentProfileCompletion } from '@kongila/shared-types';

const Chip = ({ label, color = 'var(--text-primary)', bg = 'var(--bg-tertiary)' }: any) => (
  <span style={{ background: bg, color, padding: '4px 10px', borderRadius: '999px', fontSize: '11px', fontWeight: 600, display: 'inline-flex', alignItems: 'center' }}>
    {label}
  </span>
);

const getFileUrl = (doc: any) => doc?.fileUrl || doc?.file_url || doc?.url || doc?.href || '';

const getTalentUploadedDocuments = (talent: any) => {
  const docs: any[] = [];
  if (talent?.cvUrl) {
    docs.push({
      id: 'cv',
      name: talent.cvName || 'CV / Resume',
      type: 'CV',
      category: 'CV / Resume',
      fileUrl: talent.cvUrl,
      fileSize: talent.cvSize ? `${Math.round(Number(talent.cvSize) / 1024)} KB` : '',
      uploadedAt: talent.createdAt || '',
      status: 'uploaded',
    });
  }
  if (Array.isArray(talent?.certificationFiles)) {
    talent.certificationFiles.forEach((file: any, index: number) => {
      docs.push({
        id: file?.id || `cert_${index}`,
        name: file?.name || `Certification ${index + 1}`,
        type: 'certification',
        category: 'Certifications',
        fileUrl: file?.url || file?.fileUrl || '',
        fileSize: file?.size ? `${Math.round(Number(file.size) / 1024)} KB` : '',
        uploadedAt: file?.uploadedAt || talent.createdAt || '',
        status: 'uploaded',
      });
    });
  }
  if (Array.isArray(talent?.documents)) {
    talent.documents.forEach((doc: any) => {
      docs.push({
        ...doc,
        fileUrl: getFileUrl(doc),
        category: doc?.category || doc?.type || 'Document',
      });
    });
  }
  return docs.filter((doc, index, all) => {
    const key = getFileUrl(doc) || `${doc.name}-${doc.type || doc.category}`;
    return key && all.findIndex(item => (getFileUrl(item) || `${item.name}-${item.type || item.category}`) === key) === index;
  });
};

export default function TalentProfileView() {
  const router = useRouter();
  const { id, return: returnTo } = router.query;
  const [talent, setTalent] = useState<any>(null);
  const [documents, setDocuments] = useState<any[]>([]);
  const [adminUsers, setAdminUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingManager, setSavingManager] = useState(false);

  const fetchData = async () => {
    try {
      const res = await fetch('/api/db');
      const db = await res.json();
      const found = db.talents?.find((t: any) => t.id === id);
      setTalent(found);
      setDocuments(db.documents || []);
      
      const admins = db.users?.filter((u: any) => u.role === 'admin' || (u.platform_access && u.platform_access.includes('admin'))) || [];
      setAdminUsers(admins);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) {
      fetchData();
    }
  }, [id]);

  const handleManagerChange = async (newManagerId: string) => {
    if (!talent) return;
    setSavingManager(true);
    try {
      const res = await fetch('/api/db');
      const db = await res.json();
      
      const updatedTalents = db.talents.map((t: any) => 
        t.id === talent.id ? { ...t, talentManagerId: newManagerId === '' ? undefined : newManagerId } : t
      );
      
      const saveRes = await fetch('/api/db', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ talents: updatedTalents })
      });
      
      if (saveRes.ok) {
        setTalent({ ...talent, talentManagerId: newManagerId === '' ? undefined : newManagerId });
        alert('Talent Manager updated successfully.');
      } else {
        alert('Failed to update talent manager.');
      }
    } catch (err) {
      console.error(err);
      alert('Error updating talent manager.');
    } finally {
      setSavingManager(false);
    }
  };

  if (loading) return <div style={{ padding: '40px' }}>Loading profile...</div>;
  if (!talent) return <div style={{ padding: '40px' }}>Talent not found.</div>;
  const completion = calculateTalentProfileCompletion(talent);
  const uploadedDocs = getTalentUploadedDocuments(talent);
  const backTarget = returnTo === 'vetting' ? '/?tab=vetting' : '/?tab=talent-pipeline';

  return (
    <div className="app-shell" style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-primary)' }}>
      <div style={{ flex: 1, padding: '40px', overflowY: 'auto' }}>
        <Head>
          <title>{talent.name} - Kongila Admin</title>
        </Head>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <button onClick={() => router.push(backTarget)} className="btn-secondary" style={{ fontSize: '13px', padding: '6px 14px', borderRadius: '8px' }}>Back to {returnTo === 'vetting' ? 'Vetting Workspace' : 'Pipeline'}</button>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', background: 'var(--bg-secondary)', padding: '8px 16px', borderRadius: '12px', border: '1px solid var(--border-glass)' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>Assign Talent Manager:</span>
            <select 
              value={talent.talentManagerId || ''} 
              onChange={(e) => handleManagerChange(e.target.value)}
              disabled={savingManager}
              style={{ padding: '6px 12px', borderRadius: '8px', border: '1px solid var(--border-glass)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', fontSize: '13px', outline: 'none' }}
            >
              <option value="">-- Unassigned --</option>
              {adminUsers.map(admin => (
                <option key={admin.id} value={admin.id}>{admin.name} ({admin.email})</option>
              ))}
            </select>
            {savingManager && <span style={{ fontSize: '12px', color: 'var(--accent-cyan)' }}>Saving...</span>}
          </div>
        </div>
        
        <div className="page-header" style={{ marginBottom: '32px' }}>
          <div>
            <h1 className="page-title">Full Talent Profile</h1>
            <p className="page-subtitle">Comprehensive view of {talent.name}'s details and vetting history.</p>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '24px' }}>
          
          {/* Header Card */}
          <GlassCard>
            <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start', marginBottom: '16px' }}>
              {talent.avatar ? <img src={talent.avatar} alt="" style={{ width: '80px', height: '80px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} /> : <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '32px', flexShrink: 0 }}>👤</div>}
              <div style={{ flex: 1 }}>
                <h3 style={{ fontSize: '22px', fontWeight: 800, margin: '0 0 4px 0' }}>{talent.name}</h3>
                <div style={{ fontSize: '14px', color: 'var(--accent-cyan)', marginBottom: '4px' }}>{talent.title || 'No Title Provided'}</div>
                <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '12px' }}>{talent.email}</div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <Chip label={talent.vettingStatus} />
                  <Chip label={`Stage: ${talent.vettingStage}`} />
                  <Chip label={`${completion.percent}% complete`} />
                  {talent.requiresReReview && <Chip label="Requires re-review" color="#B91C1C" bg="#FEF2F2" />}
                  <span style={{ fontWeight: 800, color: getGradeColor(talent.grade), marginLeft: '8px' }}>Grade: {talent.grade || 'N/A'}</span>
                </div>
              </div>
            </div>
            
            <div style={{ marginTop: '16px' }}>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px', textTransform: 'uppercase', fontWeight: 700 }}>Bio Summary</div>
              <p style={{ fontSize: '13px', color: 'var(--text-primary)', lineHeight: 1.5 }}>{talent.bio || 'Not provided.'}</p>
            </div>
            
            {talent.tags && talent.tags.length > 0 && (
              <div style={{ marginTop: '16px' }}>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '6px', textTransform: 'uppercase', fontWeight: 700 }}>Tags</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {talent.tags.map((tag: string) => <span key={tag} style={{ fontSize: '11px', padding: '4px 10px', borderRadius: '999px', background: 'var(--kongila-blue-glow)', color: 'var(--kongila-blue)', fontWeight: 600 }}>{tag}</span>)}
                </div>
              </div>
            )}
          </GlassCard>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '24px' }}>
            
            {/* Personal Information */}
            <GlassCard>
              <h4 style={{ fontSize: '14px', fontWeight: 700, marginBottom: '16px', borderBottom: '1px solid var(--border-glass)', paddingBottom: '8px' }}>Personal Information</h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', fontSize: '13px' }}>
                {[
                  { label: 'Phone', val: talent.phone },
                  { label: 'Date of Birth', val: talent.dateOfBirth },
                  { label: 'Gender', val: talent.gender },
                  { label: 'Nationality', val: talent.nationality },
                  { label: 'Country', val: talent.country },
                  { label: 'City', val: talent.city },
                  { label: 'Timezone', val: talent.timezone },
                ].map(({ label, val }) => (
                  <div key={label}>
                    <div style={{ color: 'var(--text-muted)', marginBottom: '4px', fontSize: '11px', textTransform: 'uppercase' }}>{label}</div>
                    <div style={{ fontWeight: 500, color: val ? 'var(--text-primary)' : 'var(--text-secondary)' }}>{val || 'Not provided'}</div>
                  </div>
                ))}
              </div>
            </GlassCard>

            {/* Location & Preferences */}
            <GlassCard>
              <h4 style={{ fontSize: '14px', fontWeight: 700, marginBottom: '16px', borderBottom: '1px solid var(--border-glass)', paddingBottom: '8px' }}>Location & Preferences</h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', fontSize: '13px' }}>
                {[
                  { label: 'Country', val: talent.country },
                  { label: 'City', val: talent.city },
                  { label: 'Timezone', val: talent.timezone },
                  { label: 'Employment Preference', val: talent.employmentPreference },
                  { label: 'Rate Preference', val: talent.hourlyMonthly },
                  { label: 'Expected Rate', val: talent.salaryExpectation ? `${talent.currency || 'USD'} ${formatCurrency(talent.salaryExpectation)}` : undefined },
                  { label: 'Availability', val: talent.availability !== undefined ? `${talent.availability}%` : undefined },
                ].map(({ label, val }) => (
                  <div key={label}>
                    <div style={{ color: 'var(--text-muted)', marginBottom: '4px', fontSize: '11px', textTransform: 'uppercase' }}>{label}</div>
                    <div style={{ fontWeight: 500, color: val ? 'var(--text-primary)' : 'var(--text-secondary)' }}>{val || 'Not provided'}</div>
                  </div>
                ))}
              </div>
            </GlassCard>

            {/* Professional Details */}
            <GlassCard>
              <h4 style={{ fontSize: '14px', fontWeight: 700, marginBottom: '16px', borderBottom: '1px solid var(--border-glass)', paddingBottom: '8px' }}>Professional Details</h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '16px', fontSize: '13px' }}>
                <div>
                  <div style={{ color: 'var(--text-muted)', marginBottom: '4px', fontSize: '11px', textTransform: 'uppercase' }}>Seniority Level</div>
                  <div style={{ fontWeight: 500, color: talent.seniorityLevel ? 'var(--text-primary)' : 'var(--text-secondary)' }}>{talent.seniorityLevel || 'Not provided'}</div>
                </div>
                <div>
                  <div style={{ color: 'var(--text-muted)', marginBottom: '4px', fontSize: '11px', textTransform: 'uppercase' }}>Role Category</div>
                  <div style={{ fontWeight: 500, color: talent.primaryRoleCategory ? 'var(--text-primary)' : 'var(--text-secondary)' }}>{talent.primaryRoleCategory || 'Not provided'}</div>
                </div>
                <div>
                  <div style={{ color: 'var(--text-muted)', marginBottom: '4px', fontSize: '11px', textTransform: 'uppercase' }}>Total Experience</div>
                  <div style={{ fontWeight: 500, color: talent.experienceYears !== undefined ? 'var(--text-primary)' : 'var(--text-secondary)' }}>{talent.experienceYears !== undefined ? `${talent.experienceYears} Years` : 'Not provided'}</div>
                </div>
                <div>
                  <div style={{ color: 'var(--text-muted)', marginBottom: '4px', fontSize: '11px', textTransform: 'uppercase' }}>Skills</div>
                  <div style={{ fontWeight: 500, color: talent.skills && talent.skills.length > 0 ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                    {talent.skills && talent.skills.length > 0 ? talent.skills.join(', ') : 'Not provided'}
                  </div>
                </div>
                <div>
                  <div style={{ color: 'var(--text-muted)', marginBottom: '4px', fontSize: '11px', textTransform: 'uppercase' }}>Skill Levels</div>
                  <div style={{ fontWeight: 500, color: talent.skillLevels && Object.keys(talent.skillLevels).length > 0 ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                    {talent.skillLevels && Object.keys(talent.skillLevels).length > 0
                      ? Object.entries(talent.skillLevels).map(([skill, level]) => `${skill}: ${String(level)}`).join(' | ')
                      : 'Not provided'}
                  </div>
                </div>
                <div>
                  <div style={{ color: 'var(--text-muted)', marginBottom: '4px', fontSize: '11px', textTransform: 'uppercase' }}>Primary Skills</div>
                  <div style={{ fontWeight: 500, color: talent.primarySkills && talent.primarySkills.length > 0 ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                    {talent.primarySkills && talent.primarySkills.length > 0 ? talent.primarySkills.join(', ') : 'Not provided'}
                  </div>
                </div>
                <div>
                  <div style={{ color: 'var(--text-muted)', marginBottom: '4px', fontSize: '11px', textTransform: 'uppercase' }}>Secondary Skills</div>
                  <div style={{ fontWeight: 500, color: talent.secondarySkills && talent.secondarySkills.length > 0 ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                    {talent.secondarySkills && talent.secondarySkills.length > 0 ? talent.secondarySkills.join(', ') : 'Not provided'}
                  </div>
                </div>
                <div>
                  <div style={{ color: 'var(--text-muted)', marginBottom: '4px', fontSize: '11px', textTransform: 'uppercase' }}>Portfolio URL</div>
                  <div style={{ fontWeight: 500, color: talent.portfolioUrl ? 'var(--kongila-blue)' : 'var(--text-secondary)' }}>
                    {talent.portfolioUrl ? <a href={talent.portfolioUrl} target="_blank" rel="noreferrer" style={{ color: 'inherit' }}>{talent.portfolioUrl}</a> : 'Not provided'}
                  </div>
                </div>
                <div>
                  <div style={{ color: 'var(--text-muted)', marginBottom: '4px', fontSize: '11px', textTransform: 'uppercase' }}>LinkedIn</div>
                  <div style={{ fontWeight: 500, color: talent.linkedIn || talent.linkedinUrl ? 'var(--kongila-blue)' : 'var(--text-secondary)' }}>
                    {(talent.linkedIn || talent.linkedinUrl) ? <a href={talent.linkedIn || talent.linkedinUrl} target="_blank" rel="noreferrer" style={{ color: 'inherit' }}>{talent.linkedIn || talent.linkedinUrl}</a> : 'Not provided'}
                  </div>
                </div>
                <div>
                  <div style={{ color: 'var(--text-muted)', marginBottom: '4px', fontSize: '11px', textTransform: 'uppercase' }}>GitHub</div>
                  <div style={{ fontWeight: 500, color: talent.githubUrl ? 'var(--kongila-blue)' : 'var(--text-secondary)' }}>
                    {talent.githubUrl ? <a href={talent.githubUrl} target="_blank" rel="noreferrer" style={{ color: 'inherit' }}>{talent.githubUrl}</a> : 'Not provided'}
                  </div>
                </div>
                <div>
                  <div style={{ color: 'var(--text-muted)', marginBottom: '4px', fontSize: '11px', textTransform: 'uppercase' }}>Website</div>
                  <div style={{ fontWeight: 500, color: talent.websiteUrl ? 'var(--kongila-blue)' : 'var(--text-secondary)' }}>
                    {talent.websiteUrl ? <a href={talent.websiteUrl} target="_blank" rel="noreferrer" style={{ color: 'inherit' }}>{talent.websiteUrl}</a> : 'Not provided'}
                  </div>
                </div>
                <div>
                  <div style={{ color: 'var(--text-muted)', marginBottom: '4px', fontSize: '11px', textTransform: 'uppercase' }}>Certifications</div>
                  <div style={{ fontWeight: 500, color: talent.certificationFiles && talent.certificationFiles.length > 0 ? 'var(--text-primary)' : 'var(--text-secondary)' }}>{talent.certifications || (talent.certificationFiles && talent.certificationFiles.length > 0 ? `${talent.certificationFiles.length} file(s)` : 'Not provided')}</div>
                </div>
                <div>
                  <div style={{ color: 'var(--text-muted)', marginBottom: '4px', fontSize: '11px', textTransform: 'uppercase' }}>CV / Resume</div>
                  <div style={{ fontWeight: 500, color: talent.cvUrl ? 'var(--kongila-blue)' : 'var(--text-secondary)' }}>
                    {talent.cvUrl ? <a href={talent.cvUrl} target="_blank" rel="noreferrer" style={{ color: 'inherit' }}>{talent.cvName || talent.cvUrl}</a> : 'Not provided'}
                  </div>
                </div>
                <div>
                  <div style={{ color: 'var(--text-muted)', marginBottom: '4px', fontSize: '11px', textTransform: 'uppercase' }}>Profile Photo</div>
                  <div style={{ fontWeight: 500, color: talent.profilePhotoUrl || talent.avatar ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                    {talent.profilePhotoUrl || talent.avatar ? 'Uploaded' : 'Not provided'}
                  </div>
                </div>
              </div>
            </GlassCard>

            <GlassCard>
              <h4 style={{ fontSize: '14px', fontWeight: 700, marginBottom: '16px', borderBottom: '1px solid var(--border-glass)', paddingBottom: '8px' }}>Preferences & Compensation</h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', fontSize: '13px' }}>
                {[
                  { label: 'Preferred Engagement', val: talent.preferredEngagementType || talent.employmentPreference },
                  { label: 'Preferred Work Hours', val: talent.preferredWorkHours || talent.hourlyMonthly },
                  { label: 'Preferred Project Type', val: talent.preferredProjectType },
                  { label: 'Available Start Date', val: talent.availableStartDate },
                  { label: 'Salary Expectation (USD)', val: talent.salaryExpectationUsd ? `USD ${formatCurrency(talent.salaryExpectationUsd)}` : talent.salaryExpectation ? `USD ${formatCurrency(talent.salaryExpectation)}` : 'Not provided' },
                  { label: 'Local Currency', val: talent.salaryExpectationCurrency || talent.currency },
                ].map(({ label, val }) => (
                  <div key={label}>
                    <div style={{ color: 'var(--text-muted)', marginBottom: '4px', fontSize: '11px', textTransform: 'uppercase' }}>{label}</div>
                    <div style={{ fontWeight: 500, color: val ? 'var(--text-primary)' : 'var(--text-secondary)' }}>{val || 'Not provided'}</div>
                  </div>
                ))}
              </div>
            </GlassCard>

            {/* Work Setup & Equipment */}
            <GlassCard>
              <h4 style={{ fontSize: '14px', fontWeight: 700, marginBottom: '16px', borderBottom: '1px solid var(--border-glass)', paddingBottom: '8px' }}>Work Setup & Equipment</h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '16px', fontSize: '13px' }}>
                {[
                  { label: 'Primary Work Setup', val: talent.workSetup },
                  { label: 'Devices / Hardware', val: talent.devices },
                  { label: 'Internet Quality', val: talent.internetQuality },
                  { label: 'Communication Tools', val: talent.communicationTools },
                ].map(({ label, val }) => (
                  <div key={label}>
                    <div style={{ color: 'var(--text-muted)', marginBottom: '4px', fontSize: '11px', textTransform: 'uppercase' }}>{label}</div>
                    <div style={{ fontWeight: 500, color: val ? 'var(--text-primary)' : 'var(--text-secondary)' }}>{val || 'Not provided'}</div>
                  </div>
                ))}
              </div>
            </GlassCard>

            {/* Identity & Compliance */}
            <GlassCard>
              <h4 style={{ fontSize: '14px', fontWeight: 700, marginBottom: '16px', borderBottom: '1px solid var(--border-glass)', paddingBottom: '8px' }}>Identity & Legal</h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '16px', fontSize: '13px' }}>
                {[
                  { label: 'National ID', val: talent.nationalId },
                  { label: 'Passport No.', val: talent.passportNo },
                ].map(({ label, val }) => (
                  <div key={label}>
                    <div style={{ color: 'var(--text-muted)', marginBottom: '4px', fontSize: '11px', textTransform: 'uppercase' }}>{label}</div>
                    <div style={{ fontWeight: 500, color: val ? 'var(--text-primary)' : 'var(--text-secondary)' }}>{val || 'Not provided'}</div>
                  </div>
                ))}
                
                <div style={{ marginTop: '8px' }}>
                  <div style={{ color: 'var(--text-muted)', marginBottom: '8px', fontSize: '11px', textTransform: 'uppercase' }}>Uploaded Documents</div>
                  {talent.documents && talent.documents.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {talent.documents.map((doc: any, i: number) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px', background: 'var(--bg-tertiary)', borderRadius: '6px' }}>
                          <span style={{ fontSize: '16px' }}>📄</span>
                          <span style={{ fontSize: '12px', fontWeight: 600 }}>{doc.name || doc.type || 'Document'}</span>
                          {doc.fileUrl && <a href={doc.fileUrl} target="_blank" rel="noreferrer" style={{ marginLeft: 'auto', fontSize: '11px', color: 'var(--kongila-blue)', textDecoration: 'none' }}>View</a>}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>No documents uploaded.</div>
                  )}
                </div>

                <div style={{ marginTop: '16px' }}>
                  <div style={{ color: 'var(--text-muted)', marginBottom: '8px', fontSize: '11px', textTransform: 'uppercase' }}>Mandatory Compliance Documents</div>
                  {documents.filter(d => !d.userId && d.isMandatory && !d.isHidden).map(doc => {
                    const isSigned = doc.signedByTalentIds?.includes(talent.id);
                    return (
                      <div key={doc.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px', background: 'var(--bg-tertiary)', borderRadius: '6px', marginBottom: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                           <span style={{ fontSize: '16px' }}>⚖️</span>
                           <span style={{ fontSize: '12px', fontWeight: 600 }}>{doc.name}</span>
                        </div>
                        <span style={{ fontSize: '11px', fontWeight: 700, color: isSigned ? 'var(--accent-green)' : 'var(--accent-magenta)', background: isSigned ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)', padding: '2px 8px', borderRadius: '4px' }}>{isSigned ? 'Signed' : 'Pending Signature'}</span>
                      </div>
                    )
                  })}
                  {documents.filter(d => !d.userId && d.isMandatory && !d.isHidden).length === 0 && (
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>No mandatory compliance documents found.</div>
                  )}
                </div>
              </div>
            </GlassCard>

            {/* Vetting Scores */}
            <GlassCard>
              <h4 style={{ fontSize: '14px', fontWeight: 700, marginBottom: '16px', borderBottom: '1px solid var(--border-glass)', paddingBottom: '8px' }}>7-Stage Vetting Scores</h4>
              {talent.vettingScores ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {Object.entries(talent.vettingScores).map(([key, val]) => (
                    <div key={key}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '6px' }}>
                        <span style={{ color: 'var(--text-secondary)', textTransform: 'capitalize' }}>{key.replace(/([A-Z])/g, ' $1')}</span>
                        <span style={{ fontWeight: 700 }}>{val as React.ReactNode}%</span>
                      </div>
                      <div style={{ height: '6px', background: 'var(--bg-tertiary)', borderRadius: '999px', overflow: 'hidden' }}>
                        <div style={{ width: `${val}%`, height: '100%', background: (val as number) >= 85 ? 'var(--accent-green)' : (val as number) >= 70 ? 'var(--accent-gold)' : 'var(--accent-magenta)', borderRadius: '999px', transition: 'width 0.5s ease' }} />
                      </div>
                    </div>
                  ))}
                  <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-tertiary)', padding: '12px', borderRadius: '8px' }}>
                    <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600 }}>Composite Grade</span>
                    <span style={{ fontSize: '20px', fontWeight: 900, color: getGradeColor(talent.grade) }}>{talent.grade} — {calculateCompositeVettingGrade(talent.vettingScores).score}%</span>
                  </div>
                </div>
              ) : (
                <div style={{ color: 'var(--text-muted)', fontSize: '13px' }}>No vetting scores available yet.</div>
              )}
            </GlassCard>

          </div>
        </div>
      </div>
    </div>
  );
}
