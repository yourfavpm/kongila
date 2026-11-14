import type { NextApiRequest, NextApiResponse } from 'next';

/**
 * Serve only LibreSpeed's two client-side assets through the app origin. Its
 * classic Web Worker must be same-origin with the page, while the test data
 * endpoints may live on the separately configured LibreSpeed backend.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).end();
  const asset = String(req.query.asset || '');
  if (asset !== 'speedtest.js' && asset !== 'speedtest_worker.js') return res.status(404).end();
  const base = process.env.NEXT_PUBLIC_LIBRESPEED_URL?.trim().replace(/\/$/, '');
  if (!base) return res.status(503).json({ error: 'LibreSpeed is not configured' });

  try {
    const upstream = await fetch(`${base}/${asset}`, { headers: { Accept: 'application/javascript, text/javascript, */*' } });
    if (!upstream.ok) return res.status(502).json({ error: `LibreSpeed asset returned ${upstream.status}` });
    const body = await upstream.text();
    res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=3600, stale-while-revalidate=86400');
    res.status(200).send(body);
  } catch (error) {
    console.error('[vetting/librespeed] failed to load upstream asset', error);
    res.status(502).json({ error: 'Could not load the LibreSpeed test asset' });
  }
}
