/**
 * Is this a vetting pipeline the product could actually have produced?
 *
 * `validateStageDecision` checks one decision at the moment an operator makes
 * it, in the admin portal. The server never checked anything. `/api/vetting`
 * accepted whatever array the browser posted, verifying only that it was an
 * array, that it held thirty or fewer entries, and that any status transition
 * on the candidate was legal. So a request made outside the admin UI could
 * post a pipeline with all seven stages passed and no scores, and the server
 * would store it. The grade is computed from the scores rather than taken
 * from the request, so that was never a route to a fake grade, but it was a
 * route to a fake pipeline: a candidate who appears fully assessed.
 *
 * This validates the posted state as a whole rather than one decision, which
 * is what the route actually receives.
 *
 * Like grading.ts, this file imports nothing, so it can be tested on its own
 * with `node --test` and no framework. The caller supplies the stage specs,
 * which is also what lets the tests describe a pipeline of their own instead
 * of depending on the real seven.
 */

export interface StageSpec {
  index: number;
  name: string;
  /** True when the stage feeds a scored dimension of the composite. */
  requiresScore: boolean;
}

/** Statuses a stage may hold. Anything else is a request we did not write. */
export const STAGE_STATUSES = [
  'pending',
  'in_progress',
  'passed',
  'failed',
  'skipped',
  'needs_clarification'
] as const;

export type StageStatus = typeof STAGE_STATUSES[number];

/** A stage is behind us when it passed or was deliberately skipped. */
const SETTLED = new Set<string>(['passed', 'skipped']);

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Returns the reason this pipeline cannot be stored, or null when it can.
 *
 * The checks, in the order a bad request is most likely to fail them:
 *
 *   1. It is an array of exactly the right length. A short pipeline is how a
 *      stage disappears; a long one is how an extra appears.
 *   2. Every entry is an object with the stage index and name it should have,
 *      so stage 3 cannot be relabelled as stage 6.
 *   3. Every status is one we recognise.
 *   4. Scores are numbers between 0 and 100, where present.
 *   5. No stage is passed while an earlier stage is still open. This is the
 *      check that stops a candidate being walked straight to Final Review.
 *   6. No stage is passed if an earlier stage failed. Reopening the failed
 *      stage is the way forward, not stepping over it.
 *   7. A stage that feeds the composite is not passed without a score, which
 *      would otherwise count as zero and drag the grade down silently.
 *   8. At most one stage is in progress. Two open stages is not a state the
 *      portal can advance from.
 */
export function validatePipelineShape(
  pipeline: unknown,
  stages: StageSpec[]
): string | null {
  if (!Array.isArray(pipeline)) return 'A pipeline must be a list of stages.';

  if (pipeline.length !== stages.length) {
    return `A vetting pipeline has ${stages.length} stages; this one has ${pipeline.length}.`;
  }

  for (let i = 0; i < stages.length; i++) {
    const spec = stages[i];
    const stage = pipeline[i];

    if (!isPlainObject(stage)) return `Stage ${i + 1} is not a stage.`;

    const index = Number(stage.stageIndex);
    if (!Number.isInteger(index) || index !== spec.index) {
      return `Stage ${i + 1} claims to be stage ${stage.stageIndex}.`;
    }

    // The name is allowed to be absent, because some writers leave it to the
    // server, but a name that disagrees with the position is a relabelled
    // stage.
    if (stage.stageName !== undefined && stage.stageName !== null && String(stage.stageName) !== spec.name) {
      return `Stage ${i + 1} should be ${spec.name}, not "${stage.stageName}".`;
    }

    const status = String(stage.status ?? 'pending');
    if (!(STAGE_STATUSES as readonly string[]).includes(status)) {
      return `"${status}" is not a stage status.`;
    }

    if (stage.score !== undefined && stage.score !== null && stage.score !== '') {
      const score = Number(stage.score);
      if (!Number.isFinite(score) || score < 0 || score > 100) {
        return `The score on ${spec.name} must be a number between 0 and 100.`;
      }
    }
  }

  const statusAt = (i: number) => String((pipeline[i] as Record<string, unknown>).status ?? 'pending');
  const scoreAt = (i: number) => (pipeline[i] as Record<string, unknown>).score;

  const firstFailed = pipeline.findIndex((_, i) => statusAt(i) === 'failed');

  for (let i = 0; i < stages.length; i++) {
    const spec = stages[i];
    if (statusAt(i) !== 'passed') continue;

    // The rejection is checked first. A failed stage is also an open stage,
    // so without this the caller is told the vaguer of the two things.
    if (firstFailed >= 0 && firstFailed < i) {
      return `${stages[firstFailed].name} was rejected, so ${spec.name} cannot be passed. `
        + 'Reopen that stage for re-assessment first.';
    }

    const openBehind = pipeline.findIndex((_, j) => j < i && !SETTLED.has(statusAt(j)));
    if (openBehind >= 0) {
      return `${spec.name} cannot be passed while ${stages[openBehind].name} is ${statusAt(openBehind)}.`;
    }

    if (spec.requiresScore) {
      const score = scoreAt(i);
      if (score === undefined || score === null || score === '' || !Number.isFinite(Number(score))) {
        return `${spec.name} produces a score for the composite grade, so it cannot be passed without one.`;
      }
    }
  }

  const inProgress = pipeline.filter((_, i) => statusAt(i) === 'in_progress').length;
  if (inProgress > 1) {
    return 'Only one stage can be in progress at a time.';
  }

  return null;
}
