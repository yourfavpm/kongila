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
import { notifyAdmins, notifyUsers } from './notify';
import { buildNotification, sendEmail } from '@kongila/notifications';

/** Named apart from interviewService's ServiceResult, which is a different shape. */
export interface UserServiceResult<T = any> {
  ok: boolean;
  status: number;
  error?: string;
  data?: T;
  warnings?: string[];
}

/** Resolve the actual admin application origin for Supabase auth callbacks. */
function adminAppUrl(): string | null {
  const configured = process.env.NEXT_PUBLIC_ADMIN_URL?.trim();
  const vercelProject = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  const vercelDeployment = process.env.VERCEL_URL?.trim();
  const candidate = configured
    || (vercelProject ? `https://${vercelProject}` : '')
    || (vercelDeployment ? `https://${vercelDeployment}` : '')
    || (process.env.NODE_ENV !== 'production' ? 'http://localhost:3002' : '');
  if (!candidate) return null;
  try {
    const parsed = new URL(candidate);
    if (!['http:', 'https:'].includes(parsed.protocol)) return null;
    return parsed.origin;
  } catch {
    return null;
  }
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
 * Invites an operator with a Supabase-generated, single-use setup link
 * delivered through Kongila's branded Resend template.
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

  const { data: existing, error: existingError } = await supabase
    .from('users')
    .select('id, role, status')
    .eq('email', email)
    .maybeSingle();

  if (existingError) return fail(500, `The existing account could not be checked: ${existingError.message}`);
  if (existing) {
    return fail(409, `${email} already has an account. Change their role instead of inviting them again.`);
  }

  const adminBaseUrl = adminAppUrl();
  if (!adminBaseUrl) return fail(503, 'Admin activation URL is not configured. Set NEXT_PUBLIC_ADMIN_URL on the admin deployment and try again.');
  const setupUrl = `${adminBaseUrl}/set-password`;
  const { data: invited, error: inviteError } = await supabase.auth.admin.generateLink({
    type: 'invite',
    email,
    options: {
      redirectTo: setupUrl,
      data: { full_name: input.name || '', role }
    }
  });

  if (inviteError) {
    return fail(500, `The secure invitation could not be created: ${inviteError.message}`);
  }

  const userId = invited?.user?.id;
  const actionLink = invited?.properties?.action_link;
  if (!userId || !actionLink) {
    return fail(500, 'The secure invitation was created without the required account or setup link.');
  }

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

  const invitation = buildNotification('team_invitation', {
    recipientName: input.name || undefined,
    companyName: 'Kongila',
    inviterName: actor.email || 'Your Kongila administrator',
    roleTitle: ROLE_LABELS[role as AdminRole],
    actionUrl: actionLink,
    expiresIn: 'a limited period'
  });
  const emailResult = await sendEmail({
    to: email,
    subject: invitation.subject,
    body: invitation.body
  });
  const warnings = emailResult.success
    ? []
    : [`The operator account was created, but the invitation email was not sent: ${emailResult.error || 'Resend rejected the message'}. Share the single-use setup link below securely.`];

  return {
    ok: true,
    status: 201,
    data: { id: userId, email, role, emailSent: emailResult.success, ...(!emailResult.success ? { setupLink: actionLink } : {}) },
    warnings
  };
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
  const { data: target, error: targetError } = await supabase
    .from('users')
    .select('id, email, name, role')
    .eq('id', input.userId)
    .maybeSingle();

  if (targetError) return fail(500, `The operator could not be loaded: ${targetError.message}`);
  if (!target) return fail(404, 'That user does not exist.');
  const previousRole = ROLE_LABELS[resolveRole(target.role) as AdminRole] || target.role;
  if (resolveRole(target.role) === role) {
    return { ok: true, status: 200, data: { id: input.userId, role }, warnings: [] };
  }

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

  const nextRole = ROLE_LABELS[role as AdminRole];
  const notified = await notifyUsers(String(target.id), 'operator_role_changed', {
    previousRole,
    newRole: nextRole,
    changedBy: actor.email || actor.userId,
    actionUrl: `${(process.env.NEXT_PUBLIC_ADMIN_URL
      || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '')
      || 'http://localhost:3002').replace(/\/$/, '')}/`
  });

  await recordAudit(actor, {
    action: 'Change Operator Role',
    details: `${target.email}: ${previousRole} to ${nextRole}.`,
    entityType: 'user',
    entityId: input.userId
  });

  return {
    ok: true,
    status: 200,
    data: { id: input.userId, role },
    warnings: notified.warnings
  };
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
  const { data: target, error: targetError } = await supabase
    .from('users')
    .select('id, email, role, status')
    .eq('id', input.userId)
    .maybeSingle();

  if (targetError) return fail(500, `The operator could not be loaded: ${targetError.message}`);
  if (!target) return fail(404, 'That user does not exist.');
  if ((target.status || 'active') === input.status) {
    return { ok: true, status: 200, data: { id: input.userId, status: input.status }, warnings: [] };
  }

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

  const warnings: string[] = [];
  if (input.status === 'suspended') {
    const userNotice = await notifyUsers(String(target.id), 'operator_account_suspended', {
      reason: input.reason
    }, { emailOnly: true });
    warnings.push(...userNotice.warnings);
    const opsNotice = await notifyAdmins('operator_account_suspended_notice', {
      suspendedEmail: target.email,
      reason: input.reason
    }, { excludeUserIds: [String(target.id)] });
    warnings.push(...opsNotice.warnings);
  } else {
    const restored = await notifyUsers(String(target.id), 'operator_account_restored', {
      actionUrl: `${(process.env.NEXT_PUBLIC_ADMIN_URL
        || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '')
        || 'http://localhost:3002').replace(/\/$/, '')}/`
    });
    warnings.push(...restored.warnings);
  }

  return { ok: true, status: 200, data: { id: input.userId, status: input.status }, warnings };
}

