import React, { useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../lib/apiFetch';

const lineLabel: Record<string, string> = {
  placement: 'Direct hires', outsourcing: 'Outsourced team',
  managed_workforce: 'Managed teams', project: 'Projects'
};
const managementLabel: Record<string, string> = {
  client_managed: 'Directed by your team', kongila_managed: 'Supervised by Kongila', hybrid: 'Shared supervision'
};

function contactLink(contact: any, subject: string, label: string) {
  if (!contact?.email) return null;
  return <a href={`mailto:${encodeURIComponent(contact.email)}?subject=${encodeURIComponent(subject)}`} style={{ color: '#1455C0', fontWeight: 700, textDecoration: 'none' }}>{label}</a>;
}

export default function EngagementWorkspace({ mode, currentUser, requests = [], onAddRequest, onMessageContact }: any) {
  const [engagements, setEngagements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [replacement, setReplacement] = useState<any>(null);
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const load = async () => {
    setLoading(true); setLoadError('');
    try {
      const response = await apiFetch('/api/engagements');
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || 'Could not load your engagements.');
      setEngagements(Array.isArray(body.engagements) ? body.engagements : []);
    } catch (error: any) { setLoadError(error?.message || 'Could not load your engagements.'); }
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const byLine = useMemo(() => {
    const grouped: Record<string, any[]> = { placement: [], outsourcing: [], managed_workforce: [], project: [] };
    engagements.forEach(row => { if (grouped[row.service_line]) grouped[row.service_line].push(row); });
    return grouped;
  }, [engagements]);

  const sendReplacementRequest = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!replacement || !reason || saving) return;
    setSaving(true); setMessage('');
    try {
      const response = await apiFetch('/api/engagements/replacement', { method: 'POST', body: JSON.stringify({ assignmentId: replacement.id, reason, notes }) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || !body.request) throw new Error(body.error || 'Could not submit the replacement request.');
      if (onAddRequest) await onAddRequest(body.request);
      setMessage('Your replacement request has been sent to Kongila operations under the placement guarantee.');
      setReplacement(null); setReason(''); setNotes('');
    } catch (error: any) { setMessage(error?.message || 'The replacement request was not sent.'); }
    setSaving(false);
  };

  if (mode === 'talent') {
    const item = engagements.find(row => ['active', 'pending_start', 'paused'].includes(row.status));
    return <section style={panelStyle}>
      <div style={eyebrowStyle}>YOUR ENGAGEMENT</div>
      <h2 style={headingStyle}>Work and reporting</h2>
      {loading ? <p style={mutedStyle}>Loading your engagement…</p> : loadError ? <p role="alert" style={{ color: '#B91C1C' }}>{loadError}</p> : !item ? <p style={mutedStyle}>Your engagement details will appear here once Kongila activates a contract for work.</p> : <>
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: 18 }}>
          <div><div style={{ fontSize: 20, fontWeight: 800, color: '#14213D' }}>{item.contracts?.role_title || item.role}</div><div style={mutedStyle}>{lineLabel[item.service_line] || item.service_line} · {String(item.status).replace(/_/g,' ')}</div></div>
          <div style={{ textAlign: 'right' }}><div style={eyebrowStyle}>START DATE</div><div style={{ color: '#14213D', fontWeight: 700 }}>{item.start_date || 'To be confirmed'}</div></div>
        </div>
        {item.contracts?.rate_amount != null && <p style={mutedStyle}>Agreed compensation: <strong style={{ color: '#14213D' }}>{item.contracts.currency || 'USD'} {Number(item.contracts.rate_amount).toLocaleString()} / {item.contracts.rate_type === 'Hourly' ? 'hour' : 'month'}</strong></p>}
        {item.working_pattern && <p style={mutedStyle}>Working pattern: <strong style={{ color: '#14213D' }}>{item.working_pattern}</strong></p>}
        <div style={{ marginTop: 16, padding: 14, background: '#F5F8FC', borderRadius: 10, color: '#475569', lineHeight: 1.55 }}>
          {item.service_line === 'placement'
            ? <>You are employed directly by <strong>{item.clientName}</strong>. Kongila introduced you to the client and is not your employer under this engagement.</>
            : item.service_line === 'managed_workforce'
              ? <>You are employed by Kongila and work as part of <strong>{item.groupLead?.name || item.supervisor?.name || 'your managed team'}</strong>'s function for {item.clientName}.</>
              : item.management_mode === 'kongila_managed'
                ? <>Kongila employs you and handles the employment arrangement. Your day-to-day work is supervised by <strong>{item.supervisor?.name || 'your Kongila supervisor'}</strong>.</>
                : item.management_mode === 'hybrid'
                  ? <>Kongila employs you and supports the employment process. Work direction is shared with {item.clientName}.</>
                  : <>Kongila employs you and supports the employment arrangement. Your day-to-day work is directed by {item.clientName}.</>}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 18, marginTop: 14, fontSize: 14 }}>
          {item.clientContact && <span>Client: <strong>{item.clientContact.name || 'Your client'}</strong> {contactLink(item.clientContact, 'Engagement support', 'Email')} {onMessageContact && <button type="button" className="btn-secondary" onClick={() => onMessageContact(item.clientContact.id, item.id)}>Message client</button>}</span>}
          {item.service_line !== 'placement' && item.supervisor && <span>Kongila supervisor: <strong>{item.supervisor.name}</strong> {contactLink(item.supervisor, 'Engagement support', 'Email')} {onMessageContact && <button type="button" className="btn-secondary" onClick={() => onMessageContact(item.supervisor.id, item.id)}>Message supervisor</button>}</span>}
          {item.service_line !== 'placement' && !item.supervisor && item.accountManager && <span>Account manager: <strong>{item.accountManager.name}</strong> {contactLink(item.accountManager, 'Engagement support', 'Email')}</span>}
        </div>
      </>}
    </section>;
  }

  const renderDirectHires = () => <div style={{ display: 'grid', gap: 12 }}>{byLine.placement.map(item => {
    const contract = item.contracts || {};
    if (item.status === 'contract_pending') return <article key={item.id} style={rowStyle}><div><h3 style={cardTitle}>{item.talent?.full_name || item.contracts?.role_title || item.role}</h3><p style={mutedStyle}>{item.contracts?.role_title || item.role} · Contract in progress</p><p style={mutedStyle}>The talent accepted the offer. Contract signatures and activation are still being completed; this person will move into the active team after activation.</p></div><span style={statusStyle}>{String(item.operational_status || 'pending_signatures').replace(/_/g,' ')}</span></article>;
    const guaranteeEnd = item.guarantee_end_date ? new Date(`${item.guarantee_end_date}T23:59:59`) : null;
    const guaranteeOpen = guaranteeEnd && guaranteeEnd.getTime() >= Date.now() && item.status !== 'ended';
    return <article key={item.id} style={rowStyle}><div><h3 style={cardTitle}>{item.talent?.full_name || contract.role_title || item.role}</h3><p style={mutedStyle}>{contract.role_title || item.role} · Starts {item.start_date || 'date pending'}</p><p style={mutedStyle}>Client employs this professional directly. Kongila is not involved in day-to-day management.</p>{guaranteeEnd && <p style={{ ...mutedStyle, color: guaranteeOpen ? '#166534' : '#64748B' }}>{item.guarantee_months || 4}-month replacement window {guaranteeOpen ? `ends ${guaranteeEnd.toLocaleDateString()}` : `ended ${guaranteeEnd.toLocaleDateString()}`}</p>}</div><div>{guaranteeOpen ? <button type="button" className="btn-secondary" onClick={() => { setReplacement(item); setMessage(''); }}>Request free replacement</button> : <span style={statusStyle}>{String(item.status).replace(/_/g,' ')}</span>}</div></article>;
  })}{byLine.placement.length === 0 && <p style={mutedStyle}>No direct hire engagements yet.</p>}</div>;

  const renderOutsourced = () => <div style={{ display: 'grid', gap: 12 }}>{byLine.outsourcing.map(item => item.status === 'contract_pending' ? <article key={item.id} style={rowStyle}><div><h3 style={cardTitle}>{item.talent?.full_name || item.contracts?.role_title || item.role}</h3><p style={mutedStyle}>{item.contracts?.role_title || item.role} · Contract in progress</p><p style={mutedStyle}>The offer is accepted. Work details will appear here when signatures and activation are complete.</p></div><span style={statusStyle}>{String(item.operational_status || 'pending_signatures').replace(/_/g,' ')}</span></article> : <article key={item.id} style={rowStyle}>
    <div><h3 style={cardTitle}>{item.talent?.full_name || item.contracts?.role_title || item.role}</h3><p style={mutedStyle}>{item.contracts?.role_title || item.role} · {item.management_mode ? managementLabel[item.management_mode] : 'Management mode pending'} · Starts {item.start_date || 'date pending'}</p>
      {item.management_mode === 'kongila_managed' ? <p style={mutedStyle}>Kongila coordinates day-to-day supervision. The manager contact is the route for questions and escalation.</p> : item.management_mode === 'hybrid' ? <p style={mutedStyle}>Your team directs the work; Kongila supports the employment and HR process.</p> : <p style={mutedStyle}>Your team directs the day-to-day work. Kongila handles the employment arrangement.</p>}
    </div><div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}><span style={statusStyle}>{String(item.status).replace(/_/g,' ')}</span>{item.supervisor && <span style={mutedStyle}>Kongila contact: {item.supervisor.name}</span>}{contactLink(item.supervisor || item.accountManager, 'Team engagement support', 'Contact Kongila')}</div>
  </article>)}{byLine.outsourcing.length === 0 && <p style={mutedStyle}>No outsourced team members are active yet.</p>}</div>;

  const groupRows: any[][] = Object.values(byLine.managed_workforce.reduce((acc: any, item: any) => {
    const key = item.engagement_group_id || item.id;
    (acc[key] ||= []).push(item); return acc;
  }, {} as Record<string, any[]>)) as any[][];
  const renderManaged = () => <div style={{ display: 'grid', gap: 14 }}>{groupRows.map((members: any[]) => {
    const first = members[0]; const group = first.engagement_groups || {};
    if (first.status === 'contract_pending') return <article key={first.id} style={rowStyle}><div><h3 style={cardTitle}>{first.talent?.full_name || first.role}</h3><p style={mutedStyle}>{first.contracts?.role_title || first.role} · Contract in progress</p><p style={mutedStyle}>Offer accepted; signatures and managed-team activation are still in progress.</p></div><span style={statusStyle}>{String(first.operational_status || 'pending_signatures').replace(/_/g,' ')}</span></article>;
    return <article key={first.engagement_group_id || first.id} style={{ ...rowStyle, display: 'block' }}><div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap' }}><div><h3 style={cardTitle}>{group.name || 'Managed function'}</h3><p style={mutedStyle}>{members.length} active team member{members.length === 1 ? '' : 's'} · Coverage: {group.coverage_type || 'to be confirmed'}</p></div><div>Kongila lead: <strong>{first.groupLead?.name || 'Assigned operations lead'}</strong> {contactLink(first.groupLead || first.supervisor, 'Managed team support', 'Contact')}</div></div><div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>{members.map((m: any) => <span key={m.id} style={statusStyle}>{m.talent?.full_name || m.role}</span>)}</div><p style={mutedStyle}>Kongila manages the team operation; this view groups the service by function rather than presenting individual staff controls.</p></article>;
  })}{groupRows.length === 0 && <p style={mutedStyle}>No managed teams are active yet.</p>}</div>;

  const projects: any[][] = Object.values(byLine.project.reduce((acc: any, item: any) => { const key = item.project_id || item.id; (acc[key] ||= []).push(item); return acc; }, {} as Record<string, any[]>)) as any[][];
  const renderProjects = () => <div style={{ display: 'grid', gap: 14 }}>{projects.map((members: any[]) => { if (members[0].status === 'contract_pending') return <article key={members[0].id} style={rowStyle}><div><h3 style={cardTitle}>{members[0].contracts?.role_title || members[0].role}</h3><p style={mutedStyle}>Offer accepted; contract signature and project activation are still in progress.</p></div><span style={statusStyle}>{String(members[0].operational_status || 'pending_signatures').replace(/_/g,' ')}</span></article>; const project = members[0].projects || {}; const milestones = members.flatMap(m => m.milestones || []).filter((m, i, all) => all.findIndex(other => other.id === m.id) === i).sort((a,b) => a.sequence - b.sequence); return <article key={members[0].project_id || members[0].id} style={{ ...rowStyle, display: 'block' }}><h3 style={cardTitle}>{project.name || members[0].role}</h3><p style={mutedStyle}>{project.description || 'Defined project engagement'} · Target {project.deadline || 'not set'}</p><p style={mutedStyle}>Project team: {members.map(m => m.talent?.full_name || m.role).join(', ')}</p><ol style={{ margin: '12px 0 0', paddingLeft: 20 }}>{milestones.map(m => <li key={m.id} style={{ padding: '5px 0', color: '#334155' }}>{m.title} <span style={statusStyle}>{m.status}</span></li>)}</ol></article>; })}{projects.length === 0 && <p style={mutedStyle}>No active projects yet.</p>}</div>;

  return <div style={{ maxWidth: 1200, margin: '0 auto', padding: 24, display: 'grid', gap: 22 }}>
    <header><div style={eyebrowStyle}>CLIENT WORKSPACE</div><h1 style={{ ...headingStyle, margin: '5px 0' }}>My team & engagements</h1><p style={mutedStyle}>People, teams and projects are organised by the way Kongila delivers each service.</p></header>
    {loading && <p style={mutedStyle}>Loading your engagements…</p>}{loadError && <div role="alert" style={{ color: '#991B1B', background: '#FEF2F2', padding: 12, borderRadius: 8 }}>{loadError} <button onClick={load} className="btn-secondary">Try again</button></div>}
    {!loading && !loadError && <>
      {[['placement',renderDirectHires],['outsourcing',renderOutsourced],['managed_workforce',renderManaged],['project',renderProjects]].map(([key, render]: any) => <section key={key} style={panelStyle}><div style={eyebrowStyle}>{lineLabel[key]}</div>{render()}</section>)}
    </>}
    {message && <p role="status" style={{ color: message.startsWith('Your replacement') ? '#166534' : '#B91C1C' }}>{message}</p>}
    {replacement && <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget && !saving) setReplacement(null); }}><div className="modal-content" role="dialog" aria-modal="true" aria-labelledby="replacement-title" style={{ maxWidth: 520, padding: 26 }}><h2 id="replacement-title" style={headingStyle}>Request a free replacement</h2><p style={mutedStyle}>This direct hire is within the recorded guarantee window. The request will be routed to Kongila operations and tied to this engagement.</p><form onSubmit={sendReplacementRequest} style={{ display: 'grid', gap: 14 }}><label style={fieldStyle}>Reason<textarea required value={reason} onChange={e => setReason(e.target.value)} rows={3} style={textareaStyle} /></label><label style={fieldStyle}>Additional context<textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} style={textareaStyle} /></label><div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}><button type="button" className="btn-secondary" onClick={() => setReplacement(null)} disabled={saving}>Cancel</button><button className="btn-primary" disabled={saving || !reason}>{saving ? 'Sending…' : 'Submit replacement request'}</button></div></form></div></div>}
  </div>;
}

