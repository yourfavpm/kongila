import type { NextApiRequest, NextApiResponse } from 'next';
import { getRequestUser } from '@kongila/database';
import { buildNotification, emailIsConfigured, sendEmail } from '@kongila/notifications';
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

    const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
    if (!normalizedEmail || !organizationId || !permissionLevel) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    if (normalizedEmail.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      return res.status(400).json({ error: 'Enter a valid email address for the invite.' });
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
      email: normalizedEmail,
      permissionLevel: String(permissionLevel),
      name: name || '',
      jobTitle: jobTitle || ''
    });

    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
    const inviteLink = `${baseUrl}/?invite=${encodeURIComponent(token)}`;

    const content = buildNotification('team_invitation', {
      recipientName: String(name || '').trim() || undefined,
      companyName: 'your company',
      inviterName: actor.email?.split('@')[0] || 'A colleague',
      actionUrl: inviteLink,
      expiresIn: '7 days'
    });
    let emailSent = false;
    let emailError: string | undefined;

    if (emailIsConfigured()) {
      const result = await sendEmail({
        to: normalizedEmail,
        subject: content.subject,
        body: content.body
      });
      emailSent = result.success;
      if (!result.success) emailError = result.error || 'Resend did not accept the invitation.';
    } else {
      emailError = 'Email is not configured. Set RESEND_API_KEY and RESEND_FROM.';
    }

    return res.status(200).json({
      success: true,
      emailSent,
      ...(emailError ? { emailError } : {}),
      message: emailSent
        ? 'Invitation email sent. The link is valid for 7 days.'
        : 'Invitation created, but the email was not sent. Share the link manually.',
      inviteLink
    });
  } catch (error: any) {
    console.error('Invite API Error:', error);
    return res.status(500).json({ error: error.message });
  }
}
