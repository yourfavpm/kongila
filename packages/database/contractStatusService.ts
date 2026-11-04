/**
 * Changing a contract's status.
 *
 * `ContractsManager` did this by rewriting its local array and posting the
 * whole thing through `/api/db`, which upserts every contract in the
 * payload. Changing one contract rewrote all of them from whatever the
 * screen was holding, and the statuses it wrote ('Active', 'Voided',
 * 'Signed') are not values `contracts_status_check` allows, so Postgres
 * refused them and the error went nowhere.
 *
 * The audit entries went the same way, with `actor` hard coded to 'Admin'.
 * `audit_logs` has RLS on and no policy, so none of them were written.
 */

import { getSupabaseClient } from './index';
import type { RequestActor as Actor } from './scope';
import { recordAudit } from './audit';
import { notifyUsers } from './notify';
import { contractTransition, normaliseContractStatus } from '@kongila/workflows';

export interface ContractStatusResult<T = any> {
  ok: boolean;
  status: number;
  error?: string;
  data?: T;
  warnings?: string[];
}

function fail(status: number, error: string): ContractStatusResult {
  return { ok: false, status, error };
}

/**
 * Moves a contract.
 *
 * Terminating also puts the request behind it back to Candidates Ready, so
 * the client sees the shortlist again rather than a dead request. That was
 * done in the browser by rewriting the whole clientRequests array.
 */
export async function updateContractStatus(
  actor: Actor,
  input: { contractId: string; status: string; reason?: string | null }
): Promise<ContractStatusResult> {
  if (!actor) return fail(401, 'Not authenticated.');
  if (actor.kind !== 'admin') return fail(403, 'Only operations change a contract status.');

  const contractId = String(input.contractId || '').trim();
  if (!contractId) return fail(400, 'Which contract?');

  const supabase = getSupabaseClient();
  const { data: contract } = await supabase
    .from('contracts').select('*').eq('id', contractId).maybeSingle();

  if (!contract) return fail(404, 'That contract does not exist.');

  const move = contractTransition(contract.status, input.status, input.reason);
  if (!move.ok) return fail(409, move.error as string);

  const previous = normaliseContractStatus(contract.status) || 'pending';
  const next = move.status as string;

  const patch: Record<string, unknown> = { status: next };
  if (next === 'active' && !contract.signed_at) {
    patch.signed_at = new Date().toISOString();
  }

  const { error } = await supabase.from('contracts').update(patch).eq('id', contractId);
  if (error) return fail(500, `That contract was not updated: ${error.message}`);

  const warnings: string[] = [];
  const reason = String(input.reason || '').trim();

  // ── A terminated contract releases its request ───────────────────────────
  if (next === 'terminated' && contract.offer_id) {
    const { data: offer } = await supabase
      .from('offers').select('request_id').eq('id', contract.offer_id).maybeSingle();

    if (offer?.request_id) {
      const { data: request } = await supabase
        .from('talent_requests').select('id, payload').eq('id', offer.request_id).maybeSingle();

      if (request) {
        const payload = { ...(request.payload || {}), status: 'Candidates Ready' };
        const { error: requestError } = await supabase
          .from('talent_requests')
          .update({ payload, status: 'candidates_ready' })
          .eq('id', request.id);
        if (requestError) {
          warnings.push(`The request was not reopened: ${requestError.message}`);
        }
      }
    }
  }

  await recordAudit(actor, {
    action: next === 'terminated' ? 'Terminate Contract' : 'Update Contract Status',
    details: `Contract ${contractId}: ${previous} to ${next}.`
           + (reason ? ` Reason: ${reason}` : ''),
    entityType: 'contract',
    entityId: contractId
  });

  // ── Tell both sides ──────────────────────────────────────────────────────
  const parties = [contract.client_id, contract.talent_id]
    .filter((id): id is string => Boolean(id));

  if (parties.length > 0 && (next === 'active' || next === 'terminated')) {
    const notified = await notifyUsers(
      parties,
      next === 'active' ? 'contract_signed' : 'offer_declined',
      {
        roleTitle: contract.service_type || undefined,
        reason: next === 'terminated' ? (reason || undefined) : undefined
      }
    );
    warnings.push(...notified.warnings);
  }

  return {
    ok: true,
    status: 200,
    data: { id: contractId, status: next, previous },
    warnings
  };
}

/**
 * A reminder to whoever has not signed yet.
 *
 * The button said "Reminder sent to parties via Email & In-App
 * Notification" in an alert and then incremented a counter in browser
 * state. Nothing was sent. Nothing even tried.
 */
