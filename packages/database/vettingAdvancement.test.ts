import test from 'node:test';
import assert from 'node:assert/strict';
import { VETTING_STAGES, buildDefaultVettingPipeline, advanceTalentStage } from '../matching-engine/index.ts';
import { getVettingStageAdvancement } from './vettingAdvancement.ts';
import { buildNotification } from '../notifications/events.ts';

test('each real stage approval targets exactly the configured next stage', () => {
  for (const stage of VETTING_STAGES.slice(0, -1)) {
    const prior = buildDefaultVettingPipeline().map(record => ({ ...record, status: 'pending' as const }));
    prior[stage.index] = { ...prior[stage.index], status: 'in_progress' };
    const next = advanceTalentStage(prior as any, stage.index, 'Proceed', 75, 'Reviewed');
    const transition = getVettingStageAdvancement(prior, next);

    assert.deepEqual(transition, {
      fromStage: stage.name,
      toStage: VETTING_STAGES[stage.index + 1].name
    });
    const email = buildNotification('stage_advanced', { stageName: transition?.toStage });
    assert.match(email.subject, new RegExp(VETTING_STAGES[stage.index + 1].name));
    assert.doesNotMatch(email.subject, new RegExp(`advanced to ${stage.name}`));
  }
});

test('a repeated approval of an already passed stage is not a new transition', () => {
  const prior = buildDefaultVettingPipeline().map(record => ({ ...record, status: 'pending' as const }));
  prior[0] = { ...prior[0], status: 'passed' };
  prior[1] = { ...prior[1], status: 'in_progress' };
  const repeated = prior.map(record => ({ ...record }));
  assert.equal(getVettingStageAdvancement(prior, repeated), null);
});

test('an incomplete or non-sequential pipeline update does not notify', () => {
  const prior = buildDefaultVettingPipeline();
  const passedWithoutNext = prior.map(record => ({ ...record }));
  passedWithoutNext[0] = { ...passedWithoutNext[0], status: 'passed' };
  assert.equal(getVettingStageAdvancement(prior, passedWithoutNext), null);

  const skipped = prior.map(record => ({ ...record }));
  skipped[0] = { ...skipped[0], status: 'passed' };
  skipped[2] = { ...skipped[2], status: 'in_progress' };
  assert.equal(getVettingStageAdvancement(prior, skipped), null);

  const rejected = prior.map(record => ({ ...record }));
  rejected[0] = { ...rejected[0], status: 'failed' };
  assert.equal(getVettingStageAdvancement(prior, rejected), null);

  const ambiguousPrior = prior.map(record => ({ ...record }));
  ambiguousPrior[1] = { ...ambiguousPrior[1], status: 'in_progress' };
  const ambiguousNext = ambiguousPrior.map(record => ({ ...record }));
  ambiguousNext[0] = { ...ambiguousNext[0], status: 'passed' };
  assert.equal(getVettingStageAdvancement(ambiguousPrior, ambiguousNext), null);
});

test('final-stage approval preserves final completion behaviour without a next-stage email', () => {
  const prior = buildDefaultVettingPipeline().map(record => ({ ...record, status: 'passed' as const }));
  const finalIndex = VETTING_STAGES.length - 1;
  prior[finalIndex] = { ...prior[finalIndex], status: 'in_progress' };
  const next = prior.map(record => ({ ...record }));
  next[finalIndex] = { ...next[finalIndex], status: 'passed' };
  assert.equal(getVettingStageAdvancement(prior, next), null);
});
