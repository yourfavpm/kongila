import React, { useState } from 'react';
import { GlassCard as Card, NeonButton as Button } from '@kongila/ui';
import { Contract, ClientSettings, PaymentMethod } from '@kongila/shared-types';

interface ClientSettingsPanelProps {
  currentUser: any;
  clientProfile: any;
  contracts: Contract[];
  onSaveSettings: (settings: ClientSettings) => void;
}

const DEFAULT_SETTINGS: ClientSettings = {
  notifications: {
    email: { Requests: true, Matches: true, Interviews: true, Contracts: true, Billing: true, Messages: true, Marketing: false },
    whatsapp: { Requests: false, Matches: true, Interviews: true, Contracts: false, Billing: true, Messages: true, Marketing: false }
  },
  paymentMethods: []
};

export default function ClientSettingsPanel({ currentUser, clientProfile, contracts, onSaveSettings }: ClientSettingsPanelProps) {
  const initialSettings = clientProfile?.settings || DEFAULT_SETTINGS;
  const [settings, setSettings] = useState<ClientSettings>(initialSettings);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [paymentFormOpen, setPaymentFormOpen] = useState(false);

  const handleToggle = (channel: 'email' | 'whatsapp', category: string) => {
    // Enforce mandatory minimums for Billing
    if (category === 'Billing' && channel === 'email' && settings.notifications.email.Billing) {
      alert("Email notifications for Billing are mandatory to ensure you receive overdue invoices and receipts.");
      return;
    }

    setSettings(prev => ({
      ...prev,
      notifications: {
        ...prev.notifications,
        [channel]: {
          ...(prev.notifications[channel as keyof typeof prev.notifications] as any),
          [category]: !(prev.notifications[channel as keyof typeof prev.notifications] as any)[category]
        }
      }
    }));
  };

  const saveSettings = () => {
    onSaveSettings(settings);
    alert('Settings saved successfully.');
  };

  const handleAddPaymentMethod = (e: React.FormEvent) => {
    e.preventDefault();
    const newMethod: PaymentMethod = {
      id: `pm_${Date.now()}`,
      type: 'card',
      last4: Math.floor(1000 + Math.random() * 9000).toString(),
      brand: ['Visa', 'Mastercard', 'Amex'][Math.floor(Math.random() * 3)],
      expiryMonth: '12',
      expiryYear: '28',
      isDefault: settings.paymentMethods.length === 0,
      addedAt: new Date().toISOString()
    };
    setSettings(prev => ({ ...prev, paymentMethods: [...prev.paymentMethods, newMethod] }));
    setPaymentFormOpen(false);
  };

  const handleSetDefaultMethod = (id: string) => {
    setSettings(prev => ({
      ...prev,
      paymentMethods: prev.paymentMethods.map(pm => ({ ...pm, isDefault: pm.id === id }))
    }));
  };

  const handleRemoveMethod = (id: string) => {
    setSettings(prev => ({
      ...prev,
      paymentMethods: prev.paymentMethods.filter(pm => pm.id !== id)
    }));
  };

  const requestAccountClosure = () => {
    const hasActiveContracts = contracts.some(c => c.status === 'active');
    if (hasActiveContracts) {
      alert("Account Closure Blocked: You have active contracts. Please resolve (complete or terminate) all active engagements before requesting account closure.");
      return;
    }
    alert("Account closure request submitted to Super Admin and Account Manager.");
    setShowDeleteConfirm(false);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', paddingBottom: '40px' }}>
      
      {/* 1. Security Settings */}
      <Card style={{ padding: '24px' }}>
        <h3 style={{ fontSize: '18px', fontWeight: 600, color: '#0F172A', marginBottom: '16px' }}>Security & Authentication</h3>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px', background: '#F8FAFC', borderRadius: '8px', marginBottom: '12px' }}>
          <div>
            <h4 style={{ fontSize: '14px', fontWeight: 600, color: '#1E293B', margin: '0 0 4px 0' }}>Password</h4>
            <p style={{ fontSize: '13px', color: '#64748B', margin: 0 }}>Last changed 3 months ago</p>
          </div>
          <button style={{ padding: '8px 16px', fontSize: '13px', fontWeight: 600, color: '#0F172A', border: '1px solid #E2E8F0', borderRadius: '6px', background: 'white', cursor: 'pointer' }}>Change Password</button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px', background: '#F8FAFC', borderRadius: '8px' }}>
          <div>
            <h4 style={{ fontSize: '14px', fontWeight: 600, color: '#1E293B', margin: '0 0 4px 0' }}>Multi-Factor Authentication (MFA)</h4>
            <p style={{ fontSize: '13px', color: '#64748B', margin: 0 }}>Enhance security with an authenticator app or SMS.</p>
          </div>
          <button style={{ padding: '8px 16px', fontSize: '13px', fontWeight: 600, color: '#2563EB', border: 'none', borderRadius: '6px', background: '#EFF6FF', cursor: 'pointer' }}>Enable MFA</button>
        </div>
      </Card>

      {/* 2. Notification Preferences */}
      <Card style={{ padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h3 style={{ fontSize: '18px', fontWeight: 600, color: '#0F172A', margin: 0 }}>Notification Preferences</h3>
          <button onClick={saveSettings} style={{ padding: '8px 16px', fontSize: '13px', fontWeight: 600, color: '#FFF', border: 'none', borderRadius: '6px', background: '#0F172A', cursor: 'pointer' }}>Save Preferences</button>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #E2E8F0' }}>
              <th style={{ padding: '12px 0', fontSize: '13px', color: '#64748B', fontWeight: 600 }}>Category</th>
              <th style={{ padding: '12px 0', fontSize: '13px', color: '#64748B', fontWeight: 600 }}>Email</th>
              <th style={{ padding: '12px 0', fontSize: '13px', color: '#64748B', fontWeight: 600 }}>WhatsApp</th>
            </tr>
          </thead>
          <tbody>
            {Object.keys(DEFAULT_SETTINGS.notifications.email).map((category) => (
              <tr key={category} style={{ borderBottom: '1px solid #F1F5F9' }}>
                <td style={{ padding: '16px 0', fontSize: '14px', color: '#1E293B', fontWeight: 500 }}>{category}</td>
                <td style={{ padding: '16px 0' }}>
                  <input type="checkbox" 
                    checked={(settings.notifications.email as any)[category]} 
                    onChange={() => handleToggle('email', category)}
                    style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                  />
                </td>
                <td style={{ padding: '16px 0' }}>
                  <input type="checkbox" 
                    checked={(settings.notifications.whatsapp as any)[category]} 
                    onChange={() => handleToggle('whatsapp', category)}
                    style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {/* 3. Payment Methods */}
      <Card style={{ padding: '24px' }}>
        <h3 style={{ fontSize: '18px', fontWeight: 600, color: '#0F172A', marginBottom: '16px' }}>Default Payment Method</h3>
        <p style={{ fontSize: '13px', color: '#64748B', marginBottom: '24px' }}>Securely manage your saved payment methods for rapid invoice processing.</p>
        
        {settings.paymentMethods.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
            {settings.paymentMethods.map(pm => (
              <div key={pm.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px', background: pm.isDefault ? '#EFF6FF' : '#F8FAFC', border: pm.isDefault ? '1px solid #BFDBFE' : '1px solid transparent', borderRadius: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <div style={{ width: '48px', height: '32px', background: '#FFF', border: '1px solid #E2E8F0', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '12px', color: '#0F172A' }}>
                    {pm.brand}
                  </div>
                  <div>
                    <h4 style={{ fontSize: '14px', fontWeight: 600, color: '#1E293B', margin: '0 0 4px 0' }}>•••• •••• •••• {pm.last4}</h4>
                    <p style={{ fontSize: '13px', color: '#64748B', margin: 0 }}>Expires {pm.expiryMonth}/{pm.expiryYear}</p>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  {pm.isDefault ? (
                    <span style={{ fontSize: '12px', fontWeight: 600, color: '#2563EB', background: '#DBEAFE', padding: '4px 8px', borderRadius: '4px' }}>Default</span>
                  ) : (
                    <button onClick={() => handleSetDefaultMethod(pm.id)} style={{ fontSize: '13px', color: '#64748B', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>Set Default</button>
                  )}
                  <button onClick={() => handleRemoveMethod(pm.id)} style={{ fontSize: '13px', color: '#EF4444', background: 'none', border: 'none', cursor: 'pointer' }}>Remove</button>
                </div>
              </div>
            ))}
          </div>
        )}

        {!paymentFormOpen ? (
          <button onClick={() => setPaymentFormOpen(true)} style={{ padding: '10px 20px', fontSize: '13px', fontWeight: 600, color: '#0F172A', border: '1px solid #E2E8F0', borderRadius: '6px', background: 'white', cursor: 'pointer' }}>+ Add Payment Method</button>
        ) : (
          <div style={{ background: '#F8FAFC', padding: '24px', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
            <h4 style={{ fontSize: '14px', fontWeight: 600, color: '#0F172A', marginBottom: '16px' }}>Add Card Details (PCI-Compliant Elements)</h4>
            <form onSubmit={handleAddPaymentMethod} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <input type="text" placeholder="Cardholder Name" required style={{ width: '100%', height: '40px', padding: '0 12px', borderRadius: '6px', border: '1px solid #CBD5E1' }} />
              <div style={{ display: 'flex', gap: '12px' }}>
                <input type="text" placeholder="Card Number" required style={{ flex: 1, height: '40px', padding: '0 12px', borderRadius: '6px', border: '1px solid #CBD5E1' }} />
                <input type="text" placeholder="MM/YY" required style={{ width: '80px', height: '40px', padding: '0 12px', borderRadius: '6px', border: '1px solid #CBD5E1' }} />
                <input type="text" placeholder="CVC" required style={{ width: '80px', height: '40px', padding: '0 12px', borderRadius: '6px', border: '1px solid #CBD5E1' }} />
              </div>
              <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                <button type="button" onClick={() => setPaymentFormOpen(false)} style={{ flex: 1, padding: '10px 0', fontSize: '13px', fontWeight: 600, color: '#64748B', border: '1px solid #E2E8F0', borderRadius: '6px', background: 'white', cursor: 'pointer' }}>Cancel</button>
                <button type="submit" style={{ flex: 1, padding: '10px 0', fontSize: '13px', fontWeight: 600, color: '#FFF', border: 'none', borderRadius: '6px', background: '#2563EB', cursor: 'pointer' }}>Save Card</button>
              </div>
            </form>
          </div>
        )}
      </Card>

      {/* 4. Account Deletion */}
      <Card style={{ padding: '24px', border: '1px solid #FCA5A5' }}>
        <h3 style={{ fontSize: '18px', fontWeight: 600, color: '#EF4444', marginBottom: '8px' }}>Danger Zone: Account Closure</h3>
        <p style={{ fontSize: '13px', color: '#64748B', marginBottom: '20px' }}>Requesting account closure will initiate a compliance review. Accounts with active contracts cannot be closed.</p>
        
        {!showDeleteConfirm ? (
          <button onClick={() => setShowDeleteConfirm(true)} style={{ padding: '8px 16px', fontSize: '13px', fontWeight: 600, color: '#EF4444', border: '1px solid #FECACA', borderRadius: '6px', background: '#FEF2F2', cursor: 'pointer' }}>Request Account Closure</button>
        ) : (
          <div style={{ background: '#FEF2F2', padding: '16px', borderRadius: '8px', border: '1px solid #FECACA', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '13px', color: '#991B1B', fontWeight: 500 }}>Are you sure you want to request closure?</span>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button onClick={() => setShowDeleteConfirm(false)} style={{ padding: '6px 12px', fontSize: '13px', color: '#64748B', background: 'none', border: 'none', cursor: 'pointer' }}>Cancel</button>
              <button onClick={requestAccountClosure} style={{ padding: '6px 16px', fontSize: '13px', fontWeight: 600, color: '#FFF', background: '#EF4444', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>Confirm Request</button>
            </div>
          </div>
        )}
      </Card>

    </div>
  );
}
