import type { NextApiRequest, NextApiResponse } from 'next';
import {
  getRequestUser,
  listConversations,
  startConversation,
  sendMessage,
  markMessagesRead
} from '@kongila/database';

/**
 * Messaging.
 *
 * The same route in both portals, because the rules are the same and the
 * service enforces them: you see the threads you are a participant in, and
 * nothing else. The admin portal had no messaging at all, so a candidate or
 * client writing to support was writing into a void.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const actor = await getRequestUser(req);
  if (!actor) return res.status(401).json({ error: 'Not authenticated' });

  if (req.method === 'GET') {
    const result = await listConversations(actor);
    if (!result.ok) return res.status(result.status).json({ error: result.error });
    return res.status(200).json(result.data);
  }

  if (req.method === 'POST') {
    const { action } = req.body || {};

    const result =
      action === 'start' ? await startConversation(actor, req.body)
      : action === 'markRead' ? await markMessagesRead(actor, req.body)
      : await sendMessage(actor, req.body);

    if (!result.ok) return res.status(result.status).json({ error: result.error });
    return res.status(result.status).json({ data: result.data, warnings: result.warnings });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
