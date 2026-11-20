import { getSupabaseClient } from './index';
import type { RequestActor as Actor } from './scope';

export function canManageInvoices(actor: Actor): boolean {
  return actor.kind === 'admin' && (
    actor.role === 'super_admin' || actor.role === 'finance' ||
    Boolean(actor.permissions?.includes('finance.manage')) ||
    Boolean(actor.permissions?.includes('invoices.manage'))
  );
}

/** Account managers can work invoices only for their assigned client accounts. */
export async function canManageContractInvoice(actor: Actor, contract: any): Promise<boolean> {
  if (!canManageInvoices(actor)) return false;
  if (actor.role === 'super_admin' || actor.role === 'finance' || actor.permissions?.includes('finance.manage')) return true;
  return isAssignedAccountManager(actor, String(contract?.client_id || ''));
}

export async function isAssignedAccountManager(actor: Actor, clientId: string): Promise<boolean> {
  if (actor.kind !== 'admin' || actor.role !== 'account_manager' || !clientId) return false;
  const supabase = getSupabaseClient();
  const { data: profile } = await supabase.from('client_profiles')
    .select('organization_id').eq('user_id', clientId).maybeSingle();
  if (!profile?.organization_id) return false;
  const { data: organization } = await supabase.from('organizations')
    .select('account_manager_id').eq('id', profile.organization_id).maybeSingle();
  return String(organization?.account_manager_id || '') === String(actor.userId);
}
