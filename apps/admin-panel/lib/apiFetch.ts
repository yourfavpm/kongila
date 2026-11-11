import { supabase } from './supabaseClient';

/**
 * fetch for this app's own API routes.
 *
 * Attaches the signed-in administrator's access token. The API routes verify
 * it and decide what the caller may read and write, so a call without it comes
 * back 401. Use this instead of bare fetch for anything under /api.
 */
export async function apiFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  let token: string | undefined;
  try {
    const { data } = await supabase.auth.getSession();
    token = data?.session?.access_token;
  } catch {
    // Fall through with no token. The route will answer 401 and the caller
    // handles it like any other failed request.
  }

  const headers = new Headers(init.headers || {});
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');

  // A request that never answers is worse than one that fails.
  //
  // fetch has no timeout of its own, so a route that hangs — a cold
  // serverless function, a database connection that never comes back — leaves
  // the caller awaiting for ever. Anything waiting on it waits for ever too,
  // which is how a loading screen becomes a dead end rather than a delay.
  // Thirty seconds is longer than any of these routes should take and short
  // enough that a person has not given up yet.
  const timeout = (init as any).timeoutMs ?? 30000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    return await fetch(input, {
      ...init,
      headers,
      signal: init.signal ?? controller.signal
    });
  } finally {
    clearTimeout(timer);
  }
}
