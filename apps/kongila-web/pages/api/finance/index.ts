import type { NextApiRequest, NextApiResponse } from 'next';
import { getRequestUser, listInvoices, listPayouts } from '@kongila/database';

/**
 * Finance, portal side. Read only.
 *
 * The client portal used to query the invoices table straight from the
 * browser and filter by client_id only when the signed-in role happened to
 * read 'client'. A candidate session, or a client whose role string did not
 * match, received every invoice on the platform and the rendering decided
 * what was shown. Scoping is the server's job.
 *
 * A client sees their own invoices. A candidate sees their own payouts and
 * no invoices at all, because an invoice is between Kongila and the client
 * and shows the margin.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const actor = await getRequestUser(req);
  if (!actor) return res.status(401).json({ error: 'Not authenticated' });

  const result = req.query.view === 'payouts'
    ? await listPayouts(actor)
    : await listInvoices(actor);

  if (!result.ok) return res.status(result.status).json({ error: result.error });
  return res.status(200).json(result.data);
}
