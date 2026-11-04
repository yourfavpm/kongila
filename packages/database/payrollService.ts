/**
 * The payroll run, server side.
 *
 * It did not exist. `payroll_entries` was in the schema and nothing in the
 * codebase read or wrote it, and that table belongs to Remotan anyway. This
 * is built on Kongila's own contracts, into its own tables.
 *
 * The shape of a run:
 *
 *   generate   works out who is owed what for a period and writes a draft
 *   approve    locks the run; entries become approvable payouts
 *   markPaid   records that the money actually moved
 *   export     the CSV an operator hands to the bank
 *
 * Generating is repeatable. A run for a period that already exists is
 * recalculated in place rather than duplicated, so an operator who fixes a
 * missing rate and runs it again gets a corrected schedule instead of a
 * second one. Once approved it stops being recalculated, because by then
 * somebody has signed it off.
 */

import { getSupabaseClient } from './index';
import type { RequestActor as Actor } from './scope';
import { recordAudit } from './audit';
import { readFees } from './financeService';
import { complianceGate } from './signatureService';
import {
  buildPayrollRun,
  describeRun,
  payrollCsv,
  parsePeriod,
  type PayrollRun,
  type PayrollEntry
} from '@kongila/workflows';

export interface PayrollResult<T = any> {
  ok: boolean;
  status: number;
  error?: string;
  data?: T;
  warnings?: string[];
}

function fail(status: number, error: string): PayrollResult {
  return { ok: false, status, error };
}

function newId(prefix: string): string {
  return `${prefix}_${globalThis.crypto?.randomUUID?.().slice(0, 12)
    || `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`}`;
}

function canRunPayroll(actor: Actor): boolean {
  return actor.kind === 'admin'
    && (actor.role === 'super_admin' || actor.role === 'finance');
}

/** The period a run defaults to: the month that has just finished. */
export function previousPeriod(now: Date = new Date()): string {
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth(); // already zero-based, so this is last month
  return month === 0
    ? `${year - 1}-12`
    : `${year}-${String(month).padStart(2, '0')}`;
}

async function loadContracts() {
  const supabase = getSupabaseClient();

  const { data: contracts, error } = await supabase.from('contracts').select('*');
  if (error) throw new Error(error.message);

  const talentIds = [...new Set((contracts || []).map((c: any) => c.talent_id).filter(Boolean))];
  const clientIds = [...new Set((contracts || []).map((c: any) => c.client_id).filter(Boolean))];

  const [{ data: talents }, { data: profiles }] = await Promise.all([
    talentIds.length
      ? supabase.from('talent_profiles').select('id, full_name').in('id', talentIds)
      : Promise.resolve({ data: [] as any[] }),
    clientIds.length
      ? supabase.from('client_profiles').select('user_id, organization_id').in('user_id', clientIds)
      : Promise.resolve({ data: [] as any[] })
  ]);

  // The company name is on organizations, not client_profiles, which has
  // no company_name column at all.
  const orgIds = [...new Set((profiles || []).map((p: any) => p.organization_id).filter(Boolean))];
  const { data: orgs } = orgIds.length
    ? await supabase.from('organizations').select('id, name').in('id', orgIds)
    : { data: [] as any[] };

  const orgName = new Map((orgs || []).map((o: any) => [String(o.id), o.name]));
  const talentName = new Map((talents || []).map((t: any) => [String(t.id), t.full_name]));
  const clientName = new Map(
    (profiles || []).map((p: any) => [String(p.user_id), orgName.get(String(p.organization_id)) || ''])
  );

  return (contracts || []).map((c: any) => ({
    id: c.id,
    talentId: c.talent_id,
    talentName: talentName.get(String(c.talent_id)) || '',
    clientId: c.client_id,
    clientName: clientName.get(String(c.client_id)) || '',
    serviceType: c.service_type,
    status: c.status,
    rateAmount: Number(c.rate_amount || 0),
    currency: c.currency || 'USD',
    startDate: c.start_date,
    endDate: c.end_date
  }));
}

// ─── Generate ────────────────────────────────────────────────────────────────

/** What a run would pay, without writing anything. */
export async function previewPayroll(
  actor: Actor,
  period: string
): Promise<PayrollResult<PayrollRun & { summary: string }>> {
  if (!actor) return fail(401, 'Not authenticated.');
  if (actor.kind !== 'admin') return fail(403, 'Only operations can see payroll.');
  if (!parsePeriod(period)) return fail(400, `"${period}" is not a period. Use YYYY-MM.`);

  const { fees, error } = await readFees();
  if (error) return fail(500, `Could not read the fee configuration: ${error}`);

  try {
    const contracts = await loadContracts();
    const run = buildPayrollRun(contracts, period, fees);
    return { ok: true, status: 200, data: { ...run, summary: describeRun(run) } };
  } catch (err: any) {
    return fail(500, err?.message || 'Could not read contracts.');
  }
}

