import { apiFetch } from '../lib/apiFetch';
import React, { useEffect, useState } from 'react';
import GenerateContractModal from './GenerateContractModal';
import { GlassCard, Chip } from '@kongila/ui';
import { formatCurrency, formatDate } from '@kongila/utils';
import { documentToHtml } from '@kongila/contracts';
import EngagementActivationModal from './EngagementActivationModal';
import ContractTermsModal from './ContractTermsModal';

export default function ContractsManager({
  contracts,
  contractTemplates,
  talents,
  organizations,
  requests,
  offers = [],
  permissions = [],
  auditLogs,
  setContracts,
  setContractTemplates,
  setAuditLogs
}: any) {
  const [engagementRows, setEngagementRows] = useState<any[]>([]);
  const [engagementLoadError, setEngagementLoadError] = useState('');
  const [templateLoadError, setTemplateLoadError] = useState('');

  // Queue State
  const [contractFilter, setContractFilter] = useState('All');
  const [selectedContract, setSelectedContract] = useState<any | null>(null);
  const [saving, setSaving] = useState(false);
  const [activationContract, setActivationContract] = useState<any | null>(null);
  const [activationMessage, setActivationMessage] = useState('');
  const [termsContract, setTermsContract] = useState<any | null>(null);

  const loadEngagements = async () => {
    try {
      const response = await apiFetch('/api/engagements');
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || 'Could not load engagement portfolio.');
      setEngagementRows(body.engagements || []); setEngagementLoadError('');
    } catch (e: any) { setEngagementLoadError(e?.message || 'Could not load engagement portfolio.'); }
  };
  useEffect(() => { loadEngagements(); }, []);
  useEffect(() => {
    let mounted = true;
    apiFetch('/api/contracts/templates').then(async response => {
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || 'Could not load contract templates.');
      if (mounted) {
        setContractTemplates(body.templates || []);
        setTemplateLoadError('');
      }
    }).catch(error => { if (mounted) setTemplateLoadError(error?.message || 'Could not load contract templates.'); });
    return () => { mounted = false; };
  }, [setContractTemplates]);

  const updateMilestone = async (recordId: string, action: 'complete' | 'invoice' | 'complete_project') => {
    setSaving(true);
    try {
      const response = await apiFetch('/api/engagements/milestones', { method: 'POST', body: JSON.stringify({ milestoneId: action === 'complete_project' ? undefined : recordId, projectId: action === 'complete_project' ? recordId : undefined, action }) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) setActivationMessage(body.error || 'Milestone action did not complete.');
      else { setActivationMessage(action === 'complete' ? 'Milestone delivery recorded. Finance can now invoice it.' : action === 'invoice' ? 'Milestone invoice drafted.' : 'Project handed over; its engagements have ended.'); await loadEngagements(); }
    } catch (e: any) { setActivationMessage(e?.message || 'Milestone action did not complete.'); }
    setSaving(false);
  };
  
  /** The service line key a template is filed under, from the label used here. */
  const contractLineForTemplate = (serviceType: string) => ({
    'Hire Talent': 'placement', 'Outsource Talent': 'outsourcing',
    'Managed Workforce': 'managed_workforce', 'Project Execution': 'project'
  } as Record<string, string>)[serviceType] || serviceType;

  // Void modal
  const [showVoidModal, setShowVoidModal] = useState(false);
  const [voidReason, setVoidReason] = useState('');


  /**
   * Offers the candidate has accepted that have no contract yet.
   *
   * This is the queue that was missing. An accepted offer sat in the offers
   * screen and a contract was drafted, separately, from an empty form, by
   * somebody retyping the figures. These are the ones waiting.
   */
  const [generateFor, setGenerateFor] = useState<any | null>(null);

  /**
   * The selected contract's documents and invoices.
   *
   * The detail pane showed a status, a rate and seven buttons, and never the
   * contract itself. The two things an operator actually wants to do here
   * are read what the parties will sign and see what has been billed.
   */
  const [detail, setDetail] = useState<any | null>(null);
  const [detailTab, setDetailTab] = useState<'client' | 'talent' | 'invoice'>('client');
  /** Read the contract as a document, or edit the markup behind it. */
  const [detailPreview, setDetailPreview] = useState(true);
  const [detailBody, setDetailBody] = useState({ client: '', talent: '' });
  const [detailDirty, setDetailDirty] = useState(false);
  const [detailSaving, setDetailSaving] = useState(false);
  const [detailError, setDetailError] = useState('');
  const [editingInvoiceId, setEditingInvoiceId] = useState('');
  const [invoiceLinesDraft, setInvoiceLinesDraft] = useState<any[]>([]);
  const [invoiceActionBusy, setInvoiceActionBusy] = useState('');
  const canManageInvoices = (permissions || []).includes('invoices.manage') || (permissions || []).includes('finance.manage');

  const saveInvoiceDraft = async (invoiceId: string) => {
    setInvoiceActionBusy(invoiceId);
    try {
      const response = await apiFetch('/api/finance', { method: 'POST', body: JSON.stringify({
        action: 'update_draft_invoice', invoiceId,
        lines: invoiceLinesDraft.map(line => ({ description: line.description, quantity: Number(line.quantity), unitAmount: Number(line.unit_amount) }))
      }) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || 'The invoice draft was not saved.');
      setEditingInvoiceId(''); await loadDetail(String(selectedContract.id));
      setActivationMessage('Invoice draft saved.');
    } catch (error: any) { setActivationMessage(error?.message || 'The invoice draft was not saved.'); }
    finally { setInvoiceActionBusy(''); }
  };

  const sendInvoiceDraft = async (invoiceId: string) => {
    setInvoiceActionBusy(invoiceId);
    try {
      const response = await apiFetch('/api/finance', { method: 'POST', body: JSON.stringify({ action: 'send_invoice', invoiceId }) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || 'The invoice was not sent.');
      await loadDetail(String(selectedContract.id));
      setActivationMessage(body.warnings?.length ? body.warnings.join(' ') : 'Kongila branded invoice emailed to the client.');
    } catch (error: any) { setActivationMessage(error?.message || 'The invoice was not sent.'); }
    finally { setInvoiceActionBusy(''); }
  };

  /**
   * The two issued documents and their states.
   *
   * Separate from the contract detail because this is the thing an operator
   * chasing a signature actually needs: which party has it, whether they
   * have opened it, and how long they have had it. The single status column
   * could never answer that.
   */
  const [docs, setDocs] = useState<any | null>(null);
  const [docBusy, setDocBusy] = useState('');
  const canSendDocuments = (permissions || []).includes('contracts.manage');

  const loadDocuments = async (contractId: string) => {
    try {
      const response = await apiFetch(`/api/contracts/documents?contractId=${encodeURIComponent(contractId)}`);
      const body = await response.json().catch(() => ({}));
      setDocs(response.ok ? body : null);
    } catch {
      setDocs(null);
    }
  };

  const sendDocument = async (audience: 'client' | 'talent') => {
    if (!selectedContract) return;
    setDocBusy(audience);
    setDetailError('');
    try {
      const response = await apiFetch('/api/contracts/documents', {
        method: 'POST',
        body: JSON.stringify({ action: 'send', contractId: selectedContract.id, audience })
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body?.error || 'That document was not sent.');
      await loadDocuments(String(selectedContract.id));
      setActivationMessage(body.warnings?.length
        ? body.warnings.join(' ')
        : body.reminder
          ? `Reminder sent to ${audience === 'talent' ? 'the candidate' : 'the client'}.`
          : `Sent to ${audience === 'talent' ? 'the candidate' : 'the client'}.`);
    } catch (cause: any) {
      setDetailError(cause?.message || 'That document was not sent.');
    } finally {
      setDocBusy('');
    }
  };

  const loadDetail = async (contractId: string) => {
    setDetail(null);
    setDetailError('');
    setDetailDirty(false);
    try {
      const response = await apiFetch(`/api/contracts/generate?contractId=${encodeURIComponent(contractId)}`);
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body?.error || 'The contract could not be loaded.');
      setDetail(body);
      setDetailBody({
        client: body.documents?.clientBody || '',
        talent: body.documents?.talentBody || ''
      });
      setDetailTab('client');
    } catch (cause: any) {
      setDetailError(cause?.message || 'The contract could not be loaded.');
    }
  };

  const saveDocuments = async () => {
    if (!selectedContract) return;
    setDetailSaving(true);
    setDetailError('');
    try {
      const response = await apiFetch('/api/contracts/generate', {
        method: 'POST',
        body: JSON.stringify({
          action: 'updateDocument',
          contractId: selectedContract.id,
          clientBody: detailBody.client,
          talentBody: detailBody.talent
        })
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body?.error || 'The wording was not saved.');
      setDetailDirty(false);
      setActivationMessage('Contract wording saved.');
    } catch (cause: any) {
      setDetailError(cause?.message || 'The wording was not saved.');
    } finally {
      setDetailSaving(false);
    }
  };

  useEffect(() => {
    if (selectedContract?.id) {
      void loadDetail(String(selectedContract.id));
      void loadDocuments(String(selectedContract.id));
    } else { setDetail(null); setDetailError(''); setDocs(null); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedContract?.id]);

  const awaitingContract = (offers || []).filter((offer: any) => {
    const status = String(offer.status || '').toLowerCase();
    if (!['accepted', 'contract_active'].includes(status)) return false;
    const contract = (contracts || []).find((row: any) =>
      String(row.offerId ?? row.offer_id ?? '') === String(offer.id));
    return !contract || !(contract.clientContractBody || contract.client_contract_body);
  });
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
  const selectedEngagement = selectedContract ? engagementRows.find((row: any) => String(row.contract_id) === String(selectedContract.id)) : null;
  const isSelectedPlacement = ['hire talent', 'direct hire', 'direct_hire', 'placement']
    .some(value => String(selectedContract?.serviceType || selectedContract?.service_type || '').toLowerCase().includes(value));
  const selectedServiceType = String(selectedContract?.serviceType || selectedContract?.service_type || '').toLowerCase();
  const selectedLine = selectedServiceType.includes('hire talent') || selectedServiceType.includes('placement') || selectedServiceType.includes('direct hire') || selectedServiceType.includes('direct_hire')
    ? 'placement' : selectedServiceType.includes('project') ? 'project'
      : selectedServiceType.includes('managed') ? 'managed_workforce' : 'outsourcing';
  const selectedBaseAmount = selectedLine === 'placement' ? Number(selectedContract?.placementFeeUsd || 0)
    : selectedLine === 'project' ? Number(selectedContract?.projectFeeUsd || 0)
      : Number(selectedContract?.rateAmount || selectedContract?.salary || 0);
  const selectedClientFeePct = selectedContract?.clientFeePctSnapshot == null ? null : Number(selectedContract.clientFeePctSnapshot);
  const selectedTalentPct = selectedContract?.talentCommissionPctSnapshot == null ? null : Number(selectedContract.talentCommissionPctSnapshot);

  const handleUpdateContractStatus = async (contractId: string, newStatus: string) => {
    if (saving) return;
    setSaving(true);
    // The local array rewrite and the whole-database save that used to be
    // here are gone. They posted every contract on screen through /api/db,
    // which upserts all of them, and wrote statuses ('Active', 'Signed')
    // that contracts_status_check does not allow, so Postgres refused them
    // while the rest of the payload still overwrote good rows. The audit
    // entry was inserted the same way with actor hardcoded to 'Admin'.

    // Anything that is not an activation goes through the status route,
    // which checks the move is legal and writes the audit entry.
    if (newStatus !== 'Active' && newStatus !== 'Signed') {
      try {
        const res = await apiFetch('/api/contracts/status', {
          method: 'POST',
          body: JSON.stringify({ action: 'status', contractId, status: newStatus })
        });
        const result = await res.json().catch(() => ({}));
        if (!res.ok) {
          alert(result?.error || 'The contract status did not save.');
          setSaving(false);
          return;
        }
        setContracts(contracts.map((c: any) =>
          c.id === contractId ? { ...c, status: result.status } : c));
        if (selectedContract && selectedContract.id === contractId) {
          setSelectedContract({ ...selectedContract, status: result.status });
        }
      } catch (e: any) {
        console.error('Failed to update contract status', e);
        alert(e?.message || 'The contract status did not save.');
      }
      setSaving(false);
      return;
    }

    if (newStatus === 'Active' || newStatus === 'Signed') {
      // This used to trigger the mock onboarding workflow, which is hardcoded
      // to fail at step three. The real effect of signing is that the request
      // moves to Onboarding, which is what makes it count as Hired.
      try {
        const res = await apiFetch('/api/contracts/sign', {
          method: 'POST',
          body: JSON.stringify({ contractId, activate: newStatus === 'Active' })
        });
        const result = await res.json().catch(() => ({}));
        if (!res.ok || !result?.ok) {
          alert(result?.error || 'The contract status did not save.');
        } else if (result.warnings?.length) {
          alert(result.warnings.join('\n'));
        }
      } catch (e) {
        console.error('Failed to record contract signature', e);
        alert('The contract status did not save. Check the console.');
      }
    }

    setSaving(false);
  };

  const handlePlacementActivation = async (contract: any) => {
    if (saving) return;
    setSaving(true); setActivationMessage('');
    try {
      const res = await apiFetch('/api/contracts/status', {
        method: 'POST', body: JSON.stringify({ action: 'raiseInvoice', contractId: contract.id })
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok) setActivationMessage(result.error || 'The placement invoice could not be prepared.');
      else {
        const updated = {
          ...contract,
          ...(isSelectedPlacement ? {
            placementFeeInvoicedAt: new Date().toISOString(),
            placementInvoiceId: result.id || result.data?.id || contract.placementInvoiceId
          } : {})
        };
        setContracts(contracts.map((row: any) => row.id === contract.id ? updated : row));
        setSelectedContract(updated);
        await loadDetail(String(contract.id));
        setActivationMessage('Invoice draft prepared from the contract. Review, edit and send it from the invoice panel.');
      }
    } catch (e: any) { setActivationMessage(e?.message || 'The placement could not be activated.'); }
    setSaving(false);
  };

  const handleVoidContract = async () => {
    if (!voidReason || saving) return;
    setSaving(true);
    
    // Through the server. 'Voided' is not a value contracts_status_check
    // allows, so this never saved; the route maps it to 'terminated' and
    // reopens the request behind the contract, which the browser used to do
    // by rewriting the whole clientRequests array.
    try {
      const res = await apiFetch('/api/contracts/status', {
        method: 'POST',
        body: JSON.stringify({
          action: 'status',
          contractId: selectedContract.id,
          status: 'Voided',
          reason: voidReason
        })
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(result?.error || 'The contract was not voided.');
        setSaving(false);
        return;
      }

      setContracts(contracts.map((c: any) =>
        c.id === selectedContract.id ? { ...c, status: result.status, voidReason } : c));
      setSelectedContract({ ...selectedContract, status: result.status, voidReason });
      setShowVoidModal(false);
      if (result.warnings?.length) alert(result.warnings.join('\n'));
    } catch (e: any) {
      console.error('Failed to void contract', e);
      alert(e?.message || 'The contract was not voided.');
    }

    setSaving(false);
    setVoidReason('');
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Contracts</h1>
          <p className="page-subtitle">Review contracts, signatures and invoices in one place.</p>
        </div>
        <button className="btn-primary" onClick={() => awaitingContract[0] && setGenerateFor(awaitingContract[0])} disabled={!awaitingContract.length} title={!awaitingContract.length ? 'No accepted offers are waiting for a contract' : ''}>Start creating contracts{awaitingContract.length ? ` (${awaitingContract.length})` : ''}</button>
      </div>

      {templateLoadError && (
        <div role="alert" style={{ background: '#FEF2F2', color: '#991B1B', border: '1px solid #FECACA', borderRadius: 10, padding: 12, marginBottom: 14 }}>
          {templateLoadError} Contracts are generated from published templates, so generation will
          fail until this is fixed. The wording itself lives in Contract Templates.
        </div>
      )}


          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {['All', 'Draft', 'Pending Signatures', 'Signed', 'Active', 'Terminated', 'Voided'].map(f => (
                <button key={f} onClick={() => setContractFilter(f)} style={{ padding: '6px 14px', borderRadius: '999px', border: `1px solid ${contractFilter === f ? 'var(--kongila-blue)' : 'var(--border-glass)'}`, background: contractFilter === f ? 'var(--kongila-blue-glow)' : 'var(--bg-secondary)', color: contractFilter === f ? 'var(--kongila-blue)' : 'var(--text-secondary)', fontWeight: contractFilter === f ? 600 : 400, fontSize: '12px', cursor: 'pointer' }}>{f}</button>
              ))}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '24px' }}>
            <div className="table-container">
              <table className="custom-table">
                <thead><tr>{['Contract', 'Talent', 'Client', 'Status', 'Days Pending'].map(h => <th key={h}>{h}</th>)}</tr></thead>
                <tbody>
                  {filteredContracts.length === 0 ? (
                    <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '40px' }}>No contracts found.</td></tr>
                  ) : filteredContracts.map((c: any) => {
                    const daysPending = getDaysPending(c);
                    const isStalled = daysPending >= 14;
                    
                    return (
                      <tr key={c.id} onClick={() => setSelectedContract(selectedContract?.id === c.id ? null : c)} style={{ cursor: 'pointer', background: selectedContract?.id === c.id ? 'var(--kongila-blue-glow)' : undefined }}>
                        <td><span style={{ fontWeight: 700, fontSize: '12px', color: 'var(--kongila-blue)', fontFamily: 'monospace' }}>{c.role || c.roleTitle || String(c.id).slice(0, 12)}<small style={{ display: 'block', color: 'var(--text-muted)' }}>{c.serviceType || ''}</small></span></td>
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

                {/* The contract itself, and what has been billed for it.

                    This pane used to show a status, a rate and seven
                    buttons, and never the document. The two things an
                    operator comes here to do are read what the parties will
                    sign and see what has gone out. */}
                <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid #E2E8F0', marginBottom: 14 }}>
                  {([
                    ['client', 'Client contract'],
                    ['talent', 'Candidate contract'],
                    ['invoice', `Invoice${detail?.invoices?.length ? ` (${detail.invoices.length})` : ''}`]
                  ] as const).map(([key, label]) => (
                    <button
                      key={key}
                      onClick={() => setDetailTab(key as any)}
                      style={{
                        padding: '8px 14px', border: 'none', background: 'transparent',
                        borderBottom: detailTab === key ? '2px solid #2563EB' : '2px solid transparent',
                        color: detailTab === key ? '#2563EB' : '#64748B',
                        fontWeight: detailTab === key ? 700 : 500, fontSize: 13, cursor: 'pointer'
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                {detailError && (
                  <div role="alert" style={{ background: '#FEE2E2', border: '1px solid #FCA5A5', color: '#991B1B', padding: 10, borderRadius: 8, marginBottom: 12, fontSize: 12.5 }}>{detailError}</div>
                )}

                {!detail && !detailError && <p style={{ fontSize: 13, color: '#64748B' }}>Loading…</p>}

                {detail && detailTab !== 'invoice' && (
                  <div style={{ marginBottom: 18 }}>
                    {(detailTab === 'client' ? detailBody.client : detailBody.talent) ? (
                      <>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8, flexWrap: 'wrap' }}>
                          <button type="button" onClick={() => setDetailPreview(value => !value)}
                            className="btn-secondary" style={{ fontSize: 11.5, height: 28, padding: '0 12px', borderRadius: 6 }}>
                            {detailPreview ? 'Edit the wording' : 'Read it as a document'}
                          </button>
                          <a
                            href={`/api/contracts/documents?view=pdf&contractId=${encodeURIComponent(String(selectedContract.id))}&audience=${detailTab === 'client' ? 'client' : 'talent'}`}
                            className="btn-secondary"
                            style={{ fontSize: 11.5, height: 28, padding: '0 12px', borderRadius: 6, display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }}
                          >
                            Download the PDF
                          </a>
                        </div>

                        {detailPreview ? (
                          /* Safe by construction: documentToHtml re-renders from
                             the parsed blocks, so only the documented subset
                             can reach the page. */
                          <div
                            className="kongila-document"
                            style={{
                              minHeight: 320, maxHeight: '52vh', overflow: 'auto',
                              background: '#FFFFFF', border: '1px solid #E2E8F0',
                              borderRadius: 8, padding: '20px 24px', fontSize: 12.5,
                              lineHeight: 1.65, color: '#14213D'
                            }}
                            dangerouslySetInnerHTML={{
                              __html: documentToHtml(detailTab === 'client' ? detailBody.client : detailBody.talent)
                            }}
                          />
                        ) : (
                        <textarea
                          value={detailTab === 'client' ? detailBody.client : detailBody.talent}
                          readOnly={!detail.documents?.editable}
                          onChange={e => {
                            setDetailDirty(true);
                            setDetailBody(current => detailTab === 'client'
                              ? { ...current, client: e.target.value }
                              : { ...current, talent: e.target.value });
                          }}
                          style={{
                            width: '100%', minHeight: 320, padding: 12, borderRadius: 8,
                            border: '1px solid #E2E8F0', fontFamily: 'ui-monospace, monospace',
                            fontSize: 11.5, lineHeight: 1.55,
                            background: detail.documents?.editable ? '#FFF' : '#F8FAFC'
                          }}
                        />
                        )}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8, flexWrap: 'wrap' }}>
                          {detail.documents?.editable ? (
                            <>
                              <button
                                onClick={saveDocuments}
                                disabled={!detailDirty || detailSaving}
                                className="btn-primary"
                                style={{ fontSize: 12, height: 32, padding: '0 14px', borderRadius: 8, opacity: detailDirty ? 1 : 0.5 }}
                              >
                                {detailSaving ? 'Saving…' : 'Save wording'}
                              </button>
                              <span style={{ fontSize: 11.5, color: '#64748B' }}>
                                Editable until somebody signs it.
                              </span>
                            </>
                          ) : (
                            <span style={{ fontSize: 11.5, color: '#64748B' }}>
                              Signed, so the wording is fixed. Void it and generate a new one if the terms are wrong.
                            </span>
                          )}
                        </div>
                      </>
                    ) : (
                      <p style={{ fontSize: 13, color: '#B45309', margin: 0 }}>
                        {detailTab === 'client'
                          ? 'This contract has no stored document. It was created before contracts carried their wording, or no client template was published when it was generated.'
                          : 'No candidate document was generated. Publish a candidate template for this service line, then generate the contract again.'}
                      </p>
                    )}
                  </div>
                )}

                {detail && detailTab === 'invoice' && (
                  <div style={{ marginBottom: 18 }}>
                    {detail.invoices?.length ? detail.invoices.map((invoice: any) => (
                      <div key={invoice.id} style={{ border: '1px solid #E2E8F0', borderRadius: 10, padding: 14, marginBottom: 10 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'baseline' }}>
                          <div>
                            <strong style={{ fontSize: 13.5, color: '#14213D' }}>{invoice.invoice_number || invoice.id}</strong>
                            <div style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>
                              {invoice.description || invoice.period || 'Invoice'}
                            </div>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: 16, fontWeight: 800, color: '#14213D' }}>
                              {formatCurrency(Number(invoice.total_usd ?? invoice.amount ?? 0))}
                            </div>
                            <Chip label={invoice.status} />
                          </div>
                        </div>
                        {Array.isArray(invoice.lines) && invoice.lines.length > 0 && (
                          <div style={{ marginTop: 12, borderTop: '1px solid #E2E8F0', paddingTop: 8 }}>
                            {invoice.lines.map((line: any, index: number) => (
                              <div key={line.id || index} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '6px 0', fontSize: 12.5, color: '#334155' }}>
                                <span>{line.description}<small style={{ display: 'block', color: '#64748B' }}>{Number(line.quantity || 1)} × {formatCurrency(Number(line.unit_amount ?? line.unitAmount ?? line.amount ?? 0))}</small></span>
                                <strong>{formatCurrency(Number(line.amount ?? (Number(line.quantity || 1) * Number(line.unit_amount ?? line.unitAmount ?? 0))))}</strong>
                              </div>
                            ))}
                          </div>
                        )}
                        {invoice.instalments?.length > 1 && (
                          <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px dashed #E2E8F0', fontSize: 12, color: '#475569' }}>
                            {invoice.instalments.map((part: any) => (
                              <div key={part.sequence} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0' }}>
                                <span>{part.label || `Instalment ${part.sequence}`} · due {String(part.due_date).slice(0, 10)}</span>
                                <span>{formatCurrency(Number(part.amount))} · {part.status}</span>
                              </div>
                            ))}
                          </div>
                        )}
                        {editingInvoiceId === invoice.id ? (
                          <div style={{ marginTop: 12, display: 'grid', gap: 8 }}>
                            {invoiceLinesDraft.map((line, index) => (
                              <div key={line.id || index} style={{ display: 'grid', gridTemplateColumns: 'minmax(160px,2fr) 90px 120px', gap: 8 }}>
                                <input className="kongila-input" aria-label="Invoice line description" value={line.description} onChange={e => setInvoiceLinesDraft(rows => rows.map((row, i) => i === index ? { ...row, description: e.target.value } : row))} />
                                <input className="kongila-input" aria-label="Quantity" type="number" min="0.01" step="0.01" value={line.quantity} onChange={e => setInvoiceLinesDraft(rows => rows.map((row, i) => i === index ? { ...row, quantity: e.target.value } : row))} />
                                <input className="kongila-input" aria-label="Unit amount" type="number" min="0" step="0.01" value={line.unit_amount} onChange={e => setInvoiceLinesDraft(rows => rows.map((row, i) => i === index ? { ...row, unit_amount: e.target.value } : row))} />
                              </div>
                            ))}
                            <div style={{ display: 'flex', gap: 8 }}>
                              <button disabled={invoiceActionBusy === invoice.id} onClick={() => saveInvoiceDraft(invoice.id)} className="btn-primary">Save invoice</button>
                              <button onClick={() => setEditingInvoiceId('')} className="btn-secondary">Cancel</button>
                            </div>
                          </div>
                        ) : canManageInvoices && String(invoice.status).toLowerCase() === 'draft' ? (
                          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                            <button className="btn-secondary" onClick={() => { setInvoiceLinesDraft(invoice.lines || []); setEditingInvoiceId(invoice.id); }}>Edit draft</button>
                            <button className="btn-primary" disabled={invoiceActionBusy === invoice.id} onClick={() => sendInvoiceDraft(invoice.id)}>
                              {invoiceActionBusy === invoice.id ? 'Sending…' : 'Send Kongila invoice'}
                            </button>
                          </div>
                        ) : null}
                      </div>
                    )) : (
                      <div style={{ background: '#F8FAFC', border: '1px dashed #CBD5E1', borderRadius: 10, padding: 16, fontSize: 13, color: '#475569', lineHeight: 1.6 }}>
                        Nothing has been invoiced against this contract yet.
                        {isSelectedPlacement
                          ? ' Prepare the direct hire invoice here when it is ready.'
                          : selectedLine === 'project'
                            ? ' A project is invoiced against its milestones, from the engagement.'
                            : ' Outsourcing and managed teams are invoiced monthly in arrears.'}
                      </div>
                    )}

                    <section style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 10, padding: 14, marginTop: 12 }}>
                      <h4 style={{ margin: '0 0 10px', color: '#14213D', fontSize: 13 }}>What this contract bills at</h4>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(120px,1fr))', gap: 10, fontSize: 12 }}>
                        <div><span style={{ display: 'block', color: '#64748B' }}>Agreed base</span><strong>{formatCurrency(selectedBaseAmount)}</strong></div>
                        <div><span style={{ display: 'block', color: '#64748B' }}>Client fee</span><strong>{selectedClientFeePct == null ? 'Not set' : `${(selectedClientFeePct * 100).toFixed(2).replace(/\.00$/, '')}%`}</strong></div>
                        <div><span style={{ display: 'block', color: '#64748B' }}>Client total</span><strong>{selectedClientFeePct == null ? 'Set the fee in Finance' : formatCurrency(selectedBaseAmount * (1 + selectedClientFeePct))}</strong></div>
                        {selectedLine !== 'placement' && <div><span style={{ display: 'block', color: '#64748B' }}>Candidate receives</span><strong>{selectedTalentPct == null ? 'Not set' : formatCurrency(selectedBaseAmount * (1 - selectedTalentPct))}</strong></div>}
                      </div>
                      {selectedLine !== 'placement' && selectedLine !== 'project' && <p style={{ margin: '10px 0 0', color: '#334155', fontSize: 12 }}><strong>Billing cadence:</strong> {(selectedContract.paymentSchedule || selectedContract.payment_schedule)?.serviceRecurring === false ? 'One invoice only' : `Monthly, on day ${(selectedContract.paymentSchedule || selectedContract.payment_schedule)?.billingDayOfMonth || 1}`}</p>}
                      <p style={{ margin: '10px 0 0', color: '#64748B', fontSize: 11 }}>
                        These were frozen onto the contract when it was generated, so a margin changed later does not reprice it.
                      </p>
                    </section>
                  </div>
                )}

                {/* Where each party's document has got to.

                    One status column could never say that the client has
                    had theirs for nine days without opening it while the
                    candidate signed on the day it arrived, which is the
                    only thing worth knowing when a signature is late. */}
                {docs && Array.isArray(docs.documents) && docs.documents.length > 0 && (
                  <section style={{ borderTop: '1px solid #E2E8F0', paddingTop: 16, marginTop: 4, marginBottom: 4 }}>
                    <div style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--text-muted)', marginBottom: 10 }}>
                      Signing
                    </div>

                    <div style={{ display: 'grid', gap: 8 }}>
                      {['client', 'talent'].map(audience => {
                        const row = docs.documents.find((entry: any) => entry.audience === audience);
                        const who = audience === 'talent' ? 'Candidate' : 'Client';
                        if (!row) {
                          return (
                            <div key={audience} style={{ padding: '10px 12px', borderRadius: 8, border: '1px dashed #E2E8F0', fontSize: 12.5, color: 'var(--text-muted)' }}>
                              {who} — no document was issued. Publish a {audience === 'talent' ? 'candidate' : 'client'} template for this service line, then generate again.
                            </div>
                          );
                        }

                        const state = String(row.status || 'draft');
                        const tone = state === 'signed' ? { bg: '#ECFDF5', fg: '#065F46', border: '#A7F3D0' }
                          : state === 'void' ? { bg: '#F1F5F9', fg: '#475569', border: '#CBD5E1' }
                          : state === 'viewed' ? { bg: '#EFF6FF', fg: '#1D4ED8', border: '#BFDBFE' }
                          : state === 'sent' ? { bg: '#FFFBEB', fg: '#92400E', border: '#FDE68A' }
                          : { bg: '#F8FAFC', fg: '#475569', border: '#E2E8F0' };

                        const when = (value: string | null) => value ? new Date(value).toLocaleDateString() : null;
                        const waiting = row.sentAt && state !== 'signed' && state !== 'void'
                          ? Math.max(0, Math.floor((Date.now() - new Date(row.sentAt).getTime()) / 86400000))
                          : null;

                        return (
                          <div key={audience} style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            gap: 12, flexWrap: 'wrap', padding: '10px 12px', borderRadius: 8,
                            background: tone.bg, border: `1px solid ${tone.border}`
                          }}>
                            <div style={{ minWidth: 190 }}>
                              <div style={{ fontWeight: 700, fontSize: 13, color: tone.fg }}>
                                {who} — {state === 'draft' ? 'not sent' : state}
                              </div>
                              <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 2 }}>
                                {state === 'draft' ? 'Generated, waiting to go out.'
                                  : state === 'void' ? (row.voidReason || 'Withdrawn.')
                                  : [
                                    when(row.sentAt) ? `sent ${when(row.sentAt)}` : null,
                                    when(row.viewedAt) ? `opened ${when(row.viewedAt)}` : null,
                                    when(row.signedAt) ? `signed ${when(row.signedAt)}` : null
                                  ].filter(Boolean).join(' · ')}
                                {waiting !== null && waiting >= 7 ? ` · ${waiting} days waiting` : ''}
                              </div>
                            </div>

                            {canSendDocuments && state !== 'signed' && state !== 'void' && (
                              <button
                                type="button"
                                onClick={() => sendDocument(audience as 'client' | 'talent')}
                                disabled={docBusy === audience}
                                className={state === 'draft' ? 'btn-primary' : 'btn-secondary'}
                                style={{ fontSize: 12, height: 32, padding: '0 14px', borderRadius: 8 }}
                              >
                                {docBusy === audience ? 'Sending…'
                                  : state === 'draft' ? `Send to the ${audience === 'talent' ? 'candidate' : 'client'}`
                                  : 'Chase it'}
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {docs.outstanding && (
                      <p style={{ margin: '10px 0 0', fontSize: 12, color: 'var(--text-secondary)' }}>
                        Waiting on {docs.outstanding}.
                      </p>
                    )}
                    {(docs.warnings || []).map((warning: string, index: number) => (
                      <p key={index} style={{ margin: '8px 0 0', fontSize: 12, color: '#92400E' }}>{warning}</p>
                    ))}
                  </section>
                )}

                {/* What to do next, and only that.

                    This was seven buttons shown at once, named for the
                    database rather than for the job: "Prepare placement
                    invoice & release", "Edit commercial terms", "Activate
                    engagement". An operator could not tell which one they
                    were supposed to press. There is almost always one next
                    step, so that one leads and the rest are secondary. */}
                {(() => {
                  const status = String(selectedContract.status || '').toLowerCase().replace(/[\s-]+/g, '_');
                  const canManage = permissions.includes('contracts.manage');
                  const awaitingSignature = ['pending_signatures', 'client_signed', 'talent_signed'].includes(status);

                  const currentPeriod = new Date().toISOString().slice(0, 7);
                  const currentPeriodHasInvoice = (detail?.invoices || []).some((invoice: any) =>
                    String(invoice.period || '') === currentPeriod && String(invoice.status).toLowerCase() !== 'void');
                  const canPrepareContractInvoice = isSelectedPlacement
                    ? !selectedContract.placementFeeInvoicedAt
                    : ['outsourcing', 'managed_workforce'].includes(selectedLine)
                      && status === 'active' && !currentPeriodHasInvoice;
                  const next =
                    (status === 'signed' || status === 'fully_signed')
                      ? { label: isSelectedPlacement ? 'Start the placement' : 'Start the engagement', run: () => setActivationContract(selectedContract) }
                    : null;

                  return (
                    <div style={{ borderTop: '1px solid #E2E8F0', paddingTop: 16, marginTop: 4 }}>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                        {canPrepareContractInvoice && canManageInvoices && (
                          <button onClick={() => handlePlacementActivation(selectedContract)} disabled={saving} className="btn-primary" style={{ fontSize: 13, height: 36, padding: '0 18px', borderRadius: 8 }}>
                            {saving ? 'Preparing invoice…' : isSelectedPlacement ? 'Prepare placement invoice' : 'Prepare monthly invoice'}
                          </button>
                        )}
                        {next && canManage && (
                          <button onClick={next.run} disabled={saving} className="btn-primary" style={{ fontSize: 13, height: 36, padding: '0 18px', borderRadius: 8 }}>
                            {next.label}
                          </button>
                        )}

                        {!['signed', 'fully_signed', 'active', 'completed', 'terminated', 'closed'].includes(status) && canManage && (
                          <button onClick={() => setTermsContract(selectedContract)} className="btn-secondary" style={{ fontSize: 12, height: 34, padding: '0 14px', borderRadius: 8 }}>
                            Change the rate or dates
                          </button>
                        )}

                        {awaitingSignature && canManage && (
                          <button onClick={() => setShowVoidModal(true)} className="btn-secondary" style={{ fontSize: 12, height: 34, padding: '0 14px', borderRadius: 8, color: '#EF4444', borderColor: '#FCA5A5' }}>
                            Void
                          </button>
                        )}
                      </div>

                      {selectedContract.placementFeeInvoicedAt && (
                        <p style={{ margin: '10px 0 0', fontSize: 12, color: '#166534' }}>
                          Placement invoice draft prepared{selectedContract.placementInvoiceId ? ` · ${selectedContract.placementInvoiceId}` : ''}.
                          Review and send it from the invoice panel.
                        </p>
                      )}
                      {status === 'active' && (
                        <p style={{ margin: '10px 0 0', fontSize: 12, color: '#64748B' }}>
                          This one is live. It is in Active Work now.
                        </p>
                      )}
                    </div>
                  );
                })()}

                {activationMessage && <p role="status" style={{ marginTop: 12, fontSize: 13, color: /not|could not|failed/i.test(activationMessage) ? '#B91C1C' : '#166534' }}>{activationMessage}</p>}
              </GlassCard>
            )}
          </div>

      {generateFor && (
        <GenerateContractModal
          offer={generateFor}
          offers={awaitingContract}
          onClose={() => setGenerateFor(null)}
          onGenerated={(result: any) => {
            if (result?.contract) setContracts([result.contract, ...contracts]);
            setGenerateFor(null);
            setActivationMessage(
              result?.warnings?.length
                ? result.warnings.join(' ')
                : 'Contract generated with draft signature documents. Prepare invoices separately when ready.'
            );
          }}
        />
      )}

      {activationContract && <EngagementActivationModal
        contract={activationContract}
        requests={requests}
        offers={offers}
        onClose={() => setActivationContract(null)}
        onActivated={(result: any) => {
          const status = result?.data?.status === 'active' ? 'active' : 'fully_signed';
          const updated = { ...activationContract, status, engagementId: result?.data?.assignment_id };
          setContracts(contracts.map((row: any) => row.id === activationContract.id ? updated : row));
          setSelectedContract(updated);
          setActivationContract(null);
          setActivationMessage(result?.warnings?.length ? result.warnings.join(' ') : 'Engagement activated. Billing and payroll now follow its service line and status.');
        }}
      />}
      {termsContract && <ContractTermsModal
        contract={termsContract}
        onClose={() => setTermsContract(null)}
        onSaved={(terms: any) => {
          const updated = { ...termsContract, ...terms, serviceType: terms.service_type, role: terms.role_title,
            roleTitle: terms.role_title, rateAmount: Number(terms.rate_amount), startDate: terms.start_date,
            placementFeeUsd: terms.placement_fee_usd, projectFeeUsd: terms.project_fee_usd };
          setContracts(contracts.map((row: any) => row.id === termsContract.id ? updated : row));
          setSelectedContract(updated); setTermsContract(null);
        }}
      />}

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

    </div>
  );
}
