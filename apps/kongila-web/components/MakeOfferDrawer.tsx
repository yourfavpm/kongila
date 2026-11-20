import React, { useMemo, useState } from "react";
import { apiFetch } from "../lib/apiFetch";
import { InterviewStatusTrail } from "@kongila/ui";
import { describeOfferStage, serviceLineOf, milestonePlanProblem } from "@kongila/workflows";

/**
 * The terms a client is offering, in full.
 *
 * The form this replaces asked for two things: a monthly figure and a start
 * date. Everything else was hardcoded — `flat_rate`, `monthly`, no
 * engagement type, no hours, no duration, no payment day — so an offer
 * arrived at Kongila with no answer to most of the questions that have to be
 * settled before a contract can be drafted, and operations had to go back to
 * the client for each one. The columns for all of it have been on the offers
 * table since it was created.
 *
 * It matters more here than on a normal job form because Kongila is the
 * employer of record: these answers become the contract Kongila signs, so
 * "we'll work it out later" is a commitment somebody else has to honour.
 *
 * Nothing here reaches the candidate directly. It goes to Kongila, who
 * review the terms and put them forward, which is what the panel says.
 */

interface MakeOfferDrawerProps {
  currentUser: any;
  request: any;
  talent: any;
  matchId?: string;
  /** 'post_interview' when it follows an interview, for the offers board. */
  entryPoint?: string;
  onClose: () => void;
  onCreated?: (offer: any) => void;
}

const ENGAGEMENTS = [
  { value: 'full_time', label: 'Full time', hint: 'Around 40 hours a week' },
  { value: 'part_time', label: 'Part time', hint: 'You set the hours below' }
];

const DURATIONS = [
  { value: 'ongoing', label: 'Ongoing', hint: 'No end date agreed up front' },
  { value: 'fixed_term', label: 'Fixed term', hint: 'Ends after a set number of months' }
];

const PAYMENT_MODELS = [
  { value: 'flat_rate', label: 'Flat rate', hint: 'A fixed amount each period' },
  { value: 'hourly', label: 'Hourly', hint: 'Paid for hours worked' }
];

