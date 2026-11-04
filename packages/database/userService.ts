/**
 * Operator accounts.
 *
 * There was no surface for this at all. An admin existed only if someone put
 * a row in the database by hand, or if their email ended in @kongila.co and
 * the browser auto-provisioned them — which was itself a way in.
 *
 * Every function here refuses anyone who is not a super admin, checks it
 * server-side from the verified token, and records what happened in the
 * audit log. An operator is invited by email and sets their own password:
 * nobody ever types someone else's.
 */

import { getSupabaseClient } from './index';
import type { RequestActor as Actor } from './scope';
import { recordAudit } from './audit';
import {
  ADMIN_ROLES,
  ROLE_LABELS,
  resolveRole,
  canManageUsers,
  storableRole,
  type AdminRole
} from '@kongila/auth';
import { notifyUsers } from './notify';

/** Named apart from interviewService's ServiceResult, which is a different shape. */
export interface UserServiceResult<T = any> {
  ok: boolean;
  status: number;
  error?: string;
  data?: T;
  warnings?: string[];
}

function fail(status: number, error: string): UserServiceResult {
  return { ok: false, status, error };
}

function guard(actor: Actor): UserServiceResult | null {
  if (!actor) return fail(401, 'Not authenticated.');
  if (!canManageUsers(actor.role)) {
    return fail(403, 'Only a super admin can manage operator accounts.');
  }
  return null;
}

// ─── Listing ─────────────────────────────────────────────────────────────────

export async function listOperators(actor: Actor): Promise<UserServiceResult> {
  const refused = guard(actor);
  if (refused) return refused;

  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('users')
    .select('id, name, email, role, status, created_at')
    .in('role', ADMIN_ROLES as unknown as string[])
    .order('created_at', { ascending: false });

  if (error) return fail(500, error.message);

  return {
    ok: true,
    status: 200,
    data: (data || []).map((u: any) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: resolveRole(u.role),
      roleLabel: ROLE_LABELS[resolveRole(u.role) as AdminRole] || u.role,
      status: u.status || 'active',
      createdAt: u.created_at
    }))
  };
}

// ─── Inviting ────────────────────────────────────────────────────────────────

export interface InviteOperatorInput {
  email: string;
  name?: string;
  role: AdminRole;
}

/**
 * Invites an operator.
 *
 * Supabase sends the invitation and the person sets their own password, so
 * no password is ever typed by one person for another or sent over a
 * channel nobody controls. The role is written to public.users by the
 * server, never from the browser: the users table had UPDATE revoked
 * precisely so a client could not set its own role.
 */
export async function inviteOperator(
  actor: Actor,
  input: InviteOperatorInput
): Promise<UserServiceResult> {
  const refused = guard(actor);
  if (refused) return refused;

  const email = String(input.email || '').trim().toLowerCase();
  if (!email || !email.includes('@')) return fail(400, 'A valid email address is required.');

  const role = resolveRole(input.role);
  if (!role || !(ADMIN_ROLES as readonly string[]).includes(role)) {
    return fail(400, `"${input.role}" is not one of the six roles.`);
  }

  const supabase = getSupabaseClient();

  const { data: existing } = await supabase
    .from('users')
    .select('id, role, status')
    .eq('email', email)
    .maybeSingle();

  if (existing) {
    return fail(409, `${email} already has an account. Change their role instead of inviting them again.`);
  }

  // inviteUserByEmail needs the service role key. If the server is running
  // on the anon key this fails, which is the correct outcome: creating
  // operator accounts is not something an anon key should be able to do.
  const { data: invited, error: inviteError } = await (supabase as any).auth.admin.inviteUserByEmail(
    email,
    { data: { full_name: input.name || '', role } }
  );

  if (inviteError) {
    return fail(500, `The invitation could not be sent: ${inviteError.message}`);
  }

  const userId = invited?.user?.id;
  if (!userId) return fail(500, 'Supabase accepted the invitation but returned no user.');

  const { error: rowError } = await supabase.from('users').insert({
    id: userId,
    email,
    name: input.name || email.split('@')[0],
    role,
    status: 'active',
    password_hash: 'auth_managed',
    created_at: new Date().toISOString()
  });

  if (rowError) {
    // The auth user exists but has no row, so they could sign in with no
    // role. Say so plainly rather than reporting success.
    return fail(500,
      `${email} was invited but their account row could not be created (${rowError.message}). ` +
      `They will not be able to sign in until this is fixed.`);
  }

  await recordAudit(actor, {
    action: 'Invite Operator',
    details: `Invited ${email} as ${ROLE_LABELS[role as AdminRole]}.`,
    entityType: 'user',
    entityId: userId
  });

  return { ok: true, status: 201, data: { id: userId, email, role } };
}

