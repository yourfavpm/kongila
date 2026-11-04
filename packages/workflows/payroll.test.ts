import test from 'node:test';
import assert from 'node:assert/strict';

import {
  isPayrollLine,
  daysInMonth,
  daysWorkedIn,
  entryFor,
  buildPayrollRun,
  describeRun,
  payrollCsv,
  parsePeriod
} from './payroll.ts';

const fees = [
  { serviceLine: 'placement' as const, clientFeePct: 0.2, talentCommissionPct: 0 },
  { serviceLine: 'outsourcing' as const, clientFeePct: 0.15, talentCommissionPct: 0.1 },
  { serviceLine: 'managed_workforce' as const, clientFeePct: 0.25, talentCommissionPct: 0.1 },
  { serviceLine: 'project' as const, clientFeePct: 0.3, talentCommissionPct: 0.15 }
];

const contract = (over: any = {}) => ({
  id: 'c1',
  talentId: 't1',
  talentName: 'Ada Okafor',
  clientName: 'Northwind Ltd',
  serviceType: 'Managed Workforce',
  status: 'active',
  rateAmount: 2000,
  currency: 'USD',
  startDate: '2026-01-01',
  endDate: null,
  ...over
});

// ─── Which lines are paid ────────────────────────────────────────────────────

test('only the two managed lines run through payroll', () => {
  assert.equal(isPayrollLine('Managed Workforce'), true);
  assert.equal(isPayrollLine('Outsource Talent'), true);
  assert.equal(isPayrollLine('Hire Talent'), false);
  assert.equal(isPayrollLine('Project Execution'), false);
});

test('a placement candidate is not paid by Kongila', () => {
  // They are the client's employee. Paying them here pays them twice.
  const { entry, skip } = entryFor(
    contract({ serviceType: 'Hire Talent' }), '2026-11', fees
  );
  assert.equal(entry, null);
  assert.equal(skip, null, 'not an error, just not payroll');
});

test('a project is paid on delivery, not monthly', () => {
  const { entry } = entryFor(contract({ serviceType: 'Project Execution' }), '2026-11', fees);
  assert.equal(entry, null);
});

// ─── Periods and proration ───────────────────────────────────────────────────

test('month lengths are real, including February in a leap year', () => {
  assert.equal(daysInMonth('2026-11'), 30);
  assert.equal(daysInMonth('2026-02'), 28);
  assert.equal(daysInMonth('2028-02'), 29);
  assert.equal(daysInMonth('2026-12'), 31);
});

test('a bad period is rejected rather than guessed at', () => {
  assert.equal(parsePeriod('2026-13'), null);
  assert.equal(parsePeriod('nonsense'), null);
  assert.equal(daysInMonth('2026-13'), 0);
});

test('a full month is a full month', () => {
  assert.equal(daysWorkedIn('2026-11', '2026-01-01', null), 30);
});

test('a mid-month start is paid from the day it started', () => {
  // Starting on the 15th of a 30-day month is 16 days, not 15: the 15th
  // itself is worked.
  assert.equal(daysWorkedIn('2026-11', '2026-11-15', null), 16);
});

test('a mid-month end stops on the last day', () => {
  assert.equal(daysWorkedIn('2026-11', '2026-01-01', '2026-11-10'), 10);
});

test('a contract that had not started yet is zero days', () => {
  assert.equal(daysWorkedIn('2026-11', '2026-12-01', null), 0);
});

test('a contract that already ended is zero days', () => {
  assert.equal(daysWorkedIn('2026-11', '2026-01-01', '2026-09-30'), 0);
});

test('a contract starting and ending inside one month pays only those days', () => {
  assert.equal(daysWorkedIn('2026-11', '2026-11-10', '2026-11-19'), 10);
});

// ─── The money ───────────────────────────────────────────────────────────────

test('a full month pays the whole rate less commission', () => {
  const { entry } = entryFor(contract(), '2026-11', fees);
  assert.equal(entry!.grossAmount, 2000);
  assert.equal(entry!.commissionPct, 0.1);
  assert.equal(entry!.commissionAmount, 200);
  assert.equal(entry!.netAmount, 1800);
});

test('a partial month is prorated by calendar days', () => {
  // 16 of 30 days on a $2,000 rate.
  const { entry } = entryFor(contract({ startDate: '2026-11-15' }), '2026-11', fees);
  assert.equal(entry!.daysWorked, 16);
  assert.equal(entry!.daysInPeriod, 30);
  assert.equal(entry!.grossAmount, 1066.67);
  assert.equal(entry!.netAmount, 960);
});

