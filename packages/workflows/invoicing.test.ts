import test from 'node:test';
import assert from 'node:assert/strict';

import {
  formatInvoiceNumber,
  parseInvoiceNumber,
  nextInvoiceNumber,
  dueDateFrom,
  describeTerms,
  isValidPaymentTerms,
  isOverdue,
  daysPastDue,
  overdueTransitions,
  disputedAndAgeing,
  overdueMessage,
  DEFAULT_PAYMENT_TERMS_DAYS
} from './invoicing.ts';

const now = new Date('2026-11-20T09:00:00Z');

const invoice = (over: any = {}) => ({
  id: 'inv1',
  invoiceNumber: 'KNG-INV-202611-0001',
  status: 'sent',
  dueDate: '2026-11-10T23:59:59.000Z',
  isDisputed: false,
  clientId: 'client1',
  totalUsd: 2500,
  ...over
});

// ─── Numbering ───────────────────────────────────────────────────────────────

test('an invoice number is readable and sortable', () => {
  assert.equal(formatInvoiceNumber('2026-11', 7), 'KNG-INV-202611-0007');
  assert.equal(formatInvoiceNumber('2026-11', 1234), 'KNG-INV-202611-1234');
});

test('a number round-trips', () => {
  assert.deepEqual(parseInvoiceNumber('KNG-INV-202611-0007'), { period: '2026-11', sequence: 7 });
  assert.equal(parseInvoiceNumber('nonsense'), null);
  assert.equal(parseInvoiceNumber('KNG-INV-202611-ABCD'), null);
});

test('the next number follows the highest already issued', () => {
  assert.equal(
    nextInvoiceNumber('2026-11', ['KNG-INV-202611-0001', 'KNG-INV-202611-0002']),
    'KNG-INV-202611-0003'
  );
});

test('a voided invoice does not free its number for reuse', () => {
  // Counting instead of taking the highest is how two invoices end up
  // sharing a number, which is exactly what an auditor asks about.
  assert.equal(
    nextInvoiceNumber('2026-11', ['KNG-INV-202611-0001', 'KNG-INV-202611-0005']),
    'KNG-INV-202611-0006'
  );
});

test('each month starts its own sequence', () => {
  const issued = ['KNG-INV-202610-0009', 'KNG-INV-202610-0010'];
  assert.equal(nextInvoiceNumber('2026-11', issued), 'KNG-INV-202611-0001');
});

test('the first invoice of a month is 0001', () => {
  assert.equal(nextInvoiceNumber('2026-11', []), 'KNG-INV-202611-0001');
});

// ─── Payment terms ───────────────────────────────────────────────────────────

test('the due date comes from the contract terms', () => {
  assert.match(dueDateFrom('2026-11-01T10:00:00Z', 30), /^2026-12-01T23:59:59/);
  assert.match(dueDateFrom('2026-11-01T10:00:00Z', 7), /^2026-11-08T23:59:59/);
});

test('a missing term falls back to the old hardcoded fourteen days', () => {
  assert.match(dueDateFrom('2026-11-01T10:00:00Z', null), /^2026-11-15T23:59:59/);
  assert.equal(DEFAULT_PAYMENT_TERMS_DAYS, 14);
});

test('due on receipt is the day it was issued, not the day before', () => {
  assert.match(dueDateFrom('2026-11-01T10:00:00Z', 0), /^2026-11-01T23:59:59/);
});

test('an invoice issued late at night is not due ten minutes later', () => {
  // The time of day is stripped, so net 14 is fourteen whole days.
  assert.match(dueDateFrom('2026-11-01T23:50:00Z', 14), /^2026-11-15T23:59:59/);
});

test('a nonsense term is rejected rather than used', () => {
  assert.equal(isValidPaymentTerms(14), true);
  assert.equal(isValidPaymentTerms(0), true);
  assert.equal(isValidPaymentTerms(-5), false);
  assert.equal(isValidPaymentTerms(400), false);
  assert.equal(isValidPaymentTerms('soon'), false);
  // Falls back rather than producing a date in 1970.
  assert.match(dueDateFrom('2026-11-01T10:00:00Z', -5), /^2026-11-15/);
});

test('a bad issue date gives an empty due date, not an invalid one', () => {
  assert.equal(dueDateFrom('not a date', 14), '');
});

test('terms read as words', () => {
  assert.equal(describeTerms(0), 'Due on receipt');
  assert.equal(describeTerms(30), 'Net 30 days');
  assert.equal(describeTerms(null), 'Net 14 days');
});

// ─── Overdue ─────────────────────────────────────────────────────────────────

test('a sent invoice past its due date is overdue', () => {
  assert.equal(isOverdue(invoice(), now), true);
  assert.equal(daysPastDue(invoice(), now), 10);
});

test('an invoice due later today is not overdue yet', () => {
  assert.equal(isOverdue(invoice({ dueDate: '2026-11-20T23:59:59Z' }), now), false);
  assert.equal(daysPastDue(invoice({ dueDate: '2026-11-20T23:59:59Z' }), now), 0);
});

test('a draft is never overdue, because it was never sent', () => {
  assert.equal(isOverdue(invoice({ status: 'draft' }), now), false);
});

test('a paid or void invoice is never overdue', () => {
  assert.equal(isOverdue(invoice({ status: 'paid' }), now), false);
  assert.equal(isOverdue(invoice({ status: 'void' }), now), false);
});

test('a disputed invoice is not chased', () => {
  // Chasing a client for money they have formally queried turns a
  // disagreement into a lost account.
  assert.equal(isOverdue(invoice({ isDisputed: true }), now), false);
});

test('only invoices actually changing are returned', () => {
  const changes = overdueTransitions([
    invoice({ id: 'a' }),
    invoice({ id: 'b', status: 'overdue' }),
    invoice({ id: 'c', status: 'paid' }),
    invoice({ id: 'd', isDisputed: true })
  ], now);

  assert.deepEqual(changes.map(c => c.id), ['a']);
});

test('running the job twice does not chase the same client twice', () => {
  // The second run sees status overdue, not sent, so there is nothing left
  // to transition.
  const first = overdueTransitions([invoice()], now);
  assert.equal(first.length, 1);
  const second = overdueTransitions([invoice({ status: 'overdue' })], now);
  assert.equal(second.length, 0);
});

test('a transition carries what a notification needs', () => {
  const [change] = overdueTransitions([invoice()], now);
  assert.equal(change.invoiceNumber, 'KNG-INV-202611-0001');
  assert.equal(change.clientId, 'client1');
  assert.equal(change.daysPastDue, 10);
  assert.equal(change.totalUsd, 2500);
});

test('disputed invoices ageing quietly are surfaced separately', () => {
  // They are not chased, and that is exactly why somebody has to see them.
  const held = disputedAndAgeing([
    invoice({ id: 'a', isDisputed: true }),
    invoice({ id: 'b' }),
    invoice({ id: 'c', isDisputed: true, status: 'paid' })
  ], now);
  assert.deepEqual(held.map(i => i.id), ['a']);
});

test('the message to the client reads like a person wrote it', () => {
  assert.match(overdueMessage(invoice({ dueDate: '2026-11-20T23:59:59Z' }), now), /due today/);
  assert.match(overdueMessage(invoice({ dueDate: '2026-11-19T23:59:59Z' }), now), /due yesterday/);
  assert.match(overdueMessage(invoice(), now), /10 days overdue/);
});
