/**
 * Interviews, server side.
 *
 * Every create or change to an interview goes through here, from both
 * portals. Before this, five browser call sites wrote to the interviews
 * table directly with the anon key — two in the client dashboard, one in the
 * scheduling modal, two in the interviews panel — so the conflict check, the
 * invitation email and the audit entry all lived in an admin API route that
 * nothing ever posted to. Two clients could book the same candidate for the
 * same hour and nothing noticed.
 *
 * Each function does the same five things in the same order:
 *
 *   1. establish who is asking and whether this interview is theirs,
 *   2. refuse anything that would double-book either party,
 *   3. write, in one place, with the instant and both timezones,
 *   4. tell both sides, each in their own zone, with a real .ics,
 *   5. write what happened to the audit log, and nothing that did not.
 *
 * It never throws for an expected refusal. Callers get `{ ok: false, status,
 * error }` and turn that into an HTTP response.
 */

import { getSupabaseClient } from './index';
import type { RequestActor as Actor } from './scope';
import { recordAudit } from './audit';
import {
  notifyUsers,
  notifyAdmins,
  resolveNotificationRecipients,
  clientPortalUrl,
  talentPortalUrl,
  adminPortalUrl
} from './notify';
import {
  findSchedulingConflicts,
  describeConflict,
  mapInterviewStatusToDb,
  matchingProgressStatus,
  normalizeRequestStatus,
  normalizeInterviewStage,
  interviewParty,
  interviewTransition,
  interviewStageToDb,
  explainInterviewTransition,
  type InterviewEvent as InterviewFlowEvent
} from '@kongila/workflows';
import { interviewInstant, formatInstantInZone, wallClockToUtc } from '@kongila/utils';
import {
  sendInterviewInvitation,
  sendEmail,
  emailIsConfigured,
  buildNotification,
  type NotificationEvent
} from '@kongila/notifications';

export interface ServiceResult<T = any> {
  ok: boolean;
  status: number;
  error?: string;
  data?: T;
  /** Things that went wrong but did not stop the action, such as an unsent email. */
  warnings?: string[];
}

const DEFAULT_DURATION_MINUTES = 60;
const INTERVIEW_TYPES = new Set(['video', 'phone', 'async_video']);

/** interviews_admin_outcome_check accepts exactly these three. */
const ADMIN_OUTCOMES = new Set(['Proceed to Hire', 'No Fit', 'Hold']);

/** A client may schedule at most this many interviews per candidate, per request. */
const MAX_INTERVIEWS_PER_PAIR = 3;

/** How close to the start a client may still move an interview themselves. */
const LATE_CHANGE_HOURS = 4;

function fail(status: number, error: string): ServiceResult {
  return { ok: false, status, error };
}

/**
 * A joining link for an interview that has just been agreed.
 *
 * `google_calendar_link` and `google_calendar_event_id` have been sitting on
 * the interviews table unused since it was created, waiting for a Calendar
 * integration that needs a Google Cloud project, OAuth consent and a service
 * account on the Workspace domain. Until that exists, every interview was
 * confirmed with no way to join it and a line promising that details would
 * follow — which somebody then had to remember to do by hand.
 *
 * A Jitsi room needs none of that. It is a real, working video room the
 * moment the URL exists, with no account on either side, so an interview is
 * never confirmed without somewhere to hold it. The room name is derived
 * from the interview id, so the same interview always resolves to the same
 * room however many times this runs, and it carries no readable detail about
 * who is meeting or what for.
 *
 * An operator pasting their own Meet or Zoom link always wins: this only
 * fills the gap when nobody has.
 */
const MEETING_ROOM_HOST = process.env.MEETING_ROOM_HOST?.trim() || 'https://meet.jit.si';

export function generateMeetingLink(interviewId: string): string | null {
  const id = String(interviewId || '').trim();
  if (!id) return null;
  // Lowercase alphanumerics only: Jitsi treats the room as a URL path, and a
  // name with punctuation in it is a name that sometimes does not resolve.
  const room = `kongila-${id.replace(/[^a-zA-Z0-9]/g, '').toLowerCase()}`.slice(0, 60);
  try {
    return new URL(`/${room}`, MEETING_ROOM_HOST).toString();
  } catch {
    return null;
  }
}

function isUsableMeetingLink(value: unknown): boolean {
  const link = String(value || '').trim();
  if (!link) return false;
  try {
    return new URL(link).protocol === 'https:';
  } catch {
    return false;
  }
}

/** Resolves the instant from either a UTC timestamp or wall clock plus zone. */
function resolveInstant(input: {
  scheduledTime?: string | null;
  date?: string | null;
  time?: string | null;
  timezone?: string | null;
}): string | null {
  if (input.scheduledTime) {
    const parsed = new Date(input.scheduledTime);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  }
  return wallClockToUtc(input.date, input.time, input.timezone);
}

// ─── Shared lookups ──────────────────────────────────────────────────────────

async function loadInterview(id: string) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('interviews')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

/** Every live interview either party is already in, for conflict checking. */
async function loadDiary(talentId?: string | null, clientId?: string | null) {
  const supabase = getSupabaseClient();
  const ids = [talentId, clientId].filter(Boolean) as string[];
  if (ids.length === 0) return [];

  const { data, error } = await supabase
    .from('interviews')
    .select('id, title, status, scheduled_time, duration_minutes, talent_id, client_id, talent_name, client_name')
    .or(ids.map(id => `talent_id.eq.${id},client_id.eq.${id}`).join(','));

  if (error) throw new Error(error.message);
  return (data || []).map((row: any) => ({
    id: row.id,
    title: row.title,
    status: row.status,
    scheduledTime: row.scheduled_time,
    durationMinutes: row.duration_minutes,
    talentId: row.talent_id,
    clientId: row.client_id,
    talentName: row.talent_name,
    clientName: row.client_name
  }));
}

/**
 * Whether this actor is allowed to touch this interview.
 *
 * An admin may touch any. A client may touch their own. A candidate may touch
 * one they are in. Anyone else is refused before a single field is read out.
 */
function actorOwnsInterview(actor: Actor, interview: any): boolean {
  if (actor.kind === 'admin') return true;
  if (actor.kind === 'client') return String(interview.client_id) === String(actor.userId);
  if (actor.kind === 'talent') {
    return String(interview.talent_id) === String(actor.userId)
      || (!!actor.talentProfileId && String(interview.talent_id) === String(actor.talentProfileId));
  }
  return false;
}

// ─── Notifying both sides ────────────────────────────────────────────────────

type NotifyKind = 'scheduled' | 'rescheduled' | 'reschedule_requested' | 'cancelled' | 'accepted' | 'declined';

/**
 * Which of the fifteen journey notifications an interview change maps to.
 *
 * The three that are not in the catalogue — a reschedule request, a
 * cancellation, a candidate's answer — are operational messages between two
 * named people rather than journey milestones, so they keep the direct
 * wording below instead of being forced into a template that does not fit.
 */
const JOURNEY_EVENT: Partial<Record<NotifyKind, NotificationEvent>> = {
  scheduled: 'interview_scheduled',
  rescheduled: 'interview_rescheduled'
};

const SUBJECTS: Record<NotifyKind, string> = {
  scheduled: 'Interview scheduled',
  rescheduled: 'Interview rescheduled',
  reschedule_requested: 'Reschedule requested',
  cancelled: 'Interview cancelled',
  accepted: 'Interview confirmed',
  declined: 'Interview declined'
};

/**
 * In-app notification to both parties, plus an email with a calendar file
 * when the time is known.
 *
 * Never throws. A notification that cannot be delivered is a warning on the
 * action, not a reason to undo a booking that already happened.
 */
