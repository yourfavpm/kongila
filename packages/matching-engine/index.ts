import { TalentProfile, ServiceRequest, MatchBreakdown, Match, VettingStage, VettingStageRecord, VettingDecision } from '@kongila/shared-types';

// ─── Vetting Stage Metadata ───────────────────────────────────────────────────
// Each stage defines WHAT ACTIVITY must be completed before it can be marked done.
// activityType drives the UI — admin sees a different panel for each.
// scoreKey is ONLY set when admin manually enters a score for that stage.
// Application Screening has NO score — admin just reviews profile and proceeds or rejects.

export type VettingActivityType =
  | 'profile_review'       // Stage 0: review profile, pass or reject
  | 'assign_assessment'    // Stage 1: assign assessment, wait for result, admin can override per-category score
  | 'schedule_interview'   // Stage 2: schedule interview, fill rubric scores, mark done
  | 'send_personality'     // Stage 3: send personality test link, wait for system result
  | 'remote_readiness'     // Stage 4: administer remote readiness check, enter result
  | 'assign_task'          // Stage 5: assign work simulation task, wait for submission
  | 'final_review';        // Stage 6: final compliance, references check

export const VETTING_STAGES: Array<{
  index: number;
  name: VettingStage;
  color: string;
  icon: string;
  responsible: string;
  activityType: VettingActivityType;
  description: string;
  scoreKey?: keyof TalentProfile['vettingScores'];
}> = [
  {
    index: 0, name: 'Application Screening', color: '#EF4444', icon: '🔴',
    responsible: 'Talent Manager', activityType: 'profile_review',
    description: "Review the candidate's profile — experience, skills, availability, salary, and documents — before proceeding to skill assessment.",
    // No scoreKey: Application Screening has no score
  },
  {
    index: 1, name: 'Skill Assessment', color: '#3B82F6', icon: '🔵',
    responsible: 'Skill Assessor', activityType: 'assign_assessment',
    description: "Assign a role-based skill assessment to the candidate. They will be notified by email. Results appear here once submitted. Admin can override per-category scores before marking as done.",
    scoreKey: 'technical',
  },
  {
    index: 2, name: 'Behavioural Interview', color: '#8B5CF6', icon: '🟣',
    responsible: 'Talent Manager', activityType: 'schedule_interview',
    description: "Schedule a live behavioural interview. Once completed, enter scores for each rubric below. The overall stage score is auto-calculated.",
    scoreKey: 'behavioral',
  },
  {
    index: 3, name: 'Personality Test', color: '#10B981', icon: '🟢',
    responsible: 'System (Auto)', activityType: 'send_personality',
    description: "Send the candidate a link to the personality assessment. The candidate will see it in their dashboard and receive an email. This stage auto-advances when results are received from the provider.",
    scoreKey: 'personality',
  },
  {
    index: 4, name: 'Remote Readiness', color: '#F59E0B', icon: '🟡',
    responsible: 'Ops Team', activityType: 'remote_readiness',
    description: "Guide the candidate through the Remote Readiness checklist: internet quality, hardware, power backup, communication tools, and workspace setup. Enter results below.",
    scoreKey: 'remoteReadiness',
  },
  {
    index: 5, name: 'Work Simulation', color: '#F97316', icon: '🔥',
    responsible: 'Team Lead', activityType: 'assign_task',
    description: "Assign a take-home work simulation task. The candidate submits their work before the deadline. Admin reviews submission and enters a score.",
    scoreKey: 'workSimulation',
  },
  {
    index: 6, name: 'Final Review', color: '#EAB308', icon: '⭐',
    responsible: 'Review Panel', activityType: 'final_review',
    description: "Conduct final reference checks, compliance review, and lock the candidate's composite vetting grade. This is the last step before the talent is marked Vetted.",
  },
];

/**
 * Creates a fresh 7-stage vetting pipeline for a new talent.
 * Stage 0 starts as 'in_progress'; the rest are 'pending'.
 */
export function buildDefaultVettingPipeline(): VettingStageRecord[] {
  return VETTING_STAGES.map((s, idx) => ({
    stageIndex: s.index,
    stageName: s.name,
    status: idx === 0 ? 'in_progress' as const : 'pending' as const,
    score: undefined,
    notes: '',
    assignee: s.responsible,
    decision: undefined,
    deadline: undefined,
    completedAt: undefined,
  }));
}

