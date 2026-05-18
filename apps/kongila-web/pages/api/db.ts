import type { NextApiRequest, NextApiResponse } from 'next';
import { readDb, writeDb } from '@kongila/database';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'POST') {
    try {
      writeDb(req.body);
      return res.status(200).json({ success: true });
    } catch (e) {
      return res.status(500).json({ error: 'Failed to write database' });
    }
  }
  
  try {
    const data = readDb();
    return res.status(200).json(data);
  } catch (e) {
    return res.status(500).json({ error: 'Failed to read database' });
  }
}
