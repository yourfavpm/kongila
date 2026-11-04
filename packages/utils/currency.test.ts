import test from 'node:test';
import assert from 'node:assert/strict';

import {
  resolveRate,
  cacheIsFresh,
  recordMoney,
  convert,
  formatMoney,
  normaliseCurrency,
  isSupportedCurrency,
  RATE_TTL_MS,
  type CacheEntry
} from './currency.ts';

const now = Date.parse('2026-11-03T12:00:00Z');
const live = (ago = 0): CacheEntry => ({
  rates: { NGN: 1512.44, GBP: 0.78 },
  fetchedAt: new Date(now - ago).toISOString(),
  source: 'live'
});

// ─── The cache ───────────────────────────────────────────────────────────────

test('a fallback is never treated as fresh', () => {
  // This was the bug. The old code wrote the fallback table into the cache
  // with a current timestamp, so 1600 was served for a day as if real.
  const cached: CacheEntry = {
    rates: { NGN: 1600 }, fetchedAt: new Date(now).toISOString(), source: 'fallback'
  };
  assert.equal(cacheIsFresh(cached, now), false);
});

test('a recent provider response is fresh, an old one is not', () => {
  assert.equal(cacheIsFresh(live(60_000), now), true);
  assert.equal(cacheIsFresh(live(RATE_TTL_MS + 1000), now), false);
  assert.equal(cacheIsFresh(undefined, now), false);
});

// ─── Resolving ───────────────────────────────────────────────────────────────

test('a real rate is not flagged as an estimate', () => {
  const rate = resolveRate('USD', 'NGN', live(60_000), now);
  assert.equal(rate.rate, 1512.44);
  assert.equal(rate.isEstimate, false);
  assert.equal(rate.source, 'cached');
  assert.equal(rate.warning, null);
});

test('the fallback says it is a guess and names the number', () => {
  const rate = resolveRate('USD', 'NGN', undefined, now);
  assert.equal(rate.rate, 1600);
  assert.equal(rate.isEstimate, true);
  assert.equal(rate.source, 'fallback');
  assert.match(rate.warning || '', /stored estimate of 1600/);
  assert.match(rate.warning || '', /Do not use it to settle a payment/);
});

test('a stale provider rate is served but says how old it is', () => {
  const rate = resolveRate('USD', 'NGN', live(RATE_TTL_MS + 1000), now);
  assert.equal(rate.rate, 1512.44);
  assert.equal(rate.isEstimate, false, 'it is a real rate, just old');
  assert.match(rate.warning || '', /more than twelve hours old/);
});

test('the fetchedAt is the provider time, not the moment we answered', () => {
  // Returning "now" is how a six-hour-old rate looked brand new.
  const entry = live(6 * 60 * 60 * 1000);
  assert.equal(resolveRate('USD', 'NGN', entry, now).fetchedAt, entry.fetchedAt);
});

test('the same currency needs no rate at all', () => {
  const rate = resolveRate('USD', 'USD', undefined, now);
  assert.equal(rate.rate, 1);
  assert.equal(rate.source, 'same_currency');
  assert.equal(rate.isEstimate, false);
});

test('an unknown currency is left unconverted and says so', () => {
  const rate = resolveRate('USD', 'XYZ', undefined, now);
  assert.equal(rate.rate, 1);
  assert.equal(rate.isEstimate, true);
  assert.match(rate.warning || '', /No rate is available for XYZ/);
});

test('currency codes are normalised', () => {
  assert.equal(normaliseCurrency(' ngn '), 'NGN');
  assert.equal(normaliseCurrency(null), 'USD');
  assert.equal(isSupportedCurrency('ngn'), true);
  assert.equal(isSupportedCurrency('XYZ'), false);
});

// ─── Storing money ───────────────────────────────────────────────────────────

test('a money record pins the rate it was written at', () => {
  const rate = resolveRate('USD', 'NGN', live(), now);
  const record = recordMoney(1_512_440, 'NGN', rate);

  assert.equal(record.amount, 1512440);
  assert.equal(record.currency, 'NGN');
  assert.equal(record.amountUsd, 1000);
  assert.equal(record.usdRate, 1512.44);
  assert.equal(record.rateSource, 'cached');
});

test('a later rate change does not move an already recorded amount', () => {
  // The whole point. A March payout queried in June showed June's rate
  // against March's money, so nothing ever reconciled.
  const march = recordMoney(1_512_440, 'NGN', resolveRate('USD', 'NGN', live(), now));
  const juneRate = resolveRate('USD', 'NGN', {
    rates: { NGN: 1750 }, fetchedAt: new Date(now).toISOString(), source: 'live'
  }, now);

  assert.equal(march.amountUsd, 1000, 'the stored figure is unchanged');
  assert.notEqual(juneRate.rate, march.usdRate);
});

test('a USD amount is stored without conversion', () => {
  const record = recordMoney(2500, 'USD', resolveRate('USD', 'NGN', undefined, now));
  assert.equal(record.amountUsd, 2500);
  assert.equal(record.usdRate, 1);
  assert.equal(record.rateSource, 'same_currency', 'a USD figure is not an estimate');
});

test('an estimated rate is carried onto the record', () => {
  const record = recordMoney(1_600_000, 'NGN', resolveRate('USD', 'NGN', undefined, now));
  assert.equal(record.rateSource, 'fallback');
  assert.equal(record.amountUsd, 1000);
});

test('money is held to whole cents', () => {
  const record = recordMoney(1000.005, 'USD', resolveRate('USD', 'USD', undefined, now));
  assert.equal(record.amount, 1000.01);
});

// ─── Display ─────────────────────────────────────────────────────────────────

test('an estimated figure is labelled', () => {
  assert.match(formatMoney(1600, 'NGN', { estimate: true }), /estimated/);
  assert.doesNotMatch(formatMoney(1000, 'USD'), /estimated/);
});

test('an unknown currency code still formats rather than throwing', () => {
  // Intl separates the code from the number with a non-breaking space, so
  // the assertion cannot look for a plain one.
  assert.match(formatMoney(100, 'XYZ'), /XYZ\s100\.00/);
});

test('convert is for display and does not round-trip through storage', () => {
  const rate = resolveRate('USD', 'NGN', live(), now);
  assert.equal(convert(1000, rate), 1512440);
});
