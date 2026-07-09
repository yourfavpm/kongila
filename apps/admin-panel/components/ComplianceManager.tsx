import React, { useState } from 'react';
import { GlassCard, Chip } from '@kongila/ui';
import { formatDate } from '@kongila/utils';

export default function ComplianceManager({
  documents,
  talents,
  auditLogs,
  saveToDb,
  setDocuments,
  setAuditLogs
}: any) {
  const [showDocModal, setShowDocModal] = useState(false);
  const [docForm, setDocForm] = useState({ id: '', name: '', type: 'NDA', isMandatory: true });
  const [saving, setSaving] = useState(false);
  
  // Strict audit modal
  const [showAuditModal, setShowAuditModal] = useState<any | null>(null);

  // Vetted talents are those whose vettingStage is 'Vetted' or 'Vetted & Available'
  const vettedTalents = talents.filter((t: any) => t.vettingStatus === 'Vetted' || t.vettingStage === 'Vetted & Available' || t.vettingStage === 'Vetted');

  // Filter compliance documents (universal ones)
  const complianceDocs = documents.filter((d: any) => !d.userId && d.isMandatory && !d.isHidden);

  const handleSaveDoc = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    
    const isNew = !docForm.id;
    let newDoc: any;
    let updated: any;

    if (isNew) {
      newDoc = { 
        ...docForm, 
        id: `cdoc_${Date.now()}`, 
        uploadedAt: new Date().toISOString(), 
        lastUpdatedAt: new Date().toISOString(),
        lastUpdatedBy: 'Super Admin',
        signedByTalentIds: []
      };
      updated = [newDoc, ...documents];
    } else {
      newDoc = {
        ...docForm,
        lastUpdatedAt: new Date().toISOString(),
        lastUpdatedBy: 'Super Admin'
      };
      updated = documents.map((d: any) => d.id === docForm.id ? { ...d, ...newDoc } : d);
    }

    const newLog = {
      id: `audit_${Date.now()}`, actor: 'Super Admin', action: isNew ? 'Create Compliance Document' : 'Update Compliance Document',
      details: `${newDoc.name} (${newDoc.type})`, timestamp: new Date().toISOString()
    };

    setDocuments(updated);
    setAuditLogs([newLog, ...auditLogs]);
    setShowDocModal(false);
    
    await saveToDb({ documents: updated, auditLogs: [newLog, ...auditLogs] });
    setSaving(false);
  };

  const handleHideDoc = async (docId: string) => {
    if (!confirm('Are you sure you want to hide this compliance document? It will no longer be mandatory for talents.')) return;
    setSaving(true);
    const updated = documents.map((d: any) => d.id === docId ? { ...d, isHidden: true, lastUpdatedAt: new Date().toISOString(), lastUpdatedBy: 'Super Admin' } : d);
    
    const newLog = {
      id: `audit_${Date.now()}`, actor: 'Super Admin', action: 'Hide Compliance Document',
      details: `Document ${docId} hidden`, timestamp: new Date().toISOString()
    };

    setDocuments(updated);
    setAuditLogs([newLog, ...auditLogs]);
    await saveToDb({ documents: updated, auditLogs: [newLog, ...auditLogs] });
    setSaving(false);
  };

  const [expandedDoc, setExpandedDoc] = useState<string | null>(null);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Compliance Documents</h1>
          <p className="page-subtitle">Strict tracking of universal mandatory documents for vetted talents.</p>
        </div>
        <button onClick={() => { setDocForm({ id: '', name: '', type: 'NDA', isMandatory: true }); setShowDocModal(true); }} className="btn-primary" style={{ fontSize: '13px', height: '40px', padding: '0 18px', borderRadius: '10px' }}>+ New Compliance Doc</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '24px' }}>
        <GlassCard>
          <div style={{ marginBottom: '16px', fontSize: '14px', fontWeight: 600, display: 'flex', justifyContent: 'space-between' }}>
            <span>Universal Documents Tracking</span>
            <span style={{ color: 'var(--text-secondary)' }}>Total Vetted Talents: {vettedTalents.length}</span>
          </div>

          <div className="table-container">
            <table className="custom-table">
              <thead><tr>{['Document Name', 'Type', 'Signature Progress', 'Last Updated', 'Actions'].map(h => <th key={h}>{h}</th>)}</tr></thead>
              <tbody>
                {complianceDocs.length === 0 ? (
                  <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '40px' }}>No mandatory compliance documents found.</td></tr>
                ) : complianceDocs.map((doc: any) => {
                  const signedCount = doc.signedByTalentIds?.length || 0;
                  const totalCount = vettedTalents.length;
                  const percent = totalCount > 0 ? Math.round((signedCount / totalCount) * 100) : 0;
                  const isExpanded = expandedDoc === doc.id;

                  return (
                    <React.Fragment key={doc.id}>
                      <tr style={{ background: isExpanded ? 'var(--bg-tertiary)' : undefined }}>
                        <td style={{ fontWeight: 600, fontSize: '13px' }}>{doc.name}</td>
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
                            <button onClick={() => { setDocForm(doc); setShowDocModal(true); }} className="btn-secondary" style={{ padding: '4px 8px', fontSize: '11px', borderRadius: '6px' }}>Edit</button>
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
                                    {vettedTalents.filter((t: any) => doc.signedByTalentIds?.includes(t.id)).map((t: any) => (
                                      <div key={t.id} style={{ fontSize: '12px', padding: '4px 0' }}>{t.name} <span style={{ color: 'var(--text-muted)' }}>({t.title})</span></div>
                                    ))}
                                    {signedCount === 0 && <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>None</div>}
                                  </div>
                                </div>
                                <div>
                                  <h4 style={{ fontSize: '12px', fontWeight: 700, color: '#EF4444', marginBottom: '8px', borderBottom: '1px solid #EF4444', paddingBottom: '4px' }}>Pending ({totalCount - signedCount})</h4>
                                  <div style={{ maxHeight: '150px', overflowY: 'auto' }}>
                                    {vettedTalents.filter((t: any) => !doc.signedByTalentIds?.includes(t.id)).map((t: any) => (
                                      <div key={t.id} style={{ fontSize: '12px', padding: '4px 0', display: 'flex', justifyContent: 'space-between' }}>
                                        <span>{t.name}</span>
                                        <button onClick={() => alert(`Reminder sent to ${t.name}`)} style={{ background: 'none', border: '1px solid var(--border-glass)', borderRadius: '4px', fontSize: '10px', color: 'var(--text-secondary)', cursor: 'pointer' }}>Remind</button>
                                      </div>
                                    ))}
                                    {(totalCount - signedCount) === 0 && <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>All vetted talents have signed!</div>}
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
                    <option value="DPA">Data Privacy Addendum (DPA)</option>
                    <option value="IT_Ethics_Policy">Code of Ethics & Conduct</option>
                  </select>
                </div>
                <div>
                  <label className="form-label">Document Name</label>
                  <input type="text" className="kongila-input" value={docForm.name} onChange={e => setDocForm({ ...docForm, name: e.target.value })} placeholder="e.g. Standard NDA 2024" required style={{ width: '100%', padding: '10px', borderRadius: '8px' }} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input type="checkbox" checked={docForm.isMandatory} disabled style={{ accentColor: 'var(--kongila-blue)' }} />
                  <span style={{ fontSize: '13px', fontWeight: 600 }}>Mandatory for all vetted talents</span>
                </div>
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)', background: 'var(--bg-tertiary)', padding: '12px', borderRadius: '8px' }}>
                  When created, this document will instantly appear in the dashboard of all vetted talents as "Pending Signature". They will not be assignable until signed.
                </p>
                <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
                  <button type="submit" className="btn-primary" style={{ flex: 1 }} disabled={saving}>{saving ? 'Saving...' : 'Save Document'}</button>
                  <button type="button" onClick={() => setShowDocModal(false)} className="btn-secondary" style={{ flex: 1 }}>Cancel</button>
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
              {auditLogs.filter((log: any) => log.details.includes(showAuditModal.name) || log.details.includes(showAuditModal.id)).length === 0 ? (
                <div style={{ color: 'var(--text-muted)', fontSize: '13px' }}>No audit logs found for this document.</div>
              ) : (
                auditLogs.filter((log: any) => log.details.includes(showAuditModal.name) || log.details.includes(showAuditModal.id)).map((log: any) => (
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
