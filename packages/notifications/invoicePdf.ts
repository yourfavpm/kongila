/**
 * The invoice a client receives.
 *
 * There was no PDF. The client portal had a print-to-browser receipt built
 * from a template string, which produced a page only the person already
 * looking at the screen could get, and the invoice email did not exist at
 * all.
 *
 * Laid out in `pdf.ts`'s small vocabulary: text at a position, rules, and
 * right-aligned money. One page. If an invoice ever needs more line items
 * than fit, the overflow is stated rather than silently cut, because a
 * client who is billed for twenty things and shown fifteen will query it.
 */

import { buildPdf, textWidth, PAGE_WIDTH, type DrawOp } from './pdf.ts';

export interface InvoicePdfLine {
  description: string;
  quantity?: number;
  unitAmount?: number;
  amount: number;
}

export interface InvoicePdfData {
  invoiceNumber: string;
  issuedAt: string;
  dueDate: string;
  paymentTerms: string;
  currency: string;
  clientName: string;
  clientAddress?: string | null;
  lines: InvoicePdfLine[];
  subtotal: number;
  tax: number;
  total: number;
  status?: string | null;
  /** Shown in the footer. Null when it has not been set yet. */
  payTo?: string | null;
  notes?: string | null;
}

const LEFT = 48;
const RIGHT = PAGE_WIDTH - 48;
const LINE_HEIGHT = 18;
/** How many line items fit before the page runs out. */
const MAX_LINES = 22;

function amount(value: number, currency: string): string {
  const figure = Number(value || 0).toLocaleString('en-US', {
    minimumFractionDigits: 2, maximumFractionDigits: 2
  });
  return `${currency} ${figure}`;
}

