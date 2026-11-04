/**
 * Document versions and certification expiry, server side.
 *
 * Versioning was a number the browser computed as `highest + 1` and wrote
 * onto the new row. Nothing marked the previous version superseded, so a
 * candidate's list showed four CVs with no sign of which counted, and
 * every screen that needed one took whichever the query returned first.
 *
 * Expiry was a coloured badge computed in the talent dashboard. No part of
 * the server knew a certification had lapsed, and nobody was ever told one
 * was about to.
 */

import { getSupabaseClient } from './index';
import type { RequestActor as Actor } from './scope';
import { notifyUsers, notifyAdmins } from './notify';
import { recordAudit } from './audit';
import {
  planSupersede,
  isVersionedType,
  expiryNotices,
  expiryState,
  type VersionedDocument
} from '@kongila/workflows';

export interface DocumentResult<T = any> {
  ok: boolean;
  status: number;
  error?: string;
  data?: T;
  warnings?: string[];
}

function fail(status: number, error: string): DocumentResult {
  return { ok: false, status, error };
}

function rowToDocument(row: any): VersionedDocument {
  return {
    id: row.id,
    userId: row.user_id,
    type: row.type,
    name: row.name,
    status: row.status,
    versionNumber: row.version_number,
    uploadedAt: row.uploaded_at,
    expiryDate: row.expiry_date,
    supersededById: row.superseded_by_id,
    isCurrent: row.is_current,
    certificationName: row.certification_name
  };
}

/**
 * Called after a new CV or portfolio is uploaded.
 *
 * Marks every earlier version superseded and stamps the new one with its
 * version number, server side, so two browser tabs cannot both decide
 * they are version 3.
 */
export async function supersedePreviousVersions(
  actor: Actor,
  input: { documentId: string; userId: string; type: string }
): Promise<DocumentResult> {
  if (!actor) return fail(401, 'Not authenticated.');
  if (!isVersionedType(input.type)) {
    return { ok: true, status: 200, data: { superseded: 0, versionNumber: 1 } };
  }

  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('documents')
    .select('*')
    .eq('user_id', input.userId)
    .eq('type', input.type);

  if (error) return fail(500, error.message);

  const plan = planSupersede(
    (data || []).map(rowToDocument), input.userId, input.type, input.documentId
  );
  const now = new Date().toISOString();

  if (plan.superseded.length > 0) {
    const { error: supersedeError } = await supabase
      .from('documents')
      .update({ is_current: false, superseded_by_id: input.documentId, superseded_at: now })
      .in('id', plan.superseded.map(s => s.id));

    if (supersedeError) return fail(500, supersedeError.message);
  }

  const { error: currentError } = await supabase
    .from('documents')
    .update({ is_current: true, version_number: plan.newVersionNumber, superseded_by_id: null })
    .eq('id', input.documentId);

  if (currentError) return fail(500, currentError.message);

  return {
    ok: true,
    status: 200,
    data: { superseded: plan.superseded.length, versionNumber: plan.newVersionNumber }
  };
}

/** Every version of a document type, so a candidate can see their history. */
export async function documentHistory(
  actor: Actor,
  input: { type: string; userId?: string }
): Promise<DocumentResult> {
  if (!actor) return fail(401, 'Not authenticated.');

  const userId = actor.kind === 'admin' && input.userId
    ? input.userId
    : (actor.talentProfileId || actor.userId);

  if (actor.kind !== 'admin' && input.userId && String(input.userId) !== String(userId)) {
    return fail(403, 'That is not your document history.');
  }

  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('documents')
    .select('*')
    .eq('user_id', userId)
    .eq('type', input.type)
    .neq('status', 'deleted')
    .order('version_number', { ascending: false });

  if (error) return fail(500, error.message);

  return {
    ok: true,
    status: 200,
    data: (data || []).map((row: any) => ({
      ...rowToDocument(row),
      fileUrl: row.file_url,
      fileSizeBytes: row.file_size_bytes,
      isCurrent: Boolean(row.is_current),
      supersededAt: row.superseded_at
    }))
  };
}

