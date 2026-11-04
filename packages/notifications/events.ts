/**
 * The fifteen journey notifications.
 *
 * Zero of these were sent. Two were console.log mocks, the rest either
 * attempted an in-app row the schema rejected or had no code at all.
 *
 * One catalogue, because the alternative is fifteen email bodies written
 * inline at fifteen call sites, drifting apart. Each event declares who it
 * goes to, what the email says, what the in-app line says, and which part of
 * the product it belongs to, so a notification panel can group by it.
 *
 * This file imports nothing, so it can be tested on its own.
 */

export type NotificationEvent =
  // Account
  | 'email_verification'
  | 'password_reset'
  | 'team_invitation'
  // Request
  | 'request_received'
  | 'candidates_ready'
  | 'all_candidates_rejected'
  // Interview
  | 'interview_scheduled'
  | 'interview_rescheduled'
  | 'interview_reminder'
  // Offer
  | 'offer_extended'
  | 'offer_accepted'
  | 'offer_declined'
  // Contract
  | 'contract_ready'
  | 'contract_signed'
  // Vetting
  | 'stage_advanced'
  | 'application_rejected';

export type NotificationModule =
  | 'account' | 'requests' | 'matches' | 'interviews'
  | 'offers' | 'contracts' | 'vetting';

export interface NotificationContent {
  subject: string;
  /** Plain text. The email layer derives an HTML version. */
  body: string;
  /** The one line shown in the in-app panel. */
  inApp: string;
  module: NotificationModule;
  /** False for transactional mail nobody should see as an in-app row. */
  alsoInApp: boolean;
}

/** Everything a template may need. All optional: a missing field degrades. */
export interface NotificationContext {
  recipientName?: string;
  actionUrl?: string;
  /** Already formatted in the recipient's own timezone by the caller. */
  when?: string;
  roleTitle?: string;
  companyName?: string;
  talentName?: string;
  clientName?: string;
  stageName?: string;
  reason?: string;
  joiningDetails?: string;
  expiresIn?: string;
  candidateCount?: number;
  rateSummary?: string;
  inviterName?: string;
}

const SIGN_OFF = 'The Kongila team';

function greeting(ctx: NotificationContext): string {
  return `Hi ${ctx.recipientName || 'there'},`;
}

function withAction(body: string, ctx: NotificationContext, label: string): string {
  return ctx.actionUrl ? `${body}\n\n${label}: ${ctx.actionUrl}` : body;
}

/**
 * Builds the content for an event.
 *
 * Never throws on a missing field — a notification that cannot be perfectly
 * worded is still better than silence, which is what the product did before.
 */
