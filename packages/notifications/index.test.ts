/// <reference types="node" />

import test from 'node:test';
import assert from 'node:assert/strict';
import { emailConfigurationMissing, emailIsConfigured, renderBrandedEmail, sendEmail } from './index.ts';
import { ALL_NOTIFICATION_EVENTS, buildNotification } from './events.ts';

function restoreEnv(name: string, value: string | undefined) {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}

test('email configuration requires both Resend variables', () => {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM;
  try {
    delete process.env.RESEND_API_KEY;
    process.env.RESEND_FROM = 'Kongila <test@example.com>';
    assert.equal(emailIsConfigured(), false);
    process.env.RESEND_API_KEY = 'test-key';
    delete process.env.RESEND_FROM;
    assert.equal(emailIsConfigured(), false);
    process.env.RESEND_FROM = 'Kongila <test@example.com>';
    assert.equal(emailIsConfigured(), true);
    delete process.env.RESEND_FROM;
    assert.deepEqual(emailConfigurationMissing(), ['RESEND_FROM']);
    process.env.RESEND_API_KEY = 'test-key';
    process.env.RESEND_FROM = 'Kongila <test@example.com>';
    assert.deepEqual(emailConfigurationMissing(), []);
  } finally {
    restoreEnv('RESEND_API_KEY', key);
    restoreEnv('RESEND_FROM', from);
  }
});

test('sendEmail does not claim success or call Resend when configuration is missing', async () => {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM;
  const originalFetch = globalThis.fetch;
  try {
    delete process.env.RESEND_API_KEY;
    delete process.env.RESEND_FROM;
    globalThis.fetch = async () => { throw new Error('Resend must not be called'); };
    const result = await sendEmail({ to: 'recipient@example.com', subject: 'Test', body: 'Test message' });
    assert.equal(result.success, false);
    assert.equal(result.configured, false);
  } finally {
    globalThis.fetch = originalFetch;
    restoreEnv('RESEND_API_KEY', key);
    restoreEnv('RESEND_FROM', from);
  }
});

test('sendEmail posts the original plain text, redesigned HTML, destination and attachments', async () => {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  const support = process.env.EMAIL_SUPPORT_EMAIL;
  const originalFetch = globalThis.fetch;
  try {
    process.env.RESEND_API_KEY = 'test-resend-key';
    process.env.RESEND_FROM = 'Kongila <test@example.com>';
    process.env.NEXT_PUBLIC_SITE_URL = 'https://app.example.com';
    process.env.EMAIL_SUPPORT_EMAIL = 'support@example.com';
    let requestBody: any;
    globalThis.fetch = async (_input, init) => {
      assert.equal(new Headers(init?.headers).get('Authorization'), 'Bearer test-resend-key');
      requestBody = JSON.parse(String(init?.body));
      return new Response(JSON.stringify({ id: 'email_test_123' }), { status: 200 });
    };

    const body = 'Hi Ada,\n\nYour interview is confirmed.\n\nDate: Friday, 14 November\nTime: 10:30 GMT\nJoining link: https://meet.example.com/room\n\nThe Kongila team';
    const result = await sendEmail({
      to: 'recipient@example.com', subject: 'Interview confirmed', body,
      attachments: [{ filename: 'invite.ics', content: 'Y2FsZW5kYXI=', contentType: 'text/calendar' }]
    });

    assert.equal(result.success, true);
    assert.equal(result.messageId, 'email_test_123');
    assert.deepEqual(requestBody.to, ['recipient@example.com']);
    assert.equal(requestBody.from, 'Kongila <test@example.com>');
    assert.equal(requestBody.text, body);
    assert.equal(requestBody.attachments[0].filename, 'invite.ics');
    assert.match(requestBody.html, /https:\/\/app\.example\.com\/images\/kongilalogo\.png/);
    assert.match(requestBody.html, /Interview confirmed/);
    assert.match(requestBody.html, /Date:/);
    assert.match(requestBody.html, /Scheduled update/);
    assert.match(requestBody.html, /href="https:\/\/meet\.example\.com\/room"/);
    assert.match(requestBody.html, />Joining link</);
    assert.match(requestBody.html, /mailto:support@example\.com/);
    assert.match(requestBody.html, /legal\/privacy/);
  } finally {
    globalThis.fetch = originalFetch;
    restoreEnv('RESEND_API_KEY', key);
    restoreEnv('RESEND_FROM', from);
    restoreEnv('NEXT_PUBLIC_SITE_URL', siteUrl);
    restoreEnv('EMAIL_SUPPORT_EMAIL', support);
  }
});

