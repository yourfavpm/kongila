import test from 'node:test';
import assert from 'node:assert/strict';

import {
  serviceLineOf,
  billingModelFor,
  isRecurring,
  feeFor,
  feeIsSet,
  splitRate,
  periodsDue,
  draftsForContract,
  planInvoices,
  describePlan,
  money,
  toCents,
  fromCents,
  sumMoney,
  allocate,
  scheduleProblem,
  instalmentsFor,
  amountDueBy,
  milestoneProblem,
  milestonePlanProblem,
  milestoneDrafts,
  groupDraftsIntoInvoices,
  upcomingInvoices
} from './billing.ts';

const fees = [
  { serviceLine: 'placement' as const, clientFeePct: 0.2, talentCommissionPct: 0 },
  { serviceLine: 'outsourcing' as const, clientFeePct: 0.15, talentCommissionPct: 0.1 },
  { serviceLine: 'managed_workforce' as const, clientFeePct: 0.25, talentCommissionPct: 0.1 },
  { serviceLine: 'project' as const, clientFeePct: 0.3, talentCommissionPct: 0.15 }
];

const contract = (over: any = {}) => ({
  id: 'c1',
  clientId: 'client1',
  talentId: 'talent1',
  talentName: 'Ada Okafor',
  serviceType: 'Managed Workforce',
  status: 'active',
  rateAmount: 2000,
  startDate: '2026-09-01',
  billedThrough: null,
  ...over
});

const asOf = new Date('2026-11-15T00:00:00Z');

// ─── Service lines ───────────────────────────────────────────────────────────

test('both spellings of each service line resolve', () => {
  // ServiceType admits the form label and the database slug, and contracts
  // carry whichever one created them.
  assert.equal(serviceLineOf('Hire Talent'), 'placement');
  assert.equal(serviceLineOf('placement'), 'placement');
  assert.equal(serviceLineOf('Outsource Talent'), 'outsourcing');
  assert.equal(serviceLineOf('Project Execution'), 'project');
  assert.equal(serviceLineOf('managed_workforce'), 'managed_workforce');
});

test('an unknown service type is null, not a guess', () => {
  assert.equal(serviceLineOf('Consulting'), null);
  assert.equal(serviceLineOf(''), null);
  assert.equal(billingModelFor('Consulting'), null);
});

test('the four lines bill three different ways', () => {
  // Every service used to be written as a monthly rate.
  assert.equal(billingModelFor('Hire Talent'), 'placement_fee');
  assert.equal(billingModelFor('Project Execution'), 'project_fee');
  assert.equal(billingModelFor('Outsource Talent'), 'recurring_monthly');
  assert.equal(billingModelFor('Managed Workforce'), 'recurring_monthly');
  assert.equal(isRecurring('Hire Talent'), false);
  assert.equal(isRecurring('Outsource Talent'), true);
});

// ─── Fees ────────────────────────────────────────────────────────────────────

test('an unconfigured fee is not a zero fee', () => {
  // The difference that matters: zero percent is a decision, null is nobody
  // having made one.
  const unset = { serviceLine: 'project' as const, clientFeePct: null, talentCommissionPct: null };
  assert.equal(feeIsSet(unset), false);
  assert.equal(feeIsSet({ serviceLine: 'project', clientFeePct: 0, talentCommissionPct: 0 }), true);
  assert.equal(feeIsSet(null), false);
});

test('the fee is found by line, whichever spelling the contract carries', () => {
  assert.equal(feeFor('Managed Workforce', fees)?.clientFeePct, 0.25);
  assert.equal(feeFor('managed_workforce', fees)?.clientFeePct, 0.25);
  assert.equal(feeFor('Consulting', fees), null);
});

test('the client pays more than the candidate receives', () => {
  // The whole point of the fee config. Before this, the platform billed the
  // client exactly what it paid the candidate and kept nothing.
  const split = splitRate(2000, fees[2]);
  assert.equal(split.clientTotal, 2500);
  assert.equal(split.talentNet, 1800);
  assert.equal(split.platformMargin, 700);
});

test('money is held to whole cents', () => {
  assert.equal(money(0.1 + 0.2), 0.3);
  assert.equal(splitRate(1999.99, fees[1]).clientTotal, 2299.99);
});

// ─── Periods ─────────────────────────────────────────────────────────────────

test('a never-billed contract owes every month since it started', () => {
  assert.deepEqual(periodsDue(contract(), asOf), ['2026-09', '2026-10', '2026-11']);
});

