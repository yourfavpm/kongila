import React, { useState } from 'react';
import { GlassCard as Card, NeonButton as Button } from '@kongila/ui';
import { TalentProfile, TalentSettings } from '@kongila/shared-types';
import { supabase } from '../lib/supabaseClient';
import QRCode from 'react-qr-code';

interface TalentSettingsPanelProps {
  profile: TalentProfile;
  onUpdateProfile?: (profile: any) => void;
}

type NotificationCategory = 'VettingUpdates' | 'InterviewAlerts' | 'PaymentAlerts' | 'Messages' | 'Marketing';

export default function TalentSettingsPanel({ profile, onUpdateProfile }: TalentSettingsPanelProps) {
  const [activeTab, setActiveTab] = useState<'security' | 'notifications' | 'preferences' | 'data'>('security');
  
  // Security State
  const [showMfaSetup, setShowMfaSetup] = useState(false);
  const [mfaEnabled, setMfaEnabled] = useState(false);
  const [mfaCode, setMfaCode] = useState('');
  
  // Account Deletion State
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteReason, setDeleteReason] = useState('');

  // Notifications State
  const defaultSettings: TalentSettings = {
    notifications: {
      email: { VettingUpdates: true, InterviewAlerts: true, PaymentAlerts: true, Messages: true, Marketing: false },
      whatsapp: { VettingUpdates: true, InterviewAlerts: true, PaymentAlerts: true, Messages: true, Marketing: false }
    }
  };
  const settings: TalentSettings = {
    ...defaultSettings,
    ...(profile.settings || {}),
    notifications: {
      ...defaultSettings.notifications,
      ...(profile.settings?.notifications || {}),
      email: {
        ...defaultSettings.notifications.email,
        ...(profile.settings?.notifications?.email || {})
      },
      whatsapp: {
        ...defaultSettings.notifications.whatsapp,
        ...(profile.settings?.notifications?.whatsapp || {})
      }
    }
  };

  const [toastMessage, setToastMessage] = useState('');

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3000);
  };

  const handleToggleNotification = async (channel: 'email' | 'whatsapp', category: NotificationCategory) => {
    const isCurrentlyOn = settings.notifications[channel][category];
    const otherChannel = channel === 'email' ? 'whatsapp' : 'email';
    
    // Critical Floor Check (REQ-KT-1302)
    if (
      isCurrentlyOn && 
      ['VettingUpdates', 'InterviewAlerts', 'PaymentAlerts'].includes(category) && 
      !settings.notifications[otherChannel][category]
    ) {
      showToast(`At least one channel must remain active for ${category.replace(/([A-Z])/g, ' $1').trim()}.`);
      return; // Prevent toggle
    }

    // Optimistic Update
    const updatedSettings = {
      ...settings,
      notifications: {
        ...settings.notifications,
        [channel]: {
          ...settings.notifications[channel],
          [category]: !isCurrentlyOn
        }
      }
    };

    if (onUpdateProfile) {
      onUpdateProfile({ ...profile, settings: updatedSettings });
    }

    // Backend Update (REQ-KT-1301)
    const { error } = await supabase
      .from('talent_profiles')
      .update({ settings: updatedSettings })
      .eq('id', profile.id);

    if (error) console.error('Failed to update notification settings', error);
  };

  const handleVerifyMfa = () => {
    if (mfaCode.length === 6) {
      setMfaEnabled(true);
      setShowMfaSetup(false);
      showToast('MFA enabled successfully.');
    } else {
      showToast('Invalid MFA Code');
    }
  };

  const handleRequestDeletion = async () => {
    if (!deleteReason) {
      showToast('Please provide a reason.');
      return;
    }
    
    // Create support ticket for Super Admin
    await supabase.from('support_tickets').insert({
      talent_id: profile.id,
      category: 'Account Access',
      subject: 'Account Deletion Request',
      description: `Reason: ${deleteReason}`,
      status: 'open',
      priority: 'Urgent'
    });

    setShowDeleteConfirm(false);
    setDeleteReason('');
    showToast('Deletion request submitted. Super Admin will process within 30 days.');
  };

  const renderSecurity = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <Card style={{ padding: '24px', background: '#FFFFFF' }}>
        <h3 style={{ fontSize: '18px', fontWeight: 700, margin: '0 0 16px 0', color: '#0F172A' }}>Login Details</h3>
        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#475569', marginBottom: '8px' }}>Email Address</label>
          <input 
            type="text" 
            value={profile.email} 
            disabled 
            style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #E2E8F0', background: '#F8FAFC', color: '#64748B' }}
          />
          <p style={{ fontSize: '12px', color: '#94A3B8', marginTop: '6px' }}>To change your email, please open a Support Ticket for identity verification.</p>
        </div>
        <div>
          <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#475569', marginBottom: '8px' }}>Password</label>
          <Button style={{ background: '#F1F5F9', color: '#0F172A', border: '1px solid #CBD5E1', padding: '8px 16px' }}>Change Password</Button>
        </div>
      </Card>

      <Card style={{ padding: '24px', background: '#FFFFFF' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ fontSize: '18px', fontWeight: 700, margin: '0 0 4px 0', color: '#0F172A' }}>Two-Factor Authentication (MFA)</h3>
            <p style={{ fontSize: '14px', color: '#64748B', margin: 0 }}>Add an extra layer of security to your account using an authenticator app.</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: mfaEnabled ? '#10B981' : '#64748B' }}>
              {mfaEnabled ? 'Enabled' : 'Disabled'}
            </span>
            <button 
              onClick={() => mfaEnabled ? setMfaEnabled(false) : setShowMfaSetup(true)}
              style={{
                width: '44px', height: '24px', borderRadius: '12px', background: mfaEnabled ? '#10B981' : '#CBD5E1',
                position: 'relative', border: 'none', cursor: 'pointer', transition: 'all 0.2s'
              }}
            >
              <div style={{
                width: '20px', height: '20px', borderRadius: '50%', background: '#fff',
                position: 'absolute', top: '2px', left: mfaEnabled ? '22px' : '2px', transition: 'all 0.2s'
              }} />
            </button>
          </div>
        </div>

        {showMfaSetup && !mfaEnabled && (
          <div style={{ marginTop: '24px', padding: '24px', background: '#F8FAFC', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
            <h4 style={{ fontSize: '16px', fontWeight: 600, margin: '0 0 16px 0', color: '#0F172A' }}>Setup Authenticator App</h4>
            <div style={{ display: 'flex', gap: '24px', alignItems: 'flex-start' }}>
              <div style={{ background: '#FFF', padding: '12px', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                <QRCode value={`otpauth://totp/Kongila:${profile.email}?secret=JBSWY3DPEHPK3PXP&issuer=Kongila`} size={120} />
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: '14px', color: '#475569', margin: '0 0 12px 0' }}>1. Scan the QR code with your authenticator app (e.g., Google Authenticator, Authy).</p>
                <p style={{ fontSize: '14px', color: '#475569', margin: '0 0 16px 0' }}>2. Enter the 6-digit code generated by the app below to verify.</p>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <input 
                    type="text" 
                    placeholder="000000" 
                    maxLength={6}
                    value={mfaCode}
                    onChange={(e) => setMfaCode(e.target.value)}
                    style={{ width: '120px', padding: '10px 14px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '16px', letterSpacing: '4px', textAlign: 'center' }}
                  />
                  <Button onClick={handleVerifyMfa} style={{ background: '#2563EB', color: '#FFF' }}>Verify & Enable</Button>
                  <Button onClick={() => setShowMfaSetup(false)} style={{ background: 'transparent', color: '#64748B', border: 'none' }}>Cancel</Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </Card>
    </div>
  );

  const renderNotifications = () => (
    <Card style={{ padding: '24px', background: '#FFFFFF' }}>
      <h3 style={{ fontSize: '18px', fontWeight: 700, margin: '0 0 4px 0', color: '#0F172A' }}>Notification Channels</h3>
      <p style={{ fontSize: '14px', color: '#64748B', margin: '0 0 24px 0' }}>Control how you receive updates for different events.</p>
      
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ borderBottom: '2px solid #E2E8F0' }}>
            <th style={{ textAlign: 'left', padding: '12px 0', color: '#475569', fontSize: '13px', fontWeight: 600 }}>Category</th>
            <th style={{ textAlign: 'center', padding: '12px 0', color: '#475569', fontSize: '13px', fontWeight: 600 }}>Email</th>
            <th style={{ textAlign: 'center', padding: '12px 0', color: '#475569', fontSize: '13px', fontWeight: 600 }}>WhatsApp</th>
          </tr>
        </thead>
        <tbody>
          {(['VettingUpdates', 'InterviewAlerts', 'PaymentAlerts', 'Messages', 'Marketing'] as NotificationCategory[]).map((cat) => (
            <tr key={cat} style={{ borderBottom: '1px solid #F1F5F9' }}>
              <td style={{ padding: '16px 0', fontSize: '14px', color: '#0F172A', fontWeight: 500 }}>
                {cat.replace(/([A-Z])/g, ' $1').trim()}
              </td>
              <td style={{ padding: '16px 0', textAlign: 'center' }}>
                <input 
                  type="checkbox" 
                  checked={settings.notifications.email[cat]} 
                  onChange={() => handleToggleNotification('email', cat)}
                  style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: '#2563EB' }}
                />
              </td>
              <td style={{ padding: '16px 0', textAlign: 'center' }}>
                <input 
                  type="checkbox" 
                  checked={settings.notifications.whatsapp[cat]} 
                  onChange={() => handleToggleNotification('whatsapp', cat)}
                  style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: '#10B981' }}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );

  const renderData = () => (
    <Card style={{ padding: '24px', background: '#FFFFFF', border: '1px solid #FECACA' }}>
      <h3 style={{ fontSize: '18px', fontWeight: 700, margin: '0 0 4px 0', color: '#DC2626' }}>Danger Zone</h3>
      <p style={{ fontSize: '14px', color: '#64748B', margin: '0 0 24px 0' }}>Permanent account actions.</p>
      
      {!showDeleteConfirm ? (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h4 style={{ fontSize: '15px', fontWeight: 600, color: '#0F172A', margin: '0 0 4px 0' }}>Request Account Deletion</h4>
            <p style={{ fontSize: '13px', color: '#64748B', margin: 0 }}>Permanently delete your account and data. Subject to 30-day retention.</p>
          </div>
          <Button onClick={() => setShowDeleteConfirm(true)} style={{ background: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA' }}>
            Request Deletion
          </Button>
        </div>
      ) : (
        <div style={{ background: '#FEF2F2', padding: '20px', borderRadius: '8px', border: '1px solid #FECACA' }}>
          <h4 style={{ fontSize: '15px', fontWeight: 600, color: '#DC2626', margin: '0 0 8px 0' }}>Confirm Deletion Request</h4>
          <p style={{ fontSize: '13px', color: '#475569', margin: '0 0 16px 0', lineHeight: 1.5 }}>
            Are you sure you want to request account deletion? Your data will be held for up to 30 days in accordance with GDPR before permanent destruction. Active contracts may block this action.
          </p>
          <textarea 
            placeholder="Please tell us why you are leaving (Required)"
            value={deleteReason}
            onChange={(e) => setDeleteReason(e.target.value)}
            style={{ width: '100%', minHeight: '80px', padding: '12px', borderRadius: '8px', border: '1px solid #FECACA', marginBottom: '16px', fontSize: '14px' }}
          />
          <div style={{ display: 'flex', gap: '12px' }}>
            <Button onClick={handleRequestDeletion} style={{ background: '#DC2626', color: '#FFF' }}>Submit Request</Button>
            <Button onClick={() => { setShowDeleteConfirm(false); setDeleteReason(''); }} style={{ background: '#FFF', color: '#475569', border: '1px solid #CBD5E1' }}>Cancel</Button>
          </div>
        </div>
      )}
    </Card>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '800px', margin: '0 auto', width: '100%', paddingBottom: '60px' }}>
      <div>
        <h2 style={{ fontSize: '24px', fontWeight: 700, color: '#0F172A', margin: '0 0 4px 0' }}>Account Settings</h2>
        <p style={{ fontSize: '14px', color: '#64748B', margin: 0 }}>Manage your security, notifications, and data.</p>
      </div>

      {toastMessage && (
        <div style={{ background: '#1E293B', color: '#FFF', padding: '12px 20px', borderRadius: '8px', fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}>
          {toastMessage}
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '24px', borderBottom: '1px solid #E2E8F0' }}>
        {(['security', 'notifications', 'preferences', 'data'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: '12px 0', background: 'transparent', border: 'none', borderBottom: activeTab === tab ? '2px solid #2563EB' : '2px solid transparent',
              color: activeTab === tab ? '#2563EB' : '#64748B', fontWeight: activeTab === tab ? 600 : 500, fontSize: '14px', cursor: 'pointer', textTransform: 'capitalize', transition: 'all 0.2s'
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Content */}
      {activeTab === 'security' && renderSecurity()}
      {activeTab === 'notifications' && renderNotifications()}
      {activeTab === 'preferences' && (
        <Card style={{ padding: '24px', background: '#FFFFFF' }}>
          <h3 style={{ fontSize: '18px', fontWeight: 700, margin: '0 0 16px 0', color: '#0F172A' }}>Language Preference</h3>
          <select style={{ width: '100%', maxWidth: '300px', padding: '10px 14px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '14px', background: '#FFF' }}>
            <option value="en">English (US)</option>
            {/* Phase 2: Add more languages */}
          </select>
        </Card>
      )}
      {activeTab === 'data' && renderData()}
    </div>
  );
}
