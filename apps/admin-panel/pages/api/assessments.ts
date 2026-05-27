import type { NextApiRequest, NextApiResponse } from 'next';
import { readDbAsync, writeDbAsync } from '@kongila/database';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const rawDb = await readDbAsync();
  const db = rawDb as any;
  if (!db.assessments) db.assessments = [];
  if (!db.skillAssessmentResults) db.skillAssessmentResults = [];

  if (req.method === 'GET') {
    const { talentId } = req.query;
    if (talentId) {
      const results = db.skillAssessmentResults.filter((r: any) => r.talentId === talentId);
      return res.status(200).json({ assessments: db.assessments, results });
    }
    return res.status(200).json({ assessments: db.assessments, results: db.skillAssessmentResults });
  }

  if (req.method === 'POST') {
    const { type, ...body } = req.body;

    if (type === 'result') {
      // Save an assessment result
      const newResult = {
        ...body,
        id: `asr_${Date.now()}`,
        completedAt: new Date().toISOString(),
      };
      db.skillAssessmentResults.push(newResult);

      db.auditLogs = [
        {
          id: `audit_${Date.now()}`,
          actor: 'Admin Operator',
          action: 'Record Assessment Result',
          details: `Assessment result recorded for talent ${body.talentId}. Score: ${body.score}%. Status: ${body.passed ? 'Passed' : 'Failed'}.`,
          timestamp: new Date().toISOString(),
        },
        ...(db.auditLogs || []),
      ];

      await writeDbAsync(db);
      return res.status(201).json(newResult);
    }

    // Create new assessment
    const newAssessment = {
      ...body,
      id: `asmnt_${Date.now()}`,
      createdAt: new Date().toISOString(),
      status: 'active',
    };
    db.assessments.push(newAssessment);

    db.auditLogs = [
      {
        id: `audit_${Date.now()}`,
        actor: 'Admin Operator',
        action: 'Create Skill Assessment',
        details: `Assessment "${newAssessment.title}" created with ${newAssessment.questionCount} questions.`,
        timestamp: new Date().toISOString(),
      },
      ...(db.auditLogs || []),
    ];

    // If assigned to specific talents, notify them
    if (body.assignedTalents && Array.isArray(body.assignedTalents)) {
      const notifications = body.assignedTalents.map((talentId: string) => ({
        id: `notif_${Date.now()}_${talentId}`,
        userId: talentId,
        title: 'New Skill Assessment Assigned',
        message: `You have been assigned: "${newAssessment.title}". Please complete it at your earliest convenience.`,
        read: false,
        createdAt: new Date().toISOString(),
      }));
      db.notifications = [...notifications, ...(db.notifications || [])];
    }

    await writeDbAsync(db);
    return res.status(201).json(newAssessment);
  }

  if (req.method === 'PUT') {
    const { id, ...updates } = req.body;
    if (!id) return res.status(400).json({ error: 'Missing assessment id' });

    let updated: any = null;
    db.assessments = db.assessments.map((a: any) => {
      if (a.id === id) {
        updated = { ...a, ...updates, updatedAt: new Date().toISOString() };
        return updated;
      }
      return a;
    });

    if (!updated) return res.status(404).json({ error: 'Assessment not found' });

    await writeDbAsync(db);
    return res.status(200).json(updated);
  }

  if (req.method === 'DELETE') {
    const { id } = req.query;
    db.assessments = db.assessments.filter((a: any) => a.id !== id);
    await writeDbAsync(db);
    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
