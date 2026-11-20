/**
 * The commercial terms behind a contract.
 *
 * Margins used to live in one place, `fee_config`, with one row per service
 * line and no way to say that this client pays a different placement fee.
 * In practice every deal of any size moves the number, and the only way to
 * honour that was to edit the invoice after it was generated, which means
 * the contract and the invoice disagree and neither matches what was agreed.
 *
 * Three layers, each overriding the one before:
 *
 *   1. the service line default, in `fee_config`
 *   2. the client's own terms, in `client_billing_terms`
 *   3. what was locked onto the contract when it was generated
 *
 * Layer 3 is the one billing actually reads. The first two decide what gets
 * written there. That ordering is deliberate: a margin changed in June must
 * not silently reprice an engagement signed in January, and the only way to
 * guarantee that is to copy the numbers onto the contract at the moment it
 * is created and never look them up again.
 */

import { getSupabaseClient, isUndefinedColumn } from './index';
import type { RequestActor as Actor } from './scope';
import { recordAudit } from './audit';
import { readFees } from './financeService';
import {
  SERVICE_LINES,
  serviceLineOf,
  scheduleProblem,
  type ServiceLine,
  type PaymentSchedule
} from '@kongila/workflows';

export interface TermsResult<T = any> {
  ok: boolean;
  status: number;
  error?: string;
  data?: T;
  warnings?: string[];
}

function fail(status: number, error: string): TermsResult {
  return { ok: false, status, error };
}

/**
 * An id for a new row.
 *
 * Several of these tables have no default on their primary key, so an
 * insert that leaves the id out fails with "null value in column id
 * violates not-null constraint". The id is supplied here rather than
 * relying on a default that may or may not be there.
 */
function newId(prefix: string): string {
  return `${prefix}_${globalThis.crypto?.randomUUID?.().slice(0, 12)
    || `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`}`;
}

/**
 * What a client is charged and what the candidate keeps, for one service
 * line. Every field may be null, which means "not set at this layer".
 */
export interface BillingTerms {
  serviceLine: ServiceLine;
  clientFeePct: number | null;
  talentCommissionPct: number | null;
  placementFeePct: number | null;
  managementPremiumPct: number | null;
  paymentTermsDays: number | null;
  paymentSchedule: PaymentSchedule | null;
  /** Where each value came from, so the screen can show what is inherited. */
  source: Record<string, 'client' | 'service_line' | 'unset'>;
}

function toNumber(value: any): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toSchedule(value: any): PaymentSchedule | null {
  if (!value || typeof value !== 'object') return null;
  const splits = Array.isArray(value.splits) ? value.splits : [];
  if (splits.length === 0 && typeof value.serviceRecurring !== 'boolean' && value.billingDayOfMonth == null) return null;
  return {
    recurring: value.recurring !== false,
    serviceRecurring: typeof value.serviceRecurring === 'boolean' ? value.serviceRecurring : undefined,
    billingDayOfMonth: value.billingDayOfMonth != null && Number.isInteger(Number(value.billingDayOfMonth)) ? Number(value.billingDayOfMonth) : undefined,
    splits: splits.map((split: any) => ({
      label: split?.label ? String(split.label) : undefined,
      percent: Number(split?.percent),
      dayOfMonth: Number(split?.dayOfMonth)
    }))
  };
}

// ─── Reading ─────────────────────────────────────────────────────────────────

/**
 * Every client-specific override, keyed by organisation and service line.
 *
 * A missing table is not an error. The migration may not have run yet on a
 * given environment, and billing falling over because an override table is
 * absent would be a worse failure than billing at the standard margin.
 */
export async function readClientTerms(
  organizationId?: string | null
): Promise<{ terms: Record<string, any>; warnings: string[] }> {
  const supabase = getSupabaseClient();
  const warnings: string[] = [];

  let query = supabase
    .from('client_billing_terms')
    .select('organization_id, service_line, client_fee_pct, talent_commission_pct, '
      + 'placement_fee_pct, management_premium_pct, payment_terms_days, payment_schedule, notes, updated_at, updated_by');

  if (organizationId) query = query.eq('organization_id', organizationId);

  const { data, error } = await query;

  if (error) {
    if (isUndefinedColumn(error) || /does not exist/i.test(error.message || '')) {
      warnings.push('Client-specific billing terms are not set up on this database yet. '
        + 'Run the 2026-11-19 billing terms migration. Standard margins are being used.');
      return { terms: {}, warnings };
    }
    warnings.push(`Client billing terms could not be read: ${error.message}. Standard margins are being used.`);
    return { terms: {}, warnings };
  }

  const terms: Record<string, any> = {};
  for (const row of data || []) {
    terms[`${row.organization_id}|${row.service_line}`] = row;
  }
  return { terms, warnings };
}