test('a missed run catches up instead of skipping the gap', () => {
  assert.deepEqual(
    periodsDue(contract({ billedThrough: '2026-09' }), asOf),
    ['2026-10', '2026-11']
  );
});

test('running the same month twice bills nothing the second time', () => {
  assert.deepEqual(periodsDue(contract({ billedThrough: '2026-11' }), asOf), []);
});

test('an ended engagement stops at its last month', () => {
  assert.deepEqual(
    periodsDue(contract({ endDate: '2026-10-14' }), asOf),
    ['2026-09', '2026-10']
  );
});

test('a year boundary rolls over correctly', () => {
  assert.deepEqual(
    periodsDue(contract({ billedThrough: '2026-11' }), new Date('2027-02-03T00:00:00Z')),
    ['2026-12', '2027-01', '2027-02']
  );
});

// ─── Drafting ────────────────────────────────────────────────────────────────

test('a recurring contract produces one invoice per owed month', () => {
  const { drafts, skipped } = draftsForContract(contract({ billedThrough: '2026-10' }), fees, asOf);
  assert.equal(skipped.length, 0);
  assert.equal(drafts.length, 1);
  assert.equal(drafts[0].period, '2026-11');
  assert.equal(drafts[0].total, 2500);
  assert.equal(drafts[0].talentPayout, 1800);
  assert.equal(drafts[0].platformMargin, 700);
});

test('a placement is billed once and never again', () => {
  const placement = contract({
    serviceType: 'Hire Talent', placementFeeUsd: 9000, rateAmount: 0
  });
  const first = draftsForContract(placement, fees, asOf);
  assert.equal(first.drafts.length, 1);
  assert.equal(first.drafts[0].total, 10800);
  assert.deepEqual(first.drafts[0].lines.map(line => line.amount), [9000, 1800]);
  assert.equal(first.drafts[0].period, null);

  const second = draftsForContract({ ...placement, billedThrough: '2026-09' }, fees, asOf);
  assert.equal(second.drafts.length, 0, 'a one-time fee is one time');
});

test('a placement pays the candidate nothing through Kongila', () => {
  // They become the client's employee. Kongila keeps the whole fee.
  const { drafts } = draftsForContract(
    contract({ serviceType: 'placement', placementFeeUsd: 9000 }), fees, asOf
  );
  assert.equal(drafts[0].talentPayout, null);
  assert.equal(drafts[0].platformMargin, 10800);
});

test('a project is billed its agreed fee, not a monthly rate', () => {
  const { drafts } = draftsForContract(
    contract({ serviceType: 'Project Execution', projectFeeUsd: 12000, rateAmount: 2000 }),
    fees, asOf
  );
  assert.equal(drafts.length, 1);
  assert.equal(drafts[0].total, 15600);
  assert.equal(drafts[0].talentPayout, 10200);
  assert.equal(drafts[0].talentGross, 12000);
  assert.equal(drafts[0].platformMargin, 5400);
});

test('a one-time contract with no agreed fee is refused, not billed monthly', () => {
  // The old behaviour would have invoiced this every month forever.
  const { drafts, skipped } = draftsForContract(
    contract({ serviceType: 'Hire Talent', placementFeeUsd: null }), fees, asOf
  );
  assert.equal(drafts.length, 0);
  assert.match(skipped[0].reason, /placement fee cannot be worked out/);
});

test('an unconfigured service line refuses rather than billing at zero margin', () => {
  const bare = [{ serviceLine: 'managed_workforce' as const, clientFeePct: null, talentCommissionPct: null }];
  const { drafts, skipped } = draftsForContract(contract(), bare, asOf);
  assert.equal(drafts.length, 0);
  assert.match(skipped[0].reason, /no fee is configured for managed workforce/);
});

test('an unknown service type names itself in the refusal', () => {
  const { skipped } = draftsForContract(contract({ serviceType: 'Consulting' }), fees, asOf);
  assert.match(skipped[0].reason, /Consulting/);
});

test('a contract that is not live is passed over silently', () => {
  // Not an error. There is simply nothing to bill yet.
  for (const status of ['pending', 'Pending Signatures', 'terminated', 'ended']) {
    const { drafts, skipped } = draftsForContract(contract({ status }), fees, asOf);
    assert.equal(drafts.length, 0, status);
    assert.equal(skipped.length, 0, status);
  }
});

test('display and database spellings of a live status both bill', () => {
  assert.equal(draftsForContract(contract({ status: 'Signed' }), fees, asOf).drafts.length, 3);
  assert.equal(draftsForContract(contract({ status: 'fully_signed' }), fees, asOf).drafts.length, 3);
});

