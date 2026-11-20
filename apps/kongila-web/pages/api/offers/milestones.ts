import type { NextApiRequest, NextApiResponse } from 'next';
import { getRequestUser, listOfferMilestones, setOfferMilestones } from '@kongila/database';

/**
 * The milestone plan on a project offer.
 *
 * GET  ?offerId=…            the plan, with what each milestone is worth
 * POST { offerId, milestones } replaces it
 *
 * Who may do what is decided in the service, against the offer itself: a
 * client may change their own offer's plan while it is still being reviewed,
 * operations may change it during review, and nobody may change it once the
 * candidate has it.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const actor = await getRequestUser(req);
  if (!actor) return res.status(401).json({ error: 'Not authenticated' });

  if (req.method === 'GET') {
    const offerId = String(req.query.offerId || '');
    const result = await listOfferMilestones(actor, offerId);
    if (!result.ok) return res.status(result.status).json({ error: result.error });
    res.setHeader('Cache-Control', 'private, no-store');
    return res.status(200).json({ ...result.data, warnings: result.warnings || [] });
  }

  if (req.method === 'POST') {
    const body = (req.body || {}) as Record<string, any>;
    const result = await setOfferMilestones(actor, {
      offerId: String(body.offerId || ''),
      milestones: Array.isArray(body.milestones) ? body.milestones : []
    });
    if (!result.ok) return res.status(result.status).json({ error: result.error });
    return res.status(200).json({ ...result.data, warnings: result.warnings || [] });
  }

  res.setHeader('Allow', 'GET, POST');
  return res.status(405).json({ error: 'Method not allowed' });
}
