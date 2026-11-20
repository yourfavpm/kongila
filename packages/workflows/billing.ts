/**
 * How Kongila bills.
 *
 * What was there: `/api/finance/generate-drafts` returned the same two
 * invented invoices every time it was called, Horizon Fintech for $5,000 and
 * Nexus Health for $3,200, with a comment describing what a real
 * implementation would do. Nothing read a contract. Nothing wrote a row.
 *
 * Underneath that, two deeper problems:
 *
 *   - Every service was written as a monthly rate. Placement is a one-time
 *     fee on a hire the client then employs directly, and Project Execution
 *     is a fee for a deliverable. Billing either of them monthly, forever,
 *     invoices a client for a service that already finished.
 *   - `FeeConfig` existed as a TypeScript interface and nothing else. No
 *     table, no handler, and no line of code anywhere multiplied a rate by a
 *     fee. So the platform had no margin: it billed the client exactly what
 *     it paid the candidate.
 *
 * The rule this file keeps: it will not invent a number. A service line with
 * no configured fee produces a refusal naming the line, not an invoice at
 * 0% or at some default that looks plausible. A wrong invoice sent to a
 * client is worse than no invoice.
 *
 * This file imports nothing, so it can be tested on its own.
 */

// ─── Service lines ───────────────────────────────────────────────────────────

/** The four things Kongila sells. */
export type ServiceLine = 'placement' | 'outsourcing' | 'managed_workforce' | 'project';

export const SERVICE_LINES: ServiceLine[] = [
  'placement', 'outsourcing', 'managed_workforce', 'project'
];

/**
 * How each line is billed.
 *
 *   recurring_monthly  a charge every month the engagement runs
 *   placement_fee      one charge when the hire is made, then nothing
 *   project_fee        one charge for the agreed scope
 */
export type BillingModel = 'recurring_monthly' | 'placement_fee' | 'project_fee';

const MODEL_BY_LINE: Record<ServiceLine, BillingModel> = {
  placement: 'placement_fee',
  outsourcing: 'recurring_monthly',
  managed_workforce: 'recurring_monthly',
  project: 'project_fee'
};

/**
 * Resolves whatever spelling a row carries to one of the four lines.
 *
 * `ServiceType` admits both the label the request form shows ('Hire Talent')
 * and the slug the database stores ('placement'), and contracts carry
 * whichever one the path that created them happened to use.
 */
export function serviceLineOf(serviceType?: string | null): ServiceLine | null {
  const key = String(serviceType || '').trim().toLowerCase().replace(/[\s-]+/g, '_');

  switch (key) {
    case 'hire_talent':
    case 'direct_hire':
    case 'placement':          return 'placement';
    case 'outsource_talent':
    case 'talent_outsourcing':
    case 'outsourcing':        return 'outsourcing';
    case 'managed_workforce':
    case 'managed_service':   return 'managed_workforce';
    case 'project_execution':
    case 'project_management':
    case 'project':            return 'project';
    default:                   return null;
  }
}

export function billingModelFor(serviceType?: string | null): BillingModel | null {
  const line = serviceLineOf(serviceType);
  return line ? MODEL_BY_LINE[line] : null;
}

/** Whether this line keeps billing after the first invoice. */
export function isRecurring(serviceType?: string | null): boolean {
  return billingModelFor(serviceType) === 'recurring_monthly';
}

// ─── Fees ────────────────────────────────────────────────────────────────────

/**
 * The margin, per service line.
 *
 * Two numbers, because they are two different things and conflating them is
 * how a platform discovers it has been paying out more than it billed:
 *
 *   clientFeePct        added on top of the rate, charged to the client
 *   talentCommissionPct deducted from the rate, kept from the candidate
 *
 * Both are fractions. 0.15 is fifteen percent. Both may legitimately be
 * zero, which is different from unset.
 */
export interface ServiceFee {
  serviceLine: ServiceLine;
  clientFeePct: number | null;
  talentCommissionPct: number | null;
}

export function feeFor(
  serviceType: string | null | undefined,
  fees: ServiceFee[]
): ServiceFee | null {
  const line = serviceLineOf(serviceType);
  if (!line) return null;
  return (fees || []).find(f => f.serviceLine === line) || null;
}

/** Whether a fee is usable, as opposed to present but unconfigured. */
export function feeIsSet(fee: ServiceFee | null): boolean {
  return Boolean(
    fee
    && typeof fee.clientFeePct === 'number'
    && Number.isFinite(fee.clientFeePct)
    && typeof fee.talentCommissionPct === 'number'
    && Number.isFinite(fee.talentCommissionPct)
  );
}

// ─── Money ───────────────────────────────────────────────────────────────────
//
// Money is counted in whole cents and only turned back into a decimal at the
// edges. `money()` used to round a float with an epsilon nudge, which gets
// the obvious cases right and two things wrong that matter:
//
//   - adding up. A thousand rounded amounts summed as floats came to
//     233329.99999999523, so a total and the sum of its parts disagreed by a
//     cent, which on an invoice is a query from the client.
//   - dividing. A thousand split three ways came back as 999.99, losing a
//     cent that nobody ever bills.
//
// So: `toCents` is the one place rounding happens, `sumMoney` adds in cents,
// and `allocate` divides so the parts always add back to the whole.

/** An amount as whole cents, rounded half away from zero. */
export function toCents(amount: number): number {
  const value = Number(amount);
  if (!Number.isFinite(value)) return 0;

  // Scaled through a string rather than by multiplying, because 8.235 * 100
  // is 823.4999999999999 in binary floating point and rounds down to 8.23.
  const scaled = Number(`${value}e2`);
  if (!Number.isFinite(scaled)) return Math.round(value * 100);

  // Half away from zero, so -1.005 is -1.01 and not -1.00. Rounding a
  // deduction towards zero quietly pays the candidate an extra cent.
  return scaled < 0 ? -Math.round(-scaled) : Math.round(scaled);
}

