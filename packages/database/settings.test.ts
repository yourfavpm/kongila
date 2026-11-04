/**
 * Only validateSetting and SETTING_DEFAULTS are covered here: they are the
 * pure parts. The rest of settingsService talks to the database.
 *
 * Imported from the file directly rather than through the package index, so
 * node --test does not have to resolve the whole dependency graph.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { validateSetting, SETTING_DEFAULTS } from './settingsRules.ts';

test('a fee rate entered as a percentage is rejected', () => {
  // 25 instead of 0.25 would multiply every revenue figure by a hundred and
  // would not announce itself anywhere.
  assert.match(validateSetting('platform_fee_rate', 25) || '', /fraction between 0 and 1/);
  assert.equal(validateSetting('platform_fee_rate', 0.25), null);
  assert.equal(validateSetting('platform_fee_rate', 0), null);
  assert.ok(validateSetting('platform_fee_rate', -0.1));
  assert.ok(validateSetting('platform_fee_rate', 'a quarter'));
});

test('the fee rate has no default, so revenue stays unavailable until set', () => {
  // Inventing a margin is what produced the fictional revenue figure.
  assert.equal(SETTING_DEFAULTS.platform_fee_rate, null);
});

test('grade thresholds must descend', () => {
  assert.equal(validateSetting('vetting_grade_thresholds', { 'A+': 85, A: 75, B: 65 }), null);
  assert.match(
    validateSetting('vetting_grade_thresholds', { 'A+': 70, A: 80, B: 65 }) || '',
    /descend/
  );
});

test('a grade threshold above 100 makes that grade unreachable', () => {
  assert.ok(validateSetting('vetting_grade_thresholds', { 'A+': 120, A: 75, B: 65 }));
});

test('the payout day stays inside every month', () => {
  // 29, 30 and 31 skip months, which is how a payroll run quietly misses February.
  assert.equal(validateSetting('payout_day_of_month', 25), null);
  assert.ok(validateSetting('payout_day_of_month', 31));
  assert.ok(validateSetting('payout_day_of_month', 0));
});

test('reminder hours must be a list of positive numbers', () => {
  assert.equal(validateSetting('reminder_hours_before', [24, 1]), null);
  assert.ok(validateSetting('reminder_hours_before', 24));
  assert.ok(validateSetting('reminder_hours_before', [24, -1]));
});

test('currency is a three-letter code', () => {
  assert.equal(validateSetting('default_currency', 'USD'), null);
  assert.ok(validateSetting('default_currency', 'dollars'));
  assert.ok(validateSetting('default_currency', 'usd'));
});

test('interview limits stay sane', () => {
  assert.equal(validateSetting('max_interviews_per_candidate', 3), null);
  assert.ok(validateSetting('max_interviews_per_candidate', 0));
  assert.equal(validateSetting('interview_default_duration_minutes', 60), null);
  assert.ok(validateSetting('interview_default_duration_minutes', 5));
});

test('an unknown key is not blocked by validation', () => {
  // The table is meant to take a new toggle without a migration, so an
  // unrecognised key passes rather than being refused.
  assert.equal(validateSetting('something_new', 'anything'), null);
});

test('the defaults match what the code used to hardcode', () => {
  assert.equal(SETTING_DEFAULTS.max_interviews_per_candidate, 3);
  assert.equal(SETTING_DEFAULTS.interview_late_change_hours, 4);
  assert.deepEqual(SETTING_DEFAULTS.reminder_hours_before, [24, 1]);
  assert.deepEqual(SETTING_DEFAULTS.vetting_grade_thresholds, { 'A+': 85, A: 75, B: 65 });
});
