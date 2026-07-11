import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { email, organizationId, permissionLevel, name, jobTitle } = req.body;

    if (!email || !organizationId || !permissionLevel) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Generate a scoped registration link for the organization
    // We pass the orgId and invite settings via query parameters.
    // In production, this would be a secure, single-use JWT token.
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
    const params = new URLSearchParams({
      authView: 'signup',
      role: 'client',
      orgId: organizationId,
      inviteEmail: email,
      inviteName: name || '',
      inviteJobTitle: jobTitle || '',
      permissionLevel: permissionLevel
    });

    const inviteLink = `${baseUrl}/?${params.toString()}`;

    // Simulate sending email
    console.log(`[EMAIL SIMULATION] Sending invite to ${email}`);
    console.log(`[EMAIL SIMULATION] Subject: You've been invited to join your company on Kongila`);
    console.log(`[EMAIL SIMULATION] Body: Click the link to register: ${inviteLink}`);

    return res.status(200).json({ 
      success: true, 
      message: 'Invitation sent successfully',
      inviteLink // returned for testing/debugging in the prototype UI
    });
  } catch (error: any) {
    console.error('Invite API Error:', error);
    return res.status(500).json({ error: error.message });
  }
}
