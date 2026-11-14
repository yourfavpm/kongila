import { PERSONALITY_QUESTIONS } from './personalityQuestions';

export type PersonalityAnswers = Record<string, number>;

const TRAITS = {
  extraversion: { positive: [1, 11, 21, 31, 41], reverse: [6, 16, 26, 36, 46] },
  agreeableness: { positive: [7, 17, 27, 37, 42, 47], reverse: [2, 12, 22, 32] },
  conscientiousness: { positive: [3, 13, 23, 33, 43, 48], reverse: [8, 18, 28, 38] },
  emotionalSensitivity: { positive: [4, 14, 24, 29, 34, 39, 44, 49], reverse: [9, 19] },
  openness: { positive: [5, 15, 25, 35, 40, 45, 50], reverse: [10, 20, 30] }
} as const;

/** Server-side IPIP-50 scoring. Raw responses are not persisted. */
export function scorePersonalityAnswers(input: unknown) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Answer all items before submitting.');
  const answers = input as PersonalityAnswers;
  const ids = Object.keys(answers);
  if (ids.length !== PERSONALITY_QUESTIONS.length || PERSONALITY_QUESTIONS.some((_, i) => !(String(i + 1) in answers))) {
    throw new Error('Answer all 50 items before submitting.');
  }
  for (const id of ids) {
    if (!/^([1-9]|[1-4][0-9]|50)$/.test(id) || !Number.isInteger(answers[id]) || answers[id] < 1 || answers[id] > 5) {
      throw new Error('One or more answers are invalid. Please review the assessment.');
    }
  }

  const scored = Object.fromEntries(Object.entries(TRAITS).map(([key, items]) => {
    let raw = 0;
    for (const id of items.positive) raw += answers[String(id)];
    for (const id of items.reverse) raw += 6 - answers[String(id)];
    const itemCount = items.positive.length + items.reverse.length;
    const minimum = itemCount * 1;
    const maximum = itemCount * 5;
    const score = Math.round(((raw - minimum) / (maximum - minimum)) * 100);
    return [key, { score, rawScore: raw }];
  }));

  return {
    instrument: 'IPIP-50',
    version: 1,
    scores: scored,
    completedAt: new Date().toISOString()
  };
}
