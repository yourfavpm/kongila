/**
 * Composite vetting grade.
 *
 * This file deliberately imports nothing. It holds the whole scoring rule in
 * one place so it can be read, argued about and tested on its own, with
 * `node --test` and no test framework installed.
 *
 * ── The model, and the decision behind it ───────────────────────────────────
 *
 * The original scope specified seven dimensions:
 *
 *   technical 25, behavioral 20, workSimulation 15, communication 15,
 *   personality 10, remoteReadiness 10, experience 5
 *
 * On 2 November 2026 communication and experience were dropped from the
 * scoring model. Neither was ever measured: no vetting stage produced a score
 * for them, the admin override panel had no field for them, and nothing wrote
 * them. They were permanently zero, which capped every candidate at 80 and
 * put A+ out of reach for everyone.
 *
 * They are not lost, only not scored twice:
 *
 *   communication  is observed in the behavioural interview rubric, which
 *                  already feeds `behavioral`.
 *   experience     is screened at stage 0, Application Screening, which is
 *                  pass or fail by design and carries no score.
 *
 * The remaining five are renormalised to 100, each mapping one-to-one onto a
 * vetting stage that produces a score:
 *
 *   technical       30   stage 1, Skill Assessment
 *   behavioral      30   stage 2, Behavioural Interview
 *   workSimulation  20   stage 5, Work Simulation
 *   personality     10   stage 3, Personality Test
 *   remoteReadiness 10   stage 4, Remote Readiness
 *
 * To add a dimension back, build the input first: a stage that produces the
 * score, a field in the admin override panel, and somewhere to store it. The
 * test beside this file fails if a weight is added for a dimension with no
 * stage behind it, so it cannot be half-done by accident.
 */

export interface VettingScoresInput {
  technical: number;
  workSimulation: number;
  behavioral: number;
  personality: number;
  remoteReadiness: number;

  /** @deprecated Dropped from the scoring model on 2 November 2026. Unweighted. */
  communication?: number;
  /** @deprecated Dropped from the scoring model on 2 November 2026. Unweighted. */
  experience?: number;
}

export type VettingGrade = 'A+' | 'A' | 'B' | 'Reject';

/** The dimension a weight scores, and the vetting stage that produces it. */
export interface WeightedDimension {
  key: keyof VettingScoresInput;
  weight: number;
  /** Index in VETTING_STAGES. null means nothing in the product produces it. */
  producedByStage: number | null;
}

export const COMPOSITE_WEIGHTS: WeightedDimension[] = [
  { key: 'technical', weight: 0.30, producedByStage: 1 },
  { key: 'behavioral', weight: 0.30, producedByStage: 2 },
  { key: 'workSimulation', weight: 0.20, producedByStage: 5 },
  { key: 'personality', weight: 0.10, producedByStage: 3 },
  { key: 'remoteReadiness', weight: 0.10, producedByStage: 4 }
];

/**
 * Dropped from the scoring model on 2 November 2026 because nothing measures
 * them. Kept listed so the test can assert they stay unweighted.
 */
export const DROPPED_DIMENSIONS: Array<'communication' | 'experience'> = [
  'communication',
  'experience'
];

/** @deprecated Renamed to DROPPED_DIMENSIONS. */
export const UNMEASURED_DIMENSIONS = DROPPED_DIMENSIONS;

export const GRADE_THRESHOLDS = { 'A+': 85, A: 75, B: 65 } as const;

export function gradeForScore(score: number): VettingGrade {
  if (score >= GRADE_THRESHOLDS['A+']) return 'A+';
  if (score >= GRADE_THRESHOLDS.A) return 'A';
  if (score >= GRADE_THRESHOLDS.B) return 'B';
  return 'Reject';
}

export function calculateCompositeVettingGrade(
  scores: Partial<VettingScoresInput> | null | undefined
): { score: number; grade: VettingGrade } {
  const total = COMPOSITE_WEIGHTS.reduce((sum, dimension) => {
    const raw = Number(scores?.[dimension.key] ?? 0);
    const clamped = Number.isFinite(raw) ? Math.min(100, Math.max(0, raw)) : 0;
    return sum + clamped * dimension.weight;
  }, 0);

  const score = Math.round(total);
  return { score, grade: gradeForScore(score) };
}