test('a zero rate is refused rather than invoiced for nothing', () => {
  const { skipped } = draftsForContract(contract({ rateAmount: 0 }), fees, asOf);
  assert.match(skipped[0].reason, /rate is zero or missing/);
});

// ─── The run ─────────────────────────────────────────────────────────────────

test('a run reports what it could not bill alongside what it could', () => {
  const plan = planInvoices([
    contract({ id: 'c1', billedThrough: '2026-10' }),
    contract({ id: 'c2', serviceType: 'Consulting' }),
    contract({ id: 'c3', status: 'pending' })
  ], fees, asOf);

  assert.equal(plan.drafts.length, 1);
  assert.equal(plan.skipped.length, 1);
  assert.equal(plan.skipped[0].contractId, 'c2');
});

test('the summary states the money, not just the count', () => {
  const plan = planInvoices([contract({ billedThrough: '2026-10' })], fees, asOf);
  assert.match(describePlan(plan), /1 draft invoice for \$2,500/);
});

test('an empty run says so plainly', () => {
  assert.match(describePlan({ drafts: [], skipped: [] }), /Nothing is due/);
});

test('nothing invented: no contracts means no invoices', () => {
  // The old endpoint returned Horizon Fintech for $5,000 and Nexus Health
  // for $3,200 whatever was in the database, including nothing.
  const plan = planInvoices([], fees, asOf);
  assert.deepEqual(plan.drafts, []);
  assert.deepEqual(plan.skipped, []);
});

test('a payout records what the commission was taken from', () => {
  // The candidate is paid a share of the rate, not of what the client was
  // charged. Storing only the net left no way to show how it was reached.
  const { drafts } = draftsForContract(contract({ billedThrough: '2026-10' }), fees, asOf);
  assert.equal(drafts[0].talentGross, 2000);
  assert.equal(drafts[0].talentCommissionPct, 0.1);
  assert.equal(drafts[0].talentPayout, 1800);
  assert.equal(drafts[0].total, 2500, 'the client total is not the payout base');
});

test('an accepted contract keeps its margin snapshot when system fees later change', () => {
  const { drafts } = draftsForContract(contract({
    billedThrough: '2026-10', clientFeePctSnapshot: 0.2, talentCommissionPctSnapshot: 0.15
  }), fees, asOf);
  assert.equal(drafts[0].total, 2400);
  assert.equal(drafts[0].talentPayout, 1700);
  assert.equal(drafts[0].platformMargin, 700);
});

test('a placement carries no payout working, because there is no payout', () => {
  const { drafts } = draftsForContract(
    contract({ serviceType: 'placement', placementFeeUsd: 9000 }), fees, asOf
  );
  assert.equal(drafts[0].talentGross, null);
  assert.equal(drafts[0].talentCommissionPct, null);
});

test('a draft carries the currency the contract is denominated in', () => {
  // Every money row stores the currency and the rate it was written at, so
  // a figure cannot silently change value when a rate moves.
  const { drafts } = draftsForContract(
    contract({ billedThrough: '2026-10', currency: 'NGN' }), fees, asOf
  );
  assert.equal(drafts[0].currency, 'NGN');
});

test('a contract with no currency defaults to USD rather than blank', () => {
  const { drafts } = draftsForContract(contract({ billedThrough: '2026-10' }), fees, asOf);
  assert.equal(drafts[0].currency, 'USD');
});

// ─── Payment schedules ───────────────────────────────────────────────────────

test('a schedule that does not total 100% is refused, not normalised', () => {
  assert.match(
    scheduleProblem({ recurring: true, splits: [{ percent: 50, dayOfMonth: 1 }, { percent: 40, dayOfMonth: 15 }] }) || '',
    /not 100%/
  );
  assert.match(
    scheduleProblem({ recurring: true, splits: [{ percent: 70, dayOfMonth: 1 }, { percent: 40, dayOfMonth: 15 }] }) || '',
    /not 100%/
  );
});

test('a schedule is checked for sane days and no duplicates', () => {
  assert.equal(scheduleProblem({ recurring: true, splits: [{ percent: 100, dayOfMonth: 1 }] }), null);
  assert.match(scheduleProblem({ recurring: true, splits: [] }) || '', /at least one/);
  assert.match(
    scheduleProblem({ recurring: true, splits: [{ percent: 100, dayOfMonth: 0 }] }) || '',
    /between 1 and 31/
  );
  assert.match(
    scheduleProblem({ recurring: true, splits: [{ percent: 50, dayOfMonth: 5 }, { percent: 50, dayOfMonth: 5 }] }) || '',
    /both fall due on day 5/
  );
  assert.equal(scheduleProblem(null), null);
});

