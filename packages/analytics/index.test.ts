import test from 'node:test';
import assert from 'node:assert/strict';

import { computePlatformMetrics, isLiveContract, computeTalentProductivity } from './index.ts';

const contract = (over: any = {}) => ({
  status: 'Active', talentId: 't1', clientId: 'c1', rateAmount: 5000, ...over
});

test('an activated contract counts as live', () => {
  // The bug. The reader maps `active` to 'Active' and `fully_signed` to
  // 'Signed'; the count only matched 'Signed', so a contract that was signed
  // and then activated — the normal path — fell out of every metric.
  assert.equal(isLiveContract({ status: 'Active' }), true);
  assert.equal(isLiveContract({ status: 'Signed' }), true);
  assert.equal(isLiveContract({ status: 'Pending Signatures' }), false);
  assert.equal(isLiveContract({ status: 'Completed' }), false);
  assert.equal(isLiveContract({ status: 'Terminated' }), false);
});

test('active contracts no longer read zero for real data', () => {
  const metrics = computePlatformMetrics([], [], [], [
    contract({ status: 'Active' }),
    contract({ status: 'Signed', talentId: 't2' }),
    contract({ status: 'Completed', talentId: 't3' })
  ]);
  assert.equal(metrics.activeContractCount, 2);
  assert.equal(metrics.monthlyContractValue, 10000);
});

test('revenue is null until a fee rate is configured, not invented', () => {
  // It used to be contract value times a hardcoded 1.25 "administrative
  // markup". No fee exists anywhere in the product.
  const without = computePlatformMetrics([], [], [], [contract()]);
  assert.equal(without.monthlyRevenue, null);
  assert.ok(without.unavailable.some(u => /fee rate/i.test(u)));

  const withRate = computePlatformMetrics([], [], [], [contract()], { platformFeeRate: 0.25 });
  assert.equal(withRate.monthlyRevenue, 1250);
});

test('an hourly contract is converted to a monthly figure', () => {
  const metrics = computePlatformMetrics([], [], [], [
    contract({ rateType: 'Hourly', rateAmount: 50 })
  ]);
  assert.equal(metrics.monthlyContractValue, 8000);
});

test('active talent comes from live contracts, not a status nothing sets', () => {
  // It counted vettingStatus 'Deployed'. Nothing in the product ever writes
  // that, so it was permanently zero and utilisation with it.
  const talents = [
    { id: 't1', vettingStatus: 'Vetted' },
    { id: 't2', vettingStatus: 'Vetted' },
    { id: 't3', vettingStatus: 'Applied' }
  ];
  const metrics = computePlatformMetrics(talents, [], [], [contract({ talentId: 't1' })]);
  assert.equal(metrics.activeTalentCount, 1);
  assert.equal(metrics.deployableTalentCount, 2);
  assert.equal(metrics.utilizationRate, 50);
});

test('one candidate on two contracts is counted once', () => {
  const metrics = computePlatformMetrics([], [], [], [
    contract({ talentId: 't1', clientId: 'c1' }),
    contract({ talentId: 't1', clientId: 'c2' })
  ]);
  assert.equal(metrics.activeTalentCount, 1);
  assert.equal(metrics.activeClientsCount, 2);
});

test('conversion counts placements that have since ended', () => {
  // A contract that ran and finished was still a conversion.
  const metrics = computePlatformMetrics([], [{ id: 'r1' }, { id: 'r2' }], [], [
    contract({ status: 'Completed' })
  ]);
  assert.equal(metrics.conversionRate, 50);
});

test('a pending contract is not a conversion', () => {
  const metrics = computePlatformMetrics([], [{ id: 'r1' }], [], [
    contract({ status: 'Pending Signatures' })
  ]);
  assert.equal(metrics.conversionRate, 0);
});

test('metrics with no data report null and say why, rather than zero', () => {
  const metrics = computePlatformMetrics([], [], [], []);
  assert.equal(metrics.utilizationRate, null);
  assert.equal(metrics.conversionRate, null);
  assert.equal(metrics.averageMatchingScore, null);
  assert.equal(metrics.unavailable.length, 4);
});

test('bad numbers do not poison the totals', () => {
  const metrics = computePlatformMetrics([], [], [], [
    contract({ rateAmount: 'not a number' }),
    contract({ rateAmount: -500, talentId: 't2' }),
    contract({ rateAmount: 1000, talentId: 't3' })
  ]);
  assert.equal(metrics.monthlyContractValue, 1000);
});

test('productivity no longer weights the dropped communication score', () => {
  const full = computeTalentProductivity({
    technical: 100, workSimulation: 100, behavioral: 100, remoteReadiness: 100
  });
  assert.equal(full.overall, 100);
  // Under the old four-way average including communication, which nothing
  // measured, a perfect candidate scored 75.
  assert.notEqual(full.overall, 75);
});

test('productivity handles missing scores as zero, not NaN', () => {
  const partial = computeTalentProductivity({ technical: 80 });
  assert.equal(Number.isFinite(partial.overall), true);
  assert.equal(partial.efficiency, 0);
});
