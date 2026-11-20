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
  /**
   * How they get in.
   *
   * 'link' emails a single-use setup link and they choose their own
   * password, which is the safer default: no password ever exists outside
   * the person's own head.
   *
   * 'password' creates the account with a password now. It exists because
   * invitation emails do not always arrive, and an operator who is sitting
   * in the room needs to be working in the next minute rather than the next
   * support ticket. They are made to change it the first time they sign in.
   */
  method?: 'link' | 'password';
  /** For method 'password'. One is generated when this is left out. */
  password?: string;
}

/** The character set avoids the pairs that get misread when read aloud. */
const PASSWORD_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';

/** A password strong enough to be temporary and short enough to read out. */
export function generateTemporaryPassword(length = 14): string {
  const bytes = new Uint8Array(length);
  // Available in Node 18+ and in the browser. Math.random is not acceptable
  // for anything that opens an account.
  (globalThis.crypto as Crypto).getRandomValues(bytes);
  let password = '';
  for (let i = 0; i < length; i += 1) {
    password += PASSWORD_ALPHABET[bytes[i] % PASSWORD_ALPHABET.length];
  }
  return password;
}

/** What a password has to be before it opens an admin account. */
export function passwordProblem(password: string): string | null {
  const value = String(password || '');
  if (value.length < 10) return 'Use at least 10 characters.';
  if (!/[a-z]/.test(value)) return 'Include a lower-case letter.';
  if (!/[A-Z]/.test(value)) return 'Include an upper-case letter.';
  if (!/[0-9]/.test(value)) return 'Include a number.';
  return null;
}

/**
 * Invites an operator, either with a Supabase-generated single-use setup
 * link delivered through Kongila's branded Resend template, or with a
 * password set now and changed on first sign-in.
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

  if (input.method === 'password') {
    return createOperatorWithPassword(actor, { ...input, email, role: role as AdminRole }, adminBaseUrl);
  }

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

/**
 * Creates the account with a password, rather than emailing a setup link.
 *
 * Three things are deliberate here.
 *
 * The password is never in the email. It goes back to the super admin who
 * typed it, once, to pass on however they already pass things on. An email
 * that contains a working password sits in two mailboxes for ever and gets
 * forwarded.
 *
 * must_change_password is set in the auth user's metadata, not in a column.
 * The admin portal reads it from the session and sends them to /set-password
 * before anything else loads, and clearing it is part of saving the new one.
 *
 * The account row is written straight after the auth user. If that write
 * fails the auth user exists with no role, which is an account that can sign
 * in and see nothing, so it is reported as a failure rather than a success.
 */
async function createOperatorWithPassword(
  actor: Actor,
  input: InviteOperatorInput & { email: string; role: AdminRole },
  adminBaseUrl: string
): Promise<UserServiceResult> {
  const supabase = getSupabaseClient();
  const generated = !input.password;
  const password = input.password || generateTemporaryPassword();

  const problem = passwordProblem(password);
  if (problem) return fail(400, `That password will not do. ${problem}`);

  const { data: created, error: createError } = await supabase.auth.admin.createUser({
    email: input.email,
    password,
    // Confirmed, because a super admin typing the address is the
    // confirmation. Leaving it unconfirmed means they cannot sign in at all
    // and the only fix is an email they were not sent.
    email_confirm: true,
    user_metadata: {
      full_name: input.name || '',
      role: input.role,
      must_change_password: true
    }
  });

  if (createError) {
    return fail(500, `The account could not be created: ${createError.message}`);
  }

  const userId = created?.user?.id;
  if (!userId) return fail(500, 'The account was created without an id.');

  const { error: rowError } = await supabase.from('users').insert({
    id: userId,
    email: input.email,
    name: input.name || input.email.split('@')[0],
    role: input.role,
    status: 'active',
    password_hash: 'auth_managed',
    created_at: new Date().toISOString()
  });

  if (rowError) {
    return fail(500,
      `${input.email} was created in authentication but their account row could not be written ` +
      `(${rowError.message}). They will be able to sign in and see nothing until this is fixed.`);
  }

  await recordAudit(actor, {
    action: 'Create Operator',
    details: `Created ${input.email} as ${ROLE_LABELS[input.role]} with a temporary password.`,
    entityType: 'user',
    entityId: userId
  });

  const content = buildNotification('operator_account_created', {
    recipientName: input.name || undefined,
    companyName: 'Kongila',
    inviterName: actor.email || 'Your Kongila administrator',
    roleTitle: ROLE_LABELS[input.role],
    actionUrl: `${adminBaseUrl}/`
  });
  const emailResult = await sendEmail({
    to: input.email,
    subject: content.subject,
    body: content.body
  });

  const warnings = emailResult.success
    ? []
    : [`The account was created, but the "your account is ready" email was not sent: ` +
       `${emailResult.error || 'Resend rejected the message'}. Tell them yourself, and give them the password below.`];

  return {
    ok: true,
    status: 201,
    data: {
      id: userId,
      email: input.email,
      role: input.role,
      emailSent: emailResult.success,
      // Returned once, never stored, never emailed. The screen shows it and
      // then it is gone.
      temporaryPassword: password,
      passwordWasGenerated: generated,
      mustChangePassword: true,
      signInUrl: `${adminBaseUrl}/`
    },
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

/**
 * Sets a new password on an existing operator account.
 *
 * For the case the setup link cannot solve: the operator is locked out, the
 * email never arrives, and somebody needs them working today. They are made
 * to change it again the moment they sign in, so what is handed over is a
 * way in rather than their password.
 */
export async function setOperatorPassword(
  actor: Actor,
  input: { userId: string; password?: string }
): Promise<UserServiceResult> {
  const refused = guard(actor);
  if (refused) return refused;
  if (!input.userId) return fail(400, 'userId is required.');

  const supabase = getSupabaseClient();
  const { data: target, error: targetError } = await supabase
    .from('users')
    .select('id, email, name, role')
    .eq('id', input.userId)
    .maybeSingle();

  if (targetError) return fail(500, `The operator could not be loaded: ${targetError.message}`);
  if (!target) return fail(404, 'That user does not exist.');

  const generated = !input.password;
  const password = input.password || generateTemporaryPassword();
  const problem = passwordProblem(password);
  if (problem) return fail(400, `That password will not do. ${problem}`);

  const { error } = await supabase.auth.admin.updateUserById(String(target.id), {
    password,
    user_metadata: {
      full_name: target.name || '',
      role: storableRole(target.role),
      must_change_password: true
    }
  });

  if (error) return fail(500, `The password could not be set: ${error.message}`);

  await recordAudit(actor, {
    action: 'Reset Operator Password',
    details: `Set a temporary password for ${target.email}.`,
    entityType: 'user',
    entityId: String(target.id)
  });

  return {
    ok: true,
    status: 200,
    data: {
      id: target.id,
      email: target.email,
      temporaryPassword: password,
      passwordWasGenerated: generated,
      mustChangePassword: true
    },
    warnings: [
      'The password is shown once and is not emailed. Pass it on the way you would pass on any other credential.'
    ]
  };
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
