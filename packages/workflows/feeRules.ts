/**
 * Fee rules, with dates and versions.
 *
 * `fee_config` holds one row per service line: a client fee and a talent
 * commission, overwritten whenever somebody changes them. That is enough to
 * price a contract today and answers none of the questions that get asked
 * afterwards: what was the rate in March, why does this contract bill 15%
 * when the screen says 18%, and who changed it.
 *
 * Contracts already freeze their terms at generation, so a rate change does
 * not reprice what was signed. This adds the other half: the rules
 * themselves keep their history, so the figure frozen onto a contract can be
 * traced back to the rule it came from and the version of it.
 *
 * A rule has a window. Changing a fee closes the current version and opens a
 * new one from the date it takes effect, rather than overwriting. Nothing is
 * ever edited in place and nothing is deleted.
 *
 * This file imports nothing, so it can be tested on its own.
 */

export type FeeBasis =
  /** A percentage of the rate, which is how outsourcing is sold. */
  | 'percent_of_rate'
  /** A percentage of annual salary, which is how placement is sold. */
  | 'percent_of_annual_salary'
  /** A percentage of the project fee. */
  | 'percent_of_project_fee'
  /** A flat amount per period, regardless of the rate. */
  | 'flat_amount'
  /** A flat amount for each seat on a managed team. */
  | 'per_seat';

export type FeeParty = 'client' | 'talent';

export interface FeeRule {
  id: string;
  serviceLine: string;
  /** Who pays it: added to the client's bill, or taken off the talent's pay. */
  party: FeeParty;
  basis: FeeBasis;
  /** A fraction for a percentage basis (0.15), or an amount for a flat one. */
  value: number;
  /** Floors and caps, in money. Both optional, both inclusive. */
  minimumUsd?: number | null;
  maximumUsd?: number | null;
  /** The window this version applies to. An open end means "still current". */
  effectiveFrom?: string | null;
  effectiveTo?: string | null;
  version?: number | null;
  active?: boolean | null;
  label?: string | null;
}

function time(value?: string | null): number | null {
  if (!value) return null;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : null;
}

/** Whether a rule is in force on a date. */
export function ruleAppliesOn(rule: FeeRule, on: Date): boolean {
  if (rule.active === false) return false;

  const at = on.getTime();
  const from = time(rule.effectiveFrom);
  const to = time(rule.effectiveTo);

  // An open start means it has always applied; an open end means it still does.
  if (from !== null && at < from) return false;
  if (to !== null && at >= to) return false;
  return true;
}

/**
 * The rule in force for a service line and party on a date.
 *
 * When versions overlap — which they should not, and do when somebody
 * backdates one — the latest start wins, then the highest version. Picking
 * deterministically matters more than the particular choice: two runs of the
 * billing pass must price a contract the same way.
 */
export function ruleFor(
  rules: FeeRule[],
  serviceLine: string,
  party: FeeParty,
  on: Date = new Date()
): FeeRule | null {
  const candidates = (rules || [])
    .filter(rule => String(rule.serviceLine) === String(serviceLine)
      && String(rule.party) === String(party)
      && ruleAppliesOn(rule, on));

  if (candidates.length === 0) return null;

  return candidates.sort((a, b) => {
    const byStart = (time(b.effectiveFrom) ?? 0) - (time(a.effectiveFrom) ?? 0);
    if (byStart !== 0) return byStart;
    return Number(b.version || 0) - Number(a.version || 0);
  })[0];
}

export interface FeeBasisInput {
  /** The periodic rate, for percent_of_rate. */
  rate?: number | null;
  /** Annual salary, for percent_of_annual_salary. */
  annualSalary?: number | null;
  /** The whole project fee, for percent_of_project_fee. */
  projectFee?: number | null;
  /** Seats on a managed team, for per_seat. */
  seats?: number | null;
}

