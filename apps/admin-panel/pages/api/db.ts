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
      // In writeDbAsync, errors are caught internally. Let's just pass it.
      await writeDbAsync(merged);
      return res.status(200).json({ success: true });
    } catch (e: any) {
      return res.status(500).json({ error: e.message || 'Failed to write database' });
    }
  }
  
  try {
    const data = await readDbAsync();
    res.setHeader('Cache-Control', 's-maxage=15, stale-while-revalidate=30');
    return res.status(200).json(data);
  } catch (e: any) {
    return res.status(500).json({ error: e.message || 'Failed to read database' });
  }
}

