import type { RequestActor } from './scope';

function isAccountManager(actor: RequestActor): boolean {
  const role = String(actor.role || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  return actor.kind === 'admin' && role === 'account_manager';
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
  if (!isAccountManager(actor) || requests.length === 0) return requests;

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
  if (!isAccountManager(actor)) return true;
  const visible = await visibleRequestsForActor(supabase, actor, [request]);
  return visible.length > 0;
}
