import React, { useState, useMemo } from 'react';
import BillingTermsPanel from './BillingTermsPanel';
import { apiFetch } from '../lib/apiFetch';
import { GlassCard as Card, NeonButton as Button, Badge, promptInApp } from '@kongila/ui';
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
  /** For naming a client on its own billing terms. Optional: the panel
      still works without it, it just shows ids rather than names. */
  organizations?: any[];
  syncFromDb: () => Promise<void>;
}

export default function FinanceManager({
  invoices,
  talentPayouts,
  feeConfigs: initialFeeConfigs,
  feeAuditLogs: initialAuditLogs,
  talents,
  contracts,
  documents,
  organizations = [],
  syncFromDb,
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
  const [savingFee, setSavingFee] = useState(false);
  const [approvingPayouts, setApprovingPayouts] = useState(false);
  const [sendingInvoiceId, setSendingInvoiceId] = useState<string | null>(null);
  const [blockedPayouts, setBlockedPayouts] = useState<any[]>([]);
  const [financeError, setFinanceError] = useState<string | null>(null);
  const [lastRun, setLastRun] = useState<{ summary: string; skipped: any[] } | null>(null);
  const [billingPreview, setBillingPreview] = useState<any | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<any | null>(null);
  const [editInvoiceLines, setEditInvoiceLines] = useState<Array<{ description: string; quantity: string; unitAmount: string }>>([]);
  const [savingInvoiceDraft, setSavingInvoiceDraft] = useState(false);

  // The margins, from fee_config. They used to arrive in the db blob, which
  // had no branch for them in either direction, so the table rendered empty
  // and every edit was discarded on reload.
  const [serviceFees, setServiceFees] = useState<any[]>([]);
  const [feeLog, setFeeLog] = useState<any[]>([]);

  const loadFees = React.useCallback(async () => {
    try {
      const res = await apiFetch('/api/finance?view=fees');
      if (!res.ok) return;
      const body = await res.json();
      setServiceFees(body.fees || []);
      setFeeLog(body.auditLog || []);
    } catch {
      // Leave the table empty rather than showing invented percentages.
    }
  }, []);

  React.useEffect(() => { loadFees(); }, [loadFees]);

  const unsetLines = serviceFees.filter(
    f => f.clientFeePct === null || f.talentCommissionPct === null
  );

  const LINE_LABELS: Record<string, string> = {
    placement: 'Placement (Hire Talent)',
    outsourcing: 'Outsourcing (Outsource Talent)',
    managed_workforce: 'Managed Workforce',
    project: 'Project Execution'
  };

  const RECURRING_LINES = ['outsourcing', 'managed_workforce'];

  // Sync props down to local state
  React.useEffect(() => {
    if (invoices.length > 0) setLocalInvoices(invoices);
    if (talentPayouts.length > 0) setLocalPayouts(talentPayouts);
    if (initialFeeConfigs?.length > 0) setLocalFeeConfigs(initialFeeConfigs);
    if (initialAuditLogs?.length > 0) setLocalAuditLogs(initialAuditLogs);
  }, [invoices, talentPayouts, initialFeeConfigs, initialAuditLogs]);

  // Derived Metrics
  // MRR is what the client is billed, which is the rate plus the fee. It used
  // to sum the raw rate, so it reported Kongila's cost as its revenue. It
  // also counted every contract monthly, including placements and projects,
  // which are one-time and are not recurring revenue at all.
  const mrr = useMemo(() => {
    const feeByLine = new Map(serviceFees.map((f: any) => [f.serviceLine, f]));

    return contracts.reduce((sum, c: any) => {
      const live = ['active', 'client_signed', 'Active', 'Signed', 'fully_signed'].includes(c.status);
      if (!live) return sum;

      const line = String(c.serviceType || c.role || '')
        .trim().toLowerCase().replace(/[\s-]+/g, '_')
        .replace('outsource_talent', 'outsourcing')
        .replace('project_execution', 'project')
        .replace('hire_talent', 'placement');

      if (!RECURRING_LINES.includes(line)) return sum;

      const fee = feeByLine.get(line);
      if (!fee || fee.clientFeePct === null) return sum;

      return sum + Number(c.rateAmount || c.salary || 0) * (1 + Number(fee.clientFeePct));
    }, 0);
  }, [contracts, serviceFees]);

  // How much of the live book MRR cannot speak for, because its line has no
  // fee set. Showing a smaller number without saying so would be worse.
  const mrrUncounted = useMemo(() => {
    const feeByLine = new Map(serviceFees.map((f: any) => [f.serviceLine, f]));
    return contracts.filter((c: any) => {
      const live = ['active', 'client_signed', 'Active', 'Signed', 'fully_signed'].includes(c.status);
      if (!live) return false;
      const line = String(c.serviceType || c.role || '')
        .trim().toLowerCase().replace(/[\s-]+/g, '_')
        .replace('outsource_talent', 'outsourcing');
      if (!RECURRING_LINES.includes(line)) return false;
      const fee = feeByLine.get(line);
      return !fee || fee.clientFeePct === null;
    }).length;
  }, [contracts, serviceFees]);
  // Both screens sum the same field. The client billing tab summed
  // `totalUsd` and this summed `amount`, and until the finance migration
  // total_usd was not even a column, so the client showed $0 against a
  // real figure here.
  const invoiceTotal = (i: any) => Number(i.totalUsd ?? i.amount ?? 0);
  const totalInvoiced = useMemo(() => localInvoices.filter((i: any) => i.status !== 'void' && i.status !== 'draft').reduce((sum, i) => sum + invoiceTotal(i), 0), [localInvoices]);
  const totalPaidOut = useMemo(() => localPayouts.filter((p: any) => p.status === 'paid').reduce((sum, p: any) => sum + Number(p.netAmount ?? p.amount ?? 0), 0), [localPayouts]);

  // Invoice Handlers
  const toggleInvoiceSelection = (id: string) => {
    const next = new Set(selectedInvoices);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedInvoices(next);
  };

  const handleGenerateDrafts = async () => {
    setGeneratingDrafts(true);
    setFinanceError(null);
    try {
      // /api/finance/generate-drafts only exists in the client app, so
      // this was a 404 and the billing run never started. The admin
      // route does the same thing behind action 'generate'.
      const res = await apiFetch('/api/finance', {
        method: 'POST',
        body: JSON.stringify({ action: 'generate' })
      });
      const data = await res.json();

      if (!res.ok) {
        setFinanceError(data.error || 'The billing run failed.');
        return;
      }

      // The server has already written the rows. Re-saving them through the
      // db blob would be a second write of the same data, so this just
      // reloads what is now there.
      setLastRun({ summary: data.summary || `${data.created?.length || 0} draft invoice(s) created.`, skipped: data.skipped || [] });
      await syncFromDb();
    } catch (e: any) {
      setFinanceError(e?.message || 'The billing run failed.');
    } finally {
      setGeneratingDrafts(false);
    }
  };

  const handlePreviewBilling = async () => {
    setLoadingPreview(true); setFinanceError(null);
    try {
      const res = await apiFetch('/api/finance?view=preview');
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not preview billing.');
      setBillingPreview(data);
    } catch (e: any) {
      setFinanceError(e?.message || 'Could not preview billing.');
    } finally { setLoadingPreview(false); }
  };

  /**
   * Issues an invoice: numbers it, dates it from the contract's payment
   * terms, and emails the PDF.
   *
   * "Send" used to flip the status to sent locally and save the blob. No
   * number was assigned, no due date was derived, and nothing reached the
   * client, so an invoice marked sent had been sent to nobody.
   */
  const handleSendInvoice = async (id: string) => {
    if (sendingInvoiceId) return;
    setSendingInvoiceId(id);
    setFinanceError(null);
    try {
      const res = await apiFetch('/api/finance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'send_invoice', invoiceId: id })
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) { setFinanceError(body.error || 'The invoice was not sent.'); return; }

      setLastRun({
        summary: `${body.invoiceNumber} emailed to ${body.sentTo}, due ${String(body.dueDate).slice(0, 10)}.`,
        skipped: []
      });
      await syncFromDb();
    } catch (e: any) {
      setFinanceError(e?.message || 'The invoice was not sent.');
    } finally {
      setSendingInvoiceId(null);
    }
  };

  const openInvoiceEditor = async (invoice: any) => {
    setFinanceError(null);
    try {
      const res = await apiFetch('/api/finance?view=invoices');
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'Could not load invoice lines.');
      const lines = (body.lineItems || []).filter((line: any) => String(line.invoiceId) === String(invoice.id));
      setEditingInvoice(invoice);
      setEditInvoiceLines(lines.map((line: any) => ({
        description: line.description,
        quantity: String(line.quantity || 1),
        unitAmount: String(line.unitAmount || 0)
      })));
    } catch (e: any) {
      setFinanceError(e?.message || 'Could not load invoice lines.');
    }
  };

  const saveInvoiceDraft = async () => {
    if (!editingInvoice || savingInvoiceDraft) return;
    setSavingInvoiceDraft(true); setFinanceError(null);
    try {
      const res = await apiFetch('/api/finance', {
        method: 'POST',
        body: JSON.stringify({
          action: 'update_draft_invoice', invoiceId: editingInvoice.id,
          lines: editInvoiceLines.map(line => ({
            description: line.description, quantity: Number(line.quantity), unitAmount: Number(line.unitAmount)
          }))
        })
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'The invoice draft was not saved.');
      setEditingInvoice(null); setEditInvoiceLines([]);
      await syncFromDb();
      setLastRun({ summary: 'Draft invoice updated. Review the PDF before sending.', skipped: [] });
    } catch (e: any) {
      setFinanceError(e?.message || 'The invoice draft was not saved.');
    } finally { setSavingInvoiceDraft(false); }
  };

  const handleBulkSendInvoices = async () => {
    if (selectedInvoices.size === 0) return;
    setFinanceError(null);

    // One call per invoice, through the route that actually sends it. This
    // used to flip the status to 'sent' in browser state and post the whole
    // invoices array through /api/db, which upserts every row: no invoice
    // was emailed, no number was issued, no due date was set, and every
    // other invoice on screen was rewritten from stale state.
    const draftIds = localInvoices
      .filter(inv => selectedInvoices.has(inv.id) && inv.status === 'draft')
      .map(inv => inv.id);

    if (draftIds.length === 0) {
      setFinanceError('None of those are drafts, so there is nothing to send.');
      return;
    }

    const failures: string[] = [];
    for (const invoiceId of draftIds) {
      try {
        const res = await apiFetch('/api/finance', {
          method: 'POST',
          body: JSON.stringify({ action: 'send_invoice', invoiceId })
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          failures.push(`${invoiceId}: ${body.error || 'not sent'}`);
        }
      } catch (e: any) {
        failures.push(`${invoiceId}: ${e?.message || 'not sent'}`);
      }
    }

    setSelectedInvoices(new Set());
    await syncFromDb();

    if (failures.length > 0) {
      setFinanceError(`${draftIds.length - failures.length} of ${draftIds.length} sent. ${failures.join('; ')}`);
    } else {
      setLastRun({ summary: `${draftIds.length} invoice(s) sent.`, skipped: [] });
    }
  };

  const handleUpdateInvoiceStatus = async (id: string, newStatus: 'paid' | 'void' | 'sent') => {
    setFinanceError(null);

    // Marking an invoice paid releases the candidate's payout, so it goes
    // through the server where the role is checked and the change is
    // audited. The other two are presentational and stay local.
    if (newStatus === 'paid') {
      const reference = (await promptInApp('Payment reference (bank reference, or how it was confirmed):', { title: 'Record payment', placeholder: 'Enter payment reference', required: true }))?.trim();
      if (!reference) return;
      try {
        const res = await apiFetch('/api/finance', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'mark_invoice_paid', invoiceId: id, reference })
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) { setFinanceError(body.error || 'The invoice was not updated.'); return; }
        await syncFromDb();
      } catch (e: any) {
        setFinanceError(e?.message || 'The invoice was not updated.');
      }
      return;
    }

    // Voiding and sending both go through the server now. Neither was ever
    // presentational: a void stops the ageing job chasing the client, and a
    // send issues the number, sets the due date and emails the PDF. Both
    // used to post the whole invoices array through /api/db.
    const action = newStatus === 'void' ? 'void_invoice' : 'send_invoice';
    const reason = newStatus === 'void'
      ? (await promptInApp('Why is this invoice being voided?', { title: 'Void invoice', placeholder: 'Reason for voiding', required: true }))?.trim()
      : undefined;
    if (newStatus === 'void' && !reason) return;

    try {
      const res = await apiFetch('/api/finance', {
        method: 'POST',
        body: JSON.stringify({ action, invoiceId: id, reason })
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) { setFinanceError(body.error || 'The invoice was not updated.'); return; }
      await syncFromDb();
    } catch (e: any) {
      setFinanceError(e?.message || 'The invoice was not updated.');
    }
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
    if (ids.length === 0 || approvingPayouts) return;
    setApprovingPayouts(true);
    setFinanceError(null);
    try {
      // The compliance check and the invoice check both happen on the
      // server now. They used to run here, against a signedByTalentIds
      // array that no column ever wrote, so the compliance half of the gate
      // was reading nothing.
      //
      // And the approval itself no longer corrupts one payout in five:
      //
      //   if (!failureTriggered && Math.random() > 0.8) { ... }
      //
      // That was a test stub that shipped. It marked a real payout failed
      // with "Invalid bank details routing number", a reason nobody had
      // reported, and told the operator to check the queue for simulated
      // failures they had no way to distinguish from real ones.
      const res = await apiFetch('/api/finance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approve_payouts', payoutIds: ids })
      });
      const body = await res.json().catch(() => ({}));

      if (!res.ok) {
        setFinanceError(body.error || 'The payouts were not approved.');
        return;
      }

      setBlockedPayouts(body.blocked || []);
      setSelectedPayouts(new Set());
      await syncFromDb();
    } catch (e: any) {
      setFinanceError(e?.message || 'The payouts were not approved.');
    } finally {
      setApprovingPayouts(false);
    }
  };

  /**
   * Records what the bank actually did. A failure needs the reason the bank
   * gave, typed by whoever saw it.
   */
  const handleSettlePayout = async (id: string, outcome: 'paid' | 'failed') => {
    let reason: string | undefined;
    if (outcome === 'failed') {
      reason = (await promptInApp('What reason did the bank give for the rejection?', { title: 'Record failed payout', placeholder: 'Bank rejection reason', required: true }))?.trim();
      if (!reason) return;
    }

    setFinanceError(null);
    try {
      const res = await apiFetch('/api/finance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'settle_payout', payoutId: id, outcome, reason })
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setFinanceError(body.error || 'The payout was not updated.');
        return;
      }
      await syncFromDb();
    } catch (e: any) {
      setFinanceError(e?.message || 'The payout was not updated.');
    }
  };

  // Fee Config Handlers
  const handleSaveFeeConfig = async () => {
    if (!editingConfigId || savingFee) return;
    setSavingFee(true);
    setFinanceError(null);
    try {
      // The percentages are typed as percentages and stored as fractions.
      // 15 on screen is 0.15 in the table, and the server rejects anything
      // outside 0 to 1 so a stray 15 cannot multiply a margin by a hundred.
      const res = await apiFetch('/api/finance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'set_fee',
          serviceLine: editingConfigId,
          clientFeePct: Number(editClientPct) / 100,
          talentCommissionPct: Number(editTalentPct) / 100
        })
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setFinanceError(body.error || 'The fee was not saved.');
        return;
      }

      setEditingConfigId(null);
      await loadFees();
    } catch (e: any) {
      setFinanceError(e?.message || 'The fee was not saved.');
    } finally {
      setSavingFee(false);
    }
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
            <div style={{ fontSize: '32px', fontWeight: 700, color: '#0F172A' }}>${Math.round(mrr).toLocaleString()}</div>
            <p style={{ fontSize: '12px', color: '#94A3B8', margin: '8px 0 0 0' }}>
              Billed to clients on recurring lines. Placements and projects are one-time and are not counted here.
            </p>
            {mrrUncounted > 0 && (
              <p style={{ fontSize: '12px', color: '#B45309', margin: '6px 0 0 0' }}>
                {mrrUncounted} recurring {mrrUncounted === 1 ? 'contract is' : 'contracts are'} missing from this figure
                because their service line has no fee set.
              </p>
            )}
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
              <Button onClick={handlePreviewBilling} disabled={loadingPreview} style={{ background: '#FFF', color: '#14213D', border: '1px solid #CBD5E1' }}>
                {loadingPreview ? 'Preparing preview…' : 'Preview billing'}
              </Button>
              <Button onClick={handleGenerateDrafts} disabled={generatingDrafts} style={{ background: '#FFF', color: '#0F172A', border: '1px solid #E2E8F0' }}>
                {generatingDrafts ? 'Generating...' : 'Auto-Generate Drafts'}
              </Button>
              {selectedInvoices.size > 0 && invoiceFilter === 'draft' && (
                <Button onClick={handleBulkSendInvoices} style={{ background: '#2563EB', color: '#FFF' }}>Bulk Send ({selectedInvoices.size})</Button>
              )}
            </div>
          </div>

          {financeError && (
            <div style={{ background: '#FEE2E2', border: '1px solid #FCA5A5', color: '#991B1B', padding: '12px', borderRadius: '8px', marginBottom: '16px', fontSize: '13px' }}>{financeError}</div>
          )}

          {lastRun && (
            <div style={{ background: '#F0F9FF', border: '1px solid #BAE6FD', padding: '16px', borderRadius: '8px', marginBottom: '16px', fontSize: '13px', color: '#0C4A6E' }}>
              <strong>{lastRun.summary}</strong>
              {lastRun.skipped.length > 0 && (
                <ul style={{ margin: '10px 0 0 0', paddingLeft: '18px' }}>
                  {lastRun.skipped.map((s: any, i: number) => <li key={i} style={{ marginBottom: '4px' }}>{s.reason}</li>)}
                </ul>
              )}
            </div>
          )}

          {billingPreview && (
            <section aria-label="Billing preview" style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 12, padding: 16, marginBottom: 18 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'start' }}>
                <div><h3 style={{ margin: 0, color: '#14213D', fontSize: 16 }}>Billing preview</h3><p style={{ margin: '5px 0 12px', color: '#64748B', fontSize: 13 }}>{billingPreview.summary || 'Amounts calculated from active engagements and the configured service fees.'}</p></div>
                <button type="button" className="btn-secondary" onClick={() => setBillingPreview(null)}>Close</button>
              </div>
              {(billingPreview.drafts || []).length === 0 ? <p style={{ color: '#64748B', marginBottom: 0 }}>No invoices are currently due.</p> : (
                <div style={{ overflowX: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}><thead><tr style={{ color: '#64748B', textAlign: 'left' }}><th style={{ padding: 8 }}>Service / period</th><th style={{ padding: 8 }}>Client lines</th><th style={{ padding: 8 }}>Client total</th><th style={{ padding: 8 }}>Talent net</th><th style={{ padding: 8 }}>Kongila margin</th></tr></thead><tbody>
                  {billingPreview.drafts.map((draft: any) => <tr key={`${draft.contractId}-${draft.period || 'once'}`} style={{ borderTop: '1px solid #E2E8F0', verticalAlign: 'top' }}><td style={{ padding: 8 }}>{LINE_LABELS[draft.serviceLine] || draft.serviceLine}<small style={{ display: 'block', color: '#64748B' }}>{draft.period || 'one-time'} · {draft.contractId}</small>{draft.period && <small style={{ display: 'block', color: '#64748B' }}>{draft.recurring === false ? 'One invoice only' : `Repeats monthly · billing day ${draft.billingDayOfMonth || 1}`}</small>}</td><td style={{ padding: 8 }}>{draft.lines.map((line: any, i: number) => <div key={i} style={{ marginBottom: 5 }}>{line.description}: {draft.currency} {formatCurrency(line.amount)}</div>)}</td><td style={{ padding: 8, fontWeight: 700 }}>{draft.currency} {formatCurrency(draft.total)}</td><td style={{ padding: 8 }}>{draft.talentPayout == null ? '—' : `${draft.currency} ${formatCurrency(draft.talentPayout)}`}</td><td style={{ padding: 8 }}>{draft.currency} {formatCurrency(draft.platformMargin)}</td></tr>)}
                </tbody></table></div>
              )}
              {(billingPreview.skipped || []).length > 0 && <details style={{ marginTop: 12 }}><summary style={{ cursor: 'pointer', color: '#8A5B00', fontWeight: 600 }}>{billingPreview.skipped.length} item(s) need attention</summary><ul>{billingPreview.skipped.map((item: any, i: number) => <li key={i}>{item.reason}</li>)}</ul></details>}
            </section>
          )}

          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #E2E8F0', color: '#64748B', fontSize: '13px' }}>
                <th style={{ padding: '12px 8px' }}>
                  <input type="checkbox" onChange={(e) => setSelectedInvoices(e.target.checked ? new Set(filteredInvoices.map(i => i.id)) : new Set())} checked={selectedInvoices.size > 0 && selectedInvoices.size === filteredInvoices.length} />
                </th>
                <th style={{ padding: '12px 8px' }}>Invoice</th>
                <th style={{ padding: '12px 8px' }}>Client</th>
                <th style={{ padding: '12px 8px' }}>Amount</th>
                <th style={{ padding: '12px 8px' }}>Kongila margin</th>
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
                  <td style={{ padding: '12px 8px', fontWeight: 500 }}>{(inv as any).invoiceNumber || <span style={{ color: '#94A3B8' }}>not issued</span>}</td>
                  <td style={{ padding: '12px 8px' }}>{(inv as any).clientName || 'Unknown'}</td>
                  <td style={{ padding: '12px 8px' }}>{formatCurrency(invoiceTotal(inv))}</td>
                  <td style={{ padding: '12px 8px', color: '#0F766E', fontWeight: 600 }}>{(inv as any).platformMarginUsd == null ? '—' : formatCurrency(Number((inv as any).platformMarginUsd))}</td>
                  <td style={{ padding: '12px 8px' }}>{formatDate(inv.dueDate)}</td>
                  <td style={{ padding: '12px 8px' }}>
                    <Badge status={getStatusColor(inv.status) as any} text={inv.status} />
                  </td>
                  <td style={{ padding: '12px 8px' }}>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      {inv.status === 'draft' && (
                        <>
                        <button onClick={() => openInvoiceEditor(inv)} style={{ background: 'none', border: 'none', color: '#475569', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}>Edit draft</button>
                        <button onClick={() => handleSendInvoice(inv.id)} disabled={sendingInvoiceId === inv.id} style={{ background: 'none', border: 'none', color: '#2563EB', cursor: sendingInvoiceId === inv.id ? 'not-allowed' : 'pointer', fontSize: '13px', fontWeight: 600 }}>
                          {sendingInvoiceId === inv.id ? 'Sending...' : 'Send'}
                        </button>
                        </>
                      )}
                      {(inv.status === 'sent' || inv.status === 'overdue') && (
                        <button onClick={() => handleUpdateInvoiceStatus(inv.id, 'paid')} style={{ background: 'none', border: 'none', color: '#10B981', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}>Mark paid</button>
                      )}
                      <a href={`/api/finance?view=pdf&invoiceId=${encodeURIComponent(inv.id)}`} style={{ color: '#64748B', fontSize: '13px', fontWeight: 600, textDecoration: 'none' }}>PDF</a>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredInvoices.length === 0 && (
                <tr><td colSpan={8} style={{ padding: '24px', textAlign: 'center', color: '#94A3B8' }}>No invoices found.</td></tr>
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
                <th style={{ padding: '12px 8px' }}>Commission</th>
                <th style={{ padding: '12px 8px' }}>Net</th>
                <th style={{ padding: '12px 8px' }}>Status</th>
                <th style={{ padding: '12px 8px' }}>Warnings</th>
                <th style={{ padding: '12px 8px' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredPayouts.map((pay: any) => {
                const hasHold = checkComplianceHolds(pay.talentId);
                const invPaid = checkInvoicePaid(pay.invoiceId);
                // Gross, commission and net are three separate stored
                // figures now. They used to all fall back to `amount`
                // because the commission columns did not exist, so every
                // payout showed the same number three times.
                const gross = pay.grossAmount ?? null;
                const net = pay.netAmount ?? pay.amount ?? 0;
                const commission = pay.commissionAmount
                  ?? (gross !== null ? Math.round((gross - net) * 100) / 100 : null);
                const blocked = blockedPayouts.find((b: any) => b.id === pay.id);
                return (
                  <tr key={pay.id} style={{ borderBottom: '1px solid #F1F5F9', fontSize: '14px', background: pay.status === 'failed' ? '#FEF2F2' : 'transparent' }}>
                    <td style={{ padding: '12px 8px' }}>
                      <input type="checkbox" checked={selectedPayouts.has(pay.id)} onChange={() => togglePayoutSelection(pay.id)} disabled={pay.status !== 'pending'} />
                    </td>
                    <td style={{ padding: '12px 8px', fontWeight: 500 }}>{String(pay.talentId || '').substring(0, 8)}</td>
                    <td style={{ padding: '12px 8px' }}>
                      {gross === null
                        ? <span style={{ color: '#94A3B8' }}>not recorded</span>
                        : formatCurrency(gross)}
                    </td>
                    <td style={{ padding: '12px 8px', color: '#64748B' }}>
                      {commission === null
                        ? <span style={{ color: '#94A3B8' }}>&mdash;</span>
                        : <>
                            {formatCurrency(commission)}
                            {pay.commissionPct != null && (
                              <span style={{ fontSize: '12px', marginLeft: '4px' }}>
                                ({(Number(pay.commissionPct) * 100).toFixed(2).replace(/\.00$/, '')}%)
                              </span>
                            )}
                          </>}
                    </td>
                    <td style={{ padding: '12px 8px', fontWeight: 600 }}>{formatCurrency(net)}</td>
                    <td style={{ padding: '12px 8px' }}>
                      <Badge status={getStatusColor(pay.status) as any} text={pay.status} />
                      {pay.status === 'failed' && <div style={{ color: '#DC2626', fontSize: '12px', marginTop: '4px' }}>{pay.failureReason}</div>}
                    </td>
                    <td style={{ padding: '12px 8px' }}>
                      {blocked && <span style={{ color: '#DC2626', fontSize: '12px', display: 'block' }}>{blocked.reason}</span>}
                      {!blocked && hasHold && <span style={{ color: '#DC2626', fontSize: '12px', display: 'block' }}>Compliance hold</span>}
                      {!blocked && !invPaid && <span style={{ color: '#F59E0B', fontSize: '12px', display: 'block' }}>Client invoice unpaid</span>}
                    </td>
                    <td style={{ padding: '12px 8px' }}>
                      {pay.status === 'pending' && (
                        <button onClick={() => handleApprovePayouts([pay.id])} disabled={approvingPayouts} style={{ background: 'none', border: 'none', color: '#10B981', cursor: approvingPayouts ? 'not-allowed' : 'pointer', fontSize: '13px', fontWeight: 600 }}>Approve</button>
                      )}
                      {(pay.status === 'approved' || pay.status === 'processing') && (
                        <div style={{ display: 'flex', gap: '10px' }}>
                          <button onClick={() => handleSettlePayout(pay.id, 'paid')} style={{ background: 'none', border: 'none', color: '#10B981', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}>Mark paid</button>
                          <button onClick={() => handleSettlePayout(pay.id, 'failed')} style={{ background: 'none', border: 'none', color: '#DC2626', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}>Record failure</button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
              {filteredPayouts.length === 0 && (
                <tr><td colSpan={8} style={{ padding: '24px', textAlign: 'center', color: '#94A3B8' }}>No payouts found.</td></tr>
              )}
            </tbody>
          </table>
        </Card>
      )}

      {activeTab === 'fees' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <Card style={{ padding: '24px', background: '#FFF' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 700, margin: '0 0 8px 0', color: '#0F172A' }}>Fee Configurations</h3>
            <p style={{ fontSize: '13px', color: '#64748B', margin: '0 0 16px 0' }}>
              The client fee is added to the rate and charged to the client. The talent commission is
              deducted from the rate. The difference between them is Kongila's margin. Nothing is billed
              on a line whose fee is unset.
            </p>
            {unsetLines.length > 0 && (
              <div style={{ background: '#FEF3C7', border: '1px solid #FCD34D', color: '#92400E', padding: '12px', borderRadius: '8px', marginBottom: '16px', fontSize: '13px' }}>
                {unsetLines.length === 1 ? 'One service line has' : `${unsetLines.length} service lines have`} no fee set,
                so contracts on {unsetLines.length === 1 ? 'it' : 'them'} will be skipped by the billing run.
              </div>
            )}
            {financeError && (
              <div style={{ background: '#FEE2E2', border: '1px solid #FCA5A5', color: '#991B1B', padding: '12px', borderRadius: '8px', marginBottom: '16px', fontSize: '13px' }}>{financeError}</div>
            )}
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #E2E8F0', color: '#64748B', fontSize: '13px' }}>
                  <th style={{ padding: '12px 8px' }}>Service line</th>
                  <th style={{ padding: '12px 8px' }}>Client Fee %</th>
                  <th style={{ padding: '12px 8px' }}>Talent Commission %</th>
                  <th style={{ padding: '12px 8px' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {serviceFees.length === 0 ? (
                  <tr><td colSpan={4} style={{ padding: '24px 8px', color: '#64748B' }}>
                    Could not load the fee configuration. Run the 3 November finance migration if you have not.
                  </td></tr>
                ) : serviceFees.map((c: any) => {
                  const unset = c.clientFeePct === null || c.talentCommissionPct === null;
                  const pct = (v: number | null) => (v === null ? null : `${(Number(v) * 100).toFixed(2).replace(/\.00$/, '')}%`);
                  return (
                  <tr key={c.serviceLine} style={{ borderBottom: '1px solid #F1F5F9', fontSize: '14px' }}>
                    <td style={{ padding: '12px 8px', fontWeight: 500 }}>{LINE_LABELS[c.serviceLine] || c.serviceLine}</td>
                    <td style={{ padding: '12px 8px' }}>
                      {editingConfigId === c.serviceLine ? (
                        <input type="number" step="0.5" value={editClientPct} onChange={e => setEditClientPct(Number(e.target.value))} style={{ width: '70px', padding: '4px' }} />
                      ) : (pct(c.clientFeePct) ?? <span style={{ color: '#B45309' }}>not set</span>)}
                    </td>
                    <td style={{ padding: '12px 8px' }}>
                      {editingConfigId === c.serviceLine ? (
                        <input type="number" step="0.5" value={editTalentPct} onChange={e => setEditTalentPct(Number(e.target.value))} style={{ width: '70px', padding: '4px' }} />
                      ) : (pct(c.talentCommissionPct) ?? <span style={{ color: '#B45309' }}>not set</span>)}
                    </td>
                    <td style={{ padding: '12px 8px' }}>
                      {editingConfigId === c.serviceLine ? (
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button onClick={handleSaveFeeConfig} disabled={savingFee} style={{ color: '#10B981', border: 'none', background: 'none', cursor: savingFee ? 'not-allowed' : 'pointer', fontWeight: 600 }}>{savingFee ? 'Saving...' : 'Save'}</button>
                          <button onClick={() => setEditingConfigId(null)} style={{ color: '#64748B', border: 'none', background: 'none', cursor: 'pointer' }}>Cancel</button>
                        </div>
                      ) : (
                        <button onClick={() => { setEditingConfigId(c.serviceLine); setEditClientPct(Number(c.clientFeePct ?? 0) * 100); setEditTalentPct(Number(c.talentCommissionPct ?? 0) * 100); }} style={{ color: '#2563EB', border: 'none', background: 'none', cursor: 'pointer', fontWeight: 600 }}>{unset ? 'Set' : 'Edit'}</button>
                      )}
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>

          {/* Everything else that decides what an invoice says: the
              placement percentage, the supervision premium, payment terms,
              and the days a split payment falls due. Per service line, and
              per client where one has been negotiated. */}
          <BillingTermsPanel organizations={organizations} />

          <Card style={{ padding: '24px', background: '#F8FAFC' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 700, margin: '0 0 16px 0', color: '#0F172A' }}>Fee Audit Logs</h3>
            {feeLog.length === 0 ? (
              <p style={{ fontSize: '13px', color: '#64748B', margin: 0 }}>No fee has been changed yet.</p>
            ) : feeLog.map((log: any) => {
              const pct = (v: number | null) => (v === null || v === undefined ? 'unset' : `${(Number(v) * 100).toFixed(2).replace(/\.00$/, '')}%`);
              return (
              <div key={log.id} style={{ padding: '12px', background: '#FFF', borderRadius: '8px', marginBottom: '8px', border: '1px solid #E2E8F0', fontSize: '13px' }}>
                <span style={{ color: '#64748B' }}>{formatDate(log.changedAt)}</span>
                <strong style={{ margin: '0 8px' }}>{LINE_LABELS[log.serviceLine] || log.serviceLine}</strong>
                client fee {pct(log.previousClientFeePct)} to {pct(log.newClientFeePct)}, talent commission {pct(log.previousTalentCommissionPct)} to {pct(log.newTalentCommissionPct)}.
              </div>
              );
            })}
          </Card>
        </div>
      )}
      {editingInvoice && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget && !savingInvoiceDraft) setEditingInvoice(null); }}>
          <section className="modal-content" style={{ width: 'min(760px, 94vw)', maxHeight: '88vh', overflow: 'auto', padding: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: 16 }}>
              <div><h2 style={{ margin: 0, color: '#14213D' }}>Edit draft invoice</h2><p style={{ color: '#64748B', margin: '6px 0 20px' }}>Review service and Kongila fee lines before this branded invoice is issued.</p></div>
              <button type="button" onClick={() => setEditingInvoice(null)} disabled={savingInvoiceDraft} className="btn-secondary">Close</button>
            </div>
            {financeError && <div role="alert" style={{ color: '#991B1B', background: '#FEF2F2', padding: 10, borderRadius: 8, marginBottom: 14 }}>{financeError}</div>}
            <div style={{ display: 'grid', gap: 10 }}>
              {editInvoiceLines.map((line, index) => (
                <div key={index} style={{ display: 'grid', gridTemplateColumns: 'minmax(180px, 1fr) 100px 150px auto', gap: 8, alignItems: 'end' }}>
                  <label style={{ fontSize: 12, color: '#64748B' }}>Description<input aria-label={`Line ${index + 1} description`} value={line.description} onChange={e => setEditInvoiceLines(rows => rows.map((row, i) => i === index ? { ...row, description: e.target.value } : row))} /></label>
                  <label style={{ fontSize: 12, color: '#64748B' }}>Quantity<input aria-label={`Line ${index + 1} quantity`} type="number" min="0.01" step="0.01" value={line.quantity} onChange={e => setEditInvoiceLines(rows => rows.map((row, i) => i === index ? { ...row, quantity: e.target.value } : row))} /></label>
                  <label style={{ fontSize: 12, color: '#64748B' }}>Unit amount<input aria-label={`Line ${index + 1} unit amount`} type="number" min="0" step="0.01" value={line.unitAmount} onChange={e => setEditInvoiceLines(rows => rows.map((row, i) => i === index ? { ...row, unitAmount: e.target.value } : row))} /></label>
                  <button type="button" className="btn-secondary" onClick={() => setEditInvoiceLines(rows => rows.filter((_, i) => i !== index))} aria-label={`Remove line ${index + 1}`}>Remove</button>
                </div>
              ))}
              <button type="button" className="btn-secondary" onClick={() => setEditInvoiceLines(rows => [...rows, { description: '', quantity: '1', unitAmount: '0' }])}>Add invoice line</button>
            </div>
            <div style={{ borderTop: '1px solid #E2E8F0', marginTop: 18, paddingTop: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <strong>Draft total: {formatCurrency(editInvoiceLines.reduce((sum, line) => sum + Number(line.quantity || 0) * Number(line.unitAmount || 0), 0))}</strong>
              <button type="button" className="btn-primary" disabled={savingInvoiceDraft || editInvoiceLines.length === 0} onClick={saveInvoiceDraft}>{savingInvoiceDraft ? 'Saving…' : 'Save draft'}</button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