test('gross minus commission always equals net exactly', () => {
  // Recomputing net from a percentage instead of subtracting the rounded
  // commission leaves a cent adrift, which a payout reconciliation finds.
  for (const rate of [2000, 1999.99, 3333.33, 1234.56, 777.77]) {
    for (const start of ['2026-01-01', '2026-11-07', '2026-11-23']) {
      const { entry } = entryFor(contract({ rateAmount: rate, startDate: start }), '2026-11', fees);
      if (!entry) continue;
      assert.equal(
        entry.netAmount,
        Math.round((entry.grossAmount - entry.commissionAmount) * 100) / 100,
        `${rate} from ${start}`
      );
    }
  }
});

test('a zero commission pays the whole gross', () => {
  const noCommission = [{ serviceLine: 'managed_workforce' as const, clientFeePct: 0.25, talentCommissionPct: 0 }];
  const { entry } = entryFor(contract(), '2026-11', noCommission);
  assert.equal(entry!.commissionAmount, 0);
  assert.equal(entry!.netAmount, 2000);
});

// ─── Refusals ────────────────────────────────────────────────────────────────

test('an unconfigured commission stops the entry rather than paying full gross', () => {
  const unset = [{ serviceLine: 'managed_workforce' as const, clientFeePct: null, talentCommissionPct: null }];
  const { entry, skip } = entryFor(contract(), '2026-11', unset);
  assert.equal(entry, null);
  assert.match(skip!.reason, /No talent commission is configured/);
});

test('a contract with no rate is reported, not paid zero', () => {
  const { entry, skip } = entryFor(contract({ rateAmount: 0 }), '2026-11', fees);
  assert.equal(entry, null);
  assert.match(skip!.reason, /no monthly rate/);
});

test('a contract that is not live is passed over silently', () => {
  for (const status of ['pending', 'Pending Signatures', 'terminated']) {
    const { entry, skip } = entryFor(contract({ status }), '2026-11', fees);
    assert.equal(entry, null, status);
    assert.equal(skip, null, status);
  }
});

// ─── The run ─────────────────────────────────────────────────────────────────

test('a run totals gross, commission and net', () => {
  const run = buildPayrollRun([
    contract({ id: 'c1', talentId: 't1', talentName: 'Ada Okafor' }),
    contract({ id: 'c2', talentId: 't2', talentName: 'Bola Hassan', rateAmount: 3000 })
  ], '2026-11', fees);

  assert.equal(run.entries.length, 2);
  assert.equal(run.totalGross, 5000);
  assert.equal(run.totalCommission, 500);
  assert.equal(run.totalNet, 4500);
  assert.equal(run.currency, 'USD');
});

test('entries come back in name order, so the schedule reads the same twice', () => {
  const run = buildPayrollRun([
    contract({ id: 'c2', talentName: 'Zainab Bello' }),
    contract({ id: 'c1', talentName: 'Ada Okafor' })
  ], '2026-11', fees);
  assert.deepEqual(run.entries.map(e => e.talentName), ['Ada Okafor', 'Zainab Bello']);
});

test('two currencies in one run refuse to be summed into one figure', () => {
  const run = buildPayrollRun([
    contract({ id: 'c1', currency: 'USD' }),
    contract({ id: 'c2', talentName: 'Bola Hassan', currency: 'NGN' })
  ], '2026-11', fees);
  assert.equal(run.currency, 'MIXED');
  assert.match(describeRun(run), /more than one currency/);
});

test('an empty run says so plainly', () => {
  assert.match(describeRun(buildPayrollRun([], '2026-11', fees)), /Nothing to pay for 2026-11/);
});

test('the summary names what needs attention', () => {
  const run = buildPayrollRun([
    contract({ id: 'c1' }),
    contract({ id: 'c2', talentName: 'Bola Hassan', rateAmount: 0 })
  ], '2026-11', fees);
  assert.match(describeRun(run), /1 person, USD 1,800 net/);
  assert.match(describeRun(run), /1 contract needs attention/);
});

// ─── Export ──────────────────────────────────────────────────────────────────

test('the export has a header and one row per person', () => {
  const run = buildPayrollRun([contract()], '2026-11', fees);
  const lines = payrollCsv(run).split('\r\n');
  assert.equal(lines.length, 2);
  assert.match(lines[0], /^Period,Talent ID,Talent Name/);
  assert.match(lines[1], /Ada Okafor/);
  assert.match(lines[1], /2000\.00/);
  assert.match(lines[1], /1800\.00/);
});

test('a name with a comma does not break the file', () => {
  // This is a bank export. A shifted column here moves somebody's money.
  const run = buildPayrollRun([contract({ talentName: 'Okafor, Ada' })], '2026-11', fees);
  const row = payrollCsv(run).split('\r\n')[1];
  assert.match(row, /"Okafor, Ada"/);
  assert.equal(row.split(',').length, 14, 'the quoted comma must not add a column');
});

test('a name with a quote is escaped, not dropped', () => {
  const run = buildPayrollRun([contract({ talentName: 'Ada "Pepper" Okafor' })], '2026-11', fees);
  assert.match(payrollCsv(run), /"Ada ""Pepper"" Okafor"/);
});