/**
 * Writes the schedule for a period as a draft.
 *
 * Each entry is checked against the compliance gate as it is written. A
 * candidate with unsigned documents still appears on the schedule, marked
 * on hold with the reason, rather than being left off it silently: an
 * operator needs to see that someone is not being paid and why.
 */
export async function generatePayroll(
  actor: Actor,
  period: string
): Promise<PayrollResult> {
  if (!actor) return fail(401, 'Not authenticated.');
  if (!canRunPayroll(actor)) {
    return fail(403, 'Only a super admin or finance can run payroll.');
  }

  const preview = await previewPayroll(actor, period);
  if (!preview.ok) return preview;

  const run = preview.data as PayrollRun & { summary: string };
  const supabase = getSupabaseClient();
  const now = new Date().toISOString();

  const { data: existing } = await supabase
    .from('kongila_payroll_runs')
    .select('id, status')
    .eq('period', period)
    .maybeSingle();

  if (existing && existing.status !== 'draft') {
    return fail(409,
      `The ${period} run is already ${existing.status} and cannot be regenerated. `
      + 'Cancel it first if it needs to change.');
  }

  const runId = existing?.id || newId('run');

  const { error: runError } = await supabase.from('kongila_payroll_runs').upsert({
    id: runId,
    period,
    status: 'draft',
    currency: run.currency,
    total_gross: run.totalGross,
    total_commission: run.totalCommission,
    total_net: run.totalNet,
    entry_count: run.entries.length,
    skipped: run.skipped,
    generated_by: actor.userId,
    generated_at: now
  }, { onConflict: 'period' });

  if (runError) return fail(500, `The run was not saved: ${runError.message}`);

  // Regenerating replaces the previous draft's entries rather than adding
  // to them, so a corrected rate does not leave the old figure behind.
  await supabase.from('kongila_payroll_entries').delete().eq('run_id', runId);

  const warnings: string[] = [];
  const rows: any[] = [];

  for (const entry of run.entries) {
    const hold = await complianceGate('issue_contract', String(entry.talentId));

    rows.push({
      id: newId('pe'),
      run_id: runId,
      contract_id: entry.contractId,
      talent_id: entry.talentId,
      talent_name: entry.talentName,
      client_name: entry.clientName,
      service_line: entry.serviceLine,
      period: entry.period,
      monthly_rate: entry.monthlyRate,
      days_worked: entry.daysWorked,
      days_in_period: entry.daysInPeriod,
      gross_amount: entry.grossAmount,
      commission_pct: entry.commissionPct,
      commission_amount: entry.commissionAmount,
      net_amount: entry.netAmount,
      currency: entry.currency,
      // Contracts are denominated in their own currency and everything
      // reports in USD. Until a contract is in something other than USD
      // this is 1, and it is stored rather than assumed.
      usd_rate: 1,
      rate_source: entry.currency === 'USD' ? 'same_currency' : null,
      rate_fetched_at: now,
      net_amount_usd: entry.currency === 'USD' ? entry.netAmount : null,
      status: hold ? 'on_hold' : 'pending',
      hold_reason: hold,
      created_at: now
    });
  }

  if (rows.length > 0) {
    const { error: entryError } = await supabase.from('kongila_payroll_entries').insert(rows);
    if (entryError) return fail(500, `The entries were not saved: ${entryError.message}`);
  }

  const held = rows.filter(r => r.status === 'on_hold').length;
  if (held > 0) {
    warnings.push(
      `${held} ${held === 1 ? 'person is' : 'people are'} on hold for outstanding compliance documents.`
    );
  }

  const nonUsd = rows.filter(r => r.currency !== 'USD').length;
  if (nonUsd > 0) {
    warnings.push(
      `${nonUsd} ${nonUsd === 1 ? 'entry is' : 'entries are'} not in USD. `
      + 'Confirm the exchange rate before paying.'
    );
  }

  await recordAudit(actor, {
    action: 'Generate Payroll Run',
    details: `${period}: ${rows.length} entries, ${run.currency} ${run.totalNet} net, `
           + `${run.skipped.length} skipped, ${held} on hold.`,
    entityType: 'payroll_run',
    entityId: runId
  });

  return {
    ok: true,
    status: 200,
    data: { runId, period, summary: run.summary, entryCount: rows.length, skipped: run.skipped },
    warnings
  };
}

// ─── Read ────────────────────────────────────────────────────────────────────

