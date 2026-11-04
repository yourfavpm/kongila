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

import { getSupabaseClient } from './index';
import type { RequestActor as Actor } from './scope';
import { scoreAssessment } from '@kongila/workflows';

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
async function loadQuestions(categories: unknown[]) {
  const supabase = getSupabaseClient();
  const ids = (categories || []).map(c => String(c)).filter(Boolean);
  if (ids.length === 0) return [];
  const { data } = await supabase
    .from('assessment_questions')
    .select('id, type, category_id, correct_answer, scoring_weight')
    .in('category_id', ids);
  return data || [];
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

  const { data: assignment } = await supabase
    .from('talent_skill_assessments')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (!assignment) return fail(404, 'That assessment was not assigned to you.');
  if (String(assignment.talentId) !== talentId) {
    return fail(403, 'That assessment was not assigned to you.');
  }
  if (String(assignment.status || '') === 'submitted') {
    // Without this a candidate could sit the same assessment until they
    // passed it, and the pipeline would show the best attempt.
    return fail(409, 'You have already submitted this assessment.');
  }

  const assessmentId = String(assignment.assessmentId || input.assessmentId || '');
  const { data: assessment } = await supabase
    .from('assessments')
    .select('id, categories, passing_score, status')
    .eq('id', assessmentId)
    .maybeSingle();

  if (!assessment) return fail(404, 'That assessment no longer exists.');

  const questions = await loadQuestions(assessment.categories || []);
  const marked = scoreAssessment(
    questions as any,
    (input.answers || {}) as Record<string, unknown>,
    (assessment.categories || []) as unknown[],
    assessment.passing_score
  );

  const submittedAt = new Date().toISOString();

  const { error: updateError } = await supabase
    .from('talent_skill_assessments')
    .update({
      status: 'submitted',
      score: marked.autoScore,
      answers: marked.objectiveAnswers,
      subjectiveAnswers: marked.subjectiveAnswers,
      submittedAt
    })
    .eq('id', id);

  if (updateError) return fail(500, `Your assessment was not saved: ${updateError.message}`);

  // The result row is what the admin pipeline reads. Written second, so a
  // failure here leaves the assignment submitted rather than leaving a
  // result for an assignment that is still open.
  const { error: resultError } = await supabase
    .from('skill_assessment_results')
    .upsert({
      id: `sar_${id}`,
      talentId,
      assessmentId,
      score: marked.autoScore,
      passed: marked.passed,
      submittedAt,
      completedAt: marked.hasSubjective ? null : submittedAt,
      subjectiveScores: {},
      categoryScores: {}
    });

  if (resultError) {
    return fail(500, `Your answers were saved but the result was not: ${resultError.message}`);
  }

  return {
    ok: true,
    status: 200,
    data: {
      talentSkillAssessmentId: id,
      assessmentId,
      autoScore: marked.autoScore,
      passed: marked.passed,
      hasSubjective: marked.hasSubjective,
      submittedAt
    }
  };
}
