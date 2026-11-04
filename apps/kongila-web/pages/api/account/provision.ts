import type { NextApiRequest, NextApiResponse } from 'next';
import { getAuthenticatedUserId, getSupabaseClient } from '@kongila/database';
import { verifyInvite } from '../../../lib/inviteToken';

/**
 * Creates the application records that back a newly registered account.
 *
 * Signup used to do this from the browser: a users upsert, then an
 * organizations insert, then a client_profiles insert, each unchecked against
 * the next. Two problems followed.
 *
 * The browser can no longer write public.users at all. The privilege
 * escalation migration revoked UPDATE and granted it back on name, last_login
 * and updated_at only, so the upsert fails with "permission denied for table
 * users". Granting the column back would re-open the hole, because role lives
 * on that table.
 *
 * And a failure partway through left the person with an auth account and no
 * profile, unable to retry because signing up again answers "already
 * registered".
 *
 * So the whole thing happens here, with the service role key, after verifying
 * the caller's token. The role is never taken from the request body beyond
 * client or talent: an administrator cannot be created through this route.
 */

const SELF_SERVICE_ROLES = new Set(['client', 'talent']);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Not getRequestUser: there is no public.users row yet, by definition.
  const auth = await getAuthenticatedUserId(req);
  if (!auth) return res.status(401).json({ error: 'Not authenticated' });

  const {
    role,
    name,
    companyName,
    inviteToken,
    position,
    phone,
    contactEmail,
    contactPhone
  } = req.body || {};

  if (!SELF_SERVICE_ROLES.has(String(role))) {
    return res.status(400).json({ error: 'role must be client or talent' });
  }

  const supabase = getSupabaseClient();
  const userId = auth.userId;
  const email = auth.email || req.body?.email || null;

  try {
    // If this signup came from an invitation, the organisation and permission
    // level come from re-verifying the signed token here. Client state is not
    // trusted for either.
    let inviteOrgId: string | null = null;
    let invitePermission: string | null = null;
    if (inviteToken) {
      const result = verifyInvite(inviteToken);
      if (!result.ok) return res.status(400).json({ error: result.reason });
      inviteOrgId = result.payload.orgId;
      invitePermission = result.payload.permissionLevel;
    }

    // ── users ────────────────────────────────────────────────────────────────
    const { error: userError } = await supabase.from('users').upsert(
      {
        id: userId,
        email,
        password_hash: 'auth_managed',
        role,
        status: role === 'talent' ? 'inactive' : 'active',
        email_verified: false
      },
      { onConflict: 'id' }
    );
    if (userError) {
      console.error('[account/provision] users upsert failed:', userError.message);
      return res.status(500).json({ error: `Could not create your account record: ${userError.message}` });
    }

    if (role === 'talent') {
      const { error: talentError } = await supabase.from('talent_profiles').upsert(
        { id: userId, user_id: userId, full_name: name || null, status: 'active' },
        { onConflict: 'id' }
      );
      if (talentError) {
        console.error('[account/provision] talent_profiles upsert failed:', talentError.message);
        return res.status(500).json({ error: `Could not create your profile: ${talentError.message}` });
      }
      return res.status(201).json({ ok: true, role });
    }

    // ── client: organisation then profile ────────────────────────────────────
    let organizationId = inviteOrgId;

    if (!organizationId) {
      organizationId = (global as any).crypto?.randomUUID?.() ?? require('crypto').randomUUID();
      const { error: orgError } = await supabase.from('organizations').insert({
        id: organizationId,
        name: companyName || `${name || 'New'}'s Company`,
        created_by: userId,
        contact_email: contactEmail || email || null,
        contact_phone: contactPhone || null
      });
      if (orgError) {
        console.error('[account/provision] organizations insert failed:', orgError.message);
        return res.status(500).json({ error: `Could not create your company: ${orgError.message}` });
      }
    }

    const { error: profileError } = await supabase.from('client_profiles').upsert(
      {
        id: require('crypto').randomUUID(),
        user_id: userId,
        organization_id: organizationId,
        position: position || (invitePermission ? 'Team Member' : 'Admin'),
        phone: phone || null,
        permission_level: invitePermission || 'Full Access'
      },
      { onConflict: 'user_id' }
    );
    if (profileError) {
      console.error('[account/provision] client_profiles upsert failed:', profileError.message);
      return res.status(500).json({ error: `Could not create your profile: ${profileError.message}` });
    }

    return res.status(201).json({ ok: true, role, organizationId });
  } catch (error: any) {
    console.error('[account/provision] unexpected failure:', error);
    return res.status(500).json({ error: error.message || 'Could not finish creating your account' });
  }
}