/** Whole cents back to an amount. */
export function fromCents(cents: number): number {
  return Number(`${Math.round(Number(cents) || 0)}e-2`);
}

/** Rounds to whole cents. */
export function money(amount: number): number {
  return fromCents(toCents(amount));
}

/**
 * Adds amounts without drifting.
 *
 * Each is taken to cents first, so the total is exact however many there are
 * and however they were produced.
 */
export function sumMoney(amounts: Array<number | null | undefined>): number {
  let cents = 0;
  for (const amount of amounts || []) cents += toCents(Number(amount) || 0);
  return fromCents(cents);
}

/**
 * Splits an amount by weights so the parts add back to the whole.
 *
 * Largest remainder: everybody gets their floor, then the cents left over go
 * one each to whoever was rounded down hardest. A third of a thousand three
 * ways is 333.34, 333.33, 333.33 and not three times 333.33, because the
 * client is billed a thousand and the parts have to say so.
 *
 * Weights that sum to zero split evenly, since the alternative is dividing
 * by zero and returning a row of NaN onto an invoice.
 */
export function allocate(total: number, weights: number[]): number[] {
  const parts = (weights || []).map(weight => Math.max(0, Number(weight) || 0));
  if (parts.length === 0) return [];

  const totalCents = toCents(total);
  const weightTotal = parts.reduce((sum, weight) => sum + weight, 0);
  const shares = weightTotal > 0 ? parts : parts.map(() => 1);
  const shareTotal = weightTotal > 0 ? weightTotal : parts.length;

  const exact = shares.map(weight => (totalCents * weight) / shareTotal);
  const floors = exact.map(value => Math.floor(value));
  let remainder = totalCents - floors.reduce((sum, value) => sum + value, 0);

  // Who was rounded down hardest, biggest shortfall first. A tie goes to the
  // earlier entry so the same input always splits the same way.
  const order = exact
    .map((value, index) => ({ index, fraction: value - floors[index] }))
    .sort((a, b) => (b.fraction - a.fraction) || (a.index - b.index));

  const cents = [...floors];
  for (let i = 0; remainder > 0 && i < order.length; i += 1) {
    cents[order[i].index] += 1;
    remainder -= 1;
  }
  // A negative remainder happens when the total is negative, which a credit
  // note is. Take the cents back from the same order.
  for (let i = 0; remainder < 0 && i < order.length; i += 1) {
    cents[order[i].index] -= 1;
    remainder += 1;
  }

  return cents.map(fromCents);
}

export interface Split {
  /** What the client is charged. */
  clientTotal: number;
  /** What the candidate receives. */
  talentNet: number;
  /** What Kongila keeps. */
  platformMargin: number;
}

/**
 * Splits one period's rate between the three parties.
 *
 * The client pays the rate plus the fee. The candidate receives the rate
 * less the commission. Kongila keeps both halves of the spread, which is the
 * only place the platform's revenue comes from.
 */
export function splitRate(rate: number, fee: ServiceFee): Split {
  const base = Number(rate) || 0;
  const clientTotal = money(base * (1 + (fee.clientFeePct as number)));
  const talentNet = money(base * (1 - (fee.talentCommissionPct as number)));
  return { clientTotal, talentNet, platformMargin: money(clientTotal - talentNet) };
}

// ─── When the client pays ────────────────────────────────────────────────────

/**
 * One instalment of a charge.
 *
 * Clients do not all pay a whole invoice on one day. A common arrangement
 * for outsourcing is half on the 1st and half on the 15th, every month, and
 * modelling that as two separate invoices is wrong: it is one charge for one
 * month's work, falling due in two parts. Two invoices would double the
 * client's paperwork, break the "last period billed" bookkeeping, and make
 * the monthly figure in every report wrong.
 */
export interface PaymentSplit {
  /** Shown on the invoice, e.g. "First instalment". Optional. */
  label?: string;
  /** Share of the charge, as a percentage. All splits must total 100. */
  percent: number;
  /** Day of the month it falls due. 29 to 31 clamp to the month's last day. */
  dayOfMonth: number;
}

export interface PaymentSchedule {
  /**
   * True: these splits apply to every month the engagement runs.
   * False: they apply to the first invoice only, and later invoices fall due
   * in one part. That is the shape of a deposit arrangement.
   */
  recurring: boolean;
  splits: PaymentSplit[];
  /** Whether this service is invoiced every month. */
  serviceRecurring?: boolean;
  /** Day of month the recurring billing cycle runs, 1–31. */
  billingDayOfMonth?: number;
}

export interface Instalment {
  label: string;
  percent: number;
  /** ISO date. */
  dueDate: string;
  amount: number;
}

const SPLIT_TOLERANCE = 0.01;

/**
 * Why a schedule cannot be used, or null when it is fine.
 *
 * Deliberately refuses rather than normalising. A schedule totalling 90%
 * silently scaled to 100% invoices the client an amount nobody agreed, and
 * one totalling 110% overcharges them. Both are worse than an error message
 * at the moment somebody is typing it in.
 */
export function scheduleProblem(schedule?: PaymentSchedule | null): string | null {
  if (!schedule) return null;
  const splits = Array.isArray(schedule.splits) ? schedule.splits : [];
  if (splits.length === 0) {
    if (typeof schedule.serviceRecurring === 'boolean' || schedule.billingDayOfMonth != null) {
      if (schedule.billingDayOfMonth != null && (!Number.isInteger(schedule.billingDayOfMonth) || schedule.billingDayOfMonth < 1 || schedule.billingDayOfMonth > 31)) {
        return 'The billing day must be between 1 and 31.';
      }
      return null;
    }
    return 'Add at least one payment split, or remove the schedule.';
  }
  if (schedule.billingDayOfMonth != null && (!Number.isInteger(schedule.billingDayOfMonth) || schedule.billingDayOfMonth < 1 || schedule.billingDayOfMonth > 31)) {
    return 'The billing day must be between 1 and 31.';
  }

  const days = new Set<number>();
  for (const split of splits) {
    const percent = Number(split?.percent);
    if (!Number.isFinite(percent) || percent <= 0) {
      return 'Every split needs a percentage above zero.';
    }
    const day = Number(split?.dayOfMonth);
    if (!Number.isInteger(day) || day < 1 || day > 31) {
      return 'Every split needs a day of the month between 1 and 31.';
    }
    if (days.has(day)) return `Two splits both fall due on day ${day}. Combine them.`;
    days.add(day);
  }

  const total = splits.reduce((sum, split) => sum + Number(split.percent), 0);
  if (Math.abs(total - 100) > SPLIT_TOLERANCE) {
    return `The splits total ${money(total)}%, not 100%. The client would be invoiced the wrong amount.`;
  }

  return null;
}

