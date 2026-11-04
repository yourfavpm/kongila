import type { NextApiRequest, NextApiResponse } from 'next';
import { readDbAsync, getRequestUser, signDbFileUrls } from '@kongila/database';

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
  // This route serves the admin portal only. A talent or client session is a
  // valid session and still has no business here, so check the kind, not just
  // that someone is signed in.
  const actor = await getRequestUser(req);
  if (!actor) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  if (actor.kind !== 'admin') {
    console.warn(`[admin api/db] refused ${actor.kind} ${actor.userId}`);
    return res.status(403).json({ error: 'Not authorised' });
  }

  // This used to carry Cache-Control: s-maxage=15, which let a shared cache
  // hold a full copy of the database. The response is per-user now.
  res.setHeader('Cache-Control', 'private, no-store');

  // Read only.
  //
  // POST used to accept the browser's whole in-memory copy of the database
  // and hand it to writeDbAsync, which upserts about twenty tables from it.
  // Any one action in either portal therefore rewrote every row the screen
  // was holding: a vetting decision reposted every candidate, an invoice
  // change reposted every invoice, and two people working at once
  // overwrote each other with no sign that anything had happened.
  //
  // Every write now goes to the route that owns that thing, where the
  // caller is checked, the values are validated against the constraints
  // the column actually has, and the change is audited against the person
  // who made it.
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({
      error: 'This endpoint is read only. Use the route for the thing you are changing.'
    });
  }

  try {
    const data = await readDbAsync();
    // Operations see every document, so every link needs signing once the
    // bucket is private.
    return res.status(200).json(await signDbFileUrls(data));
  } catch (e: any) {
    return res.status(500).json({ error: e.message || 'Failed to read database' });
  }
}
