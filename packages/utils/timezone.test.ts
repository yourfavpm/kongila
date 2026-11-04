/**
 * Run with:  pnpm test
 *
 * timezone.ts imports nothing, so this runs under node --test with no
 * framework. The cases below are the ones that were actually broken.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  wallClockToUtc,
  utcToWallClock,
  formatForBothParties,
  interviewInstant,
  generateSlots,
  isValidTimeZone
} from './timezone.ts';

test('a New York 3pm booking is 8pm UTC, not 3pm UTC', () => {
  // The bug in one line. 15:00 entered in New York was stored as "15:00"
  // and read as 15:00 everywhere else.
  const iso = wallClockToUtc('2026-11-10', '15:00', 'America/New_York');
  assert.equal(iso, '2026-11-10T20:00:00.000Z');
});

test('the Lagos candidate sees 9pm for that same call', () => {
  const iso = wallClockToUtc('2026-11-10', '15:00', 'America/New_York');
  const lagos = utcToWallClock(iso, 'Africa/Lagos');
  assert.deepEqual(lagos, { date: '2026-11-10', time: '21:00' });
});

test('round trip through a zone returns the same wall clock', () => {
  for (const zone of ['Africa/Lagos', 'America/New_York', 'Europe/London', 'Asia/Singapore']) {
    const iso = wallClockToUtc('2026-06-15', '09:30', zone);
    assert.deepEqual(utcToWallClock(iso, zone), { date: '2026-06-15', time: '09:30' },
      `round trip failed for ${zone}`);
  }
});

test('daylight saving is handled on both sides of the change', () => {
  // US clocks go back on 1 November 2026. 10:00 in New York is 14:00 UTC
  // before the change and 15:00 UTC after it.
  const before = wallClockToUtc('2026-10-30', '10:00', 'America/New_York');
  const after = wallClockToUtc('2026-11-03', '10:00', 'America/New_York');
  assert.equal(before, '2026-10-30T14:00:00.000Z');
  assert.equal(after, '2026-11-03T15:00:00.000Z');
});

test('Lagos has no daylight saving, so the offset never moves', () => {
  assert.equal(wallClockToUtc('2026-01-15', '08:00', 'Africa/Lagos'), '2026-01-15T07:00:00.000Z');
  assert.equal(wallClockToUtc('2026-07-15', '08:00', 'Africa/Lagos'), '2026-07-15T07:00:00.000Z');
});

test('both parties are shown their own time', () => {
  const iso = wallClockToUtc('2026-11-10', '15:00', 'America/New_York');
  const shown = formatForBothParties(iso, 'Africa/Lagos', 'America/New_York', "client's time");
  assert.match(shown.viewer, /9:00\s?pm/i);
  assert.ok(shown.other && /3:00\s?pm/i.test(shown.other));
  assert.ok(shown.other.includes("client's time"));
});

test('one zone for both parties shows one time, not a duplicate', () => {
  const iso = wallClockToUtc('2026-11-10', '15:00', 'Africa/Lagos');
  assert.equal(formatForBothParties(iso, 'Africa/Lagos', 'Africa/Lagos').other, null);
});

test('an interview row prefers scheduled_time over the legacy text', () => {
  // The wall-clock columns are display only. When the two disagree, the
  // timestamp wins, because it is the one that carries a zone.
  const row = {
    scheduled_time: '2026-11-10T20:00:00.000Z',
    date: '2026-11-10',
    time: '15:00',
    scheduled_timezone: 'America/New_York'
  };
  assert.equal(interviewInstant(row), '2026-11-10T20:00:00.000Z');
});

test('a legacy row with no timestamp falls back to its wall clock and zone', () => {
  assert.equal(
    interviewInstant({ date: '2026-11-10', time: '15:00', scheduled_timezone: 'America/New_York' }),
    '2026-11-10T20:00:00.000Z'
  );
});

test('a row with nothing usable returns null rather than a wrong time', () => {
  assert.equal(interviewInstant({}), null);
  assert.equal(interviewInstant(null), null);
  assert.equal(wallClockToUtc('not-a-date', '15:00', 'UTC'), null);
  assert.equal(wallClockToUtc('2026-11-10', '25:99:99', 'UTC'), null);
});

test('an unknown zone falls back to UTC instead of throwing', () => {
  assert.equal(isValidTimeZone('Mars/Olympus'), false);
  assert.equal(wallClockToUtc('2026-11-10', '15:00', 'Mars/Olympus'), '2026-11-10T15:00:00.000Z');
});

test('offered slots are in the future and on weekdays', () => {
  // The modal used to offer four slots hardcoded to 20-22 July 2026.
  const slots = generateSlots('Africa/Lagos');
  assert.ok(slots.length > 0);
  const now = Date.now();
  for (const slot of slots) {
    assert.ok(new Date(slot.iso).getTime() > now, `${slot.date} ${slot.time} is in the past`);
    const weekday = new Date(`${slot.date}T12:00:00Z`).getUTCDay();
    assert.ok(weekday !== 0 && weekday !== 6, `${slot.date} is a weekend`);
  }
});