/**
 * Restores an earlier version as the current one.
 *
 * Does not renumber anything. The history stays as it happened, and
 * `is_current` says which one counts, which is why that flag wins over the
 * highest version number when the two disagree.
 */
export async function restoreVersion(
  actor: Actor,
  input: { documentId: string }
): Promise<DocumentResult> {
  if (!actor) return fail(401, 'Not authenticated.');

  const supabase = getSupabaseClient();
  const { data: document } = await supabase
    .from('documents').select('*').eq('id', input.documentId).maybeSingle();

  if (!document) return fail(404, 'That document does not exist.');

  const owner = actor.talentProfileId || actor.userId;
  if (actor.kind !== 'admin' && String(document.user_id) !== String(owner)) {
    return fail(403, 'That document is not yours.');
  }
  if (String(document.status).toLowerCase() === 'deleted') {
    return fail(409, 'That version was deleted and cannot be restored.');
  }

  await supabase
    .from('documents')
    .update({ is_current: false })
    .eq('user_id', document.user_id)
    .eq('type', document.type);

  const { error } = await supabase
    .from('documents')
    .update({ is_current: true, superseded_by_id: null, superseded_at: null })
    .eq('id', input.documentId);

  if (error) return fail(500, error.message);

  await recordAudit(actor, {
    action: 'Restore Document Version',
    details: `${document.type} version ${document.version_number || 1} made current again.`,
    entityType: 'document',
    entityId: input.documentId
  });

  return { ok: true, status: 200, data: { id: input.documentId } };
}

/**
 * Nightly: finds certifications that have lapsed or are about to, records
 * the state on the row and tells the person once.
 *
 * `expiry_notified_at` is what stops a candidate being emailed every
 * single night for the thirty days before a certificate expires.
 */
export async function checkDocumentExpiry(now: Date = new Date()): Promise<DocumentResult> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('documents')
    .select('*')
    .not('expiry_date', 'is', null);

  if (error) return fail(500, error.message);

  const documents = (data || []).map(rowToDocument);
  const notices = expiryNotices(documents, now);
  const byId = new Map<string, any>((data || []).map((row: any) => [String(row.id), row]));

  const warnings: string[] = [];
  let notified = 0;

  // The state goes on every row with a date, so a query can find lapsed
  // certificates without recomputing a comparison across the table.
  for (const document of documents) {
    const state = expiryState(document.expiryDate, now);
    const row = byId.get(String(document.id));
    if (row?.expiry_state === state) continue;

    await supabase.from('documents').update({ expiry_state: state }).eq('id', document.id);
  }

  for (const notice of notices) {
    const row = byId.get(String(notice.documentId));

    // Once per state change, not once per night.
    const alreadyTold = row?.expiry_notified_at
      && row?.expiry_state === notice.state;
    if (alreadyTold || !notice.userId) continue;

    const result = await notifyUsers(notice.userId, 'request_received', {
      roleTitle: notice.state === 'expired'
        ? `${notice.name} has expired`
        : `${notice.name} expires soon`,
      reason: notice.message
    });
    warnings.push(...result.warnings);

    await supabase
      .from('documents')
      .update({ expiry_notified_at: now.toISOString() })
      .eq('id', notice.documentId);

    notified += 1;
  }

  const expired = notices.filter(n => n.state === 'expired');
  if (expired.length > 0) {
    const result = await notifyAdmins('request_received', {
      roleTitle: `${expired.length} certification${expired.length === 1 ? ' has' : 's have'} expired`,
      reason: expired.map(n => n.name).slice(0, 10).join(', ')
    }, { inAppOnly: true });
    warnings.push(...result.warnings);
  }

  return {
    ok: true,
    status: 200,
    data: {
      checked: documents.length,
      expiringSoon: notices.filter(n => n.state === 'expiring_soon').length,
      expired: expired.length,
      notified
    },
    warnings
  };
}