/** Sends a fresh setup link through Resend for an invitation that expired or never arrived. */
export async function resendOperatorInvite(
  actor: Actor,
  input: { userId: string }
): Promise<UserServiceResult> {
  const refused = guard(actor);
  if (refused) return refused;
  const supabase = getSupabaseClient();
  const { data: target, error: targetError } = await supabase
    .from('users')
    .select('id, email, name, role')
    .eq('id', input.userId)
    .maybeSingle();

  if (targetError) return fail(500, `The operator could not be loaded: ${targetError.message}`);
  if (!target?.email) return fail(404, 'That user does not exist, or has no email address.');

  const adminBaseUrl = adminAppUrl();
  if (!adminBaseUrl) return fail(503, 'Admin activation URL is not configured. Set NEXT_PUBLIC_ADMIN_URL on the admin deployment and try again.');

  const { data: generated, error } = await supabase.auth.admin.generateLink({
    type: 'magiclink',
    email: target.email,
    options: {
      redirectTo: `${adminBaseUrl}/set-password`,
      data: { full_name: target.name || '', role: storableRole(target.role) }
    }
  });

  if (error) return fail(500, `A fresh setup link could not be created: ${error.message}`);
  const actionLink = generated?.properties?.action_link;
  if (!actionLink) return fail(500, 'Supabase did not return a setup link.');

  const content = buildNotification('team_invitation', {
    recipientName: target.name || undefined,
    companyName: 'Kongila',
    inviterName: actor.email || 'Your Kongila administrator',
    roleTitle: ROLE_LABELS[resolveRole(target.role) as AdminRole] || target.role,
    actionUrl: actionLink,
    expiresIn: 'a limited period'
  });
  const emailResult = await sendEmail({ to: target.email, subject: content.subject, body: content.body });
  if (!emailResult.success) {
    return {
      ok: true,
      status: 200,
      data: {
        id: target.id,
        emailSent: false,
        setupLink: actionLink
      },
      warnings: [`A fresh single-use setup link was created for ${target.email}, but email delivery failed: ${emailResult.error || 'Resend rejected the message'}. Share the link below securely.`]
    };
  }

  await recordAudit(actor, {
    action: 'Resend Operator Invite',
    details: `Invitation resent to ${target.email}.`,
    entityType: 'user',
    entityId: target.id
  });

  return { ok: true, status: 200, data: { id: target.id, emailSent: true } };
}
