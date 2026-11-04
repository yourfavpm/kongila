/**
 * Assigning an account manager or a talent manager.
 *
 * Four places in the admin panel upserted `roles` and `user_roles` straight
 * from the browser, to make sure the assignee's role row existed before the
 * assignment referenced it. RLS is off on both tables in the live database,
 * so those writes landed: an administrator's browser could grant a role
 * link to any user id it named. That is the sharpest hole left, because
 * `user_roles` is what the portal reads to decide who may do what.
 *
 * Two more things were wrong with the old path:
 *
 *   - `organizations.account_manager_id` was updated from the browser too,
 *     keyed on an id held in component state.
 *   - The audit entries were inserted from the browser with `actor` hard
 *     coded to 'Super Admin'. RLS is on with no policy on `audit_logs`, so
 *     none of them were ever written, and had they been, they would have
 *     named the wrong person.
 *
 * Only a super admin assigns. Everyone else gets a 403, which is also new:
 * nothing checked before.
 */

import { getSupabaseClient } from './index';
import type { RequestActor as Actor } from './scope';
import { recordAudit } from './audit';
import { notifyUsers } from './notify';
import {
  resolveRole,
  storableRole,
  isAccountManagerAssignable,
  isTalentManagerAssignable
} from '@kongila/auth';

export interface AssignmentResult<T = any> {
  ok: boolean;
  status: number;
  error?: string;
  data?: T;
  warnings?: string[];
}

function fail(status: number, error: string): AssignmentResult {
  return { ok: false, status, error };
}

/** Only a super admin changes who is responsible for what. */
function isSuperAdmin(actor: Actor): boolean {
  return actor.kind === 'admin' && resolveRole(actor.role) === 'super_admin';
}

/**
 * Makes sure the role row and the user's link to it exist.
 *
 * The role is read from the user's own record, never from the request. The
 * browser version derived a role id from a helper and wrote it, so an
 * assignment could hand someone a role they did not have.
 */
async function ensureRoleLink(userId: string): Promise<{ role: string; warnings: string[] }> {
  const supabase = getSupabaseClient();
  const warnings: string[] = [];

  const { data: user } = await supabase
    .from('users').select('id, email, name, role').eq('id', userId).maybeSingle();

  if (!user) return { role: '', warnings: [`${userId} is not a user.`] };

  const role = storableRole(user.role);

  const { error: roleError } = await supabase
    .from('roles').upsert({ id: role, name: role }, { onConflict: 'id' });
  if (roleError) warnings.push(`The ${role} role row was not confirmed: ${roleError.message}`);

  const { error: linkError } = await supabase
    .from('user_roles')
    .upsert({ id: `ur_${userId}_${role}`, user_id: userId, role_id: role }, { onConflict: 'id' });
  if (linkError) warnings.push(`The role link was not confirmed: ${linkError.message}`);

  return { role, warnings };
}

/** The person being assigned, checked against who may hold that post. */
async function loadAssignee(userId: string, post: 'account' | 'talent') {
  const supabase = getSupabaseClient();
  const { data } = await supabase
    .from('users').select('id, email, name, role').eq('id', userId).maybeSingle();

  if (!data) return { user: null, error: 'That person is not a user.' };

  const allowed = post === 'account'
    ? isAccountManagerAssignable(data.role)
    : isTalentManagerAssignable(data.role);

  if (!allowed) {
    return {
      user: null,
      error: `${data.name || data.email || userId} cannot be a ${
        post === 'account' ? 'an account' : 'a talent'
      } manager with the role ${data.role || 'none'}.`
    };
  }

  return { user: data, error: null };
}

/**
 * Sets a client organisation's account manager.
 *
 * Replaces the sequence in `pages/clients/[id].tsx`: a roles upsert, a
 * user_roles upsert, an organizations update and an audit insert, all from
 * the browser.
 */
