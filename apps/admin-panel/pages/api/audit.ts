import type { NextApiRequest, NextApiResponse } from 'next';
import { getRequestUser, readAuditLog } from '@kongila/database';
import { canAccessTab } from '@kongila/auth';

/**
 * Reading the audit log.
 *
 * Read only, and not because this route says so: the table refuses UPDATE
 * and DELETE through a trigger, and INSERT is revoked from the browser
 * roles. Entries are written only by recordAudit, server-side, with the
 * actor taken from the verified token.
 *
 * Filtering exists now. There was none, so the only way to find anything
 * was to scroll.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const actor = await getRequestUser(req);
  if (!actor) return res.status(401).json({ error: 'Not authenticated' });
  if (!canAccessTab(actor.role, 'audit')) {
    return res.status(403).json({ error: 'Not authorised' });
  }

  const { actorUserId, entityType, entityId, action, since, until, limit } = req.query;

  const result = await readAuditLog({
    actorUserId: actorUserId ? String(actorUserId) : undefined,
    entityType: entityType ? String(entityType) : undefined,
    entityId: entityId ? String(entityId) : undefined,
    action: action ? String(action) : undefined,
    since: since ? String(since) : undefined,
    until: until ? String(until) : undefined,
    limit: limit ? Number(limit) : undefined
  });

  if (result.error) return res.status(500).json({ error: result.error });
  return res.status(200).json({ entries: result.entries });
}
