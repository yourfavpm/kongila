/**
 * Issuing, sending and ageing invoices.
 *
 * What was missing: an invoice number anyone could quote, a due date drawn
 * from the contract rather than a constant, any mechanism that moved a
 * sent invoice to overdue, a PDF, and any way to send one. The client
 * portal's "receipt" was a template string printed from the browser.
 *
 * The decisions live in `@kongila/workflows/invoicing` and the PDF in
 * `@kongila/notifications/invoicePdf`, both of which import nothing and
 * are tested on their own. This is the part that reads and writes rows.
 */

import { getSupabaseClient } from './index';
import type { RequestActor as Actor } from './scope';
import { recordAudit } from './audit';
import { notifyUsers } from './notify';
import {
  nextInvoiceNumber,
  dueDateFrom,
  describeTerms,
  overdueTransitions,
  disputedAndAgeing,
  overdueMessage,
  DEFAULT_PAYMENT_TERMS_DAYS
} from '@kongila/workflows';
import { buildInvoicePdf, sendEmail, emailIsConfigured } from '@kongila/notifications';

export interface DeliveryResult<T = any> {
  ok: boolean;
  status: number;
  error?: string;
  data?: T;
  warnings?: string[];
}

function fail(status: number, error: string): DeliveryResult {
  return { ok: false, status, error };
}

function canIssue(actor: Actor): boolean {
  return actor.kind === 'admin'
    && (actor.role === 'super_admin' || actor.role === 'finance');
}

