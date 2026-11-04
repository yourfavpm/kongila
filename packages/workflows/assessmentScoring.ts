/**
 * Scoring a skill assessment.
 *
 * The browser scored the assessment and then wrote its own score straight
 * into `talent_skill_assessments`, which has RLS off in the live database.
 * A candidate could post any score they liked, and the vetting pipeline
 * read it as an assessed result.
 *
 * The same arithmetic lives here so the server can do it from the answer
 * key, which never leaves the server. The browser may still compute a score
 * to show the candidate immediately; the stored one comes from this.
 *
 * This file imports nothing, so it can be tested on its own.
 */

export interface ScoredQuestion {
  id: string;
  type: string;
  category_id?: string | null;
  correct_answer?: unknown;
  scoring_weight?: number | null;
}

export interface AssessmentScore {
  /** Percentage of the weighted multiple choice, or null when there is none. */
  autoScore: number | null;
  /** Answers to multiple choice questions, keyed by question id. */
  objectiveAnswers: Record<string, unknown>;
  /** Answers a human still has to mark. */
  subjectiveAnswers: Record<string, unknown>;
  hasSubjective: boolean;
  /** Against the assessment pass mark. Null while a human still has to mark. */
  passed: boolean | null;
}

const MULTIPLE_CHOICE = 'multiple_choice';

function asList(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [value];
}

/** Whether a given answer matches the key, order ignored. */
export function answerMatches(correct: unknown, given: unknown): boolean {
  const key = asList(correct).map(v => String(v));
  const reply = asList(given).map(v => String(v));
  if (key.length !== reply.length) return false;
  return key.every(c => reply.includes(c));
}

/**
 * Marks a submission.
 *
 * Only questions whose category is part of this assessment count, which is
 * the rule the portal already applied: the question bank is shared and an
 * assessment picks categories out of it.
 *
 * A question the candidate did not answer scores nothing but still counts
 * towards the total, so skipping is not a way to raise a percentage.
 */
export function scoreAssessment(
  questions: ScoredQuestion[],
  answers: Record<string, unknown>,
  categories: unknown[],
  passingScore?: number | null
): AssessmentScore {
  const inAssessment = new Set((categories || []).map(c => String(c)));
  const given = answers && typeof answers === 'object' ? answers : {};

  let totalWeight = 0;
  let earnedWeight = 0;
  const objectiveAnswers: Record<string, unknown> = {};
  const subjectiveAnswers: Record<string, unknown> = {};

  for (const question of questions || []) {
    if (!question || !question.id) continue;
    if (!inAssessment.has(String(question.category_id))) continue;

    const reply = given[question.id];

    if (question.type === MULTIPLE_CHOICE) {
      const weight = Number(question.scoring_weight);
      const applied = Number.isFinite(weight) && weight > 0 ? weight : 1;
      totalWeight += applied;
      if (reply !== undefined && answerMatches(question.correct_answer, reply)) {
        earnedWeight += applied;
      }
      if (reply !== undefined) objectiveAnswers[question.id] = reply;
      continue;
    }

    if (reply !== undefined) subjectiveAnswers[question.id] = reply;
  }

  const autoScore = totalWeight === 0
    ? null
    : Math.round((earnedWeight / totalWeight) * 100);

  const hasSubjective = Object.keys(subjectiveAnswers).length > 0;

  // A pass is only decided when there is nothing left for a person to mark.
  // Calling a half-marked assessment failed would lock a candidate out of a
  // stage on an incomplete score.
  const pass = Number(passingScore);
  const passed = hasSubjective || autoScore === null || !Number.isFinite(pass)
    ? null
    : autoScore >= pass;

  return { autoScore, objectiveAnswers, subjectiveAnswers, hasSubjective, passed };
}
