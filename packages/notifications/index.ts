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
export const EMAIL_DESIGN_TOKENS = {
  canvas: '#F3F6FA',
  surface: '#FFFFFF',
  surfaceSoft: '#F8FAFC',
  navy: '#182B49',
  body: '#334155',
  muted: '#718096',
  border: '#E5EAF1',
  blue: '#1455C0',
  success: '#13866F',
  pending: '#A56408',
  scheduled: '#7259B8',
  danger: '#BD4D58'
} as const;

const BRAND_NAVY = EMAIL_DESIGN_TOKENS.navy;
const BRAND_INK = EMAIL_DESIGN_TOKENS.navy;

function resendConfig(): { key: string; from: string } | null {
  const key = process.env.RESEND_API_KEY?.trim();
  const from = process.env.RESEND_FROM?.trim();
  if (!key || !from) return null;
  return { key, from };
}

/** Names only; safe to include in server-side configuration diagnostics. */
export function emailConfigurationMissing(): string[] {
  return (['RESEND_API_KEY', 'RESEND_FROM'] as const)
    .filter(name => !process.env[name]?.trim());
}

/** True when email can actually be sent. Check before promising anything. */
export function emailIsConfigured(): boolean {
  return emailConfigurationMissing().length === 0;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\"/g, '&quot;')
    .replace(/'/g, '&#39;');
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

function emailTone(subject: string, body: string): { label: string; color: string; tint: string } {
  const text = `${subject} ${body}`.toLowerCase();
  if (/\b(rejected|rejection|failed|failure|suspended|overdue|declined|cancelled|canceled|voided|terminated)\b/.test(text)
    || /not taking it further|not selected|unsuccessful|not moving forward/.test(text)) {
    return { label: 'Attention', color: EMAIL_DESIGN_TOKENS.danger, tint: '#FFF3F4' };
  }
  if (/\b(interview|rescheduled|schedule|reminder|calendar)\b/.test(text)) {
    return { label: 'Scheduled update', color: EMAIL_DESIGN_TOKENS.scheduled, tint: '#F5F2FC' };
  }
  if (/\b(pending|awaiting|required|expires|expiring|verify|verification|reset)\b/.test(text)) {
    return { label: 'Action or review', color: EMAIL_DESIGN_TOKENS.pending, tint: '#FFF8EB' };
  }
  if (/\b(approved|complete|completed|signed|paid|accepted|advanced|welcome|confirmed|restored)\b/.test(text)) {
    return { label: 'Progress update', color: EMAIL_DESIGN_TOKENS.success, tint: '#EDF8F4' };
  }
  return { label: 'Kongila update', color: EMAIL_DESIGN_TOKENS.blue, tint: '#EFF5FD' };
}

function messageSections(body: string, isScheduling: boolean): { greeting: string; paragraphs: string[]; details: string[] } {
  const lines = String(body).replace(/\r/g, '').split('\n');
  while (lines.length && !lines[0].trim()) lines.shift();
  let greeting = '';
  if (/^(hi|hello|dear)\b/i.test(lines[0] || '')) greeting = lines.shift()!.trim();
  let text = lines.join('\n').trim();
  text = text.replace(/(?:\n\s*)?(?:The Kongila team|Kongila team)\s*$/i, '').trim();
  const paragraphs = text.split(/\n\s*\n/).map(part => part.trim()).filter(Boolean);
  const intro = paragraphs.shift() || '';
  const isLabeled = (paragraph: string) => paragraph.split('\n').some(line =>
    /^.{2,48}:\s+\S/.test(line) || /^https?:\/\/\S+$/i.test(line)
  );
  const details = paragraphs.filter(part => isLabeled(part) || isScheduling);
  const prose = paragraphs.filter(part => !details.includes(part));
  return { greeting, paragraphs: [intro, ...prose].filter(Boolean), details };
}

function renderDetailsPanel(details: string[], tone: { color: string; tint: string }): string {
  if (!details.length) return '';
  const rows = details.flatMap(section => section.split('\n')).map(line => {
    const match = line.match(/^([^:]{2,48}):\s+(.+)$/);
    if (!match) {
      return `<tr><td colspan="2" style="padding:7px 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.55;color:${EMAIL_DESIGN_TOKENS.body}">${escapeHtml(line)}</td></tr>`;
    }
    return `<tr><td valign="top" style="width:34%;padding:7px 12px 7px 0;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.5;font-weight:700;color:${EMAIL_DESIGN_TOKENS.muted}">${escapeHtml(match[1])}</td><td valign="top" style="padding:7px 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.55;color:${EMAIL_DESIGN_TOKENS.navy};word-break:break-word">${escapeHtml(match[2])}</td></tr>`;
  }).join('');
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:18px 0 8px;background:${tone.tint};border-left:3px solid ${tone.color}"><tr><td style="padding:13px 16px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">${rows}</table></td></tr></table>`;
}

/** Renders transactional emails in Kongila's table-based email design system. */
export function renderBrandedEmail(body: string, customHtml?: string, replyTo?: string, subject = ''): string {
  const { text, label, url } = actionFromBody(body);
  const siteUrl = safeWebUrl(process.env.NEXT_PUBLIC_SITE_URL);
  const logoUrl = safeWebUrl(process.env.EMAIL_LOGO_URL)
    || (siteUrl ? `${siteUrl.replace(/\/$/, '')}/images/kongilalogo.png` : null);
  const supportEmail = process.env.EMAIL_SUPPORT_EMAIL || replyTo || process.env.EMAIL_REPLY_TO || 'support@kongila.com';
  const safeSupportEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(supportEmail) ? supportEmail : '';
  const title = subject.trim() || text.split(/\r?\n/).find(line => line.trim()) || 'A Kongila update';
  const tone = emailTone(title, text);
  const sections = messageSections(text, /\b(interview|rescheduled|schedule|reminder|calendar)\b/i.test(`${title} ${text}`));
  const emailBody = customHtml || sections.paragraphs.map((paragraph, index) =>
    `<p style="margin:${index === 0 ? '0 0 16px' : '0 0 13px'};font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.75;color:${EMAIL_DESIGN_TOKENS.body}">${escapeHtml(paragraph).replace(/\n/g, '<br>')}</p>`
  ).join('') + renderDetailsPanel(sections.details, tone);
  const preheader = escapeHtml(text.replace(/\s+/g, ' ').trim().slice(0, 140) || title);
  const logo = logoUrl
    ? `<img src="${escapeHtml(logoUrl)}" alt="Kongila" width="126" style="display:block;width:126px;max-width:100%;height:auto;border:0">`
    : '';
  const greeting = sections.greeting
    ? `<tr><td style="padding:0 0 11px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;color:${EMAIL_DESIGN_TOKENS.muted}">${escapeHtml(sections.greeting)}</td></tr>`
    : '';
  const status = `<tr><td style="padding:0 0 13px"><table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr><td style="padding:5px 9px;background:${tone.tint};font-family:Arial,Helvetica,sans-serif;font-size:11px;line-height:1.2;font-weight:700;letter-spacing:.03em;color:${tone.color}">${escapeHtml(tone.label)}</td></tr></table></td></tr>`;
  const actionButton = label && url
    ? `<tr><td align="left" class="email-panel-pad" style="background:#ffffff;padding:8px 34px 24px"><table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr><td align="center" bgcolor="${BRAND_NAVY}" style="background:${BRAND_NAVY}"><a href="${escapeHtml(url)}" style="display:inline-block;background:${BRAND_NAVY};border:1px solid ${BRAND_NAVY};color:#ffffff;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:700;line-height:20px;padding:12px 20px;text-decoration:none">${escapeHtml(label)}</a></td></tr></table></td></tr>`
    : '';
  const support = safeSupportEmail
    ? `Questions? <a href="mailto:${escapeHtml(safeSupportEmail)}" style="color:${EMAIL_DESIGN_TOKENS.blue};text-decoration:underline">${escapeHtml(safeSupportEmail)}</a>`
    : 'Questions? Reply to this email and our team will be glad to help.';
  const privacyLink = siteUrl
    ? `<a href="${escapeHtml(`${siteUrl.replace(/\/$/, '')}/legal/privacy`)}" style="color:${EMAIL_DESIGN_TOKENS.muted};text-decoration:underline">Privacy policy</a><span style="color:${EMAIL_DESIGN_TOKENS.border}"> &nbsp;|&nbsp; </span>`
    : '';

  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light"><title>${escapeHtml(title)}</title><style>@media only screen and (max-width:620px){.email-outer-pad{padding:18px 10px!important}.email-panel-pad{padding-left:22px!important;padding-right:22px!important}.email-title{font-size:24px!important;line-height:1.25!important}}@media (prefers-color-scheme:dark){.email-canvas{background:#e9eef5!important}.email-surface{background:#ffffff!important}.email-copy{color:#334155!important}}</style></head><body style="margin:0;padding:0;background:${EMAIL_DESIGN_TOKENS.canvas};color:${BRAND_INK};font-family:Arial,Helvetica,sans-serif"><div style="display:none!important;visibility:hidden;opacity:0;height:0;width:0;overflow:hidden;mso-hide:all">${preheader}</div><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" class="email-canvas" style="background:${EMAIL_DESIGN_TOKENS.canvas}"><tr><td class="email-outer-pad" align="center" style="padding:30px 16px"><table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:600px;border:1px solid ${EMAIL_DESIGN_TOKENS.border}"><tr><td class="email-surface email-panel-pad" style="background:#ffffff;padding:20px 34px;border-bottom:1px solid ${EMAIL_DESIGN_TOKENS.border}">${logo}</td></tr><tr><td class="email-surface email-panel-pad" style="background:#ffffff;padding:29px 34px 25px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">${status}${greeting}<tr><td class="email-title" style="padding:0 0 16px;font-family:Arial,Helvetica,sans-serif;font-size:27px;line-height:1.25;letter-spacing:-.4px;font-weight:700;color:${EMAIL_DESIGN_TOKENS.navy}">${escapeHtml(title)}</td></tr></table><div class="email-copy" style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.75;color:${EMAIL_DESIGN_TOKENS.body}">${emailBody}</div></td></tr>${actionButton}<tr><td class="email-panel-pad" style="background:${EMAIL_DESIGN_TOKENS.surfaceSoft};border-top:1px solid ${EMAIL_DESIGN_TOKENS.border};padding:20px 34px;color:${EMAIL_DESIGN_TOKENS.muted};font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.7"><div style="font-size:13px;font-weight:700;color:${EMAIL_DESIGN_TOKENS.navy};margin-bottom:2px">Kongila</div><div style="margin-bottom:11px">Global workforce infrastructure</div><div style="margin-bottom:10px">${support}</div><div>${privacyLink}<span>Automated notification from the Kongila platform.</span></div><div style="margin-top:10px">&copy; ${new Date().getFullYear()} Kongila. All rights reserved.</div></td></tr></table></td></tr></table></body></html>`;
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
        html: renderBrandedEmail(options.body, options.html, options.replyTo, options.subject),
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
