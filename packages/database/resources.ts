/**
 * Resources that may be requested through the scoped resources API.
 * Kept independent of database scoping so the portal contract can be tested
 * without loading the database/auth runtime.
 */
export const SCOPED_RESOURCES = [
  'organizations', 'clientProfiles', 'users', 'talents', 'clientRequests', 'matches',
  'notifications', 'rehireRequests', 'supportTickets', 'supportMessages', 'interviews',
  'documents', 'requestActivityLogs', 'assessments', 'assessmentCategories',
  'assessmentQuestions', 'talentSkillAssessments', 'skillAssessmentResults',
  'assessmentAssignments', 'contracts', 'contractTemplates',
  'auditLogs', 'agentLogs', 'invoices', 'payments', 'talentPayouts',
  'platformSettings', 'tagDictionary', 'performanceReviews', 'workSimulationTasks'
] as const;

export type ScopedResource = typeof SCOPED_RESOURCES[number];

const SCOPED_RESOURCE_SET = new Set<string>(SCOPED_RESOURCES);

export function isScopedResource(name: unknown): name is ScopedResource {
  return typeof name === 'string' && SCOPED_RESOURCE_SET.has(name);
}
