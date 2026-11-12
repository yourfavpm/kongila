/**
 * Run with:  pnpm test
 *
 * interviews.ts imports nothing, so this runs under node --test directly.


 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  findSchedulingConflicts,
  describeConflict,
  resolveInterview,
  interviewForMatch,
  mapInterviewStatusToDb,
  mapInterviewStatusFromDb,
  isLiveInterview,
  isUpcomingInterviewStatus,
  isPastInterviewStatus
} from './interviews.ts';

const at = (iso: string, over: any = {}) => ({
  id: over.id || `iv_${iso}`,
  scheduledTime: iso,
  status: 'Scheduled',
  ...over
});

test('an overlapping interview for the same candidate is a conflict', () => {
  // There was no double-booking check of any kind. The same candidate could
  // be booked by two clients at the same moment and nothing noticed until
  // somebody failed to turn up.
  const existing = [at('2026-11-10T15:00:00.000Z', { talentId: 't1', talentName: 'Ada' })];
  const conflicts = findSchedulingConflicts(
    { startsAt: '2026-11-10T15:30:00.000Z', talentId: 't1' },
    existing
  );
  assert.equal(conflicts.length, 1);
  assert.equal(conflicts[0].party, 'talent');
  assert.match(describeConflict(conflicts) || '', /Ada already has an interview/);
});

test('back to back interviews do not conflict', () => {
  const existing = [at('2026-11-10T15:00:00.000Z', { talentId: 't1' })];
  const conflicts = findSchedulingConflicts(
    { startsAt: '2026-11-10T16:00:00.000Z', talentId: 't1' },
    existing
  );
  assert.deepEqual(conflicts, []);
  assert.equal(describeConflict(conflicts), null);
});

test('a cancelled interview does not block the slot', () => {
  const existing = [at('2026-11-10T15:00:00.000Z', { talentId: 't1', status: 'Cancelled' })];
  assert.deepEqual(
    findSchedulingConflicts({ startsAt: '2026-11-10T15:00:00.000Z', talentId: 't1' }, existing),
    []
  );
});

test('an interview being moved does not conflict with itself', () => {
  const existing = [at('2026-11-10T15:00:00.000Z', { id: 'iv1', talentId: 't1' })];
  assert.deepEqual(
    findSchedulingConflicts(
      { startsAt: '2026-11-10T15:15:00.000Z', talentId: 't1', excludeInterviewId: 'iv1' },
      existing
    ),
    []
  );
});

test('the client’s own diary is checked too', () => {
  const existing = [at('2026-11-10T15:00:00.000Z', { clientId: 'c1', clientName: 'Horizon' })];
  const conflicts = findSchedulingConflicts(
    { startsAt: '2026-11-10T15:00:00.000Z', clientId: 'c1' },
    existing
  );
  assert.equal(conflicts.length, 1);
  assert.equal(conflicts[0].party, 'client');
});

test('a different candidate at the same time is fine', () => {
  const existing = [at('2026-11-10T15:00:00.000Z', { talentId: 't1' })];
  assert.deepEqual(
    findSchedulingConflicts({ startsAt: '2026-11-10T15:00:00.000Z', talentId: 't2' }, existing),
    []
  );
});

test('a stage record resolves to the real interview row, not its copy', () => {
  // The whole point. The stage used to carry its own copy of the date and
  // time, and rescheduling moved one and left the other.
  const rows = [at('2026-11-10T20:00:00.000Z', { id: 'iv1', title: 'Real' })];
  const stage = { interviewId: 'iv1', interviewDate: '2026-11-10', interviewTime: '09:00' };
  const resolved = resolveInterview(stage, rows);
  assert.equal(resolved.title, 'Real');
  assert.equal(resolved.scheduledTime, '2026-11-10T20:00:00.000Z');
  assert.ok(!resolved.fromLegacyCopy);
});

test('a stage with no matching row falls back, and says that it did', () => {
  const stage = { interviewId: 'gone', interviewDate: '2026-11-10', interviewTime: '09:00' };
  const resolved = resolveInterview(stage, []);
  assert.equal(resolved.fromLegacyCopy, true);
  assert.equal(resolved.date, '2026-11-10');
});

test('a stage with nothing at all resolves to null', () => {
  assert.equal(resolveInterview({ interviewId: 'gone' }, []), null);
  assert.equal(resolveInterview(null, []), null);
});

test('a match resolves to its interview row ahead of requestedDate', () => {
  const rows = [at('2026-11-10T20:00:00.000Z', { id: 'iv1', matchId: 'm1', title: 'Real' })];
  const match = { id: 'm1', requestedDate: '2026-11-11', requestedTime: '08:00' };
  assert.equal(interviewForMatch(match, rows).title, 'Real');
});

test('a match with no row falls back to its own copy', () => {
  const match = { id: 'm1', talentId: 't1', requestId: 'r1', requestedDate: '2026-11-11', requestedTime: '08:00' };
  const resolved = interviewForMatch(match, []);
  assert.equal(resolved.fromLegacyCopy, true);
  assert.equal(resolved.date, '2026-11-11');
});

test('Rescheduled survives a save', () => {
  // It used to be collapsed to 'scheduled' on write, and the reader only
  // restored 'Scheduled', so the status reverted on every save and the
  // admin's Rescheduled counter read zero after any reload.
  assert.equal(mapInterviewStatusToDb('Rescheduled'), 'Rescheduled');
  assert.equal(mapInterviewStatusFromDb({ status: 'Rescheduled' }), 'Rescheduled');
});

test('Reschedule Requested is a flag, not a status', () => {
  assert.equal(mapInterviewStatusToDb('Reschedule Requested'), 'Scheduled');
  assert.equal(
    mapInterviewStatusFromDb({ status: 'Scheduled', reschedule_requested: true }),
    'Reschedule Requested'
  );
});

test('lowercase scheduled reads back as Scheduled', () => {
  assert.equal(mapInterviewStatusFromDb({ status: 'scheduled' }), 'Scheduled');
});

test('all active interview lifecycle statuses appear in upcoming', () => {
  for (const status of [
    'Proposed',
    'client_requested',
    'admin_reviewing',
    'sent_to_talent',
    'pending_confirmation',
    'talent_accepted',
    'talent_countered',
    'confirmed',
    'Interview Scheduled',
    'Scheduled',
    'Rescheduled'
  ]) {
    assert.equal(isUpcomingInterviewStatus(status), true, status);
  }
  assert.equal(isUpcomingInterviewStatus('Reschedule Requested'), false);
});

test('closed interview lifecycle statuses appear in past', () => {
  for (const status of [
    'Completed',
    'Cancelled',
    'failed',
    'passed',
    'talent_declined',
    'admin_declined',
    'expired'
  ]) {
    assert.equal(isPastInterviewStatus(status), true, status);
  }
  assert.equal(isPastInterviewStatus('Scheduled'), false);
});

test('an unknown status does not break the write', () => {
  assert.equal(mapInterviewStatusToDb('Something New'), 'Scheduled');
});

test('dead statuses are not live', () => {
  assert.equal(isLiveInterview({ status: 'Cancelled' }), false);
  assert.equal(isLiveInterview({ status: 'talent_declined' }), false);
  assert.equal(isLiveInterview({ status: 'Scheduled' }), true);
});