function monthOf(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

/**
 * Assigns the next number in the month and fixes the due date.
 *
 * Called when a draft becomes a real invoice. Numbers are not handed out
 * at draft time, so a draft that is deleted does not leave a gap in the
 * sequence that somebody has to explain.
 */
async function assignNumberAndDueDate(invoice: any, issuedAt: Date) {
  const supabase = getSupabaseClient();
  const period = monthOf(issuedAt);

  const { data: issued } = await supabase
    .from('invoices')
    .select('invoice_number')
    .like('invoice_number', `KNG-INV-${period.replace('-', '')}-%`);

  const number = invoice.invoice_number
    || nextInvoiceNumber(period, (issued || []).map((r: any) => r.invoice_number).filter(Boolean));

  // Terms come from the contract. The old flow added fourteen days to
  // today whatever the agreement said.
  let terms = invoice.payment_terms_days;
  if (terms == null && invoice.contract_id) {
    const { data: contract } = await supabase
      .from('contracts')
      .select('payment_terms_days')
      .eq('id', invoice.contract_id)
      .maybeSingle();
    terms = contract?.payment_terms_days ?? null;
  }

  return {
    number,
    paymentTermsDays: terms ?? DEFAULT_PAYMENT_TERMS_DAYS,
    dueDate: dueDateFrom(issuedAt, terms)
  };
}

async function invoicePdfFor(invoice: any): Promise<Buffer> {
  const supabase = getSupabaseClient();

  const { data: lines } = await supabase
    .from('invoice_line_items').select('*').eq('invoice_id', invoice.id);

  // The company name is on organizations. client_profiles has no
  // company_name column, so asking it for one returned nothing and every
  // invoice would have been addressed to "Client".
  const { data: profile } = await supabase
    .from('client_profiles').select('organization_id').eq('user_id', invoice.client_id).maybeSingle();

  const { data: org } = profile?.organization_id
    ? await supabase.from('organizations').select('name').eq('id', profile.organization_id).maybeSingle()
    : { data: null };

  // Set in platform_settings. Absent means absent: the PDF says payment
  // details will follow rather than printing a plausible account number.
  const { data: payToSetting } = await supabase
    .from('platform_settings')
    .select('value')
    .eq('key', 'contracting_entity_bank')
    .maybeSingle();

  return buildInvoicePdf({
    invoiceNumber: invoice.invoice_number || invoice.id,
    issuedAt: invoice.issued_at || invoice.created_at,
    dueDate: invoice.due_date,
    paymentTerms: describeTerms(invoice.payment_terms_days),
    currency: invoice.currency || 'USD',
    clientName: org?.name || 'Client',
    lines: (lines || []).map((line: any) => ({
      description: line.description,
      quantity: Number(line.quantity || 1),
      unitAmount: Number(line.unit_amount || 0),
      amount: Number(line.amount || 0)
    })),
    subtotal: Number(invoice.subtotal_usd ?? invoice.amount ?? 0),
    tax: Number(invoice.tax_amount_usd || 0),
    total: Number(invoice.total_usd ?? invoice.amount ?? 0),
    status: invoice.status,
    payTo: payToSetting?.value ? String(payToSetting.value).replace(/^"|"$/g, '') : null
  });
}

/** The PDF, for a download in either portal. */
export async function getInvoicePdf(
  actor: Actor,
  invoiceId: string
): Promise<DeliveryResult<{ filename: string; pdf: Buffer }>> {
  if (!actor) return fail(401, 'Not authenticated.');

  const supabase = getSupabaseClient();
  const { data: invoice } = await supabase
    .from('invoices').select('*').eq('id', invoiceId).maybeSingle();

  if (!invoice) return fail(404, 'That invoice does not exist.');
  if (actor.kind === 'talent') return fail(403, 'Invoices are between Kongila and the client.');
  if (actor.kind === 'client' && String(invoice.client_id) !== String(actor.userId)) {
    return fail(403, 'That invoice is not yours.');
  }
  if (String(invoice.status).toLowerCase() === 'draft' && actor.kind !== 'admin') {
    return fail(404, 'That invoice has not been issued yet.');
  }

  const pdf = await invoicePdfFor(invoice);
  return {
    ok: true,
    status: 200,
    data: { filename: `${invoice.invoice_number || invoice.id}.pdf`, pdf }
  };
}

/**
 * Issues a draft: numbers it, dates it, emails it with the PDF attached.
 *
 * Refuses rather than half-sending. An invoice recorded as sent that never
 * reached anybody is worse than one still sitting in drafts, because
 * nobody goes looking for it.
 */
export async function sendInvoice(
  actor: Actor,
  input: { invoiceId: string }
): Promise<DeliveryResult> {
  if (!actor) return fail(401, 'Not authenticated.');
  if (!canIssue(actor)) return fail(403, 'Only a super admin or finance can send an invoice.');

  const supabase = getSupabaseClient();
  const { data: invoice } = await supabase
    .from('invoices').select('*').eq('id', input.invoiceId).maybeSingle();

  if (!invoice) return fail(404, 'That invoice does not exist.');
  if (['paid', 'void'].includes(String(invoice.status).toLowerCase())) {
    return fail(409, `That invoice is ${invoice.status} and cannot be sent.`);
  }

  const { data: lines } = await supabase
    .from('invoice_line_items').select('id').eq('invoice_id', invoice.id).limit(1);
  if (!lines || lines.length === 0) {
    return fail(409, 'That invoice has no line items, so there is nothing to bill for.');
  }

  if (!emailIsConfigured()) {
    return fail(503,
      'Email is not configured, so the invoice cannot be sent. '
      + 'Set RESEND_API_KEY and RESEND_FROM first.');
  }

  const { data: client } = await supabase
    .from('users').select('email, name').eq('id', invoice.client_id).maybeSingle();

  if (!client?.email) {
    return fail(409, 'That client has no email address on file.');
  }

  const issuedAt = invoice.issued_at ? new Date(invoice.issued_at) : new Date();
  const { number, paymentTermsDays, dueDate } = await assignNumberAndDueDate(invoice, issuedAt);

  const prepared = {
    ...invoice,
    invoice_number: number,
    payment_terms_days: paymentTermsDays,
    due_date: dueDate,
    issued_at: issuedAt.toISOString(),
    status: 'sent'
  };

  const pdf = await invoicePdfFor(prepared);
  const total = Number(invoice.total_usd ?? invoice.amount ?? 0);
  const currency = invoice.currency || 'USD';

  const sent = await sendEmail({
    to: client.email,
    subject: `Invoice ${number} from Kongila`,
    body: [
      `Hello${client.name ? ` ${client.name}` : ''},`,
      '',
      `Invoice ${number} for ${currency} ${total.toLocaleString('en-US', { minimumFractionDigits: 2 })} `
        + `is attached. It is due by ${new Date(dueDate).toUTCString().slice(0, 16)} `
        + `(${describeTerms(paymentTermsDays).toLowerCase()}).`,
      '',
      'You can see the full breakdown, and raise a query against any line, in your Kongila portal.',
      '',
      'Kongila'
    ].join('\n'),
    attachments: [{
      filename: `${number}.pdf`,
      content: pdf.toString('base64'),
      contentType: 'application/pdf'
    }]
  });

  if (!sent.success) {
    // Nothing is written. The invoice stays a draft rather than being
    // recorded as sent to somebody who never received it.
    return fail(502, `The invoice was not sent: ${sent.error || 'the email provider refused it.'}`);
  }

  const now = new Date().toISOString();
  const { error } = await supabase
    .from('invoices')
    .update({
      invoice_number: number,
      payment_terms_days: paymentTermsDays,
      due_date: dueDate,
      issued_at: prepared.issued_at,
      sent_at: now,
      status: 'sent',
      pdf_generated_at: now
    })
    .eq('id', invoice.id);

  const warnings: string[] = [];
  if (error) {
    // The client has the invoice. Saying so matters more than failing.
    warnings.push(
      `The invoice was emailed but the record was not updated: ${error.message}. `
      + 'It may send twice if you retry.'
    );
  }

  await recordAudit(actor, {
    action: 'Send Invoice',
    details: `${number} emailed to ${client.email}, ${currency} ${total}, due ${dueDate.slice(0, 10)}.`,
    entityType: 'invoice',
    entityId: invoice.id
  });

  return {
    ok: true,
    status: 200,
    data: { id: invoice.id, invoiceNumber: number, dueDate, sentTo: client.email },
    warnings
  };
}

/**
 * Moves invoices past their due date to overdue, and tells the client.
 *
 * Run nightly. Nothing used to do this, so the overdue filter in the admin
 * panel and the overdue banner in the client portal both had nothing to
 * show whatever the due date said.
 */
export async function ageInvoices(now: Date = new Date()): Promise<DeliveryResult> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('invoices')
    .select('id, invoice_number, status, due_date, is_disputed, client_id, total_usd, amount')
    .in('status', ['sent', 'overdue']);

  if (error) return fail(500, error.message);

  const invoices = (data || []).map((row: any) => ({
    id: row.id,
    invoiceNumber: row.invoice_number,
    status: row.status,
    dueDate: row.due_date,
    isDisputed: row.is_disputed,
    clientId: row.client_id,
    totalUsd: Number(row.total_usd ?? row.amount ?? 0)
  }));

  const transitions = overdueTransitions(invoices, now);
  const held = disputedAndAgeing(invoices, now);
  const warnings: string[] = [];
  const stamp = now.toISOString();

  for (const change of transitions) {
    const { error: updateError } = await supabase
      .from('invoices')
      .update({ status: 'overdue', overdue_at: stamp, last_reminder_at: stamp })
      .eq('id', change.id)
      // Only if it is still 'sent'. Someone may have paid it in the
      // seconds since the list was read.
      .eq('status', 'sent');

    if (updateError) {
      warnings.push(`${change.invoiceNumber || change.id}: ${updateError.message}`);
      continue;
    }

    if (change.clientId) {
      const notified = await notifyUsers(change.clientId, 'request_received', {
        roleTitle: `Invoice ${change.invoiceNumber || ''} is overdue`,
        reason: overdueMessage(
          invoices.find((i: any) => i.id === change.id) as any, now
        )
      });
      warnings.push(...notified.warnings);
    }
  }

  return {
    ok: true,
    status: 200,
    data: {
      markedOverdue: transitions.length,
      // Surfaced because a dispute nobody resolves looks exactly like an
      // invoice being paid, and the money is just as missing.
      disputedAndAgeing: held.map((i: any) => ({
        id: i.id, invoiceNumber: i.invoiceNumber, totalUsd: i.totalUsd
      }))
    },
    warnings
  };
}
