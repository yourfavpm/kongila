import test from 'node:test';
import assert from 'node:assert/strict';

import {
  mandatoryTemplates,
  complianceStatus,
  complianceRefusal,
  isGated
} from './compliance.ts';

const template = (over: any = {}) => ({
  id: 'doc1', name: 'Mutual NDA', type: 'NDA', isMandatory: true, isTemplate: true, userId: null, ...over
});

test('a template whose user_id was stolen still counts as required', () => {
  // The first candidate to sign a universal template used to have their
  // user_id written onto it, so it stopped being mandatory for everyone
  // else. The is_template flag survives that.
  const docs = [template({ userId: 'talent-who-signed-first' })];
  assert.equal(mandatoryTemplates(docs).length, 1);
});

test('an uploaded file named like a policy is not a signed policy', () => {
  // The old check matched by name, so "NDA.pdf" in someone's uploads
  // satisfied a requirement for a signed NDA.
  const docs = [
    template({ id: 'tpl-nda' }),
    { id: 'upload1', name: 'NDA.pdf', type: 'NDA', userId: 't1', isTemplate: false }
  ];
  const status = complianceStatus('t1', docs, []);
  assert.equal(status.compliant, false);
  assert.equal(status.outstanding[0].id, 'tpl-nda');
});

test('signing is matched by document id', () => {
  const docs = [template({ id: 'tpl-nda' })];
  const status = complianceStatus('t1', docs, [{ documentId: 'tpl-nda', talentId: 't1' }]);
  assert.equal(status.compliant, true);
  assert.equal(status.reason, null);
});

test('one candidate signing does not clear it for another', () => {
  const docs = [template({ id: 'tpl-nda' })];
  const signatures = [{ documentId: 'tpl-nda', talentId: 't1' }];
  assert.equal(complianceStatus('t1', docs, signatures).compliant, true);
  assert.equal(complianceStatus('t2', docs, signatures).compliant, false);
});

test('progress is counted, so the admin bar is not always zero', () => {
  const docs = [
    template({ id: 'a', name: 'NDA' }),
    template({ id: 'b', name: 'Contractor Agreement', type: 'agreement' }),
    template({ id: 'c', name: 'IT Ethics Policy', type: 'IT_Ethics_Policy' })
  ];
  const status = complianceStatus('t1', docs, [{ documentId: 'a', talentId: 't1' }]);
  assert.equal(status.signedCount, 1);
  assert.equal(status.requiredCount, 3);
  assert.match(status.reason || '', /2 unsigned compliance documents/);
});

test('with nothing mandatory, everyone is compliant', () => {
  assert.equal(complianceStatus('t1', [], []).compliant, true);
  assert.equal(complianceStatus('t1', [{ id: 'x', userId: 't1' }], []).compliant, true);
});

test('the gate blocks everything that puts a candidate in front of a client', () => {
  for (const action of ['match', 'shortlist', 'submit_to_client', 'extend_offer', 'issue_contract', 'sign_contract'] as const) {
    assert.equal(isGated(action), true, `${action} should be gated`);
  }
});

test('an interview is deliberately not blocked', () => {
  // Nothing confidential has changed hands at a first interview, and
  // blocking it stalls the pipeline where the candidate has least reason to
  // have signed anything yet.
  assert.equal(isGated('schedule_interview'), false);
  assert.equal(
    complianceRefusal('schedule_interview', 't1', [template()], []),
    null
  );
});

test('a refusal names the document and the progress', () => {
  const refusal = complianceRefusal('extend_offer', 't1', [template({ name: 'Mutual NDA' })], []);
  assert.match(refusal || '', /Mutual NDA/);
  assert.match(refusal || '', /0 of 1 complete/);
});

test('a compliant candidate is not refused', () => {
  const docs = [template({ id: 'tpl' })];
  assert.equal(
    complianceRefusal('extend_offer', 't1', docs, [{ documentId: 'tpl', talentId: 't1' }]),
    null
  );
});

test('signatures for other candidates do not leak across', () => {
  const docs = [template({ id: 'tpl' })];
  const refusal = complianceRefusal('shortlist', 't2', docs, [{ documentId: 'tpl', talentId: 't1' }]);
  assert.ok(refusal, 't2 should still be blocked');
});
