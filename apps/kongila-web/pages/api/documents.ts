import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { getRequestUser, supersedePreviousVersions } from '@kongila/database';
import { isVersionedType } from '@kongila/workflows';

// No fallback on purpose. These used to default to the staging project, so a
// deploy with missing variables wrote documents into staging and looked fine.
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/**
 * documents_type_check allows exactly: CV, portfolio, NDA, agreement,
 * certification, IT_Ethics_Policy. The portals send lowercase variants, which
 * the database rejects, so every upload failed. Normalising here means one
 * place to fix rather than every caller, and a caller that sends something
 * unrecognised is told so instead of having its row silently refused.
 */
const DOCUMENT_TYPES = ['CV', 'portfolio', 'NDA', 'agreement', 'certification', 'IT_Ethics_Policy'];

function normaliseDocumentType(value: unknown): string | null {
  const given = String(value || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  const match = DOCUMENT_TYPES.find(t => t.toLowerCase() === given);
  return match || null;
}
/** Document types that must never be created or modified via this endpoint */
// Must use the same vocabulary as documents_type_check, or the guard below
// silently stops matching. The previous list ('nda', 'contractor_agreement',
// 'it_policy', 'data_protection_agreement') held values the column does not
// permit, so it could never have blocked anything.
const COMPLIANCE_TYPES = ['NDA', 'agreement', 'IT_Ethics_Policy'];

/** Max total storage per talent in bytes (100MB) */
const MAX_STORAGE_BYTES = 100 * 1024 * 1024;
/** Warn threshold (90MB) */
const WARN_STORAGE_BYTES = 90 * 1024 * 1024;

function getSupabase() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error(
      'Supabase is not configured: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must both be set.'
    );
  }
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const supabase = getSupabase();

  // This route had no authentication at all. It took `userId` from the
  // query string or the body and used it directly, so any caller could
  // read, add to or archive anybody's documents by changing one value.
  // Whose documents these are is decided here now, from the verified
  // token, and only an operator may act on someone else's.
  const actor = await getRequestUser(req);
  if (!actor) return res.status(401).json({ error: 'Not authenticated' });

  const ownerFor = (requested?: string | null): string => {
    if (actor.kind === 'admin' && requested) return String(requested);
    return String(actor.talentProfileId || actor.userId);
  };

  const mayTouch = async (docId: string): Promise<boolean> => {
    if (actor.kind === 'admin') return true;
    const { data } = await supabase.from('documents').select('user_id').eq('id', docId).maybeSingle();
    if (!data) return false;
    return String(data.user_id) === String(actor.talentProfileId || actor.userId);
  };

  // ─── GET — fetch all documents for a talent ─────────────────────────────────
  if (req.method === 'GET') {
    const userId = ownerFor(req.query.userId as string);

    const { data, error } = await supabase
      .from('documents')
      .select('*')
      .eq('user_id', userId)
      .neq('status', 'archived')
      .order('uploaded_at', { ascending: false });

    if (error) return res.status(500).json({ error: error.message });

    // Compute total storage usage
    const totalBytes = (data || []).reduce((sum: number, d: any) => sum + (d.file_size_bytes || 0), 0);

    return res.status(200).json({
      documents: data || [],
      storageUsageBytes: totalBytes,
      storageWarning: totalBytes >= WARN_STORAGE_BYTES,
      storageFull: totalBytes >= MAX_STORAGE_BYTES
    });
  }

  // ─── POST — create new document record ──────────────────────────────────────
  if (req.method === 'POST') {
    const {
      userId: requestedUserId, name, fileName, type: rawType, fileUrl, fileSizeBytes,
      certificationName, issuingBody, issueDate, expiryDate,
      isMandatory, templateId, description, versionNumber
    } = req.body;

    const userId = ownerFor(requestedUserId);
    if (!name || !rawType) {
      return res.status(400).json({ error: 'userId, name, and type are required' });
    }

    const type = normaliseDocumentType(rawType);
    if (!type) {
      return res.status(400).json({
        error: `"${rawType}" is not a document type. Expected one of: ${DOCUMENT_TYPES.join(', ')}.`
      });
    }

    // Block manual upload of compliance doc types
    if (COMPLIANCE_TYPES.includes(type)) {
      return res.status(403).json({
        error: 'Compliance documents cannot be uploaded manually. They are created via the Vetting or Contracts workflow.'
      });
    }

    // Certification metadata validation
    if (type === 'certification') {
      if (!certificationName || !issuingBody || !issueDate) {
        return res.status(400).json({
          error: 'Certifications require certificationName, issuingBody, and issueDate.'
        });
      }
    }

    // Check total storage cap
    const { data: existingDocs } = await supabase
      .from('documents')
      .select('file_size_bytes')
      .eq('user_id', userId)
      .neq('status', 'archived');

    const currentUsage = (existingDocs || []).reduce((sum: number, d: any) => sum + (d.file_size_bytes || 0), 0);
    if (currentUsage + (fileSizeBytes || 0) > MAX_STORAGE_BYTES) {
      return res.status(400).json({
        error: 'Storage limit exceeded. Maximum 100MB of documents allowed per talent. Please remove older documents first.'
      });
    }

    // If this is a CV or portfolio, supersede the previous active version
    if (type === 'CV' || type === 'portfolio') {
      await supabase
        .from('documents')
        .update({ status: 'superseded', updated_at: new Date().toISOString() })
        .eq('user_id', userId)
        .eq('type', type)
        .eq('status', 'uploaded');
    }

    const now = new Date().toISOString();
    const docId = `doc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    const row: any = {
      id: docId,
      user_id: userId,
      name: name,
      file_name: fileName || name,
      type: type,
      file_url: fileUrl || null,
      file_size_bytes: fileSizeBytes || 0,
      status: 'uploaded',
      version_number: versionNumber || 1,
      is_mandatory: isMandatory || false,
      is_hidden: false,
      template_id: templateId || null,
      description: description || null,
      uploaded_at: now,
      updated_at: now,
      requires_re_review: false
    };

    if (type === 'certification') {
      row.certification_name = certificationName;
      row.issuing_body = issuingBody;
      row.issue_date = issueDate;
      row.expiry_date = expiryDate || null;
    }

    const { error } = await supabase.from('documents').insert(row);
    if (error) return res.status(500).json({ error: error.message });

    // A new CV or portfolio replaces the ones before it. The version
    // number used to be computed in the browser and nothing marked the
    // old rows superseded, so the list showed four CVs with no sign of
    // which one counted.
    let version = row.version_number;
    if (isVersionedType(row.type) && row.user_id) {
      const superseded = await supersedePreviousVersions(actor, {
        documentId: docId, userId: String(row.user_id), type: String(row.type)
      });
      if (superseded.ok) version = superseded.data.versionNumber;
      else console.warn('[api/documents] version chain not updated:', superseded.error);
    }

    return res.status(201).json({ success: true, documentId: docId, versionNumber: version });
  }

  // ─── PATCH — update document metadata / status ───────────────────────────────
  if (req.method === 'PATCH') {
    const { docId, updates } = req.body;
    if (!docId || !updates) return res.status(400).json({ error: 'docId and updates are required' });
    if (!(await mayTouch(docId))) return res.status(403).json({ error: 'That document is not yours.' });

    // Never allow updating compliance docs to a non-compliance type
    if (updates.type && COMPLIANCE_TYPES.includes(updates.type)) {
      return res.status(403).json({ error: 'Cannot reassign a document to a compliance type.' });
    }

    // The spread used to pass the body straight through, so a caller could
    // set user_id and move the document to someone else, or set status and
    // mark their own upload verified.
    const EDITABLE = [
      'name', 'file_name', 'type', 'file_url', 'file_size', 'file_size_bytes',
      'certification_name', 'issuing_body', 'issue_date', 'expiry_date',
      'is_hidden', 'description'
    ];
    const patch: Record<string, unknown> = {};
    const refused: string[] = [];
    for (const [field, value] of Object.entries(updates)) {
      if (value === undefined) continue;
      if (EDITABLE.includes(field)) patch[field] = value;
      else refused.push(field);
    }
    if (refused.length > 0) {
      return res.status(403).json({
        error: `${refused.join(', ')} cannot be changed here.`
      });
    }
    if (Object.keys(patch).length === 0) {
      return res.status(400).json({ error: 'Nothing to change.' });
    }

    const { error } = await supabase
      .from('documents')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', docId);

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ success: true });
  }

  // ─── DELETE — soft-delete only (set status = 'archived') ─────────────────────
  if (req.method === 'DELETE') {
    const { docId, type } = req.query as Record<string, string>;
    if (!docId) return res.status(400).json({ error: 'docId is required' });
    if (!(await mayTouch(docId))) return res.status(403).json({ error: 'That document is not yours.' });

    const userId = ownerFor(req.query.userId as string);

    // Block deletion of compliance documents
    const { data: docData } = await supabase.from('documents').select('type, status').eq('id', docId).single();
    if (docData && COMPLIANCE_TYPES.includes(docData.type)) {
      return res.status(403).json({ error: 'Compliance documents cannot be deleted from here.' });
    }

    // Block deleting a CV if it is the only one (no replacement, no superseded versions)
    if (docData?.type === 'CV' || type === 'CV') {
      const { data: allCvs } = await supabase
        .from('documents')
        .select('id, status')
        .eq('user_id', userId || '')
        .eq('type', 'CV')
        .neq('id', docId);

      const hasOtherActive = (allCvs || []).some((d: any) => d.status === 'uploaded');
      if (!hasOtherActive) {
        return res.status(400).json({
          error: 'You must upload a replacement CV before removing this one.'
        });
      }
    }

    // Soft delete — documents are never permanently deleted
    const { error } = await supabase
      .from('documents')
      .update({ status: 'archived', updated_at: new Date().toISOString() })
      .eq('id', docId);

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
