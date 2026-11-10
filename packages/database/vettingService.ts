/**
 * Vetting, server side.
 *
 * The admin panel ran the whole vetting pipeline in browser state and
 * pushed it back through `/api/db`, which upserts the entire `talents`
 * array. Five consequences, all of them live:
 *
 *   - `grade` and `vetting_status` were set from the browser. They are the
 *     judgement fields; a candidate's own portal was already able to write
 *     them, and this was the other end of the same hole.
 *   - Every save rewrote every candidate's row, not just the one being
 *     assessed, from whatever the screen happened to be holding. Two
 *     operators working at once overwrote each other, and any profile edit
 *     a candidate had made since the page loaded was lost.
 *   - The pipeline and the scores live inside a JSON envelope in the `bio`
 *     column. Repacking that envelope from browser state rewrote the
 *     candidate's own bio text as a side effect of an operator action.
 *   - The audit entries named 'Admin Operator' and 'Ops Lead', regardless
 *     of who was signed in, and went to a table that denies browser writes.
 *   - Nothing told the candidate anything had happened.
 *
 * Everything here reads one row, changes one row, and writes one row.
 */

import { getSupabaseClient, isUndefinedColumn } from './index';
import type { RequestActor as Actor } from './scope';
import { recordAudit } from './audit';
import { notifyUsers, talentPortalUrl } from './notify';
import { calculateCompositeVettingGrade, vettingScoreState, validatePostedPipeline } from '@kongila/matching-engine';
import { canTransitionTalent } from '@kongila/workflows';

export interface VettingResult<T = any> {
  ok: boolean;
  status: number;
  error?: string;
  data?: T;
  warnings?: string[];
}

function fail(status: number, error: string): VettingResult {
  return { ok: false, status, error };
}

function canVet(actor: Actor): boolean {
  return actor.kind === 'admin'
    && ['super_admin', 'talent_manager', 'ops_manager', 'skill_assessor'].includes(String(actor.role));
}

// ─── The bio envelope ────────────────────────────────────────────────────────

interface Envelope {
  __kongila: true;
  tags: unknown[];
  scores: Record<string, unknown>;
  telemetry: Record<string, unknown>;
  bio: string;
}

/**
 * Reads the JSON envelope out of the bio column.
 *
 * A bio that is plain text, or malformed JSON, is a candidate who wrote
 * their own bio before the envelope existed. Keep the text; do not throw
 * it away because it will not parse.
 */
function readEnvelope(bio: unknown): Envelope {
  const empty: Envelope = { __kongila: true, tags: [], scores: {}, telemetry: {}, bio: '' };
  if (typeof bio !== 'string' || !bio.trim()) return empty;

  try {
    const parsed = JSON.parse(bio);
    if (parsed && parsed.__kongila) {
      return {
        __kongila: true,
        tags: Array.isArray(parsed.tags) ? parsed.tags : [],
        scores: parsed.scores && typeof parsed.scores === 'object' ? parsed.scores : {},
        telemetry: parsed.telemetry && typeof parsed.telemetry === 'object' ? parsed.telemetry : {},
        bio: typeof parsed.bio === 'string' ? parsed.bio : ''
      };
    }
    // Valid JSON but not ours. Treat it as text rather than losing it.
    return { ...empty, bio };
  } catch {
    return { ...empty, bio };
  }
}

/** The one place a talent row is loaded for a vetting change. */
async function loadTalent(talentId: string) {
  const supabase = getSupabaseClient();
  const { data } = await supabase
    .from('talent_profiles').select('*').eq('id', talentId).maybeSingle();
  return data;
}

// ─── Scores and grade ────────────────────────────────────────────────────────

const SCORE_KEYS = [
  'technical', 'behavioral', 'personality', 'remoteReadiness', 'workSimulation'
];

/**
 * Records the composite vetting scores and the grade they produce.
 *
 * The grade is computed here from the scores, not accepted from the
 * caller. It was computed in the browser and posted alongside, which meant
 * the number on screen and the number stored only agreed as long as
 * nobody edited the request in between.
 */
