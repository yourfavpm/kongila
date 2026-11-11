import type { NextApiRequest, NextApiResponse } from 'next';
import { resetAccountPasswordWithEmailOtp } from '../../../../lib/emailOtpService';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const result = await resetAccountPasswordWithEmailOtp({
    email: req.body?.email,
    code: req.body?.code,
    password: req.body?.password
  });
  if (!result.ok) return res.status(result.status).json({ error: result.error });
  return res.status(200).json({ ok: true });
}
