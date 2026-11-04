import type { NextApiRequest, NextApiResponse } from 'next';
import { ageInvoices, checkDocumentExpiry } from '@kongila/database';

/**
 * The nightly pass.
 *
 * Two jobs that had no home:
 *
 *   - Moving invoices past their due date to overdue. Nothing did this, so
 *     the overdue filter in the admin panel and the overdue banner in the
 *     client portal both had nothing to show whatever the due date said.
 *   - Flagging certifications that have lapsed or are about to. Expiry was
 *     a coloured badge computed in the talent dashboard and nothing else.
 *
 * Set it up as either:
 *
 *   a Supabase scheduled function (Database, Cron):
 *     select cron.schedule('kongila-nightly', '15 2 * * *',
 *       $$ select net.http_post(
 *            url := 'https://<admin-host>/api/cron/nightly',
 *            headers := '{"x-cron-secret":"<CRON_SECRET>"}'::jsonb
 *          ) $$);
 *
 *   or a crontab line on the VPS:
 *     15 2 * * * curl -s -H "x-cron-secret: $CRON_SECRET" https://<admin-host>/api/cron/nightly
 *
 * Both jobs are safe to run twice. Ageing only touches invoices still at
 * 'sent', and expiry only notifies on a state change.
 *
 * Without CRON_SECRET the route refuses every request, rather than leaving
 * an endpoint anyone can use to send mail from your domain.
 */

function authorised(req: NextApiRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const provided = req.headers['x-cron-secret']
    || (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  return provided === secret;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!process.env.CRON_SECRET) {
    console.error('[cron/nightly] CRON_SECRET is not set, refusing');
    return res.status(503).json({ error: 'This job is not configured.' });
  }
  if (!authorised(req)) {
    return res.status(401).json({ error: 'Not authorised' });
  }

  const now = new Date();
  const warnings: string[] = [];

  // Run both even if the first one fails. One job falling over should not
  // silently stop the other for the night.
  let invoices: any = null;
  try {
    const result = await ageInvoices(now);
    invoices = result.ok ? result.data : { error: result.error };
    warnings.push(...(result.warnings || []));
  } catch (error: any) {
    invoices = { error: error?.message || 'The invoice pass threw.' };
  }

  let documents: any = null;
  try {
    const result = await checkDocumentExpiry(now);
    documents = result.ok ? result.data : { error: result.error };
    warnings.push(...(result.warnings || []));
  } catch (error: any) {
    documents = { error: error?.message || 'The expiry pass threw.' };
  }

  return res.status(200).json({ ranAt: now.toISOString(), invoices, documents, warnings });
}