export async function recordVettingScores(
  actor: Actor,
  input: { talentId: string; scores: Record<string, unknown> }
): Promise<VettingResult> {
  if (!actor) return fail(401, 'Not authenticated.');
  if (!canVet(actor)) return fail(403, 'You are not able to vet a candidate.');

  const talentId = String(input.talentId || '').trim();
  if (!talentId) return fail(400, 'Which candidate?');

  const scores: Record<string, number> = {};
  for (const key of SCORE_KEYS) {
    const raw = input.scores?.[key];
    if (raw === undefined || raw === null || raw === '') continue;
    const value = Number(raw);
    if (!Number.isFinite(value) || value < 0 || value > 100) {
      return fail(422, `${key} must be a number between 0 and 100.`);
    }
    scores[key] = value;
  }

  if (Object.keys(scores).length === 0) {
    return fail(422, 'No scores were given.');
  }

  const talent = await loadTalent(talentId);
  if (!talent) return fail(404, 'That candidate does not exist.');

  // A grade is a statement about a finished assessment.
  //
  // This read `calculateCompositeVettingGrade(scores).grade` over whatever
  // subset of scores had been entered, and the dimensions nobody had scored
  // yet counted as zero. Three stages of five at full marks comes to 80,
  // which clears the A+ threshold, so a candidate could be marked Vetted at
  // A+ having never sat the personality test or the remote readiness check.
  // Two stages at full marks comes to 60, which grades as Reject, so the
  // same arithmetic also failed candidates who had passed everything asked
  // of them so far.
  //
  // A grade and a move to Vetted now require every measured stage to have a
  // score. A partial set is recorded and leaves the candidate in Review.
  const state = vettingScoreState(scores as any);
  const { score } = calculateCompositeVettingGrade(scores as any);
  const grade = state.grade;
  const nextStatus = state.isFullyScored && grade !== 'Reject' ? 'Vetted' : 'Review';

  // The transition table decides whether this move is legal. Nothing
  // checked before, so a deployed candidate could be dropped back to
  // Applied by a stale screen.
  //
  // Scoring a candidate is the review, so an Applied candidate passes
  // through Review on the way: the table has no Applied to Vetted edge,
  // and refusing the save outright would mean nobody could ever be vetted
  // from a first assessment.
  const current = String(talent.vetting_status || 'Applied');
  const steps = current === 'Applied' && nextStatus === 'Vetted'
    ? ['Review', 'Vetted']
    : [nextStatus];

  let walked = current;
  for (const step of steps) {
    if (walked !== step && !canTransitionTalent(walked as any, step as any)) {
      return fail(409, `A candidate who is ${current} cannot be moved to ${nextStatus}.`);
    }
    walked = step;
  }

  // Only this candidate's envelope is touched, and only its scores.
  const envelope = readEnvelope(talent.bio);
  envelope.scores = scores;

  const supabase = getSupabaseClient();
  const patch: Record<string, unknown> = {
    bio: JSON.stringify(envelope),
    vetting_scores: scores,
    composite_score: state.score,
    vetting_status: nextStatus
  };
  // An incomplete assessment leaves the existing grade alone rather than
  // writing one derived from stages nobody has run.
  if (state.isFullyScored && grade) patch.grade = grade;

  let { error } = await supabase
    .from('talent_profiles').update(patch).eq('id', talentId);

  // Same fallback as updateVettingPipeline: before the 2026-11-09c migration
  // vetting_scores and composite_score do not exist, and naming them failed
  // the whole statement, taking the envelope, the status and the grade with
  // it.
  if (error && isUndefinedColumn(error)) {
    console.warn(
      '[vetting] no vetting_scores/composite_score columns, so these scores were saved to the '
      + 'bio envelope instead. Run packages/database/migrations/2026-11-09c_vetting_columns.sql.'
    );
    const withoutColumns: Record<string, unknown> = { ...patch };
    delete withoutColumns.vetting_scores;
    delete withoutColumns.composite_score;
    ({ error } = await supabase
      .from('talent_profiles').update(withoutColumns).eq('id', talentId));
  }

  if (error) return fail(500, `Those scores were not saved: ${error.message}`);

  await recordAudit(actor, {
    action: 'Update Vetting Scores',
    details: `${talent.full_name || talentId}: composite ${score}%, `
      + `grade ${grade ?? 'not yet graded'} (${state.scoredDimensions.length} of `
      + `${state.scoredDimensions.length + state.missingDimensions.length} stages scored), `
      + `status ${nextStatus}.`,
    entityType: 'talent_profile',
    entityId: talentId
  });

  const warnings: string[] = [];
  if (talent.user_id) {
    // Vetted means every measured stage has produced a score and the grade
    // is real, so this is the one place `vetting_complete` is sent — with the
    // grade, which `stage_advanced` had no way to carry.
    const notified = nextStatus === 'Vetted'
      ? await notifyUsers(String(talent.user_id), 'vetting_complete', {
          grade: state.isFullyScored && grade ? grade : undefined,
          actionUrl: talentPortalUrl('/?section=scores_grades')
        })
      : await notifyUsers(String(talent.user_id), 'vetting_stage_result', {
          stageName: 'Vetting',
          score: `${state.score ?? 0}%`,
          feedback: 'Your assessment is still being reviewed.',
          actionUrl: talentPortalUrl('/?section=vetting')
        });
    warnings.push(...notified.warnings);
  }

  return {
    ok: true,
    status: 200,
    data: {
      talentId,
      score,
      grade,
      isFullyScored: state.isFullyScored,
      awaitingScores: state.missingDimensions,
      vettingStatus: nextStatus,
      scores
    },
    warnings
  };
}

