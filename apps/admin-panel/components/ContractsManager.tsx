import React, { useState } from 'react';
import { GlassCard, Chip } from '@kongila/ui';
import { formatCurrency, formatDate } from '@kongila/utils';

export default function ContractsManager({
  contracts,
  contractTemplates,
  talents,
  organizations,
  requests,
  saveToDb,
  auditLogs,
  setContracts,
  setContractTemplates,
  setAuditLogs
}: any) {
  const [activeTab, setActiveTab] = useState<'queue' | 'templates'>('queue');

  // Queue State
  const [contractFilter, setContractFilter] = useState('All');
  const [selectedContract, setSelectedContract] = useState<any | null>(null);
  const [showContractModal, setShowContractModal] = useState(false);
  const [contractForm, setContractForm] = useState({ clientId: '', clientName: '', talentId: '', talentName: '', role: '', rateType: 'Monthly', rateAmount: '', startDate: '', endDate: '', engagementModel: 'Remote / Full-time Retainer', status: 'Draft', currency: 'USD', templateId: '' });
  const [saving, setSaving] = useState(false);
  
  // Void modal
  const [showVoidModal, setShowVoidModal] = useState(false);
  const [voidReason, setVoidReason] = useState('');

  // Templates State
  const [selectedTemplate, setSelectedTemplate] = useState<any | null>(null);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [templateForm, setTemplateForm] = useState({ id: '', name: '', type: 'Contractor Agreement', body: '', version: 1, status: 'draft' });

  // ─── QUEUE LOGIC ──────────────────────────────────────────────────────────

  // Stalled signature check
  const getDaysPending = (c: any) => {
    if (c.status !== 'pending_signatures') return 0;
    const dateToCompare = c.createdAt || c.startDate; 
    if (!dateToCompare) return 0;
    const diff = new Date().getTime() - new Date(dateToCompare).getTime();
    return Math.floor(diff / (1000 * 3600 * 24));
  };

  const filteredContracts = contracts.filter((c: any) => contractFilter === 'All' ? true : c.status?.toLowerCase().replace('_', ' ') === contractFilter.toLowerCase());

  const handleUpdateContractStatus = async (contractId: string, newStatus: string) => {
    if (saving) return;
    setSaving(true);
    const updated = contracts.map((c: any) => c.id === contractId ? { ...c, status: newStatus } : c);
    
    const newLog = {
      id: `audit_${Date.now()}`, actor: 'Admin', action: 'Update Contract Status',
      details: `Updated contract ${contractId} to ${newStatus}`, timestamp: new Date().toISOString()
    };

    setContracts(updated);
    setAuditLogs([newLog, ...auditLogs]);
    if (selectedContract && selectedContract.id === contractId) setSelectedContract({ ...selectedContract, status: newStatus });

    await saveToDb({ contracts: updated, auditLogs: [newLog, ...auditLogs] });
    setSaving(false);
  };

  const handleVoidContract = async () => {
    if (!voidReason || saving) return;
    setSaving(true);
    
    const updated = contracts.map((c: any) => c.id === selectedContract.id ? { ...c, status: 'Voided', voidReason } : c);
    
    // Find linked service request and revert to Candidates Ready
    let updatedRequests = requests;
    if (selectedContract.matchId) {
      // Find match to get requestId
      const targetMatch = (await fetch('/api/db').then(r => r.json())).matches?.find((m: any) => m.id === selectedContract.matchId);
      if (targetMatch && targetMatch.requestId) {
        updatedRequests = requests.map((r: any) => r.id === targetMatch.requestId ? { ...r, status: 'Candidates Ready' } : r);
      }
    }

    const newLog = {
      id: `audit_${Date.now()}`, actor: 'Admin', action: 'Void Contract',
      details: `Voided contract ${selectedContract.id}. Reason: ${voidReason}`, timestamp: new Date().toISOString()
    };

    setContracts(updated);
    setAuditLogs([newLog, ...auditLogs]);
    setSelectedContract({ ...selectedContract, status: 'Voided', voidReason });
    setShowVoidModal(false);

    await saveToDb({ contracts: updated, clientRequests: updatedRequests, auditLogs: [newLog, ...auditLogs] });
    setSaving(false);
    setVoidReason('');
  };

  const handleCreateContract = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const newContract = {
      ...contractForm,
      id: `contract_${Date.now()}`,
      createdAt: new Date().toISOString(),
      matchId: '' // normally mapped
    };
    const updated = [newContract, ...contracts];
    setContracts(updated);
    setShowContractModal(false);
    await saveToDb({ contracts: updated });
    setSaving(false);
  };

  const handleSendReminder = async (contractId: string) => {
    alert("Reminder sent to parties via Email & In-App Notification.");
    // In real app, this updates reminderCount and lastReminderSentAt
    const updated = contracts.map((c: any) => c.id === contractId ? { ...c, reminderCount: (c.reminderCount || 0) + 1, lastReminderSentAt: new Date().toISOString() } : c);
    setContracts(updated);
    await saveToDb({ contracts: updated });
  };

  // ─── TEMPLATES LOGIC ────────────────────────────────────────────────────────

  const validateMergeFields = (body: string) => {
    const requiredVars = ['{{talent_name}}', '{{client_company}}'];
    const missing = requiredVars.filter(v => !body.includes(v));
    if (missing.length > 0) return `Missing required merge variables: ${missing.join(', ')}`;
    return null;
  };

  const handleSaveTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (templateForm.status === 'published') {
      const err = validateMergeFields(templateForm.body);
      if (err) { alert(err); return; }
    }

    setSaving(true);
    const isNew = !templateForm.id;
    let newTemplate: any;
    let updated: any;

    if (isNew) {
      newTemplate = { ...templateForm, id: `tpl_${Date.now()}`, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), version: 1 };
      updated = [newTemplate, ...contractTemplates];
    } else {
      // If publishing an existing draft, bump version if needed
      const old = contractTemplates.find((t: any) => t.id === templateForm.id);
      const isPublishingNewVersion = old.status === 'published' && templateForm.body !== old.body;
      
      newTemplate = { 
        ...templateForm, 
        updatedAt: new Date().toISOString(),
        version: isPublishingNewVersion ? old.version + 1 : old.version 
      };
      updated = contractTemplates.map((t: any) => t.id === templateForm.id ? newTemplate : t);
    }

    const newLog = {
      id: `audit_${Date.now()}`, actor: 'Admin', action: isNew ? 'Create Template' : 'Update Template',
      details: `${newTemplate.name} (v${newTemplate.version}) saved as ${newTemplate.status}`, timestamp: new Date().toISOString()
    };

    setContractTemplates(updated);
    setAuditLogs([newLog, ...auditLogs]);
    setShowTemplateModal(false);
    await saveToDb({ contractTemplates: updated, auditLogs: [newLog, ...auditLogs] });
    setSaving(false);
  };


  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Contracts & Offers</h1>
          <p className="page-subtitle">Manage dynamic templates, e-signatures, and the contract lifecycle.</p>
        </div>
        <div style={{ display: 'flex', gap: '12px', background: 'var(--bg-elevated)', padding: '4px', borderRadius: '12px' }}>
          <button 
            onClick={() => setActiveTab('queue')}
            style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', background: activeTab === 'queue' ? 'var(--kongila-blue)' : 'transparent', color: activeTab === 'queue' ? 'white' : 'var(--text-secondary)', fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}
          >
            Active Contracts Queue
          </button>
          <button 
            onClick={() => setActiveTab('templates')}
            style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', background: activeTab === 'templates' ? 'var(--kongila-blue)' : 'transparent', color: activeTab === 'templates' ? 'white' : 'var(--text-secondary)', fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}
          >
            Templates Manager
          </button>
        </div>
      </div>

      {activeTab === 'queue' && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {['All', 'Draft', 'Pending Signatures', 'Signed', 'Active', 'Terminated', 'Voided'].map(f => (
                <button key={f} onClick={() => setContractFilter(f)} style={{ padding: '6px 14px', borderRadius: '999px', border: `1px solid ${contractFilter === f ? 'var(--kongila-blue)' : 'var(--border-glass)'}`, background: contractFilter === f ? 'var(--kongila-blue-glow)' : 'var(--bg-secondary)', color: contractFilter === f ? 'var(--kongila-blue)' : 'var(--text-secondary)', fontWeight: contractFilter === f ? 600 : 400, fontSize: '12px', cursor: 'pointer' }}>{f}</button>
              ))}
            </div>
            <button onClick={() => setShowContractModal(true)} className="btn-primary" style={{ fontSize: '13px', height: '36px', padding: '0 16px', borderRadius: '8px' }}>+ Draft Contract</button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: selectedContract ? '1fr 1.4fr' : '1fr', gap: '24px' }}>
            <div className="table-container">
              <table className="custom-table">
                <thead><tr>{['Contract ID', 'Talent', 'Client', 'Status', 'Days Pending'].map(h => <th key={h}>{h}</th>)}</tr></thead>
                <tbody>
                  {filteredContracts.length === 0 ? (
                    <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '40px' }}>No contracts found.</td></tr>
                  ) : filteredContracts.map((c: any) => {
                    const daysPending = getDaysPending(c);
                    const isStalled = daysPending >= 14;
                    
                    return (
                      <tr key={c.id} onClick={() => setSelectedContract(selectedContract?.id === c.id ? null : c)} style={{ cursor: 'pointer', background: selectedContract?.id === c.id ? 'var(--kongila-blue-glow)' : undefined }}>
                        <td><span style={{ fontWeight: 700, fontSize: '12px', color: 'var(--kongila-blue)', fontFamily: 'monospace' }}>{c.id}</span></td>
                        <td style={{ fontWeight: 600, fontSize: '13px' }}>{c.talentName}</td>
                        <td style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{c.clientName}</td>
                        <td><Chip label={c.status} /></td>
                        <td>
                          {c.status === 'pending_signatures' ? (
                            <span style={{ color: isStalled ? '#EF4444' : 'var(--text-primary)', fontWeight: isStalled ? 700 : 400, background: isStalled ? 'rgba(239, 68, 68, 0.1)' : 'transparent', padding: '2px 6px', borderRadius: '4px' }}>
                              {daysPending} days {isStalled && ' ⚠️'}
                            </span>
                          ) : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {selectedContract && (
              <GlassCard>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
                  <div>
                    <h3 style={{ fontSize: '16px', fontWeight: 700 }}>{selectedContract.role}</h3>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'monospace', marginTop: '2px' }}>{selectedContract.id}</div>
                  </div>
                  <Chip label={selectedContract.status} />
                </div>

                {getDaysPending(selectedContract) >= 14 && (
                  <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid #EF4444', padding: '16px', borderRadius: '12px', marginBottom: '20px' }}>
                    <div style={{ color: '#EF4444', fontWeight: 700, fontSize: '13px', marginBottom: '4px' }}>⚠️ Stalled Signature Escalation</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>This contract has been awaiting signature for {getDaysPending(selectedContract)} days. Please contact the parties. If unresponsive, you may void the contract to free up the request.</div>
                    <div style={{ fontSize: '11px', marginTop: '8px', color: 'var(--text-muted)' }}>Reminders sent: {selectedContract.reminderCount || 0}</div>
                  </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '12px', marginBottom: '20px' }}>
                  {[
                    { label: 'Talent', val: selectedContract.talentName },
                    { label: 'Client', val: selectedContract.clientName },
                    { label: 'Rate', val: `${formatCurrency(selectedContract.rateAmount || selectedContract.salary || 0)} / ${selectedContract.rateType === 'Hourly' ? 'hr' : 'mo'}` },
                    { label: 'Template V.', val: selectedContract.templateVersion ? `v${selectedContract.templateVersion}` : '—' },
                  ].map(({ label, val }) => (
                    <div key={label} style={{ background: 'var(--bg-tertiary)', borderRadius: '8px', padding: '10px' }}>
                      <div style={{ color: 'var(--text-muted)', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '2px' }}>{label}</div>
                      <div style={{ fontWeight: 600 }}>{val}</div>
                    </div>
                  ))}
                </div>

                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {selectedContract.status === 'Draft' && <button onClick={() => handleUpdateContractStatus(selectedContract.id, 'pending_signatures')} className="btn-primary" style={{ fontSize: '12px', height: '34px', padding: '0 14px', borderRadius: '8px' }}>Send for Signatures</button>}
                  {selectedContract.status === 'pending_signatures' && <button onClick={() => handleSendReminder(selectedContract.id)} className="btn-secondary" style={{ fontSize: '12px', height: '34px', padding: '0 14px', borderRadius: '8px' }}>Resend Request</button>}
                  {selectedContract.status === 'pending_signatures' && <button onClick={() => setShowVoidModal(true)} className="btn-secondary" style={{ fontSize: '12px', height: '34px', padding: '0 14px', borderRadius: '8px', color: '#EF4444', borderColor: '#FCA5A5' }}>Void Contract</button>}
                  {(selectedContract.status === 'Draft' || selectedContract.status === 'Signed' || selectedContract.status === 'talent_signed') && <button onClick={() => handleUpdateContractStatus(selectedContract.id, 'Active')} className="btn-secondary" style={{ fontSize: '12px', height: '34px', padding: '0 14px', borderRadius: '8px', color: 'var(--accent-green)', borderColor: 'var(--accent-green)' }}>Activate Manually</button>}
                </div>
              </GlassCard>
            )}
          </div>
        </>
      )}

      {activeTab === 'templates' && (
        <>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '20px' }}>
             <button onClick={() => { setTemplateForm({ id: '', name: '', type: 'Contractor Agreement', body: '', version: 1, status: 'draft' }); setShowTemplateModal(true); }} className="btn-primary" style={{ fontSize: '13px', height: '36px', padding: '0 16px', borderRadius: '8px' }}>+ New Template</button>
          </div>

          <div className="table-container">
            <table className="custom-table">
              <thead><tr>{['Template Name', 'Type', 'Version', 'Status', 'Last Updated', 'Actions'].map(h => <th key={h}>{h}</th>)}</tr></thead>
              <tbody>
                {contractTemplates.length === 0 ? (
                  <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '40px' }}>No templates found.</td></tr>
                ) : contractTemplates.map((t: any) => (
                  <tr key={t.id}>
                    <td style={{ fontWeight: 600, fontSize: '13px' }}>{t.name}</td>
                    <td style={{ fontSize: '12px' }}>{t.type}</td>
                    <td style={{ fontSize: '12px', fontFamily: 'monospace' }}>v{t.version}</td>
                    <td><Chip label={t.status} /></td>
                    <td style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{formatDate(t.updatedAt)}</td>
                    <td>
                      <button onClick={() => { setTemplateForm(t); setShowTemplateModal(true); }} className="btn-secondary" style={{ padding: '4px 8px', fontSize: '11px', borderRadius: '6px' }}>Edit</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Void Modal */}
      {showVoidModal && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setShowVoidModal(false); }}>
          <div className="modal-content" style={{ padding: '32px', maxWidth: '400px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '8px', color: '#EF4444' }}>Void Contract</h2>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '16px' }}>Voiding a pending contract will automatically revert the linked Service Request back to 'Candidates Ready'. Please log a reason.</p>
            <textarea className="kongila-input" rows={3} placeholder="Reason for voiding..." value={voidReason} onChange={e => setVoidReason(e.target.value)} style={{ width: '100%', padding: '12px', borderRadius: '8px', marginBottom: '20px' }} />
            <div style={{ display: 'flex', gap: '12px' }}>
              <button onClick={handleVoidContract} disabled={!voidReason || saving} className="btn-primary" style={{ flex: 1, background: '#EF4444', borderColor: '#EF4444' }}>Confirm Void</button>
              <button onClick={() => setShowVoidModal(false)} className="btn-secondary" style={{ flex: 1 }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Template Modal */}
      {showTemplateModal && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setShowTemplateModal(false); }}>
          <div className="modal-content" style={{ padding: '32px', maxWidth: '800px', width: '90%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 700 }}>{templateForm.id ? `Edit Template v${templateForm.version}` : 'New Template'}</h2>
              <button onClick={() => setShowTemplateModal(false)} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: 'var(--text-secondary)' }}>✕</button>
            </div>
            <form onSubmit={handleSaveTemplate}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
                <div>
                  <label className="form-label">Template Name</label>
                  <input type="text" className="kongila-input" value={templateForm.name} onChange={e => setTemplateForm({ ...templateForm, name: e.target.value })} required style={{ width: '100%', padding: '10px', borderRadius: '8px' }} />
                </div>
                <div>
                  <label className="form-label">Template Type</label>
                  <select className="kongila-input" value={templateForm.type} onChange={e => setTemplateForm({ ...templateForm, type: e.target.value })} style={{ width: '100%', padding: '10px', borderRadius: '8px' }}>
                    <option>Contractor Agreement</option>
                    <option>Client Service Agreement</option>
                    <option>NDA</option>
                  </select>
                </div>
              </div>
              <div style={{ marginBottom: '20px' }}>
                <label className="form-label">Template Body (Use {'{{talent_name}}'}, {'{{client_company}}'}, {'{{monthly_rate}}'})</label>
                <textarea className="kongila-input" rows={15} value={templateForm.body} onChange={e => setTemplateForm({ ...templateForm, body: e.target.value })} required style={{ width: '100%', padding: '12px', borderRadius: '8px', fontFamily: 'monospace', fontSize: '13px' }} />
              </div>
              <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
                  <input type="checkbox" checked={templateForm.status === 'published'} onChange={e => setTemplateForm({ ...templateForm, status: e.target.checked ? 'published' : 'draft' })} />
                  Publish Template (Available for new contracts)
                </label>
                <div style={{ flex: 1 }} />
                <button type="submit" className="btn-primary" disabled={saving} style={{ padding: '8px 24px', borderRadius: '8px' }}>{saving ? 'Saving...' : 'Save Template'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Contract Modal (Simplified for demo) */}
      {showContractModal && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setShowContractModal(false); }}>
          <div className="modal-content" style={{ padding: '32px', maxWidth: '500px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '24px' }}>Draft Contract</h2>
            <form onSubmit={handleCreateContract}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <select className="kongila-input" style={{ width: '100%', padding: '10px', borderRadius: '8px' }} value={contractForm.templateId} onChange={e => setContractForm({...contractForm, templateId: e.target.value})} required>
                  <option value="">Select Template...</option>
                  {contractTemplates.filter((t: any) => t.status === 'published').map((t: any) => <option key={t.id} value={t.id}>{t.name} (v{t.version})</option>)}
                </select>
                <select className="kongila-input" style={{ width: '100%', padding: '10px', borderRadius: '8px' }} value={contractForm.talentId} onChange={e => setContractForm({...contractForm, talentId: e.target.value, talentName: talents.find((t:any) => t.id === e.target.value)?.name || ''})} required>
                  <option value="">Select Talent...</option>
                  {talents.map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
                <select className="kongila-input" style={{ width: '100%', padding: '10px', borderRadius: '8px' }} value={contractForm.clientId} onChange={e => setContractForm({...contractForm, clientId: e.target.value, clientName: organizations.find((o:any) => o.id === e.target.value)?.name || ''})} required>
                  <option value="">Select Client...</option>
                  {organizations.map((o: any) => <option key={o.id} value={o.id}>{o.name}</option>)}
                </select>
                <button type="submit" className="btn-primary" style={{ padding: '10px', borderRadius: '8px', marginTop: '16px' }}>Generate Draft</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
