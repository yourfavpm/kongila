import type { NextApiRequest, NextApiResponse } from 'next';
import { getRequestUser, getSupabaseClient } from '@kongila/database';
import { WorkflowInstance, WorkflowState, WorkflowType } from '@kongila/shared-types';

/**
 * Workflow instances.
 *
 * What was here, and why none of it worked:
 *
 *   - It read the whole database with `readDbAsync`, mutated `db.workflows`
 *     in memory, and wrote it all back with `writeDbAsync`. `writeDbAsync`
 *     has a branch for twenty-one tables and none for `workflows`, so every
 *     trigger and every retry was dropped on the floor while the route
 *     answered `{ success: true }`. The same class of bug the contract
 *     templates migration was written to fix.
 *   - The `talent_onboarding` branch was a "Mock State Machine" that set the
 *     instance to failed at step 3 with the invented reason "Network timeout
 *     contacting WhatsApp API to send welcome message. Retries exhausted."
 *     An operator saw a failure in the queue for something that had never
 *     run.
 *   - Retry claimed the opposite: it set `last_step_completed` to 6 and the
 *     state to completed, again without running anything.
 *
 * `workflow_instances` has existed in the database the whole time, with
 * exactly these columns. This route now reads and writes that table and
 * nothing else. It records state; it does not pretend to execute steps.
 *
 * Executing them needs a worker, which this is not: a Next.js API route does
 * not stay running. Until that exists a triggered workflow sits at
 * `in_progress` with `last_step_completed` 0, which is true, and the
 * operations queue shows exactly what has been triggered and what a worker
 * has since reported.
 *
 * GET                                     the instances, newest first
 * POST { action: 'trigger', workflow_type, trigger_event, trigger_entity_id }
 * POST { action: 'retry',   workflow_instance_id }
 * POST { action: 'cancel',  workflow_instance_id }
 */

/** Matches the workflow_state enum. */
const OPEN_STATES: WorkflowState[] = ['pending', 'in_progress', 'failed'];

