import type { NextApiRequest, NextApiResponse } from 'next';
import {
  getRequestUser,
  signContract,
  signComplianceDocument,
  getSignatures,
  getContractDocument,
  myComplianceStatus,
  clientIpFrom
} from '@kongila/database';

/**
 * Signing.
 *
 * The old flow updated React state and nothing else: the audit trail was a
 * hardcoded '192.168.1.1' and 'sha256-mock-' + Date.now(), saved nowhere, so
 * neither party could see the other's signature and nothing could be
 * verified afterwards.
 *
 * The IP and user agent are taken from the request here. A browser that
 * sends its own is ignored — a signature trail the signer can write is not
 * a trail.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const actor = await getRequestUser(req);
  if (!actor) return res.status(401).json({ error: 'Not authenticated' });

  if (req.method === 'GET') {
    // The candidate's own compliance position, decided server-side. The
    // dashboard used to work it out in the browser by matching file names.
    if (req.query.view === 'compliance') {
      const status = await myComplianceStatus(actor);
      if (!status.ok) return res.status(status.status).json({ error: status.error });
      return res.status(200).json(status.data);
    }

    const contractId = String(req.query.contractId || '');
    if (!contractId) return res.status(400).json({ error: 'contractId is required' });

    // ?view=document returns the text to be signed, built server-side. The
    // browser used to compose the agreement itself, so the words on screen
    // and the words that got hashed were whatever the page felt like.
    const result = req.query.view === 'document'
      ? await getContractDocument(actor, contractId)
      : await getSignatures(actor, contractId);

    if (!result.ok) return res.status(result.status).json({ error: result.error });
    return res.status(200).json(result.data);
  }

  if (req.method === 'POST') {
    const ipAddress = clientIpFrom(req);
    const userAgent = String(req.headers['user-agent'] || '') || null;
    const { action } = req.body || {};

    const result = action === 'compliance'
      ? await signComplianceDocument(actor, { ...(req.body || {}), ipAddress, userAgent })
      : await signContract(actor, { ...(req.body || {}), ipAddress, userAgent });

    if (!result.ok) return res.status(result.status).json({ error: result.error });
    return res.status(result.status).json({ signature: result.data, warnings: result.warnings });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
