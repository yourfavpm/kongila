import test from 'node:test';
import assert from 'node:assert/strict';

import {
  canAssignWorkSimulation,
  canManageWorkSimulation,
  canMarkWorkSimulation,
  canSubmitWorkSimulation,
  deadlinePassed,
  isWorkSimulationStageActive,
  ownsWorkSimulationTask,
  validateWorkSimulationScore,
  validateWorkSimulationSubmission
} from './workSimulationRules.ts';

test('a due date remains open through the named UTC day', () => {
  const deadline = '2026-11-14';
  assert.equal(deadlinePassed(deadline, Date.parse('2026-11-14T23:59:59.999Z')), false);
  assert.equal(deadlinePassed(deadline, Date.parse('2026-11-15T00:00:00.001Z')), true);
  assert.equal(deadlinePassed(null), false);
  assert.equal(deadlinePassed('not-a-date'), false);
});

test('only assigned and in-progress tasks accept candidate submissions', () => {
  assert.equal(canSubmitWorkSimulation('assigned'), true);
  assert.equal(canSubmitWorkSimulation('in_progress'), true);
  for (const status of ['submitted', 'marked', 'expired', 'cancelled']) {
    assert.equal(canSubmitWorkSimulation(status), false);
  }
});

test('only submitted tasks can be marked, and same-score retries are idempotent', () => {
  assert.equal(canMarkWorkSimulation('submitted'), true);
  assert.equal(canMarkWorkSimulation('marked'), true);
  assert.equal(canMarkWorkSimulation('assigned'), false);
  assert.equal(canMarkWorkSimulation('expired'), false);
});

test('submission and marking require the assigned task in the active work-simulation stage', () => {
  const pipeline: any[] = Array.from({ length: 7 }, () => ({ status: 'pending' }));
  pipeline[5] = { status: 'in_progress', taskId: 'task-1' };
  assert.equal(isWorkSimulationStageActive(pipeline, 'task-1'), true);
  assert.equal(isWorkSimulationStageActive(pipeline, 'task-2'), false);
  assert.equal(isWorkSimulationStageActive(pipeline), true);
  assert.equal(canAssignWorkSimulation(pipeline), false);
  delete pipeline[5].taskId;
  assert.equal(canAssignWorkSimulation(pipeline), true);
  pipeline[5].status = 'passed';
  assert.equal(isWorkSimulationStageActive(pipeline, 'task-1'), false);
  assert.equal(canAssignWorkSimulation(pipeline), false);
  assert.equal(isWorkSimulationStageActive(null, 'task-1'), false);
});

test('a candidate can only submit a task owned by their talent profile', () => {
  assert.equal(ownsWorkSimulationTask({ talent_id: 'talent-1' }, 'talent-1'), true);
  assert.equal(ownsWorkSimulationTask({ talent_id: 'talent-2' }, 'talent-1'), false);
  assert.equal(ownsWorkSimulationTask(null, 'talent-1'), false);
});

test('work simulation administration is limited to operational roles', () => {
  for (const role of ['admin', 'super_admin', 'talent_manager', 'ops_manager', 'operations_manager']) {
    assert.equal(canManageWorkSimulation(role), true);
  }
  for (const role of ['client', 'talent', 'finance', 'account_manager']) {
    assert.equal(canManageWorkSimulation(role), false);
  }
});

test('link submissions require an HTTPS URL and cannot include a text answer', () => {
  const base = { submissionType: 'link', talentId: 'talent-1', submissionText: '' };
  assert.equal(validateWorkSimulationSubmission({ ...base, submissionUrl: 'https://example.com/work' }), null);
  assert.match(String(validateWorkSimulationSubmission({ ...base, submissionUrl: 'http://example.com' })), /HTTPS/);
  assert.match(String(validateWorkSimulationSubmission({ ...base, submissionUrl: 'https://user:pass@example.com' })), /HTTPS/);
  assert.match(String(validateWorkSimulationSubmission({
    ...base, submissionUrl: 'https://example.com', submissionText: 'answer'
  })), /not a written response/);
});

test('text submissions require text and reject links', () => {
  const base = { submissionType: 'text', talentId: 'talent-1', submissionUrl: '' };
  assert.equal(validateWorkSimulationSubmission({ ...base, submissionText: 'My answer', submissionUrl: '' }), null);
  assert.match(String(validateWorkSimulationSubmission({ ...base, submissionText: '', submissionUrl: '' })), /Write your response/);
  assert.match(String(validateWorkSimulationSubmission({
    ...base, submissionText: 'My answer', submissionUrl: 'https://example.com'
  })), /not a link/);
});

test('file submissions must point to a document owned by the submitting candidate', () => {
  const base = { submissionType: 'file', talentId: 'talent-1', submissionText: '' };
  assert.equal(validateWorkSimulationSubmission({
    ...base, submissionUrl: 'https://project.supabase.co/storage/v1/object/public/documents/talent-1/work.pdf'
  }), null);
  assert.match(String(validateWorkSimulationSubmission({
    ...base, submissionUrl: 'https://project.supabase.co/storage/v1/object/public/documents/talent-2/work.pdf'
  })), /Upload your file/);
  assert.match(String(validateWorkSimulationSubmission({
    ...base, submissionUrl: 'https://example.com/work.pdf'
  })), /Upload your file/);
});

test('scores accept zero and the maximum but reject missing and out-of-range values', () => {
  assert.deepEqual(validateWorkSimulationScore(0, 100), { score: 0 });
  assert.deepEqual(validateWorkSimulationScore(100, 100), { score: 100 });
  assert.match(String(validateWorkSimulationScore('', 100).error), /required/);
  assert.match(String(validateWorkSimulationScore('high', 100).error), /required/);
  assert.match(String(validateWorkSimulationScore(true, 100).error), /required/);
  assert.match(String(validateWorkSimulationScore(-1, 100).error), /between 0 and 100/);
  assert.match(String(validateWorkSimulationScore(101, 100).error), /between 0 and 100/);
});
