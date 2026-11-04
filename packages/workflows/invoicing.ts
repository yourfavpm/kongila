/**
 * Invoice numbering, due dates and going overdue.
 *
 * What was there: an invoice number built from the date plus six characters
 * of a random id, no due date derived from anything, and nothing anywhere
 * that moved a sent invoice to overdue. An invoice sat at "sent" forever,
 * so the overdue filter in the admin panel and the overdue banner in the
 * client portal both had nothing to show, whatever the due date said.
 *
 * Three rules here:
 *
 *   1. An invoice number is sequential within its month and never reused.
 *      A random number cannot be read out over the phone, cannot be sorted,
 *      and gives a client no way to tell whether they have seen it before.
 *   2. The due date comes from the contract's payment terms, not a constant.
 *      Net 14 and net 30 are different commercial agreements.
 *   3. An invoice goes overdue on the day after its due date, unless it is
 *      disputed, in which case it waits. Chasing a client for money they
 *      have formally queried is how a disagreement becomes a lost account.
 *
 * This file imports nothing, so it can be tested on its own.
 */

// ─── Numbering ───────────────────────────────────────────────────────────────

export const INVOICE_PREFIX = 'KNG-INV';

/**
 * The number a client sees.
 *
 * `KNG-INV-202611-0007` is the seventh invoice issued in November 2026.
 * Sequence is per month, so the counter stays short and the month is
 * readable without a lookup.
 */
export function formatInvoiceNumber(period: string, sequence: number): string {
  const compact = String(period || '').replace(/-/g, '').slice(0, 6);
  return `${INVOICE_PREFIX}-${compact}-${String(sequence).padStart(4, '0')}`;
}

/** Pulls the sequence back out, for working out the next one. */
export function parseInvoiceNumber(
  number: string
): { period: string; sequence: number } | null {
  const match = new RegExp(`^${INVOICE_PREFIX}-(\\d{4})(\\d{2})-(\\d+)$`).exec(String(number || ''));
  if (!match) return null;
  return { period: `${match[1]}-${match[2]}`, sequence: Number(match[3]) };
}

/**
 * The next number for a month, given what has already been issued.
 *
 * Takes the highest sequence rather than the count, so a voided invoice
 * does not cause the next one to reuse its number. A reused invoice number
 * is the kind of thing an auditor asks about.
 */
export function nextInvoiceNumber(period: string, existingNumbers: string[]): string {
  let highest = 0;
  for (const number of existingNumbers || []) {
    const parsed = parseInvoiceNumber(number);
    if (parsed && parsed.period === period && parsed.sequence > highest) {
      highest = parsed.sequence;
    }
  }
  return formatInvoiceNumber(period, highest + 1);
}

// ─── Payment terms ───────────────────────────────────────────────────────────

/** Used when a contract does not say. Net 14 is what the old code hardcoded. */
export const DEFAULT_PAYMENT_TERMS_DAYS = 14;

export const ALLOWED_PAYMENT_TERMS = [0, 7, 14, 30, 45, 60, 90];

export function isValidPaymentTerms(days: unknown): boolean {
  // Number(null) is 0 and Number('') is 0, so a missing term would read as
  // "due on receipt" rather than falling back to the default. An invoice
  // that arrives already due is not a rounding error to the client.
  if (days === null || days === undefined || days === '') return false;
  const value = Number(days);
  return Number.isInteger(value) && value >= 0 && value <= 180;
}

/**
 * When an invoice falls due.
 *
 * The time of day is stripped, so an invoice issued at 23:50 on net 14 is
 * due at the end of the fourteenth day rather than ten minutes into it.
 */
export function dueDateFrom(issuedAt: string | Date, paymentTermsDays?: number | null): string {
  const issued = issuedAt instanceof Date ? issuedAt : new Date(issuedAt);
  if (Number.isNaN(issued.getTime())) return '';

  const days = isValidPaymentTerms(paymentTermsDays)
    ? Number(paymentTermsDays)
    : DEFAULT_PAYMENT_TERMS_DAYS;

  const due = new Date(Date.UTC(
    issued.getUTCFullYear(), issued.getUTCMonth(), issued.getUTCDate()
  ));
  due.setUTCDate(due.getUTCDate() + days);
  // End of the due day, so "due 14 November" means any time on the 14th.
  due.setUTCHours(23, 59, 59, 0);
  return due.toISOString();
}

