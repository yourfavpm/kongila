import type { NextApiRequest, NextApiResponse } from 'next';
import { getRequestUser, generateInvoiceDrafts, previewInvoices } from '@kongila/database';

/**
 * Generating draft invoices.
 *
 * What was here: two hardcoded invoices, Horizon Fintech for $5,000 and
 * Nexus Health for $3,200, returned on every call with a comment listing
 * what a real implementation would do. No authentication, no database read,
 * no row written. The finance screen showed the same two fictional clients
 * whatever the platform actually had under contract.
 *
 * It now reads active contracts, applies the configured margin for each
 * service line, bills recurring lines by month and one-time lines once,
 * and writes real draft invoices with their line items.
 *
 * Nothing is invented. A service line with no fee configured, or a
 * placement with no agreed fee, comes back in `skipped` with a reason
 * rather than being billed at a guessed number.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const actor = await getRequestUser(req);
  if (!actor) return res.status(401).json({ error: 'Not authenticated' });

  // A client portal session is a valid session and still has no business
  // running the billing. The old handler checked nothing at all.
  if (actor.kind !== 'admin') {
    console.warn(`[finance/generate-drafts] refused ${actor.kind} ${actor.userId}`);
    return res.status(403).json({ error: 'Not authorised' });
  }

  if (req.method === 'GET') {
    const result = await previewInvoices(actor);
    if (!result.ok) return res.status(result.status).json({ error: result.error });
    return res.status(200).json(result.data);
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const result = await generateInvoiceDrafts(actor);
  if (!result.ok) return res.status(result.status).json({ error: result.error });

  return res.status(200).json({
    success: true,
    message: result.data.summary,
    generatedDrafts: result.data.created,
    skipped: result.data.skipped,
    failed: result.data.failed
  });
}
