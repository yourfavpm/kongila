import type { NextApiRequest, NextApiResponse } from 'next';
import {
  getRequestUser,
  listOperators,
  inviteOperator,
  changeOperatorRole,
  setOperatorStatus,
  resendOperatorInvite
} from '@kongila/database';

/**
 * Operator accounts.
 *
 * There was no surface for this at all, so an admin existed only if someone
 * edited the database by hand or their email happened to end in @kongila.co,
 * which the browser auto-provisioned — a way in, not a feature.
 *
 * Every action here is refused to anyone who is not a super admin, checked
 * server-side from the verified token rather than from anything the browser
 * sends, and recorded in the audit log.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const actor = await getRequestUser(req);
  if (!actor) return res.status(401).json({ error: 'Not authenticated' });

  if (req.method === 'GET') {
    const result = await listOperators(actor);
    if (!result.ok) return res.status(result.status).json({ error: result.error });
    return res.status(200).json({ operators: result.data });
  }

  if (req.method === 'POST') {
    const { action } = req.body || {};

    const result =
      action === 'changeRole' ? await changeOperatorRole(actor, req.body)
      : action === 'setStatus' ? await setOperatorStatus(actor, req.body)
      : action === 'resendInvite' ? await resendOperatorInvite(actor, req.body)
      : action === 'invite' || !action ? await inviteOperator(actor, req.body)
      : { ok: false, status: 400, error: `Unknown action "${action}".` };

    if (!result.ok) return res.status(result.status).json({ error: result.error });
    return res.status(result.status).json(result.data);
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