/** Clamps a day to a month that may not have it. 31 February is the 28th. */
function dueDateFor(year: number, month: number, dayOfMonth: number): string {
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const day = Math.min(Math.max(1, Math.trunc(dayOfMonth)), lastDay);
  return new Date(Date.UTC(year, month - 1, day)).toISOString().slice(0, 10);
}

function addDays(iso: string, days: number): string {
  const base = Date.parse(iso);
  if (Number.isNaN(base)) return iso;
  return new Date(base + days * 86400000).toISOString().slice(0, 10);
}

/**
 * Splits a charge into the parts the client actually pays.
 *
 * The last instalment absorbs the rounding remainder, so the parts always
 * add up to the total to the cent. Three equal splits of 100.00 are 33.33,
 * 33.33 and 33.34, never 99.99.
 */
export function instalmentsFor(
  total: number,
  options: {
    schedule?: PaymentSchedule | null;
    /** YYYY-MM. Required for a schedule, since the days belong to a month. */
    period?: string | null;
    issuedAt: string;
    termsDays?: number | null;
    /** True on the first invoice of an engagement, for non-recurring schedules. */
    isFirstInvoice?: boolean;
  }
): Instalment[] {
  const amount = money(total);
  const termsDays = Number.isFinite(Number(options.termsDays)) && options.termsDays != null
    ? Number(options.termsDays)
    : 14;
  const single = (): Instalment[] => ([{
    label: 'Full amount',
    percent: 100,
    dueDate: addDays(options.issuedAt, termsDays),
    amount
  }]);

  const schedule = options.schedule;
  if (!schedule || scheduleProblem(schedule)) return single();
  if (!schedule.recurring && options.isFirstInvoice === false) return single();

  // The days belong to a month. A recurring invoice has one; a one-time fee
  // does not, so its schedule is read against the month it was issued in.
  const basis = options.period && /^\d{4}-\d{2}$/.test(options.period)
    ? options.period
    : String(options.issuedAt).slice(0, 7);
  const [yearText, monthText] = basis.split('-');
  const year = Number(yearText);
  const month = Number(monthText);
  if (!Number.isInteger(year) || !Number.isInteger(month)) return single();

  const splits = [...schedule.splits].sort((a, b) => a.dayOfMonth - b.dayOfMonth);

  // Split by weight rather than percentage-then-remainder. The old way gave
  // the last instalment whatever was left, which absorbed the rounding of
  // every one before it: three equal thirds came out 33.33, 33.33, 33.34 and
  // the client asked why the last one was different. Largest remainder
  // spreads the odd cents instead, and the parts still add to the whole.
  const shares = allocate(amount, splits.map(split => Number(split.percent) || 0));

  return splits.map((split, index) => ({
    label: split.label || `Instalment ${index + 1}`,
    percent: Number(split.percent),
    dueDate: dueDateFor(year, month, split.dayOfMonth),
    amount: shares[index]
  }));
}

/** What is due on or before a date, across a set of instalments. */
export function amountDueBy(instalments: Instalment[], onOrBefore: string): number {
  return sumMoney((instalments || [])
    .filter(part => part.dueDate <= onOrBefore)
    .map(part => part.amount));
}

// ─── What to invoice ─────────────────────────────────────────────────────────

export interface BillableContract {
  id: string;
  clientId: string;
  talentId: string;
  clientName?: string;
  talentName?: string;
  serviceType?: string | null;
  status?: string | null;
  /** The monthly rate for recurring lines. */
  rateAmount?: number | null;
  /** Agreed one-time fee for a project engagement. */
  projectFeeUsd?: number | null;
  /** Agreed one-time fee for a placement, when it is a flat amount. */
  placementFeeUsd?: number | null;
  startDate?: string | null;
  endDate?: string | null;
  currency?: string | null;
  /** Last period already invoiced, as YYYY-MM. Null means never billed. */
  billedThrough?: string | null;
  /** Present for database-backed billing; only active operational engagements bill. */
  engagementStatus?: string | null;
  managementPremiumPct?: number | null;
  /** Margins locked when the offer was accepted, when present. */
  clientFeePctSnapshot?: number | null;
  talentCommissionPctSnapshot?: number | null;

  /**
   * Placement billed as a percentage of what the client will pay the person
   * in a year, which is how recruitment is actually sold. A flat
   * placementFeeUsd still wins when it is set, because an agreed number
   * beats a calculated one.
   */
  annualSalaryUsd?: number | null;
  placementFeePct?: number | null;

  /**
   * When the client pays, within the month.
   *
   * A client paying 50% on the 1st and 50% on the 15th is one charge with
   * two due dates, not two charges. Absent means the whole amount on the
   * invoice's own due date.
   */
  paymentSchedule?: PaymentSchedule | null;
  isRecurring?: boolean | null;
  billingDayOfMonth?: number | null;
  /** Days from issue to due, when there is no schedule. */
  paymentTermsDays?: number | null;

  /** How many seats this contract covers. Managed teams only; defaults to 1. */
  seats?: number | null;
}

export interface InvoiceLine {
  description: string;
  quantity: number;
  unitAmount: number;
  amount: number;
}

