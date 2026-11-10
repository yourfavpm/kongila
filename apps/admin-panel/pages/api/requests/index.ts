import type { NextApiRequest, NextApiResponse } from 'next';
import { getRequestUser, getSupabaseClient } from '@kongila/database';
import { coerceRequestStatus, normalizeRequestStatus } from '@kongila/workflows';
import { canAccessRequest, visibleRequestsForActor } from '@kongila/database';

/**
 * Service requests, operations side.
 *
 * The request detail page read talent_requests, users, roles, user_roles,
 * client_profiles and matches directly from the browser, and /api/db on
 * top for a fallback copy of the matches. Six reads with the anon key to
 * render one page.
 *
 * GET          every request, newest first
 * GET ?id=     one request with its client, matches and interviews
 */

function toRequest(row: any) {
  return {
    ...(row.payload || {}),
    id: row.id,
    payloadId: row.payload?.id || null,
    rowId: row.id,
    clientId: row.client_id,
    serviceType: row.payload?.serviceType || row.service_type,
    roleDescription: row.payload?.roleDescription || row.role_description,
    title: row.payload?.title || row.title,
    status: coerceRequestStatus(row.payload?.status || row.status),
    createdAt: row.payload?.createdAt || row.created_at,
    // The column wins over the payload. They drift, and the column is what
    // the interview notifications read.
    assignedAccountManagerId: row.account_manager_id || row.payload?.assignedAccountManagerId || '',
    assignedTalentManagerId: row.talent_manager_id || row.payload?.assignedTalentManagerId || ''
  };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const actor = await getRequestUser(req);
  if (!actor) return res.status(401).json({ error: 'Not authenticated' });
  if (actor.kind !== 'admin') {
    console.warn(`[admin api/requests] refused ${actor.kind} ${actor.userId}`);
    return res.status(403).json({ error: 'Not authorised' });
  }

  res.setHeader('Cache-Control', 'private, no-store');
  const supabase = getSupabaseClient();
  const id = typeof req.query.id === 'string' ? req.query.id : '';

  // ── The list ──────────────────────────────────────────────────────────────
  if (!id) {
    const { data, error } = await supabase
      .from('talent_requests').select('*').order('created_at', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    try {
      const visibleRequests = await visibleRequestsForActor(supabase, actor, data || []);
      return res.status(200).json({ requests: visibleRequests.map(toRequest) });
    } catch (visibilityError: any) {
      console.error('[admin api/requests] request ownership lookup failed:', visibilityError.message);
      return res.status(500).json({ error: 'Could not verify request ownership.' });
    }
  }

  // ── One request ───────────────────────────────────────────────────────────
  const { data: rows, error } = await supabase
    .from('talent_requests').select('*')
    .or(`id.eq.${id},payload->>id.eq.${id}`).limit(2);

  if (error) return res.status(500).json({ error: error.message });
  if (!rows || rows.length === 0) return res.status(404).json({ error: 'Request not found' });

  let row = rows[0];
  try {
    if (!await canAccessRequest(supabase, actor, row)) {
      return res.status(404).json({ error: 'Request not found' });
    }
  } catch (visibilityError: any) {
    console.error('[admin api/requests] request ownership lookup failed:', visibilityError.message);
    return res.status(500).json({ error: 'Could not verify request ownership.' });
  }

  if (normalizeRequestStatus(row.payload?.status || row.status) === 'New Request') {
    const nextPayload = { ...(row.payload || {}), status: 'Reviewing' };
    let update = supabase.from('talent_requests')
      .update({ payload: nextPayload, status: 'reviewing' })
      .eq('id', row.id);
    update = row.status == null ? update.is('status', null) : update.eq('status', row.status);

    const { data: updatedRow, error: updateError } = await update.select('*').maybeSingle();
    if (updateError) {
      console.error('[admin api/requests] failed to move opened request to Reviewing:', updateError.message);
      return res.status(500).json({ error: 'Could not move the request to Reviewing.' });
    }
    if (updatedRow) {
      row = updatedRow;
      const { error: auditError } = await supabase.from('audit_logs').insert({
        actor: actor.email || actor.userId,
        action: 'Request Opened',
        details: `Request ${row.id} moved from New Request to Reviewing when opened.`,
        timestamp: new Date().toISOString()
      });
      if (auditError) {
        console.warn('[admin api/requests] request-open audit entry not written:', auditError.message);
      }
    } else {
      const { data: latestRow, error: reloadError } = await supabase
        .from('talent_requests').select('*').eq('id', row.id).maybeSingle();
      if (reloadError) {
        console.error('[admin api/requests] failed to reload request after open:', reloadError.message);
        return res.status(500).json({ error: 'Could not reload the request.' });
      }
      if (latestRow) row = latestRow;
    }
  }

  const request = toRequest(row);

  const [matches, interviews, profile, callRequests] = await Promise.all([
    supabase.from('matches').select('*').eq('request_id', row.id),
    supabase.from('interviews').select('*').eq('request_id', row.id),
    row.client_id
      ? supabase.from('client_profiles').select('*').eq('user_id', row.client_id).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase.from('client_call_requests').select('*').eq('request_id', row.id).order('created_at', { ascending: false })
  ]);
  if (callRequests.error) {
    console.error('[admin api/requests] call request lookup failed:', callRequests.error.message);
  }

  const talentIds = Array.from(new Set(
    (matches.data || []).map((m: any) => String(m.talent_id)).filter(Boolean)
  ));

  const { data: talents } = talentIds.length
    ? await supabase.from('talent_profiles')
        .select('id, full_name, level, avatar_url, grade, vetting_status, country, timezone')
        .in('id', talentIds)
    : { data: [] as any[] };

  const talentById = new Map<string, any>((talents || []).map((t: any) => [String(t.id), t]));

  const [organization, client] = await Promise.all([
    (profile as any).data?.organization_id
      ? supabase.from('organizations').select('*')
          .eq('id', (profile as any).data.organization_id).maybeSingle()
      : Promise.resolve({ data: null }),
    row.client_id
      ? supabase.from('users').select('id, name, email').eq('id', row.client_id).maybeSingle()
      : Promise.resolve({ data: null })
  ]);

  // The client as a client, not just a name on this request.
  //
  // An operator opening a new request could see the company's name and
  // nothing else about them: not who the primary contact is, not what else
  // they have asked for, not whether this is their first request or their
  // fifth. Answering that meant leaving the page and searching the client
  // list, so in practice nobody did.
  const org = (organization as any).data || null;

  const [primaryContact, orgProfiles] = await Promise.all([
    org?.primary_contact_user_id
      ? supabase.from('users').select('id, name, email')
          .eq('id', org.primary_contact_user_id).maybeSingle()
      : Promise.resolve({ data: null }),
    org?.id
      ? supabase.from('client_profiles').select('user_id, position, phone').eq('organization_id', org.id)
      : Promise.resolve({ data: [] as any[] })
  ]);

  const orgUserIds = ((orgProfiles as any).data || [])
    .map((cp: any) => String(cp.user_id)).filter(Boolean);

  // Everything else this company has asked for, so the request is read in the
  // context of the relationship rather than on its own.
  const { data: siblingRows } = orgUserIds.length
    ? await supabase.from('talent_requests').select('*')
        .in('client_id', orgUserIds).order('created_at', { ascending: false }).limit(50)
    : { data: [] as any[] };

  let visibleSiblingRows: any[] = [];
  try {
    visibleSiblingRows = await visibleRequestsForActor(supabase, actor, siblingRows || []);
  } catch (visibilityError: any) {
    console.error('[admin api/requests] sibling request ownership lookup failed:', visibilityError.message);
    return res.status(500).json({ error: 'Could not verify related request ownership.' });
  }
  const otherRequests = visibleSiblingRows
    .map(toRequest)
    .filter((r: any) => String(r.rowId) !== String(row.id));

  return res.status(200).json({
    request,
    callRequests: (callRequests.data || []).map((call: any) => ({
      id: call.id,
      requestId: call.request_id,
      status: call.status,
      agenda: call.agenda,
      timezone: call.timezone,
      preferredTimes: call.preferred_times || [],
      clientNote: call.client_note,
      scheduledAt: call.scheduled_at,
      meetingLink: call.meeting_link,
      createdAt: call.created_at
    })),
    callRequestWarning: callRequests.error
      ? 'Client call scheduling is unavailable until the client_call_requests database migration is applied.'
      : undefined,
    row: { id: row.id, accountManagerId: row.account_manager_id, talentManagerId: row.talent_manager_id },
    client: (client as any).data || null,
    organization: org,
    primaryContact: (primaryContact as any).data || null,
    otherRequests,
    matches: (matches.data || []).map((m: any) => {
      const t = talentById.get(String(m.talent_id));
      return {
        id: m.id,
        requestId: m.request_id,
        talentId: m.talent_id,
        status: m.status,
        score: m.score,
        breakdown: m.breakdown,
        clientRejectionReason: m.client_rejection_reason,
        talentName: t?.full_name || null,
        talentTitle: t?.level || null,
        talentAvatar: t?.avatar_url || null,
        talentGrade: t?.grade || null
      };
    }),
    interviews: interviews.data || []
  });
}