export async function getPayrollRun(actor: Actor, period: string): Promise<PayrollResult> {
  if (!actor) return fail(401, 'Not authenticated.');
  if (actor.kind !== 'admin') return fail(403, 'Only operations can see payroll.');

  const supabase = getSupabaseClient();
  const { data: run } = await supabase
    .from('kongila_payroll_runs')
    .select('*')
    .eq('period', period)
    .maybeSingle();

  if (!run) return { ok: true, status: 200, data: null };

  const { data: entries } = await supabase
    .from('kongila_payroll_entries')
    .select('*')
    .eq('run_id', run.id)
    .order('talent_name');

  return {
    ok: true,
    status: 200,
    data: {
      id: run.id,
      period: run.period,
      status: run.status,
      currency: run.currency,
      totalGross: Number(run.total_gross || 0),
      totalCommission: Number(run.total_commission || 0),
      totalNet: Number(run.total_net || 0),
      entryCount: run.entry_count,
      skipped: run.skipped || [],
      generatedAt: run.generated_at,
      approvedBy: run.approved_by,
      approvedAt: run.approved_at,
      paidAt: run.paid_at,
      entries: (entries || []).map(rowToEntry)
    }
  };
}

function rowToEntry(row: any) {
  return {
    id: row.id,
    contractId: row.contract_id,
    talentId: row.talent_id,
    talentName: row.talent_name,
    clientName: row.client_name,
    serviceLine: row.service_line,
    period: row.period,
    monthlyRate: Number(row.monthly_rate || 0),
    daysWorked: row.days_worked,
    daysInPeriod: row.days_in_period,
    grossAmount: Number(row.gross_amount || 0),
    commissionPct: Number(row.commission_pct || 0),
    commissionAmount: Number(row.commission_amount || 0),
    netAmount: Number(row.net_amount || 0),
    currency: row.currency,
    usdRate: Number(row.usd_rate || 1),
    rateSource: row.rate_source,
    netAmountUsd: row.net_amount_usd === null ? null : Number(row.net_amount_usd),
    status: row.status,
    holdReason: row.hold_reason,
    failureReason: row.failure_reason,
    paidAt: row.paid_at
  };
}

export async function listPayrollRuns(actor: Actor): Promise<PayrollResult> {
  if (!actor) return fail(401, 'Not authenticated.');
  if (actor.kind !== 'admin') return fail(403, 'Only operations can see payroll.');

  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('kongila_payroll_runs')
    .select('*')
    .order('period', { ascending: false })
    .limit(24);

  if (error) return fail(500, error.message);

  return {
    ok: true,
    status: 200,
    data: (data || []).map((r: any) => ({
      id: r.id,
      period: r.period,
      status: r.status,
      currency: r.currency,
      totalNet: Number(r.total_net || 0),
      entryCount: r.entry_count,
      skippedCount: (r.skipped || []).length,
      generatedAt: r.generated_at,
      approvedAt: r.approved_at,
      paidAt: r.paid_at
    }))
  };
}

// ─── Approve ─────────────────────────────────────────────────────────────────

/**
 * Signs off a run.
 *
 * Entries on hold are not approved and stay on hold. Approving around a
 * compliance hold has to be a deliberate act, not a side effect of
 * approving everybody at once.
 */
export async function approvePayroll(actor: Actor, period: string): Promise<PayrollResult> {
  if (!actor) return fail(401, 'Not authenticated.');
  if (!canRunPayroll(actor)) {
    return fail(403, 'Only a super admin or finance can approve payroll.');
  }

  const supabase = getSupabaseClient();
  const { data: run } = await supabase
    .from('kongila_payroll_runs')
    .select('*')
    .eq('period', period)
    .maybeSingle();

  if (!run) return fail(404, `There is no run for ${period}.`);
  if (run.status !== 'draft') {
    return fail(409, `The ${period} run is already ${run.status}.`);
  }

  const { data: entries } = await supabase
    .from('kongila_payroll_entries')
    .select('id, status, talent_name')
    .eq('run_id', run.id);

  const payable = (entries || []).filter((e: any) => e.status === 'pending');
  const held = (entries || []).filter((e: any) => e.status === 'on_hold');

  if (payable.length === 0) {
    return fail(409,
      held.length > 0
        ? `Every entry in the ${period} run is on hold for compliance. Nothing to approve.`
        : `The ${period} run has no entries to approve.`);
  }

  const now = new Date().toISOString();

  await supabase
    .from('kongila_payroll_entries')
    .update({ status: 'approved' })
    .eq('run_id', run.id)
    .eq('status', 'pending');

  const { error } = await supabase
    .from('kongila_payroll_runs')
    .update({ status: 'approved', approved_by: actor.userId, approved_at: now })
    .eq('id', run.id);

  if (error) return fail(500, `The run was not approved: ${error.message}`);

  await recordAudit(actor, {
    action: 'Approve Payroll Run',
    details: `${period}: ${payable.length} approved, ${held.length} left on hold. `
           + `${run.currency} ${run.total_net} net.`,
    entityType: 'payroll_run',
    entityId: run.id
  });

  const warnings = held.length > 0
    ? [`${held.length} ${held.length === 1 ? 'person was' : 'people were'} left on hold: `
       + held.map((e: any) => e.talent_name).join(', ')]
    : [];

  return {
    ok: true,
    status: 200,
    data: { period, approved: payable.length, onHold: held.length },
    warnings
  };
}

