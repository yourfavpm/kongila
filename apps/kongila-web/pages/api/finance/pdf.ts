import type { NextApiRequest, NextApiResponse } from 'next';
import { getRequestUser, getInvoicePdf } from '@kongila/database';

/**
 * The invoice PDF, for the client who owes it.
 *
 * The portal's previous "receipt" was a template string opened with
 * window.print(), which only the person already looking at the screen
 * could produce and which no email could carry.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const actor = await getRequestUser(req);
  if (!actor) return res.status(401).json({ error: 'Not authenticated' });

  const result = await getInvoicePdf(actor, String(req.query.invoiceId || ''));
  if (!result.ok) return res.status(result.status).json({ error: result.error });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${result.data!.filename}"`);
  return res.status(200).send(result.data!.pdf);
}
