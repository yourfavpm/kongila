/**
 * The payroll run.
 *
 * This is the piece the client specifically asked for and it did not exist.
 * There was a `payroll_entries` table, but it belongs to Remotan: its
 * foreign keys point at `remotan_workspaces` and `workspace_members`, it is
 * keyed on hours from `time_logs`, and Kongila is launching without any of
 * that. Nothing in the Kongila codebase read or wrote a row of it.
 *
 * So this is built on what Kongila actually has: a contract, a monthly rate,
 * a start date and an end date.
 *
 * Gross is the monthly rate, prorated by calendar days when the engagement
 * starts or ends partway through a month. Commission comes out of gross.
 * Net is what the candidate is paid.
 *
 * Only Managed Workforce and Outsourcing are paid through payroll. A
 * Placement candidate is employed by the client directly and Kongila pays
 * them nothing; a Project is paid on delivery against its project fee, not
 * monthly. Including either would pay somebody twice.
 *
 * This file imports nothing, so it can be tested on its own.
 */

import {
  serviceLineOf,
  feeFor,
  feeIsSet,
  money,
  type ServiceFee,
  type ServiceLine
} from './billing.ts';

/** The service lines that produce a monthly payroll entry. */
export const PAYROLL_LINES: ServiceLine[] = ['outsourcing', 'managed_workforce'];

export function isPayrollLine(serviceType?: string | null): boolean {
  const line = serviceLineOf(serviceType);
  return line !== null && PAYROLL_LINES.includes(line);
}

export interface PayrollContract {
  id: string;
  talentId: string;
  talentName?: string;
  clientId?: string;
  clientName?: string;
  serviceType?: string | null;
  status?: string | null;
  rateAmount?: number | null;
  currency?: string | null;
  startDate?: string | null;
  endDate?: string | null;
}

export interface PayrollEntry {
  contractId: string;
  talentId: string;
  talentName: string;
  clientName: string;
  serviceLine: ServiceLine;
  /** YYYY-MM. */
  period: string;
  /** The full monthly rate before proration. */
  monthlyRate: number;
  /** Days of the month the engagement was live. */
  daysWorked: number;
  daysInPeriod: number;
  /** Rate prorated to the days worked. */
  grossAmount: number;
  commissionPct: number;
  commissionAmount: number;
  netAmount: number;
  currency: string;
}

export interface PayrollSkip {
  contractId: string;
  talentName: string;
  reason: string;
}

export interface PayrollRun {
  period: string;
  entries: PayrollEntry[];
  skipped: PayrollSkip[];
  totalGross: number;
  totalCommission: number;
  totalNet: number;
  currency: string;
}

const LIVE_STATUSES = new Set(['active', 'signed', 'fully_signed']);

