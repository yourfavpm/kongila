import type { NextApiRequest, NextApiResponse } from 'next';
import { readDbAsync, writeDbAsync } from '@kongila/database';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'POST') {
    try {
      const existing = await readDbAsync();
      const merged = {
        ...existing,
        ...req.body
      };
      await writeDbAsync(merged);
      return res.status(200).json({ success: true });
    } catch (e) {
      return res.status(500).json({ error: 'Failed to write database' });
    }
  }
  
  try {
    const data = await readDbAsync();
    return res.status(200).json(data);
  } catch (e) {
    return res.status(500).json({ error: 'Failed to read database' });
  }
}

