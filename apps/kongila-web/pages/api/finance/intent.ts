import type { NextApiRequest, NextApiResponse } from 'next';
import { getRequestUser, recordPaymentIntent, disputeInvoice } from '@kongila/database';

/**
 * A client saying how they intend to settle an invoice.
 *
 * It does not mark anything paid, and there is deliberately no route that
 * lets a client do so. The portal used to update the invoices table from
 * the browser and tell the client their card had been charged, which took
 * no money, and which released the candidate's payout because payout
 * approval is gated on the invoice being paid.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const actor = await getRequestUser(req);
  if (!actor) return res.status(401).json({ error: 'Not authenticated' });

  const body = req.body || {};
  const result = body.action === 'dispute'
    ? await disputeInvoice(actor, body)
    : await recordPaymentIntent(actor, body);
  if (!result.ok) return res.status(result.status).json({ error: result.error });

  return res.status(200).json(result.data);
}
