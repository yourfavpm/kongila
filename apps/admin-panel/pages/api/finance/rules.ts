import type { NextApiRequest, NextApiResponse } from 'next';
import { getRequestUser, listFeeRules, setFeeRule } from '@kongila/database';

/**
 * Fee rules and their history.
 *
 * GET                       every version, plus what is in force today
 * POST { serviceLine, party, basis, value, minimumUsd?, maximumUsd?,
 *        effectiveFrom? }   closes the current version and opens the next
 *
 * A change never edits a row. Permissions are checked in the service.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const actor = await getRequestUser(req);
  if (!actor) return res.status(401).json({ error: 'Not authenticated' });

  if (req.method === 'GET') {
    const result = await listFeeRules(actor);
    if (!result.ok) return res.status(result.status).json({ error: result.error });
    res.setHeader('Cache-Control', 'private, no-store');
    return res.status(200).json({ ...result.data, warnings: result.warnings || [] });
  }

  if (req.method === 'POST') {
    const body = (req.body || {}) as Record<string, any>;
    const result = await setFeeRule(actor, {
      serviceLine: String(body.serviceLine || ''),
      party: body.party === 'talent' ? 'talent' : 'client',
      basis: body.basis ? String(body.basis) : undefined,
      value: Number(body.value),
      minimumUsd: body.minimumUsd === '' || body.minimumUsd == null ? null : Number(body.minimumUsd),
      maximumUsd: body.maximumUsd === '' || body.maximumUsd == null ? null : Number(body.maximumUsd),
      label: body.label ? String(body.label) : null,
      effectiveFrom: body.effectiveFrom ? String(body.effectiveFrom) : null
    });
    if (!result.ok) return res.status(result.status).json({ error: result.error });
    return res.status(200).json({ ...result.data, warnings: result.warnings || [] });
  }

  res.setHeader('Allow', 'GET, POST');
  return res.status(405).json({ error: 'Method not allowed' });
}
