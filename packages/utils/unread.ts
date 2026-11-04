/**
 * Unread counts.
 *
 * There were three different computations of "unread" across the two
 * portals, and the message badge was simply wrong: it read `m.read`, but a
 * message row carries `isRead`, so the test was true for every message in the
 * database. Every user saw a badge counting every message ever sent, their
 * own included.
 *
 * One implementation, used by both dashboards and both notification panels.
 *
 * This file imports nothing, so it can be tested on its own.
 */

/** A message is unread when somebody else sent it and you have not read it. */
export function isUnreadMessage(message: any, viewerId?: string | null): boolean {
  if (!message) return false;

  // Your own message is never unread for you. The old count did not check
  // the sender, so sending a message raised your own badge.
  const senderId = message.senderId ?? message.sender_id;
  if (viewerId && senderId && String(senderId) === String(viewerId)) return false;

  // isRead is the field on a message row. `read` is the field on a
  // notification row, and reading it here is what broke the badge.
  const read = message.isRead ?? message.is_read ?? message.read_status;
  return !read;
}

export function countUnreadMessages(messages: any[] | null | undefined, viewerId?: string | null): number {
  return (messages || []).filter(m => isUnreadMessage(m, viewerId)).length;
}

/** Only messages in one thread, for a per-conversation badge. */
export function countUnreadInConversation(
  messages: any[] | null | undefined,
  conversationId: string,
  viewerId?: string | null
): number {
  return (messages || []).filter(m => {
    const id = m?.conversationId ?? m?.conversation_id;
    return String(id) === String(conversationId) && isUnreadMessage(m, viewerId);
  }).length;
}

export function isUnreadNotification(notification: any): boolean {
  if (!notification) return false;
  // read is the notification field; read_status is the older column name.
  const read = notification.read ?? notification.read_status;
  return !read;
}

export function countUnreadNotifications(notifications: any[] | null | undefined): number {
  return (notifications || []).filter(isUnreadNotification).length;
}

/**
 * Unread notifications per section of the product, for sidebar badges.
 *
 * Both dashboards used to guess the section by searching the title and
 * message for words like "interview" and "contract", so a notification whose
 * text happened to mention another section counted against the wrong badge,
 * and the first matching branch won. module_type is written by the
 * notification service, so the guessing is only a fallback for older rows.
 */
const MODULE_ALIASES: Record<string, string> = {
  account: 'notifications',
  requests: 'requests',
  matches: 'opportunities',
  interviews: 'interviews',
  offers: 'opportunities',
  contracts: 'contracts',
  vetting: 'vetting_progress'
};

const KEYWORD_FALLBACK: Array<[RegExp, string]> = [
  [/interview/i, 'interviews'],
  [/contract/i, 'contracts'],
  [/offer|match|shortlist|opportunit/i, 'opportunities'],
  [/task/i, 'tasks'],
  [/stage|vetting|vetted/i, 'vetting_progress'],
  [/score|grade/i, 'scores_grades'],
  [/document|compliance/i, 'compliance'],
  [/request/i, 'requests']
];

export function countUnreadByModule(
  notifications: any[] | null | undefined
): Record<string, number> {
  const counts: Record<string, number> = {};

  for (const notification of notifications || []) {
    if (!isUnreadNotification(notification)) continue;

    const moduleType = notification.module ?? notification.module_type ?? notification.moduleType;
    let section = moduleType ? MODULE_ALIASES[String(moduleType)] : undefined;

    if (!section) {
      const text = `${notification.title || ''} ${notification.message || ''}`;
      section = KEYWORD_FALLBACK.find(([pattern]) => pattern.test(text))?.[1];
    }

    if (section) counts[section] = (counts[section] || 0) + 1;
  }

  return counts;
}
