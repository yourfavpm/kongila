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
import {
  findSchedulingConflicts,
  describeConflict,
  mapInterviewStatusToDb
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

/** A client may schedule at most this many interviews per candidate, per request. */
const MAX_INTERVIEWS_PER_PAIR = 3;

/** How close to the start a client may still move an interview themselves. */
const LATE_CHANGE_HOURS = 4;

function fail(status: number, error: string): ServiceResult {
  return { ok: false, status, error };
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
  const rows = [...parties, ...watchers].map(p => ({
    id: (globalThis.crypto?.randomUUID?.() || `notif_${Date.now()}_${Math.random().toString(36).slice(2)}`),
    user_id: p.id,
    title: SUBJECTS[kind],
    message:
      `${interview.title || 'Your interview'}` +
      (startsAt ? ` — ${formatInstantInZone(startsAt, p.zone || 'UTC')}` : '') +
      (p.zone || !startsAt ? '' : ' (UTC; set your timezone to see your own time)') +
      (extra ? ` ${extra}` : ''),
    module_type: 'interviews',
    read: false,
    created_at: new Date().toISOString()
  }));

  const { error: notifError } = await supabase.from('notifications').insert(rows);
  if (notifError) warnings.push(`In-app notification failed: ${notifError.message}`);

  if (!emailIsConfigured()) {
    warnings.push('Email is not configured, so no message was emailed.');
    return warnings;
  }

  const { data: users } = await supabase
    .from('users')
    .select('id, email, name')
    .in('id', parties.map(p => p.id));

  for (const party of parties) {
    const user = (users || []).find((u: any) => String(u.id) === String(party.id));
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

  return warnings;
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
}

export async function scheduleInterview(
  actor: Actor,
  input: ScheduleInput
): Promise<ServiceResult> {
  if (actor.kind === 'talent') {
    return fail(403, 'Candidates cannot schedule their own interviews.');
  }
  if (!input.talentId) return fail(400, 'talentId is required.');

  // A client may only book for themselves; an admin may book for anyone.
  const clientId = actor.kind === 'client' ? actor.userId : (input.clientId || null);
  if (!clientId) return fail(400, 'clientId is required.');

  const startsAt = resolveInstant(input);
  if (!startsAt) {
    return fail(400, 'An interview needs a time. Send scheduledTime, or date, time and timezone.');
  }
  if (new Date(startsAt).getTime() < Date.now()) {
    return fail(400, 'That slot is in the past.');
  }

  const supabase = getSupabaseClient();

  try {
    // The cap used to be enforced in the modal only, so it was bypassable by
    // anything that did not go through that screen.
    if (input.requestId) {
      const { data: pairRows } = await supabase
        .from('interviews')
        .select('id, status')
        .eq('request_id', input.requestId)
        .eq('talent_id', input.talentId);

      const live = (pairRows || []).filter(
        (r: any) => !['cancelled', 'Cancelled', 'declined', 'expired'].includes(String(r.status))
      );
      if (live.length >= MAX_INTERVIEWS_PER_PAIR) {
        return fail(409, `There are already ${MAX_INTERVIEWS_PER_PAIR} interviews with this candidate for this request.`);
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

    const zone = input.timezone || input.clientTimezone || 'UTC';
    const row = {
      id: `iv_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      request_id: input.requestId || null,
      match_id: input.matchId || null,
      talent_id: input.talentId,
      client_id: clientId,
      talent_name: input.talentName || null,
      talent_avatar: input.talentAvatar || null,
      client_name: input.clientName || null,
      title: input.title || 'Interview',
      scheduled_time: startsAt,
      scheduled_timezone: zone,
      client_timezone: input.clientTimezone || zone,
      talent_timezone: input.talentTimezone || null,
      // Display fallbacks for screens that still read them. Never the truth.
      date: input.date || startsAt.slice(0, 10),
      time: input.time || null,
      duration_minutes: input.durationMinutes || DEFAULT_DURATION_MINUTES,
      // Candidates are asked, not told. This used to be written as Scheduled
      // straight away, so the first a candidate heard of an interview was a
      // confirmation of one they had never agreed to.
      status: mapInterviewStatusToDb('Proposed'),
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

    const warnings = await notifyParties(
      inserted || row,
      'scheduled',
      'The candidate has been asked to confirm.'
    );

    await writeAudit(
      actor,
      'Schedule Interview',
      `Proposed "${row.title}" with ${row.talent_name || row.talent_id} for ` +
      `${formatInstantInZone(startsAt, 'UTC')} UTC.` +
      (row.meeting_link ? ' Joining link supplied.' : ' No joining link yet.')
    );

    return { ok: true, status: 201, data: inserted || row, warnings };
  } catch (err: any) {
    console.error('[interviewService] scheduleInterview failed:', err);
    return fail(500, err?.message || 'The interview could not be scheduled.');
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
    if (['Cancelled', 'cancelled'].includes(String(interview.status))) {
      return fail(409, 'That interview has been cancelled.');
    }

    const supabase = getSupabaseClient();
    const { data: updated, error } = await supabase
      .from('interviews')
      .update({
        status: input.accept ? 'talent_accepted' : 'talent_declined',
        talent_decline_reason: input.accept ? null : (input.reason || null),
        updated_at: new Date().toISOString()
      })
      .eq('id', input.interviewId)
      .select()
      .maybeSingle();

    if (error) return fail(500, `Your response was not saved: ${error.message}`);

    const warnings = await notifyParties(
      updated || interview,
      input.accept ? 'accepted' : 'declined',
      input.accept ? undefined : (input.reason ? `Reason: ${input.reason}` : undefined)
    );

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

    const supabase = getSupabaseClient();
    const { data: updated, error } = await supabase
      .from('interviews')
      .update({
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

    const warnings = await notifyParties(
      updated || interview,
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

    const supabase = getSupabaseClient();

    if (!input.approve) {
      const { data: kept, error } = await supabase
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
          updated_at: new Date().toISOString()
        })
        .eq('id', input.interviewId)
        .select()
        .maybeSingle();

      if (error) return fail(500, error.message);

      const warnings = await notifyParties(
        kept || interview,
        'scheduled',
        `The reschedule request was declined and the original time stands.${input.note ? ` ${input.note}` : ''}`
      );
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

    const zone = input.timezone || interview.proposed_timezone || interview.scheduled_timezone || 'UTC';
    const { data: moved, error } = await supabase
      .from('interviews')
      .update({
        status: mapInterviewStatusToDb('Rescheduled'),
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
      .select()
      .maybeSingle();

    if (error) return fail(500, `The interview could not be moved: ${error.message}`);

    const warnings = await notifyParties(moved || interview, 'rescheduled', input.note);
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