export interface InvoiceDraft {
  contractId: string;
  clientId: string;
  talentId: string;
  serviceLine: ServiceLine;
  billingModel: BillingModel;
  /** What the contract is denominated in. */
  currency: string;
  /** YYYY-MM for a recurring invoice, null for a one-time fee. */
  period: string | null;
  recurring?: boolean;
  billingDayOfMonth?: number;
  lines: InvoiceLine[];
  subtotal: number;
  total: number;
  /** What the candidate is owed for the same period, if anything. */
  talentPayout: number | null;
  /** The amount the commission was taken from, so a payout can show its working. */
  talentGross: number | null;
  /** The commission rate applied, recorded with the payout rather than inferred later. */
  talentCommissionPct: number | null;
  platformMargin: number;
  /**
   * When each part of this invoice falls due.
   *
   * Always at least one entry, so a caller never has to decide whether to
   * read `instalments` or `total`. A client with no split schedule gets one
   * instalment for the whole amount.
   */
  instalments: Instalment[];
  /** Set on a milestone invoice, so the milestone can be marked billed. */
  milestoneId?: string | null;
}

export interface SkippedContract {
  contractId: string;
  reason: string;
}

export interface BillingPlan {
  drafts: InvoiceDraft[];
  skipped: SkippedContract[];
}

/** Statuses that mean the engagement is live enough to bill. */
const BILLABLE_STATUSES = new Set([
  'active', 'signed', 'fully_signed'
]);