export async function assignAccountManager(
  actor: Actor,
  input: { organizationId: string; userId: string; reason?: string | null }
): Promise<AssignmentResult> {
  if (!actor) return fail(401, 'Not authenticated.');
  if (!isSuperAdmin(actor)) return fail(403, 'Only a super admin assigns an account manager.');

  const organizationId = String(input.organizationId || '').trim();
  const userId = String(input.userId || '').trim();
  if (!organizationId || !userId) return fail(400, 'A company and a person are both required.');

  const supabase = getSupabaseClient();

  const { data: organization } = await supabase
    .from('organizations').select('id, name, account_manager_id').eq('id', organizationId).maybeSingle();
  if (!organization) return fail(404, 'That company does not exist.');

  const { user, error: assigneeError } = await loadAssignee(userId, 'account');
  if (!user) return fail(422, assigneeError as string);

  // Reassigning away from someone needs a reason. Who used to own an
  // account and why it moved is the whole point of the entry.
  const previousId = organization.account_manager_id;
  const reason = String(input.reason || '').trim();
  if (previousId && String(previousId) !== userId && !reason) {
    return fail(422, 'Say why the account is moving.');
  }

  const { warnings } = await ensureRoleLink(userId);

  const { error } = await supabase
    .from('organizations').update({ account_manager_id: userId }).eq('id', organizationId);
  if (error) return fail(500, `The account manager was not saved: ${error.message}`);

  let previousName = 'nobody';
  if (previousId) {
    const { data: previous } = await supabase
      .from('users').select('name, email').eq('id', previousId).maybeSingle();
    previousName = previous?.name || previous?.email || String(previousId);
  }

  await recordAudit(actor, {
    action: previousId ? 'Reassign Account Manager' : 'Assign Account Manager',
    details:
      `${organization.name || organizationId}: ${previousName} to ` +
      `${user.name || user.email || userId}.` + (reason ? ` Reason: ${reason}` : ''),
    entityType: 'organization',
    entityId: organizationId
  });

  const notified = await notifyUsers(userId, 'stage_advanced', {
    stageName: 'Account manager',
    reason: `You are now the account manager for ${organization.name || organizationId}.`
  });
  warnings.push(...notified.warnings);

  return {
    ok: true,
    status: 200,
    data: {
      organizationId,
      accountManagerId: userId,
      accountManagerName: user.name || user.email || userId
    },
    warnings
  };
}

/**
 * Sets the managers on a request.
 *
 * Replaces the sequence in `pages/requests/[id].tsx`, which also updated
 * the client organisation's account manager from the browser, and wrote an
 * audit entry attributed to 'Super Admin' whoever was signed in.
 *
 * The managers are written to their own columns on `talent_requests` as
 * well as into the payload. The payload is what the portal reads; the
 * columns are what the interview notifications read. They were drifting.
 */
export async function assignRequestManagers(
  actor: Actor,
  input: {
    requestId: string;
    accountManagerId?: string | null;
    talentManagerId?: string | null;
    urgency?: string | null;
    internalNotes?: string | null;
    alsoSetClientAccountManager?: boolean;
  }
): Promise<AssignmentResult> {
  if (!actor) return fail(401, 'Not authenticated.');
  if (actor.kind !== 'admin') return fail(403, 'Not authorised.');

  const requestId = String(input.requestId || '').trim();
  if (!requestId) return fail(400, 'Which request?');

  const supabase = getSupabaseClient();

  const { data: rows, error: loadError } = await supabase
    .from('talent_requests')
    .select('*')
    .or(`id.eq.${requestId},payload->>id.eq.${requestId}`)
    .limit(2);

  if (loadError) return fail(500, `That request could not be loaded: ${loadError.message}`);
  if (!rows || rows.length === 0) return fail(404, 'That request does not exist.');
  const row = rows[0];

  const warnings: string[] = [];
  const payload = { ...(row.payload || {}) };
  const patch: Record<string, unknown> = {};

  // ── Account manager ──────────────────────────────────────────────────────
  if (input.accountManagerId) {
    const { user, error } = await loadAssignee(String(input.accountManagerId), 'account');
    if (!user) return fail(422, error as string);
    const link = await ensureRoleLink(String(input.accountManagerId));
    warnings.push(...link.warnings);
    patch.account_manager_id = String(input.accountManagerId);
    payload.assignedAccountManagerId = String(input.accountManagerId);
  }

  // ── Talent manager ───────────────────────────────────────────────────────
  if (input.talentManagerId) {
    const { user, error } = await loadAssignee(String(input.talentManagerId), 'talent');
    if (!user) return fail(422, error as string);
    const link = await ensureRoleLink(String(input.talentManagerId));
    warnings.push(...link.warnings);
    patch.talent_manager_id = String(input.talentManagerId);
    payload.assignedTalentManagerId = String(input.talentManagerId);
  }

  if (input.urgency !== undefined) payload.urgency = input.urgency;
  if (input.internalNotes !== undefined) payload.internalNotes = input.internalNotes;

  const { error } = await supabase
    .from('talent_requests')
    .update({ ...patch, payload })
    .eq('id', row.id);

  if (error) return fail(500, `Those assignments were not saved: ${error.message}`);

  // The client's own account manager follows the request's, when asked for.
  if (input.alsoSetClientAccountManager && input.accountManagerId && row.client_id) {
    const { data: profile } = await supabase
      .from('client_profiles').select('organization_id').eq('user_id', row.client_id).maybeSingle();

    if (profile?.organization_id) {
      const { error: orgError } = await supabase
        .from('organizations')
        .update({ account_manager_id: String(input.accountManagerId) })
        .eq('id', profile.organization_id);
      if (orgError) warnings.push(`The client's account manager was not updated: ${orgError.message}`);
    } else {
      warnings.push('That client is not attached to a company, so their account manager was not changed.');
    }
  }

  const assigned = [
    input.accountManagerId ? `AM ${input.accountManagerId}` : null,
    input.talentManagerId ? `TM ${input.talentManagerId}` : null
  ].filter(Boolean).join(', ');

  if (assigned) {
    await recordAudit(actor, {
      action: 'Assign Request Managers',
      details: `Request ${requestId}: ${assigned}.`,
      entityType: 'talent_request',
      entityId: String(row.id)
    });
  }

  // Being given a request is worth telling someone about. The browser
  // version told nobody.
  const newlyAssigned = [input.accountManagerId, input.talentManagerId]
    .filter((id): id is string => Boolean(id));

  if (newlyAssigned.length > 0) {
    const notified = await notifyUsers(newlyAssigned, 'request_received', {
      roleTitle: payload.roleDescription || row.role_description || row.service_type || undefined
    });
    warnings.push(...notified.warnings);
  }

  return {
    ok: true,
    status: 200,
    data: {
      requestId: row.id,
      accountManagerId: patch.account_manager_id ?? row.account_manager_id ?? null,
      talentManagerId: patch.talent_manager_id ?? row.talent_manager_id ?? null
    },
    warnings
  };
}