test('instalments always add up to the total, to the cent', () => {
  const parts = instalmentsFor(100, {
    schedule: { recurring: true, splits: [
      { percent: 33.34, dayOfMonth: 1 },
      { percent: 33.33, dayOfMonth: 10 },
      { percent: 33.33, dayOfMonth: 20 }
    ] },
    period: '2026-02',
    issuedAt: '2026-02-01'
  });
  assert.equal(parts.length, 3);
  assert.equal(money(parts.reduce((sum, p) => sum + p.amount, 0)), 100);
});

test('an odd total still reconciles exactly', () => {
  for (const total of [0.01, 7.77, 1234.56, 99999.99]) {
    const parts = instalmentsFor(total, {
      schedule: { recurring: true, splits: [{ percent: 60, dayOfMonth: 1 }, { percent: 40, dayOfMonth: 15 }] },
      period: '2026-03',
      issuedAt: '2026-03-01'
    });
    assert.equal(
      money(parts.reduce((sum, p) => sum + p.amount, 0)),
      money(total),
      `${total} did not reconcile`
    );
  }
});

test('a day the month does not have clamps to its last day', () => {
  const parts = instalmentsFor(100, {
    schedule: { recurring: true, splits: [{ percent: 100, dayOfMonth: 31 }] },
    period: '2026-02',
    issuedAt: '2026-02-01'
  });
  assert.equal(parts[0].dueDate, '2026-02-28');
});

test('no schedule means one instalment on the payment terms', () => {
  const parts = instalmentsFor(500, { issuedAt: '2026-01-10', termsDays: 14 });
  assert.deepEqual(parts, [{ label: 'Full amount', percent: 100, dueDate: '2026-01-24', amount: 500 }]);
});

test('a broken schedule falls back to one instalment rather than billing wrongly', () => {
  const parts = instalmentsFor(500, {
    schedule: { recurring: true, splits: [{ percent: 10, dayOfMonth: 1 }] },
    period: '2026-01',
    issuedAt: '2026-01-01'
  });
  assert.equal(parts.length, 1);
  assert.equal(parts[0].amount, 500);
});

test('a non-recurring schedule applies to the first invoice only', () => {
  const schedule = {
    recurring: false,
    splits: [{ percent: 40, dayOfMonth: 1 }, { percent: 60, dayOfMonth: 20 }]
  };
  assert.equal(instalmentsFor(1000, { schedule, period: '2026-01', issuedAt: '2026-01-01', isFirstInvoice: true }).length, 2);
  assert.equal(instalmentsFor(1000, { schedule, period: '2026-02', issuedAt: '2026-02-01', isFirstInvoice: false }).length, 1);
});

test('amountDueBy counts only what has fallen due', () => {
  const parts = instalmentsFor(1000, {
    schedule: { recurring: true, splits: [{ percent: 50, dayOfMonth: 1 }, { percent: 50, dayOfMonth: 15 }] },
    period: '2026-01',
    issuedAt: '2026-01-01'
  });
  assert.equal(amountDueBy(parts, '2026-01-01'), 500);
  assert.equal(amountDueBy(parts, '2026-01-14'), 500);
  assert.equal(amountDueBy(parts, '2026-01-15'), 1000);
});

test('a recurring contract carries its split onto every invoice', () => {
  const { drafts } = draftsForContract(
    {
      id: 'c1', clientId: 'cl', talentId: 't', talentName: 'Ada',
      serviceType: 'outsourcing', status: 'active',
      rateAmount: 1000, startDate: '2026-01-01', currency: 'USD',
      paymentSchedule: { recurring: true, splits: [
        { percent: 60, dayOfMonth: 1, label: 'On the 1st' },
        { percent: 40, dayOfMonth: 15, label: 'On the 15th' }
      ] }
    },
    fees,
    new Date('2026-02-20')
  );

  assert.equal(drafts.length, 2);
  for (const draft of drafts) {
    assert.equal(draft.instalments.length, 2);
    assert.equal(money(draft.instalments.reduce((s, p) => s + p.amount, 0)), draft.total);
    assert.ok(draft.instalments[0].dueDate.endsWith('-01'));
    assert.ok(draft.instalments[1].dueDate.endsWith('-15'));
  }
});

