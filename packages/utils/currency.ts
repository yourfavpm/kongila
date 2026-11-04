/**
 * Currency, and the rate a figure was converted at.
 *
 * What was there: `/api/exchange-rate` fetched a live rate, and on any
 * failure fell back to a hardcoded table where NGN was 1600. That part is
 * defensible. What was not: it then wrote the fallback into the cache with
 * `fetchedAt: new Date()`, so an invented rate was stored as if it had just
 * been fetched and served for the next twenty-four hours with no sign that
 * anything had gone wrong. A caller could not tell a real rate from 1600.
 *
 * Worse, nothing recorded the rate used. A payout converted to naira in
 * March and queried in June showed June's rate against March's money, so
 * the figures never reconciled and nobody could say what had actually been
 * paid.
 *
 * Two rules here:
 *
 *   1. A rate always carries its source. `live` came from the provider,
 *      `cached` came from a provider response that is still fresh,
 *      `fallback` is a built-in guess and is labelled as one.
 *   2. A money record stores the rate it used, at the moment it used it.
 *      Converting again later is how a record changes value on its own.
 *
 * This file imports nothing, so it can be tested on its own.
 */

export type RateSource = 'live' | 'cached' | 'fallback' | 'same_currency';

export interface Rate {
  base: string;
  target: string;
  rate: number;
  source: RateSource;
  /** When the provider produced it, not when we last touched it. */
  fetchedAt: string;
  /** True when this is a built-in guess rather than a real rate. */
  isEstimate: boolean;
  /** Something to show a person when the number cannot be trusted. */
  warning: string | null;
}

/**
 * Last-resort rates.
 *
 * Deliberately not treated as current. They exist so a page renders rather
 * than crashes, and every one of them is returned flagged as an estimate.
 */
export const FALLBACK_RATES: Record<string, number> = {
  USD: 1, EUR: 0.92, GBP: 0.79, CAD: 1.37, AUD: 1.49,
  NGN: 1600, KES: 129, GHS: 12.4, ZAR: 18.5
};

/** How long a fetched rate stays usable. */
export const RATE_TTL_MS = 12 * 60 * 60 * 1000;

export function normaliseCurrency(code?: string | null): string {
  return String(code || 'USD').trim().toUpperCase();
}

export function isSupportedCurrency(code?: string | null): boolean {
  return normaliseCurrency(code) in FALLBACK_RATES;
}

export interface CacheEntry {
  rates: Record<string, number>;
  /** When the provider produced these. A fallback never gets one. */
  fetchedAt: string;
  source: 'live' | 'fallback';
}

/** Whether a cached provider response is still worth serving. */
export function cacheIsFresh(entry: CacheEntry | undefined, now: number = Date.now()): boolean {
  if (!entry) return false;
  // A fallback is never fresh. Caching it as if it were is the bug.
  if (entry.source === 'fallback') return false;
  const age = now - new Date(entry.fetchedAt).getTime();
  return Number.isFinite(age) && age >= 0 && age < RATE_TTL_MS;
}

/**
 * Builds the answer, labelled with where the number came from.
 */
export function resolveRate(
  base: string,
  target: string,
  entry: CacheEntry | undefined,
  now: number = Date.now()
): Rate {
  const from = normaliseCurrency(base);
  const to = normaliseCurrency(target);
  const stamp = new Date(now).toISOString();

  if (from === to) {
    return {
      base: from, target: to, rate: 1, source: 'same_currency',
      fetchedAt: stamp, isEstimate: false, warning: null
    };
  }

  if (entry && entry.source === 'live' && typeof entry.rates[to] === 'number') {
    const fresh = cacheIsFresh(entry, now);
    return {
      base: from,
      target: to,
      rate: entry.rates[to],
      source: fresh ? 'cached' : 'live',
      fetchedAt: entry.fetchedAt,
      isEstimate: false,
      warning: fresh ? null : 'This rate is more than twelve hours old.'
    };
  }

  const fallback = FALLBACK_RATES[to];
  if (typeof fallback !== 'number') {
    return {
      base: from, target: to, rate: 1, source: 'fallback',
      fetchedAt: stamp, isEstimate: true,
      warning: `No rate is available for ${to}. Showing the amount unconverted.`
    };
  }

  return {
    base: from, target: to, rate: fallback, source: 'fallback',
    fetchedAt: stamp, isEstimate: true,
    warning: `Live rates are unavailable, so this uses a stored estimate of `
           + `${fallback} ${to} to 1 ${from}. Do not use it to settle a payment.`
  };
}

// ─── Money with a rate attached ──────────────────────────────────────────────

/** What gets stored on an invoice or a payout. */
export interface MoneyRecord {
  /** The amount in the currency the contract is denominated in. */
  amount: number;
  currency: string;
  /** The same amount in USD, which is what every report sums. */
  amountUsd: number;
  /** Units of `currency` per 1 USD at the moment this was written. */
  usdRate: number;
  rateSource: RateSource;
  rateFetchedAt: string;
}

function round(amount: number): number {
  return Math.round((Number(amount) + Number.EPSILON) * 100) / 100;
}

/**
 * Pins an amount to the rate in force when it was recorded.
 *
 * Everything reports in USD, so that is what is stored alongside the
 * original. Re-deriving it later from whatever today's rate happens to be
 * is what made the same payout worth different amounts on different days.
 */
export function recordMoney(amount: number, currency: string, rate: Rate): MoneyRecord {
  const code = normaliseCurrency(currency);
  const value = Number(amount) || 0;

  // `rate` is USD to the target. An amount already in USD needs no
  // conversion; an amount in another currency is divided back.
  const usdRate = code === 'USD' ? 1 : (rate.target === code ? rate.rate : 1);

  return {
    amount: round(value),
    currency: code,
    amountUsd: round(code === 'USD' ? value : value / usdRate),
    usdRate,
    rateSource: code === 'USD' ? 'same_currency' : rate.source,
    rateFetchedAt: rate.fetchedAt
  };
}

/** Converts for display only. Never for a figure that gets stored. */
export function convert(amountUsd: number, rate: Rate): number {
  return round((Number(amountUsd) || 0) * rate.rate);
}

/**
 * Formats an amount, saying so when the conversion is a guess.
 *
 * A number on a finance screen that might be wrong by any margin should not
 * look identical to one that is right.
 */
export function formatMoney(
  amount: number,
  currency: string,
  options: { estimate?: boolean } = {}
): string {
  const code = normaliseCurrency(currency);
  let text: string;

  try {
    text = new Intl.NumberFormat('en-US', {
      style: 'currency', currency: code, maximumFractionDigits: 2
    }).format(Number(amount) || 0);
  } catch {
    text = `${code} ${(Number(amount) || 0).toFixed(2)}`;
  }

  return options.estimate ? `${text} (estimated)` : text;
}
