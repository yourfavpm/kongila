import type { NextApiRequest, NextApiResponse } from 'next';
import {
  requirePermission,
  getRequestUser,
  raiseContractInvoice,
  updateContractStatus,
  sendSignatureReminder,
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
  // What this operator may do, checked against the permission the super
  // admin granted the role rather than against the role's name. Hiding a
  // tab is not access control; this is where the refusal happens.
  const body = (req.body || {}) as Record<string, any>;
  const invoiceRefusal = body.action === 'raiseInvoice' ? requirePermission(actor, 'invoices.manage') : null;
  const financeRefusal = body.action === 'raiseInvoice' ? requirePermission(actor, 'finance.manage') : null;
  const refused = body.action === 'raiseInvoice'
    ? (invoiceRefusal && financeRefusal ? invoiceRefusal : null)
    : requirePermission(actor, 'contracts.manage');
  if (refused) return res.status(refused.status).json({ error: refused.error });

  if (body.action === 'create') {
    return res.status(410).json({ error: 'Contracts are created from accepted offers. Select an accepted offer in the contract queue.' });
  }
  const result = body.action === 'remind'
    ? await sendSignatureReminder(actor, { contractId: body.contractId })
    : body.action === 'raiseInvoice'
    ? await raiseContractInvoice(actor, String(body.contractId || ''))
    : await updateContractStatus(actor, {
        contractId: body.contractId,
        status: body.status,
        reason: body.reason
      });

  if (!result.ok) return res.status(result.status).json({ error: result.error });
  return res.status(200).json({ ...result.data, warnings: result.warnings });
}
