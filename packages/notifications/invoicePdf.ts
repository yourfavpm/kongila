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
import { BRAND_LOGO } from './brandLogo.ts';

export interface InvoicePdfLine {
  description: string;
  quantity?: number;
  unitAmount?: number;
  amount: number;
}

/** One part of a split payment, as it appears on the invoice. */
export interface InvoicePdfInstalment {
  label: string;
  dueDate: string;
  amount: number;
  percent?: number;
}

export interface InvoicePdfData {
  invoiceNumber: string;
  issuedAt: string;
  dueDate: string;
  paymentTerms: string;
  currency: string;
  clientName: string;
  clientAddress?: string | null;
  /** A sentence saying what was bought, above the line items. */
  serviceDescription?: string | null;
  /** The month or the engagement this invoice covers. */
  periodLabel?: string | null;
  reference?: string | null;
  lines: InvoicePdfLine[];
  subtotal: number;
  tax: number;
  total: number;
  /**
   * When each part falls due. One entry for an ordinary invoice, several
   * where the client pays in instalments. Shown as its own block, because
   * "total due" and "due today" being different numbers is exactly the
   * thing a client misreads.
   */
  instalments?: InvoicePdfInstalment[];
  status?: string | null;
  /** Shown in the footer. Null when it has not been set yet. */
  payTo?: string | null;
  notes?: string | null;
  /** Company details for the footer. */
  issuerName?: string | null;
  issuerAddress?: string | null;
  issuerEmail?: string | null;
  issuerRegistration?: string | null;
}

/** Kongila blue, taken from the wordmark. */
const BRAND: [number, number, number] = [0.043, 0.306, 0.722];
const INK: [number, number, number] = [0.08, 0.13, 0.25];
const MUTED: [number, number, number] = [0.42, 0.47, 0.55];

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
 * Breaks a sentence across lines that fit the width.
 *
 * The writer has no layout engine, so anything longer than its column has
 * to be split here or it runs off the page and under the next column.
 */
