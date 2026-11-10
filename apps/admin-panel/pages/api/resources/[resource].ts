import type { NextApiRequest, NextApiResponse } from 'next';
import { getRequestUser, readDbAsync, scopeDbForUser, signDbFileUrls, isScopedResource } from '@kongila/database';

// The allowlist moved to @kongila/database, beside the scoping, so this
// route and the batch route beside it cannot disagree about what exists.

/** Read one allowlisted, server-scoped resource. This route never writes. */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const actor = await getRequestUser(req);
  if (!actor) return res.status(401).json({ error: 'Not authenticated' });

  const resource = String(req.query.resource || '');
  if (!isScopedResource(resource)) return res.status(404).json({ error: 'Resource not found' });

  try {
    const db = await readDbAsync();
    const scoped = await signDbFileUrls(scopeDbForUser(db, actor));
    return res.status(200).json({ resource, data: (scoped as any)?.[resource] || [] });
  } catch (error) {
    console.error(`[api/resources/${resource}] failed`, error);
    return res.status(500).json({ error: 'Could not load resource' });
  }
}
