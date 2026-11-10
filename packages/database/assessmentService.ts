/**
 * Skill assessments, server side.
 *
 * The portal marked its own paper. `TalentAssessmentRunner` computed a
 * score in the browser and `apps/kongila-web/pages/index.tsx` upserted it
 * into `talent_skill_assessments`, which has RLS off in the live database.
 * Nothing stopped a candidate posting a 100, and nothing stopped them
 * retaking an assessment they had already failed.
 *
 * Now the browser sends answers. The score is computed here from the
 * answer key, which never goes to the browser in the first place, and a
 * submitted assessment cannot be submitted again.
 */

import { getSupabaseClient, isUndefinedColumn } from './index';
import type { RequestActor as Actor } from './scope';
import { scoreAssessment, finalAssessmentScore, type SubjectiveMark } from '@kongila/workflows';
import { recordAudit } from './audit';
import { notifyUsers, talentPortalUrl, adminPortalUrl } from './notify';

export interface AssessmentResult<T = any> {
  ok: boolean;
  status: number;
  error?: string;
  data?: T;
}

function fail(status: number, error: string): AssessmentResult {
  return { ok: false, status, error };
}

/**
 * The questions for an assessment, with the answer key.
 *
 * Only ever called from here. `getAssessmentForTalent` is the one that
 * sends questions to a candidate, and it strips the key.
 */
async function loadQuestions(categories: unknown[]): Promise<{ questions: any[]; error?: string }> {
  const supabase = getSupabaseClient();
  const ids = (categories || []).map(c => String(c)).filter(Boolean);
  if (ids.length === 0) return { questions: [] };
  const { data, error } = await supabase
    .from('assessment_questions')
    // max_score was missing, so the combined score had nothing to tell it what
    // a written answer was worth and fell back to ten for all of them.
    .select('id, type, category_id, correct_answer, scoring_weight, max_score')
    .in('category_id', ids);
  return error ? { questions: [], error: error.message } : { questions: data || [] };
}

/**
 * Assigning an assessment to a candidate.
 *
 * This did not exist, and the assignment was not being stored. The admin
 * portal built the row in the browser, put it into local React state and
 * attached it to a `payload` object that was never sent: the request it went
 * on carries the pipeline only. So the stage recorded an assessmentId
 * pointing at a `talent_skill_assessments` row that was never written, the
 * candidate's portal found nothing assigned to them, and the assignment
 * disappeared from the operator's own screen on the next reload.
 *
 * The deadline belongs here too. It was set on the vetting stage record,
 * where the candidate's portal never looks.
 */
