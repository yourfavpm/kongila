import type { NextApiRequest, NextApiResponse } from 'next';
import { getRequestUser, getCompany, updateCompany } from '@kongila/database';

/**
 * A client's own company.
 *
 * `MyCompanyPanel` and `ClientSettingsPanel` updated `organizations` and
 * `client_profiles` from the browser, scoped by an id held in component
 * state. RLS is off on both tables in the live database, so that update
 * landed on whichever row the browser named. The organisation is resolved
 * server side here, from the caller's own profile row.
 *
 * GET
 * PATCH { organization?, profile?, settings? }
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const actor = await getRequestUser(req);
  if (!actor) return res.status(401).json({ error: 'Not authenticated' });

  if (req.method === 'GET') {
    const result = await getCompany(actor);
    if (!result.ok) return res.status(result.status).json({ error: result.error });
    return res.status(200).json(result.data);
  }

  if (req.method === 'PATCH' || req.method === 'POST') {
    const body = (req.body || {}) as Record<string, any>;
    const result = await updateCompany(actor, {
      organization: body.organization,
      profile: body.profile,
      settings: body.settings
    });
    if (!result.ok) return res.status(result.status).json({ error: result.error });
    return res.status(200).json(result.data);
  }

  res.setHeader('Allow', 'GET, PATCH, POST');
  return res.status(405).json({ error: 'Method not allowed' });
}
