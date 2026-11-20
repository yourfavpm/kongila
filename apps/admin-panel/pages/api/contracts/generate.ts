import type { NextApiRequest, NextApiResponse } from 'next';
import {
  requirePermission,
  getRequestUser,
  previewContractFromOffer,
  generateContractFromOffer,
  updateContractDocument,
  getContractDetail
} from '@kongila/database';

/**
 * Turning an accepted offer into a contract pair and its invoice.
 *
 * GET  ?offerId=…            the preview: figures, terms and both documents,
 *                            with nothing written
 * POST { offerId, overrides } writes the contract and raises the invoice the
 *                            service line calls for
 *
 * The preview exists because a contract that appears first and is corrected
 * afterwards has already been counted by every screen that reads contracts.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const actor = await getRequestUser(req);
  if (!actor) return res.status(401).json({ error: 'Not authenticated' });

  const refused = requirePermission(actor, 'contracts.manage');
  if (refused) return res.status(refused.status).json({ error: refused.error });

  if (req.method === 'GET') {
    // The contract as it stands: its documents and its invoices, for the
    // screen that shows one.
    if (req.query.contractId) {
      const detail = await getContractDetail(actor, String(req.query.contractId));
      if (!detail.ok) return res.status(detail.status).json({ error: detail.error });
      res.setHeader('Cache-Control', 'private, no-store');
      return res.status(200).json(detail.data);
    }

    const result = await previewContractFromOffer(actor, {
      offerId: String(req.query.offerId || '')
    });
    if (!result.ok) return res.status(result.status).json({ error: result.error });
    res.setHeader('Cache-Control', 'private, no-store');
    return res.status(200).json({ ...result.data, warnings: result.warnings || [] });
  }

  if (req.method === 'POST') {
    const body = (req.body || {}) as Record<string, any>;

    // A preview with the operator's edits applied, before they commit.
    if (body.preview) {
      const result = await previewContractFromOffer(actor, {
        offerId: String(body.offerId || ''),
        overrides: body.overrides || {}
      });
      if (!result.ok) return res.status(result.status).json({ error: result.error });
      return res.status(200).json({ ...result.data, warnings: result.warnings || [] });
    }

    // Editing the wording of a contract nobody has signed yet.
    if (body.action === 'updateDocument') {
      const updated = await updateContractDocument(actor, {
        contractId: String(body.contractId || ''),
        clientBody: typeof body.clientBody === 'string' ? body.clientBody : undefined,
        talentBody: typeof body.talentBody === 'string' ? body.talentBody : undefined
      });
      if (!updated.ok) return res.status(updated.status).json({ error: updated.error });
      return res.status(200).json(updated.data);
    }

    const result = await generateContractFromOffer(actor, {
      offerId: String(body.offerId || ''),
      overrides: body.overrides || {}
    });
    if (!result.ok) return res.status(result.status).json({ error: result.error });
    return res.status(result.status).json({ ...result.data, warnings: result.warnings || [] });
  }

  res.setHeader('Allow', 'GET, POST');
  return res.status(405).json({ error: 'Method not allowed' });
}
