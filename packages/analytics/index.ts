/**
 * Platform metrics.
 *
 * Every number on the admin dashboard came from this file, and most of them
 * could not be right:
 *
 *   - Active contracts counted only status 'Signed'. The reader maps the
 *     database's `active` to 'Active' and `fully_signed` to 'Signed', so a
 *     contract that was signed and then activated — the normal path — fell
 *     out of the count. Revenue, conversion and active clients all derive
 *     from that list, so all four read zero against real data.
 *   - Revenue multiplied salaries by a hardcoded 1.25 "administrative
 *     markup". No fee is configured anywhere in the product, so the figure
 *     was an invention presented as revenue.
 *   - Active talent counted vettingStatus 'Deployed', which nothing in the
 *     product ever sets, so it was permanently zero, and utilisation with it.
 *
 * The rule here now: a metric is computed from data the product actually
 * writes, or it reports null and says why. A dashboard showing a confident
 * wrong number is worse than one showing a gap.
 *
 * This file imports nothing, so it can be tested on its own.
 */

export interface PlatformMetrics {
  /** Monthly contract value under management. */
  monthlyContractValue: number;
  /**
   * Kongila's own revenue. Null until a fee is configured: it used to be
   * contract value times 1.25, which measured nothing.
   */
  monthlyRevenue: number | null;
  activeContractCount: number;
  activeTalentCount: number;
  deployableTalentCount: number;
  /** Percent of deployable talent on a live contract. Null when none. */
  utilizationRate: number | null;
  /** Percent of requests that reached a signed contract. Null when none. */
  conversionRate: number | null;
  activeClientsCount: number;
  averageMatchingScore: number | null;
  /** Anything that could not be computed, and why. */
  unavailable: string[];
}

/**
 * Contract statuses that mean money is moving.
 *
 * These are the display values the reader produces, not the raw column.
 * mapContractStatusFromDb turns `active` into 'Active' and `fully_signed`
 * into 'Signed'; both are live. 'Pending Signatures' is not yet, and
 * 'Completed', 'Terminated' and 'Closed' are over.
 */
const LIVE_CONTRACT_STATUSES = new Set(['active', 'signed', 'client signed', 'talent signed']);

export function isLiveContract(contract: any): boolean {
  return LIVE_CONTRACT_STATUSES.has(String(contract?.status || '').toLowerCase());
}

/** Monthly value of one contract, whatever shape the row arrived in. */
function monthlyValueOf(contract: any): number {
  const raw = contract?.rateAmount
    ?? contract?.rate_amount
    ?? contract?.monthlyRateUsd
    ?? contract?.monthly_rate_usd
    ?? contract?.salary
    ?? 0;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0) return 0;

  // An hourly contract is not a monthly figure. 160 hours is the convention
  // the rest of the product uses for a full-time month.
  const rateType = String(contract?.rateType || contract?.rate_type || '').toLowerCase();
  return rateType === 'hourly' ? value * 160 : value;
}

export interface MetricsOptions {
  /**
   * Kongila's margin as a fraction, e.g. 0.25. When absent, revenue is
   * reported as null rather than invented.
   */
  platformFeeRate?: number | null;
}

export function computePlatformMetrics(
  talents: any[],
  requests: any[],
  matches: any[],
  contracts: any[],
  options: MetricsOptions = {}
): PlatformMetrics {
  const unavailable: string[] = [];

  const allContracts = contracts || [];
  const liveContracts = allContracts.filter(isLiveContract);

  const monthlyContractValue = Math.round(
    liveContracts.reduce((sum, c) => sum + monthlyValueOf(c), 0)
  );

  // Revenue needs a fee. There is no fee table, no seed and no handler for
  // one, so unless a caller supplies the rate this stays null.
  const feeRate = options.platformFeeRate;
  const monthlyRevenue = typeof feeRate === 'number' && feeRate > 0
    ? Math.round(monthlyContractValue * feeRate)
    : null;
  if (monthlyRevenue === null) {
    unavailable.push('Revenue needs a platform fee rate, which is not configured yet.');
  }

  // Active talent is whoever is on a live contract. Counting vettingStatus
  // 'Deployed' meant counting a status nothing in the product sets.
  const activeTalentIds = new Set(
    liveContracts.map((c: any) => String(c.talentId ?? c.talent_id)).filter(Boolean)
  );
  const activeTalentCount = activeTalentIds.size;

  const deployableTalentCount = (talents || []).filter((t: any) =>
    ['Vetted', 'Matched', 'Deployed'].includes(String(t?.vettingStatus))
  ).length;

  const utilizationRate = deployableTalentCount > 0
    ? Math.round((activeTalentCount / deployableTalentCount) * 100)
    : null;
  if (utilizationRate === null) {
    unavailable.push('Utilisation needs at least one vetted candidate.');
  }

  // Conversion counts every contract that reached signing, not only the live
  // ones: a placement that has since ended was still a conversion.
  const everSigned = allContracts.filter((c: any) =>
    !['pending', 'pending signatures'].includes(String(c?.status || '').toLowerCase())
  ).length;

  const conversionRate = (requests || []).length > 0
    ? Math.round((everSigned / requests.length) * 100)
    : null;
  if (conversionRate === null) {
    unavailable.push('Conversion needs at least one client request.');
  }

  const activeClientsCount = new Set(
    liveContracts.map((c: any) => String(c.clientId ?? c.client_id)).filter(Boolean)
  ).size;

  const scored = (matches || []).filter((m: any) => Number.isFinite(Number(m?.score)));
  const averageMatchingScore = scored.length > 0
    ? Math.round(scored.reduce((sum: number, m: any) => sum + Number(m.score), 0) / scored.length)
    : null;
  if (averageMatchingScore === null) {
    unavailable.push('Average match score needs at least one scored match.');
  }

  return {
    monthlyContractValue,
    monthlyRevenue,
    activeContractCount: liveContracts.length,
    activeTalentCount,
    deployableTalentCount,
    utilizationRate,
    conversionRate,
    activeClientsCount,
    averageMatchingScore,
    unavailable
  };
}

/**
 * A candidate's productivity from their vetting scores.
 *
 * Previously weighted `communication`, which was dropped from the scoring
 * model on 2 November 2026 because nothing measured it — so a quarter of
 * this was permanently zero.
 */
export function computeTalentProductivity(scores: {
  technical?: number;
  workSimulation?: number;
  behavioral?: number;
  remoteReadiness?: number;
}): {
  efficiency: number;
  quality: number;
  reliability: number;
  overall: number;
} {
  const n = (v: any) => {
    const value = Number(v);
    return Number.isFinite(value) ? Math.min(100, Math.max(0, value)) : 0;
  };

  const technical = n(scores?.technical);
  const workSimulation = n(scores?.workSimulation);
  const behavioral = n(scores?.behavioral);
  const remoteReadiness = n(scores?.remoteReadiness);

  return {
    efficiency: workSimulation,
    quality: Math.round(technical * 0.7 + workSimulation * 0.3),
    reliability: Math.round(behavioral * 0.6 + remoteReadiness * 0.4),
    overall: Math.round((technical + workSimulation + behavioral + remoteReadiness) / 4)
  };
}
