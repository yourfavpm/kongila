/**
 * Project milestones, and the invoices they raise.
 *
 * A project fee invoiced once, at the end, is the arrangement nobody uses:
 * the client will not pay everything up front and Kongila will not carry
 * three months of payroll before seeing any of it. So a project is billed
 * against milestones, and a milestone becomes an invoice at the moment
 * somebody says it was delivered.
 *
 * The decisions about what a milestone is worth live in
 * `@kongila/workflows/billing`, which imports nothing and is tested on its
 * own. This is the part that talks to the database.
 */

import { getSupabaseClient } from './index';
import type { RequestActor as Actor } from './scope';
import { recordAudit } from './audit';
import { readFees } from './financeService';
import { notifyUsers, notifyFinance, clientPortalUrl } from './notify';
import {
  milestoneProblem,
  milestoneDrafts,
  milestoneAmount,
  money,
  type ProjectMilestone
} from '@kongila/workflows';

export interface MilestoneResult<T = any> {
  ok: boolean;
  status: number;
  error?: string;
  data?: T;
  warnings?: string[];
}

function fail(status: number, error: string): MilestoneResult {
  return { ok: false, status, error };
}

function newId(prefix: string): string {
  return `${prefix}_${globalThis.crypto?.randomUUID?.().slice(0, 12)
    || `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`}`;
}

function toMilestone(row: any): ProjectMilestone {
  return {
    id: String(row.id),
    name: row.name,
    dueDate: row.due_date || null,
    percent: row.percent == null ? null : Number(row.percent),
    amountUsd: row.amount_usd == null ? null : Number(row.amount_usd),
    status: row.status || 'pending',
    deliveredAt: row.delivered_at || null
  };
}

/** Every milestone on a contract, in the order they were planned. */
export async function listMilestones(
  actor: Actor,
  contractId: string
): Promise<MilestoneResult> {
  if (!actor) return fail(401, 'Not authenticated.');
  if (!contractId) return fail(400, 'Which contract?');

  const supabase = getSupabaseClient();

  const { data: contract } = await supabase
    .from('contracts')
    .select('id, client_id, talent_id, project_fee_usd, currency')
    .eq('id', contractId)
    .maybeSingle();

  if (!contract) return fail(404, 'That contract does not exist.');

  // A client sees their own project's milestones; a candidate sees the ones
  // they are delivering. Operations see them because the route already
  // checked a permission.
  if (actor.kind === 'client' && String(contract.client_id) !== String(actor.userId)) {
    return fail(403, 'Not authorised.');
  }
  if (actor.kind === 'talent'
      && String(contract.talent_id) !== String(actor.talentProfileId || actor.userId)) {
    return fail(403, 'Not authorised.');
  }

  const { data, error } = await supabase
    .from('project_milestones')
    .select('*')
    .eq('contract_id', contractId)
    .order('sequence')
    .order('due_date');

  if (error) {
    if (/does not exist/i.test(error.message || '')) {
      return { ok: true, status: 200, data: { milestones: [], projectFee: null }, warnings: [
        'Milestones are not set up on this database yet. Run the 2026-11-19 billing terms migration.'
      ] };
    }
    return fail(500, error.message);
  }

  const projectFee = Number(contract.project_fee_usd || 0);
  const milestones = (data || []).map((row: any) => ({
    ...toMilestone(row),
    // What it is worth, so a screen does not have to do the arithmetic and
    // get it different from the invoice.
    value: milestoneAmount(toMilestone(row), projectFee),
    invoiceId: row.invoice_id || null
  }));

  const planned = money(milestones.reduce((sum: number, entry: any) => sum + entry.value, 0));

  return {
    ok: true,
    status: 200,
    data: {
      milestones,
      projectFee,
      currency: contract.currency || 'USD',
      planned,
      // Said plainly, because milestones that do not add up to the fee are
      // the failure nobody notices until the year-end reconciliation.
      unallocated: money(projectFee - planned)
    }
  };
}

/**
 * Replaces a contract's milestone plan.
 *
 * All of them at once rather than one at a time, because the thing that has
 * to be true is a property of the set: they total the fee. Saving one at a
 * time means every intermediate save is invalid and the check has to be
 * skipped, which is how a plan ends up at 80%.
 */
