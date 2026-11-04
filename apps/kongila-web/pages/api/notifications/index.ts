import type { NextApiRequest, NextApiResponse } from 'next';
import { getRequestUser, markNotificationsRead, getSupabaseClient } from '@kongila/database';

/**
 * A user's own notifications.
 *
 * Scoped to the signed-in user in the query, not in the browser. The talent
 * panel used to receive the whole notifications array and apply no filter, so
 * every candidate saw every user's notifications — including clients' and
 * other candidates'.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const actor = await getRequestUser(req);
  if (!actor) return res.status(401).json({ error: 'Not authenticated' });

  const supabase = getSupabaseClient();

  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', actor.userId)
      .order('created_at', { ascending: false })
      .limit(200);

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
    // Marking read is scoped to the caller, so nobody can clear another
    // person's notifications by sending their ids.
    const { notificationIds } = req.body || {};
    const result = await markNotificationsRead(actor.userId, notificationIds);
    if (!result.ok) return res.status(500).json({ error: result.error });
    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
