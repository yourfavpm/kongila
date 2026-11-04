/**
 * Billing, server side.
 *
 * `/api/finance/generate-drafts` used to return two invented invoices,
 * Horizon Fintech for $5,000 and Nexus Health for $3,200, hardcoded, every
 * time, with a comment listing what a real implementation would do. It read
 * no contract and wrote no row, so the finance screen showed the same two
 * fictional clients whatever was in the database.
 *
 * This does the four things that comment described, plus the two it did not
 * mention: it applies a margin, and it bills each service line the way that
 * line is actually sold.
 *
 * The decisions about what to bill live in `@kongila/workflows/billing`,
 * which imports nothing and is tested on its own. This file is the part
 * that talks to the database.
 */

import { getSupabaseClient } from './index';
import type { RequestActor as Actor } from './scope';
import { recordAudit } from './audit';
import { FALLBACK_RATES, normaliseCurrency, resolveRate, recordMoney } from '@kongila/utils';
import { notifyAdmins } from './notify';
import { complianceGate } from './signatureService';
import {
  planInvoices,
  describePlan,
  serviceLineOf,
  SERVICE_LINES,
  money,
  type ServiceFee,
  type ServiceLine,
  type InvoiceDraft,
  type BillingPlan
} from '@kongila/workflows';

export interface FinanceResult<T = any> {
  ok: boolean;
  status: number;
  error?: string;
  data?: T;
  warnings?: string[];
}

function fail(status: number, error: string): FinanceResult {
  return { ok: false, status, error };
}