export async function setMilestones(
  actor: Actor,
  input: { contractId: string; milestones: ProjectMilestone[] }
): Promise<MilestoneResult> {
  if (!actor) return fail(401, 'Not authenticated.');
  const held = Array.isArray(actor.permissions) ? actor.permissions : [];
  if (!held.includes('contracts.manage')) {
    return fail(403, 'Your role cannot change a project plan.');
  }
  if (!input.contractId) return fail(400, 'Which contract?');

  const problem = milestoneProblem(input.milestones);
  if (problem) return fail(422, problem);

  const supabase = getSupabaseClient();

  const { data: contract } = await supabase
    .from('contracts')
    .select('id, service_type, project_fee_usd')
    .eq('id', input.contractId)
    .maybeSingle();

  if (!contract) return fail(404, 'That contract does not exist.');

  // Anything already invoiced is left alone. Rewriting a milestone that has
  // been billed would make the invoice and the plan disagree, and the
  // invoice is the one the client has.
  const { data: existing } = await supabase
    .from('project_milestones')
    .select('id, status, invoice_id')
    .eq('contract_id', input.contractId);

  const locked = new Set(
    (existing || [])
      .filter((row: any) => ['invoiced', 'paid'].includes(String(row.status || '').toLowerCase()))
      .map((row: any) => String(row.id))
  );

  const incoming = new Set(input.milestones.map((entry: any) => String(entry.id)));
  const removedButBilled = [...locked].filter((id: any) => !incoming.has(String(id)));
  if (removedButBilled.length > 0) {
    return fail(409,
      `${removedButBilled.length} milestone${removedButBilled.length === 1 ? ' has' : 's have'} `
      + 'already been invoiced and cannot be removed. Void the invoice first if that is wrong.');
  }

  const now = new Date().toISOString();
  const rows = input.milestones.map((entry, index) => ({
    id: String(entry.id),
    contract_id: input.contractId,
    name: entry.name,
    due_date: entry.dueDate || null,
    percent: entry.percent ?? null,
    amount_usd: entry.amountUsd ?? null,
    sequence: index,
    // A locked milestone keeps the status it has; everything else keeps
    // whatever it was sent as, defaulting to pending.
    status: locked.has(String(entry.id))
      ? (existing || []).find((row: any) => String(row.id) === String(entry.id))?.status
      : (entry.status || 'pending'),
    updated_at: now
  }));

  const { error } = await supabase
    .from('project_milestones')
    .upsert(rows, { onConflict: 'id' });

  if (error) {
    if (/does not exist/i.test(error.message || '')) {
      return fail(503, 'This database has not had the 2026-11-19 billing terms migration run yet.');
    }
    return fail(500, error.message);
  }

  // Anything no longer in the plan and never billed goes.
  const stale = (existing || [])
    .map((row: any) => String(row.id))
    .filter((id: string) => !incoming.has(id) && !locked.has(id));

  if (stale.length > 0) {
    await supabase.from('project_milestones').delete().in('id', stale);
  }

  await recordAudit(actor, {
    action: 'Set Project Milestones',
    details: `${rows.length} milestone${rows.length === 1 ? '' : 's'} on contract ${input.contractId}.`,
    entityType: 'contract',
    entityId: input.contractId
  });

  return { ok: true, status: 200, data: { contractId: input.contractId, milestones: rows.length } };
}

/**
 * Marks a milestone delivered, and raises its invoice.
 *
 * The two go together on purpose. A milestone marked delivered that does not
 * produce an invoice is work Kongila has done and not billed for, and the
 * gap between the two steps is where that gets forgotten.
 */
