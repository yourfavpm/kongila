import type { NextApiRequest, NextApiResponse } from 'next';
import { resolveRate, cacheIsFresh, normaliseCurrency, type CacheEntry } from '@kongila/utils';

/**
 * Exchange rates.
 *
 * The bug was not the fallback table, which is a reasonable thing to have.
 * It was this, in the catch block:
 *
 *   const rates = cache.get(cacheKey)?.rates || FALLBACK_RATES;
 *   cache.set(cacheKey, { fetchedAt: new Date().toISOString(), rates });
 *
 * A failed fetch wrote the hardcoded table into the cache stamped with the
 * current time. For the next twenty-four hours every caller was served a
 * made-up 1600 NGN that looked exactly like a real rate, and the next
 * request found a "fresh" cache entry so it never tried the provider again.
 * One network blip turned into a day of invented numbers.
 *
 * Now: a fallback is never cached, never looks fresh, and comes back
 * labelled as an estimate with a warning the caller can show.
 */

const cache = new Map<string, CacheEntry>();

async function ratesFor(base: string): Promise<CacheEntry | undefined> {
  const key = normaliseCurrency(base);
  const cached = cache.get(key);

  // Only a real provider response can be fresh. cacheIsFresh refuses a
  // fallback whatever its timestamp says.
  if (cacheIsFresh(cached)) return cached;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(
      `https://open.er-api.com/v6/latest/${encodeURIComponent(key)}`,
      { signal: controller.signal }
    );
    clearTimeout(timer);

    if (!response.ok) throw new Error(`The rate provider returned ${response.status}.`);

    const payload = await response.json();
    if (payload?.result !== 'success' || !payload?.rates) {
      throw new Error('The rate provider returned something unexpected.');
    }

    const stamp = payload.time_last_update_utc
      ? new Date(payload.time_last_update_utc)
      : new Date();

    const entry: CacheEntry = {
      rates: payload.rates,
      // The provider's own timestamp where it gives one, so an old response
      // is not relabelled as current.
      fetchedAt: Number.isNaN(stamp.getTime())
        ? new Date().toISOString()
        : stamp.toISOString(),
      source: 'live'
    };

    cache.set(key, entry);
    return entry;
  } catch (error: any) {
    console.warn(`[exchange-rate] ${key}: ${error?.message || error}`);
    // Deliberately not cached. The next request tries the provider again
    // instead of serving a guess for the rest of the day.
    return cached && cached.source === 'live' ? cached : undefined;
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const base = normaliseCurrency(String(req.query.base || 'USD'));
  const target = normaliseCurrency(String(req.query.target || 'USD'));

  const entry = await ratesFor(base);
  const rate = resolveRate(base, target, entry);

  // An estimate is not a server error, but it is not a normal answer
  // either. The body says which it is on every response, so a caller can
  // label the figure instead of presenting a guess as a fact.
  return res.status(200).json(rate);
}