function normalised(status?: string | null): string {
  return String(status || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
}

/** Checks a YYYY-MM string and returns its parts. */
export function parsePeriod(period: string): { year: number; month: number } | null {
  const match = /^(\d{4})-(\d{2})$/.exec(String(period || ''));
  if (!match) return null;
  const month = Number(match[2]);
  if (month < 1 || month > 12) return null;
  return { year: Number(match[1]), month };
}

export function daysInMonth(period: string): number {
  const parsed = parsePeriod(period);
  if (!parsed) return 0;
  // Day 0 of the next month is the last day of this one.
  return new Date(Date.UTC(parsed.year, parsed.month, 0)).getUTCDate();
}

/**
 * How many days of a month an engagement covered.
 *
 * A contract that starts on the 15th is paid half a month, not a whole one.
 * Flat monthly billing for a partial month is the kind of error nobody
 * notices until the candidate does.
 */
export function daysWorkedIn(
  period: string,
  startDate?: string | null,
  endDate?: string | null
): number {
  const parsed = parsePeriod(period);
  if (!parsed) return 0;

  const total = daysInMonth(period);
  const periodStart = Date.UTC(parsed.year, parsed.month - 1, 1);
  const periodEnd = Date.UTC(parsed.year, parsed.month - 1, total);

  let from = periodStart;
  if (startDate) {
    const start = Date.parse(startDate);
    if (!Number.isNaN(start)) from = Math.max(from, start);
  }

  let to = periodEnd;
  if (endDate) {
    const end = Date.parse(endDate);
    if (!Number.isNaN(end)) to = Math.min(to, end);
  }

  if (to < from) return 0;
  return Math.round((to - from) / 86400000) + 1;
}

/**
 * One contract's entry for one period, or the reason it has none.
 *
 * A contract that simply was not live in the period is skipped silently.
 * A contract that should have been paid and cannot be is reported, because
 * somebody has to fix it before the run is approved.
 */
export function entryFor(
  contract: PayrollContract,
  period: string,
  fees: ServiceFee[]
): { entry: PayrollEntry | null; skip: PayrollSkip | null } {
  const name = contract.talentName || `contract ${contract.id}`;
  const skip = (reason: string) => ({
    entry: null,
    skip: { contractId: contract.id, talentName: name, reason }
  });

  if (!LIVE_STATUSES.has(normalised(contract.status))) return { entry: null, skip: null };

  const line = serviceLineOf(contract.serviceType);
  if (!line || !PAYROLL_LINES.includes(line)) {
    // Placement and Project are not paid monthly. Not an error.
    return { entry: null, skip: null };
  }

  const daysWorked = daysWorkedIn(period, contract.startDate, contract.endDate);
  if (daysWorked === 0) return { entry: null, skip: null };

  const rate = Number(contract.rateAmount || 0);
  if (!Number.isFinite(rate) || rate <= 0) {
    return skip('The contract has no monthly rate, so there is nothing to pay.');
  }

  const fee = feeFor(contract.serviceType, fees);
  if (!feeIsSet(fee)) {
    return skip(
      `No talent commission is configured for ${line.replace(/_/g, ' ')}. `
      + 'Set it before approving this run.'
    );
  }

  const daysInPeriod = daysInMonth(period);
  const commissionPct = (fee as ServiceFee).talentCommissionPct as number;

  const grossAmount = daysWorked === daysInPeriod
    ? money(rate)
    : money(rate * (daysWorked / daysInPeriod));

  const commissionAmount = money(grossAmount * commissionPct);

  return {
    entry: {
      contractId: contract.id,
      talentId: contract.talentId,
      talentName: name,
      clientName: contract.clientName || '',
      serviceLine: line,
      period,
      monthlyRate: money(rate),
      daysWorked,
      daysInPeriod,
      grossAmount,
      commissionPct,
      commissionAmount,
      // Subtracting the rounded commission, not recomputing from a
      // percentage, so gross minus commission always equals net exactly.
      netAmount: money(grossAmount - commissionAmount),
      currency: String(contract.currency || 'USD').toUpperCase()
    },
    skip: null
  };
}

/** The whole run for one period. */
export function buildPayrollRun(
  contracts: PayrollContract[],
  period: string,
  fees: ServiceFee[]
): PayrollRun {
  const entries: PayrollEntry[] = [];
  const skipped: PayrollSkip[] = [];

  for (const contract of contracts || []) {
    const { entry, skip } = entryFor(contract, period, fees);
    if (entry) entries.push(entry);
    if (skip) skipped.push(skip);
  }

  entries.sort((a, b) => a.talentName.localeCompare(b.talentName));

  const currencies = new Set(entries.map(e => e.currency));

  return {
    period,
    entries,
    skipped,
    totalGross: money(entries.reduce((sum, e) => sum + e.grossAmount, 0)),
    totalCommission: money(entries.reduce((sum, e) => sum + e.commissionAmount, 0)),
    totalNet: money(entries.reduce((sum, e) => sum + e.netAmount, 0)),
    // A run spanning two currencies cannot be summed into one figure, and
    // saying so is better than printing a total that means nothing.
    currency: currencies.size === 1 ? [...currencies][0] : 'MIXED'
  };
}

/** One line for whoever is about to approve it. */
export function describeRun(run: PayrollRun): string {
  if (run.entries.length === 0 && run.skipped.length === 0) {
    return `Nothing to pay for ${run.period}.`;
  }

  const amount = run.currency === 'MIXED'
    ? `${run.entries.length} entries in more than one currency`
    : `${run.entries.length} ${run.entries.length === 1 ? 'person' : 'people'}, `
      + `${run.currency} ${run.totalNet.toLocaleString('en-US')} net`;

  if (run.skipped.length === 0) return `${run.period}: ${amount}.`;

  return `${run.period}: ${amount}. `
       + `${run.skipped.length} ${run.skipped.length === 1 ? 'contract needs' : 'contracts need'} attention.`;
}

// ─── Export ──────────────────────────────────────────────────────────────────

function csvCell(value: unknown): string {
  const text = value === null || value === undefined ? '' : String(value);
  // A name containing a comma, a quote or a newline breaks a naive CSV, and
  // bank export files are exactly where that is least funny.
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export const PAYROLL_CSV_HEADERS = [
  'Period', 'Talent ID', 'Talent Name', 'Client', 'Service Line',
  'Monthly Rate', 'Days Worked', 'Days In Month',
  'Gross', 'Commission %', 'Commission', 'Net', 'Currency'
];

/** The file an operator hands to whoever actually moves the money. */
export function payrollCsv(run: PayrollRun): string {
  const rows = run.entries.map(e => [
    e.period, e.talentId, e.talentName, e.clientName, e.serviceLine,
    e.monthlyRate.toFixed(2), e.daysWorked, e.daysInPeriod,
    e.grossAmount.toFixed(2), (e.commissionPct * 100).toFixed(2),
    e.commissionAmount.toFixed(2), e.netAmount.toFixed(2), e.currency
  ]);

  return [PAYROLL_CSV_HEADERS, ...rows]
    .map(row => row.map(csvCell).join(','))
    .join('\r\n');
}
