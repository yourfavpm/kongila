import type { NextApiRequest, NextApiResponse } from 'next';
import {
  getRequestUser,
  listTalents,
  getTalent,
  getMatchingBoard
} from '@kongila/database';

/**
 * The candidate directory.
 *
 * The talent detail page, the matching screen and the dashboard each read
 * every candidate on the platform through /api/db and filtered in the
 * browser. /api/db returns about twenty tables, so rendering one
 * candidate's page also pulled every contract, invoice and message.
 *
 * GET                        every candidate
 * GET ?shortlistable=true    only those who may be put in front of a client
 * GET ?id=                   one candidate with their documents, assessments,
 *                            matches, interviews and contracts
 * GET ?requestId=            the matching board: the request, the candidates
 *                            who may be shortlisted for it, and its matches
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const actor = await getRequestUser(req);
  if (!actor) return res.status(401).json({ error: 'Not authenticated' });

  res.setHeader('Cache-Control', 'private, no-store');

  const requestId = typeof req.query.requestId === 'string' ? req.query.requestId : '';
  if (requestId) {
    const result = await getMatchingBoard(actor, requestId);
    if (!result.ok) return res.status(result.status).json({ error: result.error });
    return res.status(200).json(result.data);
  }

  const id = typeof req.query.id === 'string' ? req.query.id : '';
  if (id) {
    const result = await getTalent(actor, id);
    if (!result.ok) return res.status(result.status).json({ error: result.error });
    return res.status(200).json(result.data);
  }

  const result = await listTalents(actor, {
    shortlistable: req.query.shortlistable === 'true'
  });
  if (!result.ok) return res.status(result.status).json({ error: result.error });
  return res.status(200).json({ talents: result.data });
}