/**
 * Applies a stage decision and advances (or stops) the pipeline.
 * Returns an updated pipeline array.
 */
/**
 * True when a stage must produce a score before it can be passed.
 *
 * Stages 1 to 5 each feed one dimension of the composite grade. Stage 0
 * (Application Screening) and stage 6 (Final Review) are pass or fail and
 * carry no score.
 */
export function stageRequiresScore(stageIdx: number): boolean {
  return Boolean(VETTING_STAGES[stageIdx]?.scoreKey);
}

/**
 * Checks a stage decision before it is applied. Returns a reason the decision
 * cannot be made, or null when it can.
 *
 * Personality Test, Remote Readiness and Work Simulation could all be passed
 * with no score at all. Between them they are 40% of the composite grade, so
 * a candidate who passed every stage topped out at 60, which grades as
 * Reject. Nobody could be vetted.
 */
export function validateStageDecision(
  stageIdx: number,
  decision: VettingDecision,
  score: number | undefined,
  pipeline?: VettingStageRecord[]
): string | null {
  const stage = VETTING_STAGES[stageIdx];
  if (!stage) return `There is no vetting stage ${stageIdx}.`;
  if (decision !== 'Proceed') return null;

  // A rejected stage used to be walkable past: the next stage stayed pending,
  // the UI moved on to it, and an admin could push a rejected candidate all
  // the way to Final Review and Vetted. A failed stage behind you blocks every
  // stage in front of it until it is reopened for re-assessment.
  if (pipeline) {
    const failedBehind = pipeline
      .slice(0, stageIdx)
      .findIndex(s => s?.status === 'failed');
    if (failedBehind >= 0) {
      const failedName = VETTING_STAGES[failedBehind]?.name || `stage ${failedBehind + 1}`;
      return `${failedName} was rejected, so this candidate cannot be advanced past it. ` +
             `Reopen that stage for re-assessment first, or leave the rejection standing.`;
    }
  }

  if (!stageRequiresScore(stageIdx)) return null;

  if (score === undefined || score === null || !Number.isFinite(Number(score))) {
    return `${stage.name} needs a score out of 100 before it can be passed. It is ` +
           `part of the composite vetting grade, and passing it without one ` +
           `means the candidate cannot reach a deployable grade.`;
  }
  const numeric = Number(score);
  if (numeric < 0 || numeric > 100) {
    return `The score for ${stage.name} must be between 0 and 100.`;
  }
  return null;
}

export function advanceTalentStage(
  pipeline: VettingStageRecord[],
  stageIdx: number,
  decision: VettingDecision,
  score: number | undefined,
  notes: string
): VettingStageRecord[] {
  const problem = validateStageDecision(stageIdx, decision, score, pipeline);
  if (problem) throw new Error(problem);

  const updated = pipeline.map((s, idx) => {
    if (idx !== stageIdx) return s;
    return {
      ...s,
      status: decision === 'Proceed' ? 'passed' as const : decision === 'Reject' ? 'failed' as const : 'in_progress' as const,
      score: score !== undefined ? score : s.score,
      notes,
      decision,
      completedAt: decision === 'Proceed' || decision === 'Reject' ? new Date().toISOString() : s.completedAt,
    };
  });

  // If proceeding, mark next stage as in_progress ONLY if it's currently pending.
  // This preserves later stages if we are just re-assessing an earlier stage.
  if (decision === 'Proceed' && stageIdx < VETTING_STAGES.length - 1) {
    if (updated[stageIdx + 1].status === 'pending') {
      updated[stageIdx + 1] = { ...updated[stageIdx + 1], status: 'in_progress' };
    }
  }

  return updated;
}


/**
 * The single match-scoring implementation.
 *
 * There used to be two. This one, and a reimplementation inside the admin
 * matching screen that matched skills by substring, so "Java" matched
 * "JavaScript" and a Java developer scored 100% on a JavaScript role. The
 * admin version also overwrote this one's score when a shortlist was
 * submitted, so a client saw one match percentage at intake and a different
 * one afterwards. The admin screen now calls this.
 *
 * Weights: skill fit 40, behaviour 20, personality 15, engagement 15,
 * work readiness 10.
 *
 * Nothing here invents a number. A dimension that has not been scored
 * contributes zero rather than a flattering default.
 */