test('branded email escapes dynamic content and preserves custom email markup', () => {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  const support = process.env.EMAIL_SUPPORT_EMAIL;
  try {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://app.example.com';
    process.env.EMAIL_SUPPORT_EMAIL = 'support@example.com';
    const html = renderBrandedEmail(
      'Hi Ada,\n\nHello <script>alert("x")</script>.\n\nOpen workspace: https://app.example.com/work',
      undefined,
      undefined,
      'Welcome to Kongila'
    );
    assert.match(html, /\/images\/kongilalogo\.png/);
    assert.match(html, /href="https:\/\/app\.example\.com\/work"/);
    assert.match(html, />Open workspace<\/a>/);
    assert.match(html, /&lt;script&gt;alert\(&quot;x&quot;\)&lt;\/script&gt;/);
    assert.doesNotMatch(html, /<script>alert/);
    assert.match(html, /Automated notification/);
    assert.match(html, /Global workforce infrastructure/);

    const custom = renderBrandedEmail('A verification code is included.', '<p>Code: <strong>123456</strong></p>', undefined, 'Verify your email');
    assert.match(custom, /<strong>123456<\/strong>/);
    assert.match(custom, /Verify your email/);
  } finally {
    restoreEnv('NEXT_PUBLIC_SITE_URL', siteUrl);
    restoreEnv('EMAIL_SUPPORT_EMAIL', support);
  }
});

test('email action parsing ignores unsafe URL schemes', () => {
  const html = renderBrandedEmail('Go: javascript:alert(1)', undefined, undefined, 'Account update');
  assert.doesNotMatch(html, /href="javascript:/);
  assert.match(html, /Go: javascript:alert\(1\)/);
});

test('every notification catalogue event renders through the shared system without missing values', () => {
  for (const event of ALL_NOTIFICATION_EVENTS) {
    const content = buildNotification(event, {
      recipientName: 'Ada Example',
      actionUrl: 'https://app.example.com/workspace',
      roleTitle: 'Operations Specialist',
      stageName: 'Skill Assessment',
      when: 'Friday, 14 November at 10:30 GMT'
    });
    const html = renderBrandedEmail(content.body, undefined, undefined, content.subject);
    assert.match(html, new RegExp(content.subject.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `${event} includes its subject`);
    assert.doesNotMatch(html, /\bundefined\b|null/);
    assert.match(html, /role="presentation"/);
    assert.match(html, /font-family:Arial,Helvetica,sans-serif/);
  }
});

test('sendEmail reports provider rejection without claiming success', async () => {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM;
  const originalFetch = globalThis.fetch;
  try {
    process.env.RESEND_API_KEY = 'test-resend-key';
    process.env.RESEND_FROM = 'Kongila <test@example.com>';
    globalThis.fetch = async () => new Response(JSON.stringify({ message: 'Domain is not verified' }), { status: 403 });
    const result = await sendEmail({ to: 'recipient@example.com', subject: 'Test', body: 'Test message' });
    assert.equal(result.success, false);
    assert.equal(result.configured, true);
    assert.match(String(result.error), /Domain is not verified/);
  } finally {
    globalThis.fetch = originalFetch;
    restoreEnv('RESEND_API_KEY', key);
    restoreEnv('RESEND_FROM', from);
  }
});
