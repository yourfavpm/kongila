import type { NextApiRequest, NextApiResponse } from 'next';

/**
 * Retired.
 *
 * This route created a contract the moment a client clicked Hire, before the
 * candidate had seen anything, let alone agreed. Offers now go through
 * /api/offers, Kongila approves and sends them, and the contract is created
 * only when the candidate accepts, in /api/offers/respond.
 *
 * It is kept as a refusal rather than deleted so that anything still calling
 * it fails loudly instead of quietly creating contracts nobody agreed to.
 */
export default async function handler(_req: NextApiRequest, res: NextApiResponse) {
  return res.status(410).json({
    error:
      'This endpoint has been retired. Create an offer with POST /api/offers; the contract is created when the candidate accepts.'
  });
}
