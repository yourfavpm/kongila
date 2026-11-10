/**
 * Work simulation tasks, server side.
 *
 * Stage 6 of 7, and 20% of the composite grade, with nothing behind it. There
 * was no table, no service and no route. The admin portal built the task
 * object in the browser, put it into React state and attached it to a
 * `payload` object that is never sent — the request it rode on carries the
 * vetting pipeline and nothing else. So assigning a work simulation appeared
 * to work, the stage recorded a taskId pointing at nothing, the candidate was
 * never shown a task, and it was gone on the next reload.
 *
 * The table arrives with 2026-11-10b_work_simulation_tasks.sql.
 *
 * The shape mirrors the skill assessment flow deliberately: operations
 * assigns with a deadline, the candidate submits before it, operations marks
 * it with a score and notes, and the score feeds the vetting stage. A
 * candidate never sets their own score and never sees a mark that nobody
 * awarded.
 */

import { getSupabaseClient } from './index';
import type { RequestActor as Actor } from './scope';
import { recordAudit } from './audit';
import { notifyUsers, talentPortalUrl, adminPortalUrl } from './notify';
import { mapWorkSimulationTask } from './workSimulationRow';

export interface WorkSimulationResult<T = any> {
  ok: boolean;
  status: number;
  error?: string;
  data?: T;
}

function fail(status: number, error: string): WorkSimulationResult {
  return { ok: false, status, error };
}

const SUBMISSION_TYPES = new Set(['file', 'link', 'text']);

/**
 * Has a deadline passed?
 *
 * End of the day it names, not the midnight that starts it, so "due the 14th"
 * leaves the 14th as a day the candidate can still work. The same rule runs
 * in the assessment flow and in the candidate's portal, so the button and the
 * route agree.
 */
function deadlinePassed(deadline: string | null | undefined): boolean {
  if (!deadline) return false;
  const due = new Date(deadline);
  if (Number.isNaN(due.getTime())) return false;
  const end = new Date(due);
  if (due.getUTCHours() === 0 && due.getUTCMinutes() === 0) end.setUTCHours(23, 59, 59, 999);
  return Date.now() > end.getTime();
}

const toTask = mapWorkSimulationTask;

/** Every task for one candidate, newest first. */
export async function listWorkSimulationTasks(
  actor: Actor,
  talentId?: string
): Promise<WorkSimulationResult> {
  if (!actor) return fail(401, 'Not authenticated.');

  // A candidate sees their own and nobody else's, whatever they ask for.
  const target = actor.kind === 'admin'
    ? String(talentId || '').trim()
    : String(actor.talentProfileId || actor.userId);

  if (!target) return fail(400, 'Which candidate?');

  const { data, error } = await getSupabaseClient()
    .from('work_simulation_tasks')
    .select('*')
    .eq('talent_id', target)
    .order('assigned_at', { ascending: false });

  if (error) return fail(500, `Those tasks could not be loaded: ${error.message}`);
  return { ok: true, status: 200, data: { tasks: (data || []).map(toTask) } };
}

