import React, { useState, useMemo } from 'react';
import { GlassCard as Card, NeonButton as Button, Badge } from '@kongila/ui';
import { formatCurrency, formatDate } from '@kongila/utils';
import { Invoice, TalentPayout, FeeConfig, FeeAuditLog, TalentProfile, Contract } from '@kongila/shared-types';

interface FinanceManagerProps {
  invoices: Invoice[];
  talentPayouts: TalentPayout[];
  feeConfigs: FeeConfig[];
  feeAuditLogs: FeeAuditLog[];
  talents: TalentProfile[];
  contracts: Contract[];
  documents: any[];
  syncFromDb: () => Promise<void>;
  saveToDb: (data: any) => Promise<void>;
}

export default function FinanceManager({
  invoices,
  talentPayouts,
  feeConfigs: initialFeeConfigs,
  feeAuditLogs: initialAuditLogs,
  talents,
  contracts,
  documents,
  syncFromDb,
  saveToDb
}: FinanceManagerProps) {
  const [activeTab, setActiveTab] = useState<'revenue' | 'invoices' | 'payouts' | 'fees'>('revenue');
  const [invoiceFilter, setInvoiceFilter] = useState<'all' | 'draft' | 'sent' | 'paid' | 'overdue' | 'void'>('all');
  const [payoutFilter, setPayoutFilter] = useState<'all' | 'pending' | 'approved' | 'processing' | 'paid' | 'failed'>('all');
  
  const [localInvoices, setLocalInvoices] = useState<Invoice[]>(invoices);
  const [localPayouts, setLocalPayouts] = useState<TalentPayout[]>(talentPayouts);
  const [localFeeConfigs, setLocalFeeConfigs] = useState<FeeConfig[]>(initialFeeConfigs);
  const [localAuditLogs, setLocalAuditLogs] = useState<FeeAuditLog[]>(initialAuditLogs);
  const [generatingDrafts, setGeneratingDrafts] = useState(false);
  
  // Selection states
  const [selectedInvoices, setSelectedInvoices] = useState<Set<string>>(new Set());
  const [selectedPayouts, setSelectedPayouts] = useState<Set<string>>(new Set());

  // Editing fees
  const [editingConfigId, setEditingConfigId] = useState<string | null>(null);
  const [editClientPct, setEditClientPct] = useState<number>(0);
  const [editTalentPct, setEditTalentPct] = useState<number>(0);

  // Sync props down to local state
  React.useEffect(() => {
    if (invoices.length > 0) setLocalInvoices(invoices);
    if (talentPayouts.length > 0) setLocalPayouts(talentPayouts);
    if (initialFeeConfigs?.length > 0) setLocalFeeConfigs(initialFeeConfigs);
    if (initialAuditLogs?.length > 0) setLocalAuditLogs(initialAuditLogs);
  }, [invoices, talentPayouts, initialFeeConfigs, initialAuditLogs]);

  // Derived Metrics
  const mrr = useMemo(() => contracts.reduce((sum, c) => sum + (c.status === 'client_signed' || c.status === 'active' ? Number(c.salary || 0) : 0), 0), [contracts]);
  const totalInvoiced = useMemo(() => localInvoices.filter(i => i.status !== 'void' && i.status !== 'draft').reduce((sum, i) => sum + i.amount, 0), [localInvoices]);
  const totalPaidOut = useMemo(() => localPayouts.filter(p => p.status === 'paid').reduce((sum, p) => sum + p.amount, 0), [localPayouts]);

  // Invoice Handlers
  const toggleInvoiceSelection = (id: string) => {
    const next = new Set(selectedInvoices);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedInvoices(next);
  };

  const handleGenerateDrafts = async () => {
    setGeneratingDrafts(true);
    try {
      const res = await fetch('/api/finance/generate-drafts', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        alert(data.message);
        setLocalInvoices([...data.generatedDrafts, ...localInvoices]);
        await saveToDb({ invoices: [...data.generatedDrafts, ...localInvoices] });
      }
    } catch (e) {
      console.error(e);
      alert('Failed to generate drafts.');
    } finally {
      setGeneratingDrafts(false);
    }
  };

  const handleBulkSendInvoices = async () => {
    if (selectedInvoices.size === 0) return;
    const updated = localInvoices.map(inv => selectedInvoices.has(inv.id) && inv.status === 'draft' ? { ...inv, status: 'sent' as const } : inv);
    setLocalInvoices(updated);
    setSelectedInvoices(new Set());
    await saveToDb({ invoices: updated });
    alert(`Sent ${selectedInvoices.size} invoices.`);
  };

  const handleUpdateInvoiceStatus = async (id: string, newStatus: 'paid' | 'void' | 'sent') => {
    const updated = localInvoices.map(inv => inv.id === id ? { ...inv, status: newStatus } : inv);
    setLocalInvoices(updated);
    await saveToDb({ invoices: updated });
  };

  // Payout Handlers
  const togglePayoutSelection = (id: string) => {
    const next = new Set(selectedPayouts);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedPayouts(next);
  };

  const checkComplianceHolds = (talentId: string) => {
    return documents.some(d => d.isMandatory && !d.isHidden && !d.userId && (!d.signedByTalentIds || !d.signedByTalentIds.includes(talentId)));
  };

  const checkInvoicePaid = (invoiceId?: string) => {
    if (!invoiceId) return false;
    const inv = localInvoices.find(i => i.id === invoiceId);
    return inv?.status === 'paid';
  };

  const handleApprovePayouts = async (ids: string[]) => {
    const toApprove: string[] = [];
    const errors: string[] = [];

    for (const id of ids) {
      const payout = localPayouts.find(p => p.id === id);
      if (!payout) continue;
      
      const hasComplianceHold = checkComplianceHolds(payout.talentId);
      const isInvoicePaid = checkInvoicePaid(payout.invoiceId);
      
      if (hasComplianceHold) {
        errors.push(`Payout ${id} blocked: Talent has unresolved compliance holds.`);
      } else if (!isInvoicePaid) {
        errors.push(`Payout ${id} blocked: Corresponding client invoice is not marked paid.`);
      } else {
        toApprove.push(id);
      }
    }

    if (errors.length > 0) {
      alert("Some payouts could not be approved:\n" + errors.join('\n'));
    }

    if (toApprove.length > 0) {
      // Simulate 1 failure (US-KA-602)
      let failureTriggered = false;
      const updated = localPayouts.map(p => {
        if (toApprove.includes(p.id)) {
          if (!failureTriggered && Math.random() > 0.8) {
            failureTriggered = true;
            return { ...p, status: 'failed' as const, failureReason: 'Invalid bank details routing number' };
          }
          return { ...p, status: 'approved' as const };
        }
        return p;
      });
      setLocalPayouts(updated);
      setSelectedPayouts(new Set());
      await saveToDb({ talentPayouts: updated });
      alert(`Approved ${toApprove.length} payouts. Check queue for simulated failures.`);
    }
  };

  // Fee Config Handlers
  const handleSaveFeeConfig = async () => {
    if (!editingConfigId) return;
    const currentConfig = localFeeConfigs.find(c => c.id === editingConfigId);
    if (!currentConfig) return;

    const newLog: FeeAuditLog = {
      id: `faud_${Date.now()}`,
      configId: currentConfig.id,
      changedBy: 'Super Admin',
      previousClientFeePct: currentConfig.clientFeePct,
      newClientFeePct: editClientPct,
      previousTalentCommissionPct: currentConfig.talentCommissionPct,
      newTalentCommissionPct: editTalentPct,
      changedAt: new Date().toISOString()
    };

    const updatedConfigs = localFeeConfigs.map(c => c.id === editingConfigId ? {
      ...c,
      clientFeePct: editClientPct,
      talentCommissionPct: editTalentPct,
      updatedAt: new Date().toISOString()
    } : c);

    setLocalFeeConfigs(updatedConfigs);
    setLocalAuditLogs([newLog, ...localAuditLogs]);
    setEditingConfigId(null);
    await saveToDb({ feeConfigs: updatedConfigs, feeAuditLogs: [newLog, ...localAuditLogs] });
  };

  const getStatusColor = (status: string) => {
    switch(status.toLowerCase()) {
      case 'paid': return 'success';
      case 'sent': case 'approved': case 'processing': return 'info';
      case 'overdue': case 'failed': return 'error';
      default: return 'warning';
    }
  };

  const filteredInvoices = localInvoices.filter(i => invoiceFilter === 'all' ? true : i.status === invoiceFilter);
  const filteredPayouts = localPayouts.filter(p => payoutFilter === 'all' ? true : p.status === payoutFilter);

  // Overdue Escalation Logic
  const overdueInvoices = localInvoices.filter(i => i.status === 'overdue');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: '24px', fontWeight: 700, color: '#0F172A', margin: '0 0 4px 0' }}>Financial System</h2>
          <p style={{ fontSize: '14px', color: '#64748B', margin: 0 }}>Manage invoices, payouts, and revenue metrics.</p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '24px', borderBottom: '1px solid #E2E8F0' }}>
        {(['revenue', 'invoices', 'payouts', 'fees'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: '12px 0', background: 'transparent', border: 'none', borderBottom: activeTab === tab ? '2px solid #2563EB' : '2px solid transparent',
              color: activeTab === tab ? '#2563EB' : '#64748B', fontWeight: activeTab === tab ? 600 : 500, fontSize: '14px', cursor: 'pointer', textTransform: 'capitalize'
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === 'revenue' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px' }}>
          <Card style={{ padding: '24px', background: '#FFF' }}>
            <h3 style={{ fontSize: '14px', color: '#64748B', margin: '0 0 8px 0' }}>Monthly Recurring Revenue (MRR)</h3>
            <div style={{ fontSize: '32px', fontWeight: 700, color: '#0F172A' }}>${mrr.toLocaleString()}</div>
          </Card>
          <Card style={{ padding: '24px', background: '#FFF' }}>
            <h3 style={{ fontSize: '14px', color: '#64748B', margin: '0 0 8px 0' }}>Total Invoiced</h3>
            <div style={{ fontSize: '32px', fontWeight: 700, color: '#0F172A' }}>${totalInvoiced.toLocaleString()}</div>
          </Card>
          <Card style={{ padding: '24px', background: '#FFF' }}>
            <h3 style={{ fontSize: '14px', color: '#64748B', margin: '0 0 8px 0' }}>Total Paid Out</h3>
            <div style={{ fontSize: '32px', fontWeight: 700, color: '#0F172A' }}>${totalPaidOut.toLocaleString()}</div>
          </Card>
        </div>
      )}

      {activeTab === 'invoices' && (
        <Card style={{ padding: '24px', background: '#FFF' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '24px' }}>
            <div style={{ display: 'flex', gap: '12px' }}>
              {(['all', 'draft', 'sent', 'paid', 'overdue'] as const).map(f => (
                <button key={f} onClick={() => setInvoiceFilter(f)} style={{ padding: '6px 12px', borderRadius: '20px', border: invoiceFilter === f ? 'none' : '1px solid #E2E8F0', background: invoiceFilter === f ? '#0F172A' : '#FFF', color: invoiceFilter === f ? '#FFF' : '#64748B', fontSize: '13px', cursor: 'pointer', textTransform: 'capitalize' }}>
                  {f}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '12px' }}>
              <Button onClick={handleGenerateDrafts} disabled={generatingDrafts} style={{ background: '#FFF', color: '#0F172A', border: '1px solid #E2E8F0' }}>
                {generatingDrafts ? 'Generating...' : 'Auto-Generate Drafts'}
              </Button>
              {selectedInvoices.size > 0 && invoiceFilter === 'draft' && (
                <Button onClick={handleBulkSendInvoices} style={{ background: '#2563EB', color: '#FFF' }}>Bulk Send ({selectedInvoices.size})</Button>
              )}
            </div>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #E2E8F0', color: '#64748B', fontSize: '13px' }}>
                <th style={{ padding: '12px 8px' }}>
                  <input type="checkbox" onChange={(e) => setSelectedInvoices(e.target.checked ? new Set(filteredInvoices.map(i => i.id)) : new Set())} checked={selectedInvoices.size > 0 && selectedInvoices.size === filteredInvoices.length} />
                </th>
                <th style={{ padding: '12px 8px' }}>Invoice ID</th>
                <th style={{ padding: '12px 8px' }}>Client</th>
                <th style={{ padding: '12px 8px' }}>Amount</th>
                <th style={{ padding: '12px 8px' }}>Due Date</th>
                <th style={{ padding: '12px 8px' }}>Status</th>
                <th style={{ padding: '12px 8px' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredInvoices.map(inv => (
                <tr key={inv.id} style={{ borderBottom: '1px solid #F1F5F9', fontSize: '14px' }}>
                  <td style={{ padding: '12px 8px' }}>
                    <input type="checkbox" checked={selectedInvoices.has(inv.id)} onChange={() => toggleInvoiceSelection(inv.id)} />
                  </td>
                  <td style={{ padding: '12px 8px', fontWeight: 500 }}>{inv.id.substring(0, 12)}</td>
                  <td style={{ padding: '12px 8px' }}>{(inv as any).clientName || 'Unknown'}</td>
                  <td style={{ padding: '12px 8px' }}>{formatCurrency(inv.amount)}</td>
                  <td style={{ padding: '12px 8px' }}>{formatDate(inv.dueDate)}</td>
                  <td style={{ padding: '12px 8px' }}>
                    <Badge status={getStatusColor(inv.status) as any} text={inv.status} />
                  </td>
                  <td style={{ padding: '12px 8px' }}>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      {inv.status === 'draft' && <button onClick={() => handleUpdateInvoiceStatus(inv.id, 'sent')} style={{ background: 'none', border: 'none', color: '#2563EB', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}>Send</button>}
                      {inv.status === 'sent' && <button onClick={() => handleUpdateInvoiceStatus(inv.id, 'paid')} style={{ background: 'none', border: 'none', color: '#10B981', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}>Mark Paid</button>}
                    </div>
                  </td>
                </tr>
              ))}
              {filteredInvoices.length === 0 && (
                <tr><td colSpan={7} style={{ padding: '24px', textAlign: 'center', color: '#94A3B8' }}>No invoices found.</td></tr>
              )}
            </tbody>
          </table>

          {/* Escalation Tracker section */}
          {overdueInvoices.length > 0 && (
            <div style={{ marginTop: '40px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#DC2626', marginBottom: '16px' }}>Overdue Escalation Tracker</h3>
              <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '8px', padding: '16px' }}>
                {overdueInvoices.map(inv => {
                  const daysOverdue = Math.floor((new Date().getTime() - new Date(inv.dueDate).getTime()) / (1000 * 3600 * 24));
                  let stage = 'Day 3 Reminder';
                  if (daysOverdue >= 30) stage = 'Suspension Warning';
                  else if (daysOverdue >= 21) stage = 'Formal Notice';
                  else if (daysOverdue >= 14) stage = 'Account Manager Alert';
                  else if (daysOverdue >= 7) stage = 'WhatsApp Reminder';

                  return (
                    <div key={inv.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid #FECACA' }}>
                      <div>
                        <strong style={{ color: '#0F172A' }}>{inv.id}</strong> — {(inv as any).clientName || 'Client'}
                        <div style={{ fontSize: '13px', color: '#DC2626', marginTop: '4px' }}>{daysOverdue} days overdue | Current Stage: {stage}</div>
                      </div>
                      <Button style={{ background: '#FFF', color: '#DC2626', border: '1px solid #DC2626', padding: '6px 12px' }}>Trigger Next</Button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </Card>
      )}

      {activeTab === 'payouts' && (
        <Card style={{ padding: '24px', background: '#FFF' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '24px' }}>
            <div style={{ display: 'flex', gap: '12px' }}>
              {(['all', 'pending', 'approved', 'paid', 'failed'] as const).map(f => (
                <button key={f} onClick={() => setPayoutFilter(f)} style={{ padding: '6px 12px', borderRadius: '20px', border: payoutFilter === f ? 'none' : '1px solid #E2E8F0', background: payoutFilter === f ? '#0F172A' : '#FFF', color: payoutFilter === f ? '#FFF' : '#64748B', fontSize: '13px', cursor: 'pointer', textTransform: 'capitalize' }}>
                  {f}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '12px' }}>
              {selectedPayouts.size > 0 && payoutFilter === 'pending' && (
                <Button onClick={() => handleApprovePayouts(Array.from(selectedPayouts))} style={{ background: '#10B981', color: '#FFF' }}>Approve ({selectedPayouts.size})</Button>
              )}
            </div>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #E2E8F0', color: '#64748B', fontSize: '13px' }}>
                <th style={{ padding: '12px 8px' }}>
                  <input type="checkbox" onChange={(e) => setSelectedPayouts(e.target.checked ? new Set(filteredPayouts.map(p => p.id)) : new Set())} checked={selectedPayouts.size > 0 && selectedPayouts.size === filteredPayouts.length} />
                </th>
                <th style={{ padding: '12px 8px' }}>Talent ID</th>
                <th style={{ padding: '12px 8px' }}>Gross</th>
                <th style={{ padding: '12px 8px' }}>Net</th>
                <th style={{ padding: '12px 8px' }}>Status</th>
                <th style={{ padding: '12px 8px' }}>Warnings</th>
                <th style={{ padding: '12px 8px' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredPayouts.map(pay => {
                const hasHold = checkComplianceHolds(pay.talentId);
                const invPaid = checkInvoicePaid(pay.invoiceId);
                return (
                  <tr key={pay.id} style={{ borderBottom: '1px solid #F1F5F9', fontSize: '14px', background: pay.status === 'failed' ? '#FEF2F2' : 'transparent' }}>
                    <td style={{ padding: '12px 8px' }}>
                      <input type="checkbox" checked={selectedPayouts.has(pay.id)} onChange={() => togglePayoutSelection(pay.id)} />
                    </td>
                    <td style={{ padding: '12px 8px', fontWeight: 500 }}>{pay.talentId.substring(0, 8)}</td>
                    <td style={{ padding: '12px 8px' }}>{formatCurrency(pay.grossAmount || pay.amount)}</td>
                    <td style={{ padding: '12px 8px', fontWeight: 600 }}>{formatCurrency(pay.netAmount || pay.amount)}</td>
                    <td style={{ padding: '12px 8px' }}>
                      <Badge status={getStatusColor(pay.status) as any} text={pay.status} />
                      {pay.status === 'failed' && <div style={{ color: '#DC2626', fontSize: '12px', marginTop: '4px' }}>{pay.failureReason}</div>}
                    </td>
                    <td style={{ padding: '12px 8px' }}>
                      {hasHold && <span style={{ color: '#DC2626', fontSize: '12px', display: 'block' }}>Compliance Hold</span>}
                      {!invPaid && <span style={{ color: '#F59E0B', fontSize: '12px', display: 'block' }}>Client Invoice Unpaid</span>}
                    </td>
                    <td style={{ padding: '12px 8px' }}>
                      {pay.status === 'pending' && <button onClick={() => handleApprovePayouts([pay.id])} style={{ background: 'none', border: 'none', color: '#10B981', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}>Approve</button>}
                    </td>
                  </tr>
                );
              })}
              {filteredPayouts.length === 0 && (
                <tr><td colSpan={7} style={{ padding: '24px', textAlign: 'center', color: '#94A3B8' }}>No payouts found.</td></tr>
              )}
            </tbody>
          </table>
        </Card>
      )}

      {activeTab === 'fees' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <Card style={{ padding: '24px', background: '#FFF' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 700, margin: '0 0 16px 0', color: '#0F172A' }}>Fee Configurations</h3>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #E2E8F0', color: '#64748B', fontSize: '13px' }}>
                  <th style={{ padding: '12px 8px' }}>Contract Type</th>
                  <th style={{ padding: '12px 8px' }}>Client Fee %</th>
                  <th style={{ padding: '12px 8px' }}>Talent Commission %</th>
                  <th style={{ padding: '12px 8px' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {localFeeConfigs.map(c => (
                  <tr key={c.id} style={{ borderBottom: '1px solid #F1F5F9', fontSize: '14px' }}>
                    <td style={{ padding: '12px 8px', fontWeight: 500 }}>{c.contractType}</td>
                    <td style={{ padding: '12px 8px' }}>
                      {editingConfigId === c.id ? (
                        <input type="number" value={editClientPct} onChange={e => setEditClientPct(Number(e.target.value))} style={{ width: '60px', padding: '4px' }} />
                      ) : `${c.clientFeePct}%`}
                    </td>
                    <td style={{ padding: '12px 8px' }}>
                      {editingConfigId === c.id ? (
                        <input type="number" value={editTalentPct} onChange={e => setEditTalentPct(Number(e.target.value))} style={{ width: '60px', padding: '4px' }} />
                      ) : `${c.talentCommissionPct}%`}
                    </td>
                    <td style={{ padding: '12px 8px' }}>
                      {editingConfigId === c.id ? (
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button onClick={handleSaveFeeConfig} style={{ color: '#10B981', border: 'none', background: 'none', cursor: 'pointer', fontWeight: 600 }}>Save</button>
                          <button onClick={() => setEditingConfigId(null)} style={{ color: '#64748B', border: 'none', background: 'none', cursor: 'pointer' }}>Cancel</button>
                        </div>
                      ) : (
                        <button onClick={() => { setEditingConfigId(c.id); setEditClientPct(c.clientFeePct); setEditTalentPct(c.talentCommissionPct); }} style={{ color: '#2563EB', border: 'none', background: 'none', cursor: 'pointer', fontWeight: 600 }}>Edit</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          <Card style={{ padding: '24px', background: '#F8FAFC' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 700, margin: '0 0 16px 0', color: '#0F172A' }}>Fee Audit Logs</h3>
            {localAuditLogs.map(log => (
              <div key={log.id} style={{ padding: '12px', background: '#FFF', borderRadius: '8px', marginBottom: '8px', border: '1px solid #E2E8F0', fontSize: '13px' }}>
                <span style={{ color: '#64748B' }}>{formatDate(log.changedAt)}</span> - 
                <strong style={{ margin: '0 8px' }}>{log.changedBy || 'System'}</strong> 
                changed client fee from {log.previousClientFeePct}% to {log.newClientFeePct}% and talent commission from {log.previousTalentCommissionPct}% to {log.newTalentCommissionPct}%.
              </div>
            ))}
          </Card>
        </div>
      )}
    </div>
  );
}
