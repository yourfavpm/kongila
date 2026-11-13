/**
 * Delivering a notification.
 *
 * One call per event. It writes the in-app row and sends the email from the
 * same place, so the two cannot drift: before this, the in-app insert and the
 * email (where either existed at all) were written separately at each call
 * site, with different wording, different fields, and in nine cases column
 * names the table does not have.
 *
 * Rules this enforces so no call site has to remember them:
 *
 *   - `user_id` must be a real user. Rows addressed to 'admin_team', '' and
 *     'usr_horizon' were rejected by the foreign key every time, so nothing
 *     addressed to operations was ever stored.
 *   - Operations is a set of people, not a user id. `notifyAdmins` resolves
 *     the admin roles and writes one row each.
 *   - A notification never fails the action it describes. Everything returns
 *     warnings; nothing throws.
 */

import { getSupabaseClient } from './index';
import {
  buildNotification,
  sendEmail,
  sendInterviewInvitation,
  emailIsConfigured,
  type NotificationEvent,
  type NotificationContext,
  type CalendarInvite
} from '@kongila/notifications';

/** Roles that should see operations notifications. Matches users_role_check. */
const ADMIN_ROLES = [
  'super_admin', 'superadmin', 'admin',
  'account_manager', 'talent_manager', 'ops_manager', 'skill_assessor'
];

// ─── Where a notification sends someone ──────────────────────────────────────
//
// An email that says "your assessment is ready" and gives no way to open it
// makes the recipient go and find it. Every template takes an `actionUrl` and
// renders a button when it has one, and most callers were not passing one.
//
// These return undefined rather than a localhost guess when the environment
// has not been configured, because a button pointing at localhost in a real
// email is worse than no button. `renderBrandedEmail` drops the action when
// the URL is absent.

function portalBase(variable: string): string | undefined {
  const raw = String(process.env[variable] || '').trim();
  if (!raw) return undefined;
  try {
    const url = new URL(raw);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return undefined;
    return raw.replace(/\/+$/, '');
  } catch {
    return undefined;
  }
}

/** A link into the candidate and client portal, or undefined if unconfigured. */
export function talentPortalUrl(path = '/'): string | undefined {
  const base = portalBase('NEXT_PUBLIC_SITE_URL');
  return base ? `${base}${path.startsWith('/') ? path : `/${path}`}` : undefined;
}

/** The client portal is the same deployment as the candidate portal. */
export const clientPortalUrl = talentPortalUrl;

/** A link into the operations portal, or undefined if unconfigured. */
export function adminPortalUrl(path = '/'): string | undefined {
  const base = portalBase('NEXT_PUBLIC_ADMIN_URL');
  return base ? `${base}${path.startsWith('/') ? path : `/${path}`}` : undefined;
}

export interface NotifyResult {
  delivered: number;
  warnings: string[];
}

export interface Recipient {
  userId: string;
  email?: string | null;
  name?: string | null;
  requestedIds: string[];
}

