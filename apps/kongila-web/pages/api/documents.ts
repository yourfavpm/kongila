import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://bsmwuofugczuhdbintgs.supabase.co';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJzbXd1b2Z1Z2N6dWhkYmludGdzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkxMDAzMTQsImV4cCI6MjA5NDY3NjMxNH0.yhVLhHb0BRfZZjGagF_PwQbYzKVhIOFgAhzoTURvpJc';

/** Document types that must never be created or modified via this endpoint */
const COMPLIANCE_TYPES = ['nda', 'contractor_agreement', 'it_policy', 'data_protection_agreement'];

/** Max total storage per talent in bytes (100MB) */
const MAX_STORAGE_BYTES = 100 * 1024 * 1024;
/** Warn threshold (90MB) */
const WARN_STORAGE_BYTES = 90 * 1024 * 1024;

function getSupabase() {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const supabase = getSupabase();

  // ─── GET — fetch all documents for a talent ─────────────────────────────────
  if (req.method === 'GET') {
    const { userId } = req.query;
    if (!userId) return res.status(400).json({ error: 'userId is required' });

    const { data, error } = await supabase
      .from('documents')
      .select('*')
      .eq('user_id', userId)
      .neq('status', 'deleted')
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
      userId, name, fileName, type, fileUrl, fileSizeBytes,
      certificationName, issuingBody, issueDate, expiryDate,
      isMandatory, templateId, description, versionNumber
    } = req.body;

    if (!userId || !name || !type) {
      return res.status(400).json({ error: 'userId, name, and type are required' });
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
      .neq('status', 'deleted');

    const currentUsage = (existingDocs || []).reduce((sum: number, d: any) => sum + (d.file_size_bytes || 0), 0);
    if (currentUsage + (fileSizeBytes || 0) > MAX_STORAGE_BYTES) {
      return res.status(400).json({
        error: 'Storage limit exceeded. Maximum 100MB of documents allowed per talent. Please remove older documents first.'
      });
    }

    // If this is a CV or portfolio, supersede the previous active version
    if (type === 'cv' || type === 'portfolio') {
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

    // Emit audit notification for CV re-upload flagging
    return res.status(201).json({ success: true, documentId: docId });
  }

  // ─── PATCH — update document metadata / status ───────────────────────────────
  if (req.method === 'PATCH') {
    const { docId, updates } = req.body;
    if (!docId || !updates) return res.status(400).json({ error: 'docId and updates are required' });

    // Never allow updating compliance docs to a non-compliance type
    if (updates.type && COMPLIANCE_TYPES.includes(updates.type)) {
      return res.status(403).json({ error: 'Cannot reassign a document to a compliance type.' });
    }

    const { error } = await supabase
      .from('documents')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', docId);

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ success: true });
  }

  // ─── DELETE — soft-delete only (set status = 'deleted') ─────────────────────
  if (req.method === 'DELETE') {
    const { docId, userId, type } = req.query as Record<string, string>;
    if (!docId) return res.status(400).json({ error: 'docId is required' });

    // Block deletion of compliance documents
    const { data: docData } = await supabase.from('documents').select('type, status').eq('id', docId).single();
    if (docData && COMPLIANCE_TYPES.includes(docData.type)) {
      return res.status(403).json({ error: 'Compliance documents cannot be deleted from here.' });
    }

    // Block deleting a CV if it is the only one (no replacement, no superseded versions)
    if (docData?.type === 'cv' || type === 'cv') {
      const { data: allCvs } = await supabase
        .from('documents')
        .select('id, status')
        .eq('user_id', userId || '')
        .eq('type', 'cv')
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
      .update({ status: 'deleted', updated_at: new Date().toISOString() })
      .eq('id', docId);

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
