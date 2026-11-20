import React, { useEffect, useState } from 'react';
import { apiFetch } from '../lib/apiFetch';

/**
 * Generating a contract from an offer the candidate has accepted.
 *
 * An operator used to open an empty form and retype figures that already
 * existed on the offer, with the margin applied by nobody and the
 * candidate's own document not existing at all. This starts from the offer,
 * shows what follows from the client's terms, and lets them change anything
 * before a row is written.
 *
 * Nothing is saved until Generate. The preview reruns server-side whenever a
 * figure changes, so the three numbers on screen are the numbers the invoice
 * will carry, not an approximation done in the browser.
 */

const LINE_LABELS: Record<string, string> = {
  placement: 'Direct hire',
  outsourcing: 'Outsourcing',
  managed_workforce: 'Managed team',
  project: 'Project'
};
const templateMatchesLine = (template: any, line: string) => {
  if (!template.service_type) return true;
  const key = String(template.service_type).toLowerCase().trim().replace(/[\s-]+/g, '_');
  const aliases: Record<string, string> = { hire_talent: 'placement', direct_hire: 'placement', direct_placement: 'placement', outsource_talent: 'outsourcing', managed_team: 'managed_workforce', project_execution: 'project' };
  return (aliases[key] || key) === line;
};

export default function GenerateContractModal({
  offer,
  offers = [],
  onClose,
  onGenerated
}: {
  offer: any;
  offers?: any[];
  onClose: () => void;
  onGenerated: (result: any) => void;
}) {
  const [selectedOffer, setSelectedOffer] = useState<any>(offer || offers[0] || null);
  const [plan, setPlan] = useState<any>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<'terms' | 'client' | 'talent'>('terms');
  const [templates, setTemplates] = useState<any[]>([]);
  const [overrides, setOverrides] = useState<any>({});

  const load = async (nextOverrides?: any) => {
    setLoading(true);
    try {
      const response = await apiFetch('/api/contracts/generate', {
        method: 'POST',
        body: JSON.stringify({
          preview: true,
          offerId: selectedOffer?.id,
          overrides: nextOverrides ?? overrides
        })
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body?.error || 'The contract could not be prepared.');
      setPlan(body);
      setWarnings(body.warnings || []);
      setError('');
    } catch (cause: any) {
      setError(cause?.message || 'The contract could not be prepared.');
      setPlan(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { setSelectedOffer(offer || offers[0] || null); }, [offer?.id, offers]);

  useEffect(() => {
    if (!selectedOffer?.id) return;
    setOverrides({});
    void load({});
    apiFetch('/api/contracts/templates').then(r => r.json()).then(body => setTemplates((body.templates || []).filter((t: any) => t.status === 'published'))).catch(() => setTemplates([]));
    /* eslint-disable-next-line */
  }, [selectedOffer?.id]);

  /** Changes a figure and reprices from the server. */
  const change = (patch: any) => {
    const next = { ...overrides, ...patch };
    setOverrides(next);
    void load(next);
  };

  const generate = async () => {
    setSaving(true);
    setError('');
    try {
      const response = await apiFetch('/api/contracts/generate', {
        method: 'POST',
        body: JSON.stringify({ offerId: selectedOffer?.id, overrides })
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body?.error || 'The contract was not created.');
      onGenerated(body);
    } catch (cause: any) {
      setError(cause?.message || 'The contract was not created.');
    } finally {
      setSaving(false);
    }
  };

  const money = (value: any, currency = 'USD') =>
    value === null || value === undefined
      ? '—'
      : `${currency} ${Number(value).toLocaleString('en-US', { maximumFractionDigits: 2 })}`;

  const field: React.CSSProperties = { width: '100%', padding: '8px 10px', border: '1px solid #E2E8F0', borderRadius: 8, fontSize: 13 };
  const label: React.CSSProperties = { fontSize: 11.5, fontWeight: 700, color: '#64748B', display: 'block', marginBottom: 4 };
  const tabStyle = (active: boolean): React.CSSProperties => ({
    padding: '9px 16px', border: 'none', background: 'transparent',
    borderBottom: active ? '2px solid #2563EB' : '2px solid transparent',
    color: active ? '#2563EB' : '#64748B', fontWeight: active ? 700 : 500,
    fontSize: 13.5, cursor: 'pointer'
  });

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget && !saving) onClose(); }} style={{ position: 'fixed', inset: 0, zIndex: 1000, background: '#F1F5F9', padding: 0, display: 'block' }}>
      <section className="modal-content" style={{ width: '100%', height: '100%', maxHeight: '100vh', overflow: 'auto', padding: '28px clamp(20px, 4vw, 64px)', borderRadius: 0, boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: 16, marginBottom: 18 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: '#0F172A' }}>Create contracts from accepted offer</h2>
            <p style={{ margin: '6px 0 0', fontSize: 13, color: '#64748B' }}>
              From the accepted offer for {plan?.talentName || selectedOffer?.talentName || 'this candidate'}
              {plan?.roleTitle ? ` — ${plan.roleTitle}` : ''}
              {plan?.serviceLine ? ` · ${LINE_LABELS[plan.serviceLine] || plan.serviceLine}` : ''}
            </p>
          </div>
          <button onClick={onClose} className="btn-secondary" style={{ padding: '6px 12px', fontSize: 12 }}>Close</button>
        </div>

        {offers.length > 1 && <label style={{ display: 'block', maxWidth: 560, marginBottom: 18, fontSize: 12, fontWeight: 700, color: '#475569' }}>Accepted offer<select style={{ width: '100%', padding: 10, marginTop: 5, border: '1px solid #CBD5E1', borderRadius: 8 }} value={selectedOffer?.id || ''} onChange={e => { const next = offers.find((item: any) => String(item.id) === e.target.value); setSelectedOffer(next); }}>
          {offers.map((item: any) => <option key={item.id} value={item.id}>{item.talentName || item.talent_name || 'Talent'} · {item.roleTitle || item.role_title || 'Role'} · {item.clientName || item.client_name || 'Client'}</option>)}
        </select></label>}

        {error && (
          <div role="alert" style={{ background: '#FEE2E2', border: '1px solid #FCA5A5', color: '#991B1B', padding: 12, borderRadius: 8, marginBottom: 14, fontSize: 13 }}>{error}</div>
        )}
        {warnings.length > 0 && (
          <div role="status" style={{ background: '#FFFBEB', border: '1px solid #FDE68A', color: '#92400E', padding: 12, borderRadius: 8, marginBottom: 14, fontSize: 12.5, lineHeight: 1.6 }}>
            {warnings.map((line, index) => <div key={index}>{line}</div>)}
          </div>
        )}

        {loading && !plan ? (
          <p style={{ fontSize: 13, color: '#64748B' }}>Working out the figures…</p>
        ) : plan ? (
          <>
            {/* The three numbers that matter, from the terms. */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))', gap: 12, marginBottom: 20 }}>
              {[
                {
                  label: plan.serviceLine === 'placement' ? 'Client pays, once' : 'Client pays, monthly',
                  value: money(plan.serviceLine === 'placement' ? plan.money.placementFee : plan.money.clientPaysMonthly, plan.money.currency),
                  tone: '#0F172A'
                },
                {
                  label: plan.serviceLine === 'placement' ? 'Candidate is paid by' : 'Candidate receives',
                  value: plan.serviceLine === 'placement' ? 'the client, directly' : money(plan.money.talentReceives, plan.money.currency),
                  tone: '#0F172A'
                },
                {
                  label: 'Kongila keeps',
                  value: money(plan.money.kongilaKeeps, plan.money.currency),
                  tone: '#15803D'
                }
              ].map(card => (
                <div key={card.label} style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 10, padding: '13px 15px' }}>
                  <div style={{ fontSize: 11.5, color: '#64748B', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.03em' }}>{card.label}</div>
                  <div style={{ fontSize: 19, fontWeight: 800, color: card.tone, marginTop: 5 }}>{card.value}</div>
                </div>
              ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '220px minmax(0,1fr)', gap: 26, minHeight: '58vh' }}>
              <nav aria-label="Contract setup" style={{ borderRight: '1px solid #E2E8F0', paddingRight: 18 }}>
                {[['terms', 'Offer & fees'], ['client', 'Client contract'], ['talent', 'Talent contract']].map(([key, label]) => <button key={key} onClick={() => setTab(key as any)} style={{ ...tabStyle(tab === key), display: 'block', width: '100%', textAlign: 'left', borderBottom: 0, borderLeft: tab === key ? '3px solid #2563EB' : '3px solid transparent', marginBottom: 8 }}>{label}</button>)}
                <div style={{ marginTop: 18, padding: 12, borderRadius: 10, background: '#F8FAFC', color: '#64748B', fontSize: 12, lineHeight: 1.6 }}>Offer terms are prefilled below. Review the Kongila fee and choose a published template for each signer.</div>
              </nav>
              <div>

            {tab === 'terms' && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 14 }}>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={label}>Role title from accepted offer</label>
                  <input style={field} defaultValue={plan.roleTitle || ''} onBlur={e => change({ roleTitle: e.target.value })} />
                </div>
                <div>
                  <label style={label}>{plan.serviceLine === 'placement' ? 'Monthly salary' : 'Monthly rate'}</label>
                  <input style={field} type="number" defaultValue={plan.money.rate}
                    onBlur={e => change({ rateAmount: Number(e.target.value) })} />
                </div>

                {plan.serviceLine === 'placement' && (
                  <div>
                    <label style={label}>Annual salary, the fee is a share of this</label>
                    <input style={field} type="number" defaultValue={plan.money.annualSalary ?? ''}
                      onBlur={e => change({ annualSalaryUsd: Number(e.target.value) })} />
                  </div>
                )}

                {plan.serviceLine === 'placement' && (
                  <div>
                    <label style={label}>Placement fee % of annual salary</label>
                    <input style={field} type="number" min="0" step="0.5"
                      defaultValue={Math.round((plan.terms.placementFeePct || 0) * 10000) / 100}
                      onBlur={e => change({ placementFeePct: Number(e.target.value) / 100 })} />
                  </div>
                )}

                {plan.serviceLine === 'managed_workforce' && (
                  <div>
                    <label style={label}>Seats</label>
                    <input style={field} type="number" min={1} defaultValue={plan.money.seats}
                      onBlur={e => change({ seats: Number(e.target.value) })} />
                  </div>
                )}

                <div>
                  <label style={label}>Start date</label>
                  <input style={field} type="date" defaultValue={plan.schedule.startDate || ''}
                    onBlur={e => change({ startDate: e.target.value })} />
                </div>
                <div>
                  <label style={label}>End date</label>
                  <input style={field} type="date" defaultValue={plan.schedule.endDate || ''}
                    onBlur={e => change({ endDate: e.target.value })} />
                </div>

                <div>
                  <label style={label}>Client fee %</label>
                  <input style={field} type="number" step="0.5"
                    defaultValue={Math.round(plan.terms.clientFeePct * 10000) / 100}
                    onBlur={e => change({ clientFeePct: Number(e.target.value) / 100 })} />
                </div>
                <div>
                  <label style={label}>Candidate commission %</label>
                  <input style={field} type="number" step="0.5"
                    defaultValue={Math.round(plan.terms.talentCommissionPct * 10000) / 100}
                    onBlur={e => change({ talentCommissionPct: Number(e.target.value) / 100 })} />
                </div>

                {plan.serviceLine !== 'placement' && (
                  <div>
                    <label style={label}>Supervision premium %</label>
                    <input style={field} type="number" step="0.5"
                      defaultValue={Math.round((plan.terms.managementPremiumPct || 0) * 10000) / 100}
                      onBlur={e => change({ managementPremiumPct: Number(e.target.value) / 100 })} />
                  </div>
                )}

                <div>
                  <label style={label}>Client payment terms, days</label>
                  <input style={field} type="number" defaultValue={plan.terms.paymentTermsDays}
                    onBlur={e => change({ paymentTermsDays: Number(e.target.value) })} />
                </div>

                {plan.serviceLine !== 'placement' && (
                  <>
                    <div>
                      <label style={label}>Candidate paid</label>
                      <select style={field} defaultValue={plan.schedule.payFrequency}
                        onChange={e => change({ talentPayFrequency: e.target.value })}>
                        <option value="monthly">Monthly</option>
                        <option value="twice_monthly">Twice a month</option>
                        <option value="fortnightly">Fortnightly</option>
                        <option value="on_milestone">On each accepted milestone</option>
                      </select>
                    </div>
                    <div>
                      <label style={label}>Payday, day of the month</label>
                      <input style={field} type="number" min={1} max={31} defaultValue={plan.schedule.paydayDay}
                        onBlur={e => change({ talentPaydayDay: Number(e.target.value) })} />
                    </div>
                  </>
                )}

                <div style={{ gridColumn: '1 / -1', background: '#F0F9FF', border: '1px solid #BAE6FD', borderRadius: 10, padding: '12px 14px', fontSize: 12.5, color: '#075985', lineHeight: 1.6 }}>
                  {plan.serviceLine === 'placement' ? (
                    <>
                      The placement fee is <strong>{Math.round((plan.terms.placementFeePct || 0) * 10000) / 100}%
                      of the annual salary</strong>. The invoice is prepared and sent separately
                      from the contract. Kongila does not pay the
                      candidate and no payday applies.
                    </>
                  ) : (
                    <>
                      The candidate is paid <strong>{plan.schedule.paydayDescription}</strong>, first on{' '}
                      <strong>{plan.schedule.firstPayday || 'the first payday after they start'}</strong>.
                      This is written into their contract and is what payroll and their portal read.
                      {plan.serviceLine === 'project'
                        ? ' The client is invoiced against the milestones agreed on the offer, each one when you mark it delivered.'
                        : ' The client is invoiced monthly in arrears.'}
                    </>
                  )}
                </div>

                {plan.serviceLine === 'project' && (
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label style={label}>Milestones agreed on the offer</label>
                    {(plan.milestones || []).length === 0 ? (
                      <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 10, padding: '12px 14px', fontSize: 12.5, color: '#92400E', lineHeight: 1.6 }}>
                        This offer carried no milestone plan, so this contract will have nothing to
                        invoice against. It can still be generated, but set a plan on the contract
                        before the work starts.
                      </div>
                    ) : (
                      <div style={{ border: '1px solid var(--border-glass)', borderRadius: 10, overflow: 'hidden' }}>
                        {plan.milestones.map((milestone: any, index: number) => (
                          <div key={milestone.id || index} style={{
                            display: 'flex', justifyContent: 'space-between', gap: 12,
                            padding: '9px 13px', fontSize: 12.5,
                            borderTop: index === 0 ? 'none' : '1px solid var(--border-glass)'
                          }}>
                            <span>
                              <strong>{index + 1}. {milestone.name}</strong>
                              {milestone.dueDate ? <span style={{ color: 'var(--text-muted)' }}> · due {milestone.dueDate}</span> : null}
                            </span>
                            <span style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>
                              {money(milestone.value, plan.money.currency)}
                              {milestone.percent && !milestone.amountUsd
                                ? <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}> ({milestone.percent}%)</span>
                                : null}
                            </span>
                          </div>
                        ))}
                        <div style={{
                          display: 'flex', justifyContent: 'space-between', gap: 12,
                          padding: '9px 13px', fontSize: 12.5, fontWeight: 800,
                          background: 'var(--bg-secondary)', borderTop: '1px solid var(--border-glass)'
                        }}>
                          <span>Project fee</span>
                          <span>{money(plan.projectFee || plan.money.rate, plan.money.currency)}</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {plan.terms.paymentSchedule?.splits?.length > 0 && (
                  <div style={{ gridColumn: '1 / -1', fontSize: 12.5, color: '#475569' }}>
                    This client pays in instalments:{' '}
                    {plan.terms.paymentSchedule.splits
                      .map((split: any) => `${split.percent}% on the ${split.dayOfMonth}`)
                      .join(', ')}. Change it in Finance, under terms and payment schedules.
                  </div>
                )}
              </div>
            )}

            {tab === 'client' && (
              <div>
                <label style={label}>Client template<select style={field} value={overrides.clientTemplateId || ''} onChange={e => change({ clientTemplateId: e.target.value || undefined })}><option value="">Standard template for this service</option>{templates.filter(t => (t.audience || 'client') === 'client' && templateMatchesLine(t, plan.serviceLine)).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
                <div style={{ fontSize: 12, color: '#64748B', marginBottom: 8 }}>
                  From <strong>{plan.documents.clientTemplateName}</strong>. Edit here and the change
                  applies to this contract only.
                </div>
                <textarea
                  style={{ ...field, minHeight: 360, fontFamily: 'ui-monospace, monospace', fontSize: 12, lineHeight: 1.55 }}
                  defaultValue={plan.documents.clientBody}
                  onBlur={e => setOverrides({ ...overrides, clientBody: e.target.value })}
                />
              </div>
            )}

            {tab === 'talent' && (
              <div>
                <label style={label}>Talent template<select style={field} value={overrides.talentTemplateId || ''} onChange={e => change({ talentTemplateId: e.target.value || undefined })}><option value="">Standard template for this service</option>{templates.filter(t => t.audience === 'talent' && templateMatchesLine(t, plan.serviceLine)).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
                {plan.documents.talentTemplateName ? (
                  <>
                    <div style={{ fontSize: 12, color: '#64748B', marginBottom: 8 }}>
                      From <strong>{plan.documents.talentTemplateName}</strong>. The candidate sees
                      this one and never the client's.
                    </div>
                    <textarea
                      style={{ ...field, minHeight: 360, fontFamily: 'ui-monospace, monospace', fontSize: 12, lineHeight: 1.55 }}
                      defaultValue={plan.documents.talentBody}
                      onBlur={e => setOverrides({ ...overrides, talentBody: e.target.value })}
                    />
                  </>
                ) : (
                  <p style={{ fontSize: 13, color: '#B45309' }}>
                    No candidate template is published for this service line, so the candidate would
                    get nothing. Publish one in Service templates first.
                  </p>
                )}
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, marginTop: 22, flexWrap: 'wrap', alignItems: 'center' }}>
              <button onClick={generate} disabled={saving || loading}
                style={{ padding: '10px 22px', borderRadius: 8, border: 'none', background: '#2563EB', color: '#fff', fontWeight: 700, fontSize: 14, cursor: saving ? 'wait' : 'pointer' }}>
                {saving ? 'Generating…' : 'Generate contract'}
              </button>
              <button onClick={onClose} className="btn-secondary" style={{ padding: '10px 18px', fontSize: 13 }}>Cancel</button>
              {loading && <span style={{ fontSize: 12, color: '#64748B' }}>Repricing…</span>}
            </div>
              </div>
            </div>
          </>
        ) : null}
      </section>
    </div>
  );
}
