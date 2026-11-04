// ─────────────────────────────────────────────────────────────────────────────
// Signed storage URLs
//
// CVs, identity documents and signed NDAs were uploaded with getPublicUrl, so
// anyone holding the link could read them without signing in. Once the bucket
// is private those links stop working.
//
// Rather than change the ~41 places the UI renders a file link, the URLs are
// swapped for short-lived signed ones on the way out of /api/db. The response
// is already scoped to the caller at that point, so a talent only ever gets
// links to their own documents and a client only to what the scoping allows.
//
// Anything that is not a Supabase storage URL is left exactly as it is, so
// external links, data URIs and the onboarding video are untouched.
// ─────────────────────────────────────────────────────────────────────────────

/** How long a signed URL stays valid. */
const SIGNED_URL_TTL_SECONDS = 60 * 60;

/** Re-sign a little before expiry so a cached link is never handed out stale. */
const CACHE_TTL_MS = 50 * 60 * 1000;

/** Matches both public and already-signed Supabase storage object URLs. */
const STORAGE_URL = /\/storage\/v1\/object\/(?:public|sign)\/([^/?]+)\/([^?#]+)/;

interface CacheEntry {
  url: string;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();

function cacheKey(bucket: string, path: string): string {
  return `${bucket}::${path}`;
}

/** Pulls the bucket and object path out of a storage URL, or null if it isn't one. */
export function parseStorageUrl(value: unknown): { bucket: string; path: string } | null {
  if (typeof value !== 'string' || !value.includes('/storage/v1/object/')) return null;
  const match = value.match(STORAGE_URL);
  if (!match) return null;
  const bucket = match[1];
  let path = match[2];
  try {
    path = decodeURIComponent(path);
  } catch {
    // Leave the raw path if it isn't valid percent-encoding.
  }
  if (!bucket || !path) return null;
  return { bucket, path };
}

/** Walks any value and calls visit() on every string it finds. */
function walkStrings(node: any, visit: (s: string) => void, depth = 0): void {
  if (depth > 12 || node == null) return;
  if (typeof node === 'string') {
    visit(node);
    return;
  }
  if (Array.isArray(node)) {
    for (const item of node) walkStrings(item, visit, depth + 1);
    return;
  }
  if (typeof node === 'object') {
    for (const key of Object.keys(node)) walkStrings(node[key], visit, depth + 1);
  }
}

/** Walks any value and rewrites strings via replace(). Returns a new structure. */
function mapStrings(node: any, replace: (s: string) => string, depth = 0): any {
  if (depth > 12 || node == null) return node;
  if (typeof node === 'string') return replace(node);
  if (Array.isArray(node)) return node.map(item => mapStrings(item, replace, depth + 1));
  if (typeof node === 'object') {
    const out: Record<string, any> = {};
    for (const key of Object.keys(node)) out[key] = mapStrings(node[key], replace, depth + 1);
    return out;
  }
  return node;
}

/**
 * Replaces every Supabase storage URL in `db` with a signed one.
 *
 * `supabase` is passed in rather than imported so this module stays free of a
 * circular dependency on the package index.
 *
 * A path that fails to sign keeps its original URL. That way a missing file or
 * a storage hiccup degrades to the previous behaviour instead of blanking a
 * link and looking like data loss.
 */
export async function signStoredFileUrls(db: any, supabase: any): Promise<any> {
  if (!db || !supabase) return db;

  const now = Date.now();

  // Pass one: collect the distinct paths that still need signing.
  const needed = new Map<string, { bucket: string; path: string }>();
  walkStrings(db, (value: string) => {
    const parsed = parseStorageUrl(value);
    if (!parsed) return;
    const key = cacheKey(parsed.bucket, parsed.path);
    const hit = cache.get(key);
    if (hit && hit.expiresAt > now) return;
    needed.set(key, parsed);
  });

  // Sign the misses, batched per bucket.
  if (needed.size > 0) {
    const byBucket = new Map<string, string[]>();
    for (const { bucket, path } of needed.values()) {
      if (!byBucket.has(bucket)) byBucket.set(bucket, []);
      byBucket.get(bucket)!.push(path);
    }

    for (const [bucket, paths] of byBucket.entries()) {
      try {
        const { data, error } = await supabase.storage
          .from(bucket)
          .createSignedUrls(paths, SIGNED_URL_TTL_SECONDS);

        if (error) {
          console.warn(`[signedUrls] could not sign ${paths.length} path(s) in ${bucket}: ${error.message}`);
          continue;
        }

        for (const row of data || []) {
          if (!row?.signedUrl || row?.error) continue;
          cache.set(cacheKey(bucket, row.path), {
            url: row.signedUrl,
            expiresAt: now + CACHE_TTL_MS
          });
        }
      } catch (e: any) {
        console.warn(`[signedUrls] signing failed for bucket ${bucket}: ${e?.message || e}`);
      }
    }
  }

  // Pass two: substitute. Unsigned paths keep their original value.
  return mapStrings(db, (value: string) => {
    const parsed = parseStorageUrl(value);
    if (!parsed) return value;
    const hit = cache.get(cacheKey(parsed.bucket, parsed.path));
    if (!hit || hit.expiresAt <= now) return value;
    return hit.url;
  });
}

/** Test seam: drops the in-memory cache. */
export function clearSignedUrlCache(): void {
  cache.clear();
}
