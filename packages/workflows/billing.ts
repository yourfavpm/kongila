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
    case 'placement':          return 'placement';
    case 'outsource_talent':
    case 'outsourcing':        return 'outsourcing';
    case 'managed_workforce':  return 'managed_workforce';
    case 'project_execution':
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

/** Rounds to whole cents. Floating point money drifts otherwise. */
export function money(amount: number): number {
  return Math.round((Number(amount) + Number.EPSILON) * 100) / 100;
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
  const current = monthKey(asOf);

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

  const line = serviceLineOf(contract.serviceType);
  if (!line) {
    return skip(
      `${label(contract)}: the service type "${contract.serviceType || 'none'}" is not one of the four ` +
      'service lines, so there is no way to know how to bill it.'
    );
  }

  const fee = feeFor(contract.serviceType, fees);
  if (!feeIsSet(fee)) {
    return skip(
      `${label(contract)}: no fee is configured for ${line.replace(/_/g, ' ')}. ` +
      'Set the client fee and talent commission for that service line before billing it.'
    );
  }

  const model = MODEL_BY_LINE[line];

  // ── One-time fees ──────────────────────────────────────────────────────────
  if (model === 'placement_fee' || model === 'project_fee') {
    // Already billed once. A one-time fee is one time.
    if (contract.billedThrough) return { drafts: [], skipped: [] };

    const agreed = model === 'placement_fee'
      ? contract.placementFeeUsd
      : contract.projectFeeUsd;

    if (agreed == null || !Number.isFinite(Number(agreed)) || Number(agreed) <= 0) {
      const which = model === 'placement_fee' ? 'placement fee' : 'project fee';
      return skip(
        `${label(contract)}: no ${which} is set on the contract. ` +
        'A one-time engagement cannot be billed from a monthly rate.'
      );
    }

    const amount = money(Number(agreed));
    const description = model === 'placement_fee'
      ? `Placement fee: ${label(contract)}`
      : `Project fee: ${label(contract)}`;

    // A placement hands the candidate to the client as their own employee,
    // so Kongila pays them nothing and the whole fee is margin. A project is
    // delivered by a Kongila candidate, who is paid their share of it.
    const commission = (fee as ServiceFee).talentCommissionPct as number;
    const talentNet = model === 'project_fee'
      ? money(amount * (1 - commission))
      : null;

    return {
      drafts: [{
        contractId: contract.id,
        clientId: contract.clientId,
        talentId: contract.talentId,
        serviceLine: line,
        billingModel: model,
        currency: String(contract.currency || 'USD').toUpperCase(),
        period: null,
        lines: [{ description, quantity: 1, unitAmount: amount, amount }],
        subtotal: amount,
        total: amount,
        talentPayout: talentNet,
        talentGross: talentNet === null ? null : amount,
        talentCommissionPct: talentNet === null ? null : commission,
        platformMargin: money(amount - (talentNet || 0))
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

  const split = splitRate(rate, fee as ServiceFee);

  const drafts = periods.map(period => ({
    contractId: contract.id,
    clientId: contract.clientId,
    talentId: contract.talentId,
    serviceLine: line,
    billingModel: model,
    currency: String(contract.currency || 'USD').toUpperCase(),
    period,
    lines: [{
      description: `${label(contract)} — ${line.replace(/_/g, ' ')}, ${period}`,
      quantity: 1,
      unitAmount: split.clientTotal,
      amount: split.clientTotal
    }],
    subtotal: split.clientTotal,
    total: split.clientTotal,
    talentPayout: split.talentNet,
    // The rate is what the commission comes out of, not the client total.
    talentGross: money(rate),
    talentCommissionPct: (fee as ServiceFee).talentCommissionPct as number,
    platformMargin: split.platformMargin
  }));

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
  const value = money(plan.drafts.reduce((sum, d) => sum + d.total, 0));

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