export async function deliverMilestone(
  actor: Actor,
  input: { milestoneId: string; note?: string }
): Promise<MilestoneResult> {
  if (!actor) return fail(401, 'Not authenticated.');
  const held = Array.isArray(actor.permissions) ? actor.permissions : [];
  if (!held.includes('contracts.manage')) {
    return fail(403, 'Your role cannot sign off a milestone.');
  }

  const supabase = getSupabaseClient();

  const { data: milestone } = await supabase
    .from('project_milestones')
    .select('*')
    .eq('id', input.milestoneId)
    .maybeSingle();

  if (!milestone) return fail(404, 'That milestone does not exist.');

  const status = String(milestone.status || '').toLowerCase();
  if (status === 'invoiced' || status === 'paid') {
    return fail(409, 'That milestone has already been invoiced.');
  }
  if (status === 'cancelled') return fail(409, 'That milestone was cancelled.');

  const { data: contract } = await supabase
    .from('contracts')
    .select('*')
    .eq('id', milestone.contract_id)
    .maybeSingle();

  if (!contract) return fail(404, 'The contract behind that milestone is missing.');

  const now = new Date().toISOString();
  const { error: markError } = await supabase
    .from('project_milestones')
    .update({ status: 'delivered', delivered_at: now, delivered_by: actor.userId, updated_at: now })
    .eq('id', input.milestoneId);

  if (markError) return fail(500, markError.message);

  // ── The invoice ───────────────────────────────────────────────────────────
  const warnings: string[] = [];
  const { data: siblings } = await supabase
    .from('project_milestones')
    .select('*')
    .eq('contract_id', milestone.contract_id)
    .order('sequence');

  const { fees } = await readFees();
  const billable = {
    id: String(contract.id),
    clientId: String(contract.client_id),
    talentId: String(contract.talent_id),
    talentName: contract.talent_name || undefined,
    serviceType: contract.service_type,
    status: contract.status,
    projectFeeUsd: contract.project_fee_usd,
    currency: contract.currency,
    paymentTermsDays: contract.payment_terms_days,
    paymentSchedule: contract.payment_schedule,
    clientFeePctSnapshot: contract.client_fee_pct_snapshot,
    talentCommissionPctSnapshot: contract.talent_commission_pct_snapshot
  };

  // Only this milestone, however many others are sitting at delivered. Each
  // one raises its own invoice when it is signed off, so billing the rest
  // here would double-bill anything already invoiced.
  const justThisOne = (siblings || [])
    .map(toMilestone)
    .map((entry: any) => (String(entry.id) === String(input.milestoneId)
      ? { ...entry, status: 'delivered' }
      : { ...entry, status: entry.status === 'delivered' ? 'pending' : entry.status }));

  const plan = milestoneDrafts(billable, justThisOne, fees, new Date());

  if (plan.skipped.length > 0) {
    warnings.push(...plan.skipped.map((entry: any) => entry.reason));
  }

  if (plan.drafts.length === 0) {
    return {
      ok: true,
      status: 200,
      data: { id: input.milestoneId, status: 'delivered', invoiceId: null },
      warnings: warnings.length ? warnings : [
        'The milestone is marked delivered, but no invoice could be raised from it. '
        + 'Check the project fee and the margin for project work.'
      ]
    };
  }

  const { writeMilestoneInvoice } = await import('./financeService');
  const written = await writeMilestoneInvoice(actor, plan.drafts[0]);

  if (!written.ok) {
    warnings.push(`The milestone is delivered but its invoice was not raised: ${written.error}`);
    return { ok: true, status: 200, data: { id: input.milestoneId, status: 'delivered', invoiceId: null }, warnings };
  }

  const invoiceId = written.data?.id;
  await supabase
    .from('project_milestones')
    .update({ status: 'invoiced', invoice_id: invoiceId, updated_at: new Date().toISOString() })
    .eq('id', input.milestoneId);

  await recordAudit(actor, {
    action: 'Deliver Milestone',
    details: `${milestone.name} delivered and invoiced (${invoiceId}).`
      + (input.note ? ` Note: ${input.note}` : ''),
    entityType: 'contract',
    entityId: String(contract.id)
  });

  const told = await notifyUsers(String(contract.client_id), 'invoice_issued', {
    reference: milestone.name,
    amount: `${billable.currency || 'USD'} ${money(plan.drafts[0].total).toLocaleString('en-US')}`,
    reason: 'A project milestone has been delivered.',
    actionUrl: clientPortalUrl('/?section=billing')
  });
  warnings.push(...told.warnings);

  const financeTold = await notifyFinance('invoice_issued', {
    reference: `${milestone.name} (${contract.id})`,
    amount: `${billable.currency || 'USD'} ${money(plan.drafts[0].total).toLocaleString('en-US')}`,
    reason: 'Raised from a delivered project milestone.'
  }, { excludeUserIds: [actor.userId] });
  warnings.push(...financeTold.warnings);

  return {
    ok: true,
    status: 201,
    data: { id: input.milestoneId, status: 'invoiced', invoiceId, total: plan.drafts[0].total },
    warnings
  };
}