function round(value: number): number {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

/**
 * What a rule charges, given what it is charged on.
 *
 * Returns null when the rule needs a figure that has not been supplied —
 * a placement fee with no annual salary, say — rather than quietly charging
 * zero, which is the failure that produces an invoice for nothing.
 */
export function applyRule(rule: FeeRule, input: FeeBasisInput): number | null {
  const value = Number(rule.value);
  if (!Number.isFinite(value)) return null;

  let amount: number | null = null;

  switch (rule.basis) {
    case 'percent_of_rate': {
      const rate = Number(input.rate);
      if (!Number.isFinite(rate)) return null;
      amount = rate * value;
      break;
    }
    case 'percent_of_annual_salary': {
      const salary = Number(input.annualSalary);
      if (!Number.isFinite(salary) || salary <= 0) return null;
      amount = salary * value;
      break;
    }
    case 'percent_of_project_fee': {
      const fee = Number(input.projectFee);
      if (!Number.isFinite(fee) || fee <= 0) return null;
      amount = fee * value;
      break;
    }
    case 'flat_amount':
      amount = value;
      break;
    case 'per_seat': {
      const seats = Number(input.seats);
      amount = value * (Number.isFinite(seats) && seats > 0 ? seats : 1);
      break;
    }
    default:
      return null;
  }

  if (amount === null) return null;

  // Floor and cap, in that order, so a rule with both cannot invert them.
  const minimum = Number(rule.minimumUsd);
  const maximum = Number(rule.maximumUsd);
  if (Number.isFinite(minimum) && amount < minimum) amount = minimum;
  if (Number.isFinite(maximum) && amount > maximum) amount = maximum;

  return round(amount);
}

export interface RuleChange {
  /** The version being closed, if there is one. */
  closing?: FeeRule | null;
  /** The version being opened. */
  opening: FeeRule;
}

/**
 * Why a change to a rule cannot be made, or null when it can.
 *
 * Backdating is the one that matters. A rule cannot take effect before a
 * date on which contracts have already been priced from the version it
 * replaces, because those invoices have gone out and the arithmetic behind
 * them has to stay reproducible. Changing the future is fine; rewriting the
 * past is not.
 */
export function ruleChangeProblem(
  current: FeeRule | null,
  next: Partial<FeeRule> & { effectiveFrom?: string | null },
  options: { earliestAllowed?: Date } = {}
): string | null {
  const value = Number(next.value);
  if (!Number.isFinite(value)) return 'Give the rule a value.';
  if (value < 0) return 'A fee cannot be negative.';

  const isPercent = String(next.basis || current?.basis || '').startsWith('percent_');
  if (isPercent && value > 1) {
    return `A percentage is a fraction here: ${value} would be ${Math.round(value * 100)}00%. `
      + `Enter ${value / 100} for ${value}%.`;
  }

  const minimum = Number(next.minimumUsd);
  const maximum = Number(next.maximumUsd);
  if (Number.isFinite(minimum) && Number.isFinite(maximum) && minimum > maximum) {
    return 'The minimum is above the maximum.';
  }

  const from = time(next.effectiveFrom);
  if (next.effectiveFrom && from === null) return 'That start date is not a date.';

  if (from !== null) {
    const floor = options.earliestAllowed ? options.earliestAllowed.getTime() : null;
    if (floor !== null && from < floor) {
      return 'That date is before contracts were last priced from this rule. '
        + 'Invoices have already gone out on the current version, so it cannot be changed '
        + 'retrospectively. Set a date from today onwards.';
    }
    const currentFrom = current ? time(current.effectiveFrom) : null;
    if (currentFrom !== null && from < currentFrom) {
      return 'That date is before the version it replaces starts.';
    }
  }

  return null;
}

/**
 * The two rows a change produces: the version it closes and the one it opens.
 *
 * Never an edit. The old version keeps its figures and gains an end date, so
 * a contract priced under it can still be explained.
 */
export function planRuleChange(
  current: FeeRule | null,
  next: Partial<FeeRule>,
  effectiveFrom: string
): RuleChange {
  const opening: FeeRule = {
    id: String(next.id || ''),
    serviceLine: String(next.serviceLine ?? current?.serviceLine ?? ''),
    party: (next.party ?? current?.party ?? 'client') as FeeParty,
    basis: (next.basis ?? current?.basis ?? 'percent_of_rate') as FeeBasis,
    value: Number(next.value ?? current?.value ?? 0),
    minimumUsd: next.minimumUsd ?? current?.minimumUsd ?? null,
    maximumUsd: next.maximumUsd ?? current?.maximumUsd ?? null,
    effectiveFrom,
    effectiveTo: null,
    version: Number(current?.version || 0) + 1,
    active: true,
    label: next.label ?? current?.label ?? null
  };

  return {
    closing: current ? { ...current, effectiveTo: effectiveFrom } : null,
    opening
  };
}

/** A rule in one line, for an audit entry or a tooltip. */
export function describeRule(rule: FeeRule): string {
  const money = (value: number) => `USD ${value.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
  const percent = (value: number) => `${Math.round(value * 10000) / 100}%`;

  const base =
    rule.basis === 'percent_of_rate' ? `${percent(rule.value)} of the rate`
    : rule.basis === 'percent_of_annual_salary' ? `${percent(rule.value)} of annual salary`
    : rule.basis === 'percent_of_project_fee' ? `${percent(rule.value)} of the project fee`
    : rule.basis === 'per_seat' ? `${money(rule.value)} per seat`
    : money(rule.value);

  const bounds: string[] = [];
  if (Number.isFinite(Number(rule.minimumUsd))) bounds.push(`minimum ${money(Number(rule.minimumUsd))}`);
  if (Number.isFinite(Number(rule.maximumUsd))) bounds.push(`maximum ${money(Number(rule.maximumUsd))}`);

  const who = rule.party === 'talent' ? 'deducted from the candidate' : 'charged to the client';
  return `${base}, ${who}${bounds.length ? ` (${bounds.join(', ')})` : ''}`;
}
