/**
 * Run with:  pnpm test
 *
 * offers.ts imports nothing, so this runs under node --test directly.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  normalizeOfferStage,
  offerTransition,
  describeOfferStage,
  offerTrailPosition,
  isOpenOffer,
  isLiveOffer,
  OFFER_TRAIL
} from './offers.ts';

test('a candidate never sees an offer Kongila has not sent', () => {
  // Kongila is the employer of record, so the terms are Kongila's to approve
  // before they reach anyone. A client pressing send cannot skip that.
  assert.equal(offerTransition('draft', 'client_submits'), 'submitted');
  assert.equal(offerTransition('submitted', 'talent_accepts'), null);
  assert.equal(offerTransition('admin_approved', 'talent_accepts'), null);

  assert.equal(offerTransition('submitted', 'admin_sends'), 'sent_to_talent');
  assert.equal(offerTransition('sent_to_talent', 'talent_accepts'), 'accepted');
});

test('a revision goes back to the client and can come round again', () => {
  assert.equal(offerTransition('submitted', 'admin_requests_revision'), 'revision_requested');
  assert.equal(describeOfferStage('revision_requested').waitingOn, 'client');
  assert.equal(offerTransition('revision_requested', 'client_revises'), 'submitted');
  assert.equal(offerTransition('revision_requested', 'admin_sends'), 'sent_to_talent');
});

test('a contract only exists after a candidate has accepted', () => {
  assert.equal(offerTransition('sent_to_talent', 'contract_created'), null);
  assert.equal(offerTransition('submitted', 'contract_created'), null);
  assert.equal(offerTransition('accepted', 'contract_created'), 'contract_active');
});

test('an offer that is over cannot be moved on', () => {
  for (const dead of ['declined', 'admin_declined', 'expired', 'contract_active']) {
    assert.equal(offerTransition(dead, 'admin_sends'), null, dead);
    assert.equal(offerTransition(dead, 'talent_accepts'), null, dead);
  }
});

test('every stage says whose move it is', () => {
  assert.equal(describeOfferStage('submitted').waitingOn, 'admin');
  assert.equal(describeOfferStage('sent_to_talent').waitingOn, 'talent');
  assert.equal(describeOfferStage('declined').waitingOn, null);

  assert.equal(isOpenOffer('sent_to_talent'), true);
  assert.equal(isOpenOffer('accepted'), false);
  assert.equal(isLiveOffer('accepted'), true);
  assert.equal(isLiveOffer('contract_active'), true);
  assert.equal(isLiveOffer('declined'), false);
});

test('the trail never reads as going backwards', () => {
  assert.equal(offerTrailPosition('submitted'), 0);
  assert.equal(
    offerTrailPosition('revision_requested'),
    offerTrailPosition('submitted'),
    'a revision is still the review step, not progress lost'
  );
  assert.equal(offerTrailPosition('contract_active'), OFFER_TRAIL.length - 1);
});

test('an unknown status reads as a draft rather than throwing', () => {
  assert.equal(normalizeOfferStage(undefined), 'draft');
  assert.equal(normalizeOfferStage('Sent To Talent'), 'sent_to_talent');
  assert.equal(normalizeOfferStage('nonsense'), 'draft');
});
