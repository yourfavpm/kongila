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
