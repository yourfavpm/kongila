import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ruleAppliesOn,
  ruleFor,
  applyRule,
  ruleChangeProblem,
  planRuleChange,
  describeRule,
  type FeeRule
} from './feeRules.ts';

const rule = (over: Partial<FeeRule> = {}): FeeRule => ({
  id: 'r1',
  serviceLine: 'outsourcing',
  party: 'client',
  basis: 'percent_of_rate',
  value: 0.18,
  ...over
});

// ─── Windows ─────────────────────────────────────────────────────────────────

test('a rule with no dates always applies', () => {
  assert.equal(ruleAppliesOn(rule(), new Date('2020-01-01')), true);
  assert.equal(ruleAppliesOn(rule(), new Date('2030-01-01')), true);
});

test('a rule does not apply before it starts or on the day it ends', () => {
  const r = rule({ effectiveFrom: '2026-01-01', effectiveTo: '2026-07-01' });
  assert.equal(ruleAppliesOn(r, new Date('2025-12-31')), false);
  assert.equal(ruleAppliesOn(r, new Date('2026-01-01')), true);
  assert.equal(ruleAppliesOn(r, new Date('2026-06-30')), true);
  assert.equal(ruleAppliesOn(r, new Date('2026-07-01')), false, 'the end is exclusive, so there is no day both versions cover');
});

test('an inactive rule never applies', () => {
  assert.equal(ruleAppliesOn(rule({ active: false }), new Date()), false);
});

// ─── Picking the version in force ────────────────────────────────────────────

const history: FeeRule[] = [
  rule({ id: 'v1', value: 0.15, version: 1, effectiveFrom: '2026-01-01', effectiveTo: '2026-07-01' }),
  rule({ id: 'v2', value: 0.18, version: 2, effectiveFrom: '2026-07-01' })
];

test('March is priced on the March rule, and November on the current one', () => {
  assert.equal(ruleFor(history, 'outsourcing', 'client', new Date('2026-03-15'))?.value, 0.15);
  assert.equal(ruleFor(history, 'outsourcing', 'client', new Date('2026-11-20'))?.value, 0.18);
});

test('the client rule and the talent rule are separate', () => {
  const rules = [
    rule({ id: 'c', party: 'client', value: 0.18 }),
    rule({ id: 't', party: 'talent', value: 0.08 })
  ];
  assert.equal(ruleFor(rules, 'outsourcing', 'talent')?.value, 0.08);
});

test('no rule for a service line is null, not a default', () => {
  assert.equal(ruleFor(history, 'placement', 'client'), null);
});

test('overlapping versions resolve the same way every time', () => {
  const overlapping = [
    rule({ id: 'a', value: 0.2, version: 3, effectiveFrom: '2026-01-01' }),
    rule({ id: 'b', value: 0.1, version: 4, effectiveFrom: '2026-01-01' })
  ];
  const first = ruleFor(overlapping, 'outsourcing', 'client', new Date('2026-06-01'));
  const second = ruleFor([...overlapping].reverse(), 'outsourcing', 'client', new Date('2026-06-01'));
  assert.equal(first?.id, second?.id);
  assert.equal(first?.id, 'b', 'the higher version wins when the dates tie');
});

// ─── What a rule charges ─────────────────────────────────────────────────────

test('a percentage of the rate', () => {
  assert.equal(applyRule(rule({ value: 0.18 }), { rate: 4000 }), 720);
});

test('a placement fee is a percentage of annual salary, not of the rate', () => {
  const r = rule({ basis: 'percent_of_annual_salary', value: 0.15 });
  assert.equal(applyRule(r, { annualSalary: 60000 }), 9000);
  assert.equal(applyRule(r, { rate: 5000 }), null, 'no salary given is a refusal, never zero');
});

test('per seat multiplies, and defaults to one seat rather than none', () => {
  const r = rule({ basis: 'per_seat', value: 250 });
  assert.equal(applyRule(r, { seats: 6 }), 1500);
  assert.equal(applyRule(r, {}), 250);
});

test('a floor lifts a small fee and a cap holds a large one', () => {
  const r = rule({ value: 0.18, minimumUsd: 500, maximumUsd: 2000 });
  assert.equal(applyRule(r, { rate: 1000 }), 500);
  assert.equal(applyRule(r, { rate: 4000 }), 720);
  assert.equal(applyRule(r, { rate: 20000 }), 2000);
});

test('a flat amount ignores the rate entirely', () => {
  assert.equal(applyRule(rule({ basis: 'flat_amount', value: 350 }), { rate: 9999 }), 350);
});

test('a fee is rounded to the cent', () => {
  assert.equal(applyRule(rule({ value: 0.175 }), { rate: 3333 }), 583.28);
});

// ─── Changing a rule ─────────────────────────────────────────────────────────

test('a percentage entered as a whole number is caught before it bills 1800%', () => {
  const problem = ruleChangeProblem(rule(), { value: 18, basis: 'percent_of_rate' });
  assert.ok(problem);
  assert.match(problem, /0\.18/);
});

test('a negative fee is refused', () => {
  assert.match(String(ruleChangeProblem(rule(), { value: -0.1 })), /cannot be negative/);
});

test('a minimum above the maximum is refused', () => {
  assert.match(
    String(ruleChangeProblem(rule(), { value: 0.18, minimumUsd: 900, maximumUsd: 400 })),
    /minimum is above the maximum/);
});

test('backdating past the last priced contract is refused, and says why', () => {
  const problem = ruleChangeProblem(
    rule({ effectiveFrom: '2026-01-01' }),
    { value: 0.2, effectiveFrom: '2026-02-01' },
    { earliestAllowed: new Date('2026-11-20') }
  );
  assert.ok(problem);
  assert.match(problem, /Invoices have already gone out/);
});

test('a change taking effect today or later is fine', () => {
  assert.equal(
    ruleChangeProblem(
      rule({ effectiveFrom: '2026-01-01' }),
      { value: 0.2, effectiveFrom: '2026-12-01' },
      { earliestAllowed: new Date('2026-11-20') }
    ),
    null);
});

test('a change closes the old version and opens a new one, never edits', () => {
  const current = rule({ value: 0.15, version: 1, effectiveFrom: '2026-01-01' });
  const { closing, opening } = planRuleChange(current, { value: 0.18 }, '2026-12-01');

  assert.equal(closing?.value, 0.15, 'the old version keeps its figure');
  assert.equal(closing?.effectiveTo, '2026-12-01');
  assert.equal(opening.value, 0.18);
  assert.equal(opening.version, 2);
  assert.equal(opening.effectiveTo, null);
});

test('the first version of a rule closes nothing', () => {
  const { closing, opening } = planRuleChange(null, { serviceLine: 'project', value: 0.1 }, '2026-12-01');
  assert.equal(closing, null);
  assert.equal(opening.version, 1);
});

test('a change inherits what it does not restate', () => {
  const current = rule({ value: 0.15, minimumUsd: 400, label: 'Standard' });
  const { opening } = planRuleChange(current, { value: 0.18 }, '2026-12-01');
  assert.equal(opening.minimumUsd, 400);
  assert.equal(opening.label, 'Standard');
});

// ─── Saying it in words ──────────────────────────────────────────────────────

test('a rule describes itself the way an operator would say it', () => {
  assert.equal(
    describeRule(rule({ value: 0.18, minimumUsd: 500 })),
    '18% of the rate, charged to the client (minimum USD 500)');
  assert.equal(
    describeRule(rule({ party: 'talent', basis: 'per_seat', value: 250 })),
    'USD 250 per seat, deducted from the candidate');
});
