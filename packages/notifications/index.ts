/**
 * Outbound notifications.
 *
 * What this used to be: three functions that called console.log and returned
 * `{ success: true }`. Nothing was ever sent, and because every one of them
 * claimed success, every caller believed a candidate had been emailed. Of the
 * journey emails a hire needs, zero went out, and nothing anywhere said so.
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

export * from './calendar.ts';
export * from './events.ts';

import { icsAttachment, type CalendarInvite } from './calendar.ts';

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
const BRAND_BLUE = '#0047CC';
const BRAND_NAVY = '#002B7F';
const BRAND_INK = '#1A2340';

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

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function safeWebUrl(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : null;
  } catch {
    return null;
  }
}

function actionFromBody(body: string): { text: string; label?: string; url?: string } {
  const lines = String(body).split(/\r?\n/);
  const actionIndex = lines.findIndex(line => /^\s*[^:\r\n]{2,80}:\s*https?:\/\/\S+\s*$/.test(line));
  if (actionIndex < 0) return { text: String(body) };

  const match = lines[actionIndex].trim().match(/^([^:\r\n]{2,80}):\s*(https?:\/\/\S+)$/);
  const url = safeWebUrl(match?.[2]);
  if (!match || !url) return { text: String(body) };
  lines.splice(actionIndex, 1);
  return { text: lines.join('\n'), label: match[1].trim(), url };
}

function textToHtml(body: string): string {
  const paragraphs = escapeHtml(body)
    .split(/\n{2,}/)
    .map(p => `<p style="margin:0 0 16px 0">${p.replace(/\n/g, '<br>')}</p>`)
    .join('');
  return paragraphs;
}

/** Renders every outbound email inside the Kongila brand shell. */
export function renderBrandedEmail(body: string, customHtml?: string, replyTo?: string): string {
  const { text, label, url } = actionFromBody(body);
  const siteUrl = safeWebUrl(process.env.NEXT_PUBLIC_SITE_URL);
  const logoUrl = safeWebUrl(process.env.EMAIL_LOGO_URL)
    || (siteUrl ? `${siteUrl.replace(/\/$/, '')}/images/kongilalogo.png` : null);
  const supportEmail = process.env.EMAIL_SUPPORT_EMAIL
    || replyTo
    || process.env.EMAIL_REPLY_TO
    || '';
  const safeSupportEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(supportEmail) ? supportEmail : '';
  const emailBody = customHtml || textToHtml(text);
  const preheader = escapeHtml(text.replace(/\s+/g, ' ').trim().slice(0, 140));
  const logo = logoUrl
    ? `<img src="${escapeHtml(logoUrl)}" alt="Kongila" width="156" style="display:block;width:156px;max-width:100%;height:auto;border:0">`
    : `<span style="font-size:25px;font-weight:800;letter-spacing:-.7px;color:${BRAND_BLUE}">Kongila</span>`;
  const actionButton = label && url
    ? `<tr><td align="left" style="padding:8px 0 24px"><a href="${escapeHtml(url)}" style="display:inline-block;background:${BRAND_BLUE};border-radius:8px;color:#ffffff;font-family:Arial,sans-serif;font-size:14px;font-weight:700;line-height:20px;padding:13px 22px;text-decoration:none">${escapeHtml(label)}</a></td></tr>`
    : '';
  const support = safeSupportEmail
    ? `Questions? <a href="mailto:${escapeHtml(safeSupportEmail)}" style="color:#ffffff;text-decoration:underline">${escapeHtml(safeSupportEmail)}</a>`
    : 'Questions? Reply to this email and our team will be glad to help.';

  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>Kongila</title></head><body style="margin:0;padding:0;background:#F3F6FB;color:${BRAND_INK};font-family:Arial,Helvetica,sans-serif"><div style="display:none!important;visibility:hidden;opacity:0;height:0;width:0;overflow:hidden;mso-hide:all">${preheader}</div><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#F3F6FB"><tr><td align="center" style="padding:36px 16px"><table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:600px"><tr><td style="background:#ffffff;border-radius:16px 16px 0 0;padding:26px 36px;border-bottom:4px solid ${BRAND_BLUE}">${logo}</td></tr><tr><td style="background:#ffffff;padding:34px 36px 14px;font-size:15px;line-height:1.75;color:${BRAND_INK}">${emailBody}</td></tr>${actionButton}<tr><td style="background:${BRAND_NAVY};border-radius:0 0 16px 16px;padding:24px 36px;color:#EAF1FF;font-size:12px;line-height:1.7"><div style="font-size:14px;font-weight:700;color:#ffffff;margin-bottom:5px">Kongila</div><div>Africa's talent. The world's teams.</div><div style="margin-top:12px">${support}</div><div style="margin-top:14px;color:#B9C9E8">© ${new Date().getFullYear()} Kongila. All rights reserved.</div></td></tr></table></td></tr></table></body></html>`;
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
        html: renderBrandedEmail(options.body, options.html, options.replyTo),
        reply_to: options.replyTo || process.env.EMAIL_REPLY_TO,
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
export * from './pdf.ts';
export * from './invoicePdf.ts';
