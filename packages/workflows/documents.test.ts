import test from 'node:test';
import assert from 'node:assert/strict';

import {
  versionChain,
  currentVersion,
  nextVersionNumber,
  planSupersede,
  isVersionedType,
  expiryState,
  daysUntilExpiry,
  expiryNotices,
  expiredCertifications,
  EXPIRY_WARNING_DAYS
} from './documents.ts';

const now = new Date('2026-11-20T09:00:00Z');

const cv = (over: any = {}) => ({
  id: 'd1', userId: 't1', type: 'cv', name: 'CV', status: 'uploaded',
  versionNumber: 1, uploadedAt: '2026-01-01T00:00:00Z', ...over
});

const cert = (over: any = {}) => ({
  id: 'c1', userId: 't1', type: 'certification', name: 'AWS Solutions Architect',
  certificationName: 'AWS Solutions Architect', status: 'uploaded',
  expiryDate: '2027-06-01T00:00:00Z', ...over
});

// ─── Versions ────────────────────────────────────────────────────────────────

test('only CVs and portfolios are versioned', () => {
  assert.equal(isVersionedType('cv'), true);
  assert.equal(isVersionedType('portfolio'), true);
  assert.equal(isVersionedType('certification'), false);
  assert.equal(isVersionedType('NDA'), false);
});

test('the chain comes back newest first', () => {
  const docs = [
    cv({ id: 'a', versionNumber: 1 }),
    cv({ id: 'c', versionNumber: 3 }),
    cv({ id: 'b', versionNumber: 2 })
  ];
  assert.deepEqual(versionChain(docs, 't1', 'cv').map(d => d.id), ['c', 'b', 'a']);
});

test('two rows claiming the same version still sort stably', () => {
  // Two open tabs could both compute "version 2" in the browser, and
  // whichever the database returned first became the one everything used.
  const docs = [
    cv({ id: 'early', versionNumber: 2, uploadedAt: '2026-03-01T00:00:00Z' }),
    cv({ id: 'late', versionNumber: 2, uploadedAt: '2026-04-01T00:00:00Z' })
  ];
  assert.deepEqual(versionChain(docs, 't1', 'cv').map(d => d.id), ['late', 'early']);
});

test('another person\'s documents never enter the chain', () => {
  const docs = [cv({ id: 'mine' }), cv({ id: 'theirs', userId: 't2', versionNumber: 9 })];
  assert.deepEqual(versionChain(docs, 't1', 'cv').map(d => d.id), ['mine']);
});

test('a deleted version is out of the chain', () => {
  const docs = [cv({ id: 'a', versionNumber: 2, status: 'deleted' }), cv({ id: 'b' })];
  assert.deepEqual(versionChain(docs, 't1', 'cv').map(d => d.id), ['b']);
});

test('the current version is the newest by default', () => {
  const docs = [cv({ id: 'a', versionNumber: 1 }), cv({ id: 'b', versionNumber: 2 })];
  assert.equal(currentVersion(docs, 't1', 'cv')?.id, 'b');
});

test('an explicit current flag beats the highest number', () => {
  // Restoring an earlier version makes it current without renumbering it.
  const docs = [
    cv({ id: 'a', versionNumber: 1, isCurrent: true }),
    cv({ id: 'b', versionNumber: 2 })
  ];
  assert.equal(currentVersion(docs, 't1', 'cv')?.id, 'a');
});

test('with no documents there is no current version', () => {
  assert.equal(currentVersion([], 't1', 'cv'), null);
  assert.equal(nextVersionNumber([], 't1', 'cv'), 1);
});

test('a new upload supersedes every earlier version', () => {
  // Nothing used to mark the old ones superseded, so a candidate's list
  // showed four CVs with no sign of which one counted.
  const docs = [cv({ id: 'a', versionNumber: 1 }), cv({ id: 'b', versionNumber: 2 })];
  const plan = planSupersede(docs, 't1', 'cv', 'c');

  assert.equal(plan.newVersionNumber, 3);
  assert.deepEqual(plan.superseded.map(s => s.id).sort(), ['a', 'b']);
  assert.equal(plan.superseded[0].supersededById, 'c');
});

