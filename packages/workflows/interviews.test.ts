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
  isPastInterviewStatus,
  interviewParty,
  hasClientCounterparty,
  normalizeInterviewStage,
  interviewTransition,
  interviewStageToDb,
  describeInterviewStage,
  interviewTrailPosition,
  isConfirmedInterview,
  isOpenInterview
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

// ─── The stage an interview is at ────────────────────────────────────────────


test('a client request reaches the candidate only after operations sends it', () => {
  const requested = interviewTransition(null, 'client_requests');
  assert.equal(requested, 'client_requested');

  // The candidate cannot answer something that has not been put to them.
  assert.equal(interviewTransition(requested, 'talent_accepts'), null);

  assert.equal(interviewTransition(requested, 'admin_opens'), 'admin_reviewing');
  assert.equal(interviewTransition('admin_reviewing', 'admin_sends_to_talent'), 'sent_to_talent');
  assert.equal(interviewTransition('sent_to_talent', 'talent_accepts'), 'confirmed');
});

test('a candidate countering sends the new time to the client, not to nobody', () => {
  assert.equal(interviewTransition('sent_to_talent', 'talent_counters'), 'talent_countered');
  assert.equal(describeInterviewStage('talent_countered').waitingOn, 'client');

  // The client accepting it is the agreement, so it is on.
  assert.equal(interviewTransition('talent_countered', 'client_accepts_counter'), 'confirmed');
  // Turning it down puts it back with operations to find a third time.
  assert.equal(interviewTransition('talent_countered', 'client_declines_counter'), 'admin_reviewing');
});

test('moving a confirmed interview sends it back to the candidate to agree again', () => {
  assert.equal(interviewTransition('confirmed', 'admin_approves_reschedule'), 'sent_to_talent');
  assert.equal(interviewTransition('confirmed', 'admin_rejects_reschedule'), 'confirmed');
});

test('an interview that is over or off cannot be moved on', () => {
  for (const dead of ['cancelled', 'talent_declined', 'admin_declined', 'expired', 'completed']) {
    assert.equal(interviewTransition(dead, 'admin_sends_to_talent'), null, dead);
    assert.equal(interviewTransition(dead, 'talent_accepts'), null, dead);
    assert.equal(interviewTransition(dead, 'cancel'), null, dead);
  }
});

test('statuses written before the flow existed still read as a stage', () => {
  // These are real interviews sitting in diaries. They have to keep working.
  assert.equal(normalizeInterviewStage('Proposed'), 'sent_to_talent');
  assert.equal(normalizeInterviewStage('pending_confirmation'), 'sent_to_talent');
  assert.equal(normalizeInterviewStage('Scheduled'), 'confirmed');
  assert.equal(normalizeInterviewStage('Rescheduled'), 'confirmed');
  assert.equal(normalizeInterviewStage('talent_accepted'), 'confirmed');
  assert.equal(normalizeInterviewStage('Reschedule Requested'), 'talent_countered');
  assert.equal(normalizeInterviewStage('Cancelled'), 'cancelled');

  // And a legacy Proposed row can still be accepted by the candidate.
  assert.equal(interviewTransition('Proposed', 'talent_accepts'), 'confirmed');
});

test('only a confirmed interview counts as scheduled', () => {
  assert.equal(isConfirmedInterview('confirmed'), true);
  assert.equal(isConfirmedInterview('Scheduled'), true);
  assert.equal(isConfirmedInterview('sent_to_talent'), false);
  assert.equal(isConfirmedInterview('talent_countered'), false);

  assert.equal(isOpenInterview('client_requested'), true);
  assert.equal(isOpenInterview('talent_countered'), true);
  assert.equal(isOpenInterview('confirmed'), false);
  assert.equal(isOpenInterview('cancelled'), false);
});

test('the progress trail never reads as going backwards', () => {
  assert.equal(interviewTrailPosition('client_requested'), 0);
  assert.equal(
    interviewTrailPosition('talent_countered'),
    interviewTrailPosition('sent_to_talent'),
    'a counter is still the candidate answering, not a step lost'
  );
  assert.equal(interviewTrailPosition('completed'), 3);
});

test('Completed is stored with the capital the check constraint expects', () => {
  assert.equal(interviewStageToDb('completed'), 'Completed');
  assert.equal(interviewStageToDb('sent_to_talent'), 'sent_to_talent');
});


test('operations cannot answer a time the client has not seen', () => {
  // The time on the table came from the candidate and is sitting with the
  // client. Operations approving or refusing it is deciding on the client's
  // behalf about the client's own interview.
  assert.equal(interviewTransition('talent_countered', 'admin_approves_reschedule'), null);
  assert.equal(interviewTransition('talent_countered', 'admin_rejects_reschedule'), null);

  // Cancelling is still open to them, for a client who never answers.
  assert.equal(interviewTransition('talent_countered', 'cancel'), 'cancelled');

  // A client's own reschedule is different: they already know about it, so
  // operations decides and the candidate is asked to agree the new time.
  assert.equal(interviewTransition('confirmed', 'admin_approves_reschedule'), 'sent_to_talent');
});

test('a joining link is derived from the interview id, not invented each time', async () => {
  // The link is generated server-side in @kongila/database, which cannot be
  // loaded here, so this guards the shape the UI and the .ics depend on:
  // stable for a given interview, and a valid https URL.
  const room = (id: string) =>
    `https://meet.jit.si/${`kongila-${id.replace(/[^a-zA-Z0-9]/g, '').toLowerCase()}`.slice(0, 60)}`;

  assert.equal(room('iv_123_abc'), room('iv_123_abc'), 'the same interview must resolve to the same room');
  assert.notEqual(room('iv_123_abc'), room('iv_999_xyz'));
  assert.doesNotThrow(() => new URL(room('iv_123_abc')));
  assert.ok(!room('iv_Ada_Nwosu_Backend').includes('Ada'), 'the room name leaks who is meeting');
});

test('a vetting interview is not mistaken for one a client owns', () => {
  // interviews.client_id is NOT NULL, so a behavioural interview names the
  // operator who scheduled it. Everything that asked "does this have a
  // client?" therefore said yes about an interview with no client in it.
  const vetting = { id: 'iv1', clientId: 'operator-1', clientName: 'Kongila Vetting Panel' };
  const clientInterview = { id: 'iv2', clientId: 'client-1', requestId: 'row-1', matchId: 'match-1' };

  assert.equal(interviewParty(vetting), 'vetting');
  assert.equal(interviewParty(clientInterview), 'client');
  assert.equal(hasClientCounterparty(vetting), false);
  assert.equal(hasClientCounterparty(clientInterview), true);

  // snake_case rows read the same, because the service works on raw rows.
  assert.equal(interviewParty({ request_id: 'row-1', client_id: 'c' }), 'client');
  assert.equal(interviewParty({ client_id: 'operator-1' }), 'vetting');
});

test('a candidate moving a vetting interview is not said to be waiting on a client', () => {
  const asClient = describeInterviewStage('talent_countered', 'client');
  const asVetting = describeInterviewStage('talent_countered', 'vetting');

  assert.equal(asClient.waitingOn, 'client');
  assert.equal(asVetting.waitingOn, 'admin');
  assert.ok(!/client/i.test(asVetting.detail), 'a vetting interview has no client to wait on');

  // The default stays the client reading, so existing callers are unchanged.
  assert.deepEqual(describeInterviewStage('talent_countered'), asClient);
});
