import test from 'node:test';
import assert from 'node:assert/strict';

import {
  documentTransition,
  contractStatusFromDocuments,
  whoIsOutstanding,
  daysSinceSent,
  isVisibleToParty
} from './contractDocuments.ts';

const doc = (audience: 'client' | 'talent', status: string, extra: Record<string, any> = {}) =>
  ({ audience, status, ...extra } as any);

// ─── Transitions ─────────────────────────────────────────────────────────────

test('a draft is sent, and a sent document is viewed then signed', () => {
  assert.equal(documentTransition('draft', 'sent').status, 'sent');
  assert.equal(documentTransition('sent', 'viewed').status, 'viewed');
  assert.equal(documentTransition('viewed', 'signed').status, 'signed');
});

test('a party may sign without the view being recorded first', () => {
  assert.equal(documentTransition('sent', 'signed').status, 'signed');
});

test('a draft cannot be signed: a party cannot sign what was never sent', () => {
  const result = documentTransition('draft', 'signed');
  assert.equal(result.ok, false);
  assert.match(String(result.error), /draft document cannot become signed/);
});

test('a signed document cannot be re-sent or changed', () => {
  const result = documentTransition('signed', 'sent');
  assert.equal(result.ok, false);
  assert.match(String(result.error), /already signed/);
  assert.match(String(result.error), /Void the contract/);
});

test('a voided document is the end of that document', () => {
  assert.equal(documentTransition('void', 'sent').ok, false);
});

test('a state that does not exist is refused by name', () => {
  assert.match(String(documentTransition('sent', 'countersigned').error), /not a document state/);
});

// ─── The contract status, derived ────────────────────────────────────────────

test('nothing sent means pending, not out for signature', () => {
  assert.equal(contractStatusFromDocuments([
    doc('client', 'draft'), doc('talent', 'draft')
  ]), 'pending');
});

test('one document sent puts the contract out for signature', () => {
  assert.equal(contractStatusFromDocuments([
    doc('client', 'sent'), doc('talent', 'draft')
  ]), 'pending_signatures');
});

test('each party signing alone is named', () => {
  assert.equal(contractStatusFromDocuments([
    doc('client', 'signed'), doc('talent', 'sent')
  ]), 'client_signed');
  assert.equal(contractStatusFromDocuments([
    doc('client', 'viewed'), doc('talent', 'signed')
  ]), 'talent_signed');
});

test('both signed and already started is active', () => {
  assert.equal(contractStatusFromDocuments([
    doc('client', 'signed'), doc('talent', 'signed')
  ]), 'active');
});

test('both signed but starting later waits at fully signed', () => {
  assert.equal(contractStatusFromDocuments(
    [doc('client', 'signed'), doc('talent', 'signed')],
    { startsInFuture: true }
  ), 'fully_signed');
});

test('a contract with only one document never reads as fully signed', () => {
  assert.equal(contractStatusFromDocuments([doc('client', 'signed')]), 'client_signed');
});

// ─── Who is holding it up ────────────────────────────────────────────────────

test('both outstanding names both, with what each is waiting on', () => {
  const who = whoIsOutstanding([doc('client', 'viewed'), doc('talent', 'draft')]);
  assert.match(String(who), /the client \(opened, not signed\)/);
  assert.match(String(who), /the candidate \(not sent yet\)/);
});

test('nobody outstanding once both have signed', () => {
  assert.equal(whoIsOutstanding([doc('client', 'signed'), doc('talent', 'signed')]), null);
});

test('a voided document is not somebody to chase', () => {
  assert.equal(whoIsOutstanding([doc('client', 'signed'), doc('talent', 'void')]), null);
});

// ─── Visibility and age ──────────────────────────────────────────────────────

test('a draft is not visible to its party', () => {
  assert.equal(isVisibleToParty(doc('client', 'draft')), false);
  assert.equal(isVisibleToParty(doc('client', 'sent')), true);
  assert.equal(isVisibleToParty(doc('client', 'signed')), true);
});

test('days since sent counts only while it is unsigned', () => {
  const sentAt = new Date('2026-11-01T00:00:00Z').toISOString();
  assert.equal(daysSinceSent(doc('client', 'sent', { sentAt }), new Date('2026-11-15T00:00:00Z')), 14);
  assert.equal(daysSinceSent(doc('client', 'signed', { sentAt }), new Date('2026-11-15T00:00:00Z')), null);
  assert.equal(daysSinceSent(doc('client', 'draft')), null);
});
