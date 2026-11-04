/**
 * Run with:  pnpm test
 *
 * events.ts imports nothing, so this runs under node --test directly.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ALL_NOTIFICATION_EVENTS,
  buildNotification
} from './events.ts';

test('all fifteen journey notifications have a template', () => {
  // The count is the point: the audit found zero of fifteen being sent.
  assert.equal(ALL_NOTIFICATION_EVENTS.length, 15);
  for (const event of ALL_NOTIFICATION_EVENTS) {
    const content = buildNotification(event, { recipientName: 'Ada' });
    assert.ok(content.subject.length > 0, `${event} has no subject`);
    assert.ok(content.body.length > 0, `${event} has no body`);
    assert.ok(content.inApp.length > 0, `${event} has no in-app line`);
    assert.ok(content.module.length > 0, `${event} has no module`);
  }
});

test('every template works with no context at all', () => {
  // A missing field must degrade, not throw. A notification nobody can word
  // perfectly still beats silence, which is what the product did before.
  for (const event of ALL_NOTIFICATION_EVENTS) {
    const content = buildNotification(event);
    assert.ok(content.body.includes('Hi there,'), `${event} lost its greeting`);
    assert.ok(!content.body.includes('undefined'), `${event} leaked "undefined"`);
    assert.ok(!content.subject.includes('undefined'), `${event} subject leaked "undefined"`);
    assert.ok(!content.inApp.includes('undefined'), `${event} in-app line leaked "undefined"`);
  }
});

test('the three account emails never become in-app rows', () => {
  // Nobody can read an in-app "verify your email" notice before they have
  // verified their email, and a password reset in the panel is a leak.
  for (const event of ['email_verification', 'password_reset', 'team_invitation'] as const) {
    assert.equal(buildNotification(event).alsoInApp, false, `${event} should not be in-app`);
  }
});

test('every journey event after sign-up does produce an in-app row', () => {
  const transactional = new Set(['email_verification', 'password_reset', 'team_invitation']);
  for (const event of ALL_NOTIFICATION_EVENTS) {
    if (transactional.has(event)) continue;
    assert.equal(buildNotification(event).alsoInApp, true, `${event} should be in-app`);
  }
});

test('an action url is included when given and omitted when not', () => {
  const withUrl = buildNotification('candidates_ready', { actionUrl: 'https://app.kongila.co/requests/1' });
  assert.ok(withUrl.body.includes('https://app.kongila.co/requests/1'));

  const withoutUrl = buildNotification('candidates_ready');
  assert.ok(!withoutUrl.body.includes('http'));
});

test('the rejection email does not pretend to be good news', () => {
  const content = buildNotification('application_rejected', { recipientName: 'Ada' });
  assert.ok(!/congratulations|good news|excited/i.test(content.body));
  assert.ok(content.body.includes('not taking it further'));
});

test('an interview with no confirmed time says so rather than showing nothing', () => {
  const content = buildNotification('interview_scheduled');
  assert.ok(content.body.includes('A time has not been confirmed yet.'));
});

test('joining details fall back to an honest line', () => {
  // There is no real Meet integration, so the absence has to read as an
  // absence rather than a broken link.
  const content = buildNotification('interview_scheduled', { when: 'Thu 12 Nov, 3:00 pm WAT' });
  assert.ok(content.body.includes('Joining details will follow'));

  const withLink = buildNotification('interview_scheduled', {
    when: 'Thu 12 Nov, 3:00 pm WAT',
    joiningDetails: 'Joining link: https://meet.example.com/abc'
  });
  assert.ok(withLink.body.includes('https://meet.example.com/abc'));
});

test('events are grouped under a module a panel can filter by', () => {
  assert.equal(buildNotification('offer_extended').module, 'offers');
  assert.equal(buildNotification('interview_reminder').module, 'interviews');
  assert.equal(buildNotification('stage_advanced').module, 'vetting');
  assert.equal(buildNotification('password_reset').module, 'account');
});
