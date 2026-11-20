import type { NextApiRequest, NextApiResponse } from 'next';
import { getRequestUser, getContractDocumentPdf } from '@kongila/database';

/**
 * A party's own contract, as a PDF they can keep.
 *
 * Until now a contract existed only as text in a scrolling div: a candidate
 * could sign it and had no copy afterwards. The service decides which
 * document this caller is entitled to; they cannot ask for the other side's.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const actor = await getRequestUser(req);
  if (!actor) return res.status(401).json({ error: 'Not authenticated' });

  const result = await getContractDocumentPdf(actor, {
    contractId: String(req.query.contractId || '')
  });

  if (!result.ok) return res.status(result.status).json({ error: result.error });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${result.data!.filename}"`);
  return res.status(200).send(result.data!.pdf);
}
