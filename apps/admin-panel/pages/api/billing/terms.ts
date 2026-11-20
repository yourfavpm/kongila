import type { NextApiRequest, NextApiResponse } from 'next';
import {
  requirePermission,
  getRequestUser,
  listBillingTerms,
  setServiceLineTerms,
  setClientTerms,
  effectiveTerms
} from '@kongila/database';

/**
 * Margins and payment terms.
 *
 * GET with no query returns every service line and every client override,
 * for the configuration screen. GET with an organisation and a service type
 * returns what would actually apply to a new contract, which is what the
 * contract form asks for before it shows the operator a number.
 *
 * Writing is behind finance.manage or settings.manage, because a margin is
 * the only place the platform's revenue comes from.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const actor = await getRequestUser(req);
  if (!actor) return res.status(401).json({ error: 'Not authenticated' });

  const refused = requirePermission(
    actor,
    req.method === 'GET' ? 'view:finance' : 'finance.manage'
  );
  if (refused) return res.status(refused.status).json({ error: refused.error });

  if (req.method === 'GET') {
    res.setHeader('Cache-Control', 'private, no-store');

    if (req.query.serviceType) {
      const result = await effectiveTerms(
        req.query.organizationId ? String(req.query.organizationId) : null,
        String(req.query.serviceType)
      );
      if (!result.terms) {
        return res.status(400).json({ error: result.warnings[0] || 'Unknown service type.' });
      }
      return res.status(200).json({ terms: result.terms, warnings: result.warnings });
    }

    const result = await listBillingTerms(actor);
    if (!result.ok) return res.status(result.status).json({ error: result.error });
    return res.status(200).json({ ...result.data, warnings: result.warnings || [] });
  }

  if (req.method === 'POST') {
    const body = (req.body || {}) as Record<string, any>;

    const result = body.organizationId
      ? await setClientTerms(actor, body as any)
      : await setServiceLineTerms(actor, body as any);

    if (!result.ok) return res.status(result.status).json({ error: result.error });
    return res.status(result.status).json({ ...result.data, warnings: result.warnings || [] });
  }

  res.setHeader('Allow', 'GET, POST');
  return res.status(405).json({ error: 'Method not allowed' });
}
