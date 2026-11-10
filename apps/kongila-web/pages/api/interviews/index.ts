import type { NextApiRequest, NextApiResponse } from 'next';
import { getRequestUser, scheduleInterview } from '@kongila/database';

/**
 * A client asks for an interview with a candidate.
 *
 * This replaces three browser write sites that inserted into the interviews
 * table directly with the anon key: the scheduling modal, the client
 * dashboard, and handleScheduleMeeting. None of them checked for a clash,
 * none notified the candidate, and none wrote an audit entry.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const actor = await getRequestUser(req);
  if (!actor) return res.status(401).json({ error: 'Not authenticated' });

  const result = await scheduleInterview(actor, req.body || {});
  if (!result.ok) return res.status(result.status).json({ error: result.error });

  const row = result.data || {};
  return res.status(result.status).json({
    interview: {
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
      clientTimezone: row.client_timezone,
      talentTimezone: row.talent_timezone,
      durationMinutes: row.duration_minutes,
      meetingLink: row.meeting_link,
      createdAt: row.created_at
    },
    warnings: result.warnings
  });
}
