import type { NextApiRequest, NextApiResponse } from 'next';
import { getRequestUser, listTemplates, saveTemplate } from '@kongila/database';

/**
 * Contract templates.
 *
 * The editor saved them by posting a contractTemplates array through
 * /api/db. writeDbAsync has no branch for that key, so every save was
 * parsed and dropped, and there was no table to put them in anyway. The
 * 2026-11-04b migration adds one.
 *
 * GET
 * POST { id?, name, serviceType?, body, status? }
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const actor = await getRequestUser(req);
  if (!actor) return res.status(401).json({ error: 'Not authenticated' });

  if (req.method === 'GET') {
    const result = await listTemplates(actor);
    if (!result.ok) return res.status(result.status).json({ error: result.error });
    return res.status(200).json({ templates: result.data });
  }

  if (req.method === 'POST') {
    const body = (req.body || {}) as Record<string, any>;
    const result = await saveTemplate(actor, {
      id: body.id,
      name: body.name,
      serviceType: body.serviceType,
      body: body.body,
      status: body.status
    });
    if (!result.ok) return res.status(result.status).json({ error: result.error });
    return res.status(result.status).json({ template: result.data });
  }

  res.setHeader('Allow', 'GET, POST');
  return res.status(405).json({ error: 'Method not allowed' });
}
