import test from 'node:test';
import assert from 'node:assert/strict';

import {
  clientMatchTransition,
  allCandidatesRejected,
  normaliseMatchStatus,
  MATCH_STATUSES
} from './matchStatus.ts';

// ─── The hole this closes ────────────────────────────────────────────────────

test('every allowed status is one matches_status_check permits', () => {
  // The browser wrote 'interview_scheduled' and 'rejected_by_client'.
  // Postgres rejected both and the failure went to console.error, so the
  // client saw a shortlist that had not happened.
  assert.deepEqual([...MATCH_STATUSES], ['proposed', 'shortlisted', 'rejected', 'accepted']);
  assert.equal(normaliseMatchStatus('interview_scheduled'), null);
  assert.equal(normaliseMatchStatus('rejected_by_client'), null);
});

test('a status the database would refuse is refused here instead', () => {
  const result = clientMatchTransition('proposed', 'interview_scheduled');
  assert.equal(result.ok, false);
  assert.match(result.error!, /not a match status/);
});

// ─── Transitions ─────────────────────────────────────────────────────────────

test('a client shortlists or rejects a proposed candidate', () => {
  assert.equal(clientMatchTransition('proposed', 'shortlisted').ok, true);
  assert.equal(clientMatchTransition('proposed', 'rejected', 'Not enough Django').ok, true);
});

test('a client cannot accept straight from proposed', () => {
  const result = clientMatchTransition('proposed', 'accepted');
  assert.equal(result.ok, false);
  assert.match(result.error!, /cannot be moved/);
});

test('a shortlisted candidate can be accepted', () => {
  assert.equal(clientMatchTransition('shortlisted', 'accepted').ok, true);
});

test('a decided match cannot be moved again', () => {
  const reopened = clientMatchTransition('rejected', 'shortlisted');
  assert.equal(reopened.ok, false);
  assert.match(reopened.error!, /already rejected/);
  assert.equal(clientMatchTransition('accepted', 'rejected', 'changed my mind').ok, false);
});

test('setting the status it already has is not an error', () => {
  const result = clientMatchTransition('shortlisted', 'shortlisted');
  assert.equal(result.ok, true);
  assert.equal(result.status, 'shortlisted');
});

test('a missing current status is treated as proposed', () => {
  assert.equal(clientMatchTransition(null, 'shortlisted').ok, true);
});

test('case and padding do not matter', () => {
  assert.equal(clientMatchTransition(' Proposed ', 'SHORTLISTED').ok, true);
});

// ─── Rejection reasons ───────────────────────────────────────────────────────

test('a rejection without a reason is refused', () => {
  const blank = clientMatchTransition('proposed', 'rejected', '   ');
  assert.equal(blank.ok, false);
  assert.match(blank.error!, /why/);
  assert.equal(clientMatchTransition('proposed', 'rejected').ok, false);
});

test('a reason is not required to shortlist', () => {
  assert.equal(clientMatchTransition('proposed', 'shortlisted').ok, true);
});

// ─── Telling operations the brief has run out ────────────────────────────────

test('the last rejection on a request is recognised', () => {
  const matches = [
    { id: 'm1', requestId: 'r1', status: 'rejected' },
    { id: 'm2', requestId: 'r1', status: 'proposed' },
    { id: 'm3', requestId: 'r2', status: 'proposed' }
  ];
  assert.equal(allCandidatesRejected(matches, 'r1', 'm2'), true);
});

test('a request with a candidate still standing is not exhausted', () => {
  const matches = [
    { id: 'm1', requestId: 'r1', status: 'shortlisted' },
    { id: 'm2', requestId: 'r1', status: 'proposed' }
  ];
  assert.equal(allCandidatesRejected(matches, 'r1', 'm2'), false);
});

test('a request with no candidates is not exhausted', () => {
  assert.equal(allCandidatesRejected([], 'r1', 'm1'), false);
});
