import type { NextApiRequest, NextApiResponse } from 'next';
import { getAuthenticatedUserId, getSupabaseClient } from '@kongila/database';

/**
 * Marks the signed-in talent active once onboarding is complete.
 *
 * This was `supabase.from('users').update({ status: 'active' })` in the
 * browser, which now fails: the privilege escalation migration revoked UPDATE
 * on public.users from authenticated, granting back only name, last_login and
 * updated_at.
 *
 * The caller can only ever activate themselves. The id comes from the verified
 * token, never from the request body.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const auth = await getAuthenticatedUserId(req);
  if (!auth) return res.status(401).json({ error: 'Not authenticated' });

  const supabase = getSupabaseClient();

  const { error } = await supabase
    .from('users')
    .update({ status: 'active' })
    .eq('id', auth.userId);

  if (error) {
    console.error('[account/activate] failed:', error.message);
    return res.status(500).json({ error: `Could not activate your account: ${error.message}` });
  }

  return res.status(200).json({ ok: true });
}
