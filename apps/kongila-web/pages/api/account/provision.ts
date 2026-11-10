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
 * A failure partway through can leave the person with an auth account and no
 * profile. Provisioning is idempotent so an authenticated retry or next login
 * can finish setup without requiring a second auth signup.
 *
 * The operations happen here, with the service role key, after verifying the
 * caller's token. The role is never taken from the request body beyond client
 * or talent: an administrator cannot be created through this route.
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
    const { data: existingUser, error: existingUserError } = await supabase
      .from('users').select('role, name').eq('id', userId).maybeSingle();
    if (existingUserError) {
      console.error('[account/provision] users lookup failed:', existingUserError.message);
      return res.status(500).json({ error: 'Could not verify your account record.' });
    }
    if (existingUser && String(existingUser.role).toLowerCase() !== role) {
      return res.status(409).json({ error: 'This account is already registered with a different role.' });
    }

    const personName = String(name || '').trim();

    if (!existingUser) {
      const { error: userError } = await supabase.from('users').insert({
        id: userId,
        email,
        // The name goes in. This insert left it null, and public.users.name is
        // what the admin company list, the company detail page and the request
        // board all read for the contact, so every organisation on the admin
        // side showed a primary contact with a blank name.
        name: personName || null,
        password_hash: 'auth_managed',
        role,
        status: role === 'talent' ? 'inactive' : 'active',
        email_verified: false
      });
      if (userError) {
        console.error('[account/provision] users insert failed:', userError.message);
        return res.status(500).json({ error: `Could not create your account record: ${userError.message}` });
      }
    } else if (personName && !String((existingUser as any).name || '').trim()) {
      // An account provisioned before the line above existed. Fill the name in
      // on the next pass rather than leaving it blank for ever. A name the
      // person has already set is never overwritten.
      const { error: nameError } = await supabase
        .from('users').update({ name: personName }).eq('id', userId);
      if (nameError) {
        console.warn('[account/provision] users name backfill failed:', nameError.message);
      }
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
    const { data: existingProfile, error: profileLookupError } = await supabase
      .from('client_profiles')
      .select('id, organization_id')
      .eq('user_id', userId)
      .limit(1)
      .maybeSingle();
    if (profileLookupError) {
      console.error('[account/provision] client_profiles lookup failed:', profileLookupError.message);
      return res.status(500).json({ error: 'Could not check your company profile.' });
    }
    if (existingProfile && inviteOrgId && existingProfile.organization_id !== inviteOrgId) {
      return res.status(409).json({ error: 'This account is already linked to a different company.' });
    }

    let organizationId = inviteOrgId || existingProfile?.organization_id || null;

    if (!organizationId) {
      const { data: existingOrganization, error: organizationLookupError } = await supabase
        .from('organizations')
        .select('id')
        .eq('created_by', userId)
        .limit(1)
        .maybeSingle();
      if (organizationLookupError) {
        console.error('[account/provision] organizations lookup failed:', organizationLookupError.message);
        return res.status(500).json({ error: 'Could not check your company record.' });
      }

      organizationId = existingOrganization?.id || null;
      if (!organizationId) {
        // The company must be named. This used to fall back to
        // "<person>'s Company", which put a person's name on a company record
        // and left operations guessing who they were actually dealing with.
        // Both signup paths collect it, so a request without one is a bug in
        // the caller and should say so rather than invent a name.
        const organizationName = String(companyName || '').trim();
        if (!organizationName) {
          return res.status(400).json({
            error: 'A company name is required to create a client account.'
          });
        }

        organizationId = require('crypto').randomUUID();
        const { error: orgError } = await supabase.from('organizations').insert({
          id: organizationId,
          name: organizationName,
          created_by: userId,
          // The account belongs to the company; this person is its primary
          // contact and administrator. created_by records who inserted the
          // row and cannot be transferred, so it is not the same fact.
          primary_contact_user_id: userId,
          contact_email: contactEmail || email || null,
          contact_phone: contactPhone || null
        });
        if (orgError) {
          console.error('[account/provision] organizations insert failed:', orgError.message);
          return res.status(500).json({ error: `Could not create your company: ${orgError.message}` });
        }
      }
    }

    if (!existingProfile) {
      const { error: profileError } = await supabase.from('client_profiles').insert({
        id: require('crypto').randomUUID(),
        user_id: userId,
        organization_id: organizationId,
        position: position || (invitePermission ? 'Team Member' : 'Admin'),
        phone: phone || null,
        permission_level: invitePermission || 'Full Access'
      });
      if (profileError) {
        console.error('[account/provision] client_profiles insert failed:', profileError.message);
        return res.status(500).json({ error: `Could not create your profile: ${profileError.message}` });
      }
    }

    // ── what the caller needs to confirm the account ─────────────────────────
    //
    // This returned { ok, role, organizationId } and nothing else, so the
    // portal could only say "Account created successfully" and had no way to
    // name the company it had just created or tell the person what they are
    // in it. The confirmation screen is built from what comes back here.
    const { data: organization } = await supabase
      .from('organizations')
      .select('id, name, primary_contact_user_id, contact_email, contact_phone, created_at')
      .eq('id', organizationId)
      .maybeSingle();

    // An organisation whose primary contact was never recorded, which is any
    // company created before the column existed, is adopted by whoever is
    // provisioning now if they created it. Nothing is taken from anyone: a
    // contact that is already set is left alone.
    let primaryContactUserId = organization?.primary_contact_user_id || null;
    if (!primaryContactUserId && !inviteOrgId) {
      const { error: adoptError } = await supabase
        .from('organizations')
        .update({ primary_contact_user_id: userId })
        .eq('id', organizationId)
        .is('primary_contact_user_id', null);
      if (adoptError) {
        console.warn('[account/provision] primary contact not set:', adoptError.message);
      } else {
        primaryContactUserId = userId;
      }
    }

    const { data: profileRow } = await supabase
      .from('client_profiles')
      .select('position, permission_level')
      .eq('user_id', userId)
      .maybeSingle();

    return res.status(201).json({
      ok: true,
      role,
      organizationId,
      organization: {
        id: organizationId,
        name: organization?.name || null,
        contactEmail: organization?.contact_email || null,
        contactPhone: organization?.contact_phone || null,
        createdAt: organization?.created_at || null
      },
      membership: {
        isPrimaryContact: String(primaryContactUserId || '') === String(userId),
        joinedByInvitation: Boolean(inviteOrgId),
        position: profileRow?.position || null,
        permissionLevel: profileRow?.permission_level || null
      }
    });
  } catch (error: any) {
    console.error('[account/provision] unexpected failure:', error);
    return res.status(500).json({ error: error.message || 'Could not finish creating your account' });
  }
}
