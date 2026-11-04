import type { NextApiRequest, NextApiResponse } from 'next';
import {
  readDbAsync,
  writeDbAsync,
  getRequestUser,
  getSupabaseClient,
  scheduleInterview,
  cancelInterview,
  decideReschedule
} from '@kongila/database';
import { findSchedulingConflicts, describeConflict } from '@kongila/workflows';
import { interviewInstant, formatInstantInZone } from '@kongila/utils';
import { sendInterviewInvitation, emailIsConfigured } from '@kongila/notifications';

/**
 * Interviews, admin side.
 *
 * Three things this route used to do that it no longer does:
 *
 *   1. It invented a Google Meet link — `meet.google.com/` plus ten random
 *      letters. Well-formed, and completely fictitious, so both parties were
 *      given a link that went nowhere.
 *   2. It invented a Google Calendar event id and a "render" link, neither of
 *      which corresponds to an event, because no calendar integration exists.
 *   3. It wrote an audit entry saying "Google Calendar event created" and an
 *      agent log saying "Meet link generated & calendar synced", for things
 *      that had not happened. The audit log is the record of what was done,
 *      so it cannot carry claims that were never true.
 *
 * Instead: the operator supplies a real meeting link when they have one, and
 * until they do both portals say the joining details will follow, which is
 * accurate. A genuine .ics invitation is emailed to both parties, so the
 * event reaches their calendars at the right local time.
 */

function isUsableMeetingLink(value: unknown): boolean {
  const link = String(value || '').trim();
  if (!link) return false;
  try {
    return new URL(link).protocol === 'https:';
  } catch {
    return false;
  }
}