// ─── Placement as a percentage of salary ─────────────────────────────────────

test('a placement fee is a percentage of the annual salary', () => {
  const { drafts } = draftsForContract(
    {
      id: 'p1', clientId: 'cl', talentId: 't', talentName: 'Ada',
      serviceType: 'placement', status: 'active',
      annualSalaryUsd: 60000, placementFeePct: 0.15, currency: 'USD'
    },
    fees,
    new Date('2026-01-10')
  );

  assert.equal(drafts.length, 1);
  // 15% of 60,000 is 9,000, plus the 20% placement client fee.
  assert.equal(drafts[0].lines[0].amount, 9000);
  assert.equal(drafts[0].total, money(9000 * 1.2));
  assert.match(drafts[0].lines[0].description, /15% of 60,000 annual salary/);
});

test('a flat placement fee wins over the percentage', () => {
  const { drafts } = draftsForContract(
    {
      id: 'p2', clientId: 'cl', talentId: 't', talentName: 'Ada',
      serviceType: 'placement', status: 'active',
      annualSalaryUsd: 60000, placementFeePct: 0.15, placementFeeUsd: 7500, currency: 'USD'
    },
    fees,
    new Date('2026-01-10')
  );
  assert.equal(drafts[0].lines[0].amount, 7500);
  assert.doesNotMatch(drafts[0].lines[0].description, /%/);
});

test('an annual salary is inferred from the monthly rate when it is not given', () => {
  const { drafts } = draftsForContract(
    {
      id: 'p3', clientId: 'cl', talentId: 't', talentName: 'Ada',
      serviceType: 'placement', status: 'active',
      rateAmount: 5000, placementFeePct: 0.2, currency: 'USD'
    },
    fees,
    new Date('2026-01-10')
  );
  // 20% of 5,000 x 12.
  assert.equal(drafts[0].lines[0].amount, 12000);
});

test('a placement with no fee basis is refused by name, not billed at zero', () => {
  const { drafts, skipped } = draftsForContract(
    { id: 'p4', clientId: 'cl', talentId: 't', talentName: 'Ada', serviceType: 'placement', status: 'active' },
    fees,
    new Date('2026-01-10')
  );
  assert.equal(drafts.length, 0);
  assert.equal(skipped.length, 1);
  assert.match(skipped[0].reason, /placement fee cannot be worked out/);
});

test('a placement never produces a payout, however it was priced', () => {
  const { drafts } = draftsForContract(
    {
      id: 'p5', clientId: 'cl', talentId: 't', serviceType: 'placement', status: 'active',
      annualSalaryUsd: 100000, placementFeePct: 0.1
    },
    fees,
    new Date('2026-01-10')
  );
  assert.equal(drafts[0].talentPayout, null);
});

// ─── Seats ───────────────────────────────────────────────────────────────────

test('a managed team bills per seat and still pays one person once', () => {
  const { drafts } = draftsForContract(
    {
      id: 'm1', clientId: 'cl', talentId: 't', talentName: 'Support pod',
      serviceType: 'managed_workforce', status: 'active',
      rateAmount: 1000, seats: 5, startDate: '2026-01-01', currency: 'USD'
    },
    fees,
    new Date('2026-01-31')
  );

  const draft = drafts[0];
  assert.equal(draft.lines[0].quantity, 5);
  assert.equal(draft.total, money(draft.lines[0].unitAmount * 5));
  // One contract, one person, one payout.
  assert.equal(draft.talentGross, 1000);
});

test('seats are ignored on lines that are not managed teams', () => {
  const { drafts } = draftsForContract(
    {
      id: 'o1', clientId: 'cl', talentId: 't', serviceType: 'outsourcing', status: 'active',
      rateAmount: 1000, seats: 4, startDate: '2026-01-01'
    },
    fees,
    new Date('2026-01-31')
  );
  assert.equal(drafts[0].lines[0].quantity, 1);
});

// ─── Milestones ──────────────────────────────────────────────────────────────

test('milestones that do not total the fee are refused', () => {
  assert.match(
    milestoneProblem([{ id: 'a', name: 'Deposit', percent: 40 }, { id: 'b', name: 'Delivery', percent: 40 }]) || '',
    /not 100%/
  );
  assert.equal(
    milestoneProblem([{ id: 'a', name: 'Deposit', percent: 40 }, { id: 'b', name: 'Delivery', percent: 60 }]),
    null
  );
});