/**
 * Setting a candidate's talent manager.
 *
 * `pages/talents/[id].tsx` read the whole database, mapped the talents
 * array, and posted all of it back through `/api/db`, which upserts every
 * talent row and repacks each one's bio envelope. Changing who manages one
 * candidate rewrote every candidate.
 *
 * `talent_manager_id` is not a column on `talent_profiles`; it lives in
 * the bio envelope's telemetry alongside the vetting pipeline, so only
 * that one field in that one row moves here.
 */
export async function assignTalentManager(
  actor: Actor,
  input: { talentId: string; managerId?: string | null }
): Promise<AssignmentResult> {
  if (!actor) return fail(401, 'Not authenticated.');
  if (actor.kind !== 'admin') return fail(403, 'Not authorised.');

  const talentId = String(input.talentId || '').trim();
  if (!talentId) return fail(400, 'Which candidate?');

  const supabase = getSupabaseClient();
  const { data: talent } = await supabase
    .from('talent_profiles').select('*').eq('id', talentId).maybeSingle();

  if (!talent) return fail(404, 'That candidate does not exist.');

  const managerId = input.managerId ? String(input.managerId).trim() : null;
  const warnings: string[] = [];
  let managerName = 'nobody';

  if (managerId) {
    const { user, error } = await loadAssignee(managerId, 'talent');
    if (!user) return fail(422, error as string);
    managerName = user.name || user.email || managerId;
    const link = await ensureRoleLink(managerId);
    warnings.push(...link.warnings);
  }

  // Read, change one key, write back. Anything else in the envelope,
  // including the candidate's own bio text, is left exactly as it was.
  let envelope: any = { __kongila: true, tags: [], scores: {}, telemetry: {}, bio: '' };
  if (typeof talent.bio === 'string' && talent.bio.trim()) {
    try {
      const parsed = JSON.parse(talent.bio);
      if (parsed && parsed.__kongila) envelope = parsed;
      else envelope.bio = talent.bio;
    } catch {
      envelope.bio = talent.bio;
    }
  }
  envelope.telemetry = { ...(envelope.telemetry || {}), talentManagerId: managerId || undefined };

  const { error } = await supabase
    .from('talent_profiles').update({ bio: JSON.stringify(envelope) }).eq('id', talentId);

  if (error) return fail(500, `The talent manager was not saved: ${error.message}`);

  await recordAudit(actor, {
    action: managerId ? 'Assign Talent Manager' : 'Clear Talent Manager',
    details: `${talent.full_name || talentId}: talent manager set to ${managerName}.`,
    entityType: 'talent_profile',
    entityId: talentId
  });

  if (managerId) {
    const notified = await notifyUsers(managerId, 'stage_advanced', {
      stageName: 'Talent manager',
      reason: `You are now the talent manager for ${talent.full_name || talentId}.`
    });
    warnings.push(...notified.warnings);
  }

  return { ok: true, status: 200, data: { talentId, talentManagerId: managerId }, warnings };
}