/** The extra margin columns, which `readFees` does not return. */
async function readFeeExtras(): Promise<Record<string, any>> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('fee_config')
    .select('service_line, placement_fee_pct, management_premium_pct, payment_terms_days, payment_schedule');

  if (error) return {};

  const extras: Record<string, any> = {};
  for (const row of data || []) extras[String(row.service_line)] = row;
  return extras;
}

/**
 * The terms that apply to one client on one service line, with the client's
 * overrides laid over the service line's defaults.
 */
export async function effectiveTerms(
  organizationId: string | null | undefined,
  serviceType: string | null | undefined
): Promise<{ terms: BillingTerms | null; warnings: string[] }> {
  const line = serviceLineOf(serviceType);
  if (!line) return { terms: null, warnings: [`"${serviceType}" is not one of the four service lines.`] };

  const [{ fees }, extras, clientTerms] = await Promise.all([
    readFees(),
    readFeeExtras(),
    readClientTerms(organizationId || undefined)
  ]);

  const base = fees.find(fee => fee.serviceLine === line) || null;
  const extra = extras[line] || {};
  const override = organizationId ? clientTerms.terms[`${organizationId}|${line}`] : null;

  const source: BillingTerms['source'] = {};
  const pick = (field: string, clientValue: any, lineValue: any) => {
    if (clientValue !== null && clientValue !== undefined) {
      source[field] = 'client';
      return clientValue;
    }
    if (lineValue !== null && lineValue !== undefined) {
      source[field] = 'service_line';
      return lineValue;
    }
    source[field] = 'unset';
    return null;
  };

  const terms: BillingTerms = {
    serviceLine: line,
    clientFeePct: pick('clientFeePct', toNumber(override?.client_fee_pct), base?.clientFeePct ?? null),
    talentCommissionPct: pick('talentCommissionPct', toNumber(override?.talent_commission_pct), base?.talentCommissionPct ?? null),
    placementFeePct: pick('placementFeePct', toNumber(override?.placement_fee_pct), toNumber(extra.placement_fee_pct)),
    managementPremiumPct: pick('managementPremiumPct', toNumber(override?.management_premium_pct), toNumber(extra.management_premium_pct)),
    paymentTermsDays: pick('paymentTermsDays', toNumber(override?.payment_terms_days), toNumber(extra.payment_terms_days)),
    paymentSchedule: pick('paymentSchedule', toSchedule(override?.payment_schedule), toSchedule(extra.payment_schedule)),
    source
  };

  return { terms, warnings: clientTerms.warnings };
}

/**
 * What to write onto a contract when it is generated.
 *
 * Returns a refusal rather than a partial set when the margin is not
 * configured. A contract created without a margin bills at cost, and
 * nobody notices until the month's revenue is counted.
 */
export async function termsForNewContract(
  organizationId: string | null | undefined,
  serviceType: string | null | undefined
): Promise<TermsResult<{ terms: BillingTerms; columns: Record<string, any> }>> {
  const { terms, warnings } = await effectiveTerms(organizationId, serviceType);
  if (!terms) return fail(400, `"${serviceType}" is not one of the four service lines.`);

  if (terms.clientFeePct === null || terms.talentCommissionPct === null) {
    return fail(409,
      `No margin is configured for ${terms.serviceLine.replace(/_/g, ' ')}. `
      + 'Set the client fee and the talent commission in Finance before generating this contract.');
  }

  if (terms.serviceLine === 'placement' && terms.placementFeePct === null) {
    warnings.push('No placement fee percentage is configured, so the contract needs a flat placement fee.');
  }

  const problem = scheduleProblem(terms.paymentSchedule);
  if (problem) {
    return fail(409, `The payment schedule for this client cannot be used: ${problem}`);
  }

  return {
    ok: true,
    status: 200,
    data: {
      terms,
      // The columns to write onto the contract row. Copied, never referenced,
      // so a later change to the configuration leaves this engagement alone.
      columns: {
        client_fee_pct_snapshot: terms.clientFeePct,
        talent_commission_pct_snapshot: terms.talentCommissionPct,
        placement_fee_pct: terms.placementFeePct,
        management_premium_pct: terms.managementPremiumPct,
        payment_terms_days: terms.paymentTermsDays,
        payment_schedule: terms.paymentSchedule
      }
    },
    warnings
  };
}

// ─── Writing ─────────────────────────────────────────────────────────────────

function guard(actor: Actor): TermsResult | null {
  if (!actor) return fail(401, 'Not authenticated.');
  const held = Array.isArray(actor.permissions) ? actor.permissions : [];
  if (!held.includes('finance.manage') && !held.includes('settings.manage')) {
    return fail(403, 'Your role cannot change billing terms.');
  }
  return null;
}

