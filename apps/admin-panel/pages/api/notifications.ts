import { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { talentId, type, subject, message, stage, isRejection } = req.body;

  // TODO: Integrate with Resend for actual email delivery
  // TODO: Integrate with in-app notification database table

  console.log('----------------------------------------------------');
  console.log(`[NOTIFICATION MOCK] Type: ${type}`);
  console.log(`To Talent ID: ${talentId}`);
  console.log(`Subject: ${subject}`);
  console.log(`Message: ${message}`);
  console.log(`Stage Context: ${stage}`);
  console.log(`Is Rejection?: ${isRejection}`);
  console.log('----------------------------------------------------');

  return res.status(200).json({ success: true, message: 'Notification queued successfully.' });
}
