import type { NextApiRequest, NextApiResponse } from 'next';
import { getRequestUser, assignRequestManagers } from '@kongila/database';

/**
 * Setting the account and talent managers on a request.
 *
 * The page upserted roles and user_roles from the browser to make sure the
 * assignee's role row existed, updated the client organisation directly,
 * and wrote an audit entry attributed to a hardcoded 'Super Admin'. It also
 * sent urgency and internal notes in a `patch` to /api/requests/status,
 * which only ever read `status`, so neither was saved.
 *
 * POST { requestId, accountManagerId?, talentManagerId?, urgency?,
 *        internalNotes?, alsoSetClientAccountManager? }
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const actor = await getRequestUser(req);
  if (!actor) return res.status(401).json({ error: 'Not authenticated' });

  const body = (req.body || {}) as Record<string, any>;
  const result = await assignRequestManagers(actor, {
    requestId: body.requestId,
    accountManagerId: body.accountManagerId,
    talentManagerId: body.talentManagerId,
    urgency: body.urgency,
    internalNotes: body.internalNotes,
    alsoSetClientAccountManager: Boolean(body.alsoSetClientAccountManager)
  });

  if (!result.ok) return res.status(result.status).json({ error: result.error });
  return res.status(200).json({ ...result.data, warnings: result.warnings });
}