function shortDate(value?: string | null): string {
  if (!value) return 'not set';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'not set';
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${date.getUTCDate()} ${months.at(date.getUTCMonth())} ${date.getUTCFullYear()}`;
}

/**
 * Cuts a description to fit its column.
 *
 * There is no text wrapping in the writer, so a long line would run under
 * the amount column and overlap it.
 */
function fit(text: string, width: number, size: number): string {
  if (textWidth(text, size) <= width) return text;
  let cut = text;
  while (cut.length > 3 && textWidth(`${cut}...`, size) > width) {
    cut = cut.slice(0, -1);
  }
  return `${cut}...`;
}

export function buildInvoicePdf(data: InvoicePdfData): Buffer {
  const ops: DrawOp[] = [];
  const currency = data.currency || 'USD';

  // ── Header ────────────────────────────────────────────────────────────────
  ops.push({ kind: 'text', x: LEFT, y: 64, text: 'KONGILA', size: 22, font: 'Helvetica-Bold' });
  ops.push({ kind: 'text', x: LEFT, y: 80, text: 'Global talent, managed end to end', size: 9 });

  ops.push({ kind: 'text', x: RIGHT, y: 64, text: 'INVOICE', size: 18, font: 'Helvetica-Bold', align: 'right' });
  ops.push({ kind: 'text', x: RIGHT, y: 82, text: data.invoiceNumber, size: 11, align: 'right' });

  if (data.status && String(data.status).toLowerCase() !== 'sent') {
    ops.push({
      kind: 'text', x: RIGHT, y: 98, size: 9, align: 'right',
      text: String(data.status).toUpperCase()
    });
  }

  ops.push({ kind: 'line', x1: LEFT, y1: 110, x2: RIGHT, y2: 110 });

  // ── Parties and dates ─────────────────────────────────────────────────────
  ops.push({ kind: 'text', x: LEFT, y: 134, text: 'BILL TO', size: 8, font: 'Helvetica-Bold' });
  ops.push({ kind: 'text', x: LEFT, y: 150, text: data.clientName || 'Client', size: 11, font: 'Helvetica-Bold' });
  if (data.clientAddress) {
    ops.push({ kind: 'text', x: LEFT, y: 165, text: fit(data.clientAddress, 240, 9), size: 9 });
  }

  const dates: [string, string][] = [
    ['Issued', shortDate(data.issuedAt)],
    ['Due', shortDate(data.dueDate)],
    ['Terms', data.paymentTerms || 'Net 14 days']
  ];
  dates.forEach(([label, value], index) => {
    const y = 134 + index * 16;
    ops.push({ kind: 'text', x: RIGHT - 110, y, text: label, size: 9 });
    ops.push({ kind: 'text', x: RIGHT, y, text: value, size: 9, align: 'right', font: 'Helvetica-Bold' });
  });

  // ── Line items ────────────────────────────────────────────────────────────
  let y = 212;
  ops.push({ kind: 'text', x: LEFT, y, text: 'DESCRIPTION', size: 8, font: 'Helvetica-Bold' });
  ops.push({ kind: 'text', x: RIGHT - 150, y, text: 'QTY', size: 8, font: 'Helvetica-Bold', align: 'right' });
  ops.push({ kind: 'text', x: RIGHT - 80, y, text: 'UNIT', size: 8, font: 'Helvetica-Bold', align: 'right' });
  ops.push({ kind: 'text', x: RIGHT, y, text: 'AMOUNT', size: 8, font: 'Helvetica-Bold', align: 'right' });
  ops.push({ kind: 'line', x1: LEFT, y1: y + 8, x2: RIGHT, y2: y + 8 });

  y += 26;
  const shown = (data.lines || []).slice(0, MAX_LINES);

  for (const line of shown) {
    ops.push({ kind: 'text', x: LEFT, y, text: fit(line.description || '', 280, 10), size: 10 });
    if (line.quantity !== undefined) {
      ops.push({ kind: 'text', x: RIGHT - 150, y, text: String(line.quantity), size: 10, align: 'right' });
    }
    if (line.unitAmount !== undefined) {
      ops.push({ kind: 'text', x: RIGHT - 80, y, text: amount(line.unitAmount, currency), size: 10, align: 'right' });
    }
    ops.push({ kind: 'text', x: RIGHT, y, text: amount(line.amount, currency), size: 10, align: 'right' });
    y += LINE_HEIGHT;
  }

  const hidden = (data.lines || []).length - shown.length;
  if (hidden > 0) {
    // Said out loud rather than cut quietly. A client billed for twenty
    // things and shown fifteen will query the invoice, and they would be
    // right to.
    ops.push({
      kind: 'text', x: LEFT, y, size: 9,
      text: `${hidden} further ${hidden === 1 ? 'line is' : 'lines are'} itemised in your portal.`
    });
    y += LINE_HEIGHT;
  }

  // ── Totals ────────────────────────────────────────────────────────────────
  y += 8;
  ops.push({ kind: 'line', x1: RIGHT - 220, y1: y, x2: RIGHT, y2: y });
  y += 20;

  ops.push({ kind: 'text', x: RIGHT - 220, y, text: 'Subtotal', size: 10 });
  ops.push({ kind: 'text', x: RIGHT, y, text: amount(data.subtotal, currency), size: 10, align: 'right' });
  y += LINE_HEIGHT;

  ops.push({ kind: 'text', x: RIGHT - 220, y, text: 'Tax', size: 10 });
  ops.push({ kind: 'text', x: RIGHT, y, text: amount(data.tax, currency), size: 10, align: 'right' });
  y += LINE_HEIGHT + 4;

  ops.push({ kind: 'line', x1: RIGHT - 220, y1: y - 12, x2: RIGHT, y2: y - 12 });
  ops.push({ kind: 'text', x: RIGHT - 220, y, text: 'Total due', size: 12, font: 'Helvetica-Bold' });
  ops.push({ kind: 'text', x: RIGHT, y, text: amount(data.total, currency), size: 12, font: 'Helvetica-Bold', align: 'right' });

  // ── Footer ────────────────────────────────────────────────────────────────
  let footer = 740;
  ops.push({ kind: 'line', x1: LEFT, y1: footer - 16, x2: RIGHT, y2: footer - 16 });

  if (data.notes) {
    ops.push({ kind: 'text', x: LEFT, y: footer, text: fit(data.notes, 440, 9), size: 9 });
    footer += 14;
  }

  // No invented bank details. If the account has not been configured, the
  // invoice says to ask rather than printing a plausible-looking number.
  ops.push({
    kind: 'text', x: LEFT, y: footer, size: 9,
    text: data.payTo
      ? `Payable to: ${fit(data.payTo, 440, 9)}`
      : 'Payment details will be sent separately by your account manager.'
  });

  ops.push({
    kind: 'text', x: LEFT, y: footer + 16, size: 8,
    text: 'Questions about this invoice? Reply to this email or raise a ticket in your Kongila portal.'
  });

  return buildPdf(ops);
}
