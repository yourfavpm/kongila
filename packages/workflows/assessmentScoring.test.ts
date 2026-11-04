import test from 'node:test';
import assert from 'node:assert/strict';

import { scoreAssessment, answerMatches } from './assessmentScoring.ts';

const QUESTIONS = [
  { id: 'q1', type: 'multiple_choice', category_id: 'c1', correct_answer: 'a', scoring_weight: 1 },
  { id: 'q2', type: 'multiple_choice', category_id: 'c1', correct_answer: 'b', scoring_weight: 3 },
  { id: 'q3', type: 'short_answer', category_id: 'c1' },
  { id: 'q4', type: 'multiple_choice', category_id: 'other', correct_answer: 'a', scoring_weight: 1 }
];

// ─── The hole this closes ────────────────────────────────────────────────────

test('the score comes from the answer key, not from the submission', () => {
  // The browser posted its own score to a table with RLS off. Whatever the
  // submission claims, only the answers are read here.
  const result = scoreAssessment(
    QUESTIONS, { q1: 'a', q2: 'wrong', score: 100 } as any, ['c1'], 70
  );
  assert.equal(result.autoScore, 25);
});

test('weighting is applied', () => {
  const result = scoreAssessment(QUESTIONS, { q1: 'wrong', q2: 'b' }, ['c1'], 70);
  assert.equal(result.autoScore, 75);
});

test('a question from a category this assessment does not use is ignored', () => {
  // q4 is correct but belongs to another category, so it cannot lift a score.
  const result = scoreAssessment(QUESTIONS, { q1: 'a', q2: 'b', q4: 'a' }, ['c1'], 70);
  assert.equal(result.autoScore, 100);
});

test('an unanswered question counts against the total', () => {
  // Skipping everything but one easy question is not a 100.
  const result = scoreAssessment(QUESTIONS, { q1: 'a' }, ['c1'], 70);
  assert.equal(result.autoScore, 25);
});

// ─── Multi-answer questions ──────────────────────────────────────────────────

test('a multi-answer question matches regardless of order', () => {
  assert.equal(answerMatches(['a', 'b'], ['b', 'a']), true);
  assert.equal(answerMatches(['a', 'b'], ['a']), false);
  assert.equal(answerMatches(['a', 'b'], ['a', 'b', 'c']), false);
});

test('a single answer compares as a value, not a list', () => {
  assert.equal(answerMatches('a', 'a'), true);
  assert.equal(answerMatches('a', ['a']), true);
  assert.equal(answerMatches('a', 'b'), false);
});

// ─── Splitting the answers ───────────────────────────────────────────────────

test('subjective answers are separated by question type, not by the caller', () => {
  const result = scoreAssessment(
    QUESTIONS, { q1: 'a', q3: 'I would start by reading the logs.' }, ['c1'], 70
  );
  assert.deepEqual(Object.keys(result.objectiveAnswers), ['q1']);
  assert.deepEqual(Object.keys(result.subjectiveAnswers), ['q3']);
  assert.equal(result.hasSubjective, true);
});

// ─── Passing ─────────────────────────────────────────────────────────────────

test('a pass is only decided once nothing is left to mark by hand', () => {
  const withWritten = scoreAssessment(QUESTIONS, { q1: 'a', q2: 'b', q3: 'text' }, ['c1'], 70);
  assert.equal(withWritten.passed, null, 'a human still has to mark q3');

  const mcqOnly = scoreAssessment(QUESTIONS, { q1: 'a', q2: 'b' }, ['c1'], 70);
  assert.equal(mcqOnly.passed, true);

  const failed = scoreAssessment(QUESTIONS, { q1: 'a' }, ['c1'], 70);
  assert.equal(failed.passed, false);
});

test('an assessment with no multiple choice has no automatic score', () => {
  const result = scoreAssessment(
    [{ id: 'q3', type: 'short_answer', category_id: 'c1' }], { q3: 'text' }, ['c1'], 70
  );
  assert.equal(result.autoScore, null);
  assert.equal(result.passed, null);
});

test('an empty submission scores zero rather than throwing', () => {
  const result = scoreAssessment(QUESTIONS, {}, ['c1'], 70);
  assert.equal(result.autoScore, 0);
  assert.equal(result.hasSubjective, false);
});

test('a weight of zero or nonsense falls back to one', () => {
  const questions = [
    { id: 'q1', type: 'multiple_choice', category_id: 'c1', correct_answer: 'a', scoring_weight: 0 },
    { id: 'q2', type: 'multiple_choice', category_id: 'c1', correct_answer: 'a', scoring_weight: null }
  ];
  const result = scoreAssessment(questions, { q1: 'a', q2: 'b' }, ['c1'], 70);
  assert.equal(result.autoScore, 50);
});
