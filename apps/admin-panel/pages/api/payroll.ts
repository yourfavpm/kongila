import type { NextApiRequest, NextApiResponse } from 'next';
import {
  getRequestUser,
  previewPayroll,
  generatePayroll,
  getPayrollRun,
  listPayrollRuns,
  approvePayroll,
  markPayrollPaid,
  exportPayroll,
  previousPeriod
} from '@kongila/database';

/**
 * The payroll run.
 *
 * GET  ?view=runs               the last two years of runs
 * GET  ?period=YYYY-MM          one run with its entries
 * GET  ?period=...&view=preview what a run would pay, writing nothing
 * GET  ?period=...&view=export  the CSV for the bank
 * POST action=generate          write or rewrite the draft schedule
 * POST action=approve           sign it off
 * POST action=mark_paid         record what the bank did, failures included
 *
 * Period defaults to the month that has just finished, which is the one an
 * operator almost always wants.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const actor = await getRequestUser(req);
  if (!actor) return res.status(401).json({ error: 'Not authenticated' });
  if (actor.kind !== 'admin') {
    console.warn(`[api/payroll] refused ${actor.kind} ${actor.userId}`);
    return res.status(403).json({ error: 'Not authorised' });
  }

  const period = String(req.query.period || req.body?.period || previousPeriod());

  if (req.method === 'GET') {
    const view = String(req.query.view || 'run');

    if (view === 'runs') {
      const result = await listPayrollRuns(actor);
      if (!result.ok) return res.status(result.status).json({ error: result.error });
      return res.status(200).json({ runs: result.data });
    }

    if (view === 'export') {
      const result = await exportPayroll(actor, period);
      if (!result.ok) return res.status(result.status).json({ error: result.error });

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${result.data!.filename}"`);
      return res.status(200).send(result.data!.csv);
    }

    const result = view === 'preview'
      ? await previewPayroll(actor, period)
      : await getPayrollRun(actor, period);

    if (!result.ok) return res.status(result.status).json({ error: result.error });
    return res.status(200).json(result.data);
  }

  if (req.method === 'POST') {
    const { action } = req.body || {};

    const result = action === 'generate' ? await generatePayroll(actor, period)
      : action === 'approve' ? await approvePayroll(actor, period)
      : action === 'mark_paid' ? await markPayrollPaid(actor, { period, failures: req.body?.failures })
      : null;

    if (!result) return res.status(400).json({ error: `"${action}" is not a payroll action.` });
    if (!result.ok) return res.status(result.status).json({ error: result.error });
    return res.status(result.status).json({ ...result.data, warnings: result.warnings });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
