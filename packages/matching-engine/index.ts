import { TalentProfile, ServiceRequest, MatchBreakdown, Match } from '@kongila/shared-types';

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
  const behaviorFitScore = talent.vettingScores.behavioral;

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
  const weightedBehavior = behaviorFitScore * 0.20;
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
      behaviorFit: behaviorFitScore,
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

export function calculateCompositeVettingGrade(scores: VettingScoresInput): {
  score: number;
  grade: 'A+' | 'A' | 'B' | 'Reject';
} {
  const compositeScore = Math.round(
    (scores.technical * 0.25) +
    (scores.workSimulation * 0.20) +
    (scores.behavioral * 0.15) +
    (scores.communication * 0.15) +
    (scores.personality * 0.10) +
    (scores.remoteReadiness * 0.10) +
    (scores.experience * 0.05)
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
