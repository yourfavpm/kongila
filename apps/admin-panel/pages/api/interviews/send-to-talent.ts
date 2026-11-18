import type { NextApiRequest, NextApiResponse } from 'next';
import { getRequestUser, sendInterviewToTalent, declineInterviewRequest } from '@kongila/database';

/**
 * Operations answers a client's interview request.
 *
 * This is the step that was missing between the two portals. A client's
 * request used to be written straight to the candidate, so there was nothing
 * for operations to answer and no route for them to answer it on: by the time
 * the request appeared on the admin board the candidate had already been
 * asked, and a request operations did not want to put forward could only be
 * left sitting there.
 *
 * POST { interviewId, action: 'send' | 'decline', ... }
 *
 *   send    — put it to the candidate, optionally at a different time and
 *             with a joining link. Re-checks both diaries for a clash.
 *   decline — tell the client it is not going forward, with a reason.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const actor = await getRequestUser(req);
  if (!actor) return res.status(401).json({ error: 'Not authenticated' });
  if (actor.kind !== 'admin') {
    console.warn(`[interviews/send-to-talent] refused ${actor.kind} ${actor.userId}`);
    return res.status(403).json({ error: 'Not authorised' });
  }

  const body = (req.body || {}) as Record<string, any>;
  if (!body.interviewId) return res.status(400).json({ error: 'interviewId is required.' });

  const result = body.action === 'decline'
    ? await declineInterviewRequest(actor, {
        interviewId: String(body.interviewId),
        reason: body.reason
      })
    : await sendInterviewToTalent(actor, {
        interviewId: String(body.interviewId),
        scheduledTime: body.scheduledTime,
        date: body.date,
        time: body.time,
        timezone: body.timezone,
        durationMinutes: body.durationMinutes,
        meetingLink: body.meetingLink,
        note: body.note
      });

  if (!result.ok) return res.status(result.status).json({ error: result.error });
  return res.status(result.status).json({ interview: result.data, warnings: result.warnings });
}