export default function MakeOfferDrawer({
  currentUser,
  request,
  talent,
  matchId,
  entryPoint,
  onClose,
  onCreated
}: MakeOfferDrawerProps) {
  const [roleTitle, setRoleTitle] = useState(
    request?.roleTitle || request?.title || request?.roleDescription || ''
  );
  const [engagementType, setEngagementType] = useState('full_time');
  const [hoursPerWeek, setHoursPerWeek] = useState('20');
  const [durationType, setDurationType] = useState('ongoing');
  const [contractMonths, setContractMonths] = useState('6');
  const [paymentModel, setPaymentModel] = useState('flat_rate');
  const [paymentPeriod, setPaymentPeriod] = useState('monthly');
  const [rate, setRate] = useState(
    String(request?.budgetMaxUsd || request?.budget || '')
  );
  const [paymentDueDay, setPaymentDueDay] = useState('1');
  const [startDate, setStartDate] = useState(
    new Date(Date.now() + 86400000 * 14).toISOString().split('T')[0]
  );
  const [note, setNote] = useState('');

  /**
   * A project is bought as deliverables, not as somebody's time, so the
   * money question is a total fee split into payment points rather than a
   * rate per period. These replace the rate and payment sections for that
   * service line, and are what the contract and every invoice are built
   * from afterwards.
   */
  const isProject = serviceLineOf(request?.serviceType) === 'project';
  const [projectFee, setProjectFee] = useState(
    String(request?.budgetMaxUsd || request?.budget || '')
  );
  const [plan, setPlan] = useState<any[]>([
    { id: 'm1', name: 'Kick-off', percent: '30', amountUsd: '', dueDate: '', description: '' },
    { id: 'm2', name: 'Delivery', percent: '70', amountUsd: '', dueDate: '', description: '' }
  ]);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState<any | null>(null);

  const rateLabel = paymentModel === 'hourly'
    ? 'Hourly rate (USD)'
    : paymentPeriod === 'weekly' ? 'Weekly rate (USD)' : 'Monthly rate (USD)';

  /** What this costs over a month, so nobody agrees an hourly rate blind. */
  const monthlyEquivalent = useMemo(() => {
    const amount = Number(rate);
    if (!Number.isFinite(amount) || amount <= 0) return null;
    if (paymentModel === 'hourly') {
      const hours = engagementType === 'part_time' ? Number(hoursPerWeek) || 0 : 40;
      if (hours <= 0) return null;
      return Math.round(amount * hours * 52 / 12);
    }
    return paymentPeriod === 'weekly' ? Math.round(amount * 52 / 12) : Math.round(amount);
  }, [rate, paymentModel, paymentPeriod, engagementType, hoursPerWeek]);

  /** The plan as the billing engine sees it, so the screen and the server agree. */
  const planForBilling = useMemo(() => plan.map((row, index) => ({
    id: row.id || `m${index + 1}`,
    name: String(row.name || '').trim(),
    description: String(row.description || '').trim() || null,
    dueDate: row.dueDate || null,
    percent: row.amountUsd ? null : (Number(row.percent) || null),
    amountUsd: Number(row.amountUsd) || null
  })), [plan]);

  const feeNumber = Number(projectFee);

  /** What each milestone is worth, and what is left unaccounted for. */
  const planValues = useMemo(() => {
    const fee = Number.isFinite(feeNumber) ? feeNumber : 0;
    const values = planForBilling.map(row =>
      row.amountUsd && row.amountUsd > 0
        ? row.amountUsd
        : (row.percent ? Math.round(fee * (row.percent / 100) * 100) / 100 : 0));
    const planned = Math.round(values.reduce((sum, value) => sum + value, 0) * 100) / 100;
    return { values, planned, unallocated: Math.round((fee - planned) * 100) / 100 };
  }, [planForBilling, feeNumber]);

  const planProblem = useMemo(
    () => (isProject ? milestonePlanProblem(planForBilling as any, feeNumber) : null),
    [isProject, planForBilling, feeNumber]
  );

  const updateRow = (index: number, patch: Record<string, any>) =>
    setPlan(rows => rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));

  const addRow = () =>
    setPlan(rows => [...rows, {
      id: `m${Date.now().toString(36)}`, name: '', percent: '', amountUsd: '', dueDate: '', description: ''
    }]);

  const removeRow = (index: number) =>
    setPlan(rows => (rows.length <= 1 ? rows : rows.filter((_, i) => i !== index)));

  const problems = useMemo(() => {
    const found: string[] = [];
    if (!roleTitle.trim()) found.push(isProject ? 'Give the project a title.' : 'Give the role a title.');
    if (isProject) {
      if (!(feeNumber > 0)) found.push('Set the project fee.');
      if (planProblem) found.push(planProblem);
      if (!startDate) found.push('Set a start date.');
      return found;
    }
    if (!(Number(rate) > 0)) found.push('Set a rate.');
    if (!startDate) found.push('Set a start date.');
    if (engagementType === 'part_time' && !(Number(hoursPerWeek) > 0)) {
      found.push('Say how many hours a week.');
    }
    if (durationType === 'fixed_term' && !(Number(contractMonths) > 0)) {
      found.push('Say how many months.');
    }
    const day = Number(paymentDueDay);
    if (!Number.isInteger(day) || day < 1 || day > 28) {
      found.push('The payment day must be between 1 and 28.');
    }
    return found;
  }, [roleTitle, rate, startDate, engagementType, hoursPerWeek, durationType, contractMonths,
      paymentDueDay, isProject, feeNumber, planProblem]);

  const submit = async () => {
    if (problems.length > 0 || submitting) return;
    setError('');
    setSubmitting(true);
    try {
      const response = await apiFetch('/api/offers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          matchId,
          requestId: request?.id,
          talentId: talent?.id,
          roleTitle: roleTitle.trim(),
          serviceType: request?.serviceType,
          engagementType,
          hoursPerWeek: engagementType === 'part_time' ? Number(hoursPerWeek) : null,
          contractDurationType: durationType,
          contractMonths: durationType === 'fixed_term' ? Number(contractMonths) : null,
          paymentModel,
          paymentPeriod,
          paymentDueDay: Number(paymentDueDay),
          proposedRateUsd: isProject ? feeNumber : Number(rate),
          projectFeeUsd: isProject ? feeNumber : undefined,
          milestones: isProject ? planForBilling : undefined,
          proposedStartDate: startDate,
          clientNote: note.trim(),
          entryPoint: entryPoint || 'matched_talent_page'
        })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error || `The offer could not be sent (${response.status}).`);
      }
      onCreated?.(payload.offer);
      setSent(payload.offer || {});
    } catch (err: any) {
      setError(err?.message || 'The offer could not be sent.');
    } finally {
      setSubmitting(false);
    }
  };

  const label: React.CSSProperties = {
    fontSize: '11px', fontWeight: 800, letterSpacing: '0.08em',
    textTransform: 'uppercase', color: '#64748B', margin: '0 0 10px 0'
  };
  const input: React.CSSProperties = {
    width: '100%', padding: '11px 13px', borderRadius: '10px',
    border: '1px solid #CBD5E1', fontSize: '13.5px', boxSizing: 'border-box',
    fontFamily: 'inherit'
  };

  const choice = (
    options: { value: string; label: string; hint: string }[],
    value: string,
    onPick: (next: string) => void
  ) => (
    <div style={{ display: 'grid', gap: '8px' }}>
      {options.map(option => {
        const active = value === option.value;
        return (
          <button
            key={option.value}
            onClick={() => onPick(option.value)}
            style={{
              textAlign: 'left', padding: '12px 14px', borderRadius: '12px',
              border: active ? '2px solid #2563EB' : '1px solid #E2E8F0',
              background: active ? '#EFF6FF' : '#FFFFFF', cursor: 'pointer'
            }}
          >
            <div style={{ fontSize: '13.5px', fontWeight: 800, color: active ? '#1D4ED8' : '#0F172A' }}>
              {option.label}
            </div>
            <div style={{ fontSize: '11.5px', color: '#64748B', marginTop: '2px' }}>{option.hint}</div>
          </button>
        );
      })}
    </div>
  );

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Make an offer to ${talent?.name}`}
      style={{ position: 'fixed', inset: 0, zIndex: 1200, display: 'flex', justifyContent: 'flex-end' }}
    >
      <div
        onClick={onClose}
        style={{ position: 'absolute', inset: 0, background: 'rgba(15,23,42,0.45)', backdropFilter: 'blur(3px)' }}
      />

      <aside
        style={{
          position: 'relative', width: '100%', maxWidth: '580px', height: '100%',
          background: '#F8FAFC', boxShadow: '-24px 0 60px rgba(15,23,42,0.18)',
          display: 'flex', flexDirection: 'column',
          animation: 'kongilaDrawerIn 220ms cubic-bezier(0.22, 1, 0.36, 1)'
        }}
      >
        <style>{`
          @keyframes kongilaDrawerIn {
            from { transform: translateX(32px); opacity: 0; }
            to   { transform: translateX(0);    opacity: 1; }
          }
        `}</style>

        <header style={{
          padding: '22px 26px 18px', background: '#FFFFFF',
          borderBottom: '1px solid #E2E8F0', flexShrink: 0,
          display: 'flex', alignItems: 'flex-start', gap: '12px'
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 style={{ margin: 0, fontSize: '19px', fontWeight: 800, color: '#0F172A' }}>
              Make an offer
            </h2>
            <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#475569' }}>
              {talent?.name} · {request?.title || request?.roleTitle || 'your role'}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              background: '#F1F5F9', border: 'none', borderRadius: '10px', width: '34px',
              height: '34px', cursor: 'pointer', fontSize: '18px', color: '#475569', lineHeight: 1
            }}
          >
            ×
          </button>
        </header>

        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 26px 26px', display: 'grid', gap: '22px' }}>
          {sent ? (
            <div style={{ display: 'grid', gap: '18px', alignContent: 'start' }}>
              <div style={{
                display: 'flex', gap: '12px', alignItems: 'flex-start', padding: '16px',
                borderRadius: '14px', background: '#ECFDF5', border: '1px solid #A7F3D0'
              }}>
                <span aria-hidden style={{ fontSize: '20px', lineHeight: 1 }}>✓</span>
                <div>
                  <div style={{ fontSize: '15px', fontWeight: 800, color: '#065F46' }}>
                    Offer sent to your Kongila team
                  </div>
                  <div style={{ fontSize: '13px', color: '#047857', marginTop: '3px', lineHeight: 1.55 }}>
                    {talent?.name} has not seen it yet. Kongila reviews the terms first, because
                    they become the contract Kongila signs as employer of record.
                  </div>
                </div>
              </div>
              <div>
                <div style={{ ...label, marginBottom: '10px' }}>What happens next</div>
                <InterviewStatusTrail
                  steps={[
                    { label: 'Submitted', state: 'done' },
                    { label: 'Kongila review', state: 'current' },
                    { label: 'With candidate', state: 'upcoming' },
                    { label: 'Accepted', state: 'upcoming' }
                  ]}
                  detail={describeOfferStage('submitted').detail}
                />
              </div>
            </div>
          ) : (
            <>
              <section>
                <h3 style={label}>{isProject ? 'Project' : 'Role'}</h3>
                <input
                  value={roleTitle}
                  onChange={event => setRoleTitle(event.target.value)}
                  placeholder={isProject ? 'Customer portal rebuild' : 'Backend Engineer'}
                  style={input}
                />
              </section>

              {isProject && (
                <>
                  <section>
                    <h3 style={label}>Project fee</h3>
                    <input
                      type="number" min={0}
                      value={projectFee}
                      onChange={event => setProjectFee(event.target.value)}
                      placeholder="48000"
                      style={input}
                    />
                    <div style={{ fontSize: '12px', color: '#64748B', marginTop: '6px', lineHeight: 1.55 }}>
                      The whole fee for the work, not a monthly rate. Every invoice on this project
                      comes out of it.
                    </div>
                  </section>

                  <section>
                    <h3 style={label}>Payment milestones</h3>
                    <div style={{ fontSize: '12px', color: '#64748B', marginBottom: '12px', lineHeight: 1.55 }}>
                      A project is invoiced as each milestone is delivered, so these are both the
                      delivery plan and the payment schedule. Give a percentage of the fee or a
                      fixed amount, not both.
                    </div>

                    <div style={{ display: 'grid', gap: '10px' }}>
                      {plan.map((row, index) => (
                        <div key={row.id || index} style={{
                          background: '#FFFFFF', border: '1px solid #E2E8F0',
                          borderRadius: '12px', padding: '12px 13px'
                        }}>
                          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '8px' }}>
                            <span style={{
                              width: '22px', height: '22px', borderRadius: '7px', background: '#EFF6FF',
                              color: '#1D4ED8', fontSize: '11px', fontWeight: 800,
                              display: 'grid', placeItems: 'center', flexShrink: 0
                            }}>{index + 1}</span>
                            <input
                              value={row.name}
                              onChange={event => updateRow(index, { name: event.target.value })}
                              placeholder="What is delivered"
                              style={{ ...input, padding: '8px 11px', fontSize: '13px' }}
                            />
                            <button
                              type="button"
                              onClick={() => removeRow(index)}
                              aria-label={`Remove milestone ${index + 1}`}
                              disabled={plan.length <= 1}
                              style={{
                                background: 'none', border: 'none', color: plan.length <= 1 ? '#CBD5E1' : '#94A3B8',
                                fontSize: '17px', cursor: plan.length <= 1 ? 'not-allowed' : 'pointer',
                                padding: '0 2px', lineHeight: 1, flexShrink: 0
                              }}
                            >×</button>
                          </div>

                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                            <div>
                              <label style={{ fontSize: '11px', fontWeight: 700, color: '#64748B', display: 'block', marginBottom: '4px' }}>
                                % of fee
                              </label>
                              <input
                                type="number" min={0} max={100}
                                value={row.percent}
                                disabled={Boolean(row.amountUsd)}
                                onChange={event => updateRow(index, { percent: event.target.value })}
                                style={{ ...input, padding: '8px 10px', fontSize: '13px',
                                  background: row.amountUsd ? '#F1F5F9' : '#FFFFFF' }}
                              />
                            </div>
                            <div>
                              <label style={{ fontSize: '11px', fontWeight: 700, color: '#64748B', display: 'block', marginBottom: '4px' }}>
                                or amount
                              </label>
                              <input
                                type="number" min={0}
                                value={row.amountUsd}
                                onChange={event => updateRow(index, { amountUsd: event.target.value })}
                                style={{ ...input, padding: '8px 10px', fontSize: '13px' }}
                              />
                            </div>
                            <div>
                              <label style={{ fontSize: '11px', fontWeight: 700, color: '#64748B', display: 'block', marginBottom: '4px' }}>
                                Due
                              </label>
                              <input
                                type="date"
                                value={row.dueDate}
                                onChange={event => updateRow(index, { dueDate: event.target.value })}
                                style={{ ...input, padding: '8px 10px', fontSize: '12.5px' }}
                              />
                            </div>
                          </div>

                          <div style={{ fontSize: '12px', color: '#475569', marginTop: '8px' }}>
                            Worth <strong>${planValues.values[index]?.toLocaleString() || '0'}</strong>
                          </div>
                        </div>
                      ))}
                    </div>

                    <button
                      type="button"
                      onClick={addRow}
                      style={{
                        marginTop: '10px', padding: '9px 14px', borderRadius: '10px',
                        border: '1px dashed #CBD5E1', background: '#FFFFFF', color: '#2563EB',
                        fontWeight: 700, fontSize: '12.5px', cursor: 'pointer', width: '100%'
                      }}
                    >
                      + Add a milestone
                    </button>

                    <div style={{
                      marginTop: '12px', padding: '11px 13px', borderRadius: '10px',
                      background: planProblem ? '#FFFBEB' : '#ECFDF5',
                      border: `1px solid ${planProblem ? '#FDE68A' : '#A7F3D0'}`,
                      fontSize: '12.5px', lineHeight: 1.55,
                      color: planProblem ? '#92400E' : '#065F46'
                    }}>
                      {planProblem || (
                        <>Milestones account for the whole <strong>${planValues.planned.toLocaleString()}</strong> fee.</>
                      )}
                    </div>
                  </section>
                </>
              )}

              {!isProject && (
              <section>
                <h3 style={label}>Commitment</h3>
                {choice(ENGAGEMENTS, engagementType, setEngagementType)}
                {engagementType === 'part_time' && (
                  <div style={{ marginTop: '10px' }}>
                    <label style={{ fontSize: '12px', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '6px' }}>
                      Hours a week
                    </label>
                    <input
                      type="number" min={1} max={40}
                      value={hoursPerWeek}
                      onChange={event => setHoursPerWeek(event.target.value)}
                      style={input}
                    />
                  </div>
                )}
              </section>
              )}

              {!isProject && (
              <section>
                <h3 style={label}>Length</h3>
                {choice(DURATIONS, durationType, setDurationType)}
                {durationType === 'fixed_term' && (
                  <div style={{ marginTop: '10px' }}>
                    <label style={{ fontSize: '12px', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '6px' }}>
                      Months
                    </label>
                    <input
                      type="number" min={1} max={60}
                      value={contractMonths}
                      onChange={event => setContractMonths(event.target.value)}
                      style={input}
                    />
                  </div>
                )}
              </section>
              )}

              {!isProject && (
              <section>
                <h3 style={label}>How they are paid</h3>
                {choice(PAYMENT_MODELS, paymentModel, setPaymentModel)}

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '12px' }}>
                  <div>
                    <label style={{ fontSize: '12px', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '6px' }}>
                      Paid
                    </label>
                    <select
                      value={paymentPeriod}
                      onChange={event => setPaymentPeriod(event.target.value)}
                      style={{ ...input, cursor: 'pointer' }}
                    >
                      <option value="monthly">Monthly</option>
                      <option value="weekly">Weekly</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: '12px', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '6px' }}>
                      On day
                    </label>
                    <input
                      type="number" min={1} max={28}
                      value={paymentDueDay}
                      onChange={event => setPaymentDueDay(event.target.value)}
                      style={input}
                    />
                  </div>
                </div>

                <div style={{ marginTop: '12px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '6px' }}>
                    {rateLabel}
                  </label>
                  <input
                    type="number" min={0}
                    value={rate}
                    onChange={event => setRate(event.target.value)}
                    style={input}
                  />
                  {monthlyEquivalent !== null && (
                    <div style={{ fontSize: '12px', color: '#475569', marginTop: '6px' }}>
                      About <strong>${monthlyEquivalent.toLocaleString()}</strong> a month
                      {paymentModel === 'hourly'
                        ? ` at ${engagementType === 'part_time' ? hoursPerWeek : 40} hours a week`
                        : ''}.
                    </div>
                  )}
                </div>
              </section>
              )}

              <section>
                <h3 style={label}>Start date</h3>
                <input
                  type="date"
                  value={startDate}
                  min={new Date().toISOString().split('T')[0]}
                  onChange={event => setStartDate(event.target.value)}
                  style={input}
                />
              </section>

              <section>
                <h3 style={label}>
                  Anything Kongila should know{' '}
                  <span style={{ textTransform: 'none', letterSpacing: 0, fontWeight: 600 }}>(optional)</span>
                </h3>
                <textarea
                  value={note}
                  onChange={event => setNote(event.target.value)}
                  rows={3}
                  placeholder="Probation, equipment, leave, anything you have already discussed with the candidate."
                  style={{ ...input, resize: 'vertical', lineHeight: 1.6 }}
                />
              </section>

              <p style={{ margin: 0, fontSize: '12px', color: '#94A3B8', lineHeight: 1.6 }}>
                {isProject
                  ? 'These terms and this milestone plan become the contract Kongila signs, and every invoice is raised against them, so they are reviewed here before the candidate sees them.'
                  : 'These terms become the contract Kongila signs as employer of record, so they are reviewed here before the candidate sees them. You will be told if anything needs changing.'}
              </p>
            </>
          )}
        </div>

        <footer style={{
          padding: '15px 26px', background: '#FFFFFF', borderTop: '1px solid #E2E8F0',
          display: 'grid', gap: '11px', flexShrink: 0
        }}>
          {error && !sent && (
            <div role="alert" style={{
              padding: '11px 13px', background: '#FEF2F2', border: '1px solid #FECACA',
              color: '#B91C1C', borderRadius: '10px', fontSize: '12.5px', lineHeight: 1.5
            }}>
              {error}
            </div>
          )}
          {!sent && problems.length > 0 && (
            <div style={{ fontSize: '12px', color: '#92400E', lineHeight: 1.5 }}>
              {problems[0]}
            </div>
          )}

          {sent ? (
            <button
              onClick={onClose}
              style={{
                padding: '12px 18px', borderRadius: '10px', border: 'none',
                background: '#2563EB', fontWeight: 800, fontSize: '13px', color: '#FFFFFF', cursor: 'pointer'
              }}
            >
              Done
            </button>
          ) : (
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={onClose}
                style={{
                  padding: '12px 18px', borderRadius: '10px', border: '1px solid #E2E8F0',
                  background: '#FFFFFF', fontWeight: 700, fontSize: '13px', color: '#475569', cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                onClick={submit}
                disabled={problems.length > 0 || submitting}
                style={{
                  flex: 1, padding: '12px 18px', borderRadius: '10px', border: 'none',
                  background: (problems.length > 0 || submitting) ? '#CBD5E1' : '#13866F',
                  fontWeight: 800, fontSize: '13px', color: '#FFFFFF',
                  cursor: (problems.length > 0 || submitting) ? 'not-allowed' : 'pointer'
                }}
              >
                {submitting ? 'Sending…' : 'Send offer to Kongila'}
              </button>
            </div>
          )}
        </footer>
      </aside>
    </div>
  );
}