const panelStyle: React.CSSProperties = { background: '#fff', border: '1px solid #E2E8F0', borderRadius: 14, padding: 20 };
const rowStyle: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 20, padding: 16, borderBottom: '1px solid #E5EAF1' };
const headingStyle: React.CSSProperties = { color: '#14213D', fontSize: 22, fontWeight: 800 };
const cardTitle: React.CSSProperties = { margin: 0, color: '#14213D', fontSize: 16, fontWeight: 800 };
const mutedStyle: React.CSSProperties = { margin: '5px 0 0', color: '#64748B', fontSize: 13, lineHeight: 1.5 };
const eyebrowStyle: React.CSSProperties = { color: '#1455C0', fontSize: 11, fontWeight: 800, letterSpacing: '.1em', textTransform: 'uppercase' };
const statusStyle: React.CSSProperties = { display: 'inline-block', background: '#EFF6FF', color: '#1D4ED8', borderRadius: 999, padding: '4px 9px', fontSize: 11, fontWeight: 700 };
const fieldStyle: React.CSSProperties = { display: 'grid', gap: 6, color: '#334155', fontWeight: 700, fontSize: 13 };
const textareaStyle: React.CSSProperties = { padding: 10, border: '1px solid #CBD5E1', borderRadius: 8, font: 'inherit', resize: 'vertical' };