async function notifyParties(
  interview: any,
  kind: NotifyKind,
  extra?: string
): Promise<string[]> {
  const warnings: string[] = [];
  const supabase = getSupabaseClient();
  const startsAt = interviewInstant({
    scheduled_time: interview.scheduled_time,
    date: interview.date,
    time: interview.time,
    scheduled_timezone: interview.scheduled_timezone
  });

  const parties = [
    { id: interview.talent_id, zone: interview.talent_timezone, name: interview.talent_name },
    { id: interview.client_id, zone: interview.client_timezone, name: interview.client_name }
  ].filter(p => p.id);

  if (parties.length === 0) return ['The interview has no participants to notify.'];

  // The managers on the request get the in-app row too. The portal used to
  // insert this from the browser; the notifications table denies every
  // browser write, so operations was never told an interview had been asked
  // for. They get no email: this is a queue they watch, not an interruption.
  const watchers: { id: string; zone?: string | null; name?: string | null }[] = [];
  if (interview.request_id) {
    const { data: request } = await supabase
      .from('talent_requests')
      .select('talent_manager_id, account_manager_id')
      .eq('id', interview.request_id)
      .maybeSingle();

    const seen = new Set(parties.map(p => String(p.id)));
    for (const id of [request?.talent_manager_id, request?.account_manager_id]) {
      if (id && !seen.has(String(id))) {
        seen.add(String(id));
        watchers.push({ id: String(id), zone: null, name: null });
      }
    }
  }

  // In-app first: it does not depend on an email provider being configured.
  const { recipients, warnings: recipientWarnings } = await resolveNotificationRecipients(
    [...parties, ...watchers].map(p => String(p.id))
  );
  warnings.push(...recipientWarnings);

  const notificationRows = recipients.map(recipient => {
    const party = [...parties, ...watchers].find(p =>
      recipient.requestedIds.includes(String(p.id))
    );
    return {
      id: (globalThis.crypto?.randomUUID?.() || `notif_${Date.now()}_${Math.random().toString(36).slice(2)}`),
      user_id: recipient.userId,
      title: SUBJECTS[kind],
      message:
        `${interview.title || 'Your interview'}` +
        (startsAt ? ` — ${formatInstantInZone(startsAt, party?.zone || 'UTC')}` : '') +
        (party?.zone || !startsAt ? '' : ' (UTC; set your timezone to see your own time)') +
        (extra ? ` ${extra}` : ''),
      module_type: 'interviews',
      read: false,
      created_at: new Date().toISOString()
    };
  });

  const { error: notifError } = notificationRows.length > 0
    ? await supabase.from('notifications').insert(notificationRows)
    : { error: null };
  if (notifError) warnings.push(`In-app notification failed: ${notifError.message}`);

  if (!emailIsConfigured()) {
    warnings.push('Email is not configured, so no message was emailed.');
    for (const warning of warnings) console.warn(`[interviews] ${warning}`);
    return warnings;
  }

  const emailRecipients = recipients.filter(recipient =>
    parties.some(p => recipient.requestedIds.includes(String(p.id)))
  );

  for (const party of parties) {
    const recipient = recipients.find(row => row.requestedIds.includes(String(party.id)));
    const user = emailRecipients.find(row => row.userId === recipient?.userId);
    if (!user?.email) {
      warnings.push(`No email address on file for ${party.name || party.id}.`);
      continue;
    }

    const joining = isUsableMeetingLink(interview.meeting_link)
      ? `Joining link: ${interview.meeting_link}`
      : 'Joining details will follow before the call.';
    const when = startsAt
      ? `${formatInstantInZone(startsAt, party.zone || 'UTC')}${party.zone ? '' : ' (UTC)'}`
      : 'A time has not been confirmed yet.';

    // The two journey milestones use the shared catalogue, so their wording
    // matches every other email in the product. The operational ones keep
    // the direct phrasing below.
    const journeyEvent = JOURNEY_EVENT[kind];
    const content = journeyEvent
      ? buildNotification(journeyEvent, {
          recipientName: user.name || party.name || undefined,
          when: startsAt ? when : undefined,
          talentName: interview.talent_name || undefined,
          roleTitle: interview.title || undefined,
          joiningDetails: joining,
          reason: extra || undefined
        })
      : null;

    const body = content?.body ||
      `Hi ${user.name || party.name || 'there'},\n\n` +
      `${SUBJECTS[kind]}: ${interview.title || 'your Kongila interview'}.\n\n` +
      `${when}\n\n` +
      (extra ? `${extra}\n\n` : '') +
      (kind === 'cancelled' || kind === 'declined' ? '' : `${joining}\n\n`) +
      `The Kongila team`;
    const subject = content?.subject || `${SUBJECTS[kind]}: ${interview.title || 'Kongila interview'}`;

    // A calendar file only makes sense when there is a confirmed time.
    const sendable = startsAt && kind !== 'reschedule_requested';
    const result = sendable
      ? await sendInterviewInvitation({
          to: user.email,
          subject,
          body,
          invite: {
            uid: `kongila-interview-${interview.id}@kongila`,
            title: interview.title || 'Kongila interview',
            description: joining,
            startsAt: startsAt as string,
            durationMinutes: Number(interview.duration_minutes) || DEFAULT_DURATION_MINUTES,
            location: isUsableMeetingLink(interview.meeting_link) ? interview.meeting_link : undefined,
            // Calendar clients ignore an update whose sequence has not moved.
            sequence: kind === 'scheduled' ? 0 : Math.floor(Date.now() / 1000) % 100000,
            method: kind === 'cancelled' ? 'CANCEL' : 'REQUEST'
          }
        })
      : await sendEmail({ to: user.email, subject, body });

    if (!result.success) {
      warnings.push(`Email to ${user.name || party.name} was not sent: ${result.error}`);
    }
  }

  for (const warning of warnings) console.warn(`[interviews] ${warning}`);
  return warnings;
}

// ─── Telling the right person the right thing ────────────────────────────────
//
// `notifyParties` below sends one message to both sides of an interview. That
// is right for a cancellation, where the fact is the same for everyone, and
// wrong for everything else in the flow: when a client asks for an interview,
// operations needs "review this and put it to the candidate", the client needs
// "we have it", and the candidate needs nothing at all yet, because it has not
// been put to them. Sending all three the same "an interview has been
// proposed" is how the candidate came to hear about interviews before
// operations had looked at them.
//
// This addresses each audience separately, with its own event from the
// catalogue and its own copy of the time in its own zone, and it goes through
// `notifyUsers`, so the in-app row and the email are the same message rather
// than two hand-written ones that drift.

interface InterviewAudience {
  clientId: string | null;
  talentId: string | null;
  /** The managers on the request. Empty means "all of operations". */
  opsIds: string[];
}

async function interviewAudience(interview: any): Promise<InterviewAudience> {
  const supabase = getSupabaseClient();
  const opsIds: string[] = [];

  if (interview?.request_id) {
    const { data: request } = await supabase
      .from('talent_requests')
      .select('talent_manager_id, account_manager_id')
      .eq('id', interview.request_id)
      .maybeSingle();
    for (const id of [request?.talent_manager_id, request?.account_manager_id]) {
      if (id && !opsIds.includes(String(id))) opsIds.push(String(id));
    }
  }

  return {
    clientId: interview?.client_id ? String(interview.client_id) : null,
    talentId: interview?.talent_id ? String(interview.talent_id) : null,
    opsIds
  };
}

interface AudienceNotice {
  event: NotificationEvent;
  /** Extra sentence for the template, such as a decline reason. */
  reason?: string | null;
  /** Attach a calendar file. Only ever true once both sides have agreed. */
  calendar?: boolean;
}

function interviewWhen(interview: any, zone?: string | null): string | undefined {
  const startsAt = interviewInstant({
    scheduled_time: interview?.scheduled_time,
    date: interview?.date,
    time: interview?.time,
    scheduled_timezone: interview?.scheduled_timezone
  });
  if (!startsAt) return undefined;
  return `${formatInstantInZone(startsAt, zone || 'UTC')}${zone ? '' : ' (UTC)'}`;
}

/**
 * Sends one event per audience. Never throws: a notification that could not
 * be delivered is a warning on the action, not a reason to undo it.
 */
async function notifyInterviewEvent(
  interview: any,
  notices: {
    client?: AudienceNotice;
    talent?: AudienceNotice;
    ops?: AudienceNotice;
  },
  options: { proposedInstant?: string | null } = {}
): Promise<string[]> {
  const warnings: string[] = [];
  const audience = await interviewAudience(interview);

  const startsAt = options.proposedInstant || interviewInstant({
    scheduled_time: interview?.scheduled_time,
    date: interview?.date,
    time: interview?.time,
    scheduled_timezone: interview?.scheduled_timezone
  });

  const joining = isUsableMeetingLink(interview?.meeting_link)
    ? `Joining link: ${interview.meeting_link}`
    : 'Joining details will follow before the call.';

  const calendarInvite = startsAt
    ? {
        uid: `kongila-interview-${interview?.id}@kongila`,
        title: interview?.title || 'Kongila interview',
        description: joining,
        startsAt: startsAt as string,
        durationMinutes: Number(interview?.duration_minutes) || DEFAULT_DURATION_MINUTES,
        location: isUsableMeetingLink(interview?.meeting_link) ? interview.meeting_link : undefined,
        sequence: Math.floor(Date.now() / 1000) % 100000,
        method: 'REQUEST' as const
      }
    : null;

  const send = async (
    recipients: string[],
    notice: AudienceNotice | undefined,
    zone: string | null | undefined,
    actionUrl: string | undefined,
    useAdminFallback = false
  ) => {
    if (!notice) return;
    const context = {
      roleTitle: interview?.title || undefined,
      talentName: interview?.talent_name || undefined,
      companyName: interview?.client_name || undefined,
      clientName: interview?.client_name || undefined,
      when: startsAt
        ? `${formatInstantInZone(startsAt, zone || 'UTC')}${zone ? '' : ' (UTC)'}`
        : undefined,
      joiningDetails: joining,
      reason: notice.reason || undefined,
      actionUrl
    };
    const sendOptions = notice.calendar && calendarInvite
      ? { calendarInvite, sourceRecordId: String(interview?.id || '') }
      : { sourceRecordId: String(interview?.id || '') };

    const result = recipients.length > 0
      ? await notifyUsers(recipients, notice.event, context, sendOptions)
      : useAdminFallback
        ? await notifyAdmins(notice.event, context, sendOptions)
        : { delivered: 0, warnings: ['Nobody to notify.'] };
    warnings.push(...result.warnings);
  };

  await send(
    audience.clientId ? [audience.clientId] : [],
    notices.client,
    interview?.client_timezone,
    clientPortalUrl('/?section=interviews')
  );
  await send(
    audience.talentId ? [audience.talentId] : [],
    notices.talent,
    interview?.talent_timezone,
    talentPortalUrl('/?section=interviews')
  );
  // No manager on the request means the whole operations team, because the
  // alternative is that a request nobody has been assigned reaches nobody.
  await send(
    audience.opsIds,
    notices.ops,
    null,
    interview?.request_id ? adminPortalUrl(`/requests/${interview.request_id}`) : adminPortalUrl('/'),
    true
  );

  for (const warning of warnings) console.warn(`[interviews] ${warning}`);
  return warnings;
}

