import type { NextApiRequest, NextApiResponse } from 'next';
import {
  getRequestUser,
  listContractDocuments,
  sendContractDocument,
  voidContractDocument,
  getContractDocumentPdf
} from '@kongila/database';

/**
 * The two documents on a contract, and sending them out.
 *
 * GET  ?contractId=…                              both documents and who is outstanding
 * GET  ?contractId=…&view=pdf&audience=…          that document as a PDF
 * POST { action: 'send', contractId, audience }    sends one party's document, or chases it
 * POST { action: 'void', contractId, audience, reason }  withdraws an unsigned one
 *
 * Each party is sent their own document separately, because they are
 * different texts and are often ready at different moments. Permissions are
 * checked in the service, against the contract itself.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const actor = await getRequestUser(req);
  if (!actor) return res.status(401).json({ error: 'Not authenticated' });

  if (req.method === 'GET') {
    if (String(req.query.view || '') === 'pdf') {
      const pdf = await getContractDocumentPdf(actor, {
        contractId: String(req.query.contractId || ''),
        audience: req.query.audience === 'talent' ? 'talent' : 'client'
      });
      if (!pdf.ok) return res.status(pdf.status).json({ error: pdf.error });
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${pdf.data!.filename}"`);
      return res.status(200).send(pdf.data!.pdf);
    }

    const result = await listContractDocuments(actor, String(req.query.contractId || ''));
    if (!result.ok) return res.status(result.status).json({ error: result.error });
    res.setHeader('Cache-Control', 'private, no-store');
    return res.status(200).json({ ...result.data, warnings: result.warnings || [] });
  }

  if (req.method === 'POST') {
    const body = (req.body || {}) as Record<string, any>;
    const audience = body.audience === 'talent' ? 'talent' : 'client';

    const result = body.action === 'void'
      ? await voidContractDocument(actor, {
        contractId: String(body.contractId || ''),
        audience,
        reason: String(body.reason || '')
      })
      : await sendContractDocument(actor, {
        contractId: String(body.contractId || ''),
        audience
      });

    if (!result.ok) return res.status(result.status).json({ error: result.error });
    return res.status(200).json({ ...result.data, warnings: result.warnings || [] });
  }

  res.setHeader('Allow', 'GET, POST');
  return res.status(405).json({ error: 'Method not allowed' });
}
