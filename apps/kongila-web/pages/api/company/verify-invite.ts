import type { NextApiRequest, NextApiResponse } from 'next';
import { getSupabaseClient } from '@kongila/database';
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

  // The name of the company they are joining. The signup form asked an
  // invited colleague to type a company name, which provisioning then ignored
  // in favour of the organisation in the token, so the field could disagree
  // with the account it was creating. The form now states the company instead
  // of asking for it, which is what this is for.
  //
  // It is not a disclosure: whoever holds a signed token for this
  // organisation was sent it by one of its administrators.
  let organizationName: string | null = null;
  try {
    const { data } = await getSupabaseClient()
      .from('organizations').select('name').eq('id', orgId).maybeSingle();
    organizationName = data?.name || null;
  } catch (error: any) {
    // A readable name is a nicety. A failure here must not stop a valid
    // invitation being accepted.
    console.warn('[company/verify-invite] organisation name lookup failed:', error?.message);
  }

  return res.status(200).json({
    ok: true, orgId, organizationName, email, permissionLevel, name, jobTitle
  });
}