test('a version already superseded is not touched again', () => {
  const docs = [
    cv({ id: 'a', versionNumber: 1, supersededById: 'b' }),
    cv({ id: 'b', versionNumber: 2 })
  ];
  assert.deepEqual(planSupersede(docs, 't1', 'cv', 'c').superseded.map(s => s.id), ['b']);
});

// ─── Expiry ──────────────────────────────────────────────────────────────────

test('a certification expiring today is still valid today', () => {
  // Treating the expiry date as the first invalid day takes a day off
  // every certificate on the platform.
  assert.equal(expiryState('2026-11-20T00:00:00Z', now), 'expiring_soon');
  assert.equal(daysUntilExpiry('2026-11-20T00:00:00Z', now), 0);
});

test('yesterday is expired', () => {
  assert.equal(expiryState('2026-11-19T00:00:00Z', now), 'expired');
  assert.equal(daysUntilExpiry('2026-11-19T00:00:00Z', now), -1);
});

test('the warning window is thirty days', () => {
  assert.equal(EXPIRY_WARNING_DAYS, 30);
  assert.equal(expiryState('2026-12-19T00:00:00Z', now), 'expiring_soon');
  assert.equal(expiryState('2026-12-21T00:00:00Z', now), 'valid');
});

test('no expiry date is not an expired certificate', () => {
  assert.equal(expiryState(null, now), 'none');
  assert.equal(expiryState('', now), 'none');
  assert.equal(expiryState('nonsense', now), 'none');
});

// ─── Notices ─────────────────────────────────────────────────────────────────

test('a notice reads like something a person would send', () => {
  const [notice] = expiryNotices([cert({ expiryDate: '2026-11-21T00:00:00Z' })], now);
  assert.equal(notice.state, 'expiring_soon');
  assert.match(notice.message, /AWS Solutions Architect expires tomorrow/);
});

test('today and yesterday are named, not counted', () => {
  const today = expiryNotices([cert({ expiryDate: '2026-11-20T00:00:00Z' })], now)[0];
  assert.match(today.message, /expires today/);
  const yesterday = expiryNotices([cert({ expiryDate: '2026-11-19T00:00:00Z' })], now)[0];
  assert.match(yesterday.message, /expired yesterday/);
});

test('a valid certification generates nothing', () => {
  assert.deepEqual(expiryNotices([cert()], now), []);
});

test('a superseded certification is not warned about', () => {
  // Telling somebody a certificate they replaced last year is expiring is
  // noise, and noise is how a real warning gets ignored.
  assert.deepEqual(
    expiryNotices([cert({ expiryDate: '2026-11-01T00:00:00Z', supersededById: 'c2' })], now),
    []
  );
});

test('a deleted document is not warned about', () => {
  assert.deepEqual(
    expiryNotices([cert({ expiryDate: '2026-11-01T00:00:00Z', status: 'deleted' })], now),
    []
  );
});

test('notices lead with what has already lapsed', () => {
  const notices = expiryNotices([
    cert({ id: 'soon', expiryDate: '2026-12-10T00:00:00Z' }),
    cert({ id: 'lapsed', expiryDate: '2026-10-01T00:00:00Z' }),
    cert({ id: 'tomorrow', expiryDate: '2026-11-21T00:00:00Z' })
  ], now);
  assert.deepEqual(notices.map(n => n.documentId), ['lapsed', 'tomorrow', 'soon']);
});

test('expired certifications are listed per person', () => {
  const docs = [
    cert({ id: 'a', expiryDate: '2026-10-01T00:00:00Z' }),
    cert({ id: 'b', expiryDate: '2027-10-01T00:00:00Z' }),
    cert({ id: 'c', userId: 't2', expiryDate: '2026-10-01T00:00:00Z' })
  ];
  assert.deepEqual(expiredCertifications(docs, 't1', now).map(d => d.id), ['a']);
});
