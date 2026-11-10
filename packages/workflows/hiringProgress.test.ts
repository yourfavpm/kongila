import test from 'node:test';
import assert from 'node:assert/strict';

import {
  countSignedHires,
  hasOfferCapacity,
  hasReachedHireTarget,
  isSignedHireContract,
  requestedHeadcount
} from './hiringProgress.ts';

test('only signed or active contracts count as hired', () => {
  assert.equal(isSignedHireContract({ status: 'pending' }), false);
  assert.equal(isSignedHireContract({ status: 'fully_signed' }), true);
  assert.equal(countSignedHires([
    { status: 'pending' },
    { status: 'fully_signed' },
    { status: 'active' },
    { status: 'terminated' }
  ]), 2);
});

test('a multi-hire request remains open until its requested headcount is signed', () => {
  const contracts = [{ status: 'fully_signed' }, { status: 'pending' }];

  assert.equal(hasReachedHireTarget(2, contracts), false);
  assert.equal(hasReachedHireTarget(2, [...contracts, { status: 'active' }]), true);
});

test('invalid or absent headcount defaults to one hire', () => {
  assert.equal(requestedHeadcount(undefined), 1);
  assert.equal(requestedHeadcount(0), 1);
  assert.equal(requestedHeadcount(2.5), 1);
  assert.equal(hasReachedHireTarget(undefined, [{ status: 'fully_signed' }]), true);
});

test('offers may be created until the requested number of hires is in progress', () => {
  assert.equal(hasOfferCapacity(3, 2), true);
  assert.equal(hasOfferCapacity(3, 3), false);
  assert.equal(hasOfferCapacity(1, 0), true);
  assert.equal(hasOfferCapacity(1, 1), false);
});
