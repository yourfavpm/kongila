/**
 * Run with:  pnpm test
 * (node --test --experimental-strip-types, no test framework installed)
 *
 * pipelineValidation.ts imports nothing, so this file runs without resolving
 * workspace packages. Keep it that way.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { validatePipelineShape, type StageSpec } from './pipelineValidation.ts';

// The real seven, reduced to what the validator needs. Stages 1 to 5 feed the
// composite; 0 (Application Screening) and 6 (Final Review) are pass or fail.
const STAGES: StageSpec[] = [
  { index: 0, name: 'Application Screening', requiresScore: false },
  { index: 1, name: 'Skill Assessment', requiresScore: true },
  { index: 2, name: 'Behavioural Interview', requiresScore: true },
  { index: 3, name: 'Personality Test', requiresScore: true },
  { index: 4, name: 'Remote Readiness', requiresScore: true },
  { index: 5, name: 'Work Simulation', requiresScore: true },
  { index: 6, name: 'Final Review', requiresScore: false }
];

const pipelineOf = (statuses: Array<[string, number?]>) =>
  statuses.map(([status, score], i) => ({
    stageIndex: i,
    stageName: STAGES[i].name,
    status,
    ...(score === undefined ? {} : { score })
  }));

const fresh = () => pipelineOf([
  ['in_progress'], ['pending'], ['pending'], ['pending'], ['pending'], ['pending'], ['pending']
]);

test('a freshly built pipeline is valid', () => {
  assert.equal(validatePipelineShape(fresh(), STAGES), null);
});

test('anything that is not a list is refused', () => {
  for (const bad of [null, undefined, {}, 'pipeline', 7]) {
    assert.match(String(validatePipelineShape(bad, STAGES)), /list of stages/);
  }
});

test('a pipeline with the wrong number of stages is refused', () => {
  const short = fresh().slice(0, 5);
  assert.match(String(validatePipelineShape(short, STAGES)), /has 5/);

  const long = [...fresh(), { stageIndex: 7, status: 'pending' }];
  assert.match(String(validatePipelineShape(long, STAGES)), /has 8/);
});

test('a stage cannot be relabelled as another stage', () => {
  const p = fresh();
  p[3].stageName = 'Final Review';
  assert.match(String(validatePipelineShape(p, STAGES)), /should be Personality Test/);
});

test('a stage cannot claim a different index', () => {
  const p = fresh();
  (p[2] as any).stageIndex = 6;
  assert.match(String(validatePipelineShape(p, STAGES)), /claims to be stage 6/);
});

test('an unknown status is refused', () => {
  const p = fresh();
  p[0].status = 'vetted';
  assert.match(String(validatePipelineShape(p, STAGES)), /not a stage status/);
});

test('a score outside 0 to 100 is refused', () => {
  for (const bad of [-1, 101, 'high']) {
    const p = fresh();
    p[1] = { stageIndex: 1, stageName: 'Skill Assessment', status: 'in_progress', score: bad as any };
    assert.match(String(validatePipelineShape(p, STAGES)), /between 0 and 100/);
  }
});

test('the whole pipeline cannot be posted as passed', () => {
  // The request this exists to stop: everything passed, nothing scored.
  const p = pipelineOf([
    ['passed'], ['passed'], ['passed'], ['passed'], ['passed'], ['passed'], ['passed']
  ]);
  const reason = validatePipelineShape(p, STAGES);
  assert.notEqual(reason, null);
  assert.match(String(reason), /cannot be passed without one/);
});

test('a stage cannot be passed while an earlier stage is still open', () => {
  const p = pipelineOf([
    ['in_progress'], ['pending'], ['pending'], ['pending'], ['pending'], ['pending'], ['passed']
  ]);
  assert.match(
    String(validatePipelineShape(p, STAGES)),
    /Final Review cannot be passed while Application Screening is in_progress/
  );
});

test('a stage cannot be passed when an earlier stage failed', () => {
  const p = pipelineOf([
    ['passed'], ['failed', 20], ['passed', 90], ['pending'], ['pending'], ['pending'], ['pending']
  ]);
  assert.match(String(validatePipelineShape(p, STAGES)), /was rejected/);
});

test('a scored stage cannot be passed without a score', () => {
  const p = pipelineOf([
    ['passed'], ['passed'], ['pending'], ['pending'], ['pending'], ['pending'], ['pending']
  ]);
  assert.match(
    String(validatePipelineShape(p, STAGES)),
    /Skill Assessment produces a score/
  );
});

test('a score of zero counts as a score', () => {
  // Scoring a candidate zero is a real assessment result and must be allowed
  // through; it is an absent score that is refused.
  const p = pipelineOf([
    ['passed'], ['passed', 0], ['in_progress'], ['pending'], ['pending'], ['pending'], ['pending']
  ]);
  assert.equal(validatePipelineShape(p, STAGES), null);
});

test('the unscored stages can be passed without a score', () => {
  // Application Screening and Final Review are pass or fail by design.
  const p = pipelineOf([
    ['passed'], ['passed', 80], ['passed', 80], ['passed', 80], ['passed', 80], ['passed', 80], ['passed']
  ]);
  assert.equal(validatePipelineShape(p, STAGES), null);
});

test('a skipped stage counts as settled, so later stages may pass', () => {
  const p = pipelineOf([
    ['passed'], ['passed', 70], ['passed', 70], ['skipped'], ['passed', 70], ['in_progress'], ['pending']
  ]);
  assert.equal(validatePipelineShape(p, STAGES), null);
});

test('two stages cannot be in progress at once', () => {
  const p = pipelineOf([
    ['passed'], ['in_progress'], ['in_progress'], ['pending'], ['pending'], ['pending'], ['pending']
  ]);
  assert.match(String(validatePipelineShape(p, STAGES)), /Only one stage can be in progress/);
});

test('reopening a failed stage for re-assessment is allowed', () => {
  // Nothing is passed beyond it, so this is a legitimate state.
  const p = pipelineOf([
    ['passed'], ['in_progress'], ['pending'], ['pending'], ['pending'], ['pending'], ['pending']
  ]);
  assert.equal(validatePipelineShape(p, STAGES), null);
});

test('a missing status is treated as pending rather than refused', () => {
  const p: any[] = fresh();
  delete p[4].status;
  assert.equal(validatePipelineShape(p, STAGES), null);
});