/**
 * Applies a move on the flow, or explains why it cannot be made.
 *
 * Every state change below goes through this, so an interview can never be
 * put into a stage it cannot be in — a candidate accepting something that was
 * never sent to them, a client confirming a time nobody proposed.
 */
function advance(interview: any, event: InterviewFlowEvent): { stage: string } | { error: string } {
  const next = interviewTransition(interview?.status, event);
  if (!next) {
    return { error: explainInterviewTransition(interview?.status, event) as string };
  }
  return { stage: interviewStageToDb(next) };
}

async function writeAudit(actor: Actor, action: string, details: string) {
  const supabase = getSupabaseClient();
  const { error } = await supabase.from('audit_logs').insert({
    actor: actor.email || actor.userId,
    action,
    details,
    timestamp: new Date().toISOString()
  });
  if (error) console.warn('[interviewService] audit entry not written:', error.message);
}

// ─── Schedule ────────────────────────────────────────────────────────────────

export interface ScheduleInput {
  requestId?: string | null;
  matchId?: string | null;
  talentId: string;
  clientId?: string | null;
  title?: string;
  scheduledTime?: string | null;
  date?: string | null;
  time?: string | null;
  /** The zone the wall clock was entered in. */
  timezone?: string | null;
  talentTimezone?: string | null;
  clientTimezone?: string | null;
  durationMinutes?: number;
  meetingLink?: string | null;
  notes?: string | null;
  talentName?: string | null;
  clientName?: string | null;
  talentAvatar?: string | null;
  /** Delivery format accepted by interviews.interview_type. Defaults to video. */
  interviewType?: string | null;
  /**
   * Every time the client said would work, best first, as ISO instants.
   *
   * A client is asked for a first choice and up to two backups, and all of
   * it used to be flattened into one `scheduled_time` with the alternatives
   * pasted into the notes as English prose. Operations then had to read them
   * out of a sentence, and nothing else could see them at all. The
   * `proposed_slots` column has been on the table since it was created and
   * nothing ever wrote to it.
   */
  proposedSlots?: string[] | null;
}

