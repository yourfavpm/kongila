import type { NextApiRequest, NextApiResponse } from 'next';
import { readDbAsync, writeDbAsync } from '@kongila/database';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const rawDb = await readDbAsync();
  const db = rawDb as any;
  if (!db.contracts) db.contracts = [];

  if (req.method === 'GET') {
    return res.status(200).json(db.contracts);
  }

  if (req.method === 'POST') {
    const body = req.body;
    const newContract = {
      ...body,
      id: body.id || `KNG-${Date.now()}`,
      status: body.status || 'Draft',
      createdAt: new Date().toISOString(),
    };
    db.contracts.push(newContract);

    db.auditLogs = [
      {
        id: `audit_${Date.now()}`,
        actor: 'Admin Operator',
        action: 'Draft Contract',
        details: `Created contract for ${newContract.talentName} with ${newContract.clientName} as ${newContract.role}.`,
        timestamp: new Date().toISOString(),
      },
      ...(db.auditLogs || []),
    ];
    db.agentLogs = [
      {
        id: `alog_${Date.now()}`,
        agentName: 'Contracts Agent',
        message: `Contract drafted for ${newContract.talentName}. Status: ${newContract.status}.`,
        timestamp: new Date().toLocaleTimeString(),
        type: 'success',
      },
      ...(db.agentLogs || []),
    ];

    await writeDbAsync(db);
    return res.status(201).json(newContract);
  }

  if (req.method === 'PUT') {
    const { id, ...updates } = req.body;
    if (!id) return res.status(400).json({ error: 'Missing contract id' });

    let updated: any = null;
    db.contracts = db.contracts.map((c: any) => {
      if (c.id === id) {
        updated = { ...c, ...updates, updatedAt: new Date().toISOString() };
        return updated;
      }
      return c;
    });

    if (!updated) return res.status(404).json({ error: 'Contract not found' });

    db.auditLogs = [
      {
        id: `audit_${Date.now()}`,
        actor: 'Admin Operator',
        action: updates.status === 'Signed' ? 'Sign Contract' : 'Update Contract',
        details: `Contract ${id} updated. Status: ${updated.status}.`,
        timestamp: new Date().toISOString(),
      },
      ...(db.auditLogs || []),
    ];

    if (updated.status === 'Signed') {
      db.notifications = [
        {
          id: `notif_${Date.now()}`,
          userId: updated.clientId || '',
          title: 'Contract Signed!',
          message: `Your contract for ${updated.role} with ${updated.talentName} is now active.`,
          read: false,
          createdAt: new Date().toISOString(),
        },
        ...(db.notifications || []),
      ];
    }

    await writeDbAsync(db);
    return res.status(200).json(updated);
  }

  if (req.method === 'DELETE') {
    const { id } = req.query;
    db.contracts = db.contracts.filter((c: any) => c.id !== id);
    await writeDbAsync(db);
    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
