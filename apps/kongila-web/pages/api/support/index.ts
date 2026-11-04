import type { NextApiRequest, NextApiResponse } from 'next';
import { getRequestUser, listTickets, createTicket, replyToTicket } from '@kongila/database';

/**
 * Support, client and candidate side.
 *
 * Both portals used to write to the table from the browser. A ticket was
 * created with no notification to operations, a reply with none to the
 * raiser, and the query decided who saw what rather than the server.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const actor = await getRequestUser(req);
  if (!actor) return res.status(401).json({ error: 'Not authenticated' });

  if (req.method === 'GET') {
    const result = await listTickets(actor);
    if (!result.ok) return res.status(result.status).json({ error: result.error });
    return res.status(200).json(result.data);
  }

  if (req.method === 'POST') {
    const { action } = req.body || {};
    const result = action === 'reply'
      ? await replyToTicket(actor, req.body)
      : await createTicket(actor, req.body);

    if (!result.ok) return res.status(result.status).json({ error: result.error });
    return res.status(result.status).json({ ticket: result.data, warnings: result.warnings });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