/** Everything a margins screen needs: the four lines and every client override. */
export async function listBillingTerms(actor: Actor): Promise<TermsResult> {
  if (!actor) return fail(401, 'Not authenticated.');
  if (actor.kind !== 'admin') return fail(403, 'Not authorised.');

  const [{ fees }, extras, clientTerms] = await Promise.all([
    readFees(),
    readFeeExtras(),
    readClientTerms()
  ]);

  const lines = SERVICE_LINES.map(line => {
    const base = fees.find(fee => fee.serviceLine === line) || null;
    const extra = extras[line] || {};
    return {
      serviceLine: line,
      clientFeePct: base?.clientFeePct ?? null,
      talentCommissionPct: base?.talentCommissionPct ?? null,
      placementFeePct: toNumber(extra.placement_fee_pct),
      managementPremiumPct: toNumber(extra.management_premium_pct),
      paymentTermsDays: toNumber(extra.payment_terms_days),
      paymentSchedule: toSchedule(extra.payment_schedule),
      configured: base?.clientFeePct !== null && base?.talentCommissionPct !== null
    };
  });

  const overrides = Object.values(clientTerms.terms).map((row: any) => ({
    organizationId: row.organization_id,
    serviceLine: row.service_line,
    clientFeePct: toNumber(row.client_fee_pct),
    talentCommissionPct: toNumber(row.talent_commission_pct),
    placementFeePct: toNumber(row.placement_fee_pct),
    managementPremiumPct: toNumber(row.management_premium_pct),
    paymentTermsDays: toNumber(row.payment_terms_days),
    paymentSchedule: toSchedule(row.payment_schedule),
    notes: row.notes || null,
    updatedAt: row.updated_at,
    updatedBy: row.updated_by
  }));

  return {
    ok: true,
    status: 200,
    data: { lines, overrides },
    warnings: clientTerms.warnings
  };
}

/** A percentage as somebody types it, as the fraction everything stores. */
function asFraction(value: any, field: string): { value: number | null; error?: string } {
  if (value === null || value === undefined || value === '') return { value: null };
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return { value: null, error: `${field} is not a number.` };
  if (parsed < 0) return { value: null, error: `${field} cannot be negative.` };
  // Typed as 15 meaning fifteen percent, or 0.15 meaning the same. Anything
  // at or above 1 is read as a percentage, which is how people type it.
  const fraction = parsed >= 1 ? parsed / 100 : parsed;
  if (fraction > 1) return { value: null, error: `${field} cannot be more than 100%.` };
  return { value: fraction };
}

/** Sets a service line's defaults. */
export async function setServiceLineTerms(
  actor: Actor,
  input: {
    serviceLine: string;
    placementFeePct?: any;
    managementPremiumPct?: any;
    paymentTermsDays?: any;
    paymentSchedule?: PaymentSchedule | null;
  }
): Promise<TermsResult> {
  const refused = guard(actor);
  if (refused) return refused;

  const line = serviceLineOf(input.serviceLine);
  if (!line) return fail(400, `"${input.serviceLine}" is not one of the four service lines.`);

  // The two margins are not settable here.
  //
  // `setFee` owns them, and it writes a row to fee_audit_log every time one
  // moves. A second path that wrote the margin without the log would leave
  // a change nobody can trace, which for the number the platform's revenue
  // comes from is the one thing that must not happen.
  if ('clientFeePct' in input || 'talentCommissionPct' in input) {
    return fail(400,
      'The client fee and the talent commission are changed in the fee table above, '
      + 'so every change to them is recorded in the fee audit log.');
  }

  const fields: Record<string, any> = {};
  for (const [key, column] of [
    ['placementFeePct', 'placement_fee_pct'],
    ['managementPremiumPct', 'management_premium_pct']
  ] as const) {
    if (!(key in input)) continue;
    const { value, error } = asFraction((input as any)[key], key);
    if (error) return fail(400, error);
    fields[column] = value;
  }

  if ('paymentTermsDays' in input) {
    const days = toNumber(input.paymentTermsDays);
    if (days !== null && (days < 0 || days > 180)) {
      return fail(400, 'Payment terms must be between 0 and 180 days.');
    }
    fields.payment_terms_days = days;
  }

  if ('paymentSchedule' in input) {
    const schedule = toSchedule(input.paymentSchedule);
    const problem = scheduleProblem(schedule);
    if (problem) return fail(400, problem);
    fields.payment_schedule = schedule;
  }

  if (Object.keys(fields).length === 0) return fail(400, 'Nothing to change.');

  const supabase = getSupabaseClient();

  // fee_config.id has no default, so an insert without one is refused. Read
  // the row first and carry its id, or mint one for a line that has never
  // been configured.
  const { data: existing, error: readError } = await supabase
    .from('fee_config')
    .select('id')
    .eq('service_line', line)
    .maybeSingle();

  if (readError) return fail(500, `The current fee could not be read: ${readError.message}`);

  const { error } = await supabase
    .from('fee_config')
    .upsert({
      id: existing?.id || newId('fee'),
      service_line: line,
      ...fields,
      updated_by: actor.email || actor.userId,
      updated_at: new Date().toISOString()
    }, { onConflict: 'service_line' });

  if (error) {
    if (isUndefinedColumn(error)) {
      return fail(503,
        'This database has not had the 2026-11-19 billing terms migration run against it yet, '
        + 'so it has nowhere to put the placement fee, the supervision premium or the payment '
        + 'schedule. Run it and try again.');
    }
    return fail(500, error.message);
  }

  await recordAudit(actor, {
    action: 'Change Service Line Margin',
    details: `${line.replace(/_/g, ' ')}: ${Object.entries(fields)
      .map(([column, value]) => `${column}=${JSON.stringify(value)}`).join(', ')}.`,
    entityType: 'fee_config',
    entityId: line
  });

  return { ok: true, status: 200, data: { serviceLine: line, ...fields } };
}

