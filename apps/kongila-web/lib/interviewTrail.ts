import {
  INTERVIEW_TRAIL,
  describeInterviewStage,
  interviewParty,
  interviewTrailPosition,
  normalizeInterviewStage
} from '@kongila/workflows';
import type { InterviewTrailStep } from '@kongila/ui';

/**
 * Turns an interview's stored status into something a person can read.
 *
 * The flow itself lives in @kongila/workflows and the drawing lives in
 * @kongila/ui. This is the join between them, so the client portal, the
 * candidate portal and the admin board can all show the same journey without
 * three copies of the labels drifting apart.
 *
 * `audience` only changes the wording, never the stage: "with the candidate"
 * is the same fact as "waiting on you" depending on who is reading it.
 */
export type TrailAudience = 'client' | 'talent' | 'admin';

const STEP_LABELS: Record<TrailAudience, string[]> = {
  client: ['Requested', 'Kongila review', 'With candidate', 'Scheduled'],
  talent: ['Client asked', 'Kongila review', 'Your answer', 'Scheduled'],
  admin: ['Client request', 'Your review', 'With candidate', 'Scheduled']
};

const WAITING_LABEL: Record<TrailAudience, Record<'client' | 'admin' | 'talent', string>> = {
  client: { client: 'Your move', admin: 'With Kongila', talent: 'With the candidate' },
  talent: { client: 'With the client', admin: 'With Kongila', talent: 'Your move' },
  admin: { client: 'With the client', admin: 'Your move', talent: 'With the candidate' }
};

export interface InterviewTrail {
  steps: InterviewTrailStep[];
  detail: string;
  waitingOn: string | null;
  stage: string;
  label: string;
  tone: 'pending' | 'active' | 'done' | 'dead';
}

export function interviewTrail(
  status: unknown,
  audience: TrailAudience = 'client',
  /**
   * The interview itself, when the caller has it. A vetting interview has no
   * client, so its stages are worded differently — without this it is read as
   * waiting on a client who is not in the conversation.
   */
  interview?: any
): InterviewTrail {
  const stage = normalizeInterviewStage(status as string);
  const party = interview ? interviewParty(interview) : 'client';
  const description = describeInterviewStage(stage, party);
  const position = interviewTrailPosition(stage);
  const dead = description.tone === 'dead';
  const waiting = description.waitingOn as 'client' | 'admin' | 'talent' | null;

  const steps: InterviewTrailStep[] = INTERVIEW_TRAIL.map((_, index) => ({
    label: STEP_LABELS[audience][index],
    state: dead && index >= position
      ? (index === position ? 'stopped' : 'upcoming')
      : index < position
        ? 'done'
        : index === position
          ? (stage === 'confirmed' || stage === 'completed' ? 'done' : 'current')
          : 'upcoming'
  }));

  return {
    steps,
    detail: description.detail,
    waitingOn: waiting ? WAITING_LABEL[audience][waiting] : null,
    stage,
    label: description.label,
    tone: description.tone
  };
}
