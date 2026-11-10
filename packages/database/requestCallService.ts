import { getSupabaseClient } from './index';
import type { RequestActor as Actor } from './scope';
import { recordAudit } from './audit';
import { notifyAdmins, notifyUsers } from './notify';
import { requestTitle } from '@kongila/shared-types';
import { canAccessRequest } from './requestAccess';

export interface RequestCallResult {
  ok: boolean;
  status: number;
  error?: string;
  data?: any;
  warnings?: string[];
}

function fail(status: number, error: string): RequestCallResult {
  return { ok: false, status, error };
}

function validTimezone(value: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

function mapCall(row: any) {
  return {
    id: row.id,
    requestId: row.request_id,
    requestedBy: row.requested_by,
    respondedBy: row.responded_by,
    status: row.status,
    agenda: row.agenda,
    timezone: row.timezone,
    preferredTimes: row.preferred_times || [],
    clientNote: row.client_note,
    scheduledAt: row.scheduled_at,
    meetingLink: row.meeting_link,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

async function loadRequest(requestId: string): Promise<{ row: any; error?: string }> {
  const supabase = getSupabaseClient();
  const { data: row, error } = await supabase
    .from('talent_requests')
    .select('*')
    .eq('id', requestId)
    .maybeSingle();
  if (error) return { row: null, error: error.message };
  if (row) return { row };

  const { data: legacy, error: legacyError } = await supabase
    .from('talent_requests')
    .select('*')
    .eq('payload->>id', requestId)
    .maybeSingle();
  return { row: legacy, error: legacyError?.message };
}

async function clientOwnsRequest(actor: Actor, request: any): Promise<boolean> {
  if (String(request.client_id) === String(actor.userId)) return true;
  if (!actor.organizationId) return false;

  const { data, error } = await getSupabaseClient()
    .from('client_profiles')
    .select('user_id')
    .eq('organization_id', actor.organizationId);
  if (error) {
    console.error('[requestCallService] company membership lookup failed:', error.message);
    throw new Error('Your company membership could not be verified.');
  }
  const members = new Set((data || []).map((profile: any) => String(profile.user_id)));
  return members.has(String(actor.userId)) && members.has(String(request.client_id));
}

export async function createRequestCall(
  actor: Actor,
  input: { requestId: string; agenda?: string; timezone?: string }
): Promise<RequestCallResult> {
  if (!actor) return fail(401, 'Not authenticated.');
  if (actor.kind !== 'admin') return fail(403, 'Only Kongila administrators can request a call.');

  const requestId = String(input.requestId || '').trim();
  if (!requestId) return fail(400, 'A role request is required.');
  const agenda = String(input.agenda || '').trim();
  const timezone = String(input.timezone || 'UTC').trim();
  if (agenda.length > 2000) return fail(400, 'The call agenda must be 2,000 characters or fewer.');
  if (!validTimezone(timezone)) return fail(400, 'Choose a valid timezone.');

  const { row: request, error: loadError } = await loadRequest(requestId);
  if (loadError) return fail(500, `The role request could not be loaded: ${loadError}`);
  if (!request) return fail(404, 'The role request does not exist.');
  try {
    if (!await canAccessRequest(getSupabaseClient(), actor, request)) {
      return fail(404, 'The role request does not exist.');
    }
  } catch (accessError: any) {
    return fail(500, `Request ownership could not be verified: ${accessError.message}`);
  }

  const status = String(request.payload?.status || request.status || '').toLowerCase().replace(/[_-]+/g, ' ');
  if (['closed', 'closed/cancelled', 'onboarding'].includes(status)) {
    return fail(409, `A call cannot be requested for a ${status} role.`);
  }
  if (!request.client_id) return fail(409, 'This role request has no client to contact.');

  const supabase = getSupabaseClient();
  const { data: openCalls, error: openError } = await supabase
    .from('client_call_requests')
    .select('id')
    .eq('request_id', request.id)
    .in('status', ['requested', 'client_responded']);
  if (openError) return fail(500, `Existing call requests could not be checked: ${openError.message}`);
  if (openCalls?.length) return fail(409, 'There is already an open call request for this role.');

  const { data: row, error } = await supabase
    .from('client_call_requests')
    .insert({
      request_id: request.id,
      requested_by: actor.userId,
      status: 'requested',
      agenda: agenda || null,
      timezone
    })
    .select('*')
    .single();
  if (error?.code === '23505') return fail(409, 'There is already an open call request for this role.');
  if (error) return fail(500, `The call request could not be saved: ${error.message}`);

  const title = requestTitle({ ...(request.payload || {}), title: request.payload?.title || request.title });
  await recordAudit(actor, {
    action: 'Request Client Call',
    details: `Requested a call with the client about ${title}.`,
    entityType: 'talent_request',
    entityId: String(request.id)
  });
  const notification = await notifyUsers(String(request.client_id), 'client_call_requested', {
    roleTitle: title,
    reason: row.agenda || undefined
  }, { sourceRecordId: String(row.id) });

  return { ok: true, status: 201, data: mapCall(row), warnings: notification.warnings };
}

export async function respondToRequestCall(
  actor: Actor,
  input: { callRequestId: string; preferredTimes: string[]; timezone?: string; note?: string }
): Promise<RequestCallResult> {
  if (!actor) return fail(401, 'Not authenticated.');
  if (actor.kind !== 'client') return fail(403, 'Only the client can respond to this call request.');

  const callId = String(input.callRequestId || '').trim();
  const rawTimes = Array.isArray(input.preferredTimes) ? input.preferredTimes : [];
  if (rawTimes.some((value) => typeof value !== 'string' || !Number.isFinite(Date.parse(value)))) {
    return fail(400, 'All preferred times must be valid dates.');
  }
  const preferredTimes = rawTimes.map((value) => new Date(value).toISOString());
  if (!callId || preferredTimes.length < 1 || preferredTimes.length > 5) {
    return fail(400, 'Choose between one and five preferred call times.');
  }
  if (preferredTimes.some((value) => !Number.isFinite(Date.parse(value)) || Date.parse(value) <= Date.now())) {
    return fail(400, 'All preferred times must be valid future dates.');
  }
  const timezone = String(input.timezone || 'UTC').trim();
  const note = String(input.note || '').trim();
  if (!validTimezone(timezone)) return fail(400, 'Choose a valid timezone.');
  if (note.length > 1000) return fail(400, 'Your note must be 1,000 characters or fewer.');

  const supabase = getSupabaseClient();
  const { data: call, error: callError } = await supabase
    .from('client_call_requests')
    .select('*')
    .eq('id', callId)
    .maybeSingle();
  if (callError) return fail(500, `The call request could not be loaded: ${callError.message}`);
  if (!call) return fail(404, 'The call request does not exist.');

  const { row: request, error: requestError } = await loadRequest(String(call.request_id));
  if (requestError) return fail(500, `The role request could not be loaded: ${requestError}`);
  if (!request) return fail(404, 'The role request for this call no longer exists.');
  try {
    if (!(await clientOwnsRequest(actor, request))) return fail(403, 'This call request is not for your company.');
  } catch (error: any) {
    return fail(500, error.message);
  }
  if (call.status !== 'requested') return fail(409, 'This call request has already been answered.');

  const { data: updated, error: updateError } = await supabase
    .from('client_call_requests')
    .update({
      status: 'client_responded',
      preferred_times: preferredTimes,
      timezone,
      client_note: note || null,
      responded_by: actor.userId,
      responded_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('id', call.id)
    .eq('status', 'requested')
    .select('*')
    .maybeSingle();
  if (updateError) return fail(500, `Your preferred time could not be saved: ${updateError.message}`);
  if (!updated) return fail(409, 'This call request has already been answered.');

  const title = requestTitle({ ...(request.payload || {}), title: request.payload?.title || request.title });
  await recordAudit(actor, {
    action: 'Respond to Client Call Request',
    details: `Sent preferred call times for ${title}.`,
    entityType: 'talent_request',
    entityId: String(request.id)
  });
  const notification = await notifyAdmins('client_call_responded', {
    roleTitle: title,
    when: preferredTimes.map((value) => new Date(value).toLocaleString()).join(', ')
  }, { sourceRecordId: String(call.id) });
  return { ok: true, status: 200, data: mapCall(updated), warnings: notification.warnings };
}

export async function scheduleRequestCall(
  actor: Actor,
  input: { callRequestId: string; scheduledAt: string; meetingLink?: string }
): Promise<RequestCallResult> {
  if (!actor) return fail(401, 'Not authenticated.');
  if (actor.kind !== 'admin') return fail(403, 'Only Kongila administrators can schedule the call.');

  const callId = String(input.callRequestId || '').trim();
  const scheduledTimestamp = Date.parse(input.scheduledAt || '');
  if (!callId || !Number.isFinite(scheduledTimestamp) || scheduledTimestamp <= Date.now()) {
    return fail(400, 'Choose a valid future time for the call.');
  }
  const scheduledAt = new Date(scheduledTimestamp).toISOString();

  const meetingLink = String(input.meetingLink || '').trim();
  if (meetingLink) {
    try {
      if (new URL(meetingLink).protocol !== 'https:') return fail(400, 'The meeting link must use HTTPS.');
    } catch {
      return fail(400, 'The meeting link must be a valid HTTPS URL.');
    }
  }

  const supabase = getSupabaseClient();
  const { data: call, error: callError } = await supabase
    .from('client_call_requests')
    .select('*')
    .eq('id', callId)
    .maybeSingle();
  if (callError) return fail(500, `The call request could not be loaded: ${callError.message}`);
  if (!call) return fail(404, 'The call request does not exist.');
  if (call.status !== 'client_responded') return fail(409, 'The client must submit preferred times before the call can be scheduled.');
  if (!(call.preferred_times || []).some((value: string) => new Date(value).getTime() === Date.parse(scheduledAt))) {
    return fail(400, 'Choose one of the times proposed by the client.');
  }

  const { row: request, error: requestError } = await loadRequest(String(call.request_id));
  if (requestError) return fail(500, `The role request could not be loaded: ${requestError}`);
  if (!request) return fail(404, 'The role request for this call no longer exists.');
  try {
    if (!await canAccessRequest(supabase, actor, request)) {
      return fail(404, 'The call request does not exist.');
    }
  } catch (accessError: any) {
    return fail(500, `Request ownership could not be verified: ${accessError.message}`);
  }

  const { data: updated, error: updateError } = await supabase
    .from('client_call_requests')
    .update({
      status: 'scheduled',
      scheduled_at: scheduledAt,
      meeting_link: meetingLink || null,
      updated_at: new Date().toISOString()
    })
    .eq('id', call.id)
    .eq('status', 'client_responded')
    .select('*')
    .maybeSingle();
  if (updateError) return fail(500, `The call could not be scheduled: ${updateError.message}`);
  if (!updated) return fail(409, 'This call request has already been scheduled.');

  const title = requestTitle({ ...(request?.payload || {}), title: request?.payload?.title || request?.title });
  await recordAudit(actor, {
    action: 'Schedule Client Call',
    details: `Scheduled a client call about ${title} for ${scheduledAt}.`,
    entityType: 'talent_request',
    entityId: String(call.request_id)
  });
  const notification = request?.client_id
    ? await notifyUsers(String(request.client_id), 'client_call_scheduled', {
        roleTitle: title,
        when: new Date(scheduledAt).toLocaleString(undefined, { timeZone: call.timezone || 'UTC' }),
        joiningDetails: meetingLink || 'The Kongila team will share joining details.'
      }, { sourceRecordId: String(call.id) })
    : { warnings: ['The call was scheduled, but the client could not be notified because the request has no client.'] };
  return { ok: true, status: 200, data: mapCall(updated), warnings: notification.warnings };
}
