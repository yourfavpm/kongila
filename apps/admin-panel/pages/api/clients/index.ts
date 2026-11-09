import type { NextApiRequest, NextApiResponse } from 'next';
import {
  getRequestUser,
  listClients,
  getClient,
  listAssignableManagers
} from '@kongila/database';

/**
 * Client companies.
 *
 * The admin Clients module had no API. It read the whole database through
 * /api/db and filtered in the browser: every organisation, every client
 * profile, every request, contract, invoice and payment on the platform,
 * to render one company's page. Before that it read the tables directly
 * with the anon key, which is what made `users` readable by anyone with a
 * session.
 *
 * GET                      every company, with counts and totals
 * GET ?id=                 one company and the records belonging to it
 * GET ?view=managers       who may be assigned as an account manager
 *
 * There is no write here. A client edits their own company through
 * /api/company, and the account manager is set through
 * /api/clients/assign-manager.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const actor = await getRequestUser(req);
  if (!actor) return res.status(401).json({ error: 'Not authenticated' });

  res.setHeader('Cache-Control', 'private, no-store');

  if (req.query.view === 'managers') {
    const result = await listAssignableManagers(actor);
    if (!result.ok) return res.status(result.status).json({ error: result.error });
    return res.status(200).json(result.data);
  }

  const id = typeof req.query.id === 'string' ? req.query.id : '';
  if (id) {
    const result = await getClient(actor, id);
    if (!result.ok) return res.status(result.status).json({ error: result.error });
    return res.status(200).json(result.data);
  }

  const result = await listClients(actor);
  if (!result.ok) return res.status(result.status).json({ error: result.error });
  return res.status(200).json({ clients: result.data });
}
