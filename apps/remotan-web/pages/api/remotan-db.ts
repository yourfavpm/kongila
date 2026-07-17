import type { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs';
import path from 'path';

const DB_PATH = path.join(process.cwd(), '../../db.json');

function readDb() {
  try {
    const raw = fs.readFileSync(DB_PATH, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function writeDb(data: any) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    const db = readDb();
    return res.status(200).json({
      // Core shared collections
      talents: db.talents || [],
      contracts: db.contracts || [],
      organizations: db.organizations || [],
      tasks: db.tasks || [],
      agentLogs: db.agentLogs || [],
      notifications: db.notifications || [],
      interviews: db.interviews || [],
      // Remotan-specific collections
      remotanWorkspaces: db.remotanWorkspaces || [],
      workspaceMembers: db.workspaceMembers || [],
      workspaceInvitations: db.workspaceInvitations || [],
      remotanProjects: db.remotanProjects || [],
      remotanTasks: db.remotanTasks || [],
      timeLogs: db.timeLogs || [],
      gdprConsentRecords: db.gdprConsentRecords || [],
      performanceReviewCycles: db.performanceReviewCycles || [],
      remotanPerformanceReviews: db.remotanPerformanceReviews || [],
      calendarEvents: db.calendarEvents || [],
      workspaceMessages: db.workspaceMessages || [],
      payrollEntries: db.payrollEntries || [],
      complianceRecords: db.complianceRecords || [],
      academyResources: db.academyResources || [],
      academyEnrollments: db.academyEnrollments || [],
      remotanAgentLogs: db.remotanAgentLogs || [],
      remotanProjectMilestones: db.remotanProjectMilestones || [],
      remotanTaskDependencies: db.remotanTaskDependencies || [],
      remotanTaskComments: db.remotanTaskComments || [],
      remotanTaskActivityLogs: db.remotanTaskActivityLogs || [],
      remotanBoardColumns: db.remotanBoardColumns || [],
    });
  }

  if (req.method === 'POST') {
    const db = readDb();
    const updates = req.body;
    const merged = { ...db, ...updates };
    writeDb(merged);
    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
