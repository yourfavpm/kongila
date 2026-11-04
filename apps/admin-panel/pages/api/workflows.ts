import type { NextApiRequest, NextApiResponse } from 'next';
import { readDbAsync, writeDbAsync, getRequestUser } from '@kongila/database';
import crypto from 'crypto';
import { WorkflowInstance, WorkflowState, WorkflowType } from '@kongila/shared-types';

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

  if (req.method === 'POST') {
    const action = req.body.action || 'trigger';

    try {
      const db = await readDbAsync();
      const workflows: WorkflowInstance[] = db.workflows || [];
      const now = new Date().toISOString();

      if (action === 'trigger') {
        const { workflow_type, trigger_event, trigger_entity_id } = req.body;

        if (!workflow_type || !trigger_event || !trigger_entity_id) {
          return res.status(400).json({ error: 'Missing required fields for trigger.' });
        }

        // Idempotency check: don't create if one already exists for this entity that isn't completed/cancelled
        const existing = workflows.find(w => 
          w.workflow_type === workflow_type && 
          w.trigger_entity_id === trigger_entity_id &&
          w.state !== 'completed' && w.state !== 'cancelled'
        );

        if (existing) {
          return res.status(200).json({ success: true, workflow: existing, message: 'Workflow already active.' });
        }

        const newWorkflow: WorkflowInstance = {
          workflow_instance_id: crypto.randomUUID(),
          workflow_type: workflow_type as WorkflowType,
          state: 'in_progress',
          trigger_event,
          trigger_entity_id,
          last_step_completed: 0,
          created_at: now,
          updated_at: now
        };

        workflows.push(newWorkflow);

        // --- Mock State Machine Execution Side Effects ---
        // In a real production environment with Supabase, this would dispatch to a background worker
        // (like Inngest or a cron job) to execute the workflow steps safely.
        // For local simulation, we'll execute the side effects immediately on db.json.
        
        if (workflow_type === 'talent_onboarding') {
          // Mock the onboarding logic. Assume it fails at Step 3 to demonstrate the Failed Queue.
          // Wait, if it fails, we set state to 'failed'.
          
          // Step 1: Provision Workspace (mocked)
          newWorkflow.last_step_completed = 1;
          
          // Step 2: Add talent to workspace (mocked)
          newWorkflow.last_step_completed = 2;

          // Step 3: Send welcome message (Simulate a failure here initially to show off the Failed Queue)
          // We will fail it if this is the first time.
          newWorkflow.state = 'failed';
          newWorkflow.failed_at_step = 3;
          newWorkflow.failure_reason = 'Network timeout contacting WhatsApp API to send welcome message. Retries exhausted.';
          newWorkflow.updated_at = now;
        }

        db.workflows = workflows;
        await writeDbAsync(db);

        return res.status(200).json({ success: true, workflow: newWorkflow });
      }

      if (action === 'retry') {
        const { workflow_instance_id } = req.body;
        const index = workflows.findIndex(w => w.workflow_instance_id === workflow_instance_id);

        if (index === -1) {
          return res.status(404).json({ error: 'Workflow not found.' });
        }

        const wf = workflows[index];
        if (wf.state !== 'failed') {
          return res.status(400).json({ error: 'Only failed workflows can be retried.' });
        }

        // Retry logic
        wf.state = 'in_progress';
        wf.failure_reason = undefined;
        wf.failed_at_step = undefined;
        wf.updated_at = now;

        // Simulate successful completion of remaining steps
        if (wf.workflow_type === 'talent_onboarding') {
          wf.last_step_completed = 6; // Max steps
          wf.state = 'completed';
          wf.updated_at = new Date().toISOString();
        }

        db.workflows = workflows;
        await writeDbAsync(db);

        return res.status(200).json({ success: true, workflow: wf });
      }

      return res.status(400).json({ error: 'Invalid action' });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
