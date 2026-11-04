/**
 * Uploading a file.
 *
 * The portals uploaded straight to Supabase Storage from the browser with
 * the anon key, and then called `getPublicUrl` on the result. Two problems,
 * both live:
 *
 *   - The path was chosen in the browser. Nothing stopped a candidate
 *     writing to another candidate's folder, or to a compliance path, by
 *     naming one.
 *   - Three of the four buckets are private, so `getPublicUrl` returned a
 *     link that 400s. Every document uploaded since the buckets were
 *     locked down has a dead URL stored against it.
 *
 * The server decides the path now, from the verified session, and issues a
 * short-lived signed upload URL for exactly that path. The browser uploads
 * to it and nothing else. Reading is unchanged: `signDbFileUrls` swaps
 * stored URLs for signed ones on the way out.
 */

import { getSupabaseClient } from './index';
import type { RequestActor as Actor } from './scope';

export interface UploadResult<T = any> {
  ok: boolean;
  status: number;
  error?: string;
  data?: T;
}

function fail(status: number, error: string): UploadResult {
  return { ok: false, status, error };
}

/**
 * What may be uploaded, where it goes, and who may do it.
 *
 * The folder is always built from the caller's own id, so a path cannot
 * be aimed at somebody else.
 */
export const UPLOAD_KINDS = {
  talent_document: {
    bucket: 'documents',
    folder: (actor: Actor) => `${actor.talentProfileId || actor.userId}`,
    allow: (actor: Actor) => actor.kind === 'talent',
    maxBytes: 15 * 1024 * 1024,
    types: [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'image/png', 'image/jpeg', 'image/webp'
    ]
  },
  talent_avatar: {
    bucket: 'profile-assets',
    folder: (actor: Actor) => `avatars/${actor.userId}`,
    allow: (actor: Actor) => actor.kind === 'talent' || actor.kind === 'client',
    maxBytes: 5 * 1024 * 1024,
    types: ['image/png', 'image/jpeg', 'image/webp']
  },
  message_attachment: {
    bucket: 'message-attachments',
    folder: (actor: Actor) => `${actor.userId}`,
    // Anyone signed in may attach a file to their own message. The
    // folder is their own user id, so they cannot write anywhere else.
    allow: () => true,
    maxBytes: 15 * 1024 * 1024,
    types: [
      'application/pdf', 'image/png', 'image/jpeg', 'image/webp',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/plain', 'text/csv'
    ]
  },
  compliance_document: {
    bucket: 'compliance-documents',
    folder: () => 'templates',
    allow: (actor: Actor) => actor.kind === 'admin',
    maxBytes: 15 * 1024 * 1024,
    types: ['application/pdf']
  }
} as const;

export type UploadKind = keyof typeof UPLOAD_KINDS;

/**
 * Strips a filename back to something safe to put in a path.
 *
 * A name carrying `../`, a leading slash or a null byte is how an upload
 * ends up outside its own folder.
 */
export function safeFileName(name: unknown): string {
  const base = String(name || 'file')
    .split(/[\\/]/).pop() || 'file';
  const cleaned = base
    .replace(/\0/g, '')
    .replace(/[^A-Za-z0-9._-]+/g, '_')
    .replace(/^[._]+/, '')
    .slice(0, 120);
  return cleaned || 'file';
}

/**
 * Issues a signed upload URL for one file.
 *
 * The token is good for one upload to one path and expires on its own, so
 * handing it to the browser gives away nothing else.
 */
export async function createUploadUrl(
  actor: Actor,
  input: { kind: string; fileName: string; contentType?: string | null; size?: unknown }
): Promise<UploadResult> {
  if (!actor) return fail(401, 'Not authenticated.');

  const kind = String(input.kind || '') as UploadKind;
  const spec = UPLOAD_KINDS[kind];
  if (!spec) return fail(400, `"${input.kind}" is not something you can upload here.`);
  if (!spec.allow(actor)) return fail(403, 'You are not able to upload that.');

  const contentType = String(input.contentType || '').toLowerCase().split(';')[0].trim();
  if (!contentType) return fail(422, 'The file type is missing.');
  if (!(spec.types as readonly string[]).includes(contentType)) {
    return fail(422, `${contentType} is not a file type we accept here.`);
  }

  const size = Number(input.size);
  if (!Number.isFinite(size) || size <= 0) return fail(422, 'The file size is missing.');
  if (size > spec.maxBytes) {
    return fail(413, `That file is larger than ${Math.round(spec.maxBytes / (1024 * 1024))}MB.`);
  }

  // The path is built here, never taken from the caller. A unique prefix
  // means two uploads of the same name do not overwrite each other, which
  // the old `upsert: true` allowed across folders.
  const unique = globalThis.crypto?.randomUUID?.()
    || `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  const path = `${spec.folder(actor)}/${unique}-${safeFileName(input.fileName)}`;

  const supabase = getSupabaseClient();
  const { data, error } = await supabase.storage
    .from(spec.bucket)
    .createSignedUploadUrl(path);

  if (error || !data) {
    return fail(500, `The upload could not be started: ${error?.message || 'no URL returned'}`);
  }

  return {
    ok: true,
    status: 200,
    data: {
      bucket: spec.bucket,
      path: data.path || path,
      token: data.token,
      signedUrl: data.signedUrl,
      // What to store against the record. signDbFileUrls turns this into a
      // signed read URL on the way out, so nothing downstream changes.
      storedUrl: storageUrlFor(spec.bucket, data.path || path)
    }
  };
}

/**
 * The canonical stored form of an uploaded object.
 *
 * It looks like a public URL and is never served as one: the buckets are
 * private, and every read goes through `signDbFileUrls`, which recognises
 * this shape and swaps it for a signed link.
 */
export function storageUrlFor(bucket: string, path: string): string {
  const base = String(process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/+$/, '');
  const encoded = path.split('/').map(encodeURIComponent).join('/');
  return `${base}/storage/v1/object/public/${bucket}/${encoded}`;
}
