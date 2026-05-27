import type { NextApiRequest, NextApiResponse } from 'next';
import { readDbAsync, writeDbAsync } from '@kongila/database';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const rawDb = await readDbAsync();
  const db = rawDb as any;
  if (!db.supportTickets) db.supportTickets = [];
  if (!db.supportMessages) db.supportMessages = [];

  if (req.method === 'GET') {
    return res.status(200).json({
      tickets: db.supportTickets,
      messages: db.supportMessages,
    });
  }

  if (req.method === 'POST') {
    const { type, ...body } = req.body;

    if (type === 'message') {
      // Reply to a ticket
      const newMessage = {
        ...body,
        id: `msg_admin_${Date.now()}`,
        isSupport: true,
        timestamp: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
        createdAt: new Date().toISOString(),
      };
      db.supportMessages.push(newMessage);

      // Update ticket lastActivity
      db.supportTickets = db.supportTickets.map((t: any) =>
        t.id === body.ticketId
          ? { ...t, lastActivity: 'Active', status: t.status === 'Resolved' ? t.status : 'In Progress' }
          : t
      );

      db.auditLogs = [
        {
          id: `audit_${Date.now()}`,
          actor: 'Admin Support',
          action: 'Reply to Support Ticket',
          details: `Replied to ticket ${body.ticketId}. Message: "${body.text?.slice(0, 60)}..."`,
          timestamp: new Date().toISOString(),
        },
        ...(db.auditLogs || []),
      ];

      // Notify talent
      const ticket = db.supportTickets.find((t: any) => t.id === body.ticketId);
      if (ticket?.talentId) {
        db.notifications = [
          {
            id: `notif_${Date.now()}`,
            userId: ticket.talentId,
            title: 'Support Ticket Update',
            message: `An admin has responded to your ticket: "${ticket.subject}".`,
            read: false,
            createdAt: new Date().toISOString(),
          },
          ...(db.notifications || []),
        ];
      }

      await writeDbAsync(db);
      return res.status(201).json(newMessage);
    }

    // Create new ticket (admin-created)
    const newTicket = {
      ...body,
      id: `TK-${Math.floor(10000 + Math.random() * 90000)}`,
      status: 'Open',
      lastActivity: 'Active',
      createdAt: new Date().toISOString(),
    };
    db.supportTickets.push(newTicket);
    await writeDbAsync(db);
    return res.status(201).json(newTicket);
  }

  if (req.method === 'PUT') {
    const { id, ...updates } = req.body;
    if (!id) return res.status(400).json({ error: 'Missing ticket id' });

    let updated: any = null;
    db.supportTickets = db.supportTickets.map((t: any) => {
      if (t.id === id) {
        updated = { ...t, ...updates, updatedAt: new Date().toISOString() };
        return updated;
      }
      return t;
    });

    if (!updated) return res.status(404).json({ error: 'Ticket not found' });

    db.auditLogs = [
      {
        id: `audit_${Date.now()}`,
        actor: 'Admin Support',
        action: 'Update Ticket Status',
        details: `Ticket ${id} status changed to "${updated.status}".`,
        timestamp: new Date().toISOString(),
      },
      ...(db.auditLogs || []),
    ];

    if (updated.status === 'Resolved' && updated.talentId) {
      db.notifications = [
        {
          id: `notif_${Date.now()}`,
          userId: updated.talentId,
          title: 'Support Ticket Resolved',
          message: `Your ticket "${updated.subject}" has been resolved.`,
          read: false,
          createdAt: new Date().toISOString(),
        },
        ...(db.notifications || []),
      ];
    }

    await writeDbAsync(db);
    return res.status(200).json(updated);
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
