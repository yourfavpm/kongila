import React, { useMemo, useState } from 'react';
import { apiFetch } from '../lib/apiFetch';

const lines = [
  ['placement', 'Direct hire / placement'],
  ['outsourcing', 'Talent outsourcing'],
  ['managed_workforce', 'Managed workforce'],
  ['project', 'Project execution']
];

export default function EngagementActivationModal({ contract, requests = [], offers = [], onClose, onActivated }: any) {
  const intake = useMemo(() => {
    const offer = offers.find((row: any) => String(row.id) === String(contract.offerId || contract.offer_id));
    const request = requests.find((row: any) => [row.id, row.sourceId, row.requestId].some((id: any) => id && String(id) === String(offer?.request_id)));
    return request?.payload || request || {};
  }, [contract, offers, requests]);
  const linkedOffer = offers.find((row: any) => String(row.id) === String(contract.offerId || contract.offer_id));
  const initialLine = useMemo(() => {
    const value = String(contract.serviceType || contract.service_type || contract.role || '').toLowerCase();
    if (value.includes('outsource')) return 'outsourcing';
    if (value.includes('managed')) return 'managed_workforce';
    if (value.includes('project')) return 'project';
    return 'placement';
  }, [contract]);
  const [serviceLine, setServiceLine] = useState(initialLine);
  const [managementMode, setManagementMode] = useState(() => {
    const supervision = String(intake.supervisionLevel || '').toLowerCase();
    if (supervision.includes('kongila')) return 'kongila_managed';
    if (supervision.includes('hybrid')) return 'hybrid';
    return 'client_managed';
  });
  const [supervisorEmail, setSupervisorEmail] = useState('');
  const [startDate, setStartDate] = useState(contract.startDate || '');
  const [workingPattern, setWorkingPattern] = useState(intake.workingPattern || intake.workSchedule || intake.preferredWorkHours || '');
  const [checks, setChecks] = useState({ compliance_cleared: false, tools_access_ready: false, introduction_booked: false });
  const [premium, setPremium] = useState('');
  const [groupName, setGroupName] = useState(contract.role || 'Managed team');
  const [coverageType, setCoverageType] = useState(() => {
    const coverage = String(intake.coverageType || '').toLowerCase();
    if (coverage.includes('24')) return '24_7';
    if (coverage.includes('shift')) return 'shifts';
    return 'business_hours';
  });
  const [project, setProject] = useState({ name: intake.projectName || contract.roleTitle || contract.role || '', description: intake.projectDescription || '', deadline: intake.projectDeadline || '' });
  const [milestones, setMilestones] = useState([{ title: '', description: '', sequence: 1, amountUsd: '', dueDate: '' }]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const updateMilestone = (index: number, key: string, value: string) => setMilestones(current => current.map((item: any, i) => i === index ? { ...item, [key]: key === 'amountUsd' ? value : value } : item));
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setError('');
    const body: any = {
      contractId: contract.id, serviceLine,
      managementMode: serviceLine === 'managed_workforce' ? 'kongila_managed' : managementMode,
      supervisorId: supervisorEmail || null,
      startDate, workingPattern, activationChecks: checks, requestId: linkedOffer?.request_id || linkedOffer?.requestId || null,
      groupName, coverageType,
      managementPremiumPct: premium ? Number(premium) : null
    };
    if (serviceLine === 'project') {
      body.project = project;
      body.milestones = milestones.map((m: any, index: number) => ({ ...m, sequence: index + 1, amountUsd: Number(m.amountUsd) }));
    }
    try {
      const response = await apiFetch('/api/engagements', { method: 'POST', body: JSON.stringify(body) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) { setError(result.error || 'The engagement could not be activated.'); setBusy(false); return; }
      onActivated(result);
    } catch (e: any) { setError(e?.message || 'The engagement could not be activated.'); }
    setBusy(false);
  };

  const field = (label: string, control: React.ReactNode) => <label style={{ display: 'grid', gap: 6, color: '#334155', fontSize: 13, fontWeight: 600 }}>{label}{control}</label>;
  const inputStyle: React.CSSProperties = { width: '100%', padding: '10px 12px', border: '1px solid #CBD5E1', borderRadius: 8, background: 'white', color: '#14213D', font: 'inherit' };
  return <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget && !busy) onClose(); }}>
    <div className="modal-content" role="dialog" aria-modal="true" aria-labelledby="activate-engagement-title" style={{ maxWidth: 720, width: '94%', maxHeight: '90vh', overflowY: 'auto', padding: 28 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: 16 }}>
        <div><div style={{ color: '#1455C0', fontSize: 11, fontWeight: 800, letterSpacing: '.12em' }}>CONTRACT ACTIVATION</div><h2 id="activate-engagement-title" style={{ margin: '6px 0', color: '#14213D' }}>Confirm the engagement</h2><p style={{ margin: 0, color: '#64748B', fontSize: 14 }}>A signed contract does not start work on its own. Confirm operating responsibility, start date and readiness.</p></div>
        <button type="button" onClick={onClose} disabled={busy} aria-label="Close" className="btn-secondary">×</button>
      </div>
      <form onSubmit={submit} style={{ marginTop: 22 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(230px,1fr))', gap: 14 }}>
          {field('Service line', <select value={serviceLine} onChange={e => setServiceLine(e.target.value)} style={inputStyle}>{lines.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>)}
          {field('Confirmed start date', <input required type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={inputStyle} />)}
          {field('Working pattern', <input value={workingPattern} onChange={e => setWorkingPattern(e.target.value)} placeholder="e.g. 9am–5pm, weekdays" style={inputStyle} />)}
        </div>
        {serviceLine !== 'placement' && <>
          <div style={{ marginTop: 18, display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(230px,1fr))', gap: 14 }}>
            {serviceLine === 'managed_workforce'
              ? <div style={{ padding: 12, borderRadius: 8, background: '#EFF6FF', color: '#1E3A8A', fontSize: 13 }}>Kongila operates the managed function. Assign the operations lead responsible for its day-to-day delivery.</div>
              : field('Who directs day-to-day work?', <select value={managementMode} onChange={e => setManagementMode(e.target.value)} style={inputStyle}><option value="client_managed">Client managed</option><option value="kongila_managed">Kongila managed</option><option value="hybrid">Hybrid supervision</option></select>)}
            {(managementMode === 'kongila_managed' || serviceLine === 'managed_workforce') && field('Kongila supervisor / operations lead work email', <input required type="email" value={supervisorEmail} onChange={e => setSupervisorEmail(e.target.value)} style={inputStyle} />)}
            {serviceLine === 'outsourcing' && managementMode === 'kongila_managed' && field('Additional supervision fee', <select required value={premium} onChange={e => setPremium(e.target.value)} style={inputStyle}><option value="">Select agreed rate</option><option value="0.10">10%</option><option value="0.15">15%</option><option value="0.20">20%</option></select>)}
          </div>
          <fieldset style={{ border: '1px solid #E2E8F0', borderRadius: 10, margin: '20px 0', padding: 16 }}><legend style={{ padding: '0 6px', color: '#14213D', fontWeight: 700 }}>Readiness checklist</legend>
            {([['compliance_cleared','Compliance documents cleared'],['tools_access_ready','Tools and access are ready'],['introduction_booked','Introduction call booked']] as const).map(([key,label]) => <label key={key} style={{ display: 'flex', gap: 10, alignItems: 'center', margin: '9px 0', color: '#475569', fontSize: 14 }}><input type="checkbox" checked={checks[key]} onChange={e => setChecks({ ...checks, [key]: e.target.checked })} />{label}</label>)}
          </fieldset>
        </>}
        {serviceLine === 'managed_workforce' && <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(230px,1fr))', gap: 14, marginBottom: 16 }}>{field('Managed team / function', <input required value={groupName} onChange={e => setGroupName(e.target.value)} style={inputStyle} />)}{field('Agreed coverage model', <select value={coverageType} onChange={e => setCoverageType(e.target.value)} style={inputStyle}><option value="business_hours">Business hours</option><option value="24_7">24/7</option><option value="shifts">Shifts</option></select>)}</div>}
        {serviceLine === 'project' && <section style={{ borderTop: '1px solid #E2E8F0', paddingTop: 18 }}><h3 style={{ color: '#14213D', margin: '0 0 12px' }}>Project and billing milestones</h3><div style={{ display: 'grid', gap: 12 }}>{field('Project name', <input required value={project.name} onChange={e => setProject({ ...project, name: e.target.value })} style={inputStyle} />)}{field('Scope summary', <textarea value={project.description} onChange={e => setProject({ ...project, description: e.target.value })} rows={2} style={inputStyle} />)}{field('Target deadline', <input type="date" value={project.deadline} onChange={e => setProject({ ...project, deadline: e.target.value })} style={inputStyle} />)}</div>
          {milestones.map((m: any, index: number) => <div key={index} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 10, marginTop: 12 }}>{field(`Milestone ${index + 1}`, <input required value={m.title} onChange={e => updateMilestone(index,'title',e.target.value)} style={inputStyle} />)}{field('Amount (USD)', <input required type="number" min="0.01" step="0.01" value={m.amountUsd} onChange={e => updateMilestone(index,'amountUsd',e.target.value)} style={inputStyle} />)}{field('Due date', <input type="date" value={m.dueDate} onChange={e => updateMilestone(index,'dueDate',e.target.value)} style={inputStyle} />)}</div>)}
          <button type="button" className="btn-secondary" style={{ marginTop: 10 }} onClick={() => setMilestones([...milestones, { title: '', description: '', sequence: milestones.length + 1, amountUsd: '', dueDate: '' }])}>Add milestone</button><p style={{ fontSize: 12, color: '#64748B' }}>Milestone amounts must add up to the project fee already agreed in the contract.</p></section>}
        {error && <p role="alert" style={{ color: '#B91C1C', background: '#FEF2F2', padding: 10, borderRadius: 8 }}>{error}</p>}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 22 }}><button type="button" onClick={onClose} className="btn-secondary" disabled={busy}>Cancel</button><button type="submit" className="btn-primary" disabled={busy}>{busy ? 'Activating…' : 'Activate engagement'}</button></div>
      </form>
    </div>
  </div>;
}