/** Sets one client's override, or clears it. */
export async function setClientTerms(
  actor: Actor,
  input: {
    organizationId: string;
    serviceLine: string;
    clear?: boolean;
    clientFeePct?: any;
    talentCommissionPct?: any;
    placementFeePct?: any;
    managementPremiumPct?: any;
    paymentTermsDays?: any;
    paymentSchedule?: PaymentSchedule | null;
    notes?: string;
  }
): Promise<TermsResult> {
  const refused = guard(actor);
  if (refused) return refused;

  if (!input.organizationId) return fail(400, 'An organisation is required.');
  const line = serviceLineOf(input.serviceLine);
  if (!line) return fail(400, `"${input.serviceLine}" is not one of the four service lines.`);

  const supabase = getSupabaseClient();

  if (input.clear) {
    const { error } = await supabase
      .from('client_billing_terms')
      .delete()
      .eq('organization_id', input.organizationId)
      .eq('service_line', line);
    if (error) return fail(500, error.message);

    await recordAudit(actor, {
      action: 'Clear Client Billing Terms',
      details: `${input.organizationId} now uses the standard ${line.replace(/_/g, ' ')} margin.`,
      entityType: 'organization',
      entityId: input.organizationId
    });
    return { ok: true, status: 200, data: { organizationId: input.organizationId, serviceLine: line, cleared: true } };
  }

  const row: Record<string, any> = {
    organization_id: input.organizationId,
    service_line: line,
    notes: input.notes ?? null,
    updated_by: actor.email || actor.userId,
    updated_at: new Date().toISOString()
  };

  for (const [key, column] of [
    ['clientFeePct', 'client_fee_pct'],
    ['talentCommissionPct', 'talent_commission_pct'],
    ['placementFeePct', 'placement_fee_pct'],
    ['managementPremiumPct', 'management_premium_pct']
  ] as const) {
    const { value, error } = asFraction((input as any)[key], key);
    if (error) return fail(400, error);
    row[column] = value;
  }

  const days = toNumber(input.paymentTermsDays);
  if (days !== null && (days < 0 || days > 180)) {
    return fail(400, 'Payment terms must be between 0 and 180 days.');
  }
  row.payment_terms_days = days;

  const schedule = toSchedule(input.paymentSchedule);
  const problem = scheduleProblem(schedule);
  if (problem) return fail(400, problem);
  row.payment_schedule = schedule;

  // The migration gives this table a default id, but a database where the
  // table was created by hand may not have one. Supplying it costs nothing
  // and removes the question.
  const { data: existingRow } = await supabase
    .from('client_billing_terms')
    .select('id')
    .eq('organization_id', input.organizationId)
    .eq('service_line', line)
    .maybeSingle();

  row.id = existingRow?.id || newId('cbt');

  const { error } = await supabase
    .from('client_billing_terms')
    .upsert(row, { onConflict: 'organization_id,service_line' });

  if (error) {
    if (/does not exist/i.test(error.message || '')) {
      return fail(503, 'This database has not had the 2026-11-19 billing terms migration run against it yet.');
    }
    return fail(500, error.message);
  }

  await recordAudit(actor, {
    action: 'Set Client Billing Terms',
    details: `${input.organizationId}, ${line.replace(/_/g, ' ')}: `
      + Object.entries(row)
          .filter(([column]) => column.endsWith('_pct') || column.startsWith('payment_'))
          .map(([column, value]) => `${column}=${JSON.stringify(value)}`).join(', '),
    entityType: 'organization',
    entityId: input.organizationId
  });

  // Said out loud, because the person setting it will assume otherwise.
  return {
    ok: true,
    status: 200,
    data: { organizationId: input.organizationId, serviceLine: line },
    warnings: [
      'This applies to contracts generated from now on. Contracts already signed keep the terms '
      + 'they were created with.'
    ]
  };
}
