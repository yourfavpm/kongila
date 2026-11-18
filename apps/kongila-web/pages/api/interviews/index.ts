import type { NextApiRequest, NextApiResponse } from 'next';
import { getRequestUser, getSupabaseClient, scheduleInterview } from '@kongila/database';
import { mapInterviewStatusFromDb } from '@kongila/workflows';

/**
 * A client's interviews, and asking for a new one.
 *
 * POST replaces three browser write sites that inserted into the interviews
 * table directly with the anon key: the scheduling modal, the client
 * dashboard, and handleScheduleMeeting. None of them checked for a clash,
 * none notified the candidate, and none wrote an audit entry.
 *
 * GET did not exist. The client portal read its interviews only from the
 * scoped snapshot, which reaches them through `clientRequests` — so an
 * interview was visible to a client only if the request behind it resolved
 * through that one path, and when it did not the Interviews screen was simply
 * empty with nothing to say why. Requests have had their own authenticated
 * route for a while and work; this gives interviews the same, read directly
 * from the table and scoped by the company that owns the request.
 */

function toInterview(row: any) {
  return {
    id: row.id,
    requestId: row.request_id,
    matchId: row.match_id,
    talentId: row.talent_id,
    clientId: row.client_id,
    talentName: row.talent_name,
    talentAvatar: row.talent_avatar,
    clientName: row.client_name,
    title: row.title,
    date: row.date,
    time: row.time,
    status: mapInterviewStatusFromDb(row),
    interviewType: row.interview_type,
    durationMinutes: row.duration_minutes,
    meetingLink: row.meeting_link,
    notes: row.notes,
    clientRating: row.client_rating,
    clientFeedback: row.client_feedback,
    clientNotes: row.client_notes,
    outcome: row.admin_outcome,
    scheduledTime: row.scheduled_time,
    scheduledTimezone: row.scheduled_timezone,
    clientTimezone: row.client_timezone,
    talentTimezone: row.talent_timezone,
    rescheduleRequested: row.reschedule_requested,
    rescheduleReason: row.reschedule_reason,
    rescheduleRequestedBy: row.reschedule_requested_by,
    rescheduleRequestedAt: row.reschedule_requested_at,
    rescheduledFrom: row.rescheduled_from,
    proposedTime: row.proposed_time,
    proposedTimezone: row.proposed_timezone,
    proposedNewDate: row.proposed_new_date,
    proposedNewTime: row.proposed_new_time,
    talentDeclineReason: row.talent_decline_reason,
    // Every time the client said would work, and the one both sides settled on.
    proposedSlots: Array.isArray(row.proposed_slots) ? row.proposed_slots : [],
    confirmedSlot: row.confirmed_slot,
    revealedToTalentAt: row.revealed_to_talent_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

/** Everyone at the company, because a Kongila client account is a company. */
async function orgUserIds(supabase: any, actor: any): Promise<string[]> {
  if (!actor.organizationId) return [String(actor.userId)];
  const { data, error } = await supabase
    .from('client_profiles')
    .select('user_id')
    .eq('organization_id', actor.organizationId);
  // Narrowing to the caller on error is the safe direction to fail.
  if (error) {
    console.error('[interviews] could not resolve the organisation:', error.message);
    return [String(actor.userId)];
  }
  const ids = new Set<string>((data || []).map((r: any) => String(r.user_id)));
  ids.add(String(actor.userId));
  return [...ids];
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const actor = await getRequestUser(req);
  if (!actor) return res.status(401).json({ error: 'Not authenticated' });

  if (req.method === 'GET') {
    res.setHeader('Cache-Control', 'private, no-store');
    const supabase = getSupabaseClient();

    if (actor.kind === 'talent') {
      const ids = [actor.userId, actor.talentProfileId].filter(Boolean).map(String);
      const { data, error } = await supabase
        .from('interviews')
        .select('*')
        .in('talent_id', ids)
        .order('created_at', { ascending: false });
      if (error) {
        console.error('[interviews] list failed:', error.message);
        return res.status(500).json({ error: 'Could not load your interviews' });
      }
      return res.status(200).json({ interviews: (data || []).map(toInterview) });
    }

    if (actor.kind !== 'client') {
      return res.status(403).json({ error: 'Not authorised' });
    }

    const clientIds = await orgUserIds(supabase, actor);

    // Two ways an interview belongs to this company: the row names one of
    // its people as the client, or it hangs off one of its role requests.
    // Both are needed. client_id is the person who asked, and a colleague
    // filing the request means the row and the request disagree about who
    // the client is — which is exactly the case that went missing.
    const { data: requestRows, error: requestError } = await supabase
      .from('talent_requests')
      .select('id, payload')
      .in('client_id', clientIds);
    if (requestError) {
      console.error('[interviews] request lookup failed:', requestError.message);
      return res.status(500).json({ error: 'Could not load your interviews' });
    }

    const requestIds = new Set<string>();
    for (const row of requestRows || []) {
      requestIds.add(String(row.id));
      if (row.payload?.id) requestIds.add(String(row.payload.id));
    }

    const filters = [
      `client_id.in.(${clientIds.join(',')})`,
      ...(requestIds.size > 0 ? [`request_id.in.(${[...requestIds].join(',')})`] : [])
    ];

    const { data, error } = await supabase
      .from('interviews')
      .select('*')
      .or(filters.join(','))
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[interviews] list failed:', error.message);
      return res.status(500).json({ error: 'Could not load your interviews' });
    }

    return res.status(200).json({ interviews: (data || []).map(toInterview) });
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const result = await scheduleInterview(actor, req.body || {});
  if (!result.ok) return res.status(result.status).json({ error: result.error });

  return res.status(result.status).json({
    interview: toInterview(result.data || {}),
    warnings: result.warnings
  });
}
