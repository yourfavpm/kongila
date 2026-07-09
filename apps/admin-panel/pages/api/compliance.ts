import type { NextApiRequest, NextApiResponse } from 'next';
import { readDbAsync, writeDbAsync } from '@kongila/database';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const rawDb = await readDbAsync();
  const db = rawDb as any;
  if (!db.documents) db.documents = [];

  if (req.method === 'GET') {
    // Only return non-hidden documents
    const visibleDocs = db.documents.filter((d: any) => !d.isHidden);
    return res.status(200).json(visibleDocs);
  }

  if (req.method === 'POST') {
    const body = req.body;
    const newDoc = {
      ...body,
      id: `doc_${Date.now()}`,
      status: body.status || 'pending_signature',
      uploadedAt: new Date().toISOString(),
      isHidden: false,
    };
    db.documents.push(newDoc);

    db.auditLogs = [
      {
        id: `audit_${Date.now()}`,
        actor: 'Admin Operator',
        action: 'Create Compliance Document',
        details: `Created "${newDoc.name}" (${newDoc.type}) for ${newDoc.isMandatory ? 'All Talents' : (newDoc.userId || 'N/A')}.`,
        timestamp: new Date().toISOString(),
      },
      ...(db.auditLogs || []),
    ];

    if (newDoc.userId && !newDoc.isMandatory) {
      db.notifications = [
        {
          id: `notif_${Date.now()}`,
          userId: newDoc.userId,
          title: 'New Document Requires Your Signature',
          message: `Please review and sign: "${newDoc.name}".`,
          read: false,
          createdAt: new Date().toISOString(),
        },
        ...(db.notifications || []),
      ];
    }

    await writeDbAsync(db);
    return res.status(201).json(newDoc);
  }

  if (req.method === 'PUT') {
    const { id, ...updates } = req.body;
    if (!id) return res.status(400).json({ error: 'Missing document id' });

    let updated: any = null;
    db.documents = db.documents.map((d: any) => {
      if (d.id === id) {
        updated = { ...d, ...updates, updatedAt: new Date().toISOString() };
        return updated;
      }
      return d;
    });

    if (!updated) return res.status(404).json({ error: 'Document not found' });

    db.auditLogs = [
      {
        id: `audit_${Date.now()}`,
        actor: 'Admin Operator',
        action: 'Update Document Status',
        details: `Document "${updated.name}" status updated to "${updated.status}".`,
        timestamp: new Date().toISOString(),
      },
      ...(db.auditLogs || []),
    ];

    await writeDbAsync(db);
    return res.status(200).json(updated);
  }

  if (req.method === 'PUT') {
    const { id, isHidden } = req.body;
    const docIndex = db.documents.findIndex((d: any) => d.id === id);
    if (docIndex > -1) {
      db.documents[docIndex].isHidden = isHidden;
      await writeDbAsync(db);
      return res.status(200).json(db.documents[docIndex]);
    }
    return res.status(404).json({ error: 'Document not found' });
  }

  if (req.method === 'DELETE') {
    const { id } = req.query;
    // Instead of deleting, mark as hidden
    let hidden: any = null;
    db.documents = db.documents.map((d: any) => {
      if (d.id === id) {
        hidden = { ...d, isHidden: true, updatedAt: new Date().toISOString() };
        return hidden;
      }
      return d;
    });
    
    if (hidden) {
      db.auditLogs = [
        {
          id: `audit_${Date.now()}`,
          actor: 'Admin Operator',
          action: 'Hide Compliance Document',
          details: `Document "${hidden.name}" was hidden.`,
          timestamp: new Date().toISOString(),
        },
        ...(db.auditLogs || []),
      ];
      await writeDbAsync(db);
    }
    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
