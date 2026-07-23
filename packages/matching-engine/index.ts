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
export function advanceTalentStage(
  pipeline: VettingStageRecord[],
  stageIdx: number,
  decision: VettingDecision,
  score: number | undefined,
  notes: string
): VettingStageRecord[] {
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
 * Calculates a matching score between a talent profile and a service request.
 * 
 * Weights:
 * - Skill Fit: 40%
 * - Behaviour Fit: 20%
 * - Personality Fit: 15%
 * - Availability: 15%
 * - Past Performance (experience score): 10%
 */
export function calculateMatchScore(talent: TalentProfile, request: ServiceRequest): {
  score: number;
  breakdown: MatchBreakdown;
} {
  // 1. Skill Fit (40%)
  // Calculate overlap between required skills and talent skills.
  let skillFitScore = 0;
  if (!request.requiredSkills || request.requiredSkills.length === 0) {
    // If no skills are requested, use talent's default technical vetting score.
    skillFitScore = talent.vettingScores.technical;
  } else {
    const matchingSkills = request.requiredSkills.filter(skill =>
      talent.skills.map(s => s.toLowerCase()).includes(skill.toLowerCase())
    );
    skillFitScore = Math.round((matchingSkills.length / request.requiredSkills.length) * 100);
  }

  // 2. Behaviour Fit (20%)
  const behaviourFitScore = talent.vettingScores.behavioral;

  // 3. Personality Fit (15%)
  const personalityFitScore = talent.vettingScores.personality;

  // 4. Availability (15%)
  const availabilityScore = talent.availability; // e.g. 100 for full availability

  // 5. Past Performance (10%)
  // Uses a combination of work simulation score (70%) and experience rating (30%)
  const pastPerformanceScore = Math.round(
    (talent.vettingScores.workSimulation * 0.7) + (talent.vettingScores.experience * 0.3)
  );

  // Apply weights
  const weightedSkill = skillFitScore * 0.40;
  const weightedBehavior = behaviourFitScore * 0.20;
  const weightedPersonality = personalityFitScore * 0.15;
  const weightedAvailability = availabilityScore * 0.15;
  const weightedPerformance = pastPerformanceScore * 0.10;

  const totalScore = Math.round(
    weightedSkill + weightedBehavior + weightedPersonality + weightedAvailability + weightedPerformance
  );

  return {
    score: Math.min(100, Math.max(0, totalScore)),
    breakdown: {
      skillFit: skillFitScore,
      behaviourFit: behaviourFitScore,
      personalityFit: personalityFitScore,
      availability: availabilityScore,
      pastPerformance: pastPerformanceScore
    }
  };
}

/**
 * Executes automatic matching for a single request against a collection of profiles.
 */
export function generateMatchesForRequest(
  request: ServiceRequest,
  talents: TalentProfile[]
): Match[] {
  // Only match candidates who are Vetted or Matched (deployable grades: A+, A, B)
  const deployableTalents = talents.filter(
    t => t.grade !== 'Reject' && (t.vettingStatus === 'Vetted' || t.vettingStatus === 'Matched' || t.vettingStatus === 'Applied' || t.vettingStatus === 'Review')
  );

  return deployableTalents.map(talent => {
    const { score, breakdown } = calculateMatchScore(talent, request);
    return {
      id: `match_${request.id.split('_')[1]}_${talent.id.split('_')[1]}`,
      requestId: request.id,
      talentId: talent.id,
      score,
      breakdown,
      status: 'Applied' as const
    };
  }).sort((a, b) => b.score - a.score);
}

export interface VettingScoresInput {
  technical: number;
  workSimulation: number;
  behavioral: number;
  communication: number;
  personality: number;
  remoteReadiness: number;
  experience: number;
}

export function calculateCompositeVettingGrade(scores: Partial<VettingScoresInput>): {
  score: number;
  grade: 'A+' | 'A' | 'B' | 'Reject';
} {
  const compositeScore = Math.round(
    ((scores?.technical || 0) * 0.30) +
    ((scores?.behavioral || 0) * 0.30) +
    ((scores?.workSimulation || 0) * 0.20) +
    ((scores?.personality || 0) * 0.10) +
    ((scores?.remoteReadiness || 0) * 0.10)
  );

  let grade: 'A+' | 'A' | 'B' | 'Reject' = 'Reject';
  if (compositeScore >= 85) grade = 'A+';
  else if (compositeScore >= 75) grade = 'A';
  else if (compositeScore >= 65) grade = 'B';

  return {
    score: compositeScore,
    grade
  };
}
