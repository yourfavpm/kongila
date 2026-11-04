import type { NextApiRequest, NextApiResponse } from 'next';
import { readDbAsync, getRequestUser } from '@kongila/database';

/**
 * Read only, and authenticated.
 *
 * This route had no authentication at all and accepted a POST straight
 * into writeDbAsync, which upserts about twenty tables from whatever body
 * it is given. Anyone who could reach the URL could overwrite the users
 * table, every talent profile, every contract and every invoice, with no
 * session, no role check and no audit entry.
 *
 * Remotan is dormant for the Kongila launch, but this app is still in the
 * build and would have shipped with it.
 */
/**
 * DEPRECATED. Read only, and on its way out.
 *
 * This returns a snapshot of about twenty tables in one response, scoped
 * to the caller. Eleven places in the two portals still hydrate from it,
 * so it cannot be deleted yet, but nothing new should call it.
 *
 * Its POST is gone. It used to accept the browser's whole in-memory copy
 * of the database and hand it to writeDbAsync, which upserts every table
 * in the payload, so any one action rewrote every row the screen was
 * holding and two people working at once overwrote each other.
 *
 * To retire the rest: replace each caller with the resource route for
 * what it actually needs, then delete this file. Tracked in
 * PRODUCTION-READINESS-CHECKLIST.md.
 */

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const actor = await getRequestUser(req);
  if (!actor) return res.status(401).json({ error: 'Not authenticated' });

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({
      error: 'This endpoint is read only. Use the route for the thing you are changing.'
    });
  }

  res.setHeader('Cache-Control', 'private, no-store');

  try {
    const data = await readDbAsync();
    return res.status(200).json(data);
  } catch (e) {
    return res.status(500).json({ error: 'Failed to read database' });
  }
}