/**
 * Records that the money moved.
 *
 * A failure here is something the bank reported, passed in by the operator
 * who saw it. The previous payout screen generated its own failures with
 * `Math.random() > 0.8` and a made-up reason about routing numbers.
 */
export async function markPayrollPaid(
  actor: Actor,
  input: { period: string; failures?: { entryId: string; reason: string }[] }
): Promise<PayrollResult> {
  if (!actor) return fail(401, 'Not authenticated.');
  if (!canRunPayroll(actor)) {
    return fail(403, 'Only a super admin or finance can settle payroll.');
  }

  const supabase = getSupabaseClient();
  const { data: run } = await supabase
    .from('kongila_payroll_runs')
    .select('*')
    .eq('period', input.period)
    .maybeSingle();

  if (!run) return fail(404, `There is no run for ${input.period}.`);
  if (run.status !== 'approved') {
    return fail(409, `The ${input.period} run is ${run.status}. Approve it before settling it.`);
  }

  const now = new Date().toISOString();
  const failures = input.failures || [];

  for (const failure of failures) {
    if (!failure.reason?.trim()) {
      return fail(400, 'A failed payment needs the reason the bank gave.');
    }
    await supabase
      .from('kongila_payroll_entries')
      .update({ status: 'failed', failure_reason: failure.reason.trim() })
      .eq('id', failure.entryId)
      .eq('run_id', run.id);
  }

  const failedIds = failures.map(f => f.entryId);
  let paidQuery = supabase
    .from('kongila_payroll_entries')
    .update({ status: 'paid', paid_at: now })
    .eq('run_id', run.id)
    .eq('status', 'approved');

  if (failedIds.length > 0) paidQuery = paidQuery.not('id', 'in', `(${failedIds.join(',')})`);

  const { error } = await paidQuery;
  if (error) return fail(500, `The run was not settled: ${error.message}`);

  await supabase
    .from('kongila_payroll_runs')
    .update({ status: 'paid', paid_at: now })
    .eq('id', run.id);

  await recordAudit(actor, {
    action: 'Settle Payroll Run',
    details: `${input.period} marked paid. ${failures.length} reported failed by the bank.`,
    entityType: 'payroll_run',
    entityId: run.id
  });

  return { ok: true, status: 200, data: { period: input.period, failed: failures.length } };
}

// ─── Export ──────────────────────────────────────────────────────────────────

/** The CSV an operator hands to whoever moves the money. */
export async function exportPayroll(
  actor: Actor,
  period: string
): Promise<PayrollResult<{ filename: string; csv: string }>> {
  if (!actor) return fail(401, 'Not authenticated.');
  if (!canRunPayroll(actor)) {
    return fail(403, 'Only a super admin or finance can export payroll.');
  }

  const result = await getPayrollRun(actor, period);
  if (!result.ok) return result;
  if (!result.data) return fail(404, `There is no run for ${period}.`);

  // On-hold and failed entries are left out of the bank file. A file that
  // includes somebody who must not be paid is how they get paid.
  const payable = result.data.entries.filter(
    (e: any) => e.status === 'approved' || e.status === 'paid'
  );

  const run: PayrollRun = {
    period,
    entries: payable as PayrollEntry[],
    skipped: [],
    totalGross: payable.reduce((s: number, e: any) => s + e.grossAmount, 0),
    totalCommission: payable.reduce((s: number, e: any) => s + e.commissionAmount, 0),
    totalNet: payable.reduce((s: number, e: any) => s + e.netAmount, 0),
    currency: result.data.currency
  };

  await recordAudit(actor, {
    action: 'Export Payroll',
    details: `${period}: ${payable.length} entries exported.`,
    entityType: 'payroll_run',
    entityId: result.data.id
  });

  return {
    ok: true,
    status: 200,
    data: { filename: `kongila-payroll-${period}.csv`, csv: payrollCsv(run) }
  };
}