export async function scheduleInterview(
  actor: Actor,
  input: ScheduleInput
): Promise<ServiceResult> {
  if (!actor) return fail(401, 'Not authenticated.');
  if (actor.kind === 'talent') {
    return fail(403, 'Candidates cannot schedule their own interviews.');
  }
  if (!input.talentId) return fail(400, 'talentId is required.');
  const interviewType = String(input.interviewType || 'video');
  if (!INTERVIEW_TYPES.has(interviewType)) {
    return fail(400, 'interviewType must be video, phone, or async_video.');
  }

  const supabase = getSupabaseClient();
  let request: any = null;
  let match: any = null;
  let requestId = input.requestId ? String(input.requestId) : null;
  if (actor.kind === 'client' && !requestId) {
    return fail(400, 'A role request is required for a client interview.');
  }
  if (actor.kind === 'client' && !input.matchId) {
    return fail(400, 'A matched candidate is required for a client interview.');
  }

  if (requestId) {
    const { data: rowById, error: rowError } = await supabase
      .from('talent_requests')
      .select('*')
      .eq('id', requestId)
      .maybeSingle();
    if (rowError) return fail(500, `The role request could not be loaded: ${rowError.message}`);

    if (rowById) {
      request = rowById;
    } else {
      const { data: rowByPayloadId, error: payloadError } = await supabase
        .from('talent_requests')
        .select('*')
        .eq('payload->>id', requestId)
        .maybeSingle();
      if (payloadError) return fail(500, `The role request could not be loaded: ${payloadError.message}`);
      request = rowByPayloadId;
    }

    if (!request) return fail(404, 'The role request does not exist.');
    requestId = String(request.id);

    if (actor.kind === 'client') {
      let permitted = String(request.client_id) === String(actor.userId);
      if (!permitted && actor.organizationId) {
        const { data: members, error: membersError } = await supabase
          .from('client_profiles')
          .select('user_id')
          .eq('organization_id', actor.organizationId);
        if (membersError) return fail(500, 'Your company membership could not be verified.');
        permitted = (members || []).some((member: any) => String(member.user_id) === String(request.client_id));
      }
      if (!permitted) return fail(403, 'That role request does not belong to your company.');
    }

    const requestStatus = normalizeRequestStatus(request.payload?.status || request.status);
    if (requestStatus === 'Closed' || requestStatus === 'Onboarding') {
      return fail(409, `An interview cannot be requested for a ${requestStatus.toLowerCase()} role.`);
    }

    const matchQuery = supabase
      .from('matches')
      .select('*')
      .eq('request_id', request.id)
      .eq('talent_id', input.talentId);
    const { data: matchingRows, error: matchingError } = input.matchId
      ? await matchQuery.eq('id', String(input.matchId)).limit(1)
      : await matchQuery.limit(1);
    if (matchingError) return fail(500, `The candidate's role match could not be verified: ${matchingError.message}`);
    match = matchingRows?.[0] || null;
    if (!match) return fail(403, 'This candidate is not matched to the selected role.');
    if (['rejected', 'accepted'].includes(String(match.status).toLowerCase())) {
      return fail(409, 'This candidate is no longer available for an interview on this role.');
    }
  }

  // A client may only book for themselves; an admin may book for anyone.
  const clientId = actor.kind === 'client' ? actor.userId : (input.clientId || request?.client_id || null);
  if (!clientId) return fail(400, 'clientId is required.');

  const startsAt = resolveInstant(input);
  if (!startsAt) {
    return fail(400, 'An interview needs a time. Send scheduledTime, or date, time and timezone.');
  }
  if (new Date(startsAt).getTime() < Date.now()) {
    return fail(400, 'That slot is in the past.');
  }

  try {
    // One conversation at a time with a candidate on a role.
    //
    // The cap was three, enforced in the modal only, so it was bypassable by
    // anything that did not go through that screen — and three was the wrong
    // number anyway. A client who asked on Monday and had heard nothing by
    // Wednesday asked again, and operations ended up with three requests for
    // one conversation, each sitting at a different stage.
    //
    // A finished interview does not block a second round: completed ones are
    // not counted, so a follow-up can still be asked for.
    if (requestId) {
      const { data: pairRows, error: pairError } = await supabase
        .from('interviews')
        .select('id, status')
        .eq('request_id', requestId)
        .eq('talent_id', input.talentId);
      if (pairError) return fail(500, `Existing interviews could not be checked: ${pairError.message}`);

      const openOne = (pairRows || []).find((row: any) => {
        const stage = normalizeInterviewStage(row.status);
        return stage !== 'completed'
          && stage !== 'cancelled'
          && stage !== 'talent_declined'
          && stage !== 'admin_declined'
          && stage !== 'expired';
      });

      if (openOne) {
        return fail(
          409,
          normalizeInterviewStage(openOne.status) === 'confirmed'
            ? 'This candidate already has an interview booked on this role.'
            : 'There is already an interview request open with this candidate on this role. '
              + 'Your Kongila team is working on it — you can follow it on your Interviews screen.'
        );
      }

      const live = (pairRows || []).filter(
        (r: any) => !['cancelled', 'declined', 'expired'].includes(String(r.status).toLowerCase())
      );
      if (live.length >= MAX_INTERVIEWS_PER_PAIR) {
        return fail(409, `There have already been ${MAX_INTERVIEWS_PER_PAIR} interviews with this candidate for this request.`);
      }
    }

    const diary = await loadDiary(input.talentId, clientId);
    const conflicts = findSchedulingConflicts(
      {
        startsAt,
        durationMinutes: input.durationMinutes || DEFAULT_DURATION_MINUTES,
        talentId: input.talentId,
        clientId
      },
      diary
    );
    if (conflicts.length > 0) {
      return { ok: false, status: 409, error: describeConflict(conflicts) as string };
    }

    // Deduplicated, sorted, and always containing the time being booked, so
    // the list and the chosen slot can never disagree.
    const normalizedSlots = Array.from(new Set(
      [startsAt, ...(input.proposedSlots || [])]
        .map(value => {
          const parsed = new Date(String(value));
          return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
        })
        .filter((value): value is string => Boolean(value))
    )).sort();

    const zone = input.timezone || input.clientTimezone || 'UTC';
    const row = {
      id: `iv_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      request_id: requestId || null,
      match_id: match?.id || input.matchId || null,
      talent_id: input.talentId,
      client_id: clientId,
      talent_name: input.talentName || null,
      talent_avatar: input.talentAvatar || null,
      client_name: input.clientName || null,
      // This column stores the interview format, not whether it is vetting or
      // client-facing. The request and title carry that distinction.
      interview_type: interviewType,
      title: input.title || 'Interview',
      // The first choice is the interview's time until operations picks
      // another; the whole list stays so they can.
      proposed_slots: normalizedSlots.length > 0 ? normalizedSlots : null,
      scheduled_time: startsAt,
      scheduled_timezone: zone,
      client_timezone: input.clientTimezone || zone,
      talent_timezone: input.talentTimezone || null,
      // Display fallbacks for screens that still read them. Never the truth.
      date: input.date || startsAt.slice(0, 10),
      time: input.time || null,
      duration_minutes: input.durationMinutes || DEFAULT_DURATION_MINUTES,
      // Where a new interview starts depends on who asked for it.
      //
      // A client asking is a request, not a booking: it goes to operations
      // first, who review it and put it to the candidate. It used to be
      // written straight out to the candidate as 'Proposed', so the first
      // Kongila heard of an interview with one of its candidates was after
      // the candidate had already been asked.
      //
      // Operations creating one directly — a vetting interview, or a slot
      // agreed on a call — has already had that review, so it goes to the
      // candidate to answer.
      status: actor.kind === 'client' ? 'client_requested' : 'sent_to_talent',
      meeting_link: isUsableMeetingLink(input.meetingLink) ? input.meetingLink : null,
      notes: input.notes || null,
      created_at: new Date().toISOString()
    };

    const { data: inserted, error } = await supabase
      .from('interviews')
      .insert(row)
      .select()
      .maybeSingle();

    if (error) return fail(500, `The interview could not be saved: ${error.message}`);

    const warnings: string[] = [];
    if (match && String(match.status).toLowerCase() === 'proposed') {
      const { error: matchUpdateError } = await supabase
        .from('matches')
        .update({ status: 'shortlisted' })
        .eq('id', match.id);
      if (matchUpdateError) {
        warnings.push(`The interview was requested, but the match stage did not update: ${matchUpdateError.message}`);
      }
    }

    if (requestId && request) {
      const requestPayload = { ...(request.payload || {}) };
      const nextStatus = matchingProgressStatus(
        requestPayload.status || request.status,
        'interview_requested'
      );
      if (nextStatus) {
        requestPayload.status = nextStatus;
        const { error: requestUpdateError } = await supabase
          .from('talent_requests')
          .update({
            payload: requestPayload,
            status: nextStatus.toLowerCase().replace(/ /g, '_')
          })
          .eq('id', request.id);
        if (requestUpdateError) {
          warnings.push(`The interview was requested, but the role stage did not update: ${requestUpdateError.message}`);
        }
      }
    }

    // Who hears about it, and what they are told, depends on where it is.
    const saved = inserted || row;
    if (actor.kind === 'client') {
      warnings.push(...await notifyInterviewEvent(saved, {
        // Not the candidate. Nothing has been put to them yet.
        client: { event: 'interview_request_sent' },
        ops: { event: 'interview_requested', reason: input.notes || null }
      }));
    } else {
      warnings.push(...await notifyInterviewEvent(saved, {
        talent: { event: 'interview_invitation', reason: input.notes || null },
        client: { event: 'interview_sent_to_talent' }
      }));
    }

    await writeAudit(
      actor,
      actor.kind === 'client' ? 'Request Interview' : 'Schedule Interview',
      `${actor.kind === 'client' ? 'Requested' : 'Proposed'} "${row.title}" with ${row.talent_name || row.talent_id} for ` +
      `${formatInstantInZone(startsAt, 'UTC')} UTC.` +
      (row.meeting_link ? ' Joining link supplied.' : ' No joining link yet.')
    );

    return { ok: true, status: 201, data: inserted || row, warnings };
  } catch (err: any) {
    console.error('[interviewService] scheduleInterview failed:', err);
    return fail(500, err?.message || 'The interview could not be scheduled.');
  }
}

// ─── Operations, between the client and the candidate ────────────────────────

/**
 * Operations puts a client's request to the candidate.
 *
 * This step did not exist. A client's request went straight to the candidate,
 * so nobody at Kongila saw an interview before the candidate did, nobody
 * checked the time against the candidate's vetting stage or their other
 * calls, and there was no point at which a request could be turned down
 * without the candidate having already been bothered by it.
 *
 * Operations may move the time while sending it — that is usually the whole
 * point of the review — so the conflict check runs again on whatever is sent.
 */
export async function sendInterviewToTalent(
  actor: Actor,
  input: {
    interviewId: string;
    scheduledTime?: string | null;
    date?: string | null;
    time?: string | null;
    timezone?: string | null;
    durationMinutes?: number;
    meetingLink?: string | null;
    note?: string;
  }
): Promise<ServiceResult> {
  if (actor?.kind !== 'admin') return fail(403, 'Only operations can send an interview to a candidate.');
  if (!input.interviewId) return fail(400, 'interviewId is required.');

  try {
    const interview = await loadInterview(input.interviewId);
    if (!interview) return fail(404, 'Interview not found.');

    const move = advance(interview, 'admin_sends_to_talent');
    if ('error' in move) return fail(409, move.error);

    const startsAt = resolveInstant({
      scheduledTime: input.scheduledTime,
      date: input.date,
      time: input.time,
      timezone: input.timezone || interview.scheduled_timezone
    }) || interview.scheduled_time;

    if (!startsAt) return fail(400, 'A time is needed before this goes to the candidate.');

    const duration = Number(input.durationMinutes || interview.duration_minutes) || DEFAULT_DURATION_MINUTES;
    const diary = await loadDiary(interview.talent_id, interview.client_id);
    const conflicts = findSchedulingConflicts(
      {
        startsAt,
        durationMinutes: duration,
        talentId: interview.talent_id,
        clientId: interview.client_id,
        excludeInterviewId: input.interviewId
      },
      diary
    );
    if (conflicts.length > 0) return fail(409, describeConflict(conflicts) as string);

    const zone = input.timezone || interview.scheduled_timezone || 'UTC';
    const supabase = getSupabaseClient();

    // A candidate is being asked to hold an hour. Telling them where it
    // happens is part of asking. An operator's own Meet or Zoom link wins;
    // otherwise a room is made now rather than promised in a sentence
    // somebody has to remember to act on.
    const meetingLink = isUsableMeetingLink(input.meetingLink)
      ? String(input.meetingLink)
      : isUsableMeetingLink(interview.meeting_link)
        ? interview.meeting_link
        : generateMeetingLink(String(interview.id));

    const { data: updated, error } = await supabase
      .from('interviews')
      .update({
        status: move.stage,
        scheduled_time: startsAt,
        scheduled_timezone: zone,
        date: input.date || startsAt.slice(0, 10),
        time: input.time || interview.time,
        duration_minutes: duration,
        meeting_link: meetingLink,
        // When the candidate first saw it, which is what the SLA on an
        // unanswered invitation has to be measured from.
        revealed_to_talent_at: interview.revealed_to_talent_at || new Date().toISOString(),
        // A time the candidate has not answered yet is not a time to remind
        // anyone about.
        reminder_24h_sent_at: null,
        reminder_1h_sent_at: null,
        updated_at: new Date().toISOString()
      })
      .eq('id', input.interviewId)
      .select()
      .maybeSingle();

    if (error) return fail(500, `The invitation was not sent: ${error.message}`);

    const saved = updated || interview;
    const warnings = await notifyInterviewEvent(saved, {
      talent: { event: 'interview_invitation', reason: input.note || null },
      client: { event: 'interview_sent_to_talent' }
    });

    await writeAudit(
      actor,
      'Send Interview To Candidate',
      `Put "${interview.title}" to ${interview.talent_name || interview.talent_id} for ` +
      `${formatInstantInZone(startsAt, 'UTC')} UTC.` + (input.note ? ` Note: ${input.note}` : '')
    );

    return { ok: true, status: 200, data: saved, warnings };
  } catch (err: any) {
    console.error('[interviewService] sendInterviewToTalent failed:', err);
    return fail(500, err?.message || 'The invitation could not be sent.');
  }
}

/**
 * Operations turns a client's interview request down.
 *
 * There was no way to do this. A request operations did not want to put
 * forward — the candidate is mid-assessment, already placed, or no longer on
 * the platform — could only be left sitting, and the client was never told.
 */
export async function declineInterviewRequest(
  actor: Actor,
  input: { interviewId: string; reason?: string }
): Promise<ServiceResult> {
  if (actor?.kind !== 'admin') return fail(403, 'Only operations can decline an interview request.');
  if (!input.interviewId) return fail(400, 'interviewId is required.');

  try {
    const interview = await loadInterview(input.interviewId);
    if (!interview) return fail(404, 'Interview not found.');

    const move = advance(interview, 'admin_declines');
    if ('error' in move) return fail(409, move.error);

    const supabase = getSupabaseClient();
    const { data: updated, error } = await supabase
      .from('interviews')
      .update({
        status: move.stage,
        admin_note_internal: input.reason || interview.admin_note_internal || null,
        updated_at: new Date().toISOString()
      })
      .eq('id', input.interviewId)
      .select()
      .maybeSingle();

    if (error) return fail(500, `That was not saved: ${error.message}`);

    const saved = updated || interview;
    // The candidate is not told, because the candidate was never asked.
    const warnings = await notifyInterviewEvent(saved, {
      client: { event: 'interview_request_declined', reason: input.reason || null }
    });

    await writeAudit(
      actor,
      'Decline Interview Request',
      `Declined the request to interview ${interview.talent_name || interview.talent_id}.` +
      (input.reason ? ` Reason: ${input.reason}` : '')
    );

    return { ok: true, status: 200, data: saved, warnings };
  } catch (err: any) {
    console.error('[interviewService] declineInterviewRequest failed:', err);
    return fail(500, err?.message || 'That could not be saved.');
  }
}

/**
 * The client answers a time the candidate proposed instead.
 *
 * This is the step the loop was missing. A candidate who could not make the
 * slot raised a reschedule, which only operations could answer, so the client
 * whose interview it was had no say in the time they were being moved to and
 * often learned of it from the calendar invitation.
 *
 * Accepting is agreement from both sides, so it confirms there and then.
 * Turning it down hands it back to operations to find a third time, rather
 * than bouncing it straight back to the candidate.
 */
export async function decideCounterOffer(
  actor: Actor,
  input: { interviewId: string; accept: boolean; reason?: string; meetingLink?: string | null }
): Promise<ServiceResult> {
  if (!input.interviewId) return fail(400, 'interviewId is required.');
  if (actor?.kind === 'talent') {
    return fail(403, 'Only the client can answer a time proposed to them.');
  }

  try {
    const interview = await loadInterview(input.interviewId);
    if (!interview) return fail(404, 'Interview not found.');
    if (!actorOwnsInterview(actor, interview)) return fail(403, 'That interview is not yours.');

    const supabase = getSupabaseClient();

    // A reschedule request on an already-confirmed interview is different
    // from the candidate countering an initial invitation: the original
    // calendar booking remains active until the client accepts the proposed
    // replacement time.
    const isConfirmedReschedule = Boolean(
      interview.reschedule_requested &&
      interview.reschedule_requested_by === 'talent' &&
      interview.client_id &&
      normalizeInterviewStage(interview.status) === 'confirmed'
    );

    if (isConfirmedReschedule) {
      if (!input.accept) {
        const { data: declined, error } = await supabase
          .from('interviews')
          .update({
            reschedule_requested: false,
            reschedule_reason: null,
            reschedule_requested_by: null,
            reschedule_requested_at: null,
            proposed_time: null,
            proposed_timezone: null,
            proposed_new_date: null,
            proposed_new_time: null,
            client_notes: input.reason || interview.client_notes || null,
            updated_at: new Date().toISOString()
          })
          .eq('id', input.interviewId)
          .eq('reschedule_requested', true)
          .select()
          .maybeSingle();

        if (error) return fail(500, `Your answer was not saved: ${error.message}`);
        if (!declined) return fail(409, 'This reschedule request has already been answered.');

        const warnings = await notifyInterviewEvent(declined, {
          talent: { event: 'interview_reschedule_request_declined', reason: input.reason || null },
          ops: { event: 'interview_reschedule_request_declined', reason: input.reason || null }
        });
        await writeAudit(
          actor,
          'Decline Talent Reschedule Request',
          `The client declined the proposed time for "${interview.title}". The original interview time remains in place.` +
          (input.reason ? ` Reason: ${input.reason}` : '')
        );
        return { ok: true, status: 200, data: declined, warnings };
      }

      const newStart = resolveInstant({
        scheduledTime: interview.proposed_time,
        date: interview.proposed_new_date,
        time: interview.proposed_new_time,
        timezone: interview.proposed_timezone || interview.scheduled_timezone
      });
      if (!newStart) return fail(409, 'There is no proposed time on this interview to accept.');

      const diary = await loadDiary(interview.talent_id, interview.client_id);
      const conflicts = findSchedulingConflicts(
        {
          startsAt: newStart,
          durationMinutes: Number(interview.duration_minutes) || DEFAULT_DURATION_MINUTES,
          talentId: interview.talent_id,
          clientId: interview.client_id,
          excludeInterviewId: input.interviewId
        },
        diary
      );
      if (conflicts.length > 0) return { ok: false, status: 409, error: describeConflict(conflicts) as string };

      const zone = interview.proposed_timezone || interview.scheduled_timezone || 'UTC';
      const { data: rescheduled, error } = await supabase
        .from('interviews')
        .update({
          status: 'Rescheduled',
          scheduled_time: newStart,
          scheduled_timezone: zone,
          rescheduled_from: interview.scheduled_time || null,
          date: interview.proposed_new_date || newStart.slice(0, 10),
          time: interview.proposed_new_time || interview.time,
          reschedule_requested: false,
          reschedule_reason: null,
          reschedule_requested_by: null,
          reschedule_requested_at: null,
          proposed_time: null,
          proposed_timezone: null,
          proposed_new_date: null,
          proposed_new_time: null,
          reminder_24h_sent_at: null,
          reminder_1h_sent_at: null,
          updated_at: new Date().toISOString()
        })
        .eq('id', input.interviewId)
        .eq('reschedule_requested', true)
        .select()
        .maybeSingle();

      if (error) return fail(500, `The interview was not rescheduled: ${error.message}`);
      if (!rescheduled) return fail(409, 'This reschedule request has already been answered.');

      const warnings = await notifyInterviewEvent(rescheduled, {
        client: { event: 'interview_rescheduled', calendar: true },
        talent: { event: 'interview_rescheduled', calendar: true },
        ops: { event: 'interview_rescheduled' }
      });
      await writeAudit(
        actor,
        'Accept Talent Reschedule Request',
        `The client accepted the proposed time for "${interview.title}". Confirmed for ${formatInstantInZone(newStart, zone)}.`
      );
      return { ok: true, status: 200, data: rescheduled, warnings };
    }

    const move = advance(interview, input.accept ? 'client_accepts_counter' : 'client_declines_counter');
    if ('error' in move) return fail(409, move.error);

    if (!input.accept) {
      const { data: handedBack, error } = await supabase
        .from('interviews')
        .update({
          status: move.stage,
          reschedule_requested: false,
          reschedule_reason: null,
          reschedule_requested_by: null,
          reschedule_requested_at: null,
          proposed_time: null,
          proposed_timezone: null,
          proposed_new_date: null,
          proposed_new_time: null,
          client_notes: input.reason || interview.client_notes || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', input.interviewId)
        .select()
        .maybeSingle();

      if (error) return fail(500, `Your answer was not saved: ${error.message}`);

      const saved = handedBack || interview;
      const warnings = await notifyInterviewEvent(saved, {
        talent: { event: 'interview_counter_declined', reason: input.reason || null },
        ops: { event: 'interview_counter_declined', reason: input.reason || null }
      });

      await writeAudit(
        actor,
        'Decline Proposed Interview Time',
        `The client turned down the time proposed for "${interview.title}".` +
        (input.reason ? ` Reason: ${input.reason}` : '')
      );

      return { ok: true, status: 200, data: saved, warnings };
    }

    const newStart = resolveInstant({
      scheduledTime: interview.proposed_time,
      date: interview.proposed_new_date,
      time: interview.proposed_new_time,
      timezone: interview.proposed_timezone || interview.scheduled_timezone
    });
    if (!newStart) return fail(409, 'There is no proposed time on this interview to accept.');

    const diary = await loadDiary(interview.talent_id, interview.client_id);
    const conflicts = findSchedulingConflicts(
      {
        startsAt: newStart,
        durationMinutes: Number(interview.duration_minutes) || DEFAULT_DURATION_MINUTES,
        talentId: interview.talent_id,
        clientId: interview.client_id,
        excludeInterviewId: input.interviewId
      },
      diary
    );
    if (conflicts.length > 0) return { ok: false, status: 409, error: describeConflict(conflicts) as string };

    const zone = interview.proposed_timezone || interview.scheduled_timezone || 'UTC';
    const { data: confirmed, error } = await supabase
      .from('interviews')
      .update({
        status: move.stage,
        scheduled_time: newStart,
        scheduled_timezone: zone,
        rescheduled_from: interview.scheduled_time || null,
        date: interview.proposed_new_date || newStart.slice(0, 10),
        time: interview.proposed_new_time || interview.time,
        // Both sides have now agreed this one, so it is the confirmed slot.
        confirmed_slot: newStart,
        meeting_link: isUsableMeetingLink(input.meetingLink)
          ? input.meetingLink
          : isUsableMeetingLink(interview.meeting_link)
            ? interview.meeting_link
            : generateMeetingLink(String(interview.id)),
        reschedule_requested: false,
        reschedule_reason: null,
        reschedule_requested_by: null,
        reschedule_requested_at: null,
        proposed_time: null,
        proposed_timezone: null,
        proposed_new_date: null,
        proposed_new_time: null,
        reminder_24h_sent_at: null,
        reminder_1h_sent_at: null,
        updated_at: new Date().toISOString()
      })
      .eq('id', input.interviewId)
      .select()
      .maybeSingle();

    if (error) return fail(500, `The interview was not confirmed: ${error.message}`);

    const saved = confirmed || interview;
    const warnings = await notifyInterviewEvent(saved, {
      client: { event: 'interview_confirmed', calendar: true },
      talent: { event: 'interview_confirmed', calendar: true },
      ops: { event: 'interview_confirmed' }
    });

    await writeAudit(
      actor,
      'Confirm Interview',
      `The client accepted the time proposed by ${interview.talent_name || 'the candidate'} for ` +
      `"${interview.title}". Confirmed for ${formatInstantInZone(newStart, 'UTC')} UTC.`
    );

    return { ok: true, status: 200, data: saved, warnings };
  } catch (err: any) {
    console.error('[interviewService] decideCounterOffer failed:', err);
    return fail(500, err?.message || 'Your answer could not be saved.');
  }
}

// ─── Candidate response ──────────────────────────────────────────────────────

export async function respondToInterview(
  actor: Actor,
  input: { interviewId: string; accept: boolean; reason?: string }
): Promise<ServiceResult> {
  if (!input.interviewId) return fail(400, 'interviewId is required.');

  try {
    const interview = await loadInterview(input.interviewId);
    if (!interview) return fail(404, 'Interview not found.');

    // Only the candidate answers for themselves. An admin may record an
    // answer relayed by phone; a client may not answer on their behalf.
    if (actor.kind === 'client') {
      return fail(403, 'Only the candidate can accept or decline an interview.');
    }
    if (!actorOwnsInterview(actor, interview)) {
      return fail(403, 'That interview is not yours.');
    }
    // Accepting is the agreement, so it confirms the interview outright.
    // It used to be written as 'talent_accepted' and left there: nothing
    // moved an interview to confirmed, so an interview both sides had agreed
    // to sat in a stage that no screen called scheduled, and no calendar
    // invitation was ever sent for it.
    const move = advance(interview, input.accept ? 'talent_accepts' : 'talent_declines');
    if ('error' in move) return fail(409, move.error);

    const supabase = getSupabaseClient();
    const { data: updated, error } = await supabase
      .from('interviews')
      .update({
        status: move.stage,
        talent_decline_reason: input.accept ? null : (input.reason || null),
        // `confirmed_slot` is what both sides agreed, kept apart from
        // `scheduled_time` so a later move cannot quietly rewrite the record
        // of what was once settled. The column existed and nothing wrote it.
        ...(input.accept
          ? {
              confirmed_slot: interview.scheduled_time || null,
              meeting_link: isUsableMeetingLink(interview.meeting_link)
                ? interview.meeting_link
                : generateMeetingLink(String(interview.id))
            }
          : {}),
        updated_at: new Date().toISOString()
      })
      .eq('id', input.interviewId)
      .select()
      .maybeSingle();

    if (error) return fail(500, `Your response was not saved: ${error.message}`);

    const saved = updated || interview;
    const warnings = input.accept
      ? await notifyInterviewEvent(saved, {
          // Both sides get the calendar file, because now there is something
          // to put in a calendar.
          client: { event: 'interview_confirmed', calendar: true },
          talent: { event: 'interview_confirmed', calendar: true },
          ops: { event: 'interview_confirmed' }
        })
      : await notifyInterviewEvent(saved, {
          client: { event: 'interview_declined_by_talent', reason: input.reason || null },
          ops: { event: 'interview_declined_by_talent', reason: input.reason || null }
        });

    await writeAudit(
      actor,
      input.accept ? 'Accept Interview' : 'Decline Interview',
      `${interview.talent_name || actor.userId} ${input.accept ? 'accepted' : 'declined'} ` +
      `"${interview.title}".` + (input.reason ? ` Reason: ${input.reason}` : '')
    );

    return { ok: true, status: 200, data: updated, warnings };
  } catch (err: any) {
    console.error('[interviewService] respondToInterview failed:', err);
    return fail(500, err?.message || 'Your response could not be saved.');
  }
}

// ─── Reschedule ──────────────────────────────────────────────────────────────

/**
 * Either party asks for a different time. This is a real record on the
 * interview row — who asked, when, and the instant they proposed — not a
 * formatted string stuffed into a reason field, and not a copy written onto
 * the match.
 */
export async function requestReschedule(
  actor: Actor,
  input: {
    interviewId: string;
    proposedScheduledTime?: string | null;
    proposedDate?: string | null;
    proposedTime?: string | null;
    timezone?: string | null;
    reason?: string;
  }
): Promise<ServiceResult> {
  if (!input.interviewId) return fail(400, 'interviewId is required.');

  try {
    const interview = await loadInterview(input.interviewId);
    if (!interview) return fail(404, 'Interview not found.');
    if (!actorOwnsInterview(actor, interview)) return fail(403, 'That interview is not yours.');

    const currentStart = interviewInstant({
      scheduled_time: interview.scheduled_time,
      date: interview.date,
      time: interview.time,
      scheduled_timezone: interview.scheduled_timezone
    });

    // A client moving a call a couple of hours beforehand is the candidate's
    // problem, not a self-service action.
    if (actor.kind === 'client' && currentStart) {
      const hoursAway = (new Date(currentStart).getTime() - Date.now()) / 3_600_000;
      if (hoursAway < LATE_CHANGE_HOURS) {
        return fail(
          409,
          `This interview starts in under ${LATE_CHANGE_HOURS} hours, so it cannot be moved here. ` +
          `Your account manager has been notified and will coordinate.`
        );
      }
    }

    const proposed = resolveInstant({
      scheduledTime: input.proposedScheduledTime,
      date: input.proposedDate,
      time: input.proposedTime,
      timezone: input.timezone
    });

    // A candidate answering an invitation with a different time is not a
    // reschedule — there is nothing scheduled yet to move. It is a counter,
    // and the person who has to answer it is the client, not operations.
    //
    // Treating it as a reschedule is why the loop never closed: it set a flag
    // that only `decideReschedule` could clear, and that is admin-only, so
    // the client whose interview it was never saw the time being proposed to
    // them and operations had to guess on their behalf.
    // Only a client interview has a client to put a new time to.
    //
    // A vetting interview — the behavioural interview in the pipeline — is
    // between the candidate and Kongila. It still names a client, because
    // interviews.client_id is NOT NULL and the operator who scheduled it
    // stands in, and that stand-in was being treated as a real counterparty:
    // a candidate asking to move a behavioural interview was recorded as
    // proposing a time to a client who is not in the conversation, and the
    // screens said it was waiting on them.
    const party = interviewParty(interview);
    const isCounter = party === 'client'
      && actor.kind === 'talent'
      && Boolean(interviewTransition(interview.status, 'talent_counters'));

    if (isCounter && !proposed) {
      return fail(422, 'Propose a time you can make, so the client has something to accept.');
    }

    const supabase = getSupabaseClient();
    const { data: updated, error } = await supabase
      .from('interviews')
      .update({
        ...(isCounter ? { status: interviewStageToDb('talent_countered') } : {}),
        reschedule_requested: true,
        reschedule_reason: input.reason || null,
        reschedule_requested_by: actor.kind,
        reschedule_requested_at: new Date().toISOString(),
        proposed_time: proposed,
        proposed_timezone: input.timezone || null,
        proposed_new_date: input.proposedDate || null,
        proposed_new_time: input.proposedTime || null,
        updated_at: new Date().toISOString()
      })
      .eq('id', input.interviewId)
      .select()
      .maybeSingle();

    if (error) return fail(500, `The request was not saved: ${error.message}`);

    const proposedText = proposed
      ? `Proposed: ${formatInstantInZone(proposed, input.timezone || 'UTC')}.`
      : 'No alternative time was proposed.';

    const saved = updated || interview;
    const talentAskedClientToMove = party === 'client'
      && actor.kind === 'talent'
      && Boolean(interview.client_id);
    const warnings = (isCounter || talentAskedClientToMove)
      ? await notifyInterviewEvent(
          saved,
          {
            // The client is the decision maker. Operations gets a copy to
            // coordinate, while the talent receives a clear receipt.
            client: { event: 'interview_new_time_proposed', reason: input.reason || null },
            ops: { event: 'interview_reschedule_waiting_on_client', reason: input.reason || null },
            talent: { event: 'interview_reschedule_submitted', reason: input.reason || null }
          },
          { proposedInstant: proposed }
        )
      // A vetting interview, or a client moving their own: both sides of the
      // conversation hear it directly. On a vetting interview that is the
      // candidate and the operator who scheduled it, which is who it is
      // actually between.
      : await notifyParties(
          saved,
          'reschedule_requested',
          `${proposedText}${input.reason ? ` Reason: ${input.reason}` : ''}`
        );

    await writeAudit(
      actor,
      'Request Interview Reschedule',
      `${actor.kind} asked to move "${interview.title}". ${proposedText}` +
      (input.reason ? ` Reason: ${input.reason}` : '')
    );

    return { ok: true, status: 200, data: updated, warnings };
  } catch (err: any) {
    console.error('[interviewService] requestReschedule failed:', err);
    return fail(500, err?.message || 'The reschedule request could not be saved.');
  }
}

/**
 * Operations approves or refuses a reschedule.
 *
 * Approving moves the existing interview. It used to create a second row and
 * leave the first one Scheduled forever, so one conversation showed as two
 * live interviews and the candidate got two calendar entries.
 */
export async function decideReschedule(
  actor: Actor,
  input: {
    interviewId: string;
    approve: boolean;
    scheduledTime?: string | null;
    date?: string | null;
    time?: string | null;
    timezone?: string | null;
    meetingLink?: string | null;
    note?: string;
  }
): Promise<ServiceResult> {
  if (actor.kind !== 'admin') return fail(403, 'Only operations can decide a reschedule.');
  if (!input.interviewId) return fail(400, 'interviewId is required.');

  try {
    const interview = await loadInterview(input.interviewId);
    if (!interview) return fail(404, 'Interview not found.');
    if (!interview.reschedule_requested) return fail(409, 'There is no pending reschedule request to decide.');

    // A talent reschedule on a client-owned interview must be seen and
    // answered by that client. Operations can coordinate, but cannot accept
    // or reject the proposed time on the client's behalf.
    //
    // Only where there is a client. This used to test `interview.client_id`,
    // which is never null — interviews.client_id is NOT NULL, so a vetting
    // interview names the operator who scheduled it. Every behavioural
    // interview therefore looked client-owned, and a candidate asking to
    // move one left it stuck: operations were told to wait for a client who
    // was not in the conversation and had no screen on which to answer.
    if (
      interviewParty(interview) === 'client' &&
      interview.reschedule_requested &&
      interview.reschedule_requested_by === 'talent' &&
      interview.client_id
    ) {
      return fail(409, 'The client must review this reschedule request before operations can take further action.');
    }

    const supabase = getSupabaseClient();

    if (!input.approve) {
      const refusal = advance(interview, 'admin_rejects_reschedule');
      if ('error' in refusal) return fail(409, refusal.error);
      const { data: kept, error } = await supabase
        .from('interviews')
        .update({
          status: refusal.stage,
          reschedule_requested: false,
          reschedule_reason: null,
          reschedule_requested_by: null,
          reschedule_requested_at: null,
          proposed_time: null,
          proposed_timezone: null,
          proposed_new_date: null,
          proposed_new_time: null,
          updated_at: new Date().toISOString()
        })
        .eq('id', input.interviewId)
        .eq('reschedule_requested', true)
        .select()
        .maybeSingle();

      if (error) return fail(500, error.message);
      if (!kept) return fail(409, 'This reschedule request has already been answered.');

      const warnings = await notifyInterviewEvent(kept || interview, {
        client: {
          event: 'interview_confirmed',
          reason: `The reschedule request was declined and the original time stands.${input.note ? ` ${input.note}` : ''}`
        },
        talent: {
          event: 'interview_confirmed',
          reason: `The reschedule request was declined and the original time stands.${input.note ? ` ${input.note}` : ''}`
        }
      });
      await writeAudit(actor, 'Decline Reschedule', `Kept the original time for "${interview.title}".`);
      return { ok: true, status: 200, data: kept, warnings };
    }

    const newStart = resolveInstant({
      scheduledTime: input.scheduledTime || interview.proposed_time,
      date: input.date || interview.proposed_new_date,
      time: input.time || interview.proposed_new_time,
      timezone: input.timezone || interview.proposed_timezone || interview.scheduled_timezone
    });
    if (!newStart) return fail(400, 'Approving a reschedule needs a new time.');

    const diary = await loadDiary(interview.talent_id, interview.client_id);
    const conflicts = findSchedulingConflicts(
      {
        startsAt: newStart,
        durationMinutes: Number(interview.duration_minutes) || DEFAULT_DURATION_MINUTES,
        talentId: interview.talent_id,
        clientId: interview.client_id,
        excludeInterviewId: input.interviewId
      },
      diary
    );
    if (conflicts.length > 0) {
      return { ok: false, status: 409, error: describeConflict(conflicts) as string };
    }

    // Approving a move does not confirm it. The new time is one the candidate
    // has not agreed to, so the interview goes back to them to answer. It used
    // to be written as 'Rescheduled' and treated as scheduled from that
    // moment, which is how calendar invitations went out for times nobody on
    // the other end had accepted.
    const approval = advance(interview, 'admin_approves_reschedule');
    if ('error' in approval) return fail(409, approval.error);

    const zone = input.timezone || interview.proposed_timezone || interview.scheduled_timezone || 'UTC';
    const { data: moved, error } = await supabase
      .from('interviews')
      .update({
        status: approval.stage,
        scheduled_time: newStart,
        scheduled_timezone: zone,
        // Kept, so the history of what it moved from is not lost.
        rescheduled_from: interview.scheduled_time || null,
        date: input.date || newStart.slice(0, 10),
        time: input.time || interview.time,
        meeting_link: isUsableMeetingLink(input.meetingLink)
          ? input.meetingLink
          : interview.meeting_link,
        reschedule_requested: false,
        reschedule_reason: null,
        reschedule_requested_by: null,
        reschedule_requested_at: null,
        proposed_time: null,
        proposed_timezone: null,
        proposed_new_date: null,
        proposed_new_time: null,
        // A moved interview needs confirming again, so the reminders and the
        // calendar entry are not for a time nobody agreed to.
        reminder_24h_sent_at: null,
        reminder_1h_sent_at: null,
        updated_at: new Date().toISOString()
      })
      .eq('id', input.interviewId)
      .eq('reschedule_requested', true)
      .select()
      .maybeSingle();

    if (error) return fail(500, `The interview could not be moved: ${error.message}`);
    if (!moved) return fail(409, 'This reschedule request has already been answered.');

    const warnings = await notifyInterviewEvent(moved || interview, {
      talent: { event: 'interview_invitation', reason: input.note || null },
      client: { event: 'interview_sent_to_talent', reason: input.note || null }
    });
    await writeAudit(
      actor,
      'Reschedule Interview',
      `Moved "${interview.title}" to ${formatInstantInZone(newStart, 'UTC')} UTC` +
      (interview.scheduled_time ? ` from ${formatInstantInZone(interview.scheduled_time, 'UTC')} UTC.` : '.')
    );

    return { ok: true, status: 200, data: moved, warnings };
  } catch (err: any) {
    console.error('[interviewService] decideReschedule failed:', err);
    return fail(500, err?.message || 'The reschedule could not be applied.');
  }
}

// ─── Cancel ──────────────────────────────────────────────────────────────────

export async function cancelInterview(
  actor: Actor,
  input: { interviewId: string; reason?: string }
): Promise<ServiceResult> {
  if (!input.interviewId) return fail(400, 'interviewId is required.');

  try {
    const interview = await loadInterview(input.interviewId);
    if (!interview) return fail(404, 'Interview not found.');
    if (!actorOwnsInterview(actor, interview)) return fail(403, 'That interview is not yours.');

    const supabase = getSupabaseClient();
    const { data: cancelled, error } = await supabase
      .from('interviews')
      .update({
        status: 'Cancelled',
        notes: input.reason
          ? `${interview.notes ? interview.notes + '\n' : ''}Cancelled by ${actor.kind}: ${input.reason}`
          : interview.notes,
        updated_at: new Date().toISOString()
      })
      .eq('id', input.interviewId)
      .select()
      .maybeSingle();

    if (error) return fail(500, `The interview was not cancelled: ${error.message}`);

    // method: CANCEL on the .ics removes it from both calendars.
    const warnings = await notifyParties(
      cancelled || interview,
      'cancelled',
      input.reason ? `Reason: ${input.reason}` : undefined
    );
    await writeAudit(
      actor,
      'Cancel Interview',
      `"${interview.title}" cancelled by ${actor.kind}.` + (input.reason ? ` Reason: ${input.reason}` : '')
    );

    return { ok: true, status: 200, data: cancelled, warnings };
  } catch (err: any) {
    console.error('[interviewService] cancelInterview failed:', err);
    return fail(500, err?.message || 'The interview could not be cancelled.');
  }
}

// ─── Outcome ─────────────────────────────────────────────────────────────────

export async function rateInterview(
  actor: Actor,
  input: { interviewId: string; rating?: number; feedback?: string }
): Promise<ServiceResult> {
  if (!input.interviewId) return fail(400, 'interviewId is required.');
  if (actor.kind === 'talent') return fail(403, 'Candidates do not rate their own interviews.');
  if (input.rating !== undefined && (input.rating < 1 || input.rating > 5)) {
    return fail(400, 'A rating must be between 1 and 5.');
  }

  try {
    const interview = await loadInterview(input.interviewId);
    if (!interview) return fail(404, 'Interview not found.');
    if (!actorOwnsInterview(actor, interview)) return fail(403, 'That interview is not yours.');

    const supabase = getSupabaseClient();
    const { data: rated, error } = await supabase
      .from('interviews')
      .update({
        status: 'Completed',
        client_rating: input.rating ?? interview.client_rating,
        client_feedback: input.feedback ?? interview.client_feedback,
        updated_at: new Date().toISOString()
      })
      .eq('id', input.interviewId)
      .select()
      .maybeSingle();

    if (error) return fail(500, `The rating was not saved: ${error.message}`);

    await writeAudit(
      actor,
      'Rate Interview',
      `"${interview.title}" marked complete` +
      (input.rating ? ` with a ${input.rating}-star rating.` : '.')
    );

    return { ok: true, status: 200, data: rated };
  } catch (err: any) {
    console.error('[interviewService] rateInterview failed:', err);
    return fail(500, err?.message || 'The rating could not be saved.');
  }
}

/**
 * Moving a vetting interview to a new time, and closing one out.
 *
 * Both of these were done in the browser and never sent. The admin portal
 * rewrote the interview object in React state and attached it to a `payload`
 * that the stage-decision request does not carry, so rescheduling a vetting
 * interview changed nothing in the database and neither did marking one
 * completed. The candidate kept the old time, and a finished interview stayed
 * open in every queue that reads the table.
 */
export async function moveVettingInterview(
  actor: Actor,
  input: {
    interviewId: string;
    date?: string | null;
    time?: string | null;
    timezone?: string | null;
    scheduledTime?: string | null;
    meetingLink?: string | null;
  }
): Promise<ServiceResult> {
  if (!actor) return fail(401, 'Not authenticated.');
  if (actor.kind === 'talent') return fail(403, 'Candidates cannot move their own interviews.');

  const id = String(input.interviewId || '').trim();
  if (!id) return fail(400, 'Which interview?');

  const startsAt = resolveInstant(input as any);
  if (!startsAt) {
    return fail(400, 'A new time is required. Send scheduledTime, or date, time and timezone.');
  }
  if (new Date(startsAt).getTime() < Date.now()) {
    return fail(400, 'That slot is in the past.');
  }

  const supabase = getSupabaseClient();

  const { data: existing } = await supabase
    .from('interviews').select('*').eq('id', id).maybeSingle();
  if (!existing) return fail(404, 'That interview does not exist.');

  const zone = input.timezone || existing.scheduled_timezone || 'UTC';

  const { data: moved, error } = await supabase
    .from('interviews')
    .update({
      scheduled_time: startsAt,
      scheduled_timezone: zone,
      date: input.date || startsAt.slice(0, 10),
      time: input.time || existing.time,
      status: mapInterviewStatusToDb('Rescheduled'),
      meeting_link: isUsableMeetingLink(input.meetingLink) ? input.meetingLink : existing.meeting_link,
      // The negotiation is settled by this move, so none of it should be left
      // sitting on the row looking live.
      reschedule_requested: false,
      reschedule_reason: null,
      proposed_new_date: null,
      proposed_new_time: null
    })
    .eq('id', id)
    .select()
    .maybeSingle();

  if (error) return fail(500, `The interview could not be moved: ${error.message}`);

  await recordAudit(actor, {
    action: 'Reschedule Vetting Interview',
    details: `${existing.title || id}: moved to ${startsAt}.`,
    entityType: 'interview',
    entityId: id
  });

  const warnings: string[] = [];
  if (existing.talent_id) {
    const { data: talent } = await supabase
      .from('talent_profiles').select('user_id').eq('id', existing.talent_id).maybeSingle();
    if (talent?.user_id) {
      const notified = await notifyUsers(String(talent.user_id), 'interview_rescheduled', {
        when: startsAt,
        roleTitle: existing.title || 'your interview'
      });
      warnings.push(...notified.warnings);
    }
  }

  return { ok: true, status: 200, data: moved || existing, warnings };
}

/** Closing an interview out once the stage decision is taken. */
export async function completeInterview(
  actor: Actor,
  input: {
    interviewId: string;
    /** False records that it did not take place. Defaults to held. */
    held?: boolean;
    /** The operator's read, from interviews_admin_outcome_check. */
    outcome?: string | null;
    note?: string | null;
  }
): Promise<ServiceResult> {
  if (!actor) return fail(401, 'Not authenticated.');
  // Operations closes an interview out. It used to be whoever got there
  // first, and in practice nobody did: the only thing that set Completed was
  // a client opening a rating modal, and the decision that follows — offer or
  // pass — is only offered once an interview is known to be over. So an
  // interview nobody rated left the hire with nowhere to go at all.
  if (actor.kind !== 'admin') {
    return fail(403, 'Only operations can record whether an interview took place.');
  }
  const id = String(input.interviewId || '').trim();
  if (!id) return fail(400, 'Which interview?');

  const held = input.held !== false;
  if (held && input.outcome && !ADMIN_OUTCOMES.has(String(input.outcome))) {
    return fail(422, `An outcome must be one of: ${[...ADMIN_OUTCOMES].join(', ')}.`);
  }

  const supabase = getSupabaseClient();
  const interview = await loadInterview(id);
  if (!interview) return fail(404, 'That interview does not exist.');

  const move = advance(interview, held ? 'complete' : 'cancel');
  if ('error' in move) return fail(409, move.error);

  const { data, error } = await supabase
    .from('interviews')
    .update({
      status: move.stage,
      outcome: held ? (input.outcome || 'Held') : 'Did not take place',
      admin_outcome: held && input.outcome && ADMIN_OUTCOMES.has(String(input.outcome))
        ? String(input.outcome)
        : interview.admin_outcome || null,
      admin_note_internal: input.note || interview.admin_note_internal || null,
      updated_at: new Date().toISOString()
    })
    .eq('id', id)
    .select()
    .maybeSingle();

  if (error) return fail(500, `The interview was not closed out: ${error.message}`);

  const saved = data || interview;

  // The client is the one who decides what happens next, so closing an
  // interview has to reach them. Nothing told anybody before: the status
  // changed and the client was left to notice.
  const warnings = held
    ? await notifyInterviewEvent(saved, {
        client: { event: 'interview_outcome_due' },
        talent: { event: 'interview_completed' }
      })
    : await notifyInterviewEvent(saved, {
        client: { event: 'interview_did_not_happen', reason: input.note || null },
        talent: { event: 'interview_did_not_happen', reason: input.note || null }
      });

  await recordAudit(actor, {
    action: held ? 'Complete Interview' : 'Record Interview Not Held',
    details: `${interview.title || id}: ${held ? (input.outcome || 'held') : 'did not take place'}.`
      + (input.note ? ` ${input.note}` : ''),
    entityType: 'interview',
    entityId: id
  });

  return { ok: true, status: 200, data: saved, warnings };
}
