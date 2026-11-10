import test from 'node:test';
import assert from 'node:assert/strict';
import { isScopedResource } from './resources.ts';

test('both portals resource lists are accepted by the shared resources API', () => {
  const adminResources = [
    'organizations', 'clientProfiles', 'users', 'talents', 'clientRequests',
    'matches', 'notifications', 'rehireRequests', 'supportTickets', 'supportMessages',
    'interviews', 'documents', 'requestActivityLogs', 'assessments',
    'assessmentCategories', 'assessmentQuestions', 'assessmentAssignments',
    'skillAssessmentResults', 'talentSkillAssessments', 'workSimulationTasks',
    'contracts', 'contractTemplates', 'auditLogs', 'agentLogs', 'invoices',
    'payments', 'talentPayouts'
  ];
  const clientResources = [
    'organizations', 'clientProfiles', 'users', 'talents', 'clientRequests',
    'matches', 'notifications', 'rehireRequests', 'supportTickets', 'interviews',
    'documents', 'requestActivityLogs', 'assessments', 'assessmentCategories',
    'assessmentQuestions', 'talentSkillAssessments', 'skillAssessmentResults',
    'workSimulationTasks'
  ];

  for (const resource of [...adminResources, ...clientResources]) {
    assert.equal(isScopedResource(resource), true, `${resource} must be allowed`);
  }
});

test('unknown resources remain rejected', () => {
  assert.equal(isScopedResource('unlistedResource'), false);
});
