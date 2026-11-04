import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildContractDocument,
  renderTemplate,
  templateFields,
  contractCoverSheet,
  MINIMUM_TERMS_LENGTH
} from './document.ts';

const facts = {
  referenceNumber: 'KON-0001',
  talentName: 'Ada Okafor',
  clientName: 'Northwind Ltd',
  roleTitle: 'Backend Engineer',
  monthlyRateUsd: 2400,
  startDate: '2026-12-01'
};

const terms = 'x'.repeat(MINIMUM_TERMS_LENGTH + 50);

test('with no template, the document is not signable', () => {
  // The filler paragraphs made an empty agreement look like a full one.
  const doc = buildContractDocument(facts, null);
  assert.equal(doc.ready, false);
  assert.match(doc.reason || '', /have not been issued/);
});

test('the cover sheet still shows the real particulars', () => {
  const doc = buildContractDocument(facts, null);
  assert.match(doc.text, /KON-0001/);
  assert.match(doc.text, /Ada Okafor/);
  assert.match(doc.text, /USD 2400/);
});

test('nothing is invented to fill the gap', () => {
  const doc = buildContractDocument(facts, null);
  assert.doesNotMatch(doc.text, /Standard terms and conditions/);
  assert.doesNotMatch(doc.text, /Clause/);
});

test('a real template is signable', () => {
  const doc = buildContractDocument(facts, terms);
  assert.equal(doc.ready, true);
  assert.equal(doc.reason, null);
  assert.ok(doc.text.length > MINIMUM_TERMS_LENGTH);
});

test('a template too short to be a contract is refused', () => {
  const doc = buildContractDocument(facts, 'The talent agrees to work.');
  assert.equal(doc.ready, false);
  assert.match(doc.reason || '', /too short/);
});

test('merge fields are filled from the contract', () => {
  const rendered = renderTemplate('Between {{talent_name}} and {{client_company}}.', facts);
  assert.equal(rendered, 'Between Ada Okafor and Northwind Ltd.');
});

test('an unfilled field blocks signing instead of leaving a blank', () => {
  // Replacing a missing name with an empty string produces a contract with a
  // hole in it that reads as finished.
  const doc = buildContractDocument(
    { ...facts, clientName: null },
    `${terms} Client: {{client_company}}.`
  );
  assert.equal(doc.ready, false);
  assert.match(doc.reason || '', /client_company/);
  assert.match(doc.text, /\{\{client_company\}\}/);
});

test('fields are listed once, in order', () => {
  assert.deepEqual(
    templateFields('{{talent_name}} {{client_company}} {{talent_name}}'),
    ['talent_name', 'client_company']
  );
});

test('an unknown merge field is left alone, not blanked', () => {
  assert.equal(renderTemplate('{{governing_law}}', facts), '{{governing_law}}');
});

test('missing particulars are named, not left empty', () => {
  const cover = contractCoverSheet({ talentName: 'Ada Okafor' });
  assert.match(cover, /Reference: not yet assigned/);
  assert.match(cover, /Monthly rate: not yet set/);
});
