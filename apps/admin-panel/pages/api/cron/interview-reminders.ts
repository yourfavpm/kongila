import type { NextApiRequest, NextApiResponse } from 'next';
import { getSupabaseClient } from '@kongila/database';
import { interviewInstant, formatInstantInZone } from '@kongila/utils';
import { isLiveInterview } from '@kongila/workflows';
import { sendEmail, emailIsConfigured } from '@kongila/notifications';

/**
 * Interview reminders.
 *
 * There were none. An interview was booked and then nothing happened until
 * the moment it started, or did not.
 *
 * This is a cron endpoint, not a background worker: Next.js API routes do not
 * stay running, so something external has to call it. Every fifteen minutes
 * is right — the windows below are wide enough that a late or skipped run
 * still catches the reminder, and each one is stamped so it cannot go twice.
 *
 * Set it up as either:
 *
 *   Supabase scheduled function (Database → Cron):
 *     select cron.schedule('kongila-interview-reminders', '*\/15 * * * *',
 *       $$ select net.http_post(
 *            url := 'https://<admin-host>/api/cron/interview-reminders',
 *            headers := '{"x-cron-secret":"<CRON_SECRET>"}'::jsonb
 *          ) $$);
 *
 *   or a Vercel cron entry in vercel.json pointing at this path.
 *
 * Needs in .env.local:
 *   CRON_SECRET=<a long random string>
 *   RESEND_API_KEY, RESEND_FROM
 *
 * Without CRON_SECRET the route refuses every request, rather than leaving an
 * unauthenticated endpoint that anyone can use to send mail from your domain.
 */

interface Window {
  column: 'reminder_24h_sent_at' | 'reminder_1h_sent_at';
  /** Minutes before the start that this reminder is due. */
  leadMinutes: number;
  /** How wide a net to cast, so a missed run still catches it. */
  toleranceMinutes: number;
  label: string;
}

const WINDOWS: Window[] = [
  { column: 'reminder_24h_sent_at', leadMinutes: 24 * 60, toleranceMinutes: 90, label: 'tomorrow' },
  { column: 'reminder_1h_sent_at', leadMinutes: 60, toleranceMinutes: 30, label: 'in about an hour' }
];

function authorised(req: NextApiRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const provided = req.headers['x-cron-secret']
    || (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  return provided === secret;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!process.env.CRON_SECRET) {
    console.error('[cron/interview-reminders] CRON_SECRET is not set; refusing.');
    return res.status(503).json({ error: 'Reminders are not configured.' });
  }
  if (!authorised(req)) {
    return res.status(401).json({ error: 'Not authorised' });
  }
  if (!emailIsConfigured()) {
    return res.status(503).json({
      error: 'Email is not configured, so no reminder was sent. Set RESEND_API_KEY and RESEND_FROM.'
    });
  }

  const supabase = getSupabaseClient();
  const now = Date.now();
  const summary = { checked: 0, sent: 0, skipped: 0, failed: 0, errors: [] as string[] };

  try {
    // One read covering the widest window, rather than a query per reminder.
    const horizon = new Date(now + 26 * 60 * 60 * 1000).toISOString();
    const floor = new Date(now - 60 * 60 * 1000).toISOString();

    const { data: interviews, error } = await supabase
      .from('interviews')
      .select('*')
      .gte('scheduled_time', floor)
      .lte('scheduled_time', horizon);

    if (error) throw new Error(error.message);

    const ids = Array.from(new Set(
      (interviews || []).flatMap((iv: any) => [iv.talent_id, iv.client_id].filter(Boolean))
    ));
    const { data: users } = ids.length
      ? await supabase.from('users').select('id, email, name').in('id', ids)
      : { data: [] as any[] };

    for (const interview of interviews || []) {
      summary.checked++;
      if (!isLiveInterview({ status: interview.status })) { summary.skipped++; continue; }

      const startsAt = interviewInstant(interview);
      if (!startsAt) { summary.skipped++; continue; }
      const minutesAway = (new Date(startsAt).getTime() - now) / 60_000;

      for (const window of WINDOWS) {
        if (interview[window.column]) continue;
        const distance = Math.abs(minutesAway - window.leadMinutes);
        if (minutesAway < 0 || distance > window.toleranceMinutes) continue;

        const recipients = [
          { id: interview.talent_id, zone: interview.talent_timezone },
          { id: interview.client_id, zone: interview.client_timezone }
        ].filter(r => r.id);

        let anyFailed = false;
        for (const recipient of recipients) {
          const user = (users || []).find((u: any) => String(u.id) === String(recipient.id));
          if (!user?.email) {
            summary.errors.push(`No email for ${recipient.id} on interview ${interview.id}.`);
            anyFailed = true;
            continue;
          }

          const result = await sendEmail({
            to: user.email,
            subject: `Reminder: ${interview.title || 'your Kongila interview'} ${window.label}`,
            body:
              `Hi ${user.name || 'there'},\n\n` +
              `This is a reminder that your interview is ${window.label}.\n\n` +
              `${formatInstantInZone(startsAt, recipient.zone || 'UTC')}` +
              `${recipient.zone ? '' : ' (UTC — set your timezone to see this in your own time)'}\n\n` +
              (interview.meeting_link
                ? `Joining link: ${interview.meeting_link}\n\n`
                : `Joining details will follow before the call.\n\n`) +
              `The Kongila team`
          });

          if (result.success) summary.sent++;
          else {
            summary.failed++;
            anyFailed = true;
            summary.errors.push(`Interview ${interview.id}: ${result.error}`);
          }
        }

        // Stamped even on a partial failure, so a permanently undeliverable
        // address does not make this run the same send every fifteen minutes
        // forever. The failure is in the response and in the log.
        const { error: stampError } = await supabase
          .from('interviews')
          .update({ [window.column]: new Date().toISOString() })
          .eq('id', interview.id);

        if (stampError) {
          summary.errors.push(`Could not stamp ${window.column} on ${interview.id}: ${stampError.message}`);
        }
        if (anyFailed) {
          console.warn(`[cron/interview-reminders] interview ${interview.id} reminder was incomplete.`);
        }
      }
    }

    return res.status(200).json(summary);
  } catch (err: any) {
    console.error('[cron/interview-reminders] run failed:', err);
    return res.status(500).json({ error: err?.message || 'Reminder run failed', summary });
  }
}
