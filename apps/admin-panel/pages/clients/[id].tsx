import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { GlassCard, KongilaLoader } from '@kongila/ui';
import { formatCurrency, formatDate } from '@kongila/utils';
import { supabase } from '../../lib/supabaseClient';
import {
  enrichUsersWithRoleAssignments,
  formatAssignableUserLabel,
  isAccountManagerAssignable,
  mergeAuthenticatedUserIntoAssignableUsers,
} from '../../lib/adminRoleFilters';

type Tab = 'overview' | 'requests' | 'active-talent' | 'contracts' | 'billing' | 'communication';

const Chip = ({ label, color = 'var(--text-primary)', bg = 'var(--bg-tertiary)' }: any) => (
  <span style={{ background: bg, color, padding: '4px 10px', borderRadius: '999px', fontSize: '11px', fontWeight: 600, display: 'inline-flex', alignItems: 'center' }}>
    {label}
  </span>
);

export default function ClientProfileView() {
  const router = useRouter();
  const { id } = router.query;
  const [client, setClient] = useState<any>(null);
  const [clientRequests, setClientRequests] = useState<any[]>([]);
  const [clientContracts, setClientContracts] = useState<any[]>([]);
  const [clientInvoices, setClientInvoices] = useState<any[]>([]);
  const [clientPayments, setClientPayments] = useState<any[]>([]);
  const [clientMessages, setClientMessages] = useState<any[]>([]);
  const [adminUsers, setAdminUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  
  // Modal State
  const [showReassignModal, setShowReassignModal] = useState(false);
  const [reassignForm, setReassignForm] = useState({ newAmId: '', reason: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!id) return;
    
    // Optimistically render if we have cached data for this client
    if (typeof window !== 'undefined') {
      const cached = sessionStorage.getItem(`kongila_client_${id}`);
      if (cached) {
        try {
          setClient(JSON.parse(cached));
          setLoading(false);
        } catch(e) {}
      }
    }
    
    fetchClientData();
    // Re-fetch every 5 seconds to ensure cross-tab data consistency (REQ-KA-203)
    const interval = setInterval(fetchClientData, 5000);
    return () => clearInterval(interval);
  }, [id]);

  const fetchClientData = async () => {
    try {
      const { data: orgs } = await supabase.from('organizations').select('*').eq('id', id);
      const org = orgs && orgs.length > 0 ? orgs[0] : null;

      if (!org) {
        setLoading(false);
        return;
      }

      // 1. Immediately render the core CRM page and cache it
      setClient(org);
      if (typeof window !== 'undefined') {
        sessionStorage.setItem(`kongila_client_${id}`, JSON.stringify(org));
      }
      setLoading(false);

      // 2. Fetch heavy relational data asynchronously in the background
      const sessionPromise = supabase.auth.getSession();
      const adminsPromise = supabase.from('users').select('id, name, email, role, platform_access');
      const rolesPromise = supabase.from('roles').select('id, name');
      const userRolesPromise = supabase.from('user_roles').select('user_id, role_id');
      const dbPromise = fetch('/api/db').then(res => res.json());

      const [{ data: { session } }, { data: admins }, { data: roles }, { data: userRoles }, db] = await Promise.all([
        sessionPromise,
        adminsPromise,
        rolesPromise,
        userRolesPromise,
        dbPromise
      ]);

      setAdminUsers(
        mergeAuthenticatedUserIntoAssignableUsers(
          enrichUsersWithRoleAssignments(admins || [], roles || [], userRoles || []),
          session?.user,
        ).filter(isAccountManagerAssignable)
      );
        
      // Fetch client profiles
      const { data: profiles } = await supabase.from('client_profiles').select('*').eq('organization_id', org.id);
      const orgUserIds = (profiles || []).map((cp: any) => cp.user_id);
        
      // Fetch real requests
      let requests: any[] = [];
      if (orgUserIds.length > 0) {
        const { data: supabaseRequests } = await supabase.from('talent_requests').select('*').in('client_id', orgUserIds);
        if (supabaseRequests) {
          requests = supabaseRequests.map((r: any) => ({
            ...(r.payload || {}),
            id: r.payload?.id || r.id,
            dbId: r.id,
          }));
        }
      }
        
      const contracts = (db.contracts || []).filter((c: any) => orgUserIds.includes(c.clientId));
      const invoices = (db.invoices || []).filter((i: any) => orgUserIds.includes(i.clientId));
      const invoiceIds = invoices.map((i: any) => i.id);
      const payments = (db.payments || []).filter((p: any) => invoiceIds.includes(p.invoiceId));
        
      setClientRequests(requests);
      setClientContracts(contracts);
      setClientInvoices(invoices);
      setClientPayments(payments);
      setClientMessages([]);
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  };

  const handleReassignAM = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reassignForm.newAmId || !reassignForm.reason.trim()) {
      alert("Please select an Account Manager and provide a reason.");
      return;
    }
    
    setIsSubmitting(true);
    const newAm = adminUsers.find(u => u.id === reassignForm.newAmId);
    
    try {
      // Update the organization in Supabase
      const { error: orgError } = await supabase
        .from('organizations')
        .update({
          account_manager_id: newAm.id
        })
        .eq('id', id);

      if (orgError) throw orgError;
      
      // Real audit log in Supabase
      const actorName = 'Super Admin';
      const actionName = hasAccountManager ? 'Reassign Account Manager' : 'Assign Account Manager';
      const previousAmName = hasAccountManager ? accountManagerName : 'None';
      const actionDesc = `${hasAccountManager ? 'Reassigned' : 'Assigned'} AM from ${previousAmName} to ${newAm.name || newAm.email}. Reason: ${reassignForm.reason}`;
      
      const { error: auditError } = await supabase.from('audit_logs').insert({
        actor: actorName,
        action: actionName,
        details: actionDesc
      });
      
      if (auditError) console.error('Failed to write audit log:', auditError);
      
      setClient({
        ...client,
        account_manager_id: newAm.id,
        accountManagerId: newAm.id,
        accountManagerName: newAm.name || newAm.email,
      });
      setShowReassignModal(false);
      setReassignForm({ newAmId: '', reason: '' });
      alert(`Account Manager successfully assigned to ${newAm.name || newAm.email}.`);
    } catch (e) {
      console.error(e);
      alert('Failed to save Account Manager.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) return <KongilaLoader text="Loading client profile..." />;
  if (!client) return <div style={{ padding: '40px' }}>Client not found.</div>;

  const activeContracts = clientContracts.filter(c => c.status === 'Signed' || c.status === 'Active');
  const isAtRisk = client.status === 'At Risk' || (client.healthScore && client.healthScore < 75);
  const currentAccountManagerId = client.account_manager_id || client.accountManagerId;
  const currentAccountManager = adminUsers.find(u => u.id === currentAccountManagerId);
  const hasAccountManager = Boolean(currentAccountManagerId);
  const accountManagerName = currentAccountManager?.name || currentAccountManager?.email || client.accountManagerName || 'Assigned Account Manager';
  const openAccountManagerModal = () => {
    setReassignForm({ newAmId: currentAccountManagerId || '', reason: '' });
    setShowReassignModal(true);
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'overview':
        return (
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <GlassCard>
                <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '16px' }}>Company Information</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', fontSize: '13px' }}>
                  <div>
                    <div style={{ color: 'var(--text-muted)', marginBottom: '4px' }}>Organization Name</div>
                    <div style={{ fontWeight: 600 }}>{client.name}</div>
                  </div>
                  <div>
                    <div style={{ color: 'var(--text-muted)', marginBottom: '4px' }}>Client ID</div>
                    <div style={{ fontWeight: 600 }}>{client.id}</div>
                  </div>
                  <div>
                    <div style={{ color: 'var(--text-muted)', marginBottom: '4px' }}>Primary Contact Email</div>
                    <div style={{ fontWeight: 600 }}>{client.contact_email || client.contactEmail || 'N/A'}</div>
                  </div>
                  <div>
                    <div style={{ color: 'var(--text-muted)', marginBottom: '4px' }}>Primary Contact Phone</div>
                    <div style={{ fontWeight: 600 }}>{client.contact_phone || client.contactPhone || 'N/A'}</div>
                  </div>
                  <div>
                    <div style={{ color: 'var(--text-muted)', marginBottom: '4px' }}>Subscription Tier</div>
                    <div style={{ fontWeight: 600 }}>{client.subscription_type || 'Basic'}</div>
                  </div>
                  <div>
                    <div style={{ color: 'var(--text-muted)', marginBottom: '4px' }}>Created At</div>
                    <div style={{ fontWeight: 600 }}>{formatDate(client.created_at || client.createdAt)}</div>
                  </div>
                </div>
              </GlassCard>
              
              <GlassCard>
                <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '16px' }}>Internal Notes</h3>
                <p style={{ fontSize: '13px', color: client.internalNotes ? 'var(--text-primary)' : 'var(--text-muted)', whiteSpace: 'pre-wrap' }}>
                  {client.internalNotes || 'No internal notes found for this client.'}
                </p>
                <button className="btn-secondary" style={{ marginTop: '16px', fontSize: '12px', padding: '6px 12px', borderRadius: '6px' }}>Edit Notes</button>
              </GlassCard>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <GlassCard>
                <h3 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '16px' }}>Account Health</h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '16px' }}>
                  <div style={{ 
                    width: '64px', height: '64px', borderRadius: '50%', 
                    border: `4px solid ${isAtRisk ? '#EF4444' : '#10B981'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '20px', fontWeight: 700, color: isAtRisk ? '#EF4444' : '#10B981'
                  }}>
                    {client.healthScore || 100}
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '15px', color: isAtRisk ? '#EF4444' : '#10B981' }}>
                      {isAtRisk ? 'At Risk' : 'Healthy'}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Score dynamically calculated.</div>
                  </div>
                </div>
              </GlassCard>

              <GlassCard>
                <h3 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '16px' }}>Account Manager</h3>
                {hasAccountManager ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                    <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'var(--bg-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>
                      {accountManagerName[0]}
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '14px' }}>{accountManagerName}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>ID: {currentAccountManagerId}</div>
                      {currentAccountManager?.email && currentAccountManager?.name && (
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>{currentAccountManager.email}</div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div style={{ marginBottom: '16px', padding: '14px', borderRadius: '10px', background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', fontSize: '13px' }}>
                    No account manager has been assigned to this client yet.
                  </div>
                )}
                <button onClick={openAccountManagerModal} className="btn-primary" style={{ width: '100%', fontSize: '13px', padding: '8px', borderRadius: '6px' }}>
                  {hasAccountManager ? 'Reassign Account Manager' : 'Assign Account Manager'}
                </button>
              </GlassCard>
            </div>
          </div>
        );
        
      case 'requests':
        return (
          <GlassCard style={{ padding: 0, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-glass)', background: 'var(--bg-tertiary)' }}>
                  <th style={{ padding: '16px', fontWeight: 600, color: 'var(--text-secondary)' }}>Service Type</th>
                  <th style={{ padding: '16px', fontWeight: 600, color: 'var(--text-secondary)' }}>Role</th>
                  <th style={{ padding: '16px', fontWeight: 600, color: 'var(--text-secondary)' }}>Hires Needed</th>
                  <th style={{ padding: '16px', fontWeight: 600, color: 'var(--text-secondary)' }}>Status</th>
                  <th style={{ padding: '16px', fontWeight: 600, color: 'var(--text-secondary)' }}>Created</th>
                  <th style={{ padding: '16px', fontWeight: 600, color: 'var(--text-secondary)' }}></th>
                </tr>
              </thead>
              <tbody>
                {clientRequests.length === 0 ? (
                  <tr><td colSpan={6} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>No requests found.</td></tr>
                ) : (
                  clientRequests.map(req => (
                    <tr key={req.id} style={{ borderBottom: '1px solid var(--border-glass)' }}>
                      <td style={{ padding: '16px', fontWeight: 600 }}>{req.serviceType}</td>
                      <td style={{ padding: '16px' }}>{req.roleDescription?.substring(0, 40) || 'N/A'}</td>
                      <td style={{ padding: '16px' }}>{req.numberOfHires || 1}</td>
                      <td style={{ padding: '16px' }}><Chip label={req.status} /></td>
                      <td style={{ padding: '16px' }}>{formatDate(req.createdAt)}</td>
                      <td style={{ padding: '16px', textAlign: 'right' }}>
                        <button onClick={() => router.push(`/requests/${req.id || req.dbId}`)} className="btn-secondary" style={{ padding: '4px 10px', fontSize: '12px', borderRadius: '6px' }}>Open Request</button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </GlassCard>
        );
        
      case 'active-talent':
        return (
          <GlassCard style={{ padding: 0, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-glass)', background: 'var(--bg-tertiary)' }}>
                  <th style={{ padding: '16px', fontWeight: 600, color: 'var(--text-secondary)' }}>Talent Name</th>
                  <th style={{ padding: '16px', fontWeight: 600, color: 'var(--text-secondary)' }}>Role</th>
                  <th style={{ padding: '16px', fontWeight: 600, color: 'var(--text-secondary)' }}>Start Date</th>
                  <th style={{ padding: '16px', fontWeight: 600, color: 'var(--text-secondary)' }}>Monthly Rate</th>
                  <th style={{ padding: '16px', fontWeight: 600, color: 'var(--text-secondary)' }}>Perf. Score</th>
                  <th style={{ padding: '16px', fontWeight: 600, color: 'var(--text-secondary)' }}></th>
                </tr>
              </thead>
              <tbody>
                {activeContracts.length === 0 ? (
                  <tr><td colSpan={6} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>No active talent currently deployed.</td></tr>
                ) : (
                  activeContracts.map(c => (
                    <tr key={c.id} style={{ borderBottom: '1px solid var(--border-glass)' }}>
                      <td style={{ padding: '16px', fontWeight: 600 }}>{c.talentName}</td>
                      <td style={{ padding: '16px' }}>{c.role}</td>
                      <td style={{ padding: '16px' }}>{formatDate(c.startDate || c.start_date)}</td>
                      <td style={{ padding: '16px' }}>{formatCurrency(c.salary || c.monthly_rate_usd || 0)}</td>
                      <td style={{ padding: '16px' }}>
                        {c.performance_score ? <span style={{ color: 'var(--accent-green)', fontWeight: 600 }}>{c.performance_score}%</span> : <span style={{ color: 'var(--text-muted)' }}>Pending Review</span>}
                      </td>
                      <td style={{ padding: '16px', textAlign: 'right' }}>
                        <button className="btn-secondary" style={{ padding: '4px 10px', fontSize: '12px', borderRadius: '6px' }}>Remotan Workspace</button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </GlassCard>
        );

      case 'contracts':
        return (
          <GlassCard style={{ padding: 0, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-glass)', background: 'var(--bg-tertiary)' }}>
                  <th style={{ padding: '16px', fontWeight: 600, color: 'var(--text-secondary)' }}>Contract ID</th>
                  <th style={{ padding: '16px', fontWeight: 600, color: 'var(--text-secondary)' }}>Talent</th>
                  <th style={{ padding: '16px', fontWeight: 600, color: 'var(--text-secondary)' }}>Role</th>
                  <th style={{ padding: '16px', fontWeight: 600, color: 'var(--text-secondary)' }}>Status</th>
                  <th style={{ padding: '16px', fontWeight: 600, color: 'var(--text-secondary)' }}></th>
                </tr>
              </thead>
              <tbody>
                {clientContracts.length === 0 ? (
                  <tr><td colSpan={5} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>No contracts found.</td></tr>
                ) : (
                  clientContracts.map(c => (
                    <tr key={c.id} style={{ borderBottom: '1px solid var(--border-glass)' }}>
                      <td style={{ padding: '16px', fontFamily: 'monospace' }}>{c.id.split('_').pop()?.substring(0, 8)}</td>
                      <td style={{ padding: '16px', fontWeight: 600 }}>{c.talentName}</td>
                      <td style={{ padding: '16px' }}>{c.role}</td>
                      <td style={{ padding: '16px' }}><Chip label={c.status} /></td>
                      <td style={{ padding: '16px', textAlign: 'right' }}>
                        <button className="btn-secondary" style={{ padding: '4px 10px', fontSize: '12px', borderRadius: '6px' }}>Download PDF</button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </GlassCard>
        );

      case 'billing':
        return (
          <GlassCard style={{ padding: 0, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-glass)', background: 'var(--bg-tertiary)' }}>
                  <th style={{ padding: '16px', fontWeight: 600, color: 'var(--text-secondary)' }}>Invoice ID</th>
                  <th style={{ padding: '16px', fontWeight: 600, color: 'var(--text-secondary)' }}>Amount</th>
                  <th style={{ padding: '16px', fontWeight: 600, color: 'var(--text-secondary)' }}>Due Date</th>
                  <th style={{ padding: '16px', fontWeight: 600, color: 'var(--text-secondary)' }}>Status</th>
                  <th style={{ padding: '16px', fontWeight: 600, color: 'var(--text-secondary)' }}></th>
                </tr>
              </thead>
              <tbody>
                {clientInvoices.length === 0 ? (
                  <tr><td colSpan={5} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>No billing history found.</td></tr>
                ) : (
                  clientInvoices.map(inv => (
                    <tr key={inv.id} style={{ borderBottom: '1px solid var(--border-glass)' }}>
                      <td style={{ padding: '16px', fontFamily: 'monospace' }}>{inv.id}</td>
                      <td style={{ padding: '16px', fontWeight: 600 }}>{formatCurrency(inv.amount)}</td>
                      <td style={{ padding: '16px' }}>{formatDate(inv.dueDate)}</td>
                      <td style={{ padding: '16px' }}>
                        <span style={{ 
                          color: inv.status === 'paid' ? '#10B981' : inv.status === 'overdue' ? '#EF4444' : '#F59E0B',
                          background: inv.status === 'paid' ? 'rgba(16, 185, 129, 0.1)' : inv.status === 'overdue' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(245, 158, 11, 0.1)',
                          padding: '3px 8px', borderRadius: '6px', fontWeight: 600, fontSize: '11px'
                        }}>
                          {inv.status.toUpperCase()}
                        </span>
                      </td>
                      <td style={{ padding: '16px', textAlign: 'right' }}>
                        {inv.status !== 'paid' && (
                          <button className="btn-secondary" style={{ padding: '4px 10px', fontSize: '12px', borderRadius: '6px', marginRight: '8px' }}>Mark Paid</button>
                        )}
                        <button className="btn-secondary" style={{ padding: '4px 10px', fontSize: '12px', borderRadius: '6px' }}>PDF</button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </GlassCard>
        );

      case 'communication':
        return (
          <GlassCard>
            <h3 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '24px' }}>Communication Log</h3>
            {clientMessages.length === 0 ? (
              <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>No communication history found.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {clientMessages.map(msg => (
                  <div key={msg.id} style={{ padding: '16px', borderLeft: '2px solid var(--kongila-blue)', background: 'var(--bg-tertiary)', borderRadius: '0 8px 8px 0' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <strong style={{ fontSize: '13px' }}>{msg.senderName}</strong>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{formatDate(msg.createdAt)}</span>
                    </div>
                    <p style={{ fontSize: '13px', color: 'var(--text-primary)', margin: 0, whiteSpace: 'pre-wrap' }}>
                      {msg.text}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </GlassCard>
        );
    }
  };

  return (
    <div className="app-shell" style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-primary)' }}>
      <div style={{ flex: 1, padding: '40px', overflowY: 'auto' }}>
        <Head>
          <title>{client.name} - Kongila Admin</title>
        </Head>

        <button onClick={() => router.push('/?tab=client-pipeline')} className="btn-secondary" style={{ marginBottom: '20px', fontSize: '13px', padding: '6px 14px', borderRadius: '8px' }}>← Back to Clients</button>
        
        <div className="page-header" style={{ marginBottom: '32px' }}>
          <div>
            <h1 className="page-title">{client.name}</h1>
            <p className="page-subtitle">Client CRM Record</p>
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <span style={{ 
              background: isAtRisk ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)', 
              color: isAtRisk ? '#EF4444' : '#10B981', 
              padding: '6px 12px', 
              borderRadius: '999px', 
              fontSize: '13px', 
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center'
            }}>
              {isAtRisk ? 'Account At Risk' : 'Healthy Account'}
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '2px', background: 'var(--bg-tertiary)', padding: '6px', borderRadius: '12px', marginBottom: '24px', width: 'fit-content' }}>
          {[
            { id: 'overview', label: 'Overview' },
            { id: 'requests', label: 'Requests' },
            { id: 'active-talent', label: 'Active Talent' },
            { id: 'contracts', label: 'Contracts' },
            { id: 'billing', label: 'Billing' },
            { id: 'communication', label: 'Communication Log' },
          ].map(t => (
            <button 
              key={t.id}
              onClick={() => setActiveTab(t.id as Tab)}
              style={{
                padding: '8px 16px',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: 600,
                background: activeTab === t.id ? 'var(--kongila-blue)' : 'transparent',
                color: activeTab === t.id ? '#FFF' : 'var(--text-secondary)',
                border: 'none',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {renderTabContent()}
      </div>

      {showReassignModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'var(--bg-primary)', width: '480px', borderRadius: '16px', border: '1px solid var(--border-glass)', boxShadow: '0 24px 48px rgba(0,0,0,0.4)', padding: '32px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '8px' }}>{hasAccountManager ? 'Reassign Account Manager' : 'Assign Account Manager'}</h2>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '24px' }}>
              Select an Account Manager for {client.name}. A reason is required and will be recorded in the audit log.
            </p>
            
            <form onSubmit={handleReassignAM}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>Account Manager</label>
                <select 
                  className="kongila-input" 
                  value={reassignForm.newAmId}
                  onChange={e => setReassignForm({ ...reassignForm, newAmId: e.target.value })}
                  style={{ width: '100%', padding: '12px', borderRadius: '8px' }}
                  required
                >
                  <option value="">-- Select Account Manager --</option>
                  {adminUsers.map(u => (
                    <option key={u.id} value={u.id}>{formatAssignableUserLabel(u)}</option>
                  ))}
                </select>
              </div>
              
              <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>{hasAccountManager ? 'Reason for Reassignment' : 'Reason for Assignment'}</label>
                <textarea 
                  className="kongila-input" 
                  rows={4}
                  value={reassignForm.reason}
                  onChange={e => setReassignForm({ ...reassignForm, reason: e.target.value })}
                  placeholder="e.g., Workload rebalancing, AM departure, Client request..."
                  style={{ width: '100%', padding: '12px', borderRadius: '8px', resize: 'vertical' }}
                  required
                />
              </div>
              
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setShowReassignModal(false)} className="btn-secondary" style={{ padding: '10px 20px', borderRadius: '8px', fontSize: '14px' }}>Cancel</button>
                <button type="submit" disabled={isSubmitting} className="btn-primary" style={{ padding: '10px 20px', borderRadius: '8px', fontSize: '14px' }}>
                  {isSubmitting ? 'Saving...' : hasAccountManager ? 'Confirm Reassignment' : 'Assign Account Manager'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
