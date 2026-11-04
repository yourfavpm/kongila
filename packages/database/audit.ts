/**
 * The audit log.
 *
 * What it was: rows written from the browser in five places, upserted by id
 * from client-supplied arrays — so sending an existing id overwrote that
 * entry — attributed to the hardcoded string 'Admin Operator', with ids of
 * the form `audit_${Date.now()}` that collide whenever two actions land in
 * the same millisecond. A log that can be overwritten, by anyone, with no
 * real actor, is not evidence of anything.
 *
 * What it is now: one server-side writer. The actor comes from the verified
 * bearer token, never from the request body. Ids are uuids. The table itself
 * refuses UPDATE and DELETE through a trigger, and INSERT is revoked from
 * the browser roles, so this is the only way in.
 *
 * Never throws. An action that happened must not be rolled back because the
 * note about it could not be filed — but a failure to record is logged
 * loudly, because a gap in an audit log is itself worth knowing about.
 */

import { getSupabaseClient } from './index';
import type { RequestActor as Actor } from './scope';

export interface AuditEntry {
  /** Short verb phrase: 'Sign Contract', 'Suspend User'. */
  action: string;
  /** What happened, in a sentence someone can read a year from now. */
  details: string;
  /** What was acted on, so the log can be filtered. */
  entityType?: string;
  entityId?: string;
}

/**
 * Records one thing that happened.
 *
 * The actor is taken from the verified token. There is deliberately no way
 * for a caller to pass one in: the previous design let the browser name
 * whoever it liked, which is how every entry ended up as 'Admin Operator'.
 */
export async function recordAudit(actor: Actor, entry: AuditEntry): Promise<void> {
  if (!actor) {
    console.error('[audit] refusing to record an entry with no actor:', entry.action);
    return;
  }

  const supabase = getSupabaseClient();
  const row = {
    // A uuid, not a timestamp. Two actions in the same millisecond used to
    // produce the same id, and the upsert meant the second overwrote the first.
    id: globalThis.crypto?.randomUUID?.()
      || `audit_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
    actor: actor.email || actor.userId,
    actor_user_id: actor.userId,
    actor_role: actor.kind,
    action: entry.action,
    details: entry.details,
    entity_type: entry.entityType || null,
    entity_id: entry.entityId || null,
    timestamp: new Date().toISOString()
  };

  // insert, never upsert. An upsert on a log is a way to rewrite history.
  const { error } = await supabase.from('audit_logs').insert(row);

  if (error) {
    // Loud on purpose. A missing audit entry is a hole in the record, and
    // nobody will notice it later unless it is noisy now.
    console.error(
      `[audit] FAILED to record "${entry.action}" by ${row.actor}: ${error.message}`
    );
  }
}

/** Several entries at once, for an action that changes more than one thing. */
export async function recordAuditBatch(actor: Actor, entries: AuditEntry[]): Promise<void> {
  if (!actor || entries.length === 0) return;

  const supabase = getSupabaseClient();
  const now = new Date().toISOString();
  const rows = entries.map(entry => ({
    id: globalThis.crypto?.randomUUID?.()
      || `audit_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
    actor: actor.email || actor.userId,
    actor_user_id: actor.userId,
    actor_role: actor.kind,
    action: entry.action,
    details: entry.details,
    entity_type: entry.entityType || null,
    entity_id: entry.entityId || null,
    timestamp: now
  }));

  const { error } = await supabase.from('audit_logs').insert(rows);
  if (error) {
    console.error(`[audit] FAILED to record ${rows.length} entries: ${error.message}`);
  }
}

export interface AuditQuery {
  actorUserId?: string;
  entityType?: string;
  entityId?: string;
  action?: string;
  /** ISO instants. */
  since?: string;
  until?: string;
  limit?: number;
}

/**
 * Reads the log.
 *
 * There was no filter and no export, so the only way to find anything was to
 * scroll. Read-only by construction: the table refuses anything else.
 */
export async function readAuditLog(query: AuditQuery = {}): Promise<{
  entries: any[];
  error?: string;
}> {
  const supabase = getSupabaseClient();
  let q = supabase
    .from('audit_logs')
    .select('*')
    .order('timestamp', { ascending: false })
    .limit(Math.min(query.limit || 200, 1000));

  if (query.actorUserId) q = q.eq('actor_user_id', query.actorUserId);
  if (query.entityType) q = q.eq('entity_type', query.entityType);
  if (query.entityId) q = q.eq('entity_id', query.entityId);
  if (query.action) q = q.ilike('action', `%${query.action}%`);
  if (query.since) q = q.gte('timestamp', query.since);
  if (query.until) q = q.lte('timestamp', query.until);

  const { data, error } = await q;
  if (error) return { entries: [], error: error.message };

  return {
    entries: (data || []).map((row: any) => ({
      id: row.id,
      actor: row.actor,
      actorUserId: row.actor_user_id,
      actorRole: row.actor_role,
      action: row.action,
      details: row.details,
      entityType: row.entity_type,
      entityId: row.entity_id,
      timestamp: row.timestamp
    }))
  };
}
