/**
 * Fee rules, and their history.
 *
 * `fee_config` holds the current figure per service line and is overwritten
 * when it changes. It stays, and stays the thing the finance screen reads for
 * "what do we charge". This sits beside it and keeps the versions, so the
 * figure frozen onto a contract in March can be traced to the rule that was
 * in force in March.
 *
 * Changing a rule never edits a row. It closes the current version with an
 * end date and inserts the next one, so the arithmetic behind an invoice that
 * has already gone out stays reproducible.
 *
 * The rules about dates, bounds and versions live in
 * `@kongila/workflows/feeRules`, which imports nothing and is tested on its
 * own. This is the part that talks to the database.
 */

import { getSupabaseClient } from './index';
import type { RequestActor as Actor } from './scope';
import { recordAudit } from './audit';
import {
  ruleFor,
  applyRule,
  ruleChangeProblem,
  planRuleChange,
  describeRule,
  type FeeRule,
  type FeeParty,
  type FeeBasisInput
} from '@kongila/workflows';

export interface FeeRuleResult<T = any> {
  ok: boolean;
  status: number;
  error?: string;
  data?: T;
  warnings?: string[];
}

function fail(status: number, error: string): FeeRuleResult {
  return { ok: false, status, error };
}

function missingSchema(error: any): boolean {
  const message = String(error?.message || '');
  return /does not exist/i.test(message)
    || /schema cache/i.test(message)
    || error?.code === '42P01'
    || error?.code === '42703';
}

function toRule(row: any): FeeRule {
  return {
    id: String(row.id),
    serviceLine: String(row.service_line),
    party: String(row.party) as FeeParty,
    basis: row.basis,
    value: Number(row.value),
    minimumUsd: row.minimum_usd == null ? null : Number(row.minimum_usd),
    maximumUsd: row.maximum_usd == null ? null : Number(row.maximum_usd),
    effectiveFrom: row.effective_from || null,
    effectiveTo: row.effective_to || null,
    version: row.version == null ? null : Number(row.version),
    active: row.active !== false,
    label: row.label || null
  };
}

/** Every rule and every version of it, newest first. */
export async function listFeeRules(actor: Actor): Promise<FeeRuleResult> {
  if (!actor) return fail(401, 'Not authenticated.');
  const held = Array.isArray(actor.permissions) ? actor.permissions : [];
  if (!held.includes('finance.manage') && !held.includes('view:finance')) {
    return fail(403, 'Your role cannot see fee rules.');
  }

  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('fee_rules')
    .select('*')
    .order('service_line')
    .order('party')
    .order('version', { ascending: false });

  if (error) {
    if (missingSchema(error)) {
      return {
        ok: true, status: 200, data: { rules: [], current: [] },
        warnings: ['Fee rule history is not set up on this database yet. '
          + 'Run the 2026-11-20c migration. Fees are still read from the fee configuration.']
      };
    }
    return fail(500, error.message);
  }

  const rules = (data || []).map(toRule);
  const now = new Date();

  // What is in force right now, which is the question the screen asks.
  const lines: string[] = Array.from(new Set(rules.map((rule: FeeRule) => rule.serviceLine)));
  const current: any[] = [];
  for (const line of lines) {
    for (const party of ['client', 'talent'] as FeeParty[]) {
      const rule = ruleFor(rules, line, party, now);
      if (rule) current.push({ ...rule, description: describeRule(rule) });
    }
  }

  return { ok: true, status: 200, data: { rules, current } };
}

/**
 * The rules that price a contract, as of a date.
 *
 * Returns nulls rather than defaults when nothing is configured: a fee of
 * zero because nobody set one is an invoice for nothing, and that has to be
 * a refusal upstream, not a silent discount.
 */
export async function rulesForPricing(
  serviceLine: string,
  on: Date = new Date()
): Promise<{ client: FeeRule | null; talent: FeeRule | null; available: boolean }> {
  const supabase = getSupabaseClient();

  try {
    const { data, error } = await supabase
      .from('fee_rules')
      .select('*')
      .eq('service_line', serviceLine);

    if (error) return { client: null, talent: null, available: false };

    const rules = (data || []).map(toRule);
    return {
      client: ruleFor(rules, serviceLine, 'client', on),
      talent: ruleFor(rules, serviceLine, 'talent', on),
      available: true
    };
  } catch {
    return { client: null, talent: null, available: false };
  }
}

/** What a service line charges on a date, given the figures to charge on. */
export async function priceWithRules(
  serviceLine: string,
  input: FeeBasisInput,
  on: Date = new Date()
): Promise<{ clientFee: number | null; talentDeduction: number | null; rules: { client: FeeRule | null; talent: FeeRule | null } }> {
  const { client, talent } = await rulesForPricing(serviceLine, on);
  return {
    clientFee: client ? applyRule(client, input) : null,
    talentDeduction: talent ? applyRule(talent, input) : null,
    rules: { client, talent }
  };
}