/** Operations assigns a work simulation to a candidate. */
export async function assignWorkSimulationTask(
  actor: Actor,
  input: {
    talentId: string;
    title: string;
    description?: string | null;
    submissionType?: string | null;
    deadline?: string | null;
    maxScore?: number | null;
  }
): Promise<WorkSimulationResult> {
  if (!actor) return fail(401, 'Not authenticated.');
  if (actor.kind !== 'admin') return fail(403, 'Only operations assigns a work simulation.');

  const talentId = String(input.talentId || '').trim();
  const title = String(input.title || '').trim();
  if (!talentId) return fail(400, 'Which candidate?');
  if (!title) return fail(422, 'A work simulation needs a title — what is the candidate being asked to do?');

  const submissionType = String(input.submissionType || 'file');
  if (!SUBMISSION_TYPES.has(submissionType)) {
    return fail(422, `"${submissionType}" is not a submission type. Use file, link or text.`);
  }

  let deadline: string | null = null;
  if (input.deadline) {
    const parsed = new Date(input.deadline);
    if (Number.isNaN(parsed.getTime())) return fail(422, 'That deadline is not a date.');
    deadline = parsed.toISOString();
  }

  const maxScore = Number(input.maxScore);
  const supabase = getSupabaseClient();

  const { data: talent } = await supabase
    .from('talent_profiles').select('id, user_id, full_name').eq('id', talentId).maybeSingle();
  if (!talent) return fail(404, 'That candidate does not exist.');

  const id = `wst_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const { data, error } = await supabase
    .from('work_simulation_tasks')
    .insert({
      id,
      talent_id: talentId,
      title,
      description: input.description || null,
      submission_type: submissionType,
      assigned_by: actor.userId,
      assigned_at: new Date().toISOString(),
      deadline,
      max_score: Number.isFinite(maxScore) && maxScore > 0 ? Math.round(maxScore) : 100,
      status: 'assigned'
    })
    .select()
    .maybeSingle();

  if (error) return fail(500, `That task was not assigned: ${error.message}`);

  await recordAudit(actor, {
    action: 'Assign Work Simulation',
    details: `${talent.full_name || talentId}: ${title}`
      + (deadline ? `, due ${deadline.slice(0, 10)}` : ', no deadline') + '.',
    entityType: 'work_simulation_task',
    entityId: id
  });

  const warnings: string[] = [];
  if (talent.user_id) {
    const notified = await notifyUsers(String(talent.user_id), 'work_simulation_assigned', {
      stageName: title,
      deadline: deadline ? deadline.slice(0, 10) : undefined,
      actionUrl: talentPortalUrl('/?section=vetting')
    });
    warnings.push(...notified.warnings);
  }

  return { ok: true, status: 201, data: { ...toTask(data || {}), id, warnings } };
}

/** The candidate hands it in. */
export async function submitWorkSimulationTask(
  actor: Actor,
  input: { taskId: string; submissionUrl?: string | null; submissionText?: string | null; submissionName?: string | null }
): Promise<WorkSimulationResult> {
  if (!actor) return fail(401, 'Not authenticated.');
  if (actor.kind !== 'talent') return fail(403, 'Only a candidate submits a work simulation.');

  const talentId = String(actor.talentProfileId || actor.userId);
  const taskId = String(input.taskId || '').trim();
  if (!taskId) return fail(400, 'Which task?');

  const supabase = getSupabaseClient();
  const { data: task } = await supabase
    .from('work_simulation_tasks').select('*').eq('id', taskId).maybeSingle();

  if (!task) return fail(404, 'That task was not assigned to you.');
  if (String(task.talent_id) !== talentId) return fail(403, 'That task was not assigned to you.');
  if (['submitted', 'marked'].includes(String(task.status))) {
    return fail(409, 'You have already submitted this task.');
  }

  if (deadlinePassed(task.deadline)) {
    await supabase.from('work_simulation_tasks').update({ status: 'expired' }).eq('id', taskId);
    return fail(
      410,
      `The deadline for this task was ${String(task.deadline).slice(0, 10)}. `
      + 'Ask your Kongila contact to reopen it if you still need to submit.'
    );
  }

  const url = String(input.submissionUrl || '').trim();
  const text = String(input.submissionText || '').trim();
  if (!url && !text) {
    return fail(422, 'Add a file, a link or your written answer before submitting.');
  }

  const submittedAt = new Date().toISOString();
  const { data, error } = await supabase
    .from('work_simulation_tasks')
    .update({
      status: 'submitted',
      submitted_at: submittedAt,
      submission_url: url || null,
      submission_text: text || null,
      submission_name: input.submissionName || null
    })
    .eq('id', taskId)
    .select()
    .maybeSingle();

  if (error) return fail(500, `Your submission was not saved: ${error.message}`);

  // Operations has to know there is something to mark.
  const { data: reviewers } = await supabase
    .from('users').select('id').in('role', ['super_admin', 'talent_manager', 'ops_manager']);
  const ids = (reviewers || []).map((u: any) => String(u.id)).filter(Boolean);
  if (ids.length > 0) {
    await notifyUsers(ids, 'stage_advanced', {
      stageName: 'Work Simulation',
      reason: `A candidate submitted "${task.title}" and it is waiting to be marked.`,
      actionUrl: adminPortalUrl('/?tab=talent')
    }).catch(() => {});
  }

  return { ok: true, status: 200, data: toTask(data) };
}

/** Operations marks it. */
export async function markWorkSimulationTask(
  actor: Actor,
  input: { taskId: string; score: number; reviewerNotes?: string | null }
): Promise<WorkSimulationResult> {
  if (!actor) return fail(401, 'Not authenticated.');
  if (actor.kind !== 'admin') return fail(403, 'Only operations marks a work simulation.');

  const taskId = String(input.taskId || '').trim();
  if (!taskId) return fail(400, 'Which task?');

  const supabase = getSupabaseClient();
  const { data: task } = await supabase
    .from('work_simulation_tasks').select('*').eq('id', taskId).maybeSingle();
  if (!task) return fail(404, 'That task does not exist.');

  if (String(task.status) === 'assigned') {
    return fail(409, 'That task has not been submitted yet, so there is nothing to mark.');
  }

  const max = Number(task.max_score) > 0 ? Number(task.max_score) : 100;
  const score = Number(input.score);
  if (!Number.isFinite(score)) return fail(422, 'A score is required.');
  if (score < 0 || score > max) return fail(422, `The score must be between 0 and ${max}.`);

  const reviewedAt = new Date().toISOString();
  const { data, error } = await supabase
    .from('work_simulation_tasks')
    .update({
      score: Math.round(score),
      reviewer_notes: input.reviewerNotes || null,
      reviewed_by: actor.userId,
      reviewed_at: reviewedAt,
      status: 'marked'
    })
    .eq('id', taskId)
    .select()
    .maybeSingle();

  if (error) return fail(500, `That mark was not saved: ${error.message}`);

  await recordAudit(actor, {
    action: 'Mark Work Simulation',
    details: `${task.title}: ${Math.round(score)} of ${max}.`,
    entityType: 'work_simulation_task',
    entityId: taskId
  });

  const warnings: string[] = [];
  const { data: talent } = await supabase
    .from('talent_profiles').select('user_id').eq('id', task.talent_id).maybeSingle();
  if (talent?.user_id) {
    const notified = await notifyUsers(String(talent.user_id), 'work_simulation_marked', {
      stageName: task.title,
      score: `${Math.round(score)} of ${max}`,
      feedback: input.reviewerNotes || undefined,
      actionUrl: talentPortalUrl('/?section=scores_grades')
    });
    warnings.push(...notified.warnings);
  }

  return {
    ok: true,
    status: 200,
    // As a percentage too, because that is what the vetting stage stores.
    data: { ...toTask(data), percentage: Math.round((score / max) * 100), warnings }
  };
}
