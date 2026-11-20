/**
 * The four service lines, end to end, plus the edge cases that have actually
 * gone wrong.
 *
 * Every other test file checks one function. This one checks that the
 * functions agree with each other: that what a client is billed, what a
 * candidate is paid and what Kongila keeps add up, on each service line, at
 * the figures the business actually uses.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  serviceLineOf,
  billingModelFor,
  splitRate,
  money,
  sumMoney,
  allocate,
  instalmentsFor,
  amountDueBy,
  scheduleProblem,
  milestoneProblem,
  milestonePlanProblem,
  milestoneAmount,
  draftsForContract,
  upcomingInvoices,
  type ServiceFee,
  type BillableContract
} from './billing.ts';

import { ruleFor, applyRule, type FeeRule } from './feeRules.ts';
import { contractStatusFromDocuments } from './contractDocuments.ts';

const fees: ServiceFee[] = [
  { serviceLine: 'placement', clientFeePct: 0, talentCommissionPct: 0 },
  { serviceLine: 'outsourcing', clientFeePct: 0.18, talentCommissionPct: 0.08 },
  { serviceLine: 'managed_workforce', clientFeePct: 0.22, talentCommissionPct: 0.08 },
  { serviceLine: 'project', clientFeePct: 0.2, talentCommissionPct: 0.1 }
];

// ─── Scenario A: Direct hire ─────────────────────────────────────────────────

test('A: a placement is a one-off fee on annual salary and no monthly billing', () => {
  assert.equal(serviceLineOf('Hire Talent'), 'placement');
  assert.equal(billingModelFor('Hire Talent'), 'placement_fee');

  const rule: FeeRule = {
    id: 'p', serviceLine: 'placement', party: 'client',
    basis: 'percent_of_annual_salary', value: 0.15
  };

  // 5,000 a month is 60,000 a year; fifteen per cent of that is the fee.
  assert.equal(applyRule(rule, { annualSalary: 60000 }), 9000);

  // Kongila does not pay the candidate on a placement, so there is no
  // deduction to take and no recurring invoice to raise.
  const { drafts } = draftsForContract(
    {
      id: 'c1', clientId: 'cl', talentId: 't', serviceType: 'placement',
      status: 'active', rateAmount: 5000, startDate: '2026-01-01',
      placementFeeUsd: 9000, billedThrough: '2026-01'
    } as BillableContract,
    fees,
    new Date('2026-06-01')
  );
  assert.equal(drafts.length, 0, 'the placement fee was already invoiced; nothing recurs');
});

// ─── Scenario B: Outsourcing ─────────────────────────────────────────────────

const outsourcingFee = fees.find(fee => fee.serviceLine === 'outsourcing') as ServiceFee;

test('B: outsourcing bills the client above the rate and pays the candidate below it', () => {
  const split = splitRate(4000, outsourcingFee);

  assert.equal(split.clientTotal, 4720, 'the client pays the rate plus 18%');
  assert.equal(split.talentNet, 3680, 'the candidate receives the rate less 8%');
  assert.equal(split.platformMargin, 1040, 'Kongila keeps both halves of the spread');

  // The three add up, which is the only property that has to hold.
  assert.equal(
    sumMoney([split.talentNet, split.platformMargin]),
    split.clientTotal,
    'what the client pays is what the candidate gets plus what Kongila keeps');
});

test('B: a rate that does not divide cleanly still reconciles', () => {
  const split = splitRate(3333.33, outsourcingFee);
  assert.equal(sumMoney([split.talentNet, split.platformMargin]), split.clientTotal);
});

// ─── Scenario C: Managed workforce ───────────────────────────────────────────

test('C: a managed team bills per seat and the seats multiply', () => {
  const six: BillableContract = {
    id: 'c3', clientId: 'cl', talentId: 't', serviceType: 'managed_workforce',
    status: 'active', rateAmount: 2000, startDate: '2026-01-01', seats: 6
  } as BillableContract;

  const one: BillableContract = { ...six, id: 'c3b', seats: 1 };

  const sixSeats = draftsForContract(six, fees, new Date('2026-03-05')).drafts[0];
  const oneSeat = draftsForContract(one, fees, new Date('2026-03-05')).drafts[0];

  assert.ok(sixSeats && oneSeat);
  assert.equal(sixSeats.total, money(oneSeat.total * 6));
});

// ─── Scenario D: Project execution ───────────────────────────────────────────

test('D: a project is billed against milestones that add to the fee', () => {
  const plan = [
    { id: 'm1', name: 'Discovery', percent: 25 },
    { id: 'm2', name: 'Build', percent: 50 },
    { id: 'm3', name: 'Handover', percent: 25 }
  ];

  assert.equal(milestoneProblem(plan), null);
  assert.equal(milestonePlanProblem(plan, 48000), null);

  const values = plan.map(milestone => milestoneAmount(milestone, 48000));
  assert.deepEqual(values, [12000, 24000, 12000]);
  assert.equal(sumMoney(values), 48000);
});

test('D: a plan that leaves money unbilled is refused before anything is signed', () => {
  const problem = milestonePlanProblem([
    { id: 'm1', name: 'Half', percent: 50 },
    { id: 'm2', name: 'A bit', amountUsd: 10000 }
  ], 48000);
  assert.ok(problem);
  assert.match(problem, /never be invoiced/);
});

// ─── Edge cases that have gone wrong ─────────────────────────────────────────

test('a payment schedule that does not total 100% is refused, never normalised', () => {
  assert.match(
    String(scheduleProblem({ recurring: true, splits: [
      { percent: 50, dayOfMonth: 1 }, { percent: 40, dayOfMonth: 15 }] })),
    /100/);
});

test('a payment day past the end of a short month lands on its last day', () => {
  const instalments = instalmentsFor(1000, {
    schedule: { recurring: true, splits: [{ percent: 100, dayOfMonth: 31 }] },
    period: '2026-02', issuedAt: '2026-02-01', termsDays: 30, isFirstInvoice: true
  });
  assert.equal(instalments[0].dueDate, '2026-02-28');
});

test('what is due today excludes instalments that fall later', () => {
  const instalments = instalmentsFor(1000, {
    schedule: { recurring: true, splits: [
      { percent: 40, dayOfMonth: 5 }, { percent: 60, dayOfMonth: 25 }] },
    period: '2026-03', issuedAt: '2026-03-01', termsDays: 30, isFirstInvoice: true
  });
  assert.equal(amountDueBy(instalments, '2026-03-10'), 400);
  assert.equal(amountDueBy(instalments, '2026-03-31'), 1000);
});

test('a service line with no fee configured bills nothing rather than zero', () => {
  const { drafts, skipped } = draftsForContract(
    {
      id: 'c9', clientId: 'cl', talentId: 't', serviceType: 'outsourcing',
      status: 'active', rateAmount: 4000, startDate: '2026-01-01'
    } as BillableContract,
    [{ serviceLine: 'outsourcing', clientFeePct: null, talentCommissionPct: null }],
    new Date('2026-03-05')
  );
  assert.equal(drafts.length, 0);
  assert.ok(skipped.length > 0, 'and says why rather than going quiet');
});

test('a contract that has not started is not billed yet', () => {
  const { drafts } = draftsForContract(
    {
      id: 'c10', clientId: 'cl', talentId: 't', serviceType: 'outsourcing',
      status: 'active', rateAmount: 4000, startDate: '2026-12-01'
    } as BillableContract,
    fees,
    new Date('2026-06-01')
  );
  assert.equal(drafts.length, 0);
});

test('a fee rule in force in March prices March, not today', () => {
  const history: FeeRule[] = [
    { id: 'v1', serviceLine: 'outsourcing', party: 'client', basis: 'percent_of_rate',
      value: 0.15, version: 1, effectiveFrom: '2026-01-01', effectiveTo: '2026-07-01' },
    { id: 'v2', serviceLine: 'outsourcing', party: 'client', basis: 'percent_of_rate',
      value: 0.18, version: 2, effectiveFrom: '2026-07-01' }
  ];

  const march = ruleFor(history, 'outsourcing', 'client', new Date('2026-03-15'));
  const november = ruleFor(history, 'outsourcing', 'client', new Date('2026-11-20'));

  assert.equal(applyRule(march as FeeRule, { rate: 4000 }), 600);
  assert.equal(applyRule(november as FeeRule, { rate: 4000 }), 720);
});

test('a contract is not fully signed while one of its documents is unsent', () => {
  assert.equal(contractStatusFromDocuments([
    { audience: 'client', status: 'signed' },
    { audience: 'talent', status: 'draft' }
  ]), 'client_signed');
});

test('a split invoice reconciles whatever the percentages are', () => {
  for (const percents of [[33.33, 33.33, 33.34], [70, 30], [10, 20, 30, 40], [12.5, 87.5]]) {
    for (const amount of [1000, 4720.37, 999.99, 0.03]) {
      const parts = allocate(amount, percents);
      assert.equal(sumMoney(parts), money(amount),
        `${amount} split ${percents.join('/')} did not add back`);
    }
  }
});

test('upcoming invoices come back for the right contracts, in date order', () => {
  const contracts: BillableContract[] = [
    {
      id: 'a', clientId: 'cl', talentId: 't', serviceType: 'outsourcing', status: 'active',
      rateAmount: 4000, startDate: '2026-01-01',
      paymentSchedule: { recurring: true, splits: [{ percent: 100, dayOfMonth: 20 }] }
    } as BillableContract,
    {
      id: 'b', clientId: 'cl', talentId: 't2', serviceType: 'placement', status: 'active',
      rateAmount: 5000, startDate: '2026-01-01'
    } as BillableContract
  ];

  const upcoming = upcomingInvoices(contracts, fees, new Date('2026-03-14'), 10);
  assert.ok(upcoming.every(entry => entry.contractId === 'a'),
    'a placement has no recurring invoice to look forward to');
  const dates = upcoming.map(entry => entry.raiseOn);
  assert.deepEqual(dates, [...dates].sort());
});
