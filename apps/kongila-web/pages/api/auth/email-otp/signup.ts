import type { NextApiRequest, NextApiResponse } from 'next';
import { createAccountWithEmailOtp } from '../../../../lib/emailOtpService';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const result = await createAccountWithEmailOtp({
    email: req.body?.email,
    code: req.body?.code,
    password: req.body?.password,
    role: req.body?.role,
    name: req.body?.name,
    companyName: req.body?.companyName
  });
  if (!result.ok) return res.status(result.status).json({ error: result.error });
  return res.status(201).json({ ok: true, userId: result.userId });
}
