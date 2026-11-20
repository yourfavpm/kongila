import type { NextApiRequest, NextApiResponse } from 'next';
import {
  requirePermission,
  getRequestUser,
  scheduleInterview,
  moveVettingInterview,
  completeInterview
} from '@kongila/database';

/**
 * Scheduling a vetting interview.
 *
 * `scheduleInterview` existed; nothing called it for stage 3. The admin
 * portal built the interview row in the browser, put it in React state and
 * attached it to a `payload` object that is never sent — the request it rode
 * on carries the vetting pipeline and nothing else. So the stage recorded an
 * interviewId pointing at a row that was never written, the candidate was
 * never told, and the interview was gone on the next reload.
 *
 * `interviews.client_id` is NOT NULL and a vetting interview has no client,
 * so the operator scheduling it stands as the counterparty. That is honest —
 * the panel is Kongila — and it keeps the candidate's own interview list
 * complete. Client scoping is by request, and a vetting interview has no
 * request, so this never leaks into a client's view.
 *
 * POST { talentId, date, time, timezone?, meetingLink?, durationMinutes?,
 *        talentName?, talentTimezone?, title? }
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const actor = await getRequestUser(req);
  if (!actor) return res.status(401).json({ error: 'Not authenticated' });
  if (actor.kind !== 'admin') return res.status(403).json({ error: 'Not authorised' });

  // What this operator may do, checked against the permission the super
  // admin granted the role rather than against the role's name. Hiding a
  // tab is not access control; this is where the refusal happens.
  const refused = requirePermission(actor, 'interviews.manage');
  if (refused) return res.status(refused.status).json({ error: refused.error });

  const body = (req.body || {}) as Record<string, any>;

  // Moving one that already exists, and closing one out, were also done in
  // the browser and never sent: the stage panel rewrote the interview in
  // React state and attached it to the same unsent payload. So a reschedule
  // changed nothing and a finished interview stayed open everywhere.
  if (body.action === 'move') {
    const moved = await moveVettingInterview(actor, {
      interviewId: body.interviewId,
      date: body.date,
      time: body.time,
      timezone: body.timezone,
      meetingLink: body.meetingLink
    });
    if (!moved.ok) return res.status(moved.status).json({ error: moved.error });
    return res.status(200).json({ interview: moved.data, warnings: moved.warnings });
  }

  // Closing an interview out: it took place, or it did not. The client is
  // notified either way, because the decision that follows a held interview
  // is theirs and they cannot make it until they know it is over.
  if (body.action === 'complete') {
    const done = await completeInterview(actor, {
      interviewId: body.interviewId,
      held: body.held !== false,
      outcome: body.outcome,
      note: body.note
    });
    if (!done.ok) return res.status(done.status).json({ error: done.error });
    return res.status(200).json({ interview: done.data, warnings: done.warnings });
  }

  const result = await scheduleInterview(actor, {
    talentId: body.talentId,
    // No client on a vetting interview. The column will not take null.
    clientId: actor.userId,
    clientName: 'Kongila Vetting Panel',
    // The database stores the format here; the externally hosted meeting
    // URL remains a separate meetingLink, saved and emailed to the talent.
    interviewType: 'video',
    title: body.title || (body.talentName ? `Behavioural Interview: ${body.talentName}` : 'Behavioural Interview'),
    date: body.date,
    time: body.time,
    timezone: body.timezone,
    talentTimezone: body.talentTimezone,
    talentName: body.talentName,
    durationMinutes: body.durationMinutes,
    meetingLink: body.meetingLink,
    notes: body.notes
  });

  if (!result.ok) return res.status(result.status).json({ error: result.error });
  return res.status(result.status).json({ interview: result.data, warnings: result.warnings });
}
