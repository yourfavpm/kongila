/**
 * Outbound notifications.
 *
 * What this used to be: three functions that called console.log and returned
 * `{ success: true }`. Nothing was ever sent, and because every one of them
 * claimed success, every caller believed a candidate had been emailed. Of the
 * fifteen emails a hire needs, zero went out, and nothing anywhere said so.
 *
 * Now: Resend over HTTPS, no SDK — one fetch call, so there is nothing to
 * install and nothing to keep in step. A send either happens or returns an
 * error the caller can see. It never claims a success it did not have.
 *
 * Configuration, in every app's .env.local:
 *
 *   RESEND_API_KEY=re_...
 *   RESEND_FROM="Kongila <interviews@yourdomain.com>"
 *
 * The from address must be on a domain verified in Resend, or Resend rejects
 * the send. Until the key is set, sends return `configured: false` and say so
 * rather than pretending.
 *
 * Server side only. RESEND_API_KEY has no NEXT_PUBLIC_ prefix on purpose: it
 * must never reach a browser, so call these from API routes, not components.
 */

export * from './calendar';
export * from './events';

import { icsAttachment, CalendarInvite } from './calendar';

export interface DispatchResult {
  success: boolean;
  channel: 'Email' | 'SMS' | 'WhatsApp';
  dispatchedAt: string;
  /** False when no provider is configured. Not an error, but nothing was sent. */
  configured: boolean;
  /** The provider's id for the message, when it accepted one. */
  messageId?: string;
  error?: string;
}

export interface EmailAttachment {
  filename: string;
  /** Base64. */
  content: string;
  contentType?: string;
}

export interface SendEmailOptions {
  to: string | string[];
  subject: string;
  /** Plain text. An HTML version is derived from it when html is not given. */
  body: string;
  html?: string;
  replyTo?: string;
  attachments?: EmailAttachment[];
}

const RESEND_ENDPOINT = 'https://api.resend.com/emails';

function resendConfig(): { key: string; from: string } | null {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM;
  if (!key || !from) return null;
  return { key, from };
}

/** True when email can actually be sent. Check before promising anything. */
export function emailIsConfigured(): boolean {
  return resendConfig() !== null;
}

function textToHtml(body: string): string {
  const escaped = String(body)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  const paragraphs = escaped
    .split(/\n{2,}/)
    .map(p => `<p style="margin:0 0 16px 0">${p.replace(/\n/g, '<br>')}</p>`)
    .join('');
  return `<div style="font-family:system-ui,-apple-system,'Segoe UI',sans-serif;font-size:15px;line-height:1.6;color:#0F172A">${paragraphs}</div>`;
}

export async function sendEmail(options: SendEmailOptions): Promise<DispatchResult> {
  const dispatchedAt = new Date().toISOString();
  const config = resendConfig();

  if (!config) {
    // Deliberately not an exception. A missing provider should not take down
    // the hire flow, but it must never read as a successful send either.
    const message = 'Email is not configured: set RESEND_API_KEY and RESEND_FROM.';
    console.error(`[notifications] ${message} Nothing was sent to ${String(options.to)}.`);
    return { success: false, configured: false, channel: 'Email', dispatchedAt, error: message };
  }

  try {
    const response = await fetch(RESEND_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.key}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: config.from,
        to: Array.isArray(options.to) ? options.to : [options.to],
        subject: options.subject,
        text: options.body,
        html: options.html || textToHtml(options.body),
        reply_to: options.replyTo,
        attachments: options.attachments?.map(a => ({
          filename: a.filename,
          content: a.content,
          content_type: a.contentType
        }))
      })
    });

    const payload: any = await response.json().catch(() => ({}));

    if (!response.ok) {
      const error = payload?.message || `Resend returned ${response.status}`;
      console.error(`[notifications] email to ${String(options.to)} failed: ${error}`);
      return { success: false, configured: true, channel: 'Email', dispatchedAt, error };
    }

    return {
      success: true,
      configured: true,
      channel: 'Email',
      dispatchedAt,
      messageId: payload?.id
    };
  } catch (err: any) {
    const error = err?.message || 'Email send failed';
    console.error(`[notifications] email to ${String(options.to)} threw: ${error}`);
    return { success: false, configured: true, channel: 'Email', dispatchedAt, error };
  }
}

/**
 * @deprecated Use sendEmail. This used to return success:true without
 * sending; it now performs a real send and is async.
 */
export async function sendEmailNotification(
  to: string,
  subject: string,
  body: string
): Promise<DispatchResult> {
  return sendEmail({ to, subject, body });
}

/** An interview invitation, with a calendar file attached. */
export async function sendInterviewInvitation(args: {
  to: string;
  subject: string;
  body: string;
  invite: CalendarInvite;
}): Promise<DispatchResult> {
  return sendEmail({
    to: args.to,
    subject: args.subject,
    body: args.body,
    attachments: [icsAttachment(args.invite, 'kongila-interview.ics')]
  });
}

export async function dispatchOnboardingAlert(
  talentName: string,
  email: string
): Promise<DispatchResult> {
  return sendEmail({
    to: email,
    subject: 'Welcome to Kongila',
    body: `Hi ${talentName},\n\nYour profile has been vetted and is now visible to clients with matching roles. ` +
          `Log in to complete your onboarding details.\n\nThe Kongila team`
  });
}

// ─── Not built ───────────────────────────────────────────────────────────────
// SMS and WhatsApp have no provider. These used to log and return success, so
// the WhatsApp onboarding step reported as delivered. They now say plainly
// that nothing was sent, and a caller can decide what to do about it.

export async function sendSMSNotification(phone: string, message: string): Promise<DispatchResult> {
  console.warn(`[notifications] SMS is not configured. Nothing sent to ${phone}.`);
  return {
    success: false,
    configured: false,
    channel: 'SMS',
    dispatchedAt: new Date().toISOString(),
    error: 'No SMS provider is configured.'
  };
}

export async function sendWhatsAppNotification(
  phone: string,
  templateName: string,
  params: Record<string, string>
): Promise<DispatchResult> {
  console.warn(`[notifications] WhatsApp is not configured. Nothing sent to ${phone}.`);
  return {
    success: false,
    configured: false,
    channel: 'WhatsApp',
    dispatchedAt: new Date().toISOString(),
    error: 'No WhatsApp provider is configured.'
  };
}

// The invoice PDF, and the small writer behind it.
export * from './pdf';
export * from './invoicePdf';
