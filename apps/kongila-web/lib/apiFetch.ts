import { supabase } from './supabaseClient';

/**
 * fetch for this app's own API routes.
 *
 * Attaches the signed-in user's access token. The API routes verify it and
 * decide what the caller may read and write, so a call without it comes back
 * 401. Use this instead of bare fetch for anything under /api.
 *
 * supabase-js keeps the session in localStorage and refreshes it in the
 * background, so getSession returns a current token without a round trip in
 * the common case.
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

  return fetch(input, { ...init, headers });
}
