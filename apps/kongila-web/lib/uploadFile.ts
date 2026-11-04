import { apiFetch } from './apiFetch';
import { supabase } from './supabaseClient';

export interface UploadedFile {
  /** Store this against the record. Reads swap it for a signed link. */
  url: string;
  /** The object path inside the bucket. */
  path: string;
  bucket: string;
  name: string;
  size: number;
  contentType: string;
}

/**
 * Uploads one file through the server.
 *
 * The browser used to pick the object path itself and upload with the anon
 * key, so a path could be aimed at another person's folder. Now the server
 * decides the path from the signed-in session and hands back a signed URL
 * good for that one upload.
 *
 * `kind` is one of the kinds the upload route knows: talent_document,
 * talent_avatar, message_attachment, compliance_document. It decides the
 * bucket, the folder, the size limit and the accepted file types.
 */
export async function uploadFile(kind: string, file: File): Promise<UploadedFile> {
  const contentType = file.type || 'application/octet-stream';

  const start = await apiFetch('/api/uploads', {
    method: 'POST',
    body: JSON.stringify({
      kind,
      fileName: file.name,
      contentType,
      size: file.size
    })
  });

  const ticket = await start.json().catch(() => ({}));
  if (!start.ok) throw new Error(ticket?.error || 'That file could not be uploaded.');

  const { error } = await supabase.storage
    .from(ticket.bucket)
    .uploadToSignedUrl(ticket.path, ticket.token, file, { contentType });

  if (error) throw new Error(`That file could not be uploaded: ${error.message}`);

  return {
    url: ticket.storedUrl,
    path: ticket.path,
    bucket: ticket.bucket,
    name: file.name,
    size: file.size,
    contentType
  };
}
