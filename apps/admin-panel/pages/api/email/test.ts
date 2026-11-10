import type { NextApiRequest, NextApiResponse } from 'next';
import { getRequestUser } from '@kongila/database';
import { emailIsConfigured, sendEmail } from '@kongila/notifications';

/**
 * Sends one test message to the signed-in operator's own address.
 * The recipient and message cannot be supplied by the request, preventing
 * this diagnostic route from becoming an email-sending relay.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const actor = await getRequestUser(req);
  if (!actor) return res.status(401).json({ error: 'Not authenticated' });
  if (actor.kind !== 'admin') return res.status(403).json({ error: 'Not authorised' });
  if (!actor.email) return res.status(422).json({ error: 'Your operator account has no email address.' });

  res.setHeader('Cache-Control', 'private, no-store');
  if (!emailIsConfigured()) {
    return res.status(503).json({
      error: 'Email is not configured. Set RESEND_API_KEY and RESEND_FROM on the admin app.'
    });
  }

  const result = await sendEmail({
    to: actor.email,
    subject: 'Kongila email integration test',
    body:
      `Hi,\n\nThis test confirms that Kongila can send email through Resend.\n\n` +
      `Sent at: ${new Date().toISOString()}\n\nThe Kongila team`
  });

  if (!result.success) {
    return res.status(502).json({
      error: result.error || 'Resend did not accept the test email.',
      configured: result.configured
    });
  }

  return res.status(200).json({
    success: true,
    recipient: actor.email,
    messageId: result.messageId
  });
}
