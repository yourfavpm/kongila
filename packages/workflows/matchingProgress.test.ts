import test from 'node:test';
import assert from 'node:assert/strict';
import { compareMatchingProgress, matchingProgressStatus } from './matchingProgress.ts';

test('matching events advance only the request they apply to', () => {
  assert.equal(matchingProgressStatus('Sourcing Talent', 'candidates_submitted'), 'Candidates Ready');
  assert.equal(matchingProgressStatus('Candidates Ready', 'interview_requested'), 'Client Interview');
  assert.equal(matchingProgressStatus('Client Interview', 'offer_accepted'), 'Offer Accepted');
  assert.equal(matchingProgressStatus('Offer Accepted', 'offer_declined'), 'Client Interview');
  assert.equal(matchingProgressStatus('Client Interview', 'all_candidates_rejected'), 'Sourcing Talent');
});

test('matching events do not regress closed or hired requests', () => {
  assert.equal(matchingProgressStatus('Closed', 'interview_requested'), null);
  assert.equal(matchingProgressStatus('Onboarding', 'all_candidates_rejected'), null);
  assert.equal(matchingProgressStatus('Offer Accepted', 'candidates_submitted'), null);
});

test('matching progress comparison normalizes stored status aliases', () => {
  assert.ok(compareMatchingProgress('candidates_ready', 'client interview') < 0);
  assert.equal(compareMatchingProgress('client_interview', 'Client Interview'), 0);
});

test('matching events do not rewrite an unrecognized request stage', () => {
  assert.equal(matchingProgressStatus('Custom Review', 'interview_requested'), null);
});

test('terminal request aliases do not advance', () => {
  assert.equal(matchingProgressStatus('Closed/Cancelled', 'offer_accepted'), null);
  assert.equal(matchingProgressStatus('Hired', 'interview_requested'), null);
});
