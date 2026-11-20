import type { RequestActor } from './scope';

function isAccountManager(actor: RequestActor): boolean {
  const role = String(actor.role || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  return actor.kind === 'admin' && role === 'account_manager';
}

function isTalentManager(actor: RequestActor): boolean {
  const role = String(actor.role || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  return actor.kind === 'admin' && role === 'talent_manager';
}

export function isRequestAssignedToAccountManager(
  request: any,
  accountManagerId: string,
  managedClientIds: Set<string>
): boolean {
  const assignedManagerId = request?.account_manager_id
    || request?.payload?.assignedAccountManagerId
    || request?.assignedAccountManagerId;
  const clientId = request?.client_id ?? request?.clientId;
  return String(assignedManagerId || '') === String(accountManagerId)
    || (clientId != null && managedClientIds.has(String(clientId)));
}

export async function visibleRequestsForActor(
  supabase: any,
  actor: RequestActor,
  requests: any[]
): Promise<any[]> {
  if (requests.length === 0) return requests;

  if (isTalentManager(actor)) {
    const { data: talents, error: talentError } = await supabase
      .from('talent_profiles').select('id').eq('talent_manager_id', actor.userId);
    if (talentError) throw new Error('Could not check talent ownership: ' + talentError.message);
    const talentIds = (talents || []).map((talent: any) => String(talent.id));
    const { data: direct, error: requestError } = await supabase.from('talent_requests')
      .select('id, payload').eq('talent_manager_id', actor.userId);
    if (requestError) throw new Error('Could not check request ownership: ' + requestError.message);
    const visibleIds = new Set((direct || []).flatMap((row: any) => [row.id, row.payload?.id].filter(Boolean).map(String)));
    if (talentIds.length) {
      const { data: matches, error: matchError } = await supabase.from('matches')
        .select('request_id').in('talent_id', talentIds);
      if (matchError) throw new Error('Could not check assigned talent requests: ' + matchError.message);
      for (const match of matches || []) visibleIds.add(String(match.request_id));
    }
    return requests.filter((request: any) =>
      visibleIds.has(String(request.id))
      || visibleIds.has(String(request.payload?.id || ''))
      || String(request.talent_manager_id || request.payload?.assignedTalentManagerId || '') === String(actor.userId)
    );
  }
  if (!isAccountManager(actor)) return requests;

  const directAssignments = requests.filter((request) =>
    String(request.account_manager_id || request.payload?.assignedAccountManagerId || '') === actor.userId
  );
  const { data: organizations, error: organizationsError } = await supabase
    .from('organizations')
    .select('id')
    .eq('account_manager_id', actor.userId);
  if (organizationsError) throw new Error(`Could not check client ownership: ${organizationsError.message}`);

  const organizationIds = (organizations || []).map((organization: any) => String(organization.id));
  const managedClientIds = new Set<string>();
  if (organizationIds.length > 0) {
    const { data: profiles, error: profilesError } = await supabase
      .from('client_profiles')
      .select('user_id')
      .in('organization_id', organizationIds);
    if (profilesError) throw new Error(`Could not check client ownership: ${profilesError.message}`);
    for (const profile of profiles || []) {
      if (profile.user_id != null) managedClientIds.add(String(profile.user_id));
    }
  }

  const directlyAssigned = new Set(directAssignments);
  return requests.filter((request) =>
    directlyAssigned.has(request) || isRequestAssignedToAccountManager(request, actor.userId, managedClientIds)
  );
}

export async function canAccessRequest(
  supabase: any,
  actor: RequestActor,
  request: any
): Promise<boolean> {
  if (actor.kind !== 'admin') return false;
  if (!isAccountManager(actor) && !isTalentManager(actor)) return true;
  const visible = await visibleRequestsForActor(supabase, actor, [request]);
  return visible.length > 0;
}
