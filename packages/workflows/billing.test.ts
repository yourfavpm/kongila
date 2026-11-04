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
  money
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
  assert.equal(first.drafts[0].total, 9000);
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
  assert.equal(drafts[0].platformMargin, 9000);
});

test('a project is billed its agreed fee, not a monthly rate', () => {
  const { drafts } = draftsForContract(
    contract({ serviceType: 'Project Execution', projectFeeUsd: 12000, rateAmount: 2000 }),
    fees, asOf
  );
  assert.equal(drafts.length, 1);
  assert.equal(drafts[0].total, 12000);
  assert.equal(drafts[0].talentPayout, 10200);
});

test('a one-time contract with no agreed fee is refused, not billed monthly', () => {
  // The old behaviour would have invoiced this every month forever.
  const { drafts, skipped } = draftsForContract(
    contract({ serviceType: 'Hire Talent', placementFeeUsd: null }), fees, asOf
  );
  assert.equal(drafts.length, 0);
  assert.match(skipped[0].reason, /no placement fee is set/);
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
