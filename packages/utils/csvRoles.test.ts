/**
 * Run with:  pnpm test
 *
 * csvRoles.ts imports nothing, so this runs under node --test directly.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { parseCsv, parseRoleCsv, ROLE_CSV_TEMPLATE } from './csvRoles.ts';

test('a description containing a comma does not become two columns', () => {
  // The reason this is not a split on commas. Every real description has one.
  const rows = parseCsv('Title,Description\n"Backend Engineer","Owns payments, billing and payouts"');
  assert.deepEqual(rows[1], ['Backend Engineer', 'Owns payments, billing and payouts']);
});

test('quotes inside a quoted field, newlines inside a cell, and Excel\'s BOM', () => {
  const rows = parseCsv('﻿Title,Note\n"Engineer","They said ""yes"" twice"');
  assert.deepEqual(rows[0], ['Title', 'Note']);
  assert.deepEqual(rows[1], ['Engineer', 'They said "yes" twice']);

  const multiline = parseCsv('Title,Note\n"Engineer","line one\nline two"');
  assert.equal(multiline[1][1], 'line one\nline two');

  // Windows line endings, and a trailing newline that is not a row.
  assert.equal(parseCsv('A,B\r\n1,2\r\n').length, 2);
});

test('headers are recognised however the client spelled them', () => {
  for (const header of ['Title', 'role_title', 'Position', 'JOB TITLE']) {
    const parsed = parseRoleCsv(`${header}\nBackend Engineer`);
    assert.equal(parsed.roles.length, 1, header);
    assert.equal(parsed.roles[0].title, 'Backend Engineer', header);
  }
});

test('a file with no title column is refused with a reason, not a stack trace', () => {
  const parsed = parseRoleCsv('Skills,Budget\nNode.js,4000');
  assert.equal(parsed.roles.length, 0);
  assert.match(parsed.problems[0].message, /No column of role titles/);
});

test('a row with no title is reported, never silently dropped', () => {
  // Finding out later that two of your eight roles never arrived is the
  // worst version of this feature.
  const parsed = parseRoleCsv('Title,Headcount\nBackend Engineer,2\n,3\nDesigner,1');
  assert.equal(parsed.roles.length, 2);
  assert.equal(parsed.problems.length, 1);
  assert.equal(parsed.problems[0].line, 3);
});

test('blank lines in the middle of a spreadsheet are not errors', () => {
  const parsed = parseRoleCsv('Title\nBackend Engineer\n\n\nDesigner');
  assert.equal(parsed.roles.length, 2);
  assert.equal(parsed.problems.length, 0);
});

test('headcount, money and dates survive how people actually type them', () => {
  const parsed = parseRoleCsv(
    'Title,Headcount,Budget Min,Budget Max,Start Date,Skills\n' +
    'Engineer,"2","$4,000","6 000",2026-01-12,"Node.js; React, AWS"'
  );
  const [role] = parsed.roles;
  assert.equal(role.count, 2);
  assert.equal(role.budgetMinUsd, 4000);
  assert.equal(role.budgetMaxUsd, 6000);
  assert.equal(role.startDate, '2026-01-12');
  assert.deepEqual(role.requiredSkills, ['Node.js', 'React', 'AWS']);
});

test('a headcount that is not a number is flagged and read as one person', () => {
  const parsed = parseRoleCsv('Title,Headcount\nEngineer,a few');
  assert.equal(parsed.roles[0].count, 1);
  assert.match(parsed.problems[0].message, /not a number of people/);
});

test('a budget the wrong way round is dropped rather than filed backwards', () => {
  const parsed = parseRoleCsv('Title,Budget Min,Budget Max\nEngineer,9000,3000');
  assert.equal(parsed.roles[0].budgetMinUsd, undefined);
  assert.equal(parsed.roles[0].budgetMaxUsd, undefined);
  assert.match(parsed.problems[0].message, /minimum budget is above the maximum/);
});

test('one file cannot file an unlimited number of requests', () => {
  const rows = ['Title', ...Array.from({ length: 30 }, (_, i) => `Role ${i}`)].join('\n');
  const parsed = parseRoleCsv(rows, { maxRoles: 20 });
  assert.equal(parsed.roles.length, 20);
  assert.equal(parsed.problems.length, 10);
});

test('the template we hand out parses into the roles it claims to show', () => {
  const parsed = parseRoleCsv(ROLE_CSV_TEMPLATE);
  assert.equal(parsed.problems.length, 0);
  assert.equal(parsed.roles.length, 2);
  assert.equal(parsed.roles[0].title, 'Backend Engineer');
  assert.equal(parsed.roles[0].count, 2);
  assert.deepEqual(parsed.roles[0].requiredSkills, ['Node.js', 'PostgreSQL', 'AWS']);
});
