import type { NextApiRequest, NextApiResponse } from 'next';
import {
  getRequestUser,
  listFees,
  setFee,
  previewInvoices,
  generateInvoiceDrafts,
  listInvoices,
  listPayouts,
  approvePayouts,
  settlePayout,
  markInvoicePaid,
  sendInvoice,
  voidInvoice,
  getInvoicePdf
} from '@kongila/database';

/**
 * Billing, operations side.
 *
 * GET  ?view=fees      the four margins, and which are still unset
 * GET  ?view=preview   what a run would bill, and what it would refuse
 * GET  ?view=invoices  invoices with their line items
 * GET  ?view=payouts   candidate payouts
 * POST action=set_fee  change a margin
 * POST action=generate run the billing and write the drafts
 *
 * Preview and generate are deliberately separate calls. Somebody should be
 * able to see what a run would produce before it produces it, especially
 * the first time, when every fee is newly configured.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const actor = await getRequestUser(req);
  if (!actor) return res.status(401).json({ error: 'Not authenticated' });
  if (actor.kind !== 'admin') {
    console.warn(`[api/finance] refused ${actor.kind} ${actor.userId}`);
    return res.status(403).json({ error: 'Not authorised' });
  }

  if (req.method === 'GET') {
    const view = String(req.query.view || 'invoices');

    if (view === 'pdf') {
      const result = await getInvoicePdf(actor, String(req.query.invoiceId || ''));
      if (!result.ok) return res.status(result.status).json({ error: result.error });

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${result.data!.filename}"`);
      return res.status(200).send(result.data!.pdf);
    }

    const result = view === 'fees' ? await listFees(actor)
      : view === 'preview' ? await previewInvoices(actor)
      : view === 'payouts' ? await listPayouts(actor)
      : await listInvoices(actor);

    if (!result.ok) return res.status(result.status).json({ error: result.error });
    return res.status(200).json(result.data);
  }

  if (req.method === 'POST') {
    const { action } = req.body || {};

    const result = action === 'set_fee' ? await setFee(actor, req.body)
      : action === 'generate' ? await generateInvoiceDrafts(actor)
      : action === 'approve_payouts' ? await approvePayouts(actor, req.body)
      : action === 'settle_payout' ? await settlePayout(actor, req.body)
      : action === 'mark_invoice_paid' ? await markInvoicePaid(actor, req.body)
      : action === 'send_invoice' ? await sendInvoice(actor, req.body)
      : action === 'void_invoice' ? await voidInvoice(actor, req.body)
      : null;

    if (!result) {
      return res.status(400).json({ error: `"${action}" is not a finance action.` });
    }
    if (!result.ok) return res.status(result.status).json({ error: result.error });
    return res.status(result.status).json({ ...result.data, warnings: result.warnings });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