test('a fixed deposit alongside percentages is allowed', () => {
  assert.equal(
    milestoneProblem([
      { id: 'a', name: 'Deposit', amountUsd: 2000 },
      { id: 'b', name: 'Delivery', percent: 100 }
    ]),
    null
  );
});

test('milestones need an id and a name', () => {
  assert.match(milestoneProblem([{ id: '', name: 'x', percent: 100 }]) || '', /needs an id/);
  assert.match(milestoneProblem([{ id: 'a', name: '', percent: 100 }]) || '', /needs a name/);
  assert.match(milestoneProblem([]) || '', /at least one milestone/);
});

test('only a delivered milestone is invoiced', () => {
  const contract = {
    id: 'pr1', clientId: 'cl', talentId: 't', talentName: 'Ada',
    serviceType: 'project', status: 'active', projectFeeUsd: 10000, currency: 'USD'
  };
  const milestones = [
    { id: 'a', name: 'Deposit', percent: 40, status: 'delivered' },
    { id: 'b', name: 'Build', percent: 40, status: 'pending' },
    { id: 'c', name: 'Handover', percent: 20, status: 'invoiced' }
  ];

  const { drafts } = milestoneDrafts(contract, milestones, fees, new Date('2026-02-01'));
  assert.equal(drafts.length, 1);
  assert.equal(drafts[0].milestoneId, 'a');
  assert.equal(drafts[0].lines[0].amount, 4000);
  // A project is delivered by a Kongila candidate, so they are paid.
  assert.equal(drafts[0].talentGross, 4000);
});

test('a milestone due but not delivered is a late project, not a bill', () => {
  const { drafts } = milestoneDrafts(
    { id: 'pr2', clientId: 'cl', talentId: 't', serviceType: 'project', status: 'active', projectFeeUsd: 5000 },
    [{ id: 'a', name: 'Overdue', percent: 100, dueDate: '2020-01-01', status: 'pending' }],
    fees,
    new Date('2026-02-01')
  );
  assert.equal(drafts.length, 0);
});

test('milestones on a non-project engagement are refused', () => {
  const { skipped } = milestoneDrafts(
    { id: 'x', clientId: 'cl', talentId: 't', serviceType: 'outsourcing', status: 'active' },
    [{ id: 'a', name: 'A', percent: 100, status: 'delivered' }],
    fees,
    new Date('2026-02-01')
  );
  assert.match(skipped[0].reason, /only apply to project engagements/);
});

// ─── Grouping ────────────────────────────────────────────────────────────────

test('a managed team becomes one invoice with a line per seat', () => {
  const contracts = ['a', 'b', 'c'].map(id => ({
    id, clientId: 'cl', talentId: `t-${id}`, talentName: `Member ${id}`,
    serviceType: 'managed_workforce', status: 'active',
    rateAmount: 1000, startDate: '2026-01-01', currency: 'USD'
  }));

  const plan = planInvoices(contracts, fees, new Date('2026-01-31'));
  const invoices = groupDraftsIntoInvoices(plan.drafts, { issuedAt: '2026-01-31' });

  assert.equal(invoices.length, 1);
  assert.equal(invoices[0].lines.length, 3);
  assert.equal(invoices[0].drafts.length, 3);
  assert.equal(invoices[0].total, money(plan.drafts.reduce((sum, d) => sum + d.total, 0)));
});

test('two clients are never combined, and nor are two service lines', () => {
  const plan = planInvoices(
    [
      { id: 'a', clientId: 'one', talentId: 't1', serviceType: 'managed_workforce', status: 'active', rateAmount: 1000, startDate: '2026-01-01' },
      { id: 'b', clientId: 'two', talentId: 't2', serviceType: 'managed_workforce', status: 'active', rateAmount: 1000, startDate: '2026-01-01' },
      { id: 'c', clientId: 'one', talentId: 't3', serviceType: 'outsourcing', status: 'active', rateAmount: 1000, startDate: '2026-01-01' }
    ],
    fees,
    new Date('2026-01-31')
  );
  const invoices = groupDraftsIntoInvoices(plan.drafts, { issuedAt: '2026-01-31' });
  assert.equal(invoices.length, 3);
});

