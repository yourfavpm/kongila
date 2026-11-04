import type { NextApiRequest, NextApiResponse } from 'next';
import {
  getRequestUser,
  updateContractStatus,
  sendSignatureReminder,
  createContract
} from '@kongila/database';

/**
 * A contract's status, and chasing an outstanding signature.
 *
 * The panel rewrote its local contracts array and posted the whole thing
 * through /api/db, which upserts every contract in it. The statuses it
 * wrote ('Active', 'Voided', 'Signed') are not values the column allows,
 * so Postgres refused them while the rest of the payload still overwrote
 * every other contract from stale browser state.
 *
 * POST { action: 'status', contractId, status, reason? }
 * POST { action: 'remind', contractId }
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const actor = await getRequestUser(req);
  if (!actor) return res.status(401).json({ error: 'Not authenticated' });

  const body = (req.body || {}) as Record<string, any>;

  const result = body.action === 'create'
    ? await createContract(actor, { ...body, talentId: String(body.talentId || '') })
   
    : body.action === 'remind'
    ? await sendSignatureReminder(actor, { contractId: body.contractId })
    : await updateContractStatus(actor, {
        contractId: body.contractId,
        status: body.status,
        reason: body.reason
      });

  if (!result.ok) return res.status(result.status).json({ error: result.error });
  return res.status(200).json({ ...result.data, warnings: result.warnings });
}
