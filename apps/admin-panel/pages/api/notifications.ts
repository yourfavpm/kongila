import type { NextApiRequest, NextApiResponse } from 'next';
import { getRequestUser, notifyUsers, notifyAdmins, markNotificationsRead, getSupabaseClient } from '@kongila/database';
import type { NotificationEvent } from '@kongila/notifications';

/**
 * Notifications, operations side.
 *
 * This route used to be six console.log lines and a `{ success: true }`, with
 * two TODOs: integrate Resend, integrate the database. Both are done, so the
 * route now actually delivers, and the admin portal reads its own inbox from
 * here — it never read the notifications table at all, so anything addressed
 * to operations was invisible even when it was stored.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const actor = await getRequestUser(req);
  if (!actor) return res.status(401).json({ error: 'Not authenticated' });
  if (actor.kind !== 'admin') {
    console.warn(`[api/notifications] refused ${actor.kind} ${actor.userId}`);
    return res.status(403).json({ error: 'Not authorised' });
  }

  // ── The operations inbox ──────────────────────────────────────────────────
  if (req.method === 'GET') {
    const supabase = getSupabaseClient();
    const limit = Math.min(Number(req.query.limit) || 100, 500);

    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', actor.userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) return res.status(500).json({ error: error.message });

    const notifications = (data || []).map((n: any) => ({
      id: n.id,
      userId: n.user_id,
      title: n.title,
      message: n.message,
      module: n.module_type,
      read: Boolean(n.read),
      createdAt: n.created_at
    }));

    return res.status(200).json({
      notifications,
      unread: notifications.filter((n: any) => !n.read).length
    });
  }

  if (req.method === 'POST') {
    const { event, userIds, context, toAdmins, markRead, notificationIds } = req.body || {};

    if (markRead) {
      const result = await markNotificationsRead(actor.userId, notificationIds);
      if (!result.ok) return res.status(500).json({ error: result.error });
      return res.status(200).json({ ok: true });
    }

    if (!event) return res.status(400).json({ error: 'event is required.' });

    const result = toAdmins
      ? await notifyAdmins(event as NotificationEvent, context || {})
      : await notifyUsers(userIds || [], event as NotificationEvent, context || {});

    // Says what was delivered and what was not, rather than a flat success.
    return res.status(200).json(result);
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