test('grouped instalments are recalculated on the grouped total', () => {
  const contracts = ['a', 'b'].map(id => ({
    id, clientId: 'cl', talentId: `t-${id}`,
    serviceType: 'managed_workforce', status: 'active',
    rateAmount: 1000, startDate: '2026-01-01', currency: 'USD'
  }));
  const plan = planInvoices(contracts, fees, new Date('2026-01-31'));
  const invoices = groupDraftsIntoInvoices(plan.drafts, {
    issuedAt: '2026-01-31',
    schedulesByClient: { cl: { recurring: true, splits: [{ percent: 50, dayOfMonth: 1 }, { percent: 50, dayOfMonth: 15 }] } }
  });

  assert.equal(invoices[0].instalments.length, 2);
  assert.equal(
    money(invoices[0].instalments.reduce((sum, p) => sum + p.amount, 0)),
    invoices[0].total
  );
});

// ─── Telling finance ─────────────────────────────────────────────────────────

test('upcoming invoices list recurring engagements and nothing else', () => {
  const upcoming = upcomingInvoices(
    [
      { id: 'a', clientId: 'cl', talentId: 't', clientName: 'Acme', serviceType: 'outsourcing', status: 'active', rateAmount: 1000, startDate: '2026-01-01' },
      { id: 'b', clientId: 'cl', talentId: 't2', serviceType: 'placement', status: 'active', annualSalaryUsd: 60000, placementFeePct: 0.15 },
      { id: 'c', clientId: 'cl', talentId: 't3', serviceType: 'outsourcing', status: 'active', rateAmount: 1000, startDate: '2026-01-01', engagementStatus: 'paused' }
    ],
    fees,
    new Date('2026-01-28'),
    7
  );

  assert.ok(upcoming.length >= 1);
  assert.ok(upcoming.every(entry => entry.contractId === 'a'));
  assert.ok(upcoming.every(entry => entry.serviceLine === 'outsourcing'));
});

test('upcoming invoices come back in date order', () => {
  const upcoming = upcomingInvoices(
    [
      { id: 'a', clientId: 'cl', talentId: 't', serviceType: 'outsourcing', status: 'active', rateAmount: 1000, startDate: '2026-01-01',
        paymentSchedule: { recurring: true, splits: [{ percent: 100, dayOfMonth: 20 }] } },
      { id: 'b', clientId: 'cl', talentId: 't2', serviceType: 'outsourcing', status: 'active', rateAmount: 1000, startDate: '2026-01-01',
        paymentSchedule: { recurring: true, splits: [{ percent: 100, dayOfMonth: 5 }] } }
    ],
    fees,
    new Date('2026-01-10'),
    7
  );
  const dates = upcoming.map(entry => entry.raiseOn);
  assert.deepEqual(dates, [...dates].sort());
});

// ─── Milestone plans against the project fee ─────────────────────────────────

test('percentages totalling 100 reconcile against any fee', () => {
  const plan = [
    { id: 'm1', name: 'Discovery', percent: 30 },
    { id: 'm2', name: 'Build', percent: 50 },
    { id: 'm3', name: 'Handover', percent: 20 }
  ];
  assert.equal(milestonePlanProblem(plan, 48000), null);
  assert.equal(milestonePlanProblem(plan, 7), null);
});

test('amounts totalling the fee reconcile', () => {
  assert.equal(milestonePlanProblem([
    { id: 'm1', name: 'Deposit', amountUsd: 5000 },
    { id: 'm2', name: 'Delivery', amountUsd: 7000 }
  ], 12000), null);
});

test('a plan that under-bills the fee is refused, and says by how much', () => {
  const problem = milestonePlanProblem([
    { id: 'm1', name: 'Deposit', amountUsd: 5000 },
    { id: 'm2', name: 'Delivery', amountUsd: 4000 }
  ], 12000);
  assert.ok(problem);
  assert.match(problem, /3000/);
  assert.match(problem, /never be invoiced/);
});

test('a plan that over-bills the fee is refused', () => {
  const problem = milestonePlanProblem([
    { id: 'm1', name: 'Deposit', amountUsd: 9000 },
    { id: 'm2', name: 'Delivery', amountUsd: 7000 }
  ], 12000);
  assert.ok(problem);
  assert.match(problem, /more than/);
});

test('a deposit mixed with percentages is judged on the money, not the percentages', () => {
  // The percentages are of the whole fee, not of the remainder, which is the
  // assumption that quietly loses money. 2000 + 30% + 40% of 10000 is 9000.
  const short = milestonePlanProblem([
    { id: 'm1', name: 'Deposit', amountUsd: 2000 },
    { id: 'm2', name: 'Build', percent: 30 },
    { id: 'm3', name: 'Handover', percent: 40 }
  ], 10000);
  assert.ok(short);
  assert.match(short, /1000/);

  // The same shape, planned so it does add up.
  assert.equal(milestonePlanProblem([
    { id: 'm1', name: 'Deposit', amountUsd: 2000 },
    { id: 'm2', name: 'Build', percent: 40 },
    { id: 'm3', name: 'Handover', percent: 40 }
  ], 10000), null);
});