const WORKFLOW_TYPES: WorkflowType[] = [
  'talent_onboarding',
  'performance_review_cycle',
  'contract_renewal_alert',
  'invoice_generation',
  'talent_replacement',
  'workspace_offboarding',
  'trial_expiry',
  'payroll_generation'
] as WorkflowType[];

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Admin portal route. A talent or client session is a valid session and
  // still has no business here, so check the kind, not just that someone is
  // signed in. This runs before any database read.
  const actor = await getRequestUser(req);
  if (!actor) return res.status(401).json({ error: 'Not authenticated' });
  if (actor.kind !== 'admin') {
    console.warn('[api/workflows] refused ' + actor.kind + ' ' + actor.userId);
    return res.status(403).json({ error: 'Not authorised' });
  }

  const supabase = getSupabaseClient();

  if (req.method === 'GET') {
    const limit = Math.min(Number(req.query.limit) || 100, 500);
    const { data, error } = await supabase
      .from('workflow_instances')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('[api/workflows] list failed:', error.message);
      return res.status(500).json({ error: `Workflows could not be loaded: ${error.message}` });
    }
    return res.status(200).json({ workflows: data || [] });
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const action = String(req.body?.action || 'trigger');

  // ── Trigger ───────────────────────────────────────────────────────────────
  if (action === 'trigger') {
    const workflowType = String(req.body?.workflow_type || '') as WorkflowType;
    const triggerEvent = String(req.body?.trigger_event || '').trim();
    const triggerEntityId = String(req.body?.trigger_entity_id || '').trim();

    if (!workflowType || !triggerEvent || !triggerEntityId) {
      return res.status(400).json({
        error: 'workflow_type, trigger_event and trigger_entity_id are all required.'
      });
    }
    // The column is an enum. An unknown value is a 500 from Postgres and a
    // confusing one, so it is named here instead.
    if (!WORKFLOW_TYPES.includes(workflowType)) {
      return res.status(400).json({ error: `"${workflowType}" is not a workflow type.` });
    }

    // Idempotent on an open instance for the same entity, as it was before.
    const { data: existing, error: lookupError } = await supabase
      .from('workflow_instances')
      .select('*')
      .eq('workflow_type', workflowType)
      .eq('trigger_entity_id', triggerEntityId)
      .in('state', OPEN_STATES)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (lookupError) {
      console.error('[api/workflows] lookup failed:', lookupError.message);
      return res.status(500).json({ error: `Could not check for an existing workflow: ${lookupError.message}` });
    }
    if (existing) {
      return res.status(200).json({
        success: true,
        workflow: existing as WorkflowInstance,
        message: 'A workflow is already open for this record.'
      });
    }

    const { data: created, error: insertError } = await supabase
      .from('workflow_instances')
      .insert({
        workflow_type: workflowType,
        state: 'in_progress',
        trigger_event: triggerEvent,
        trigger_entity_id: triggerEntityId,
        last_step_completed: 0
      })
      .select()
      .maybeSingle();

    if (insertError) {
      console.error('[api/workflows] insert failed:', insertError.message);
      return res.status(500).json({ error: `The workflow was not created: ${insertError.message}` });
    }

    return res.status(201).json({ success: true, workflow: created as WorkflowInstance });
  }

  // ── Retry ─────────────────────────────────────────────────────────────────
  //
  // Reopens a failed instance. It does not complete it: there is nothing here
  // that could run the remaining steps, and saying otherwise is what the old
  // handler did.
  if (action === 'retry') {
    const id = String(req.body?.workflow_instance_id || '').trim();
    if (!id) return res.status(400).json({ error: 'Which workflow?' });

    const { data: current, error: readError } = await supabase
      .from('workflow_instances').select('*').eq('workflow_instance_id', id).maybeSingle();

    if (readError) {
      console.error('[api/workflows] read failed:', readError.message);
      return res.status(500).json({ error: `That workflow could not be read: ${readError.message}` });
    }
    if (!current) return res.status(404).json({ error: 'That workflow does not exist.' });
    if (current.state !== 'failed') {
      return res.status(409).json({ error: `Only a failed workflow can be retried; this one is ${current.state}.` });
    }

    const { data: updated, error: updateError } = await supabase
      .from('workflow_instances')
      .update({
        state: 'in_progress',
        failed_at_step: null,
        failure_reason: null,
        updated_at: new Date().toISOString()
      })
      .eq('workflow_instance_id', id)
      .select()
      .maybeSingle();

    if (updateError) {
      console.error('[api/workflows] retry failed:', updateError.message);
      return res.status(500).json({ error: `The retry was not saved: ${updateError.message}` });
    }

    return res.status(200).json({
      success: true,
      workflow: updated as WorkflowInstance,
      message: 'Reopened. It resumes from step '
        + String((current.last_step_completed ?? 0) + 1)
        + ' when a worker next picks it up.'
    });
  }

  // ── Cancel ────────────────────────────────────────────────────────────────
  if (action === 'cancel') {
    const id = String(req.body?.workflow_instance_id || '').trim();
    if (!id) return res.status(400).json({ error: 'Which workflow?' });

    const { data: updated, error } = await supabase
      .from('workflow_instances')
      .update({ state: 'cancelled', updated_at: new Date().toISOString() })
      .eq('workflow_instance_id', id)
      .in('state', OPEN_STATES)
      .select()
      .maybeSingle();

    if (error) {
      console.error('[api/workflows] cancel failed:', error.message);
      return res.status(500).json({ error: `The workflow was not cancelled: ${error.message}` });
    }
    if (!updated) {
      return res.status(409).json({ error: 'That workflow is not open, so there is nothing to cancel.' });
    }

    return res.status(200).json({ success: true, workflow: updated as WorkflowInstance });
  }

  return res.status(400).json({ error: `"${action}" is not an action.` });
}