// ─── The pipeline ────────────────────────────────────────────────────────────

/**
 * Writes the vetting pipeline for one candidate.
 *
 * The pipeline is an array of stages with decisions, scores and interview
 * references. It lives in the bio envelope, which is why the browser was
 * repacking the whole envelope to change one stage. Only the pipeline and
 * the stage name move here; the candidate's own bio text does not.
 *
 * `grade` is not accepted from the caller. When a stage decision carries
 * scores, the grade is recomputed here from those scores, the same way
 * `recordVettingScores` does it. The browser used to compute it and post
 * it alongside, so the number on screen and the number stored agreed only
 * as long as nothing changed in between.
 */
export async function updateVettingPipeline(
  actor: Actor,
  input: {
    talentId: string;
    pipeline: unknown[];
    vettingStage?: string | null;
    vettingStatus?: string | null;
    /** Accumulated stage scores. The grade is recomputed from these. */
    scores?: Record<string, unknown> | null;
    action?: string | null;
    details?: string | null;
  }
): Promise<VettingResult> {
  if (!actor) return fail(401, 'Not authenticated.');
  if (!canVet(actor)) return fail(403, 'You are not able to vet a candidate.');

  const talentId = String(input.talentId || '').trim();
  if (!talentId) return fail(400, 'Which candidate?');
  if (!Array.isArray(input.pipeline)) return fail(400, 'A pipeline is required.');

  // The posted pipeline is checked against the real seven stages before it is
  // stored. Until now the only checks here were that it was an array of
  // thirty or fewer entries, so a request made outside the admin portal could
  // post every stage as passed, with no scores, and the server would keep it:
  // a candidate who looks fully assessed and never was. The portal's own
  // validateStageDecision still runs when an operator takes a decision, which
  // is what gives them the specific message about that decision; this is the
  // check that does not depend on the caller being our own screen.
  const shapeProblem = validatePostedPipeline(input.pipeline);
  if (shapeProblem) return fail(422, shapeProblem);

  const talent = await loadTalent(talentId);
  if (!talent) return fail(404, 'That candidate does not exist.');

  const patch: Record<string, unknown> = {};

  if (input.vettingStatus) {
    const current = String(talent.vetting_status || 'Applied');
    const next = String(input.vettingStatus);
    if (current !== next && !canTransitionTalent(current as any, next as any)) {
      return fail(409, `A candidate who is ${current} cannot be moved to ${next}.`);
    }
    patch.vetting_status = next;
  }

  if (input.vettingStage) patch.vetting_stage = String(input.vettingStage);

  const envelope = readEnvelope(talent.bio);
  envelope.telemetry = { ...envelope.telemetry, vettingPipeline: input.pipeline };

  let grade: string | null = null;
  if (input.scores && typeof input.scores === 'object') {
    const scores: Record<string, number> = {};
    for (const key of SCORE_KEYS) {
      const raw = (input.scores as Record<string, unknown>)[key];
      if (raw === undefined || raw === null || raw === '') continue;
      const value = Number(raw);
      if (!Number.isFinite(value) || value < 0 || value > 100) {
        return fail(422, `${key} must be a number between 0 and 100.`);
      }
      scores[key] = value;
    }
    if (Object.keys(scores).length > 0) {
      envelope.scores = scores;
      // Same rule as recordVettingScores: no grade until every measured
      // stage has produced a score. The composite is written either way,
      // because a running total is useful to operations; it is only the
      // grade that must wait for a complete assessment.
      const state = vettingScoreState(scores as any);
      patch.vetting_scores = scores;
      patch.composite_score = state.score;
      if (state.isFullyScored && state.grade) {
        grade = state.grade;
        patch.grade = grade;
      }
    }
  }

  patch.vetting_pipeline = input.pipeline;
  patch.bio = JSON.stringify(envelope);

  const supabase = getSupabaseClient();
  let { error } = await supabase
    .from('talent_profiles').update(patch).eq('id', talentId);

  // The three vetting columns arrive with the 2026-11-09c migration. Until it
  // runs they do not exist, and naming them failed the whole statement — so a
  // stage decision could not be saved at all, even though the bio envelope
  // beside them would have taken it. An operator approving Application
  // Screening got an error, nothing was stored, and every later stage stayed
  // blocked because the stage behind it was still pending.
  //
  // The envelope carries the same pipeline and scores, so fall back to it and
  // let the migration move the row onto the columns later.
  if (error && isUndefinedColumn(error)) {
    console.warn(
      '[vetting] talent_profiles has no vetting_pipeline/vetting_scores/composite_score columns, ' +
      'so this decision was saved to the bio envelope instead. Run ' +
      'packages/database/migrations/2026-11-09c_vetting_columns.sql.'
    );
    const withoutColumns: Record<string, unknown> = { ...patch };
    delete withoutColumns.vetting_pipeline;
    delete withoutColumns.vetting_scores;
    delete withoutColumns.composite_score;
    ({ error } = await supabase
      .from('talent_profiles').update(withoutColumns).eq('id', talentId));
  }

  if (error) return fail(500, `That decision was not saved: ${error.message}`);

  await recordAudit(actor, {
    action: input.action || 'Update Vetting Pipeline',
    details: input.details
      || `${talent.full_name || talentId}: pipeline updated`
         + (input.vettingStage ? `, stage ${input.vettingStage}` : '') + '.',
    entityType: 'talent_profile',
    entityId: talentId
  });

  const warnings: string[] = [];
  if (input.vettingStage && talent.user_id && input.vettingStage !== talent.vetting_stage) {
    const notified = await notifyUsers(String(talent.user_id), 'stage_advanced', {
      stageName: String(input.vettingStage),
      actionUrl: talentPortalUrl('/?section=vetting')
    });
    warnings.push(...notified.warnings);
  }

  return {
    ok: true,
    status: 200,
    data: {
      talentId,
      vettingStage: patch.vetting_stage ?? talent.vetting_stage,
      vettingStatus: patch.vetting_status ?? talent.vetting_status,
      grade: grade ?? talent.grade,
      scores: envelope.scores,
      pipeline: input.pipeline
    },
    warnings
  };
}