/** Plain words for a client, rather than a number of days. */
export function describeTerms(paymentTermsDays?: number | null): string {
  const days = isValidPaymentTerms(paymentTermsDays)
    ? Number(paymentTermsDays)
    : DEFAULT_PAYMENT_TERMS_DAYS;
  if (days === 0) return 'Due on receipt';
  return `Net ${days} days`;
}

// ─── Going overdue ───────────────────────────────────────────────────────────

export interface AgeableInvoice {
  id: string;
  invoiceNumber?: string | null;
  status?: string | null;
  dueDate?: string | null;
  isDisputed?: boolean | null;
  clientId?: string | null;
  totalUsd?: number | null;
}

/** Statuses that can still go overdue. A draft has not been sent. */
const CHASEABLE = new Set(['sent', 'overdue']);

/** Midnight UTC on the day a timestamp falls, for counting whole days. */
function dayOf(value: Date): number {
  return Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate());
}

/**
 * How many days late, counted in calendar days rather than elapsed hours.
 *
 * An invoice due at the end of the 19th, read at 09:00 on the 20th, is a
 * day late. Counting elapsed milliseconds makes that nine hours, which
 * floors to zero, and the client is told it is due today.
 */
export function daysPastDue(invoice: AgeableInvoice, now: Date = new Date()): number {
  if (!invoice.dueDate) return 0;
  const due = new Date(invoice.dueDate);
  if (Number.isNaN(due.getTime())) return 0;
  const diff = dayOf(now) - dayOf(due);
  return diff <= 0 ? 0 : Math.round(diff / 86400000);
}

export function isOverdue(invoice: AgeableInvoice, now: Date = new Date()): boolean {
  if (!CHASEABLE.has(String(invoice.status || '').toLowerCase())) return false;
  // A disputed invoice is not chased. The dispute has to be settled first.
  if (invoice.isDisputed) return false;
  if (!invoice.dueDate) return false;
  return new Date(invoice.dueDate).getTime() < now.getTime();
}

export interface OverdueChange {
  id: string;
  invoiceNumber: string | null;
  clientId: string | null;
  daysPastDue: number;
  totalUsd: number;
}

/**
 * Which invoices should change to overdue on this run.
 *
 * Returns only the ones actually changing, so a nightly job that runs
 * twice does not notify the same client twice.
 */
export function overdueTransitions(
  invoices: AgeableInvoice[],
  now: Date = new Date()
): OverdueChange[] {
  return (invoices || [])
    .filter(invoice =>
      String(invoice.status || '').toLowerCase() === 'sent'
      && isOverdue(invoice, now))
    .map(invoice => ({
      id: invoice.id,
      invoiceNumber: invoice.invoiceNumber || null,
      clientId: invoice.clientId || null,
      daysPastDue: daysPastDue(invoice, now),
      totalUsd: Number(invoice.totalUsd || 0)
    }));
}

/**
 * Invoices held back from chasing because they are disputed.
 *
 * Worth surfacing separately: a dispute that nobody resolves looks exactly
 * like an invoice that is being paid, and the money is just as missing.
 */
export function disputedAndAgeing(
  invoices: AgeableInvoice[],
  now: Date = new Date()
): AgeableInvoice[] {
  return (invoices || []).filter(invoice =>
    invoice.isDisputed
    && CHASEABLE.has(String(invoice.status || '').toLowerCase())
    && daysPastDue(invoice, now) > 0);
}

/** How an ageing invoice should be described to the person who owes it. */
export function overdueMessage(invoice: AgeableInvoice, now: Date = new Date()): string {
  const days = daysPastDue(invoice, now);
  const label = invoice.invoiceNumber || invoice.id;

  if (days === 0) return `Invoice ${label} is due today.`;
  if (days === 1) return `Invoice ${label} was due yesterday.`;
  return `Invoice ${label} is ${days} days overdue.`;
}
