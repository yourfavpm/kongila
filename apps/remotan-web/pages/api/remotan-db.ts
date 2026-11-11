import type { NextApiRequest, NextApiResponse } from 'next';
import { getRequestUser } from '@kongila/database';

/**
 * Retired.
 *
 * This read and wrote a `db.json` file on the server's own disk, with no
 * authentication of any kind. A POST merged whatever body it was given
 * into that file and returned `{ ok: true }`; a GET handed the whole
 * thing back. Anyone who could reach the URL could read every talent,
 * contract and organisation in it, and overwrite all of them.
 *
 * It also wrote to the filesystem, which on a serverless host is either
 * read-only or a container that is thrown away, so the writes went
 * nowhere even when they appeared to work.
 *
 * Remotan is dormant for the Kongila launch. The route is kept as a
 * refusal rather than deleted so anything still calling it fails loudly
 * instead of quietly reading a stale file.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Still checks the session, so an unauthenticated caller gets 401 rather
  // than a description of an endpoint they cannot use.
  const actor = await getRequestUser(req);
  if (!actor) return res.status(401).json({ error: 'Not authenticated' });

  return res.status(410).json({
    error:
      'This endpoint has been retired. It read and wrote an unauthenticated '
      + 'db.json on the server disk. Remotan is dormant for this launch.'
  });
}
