import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';

interface MyCompanyPanelProps {
  currentUser: any;
  organizations: any[];
  clientProfiles: any[];
  users: any[];
}

export default function MyCompanyPanel({ currentUser, organizations, clientProfiles, users }: MyCompanyPanelProps) {
  // Find the organization for the current user
  const currentProfile = clientProfiles.find(cp => cp.userId === currentUser.id || cp.user_id === currentUser.id);
  const organizationId = currentProfile?.organizationId || currentProfile?.organization_id;
  const organization = organizations.find(o => o.id === organizationId);
  
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    industry: '',
    company_size: '',
    country: '',
    website: '',
    how_did_you_hear_about_us: '',
    contactName: '',
    contactEmail: '',
    contactPhone: '',
    position: ''
  });

  useEffect(() => {
    if (organization) {
      setFormData(prev => ({
        ...prev,
        name: organization.name || '',
        industry: organization.industry || '',
        company_size: organization.company_size || '',
        country: organization.country || '',
        website: organization.website || '',
        how_did_you_hear_about_us: organization.how_did_you_hear_about_us || '',
        contactName: currentUser.name || '',
        contactEmail: currentUser.email || '',
        contactPhone: currentProfile?.phone || organization.contactPhone || organization.contact_phone || '',
        position: currentProfile?.position || ''
      }));
    }
  }, [organization, currentProfile, currentUser]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!organizationId) return;
    setSaving(true);
    setSuccessMsg('');
    setErrorMsg('');

    try {
      // 1. Update Organization
      const { error: orgErr } = await supabase.from('organizations').update({
        name: formData.name,
        industry: formData.industry,
        company_size: formData.company_size,
        country: formData.country,
        website: formData.website,
        how_did_you_hear_about_us: formData.how_did_you_hear_about_us,
        contact_phone: formData.contactPhone
      }).eq('id', organizationId);

      if (orgErr) throw orgErr;

      // 2. Update Client Profile (Primary Contact position/phone)
      if (currentProfile?.id) {
        await supabase.from('client_profiles').update({
          position: formData.position,
          phone: formData.contactPhone
        }).eq('id', currentProfile.id);
      }

      setSuccessMsg('Company profile updated successfully.');
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to update company profile');
    } finally {
      setSaving(false);
      setTimeout(() => setSuccessMsg(''), 5000);
    }
  };

  // Invite Logic
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [inviteJobTitle, setInviteJobTitle] = useState('');
  const [invitePermission, setInvitePermission] = useState('Full Access');
  const [inviting, setInviting] = useState(false);
  const [inviteResult, setInviteResult] = useState<{link?: string, error?: string} | null>(null);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail) return;
    setInviting(true);
    setInviteResult(null);

    try {
      const res = await fetch('/api/company/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: inviteEmail,
          name: inviteName,
          jobTitle: inviteJobTitle,
          permissionLevel: invitePermission,
          organizationId
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to send invite');
      
      setInviteResult({ link: data.inviteLink });
      setInviteEmail('');
      setInviteName('');
      setInviteJobTitle('');
    } catch (err: any) {
      setInviteResult({ error: err.message });
    } finally {
      setInviting(false);
    }
  };

  if (!organization) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: '#64748B' }}>
        Loading company details...
      </div>
    );
  }

  const accountManager = users.find(u => u.id === (organization.accountManagerId || organization.account_manager_id));
  const additionalContacts = clientProfiles.filter(cp => 
    (cp.organizationId === organizationId || cp.organization_id === organizationId) && 
    (cp.userId !== currentUser.id && cp.user_id !== currentUser.id)
  );

  return (
    <div style={{ padding: '32px', maxWidth: '1000px', margin: '0 auto' }}>
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#0F172A', marginBottom: '8px' }}>My Company</h1>
        <p style={{ color: '#64748B', fontSize: '14px' }}>Manage your organization's profile and team members.</p>
      </div>

      {(successMsg || errorMsg) && (
        <div style={{ 
          padding: '16px', 
          borderRadius: '8px', 
          marginBottom: '24px', 
          background: successMsg ? '#ECFDF5' : '#FEF2F2',
          color: successMsg ? '#059669' : '#DC2626',
          border: `1px solid ${successMsg ? '#10B981' : '#EF4444'}`
        }}>
          {successMsg || errorMsg}
        </div>
      )}

      <form onSubmit={handleSave} style={{ display: 'grid', gap: '32px' }}>
        
        {/* Company Profile */}
        <div style={{ background: '#FFF', padding: '24px', borderRadius: '12px', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#1E293B', marginBottom: '20px' }}>Company Profile</h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            <div>
              <label style={labelStyle}>Company Name</label>
              <input style={inputStyle} value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} required />
            </div>
            <div>
              <label style={labelStyle}>Industry</label>
              <input style={inputStyle} value={formData.industry} onChange={e => setFormData({...formData, industry: e.target.value})} />
            </div>
            <div>
              <label style={labelStyle}>Company Size</label>
              <select style={inputStyle} value={formData.company_size} onChange={e => setFormData({...formData, company_size: e.target.value})}>
                <option value="">Select size</option>
                <option value="1-10">1-10 employees</option>
                <option value="11-50">11-50 employees</option>
                <option value="51-200">51-200 employees</option>
                <option value="201-500">201-500 employees</option>
                <option value="500+">500+ employees</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>Country</label>
              <input style={inputStyle} value={formData.country} onChange={e => setFormData({...formData, country: e.target.value})} />
            </div>
            <div>
              <label style={labelStyle}>Website</label>
              <input style={inputStyle} type="url" value={formData.website} onChange={e => setFormData({...formData, website: e.target.value})} placeholder="https://" />
            </div>
            <div>
              <label style={labelStyle}>How did you hear about us?</label>
              <input style={inputStyle} value={formData.how_did_you_hear_about_us} onChange={e => setFormData({...formData, how_did_you_hear_about_us: e.target.value})} />
            </div>
          </div>
        </div>

        {/* Primary Contact */}
        <div style={{ background: '#FFF', padding: '24px', borderRadius: '12px', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#1E293B', marginBottom: '20px' }}>Primary Contact</h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            <div>
              <label style={labelStyle}>Name</label>
              <input style={inputStyle} value={formData.contactName} disabled />
              <div style={helpTextStyle}>Name changes are managed via Profile Settings</div>
            </div>
            <div>
              <label style={labelStyle}>Email</label>
              <input style={inputStyle} value={formData.contactEmail} disabled />
              <div style={helpTextStyle}>Email changes require verification</div>
            </div>
            <div>
              <label style={labelStyle}>Phone Number</label>
              <input style={inputStyle} value={formData.contactPhone} onChange={e => setFormData({...formData, contactPhone: e.target.value})} />
            </div>
            <div>
              <label style={labelStyle}>Job Title</label>
              <input style={inputStyle} value={formData.position} onChange={e => setFormData({...formData, position: e.target.value})} />
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button type="submit" disabled={saving} style={{
            background: '#2563EB', color: '#FFF', border: 'none', padding: '12px 24px', borderRadius: '8px',
            fontSize: '14px', fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1
          }}>
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>

      </form>

      {/* Account Team (Read Only) */}
      <div style={{ background: '#F8FAFC', padding: '24px', borderRadius: '12px', border: '1px solid #E2E8F0', marginTop: '32px' }}>
        <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#1E293B', marginBottom: '20px' }}>Your Account Team</h2>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#FFF', padding: '16px', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '24px', background: '#E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>
              👤
            </div>
            <div>
              <div style={{ fontWeight: 600, color: '#0F172A' }}>{organization.accountManagerName || accountManager?.name || 'Assigned Account Manager'}</div>
              <div style={{ fontSize: '13px', color: '#64748B' }}>Account Manager</div>
            </div>
          </div>
          <button style={{
            background: 'none', border: '1px solid #E2E8F0', padding: '8px 16px', borderRadius: '6px',
            fontSize: '13px', fontWeight: 600, color: '#334155', cursor: 'pointer'
          }}>
            Message
          </button>
        </div>
      </div>

      {/* Additional Contacts (Multi-user gating) */}
      {organization.multi_user_enabled || organization.multi_user_enabled === "true" ? (
        <div style={{ background: '#FFF', padding: '24px', borderRadius: '12px', border: '1px solid #E2E8F0', marginTop: '32px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <div>
              <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#1E293B' }}>Additional Contacts</h2>
              <p style={{ fontSize: '13px', color: '#64748B', marginTop: '4px' }}>Manage team members who have access to your Kongila account.</p>
            </div>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
            {additionalContacts.length === 0 ? (
              <div style={{ padding: '24px', textAlign: 'center', border: '1px dashed #CBD5E1', borderRadius: '8px', color: '#64748B', fontSize: '14px' }}>
                No additional contacts invited yet.
              </div>
            ) : (
              additionalContacts.map((contact, i) => {
                const userObj = users.find(u => u.id === contact.userId || u.id === contact.user_id);
                return (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px', border: '1px solid #E2E8F0', borderRadius: '8px' }}>
                    <div>
                      <div style={{ fontWeight: 600, color: '#0F172A', fontSize: '14px' }}>{userObj?.name || 'Pending Invitation'}</div>
                      <div style={{ fontSize: '13px', color: '#64748B' }}>{userObj?.email || ''} • {contact.position || 'Team Member'}</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                      <span style={{ fontSize: '12px', background: '#F1F5F9', padding: '4px 8px', borderRadius: '12px', color: '#475569', fontWeight: 500 }}>
                        {contact.permissionLevel || contact.permission_level || 'Full Access'}
                      </span>
                      <button style={{ color: '#EF4444', background: 'none', border: 'none', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
                        Remove
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <form onSubmit={handleInvite} style={{ background: '#F8FAFC', padding: '20px', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
            <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#0F172A', marginBottom: '16px' }}>+ Invite Team Member</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
              <input style={inputStyle} placeholder="Name" value={inviteName} onChange={e => setInviteName(e.target.value)} required />
              <input style={inputStyle} type="email" placeholder="Email Address" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} required />
              <input style={inputStyle} placeholder="Job Title" value={inviteJobTitle} onChange={e => setInviteJobTitle(e.target.value)} />
              <select style={inputStyle} value={invitePermission} onChange={e => setInvitePermission(e.target.value)}>
                <option value="Full Access">Full Access</option>
                <option value="Billing Only">Billing Only</option>
                <option value="View Only">View Only</option>
              </select>
            </div>
            
            {inviteResult?.link && (
              <div style={{ padding: '12px', background: '#ECFDF5', border: '1px solid #10B981', borderRadius: '6px', marginBottom: '16px', color: '#065F46', fontSize: '13px' }}>
                <strong>Simulation:</strong> Invitation sent! Registration link:<br/>
                <a href={inviteResult.link} target="_blank" rel="noreferrer" style={{ color: '#059669', wordBreak: 'break-all' }}>{inviteResult.link}</a>
              </div>
            )}
            {inviteResult?.error && (
              <div style={{ padding: '12px', background: '#FEF2F2', border: '1px solid #EF4444', borderRadius: '6px', marginBottom: '16px', color: '#B91C1C', fontSize: '13px' }}>
                Error: {inviteResult.error}
              </div>
            )}

            <button type="submit" disabled={inviting} style={{
              background: '#0F172A', color: '#FFF', border: 'none', padding: '10px 20px', borderRadius: '6px',
              fontSize: '13px', fontWeight: 600, cursor: inviting ? 'not-allowed' : 'pointer', opacity: inviting ? 0.7 : 1
            }}>
              {inviting ? 'Sending...' : 'Send Invitation'}
            </button>
          </form>
        </div>
      ) : null}

    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '13px',
  fontWeight: 600,
  color: '#475569',
  marginBottom: '6px'
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  borderRadius: '6px',
  border: '1px solid #CBD5E1',
  fontSize: '14px',
  color: '#0F172A',
  background: '#FFF'
};

const helpTextStyle: React.CSSProperties = {
  fontSize: '12px',
  color: '#94A3B8',
  marginTop: '4px'
};