export interface MatchScoreResult {
  score: number;
  breakdown: MatchBreakdown;
  /** The required skills this candidate actually has, for the admin screen. */
  matchedSkills: string[];
  requiredSkillCount: number;
}

/** Skills can live under either name depending on where the profile came from. */
function talentSkillList(talent: any): string[] {
  const raw = talent?.skills || talent?.primarySkills || [];
  return Array.isArray(raw) ? raw.map((s: any) => String(s)) : [];
}

export function calculateMatchScore(
  talent: TalentProfile | any,
  request: ServiceRequest | any
): MatchScoreResult {
  const vs = talent?.vettingScores || {};
  const num = (v: any) => {
    const n = Number(v);
    return Number.isFinite(n) ? Math.min(100, Math.max(0, n)) : 0;
  };

  // ── 1. Skill fit (40%) ────────────────────────────────────────────────────
  // Exact match, case-insensitive. Deliberately not substring: substring
  // matching made "Java" satisfy a "JavaScript" requirement, and "C" satisfy
  // almost everything.
  const requiredSkills: string[] = Array.isArray(request?.requiredSkills) ? request.requiredSkills : [];
  const talentSkills = talentSkillList(talent).map(s => s.trim().toLowerCase());

  let matchedSkills: string[] = [];
  let skillFitScore: number;
  if (requiredSkills.length === 0) {
    // Nothing specified to match against, so fall back to the assessed
    // technical score rather than awarding a free 100.
    skillFitScore = num(vs.technical);
  } else {
    matchedSkills = requiredSkills.filter(rs =>
      talentSkills.includes(String(rs).trim().toLowerCase())
    );
    skillFitScore = Math.round((matchedSkills.length / requiredSkills.length) * 100);
  }

  // ── 2. Behaviour fit (20%) ────────────────────────────────────────────────
  const behaviourFitScore = num(vs.behavioral);

  // ── 3. Personality fit (15%) ──────────────────────────────────────────────
  const personalityFitScore = num(vs.personality);

  // ── 4. Engagement match (15%) ─────────────────────────────────────────────
  // Does the candidate want the kind of engagement the client is offering.
  // This used to read talent.availability, which holds hours per week, so a
  // candidate available 40 hours scored 40 out of 100.
  const preferred = String(talent?.preferredEngagementType || '').toLowerCase();
  const wanted = String(request?.commitmentLevel || '').toLowerCase();
  const availabilityScore = wanted && preferred
    ? (preferred.includes(wanted.split('-')[0].trim()) ? 100 : 70)
    : 70;

  // ── 5. Work readiness (10%) ───────────────────────────────────────────────
  // Work simulation and remote readiness. Replaces "past performance", which
  // undeployed candidates have none of.
  const pastPerformanceScore = Math.round(
    (num(vs.workSimulation) * 0.6) + (num(vs.remoteReadiness) * 0.4)
  );

  const totalScore = Math.round(
    (skillFitScore * 0.40) +
    (behaviourFitScore * 0.20) +
    (personalityFitScore * 0.15) +
    (availabilityScore * 0.15) +
    (pastPerformanceScore * 0.10)
  );

  return {
    score: Math.min(100, Math.max(0, totalScore)),
    breakdown: {
      skillFit: skillFitScore,
      behaviourFit: behaviourFitScore,
      personalityFit: personalityFitScore,
      availability: availabilityScore,
      pastPerformance: pastPerformanceScore
    },
    matchedSkills,
    requiredSkillCount: requiredSkills.length
  };
}

/**
 * Executes automatic matching for a single request against a collection of profiles.
 */
