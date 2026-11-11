import { supabase } from './supabaseClient';

/**
 * fetch for this app's own API routes, with the signed-in user's token.
 *
 * The routes verify it and decide what the caller may read, so a call
 * without it comes back 401. Use this instead of bare fetch for anything
 * under /api.
 */
export async function apiFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  let token: string | undefined;
  try {
    const { data } = await supabase.auth.getSession();
    token = data?.session?.access_token;
  } catch {
    // Fall through with no token. The route answers 401 and the caller
    // handles it like any other failed request.
  }
  const headers = new Headers(init.headers || {});
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  return fetch(input, { ...init, headers });
}
