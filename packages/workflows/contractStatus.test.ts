import test from 'node:test';
import assert from 'node:assert/strict';

import {
  normaliseContractStatus,
  contractTransition,
  contractIsLive,
  CONTRACT_STATUSES
} from './contractStatus.ts';

// ─── The hole this closes ────────────────────────────────────────────────────

test('every status is one contracts_status_check permits', () => {
  // The panel wrote 'Draft', 'Signed', 'Active', 'Voided' and 'Terminated'.
  // The column takes none of those, so every write was rejected and the
  // error was swallowed.
  assert.deepEqual([...CONTRACT_STATUSES], [
    'pending', 'pending_signatures', 'client_signed', 'talent_signed',
    'fully_signed', 'active', 'ended', 'terminated', 'closed'
  ]);
});

test('the words the panel uses map onto values the column takes', () => {
  assert.equal(normaliseContractStatus('Draft'), 'pending');
  assert.equal(normaliseContractStatus('Signed'), 'fully_signed');
  assert.equal(normaliseContractStatus('Active'), 'active');
  assert.equal(normaliseContractStatus('Voided'), 'terminated');
  assert.equal(normaliseContractStatus('Pending Signatures'), 'pending_signatures');
});

test('Draft is pending and Voided is terminated, not draft and voided', () => {
  // Lowercasing the label would have produced exactly the two values the
  // database refuses, which is what the old code effectively did.
  assert.notEqual(normaliseContractStatus('Draft'), 'draft' as any);
  assert.notEqual(normaliseContractStatus('Voided'), 'voided' as any);
});

test('a word nothing recognises is refused rather than guessed at', () => {
  assert.equal(normaliseContractStatus('Signed By Everyone'), null);
  assert.equal(normaliseContractStatus(''), null);
  assert.equal(normaliseContractStatus(null), null);
});

// ─── Transitions ─────────────────────────────────────────────────────────────

test('a contract goes out for signature before it is signed', () => {
  assert.equal(contractTransition('Draft', 'Pending Signatures').ok, true);
  const early = contractTransition('Draft', 'Active');
  assert.equal(early.ok, false);
  assert.match(early.error!, /cannot become/);
});

test('one side signing leaves it part signed', () => {
  assert.equal(contractTransition('pending_signatures', 'client_signed').ok, true);
  assert.equal(contractTransition('client_signed', 'fully_signed').ok, true);
});

test('activation comes after both signatures', () => {
  assert.equal(contractTransition('fully_signed', 'active').ok, true);
  assert.equal(contractTransition('client_signed', 'active').ok, false);
});

test('a closed contract cannot change', () => {
  const result = contractTransition('closed', 'active');
  assert.equal(result.ok, false);
  assert.match(result.error!, /cannot change/);
});

test('an ended contract is not revived', () => {
  assert.equal(contractTransition('ended', 'active').ok, false);
  assert.equal(contractTransition('ended', 'closed').ok, true);
});

test('setting the status it already has is not an error', () => {
  const result = contractTransition('active', 'Active');
  assert.equal(result.ok, true);
  assert.equal(result.status, 'active');
});

// ─── Ending a contract ───────────────────────────────────────────────────────

test('terminating without a reason is refused', () => {
  const blank = contractTransition('active', 'Voided', '  ');
  assert.equal(blank.ok, false);
  assert.match(blank.error!, /why/);
  assert.equal(contractTransition('active', 'Voided').ok, false);
});

test('terminating with a reason is allowed from any live status', () => {
  for (const from of ['pending', 'pending_signatures', 'client_signed', 'fully_signed', 'active']) {
    assert.equal(contractTransition(from, 'Voided', 'Client cancelled the role.').ok, true, from);
  }
});

// ─── Billing ─────────────────────────────────────────────────────────────────

test('only a signed or active contract is billable', () => {
  assert.equal(contractIsLive('active'), true);
  assert.equal(contractIsLive('fully_signed'), true);
  assert.equal(contractIsLive('pending_signatures'), false);
  assert.equal(contractIsLive('terminated'), false);
  assert.equal(contractIsLive('Signed'), true, 'the panel label resolves too');
});
