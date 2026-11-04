import type { NextApiRequest, NextApiResponse } from 'next';
import {
  createTicket,
  getRequestUser,
  listTickets,
  replyToTicket,
  setTicketStatus
} from '@kongila/database';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const actor = await getRequestUser(req);
  if (!actor) return res.status(401).json({ error: 'Not authenticated' });

  if (req.method === 'GET') {
    const result = await listTickets(actor);
    if (!result.ok) return res.status(result.status).json({ error: result.error });
    return res.status(200).json(result.data);
  }

  if (req.method === 'POST') {
    const body = req.body || {};
    const result = body.type === 'message'
      ? await replyToTicket(actor, {
          ticketId: String(body.ticketId || ''),
          text: String(body.text || '')
        })
      : await createTicket(actor, {
          subject: String(body.subject || ''),
          category: String(body.category || ''),
          description: body.description,
          linkedContractId: body.linkedContractId || null
        });

    if (!result.ok) return res.status(result.status).json({ error: result.error });
    return res.status(result.status).json({
      ...(body.type === 'message' ? { message: result.data } : { ticket: result.data }),
      warnings: result.warnings
    });
  }

  if (req.method === 'PUT') {
    const result = await setTicketStatus(actor, {
      ticketId: String(req.body?.id || req.body?.ticketId || ''),
      status: String(req.body?.status || ''),
      assignedTo: req.body?.assignedTo
    });
    if (!result.ok) return res.status(result.status).json({ error: result.error });
    return res.status(200).json(result.data);
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
