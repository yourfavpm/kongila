/**
 * Run with:  pnpm test
 * (node --test --experimental-strip-types, no test framework installed)
 *
 * grading.ts imports nothing, so this file runs without resolving workspace
 * packages. Keep it that way.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  COMPOSITE_WEIGHTS,
  DROPPED_DIMENSIONS,
  calculateCompositeVettingGrade,
  gradeForScore
} from './grading.ts';

test('the weights add up to exactly 1', () => {
  const total = COMPOSITE_WEIGHTS.reduce((sum, d) => sum + d.weight, 0);
  assert.equal(Math.round(total * 1000) / 1000, 1);
});

test('every weighted dimension has a vetting stage that produces it', () => {
  // This is the guard on the open scope question. Adding communication or
  // experience to COMPOSITE_WEIGHTS before a stage produces a score for them
  // would cap every candidate below A+, so it fails here instead of quietly
  // downgrading the whole talent pool.
  for (const dimension of COMPOSITE_WEIGHTS) {
    assert.notEqual(
      dimension.producedByStage,
      null,
      `${dimension.key} is weighted but no vetting stage produces a score for it`
    );
  }
});

test('the dropped dimensions stay dropped', () => {
  // communication and experience were removed from the model on 2 Nov 2026.
  // Adding either back without building an input for it would cap every
  // candidate below A+, so it fails here first.
  const weighted = new Set(COMPOSITE_WEIGHTS.map(d => d.key));
  for (const key of DROPPED_DIMENSIONS) {
    assert.equal(weighted.has(key as any), false, `${key} has no input but carries weight`);
  }
});

test('a dropped dimension cannot change a score', () => {
  const withoutThem = calculateCompositeVettingGrade({ technical: 80, behavioral: 80 });
  const withThem = calculateCompositeVettingGrade({
    technical: 80, behavioral: 80, communication: 100, experience: 100
  });
  assert.deepEqual(withThem, withoutThem);
});

test('a candidate who scores full marks on every measured stage reaches 100', () => {
  // The real point of this one: a strong candidate must be able to reach A+.
  // Under the scope's seven weights with communication and experience always
  // zero, the ceiling would be 80 and nobody could ever be graded A+.
  const perfect = Object.fromEntries(COMPOSITE_WEIGHTS.map(d => [d.key, 100]));
  const { score, grade } = calculateCompositeVettingGrade(perfect as any);
  assert.equal(score, 100);
  assert.equal(grade, 'A+');
});

test('an empty score set is a Reject, not a pass', () => {
  assert.deepEqual(calculateCompositeVettingGrade({}), { score: 0, grade: 'Reject' });
  assert.deepEqual(calculateCompositeVettingGrade(null), { score: 0, grade: 'Reject' });
});

test('stages 3, 4 and 5 are worth 40 points between them', () => {
  // Personality, Remote Readiness and Work Simulation. If those stages pass
  // without producing a score, this much of the composite is structurally
  // zero and the best possible result is 60, which grades as Reject.
  const stageKeys = COMPOSITE_WEIGHTS.filter(d => [3, 4, 5].includes(d.producedByStage as number));
  const weight = stageKeys.reduce((sum, d) => sum + d.weight, 0);
  assert.equal(Math.round(weight * 100), 40);

  const onlyEarlyStages = { technical: 100, behavioral: 100 };
  const { score, grade } = calculateCompositeVettingGrade(onlyEarlyStages);
  assert.equal(score, 60);
  assert.equal(grade, 'Reject');
});

test('grade boundaries are inclusive at the threshold', () => {
  assert.equal(gradeForScore(85), 'A+');
  assert.equal(gradeForScore(84), 'A');
  assert.equal(gradeForScore(75), 'A');
  assert.equal(gradeForScore(74), 'B');
  assert.equal(gradeForScore(65), 'B');
  assert.equal(gradeForScore(64), 'Reject');
});

test('scores outside 0-100 are clamped rather than trusted', () => {
  assert.equal(calculateCompositeVettingGrade({ technical: 500 }).score, 30);
  assert.equal(calculateCompositeVettingGrade({ technical: -50 }).score, 0);
  assert.equal(calculateCompositeVettingGrade({ technical: NaN }).score, 0);
});
