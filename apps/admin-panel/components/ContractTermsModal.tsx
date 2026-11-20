import React, { useState } from 'react';
import { apiFetch } from '../lib/apiFetch';

const lines = ['Hire Talent', 'Outsource Talent', 'Managed Workforce', 'Project Execution'];
export default function ContractTermsModal({ contract, onClose, onSaved }: any) {
  const [serviceLine, setServiceLine] = useState(contract.serviceType || contract.role || 'Hire Talent');
  const [roleTitle, setRoleTitle] = useState(contract.roleTitle || contract.role || '');
  const [rateAmount, setRateAmount] = useState(String(contract.rateAmount || contract.salary || ''));
  const [rateType, setRateType] = useState(contract.rateType || 'Monthly');
  const [startDate, setStartDate] = useState(contract.startDate || '');
  const [endDate, setEndDate] = useState(contract.endDate || '');
  const [placementFeeUsd, setPlacementFeeUsd] = useState(String(contract.placementFeeUsd || ''));
  const [projectFeeUsd, setProjectFeeUsd] = useState(String(contract.projectFeeUsd || ''));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const style: React.CSSProperties = { width: '100%', padding: '10px 12px', border: '1px solid #CBD5E1', borderRadius: 8, font: 'inherit' };
  const field = (title: string, control: React.ReactNode) => <label style={{ display: 'grid', gap: 6, fontSize: 13, fontWeight: 600, color: '#334155' }}>{title}{control}</label>;
  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); setError(''); setBusy(true);
    try {
      const response = await apiFetch('/api/contracts/terms', { method: 'POST', body: JSON.stringify({
        contractId: contract.id, serviceLine, roleTitle, rateAmount, rateType, startDate, endDate,
        placementFeeUsd: serviceLine === 'Hire Talent' ? placementFeeUsd : null,
        projectFeeUsd: serviceLine === 'Project Execution' ? projectFeeUsd : null
      }) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) { setError(body.error || 'Terms were not saved.'); setBusy(false); return; }
      onSaved(body);
    } catch (e: any) { setError(e?.message || 'Terms were not saved.'); }
    setBusy(false);
  };
  return <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget && !busy) onClose(); }}><div className="modal-content" role="dialog" aria-modal="true" aria-labelledby="terms-title" style={{ maxWidth: 560, width: '94%', padding: 28 }}>
    <h2 id="terms-title" style={{ margin: 0, color: '#14213D' }}>Commercial contract terms</h2><p style={{ margin: '6px 0 18px', color: '#64748B', fontSize: 14 }}>Set and confirm the terms before either party signs.</p>
    <form onSubmit={submit} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
      {field('Service line', <select value={serviceLine} onChange={e => setServiceLine(e.target.value)} style={style}>{lines.map(x => <option key={x}>{x}</option>)}</select>)}
      {field('Role / function', <input required value={roleTitle} onChange={e => setRoleTitle(e.target.value)} style={style} />)}
      {field(rateType === 'Hourly' ? 'Hourly rate' : 'Monthly rate', <input required type="number" min="0.01" step="0.01" value={rateAmount} onChange={e => setRateAmount(e.target.value)} style={style} />)}
      {field('Rate type', <select value={rateType} onChange={e => setRateType(e.target.value)} style={style}><option>Monthly</option><option>Hourly</option></select>)}
      {field('Planned start date', <input required type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={style} />)}
      {field('End date (if fixed term)', <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} style={style} />)}
      {serviceLine === 'Hire Talent' && field('One-time placement fee (USD)', <input required type="number" min="0.01" step="0.01" value={placementFeeUsd} onChange={e => setPlacementFeeUsd(e.target.value)} style={style} />)}
      {serviceLine === 'Project Execution' && field('Agreed project fee (USD)', <input required type="number" min="0.01" step="0.01" value={projectFeeUsd} onChange={e => setProjectFeeUsd(e.target.value)} style={style} />)}
      {error && <p role="alert" style={{ color: '#B91C1C', gridColumn: '1/-1', margin: 0 }}>{error}</p>}
      <div style={{ gridColumn: '1/-1', display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}><button type="button" className="btn-secondary" onClick={onClose} disabled={busy}>Cancel</button><button className="btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save commercial terms'}</button></div>
    </form>
  </div></div>;
}
