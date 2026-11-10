/**
 * Run with:  pnpm test
 * (node --test --experimental-strip-types, no test framework installed)
 *
 * assessmentScoring.ts imports nothing, so this runs without resolving
 * workspace packages. Keep it that way.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { finalAssessmentScore, type ScoredQuestion } from './assessmentScoring.ts';

const CATEGORIES = ['cat_1'];

// Two multiple choice worth 1 each, two written worth 10 each: 22 marks.
const QUESTIONS: ScoredQuestion[] = [
  { id: 'q1', type: 'multiple_choice', category_id: 'cat_1', correct_answer: 'a', scoring_weight: 1 },
  { id: 'q2', type: 'multiple_choice', category_id: 'cat_1', correct_answer: ['b', 'c'], scoring_weight: 1 },
  { id: 'q3', type: 'long_text', category_id: 'cat_1', max_score: 10 },
  { id: 'q4', type: 'code', category_id: 'cat_1', max_score: 10 }
];

test('a fully marked paper scores over the whole paper, not just the multiple choice', () => {
  const out = finalAssessmentScore(
    QUESTIONS,
    { q1: 'a', q2: ['c', 'b'], q3: 'an answer', q4: 'some code' },
    { q3: { score: 8 }, q4: { score: 6 } },
    CATEGORIES,
    70
  );

  assert.equal(out.autoEarned, 2);
  assert.equal(out.autoMax, 2);
  assert.equal(out.manualEarned, 14);
  assert.equal(out.manualMax, 20);
  // 16 of 22.
  assert.equal(out.score, 73);
  assert.equal(out.isFullyMarked, true);
  assert.equal(out.passed, true);
});

test('acing the multiple choice and writing nothing is not full marks', () => {
  // The old arithmetic scored the objective half alone and returned 100 here,
  // which is how a candidate who answered two of four questions was recorded
  // as perfect.
  const out = finalAssessmentScore(
    QUESTIONS,
    { q1: 'a', q2: ['b', 'c'] },
    { q3: { score: 0 }, q4: { score: 0 } },
    CATEGORIES,
    70
  );
  assert.equal(out.score, 9);
  assert.equal(out.passed, false);
});

test('an unmarked written answer is counted in the total but earns nothing', () => {
  const out = finalAssessmentScore(
    QUESTIONS,
    { q1: 'a', q2: ['b', 'c'], q3: 'an answer', q4: 'some code' },
    { q3: { score: 10 } },
    CATEGORIES,
    70
  );

  assert.deepEqual(out.unmarked, ['q4']);
  assert.equal(out.isFullyMarked, false);
  // 12 of 22 so far, and it can only rise.
  assert.equal(out.score, 55);
  // Not decided while something is unmarked, so a half-marked paper never
  // reads as a failure.
  assert.equal(out.passed, null);
});

test('a mark may be given as a bare number as well as an object', () => {
  const asObject = finalAssessmentScore(QUESTIONS, {}, { q3: { score: 5 }, q4: { score: 5 } }, CATEGORIES, 70);
  const asNumber = finalAssessmentScore(QUESTIONS, {}, { q3: 5, q4: 5 }, CATEGORIES, 70);
  assert.equal(asObject.score, asNumber.score);
  assert.equal(asNumber.manualEarned, 10);
});

test('zero is a mark, not a missing mark', () => {
  // The distinction that decides whether a paper is finished.
  const out = finalAssessmentScore(QUESTIONS, {}, { q3: 0, q4: 0 }, CATEGORIES, 70);
  assert.deepEqual(out.unmarked, []);
  assert.equal(out.isFullyMarked, true);
  assert.equal(out.passed, false);
});

test('a mark outside the question is clamped rather than refused', () => {
  // A typo at question twenty must not throw away the nineteen before it.
  const over = finalAssessmentScore(QUESTIONS, {}, { q3: 999, q4: 0 }, CATEGORIES, 70);
  assert.equal(over.manualEarned, 10);

  const under = finalAssessmentScore(QUESTIONS, {}, { q3: -50, q4: 0 }, CATEGORIES, 70);
  assert.equal(under.manualEarned, 0);
});

test('a written question with no max_score is worth ten', () => {
  const out = finalAssessmentScore(
    [{ id: 'q1', type: 'long_text', category_id: 'cat_1' }],
    {},
    { q1: 7 },
    CATEGORIES,
    70
  );
  assert.equal(out.manualMax, 10);
  assert.equal(out.score, 70);
});

test('a question from another assessment is ignored', () => {
  // The question bank is shared; an assessment picks categories out of it.
  const out = finalAssessmentScore(
    [...QUESTIONS, { id: 'other', type: 'long_text', category_id: 'cat_99', max_score: 100 }],
    { q1: 'a', q2: ['b', 'c'] },
    { q3: 10, q4: 10 },
    CATEGORIES,
    70
  );
  assert.equal(out.manualMax, 20);
  assert.equal(out.score, 100);
});

test('multiple choice ignores the order the options came back in', () => {
  const out = finalAssessmentScore(QUESTIONS, { q2: ['c', 'b'] }, { q3: 0, q4: 0 }, CATEGORIES, 70);
  assert.equal(out.autoEarned, 1);
});

test('an assessment with no questions scores zero rather than dividing by zero', () => {
  const out = finalAssessmentScore([], {}, {}, CATEGORIES, 70);
  assert.equal(out.score, 0);
  assert.equal(out.isFullyMarked, true);
});

test('with no pass mark set, passed is undecided rather than false', () => {
  const out = finalAssessmentScore(QUESTIONS, { q1: 'a' }, { q3: 10, q4: 10 }, CATEGORIES, null);
  assert.equal(out.passed, null);
});

test('rubbish in the marks object does not become a mark', () => {
  // subjectiveScores is jsonb, so anything can arrive in it.
  const out = finalAssessmentScore(
    QUESTIONS,
    {},
    { q3: 'eight' as any, q4: null },
    CATEGORIES,
    70
  );
  assert.deepEqual(out.unmarked.sort(), ['q3', 'q4']);
  assert.equal(out.manualEarned, 0);
});