function normalised(status?: string | null): string {
  return String(status || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
}

function monthKey(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

function parseMonth(key: string): { year: number; month: number } | null {
  const match = /^(\d{4})-(\d{2})$/.exec(String(key || ''));
  if (!match) return null;
  const month = Number(match[2]);
  if (month < 1 || month > 12) return null;
  return { year: Number(match[1]), month };
}

function nextMonth(key: string): string {
  const parsed = parseMonth(key);
  if (!parsed) return key;
  const { year, month } = parsed;
  return month === 12
    ? `${year + 1}-01`
    : `${year}-${String(month + 1).padStart(2, '0')}`;
}

function previousMonth(key: string): string {
  const [year, month] = key.split('-').map(Number);
  return month === 1 ? `${year - 1}-12` : `${year}-${String(month - 1).padStart(2, '0')}`;
}

/**
 * The months a recurring contract owes, oldest first.
 *
 * Counted from the start date or from the last period billed, so a run that
 * was missed for two months catches up rather than quietly skipping them,
 * and a run repeated twice in a day produces nothing the second time.
 */
export function periodsDue(
  contract: BillableContract,
  asOf: Date,
  maxPeriods = 24
): string[] {
  const currentMonth = monthKey(asOf);
  const billingDay = Math.min(31, Math.max(1, Number(contract.billingDayOfMonth || contract.paymentSchedule?.billingDayOfMonth || 1)));
  const current = asOf.getUTCDate() >= billingDay ? currentMonth : previousMonth(currentMonth);

  let cursor: string;
  if (contract.billedThrough) {
    cursor = nextMonth(contract.billedThrough);
  } else if (contract.startDate) {
    const start = new Date(contract.startDate);
    if (Number.isNaN(start.getTime())) return [];
    cursor = monthKey(start);
  } else {
    return [];
  }

  if (contract.paymentSchedule?.serviceRecurring === false) {
    if (contract.billedThrough || cursor > current) return [];
    return [cursor];
  }

  // An engagement that has ended stops billing after its last month.
  let limit = current;
  if (contract.endDate) {
    const end = new Date(contract.endDate);
    if (!Number.isNaN(end.getTime())) {
      const endKey = monthKey(end);
      if (endKey < limit) limit = endKey;
    }
  }

  const periods: string[] = [];
  while (cursor <= limit && periods.length < maxPeriods) {
    periods.push(cursor);
    cursor = nextMonth(cursor);
  }
  return periods;
}

function label(contract: BillableContract): string {
  return contract.talentName || `contract ${contract.id}`;
}

/**
 * The salary a percentage placement fee is calculated from.
 *
 * Prefers the figure somebody entered. Falls back to twelve times the
 * monthly rate, which is what a placement contract's rate means, and
 * returns null rather than guessing when there is neither — a placement fee
 * invoiced off an invented salary is a number the client will dispute and
 * be right to.
 */
function placementSalary(contract: BillableContract): number | null {
  const annual = Number(contract.annualSalaryUsd);
  if (Number.isFinite(annual) && annual > 0) return money(annual);
  const monthly = Number(contract.rateAmount);
  if (Number.isFinite(monthly) && monthly > 0) return money(monthly * 12);
  return null;
}

/**
 * Turns one contract into the invoices it owes, or says why it owes none.
 *
 * Every refusal names the contract and what is missing, because the admin
 * running this needs to fix it, not wonder why the run produced nothing.
 */
export function draftsForContract(
  contract: BillableContract,
  fees: ServiceFee[],
  asOf: Date
): { drafts: InvoiceDraft[]; skipped: SkippedContract[] } {
  const skip = (reason: string) => ({ drafts: [], skipped: [{ contractId: contract.id, reason }] });

  if (!BILLABLE_STATUSES.has(normalised(contract.status))) {
    return { drafts: [], skipped: [] };
  }
  if (contract.engagementStatus && normalised(contract.engagementStatus) !== 'active') {
    return { drafts: [], skipped: [] };
  }

  const line = serviceLineOf(contract.serviceType);
  if (!line) {
    return skip(
      `${label(contract)}: the service type "${contract.serviceType || 'none'}" is not one of the four ` +
      'service lines, so there is no way to know how to bill it.'
    );
  }

  const configuredFee = feeFor(contract.serviceType, fees);
  const hasSnapshot = Number.isFinite(Number(contract.clientFeePctSnapshot))
    && contract.clientFeePctSnapshot != null
    && Number.isFinite(Number(contract.talentCommissionPctSnapshot))
    && contract.talentCommissionPctSnapshot != null;
  const fee = hasSnapshot
    ? {
        serviceLine: line,
        clientFeePct: Number(contract.clientFeePctSnapshot),
        talentCommissionPct: Number(contract.talentCommissionPctSnapshot)
      }
    : configuredFee;
  if (line !== 'placement' && !feeIsSet(fee)) {
    return skip(
      `${label(contract)}: no fee is configured for ${line.replace(/_/g, ' ')}. ` +
      'Set the client fee and talent commission for that service line before billing it.'
    );
  }
  const applicableFee: ServiceFee = feeIsSet(fee)
    ? fee as ServiceFee
    : { serviceLine: line, clientFeePct: 0, talentCommissionPct: 0 };

  const model = MODEL_BY_LINE[line];

  // ── One-time fees ──────────────────────────────────────────────────────────
  if (model === 'placement_fee' || model === 'project_fee') {
    // Already billed once. A one-time fee is one time.
    if (contract.billedThrough) return { drafts: [], skipped: [] };

    // A placement is usually sold as a percentage of what the client will
    // pay the person in a year. A flat figure still wins when one is set,
    // because a number both sides agreed beats a number this code worked
    // out.
    let agreed: number | null | undefined = model === 'placement_fee'
      ? contract.placementFeeUsd
      : contract.projectFeeUsd;

    if (model === 'placement_fee'
        && (agreed == null || !Number.isFinite(Number(agreed)) || Number(agreed) <= 0)) {
      const pct = Number(contract.placementFeePct);
      const salary = placementSalary(contract);
      if (Number.isFinite(pct) && pct > 0 && salary != null) {
        agreed = money(salary * pct);
      }
    }

    if (agreed == null || !Number.isFinite(Number(agreed)) || Number(agreed) <= 0) {
      if (model === 'placement_fee') {
        return skip(
          `${label(contract)}: the placement fee cannot be worked out. ` +
          'Set either a flat placement fee, or a placement fee percentage and the annual salary ' +
          'the client will pay.'
        );
      }
      return skip(
        `${label(contract)}: no project fee is set on the contract. ` +
        'A one-time engagement cannot be billed from a monthly rate.'
      );
    }

    const baseAmount = money(Number(agreed));
    const clientFeePct = applicableFee.clientFeePct as number;
    // A placement percentage is the complete one-time fee on annual salary.
    // Do not stack the recurring client margin on top of that fee.
    const clientFee = model === 'placement_fee' ? 0 : money(baseAmount * clientFeePct);
    const amount = money(baseAmount + clientFee);
    const placementPct = Number(contract.placementFeePct);
    const salaryBasis = model === 'placement_fee' ? placementSalary(contract) : null;
    const showsPercentage = model === 'placement_fee'
      && (contract.placementFeeUsd == null || !(Number(contract.placementFeeUsd) > 0))
      && Number.isFinite(placementPct) && placementPct > 0 && salaryBasis != null;

    // The client should be able to check the arithmetic without asking.
    const description = model === 'placement_fee'
      ? (showsPercentage
          ? `Placement fee: ${label(contract)} (${money(placementPct * 100)}% of ${
              (salaryBasis as number).toLocaleString('en-US')} annual salary)`
          : `Placement fee: ${label(contract)}`)
      : `Project fee: ${label(contract)}`;

    // A placement hands the candidate to the client as their own employee,
    // so Kongila pays them nothing and the whole fee is margin. A project is
    // delivered by a Kongila candidate, who is paid their share of it.
    const commission = applicableFee.talentCommissionPct as number;
    const talentNet = model === 'project_fee'
      ? money(baseAmount * (1 - commission))
      : null;

    const lines: InvoiceLine[] = [{
      description,
      quantity: 1,
      unitAmount: baseAmount,
      amount: baseAmount
    }];
    if (clientFee > 0) lines.push({
      description: 'Kongila service fee',
      quantity: 1,
      unitAmount: clientFee,
      amount: clientFee
    });

    const issuedAt = asOf.toISOString().slice(0, 10);

    return {
      drafts: [{
        contractId: contract.id,
        clientId: contract.clientId,
        talentId: contract.talentId,
        serviceLine: line,
        billingModel: model,
        currency: String(contract.currency || 'USD').toUpperCase(),
        period: null,
        lines,
        subtotal: amount,
        total: amount,
        talentPayout: talentNet,
        talentGross: talentNet === null ? null : baseAmount,
        talentCommissionPct: talentNet === null ? null : commission,
        platformMargin: money(amount - (talentNet || 0)),
        instalments: instalmentsFor(amount, {
          schedule: contract.paymentSchedule,
          period: null,
          issuedAt,
          termsDays: contract.paymentTermsDays,
          isFirstInvoice: true
        })
      }],
      skipped: []
    };
  }

  // ── Recurring ──────────────────────────────────────────────────────────────
  const rate = Number(contract.rateAmount || 0);
  if (!Number.isFinite(rate) || rate <= 0) {
    return skip(`${label(contract)}: the monthly rate is zero or missing, so there is nothing to bill.`);
  }

  const periods = periodsDue(contract, asOf);
  if (periods.length === 0) return { drafts: [], skipped: [] };

  const split = splitRate(rate, applicableFee);
  const premiumPct = Number(contract.managementPremiumPct || 0);

  // Seats, for a managed team billed by headcount rather than per person.
  // Anything other than managed workforce bills one seat: an outsourced
  // person is one person, and a contract claiming three of them would
  // triple the charge with nobody to pay for the other two.
  const seatCount = line === 'managed_workforce'
    ? Math.max(1, Math.trunc(Number(contract.seats) || 1))
    : 1;

  const issuedAt = asOf.toISOString().slice(0, 10);
  const firstPeriod = periods[0];

  const drafts = periods.map(period => {
    const parsed = parseMonth(period)!;
    const monthDays = new Date(Date.UTC(parsed.year, parsed.month, 0)).getUTCDate();
    const first = Date.UTC(parsed.year, parsed.month - 1, 1);
    const last = Date.UTC(parsed.year, parsed.month - 1, monthDays);
    const from = contract.startDate ? Math.max(first, Date.parse(contract.startDate)) : first;
    const to = contract.endDate ? Math.min(last, Date.parse(contract.endDate)) : last;
    const days = to < from ? 0 : Math.round((to - from) / 86400000) + 1;
    const fraction = monthDays ? days / monthDays : 1;
    const basePerSeat = money(rate * fraction);
    const baseClient = money(basePerSeat * seatCount);
    const clientFee = money(baseClient * (applicableFee.clientFeePct as number));
    const supervision = money(rate * premiumPct * fraction * seatCount);
    const clientTotal = money(baseClient + clientFee + supervision);
    const lines: InvoiceLine[] = [{
      description: seatCount > 1
        ? `${label(contract)} — managed team, ${seatCount} seats, ${period}`
        : `${label(contract)} — ${line.replace(/_/g, ' ')}, ${period}`,
      quantity: seatCount,
      unitAmount: basePerSeat,
      amount: baseClient
    }];
    if (clientFee > 0) lines.push({
      description: `Kongila client service fee (${Math.round((applicableFee.clientFeePct as number) * 100)}%), ${period}`,
      quantity: 1,
      unitAmount: clientFee,
      amount: clientFee
    });
    if (supervision > 0) lines.push({
      description: `Kongila supervision (${Math.round(premiumPct * 100)}%), ${period}`,
      quantity: 1,
      unitAmount: supervision,
      amount: supervision
    });
    return {
      contractId: contract.id,
      clientId: contract.clientId,
      talentId: contract.talentId,
      serviceLine: line,
      billingModel: model,
      currency: String(contract.currency || 'USD').toUpperCase(),
      period,
      recurring: contract.paymentSchedule?.serviceRecurring !== false,
      billingDayOfMonth: contract.billingDayOfMonth || contract.paymentSchedule?.billingDayOfMonth || 1,
      lines,
      subtotal: clientTotal,
      total: clientTotal,
      // One person, one payout, however many seats the client is billed
      // for. A multi-seat team contract pays its members through their own
      // contracts; paying this one per seat would pay one person for all of
      // them.
      talentPayout: money(split.talentNet * fraction),
      // The rate is what the commission comes out of, not the client total.
      talentGross: money(rate * fraction),
      talentCommissionPct: (fee as ServiceFee).talentCommissionPct as number,
      platformMargin: money(clientTotal - split.talentNet * fraction),
      instalments: instalmentsFor(clientTotal, {
        schedule: contract.paymentSchedule,
        period,
        issuedAt,
        termsDays: contract.paymentTermsDays,
        isFirstInvoice: period === firstPeriod && !contract.billedThrough
      })
    };
  });

  return { drafts, skipped: [] };
}

/** The whole run: every contract, every period owed. */
export function planInvoices(
  contracts: BillableContract[],
  fees: ServiceFee[],
  asOf: Date = new Date()
): BillingPlan {
  const plan: BillingPlan = { drafts: [], skipped: [] };

  for (const contract of contracts || []) {
    const result = draftsForContract(contract, fees, asOf);
    plan.drafts.push(...result.drafts);
    plan.skipped.push(...result.skipped);
  }

  return plan;
}

/** A one-line summary for the admin who pressed the button. */
export function describePlan(plan: BillingPlan): string {
  const value = sumMoney(plan.drafts.map(d => d.total));

  if (plan.drafts.length === 0 && plan.skipped.length === 0) {
    return 'Nothing is due. No active contract has an unbilled period.';
  }

  const made = plan.drafts.length === 1
    ? `1 draft invoice for $${value.toLocaleString('en-US')}`
    : `${plan.drafts.length} draft invoices for $${value.toLocaleString('en-US')}`;

  if (plan.skipped.length === 0) return `${made}.`;

  const held = plan.skipped.length === 1
    ? '1 contract was skipped'
    : `${plan.skipped.length} contracts were skipped`;

  return `${made}. ${held} and needs attention.`;
}

// ─── Project milestones ──────────────────────────────────────────────────────

/**
 * A piece of a project that can be billed on its own.
 *
 * A project fee invoiced once, at the end, is the arrangement nobody uses:
 * the client will not pay everything up front and Kongila will not carry
 * three months of payroll before seeing any of it. So a project is billed
 * against milestones, and a milestone becomes an invoice when somebody says
 * it was delivered.
 *
 * Percentages, not amounts, by default: the project fee can still be
 * renegotiated after the milestones were agreed, and percentages follow it.
 * An explicit amount wins where one is set, for the deposit that was agreed
 * as a round number.
 */
export interface ProjectMilestone {
  id: string;
  name: string;
  /** When the work is due, not when the money is. */
  dueDate?: string | null;
  /** Share of the project fee. Ignored when amountUsd is set. */
  percent?: number | null;
  amountUsd?: number | null;
  status?: 'pending' | 'delivered' | 'invoiced' | 'paid' | string | null;
  deliveredAt?: string | null;
}

/**
 * Why a set of milestones cannot be used, or null when it is fine.
 *
 * The same refusal-rather-than-normalise rule as payment splits, for the
 * same reason: milestones totalling 80% of the fee means 20% of the project
 * is never invoiced, and nobody notices until the year-end reconciliation.
 */
export function milestoneProblem(milestones: ProjectMilestone[]): string | null {
  const list = Array.isArray(milestones) ? milestones : [];
  if (list.length === 0) return 'Add at least one milestone before billing a project.';

  const ids = new Set<string>();
  let percentTotal = 0;
  let percentCount = 0;

  for (const milestone of list) {
    if (!milestone?.id) return 'Every milestone needs an id.';
    if (ids.has(milestone.id)) return `Two milestones share the id ${milestone.id}.`;
    ids.add(milestone.id);
    if (!String(milestone.name || '').trim()) return 'Every milestone needs a name.';

    const amount = Number(milestone.amountUsd);
    const percent = Number(milestone.percent);
    const hasAmount = Number.isFinite(amount) && amount > 0;
    const hasPercent = Number.isFinite(percent) && percent > 0;

    if (!hasAmount && !hasPercent) {
      return `"${milestone.name}" has neither a percentage nor an amount.`;
    }
    if (hasPercent && !hasAmount) {
      percentTotal += percent;
      percentCount += 1;
    }
  }

  // Only the percentage-based milestones have to total 100, and only when
  // every milestone is percentage-based. A mix of a fixed deposit and
  // percentages of the remainder is a legitimate arrangement.
  if (percentCount === list.length && Math.abs(percentTotal - 100) > SPLIT_TOLERANCE) {
    return `The milestones total ${money(percentTotal)}% of the project fee, not 100%.`;
  }

  return null;
}

/**
 * Why a milestone plan does not add up against the fee it is billing, or
 * null when it does.
 *
 * `milestoneProblem` checks the plan is internally coherent. This checks it
 * against the money: the milestones are the only thing that will ever be
 * invoiced on a project, so a plan totalling less than the fee is revenue
 * nobody will bill, and one totalling more is a client who will be
 * overcharged against what they agreed. Both are found at the year end
 * otherwise, which is far too late.
 *
 * A tolerance of one cent absorbs the rounding of percentages that do not
 * divide cleanly. Anything wider is a mistake, not rounding.
 */
export function milestonePlanProblem(
  milestones: ProjectMilestone[],
  projectFee: number
): string | null {
  const basic = milestoneProblem(milestones);
  if (basic) return basic;

  const fee = Number(projectFee);
  if (!Number.isFinite(fee) || fee <= 0) {
    return 'Set the project fee before planning the milestones against it.';
  }

  const total = sumMoney((milestones || []).map(milestone => milestoneAmount(milestone, fee)));

  if (Math.abs(total - money(fee)) <= 0.01) return null;

  const difference = money(Math.abs(total - money(fee)));
  return total < fee
    ? `The milestones come to ${money(total)} of a ${money(fee)} project fee. `
      + `${difference} would never be invoiced.`
    : `The milestones come to ${money(total)}, which is ${difference} more than the `
      + `${money(fee)} project fee.`;
}

/** What a milestone is worth, given the project fee. */
export function milestoneAmount(milestone: ProjectMilestone, projectFee: number): number {
  const explicit = Number(milestone?.amountUsd);
  if (Number.isFinite(explicit) && explicit > 0) return money(explicit);
  const percent = Number(milestone?.percent);
  if (Number.isFinite(percent) && percent > 0) return money(Number(projectFee || 0) * (percent / 100));
  return 0;
}

/**
 * The invoices a project owes right now.
 *
 * One per milestone that has been delivered and not yet invoiced. Nothing
 * is billed on a date alone: a milestone whose due date has passed and
 * which nobody has delivered is a project running late, not a bill.
 */
export function milestoneDrafts(
  contract: BillableContract,
  milestones: ProjectMilestone[],
  fees: ServiceFee[],
  asOf: Date = new Date()
): { drafts: InvoiceDraft[]; skipped: SkippedContract[] } {
  const skip = (reason: string) => ({ drafts: [], skipped: [{ contractId: contract.id, reason }] });

  const line = serviceLineOf(contract.serviceType);
  if (line !== 'project') {
    return skip(`${label(contract)}: milestones only apply to project engagements.`);
  }
  if (!BILLABLE_STATUSES.has(normalised(contract.status))) return { drafts: [], skipped: [] };
  if (contract.engagementStatus && normalised(contract.engagementStatus) !== 'active') {
    return { drafts: [], skipped: [] };
  }

  const problem = milestoneProblem(milestones);
  if (problem) return skip(`${label(contract)}: ${problem}`);

  const configuredFee = feeFor(contract.serviceType, fees);
  const hasSnapshot = contract.clientFeePctSnapshot != null
    && contract.talentCommissionPctSnapshot != null
    && Number.isFinite(Number(contract.clientFeePctSnapshot))
    && Number.isFinite(Number(contract.talentCommissionPctSnapshot));
  const fee = hasSnapshot
    ? {
        serviceLine: 'project' as ServiceLine,
        clientFeePct: Number(contract.clientFeePctSnapshot),
        talentCommissionPct: Number(contract.talentCommissionPctSnapshot)
      }
    : configuredFee;

  if (!feeIsSet(fee)) {
    return skip(
      `${label(contract)}: no fee is configured for project work. ` +
      'Set the client fee and talent commission for that service line before billing it.'
    );
  }

  const projectFee = Number(contract.projectFeeUsd || 0);
  const due = (milestones || []).filter(milestone => {
    const status = normalised(milestone.status);
    return status === 'delivered';
  });

  if (due.length === 0) return { drafts: [], skipped: [] };

  const issuedAt = asOf.toISOString().slice(0, 10);
  const clientFeePct = (fee as ServiceFee).clientFeePct as number;
  const commission = (fee as ServiceFee).talentCommissionPct as number;
  const drafts: InvoiceDraft[] = [];
  const skipped: SkippedContract[] = [];

  for (const milestone of due) {
    const base = milestoneAmount(milestone, projectFee);
    if (base <= 0) {
      skipped.push({
        contractId: contract.id,
        reason: `${label(contract)}: milestone "${milestone.name}" works out to nothing. `
          + 'Check the project fee and the milestone percentage.'
      });
      continue;
    }

    const serviceFee = money(base * clientFeePct);
    const total = money(base + serviceFee);
    const lines: InvoiceLine[] = [{
      description: `${milestone.name} — ${label(contract)}`,
      quantity: 1,
      unitAmount: base,
      amount: base
    }];
    if (serviceFee > 0) lines.push({
      description: 'Kongila service fee',
      quantity: 1,
      unitAmount: serviceFee,
      amount: serviceFee
    });

    const talentNet = money(base * (1 - commission));

    drafts.push({
      contractId: contract.id,
      clientId: contract.clientId,
      talentId: contract.talentId,
      serviceLine: 'project',
      billingModel: 'project_fee',
      currency: String(contract.currency || 'USD').toUpperCase(),
      period: null,
      lines,
      subtotal: total,
      total,
      talentPayout: talentNet,
      talentGross: base,
      talentCommissionPct: commission,
      platformMargin: money(total - talentNet),
      milestoneId: milestone.id,
      instalments: instalmentsFor(total, {
        schedule: contract.paymentSchedule,
        period: null,
        issuedAt,
        termsDays: contract.paymentTermsDays,
        isFirstInvoice: !contract.billedThrough
      })
    });
  }

  return { drafts, skipped };
}

// ─── One invoice per client, per period ──────────────────────────────────────

export interface GroupedInvoice {
  clientId: string;
  clientName?: string;
  serviceLine: ServiceLine;
  billingModel: BillingModel;
  currency: string;
  period: string | null;
  lines: InvoiceLine[];
  subtotal: number;
  total: number;
  instalments: Instalment[];
  /** The drafts this invoice was built from, so payouts still attach to contracts. */
  drafts: InvoiceDraft[];
}

/**
 * Collapses a month's drafts into the invoice a client actually receives.
 *
 * A managed team of eight is billed per seat, and sending eight invoices for
 * one team in one month is eight things to pay, eight references to chase
 * and eight rows in their ledger for one service. One invoice with eight
 * lines is the same money and a tenth of the friction.
 *
 * Grouped by client, period, service line and currency. Never across service
 * lines: a client buying both a managed team and an outsourced developer is
 * buying two different things on two different terms, and one invoice would
 * hide which.
 */
export function groupDraftsIntoInvoices(
  drafts: InvoiceDraft[],
  options: {
    /** Which lines are combined. Managed workforce by default. */
    combine?: ServiceLine[];
    issuedAt?: string;
    schedulesByClient?: Record<string, PaymentSchedule | null | undefined>;
    termsDaysByClient?: Record<string, number | null | undefined>;
  } = {}
): GroupedInvoice[] {
  const combine = new Set(options.combine || ['managed_workforce']);
  const issuedAt = options.issuedAt || new Date().toISOString().slice(0, 10);
  const grouped = new Map<string, GroupedInvoice>();
  const out: GroupedInvoice[] = [];

  for (const draft of drafts || []) {
    const one = (): GroupedInvoice => ({
      clientId: draft.clientId,
      serviceLine: draft.serviceLine,
      billingModel: draft.billingModel,
      currency: draft.currency,
      period: draft.period,
      lines: [...draft.lines],
      subtotal: draft.subtotal,
      total: draft.total,
      instalments: draft.instalments,
      drafts: [draft]
    });

    if (!combine.has(draft.serviceLine)) {
      out.push(one());
      continue;
    }

    const key = [draft.clientId, draft.serviceLine, draft.period || 'once', draft.currency].join('|');
    const existing = grouped.get(key);
    if (!existing) {
      const invoice = one();
      grouped.set(key, invoice);
      out.push(invoice);
      continue;
    }

    existing.lines.push(...draft.lines);
    existing.subtotal = money(existing.subtotal + draft.subtotal);
    existing.total = money(existing.total + draft.total);
    existing.drafts.push(draft);
  }

  // Instalments are recalculated on the grouped total, because 50% of eight
  // seats is not the sum of eight roundings of 50% of one seat.
  for (const invoice of grouped.values()) {
    if (invoice.drafts.length === 1) continue;
    invoice.instalments = instalmentsFor(invoice.total, {
      schedule: options.schedulesByClient?.[invoice.clientId],
      period: invoice.period,
      issuedAt,
      termsDays: options.termsDaysByClient?.[invoice.clientId],
      isFirstInvoice: false
    });
  }

  return out;
}

// ─── Telling finance what is coming ──────────────────────────────────────────

export interface UpcomingInvoice {
  contractId: string;
  clientId: string;
  clientName?: string;
  serviceLine: ServiceLine;
  /** The month it covers. */
  period: string;
  /** The day the invoice should be raised. */
  raiseOn: string;
  estimatedTotal: number;
  currency: string;
}

/**
 * The recurring invoices that fall due soon, so somebody raises them.
 *
 * A recurring engagement quietly stops being invoiced the moment nobody
 * remembers to run the month, and the first sign is a revenue figure that
 * looks low. This is what the alert to finance is built from: it answers
 * "what should go out in the next few days", not "what is overdue", because
 * overdue is already too late.
 */
export function upcomingInvoices(
  contracts: BillableContract[],
  fees: ServiceFee[],
  asOf: Date = new Date(),
  leadDays = 7
): UpcomingInvoice[] {
  const horizon = new Date(asOf.getTime() + leadDays * 86400000);
  const upcoming: UpcomingInvoice[] = [];

  for (const contract of contracts || []) {
    const line = serviceLineOf(contract.serviceType);
    if (!line || MODEL_BY_LINE[line] !== 'recurring_monthly') continue;
    if (!BILLABLE_STATUSES.has(normalised(contract.status))) continue;
    if (contract.engagementStatus && normalised(contract.engagementStatus) !== 'active') continue;

    // Look one month past today, so a run due early next month is seen in
    // the last days of this one.
    const plan = draftsForContract(contract, fees, horizon);
    for (const draft of plan.drafts) {
      if (!draft.period) continue;
      const raiseOn = draft.instalments[0]?.dueDate || horizon.toISOString().slice(0, 10);
      upcoming.push({
        contractId: contract.id,
        clientId: contract.clientId,
        clientName: contract.clientName,
        serviceLine: line,
        period: draft.period,
        raiseOn,
        estimatedTotal: draft.total,
        currency: draft.currency
      });
    }
  }

  return upcoming.sort((a, b) => a.raiseOn.localeCompare(b.raiseOn));
}