export async function assignAssessment(
  actor: Actor,
  input: { talentId: string; assessmentId: string; deadline?: string | null }
): Promise<AssessmentResult> {
  if (!actor) return fail(401, 'Not authenticated.');
  if (actor.kind !== 'admin') return fail(403, 'Only operations assigns an assessment.');

  const talentId = String(input.talentId || '').trim();
  const assessmentId = String(input.assessmentId || '').trim();
  if (!talentId) return fail(400, 'Which candidate?');
  if (!assessmentId) return fail(400, 'Which assessment?');

  const supabase = getSupabaseClient();

  const [{ data: talent }, { data: assessment }] = await Promise.all([
    supabase.from('talent_profiles').select('id, user_id, full_name').eq('id', talentId).maybeSingle(),
    supabase.from('assessments').select('id, title, status').eq('id', assessmentId).maybeSingle()
  ]);

  if (!talent) return fail(404, 'That candidate does not exist.');
  if (!assessment) return fail(404, 'That assessment does not exist.');
  if (String(assessment.status) === 'draft') {
    return fail(422, `"${assessment.title}" is still a draft. Publish it before assigning it.`);
  }

  let deadline: string | null = null;
  if (input.deadline) {
    const parsed = new Date(input.deadline);
    if (Number.isNaN(parsed.getTime())) return fail(422, 'That deadline is not a date.');
    deadline = parsed.toISOString();
  }

  // An assessment already assigned and not yet submitted is reused rather
  // than duplicated, so an operator who clicks twice does not leave the
  // candidate with two of the same paper and the stage pointing at one.
  const { data: open } = await supabase
    .from('talent_skill_assessments')
    .select('id, status')
    .eq('talentId', talentId)
    .eq('assessmentId', assessmentId)
    .in('status', ['assigned', 'in_progress', 'expired'])
    .maybeSingle();

  const assignedAt = new Date().toISOString();

  // `deadline` arrives with the 2026-11-10 migration. Until it runs the
  // column does not exist and naming it fails the whole statement, so
  // assigning an assessment was impossible rather than merely deadline-less.
  // A candidate who cannot be assigned an assessment cannot sit one, which
  // is where this whole flow stalls.
  //
  // The assignment matters more than the deadline, so the deadline is
  // dropped and the caller is told.
  const warnings: string[] = [];
  const noDeadlineColumn = () => {
    warnings.push(
      'This assessment was assigned, but the deadline was not saved: talent_skill_assessments '
      + 'has no "deadline" column yet. Run packages/database/migrations/2026-11-10_assessment_columns.sql.'
    );
  };

  if (open) {
    let { error } = await supabase
      .from('talent_skill_assessments')
      .update({ deadline, status: 'assigned', assignedAt })
      .eq('id', open.id);

    if (error && isUndefinedColumn(error)) {
      noDeadlineColumn();
      ({ error } = await supabase
        .from('talent_skill_assessments')
        .update({ status: 'assigned', assignedAt })
        .eq('id', open.id));
    }

    if (error) return fail(500, `That assessment was not assigned: ${error.message}`);
    const told = await announceAssignment(talent, assessment, deadline);
    return {
      ok: true,
      status: 200,
      data: { id: open.id, talentId, assessmentId, deadline, reused: true, warnings: [...warnings, ...told] }
    };
  }

  const id = `tsa_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const row: Record<string, unknown> = {
    id,
    talentId,
    assessmentId,
    status: 'assigned',
    assignedAt,
    deadline
  };

  let { error } = await supabase.from('talent_skill_assessments').insert(row);

  if (error && isUndefinedColumn(error)) {
    noDeadlineColumn();
    delete row.deadline;
    ({ error } = await supabase.from('talent_skill_assessments').insert(row));
  }

  if (error) return fail(500, `That assessment was not assigned: ${error.message}`);

  await recordAudit(actor, {
    action: 'Assign Skill Assessment',
    details: `${talent.full_name || talentId}: ${assessment.title || assessmentId}`
      + (deadline ? `, due ${deadline.slice(0, 10)}` : ', no deadline') + '.',
    entityType: 'talent_skill_assessment',
    entityId: id
  });

  const told = await announceAssignment(talent, assessment, deadline);

  return {
    ok: true,
    status: 200,
    data: { id, talentId, assessmentId, deadline, warnings: [...warnings, ...told] }
  };
}

/** Tells the candidate. Never fails the assignment it describes. */
async function announceAssignment(talent: any, assessment: any, deadline: string | null): Promise<string[]> {
  if (!talent?.user_id) return [];
  try {
    // Its own event, not the generic stage_advanced. That template says
    // "you have moved to the next stage" and nothing about what to do, so a
    // candidate being given an assessment with a deadline read the same as
    // one being given a mark back.
    const notified = await notifyUsers(String(talent.user_id), 'assessment_assigned', {
      stageName: assessment.title || 'A skill assessment',
      deadline: deadline ? deadline.slice(0, 10) : undefined,
      actionUrl: talentPortalUrl('/?section=vetting')
    });
    return notified.warnings;
  } catch (e) {
    return [];
  }
}

/**
 * Records a candidate's submission.
 *
 * `score` in the body is ignored. It is accepted in the type only because
 * the portal still sends it, and refusing the whole request over a field
 * nobody reads would break a submission that is otherwise fine.
 */
export async function submitAssessment(
  actor: Actor,
  input: {
    talentSkillAssessmentId: string;
    assessmentId?: string;
    answers?: Record<string, unknown>;
  }
): Promise<AssessmentResult> {
  if (!actor) return fail(401, 'Not authenticated.');
  if (actor.kind !== 'talent') return fail(403, 'Only a candidate submits an assessment.');

  const talentId = String(actor.talentProfileId || actor.userId);
  const id = String(input.talentSkillAssessmentId || '').trim();
  if (!id) return fail(400, 'Which assessment is this?');

  const supabase = getSupabaseClient();

  const { data: assignment, error: assignmentError } = await supabase
    .from('talent_skill_assessments')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (assignmentError) {
    console.error('[assessments] assignment lookup failed:', assignmentError.message);
    return fail(500, 'Could not verify this assessment assignment. Please try again.');
  }
  if (!assignment) return fail(404, 'That assessment was not assigned to you.');
  if (String(assignment.talentId) !== talentId) {
    return fail(403, 'That assessment was not assigned to you.');
  }
  if (['submitted', 'marked'].includes(String(assignment.status || ''))) {
    // Without this a candidate could sit the same assessment until they
    // passed it, and the pipeline would show the best attempt.
    return fail(409, 'You have already submitted this assessment.');
  }

  // The deadline the operator set when assigning it.
  //
  // It was stored on the vetting stage record, which the candidate's portal
  // never reads, so it was shown to nobody and checked by nothing: an
  // assessment assigned with a Friday deadline could be submitted the
  // following month and the pipeline would accept it.
  //
  // End of day in the server's zone, not the stroke of midnight that starts
  // it, so "due the 14th" means the 14th is a day you can still work.
  if (assignment.deadline) {
    const due = new Date(assignment.deadline);
    if (!Number.isNaN(due.getTime())) {
      const endOfDay = new Date(due);
      if (due.getUTCHours() === 0 && due.getUTCMinutes() === 0) {
        endOfDay.setUTCHours(23, 59, 59, 999);
      }
      if (Date.now() > endOfDay.getTime()) {
        await supabase.from('talent_skill_assessments').update({ status: 'expired' }).eq('id', id);
        return fail(
          410,
          `The deadline for this assessment was ${endOfDay.toISOString().slice(0, 10)}. `
          + 'Ask your Kongila contact to reopen it if you still need to sit it.'
        );
      }
    }
  }

  const assessmentId = String(assignment.assessmentId || input.assessmentId || '');
  const { data: assessment, error: assessmentError } = await supabase
    .from('assessments')
    .select('id, categories, passing_score, status')
    .eq('id', assessmentId)
    .maybeSingle();

  if (assessmentError) {
    console.error('[assessments] assessment lookup failed:', assessmentError.message);
    return fail(500, 'Could not load this assessment. Please try again.');
  }
  if (!assessment) return fail(404, 'That assessment no longer exists.');

  const { questions, error: questionsError } = await loadQuestions(assessment.categories || []);
  if (questionsError) {
    console.error('[assessments] question lookup failed:', questionsError);
    return fail(500, 'Could not load the assessment questions. Please try again.');
  }
  if (questions.length === 0) {
    return fail(409, 'This assessment has no available questions. Please contact support.');
  }
  const marked = scoreAssessment(
    questions as any,
    (input.answers || {}) as Record<string, unknown>,
    (assessment.categories || []) as unknown[],
    assessment.passing_score
  );

  const submittedAt = new Date().toISOString();

  // The score as it stands, over the whole paper. The written answers are
  // unmarked at this point, so they count towards the total and earn nothing,
  // and `isFullyMarked` is false — the figure can only rise from here.
  //
  // marked.autoScore is a percentage of the multiple choice alone, which on a
  // paper that is half written answers is not this candidate's score. It is
  // kept as the auto half rather than used as the result.
  const provisional = finalAssessmentScore(
    questions as any,
    (input.answers || {}) as Record<string, unknown>,
    {},
    (assessment.categories || []) as unknown[],
    assessment.passing_score
  );

  // Four of these columns arrive with the 2026-11-10 migration. Before it
  // runs, naming them fails the whole statement — so a candidate who sat the
  // assessment lost every answer at the final step, which is the worst place
  // in the flow for it to happen.
  //
  // The answers are also written to skill_assessment_results below, so they
  // survive even when this half has to fall back to status and score alone.
  const submitWarnings: string[] = [];
  let { error: updateError } = await supabase
    .from('talent_skill_assessments')
    .update({
      status: 'submitted',
      score: provisional.score,
      answers: marked.objectiveAnswers,
      subjectiveAnswers: marked.subjectiveAnswers,
      submittedAt
    })
    .eq('id', id);

  if (updateError && isUndefinedColumn(updateError)) {
    submitWarnings.push(
      'Your answers were saved, but talent_skill_assessments is missing columns the product '
      + 'expects. Run packages/database/migrations/2026-11-10_assessment_columns.sql.'
    );
    ({ error: updateError } = await supabase
      .from('talent_skill_assessments')
      .update({ status: 'submitted', score: provisional.score })
      .eq('id', id));
  }

  if (updateError) {
    console.error('[assessments] assignment submission update failed:', updateError.message);
    return fail(500, `Your assessment was not saved: ${updateError.message}`);
  }

  // The result row is what the admin pipeline reads. Written second, so a
  // failure here leaves the assignment submitted rather than leaving a
  // result for an assignment that is still open.
  //
  // The answers are copied onto it because this is the row the marking screen
  // opens. Without them that screen read `r.answers`, found nothing, and
  // asked an operator to mark a written answer they could not see.
  const resultRow: Record<string, unknown> = {
    id: `sar_${id}`,
    talentId,
    assessmentId,
    score: provisional.score,
    autoScore: provisional.autoEarned,
    manualScore: null,
    maxScore: provisional.autoMax + provisional.manualMax,
    passed: provisional.passed,
    answers: marked.objectiveAnswers,
    subjectiveAnswers: marked.subjectiveAnswers,
    needsReview: marked.hasSubjective,
    submittedAt,
    completedAt: marked.hasSubjective ? null : submittedAt,
    subjectiveScores: {},
    categoryScores: {}
  };

  let { error: resultError } = await supabase
    .from('skill_assessment_results').upsert(resultRow);

  // Same migration. Falling back to the columns that have always existed
  // keeps the result, and the score with it; what is lost until the
  // migration runs is the stored copy of the answers, which is what the
  // marking screen reads.
  if (resultError && isUndefinedColumn(resultError)) {
    submitWarnings.push(
      'Your result was saved, but the written answers could not be stored for review until '
      + 'packages/database/migrations/2026-11-10_assessment_columns.sql has been run.'
    );
    for (const column of ['autoScore', 'manualScore', 'maxScore', 'answers', 'subjectiveAnswers', 'needsReview']) {
      delete resultRow[column];
    }
    ({ error: resultError } = await supabase
      .from('skill_assessment_results').upsert(resultRow));
  }

  if (resultError) {
    console.error('[assessments] result persistence failed:', resultError.message);
    let { error: restoreError } = await supabase
      .from('talent_skill_assessments')
      .update({
        status: assignment.status || 'assigned',
        score: assignment.score ?? null,
        answers: assignment.answers ?? null,
        subjectiveAnswers: assignment.subjectiveAnswers ?? null,
        submittedAt: assignment.submittedAt ?? null
      })
      .eq('id', id);

    if (restoreError && isUndefinedColumn(restoreError)) {
      ({ error: restoreError } = await supabase
        .from('talent_skill_assessments')
        .update({
          status: assignment.status || 'assigned',
          score: assignment.score ?? null
        })
        .eq('id', id));
    }

    if (restoreError) {
      console.error('[assessments] failed to restore assignment after result failure:', restoreError.message);
      return fail(
        500,
        `Your result could not be saved (${resultError.message}), and the assignment could not be reopened. `
        + 'Please contact support before trying again.'
      );
    }

    return fail(500, `Your result could not be saved: ${resultError.message}. Your assignment is available to retry.`);
  }

  // Operations has to know there is something to mark. A submission that
  // notifies nobody sits in the queue until somebody happens to look.
  if (marked.hasSubjective) {
    await notifyAdminsOfSubmission(talentId, assessmentId).catch(() => {});
  }

  return {
    ok: true,
    status: 200,
    data: {
      talentSkillAssessmentId: id,
      assessmentId,
      // What the candidate is told now: their marks so far out of the whole
      // paper, and plainly that it is not the final figure.
      score: provisional.score,
      autoScore: marked.autoScore,
      passed: provisional.passed,
      awaitingReview: marked.hasSubjective,
      questionsAwaitingReview: provisional.unmarked.length,
      submittedAt,
      warnings: submitWarnings
    }
  };
}

/** Tells the talent managers a paper is waiting. Never fails the submission. */
async function notifyAdminsOfSubmission(talentId: string, assessmentId: string) {
  const supabase = getSupabaseClient();

  const [{ data: reviewers }, { data: talent }, { data: assessment }] = await Promise.all([
    supabase.from('users').select('id').in('role', ['super_admin', 'talent_manager', 'ops_manager']),
    supabase.from('talent_profiles').select('full_name').eq('id', talentId).maybeSingle(),
    supabase.from('assessments').select('title').eq('id', assessmentId).maybeSingle()
  ]);

  const ids = (reviewers || []).map((u: any) => String(u.id)).filter(Boolean);
  if (ids.length === 0) return;

  await notifyUsers(ids, 'stage_advanced', {
    stageName: 'Skill Assessment',
    reason: `${talent?.full_name || 'A candidate'} submitted ${assessment?.title || 'a skill assessment'} `
      + 'and it has written answers waiting to be marked.',
    actionUrl: adminPortalUrl('/?tab=assessments')
  });
}

/**
 * An operator marking the written answers.
 *
 * Nothing did this. The admin portal had a Review Submission screen with a
 * score box against each written answer, and its submit handler was
 * `alert("Grading submitted!")` followed by closing the modal — the marks
 * were never sent anywhere, so a candidate who wrote anything other than
 * multiple choice could not be given a result at all.
 *
 * The marks are per question and bounded by that question's max_score. The
 * total is computed here, from the questions, not taken from the request: an
 * operator sets what each answer earned, not what the paper came to.
 */
export async function markAssessment(
  actor: Actor,
  input: {
    resultId?: string;
    talentSkillAssessmentId?: string;
    /** questionId -> { score, notes } or a bare number. */
    marks: Record<string, SubjectiveMark | number>;
    reviewerNotes?: string;
  }
): Promise<AssessmentResult> {
  if (!actor) return fail(401, 'Not authenticated.');
  if (actor.kind !== 'admin') return fail(403, 'Only operations marks an assessment.');

  const supabase = getSupabaseClient();

  const resultId = String(
    input.resultId || (input.talentSkillAssessmentId ? `sar_${input.talentSkillAssessmentId}` : '')
  ).trim();
  if (!resultId) return fail(400, 'Which submission is this?');

  const { data: result } = await supabase
    .from('skill_assessment_results').select('*').eq('id', resultId).maybeSingle();
  if (!result) return fail(404, 'That submission does not exist.');

  const { data: assessment, error: assessmentError } = await supabase
    .from('assessments')
    .select('id, title, categories, passing_score')
    .eq('id', result.assessmentId)
    .maybeSingle();
  if (assessmentError) {
    console.error('[assessments] assessment lookup for marking failed:', assessmentError.message);
    return fail(500, 'Could not load this assessment for marking. Please try again.');
  }
  if (!assessment) return fail(404, 'That assessment no longer exists.');

  const { questions, error: questionsError } = await loadQuestions(assessment.categories || []);
  if (questionsError) {
    console.error('[assessments] question lookup for marking failed:', questionsError);
    return fail(500, 'Could not load the assessment questions for marking. Please try again.');
  }

  // Everything the candidate answered, objective and written together, so the
  // auto half is re-marked from the key rather than trusted from the old row.
  const allAnswers = {
    ...(result.answers || {}),
    ...(result.subjectiveAnswers || {})
  } as Record<string, unknown>;

  // Marks already recorded, so a reviewer can mark half the paper, come back,
  // and not lose what they did.
  const existing = (result.subjectiveScores && typeof result.subjectiveScores === 'object')
    ? result.subjectiveScores as Record<string, SubjectiveMark>
    : {};

  const incoming: Record<string, SubjectiveMark> = {};
  for (const [questionId, raw] of Object.entries(input.marks || {})) {
    const score = typeof raw === 'number' ? raw : Number((raw as SubjectiveMark)?.score);
    if (!Number.isFinite(score)) continue;
    const notes = typeof raw === 'object' && raw ? String((raw as SubjectiveMark).notes || '') : '';
    incoming[questionId] = notes ? { score, notes } : { score };
  }

  const marks = { ...existing, ...incoming };
  const scored = finalAssessmentScore(
    questions as any,
    allAnswers,
    marks,
    (assessment.categories || []) as unknown[],
    assessment.passing_score
  );

  const reviewedAt = new Date().toISOString();

  const { error } = await supabase
    .from('skill_assessment_results')
    .update({
      score: scored.score,
      autoScore: scored.autoEarned,
      manualScore: scored.manualEarned,
      maxScore: scored.autoMax + scored.manualMax,
      passed: scored.passed,
      subjectiveScores: marks,
      // Only finished when every written answer has a mark. A half-marked
      // paper stays in the queue rather than leaving the candidate with a
      // score that is not their score.
      needsReview: !scored.isFullyMarked,
      completedAt: scored.isFullyMarked ? reviewedAt : null,
      reviewerNotes: input.reviewerNotes ?? result.reviewerNotes ?? null,
      reviewedBy: actor.userId,
      reviewedAt
    })
    .eq('id', resultId);

  if (error) return fail(500, `Those marks were not saved: ${error.message}`);

  // The assignment carries the same figure, because the candidate's portal
  // and the vetting pipeline both read it from there.
  const assignmentId = String(result.id || '').replace(/^sar_/, '');
  if (assignmentId) {
    await supabase
      .from('talent_skill_assessments')
      .update({ score: scored.score, status: scored.isFullyMarked ? 'marked' : 'submitted' })
      .eq('id', assignmentId);
  }

  await recordAudit(actor, {
    action: scored.isFullyMarked ? 'Mark Skill Assessment' : 'Part-mark Skill Assessment',
    details: `${assessment.title || result.assessmentId}: ${scored.autoEarned + scored.manualEarned}`
      + ` of ${scored.autoMax + scored.manualMax} marks, ${scored.score}%`
      + (scored.isFullyMarked ? '' : `, ${scored.unmarked.length} answers still unmarked`) + '.',
    entityType: 'skill_assessment_result',
    entityId: resultId
  });

  // The candidate hears the result from us, once it is final.
  const warnings: string[] = [];
  if (scored.isFullyMarked && result.talentId) {
    const { data: talent } = await supabase
      .from('talent_profiles').select('user_id').eq('id', result.talentId).maybeSingle();
    if (talent?.user_id) {
      const notified = await notifyUsers(String(talent.user_id), 'assessment_marked', {
        stageName: assessment.title || 'Skill Assessment',
        score: `${scored.score}%`,
        passMark: assessment.passing_score != null ? `${assessment.passing_score}%` : undefined,
        feedback: input.reviewerNotes || undefined,
        actionUrl: talentPortalUrl('/?section=scores_grades')
      });
      warnings.push(...notified.warnings);
    }
  }

  return {
    ok: true,
    status: 200,
    data: {
      resultId,
      score: scored.score,
      autoEarned: scored.autoEarned,
      autoMax: scored.autoMax,
      manualEarned: scored.manualEarned,
      manualMax: scored.manualMax,
      passed: scored.passed,
      isFullyMarked: scored.isFullyMarked,
      unmarked: scored.unmarked,
      warnings
    }
  };
}
