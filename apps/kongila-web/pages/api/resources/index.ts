import type { NextApiRequest, NextApiResponse } from 'next';
import {
  getRequestUser,
  readDbAsync,
  scopeDbForUser,
  signDbFileUrls,
  isScopedResource,
  SCOPED_RESOURCES
} from '@kongila/database';

/**
 * Several scoped resources in one request.
 *
 * `/api/resources/[resource]` returns one. The problem is what it costs: the
 * handler calls `readDbAsync`, which reads every table, scopes the whole
 * snapshot, signs every stored file URL in it, and then returns one array and
 * discards the rest.
 *
 * Both portals open by asking for the lot. The admin portal names 27
 * resources and the candidate portal 18, each as its own request, so signing
 * in ran the full read 27 times over. That is the long wait after sign-in:
 * not one slow query, but the same expensive query repeated once per array
 * the screen wanted.
 *
 * This does the read, the scoping and the signing once, and returns every
 * resource asked for. The scoping is the same function, so a caller receives
 * exactly what the per-resource route would have given them.
 *
 * GET /api/resources?names=organizations,users,talents
 *   -> { data: { organizations: [...], users: [...], talents: [...] } }
 *
 * GET /api/resources            (no names)
 *   -> every resource this caller may see
 *
 * Read only, like the route beside it. Writes go to the endpoint for the
 * thing being written.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const actor = await getRequestUser(req);
  if (!actor) return res.status(401).json({ error: 'Not authenticated' });

  const raw = typeof req.query.names === 'string'
    ? req.query.names
    : Array.isArray(req.query.names) ? req.query.names.join(',') : '';

  const requested = raw
    .split(',')
    .map(name => name.trim())
    .filter(Boolean);

  // An unknown name is a caller bug and is named, rather than silently coming
  // back as an empty array that looks like "this account has none of those".
  const unknown = requested.filter(name => !isScopedResource(name));
  if (unknown.length > 0) {
    return res.status(404).json({ error: `Not a resource: ${unknown.join(', ')}` });
  }

  const names = requested.length > 0 ? requested : [...SCOPED_RESOURCES];

  res.setHeader('Cache-Control', 'private, no-store');

  try {
    const db = await readDbAsync();
    const scoped = await signDbFileUrls(scopeDbForUser(db, actor));

    const data: Record<string, unknown[]> = {};
    for (const name of names) {
      const value = (scoped as any)?.[name];
      data[name] = Array.isArray(value) ? value : [];
    }

    return res.status(200).json({ data });
  } catch (error) {
    console.error('[api/resources] failed', error);
    return res.status(500).json({ error: 'Those resources could not be loaded' });
  }
}