function newId(): string {
  return globalThis.crypto?.randomUUID?.()
    || `notif_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

/** Resolve user IDs and talent profile IDs to real user records. */
export function mapNotificationRecipients(
  userIds: string[],
  users: any[],
  talentProfiles: any[]
): { recipients: Recipient[]; warnings: string[] } {
  const wanted = Array.from(new Set(userIds.filter(Boolean).map(String)));
  const recipientByUserId = new Map<string, Recipient>();
  const recipientByRequestedId = new Map<string, Recipient>();

  const addRecipient = (user: any, requestedId: string) => {
    const userId = String(user?.id || '');
    if (!userId) return;
    let recipient = recipientByUserId.get(userId);
    if (!recipient) {
      recipient = {
        userId,
        email: user.email,
        name: user.name,
        requestedIds: []
      };
      recipientByUserId.set(userId, recipient);
    }
    if (!recipient.requestedIds.includes(requestedId)) recipient.requestedIds.push(requestedId);
    recipientByRequestedId.set(requestedId, recipient);
  };

  const wantedIds = new Set(wanted);
  for (const user of users || []) {
    const id = String(user?.id || '');
    if (wantedIds.has(id)) addRecipient(user, id);
  }

  for (const profile of talentProfiles || []) {
    const profileId = String(profile?.id || '');
    const user = (users || []).find((row: any) => String(row?.id) === String(profile?.user_id));
    if (wantedIds.has(profileId) && user) addRecipient(user, profileId);
  }

  const warnings = wanted
    .filter(id => !recipientByRequestedId.has(id))
    .map(id => `"${id}" is not a user or linked talent profile, so nothing was sent to it.`);

  return { recipients: Array.from(recipientByUserId.values()), warnings };
}

/** Looks up email and name, and drops anyone who is not a real user. */
export async function resolveNotificationRecipients(userIds: string[]): Promise<{
  recipients: Recipient[];
  warnings: string[];
}> {
  const wanted = Array.from(new Set(userIds.filter(Boolean).map(String)));
  if (wanted.length === 0) return { recipients: [], warnings: ['No recipient was given.'] };

  const supabase = getSupabaseClient();
  const { data: directUsers, error } = await supabase
    .from('users')
    .select('id, email, name')
    .in('id', wanted);

  if (error) {
    return { recipients: [], warnings: [`Could not resolve recipients: ${error.message}`] };
  }

  const found = new Set((directUsers || []).map((user: any) => String(user.id)));
  const missingIds = wanted.filter(id => !found.has(id));
  let talentProfiles: any[] = [];
  let linkedUsers: any[] = [];
  const warnings: string[] = [];

  if (missingIds.length > 0) {
    const { data, error: profileError } = await supabase
      .from('talent_profiles')
      .select('id, user_id')
      .in('id', missingIds);
    if (profileError) {
      warnings.push(`Could not resolve talent profile recipients: ${profileError.message}`);
    } else {
      talentProfiles = data || [];
      const linkedUserIds = Array.from(new Set(
        talentProfiles.map((profile: any) => String(profile.user_id || '')).filter(Boolean)
      )).filter(id => !found.has(id));
      if (linkedUserIds.length > 0) {
        const { data: linked, error: linkedError } = await supabase
          .from('users')
          .select('id, email, name')
          .in('id', linkedUserIds);
        if (linkedError) warnings.push(`Could not load linked recipient accounts: ${linkedError.message}`);
        else linkedUsers = linked || [];
      }
    }
  }

  const resolved = mapNotificationRecipients(
    wanted,
    [...(directUsers || []), ...linkedUsers],
    talentProfiles
  );
  warnings.push(...resolved.warnings);
  return { recipients: resolved.recipients, warnings };
}

function logNotificationWarnings(event: NotificationEvent, warnings: string[]) {
  for (const warning of warnings) {
    console.warn(`[notifications] ${event}: ${warning}`);
  }
}

export interface NotifyOptions {
  /** Attached when the event is an interview and a time is known. */
  calendarInvite?: CalendarInvite;
  /** Skip the email and write only the in-app row. */
  inAppOnly?: boolean;
  /** Skip the in-app row and only send the email. */
  emailOnly?: boolean;
  /** Links an in-app row back to the thing it is about. */
  sourceRecordId?: string;
  /** Excludes a person when notifying the wider operations team. */
  excludeUserIds?: string[];
}

/**
 * Sends one event to one or more users.
 *
 * Context is per-recipient where it needs to be — a time formatted in the
 * reader's own zone, for instance — so callers pass a function when the
 * wording differs by recipient.
 */
export async function notifyUsers(
  userIds: string | string[],
  event: NotificationEvent,
  context: NotificationContext | ((recipient: Recipient) => NotificationContext) = {},
  options: NotifyOptions = {}
): Promise<NotifyResult> {
  const ids = Array.isArray(userIds) ? userIds : [userIds];
  const { recipients, warnings } = await resolveNotificationRecipients(ids);
  if (recipients.length === 0) {
    logNotificationWarnings(event, warnings);
    return { delivered: 0, warnings };
  }

  const supabase = getSupabaseClient();
  let delivered = 0;

  // ── In-app ────────────────────────────────────────────────────────────────
  const inAppRows = recipients
    .map(recipient => {
      const ctx = typeof context === 'function' ? context(recipient) : context;
      const content = buildNotification(event, { recipientName: recipient.name || undefined, ...ctx });
      if (!content.alsoInApp || options.emailOnly) return null;
      return {
        id: newId(),
        user_id: recipient.userId,
        title: content.subject,
        message: content.inApp,
        module_type: content.module,
        read: false,
        created_at: new Date().toISOString(),
        ...(options.sourceRecordId ? { source_record_id: options.sourceRecordId } : {})
      };
    })
    .filter(Boolean) as any[];

  if (inAppRows.length > 0) {
    const { error } = await supabase.from('notifications').insert(inAppRows);
    if (error) warnings.push(`In-app notification failed: ${error.message}`);
    else delivered += inAppRows.length;
  }

  // ── Email ─────────────────────────────────────────────────────────────────
  if (options.inAppOnly) {
    logNotificationWarnings(event, warnings);
    return { delivered, warnings };
  }

  if (!emailIsConfigured()) {
    warnings.push('Email is not configured, so nothing was emailed.');
    logNotificationWarnings(event, warnings);
    return { delivered, warnings };
  }

  for (const recipient of recipients) {
    if (!recipient.email) {
      warnings.push(`No email address on file for ${recipient.name || recipient.userId}.`);
      continue;
    }

    const ctx = typeof context === 'function' ? context(recipient) : context;
    const content = buildNotification(event, { recipientName: recipient.name || undefined, ...ctx });

    const result = options.calendarInvite
      ? await sendInterviewInvitation({
          to: recipient.email,
          subject: content.subject,
          body: content.body,
          invite: options.calendarInvite
        })
      : await sendEmail({ to: recipient.email, subject: content.subject, body: content.body });

    if (result.success) delivered++;
    else warnings.push(`Email to ${recipient.name || recipient.email} failed: ${result.error}`);
  }

  logNotificationWarnings(event, warnings);
  return { delivered, warnings };
}

/**
 * Sends an event to operations.
 *
 * The admin portal never read the notifications table, so anything addressed
 * to operations was invisible even when it was stored. With the inbox in
 * place, these now land somewhere a person looks.
 */
export async function notifyAdmins(
  event: NotificationEvent,
  context: NotificationContext = {},
  options: NotifyOptions = {}
): Promise<NotifyResult> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('users')
    .select('id')
    .in('role', ADMIN_ROLES);

  if (error) return { delivered: 0, warnings: [`Could not find operations users: ${error.message}`] };
  if (!data || data.length === 0) {
    return { delivered: 0, warnings: ['No operations users exist to notify.'] };
  }

  const excluded = new Set((options.excludeUserIds || []).map(String));
  const recipients = data.map((u: any) => String(u.id)).filter((id: string) => !excluded.has(id));
  if (recipients.length === 0) {
    return { delivered: 0, warnings: ['No eligible operations users exist to notify.'] };
  }

  return notifyUsers(recipients, event, context, options);
}

/**
 * Sends to the operations people holding particular roles.
 *
 * `notifyAdmins` goes to everybody in operations, which is right for "a new
 * request arrived" and wrong for most of the rest. Both FRDs route internal
 * notices by role — an SLA breach to the Talent Manager and Ops Manager, a
 * client dropping to At Risk to the Ops Manager, a payout failure to Finance
 * — and sending all of those to everyone is how people learn to ignore the
 * ones meant for them.
 *
 * Falls back to all of operations when nobody holds the named roles, because
 * the alternative is that the notice reaches nobody at all.
 */
export async function notifyRoles(
  roles: string[],
  event: NotificationEvent,
  context: NotificationContext = {},
  options: NotifyOptions = {}
): Promise<NotifyResult> {
  const wanted = roles.map(r => String(r).trim().toLowerCase()).filter(Boolean);
  if (wanted.length === 0) return notifyAdmins(event, context, options);

  const supabase = getSupabaseClient();
  const { data, error } = await supabase.from('users').select('id').in('role', wanted);

  if (error) {
    return { delivered: 0, warnings: [`Could not find the ${wanted.join(' or ')}: ${error.message}`] };
  }

  const excluded = new Set((options.excludeUserIds || []).map(String));
  const recipients = (data || []).map((u: any) => String(u.id)).filter((id: string) => !excluded.has(id));

  if (recipients.length === 0) {
    const fallback = await notifyAdmins(event, context, options);
    return {
      delivered: fallback.delivered,
      warnings: [
        `Nobody holds the role ${wanted.join(' or ')}, so this went to all of operations.`,
        ...fallback.warnings
      ]
    };
  }

  return notifyUsers(recipients, event, context, options);
}

/** The people who own a candidate's vetting. */
export async function notifyTalentManagers(
  event: NotificationEvent,
  context: NotificationContext = {},
  options: NotifyOptions = {}
): Promise<NotifyResult> {
  return notifyRoles(['talent_manager', 'ops_manager', 'super_admin'], event, context, options);
}

/** The people who own a client relationship. */
export async function notifyAccountManagers(
  event: NotificationEvent,
  context: NotificationContext = {},
  options: NotifyOptions = {}
): Promise<NotifyResult> {
  return notifyRoles(['account_manager', 'ops_manager', 'super_admin'], event, context, options);
}

/** The people who own money. */
export async function notifyFinance(
  event: NotificationEvent,
  context: NotificationContext = {},
  options: NotifyOptions = {}
): Promise<NotifyResult> {
  return notifyRoles(['finance', 'finance_admin', 'super_admin'], event, context, options);
}

/**
 * Sends to the specific people on a request, falling back to all of
 * operations when nobody is assigned — better than nobody hearing.
 */
export async function notifyRequestOwners(
  request: { assignedAccountManagerId?: string | null; assignedTalentManagerId?: string | null },
  event: NotificationEvent,
  context: NotificationContext = {},
  options: NotifyOptions = {}
): Promise<NotifyResult> {
  const owners = [request?.assignedAccountManagerId, request?.assignedTalentManagerId]
    .filter((id): id is string => Boolean(id));

  if (owners.length === 0) return notifyAdmins(event, context, options);
  return notifyUsers(owners, event, context, options);
}

/** Marks notifications read, scoped to their owner so nobody clears another's. */
export async function markNotificationsRead(
  userId: string,
  notificationIds?: string[]
): Promise<{ ok: boolean; error?: string }> {
  const supabase = getSupabaseClient();
  let query = supabase
    .from('notifications')
    .update({ read: true })
    .eq('user_id', userId);

  if (notificationIds && notificationIds.length > 0) {
    query = query.in('id', notificationIds);
  }

  const { error } = await query;
  return error ? { ok: false, error: error.message } : { ok: true };
}