function wrap(text: string, width: number, size: number): string[] {
  const words = String(text || '').split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (textWidth(candidate, size) <= width) {
      current = candidate;
      continue;
    }
    if (current) lines.push(current);
    current = word;
  }
  if (current) lines.push(current);
  return lines;
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
  const instalments = (data.instalments || []).filter(part => part && part.amount != null);
  const isSplit = instalments.length > 1;

  // ── Header band ───────────────────────────────────────────────────────────
  // A band rather than a rule, because an invoice that arrives as an email
  // attachment is competing with every other PDF in the client's downloads
  // folder, and the first thing they should see is who it is from.
  ops.push({ kind: 'rect', x: 0, y: 0, width: PAGE_WIDTH, height: 96, rgb: [0.97, 0.98, 1] });

  // The wordmark, at its own aspect ratio so it is never stretched.
  const logoHeight = 30;
  const logoWidth = Math.round((BRAND_LOGO.width / BRAND_LOGO.height) * logoHeight);
  ops.push({
    kind: 'image',
    x: LEFT, y: 30, width: logoWidth, height: logoHeight,
    rgb: BRAND_LOGO.rgb, alpha: BRAND_LOGO.alpha,
    pixelWidth: BRAND_LOGO.width, pixelHeight: BRAND_LOGO.height
  });

  ops.push({
    kind: 'text', x: LEFT, y: 78, size: 8.5, rgb: MUTED,
    text: data.issuerName || 'Kongila'
  });

  ops.push({
    kind: 'text', x: RIGHT, y: 44, text: 'INVOICE', size: 20,
    font: 'Helvetica-Bold', align: 'right', rgb: BRAND
  });
  ops.push({
    kind: 'text', x: RIGHT, y: 62, text: data.invoiceNumber, size: 10.5,
    align: 'right', rgb: INK
  });
  if (data.status && String(data.status).toLowerCase() !== 'sent') {
    ops.push({
      kind: 'text', x: RIGHT, y: 78, size: 8.5, align: 'right', rgb: MUTED,
      text: String(data.status).toUpperCase()
    });
  }

  // ── Parties and dates ─────────────────────────────────────────────────────
  ops.push({ kind: 'text', x: LEFT, y: 136, text: 'BILL TO', size: 8, font: 'Helvetica-Bold', rgb: MUTED });
  ops.push({ kind: 'text', x: LEFT, y: 154, text: data.clientName || 'Client', size: 12, font: 'Helvetica-Bold', rgb: INK });
  let billToY = 170;
  if (data.clientAddress) {
    for (const part of String(data.clientAddress).split(/\n|,\s*/).slice(0, 3)) {
      if (!part.trim()) continue;
      ops.push({ kind: 'text', x: LEFT, y: billToY, text: fit(part.trim(), 240, 9), size: 9, rgb: MUTED });
      billToY += 13;
    }
  }

  const dates: [string, string][] = [
    ['Issued', shortDate(data.issuedAt)],
    [isSplit ? 'First payment due' : 'Due', shortDate(data.dueDate)],
    ['Terms', data.paymentTerms || 'Net 14 days']
  ];
  if (data.periodLabel) dates.push(['Period', data.periodLabel]);
  if (data.reference) dates.push(['Reference', fit(data.reference, 120, 9)]);

  dates.forEach(([label, value], index) => {
    const y = 136 + index * 15;
    const labelX = RIGHT - 180;
    ops.push({ kind: 'text', x: labelX, y, text: label, size: 9, rgb: MUTED });
    // Trimmed to what is left after the label, so a long value runs out of
    // room rather than printing on top of it. Payment terms are the usual
    // offender: "50% on the 1st, 50% on the 15th" is wider than the column.
    const available = RIGHT - labelX - textWidth(label, 9) - 10;
    ops.push({
      kind: 'text', x: RIGHT, y, text: fit(value, available, 9),
      size: 9, align: 'right', font: 'Helvetica-Bold', rgb: INK
    });
  });

  // ── What this is for ──────────────────────────────────────────────────────
  let y = Math.max(billToY + 14, 136 + dates.length * 15 + 10);
  if (data.serviceDescription) {
    ops.push({ kind: 'text', x: LEFT, y, text: 'FOR', size: 8, font: 'Helvetica-Bold', rgb: MUTED });
    y += 15;
    for (const part of wrap(data.serviceDescription, RIGHT - LEFT, 10).slice(0, 3)) {
      ops.push({ kind: 'text', x: LEFT, y, text: part, size: 10, rgb: INK });
      y += 14;
    }
    y += 10;
  }

  // ── Line items ────────────────────────────────────────────────────────────
  y = Math.max(y, 232);
  ops.push({ kind: 'rect', x: LEFT, y: y - 12, width: RIGHT - LEFT, height: 22, rgb: [0.95, 0.96, 0.99] });
  ops.push({ kind: 'text', x: LEFT + 8, y, text: 'DESCRIPTION', size: 8, font: 'Helvetica-Bold', rgb: MUTED });
  ops.push({ kind: 'text', x: RIGHT - 160, y, text: 'QTY', size: 8, font: 'Helvetica-Bold', align: 'right', rgb: MUTED });
  ops.push({ kind: 'text', x: RIGHT - 88, y, text: 'UNIT', size: 8, font: 'Helvetica-Bold', align: 'right', rgb: MUTED });
  ops.push({ kind: 'text', x: RIGHT - 8, y, text: 'AMOUNT', size: 8, font: 'Helvetica-Bold', align: 'right', rgb: MUTED });

  y += 24;
  const shown = (data.lines || []).slice(0, MAX_LINES);

  shown.forEach((line, index) => {
    if (index % 2 === 1) {
      ops.push({ kind: 'rect', x: LEFT, y: y - 11, width: RIGHT - LEFT, height: LINE_HEIGHT, rgb: [0.985, 0.99, 1] });
    }
    ops.push({ kind: 'text', x: LEFT + 8, y, text: fit(line.description || '', 270, 10), size: 10, rgb: INK });
    if (line.quantity !== undefined) {
      ops.push({ kind: 'text', x: RIGHT - 160, y, text: String(line.quantity), size: 10, align: 'right', rgb: INK });
    }
    if (line.unitAmount !== undefined) {
      ops.push({ kind: 'text', x: RIGHT - 88, y, text: amount(line.unitAmount, currency), size: 10, align: 'right', rgb: INK });
    }
    ops.push({ kind: 'text', x: RIGHT - 8, y, text: amount(line.amount, currency), size: 10, align: 'right', rgb: INK });
    y += LINE_HEIGHT;
  });

  const hidden = (data.lines || []).length - shown.length;
  if (hidden > 0) {
    // Said out loud rather than cut quietly. A client billed for twenty
    // things and shown fifteen will query the invoice, and they would be
    // right to.
    ops.push({
      kind: 'text', x: LEFT + 8, y, size: 9, rgb: MUTED,
      text: `${hidden} further ${hidden === 1 ? 'line is' : 'lines are'} itemised in your portal.`
    });
    y += LINE_HEIGHT;
  }

  // ── Totals ────────────────────────────────────────────────────────────────
  y += 10;
  ops.push({ kind: 'line', x1: RIGHT - 230, y1: y, x2: RIGHT, y2: y });
  y += 20;

  ops.push({ kind: 'text', x: RIGHT - 230, y, text: 'Subtotal', size: 10, rgb: MUTED });
  ops.push({ kind: 'text', x: RIGHT, y, text: amount(data.subtotal, currency), size: 10, align: 'right', rgb: INK });
  y += LINE_HEIGHT;

  ops.push({ kind: 'text', x: RIGHT - 230, y, text: 'Tax', size: 10, rgb: MUTED });
  ops.push({ kind: 'text', x: RIGHT, y, text: amount(data.tax, currency), size: 10, align: 'right', rgb: INK });
  y += LINE_HEIGHT + 6;

  ops.push({ kind: 'rect', x: RIGHT - 230, y: y - 15, width: 230, height: 26, rgb: [0.95, 0.96, 0.99] });
  ops.push({ kind: 'text', x: RIGHT - 222, y, text: 'Total', size: 11, font: 'Helvetica-Bold', rgb: INK });
  ops.push({ kind: 'text', x: RIGHT - 8, y, text: amount(data.total, currency), size: 12, font: 'Helvetica-Bold', align: 'right', rgb: BRAND });
  y += 34;

  // ── Payment schedule ──────────────────────────────────────────────────────
  //
  // The single most misread thing on a split invoice is which number to pay
  // now. So it gets its own block with the dates spelled out, and the first
  // row says "due now" rather than leaving the client to compare dates.
  if (isSplit) {
    ops.push({ kind: 'text', x: LEFT, y, text: 'PAYMENT SCHEDULE', size: 8, font: 'Helvetica-Bold', rgb: MUTED });
    y += 8;
    ops.push({ kind: 'line', x1: LEFT, y1: y, x2: RIGHT, y2: y });
    y += 18;

    instalments.slice(0, 6).forEach((part, index) => {
      const isFirst = index === 0;
      ops.push({
        kind: 'text', x: LEFT, y, size: 10, rgb: INK,
        font: isFirst ? 'Helvetica-Bold' : 'Helvetica',
        text: fit(part.label || `Instalment ${index + 1}`, 220, 10)
      });
      ops.push({
        kind: 'text', x: RIGHT - 150, y, size: 10, align: 'right', rgb: isFirst ? INK : MUTED,
        text: isFirst ? `Due now, ${shortDate(part.dueDate)}` : shortDate(part.dueDate)
      });
      ops.push({
        kind: 'text', x: RIGHT - 8, y, size: 10, align: 'right', rgb: INK,
        font: isFirst ? 'Helvetica-Bold' : 'Helvetica',
        text: amount(part.amount, currency)
      });
      y += LINE_HEIGHT;
    });

    y += 6;
    ops.push({
      kind: 'text', x: LEFT, y, size: 9, rgb: MUTED,
      text: `Pay ${amount(instalments[0].amount, currency)} by ${shortDate(instalments[0].dueDate)}. `
        + `The balance of ${amount(data.total - instalments[0].amount, currency)} follows on the dates above.`
    });
    y += 20;
  }

  // ── Footer ────────────────────────────────────────────────────────────────
  let footer = Math.max(y + 20, 712);
  ops.push({ kind: 'line', x1: LEFT, y1: footer - 16, x2: RIGHT, y2: footer - 16 });

  if (data.notes) {
    for (const part of wrap(data.notes, RIGHT - LEFT, 9).slice(0, 2)) {
      ops.push({ kind: 'text', x: LEFT, y: footer, text: part, size: 9, rgb: INK });
      footer += 13;
    }
  }

  // No invented bank details. If the account has not been configured, the
  // invoice says to ask rather than printing a plausible-looking number.
  ops.push({
    kind: 'text', x: LEFT, y: footer, size: 9, rgb: INK,
    text: data.payTo
      ? `Payable to: ${fit(data.payTo, 440, 9)}`
      : 'Payment details will be sent separately by your account manager.'
  });
  footer += 14;

  const issuerBits = [data.issuerAddress, data.issuerEmail, data.issuerRegistration]
    .filter(Boolean)
    .join('  |  ');
  if (issuerBits) {
    ops.push({ kind: 'text', x: LEFT, y: footer, size: 8, rgb: MUTED, text: fit(issuerBits, 460, 8) });
    footer += 12;
  }

  ops.push({
    kind: 'text', x: LEFT, y: footer, size: 8, rgb: MUTED,
    text: 'Questions about this invoice? Reply to this email or raise a ticket in your Kongila portal.'
  });

  return buildPdf(ops);
}
