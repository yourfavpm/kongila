import type { NextApiRequest, NextApiResponse } from 'next';
import { getRequestUser, readDbAsync, scopeDbForUser, signDbFileUrls } from '@kongila/database';

const ALLOWED_RESOURCES = new Set([
  'organizations', 'clientProfiles', 'users', 'talents', 'clientRequests', 'matches',
  'notifications', 'rehireRequests', 'supportTickets', 'supportMessages', 'interviews',
  'documents', 'requestActivityLogs', 'assessments', 'assessmentCategories',
  'assessmentQuestions', 'talentSkillAssessments', 'skillAssessmentResults',
  'assessmentAssignments', 'workSimulationTasks', 'contracts', 'contractTemplates',
  'auditLogs', 'agentLogs', 'invoices', 'payments', 'talentPayouts'
]);

/** Read one allowlisted, server-scoped resource. This route never writes. */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const actor = await getRequestUser(req);
  if (!actor) return res.status(401).json({ error: 'Not authenticated' });

  const resource = String(req.query.resource || '');
  if (!ALLOWED_RESOURCES.has(resource)) return res.status(404).json({ error: 'Resource not found' });

  try {
    const db = await readDbAsync();
    const scoped = await signDbFileUrls(scopeDbForUser(db, actor));
    return res.status(200).json({ resource, data: (scoped as any)?.[resource] || [] });
  } catch (error) {
    console.error(`[api/resources/${resource}] failed`, error);
    return res.status(500).json({ error: 'Could not load resource' });
  }
}
