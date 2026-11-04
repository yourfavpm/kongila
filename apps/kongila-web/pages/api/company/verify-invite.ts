import type { NextApiRequest, NextApiResponse } from 'next';
import { verifyInvite } from '../../../lib/inviteToken';

/**
 * Checks an invitation token and returns what it contains.
 *
 * Unauthenticated by design: it runs before the invited person has an account.
 * It reveals nothing the caller does not already hold, and a token that fails
 * the signature check returns the same message as a malformed one, so the
 * endpoint cannot be used to probe for valid organisation ids.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { token } = req.body || {};

  let result;
  try {
    result = verifyInvite(token);
  } catch (error: any) {
    // Thrown only when the signing secret is missing from the environment.
    console.error('[company/verify-invite]', error.message);
    return res.status(500).json({ error: 'Invitations are not configured on this environment.' });
  }

  if (!result.ok) {
    return res.status(400).json({ error: result.reason });
  }

  const { orgId, email, permissionLevel, name, jobTitle } = result.payload;
  return res.status(200).json({ ok: true, orgId, email, permissionLevel, name, jobTitle });
}