export async function sendSignatureReminder(
  actor: Actor,
  input: { contractId: string }
): Promise<ContractStatusResult> {
  if (!actor) return fail(401, 'Not authenticated.');
  if (actor.kind !== 'admin') return fail(403, 'Only operations send a reminder.');

  const contractId = String(input.contractId || '').trim();
  if (!contractId) return fail(400, 'Which contract?');

  const supabase = getSupabaseClient();
  const { data: contract } = await supabase
    .from('contracts').select('*').eq('id', contractId).maybeSingle();

  if (!contract) return fail(404, 'That contract does not exist.');

  const status = normaliseContractStatus(contract.status);
  if (status !== 'pending_signatures' && status !== 'client_signed' && status !== 'talent_signed') {
    return fail(409, 'That contract is not waiting on a signature.');
  }

  // Only chase the side that has not signed.
  const outstanding: string[] = [];
  if (status !== 'client_signed' && contract.client_id) outstanding.push(String(contract.client_id));
  if (status !== 'talent_signed' && contract.talent_id) outstanding.push(String(contract.talent_id));

  if (outstanding.length === 0) return fail(409, 'Both sides have already signed.');

  const notified = await notifyUsers(outstanding, 'contract_ready', {
    roleTitle: contract.service_type || undefined
  });

  await recordAudit(actor, {
    action: 'Send Signature Reminder',
    details: `Contract ${contractId}: reminded ${outstanding.length} party/parties.`,
    entityType: 'contract',
    entityId: contractId
  });

  return {
    ok: true,
    status: 200,
    data: { id: contractId, reminded: notified.delivered },
    warnings: notified.warnings
  };
}

/**
 * Drafting a contract by hand.
 *
 * The panel built a row in the browser with `id: contract_${Date.now()}`
 * and `status: 'Draft'`, pushed it into its local array and posted all of
 * them through `/api/db`. 'Draft' is not a value `contracts_status_check`
 * allows, so Postgres refused the row while the rest of the payload still
 * overwrote every other contract from browser state.
 *
 * The form also picked the client from the organisations list, and
 * `contracts.client_id` is a foreign key to `users`, not to
 * `organizations`. The organisation is resolved to its client user here.
 */
export async function createContract(
  actor: Actor,
  input: {
    talentId: string;
    clientId?: string | null;
    organizationId?: string | null;
    serviceType?: string | null;
    rateType?: string | null;
    rateAmount?: unknown;
    startDate?: string | null;
    endDate?: string | null;
    engagementModel?: string | null;
    currency?: string | null;
    templateId?: string | null;
  }
): Promise<ContractStatusResult> {
  if (!actor) return fail(401, 'Not authenticated.');
  if (actor.kind !== 'admin') return fail(403, 'Only operations draft a contract.');

  const talentId = String(input.talentId || '').trim();
  if (!talentId) return fail(400, 'Which candidate?');

  const supabase = getSupabaseClient();

  const { data: talent } = await supabase
    .from('talent_profiles').select('id').eq('id', talentId).maybeSingle();
  if (!talent) return fail(422, 'That candidate does not exist.');

  // ── Resolve the client ───────────────────────────────────────────────────
  let clientId = input.clientId ? String(input.clientId).trim() : '';

  if (clientId) {
    const { data: user } = await supabase
      .from('users').select('id').eq('id', clientId).maybeSingle();

    if (!user) {
      // The form sends an organisation id. Find the client user behind it
      // rather than writing an id the foreign key will refuse.
      const { data: profiles } = await supabase
        .from('client_profiles').select('user_id').eq('organization_id', clientId).limit(1);

      if (!profiles || profiles.length === 0) {
        return fail(422, 'That client has no account on the platform yet.');
      }
      clientId = String(profiles[0].user_id);
    }
  } else if (input.organizationId) {
    const { data: profiles } = await supabase
      .from('client_profiles').select('user_id')
      .eq('organization_id', String(input.organizationId)).limit(1);

    if (!profiles || profiles.length === 0) {
      return fail(422, 'That company has no account on the platform yet.');
    }
    clientId = String(profiles[0].user_id);
  } else {
    return fail(400, 'Which client?');
  }

  // ── The rate ─────────────────────────────────────────────────────────────
  const rate = Number(input.rateAmount);
  if (!Number.isFinite(rate) || rate <= 0) {
    return fail(422, 'A contract needs a rate above zero.');
  }

  // contracts_rate_type_check takes exactly 'Hourly' or 'Monthly'.
  const rateTypeRaw = String(input.rateType || 'Monthly').trim().toLowerCase();
  const rateType = rateTypeRaw === 'hourly' ? 'Hourly' : 'Monthly';

  if (input.startDate && input.endDate && input.endDate < input.startDate) {
    return fail(422, 'The end date is before the start date.');
  }

  const row: Record<string, unknown> = {
    client_id: clientId,
    talent_id: talentId,
    service_type: input.serviceType || 'Hire Talent',
    // 'pending' is the real starting status. The panel called it Draft.
    status: 'pending',
    rate_type: rateType,
    rate_amount: rate,
    start_date: input.startDate || null,
    end_date: input.endDate || null,
    engagement_model: input.engagementModel || null,
    currency: String(input.currency || 'USD').toUpperCase(),
    entry_point: 'admin_panel'
  };

  if (rateType === 'Monthly') {
    row.monthly_rate = rate;
    row.monthly_rate_usd = rate;
  } else {
    row.hourly_rate_usd = rate;
  }

  if (input.templateId) row.template_version_id = String(input.templateId);

  const { data: contract, error } = await supabase
    .from('contracts').insert(row).select('*').maybeSingle();

  if (error) return fail(500, `That contract was not created: ${error.message}`);

  await recordAudit(actor, {
    action: 'Draft Contract',
    details: `Drafted a ${rateType.toLowerCase()} contract for candidate ${talentId}.`,
    entityType: 'contract',
    entityId: String(contract?.id)
  });

  return { ok: true, status: 201, data: contract };
}
