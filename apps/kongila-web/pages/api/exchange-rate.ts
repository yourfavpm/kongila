import type { NextApiRequest, NextApiResponse } from 'next';

type CacheEntry = {
  fetchedAt: string;
  rates: Record<string, number>;
};

const cache = new Map<string, CacheEntry>();

const FALLBACK_RATES: Record<string, number> = {
  USD: 1,
  EUR: 0.92,
  GBP: 0.79,
  CAD: 1.37,
  AUD: 1.49,
  NGN: 1600,
  KES: 129,
  GHS: 12.4,
  ZAR: 18.5
};

async function fetchRates(base: string) {
  const cacheKey = base.toUpperCase();
  const cached = cache.get(cacheKey);
  const now = Date.now();
  if (cached && now - new Date(cached.fetchedAt).getTime() < 24 * 60 * 60 * 1000) {
    return cached.rates;
  }

  try {
    const response = await fetch(`https://open.er-api.com/v6/latest/${encodeURIComponent(cacheKey)}`);
    if (!response.ok) {
      throw new Error(`Rate API responded with ${response.status}`);
    }
    const payload = await response.json();
    if (payload?.result !== 'success' || !payload?.rates) {
      throw new Error('Invalid exchange rate payload');
    }
    cache.set(cacheKey, { fetchedAt: new Date().toISOString(), rates: payload.rates });
    return payload.rates as Record<string, number>;
  } catch (error) {
    const rates = cache.get(cacheKey)?.rates || FALLBACK_RATES;
    cache.set(cacheKey, { fetchedAt: new Date().toISOString(), rates });
    return rates;
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const base = String(req.query.base || 'USD').toUpperCase();
  const target = String(req.query.target || 'USD').toUpperCase();

  try {
    const rates = await fetchRates(base);
    const rate = target === base ? 1 : rates[target] || FALLBACK_RATES[target] || 1;
    return res.status(200).json({
      base,
      target,
      rate,
      fetchedAt: new Date().toISOString()
    });
  } catch (error: any) {
    return res.status(200).json({
      base,
      target,
      rate: target === base ? 1 : FALLBACK_RATES[target] || 1,
      fetchedAt: new Date().toISOString(),
      fallback: true
    });
  }
}
