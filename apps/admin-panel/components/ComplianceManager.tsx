import React, { useEffect, useState } from 'react';
import { apiFetch } from '../lib/apiFetch';
import { uploadFile } from '../lib/uploadFile';
import { GlassCard, Chip, confirmInApp } from '@kongila/ui';
import { formatDate } from '@kongila/utils';

export default function ComplianceManager({
  documents,
  talents,
  auditLogs,
  setDocuments,
  setAuditLogs,
  openCreate = false,
  onCloseCreate
}: any) {
  const [showDocModal, setShowDocModal] = useState(false);
  const [docForm, setDocForm] = useState<any>({ id: '', name: '', type: 'NDA', isMandatory: true, description: '', fileUrl: '', fileName: '', file: null });
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [liveDocuments, setLiveDocuments] = useState<any[]>(documents || []);

  useEffect(() => {
    if (openCreate) {
      setDocForm({ id: '', name: '', type: 'NDA', isMandatory: true, description: '', fileUrl: '', fileName: '', file: null });
      setShowDocModal(true);
    }
  }, [openCreate]);

  useEffect(() => {
    let active = true;
    apiFetch('/api/compliance').then(async response => {
      const payload = await response.json().catch(() => []);
      if (!response.ok) throw new Error(payload?.error || 'Could not load compliance documents.');
      return payload;
    }).then((rows: any[]) => {
      if (!active || !Array.isArray(rows)) return;
      setLiveDocuments(rows);
      setDocuments((current: any[]) => {
        const others = (current || []).filter((doc: any) => doc.userId);
        return [...others, ...rows];
      });
    }).catch((error: any) => {
      if (active) setFeedback({ type: 'error', text: error.message || 'Could not load compliance documents.' });
    });
    return () => { active = false; };
  }, []);
  
  // Strict audit modal
  const [showAuditModal, setShowAuditModal] = useState<any | null>(null);

  // Vetted talents are those whose vettingStage is 'Vetted' or 'Vetted & Available'
  const applicableTalents = talents || [];

  // Filter compliance documents (universal ones)
  const complianceDocs = (liveDocuments || []).filter((d: any) => !d.userId && !d.isHidden);

  const handleSaveDoc = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    
    const isNew = !docForm.id;

    // Through the server. This used to rewrite the local documents array
    // and post all of it through /api/db, which upserts every document in
    // the payload, and stamp lastUpdatedBy as the literal string 'Super
    // Admin' whoever was signed in. The audit entry went the same way, to
    // a table that denies browser writes.
    try {
      let uploadedFile = null;
      if (docForm.file) uploadedFile = await uploadFile('compliance_document', docForm.file);
      if (docForm.isMandatory && !uploadedFile?.url && !docForm.fileUrl) {
        throw new Error('Upload the PDF that talents need to review and sign.');
      }
      const res = await apiFetch('/api/compliance', {
        method: isNew ? 'POST' : 'PUT',
        body: JSON.stringify({
          id: docForm.id || undefined,
          name: docForm.name,
          type: docForm.type,
          isMandatory: docForm.isMandatory,
          description: docForm.description,
          fileUrl: uploadedFile?.url || docForm.fileUrl,
          fileName: uploadedFile?.name || docForm.fileName,
          fileSizeBytes: uploadedFile?.size
        })
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok) {
        setFeedback({ type: 'error', text: result?.error || 'That document was not saved.' });
        setSaving(false);
        return;
      }

      setDocuments(isNew
        ? [result, ...documents]
        : documents.map((d: any) => d.id === docForm.id ? { ...d, ...result } : d));
      setLiveDocuments((current: any[]) => isNew ? [result, ...current] : current.map((d: any) => d.id === docForm.id ? { ...d, ...result } : d));
      setFeedback({ type: 'success', text: isNew ? 'Compliance document added.' : 'Compliance document updated.' });
      setShowDocModal(false);
      onCloseCreate?.();
    } catch (e: any) {
      console.error('Failed to save compliance document', e);
      setFeedback({ type: 'error', text: e?.message || 'That document was not saved.' });
    }

    setSaving(false);
  };

  const handleHideDoc = async (docId: string) => {
    if (!await confirmInApp('Are you sure you want to hide this compliance document? It will no longer be mandatory for talents.', 'Hide compliance document')) return;
    setSaving(true);

    // The hide path in the route was unreachable: there were two
    // `if (req.method === 'PUT')` blocks and this one was the second. It
    // never ran, so nothing was ever hidden in the database.
    try {
      const res = await apiFetch(`/api/compliance?id=${encodeURIComponent(docId)}`, {
        method: 'DELETE'
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok) {
        setFeedback({ type: 'error', text: result?.error || 'That document was not hidden.' });
        setSaving(false);
        return;
      }
      setDocuments(documents.map((d: any) => d.id === docId ? { ...d, isHidden: true } : d));
      setLiveDocuments((current: any[]) => current.map((d: any) => d.id === docId ? { ...d, isHidden: true } : d));
      setFeedback({ type: 'success', text: 'The document is no longer assigned to talents.' });
    } catch (e: any) {
      console.error('Failed to hide compliance document', e);
      setFeedback({ type: 'error', text: e?.message || 'That document was not hidden.' });
    }

    setSaving(false);
  };

  const [expandedDoc, setExpandedDoc] = useState<string | null>(null);

  return (
    <div>
      {feedback && <div role="status" style={{ marginBottom: 16, padding: '12px 16px', borderRadius: 10, background: feedback.type === 'error' ? '#FEF2F2' : '#ECFDF5', color: feedback.type === 'error' ? '#B91C1C' : '#047857', fontSize: 13 }}>{feedback.text}<button onClick={() => setFeedback(null)} aria-label="Dismiss message" style={{ float: 'right', border: 0, background: 'transparent', color: 'inherit', cursor: 'pointer' }}>×</button></div>}
      <div className="page-header">
        <div>
          <h1 className="page-title">Compliance Documents</h1>
          <p className="page-subtitle">Publish documents for talent review, collect signatures, and track each talent’s compliance status.</p>
        </div>
        <button onClick={() => { setDocForm({ id: '', name: '', type: 'NDA', isMandatory: true, description: '', fileUrl: '', fileName: '', file: null }); setShowDocModal(true); }} className="btn-primary" style={{ fontSize: '13px', height: '40px', padding: '0 18px', borderRadius: '10px' }}>+ New Compliance Doc</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '24px' }}>
        <GlassCard>
          <div style={{ marginBottom: '16px', fontSize: '14px', fontWeight: 600, display: 'flex', justifyContent: 'space-between' }}>
            <span>Talent Documents & Signature Tracking</span>
            <span style={{ color: 'var(--text-secondary)' }}>Talent accounts: {applicableTalents.length}</span>
          </div>

          <div className="table-container">
            <table className="custom-table">
              <thead><tr>{['Document Name', 'Type', 'Signature Progress', 'Last Updated', 'Actions'].map(h => <th key={h}>{h}</th>)}</tr></thead>
              <tbody>
                {complianceDocs.length === 0 ? (
                <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '40px' }}>No compliance documents found. Add a document and upload its PDF to make it available for signing.</td></tr>
                ) : complianceDocs.map((doc: any) => {
                  const hasTalentSigned = (talent: any) => (doc.signedByTalentIds || []).some((id: any) => String(id) === String(talent.id));
                  const signedCount = applicableTalents.filter(hasTalentSigned).length;
                  const totalCount = applicableTalents.length;
                  const percent = totalCount > 0 ? Math.round((signedCount / totalCount) * 100) : 0;
                  const isExpanded = expandedDoc === doc.id;

                  return (
                    <React.Fragment key={doc.id}>
                      <tr style={{ background: isExpanded ? 'var(--bg-tertiary)' : undefined }}>
                        <td style={{ fontWeight: 600, fontSize: '13px' }}>{doc.name}<div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 400 }}>{doc.fileName || 'No PDF uploaded'} · {doc.isMandatory ? 'Mandatory' : 'Optional'}</div></td>
                        <td><Chip label={doc.type} /></td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{ flex: 1, height: '6px', background: 'var(--bg-elevated)', borderRadius: '999px', minWidth: '100px' }}>
                              <div style={{ width: `${percent}%`, height: '100%', background: percent === 100 ? '#10B981' : '#F59E0B', borderRadius: '999px' }} />
                            </div>
                            <span style={{ fontSize: '12px', fontWeight: 600 }}>{signedCount} / {totalCount}</span>
                          </div>
                        </td>
                        <td>
                          <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{doc.lastUpdatedAt ? formatDate(doc.lastUpdatedAt) : '—'}</div>
                          <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>by {doc.lastUpdatedBy || 'System'}</div>
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <button onClick={() => setExpandedDoc(isExpanded ? null : doc.id)} className="btn-secondary" style={{ padding: '4px 8px', fontSize: '11px', borderRadius: '6px' }}>{isExpanded ? 'Hide Details' : 'View Talents'}</button>
                            <button onClick={() => { setDocForm({ ...doc, file: null }); setShowDocModal(true); }} className="btn-secondary" style={{ padding: '4px 8px', fontSize: '11px', borderRadius: '6px' }}>Edit</button>
                            {doc.fileUrl && <a href={doc.fileUrl} target="_blank" rel="noreferrer" className="btn-secondary" style={{ padding: '4px 8px', fontSize: '11px', borderRadius: '6px', textDecoration: 'none' }}>View PDF</a>}
                            <button onClick={() => setShowAuditModal(doc)} className="btn-secondary" style={{ padding: '4px 8px', fontSize: '11px', borderRadius: '6px' }}>Audit</button>
                            <button onClick={() => handleHideDoc(doc.id)} className="btn-secondary" style={{ padding: '4px 8px', fontSize: '11px', borderRadius: '6px', color: '#EF4444' }}>Delete</button>
                          </div>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr>
                          <td colSpan={5} style={{ padding: 0, borderBottom: '1px solid var(--border-glass)' }}>
                            <div style={{ padding: '16px 24px', background: 'var(--bg-elevated)' }}>
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px' }}>
                                <div>
                                  <h4 style={{ fontSize: '12px', fontWeight: 700, color: '#10B981', marginBottom: '8px', borderBottom: '1px solid #10B981', paddingBottom: '4px' }}>Signed ({signedCount})</h4>
                                  <div style={{ maxHeight: '150px', overflowY: 'auto' }}>
                                    {applicableTalents.filter(hasTalentSigned).map((t: any) => (
                                      <div key={t.id} style={{ fontSize: '12px', padding: '4px 0' }}>{t.name} <span style={{ color: 'var(--text-muted)' }}>({t.title})</span></div>
                                    ))}
                                    {signedCount === 0 && <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>None</div>}
                                  </div>
                                </div>
                                <div>
                                  <h4 style={{ fontSize: '12px', fontWeight: 700, color: '#EF4444', marginBottom: '8px', borderBottom: '1px solid #EF4444', paddingBottom: '4px' }}>Pending ({totalCount - signedCount})</h4>
                                  <div style={{ maxHeight: '150px', overflowY: 'auto' }}>
                                    {applicableTalents.filter((t: any) => !hasTalentSigned(t)).map((t: any) => (
                                      <div key={t.id} style={{ fontSize: '12px', padding: '4px 0', display: 'flex', justifyContent: 'space-between' }}>
                                        <span>{t.name}</span>
                                        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>Pending</span>
                                      </div>
                                    ))}
                                    {(totalCount - signedCount) === 0 && <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>All talents have signed this document.</div>}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </GlassCard>
      </div>

      {showDocModal && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setShowDocModal(false); }}>
          <div className="modal-content" style={{ padding: '32px', maxWidth: '520px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '24px' }}>{docForm.id ? 'Edit Compliance Document' : 'Create Compliance Document'}</h2>
            <form onSubmit={handleSaveDoc}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <label className="form-label">Document Type</label>
                  <select className="kongila-input" value={docForm.type} onChange={e => setDocForm({ ...docForm, type: e.target.value })} required style={{ width: '100%', padding: '10px', borderRadius: '8px' }}>
                    <option value="NDA">Non-Disclosure Agreement (NDA)</option>
                    <option value="agreement">Independent Contractor Agreement</option>
                    <option value="IT_Ethics_Policy">Code of Ethics & Conduct</option>
                    <option value="certification">Other compliance document</option>
                  </select>
                </div>
                <div>
                  <label className="form-label">Document Name</label>
                  <input type="text" className="kongila-input" value={docForm.name} onChange={e => setDocForm({ ...docForm, name: e.target.value })} placeholder="e.g. Standard NDA 2024" required style={{ width: '100%', padding: '10px', borderRadius: '8px' }} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input type="checkbox" checked={docForm.isMandatory} onChange={e => setDocForm({ ...docForm, isMandatory: e.target.checked })} style={{ accentColor: 'var(--kongila-blue)' }} />
                  <span style={{ fontSize: '13px', fontWeight: 600 }}>Mandatory for all talents</span>
                </div>
                <div>
                  <label className="form-label">Document PDF {docForm.isMandatory ? '(required)' : '(optional)'}</label>
                  <input type="file" accept="application/pdf,.pdf" onChange={e => setDocForm({ ...docForm, file: e.target.files?.[0] || null })} />
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 5 }}>{docForm.file?.name || docForm.fileName || 'PDF only · up to 15 MB'}</div>
                </div>
                <div>
                  <label className="form-label">Instructions (optional)</label>
                  <textarea className="kongila-input" value={docForm.description || ''} onChange={e => setDocForm({ ...docForm, description: e.target.value })} rows={3} style={{ width: '100%', padding: '10px', borderRadius: '8px' }} />
                </div>
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)', background: 'var(--bg-tertiary)', padding: '12px', borderRadius: '8px' }}>
                  Mandatory documents appear in each talent’s Documents area. They can review the PDF and sign it there; offer acceptance remains blocked until all mandatory documents are signed.
                </p>
                <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
          <button type="submit" className="btn-primary" style={{ flex: 1 }} disabled={saving}>{saving ? (docForm.file ? 'Uploading and saving…' : 'Saving…') : 'Save Document'}</button>
                  <button type="button" onClick={() => { setShowDocModal(false); onCloseCreate?.(); }} className="btn-secondary" style={{ flex: 1 }}>Cancel</button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {showAuditModal && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setShowAuditModal(null); }}>
          <div className="modal-content" style={{ padding: '32px', maxWidth: '600px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 700 }}>Audit Logs: {showAuditModal.name}</h2>
              <button onClick={() => setShowAuditModal(null)} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: 'var(--text-secondary)' }}>✕</button>
            </div>
            <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
              {auditLogs.filter((log: any) => String(log.details || '').includes(showAuditModal.name) || String(log.details || '').includes(showAuditModal.id)).length === 0 ? (
                <div style={{ color: 'var(--text-muted)', fontSize: '13px' }}>No audit logs found for this document.</div>
              ) : (
                auditLogs.filter((log: any) => String(log.details || '').includes(showAuditModal.name) || String(log.details || '').includes(showAuditModal.id)).map((log: any) => (
                  <div key={log.id} style={{ padding: '12px', borderBottom: '1px solid var(--border-glass)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span style={{ fontWeight: 600, fontSize: '13px' }}>{log.action}</span>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{formatDate(log.timestamp)}</span>
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{log.details}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>Actor: {log.actor}</div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