/**
 * The earliest date a rule may now take effect from.
 *
 * The day after the most recent contract priced on this service line. A rule
 * cannot be backdated past a contract that was priced under the version it
 * replaces, because the invoice has gone out and its arithmetic has to stay
 * reproducible.
 */
async function earliestAllowedFor(serviceLine: string): Promise<Date | undefined> {
  const supabase = getSupabaseClient();
  try {
    const { data } = await supabase
      .from('contracts')
      .select('generated_at, created_at')
      .eq('service_type', serviceLine)
      .order('generated_at', { ascending: false })
      .limit(1);

    const row = (data || [])[0];
    const stamp = row?.generated_at || row?.created_at;
    if (!stamp) return undefined;

    const date = new Date(stamp);
    return Number.isFinite(date.getTime()) ? date : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Changes a rule, by closing the current version and opening a new one.
 *
 * Takes effect from a date, which defaults to today. Backdating past the
 * last priced contract is refused rather than silently repricing history.
 */
export async function setFeeRule(
  actor: Actor,
  input: {
    serviceLine: string;
    party: FeeParty;
    basis?: string;
    value: number;
    minimumUsd?: number | null;
    maximumUsd?: number | null;
    label?: string | null;
    effectiveFrom?: string | null;
  }
): Promise<FeeRuleResult> {
  if (!actor) return fail(401, 'Not authenticated.');
  const held = Array.isArray(actor.permissions) ? actor.permissions : [];
  if (!held.includes('finance.manage')) {
    return fail(403, 'Only finance changes a fee rule.');
  }
  if (!input.serviceLine) return fail(400, 'Which service line?');
  if (!['client', 'talent'].includes(String(input.party))) {
    return fail(400, 'A fee is either charged to the client or deducted from the candidate.');
  }

  const supabase = getSupabaseClient();
  const effectiveFrom = String(input.effectiveFrom || new Date().toISOString().slice(0, 10));

  const { data: existing, error: readError } = await supabase
    .from('fee_rules')
    .select('*')
    .eq('service_line', input.serviceLine)
    .eq('party', input.party);

  if (readError) {
    if (missingSchema(readError)) {
      return fail(503, 'This database has not had the 2026-11-20c fee rules migration run against '
        + 'it yet, so a rule cannot keep its history. Run it and try again.');
    }
    return fail(500, readError.message);
  }

  const rules = (existing || []).map(toRule);
  const current = ruleFor(rules, input.serviceLine, input.party, new Date());

  const problem = ruleChangeProblem(
    current,
    {
      value: Number(input.value),
      basis: (input.basis || current?.basis || 'percent_of_rate') as any,
      minimumUsd: input.minimumUsd ?? null,
      maximumUsd: input.maximumUsd ?? null,
      effectiveFrom
    },
    { earliestAllowed: await earliestAllowedFor(input.serviceLine) }
  );
  if (problem) return fail(422, problem);

  const { closing, opening } = planRuleChange(
    current,
    {
      serviceLine: input.serviceLine,
      party: input.party,
      basis: (input.basis || current?.basis || 'percent_of_rate') as any,
      value: Number(input.value),
      minimumUsd: input.minimumUsd ?? null,
      maximumUsd: input.maximumUsd ?? null,
      label: input.label ?? null
    },
    effectiveFrom
  );

  const now = new Date().toISOString();

  if (closing?.id) {
    const { error } = await supabase
      .from('fee_rules')
      .update({ effective_to: effectiveFrom, updated_at: now })
      .eq('id', closing.id);
    if (error) return fail(500, `The previous version was not closed, so nothing was changed: ${error.message}`);
  }

  const { data: inserted, error: insertError } = await supabase
    .from('fee_rules')
    .insert({
      service_line: opening.serviceLine,
      party: opening.party,
      basis: opening.basis,
      value: opening.value,
      minimum_usd: opening.minimumUsd,
      maximum_usd: opening.maximumUsd,
      effective_from: effectiveFrom,
      effective_to: null,
      version: opening.version,
      active: true,
      label: opening.label,
      created_by: actor.userId,
      created_at: now,
      updated_at: now
    })
    .select('*')
    .maybeSingle();

  if (insertError) {
    // Put the old version back, so a failure leaves nothing half-closed.
    if (closing?.id) {
      await supabase.from('fee_rules')
        .update({ effective_to: closing.effectiveTo ?? null }).eq('id', closing.id);
    }
    return fail(500, `That rule was not saved: ${insertError.message}`);
  }

  const saved = toRule(inserted);

  await recordAudit(actor, {
    action: 'Change Fee Rule',
    details: `${input.serviceLine} ${input.party}: ${describeRule(saved)}, from ${effectiveFrom}`
      + (current ? ` (was ${describeRule(current)})` : ' (first version)'),
    entityType: 'fee_rule',
    entityId: String(saved.id)
  });

  return {
    ok: true,
    status: 200,
    data: { rule: saved, description: describeRule(saved), replaced: current || null }
  };
}
