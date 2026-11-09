import type { NextApiRequest, NextApiResponse } from 'next';
import { getRequestUser, getSupabaseClient } from '@kongila/database';
import { coerceRequestStatus } from '@kongila/workflows';

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
    id: row.payload?.id || row.id,
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
    return res.status(200).json({ requests: (data || []).map(toRequest) });
  }

  // ── One request ───────────────────────────────────────────────────────────
  const { data: rows, error } = await supabase
    .from('talent_requests').select('*')
    .or(`id.eq.${id},payload->>id.eq.${id}`).limit(2);

  if (error) return res.status(500).json({ error: error.message });
  if (!rows || rows.length === 0) return res.status(404).json({ error: 'Request not found' });

  const row = rows[0];
  const request = toRequest(row);

  const [matches, interviews, profile] = await Promise.all([
    supabase.from('matches').select('*').eq('request_id', row.id),
    supabase.from('interviews').select('*').eq('request_id', row.id),
    row.client_id
      ? supabase.from('client_profiles').select('*').eq('user_id', row.client_id).maybeSingle()
      : Promise.resolve({ data: null })
  ]);

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

  return res.status(200).json({
    request,
    row: { id: row.id, accountManagerId: row.account_manager_id, talentManagerId: row.talent_manager_id },
    client: (client as any).data || null,
    organization: (organization as any).data || null,
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
