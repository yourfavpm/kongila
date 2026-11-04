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

export interface NotifyResult {
  delivered: number;
  warnings: string[];
}

interface Recipient {
  userId: string;
  email?: string | null;
  name?: string | null;
}

function newId(): string {
  return globalThis.crypto?.randomUUID?.()
    || `notif_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

/** Looks up email and name, and drops anyone who is not a real user. */
async function resolveRecipients(userIds: string[]): Promise<{
  recipients: Recipient[];
  warnings: string[];
}> {
  const warnings: string[] = [];
  const wanted = Array.from(new Set(userIds.filter(Boolean).map(String)));
  if (wanted.length === 0) return { recipients: [], warnings: ['No recipient was given.'] };

  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('users')
    .select('id, email, name')
    .in('id', wanted);

  if (error) return { recipients: [], warnings: [`Could not resolve recipients: ${error.message}`] };

  const found = new Set((data || []).map((u: any) => String(u.id)));
  for (const id of wanted) {
    if (!found.has(id)) {
      // This is where 'admin_team' used to end up, silently.
      warnings.push(`"${id}" is not a user, so nothing was sent to it.`);
    }
  }

  return {
    recipients: (data || []).map((u: any) => ({ userId: String(u.id), email: u.email, name: u.name })),
    warnings
  };
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
  const { recipients, warnings } = await resolveRecipients(ids);
  if (recipients.length === 0) return { delivered: 0, warnings };

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
  if (options.inAppOnly) return { delivered, warnings };

  if (!emailIsConfigured()) {
    warnings.push('Email is not configured, so nothing was emailed.');
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

  return notifyUsers(data.map((u: any) => String(u.id)), event, context, options);
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
