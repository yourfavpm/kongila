import type { NextApiRequest, NextApiResponse } from 'next';
import {
  ageInvoices,
  checkDocumentExpiry,
  activateDueContracts,
  alertUpcomingInvoices
} from '@kongila/database';

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

  // Contracts both sides signed ahead of time, whose start date has now
  // arrived. Without this they waited at 'fully_signed' for ever and every
  // count of active placements was short.
  let contracts: any = null;
  try {
    const result = await activateDueContracts();
    contracts = { activated: result.activated };
    warnings.push(...(result.warnings || []));
  } catch (error: any) {
    contracts = { error: error?.message || 'The contract activation pass threw.' };
  }

  // What is about to fall due, so somebody raises it. A recurring
  // engagement quietly stops being invoiced the moment nobody remembers to
  // run the month, and the first sign is a revenue figure that looks low.
  let upcoming: any = null;
  try {
    const result = await alertUpcomingInvoices(now);
    upcoming = { upcoming: result.upcoming };
    warnings.push(...(result.warnings || []));
  } catch (error: any) {
    upcoming = { error: error?.message || 'The upcoming invoice pass threw.' };
  }

  return res.status(200).json({
    ranAt: now.toISOString(), invoices, documents, contracts, upcoming, warnings
  });
}
