import type { NextApiRequest, NextApiResponse } from 'next';
import { getRequestUser, getSupabaseClient, recordAudit } from '@kongila/database';

/**
 * Universal compliance documents.
 *
 * This route used to read the whole database with readDbAsync, mutate the
 * in-memory object, and write all of it back with writeDbAsync, which
 * upserts about twenty tables. Two callers acting at once overwrote each
 * other. Its PUT also spread the request body straight onto the row, so a
 * caller could set user_id or is_mandatory on any document by id.
 *
 * It also had two `if (req.method === 'PUT')` blocks. The second was
 * unreachable, which is why hiding a document from that path never worked.
 *
 * GET                         the visible compliance documents
 * POST   { name, type, isMandatory, description? }
 * PUT    { id, ...editable }
 * DELETE ?id=                 hides rather than deletes
 */

/** documents_type_check allows exactly these. */
const TYPES = ['CV', 'portfolio', 'NDA', 'agreement', 'certification', 'IT_Ethics_Policy'];

/** What may be changed through this route. Not user_id, not status. */
const EDITABLE = ['name', 'type', 'is_mandatory', 'description', 'file_url', 'file_name'];

function toDocument(row: any) {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    type: row.type,
    status: row.status,
    isMandatory: row.is_mandatory,
    isHidden: row.is_hidden,
    description: row.description,
    fileUrl: row.file_url,
    fileName: row.file_name,
    uploadedAt: row.uploaded_at,
    updatedAt: row.updated_at
  };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const actor = await getRequestUser(req);
  if (!actor) return res.status(401).json({ error: 'Not authenticated' });
  if (actor.kind !== 'admin') {
    console.warn(`[api/compliance] refused ${actor.kind} ${actor.userId}`);
    return res.status(403).json({ error: 'Not authorised' });
  }

  const supabase = getSupabaseClient();

  // ── Read ──────────────────────────────────────────────────────────────────
  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('documents')
      .select('*')
      .eq('is_hidden', false)
      .order('uploaded_at', { ascending: false });

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json((data || []).map(toDocument));
  }

  // ── Create ────────────────────────────────────────────────────────────────
  if (req.method === 'POST') {
    const body = (req.body || {}) as Record<string, any>;

    const name = String(body.name || '').trim();
    if (!name) return res.status(422).json({ error: 'A document needs a name.' });

    const type = String(body.type || '').trim();
    if (!TYPES.includes(type)) {
      return res.status(422).json({ error: `A document is one of: ${TYPES.join(', ')}.` });
    }

    const isMandatory = Boolean(body.isMandatory);
    const userId = body.userId ? String(body.userId) : null;

    // A universal document belongs to nobody in particular. One addressed
    // to a person is that person's to sign.
    if (isMandatory && userId) {
      return res.status(422).json({ error: 'A mandatory document applies to everyone, so it has no owner.' });
    }

    const { data, error } = await supabase
      .from('documents')
      .insert({
        user_id: userId,
        name,
        type,
        is_mandatory: isMandatory,
        is_template: isMandatory,
        description: body.description ? String(body.description) : null,
        file_url: body.fileUrl ? String(body.fileUrl) : null,
        file_name: body.fileName ? String(body.fileName) : null,
        status: 'pending_signature',
        is_hidden: false,
        is_current: true,
        version_number: 1,
        uploaded_at: new Date().toISOString()
      })
      .select('*')
      .maybeSingle();

    if (error) return res.status(500).json({ error: `That document was not created: ${error.message}` });

    await recordAudit(actor, {
      action: 'Create Compliance Document',
      details: `"${name}" (${type}) for ${isMandatory ? 'all candidates' : (userId || 'nobody in particular')}.`,
      entityType: 'document',
      entityId: String(data?.id)
    });

    return res.status(201).json(toDocument(data));
  }

  // ── Update ────────────────────────────────────────────────────────────────
  if (req.method === 'PUT') {
    const { id, ...updates } = (req.body || {}) as Record<string, any>;
    if (!id) return res.status(400).json({ error: 'Missing document id' });

    // Map the panel's camelCase onto the columns, then allowlist. The old
    // version spread the body straight on, so user_id and status were
    // writable by anyone who knew a document id.
    const incoming: Record<string, unknown> = {
      name: updates.name,
      type: updates.type,
      is_mandatory: updates.isMandatory,
      description: updates.description,
      file_url: updates.fileUrl,
      file_name: updates.fileName
    };

    const patch: Record<string, unknown> = {};
    for (const [field, value] of Object.entries(incoming)) {
      if (value === undefined) continue;
      if (EDITABLE.includes(field)) patch[field] = value;
    }

    if (patch.type !== undefined && !TYPES.includes(String(patch.type))) {
      return res.status(422).json({ error: `A document is one of: ${TYPES.join(', ')}.` });
    }
    if (Object.keys(patch).length === 0) {
      return res.status(400).json({ error: 'Nothing to change.' });
    }

    patch.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('documents').update(patch).eq('id', String(id)).select('*').maybeSingle();

    if (error) return res.status(500).json({ error: `That document was not saved: ${error.message}` });
    if (!data) return res.status(404).json({ error: 'Document not found' });

    await recordAudit(actor, {
      action: 'Update Compliance Document',
      details: `"${data.name}" updated.`,
      entityType: 'document',
      entityId: String(id)
    });

    return res.status(200).json(toDocument(data));
  }

  // ── Hide ──────────────────────────────────────────────────────────────────
  if (req.method === 'DELETE') {
    const id = typeof req.query.id === 'string' ? req.query.id : '';
    if (!id) return res.status(400).json({ error: 'Missing document id' });

    const { data, error } = await supabase
      .from('documents')
      .update({ is_hidden: true, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('*')
      .maybeSingle();

    if (error) return res.status(500).json({ error: `That document was not hidden: ${error.message}` });
    if (!data) return res.status(404).json({ error: 'Document not found' });

    await recordAudit(actor, {
      action: 'Hide Compliance Document',
      details: `"${data.name}" hidden.`,
      entityType: 'document',
      entityId: id
    });

    return res.status(200).json({ success: true, document: toDocument(data) });
  }

  res.setHeader('Allow', 'GET, POST, PUT, DELETE');
  return res.status(405).json({ error: 'Method not allowed' });
}
