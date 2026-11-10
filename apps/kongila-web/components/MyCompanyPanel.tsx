import { apiFetch } from '../lib/apiFetch';
import React, { useState, useEffect } from 'react';

interface MyCompanyPanelProps {
  currentUser: any;
  organizations: any[];
  clientProfiles: any[];
  users: any[];
}

export default function MyCompanyPanel({ currentUser, organizations, clientProfiles, users }: MyCompanyPanelProps) {
  // This panel used to derive the company from the `organizations` and
  // `clientProfiles` arrays handed down from the page, and render
  // "Loading company details..." whenever it could not find a match. Nothing
  // in that path was loading anything: if either array came back empty, which
  // is what happens when the caller has no client_profiles row or no
  // organization_id on it, the panel sat on that message for ever and the
  // client could not tell a slow network from a missing record.
  //
  // It now asks the server for its own company. GET /api/company resolves the
  // organisation from the caller's verified session, so there are three real
  // outcomes: loaded, failed with a reason, or no company linked yet.
  const [company, setCompany] = useState<{ organization: any; profile: any; isPrimaryContact?: boolean; primaryContact?: any } | null>(null);
  const [loadingCompany, setLoadingCompany] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoadingCompany(true);
    setLoadError('');

    (async () => {
      try {
        const res = await apiFetch('/api/company');
        const body = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok) {
          setLoadError(body?.error || `Could not load your company (${res.status}).`);
          setCompany(null);
          return;
        }
        setCompany({
          organization: body?.organization || null,
          profile: body?.profile || null,
          isPrimaryContact: Boolean(body?.isPrimaryContact),
          primaryContact: body?.primaryContact || null
        });
      } catch (err: any) {
        if (!cancelled) {
          setLoadError(err?.message || 'Could not reach the server.');
          setCompany(null);
        }
      } finally {
        if (!cancelled) setLoadingCompany(false);
      }
    })();

    return () => { cancelled = true; };
  }, [currentUser?.id, reloadToken]);

  // The page-level arrays stay as a fallback so nothing regresses for a client
  // whose snapshot is already populated, but they no longer decide whether
  // this panel renders at all.
  const fallbackProfile = clientProfiles.find(cp => cp.userId === currentUser.id || cp.user_id === currentUser.id);
  const currentProfile: any = company?.profile || fallbackProfile;
  const organization: any = company?.organization
    || organizations.find(o => o.id === (fallbackProfile?.organizationId || fallbackProfile?.organization_id));
  const organizationId = organization?.id
    || currentProfile?.organizationId
    || currentProfile?.organization_id;

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
      // Through the server. organizations and client_profiles both have
      // RLS off in the live database, and the organisation id came from
      // component state, so this update could land on another company.
      // The route resolves the organisation from the caller's own profile.
      const response = await apiFetch('/api/company', {
        method: 'PATCH',
        body: JSON.stringify({
          organization: {
            name: formData.name,
            industry: formData.industry,
            company_size: formData.company_size,
            country: formData.country,
            website: formData.website,
            how_did_you_hear_about_us: formData.how_did_you_hear_about_us,
            contact_phone: formData.contactPhone
          },
          profile: {
            position: formData.position,
            phone: formData.contactPhone
          }
        })
      });

      if (!response.ok) {
        const detail = await response.json().catch(() => ({}));
        throw new Error(detail?.error || 'Failed to update company profile');
      }

      setSuccessMsg('Company profile updated successfully.');
      // Read it back, so what is on screen is what the server stored rather
      // than what was typed.
      setReloadToken(t => t + 1);
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
  const [inviteResult, setInviteResult] = useState<{link?: string, error?: string, emailSent?: boolean, emailError?: string} | null>(null);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail) return;
    setInviting(true);
    setInviteResult(null);

    try {
      const res = await apiFetch('/api/company/invite', {
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
      
      setInviteResult({
        link: data.inviteLink,
        emailSent: data.emailSent,
        emailError: data.emailError
      });
      setInviteEmail('');
      setInviteName('');
      setInviteJobTitle('');
    } catch (err: any) {
      setInviteResult({ error: err.message });
    } finally {
      setInviting(false);
    }
  };

  if (loadingCompany && !organization) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: '#64748B' }}>
        Loading company details…
      </div>
    );
  }

  if (loadError && !organization) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: '#991B1B' }}>
        <div style={{ fontWeight: 700, marginBottom: '8px' }}>We could not load your company details.</div>
        <div style={{ fontSize: '13px', color: '#64748B', marginBottom: '16px' }}>{loadError}</div>
        <button
          type="button"
          onClick={() => setReloadToken(t => t + 1)}
          style={{ padding: '10px 18px', borderRadius: '8px', border: '1px solid #CBD5E1', background: '#fff', cursor: 'pointer', fontWeight: 600 }}
        >
          Try again
        </button>
      </div>
    );
  }

  if (!organization) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: '#64748B' }}>
        <div style={{ fontWeight: 700, color: '#0F172A', marginBottom: '8px' }}>No company is linked to your account yet.</div>
        <div style={{ fontSize: '13px' }}>
          Your company record is created with your first talent request. Submit one, or ask whoever invited you to add you to their company.
        </div>
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

      {/* Who this account belongs to. The page gave no sign that the account
          is the company's rather than the signed-in person's, or who among
          the team administers it. */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '16px',
        flexWrap: 'wrap',
        padding: '16px 18px',
        marginBottom: '24px',
        borderRadius: '12px',
        background: company?.isPrimaryContact ? '#EFF6FF' : '#F8FAFC',
        border: `1px solid ${company?.isPrimaryContact ? '#BFDBFE' : '#E2E8F0'}`
      }}>
        <div>
          <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#64748B' }}>
            Primary contact
          </div>
          <div style={{ fontSize: '15px', fontWeight: 700, color: '#0F172A', marginTop: '2px' }}>
            {company?.isPrimaryContact
              ? `You (${company?.primaryContact?.position || currentProfile?.position || 'Administrator'})`
              : company?.primaryContact?.name
                || company?.primaryContact?.email
                || 'Not set'}
          </div>
          <div style={{ fontSize: '12px', color: '#64748B', marginTop: '4px', maxWidth: '620px', lineHeight: 1.6 }}>
            {company?.isPrimaryContact
              ? 'This account belongs to the company. As its primary contact you can edit these details and invite colleagues.'
              : company?.primaryContact
                ? `${company.primaryContact.name || company.primaryContact.email} administers this company account. Ask them to change the company details or your access level.`
                : 'No primary contact is recorded for this company. Ask Kongila to set one.'}
          </div>
        </div>
        {(currentProfile?.permissionLevel || currentProfile?.permission_level) && (
          <div style={{ fontSize: '12px', fontWeight: 700, padding: '6px 12px', borderRadius: '999px', background: '#FFF', border: '1px solid #CBD5E1', color: '#334155', whiteSpace: 'nowrap' }}>
            Your access: {currentProfile.permissionLevel || currentProfile.permission_level}
          </div>
        )}
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
              <label style={labelStyle}>Position Held</label>
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
                <strong>{inviteResult.emailSent ? 'Invitation email sent.' : 'Invitation email not sent.'}</strong>
                {inviteResult.emailError && <> {inviteResult.emailError}</>} Registration link:<br/>
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