export function generateMatchesForRequest(
  request: ServiceRequest,
  talents: TalentProfile[]
): Match[] {
  // Only candidates who have finished vetting. 'Applied' and 'Review' were in
  // this list, which put candidates who had not been assessed, and candidates
  // who had been sent back for review, in front of clients.
  //
  // Grade B is the trainable pool. It is deliberately not matched
  // automatically: an operator can still put a B candidate forward from the
  // admin matching screen, with a recorded override reason.
  //
  // requiresReReview is set when a vetted candidate edits something material
  // about themselves. Nothing used to read it, so a candidate could change
  // their skills or rate and keep being matched on the old profile.
  const deployableTalents = talents.filter(
    t => !(t as any).requiresReReview &&
         (t.grade === 'A+' || t.grade === 'A') &&
         (t.vettingStatus === 'Vetted' || t.vettingStatus === 'Matched')
  );

  return deployableTalents.map(talent => {
    const { score, breakdown } = calculateMatchScore(talent, request);
    return {
      // Was `match_${request.id.split('_')[1]}_${talent.id.split('_')[1]}`.
      // Ids are UUIDs with no underscore, so both halves were undefined and
      // every candidate got the same id: the rows collided and the whole
      // batch upsert was rejected, so no match was ever saved. Using the ids
      // whole also makes this idempotent, so re-running matching updates the
      // existing rows instead of duplicating them.
      id: `match_${request.id}_${talent.id}`,
      requestId: request.id,
      talentId: talent.id,
      score,
      breakdown,
      status: 'Applied' as const
    };
  }).sort((a, b) => b.score - a.score);
}

/**
 * Rebuilds a request's matches against the current talent pool.
 *
 * Matches used to be generated once, at intake, and never touched again.
 * Editing the request, or a candidate's grade or vetting status changing
 * afterwards, left the old rows in place: a candidate rejected at vetting
 * stayed on a client's shortlist, and a request whose skills changed kept
 * being matched on the skills it no longer asked for.
 *
 * What this does:
 *   - rescores every match that is still eligible,
 *   - drops matches for candidates who are no longer eligible, unless the
 *     client has already acted on them,
 *   - adds matches for candidates who have become eligible since.
 *
 * A match the client has already engaged with is never removed. Taking a
 * candidate off a shortlist after an interview has been scheduled, or an
 * offer made, would lose the history of what happened.
 */
const CLIENT_ENGAGED_STATUSES = [
  'shortlisted', 'interview requested', 'interview_requested',
  'interview scheduled', 'interview_scheduled', 'interviewed',
  'offer extended', 'offer_extended', 'offer accepted', 'accepted',
  'rejected', 'rejected_by_client', 'declined'
];

export function reconcileMatchesForRequest(
  request: ServiceRequest | any,
  talents: TalentProfile[] | any[],
  existingMatches: Match[] | any[]
): { matches: Match[]; added: number; removed: number; rescored: number } {
  const requestId = String(request?.id);
  const mine = (existingMatches || []).filter((m: any) => String(m.requestId) === requestId);
  const others = (existingMatches || []).filter((m: any) => String(m.requestId) !== requestId);

  const fresh = generateMatchesForRequest(request, talents as TalentProfile[]);
  const freshById = new Map(fresh.map(m => [String(m.talentId), m]));

  const kept: Match[] = [];
  let removed = 0;
  let rescored = 0;

  for (const match of mine as any[]) {
    const stillEligible = freshById.get(String(match.talentId));
    const engaged = CLIENT_ENGAGED_STATUSES.includes(String(match.status || '').toLowerCase());

    if (stillEligible) {
      if (match.score !== stillEligible.score) rescored++;
      kept.push({ ...match, score: stillEligible.score, breakdown: stillEligible.breakdown });
      freshById.delete(String(match.talentId));
    } else if (engaged) {
      // Keep the row and the history, but say why it is no longer offered.
      kept.push({ ...match, noLongerEligible: true } as any);
    } else {
      removed++;
    }
  }

  const added = Array.from(freshById.values());
  const matches = [...others, ...kept, ...added].sort((a: any, b: any) => (b.score || 0) - (a.score || 0));

  return { matches, added: added.length, removed, rescored };
}

// ─── Composite vetting grade ─────────────────────────────────────────────────
//
// The weights, the grade thresholds and the open scope question about
// communication and experience all live in ./grading.ts, which imports
// nothing so it can be tested on its own (`pnpm test`). Re-exported here so
// every existing import of '@kongila/matching-engine' keeps working.

export type {
  VettingScoresInput,
  VettingGrade,
  WeightedDimension
} from './grading';

export {
  COMPOSITE_WEIGHTS,
  DROPPED_DIMENSIONS,
  UNMEASURED_DIMENSIONS,
  GRADE_THRESHOLDS,
  gradeForScore,
  calculateCompositeVettingGrade
} from './grading';
