/**
 * Run with:  pnpm test
 * (node --test --experimental-strip-types, no test framework installed)
 *
 * index.ts imports nothing, so this runs without resolving workspace
 * packages. Keep it that way.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { requestTitle } from './index.ts';

test('a stored title wins', () => {
  assert.equal(
    requestTitle({ title: 'Senior Backend Engineer', roleDescription: 'Long paragraph here.' }),
    'Senior Backend Engineer'
  );
});

test('each service path falls back to its own name for the work', () => {
  assert.equal(requestTitle({ roleTitle: 'Product Designer' }), 'Product Designer');
  assert.equal(requestTitle({ projectName: 'Atlas Migration' }), 'Atlas Migration');
  assert.equal(
    requestTitle({ teamDescription: 'Tier 2 support team covering EMEA hours' }),
    'Tier 2 support team covering EMEA hours'
  );
});

test('a blank or whitespace-only field is skipped, not returned', () => {
  // '' and '   ' both used to pass the truthiness test somewhere up the chain
  // and produce a request with no visible name at all.
  assert.equal(requestTitle({ title: '', roleTitle: 'Data Analyst' }), 'Data Analyst');
  assert.equal(requestTitle({ title: '   ', projectName: 'Atlas Migration' }), 'Atlas Migration');
});

test('a description is used only as a last resort, and is shortened', () => {
  const long = 'We are looking for an experienced backend engineer to join our platform team '
    + 'and own the payments service end to end.';
  const out = requestTitle({ roleDescription: long });

  assert.ok(out.length <= 70, `"${out}" is ${out.length} characters`);
  assert.ok(out.endsWith('…'), 'a shortened title says so');
  // Cut at a word boundary. The board used to show substring(0, 40), which
  // ended mid-word.
  assert.ok(!/\s…$/.test(out), 'no space before the ellipsis');
  assert.ok(long.startsWith(out.slice(0, -1)), 'the kept part is the start of the description');
});

test('a short description is returned whole', () => {
  assert.equal(requestTitle({ roleDescription: 'Backend engineer, payments' }), 'Backend engineer, payments');
});

test('a request with nothing written in falls back to the service type', () => {
  assert.equal(requestTitle({ serviceType: 'Managed Workforce' } as any), 'Managed Workforce');
});

test('a request with nothing at all still has a name', () => {
  // Every caller renders this directly, so returning undefined put the string
  // "undefined" on the board.
  assert.equal(requestTitle({}), 'Untitled request');
  assert.equal(requestTitle(null), 'Untitled request');
  assert.equal(requestTitle(undefined), 'Untitled request');
});

test('a non-string field does not become the title', () => {
  // payload is jsonb, so a number or an object can arrive in any of these.
  assert.equal(requestTitle({ title: 42 as any, roleTitle: 'QA Analyst' }), 'QA Analyst');
  assert.equal(requestTitle({ title: { en: 'x' } as any, roleTitle: 'QA Analyst' }), 'QA Analyst');
});
