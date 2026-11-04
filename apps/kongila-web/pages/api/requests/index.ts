import type { NextApiRequest, NextApiResponse } from 'next';
import { getRequestUser, getSupabaseClient, recordAudit, notifyAdmins } from '@kongila/database';
import { normalizeRequestStatus } from '@kongila/workflows';

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
  return {
    ...(row.payload || {}),
    rowId: row.id,
    clientId: row.client_id,
    serviceType: row.payload?.serviceType || row.service_type,
    status: normalizeRequestStatus(row.payload?.status || row.status) || 'New Request',
    createdAt: row.payload?.createdAt || row.created_at
  };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const actor = await getRequestUser(req);
  if (!actor) return res.status(401).json({ error: 'Not authenticated' });
  if (actor.kind !== 'client') return res.status(403).json({ error: 'Only clients can use this request endpoint' });

  const supabase = getSupabaseClient();

  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('talent_requests')
      .select('*')
      .eq('client_id', actor.userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[requests] list failed:', error.message);
      return res.status(500).json({ error: 'Could not load your requests' });
    }
    return res.status(200).json({ requests: (data || []).map(toRequest) });
  }

  if (req.method === 'PATCH') {
    const requestId = String(req.body?.requestId || req.body?.request?.id || '').trim();
    const changes = req.body?.patch || req.body?.request || {};
    if (!requestId || !changes || typeof changes !== 'object') {
      return res.status(400).json({ error: 'A request id and patch are required' });
    }

    const { data: rows, error: loadError } = await supabase
      .from('talent_requests')
      .select('*')
      .eq('client_id', actor.userId);
    if (loadError) return res.status(500).json({ error: 'Could not load the request' });

    const row = (rows || []).find((candidate: any) =>
      String(candidate.id) === requestId || String(candidate.payload?.id || '') === requestId
    );
    if (!row) return res.status(404).json({ error: 'Request not found' });

    const allowed = ['roleDescription', 'serviceType', 'numberOfHires', 'status'];
    const safePatch = Object.fromEntries(
      allowed.filter((key) => Object.prototype.hasOwnProperty.call(changes, key))
        .map((key) => [key, changes[key]])
    );
    if (safePatch.serviceType && !SERVICE_TYPES.has(String(safePatch.serviceType))) {
      return res.status(422).json({ error: 'A valid service type is required' });
    }

    const nextPayload = { ...(row.payload || {}), ...safePatch };
    const { data, error } = await supabase
      .from('talent_requests')
      .update({
        payload: nextPayload,
        service_type: nextPayload.serviceType || row.service_type,
        role_description: nextPayload.roleDescription || row.role_description,
        status: nextPayload.status || row.status
      })
      .eq('id', row.id)
      .eq('client_id', actor.userId)
      .select('*')
      .single();
    if (error) return res.status(500).json({ error: 'Could not update the request' });

    await recordAudit(actor, {
      action: 'Edit Service Request',
      details: `Updated request ${requestId}.`,
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

  const id = globalThis.crypto?.randomUUID?.() || `req_${Date.now()}`;
  const createdAt = new Date().toISOString();
  const referenceNumber = `KNG-REQ-${createdAt.slice(0, 10).replace(/-/g, '')}-${id.slice(0, 8).toUpperCase()}`;
  const payload = {
    ...input,
    id,
    referenceNumber,
    clientId: actor.userId,
    status: 'New Request',
    createdAt,
    serviceType
  };

  const { data, error } = await supabase
    .from('talent_requests')
    .insert({
      client_id: actor.userId,
      service_type: serviceType,
      payload,
      status: 'new',
      role_description: payload.roleDescription || payload.roleTitle || payload.projectName || null,
      title: payload.title || payload.roleTitle || payload.projectName || serviceType
    })
    .select('*')
    .single();

  if (error) {
    console.error('[requests] create failed:', error.message);
    return res.status(500).json({ error: 'Could not save the request' });
  }

  await recordAudit(actor, {
    action: 'Create Service Request',
    details: `Created ${referenceNumber} for ${serviceType}.`,
    entityType: 'talent_request',
    entityId: String(data.id)
  });

  // Operations has to see a new request to act on it. A notification never
  // fails the request it describes, so warnings go back with the response
  // rather than turning a saved request into an error.
  const notified = await notifyAdmins('request_received', {
    clientName: actor.email || undefined,
    roleTitle: payload.roleDescription || payload.roleTitle || serviceType
  });

  return res.status(201).json({ request: toRequest(data), warnings: notified.warnings });
}
