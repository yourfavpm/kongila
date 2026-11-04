import type { NextApiRequest, NextApiResponse } from 'next';
import { getRequestUser } from '@kongila/database';
import { signInvite } from '../../../lib/inviteToken';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // This endpoint had no authentication at all, so anyone could mint an
  // invitation into any organisation.
  const actor = await getRequestUser(req);
  if (!actor) return res.status(401).json({ error: 'Not authenticated' });

  try {
    const { email, organizationId, permissionLevel, name, jobTitle } = req.body;

    if (!email || !organizationId || !permissionLevel) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // A client may only invite into their own organisation. Operations may
    // invite into any. The organisation is never taken on trust from the body
    // without this check.
    const ownOrg = actor.kind === 'client' && String(actor.organizationId) === String(organizationId);
    if (actor.kind !== 'admin' && !ownOrg) {
      console.warn(
        `[company/invite] ${actor.kind} ${actor.userId} attempted to invite into org ${organizationId}`
      );
      return res.status(403).json({ error: 'Not authorised to invite into this organisation' });
    }

    // One opaque, signed, expiring token instead of orgId and permissionLevel
    // as editable query parameters.
    const token = signInvite({
      orgId: String(organizationId),
      email: String(email).trim().toLowerCase(),
      permissionLevel: String(permissionLevel),
      name: name || '',
      jobTitle: jobTitle || ''
    });

    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
    const inviteLink = `${baseUrl}/?invite=${encodeURIComponent(token)}`;

    // No email provider is wired yet, so the link is returned to the inviter
    // to pass on by hand. Once email lands, send it and stop returning it.
    console.log(`[EMAIL SIMULATION] Sending invite to ${email}`);
    console.log(`[EMAIL SIMULATION] Subject: You've been invited to join your company on Kongila`);
    console.log(`[EMAIL SIMULATION] Body: Click the link to register: ${inviteLink}`);

    return res.status(200).json({
      success: true,
      message: 'Invitation created. The link is valid for 7 days.',
      inviteLink
    });
  } catch (error: any) {
    console.error('Invite API Error:', error);
    return res.status(500).json({ error: error.message });
  }
}