/** Emails the invitation to whoever has an address, with the .ics attached. */
async function sendInvitations(
  interview: any,
  db: any,
  kind: 'scheduled' | 'rescheduled'
): Promise<string[]> {
  if (!emailIsConfigured()) {
    return ['Email is not configured, so no invitation was sent.'];
  }

  const startsAt = interviewInstant(interview);
  if (!startsAt) return ['The interview has no scheduled time, so no invitation was sent.'];

  const problems: string[] = [];
  const users = db.users || [];
  const recipients = [
    { id: interview.talentId, zone: interview.talentTimezone, label: interview.talentName || 'there' },
    { id: interview.clientId, zone: interview.clientTimezone, label: interview.clientName || 'there' }
  ].filter(r => r.id);

  for (const recipient of recipients) {
    const user = users.find((u: any) => String(u.id) === String(recipient.id));
    if (!user?.email) {
      problems.push(`No email address on file for ${recipient.label}.`);
      continue;
    }

    const localTime = formatInstantInZone(startsAt, recipient.zone || 'UTC');
    const joining = isUsableMeetingLink(interview.meetingLink)
      ? `Joining link: ${interview.meetingLink}`
      : 'Joining details will follow before the call.';

    const result = await sendInterviewInvitation({
      to: user.email,
      subject: kind === 'rescheduled'
        ? `Rescheduled: ${interview.title || 'Your Kongila interview'}`
        : (interview.title || 'Your Kongila interview'),
      body:
        `Hi ${recipient.label},\n\n` +
        `${kind === 'rescheduled' ? 'This interview has been moved.' : 'Your interview is confirmed.'}\n\n` +
        `${localTime}${recipient.zone ? '' : ' (UTC — set your timezone to see this in your own time)'}\n\n` +
        `${joining}\n\n` +
        `The attached calendar file adds this to your calendar at the correct local time.\n\n` +
        `The Kongila team`,
      invite: {
        uid: `kongila-interview-${interview.id}@kongila`,
        title: interview.title || 'Kongila interview',
        description: joining,
        startsAt,
        durationMinutes: Number(interview.durationMinutes) || 60,
        location: isUsableMeetingLink(interview.meetingLink) ? interview.meetingLink : undefined,
        // Bumped on a reschedule, or calendar clients ignore the update.
        sequence: kind === 'rescheduled' ? Date.now() % 1000 : 0,
        method: 'REQUEST'
      }
    });

    if (!result.success) {
      problems.push(`Invitation to ${recipient.label} was not sent: ${result.error}`);
    }
  }

  return problems;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Admin portal route. A talent or client session is a valid session and
  // still has no business here, so check the kind, not just that someone is
  // signed in. This runs before any database read.
  const actor = await getRequestUser(req);
  if (!actor) return res.status(401).json({ error: 'Not authenticated' });
  if (actor.kind !== 'admin') {
    console.warn('[api/interviews] refused ' + actor.kind + ' ' + actor.userId);
    return res.status(403).json({ error: 'Not authorised' });
  }
  const auditActor = actor.email || actor.userId;

  if (req.method === 'GET') {
    const { data, error } = await getSupabaseClient()
      .from('interviews')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) return res.status(500).json({ error: 'Could not load interviews' });
    return res.status(200).json((data || []).map((row: any) => ({
      ...row,
      requestId: row.request_id,
      matchId: row.match_id,
      talentId: row.talent_id,
      clientId: row.client_id,
      talentName: row.talent_name,
      talentAvatar: row.talent_avatar,
      clientName: row.client_name,
      scheduledTime: row.scheduled_time,
      scheduledTimezone: row.scheduled_timezone,
      durationMinutes: row.duration_minutes,
      meetingLink: row.meeting_link,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      rescheduleRequested: row.reschedule_requested,
      rescheduleReason: row.reschedule_reason,
      rescheduleRequestedBy: row.reschedule_requested_by,
      rescheduleRequestedAt: row.reschedule_requested_at,
      proposedTime: row.proposed_time,
      proposedTimezone: row.proposed_timezone
    })));
  }

  // All admin mutations use the shared service and the live Supabase tables.
  // The legacy snapshot implementation below is retained only as unreachable
  // compatibility code while the remaining callers are migrated.
  if (req.method === 'POST') {
    const result = await scheduleInterview(actor, req.body || {});
    if (!result.ok) return res.status(result.status).json({ error: result.error });
    return res.status(result.status).json({ interview: result.data, warnings: result.warnings });
  }

  if (req.method === 'PUT') {
    const body = req.body || {};
    const interviewId = String(body.id || body.interviewId || '');
    if (!interviewId) return res.status(400).json({ error: 'Missing interview id' });

    if (body.action === 'cancel' || body.status === 'Cancelled') {
      const result = await cancelInterview(actor, { interviewId, reason: body.reason });
      if (!result.ok) return res.status(result.status).json({ error: result.error });
      return res.status(result.status).json({ interview: result.data, warnings: result.warnings });
    }

    if (body.action === 'reschedule' || body.approve !== undefined) {
      const result = await decideReschedule(actor, { ...body, interviewId, approve: body.approve !== false });
      if (!result.ok) return res.status(result.status).json({ error: result.error });
      return res.status(result.status).json({ interview: result.data, warnings: result.warnings });
    }

    const allowed: Record<string, unknown> = {};
    if (typeof body.meetingLink === 'string' || body.meetingLink === null) allowed.meeting_link = body.meetingLink;
    if (typeof body.notes === 'string' || body.notes === null) allowed.notes = body.notes;
    if (typeof body.title === 'string' && body.title.trim()) allowed.title = body.title.trim();
    if (Object.keys(allowed).length === 0) return res.status(400).json({ error: 'No supported interview fields supplied' });
    allowed.updated_at = new Date().toISOString();

    const { data, error } = await getSupabaseClient()
      .from('interviews').update(allowed).eq('id', interviewId).select('*').maybeSingle();
    if (error) return res.status(500).json({ error: 'Could not update the interview' });
    if (!data) return res.status(404).json({ error: 'Interview not found' });
    return res.status(200).json({ interview: data });
  }

  if (req.method === 'DELETE') {
    const interviewId = String(req.query.id || '');
    if (!interviewId) return res.status(400).json({ error: 'Missing interview id' });
    const result = await cancelInterview(actor, { interviewId, reason: String(req.query.reason || '') || undefined });
    if (!result.ok) return res.status(result.status).json({ error: result.error });
    return res.status(result.status).json({ interview: result.data, warnings: result.warnings });
  }

  const db = await readDbAsync();
  if (!db.interviews) (db as any).interviews = [];

  if (req.method === 'POST') {
    const body = req.body as any;

    const startsAt = interviewInstant(body);
    if (!startsAt) {
      return res.status(400).json({
        error: 'An interview needs a scheduled time. Send scheduledTime as a UTC instant, ' +
               'or date, time and scheduledTimezone together.'
      });
    }

    // Nobody can be in two interviews at once. There was no check at all, so
    // the same candidate could be booked by two clients for the same moment.
    const conflicts = findSchedulingConflicts(
      {
        startsAt,
        durationMinutes: Number(body.durationMinutes) || 60,
        talentId: body.talentId,
        clientId: body.clientId
      },
      db.interviews
    );
    if (conflicts.length > 0) {
      return res.status(409).json({ error: describeConflict(conflicts), conflicts });
    }

    const newInterview: any = {
      ...body,
      id: `interview_${Date.now()}`,
      scheduledTime: startsAt,
      // No invented link. A real one supplied by the operator is kept;
      // otherwise the portals say joining details will follow.
      meetingLink: isUsableMeetingLink(body.meetingLink) ? body.meetingLink : null,
      createdAt: new Date().toISOString()
    };

    db.interviews.push(newInterview);

    const emailProblems = await sendInvitations(newInterview, db, 'scheduled');

    db.auditLogs = [
      {
        id: `audit_${Date.now()}`,
        actor: auditActor,
        action: 'Schedule Interview',
        // Says what happened, and nothing else.
        details:
          `Booked "${body.title}" with ${body.talentName} for ${formatInstantInZone(startsAt, 'UTC')}. ` +
          (newInterview.meetingLink ? 'Joining link supplied by operator. ' : 'No joining link yet. ') +
          (emailProblems.length === 0 ? 'Invitations emailed.' : `Invitations incomplete: ${emailProblems.join(' ')}`),
        timestamp: new Date().toISOString()
      },
      ...(db.auditLogs || [])
    ];

    if (body.matchId && db.matches) {
      db.matches = db.matches.map((m: any) =>
        m.id === body.matchId ? { ...m, status: 'Interview Scheduled' as const } : m
      );
    }

    db.notifications = [
      {
        id: `notif_${Date.now()}`,
        userId: body.talentId,
        title: 'Interview Scheduled',
        message:
          `${body.title} — ${formatInstantInZone(startsAt, body.talentTimezone || 'UTC')}. ` +
          (newInterview.meetingLink ? 'The joining link is on your interviews page.' : 'Joining details will follow.'),
        read: false,
        createdAt: new Date().toISOString()
      },
      ...(db.notifications || [])
    ];

    await writeDbAsync(db);
    return res.status(201).json({ interview: newInterview, warnings: emailProblems });
  }

  if (req.method === 'PUT') {
    const { id, ...updates } = req.body as any;
    if (!id) return res.status(400).json({ error: 'Missing interview id' });

    const existing = db.interviews.find((iv: any) => iv.id === id);
    if (!existing) return res.status(404).json({ error: 'Interview not found' });

    const merged: any = { ...existing, ...updates };
    const startsAt = interviewInstant(merged);
    const movedInTime = Boolean(startsAt && startsAt !== interviewInstant(existing));

    if (movedInTime) {
      const conflicts = findSchedulingConflicts(
        {
          startsAt: startsAt as string,
          durationMinutes: Number(merged.durationMinutes) || 60,
          talentId: merged.talentId,
          clientId: merged.clientId,
          excludeInterviewId: String(id)
        },
        db.interviews
      );
      if (conflicts.length > 0) {
        return res.status(409).json({ error: describeConflict(conflicts), conflicts });
      }
    }

    const updated: any = {
      ...merged,
      scheduledTime: startsAt || merged.scheduledTime,
      // Keep what it moved from, so the history is not lost.
      rescheduledFrom: movedInTime ? interviewInstant(existing) : merged.rescheduledFrom,
      meetingLink: isUsableMeetingLink(merged.meetingLink) ? merged.meetingLink : null,
      updatedAt: new Date().toISOString()
    };
    db.interviews = db.interviews.map((iv: any) => (iv.id === id ? updated : iv));

    const emailProblems = movedInTime ? await sendInvitations(updated, db, 'rescheduled') : [];

    db.auditLogs = [
      {
        id: `audit_${Date.now()}`,
        actor: auditActor,
        action: movedInTime ? 'Reschedule Interview' : 'Update Interview',
        details:
          `Interview "${updated.title}" with ${updated.talentName}` +
          (movedInTime ? ` moved to ${formatInstantInZone(startsAt, 'UTC')}.` : ' updated.') +
          (emailProblems.length > 0 ? ` Invitations incomplete: ${emailProblems.join(' ')}` : ''),
        timestamp: new Date().toISOString()
      },
      ...(db.auditLogs || [])
    ];

    await writeDbAsync(db);
    return res.status(200).json({ interview: updated, warnings: emailProblems });
  }

  if (req.method === 'DELETE') {
    const { id } = req.query;
    const target = db.interviews.find((iv: any) => iv.id === id);
    if (!target) return res.status(404).json({ error: 'Interview not found' });

    // Cancelled, not deleted. Removing the row loses the record of what was
    // arranged, and frees the slot with no trace of why.
    db.interviews = db.interviews.map((iv: any) =>
      iv.id === id ? { ...iv, status: 'Cancelled', updatedAt: new Date().toISOString() } : iv
    );

    db.auditLogs = [
      {
        id: `audit_${Date.now()}`,
        actor: auditActor,
        action: 'Cancel Interview',
        details: `Interview "${target.title}" with ${target.talentName} cancelled.`,
        timestamp: new Date().toISOString()
      },
      ...(db.auditLogs || [])
    ];
    await writeDbAsync(db);
    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