// ─── Changing a role ─────────────────────────────────────────────────────────

export async function changeOperatorRole(
  actor: Actor,
  input: { userId: string; role: AdminRole }
): Promise<UserServiceResult> {
  const refused = guard(actor);
  if (refused) return refused;
  if (!input.userId) return fail(400, 'userId is required.');

  const role = resolveRole(input.role);
  if (!role || !(ADMIN_ROLES as readonly string[]).includes(role)) {
    return fail(400, `"${input.role}" is not one of the six roles.`);
  }

  const supabase = getSupabaseClient();
  const { data: target } = await supabase
    .from('users')
    .select('id, email, name, role')
    .eq('id', input.userId)
    .maybeSingle();

  if (!target) return fail(404, 'That user does not exist.');

  // A super admin demoting themselves can lock the last one out of user
  // management, so it is refused unless somebody else can still do it.
  if (String(input.userId) === String(actor.userId) && role !== 'super_admin') {
    const { count } = await supabase
      .from('users')
      .select('id', { count: 'exact', head: true })
      .eq('role', 'super_admin');

    if ((count ?? 0) <= 1) {
      return fail(409, 'You are the only super admin. Promote someone else before changing your own role.');
    }
  }

  const { error } = await supabase
    .from('users')
    .update({ role })
    .eq('id', input.userId);

  if (error) return fail(500, error.message);

  await recordAudit(actor, {
    action: 'Change Operator Role',
    details: `${target.email}: ${ROLE_LABELS[resolveRole(target.role) as AdminRole] || target.role} ` +
             `to ${ROLE_LABELS[role as AdminRole]}.`,
    entityType: 'user',
    entityId: input.userId
  });

  return { ok: true, status: 200, data: { id: input.userId, role } };
}

// ─── Suspending ──────────────────────────────────────────────────────────────

/**
 * Suspends or restores an account.
 *
 * Suspension, not deletion: a deleted operator takes their history with
 * them, and getRequestUser already refuses a suspended user even while their
 * token is still technically valid.
 */
export async function setOperatorStatus(
  actor: Actor,
  input: { userId: string; status: 'active' | 'suspended'; reason?: string }
): Promise<UserServiceResult> {
  const refused = guard(actor);
  if (refused) return refused;
  if (!input.userId) return fail(400, 'userId is required.');
  if (!['active', 'suspended'].includes(input.status)) {
    return fail(400, 'status must be active or suspended.');
  }

  if (String(input.userId) === String(actor.userId) && input.status === 'suspended') {
    return fail(409, 'You cannot suspend your own account.');
  }

  const supabase = getSupabaseClient();
  const { data: target } = await supabase
    .from('users')
    .select('id, email, role')
    .eq('id', input.userId)
    .maybeSingle();

  if (!target) return fail(404, 'That user does not exist.');

  if (input.status === 'suspended' && resolveRole(target.role) === 'super_admin') {
    const { count } = await supabase
      .from('users')
      .select('id', { count: 'exact', head: true })
      .eq('role', 'super_admin')
      .eq('status', 'active');

    if ((count ?? 0) <= 1) {
      return fail(409, 'That is the last active super admin. Promote someone else first.');
    }
  }

  const { error } = await supabase
    .from('users')
    .update({ status: input.status })
    .eq('id', input.userId);

  if (error) return fail(500, error.message);

  await recordAudit(actor, {
    action: input.status === 'suspended' ? 'Suspend Operator' : 'Restore Operator',
    details: `${target.email} ${input.status === 'suspended' ? 'suspended' : 'restored'}.` +
             (input.reason ? ` Reason: ${input.reason}` : ''),
    entityType: 'user',
    entityId: input.userId
  });

  return { ok: true, status: 200, data: { id: input.userId, status: input.status } };
}

/** Sends the invitation again, for one that expired or never arrived. */
export async function resendOperatorInvite(
  actor: Actor,
  input: { userId: string }
): Promise<UserServiceResult> {
  const refused = guard(actor);
  if (refused) return refused;

  const supabase = getSupabaseClient();
  const { data: target } = await supabase
    .from('users')
    .select('id, email, name, role')
    .eq('id', input.userId)
    .maybeSingle();

  if (!target?.email) return fail(404, 'That user does not exist, or has no email address.');

  const { error } = await (supabase as any).auth.admin.inviteUserByEmail(target.email, {
    data: { full_name: target.name || '', role: storableRole(target.role) }
  });

  if (error) return fail(500, `The invitation could not be resent: ${error.message}`);

  await recordAudit(actor, {
    action: 'Resend Operator Invite',
    details: `Invitation resent to ${target.email}.`,
    entityType: 'user',
    entityId: target.id
  });

  return { ok: true, status: 200, data: { id: target.id } };
}
