/**
 * Interviews: one source of truth, and the rules around it.
 *
 * There were three places an interview's time lived:
 *
 *   1. the `interviews` row,
 *   2. `interviewDate` / `interviewTime` copied onto the vetting pipeline
 *      stage record,
 *   3. `requestedDate` / `requestedTime` copied onto the match.
 *
 * Nothing kept them in step. The talent dashboard built its upcoming list
 * from the pipeline with synthetic ids, so an interview could exist on one
 * and not the other; rescheduling moved one copy and left the rest; and the
 * three screens showed three different times for the same call.
 *
 * The rule from here: **the `interviews` row is the interview.** The stage
 * record and the match hold an id and nothing else. The copied fields stay
 * readable so rows written before this still render, but `resolveInterview`
 * always prefers the real row, and anything written now writes the pointer.
 *
 * This file imports nothing, so it can be tested on its own with node --test.
 */

/**
 * The instant an interview starts, or null.
 *
 * Deliberately narrower than the resolver in @kongila/utils: it reads only
 * the stored timestamp, never the naive wall-clock columns. A row with no
 * timestamp has no knowable instant, and guessing one from zoneless text is
 * exactly how interviews ended up six hours out. Such a row is skipped by the
 * conflict check rather than compared against a fabricated time.
 */
function instantOf(interview: any): string | null {
  const raw = interview?.scheduledTime
    || interview?.scheduled_time
    || interview?.confirmedSlot
    || interview?.confirmed_slot;
  if (!raw) return null;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

export interface InterviewRef {
  interviewId?: string | null;
  /** Legacy copies. Read as a last resort; never written by new code. */
  interviewDate?: string | null;
  interviewTime?: string | null;
  interviewScheduledTime?: string | null;
  interviewTimezone?: string | null;
  meetingLink?: string | null;
}

/** Statuses that mean the interview is off and should not block a slot. */
const DEAD_STATUSES = ['cancelled', 'canceled', 'declined', 'admin_declined', 'talent_declined', 'expired'];

export function isLiveInterview(interview: any): boolean {
  return !DEAD_STATUSES.includes(String(interview?.status || '').toLowerCase());
}

/**
 * The interview a pointer refers to.
 *
 * Returns the real row when the id resolves. When it does not — a stage
 * written before interviews were rows, or a row since deleted — it returns a
 * read-only shim built from the copied fields, marked `fromLegacyCopy` so a
 * caller can tell the difference between a fact and a leftover.
 */
export function resolveInterview(
  ref: InterviewRef | null | undefined,
  interviews: any[]
): any | null {
  if (!ref) return null;

  if (ref.interviewId) {
    const row = (interviews || []).find((iv: any) => String(iv.id) === String(ref.interviewId));
    if (row) return row;
  }

  if (!ref.interviewDate && !ref.interviewScheduledTime) return null;

  return {
    id: ref.interviewId || null,
    date: ref.interviewDate,
    time: ref.interviewTime,
    scheduledTime: ref.interviewScheduledTime,
    scheduledTimezone: ref.interviewTimezone,
    meetingLink: ref.meetingLink,
    status: 'Scheduled',
    fromLegacyCopy: true
  };
}

/** Every interview belonging to a vetting pipeline, newest stage first. */
export function interviewsForPipeline(pipeline: any[], interviews: any[]): any[] {
  return (pipeline || [])
    .map(stage => resolveInterview(stage, interviews))
    .filter(Boolean);
}

/**
 * The interview a match refers to.
 *
 * `requestedDate` and `requestedTime` on the match are a third copy of the
 * same thing. They are read here only when no interview row can be found.
 */
export function interviewForMatch(match: any, interviews: any[]): any | null {
  if (!match) return null;

  const byId = (interviews || []).find((iv: any) => String(iv.matchId) === String(match.id));
  if (byId) return byId;

  const byPair = (interviews || []).find((iv: any) =>
    String(iv.talentId) === String(match.talentId) &&
    String(iv.requestId) === String(match.requestId) &&
    isLiveInterview(iv)
  );
  if (byPair) return byPair;

  if (!match.requestedDate) return null;
  return {
    id: null,
    talentId: match.talentId,
    requestId: match.requestId,
    date: match.requestedDate,
    time: match.requestedTime,
    status: 'Proposed',
    fromLegacyCopy: true
  };
}

// ─── Double booking ──────────────────────────────────────────────────────────

export interface ConflictCheck {
  /** The instant being proposed. */
  startsAt: string;
  durationMinutes?: number;
  talentId?: string | null;
  clientId?: string | null;
  /** The interview being moved, so it does not clash with itself. */
  excludeInterviewId?: string | null;
}

export interface Conflict {
  interview: any;
  /** 'talent' or 'client' — whose diary the clash is in. */
  party: 'talent' | 'client';
  startsAt: string;
}

const DEFAULT_DURATION_MINUTES = 60;

/**
 * Finds an existing interview that overlaps a proposed slot.
 *
 * There was no check of any kind: the same candidate could be booked into two
 * interviews at the same moment by two different clients, and nothing noticed
 * until someone failed to turn up.
 *
 * Overlap, not equality — a 60 minute call at 15:00 clashes with one at 15:30.
 */
export function findSchedulingConflicts(
  check: ConflictCheck,
  interviews: any[]
): Conflict[] {
  const start = new Date(check.startsAt).getTime();
  if (Number.isNaN(start)) return [];
  const end = start + (check.durationMinutes ?? DEFAULT_DURATION_MINUTES) * 60_000;

  const conflicts: Conflict[] = [];

  for (const other of interviews || []) {
    if (!other) continue;
    if (check.excludeInterviewId && String(other.id) === String(check.excludeInterviewId)) continue;
    if (!isLiveInterview(other)) continue;

    const otherIso = instantOf(other);
    if (!otherIso) continue;

    const otherStart = new Date(otherIso).getTime();
    const otherEnd = otherStart + (Number(other.durationMinutes || other.duration_minutes) || DEFAULT_DURATION_MINUTES) * 60_000;

    const overlaps = start < otherEnd && otherStart < end;
    if (!overlaps) continue;

    if (check.talentId && String(other.talentId) === String(check.talentId)) {
      conflicts.push({ interview: other, party: 'talent', startsAt: otherIso });
      continue;
    }
    if (check.clientId && String(other.clientId) === String(check.clientId)) {
      conflicts.push({ interview: other, party: 'client', startsAt: otherIso });
    }
  }

  return conflicts;
}

/** A sentence to put in front of whoever is scheduling, or null when clear. */
export function describeConflict(conflicts: Conflict[]): string | null {
  if (!conflicts || conflicts.length === 0) return null;
  const first = conflicts[0];
  const who = first.party === 'talent'
    ? (first.interview.talentName || 'That candidate')
    : (first.interview.clientName || 'That client');
  return `${who} already has an interview that overlaps this slot: ` +
         `"${first.interview.title || 'Untitled interview'}". Pick another time, or cancel the existing one first.`;
}

// ─── Status ──────────────────────────────────────────────────────────────────

/**
 * interviews_status_check accepts 18 values, including both 'Cancelled' and
 * 'cancelled'. The writer used to collapse 'Rescheduled', 'Scheduled' and
 * 'Reschedule Requested' all to 'scheduled', and the reader only restored
 * 'Scheduled', so a rescheduled interview reverted to Scheduled on every save
 * and the admin's Rescheduled counter read zero after any reload.
 *
 * Both of those statuses are legal in the database, so neither needs
 * collapsing. 'Reschedule Requested' is the one that genuinely is not a
 * status: it is the reschedule_requested flag, and the reader derives it.
 */
const DB_INTERVIEW_STATUSES = new Set([
  'client_requested', 'admin_reviewing', 'sent_to_talent', 'talent_accepted',
  'talent_countered', 'talent_declined', 'confirmed', 'expired',
  'admin_declined', 'cancelled', 'Completed', 'Scheduled', 'Rescheduled',
  'Cancelled', 'Proposed', 'Reschedule Requested', 'scheduled',
  'pending_confirmation'
]);

export function mapInterviewStatusToDb(status?: string | null): string {
  const value = String(status || '').trim();

  // Not a status. It is reschedule_requested = true on top of whatever the
  // interview already was, and the reader puts the label back.
  if (value === 'Reschedule Requested') return 'Scheduled';

  if (DB_INTERVIEW_STATUSES.has(value)) return value;

  const lower = value.toLowerCase();
  if (DB_INTERVIEW_STATUSES.has(lower)) return lower;

  console.warn(`[interviews] unknown status "${status}", storing as Scheduled.`);
  return 'Scheduled';
}

export function mapInterviewStatusFromDb(row: any): string {
  if (row?.reschedule_requested || row?.rescheduleRequested) return 'Reschedule Requested';
  const value = String(row?.status || '').trim();
  if (value === 'scheduled') return 'Scheduled';
  return value || 'Proposed';
}

const UPCOMING_INTERVIEW_STATUSES = new Set([
  'proposed',
  'client_requested',
  'admin_reviewing',
  'sent_to_talent',
  'pending_confirmation',
  'talent_accepted',
  'talent_countered',
  'confirmed',
  'interview scheduled',
  'scheduled',
  'rescheduled'
]);

const PAST_INTERVIEW_STATUSES = new Set([
  'completed',
  'cancelled',
  'canceled',
  'failed',
  'passed',
  'talent_declined',
  'admin_declined',
  'declined',
  'expired'
]);

export function isUpcomingInterviewStatus(status?: string | null): boolean {
  return UPCOMING_INTERVIEW_STATUSES.has(String(status || '').trim().toLowerCase());
}

export function isPastInterviewStatus(status?: string | null): boolean {
  return PAST_INTERVIEW_STATUSES.has(String(status || '').trim().toLowerCase());
}

// ─── The stage an interview is at ────────────────────────────────────────────
//
// An interview with a matched candidate is not a booking the client makes. It
// is a request that travels: the client asks, operations reviews it and puts
// it to the candidate, the candidate accepts, counters or declines, and a
// counter goes back to the client to accept. Only when both sides have agreed
// the same instant is it an interview.
//
// None of that was modelled. A client's request was written straight to the
// candidate as 'Proposed', operations was told about it but had no part in it,
// a candidate's acceptance left the row at 'talent_accepted' for ever — there
// was no step that made an interview confirmed — and a candidate who wanted a
// different time raised a reschedule that only operations could answer, so the
// client whose call it was never saw the time they were being moved to.
//
// The eighteen statuses the database accepts already contain the right words.
// What was missing was the order they go in, and that is what this is. It
// imports nothing, so the whole flow can be tested with node --test.

export type InterviewStage =
  /** The client has asked. Nobody outside Kongila has seen it yet. */
  | 'client_requested'
  /** Operations has it open. */
  | 'admin_reviewing'
  /** Put to the candidate, waiting on them. */
  | 'sent_to_talent'
  /** The candidate wants a different time; the client has to agree to it. */
  | 'talent_countered'
  /** Both sides have agreed the same instant. This is the only "it's on". */
  | 'confirmed'
  | 'talent_declined'
  | 'admin_declined'
  | 'cancelled'
  | 'completed'
  | 'expired';

/**
 * Who an interview is actually between.
 *
 * Two different things share this table. A **client** interview is a client
 * meeting a candidate they were matched with: it hangs off a role request,
 * and the client is the one who decides about times. A **vetting** interview
 * is Kongila assessing a candidate — the behavioural interview in the vetting
 * pipeline — and there is no client in it at all.
 *
 * `interviews.client_id` is NOT NULL, so a vetting interview has to name
 * somebody, and the operator who scheduled it stands in. That is sound for
 * the diary and the foreign key, and it is why everything that asked "does
 * this interview have a client?" got the wrong answer: a candidate asking to
 * move a behavioural interview was treated as proposing a new time to a
 * client who does not exist. It was labelled as waiting on that client, and
 * operations could not approve it, because the code had already decided the
 * client had to answer first.
 *
 * The honest discriminator is the role request. A client interview always has
 * one; a vetting interview never does.
 */
export type InterviewParty = 'client' | 'vetting';

export function interviewParty(interview: any): InterviewParty {
  if (!interview) return 'client';
  const requestId = interview.requestId ?? interview.request_id;
  const matchId = interview.matchId ?? interview.match_id;
  if (requestId || matchId) return 'client';
  return 'vetting';
}

/** True when there is a real client who gets a say in the timing. */
export function hasClientCounterparty(interview: any): boolean {
  return interviewParty(interview) === 'client';
}

export type InterviewEvent =
  | 'client_requests'
  | 'admin_opens'
  | 'admin_sends_to_talent'
  | 'admin_declines'
  | 'talent_accepts'
  | 'talent_counters'
  | 'talent_declines'
  | 'client_accepts_counter'
  | 'client_declines_counter'
  | 'admin_approves_reschedule'
  | 'admin_rejects_reschedule'
  | 'cancel'
  | 'complete';

/**
 * Statuses written before the flow above existed, and what they meant.
 *
 * 'Proposed' and 'pending_confirmation' were written when a client's request
 * went straight to the candidate, so the candidate is who it is waiting on.
 * 'Scheduled' and 'Rescheduled' were written as though agreement had happened,
 * so they read as confirmed — those interviews are real and in diaries, and
 * re-opening them would be worse than honouring them.
 */
const LEGACY_STAGES: Record<string, InterviewStage> = {
  proposed: 'sent_to_talent',
  pending_confirmation: 'sent_to_talent',
  scheduled: 'confirmed',
  rescheduled: 'confirmed',
  confirmed: 'confirmed',
  talent_accepted: 'confirmed',
  'reschedule requested': 'talent_countered',
  canceled: 'cancelled',
  declined: 'talent_declined',
  failed: 'completed',
  passed: 'completed'
};

const KNOWN_STAGES = new Set<InterviewStage>([
  'client_requested', 'admin_reviewing', 'sent_to_talent', 'talent_countered',
  'confirmed', 'talent_declined', 'admin_declined', 'cancelled', 'completed', 'expired'
]);

/** The stage a stored status means, whichever vocabulary wrote it. */
export function normalizeInterviewStage(status?: string | null): InterviewStage {
  const raw = String(status || '').trim().toLowerCase().replace(/[-\s]+/g, '_');
  if (KNOWN_STAGES.has(raw as InterviewStage)) return raw as InterviewStage;
  const spaced = String(status || '').trim().toLowerCase();
  return LEGACY_STAGES[raw] || LEGACY_STAGES[spaced] || 'client_requested';
}

/** The exact string to store. interviews_status_check is picky about case. */
export function interviewStageToDb(stage: InterviewStage): string {
  return stage === 'completed' ? 'Completed' : stage;
}

const TRANSITIONS: Record<InterviewEvent, { from: InterviewStage[]; to: InterviewStage }> = {
  client_requests: { from: [], to: 'client_requested' },
  admin_opens: { from: ['client_requested'], to: 'admin_reviewing' },
  // From talent_countered too: the client turned the candidate's time down,
  // operations picked a third one and is putting that to the candidate.
  admin_sends_to_talent: {
    from: ['client_requested', 'admin_reviewing', 'talent_countered'],
    to: 'sent_to_talent'
  },
  admin_declines: { from: ['client_requested', 'admin_reviewing'], to: 'admin_declined' },
  // The candidate accepting the slot operations sent is the agreement. There
  // is no further confirmation step: operations already approved the time
  // before it went out, so adding one would only leave a window in which
  // nobody could say whether the interview was on.
  talent_accepts: { from: ['sent_to_talent'], to: 'confirmed' },
  talent_counters: { from: ['sent_to_talent'], to: 'talent_countered' },
  talent_declines: { from: ['sent_to_talent'], to: 'talent_declined' },
  // The client agreeing to the candidate's time is the same agreement from
  // the other side, so it confirms. Operations is told, but is not a gate.
  client_accepts_counter: { from: ['talent_countered'], to: 'confirmed' },
  client_declines_counter: { from: ['talent_countered'], to: 'admin_reviewing' },
  // A confirmed interview that is moved is not confirmed any more: the new
  // time is one the candidate has not agreed to, so it goes back to them.
  //
  // 'talent_countered' is deliberately not a legal starting point for either
  // of these. At that stage the time on the table came from the candidate and
  // is sitting with the client, and operations approving or refusing it would
  // be deciding on the client's behalf about the client's own interview. The
  // client answers; operations can cancel if nobody does.
  admin_approves_reschedule: { from: ['confirmed', 'sent_to_talent'], to: 'sent_to_talent' },
  admin_rejects_reschedule: { from: ['confirmed'], to: 'confirmed' },
  cancel: {
    from: ['client_requested', 'admin_reviewing', 'sent_to_talent', 'talent_countered', 'confirmed'],
    to: 'cancelled'
  },
  complete: { from: ['confirmed'], to: 'completed' }
};

/** The stage this event moves an interview to, or null when it is not legal. */
export function interviewTransition(
  current: string | null | undefined,
  event: InterviewEvent
): InterviewStage | null {
  const rule = TRANSITIONS[event];
  if (!rule) return null;
  if (event === 'client_requests') return rule.to;
  return rule.from.includes(normalizeInterviewStage(current)) ? rule.to : null;
}

/** Why an event was refused, in words the person who tried it can act on. */
export function explainInterviewTransition(
  current: string | null | undefined,
  event: InterviewEvent
): string | null {
  if (interviewTransition(current, event)) return null;
  const stage = normalizeInterviewStage(current);
  return `This interview is ${describeInterviewStage(stage).label.toLowerCase()}, `
    + 'so that is not something it can do from here.';
}

export interface InterviewStageDescription {
  label: string;
  /** Whose move it is now, or null when nobody's. */
  waitingOn: 'client' | 'admin' | 'talent' | null;
  /** One line for whoever is reading the screen. */
  detail: string;
  tone: 'pending' | 'active' | 'done' | 'dead';
}

const STAGE_DESCRIPTIONS: Record<InterviewStage, InterviewStageDescription> = {
  client_requested: {
    label: 'Request sent',
    waitingOn: 'admin',
    detail: 'Your Kongila team is reviewing the times you proposed.',
    tone: 'pending'
  },
  admin_reviewing: {
    label: 'With your Kongila team',
    waitingOn: 'admin',
    detail: 'Your account manager is lining this up with the candidate.',
    tone: 'active'
  },
  sent_to_talent: {
    label: 'With the candidate',
    waitingOn: 'talent',
    detail: 'The candidate has been asked to confirm the time.',
    tone: 'active'
  },
  talent_countered: {
    label: 'New time proposed',
    waitingOn: 'client',
    detail: 'The candidate has proposed a different time. Accept it, or tell us and we will find another.',
    tone: 'active'
  },
  confirmed: {
    label: 'Scheduled',
    waitingOn: null,
    detail: 'Both sides have confirmed. The joining details are below.',
    tone: 'done'
  },
  talent_declined: {
    label: 'Declined by candidate',
    waitingOn: 'admin',
    detail: 'The candidate turned this interview down. Your Kongila team will follow up.',
    tone: 'dead'
  },
  admin_declined: {
    label: 'Not proceeding',
    waitingOn: null,
    detail: 'Your Kongila team did not take this request forward.',
    tone: 'dead'
  },
  cancelled: { label: 'Cancelled', waitingOn: null, detail: 'This interview was cancelled.', tone: 'dead' },
  completed: { label: 'Completed', waitingOn: null, detail: 'This interview has taken place.', tone: 'done' },
  expired: { label: 'Expired', waitingOn: null, detail: 'Nobody answered in time and the slot lapsed.', tone: 'dead' }
};

/**
 * Vetting has no client, so the three stages that name one are reworded
 * rather than left saying an interview is waiting on somebody who is not in
 * it. Everything else reads the same either way.
 */
const VETTING_OVERRIDES: Partial<Record<InterviewStage, InterviewStageDescription>> = {
  client_requested: {
    label: 'Being arranged',
    waitingOn: 'admin',
    detail: 'Your Kongila team is arranging this interview.',
    tone: 'pending'
  },
  talent_countered: {
    label: 'New time proposed',
    waitingOn: 'admin',
    detail: 'You proposed a different time. Your Kongila team will confirm it or suggest another.',
    tone: 'active'
  },
  talent_declined: {
    label: 'Declined',
    waitingOn: 'admin',
    detail: 'This interview was turned down. Your Kongila team will be in touch.',
    tone: 'dead'
  }
};

export function describeInterviewStage(
  stage: InterviewStage | string,
  party: InterviewParty = 'client'
): InterviewStageDescription {
  const normalized = normalizeInterviewStage(String(stage));
  if (party === 'vetting' && VETTING_OVERRIDES[normalized]) {
    return VETTING_OVERRIDES[normalized] as InterviewStageDescription;
  }
  return STAGE_DESCRIPTIONS[normalized];
}

/** The happy path, for the progress trail on every portal. */
export const INTERVIEW_TRAIL: InterviewStage[] = [
  'client_requested',
  'admin_reviewing',
  'sent_to_talent',
  'confirmed'
];

/**
 * How far along the trail a stage sits.
 *
 * A counter is not a step backwards for the reader — the request is still
 * with the candidate's answer — so it sits at the same point as sent_to_talent
 * rather than rewinding the trail and making it look like progress was lost.
 */
export function interviewTrailPosition(stage: InterviewStage | string): number {
  const normalized = normalizeInterviewStage(String(stage));
  if (normalized === 'talent_countered') return INTERVIEW_TRAIL.indexOf('sent_to_talent');
  if (normalized === 'completed') return INTERVIEW_TRAIL.length - 1;
  const index = INTERVIEW_TRAIL.indexOf(normalized);
  return index >= 0 ? index : 0;
}

/** True once both sides have agreed, which is the only time it is a booking. */
export function isConfirmedInterview(status?: string | null): boolean {
  const stage = normalizeInterviewStage(status);
  return stage === 'confirmed' || stage === 'completed';
}

/** True while somebody still owes an answer. */
export function isOpenInterview(status?: string | null): boolean {
  const stage = normalizeInterviewStage(status);
  return stage === 'client_requested' || stage === 'admin_reviewing'
    || stage === 'sent_to_talent' || stage === 'talent_countered';
}