test('rounding of a third each is absorbed', () => {
  assert.equal(milestonePlanProblem([
    { id: 'm1', name: 'One', percent: 33.33 },
    { id: 'm2', name: 'Two', percent: 33.33 },
    { id: 'm3', name: 'Three', percent: 33.34 }
  ], 10000), null);
});

test('a plan with no fee to bill against is refused', () => {
  const problem = milestonePlanProblem([{ id: 'm1', name: 'All of it', percent: 100 }], 0);
  assert.ok(problem);
  assert.match(problem, /project fee/);
});

test('an empty plan is refused before the fee is considered', () => {
  assert.match(String(milestonePlanProblem([], 10000)), /at least one milestone/);
});

// ─── Money in cents ──────────────────────────────────────────────────────────

test('a half cent rounds away from zero, in both directions', () => {
  assert.equal(money(1.005), 1.01);
  assert.equal(money(8.235), 8.24, 'the binary representation of this one rounds down if multiplied');
  assert.equal(money(-1.005), -1.01, 'a deduction rounded towards zero quietly pays an extra cent');
});

test('cents convert exactly, both ways', () => {
  assert.equal(toCents(4720.5), 472050);
  assert.equal(toCents(0.1 + 0.2), 30);
  assert.equal(fromCents(472050), 4720.5);
  assert.equal(fromCents(1), 0.01);
});

test('adding a thousand amounts does not drift', () => {
  const amounts = Array.from({ length: 1000 }, () => 233.33);
  assert.equal(sumMoney(amounts), 233330);

  // The float version of the same sum, which is what this replaces.
  const drifted = amounts.reduce((sum, value) => sum + value, 0);
  assert.notEqual(drifted, 233330);
});

test('a sum of nothing is zero, not NaN', () => {
  assert.equal(sumMoney([]), 0);
  assert.equal(sumMoney([null, undefined, 5] as any), 5);
});

test('a thousand split three ways still adds to a thousand', () => {
  const parts = allocate(1000, [1, 1, 1]);
  assert.deepEqual(parts, [333.34, 333.33, 333.33]);
  assert.equal(sumMoney(parts), 1000);
});

test('percentages that do not divide cleanly still add to the total', () => {
  const parts = allocate(4720.37, [30, 30, 40]);
  assert.equal(sumMoney(parts), 4720.37);
});

test('an allocation is stable: the same input splits the same way twice', () => {
  assert.deepEqual(allocate(100, [1, 1, 1]), allocate(100, [1, 1, 1]));
});

test('weights of zero split evenly rather than returning NaN', () => {
  const parts = allocate(90, [0, 0, 0]);
  assert.deepEqual(parts, [30, 30, 30]);
});

test('a credit note splits without gaining a cent', () => {
  const parts = allocate(-100, [1, 1, 1]);
  assert.equal(sumMoney(parts), -100);
});

test('instalments add back to the invoice total, to the cent', () => {
  const instalments = instalmentsFor(4720.37, {
    schedule: { recurring: false, splits: [
      { percent: 30, dayOfMonth: 1 },
      { percent: 30, dayOfMonth: 15 },
      { percent: 40, dayOfMonth: 28 }
    ] },
    period: '2026-11',
    issuedAt: '2026-11-01',
    termsDays: 30,
    isFirstInvoice: true
  });
  assert.equal(sumMoney(instalments.map(part => part.amount)), 4720.37);
});

test('three equal instalments do not dump the rounding on the last one', () => {
  const instalments = instalmentsFor(100, {
    schedule: { recurring: true, splits: [
      { percent: 33.34, dayOfMonth: 1 },
      { percent: 33.33, dayOfMonth: 10 },
      { percent: 33.33, dayOfMonth: 20 }
    ] },
    period: '2026-11',
    issuedAt: '2026-11-01',
    termsDays: 30,
    isFirstInvoice: true
  });
  const amounts = instalments.map(part => part.amount);
  assert.equal(sumMoney(amounts), 100);
  // Compared in cents: 33.34 - 33.33 is 0.010000000000001563 as floats,
  // which is the whole reason this module counts in cents.
  const spread = toCents(Math.max(...amounts)) - toCents(Math.min(...amounts));
  assert.ok(spread <= 1, 'no instalment is more than a cent away from any other');
});