function newId(prefix: string): string {
  return globalThis.crypto?.randomUUID?.()
    || `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// ─── Fee configuration ───────────────────────────────────────────────────────

/**
 * The four margins.
 *
 * A line missing from the table comes back with nulls rather than being
 * absent, so the billing code refuses it by name instead of treating the
 * contract as having an unknown service type.
 */
export async function readFees(): Promise<{ fees: ServiceFee[]; error?: string }> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('fee_config')
    .select('service_line, client_fee_pct, talent_commission_pct');

  if (error) return { fees: [], error: error.message };

  const byLine = new Map<string, any>(
    (data || []).map((row: any) => [String(row.service_line), row])
  );

  const fees = SERVICE_LINES.map(line => {
    const row = byLine.get(line);
    const toNumber = (v: any) => (v === null || v === undefined || v === '' ? null : Number(v));
    return {
      serviceLine: line,
      clientFeePct: row ? toNumber(row.client_fee_pct) : null,
      talentCommissionPct: row ? toNumber(row.talent_commission_pct) : null
    } as ServiceFee;
  });

  return { fees };
}

export async function listFees(actor: Actor): Promise<FinanceResult> {
  if (!actor) return fail(401, 'Not authenticated.');
  if (actor.kind !== 'admin') return fail(403, 'Only operations can see the fee configuration.');

  const { fees, error } = await readFees();
  if (error) return fail(500, error);

  // The change log comes back with the fees, because the only screen that
  // shows one shows the other. It used to read an array the db blob never
  // carried, so the panel was permanently empty.
  const supabase = getSupabaseClient();
  const { data: log } = await supabase
    .from('fee_audit_log')
    .select('*')
    .order('changed_at', { ascending: false })
    .limit(50);

  return {
    ok: true,
    status: 200,
    data: {
      fees,
      unset: fees.filter(f => f.clientFeePct === null || f.talentCommissionPct === null)
        .map(f => f.serviceLine),
      auditLog: (log || []).map((row: any) => ({
        id: row.id,
        serviceLine: row.service_line,
        changedBy: row.changed_by,
        previousClientFeePct: row.previous_client_fee_pct === null ? null : Number(row.previous_client_fee_pct),
        newClientFeePct: Number(row.new_client_fee_pct),
        previousTalentCommissionPct: row.previous_talent_commission_pct === null ? null : Number(row.previous_talent_commission_pct),
        newTalentCommissionPct: Number(row.new_talent_commission_pct),
        changedAt: row.changed_at
      }))
    }
  };
}

/**
 * Changes a margin, and records who changed it.
 *
 * A fee change silently rewrites what every future invoice is worth, so it
 * goes in its own append-only log as well as the audit trail.
 */
export async function setFee(
  actor: Actor,
  input: { serviceLine: string; clientFeePct: number; talentCommissionPct: number }
): Promise<FinanceResult> {
  if (!actor) return fail(401, 'Not authenticated.');
  if (actor.kind !== 'admin') return fail(403, 'Only operations can change a fee.');
  if (actor.role !== 'super_admin' && actor.role !== 'finance') {
    return fail(403, 'Only a super admin or finance can change a fee.');
  }

  const line = serviceLineOf(input.serviceLine);
  if (!line) return fail(400, `"${input.serviceLine}" is not one of the four service lines.`);

  for (const [name, value] of Object.entries({
    clientFeePct: input.clientFeePct,
    talentCommissionPct: input.talentCommissionPct
  })) {
    const n = Number(value);
    if (!Number.isFinite(n)) return fail(400, `${name} must be a number.`);
    if (n < 0 || n > 1) {
      return fail(400, `${name} is a fraction between 0 and 1. For 25 percent, send 0.25.`);
    }
  }

  const supabase = getSupabaseClient();
  const { data: existing } = await supabase
    .from('fee_config')
    .select('*')
    .eq('service_line', line)
    .maybeSingle();

  const now = new Date().toISOString();
  const { error } = await supabase
    .from('fee_config')
    .upsert({
      id: existing?.id || newId('fee'),
      service_line: line,
      client_fee_pct: Number(input.clientFeePct),
      talent_commission_pct: Number(input.talentCommissionPct),
      updated_by: actor.userId,
      updated_at: now
    }, { onConflict: 'service_line' });

  if (error) return fail(500, `The fee was not saved: ${error.message}`);

  const warnings: string[] = [];
  const { error: logError } = await supabase.from('fee_audit_log').insert({
    id: newId('feelog'),
    config_id: existing?.id || null,
    service_line: line,
    changed_by: actor.userId,
    previous_client_fee_pct: existing?.client_fee_pct ?? null,
    new_client_fee_pct: Number(input.clientFeePct),
    previous_talent_commission_pct: existing?.talent_commission_pct ?? null,
    new_talent_commission_pct: Number(input.talentCommissionPct),
    changed_at: now
  });
  if (logError) warnings.push(`The fee was saved but the change log failed: ${logError.message}`);

  await recordAudit(actor, {
    action: 'Change Service Fee',
    details: `${line}: client fee ${existing?.client_fee_pct ?? 'unset'} to ${input.clientFeePct}, `
           + `talent commission ${existing?.talent_commission_pct ?? 'unset'} to ${input.talentCommissionPct}.`,
    entityType: 'fee_config',
    entityId: line
  });

  return { ok: true, status: 200, data: { serviceLine: line }, warnings };
}

// ─── Generating invoices ─────────────────────────────────────────────────────

async function loadBillableContracts() {
  const supabase = getSupabaseClient();

  const { data: contracts, error } = await supabase
    .from('contracts')
    .select('*');
  if (error) throw new Error(error.message);

  const talentIds = [...new Set((contracts || []).map((c: any) => c.talent_id).filter(Boolean))];
  const { data: talents } = talentIds.length
    ? await supabase.from('talent_profiles').select('id, full_name').in('id', talentIds)
    : { data: [] as any[] };

  const nameOf = new Map((talents || []).map((t: any) => [String(t.id), t.full_name]));

  return (contracts || []).map((c: any) => ({
    id: c.id,
    clientId: c.client_id,
    talentId: c.talent_id,
    talentName: nameOf.get(String(c.talent_id)) || '',
    serviceType: c.service_type,
    status: c.status,
    rateAmount: Number(c.rate_amount || 0),
    placementFeeUsd: c.placement_fee_usd == null ? null : Number(c.placement_fee_usd),
    projectFeeUsd: c.project_fee_usd == null ? null : Number(c.project_fee_usd),
    startDate: c.start_date,
    endDate: c.end_date,
    currency: c.currency || 'USD',
    billedThrough: c.billed_through
  }));
}

/**
 * Works out what is due without writing anything.
 *
 * Worth having separately: an admin should be able to see what a run would
 * produce, and what it would refuse, before it produces it.
 */
export async function previewInvoices(
  actor: Actor,
  asOf: Date = new Date()
): Promise<FinanceResult<BillingPlan & { summary: string }>> {
  if (!actor) return fail(401, 'Not authenticated.');
  if (actor.kind !== 'admin') return fail(403, 'Only operations can run billing.');

  const { fees, error: feeError } = await readFees();
  if (feeError) return fail(500, `Could not read the fee configuration: ${feeError}`);

  try {
    const contracts = await loadBillableContracts();
    const plan = planInvoices(contracts, fees, asOf);
    return { ok: true, status: 200, data: { ...plan, summary: describePlan(plan) } };
  } catch (err: any) {
    return fail(500, err?.message || 'Could not read contracts.');
  }
}

/**
 * The rate to stamp on a money row.
 *
 * Contracts are USD today, so this is almost always a no-op. When one is
 * not, the figure is still stored with the rate that was used and its
 * source, so finance can find anything converted at a built-in estimate
 * rather than a real rate:
 *
 *   select id from invoices where rate_source = 'fallback';
 */
function rateFor(currency: string) {
  const code = normaliseCurrency(currency);
  if (code === 'USD') return resolveRate('USD', 'USD', undefined);

  // No live lookup from inside a write: a billing run must not depend on a
  // third-party API being up. The stored estimate is used and labelled.
  return resolveRate('USD', code, undefined);
}

async function writeDraft(draft: InvoiceDraft, now: string): Promise<{ id: string } | { error: string }> {
  const supabase = getSupabaseClient();
  const invoiceMoney = recordMoney(draft.total, draft.currency || 'USD', rateFor(draft.currency || 'USD'));

  const invoiceId = newId('inv');
  const dueDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();

  const { error: invoiceError } = await supabase.from('invoices').insert({
    id: invoiceId,
    invoice_number: `KNG-INV-${now.slice(0, 10).replace(/-/g, '')}-${invoiceId.slice(0, 6).toUpperCase()}`,
    client_id: draft.clientId,
    contract_id: draft.contractId,
    period: draft.period,
    service_line: draft.serviceLine,
    amount: draft.total,
    subtotal_usd: draft.subtotal,
    tax_amount_usd: 0,
    total_usd: draft.total,
    // Contracts are denominated in USD today. The rate is stored rather
    // than assumed, so a figure keeps the rate it was written at when that
    // stops being true.
    currency: invoiceMoney.currency,
    usd_rate: invoiceMoney.usdRate,
    rate_source: invoiceMoney.rateSource,
    rate_fetched_at: invoiceMoney.rateFetchedAt,
    total_amount_usd: invoiceMoney.amountUsd,
    status: 'draft',
    due_date: dueDate,
    created_at: now
  });

  if (invoiceError) {
    // The unique index on (contract_id, period) is what makes a second run
    // in the same month a no-op rather than a double charge.
    if (/duplicate key|unique constraint/i.test(invoiceError.message)) {
      return { error: `already invoiced for ${draft.period || 'this engagement'}` };
    }
    return { error: invoiceError.message };
  }

  const { error: lineError } = await supabase.from('invoice_line_items').insert(
    draft.lines.map(line => ({
      id: newId('ili'),
      invoice_id: invoiceId,
      description: line.description,
      quantity: line.quantity,
      unit_amount: line.unitAmount,
      amount: line.amount,
      created_at: now
    }))
  );
  if (lineError) return { error: `invoice written but its lines failed: ${lineError.message}` };

  // The candidate's side of the same period. A placement has none: the
  // client employs them directly.
  if (draft.talentPayout !== null) {
    await supabase.from('talent_payouts').insert({
      id: newId('payout'),
      talent_id: draft.talentId,
      contract_id: draft.contractId,
      invoice_id: invoiceId,
      period: draft.period,
      // Gross, rate and net are all stored, so a candidate querying their
      // payout can be shown how it was worked out rather than a bare total.
      gross_amount: draft.talentGross,
      commission_pct: draft.talentCommissionPct,
      net_amount: draft.talentPayout,
      amount: draft.talentPayout,
      currency: invoiceMoney.currency,
      usd_rate: invoiceMoney.usdRate,
      rate_source: invoiceMoney.rateSource,
      rate_fetched_at: invoiceMoney.rateFetchedAt,
      net_amount_usd: recordMoney(
        draft.talentPayout, draft.currency || 'USD', rateFor(draft.currency || 'USD')
      ).amountUsd,
      status: 'pending',
      created_at: now
    });
  }

  // Move the billing cursor so the next run does not bill this period again.
  await supabase
    .from('contracts')
    .update({
      billed_through: draft.period || now.slice(0, 7),
      billing_model: draft.billingModel
    })
    .eq('id', draft.contractId);

  return { id: invoiceId };
}

/**
 * The run. Reads active contracts, writes draft invoices, moves the cursor.
 *
 * Drafts, not sent invoices. Somebody reviews them before a client sees one.
 */
export async function generateInvoiceDrafts(
  actor: Actor,
  asOf: Date = new Date()
): Promise<FinanceResult> {
  if (!actor) return fail(401, 'Not authenticated.');
  if (actor.kind !== 'admin') return fail(403, 'Only operations can run billing.');
  if (actor.role !== 'super_admin' && actor.role !== 'finance') {
    return fail(403, 'Only a super admin or finance can generate invoices.');
  }

  const preview = await previewInvoices(actor, asOf);
  if (!preview.ok) return preview;

  const plan = preview.data as BillingPlan & { summary: string };
  const now = new Date().toISOString();

  const created: any[] = [];
  const failed: { contractId: string; reason: string }[] = [];

  for (const draft of plan.drafts) {
    const result = await writeDraft(draft, now);
    if ('error' in result) {
      failed.push({ contractId: draft.contractId, reason: result.error });
    } else {
      created.push({
        id: result.id,
        contractId: draft.contractId,
        clientId: draft.clientId,
        period: draft.period,
        serviceLine: draft.serviceLine,
        total: draft.total
      });
    }
  }

  await recordAudit(actor, {
    action: 'Generate Draft Invoices',
    details: `${created.length} created, ${plan.skipped.length} skipped, ${failed.length} failed. `
           + `Total $${money(created.reduce((sum, c) => sum + c.total, 0))}.`,
    entityType: 'invoice',
    entityId: 'batch'
  });

  return {
    ok: true,
    status: 200,
    data: {
      created,
      skipped: plan.skipped,
      failed,
      summary: describePlan(plan)
    }
  };
}

// ─── Reading ─────────────────────────────────────────────────────────────────

/** Invoices this actor may see, with their lines. */
export async function listInvoices(actor: Actor): Promise<FinanceResult> {
  if (!actor) return fail(401, 'Not authenticated.');

  const supabase = getSupabaseClient();
  let query = supabase.from('invoices').select('*').order('created_at', { ascending: false });

  if (actor.kind === 'client') query = query.eq('client_id', actor.userId);
  else if (actor.kind === 'talent') return fail(403, 'Invoices are between Kongila and the client.');

  const { data, error } = await query;
  if (error) return fail(500, error.message);

  const ids = (data || []).map((i: any) => i.id);
  const { data: lines } = ids.length
    ? await supabase.from('invoice_line_items').select('*').in('invoice_id', ids)
    : { data: [] as any[] };

  return {
    ok: true,
    status: 200,
    data: {
      invoices: (data || []).map((i: any) => ({
        id: i.id,
        invoiceNumber: i.invoice_number,
        clientId: i.client_id,
        contractId: i.contract_id,
        period: i.period,
        serviceLine: i.service_line,
        // One figure, three names, because the admin screen reads `amount`
        // and the client screen reads `totalUsd` and they were summing
        // different columns. They now resolve to the same number.
        amount: Number(i.total_usd ?? i.amount ?? 0),
        subtotalUsd: Number(i.subtotal_usd ?? i.amount ?? 0),
        taxAmountUsd: Number(i.tax_amount_usd || 0),
        totalUsd: Number(i.total_usd ?? i.amount ?? 0),
        currency: i.currency || 'USD',
        usdRate: Number(i.usd_rate || 1),
        rateSource: i.rate_source || null,
        totalAmountUsd: Number(i.total_amount_usd ?? i.total_usd ?? i.amount ?? 0),
        status: i.status,
        dueDate: i.due_date,
        isDisputed: i.is_disputed || false,
        disputeReason: i.dispute_reason,
        createdAt: i.created_at
      })),
      lineItems: (lines || []).map((l: any) => ({
        id: l.id,
        invoiceId: l.invoice_id,
        description: l.description,
        quantity: Number(l.quantity || 1),
        unitAmount: Number(l.unit_amount || 0),
        amount: Number(l.amount || 0),
        // The client portal renders `amountUsd`, which nothing returned, so
        // every line item showed blank next to a correct invoice total.
        amountUsd: Number(l.amount || 0)
      }))
    }
  };
}

/** A candidate's own payouts, or all of them for operations. */
export async function listPayouts(actor: Actor): Promise<FinanceResult> {
  if (!actor) return fail(401, 'Not authenticated.');
  if (actor.kind === 'client') return fail(403, 'Payouts are between Kongila and the candidate.');

  const supabase = getSupabaseClient();
  let query = supabase.from('talent_payouts').select('*').order('created_at', { ascending: false });

  if (actor.kind === 'talent') {
    query = query.eq('talent_id', actor.talentProfileId || actor.userId);
  }

  const { data, error } = await query;
  if (error) return fail(500, error.message);

  return {
    ok: true,
    status: 200,
    data: (data || []).map((p: any) => ({
      id: p.id,
      talentId: p.talent_id,
      contractId: p.contract_id,
      invoiceId: p.invoice_id,
      period: p.period,
      // Three separate figures. Before the commission columns existed,
      // gross and net both fell back to `amount` and showed the same
      // number, which made the deduction invisible.
      grossAmount: p.gross_amount == null ? null : Number(p.gross_amount),
      commissionPct: p.commission_pct == null ? null : Number(p.commission_pct),
      commissionAmount: p.gross_amount == null || p.net_amount == null
        ? null
        : Math.round((Number(p.gross_amount) - Number(p.net_amount)) * 100) / 100,
      netAmount: Number(p.net_amount ?? p.amount ?? 0),
      amount: Number(p.amount ?? p.net_amount ?? 0),
      currency: p.currency || 'USD',
      usdRate: Number(p.usd_rate || 1),
      rateSource: p.rate_source || null,
      status: p.status,
      paymentMethod: p.payment_method,
      failureReason: p.failure_reason,
      paidAt: p.paid_at,
      createdAt: p.created_at
    }))
  };
}

export type { ServiceLine };

// ─── Payouts: approving and settling ─────────────────────────────────────────

/**
 * Approves payouts, server side.
 *
 * The admin screen used to do this in the browser. It checked compliance by
 * reading a `signedByTalentIds` array that no column ever wrote, then
 * approved everything and corrupted one at random:
 *
 *   if (!failureTriggered && Math.random() > 0.8) {
 *     return { ...p, status: 'failed',
 *              failureReason: 'Invalid bank details routing number' };
 *   }
 *
 * A test stub, shipped. One payout in five was marked failed with a reason
 * nobody had reported, and the alert said "Check queue for simulated
 * failures" to an operator who had no way to tell a simulated failure from
 * a real one.
 *
 * Nothing here invents a failure. A payout fails when someone records that
 * the bank rejected it, with the reason the bank gave.
 */
export async function approvePayouts(
  actor: Actor,
  input: { payoutIds: string[] }
): Promise<FinanceResult> {
  if (!actor) return fail(401, 'Not authenticated.');
  if (actor.kind !== 'admin') return fail(403, 'Only operations can approve a payout.');
  if (actor.role !== 'super_admin' && actor.role !== 'finance') {
    return fail(403, 'Only a super admin or finance can approve a payout.');
  }

  const ids = (input.payoutIds || []).filter(Boolean);
  if (ids.length === 0) return fail(400, 'No payouts were selected.');

  const supabase = getSupabaseClient();
  const { data: payouts, error } = await supabase
    .from('talent_payouts')
    .select('*')
    .in('id', ids);

  if (error) return fail(500, error.message);

  const approved: string[] = [];
  const blocked: { id: string; talentId: string; reason: string }[] = [];

  for (const payout of payouts || []) {
    if (payout.status !== 'pending') {
      blocked.push({
        id: payout.id, talentId: payout.talent_id,
        reason: `Already ${payout.status}.`
      });
      continue;
    }

    // The real gate, reading the signature table rather than an array that
    // only ever existed in browser memory.
    const hold = await complianceGate('issue_contract', String(payout.talent_id));
    if (hold) {
      blocked.push({ id: payout.id, talentId: payout.talent_id, reason: hold });
      continue;
    }

    // Kongila does not pay out against an invoice the client has not paid.
    if (payout.invoice_id) {
      const { data: invoice } = await supabase
        .from('invoices')
        .select('status, invoice_number')
        .eq('id', payout.invoice_id)
        .maybeSingle();

      if (!invoice || String(invoice.status).toLowerCase() !== 'paid') {
        blocked.push({
          id: payout.id,
          talentId: payout.talent_id,
          reason: `Invoice ${invoice?.invoice_number || payout.invoice_id} is not paid yet.`
        });
        continue;
      }
    }

    approved.push(payout.id);
  }

  if (approved.length > 0) {
    const { error: updateError } = await supabase
      .from('talent_payouts')
      .update({ status: 'approved' })
      .in('id', approved);

    if (updateError) return fail(500, `The payouts were not approved: ${updateError.message}`);

    await recordAudit(actor, {
      action: 'Approve Payouts',
      details: `${approved.length} approved, ${blocked.length} blocked.`,
      entityType: 'talent_payout',
      entityId: approved.join(',').slice(0, 200)
    });
  }

  return { ok: true, status: 200, data: { approved, blocked } };
}

/**
 * Records what the bank did with an approved payout.
 *
 * A failure needs a reason, and the reason comes from whoever saw the
 * rejection. There is no path here that generates one.
 */
export async function settlePayout(
  actor: Actor,
  input: { payoutId: string; outcome: 'paid' | 'failed'; reason?: string; paymentMethod?: string }
): Promise<FinanceResult> {
  if (!actor) return fail(401, 'Not authenticated.');
  if (actor.kind !== 'admin') return fail(403, 'Only operations can settle a payout.');
  if (actor.role !== 'super_admin' && actor.role !== 'finance') {
    return fail(403, 'Only a super admin or finance can settle a payout.');
  }
  if (input.outcome !== 'paid' && input.outcome !== 'failed') {
    return fail(400, 'The outcome is either paid or failed.');
  }
  if (input.outcome === 'failed' && !input.reason?.trim()) {
    return fail(400, 'A failed payout needs the reason the bank gave.');
  }

  const supabase = getSupabaseClient();
  const { data: payout } = await supabase
    .from('talent_payouts')
    .select('*')
    .eq('id', input.payoutId)
    .maybeSingle();

  if (!payout) return fail(404, 'That payout does not exist.');
  if (payout.status !== 'approved' && payout.status !== 'processing') {
    return fail(409, `A payout at "${payout.status}" cannot be settled. Approve it first.`);
  }

  const now = new Date().toISOString();
  const patch: any = input.outcome === 'paid'
    ? { status: 'paid', paid_at: now, payment_method: input.paymentMethod || payout.payment_method }
    : { status: 'failed', failure_reason: input.reason!.trim() };

  const { error } = await supabase
    .from('talent_payouts')
    .update(patch)
    .eq('id', input.payoutId);

  if (error) return fail(500, error.message);

  await recordAudit(actor, {
    action: input.outcome === 'paid' ? 'Settle Payout' : 'Record Payout Failure',
    details: input.outcome === 'paid'
      ? `Payout ${input.payoutId} paid.`
      : `Payout ${input.payoutId} failed: ${input.reason!.trim()}`,
    entityType: 'talent_payout',
    entityId: input.payoutId
  });

  return { ok: true, status: 200, data: { id: input.payoutId, status: patch.status } };
}

/**
 * Records how a client says they will settle an invoice.
 *
 * Deliberately does not mark anything paid. The client portal used to write
 * `status: 'paid'` straight to the table from the browser after taking no
 * payment at all, and told the client their card had been charged. Kongila
 * is launching without a payment provider, so the honest flow is: the
 * client says how they are paying, operations is told, and finance marks
 * the invoice paid when the money actually lands.
 *
 * That matters beyond the invoice. Payout approval is gated on the invoice
 * being paid, so a fabricated payment released a real payout.
 */
export async function recordPaymentIntent(
  actor: Actor,
  input: { invoiceId: string; method?: string; reference?: string }
): Promise<FinanceResult<{ message: string }>> {
  if (!actor) return fail(401, 'Not authenticated.');
  if (!input.invoiceId) return fail(400, 'invoiceId is required.');

  const supabase = getSupabaseClient();
  const { data: invoice } = await supabase
    .from('invoices')
    .select('*')
    .eq('id', input.invoiceId)
    .maybeSingle();

  if (!invoice) return fail(404, 'That invoice does not exist.');

  if (actor.kind === 'client' && String(invoice.client_id) !== String(actor.userId)) {
    return fail(403, 'That invoice is not yours.');
  }
  if (actor.kind === 'talent') return fail(403, 'Invoices are between Kongila and the client.');

  if (String(invoice.status).toLowerCase() === 'paid') {
    return { ok: true, status: 200, data: { message: 'This invoice is already settled.' } };
  }

  const method = String(input.method || 'bank_transfer').toLowerCase();

  // Nothing here charges a card, so saying a card was charged is not an
  // option. The invoice stays where it is either way.
  const message = method === 'card'
    ? 'Card payment is not available yet. Your account manager will send bank transfer '
      + 'details, and the invoice will be marked paid once the transfer clears.'
    : 'Thank you. Your invoice stays open until the transfer reaches us, and finance '
      + 'will mark it paid once it has cleared.';

  const { error } = await supabase
    .from('invoices')
    .update({
      status: String(invoice.status).toLowerCase() === 'draft' ? invoice.status : 'sent'
    })
    .eq('id', input.invoiceId);

  if (error) console.warn('[finance] could not touch invoice on intent:', error.message);

  const notified = await notifyAdmins('request_received', {
    roleTitle: `Payment expected: ${invoice.invoice_number || invoice.id}`,
    reason: `The client intends to settle by ${method.replace(/_/g, ' ')}.`
          + (input.reference ? ` Reference: ${input.reference}.` : '')
  }, { inAppOnly: true });

  await recordAudit(actor, {
    action: 'Record Payment Intent',
    details: `Invoice ${invoice.invoice_number || invoice.id}: client intends to pay by ${method}. `
           + 'Not marked paid.',
    entityType: 'invoice',
    entityId: input.invoiceId
  });

  return { ok: true, status: 200, data: { message }, warnings: notified.warnings };
}

/**
 * Finance marking an invoice settled, which is the only way it happens.
 */
export async function markInvoicePaid(
  actor: Actor,
  input: { invoiceId: string; reference?: string }
): Promise<FinanceResult> {
  if (!actor) return fail(401, 'Not authenticated.');
  if (actor.kind !== 'admin') return fail(403, 'Only operations can settle an invoice.');
  if (actor.role !== 'super_admin' && actor.role !== 'finance') {
    return fail(403, 'Only a super admin or finance can mark an invoice paid.');
  }

  const supabase = getSupabaseClient();
  const { data: invoice } = await supabase
    .from('invoices')
    .select('*')
    .eq('id', input.invoiceId)
    .maybeSingle();

  if (!invoice) return fail(404, 'That invoice does not exist.');
  if (String(invoice.status).toLowerCase() === 'paid') {
    return fail(409, 'That invoice is already paid.');
  }

  const { error } = await supabase
    .from('invoices')
    .update({ status: 'paid' })
    .eq('id', input.invoiceId);

  if (error) return fail(500, error.message);

  await recordAudit(actor, {
    action: 'Mark Invoice Paid',
    details: `${invoice.invoice_number || invoice.id} settled`
           + (input.reference ? `, reference ${input.reference}` : '') + '.',
    entityType: 'invoice',
    entityId: input.invoiceId
  });

  return { ok: true, status: 200, data: { id: input.invoiceId, status: 'paid' } };
}

/**
 * Voiding an invoice.
 *
 * The admin panel set this from the browser and posted the whole invoices
 * array back through /api/db, which upserts every row in it, so voiding one
 * invoice rewrote all of them from whatever the screen was holding. A paid
 * invoice cannot be voided; it is reversed with a credit note, which is a
 * conversation with finance, not a dropdown.
 */
export async function voidInvoice(
  actor: Actor,
  input: { invoiceId: string; reason?: string }
): Promise<FinanceResult> {
  if (!actor) return fail(401, 'Not authenticated.');
  if (actor.kind !== 'admin') return fail(403, 'Only operations can void an invoice.');
  if (actor.role !== 'super_admin' && actor.role !== 'finance') {
    return fail(403, 'Only a super admin or finance can void an invoice.');
  }

  const supabase = getSupabaseClient();
  const { data: invoice } = await supabase
    .from('invoices').select('*').eq('id', input.invoiceId).maybeSingle();

  if (!invoice) return fail(404, 'That invoice does not exist.');

  const status = String(invoice.status || '').toLowerCase();
  if (status === 'paid') {
    return fail(409, 'That invoice is paid. Raise a credit note rather than voiding it.');
  }
  if (status === 'void') return fail(409, 'That invoice is already void.');

  const { error } = await supabase
    .from('invoices').update({ status: 'void' }).eq('id', input.invoiceId);
  if (error) return fail(500, error.message);

  await recordAudit(actor, {
    action: 'Void Invoice',
    details: `${invoice.invoice_number || invoice.id} voided`
           + (input.reason ? `. Reason: ${input.reason}` : '.'),
    entityType: 'invoice',
    entityId: input.invoiceId
  });

  return { ok: true, status: 200, data: { id: input.invoiceId, status: 'void' } };
}

/**
 * A client disputing an invoice.
 *
 * The portal wrote the dispute straight to the table from the browser and
 * then inserted a notification addressed to `currentUser.id`, which is the
 * client who raised it. The message read "Our Finance Admin will review
 * this shortly" and no finance admin was ever told, so a disputed invoice
 * sat there while reminders carried on going out.
 */
export async function disputeInvoice(
  actor: Actor,
  input: { invoiceId: string; reason: string }
): Promise<FinanceResult> {
  if (!actor) return fail(401, 'Not authenticated.');
  if (!input.reason?.trim()) return fail(400, 'A dispute needs a reason.');

  const supabase = getSupabaseClient();
  const { data: invoice } = await supabase
    .from('invoices')
    .select('*')
    .eq('id', input.invoiceId)
    .maybeSingle();

  if (!invoice) return fail(404, 'That invoice does not exist.');
  if (actor.kind === 'client' && String(invoice.client_id) !== String(actor.userId)) {
    return fail(403, 'That invoice is not yours.');
  }
  if (actor.kind === 'talent') return fail(403, 'Invoices are between Kongila and the client.');
  if (String(invoice.status).toLowerCase() === 'paid') {
    return fail(409, 'That invoice is already paid. Raise a support ticket instead.');
  }

  const { error } = await supabase
    .from('invoices')
    .update({ is_disputed: true, dispute_reason: input.reason.trim() })
    .eq('id', input.invoiceId);

  if (error) return fail(500, `The dispute was not recorded: ${error.message}`);

  // Operations, this time, rather than the person who raised it.
  const notified = await notifyAdmins('request_received', {
    roleTitle: `Invoice disputed: ${invoice.invoice_number || invoice.id}`,
    reason: input.reason.trim()
  }, { inAppOnly: true });

  await recordAudit(actor, {
    action: 'Dispute Invoice',
    details: `${invoice.invoice_number || invoice.id}: ${input.reason.trim()}`,
    entityType: 'invoice',
    entityId: input.invoiceId
  });

  return {
    ok: true,
    status: 200,
    data: {
      id: input.invoiceId,
      message: 'Your dispute has been sent to our finance team, and payment reminders '
             + 'for this invoice are paused while they look at it.'
    },
    warnings: notified.warnings
  };
}