export function buildNotification(
  event: NotificationEvent,
  ctx: NotificationContext = {}
): NotificationContent {
  const hi = greeting(ctx);
  const role = ctx.roleTitle || 'the role';
  const company = ctx.companyName || 'the client';

  switch (event) {
    // ── Account ─────────────────────────────────────────────────────────────
    case 'email_verification':
      return {
        module: 'account',
        alsoInApp: false,
        subject: 'Confirm your email address',
        body: withAction(
          `${hi}\n\nConfirm your email address to finish setting up your Kongila account.` +
          (ctx.expiresIn ? `\n\nThis link expires in ${ctx.expiresIn}.` : ''),
          ctx, 'Confirm your email'
        ) + `\n\nIf you did not create an account, ignore this message.\n\n${SIGN_OFF}`,
        inApp: 'Confirm your email address.'
      };

    case 'password_reset':
      return {
        module: 'account',
        alsoInApp: false,
        subject: 'Reset your Kongila password',
        body: withAction(
          `${hi}\n\nSomeone asked to reset the password on this account.` +
          (ctx.expiresIn ? ` The link below expires in ${ctx.expiresIn}.` : ''),
          ctx, 'Reset your password'
        ) + `\n\nIf this was not you, ignore this message and your password stays as it is.\n\n${SIGN_OFF}`,
        inApp: 'Password reset requested.'
      };

    case 'team_invitation':
      return {
        module: 'account',
        alsoInApp: false,
        subject: `${ctx.inviterName || 'A colleague'} invited you to ${company} on Kongila`,
        body: withAction(
          `${hi}\n\n${ctx.inviterName || 'A colleague'} has invited you to join ${company} on Kongila.`,
          ctx, 'Accept the invitation'
        ) + `\n\nThe link is single use and expires in ${ctx.expiresIn || '7 days'}.\n\n${SIGN_OFF}`,
        inApp: `You were invited to ${company}.`
      };

    // ── Request ─────────────────────────────────────────────────────────────
    case 'request_received':
      return {
        module: 'requests',
        alsoInApp: true,
        subject: `We have your request for ${role}`,
        body: withAction(
          `${hi}\n\nYour request for ${role} is with our talent team. ` +
          `We will come back to you with a shortlist, and you will get an email when candidates are ready to review.`,
          ctx, 'View your request'
        ) + `\n\n${SIGN_OFF}`,
        inApp: `Request received: ${role}. Our team is sourcing candidates.`
      };

    case 'candidates_ready':
      return {
        module: 'matches',
        alsoInApp: true,
        subject: `${ctx.candidateCount ? `${ctx.candidateCount} candidates` : 'Candidates'} ready for ${role}`,
        body: withAction(
          `${hi}\n\n` +
          `${ctx.candidateCount ? `${ctx.candidateCount} candidates are` : 'Candidates are'} ready for you to review for ${role}. ` +
          `You can read their profiles and request an interview with anyone who looks right.`,
          ctx, 'Review candidates'
        ) + `\n\n${SIGN_OFF}`,
        inApp: `${ctx.candidateCount ? `${ctx.candidateCount} candidates` : 'Candidates'} ready for ${role}.`
      };

    // ── Interview ───────────────────────────────────────────────────────────
    case 'interview_scheduled':
      return {
        module: 'interviews',
        alsoInApp: true,
        subject: `Interview ${ctx.when ? `— ${ctx.when}` : 'scheduled'}`,
        body:
          `${hi}\n\nAn interview has been proposed${ctx.talentName ? ` with ${ctx.talentName}` : ''}` +
          `${ctx.roleTitle ? ` for ${ctx.roleTitle}` : ''}.\n\n` +
          `${ctx.when || 'A time has not been confirmed yet.'}\n\n` +
          `${ctx.joiningDetails || 'Joining details will follow before the call.'}\n\n` +
          `The attached calendar file adds this at the correct local time.\n\n${SIGN_OFF}`,
        inApp: `Interview proposed${ctx.when ? ` — ${ctx.when}` : ''}.`
      };

    case 'interview_rescheduled':
      return {
        module: 'interviews',
        alsoInApp: true,
        subject: `Interview moved${ctx.when ? ` — ${ctx.when}` : ''}`,
        body:
          `${hi}\n\nThis interview has been moved.\n\n` +
          `${ctx.when || 'A new time has not been confirmed yet.'}\n\n` +
          (ctx.reason ? `Reason: ${ctx.reason}\n\n` : '') +
          `${ctx.joiningDetails || 'Joining details will follow before the call.'}\n\n` +
          `The attached calendar file replaces the previous entry.\n\n${SIGN_OFF}`,
        inApp: `Interview moved${ctx.when ? ` to ${ctx.when}` : ''}.`
      };

    case 'interview_reminder':
      return {
        module: 'interviews',
        alsoInApp: true,
        subject: `Reminder: interview ${ctx.when ? `— ${ctx.when}` : 'coming up'}`,
        body:
          `${hi}\n\nA reminder that your interview is coming up.\n\n` +
          `${ctx.when || ''}\n\n` +
          `${ctx.joiningDetails || 'Joining details will follow before the call.'}\n\n${SIGN_OFF}`,
        inApp: `Interview reminder${ctx.when ? ` — ${ctx.when}` : ''}.`
      };

    // ── Offer ───────────────────────────────────────────────────────────────
    case 'offer_extended':
      return {
        module: 'offers',
        alsoInApp: true,
        subject: `You have an offer${ctx.roleTitle ? ` for ${ctx.roleTitle}` : ''}`,
        body: withAction(
          `${hi}\n\n${company} has made you an offer${ctx.roleTitle ? ` for ${ctx.roleTitle}` : ''}.` +
          (ctx.rateSummary ? `\n\n${ctx.rateSummary}` : '') +
          (ctx.expiresIn ? `\n\nPlease respond within ${ctx.expiresIn}.` : ''),
          ctx, 'Review the offer'
        ) + `\n\n${SIGN_OFF}`,
        inApp: `Offer from ${company}${ctx.roleTitle ? ` for ${ctx.roleTitle}` : ''}.`
      };

    case 'offer_accepted':
      return {
        module: 'offers',
        alsoInApp: true,
        subject: `${ctx.talentName || 'The candidate'} accepted your offer`,
        body: withAction(
          `${hi}\n\n${ctx.talentName || 'The candidate'} has accepted the offer` +
          `${ctx.roleTitle ? ` for ${ctx.roleTitle}` : ''}. We are preparing the contract now ` +
          `and will send it to both sides to sign.`,
          ctx, 'View the placement'
        ) + `\n\n${SIGN_OFF}`,
        inApp: `${ctx.talentName || 'The candidate'} accepted the offer.`
      };

    case 'all_candidates_rejected':
      // Operations only. A request with nobody left on it stalls silently
      // otherwise: the client has stopped clicking and nobody is told.
      return {
        module: 'matches',
        alsoInApp: true,
        subject: `Every candidate rejected for ${role}`,
        body: withAction(
          `${hi}\n\n${ctx.clientName || 'The client'} has rejected every candidate submitted ` +
          `for ${role}. There is nobody left on the request.` +
          `${ctx.reason ? `\n\nThe last reason given: ${ctx.reason}` : ''}\n\n` +
          `A discovery call is the usual next step, to find out what the shortlist is missing.`,
          ctx, 'Open the request'
        ) + `\n\n${SIGN_OFF}`,
        inApp: `Every candidate for ${role} was rejected. A discovery call is needed.`
      };

    case 'offer_declined':
      return {
        module: 'offers',
        alsoInApp: true,
        subject: `${ctx.talentName || 'The candidate'} declined the offer`,
        body: withAction(
          `${hi}\n\n${ctx.talentName || 'The candidate'} has declined the offer` +
          `${ctx.roleTitle ? ` for ${ctx.roleTitle}` : ''}.` +
          (ctx.reason ? `\n\nReason given: ${ctx.reason}` : '') +
          `\n\nYour account manager will be in touch about the other candidates on your shortlist.`,
          ctx, 'View your shortlist'
        ) + `\n\n${SIGN_OFF}`,
        inApp: `${ctx.talentName || 'The candidate'} declined the offer.`
      };

    // ── Contract ────────────────────────────────────────────────────────────
    case 'contract_ready':
      return {
        module: 'contracts',
        alsoInApp: true,
        subject: `Your contract is ready to sign${ctx.roleTitle ? ` — ${ctx.roleTitle}` : ''}`,
        body: withAction(
          `${hi}\n\nThe contract${ctx.roleTitle ? ` for ${ctx.roleTitle}` : ''} is ready for your signature. ` +
          `Please read it in full before signing.` +
          (ctx.rateSummary ? `\n\n${ctx.rateSummary}` : ''),
          ctx, 'Read and sign'
        ) + `\n\n${SIGN_OFF}`,
        inApp: `Contract ready to sign${ctx.roleTitle ? ` — ${ctx.roleTitle}` : ''}.`
      };

    case 'contract_signed':
      return {
        module: 'contracts',
        alsoInApp: true,
        subject: 'Contract signed',
        body: withAction(
          `${hi}\n\nThe contract${ctx.roleTitle ? ` for ${ctx.roleTitle}` : ''} has been signed by both sides` +
          `${ctx.talentName ? ` and ${ctx.talentName} is confirmed` : ''}. Onboarding starts next.`,
          ctx, 'View the contract'
        ) + `\n\n${SIGN_OFF}`,
        inApp: 'Contract signed. Onboarding starts next.'
      };

    // ── Vetting ─────────────────────────────────────────────────────────────
    case 'stage_advanced':
      return {
        module: 'vetting',
        alsoInApp: true,
        subject: ctx.stageName ? `You have advanced to ${ctx.stageName}` : 'Your application has advanced',
        body: withAction(
          `${hi}\n\nGood news — your application has moved forward` +
          `${ctx.stageName ? ` to ${ctx.stageName}` : ''}. ` +
          `Log in to see what happens next and anything we need from you.`,
          ctx, 'View your progress'
        ) + `\n\n${SIGN_OFF}`,
        inApp: ctx.stageName ? `Advanced to ${ctx.stageName}.` : 'Your application advanced.'
      };

    case 'application_rejected':
      // Worth being careful with. A rejection is a real moment for someone,
      // so it is short, direct, and does not pretend to be good news.
      return {
        module: 'vetting',
        alsoInApp: true,
        subject: 'An update on your Kongila application',
        body:
          `${hi}\n\nThank you for the time you put into your application. ` +
          `We are not taking it further at this stage.\n\n` +
          (ctx.reason ? `${ctx.reason}\n\n` : '') +
          `You are welcome to apply again in future, and we keep your profile on file.\n\n${SIGN_OFF}`,
        inApp: 'An update on your application.'
      };

    default: {
      // A new event added to the union without a template lands here rather
      // than sending an empty email.
      const unreachable: never = event;
      throw new Error(`No notification template for "${unreachable}".`);
    }
  }
}

/** Every event, for tests and for a settings screen that lists them. */
export const ALL_NOTIFICATION_EVENTS: NotificationEvent[] = [
  'email_verification', 'password_reset', 'team_invitation',
  'request_received', 'candidates_ready',
  'interview_scheduled', 'interview_rescheduled', 'interview_reminder',
  'offer_extended', 'offer_accepted', 'offer_declined',
  'contract_ready', 'contract_signed',
  'stage_advanced', 'application_rejected'
];
