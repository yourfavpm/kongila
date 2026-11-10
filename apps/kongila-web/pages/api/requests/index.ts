import type { NextApiRequest, NextApiResponse } from 'next';
import { getRequestUser, getSupabaseClient, recordAudit, notifyAdmins } from '@kongila/database';
import { isSignedHireContract, normalizeRequestStatus } from '@kongila/workflows';
import {
  requestTitle,
  validateRequestRoles
} from '@kongila/shared-types';

const SERVICE_TYPES = new Set([
  'Hire Talent',
  'Outsource Talent',
  'Managed Workforce',
  'Project Execution',
  'placement',
  'outsourcing',
  'managed_workforce',
  'project',
  // A client asking for someone back. It went in as a browser insert into
  // talent_requests, which skipped this check, the reference number and the
  // audit entry, so a re-hire never appeared in the operations queue the way
  // every other request does.
  'Re-hire'
]);

function toRequest(row: any) {
  const payload = row.payload || {};
  return {
    ...payload,
    id: row.id,
    payloadId: payload.id || null,
    rowId: row.id,
    clientId: row.client_id,
    serviceType: payload.serviceType || row.service_type,
    // The title column was written on insert and read by nobody, so every
    // screen fell back to truncating the description. Resolving it here means
    // a request filed before the column was read still comes back named.
    title: requestTitle({ ...payload, title: payload.title || row.title }),
    status: normalizeRequestStatus(payload.status || row.status) || 'New Request',
    createdAt: payload.createdAt || row.created_at
  };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const actor = await getRequestUser(req);
  if (!actor) return res.status(401).json({ error: 'Not authenticated' });
  if (actor.kind !== 'client') return res.status(403).json({ error: 'Only clients can use this request endpoint' });

  const supabase = getSupabaseClient();

  // Everyone at the same company, because the account is the company. A
  // Kongila client account belongs to an organisation and the person who
  // signed up is its primary contact, so a colleague filing a request is
  // filing it for the same account.
  //
  // scopeDbForUser has always scoped requests this way, through orgUserIds.
  // This route filtered on client_id alone, so the same client saw the
  // organisation's requests on one screen and only their own on another,
  // depending on which path the screen happened to read from.
  const orgClientIds = async (): Promise<string[]> => {
    if (!actor.organizationId) return [actor.userId];
    const { data, error } = await supabase
      .from('client_profiles')
      .select('user_id')
      .eq('organization_id', actor.organizationId);
    // Narrowing to the caller on error is the safe direction to fail: they see
    // less than they should rather than more.
    if (error) {
      console.error('[requests] could not resolve the organisation:', error.message);
      return [actor.userId];
    }
    const ids = new Set<string>((data || []).map((r: any) => String(r.user_id)));
    ids.add(String(actor.userId));
    return [...ids];
  };

  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('talent_requests')
      .select('*')
      .in('client_id', await orgClientIds())
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[requests] list failed:', error.message);
      return res.status(500).json({ error: 'Could not load your requests' });
    }

    const rows = data || [];
    const requestIdToRowId = new Map<string, string>();
    for (const row of rows) {
      requestIdToRowId.set(String(row.id), String(row.id));
      if (row.payload?.id) requestIdToRowId.set(String(row.payload.id), String(row.id));
    }

    const requestIds = [...requestIdToRowId.keys()];
    const { data: offers, error: offersError } = requestIds.length
      ? await supabase.from('offers').select('id, request_id, match_id, talent_id, status').in('request_id', requestIds)
      : { data: [] as any[], error: null };
    if (offersError) {
      console.error('[requests] hire progress lookup failed:', offersError.message);
      return res.status(500).json({ error: 'Could not load hiring progress' });
    }

    const offerIds = (offers || []).map((offer: any) => String(offer.id));
    const offerToRequest = new Map<string, string>(
      (offers || []).map((offer: any) => [
        String(offer.id),
        requestIdToRowId.get(String(offer.request_id)) || String(offer.request_id)
      ])
    );
    const { data: contracts, error: contractsError } = offerIds.length
      ? await supabase.from('contracts').select('offer_id, status').in('offer_id', offerIds)
      : { data: [] as any[], error: null };
    if (contractsError) {
      console.error('[requests] signed hire lookup failed:', contractsError.message);
      return res.status(500).json({ error: 'Could not load signed hires' });
    }

    const rowIds = rows.map((row: any) => String(row.id));
    const { data: callRows, error: callsError } = rowIds.length
      ? await supabase
          .from('client_call_requests')
          .select('*')
          .in('request_id', rowIds)
          .order('created_at', { ascending: false })
      : { data: [] as any[], error: null };
    if (callsError) {
      console.error('[requests] call request lookup failed:', callsError.message);
    }

    const filledByRequest = new Map<string, number>();
    for (const contract of contracts || []) {
      if (!isSignedHireContract(contract)) continue;
      const requestRowId = offerToRequest.get(String(contract.offer_id));
      if (requestRowId) filledByRequest.set(requestRowId, (filledByRequest.get(requestRowId) || 0) + 1);
    }

    return res.status(200).json({
      requests: rows.map((row: any) => ({
        ...toRequest(row),
        filledCount: filledByRequest.get(String(row.id)) || 0,
        offers: (offers || [])
          .filter((offer: any) => requestIdToRowId.get(String(offer.request_id)) === String(row.id))
          .map((offer: any) => ({
            id: offer.id,
            requestId: requestIdToRowId.get(String(offer.request_id)) || offer.request_id,
            matchId: offer.match_id,
            talentId: offer.talent_id,
            status: offer.status
          })),
        callRequests: (callRows || [])
          .filter((call: any) => String(call.request_id) === String(row.id))
          .map((call: any) => ({
            id: call.id,
            requestId: call.request_id,
            requestedBy: call.requested_by,
            respondedBy: call.responded_by,
            status: call.status,
            agenda: call.agenda,
            timezone: call.timezone,
            preferredTimes: call.preferred_times || [],
            clientNote: call.client_note,
            scheduledAt: call.scheduled_at,
            meetingLink: call.meeting_link,
            createdAt: call.created_at
          })),
        callRequestWarning: callsError
          ? 'Client call scheduling is unavailable until the client_call_requests database migration is applied.'
          : undefined
      }))
    });
  }

  if (req.method === 'PATCH') {
    const requestId = String(req.body?.requestId || req.body?.request?.id || '').trim();
    const changes = req.body?.patch || req.body?.request || {};
    if (!requestId || !changes || typeof changes !== 'object') {
      return res.status(400).json({ error: 'A request id and patch are required' });
    }

    const visibleIds = await orgClientIds();
    const { data: rows, error: loadError } = await supabase
      .from('talent_requests')
      .select('*')
      .in('client_id', visibleIds);
    if (loadError) return res.status(500).json({ error: 'Could not load the request' });

    const row = (rows || []).find((candidate: any) =>
      String(candidate.id) === requestId || String(candidate.payload?.id || '') === requestId
    );
    if (!row) return res.status(404).json({ error: 'Request not found' });

    // What a client may change about their own request.
    //
    // This was four fields — roleDescription, serviceType, numberOfHires and
    // status — which is both too little and too much. Too little, because the
    // answers most likely to be wrong on a first attempt are the skills, the
    // seniority, the budget and the start date, and none of them could be
    // corrected. Too much, because status is an operations stage: a client
    // could move their own request to Offer Accepted. Cancelling is the one
    // status change that is theirs to make, and it is handled below as its own
    // decision rather than as a free-text status.
    const CLIENT_EDITABLE = [
      // What the work is
      'roleTitle', 'roleDescription', 'seniorityLevel', 'keyResponsibilities',
      'teamDescription', 'serviceDescription', 'supervisionLevel', 'performanceMetrics',
      'projectName', 'projectDescription', 'keyDeliverables', 'projectDeadline',
      // How much of it
      // `roles` is absent: a request is for one role, so there is no array
      // to edit. A client who wants another role files another request.
      'serviceType', 'numberOfHires', 'teamSize', 'requiredSkills',
      // When and where
      'startDate', 'durationType', 'durationMonths', 'partTimeHours',
      'commitmentLevel', 'preferredTimezones',
      // What it is worth
      'currency', 'budgetMinUsd', 'budgetMaxUsd', 'budgetUnknown',
      // How pressing, and anything else
      'urgencyLevel', 'additionalNotes'
    ];

    const safePatch = Object.fromEntries(
      CLIENT_EDITABLE.filter((key) => Object.prototype.hasOwnProperty.call(changes, key))
        .map((key) => [key, changes[key]])
    );

    // Cancelling is the client's decision and the only status they can set.
    const wantsCancel = changes.status === 'Closed' || changes.cancel === true;
    if (changes.status !== undefined && changes.status !== 'Closed') {
      return res.status(403).json({
        error: 'A request\'s stage is set by your Kongila team. You can cancel a request, or edit its details.'
      });
    }

    if (Object.keys(safePatch).length === 0 && !wantsCancel) {
      return res.status(400).json({ error: 'That patch contains nothing a client can change.' });
    }

    if (safePatch.serviceType && !SERVICE_TYPES.has(String(safePatch.serviceType))) {
      return res.status(422).json({ error: 'A valid service type is required' });
    }

    if (safePatch.numberOfHires !== undefined) {
      const count = Number(safePatch.numberOfHires);
      if (!Number.isInteger(count) || count < 1 || count > 100) {
        return res.status(422).json({ error: 'How many people must be a whole number between 1 and 100.' });
      }
    }

    // A request stored while one could hold several roles keeps its array for
    // reading, but an edit is about this request's own role, so the stale
    // array is dropped rather than left to contradict the fields beside it.
    // requestTitle prefers `roles`, so leaving it would mean a client edits
    // the title and sees nothing change.
    if (Array.isArray((row.payload || {}).roles) && Object.keys(safePatch).length > 0) {
      safePatch.roles = undefined;
    }

    // Once candidates are in front of the client, the brief they were sourced
    // against is no longer the client's alone to rewrite: the shortlist,
    // interviews and any offer were all built on it. Notes stay open so they
    // can still say what changed, and cancelling stays open throughout.
    const LOCKED_AFTER = new Set(['Candidates Ready', 'Client Interview', 'Offer Accepted', 'Onboarding', 'Closed']);
    const currentStatus = normalizeRequestStatus(row.payload?.status || row.status) || 'New Request';
    if (LOCKED_AFTER.has(currentStatus)) {
      const substantive = Object.keys(safePatch).filter((key) => key !== 'additionalNotes');
      if (substantive.length > 0) {
        return res.status(409).json({
          error: `This request has reached ${currentStatus}, so its brief is now fixed. `
            + 'Add a note here or speak to your account manager, and they will revise it with you.'
        });
      }
    }

    const nextPayload = { ...(row.payload || {}), ...safePatch };
    if (wantsCancel) nextPayload.status = 'Closed';
    // Re-derive rather than carry the old one: a client correcting the role
    // title should see the request renamed on both portals.
    nextPayload.title = requestTitle(nextPayload);

    const { data, error } = await supabase
      .from('talent_requests')
      .update({
        payload: nextPayload,
        service_type: nextPayload.serviceType || row.service_type,
        role_description: nextPayload.roleDescription || row.role_description,
        title: nextPayload.title,
        status: wantsCancel ? 'Closed' : row.status
      })
      .eq('id', row.id)
      .in('client_id', visibleIds)
      .select('*')
      .single();
    if (error) return res.status(500).json({ error: 'Could not update the request' });

    await recordAudit(actor, {
      action: wantsCancel ? 'Cancel Service Request' : 'Edit Service Request',
      // Naming the fields, so an operator reading the log can see what the
      // client changed without diffing two payloads.
      details: wantsCancel
        ? `Client cancelled request ${requestId}.`
        : `Updated ${Object.keys(safePatch).join(', ')} on request ${requestId}.`,
      entityType: 'talent_request',
      entityId: String(row.id)
    });
    return res.status(200).json({ request: toRequest(data) });
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const input = req.body?.request || req.body;
  if (!input || typeof input !== 'object') {
    return res.status(400).json({ error: 'A request payload is required' });
  }

  const serviceType = String(input.serviceType || '').trim();
  if (!SERVICE_TYPES.has(serviceType)) {
    return res.status(422).json({ error: 'A valid service type is required' });
  }

  if (input.roles !== undefined) {
    const reason = validateRequestRoles(input.roles);
    if (reason) return res.status(422).json({ error: reason });
  }

  const createdAt = new Date().toISOString();
  const datePart = createdAt.slice(0, 10).replace(/-/g, '');
  const newId = () => globalThis.crypto?.randomUUID?.() || `req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  // One request per role.
  //
  // A client hiring a designer, a backend engineer and a QA analyst answers
  // the shared context once and adds three roles. This used to store that as
  // one request carrying three roles, which cannot work: matching,
  // interviews, offers and contracts all happen per role, so one request
  // holding three of them had a single status covering three separate
  // conversations. One role at offer and another not yet sourced is the
  // normal case, and the request could only show one of the two.
  //
  // So the roles are fanned out here. The client still answers once; each
  // role becomes a request with its own reference, status, progress and
  // shortlist, and a shared group id records that they were filed together.
  const submittedRoles: any[] = Array.isArray(input.roles)
    ? input.roles.filter((r: any) => r && String(r.title || '').trim())
    : [];

  const groupId = submittedRoles.length > 1 ? `grp_${datePart}_${newId().slice(0, 8)}` : null;

  // Shared context: everything the client answered once. The per-role fields
  // are taken off, because each row carries its own.
  const { roles: _roles, id: _id, referenceNumber: _ref, ...shared } = input as Record<string, any>;

  const buildPayload = (role: any | null, index: number) => {
    const id = newId();
    const payload: Record<string, any> = {
      ...shared,
      id,
      referenceNumber: `KNG-REQ-${datePart}-${String(id).slice(0, 8).toUpperCase()}`,
      clientId: actor.userId,
      status: 'New Request',
      createdAt,
      serviceType
    };

    if (role) {
      // The role's own answers win over whatever the shared context carried,
      // so a request is about one role and says so in its own fields.
      payload.roleTitle = String(role.title).trim();
      payload.roleDescription = role.description || payload.roleDescription || '';
      payload.seniorityLevel = role.seniorityLevel || payload.seniorityLevel;
      payload.requiredSkills = Array.isArray(role.requiredSkills)
        ? role.requiredSkills.filter(Boolean)
        : (payload.requiredSkills || []);
      payload.commitmentLevel = role.commitmentLevel || payload.commitmentLevel;
      payload.startDate = role.startDate || payload.startDate;
      if (role.budgetMinUsd !== undefined) payload.budgetMinUsd = role.budgetMinUsd;
      if (role.budgetMaxUsd !== undefined) payload.budgetMaxUsd = role.budgetMaxUsd;
      const count = Number(role.count);
      payload.numberOfHires = Number.isInteger(count) && count > 0 ? count : 1;
    }

    if (groupId) {
      payload.requestGroupId = groupId;
      payload.groupPosition = index + 1;
      payload.groupSize = submittedRoles.length;
    }

    payload.title = requestTitle(payload);
    return payload;
  };

  const payloads = submittedRoles.length > 0
    ? submittedRoles.map((role, i) => buildPayload(role, i))
    : [buildPayload(null, 0)];

  const { data, error } = await supabase
    .from('talent_requests')
    .insert(payloads.map((payload) => ({
      client_id: actor.userId,
      service_type: serviceType,
      payload,
      status: 'new',
      role_description: payload.roleDescription || payload.roleTitle || payload.projectName || null,
      title: payload.title
    })))
    .select('*');

  if (error || !data || data.length === 0) {
    console.error('[requests] create failed:', error?.message);
    return res.status(500).json({ error: 'Could not save the request' });
  }

  const created = data.map(toRequest);

  await recordAudit(actor, {
    action: 'Create Service Request',
    details: created.length === 1
      ? `Created ${created[0].referenceNumber} for ${serviceType}.`
      : `Created ${created.length} requests for ${serviceType} from one brief: `
        + created.map((r: any) => `${r.referenceNumber} (${r.title})`).join(', ') + '.',
    entityType: 'talent_request',
    entityId: String(data[0].id)
  });

  // Operations has to see a new request to act on it. A notification never
  // fails the request it describes, so warnings go back with the response
  // rather than turning a saved request into an error.
  const notified = await notifyAdmins('request_received', {
    clientName: actor.email || undefined,
    roleTitle: created.length === 1
      ? created[0].title
      : `${created.length} roles: ${created.map((r: any) => r.title).join(', ')}`
  });

  return res.status(201).json({
    // The first one, so a caller written against the single-request shape
    // still works.
    request: created[0],
    requests: created,
    requestGroupId: groupId,
    warnings: notified.warnings
  });
}
