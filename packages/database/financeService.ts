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
import { notifyAdmins, notifyUsers, notifyFinance, talentPortalUrl, clientPortalUrl, adminPortalUrl } from './notify';
import { complianceGate } from './signatureService';
import { canManageContractInvoice } from './invoiceAccess';
import {
  planInvoices,
  draftsForContract,
  upcomingInvoices,
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

  // Invoices follow active engagements, not signed contracts. Placement is
  // invoiced at the explicit client-release event, and project work is
  // invoiced from completed milestones.
  const { data: assignments, error: assignmentError } = await supabase
    .from('assignments').select('*').eq('status', 'active')
    .in('service_line', ['outsourcing', 'managed_workforce']);
  if (assignmentError) throw new Error(assignmentError.message);
  const contractIds = [...new Set((assignments || []).map((a: any) => a.contract_id).filter(Boolean))];
  if (!contractIds.length) return [];
  const { data: contracts, error } = await supabase.from('contracts').select('*').in('id', contractIds);
  if (error) throw new Error(error.message);

  const talentIds = [...new Set((contracts || []).map((c: any) => c.talent_id).filter(Boolean))];
  const { data: talents } = talentIds.length
    ? await supabase.from('talent_profiles').select('id, full_name').in('id', talentIds)
    : { data: [] as any[] };

  const nameOf = new Map((talents || []).map((t: any) => [String(t.id), t.full_name]));

  const assignmentByContract = new Map((assignments || []).map((a: any) => [String(a.contract_id), a]));
  return (contracts || []).map((c: any) => {
    const assignment: any = assignmentByContract.get(String(c.id));
    return ({
    id: c.id,
    clientId: c.client_id,
    talentId: c.talent_id,
    talentName: nameOf.get(String(c.talent_id)) || '',
    serviceType: assignment?.service_line || c.service_type,
    status: c.status,
    rateAmount: Number(c.rate_amount || 0),
    annualSalaryUsd: c.annual_salary_usd == null ? null : Number(c.annual_salary_usd),
    placementFeePct: c.placement_fee_pct == null ? null : Number(c.placement_fee_pct),
    paymentSchedule: c.payment_schedule || null,
    billingDayOfMonth: c.payment_schedule?.billingDayOfMonth || null,
    placementFeeUsd: c.placement_fee_usd == null ? null : Number(c.placement_fee_usd),
    projectFeeUsd: c.project_fee_usd == null ? null : Number(c.project_fee_usd),
    startDate: c.start_date,
    endDate: c.end_date,
    currency: c.currency || 'USD',
    billedThrough: c.billed_through
    ,engagementStatus: assignment?.status,
    managementPremiumPct: assignment?.management_premium_pct == null ? null : Number(assignment.management_premium_pct),
    clientFeePctSnapshot: c.client_fee_pct_snapshot == null ? null : Number(c.client_fee_pct_snapshot),
    talentCommissionPctSnapshot: c.talent_commission_pct_snapshot == null ? null : Number(c.talent_commission_pct_snapshot)
  });
  });
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

  // The due date is the first instalment's, not a flat fourteen days.
  //
  // A client paying half on the 1st and half on the 15th has one invoice
  // with two due dates, and an invoice stamped "due in 14 days" tells them
  // neither of them. The parts are written to invoice_instalments and the
  // headline due date is the first one, so a reminder chases the part that
  // is actually late rather than the whole amount.
  const instalments = Array.isArray(draft.instalments) && draft.instalments.length > 0
    ? draft.instalments
    : [{
        label: 'Full amount',
        percent: 100,
        dueDate: new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10),
        amount: draft.total
      }];

  const dueDate = new Date(`${instalments[0].dueDate}T00:00:00Z`).toISOString();
  const laterInstalment = instalments.length > 1 ? instalments[1] : null;

  // What the client reads on the invoice, before any line item. The service
  // line alone is a slug; this is a sentence.
  const describeService = () => {
    const line = String(draft.serviceLine || '').replace(/_/g, ' ');
    if (draft.period) return `${line} services for ${draft.period}`;
    if (draft.milestoneId) return `${line} milestone`;
    return `${line} fee`;
  };

  const { error: invoiceError } = await supabase.from('invoices').insert({
    id: invoiceId,
    invoice_number: `KNG-INV-${now.slice(0, 10).replace(/-/g, '')}-${invoiceId.slice(0, 6).toUpperCase()}`,
    client_id: draft.clientId,
    contract_id: draft.contractId,
    period: draft.period,
    service_line: draft.serviceLine,
    platform_margin_usd: draft.platformMargin,
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
    description: describeService(),
    milestone_id: draft.milestoneId || null,
    // What falls due on the headline date, as against the whole invoice.
    amount_due_now: instalments[0].amount,
    next_due_date: laterInstalment ? laterInstalment.dueDate : null,
    next_due_amount: laterInstalment ? laterInstalment.amount : null,
    // Read by the alert that tells finance another one is coming.
    is_recurring: draft.recurring ?? Boolean(draft.period),
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

  // The instalments, as rows rather than as a blob, so a part can be marked
  // paid on its own and an overdue report can name which half is late.
  const { error: instalmentError } = await supabase.from('invoice_instalments').insert(
    instalments.map((part, index) => ({
      id: newId('ins'),
      invoice_id: invoiceId,
      sequence: index + 1,
      label: part.label,
      percent: part.percent,
      amount: part.amount,
      due_date: part.dueDate,
      status: 'due',
      created_at: now
    }))
  );

  // Not fatal. The invoice is correct and payable either way, and an
  // environment that has not had the migration run should still be able to
  // bill rather than failing the whole run over a missing table.
  if (instalmentError && !/does not exist/i.test(instalmentError.message || '')) {
    console.warn(`[finance] instalments for ${invoiceId} were not written: ${instalmentError.message}`);
  }

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

  // Finance has to know a batch is sitting in draft. The admin FRD lists
  // this and nothing sent it, so a monthly run produced drafts that waited
  // until somebody happened to open the invoices screen.
  const warnings: string[] = [];
  if (created.length > 0) {
    const told = await notifyFinance('invoice_issued', {
      reference: `${created.length} draft invoice${created.length === 1 ? '' : 's'}`,
      amount: `$${money(created.reduce((sum, c) => sum + c.total, 0))}`,
      reason: 'They are in draft and need review before they go out.'
    }, { excludeUserIds: [actor.userId] });
    warnings.push(...told.warnings);
  }

  return {
    ok: true,
    status: 200,
    data: {
      created,
      skipped: plan.skipped,
      failed,
      summary: describePlan(plan)
    },
    warnings
  };
}

/** Edit the commercial lines on a draft before finance issues it. */
export async function updateDraftInvoice(actor: Actor, input: {
  invoiceId: string;
  lines: Array<{ description: string; quantity: number; unitAmount: number }>;
}): Promise<FinanceResult> {
  if (!actor) return fail(401, 'Not authenticated.');
  if (actor.kind !== 'admin') return fail(403, 'Only operators can edit a draft invoice.');
  if (!input.invoiceId || !Array.isArray(input.lines) || input.lines.length === 0) {
    return fail(422, 'Add at least one invoice line.');
  }
  const lines = input.lines.map(line => ({
    description: String(line.description || '').trim(),
    quantity: Number(line.quantity),
    unit_amount: Number(line.unitAmount)
  }));
  if (lines.some(line => !line.description || line.description.length > 500
    || !Number.isFinite(line.quantity) || line.quantity <= 0
    || !Number.isFinite(line.unit_amount) || line.unit_amount < 0)) {
    return fail(422, 'Each invoice line needs a description, positive quantity, and non-negative amount.');
  }
  const supabase = getSupabaseClient();
  const { data: invoice } = await supabase.from('invoices').select('contract_id').eq('id', input.invoiceId).maybeSingle();
  if (!invoice) return fail(404, 'That invoice does not exist.');
  const { data: contract } = invoice.contract_id
    ? await supabase.from('contracts').select('client_id').eq('id', invoice.contract_id).maybeSingle()
    : { data: null };
  if (!contract || !(await canManageContractInvoice(actor, contract))) {
    return fail(403, 'You can edit invoices only for client accounts assigned to you.');
  }
  const { data, error } = await supabase.rpc('update_draft_invoice', {
    p_invoice_id: input.invoiceId,
    p_lines: lines
  });
  if (error) return fail(/not found|draft/i.test(error.message) ? 409 : 500, error.message);
  await recordAudit(actor, {
    action: 'Edit Draft Invoice',
    details: `Updated ${lines.length} invoice line(s) on draft ${input.invoiceId}.`,
    entityType: 'invoice', entityId: input.invoiceId
  });
  return { ok: true, status: 200, data };
}

/**
 * Writes one draft as an invoice, outside a billing run.
 *
 * A delivered milestone and a signed placement each raise a single invoice
 * at the moment they happen, rather than waiting for the monthly run. They
 * go through the same writer so the instalments, the description and the
 * payout are built identically, because two paths producing nearly the same
 * invoice is how they drift apart.
 */
export async function writeMilestoneInvoice(
  actor: Actor,
  draft: InvoiceDraft
): Promise<FinanceResult<{ id: string }>> {
  if (!actor) return fail(401, 'Not authenticated.');
  if (actor.kind !== 'admin') return fail(403, 'Only operations raise an invoice.');

  const result = await writeDraft(draft, new Date().toISOString());
  if ('error' in result) return fail(500, result.error);

  await recordAudit(actor, {
    action: 'Raise Invoice',
    details: `${draft.serviceLine} invoice for ${money(draft.total)} on contract ${draft.contractId}.`,
    entityType: 'invoice',
    entityId: result.id
  });

  return { ok: true, status: 201, data: { id: result.id } };
}

/**
 * The placement fee invoice, prepared separately from the contract.
 *
 * The placement fee invoice is prepared separately from contract delivery.
 */
export async function raisePlacementInvoice(
  actor: Actor,
  contractId: string
): Promise<FinanceResult> {
  if (!actor) return fail(401, 'Not authenticated.');
  if (actor.kind !== 'admin') return fail(403, 'Only operators raise an invoice.');

  const supabase = getSupabaseClient();
  const { data: contract } = await supabase
    .from('contracts').select('*').eq('id', contractId).maybeSingle();

  if (!contract) return fail(404, 'That contract does not exist.');
  if (!(await canManageContractInvoice(actor, contract))) {
    return fail(403, 'You can prepare invoices only for client accounts assigned to you.');
  }

  const line = serviceLineOf(contract.service_type);
  if (line !== 'placement') {
    return fail(409, 'Only a Hire Talent contract is invoiced up front. '
      + 'Outsourcing and managed teams bill monthly, and a project bills on its milestones.');
  }

  // Raised once. A second call returns the invoice that already exists
  // rather than billing the client twice for one placement.
  const { data: existing } = await supabase
    .from('invoices')
    .select('id, invoice_number, status')
    .eq('contract_id', contractId)
    .limit(1);

  if (existing && existing.length > 0) {
    // Keep the contract queue in sync when a draft was raised before this
    // flag was introduced, and when contract generation retries the action.
    const { error: stampError } = await supabase.from('contracts')
      .update({ placement_fee_invoiced_at: contract.placement_fee_invoiced_at || new Date().toISOString() })
      .eq('id', contractId);
    return {
      ok: true,
      status: 200,
      data: { id: existing[0].id, invoiceNumber: existing[0].invoice_number, alreadyExisted: true },
      warnings: [
        'This placement was already invoiced, so nothing new was raised.',
        ...(stampError ? [`The invoice exists, but the contract could not be marked as invoiced: ${stampError.message}`] : [])
      ]
    };
  }

  const { fees } = await readFees();
  const plan = draftsForContract({
    id: String(contract.id),
    clientId: String(contract.client_id),
    talentId: String(contract.talent_id),
    talentName: contract.talent_name || undefined,
    serviceType: contract.service_type,
    // Up front means before the start date, so the status gate that stops a
    // monthly run billing an unsigned contract does not apply here.
    status: 'active',
    rateAmount: contract.rate_amount,
    annualSalaryUsd: contract.annual_salary_usd,
    placementFeePct: contract.placement_fee_pct,
    placementFeeUsd: contract.placement_fee_usd,
    currency: contract.currency,
    paymentTermsDays: contract.payment_terms_days,
    paymentSchedule: contract.payment_schedule,
    clientFeePctSnapshot: contract.client_fee_pct_snapshot,
    talentCommissionPctSnapshot: contract.talent_commission_pct_snapshot
  }, fees, new Date());

  if (plan.drafts.length === 0) {
    const reason = plan.skipped[0]?.reason
      || 'The placement fee could not be worked out from this contract.';
    return fail(422, reason);
  }

  const result = await writeDraft(plan.drafts[0], new Date().toISOString());
  if ('error' in result) return fail(500, result.error);

  const { error: stampError } = await supabase.from('contracts')
    .update({ placement_fee_invoiced_at: new Date().toISOString() })
    .eq('id', contractId);

  await recordAudit(actor, {
    action: 'Raise Placement Invoice',
    details: `Placement invoice draft for ${money(plan.drafts[0].total)} on contract ${contractId}.`,
    entityType: 'invoice',
    entityId: result.id
  });

  return {
    ok: true,
    status: 201,
    data: { id: result.id, total: plan.drafts[0].total },
    warnings: stampError
      ? [`The invoice was drafted, but the contract could not be marked as invoiced: ${stampError.message}`]
      : []
  };
}

/** Prepare the next client invoice from an active contract, without sending it. */
export async function raiseContractInvoice(actor: Actor, contractId: string): Promise<FinanceResult> {
  if (!actor || actor.kind !== 'admin') return fail(403, 'Only operators can prepare a contract invoice.');
  const supabase = getSupabaseClient();
  const { data: contract } = await supabase.from('contracts').select('*').eq('id', contractId).maybeSingle();
  if (!contract) return fail(404, 'That contract does not exist.');
  if (!(await canManageContractInvoice(actor, contract))) return fail(403, 'You can prepare invoices only for assigned client accounts.');

  const line = serviceLineOf(contract.service_type);
  if (line === 'placement') return raisePlacementInvoice(actor, contractId);
  if (line === 'project') return fail(409, 'Project invoices are prepared from accepted delivery milestones.');
  if (String(contract.status || '').toLowerCase() !== 'active') {
    return fail(409, 'A monthly invoice can be prepared after the contract is activated.');
  }

  const { fees } = await readFees();
  const plan = draftsForContract({
    id: String(contract.id), clientId: String(contract.client_id), talentId: String(contract.talent_id),
    talentName: contract.talent_name || undefined, serviceType: contract.service_type,
    status: contract.status, engagementStatus: 'active', rateAmount: contract.rate_amount,
    startDate: contract.start_date, endDate: contract.end_date, billedThrough: contract.billed_through,
    currency: contract.currency, managementPremiumPct: contract.management_premium_pct,
    clientFeePctSnapshot: contract.client_fee_pct_snapshot,
    talentCommissionPctSnapshot: contract.talent_commission_pct_snapshot,
    paymentTermsDays: contract.payment_terms_days, paymentSchedule: contract.payment_schedule,
    seats: contract.seats
  }, fees, new Date());
  if (!plan.drafts.length) return fail(409, plan.skipped[0]?.reason || 'There is no unbilled month ready for invoicing.');

  const draft = plan.drafts[0];
  const result = await writeDraft(draft, new Date().toISOString());
  if ('error' in result) return fail(/already invoiced/.test(result.error) ? 409 : 500, result.error);
  await recordAudit(actor, {
    action: 'Prepare Contract Invoice',
    details: `Prepared ${draft.period} ${line} invoice for ${money(draft.total)} from contract ${contractId}.`,
    entityType: 'invoice', entityId: result.id
  });
  return { ok: true, status: 201, data: { id: result.id, period: draft.period, total: draft.total } };
}

/**
 * Tells finance what is about to fall due.
 *
 * A recurring engagement stops being invoiced the moment nobody remembers to
 * run the month, and the first sign is a revenue figure that looks a bit
 * low. This answers "what should go out in the next few days" rather than
 * "what is overdue", because overdue is already too late.
 *
 * Run from the nightly pass. Safe to run twice: it sends nothing when
 * nothing is coming, and a single digest rather than one message per
 * contract, because thirty separate emails on the 28th of every month is how
 * people build a filter rule.
 */
export async function alertUpcomingInvoices(
  asOf: Date = new Date(),
  leadDays = 5
): Promise<{ upcoming: number; warnings: string[] }> {
  const warnings: string[] = [];

  try {
    const supabase = getSupabaseClient();
    const { data: contracts, error } = await supabase
      .from('contracts')
      .select('*')
      .in('status', ['active', 'signed', 'fully_signed']);

    if (error) return { upcoming: 0, warnings: [`Upcoming invoices could not be read: ${error.message}`] };

    const { fees } = await readFees();
    const billable = (contracts || []).map((contract: any) => ({
      id: String(contract.id),
      clientId: String(contract.client_id),
      talentId: String(contract.talent_id),
      clientName: contract.client_name || undefined,
      serviceType: contract.service_type,
      status: contract.status,
      rateAmount: contract.rate_amount ?? contract.monthly_rate_usd,
      startDate: contract.start_date,
      endDate: contract.end_date,
      currency: contract.currency,
      billedThrough: contract.billed_through,
      seats: contract.seats,
      paymentSchedule: contract.payment_schedule,
      paymentTermsDays: contract.payment_terms_days,
      managementPremiumPct: contract.management_premium_pct,
      clientFeePctSnapshot: contract.client_fee_pct_snapshot,
      talentCommissionPctSnapshot: contract.talent_commission_pct_snapshot
    }));

    const upcoming = upcomingInvoices(billable, fees, asOf, leadDays);
    if (upcoming.length === 0) return { upcoming: 0, warnings };

    const total = money(upcoming.reduce((sum, entry) => sum + entry.estimatedTotal, 0));
    const currency = upcoming[0].currency || 'USD';
    const earliest = upcoming[0].raiseOn;

    const told = await notifyFinance('invoices_due_soon', {
      itemCount: upcoming.length,
      amount: `${currency} ${total.toLocaleString('en-US')}`,
      dueDate: earliest,
      timeRemaining: `${leadDays} days`,
      actionUrl: adminPortalUrl('/?tab=finance')
    });
    warnings.push(...told.warnings);

    return { upcoming: upcoming.length, warnings };
  } catch (err: any) {
    return { upcoming: 0, warnings: [`Upcoming invoices could not be checked: ${err?.message}`] };
  }
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
        platformMarginUsd: i.platform_margin_usd == null ? null : Number(i.platform_margin_usd),
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

  // Tell the person whose money it is.
  //
  // Nothing here notified anybody. A payout was marked paid and the
  // contractor found out by checking their bank; a payout failed and they
  // found out by not being paid, with no one telling them their details
  // needed fixing. Both FRDs list these.
  const warnings: string[] = [];
  try {
    const amount = payout.amount != null
      ? `${payout.currency || 'USD'} ${Number(payout.amount).toLocaleString()}`
      : undefined;

    const { data: talent } = await supabase
      .from('talent_profiles').select('user_id').eq('id', payout.talent_id).maybeSingle();

    if (talent?.user_id) {
      const told = await notifyUsers(
        String(talent.user_id),
        input.outcome === 'paid' ? 'payout_sent' : 'payout_failed',
        {
          amount,
          reference: input.payoutId,
          reason: input.outcome === 'paid' ? undefined : input.reason!.trim(),
          actionUrl: talentPortalUrl('/?section=earnings')
        }
      );
      warnings.push(...told.warnings);
    }

    // A failure is finance's problem too — somebody has to chase the bank.
    if (input.outcome !== 'paid') {
      const toldFinance = await notifyFinance('payout_failed', {
        amount,
        reference: input.payoutId,
        reason: input.reason!.trim()
      }, { excludeUserIds: [actor.userId] });
      warnings.push(...toldFinance.warnings);
    }
  } catch (err: any) {
    warnings.push(`The payout was settled but not everyone could be told: ${err?.message || err}`);
  }

  return { ok: true, status: 200, data: { id: input.payoutId, status: patch.status }, warnings };
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

  // Every outstanding part of a split invoice is settled too, so a partly
  // paid invoice cannot be left looking overdue after the whole thing was
  // marked paid.
  await supabase
    .from('invoice_instalments')
    .update({ status: 'paid', paid_at: new Date().toISOString() })
    .eq('invoice_id', input.invoiceId)
    .neq('status', 'paid');

  await recordAudit(actor, {
    action: 'Mark Invoice Paid',
    details: `${invoice.invoice_number || invoice.id} settled`
           + (input.reference ? `, reference ${input.reference}` : '') + '.',
    entityType: 'invoice',
    entityId: input.invoiceId
  });

  // Acknowledge the payment. A client who has just paid an invoice gets no
  // confirmation from us at all, which is the one moment they are most
  // likely to want one.
  const warnings: string[] = [];
  if (invoice.client_id) {
    const told = await notifyUsers(String(invoice.client_id), 'invoice_paid', {
      reference: invoice.invoice_number || invoice.id,
      amount: invoice.amount != null
        ? `${invoice.currency || 'USD'} ${Number(invoice.amount).toLocaleString()}`
        : undefined,
      actionUrl: clientPortalUrl('/?section=billing')
    });
    warnings.push(...told.warnings);
  }

  // ── A placement starts when it is paid for ────────────────────────────────
  return {
    ok: true,
    status: 200,
    data: { id: input.invoiceId, status: 'paid' },
    warnings
  };
}

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
