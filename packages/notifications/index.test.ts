/// <reference types="node" />

import test from 'node:test';
import assert from 'node:assert/strict';

import { emailIsConfigured, renderBrandedEmail, sendEmail } from './index.ts';

function restoreEnv(name: 'RESEND_API_KEY' | 'RESEND_FROM', value: string | undefined) {
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
    globalThis.fetch = async () => {
      throw new Error('Resend must not be called without configuration');
    };

    const result = await sendEmail({
      to: 'recipient@example.com',
      subject: 'Test',
      body: 'Test message'
    });

    assert.equal(result.success, false);
    assert.equal(result.configured, false);
  } finally {
    globalThis.fetch = originalFetch;
    restoreEnv('RESEND_API_KEY', key);
    restoreEnv('RESEND_FROM', from);
  }
});

test('sendEmail posts a plain-text and HTML message to Resend', async () => {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM;
  const originalFetch = globalThis.fetch;
  try {
    process.env.RESEND_API_KEY = 'test-resend-key';
    process.env.RESEND_FROM = 'Kongila <test@example.com>';
    let requestBody: any;
    globalThis.fetch = async (_input, init) => {
      assert.equal(new Headers(init?.headers).get('Authorization'), 'Bearer test-resend-key');
      requestBody = JSON.parse(String(init?.body));
      return new Response(JSON.stringify({ id: 'email_test_123' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });

      test('branded email renders a safe CTA, public logo and support footer', () => {
        const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
        const supportEmail = process.env.EMAIL_SUPPORT_EMAIL;
        try {
          process.env.NEXT_PUBLIC_SITE_URL = 'https://app.example.com';
          process.env.EMAIL_SUPPORT_EMAIL = 'support@example.com';
          const html = renderBrandedEmail(
            'Hi Ada,\n\nYour invitation is ready.\n\nSet password: https://admin.example.com/set-password'
          );
          assert.match(html, /\/images\/kongilalogo\.png/);
          assert.match(html, /href="https:\/\/admin\.example\.com\/set-password"/);
          assert.match(html, />Set password<\/a>/);
          assert.match(html, /mailto:support@example\.com/);
          assert.match(html, /Africa&#39;s talent|Africa's talent/);
        } finally {
          if (siteUrl === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
          else process.env.NEXT_PUBLIC_SITE_URL = siteUrl;
          if (supportEmail === undefined) delete process.env.EMAIL_SUPPORT_EMAIL;
          else process.env.EMAIL_SUPPORT_EMAIL = supportEmail;
        }
      });
    };

    const result = await sendEmail({
      to: 'recipient@example.com',
      subject: 'Test',
      body: '<Hello>\n\nWorld'
    });

    assert.equal(result.success, true);
    assert.equal(result.configured, true);
    assert.equal(result.messageId, 'email_test_123');
    assert.deepEqual(requestBody.to, ['recipient@example.com']);
    assert.equal(requestBody.from, 'Kongila <test@example.com>');
    assert.equal(requestBody.text, '<Hello>\n\nWorld');
    assert.match(requestBody.html, /&lt;Hello&gt;/);
  } finally {
    globalThis.fetch = originalFetch;
    restoreEnv('RESEND_API_KEY', key);
    restoreEnv('RESEND_FROM', from);
  }
});

test('sendEmail reports provider rejection without claiming success', async () => {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM;
  const originalFetch = globalThis.fetch;
  try {
    process.env.RESEND_API_KEY = 'test-resend-key';
    process.env.RESEND_FROM = 'Kongila <test@example.com>';
    globalThis.fetch = async () => new Response(JSON.stringify({ message: 'Domain is not verified' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' }
    });

    const result = await sendEmail({
      to: 'recipient@example.com',
      subject: 'Test',
      body: 'Test message'
    });

    assert.equal(result.success, false);
    assert.equal(result.configured, true);
    assert.match(String(result.error), /Domain is not verified/);
  } finally {
    globalThis.fetch = originalFetch;
    restoreEnv('RESEND_API_KEY', key);
    restoreEnv('RESEND_FROM', from);
  }
});
