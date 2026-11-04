import type { NextApiRequest, NextApiResponse } from 'next';
import { getRequestUser, createUploadUrl } from '@kongila/database';

/**
 * Starting an upload.
 *
 * The portals uploaded straight to Supabase Storage from the browser with
 * the anon key, choosing the object path themselves, and then called
 * getPublicUrl on the result. Nothing stopped a path being aimed at
 * someone else's folder, and three of the four buckets are private, so
 * the URL that came back was dead on arrival.
 *
 * This hands back a signed URL good for one upload to one path, and that
 * path is built from the verified session, not from the request.
 *
 * POST { kind, fileName, contentType, size }
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const actor = await getRequestUser(req);
  if (!actor) return res.status(401).json({ error: 'Not authenticated' });

  const body = (req.body || {}) as Record<string, any>;
  const result = await createUploadUrl(actor, {
    kind: body.kind,
    fileName: body.fileName,
    contentType: body.contentType,
    size: body.size
  });

  if (!result.ok) return res.status(result.status).json({ error: result.error });
  return res.status(200).json(result.data);
}
