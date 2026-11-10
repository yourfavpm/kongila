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
  /** What a written answer is worth. Multiple choice uses scoring_weight. */
  max_score?: number | null;
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
  // Number(null) is 0 and finite, so an assessment with no pass mark set had
  // an effective pass mark of zero and everybody passed it.
  const hasPassMark = passingScore !== null && passingScore !== undefined && passingScore !== ('' as any);
  const pass = Number(passingScore);
  const passed = hasSubjective || autoScore === null || !hasPassMark || !Number.isFinite(pass)
    ? null
    : autoScore >= pass;

  return { autoScore, objectiveAnswers, subjectiveAnswers, hasSubjective, passed };
}

// ─── The final score, once a person has marked the written answers ──────────

/** What a reviewer awarded for one written answer. */
export interface SubjectiveMark {
  /** Marks given, 0 to the question's max_score. */
  score: number;
  /** Why. Shown to the candidate with their result. */
  notes?: string;
}

export interface FinalAssessmentScore {
  /** 0 to 100, over every question in the assessment. */
  score: number;
  /** Marks earned and available on the auto-marked half. */
  autoEarned: number;
  autoMax: number;
  /** Marks earned and available on the written half. */
  manualEarned: number;
  manualMax: number;
  /** Written questions still without a mark. The score is provisional while this is non-empty. */
  unmarked: string[];
  /** Every written question has a mark. */
  isFullyMarked: boolean;
  passed: boolean | null;
}

/**
 * Combines the machine's marking and the reviewer's into one score.
 *
 * `scoreAssessment` above answers "how did they do on the multiple choice",
 * which is all that could be answered at submission time. It returns a
 * percentage of the objective questions alone, so an assessment that was half
 * written answers reported a score over half the paper and called it the
 * result.
 *
 * This is the whole paper. Objective questions are worth their
 * `scoring_weight`, written ones their `max_score`, and the score is marks
 * earned over marks available across both. That means a candidate who aces
 * the multiple choice and writes nothing scores well under 100, which is the
 * honest answer and was not what the old arithmetic gave.
 *
 * A written question with no mark yet is counted in the total but earns
 * nothing, and is named in `unmarked`. So a partly marked paper has a score
 * that can only rise, and the caller can tell it is not final. Nothing here
 * invents a mark for an unmarked answer.
 */
export function finalAssessmentScore(
  questions: ScoredQuestion[],
  answers: Record<string, unknown>,
  subjectiveMarks: Record<string, SubjectiveMark | number | null | undefined>,
  categories: unknown[],
  passingScore?: number | null
): FinalAssessmentScore {
  const inAssessment = new Set((categories || []).map(c => String(c)));
  const given = answers && typeof answers === 'object' ? answers : {};
  const marks = subjectiveMarks && typeof subjectiveMarks === 'object' ? subjectiveMarks : {};

  let autoEarned = 0;
  let autoMax = 0;
  let manualEarned = 0;
  let manualMax = 0;
  const unmarked: string[] = [];

  for (const question of questions || []) {
    if (!question || !question.id) continue;
    if (!inAssessment.has(String(question.category_id))) continue;

    if (question.type === MULTIPLE_CHOICE) {
      const weight = Number(question.scoring_weight);
      const applied = Number.isFinite(weight) && weight > 0 ? weight : 1;
      autoMax += applied;
      const reply = given[question.id];
      if (reply !== undefined && answerMatches(question.correct_answer, reply)) {
        autoEarned += applied;
      }
      continue;
    }

    const max = Number(question.max_score);
    const applied = Number.isFinite(max) && max > 0 ? max : 10;
    manualMax += applied;

    const raw = marks[question.id];
    const awarded = typeof raw === 'number'
      ? raw
      : (raw && typeof raw === 'object' ? Number((raw as SubjectiveMark).score) : NaN);

    if (!Number.isFinite(awarded)) {
      unmarked.push(question.id);
      continue;
    }
    // A reviewer cannot award more than the question is worth, or less than
    // nothing. Clamping rather than refusing keeps a typo from failing the
    // whole save after someone has marked twenty answers.
    manualEarned += Math.max(0, Math.min(applied, awarded));
  }

  const totalMax = autoMax + manualMax;
  const score = totalMax === 0 ? 0 : Math.round(((autoEarned + manualEarned) / totalMax) * 100);
  const isFullyMarked = unmarked.length === 0;

  // Number(null) is 0, which is finite, so an assessment with no pass mark
  // set would have had a pass mark of zero and everybody would have passed.
  const hasPassMark = passingScore !== null && passingScore !== undefined && passingScore !== ('' as any);
  const pass = Number(passingScore);
  const passed = !isFullyMarked || !hasPassMark || !Number.isFinite(pass) ? null : score >= pass;

  return { score, autoEarned, autoMax, manualEarned, manualMax, unmarked, isFullyMarked, passed };
}
