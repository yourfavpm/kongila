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

test('all journey notifications have a template', () => {
  assert.ok(ALL_NOTIFICATION_EVENTS.length > 0);
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

test('transactional account emails never become in-app rows', () => {
  // Nobody can read an in-app "verify your email" notice before they have
  // verified their email, and a password reset in the panel is a leak.
  for (const event of [
    'email_verification', 'password_reset', 'team_invitation', 'operator_account_suspended'
  ] as const) {
    assert.equal(buildNotification(event).alsoInApp, false, `${event} should not be in-app`);
  }
});

test('every journey event after sign-up does produce an in-app row', () => {
  const transactional = new Set([
    'email_verification', 'password_reset', 'team_invitation', 'operator_account_suspended'
  ]);
  for (const event of ALL_NOTIFICATION_EVENTS) {
    if (transactional.has(event)) continue;
    assert.equal(buildNotification(event).alsoInApp, true, `${event} should be in-app`);
  }
});

test('operator invitation and access-change emails explain their action', () => {
  const invite = buildNotification('team_invitation', {
    inviterName: 'Ada',
    roleTitle: 'Operations Manager',
    actionUrl: 'https://admin.example.com/set-password'
  });
  assert.match(invite.subject, /Kongila/);
  assert.match(invite.body, /set your password/);
  assert.match(invite.body, /single use and expires/);
  assert.match(invite.body, /https:\/\/admin\.example\.com\/set-password/);

  const roleChange = buildNotification('operator_role_changed', {
    previousRole: 'Talent Manager',
    newRole: 'Operations Manager'
  });
  assert.match(roleChange.body, /Talent Manager to Operations Manager/);

  const suspended = buildNotification('operator_account_suspended_notice', {
    suspendedEmail: 'operator@example.com'
  });
  assert.match(suspended.body, /operator@example\.com/);
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

test('request message notifications identify the role and include message context', () => {
  const clientNotice = buildNotification('request_message_from_admin', {
    roleTitle: 'Product Manager',
    reason: 'Can we confirm the start date?'
  });
  assert.equal(clientNotice.module, 'requests');
  assert.equal(clientNotice.alsoInApp, true);
  assert.match(clientNotice.subject, /Product Manager/);
  assert.match(clientNotice.body, /Can we confirm the start date\?/);

  const managerNotice = buildNotification('request_message_from_client', {
    roleTitle: 'Product Manager',
    reason: 'We would like to adjust the budget.'
  });
  assert.equal(managerNotice.module, 'requests');
  assert.equal(managerNotice.alsoInApp, true);
  assert.match(managerNotice.subject, /client/i);
  assert.match(managerNotice.body, /adjust the budget/);
});

// ─── The events added from the FRDs ─────────────────────────────────────────

test('a stage notification says what the stage was, not just "a stage"', () => {
  // stage_advanced was carrying assessment assignment, deadlines and marks,
  // so all three read the same and none said what to do.
  const assigned = buildNotification('assessment_assigned', {
    recipientName: 'Ada',
    stageName: 'Backend Engineering Assessment',
    deadline: '2026-11-20'
  });
  assert.match(assigned.subject, /due 2026-11-20/);
  assert.match(assigned.body, /Backend Engineering Assessment/);

  const marked = buildNotification('assessment_marked', {
    stageName: 'Backend Engineering Assessment',
    score: '72%',
    passMark: '70%'
  });
  assert.match(marked.subject, /72%/);
  assert.match(marked.body, /against a pass mark of 70%/);
});

test('a result carries the reviewer feedback when there is some', () => {
  const withNotes = buildNotification('work_simulation_marked', {
    score: '18 of 25',
    feedback: 'Clean approach, thin on error handling.'
  });
  assert.match(withNotes.body, /Clean approach, thin on error handling\./);

  // And reads properly when there is none.
  const without = buildNotification('work_simulation_marked', { score: '18 of 25' });
  assert.ok(!without.body.includes('From the reviewer'));
});

test('vetting_complete only states a grade when one was given', () => {
  // A grade with no finished assessment behind it is the bug this whole
  // area was built to stop.
  const graded = buildNotification('vetting_complete', { grade: 'A' });
  assert.match(graded.body, /classification is A/);

  const ungraded = buildNotification('vetting_complete', {});
  assert.ok(!ungraded.body.includes('classification is'));
  assert.ok(!ungraded.inApp.includes('—'));
});

test('an overdue invoice states the amount, date and how late it is', () => {
  const content = buildNotification('invoice_overdue', {
    reference: 'INV-204',
    amount: '$4,500',
    dueDate: '1 November 2026',
    daysOverdue: 9
  });
  assert.match(content.body, /INV-204/);
  assert.match(content.body, /\$4,500/);
  assert.match(content.body, /9 days ago/);
});

test('one day overdue is not "1 days"', () => {
  const content = buildNotification('invoice_overdue', { daysOverdue: 1 });
  assert.match(content.body, /1 day ago/);
  assert.ok(!content.body.includes('1 days'));
});

test('a failed payout does not imply the money is lost', () => {
  const content = buildNotification('payout_failed', { amount: '$1,200', reason: 'Account number rejected.' });
  assert.match(content.body, /Nothing has been lost/);
  assert.match(content.body, /Account number rejected\./);
});

test('internal operations notices name what breached and by how much', () => {
  const content = buildNotification('sla_breach', {
    breachedStage: 'Application Screening',
    talentName: 'Ada Lovelace',
    overdueBy: '2 days'
  });
  assert.match(content.subject, /Application Screening/);
  assert.match(content.body, /Ada Lovelace/);
  assert.match(content.body, /by 2 days/);
});

test('every new template renders an action button when given a URL', () => {
  const withButtons = [
    'assessment_assigned', 'assessment_marked', 'work_simulation_assigned',
    'work_simulation_marked', 'vetting_stage_result', 'vetting_complete',
    'submitted_to_client', 'talent_hired', 'invoice_issued', 'invoice_overdue',
    'payout_sent', 'payout_failed', 'contract_renewal_due', 'contract_terminated',
    'contract_voided', 'sla_breach', 'client_at_risk', 'sourcing_required'
  ] as const;

  for (const event of withButtons) {
    const content = buildNotification(event, { actionUrl: 'https://app.kongila.io/x' });
    assert.ok(
      content.body.includes('https://app.kongila.io/x'),
      `${event} dropped its action URL, so the email has no way in`
    );
  }
});

test('a template with no action URL does not print an empty link', () => {
  for (const event of ALL_NOTIFICATION_EVENTS) {
    const content = buildNotification(event, { recipientName: 'Ada' });
    assert.ok(!/: *$/m.test(content.body.trim()), `${event} left a dangling label`);
    assert.ok(!content.body.includes('undefined'), `${event} leaked "undefined"`);
    assert.ok(!content.subject.includes('undefined'), `${event} leaked "undefined" into the subject`);
  }
});
