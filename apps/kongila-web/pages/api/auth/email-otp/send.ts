import type { NextApiRequest, NextApiResponse } from 'next';
import { sendEmailOtp } from '../../../../lib/emailOtpService';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const result = await sendEmailOtp({
    email: req.body?.email,
    purpose: req.body?.purpose,
    ipAddress: String(req.headers['x-real-ip'] || req.socket.remoteAddress || 'unknown')
  });
  if (!result.ok) return res.status(result.status).json({ error: result.error });
  return res.status(200).json({ ok: true, message: result.message });
}
