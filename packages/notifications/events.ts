/**
 * The journey notifications.
 *
 * Zero of these were sent. Two were console.log mocks, the rest either
 * attempted an in-app row the schema rejected or had no code at all.
 *
 * One catalogue, because the alternative is email bodies written inline at
 * every call site, drifting apart. Each event declares who it
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
  | 'account_manager_assigned'
  | 'account_manager_assignment'
  | 'account_manager_removed'
  | 'request_assigned'
  | 'operator_role_changed'
  | 'operator_account_suspended'
  | 'operator_account_suspended_notice'
  | 'operator_account_restored'
  // Request
  | 'request_received'
  | 'candidates_ready'
  | 'all_candidates_rejected'
  | 'client_call_requested'
  | 'client_call_responded'
  | 'client_call_scheduled'
  | 'request_message_from_admin'
  | 'request_message_from_client'
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
  | 'contract_renewal_due'
  | 'contract_terminated'
  | 'contract_voided'
  | 'contract_unsigned_chase'
  | 'compliance_document_expiring'
  // Vetting
  | 'stage_advanced'
  | 'application_rejected'
  // ── Vetting, stage by stage ───────────────────────────────────────────
  //
  // `stage_advanced` was carrying all of these. It is deliberately vague —
  // "you have moved to the next stage" — so a candidate being assigned an
  // assessment, being given a deadline, and getting a mark back all read the
  // same and none of them said what to do. The talent FRD specifies each of
  // these as its own notification; they are their own events here.
  | 'assessment_assigned'
  | 'assessment_marked'
  | 'work_simulation_assigned'
  | 'work_simulation_marked'
  | 'vetting_stage_result'
  | 'vetting_complete'
  | 'profile_rereview_required'
  | 'certification_expiring'
  // ── Opportunities, talent side ────────────────────────────────────────
  | 'submitted_to_client'
  | 'talent_hired'
  | 'talent_not_selected'
  // ── Money ─────────────────────────────────────────────────────────────
  | 'invoice_issued'
  | 'invoice_overdue'
  | 'invoice_paid'
  | 'payout_sent'
  | 'payout_failed'
  // ── Operations, internal ──────────────────────────────────────────────
  | 'sla_breach'
  | 'client_at_risk'
  | 'sourcing_required'
  | 'critical_setting_changed';

export type NotificationModule =
  | 'account' | 'requests' | 'matches' | 'interviews'
  | 'offers' | 'contracts' | 'vetting' | 'finance';

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
  previousRole?: string;
  newRole?: string;
  changedBy?: string;
  suspendedEmail?: string;

  // ── Scores and marks ──────────────────────────────────────────────────
  /** A mark as it should read, already formatted: "72%" or "18 of 25". */
  score?: string;
  /** What the pass mark was, where one applies. */
  passMark?: string;
  /** The reviewer's feedback, shown to the candidate with their result. */
  feedback?: string;
  /** The final grade, only ever set once vetting is actually complete. */
  grade?: string;

  // ── Deadlines ─────────────────────────────────────────────────────────
  /** Already formatted as a date the recipient will recognise. */
  deadline?: string;
  /** "3 days" — how long is left, where saying so adds urgency. */
  timeRemaining?: string;

  // ── Money ─────────────────────────────────────────────────────────────
  /** Formatted with its currency symbol by the caller: "$4,500". */
  amount?: string;
  reference?: string;
  /** Formatted date the money is or was due. */
  dueDate?: string;
  daysOverdue?: number;

  // ── Operations ────────────────────────────────────────────────────────
  /** What was missed, for an SLA breach: "Application Screening". */
  breachedStage?: string;
  /** How late it is: "2 days". */
  overdueBy?: string;
  settingName?: string;
  previousValue?: string;
  newValue?: string;
  documentName?: string;
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
        subject: `${ctx.inviterName || 'A colleague'} invited you to join Kongila`,
        body: withAction(
          `${hi}\n\n${ctx.inviterName || 'A colleague'} has invited you to join Kongila` +
          `${ctx.roleTitle ? ` as ${ctx.roleTitle}` : ''}. ` +
          `Use the secure link below to set your password and activate your account.`,
          ctx, 'Accept the invitation'
        ) + `\n\nThe link is single use${ctx.expiresIn ? ` and expires in ${ctx.expiresIn}` : ' and expires after a limited period'}. ` +
          `If you were not expecting this invitation, contact your Kongila administrator.\n\n${SIGN_OFF}`,
        inApp: `You were invited to join Kongila${ctx.roleTitle ? ` as ${ctx.roleTitle}` : ''}.`
      };

    // Who at Kongila is looking after this account. Assigning one used to
    // notify the manager and nobody at the company, so a client's dashboard
    // simply started naming a stranger — or, before the lookup was fixed, went
    // on saying "Unassigned" indefinitely.
    case 'account_manager_assigned':
      return {
        module: 'account',
        alsoInApp: true,
        subject: `${ctx.inviterName || 'Your account manager'} is looking after ${company}`,
        body: withAction(
          `${hi}\n\n${ctx.inviterName || 'An account manager'} is now your account manager at Kongila. ` +
          `They are your first point of contact for your requests, your candidates and anything else ` +
          `about the account, and you can message them from your dashboard.`,
          ctx, 'Open your dashboard'
        ) + `\n\n${SIGN_OFF}`,
        inApp: `${ctx.inviterName || 'An account manager'} is now your account manager.`
      };

    case 'account_manager_assignment':
      return {
        module: 'account',
        alsoInApp: true,
        subject: `You are now the account manager for ${company}`,
        body: withAction(
          `${hi}\n\nYou are now responsible for the Kongila account for ${company}. ` +
          `You are the primary contact for this client's requests, candidates and hiring progress.`,
          ctx, 'Open the admin dashboard'
        ) + `\n\n${SIGN_OFF}`,
        inApp: `You are now the account manager for ${company}.`
      };

    case 'account_manager_removed':
      return {
        module: 'account',
        alsoInApp: true,
        subject: `Account ownership updated for ${company}`,
        body: withAction(
          `${hi}\n\nYou are no longer the account manager for ${company}. ` +
          `Your previous activity remains in the audit history.`,
          ctx, 'Open the admin dashboard'
        ) + `\n\n${SIGN_OFF}`,
        inApp: `Account ownership changed for ${company}.`
      };

    case 'request_assigned':
      return {
        module: 'requests',
        alsoInApp: true,
        subject: `You have been assigned ${role}`,
        body: withAction(
          `${hi}\n\nYou have been assigned to ${role}${ctx.companyName ? ` for ${ctx.companyName}` : ''}. ` +
          `Please review the request and follow its progress in the admin dashboard.`,
          ctx, 'Open the request'
        ) + `\n\n${SIGN_OFF}`,
        inApp: `You have been assigned ${role}.`
      };

    case 'operator_role_changed':
      return {
        module: 'account',
        alsoInApp: true,
        subject: 'Your Kongila administrator role has changed',
        body: withAction(
          `${hi}\n\nYour Kongila administrator role changed from ${ctx.previousRole || 'your previous role'} ` +
          `to ${ctx.newRole || 'your new role'}.` +
          (ctx.changedBy ? `\n\nChanged by ${ctx.changedBy}.` : '') +
          `\n\nYour access to administrator tools now reflects this role.`,
          ctx, 'Sign in to Kongila'
        ) + `\n\nIf you did not expect this change, contact your Super Admin.\n\n${SIGN_OFF}`,
        inApp: `Your administrator role changed to ${ctx.newRole || 'a new role'}.`
      };

    case 'operator_account_suspended':
      return {
        module: 'account',
        alsoInApp: false,
        subject: 'Your Kongila administrator access has been suspended',
        body:
          `${hi}\n\nYour Kongila administrator access has been suspended.` +
          (ctx.reason ? `\n\nReason: ${ctx.reason}` : '') +
          `\n\nIf you believe this is a mistake, contact your Kongila administrator.\n\n${SIGN_OFF}`,
        inApp: 'Administrator access suspended.'
      };

    case 'operator_account_suspended_notice':
      return {
        module: 'account',
        alsoInApp: true,
        subject: 'An operator account was suspended',
        body:
          `${hi}\n\n${ctx.suspendedEmail || 'An operator'}'s Kongila administrator access was suspended.` +
          (ctx.reason ? `\n\nReason: ${ctx.reason}` : '') +
          `\n\n${SIGN_OFF}`,
        inApp: `${ctx.suspendedEmail || 'An operator'} was suspended.`
      };

    case 'operator_account_restored':
      return {
        module: 'account',
        alsoInApp: true,
        subject: 'Your Kongila administrator access has been restored',
        body: withAction(
          `${hi}\n\nYour Kongila administrator access has been restored. You can sign in using your existing account.`,
          ctx, 'Sign in to Kongila'
        ) + `\n\n${SIGN_OFF}`,
        inApp: 'Administrator access restored.'
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

    case 'client_call_requested':
      return {
        module: 'requests',
        alsoInApp: true,
        subject: `Can we discuss ${role}?`,
        body: withAction(
          `${hi}\n\nYour Kongila team would like to discuss your request for ${role}.` +
          (ctx.reason ? `\n\nAgenda: ${ctx.reason}` : '') +
          `\n\nPlease share a time that works for you from the request page.`,
          ctx, 'Open your request'
        ) + `\n\n${SIGN_OFF}`,
        inApp: `Your Kongila team requested a call about ${role}.`
      };

    case 'client_call_responded':
      return {
        module: 'requests',
        alsoInApp: true,
        subject: `The client suggested times for ${role}`,
        body: withAction(
          `${hi}\n\nThe client has shared preferred times to discuss ${role}.` +
          (ctx.when ? `\n\n${ctx.when}` : ''),
          ctx, 'Review the request'
        ) + `\n\n${SIGN_OFF}`,
        inApp: `The client suggested times for a call about ${role}.`
      };

    case 'client_call_scheduled':
      return {
        module: 'requests',
        alsoInApp: true,
        subject: `Call scheduled for ${role}`,
        body: withAction(
          `${hi}\n\nYour call about ${role} is scheduled${ctx.when ? ` for ${ctx.when}` : ''}.` +
          (ctx.joiningDetails ? `\n\n${ctx.joiningDetails}` : ''),
          ctx, 'Open your request'
        ) + `\n\n${SIGN_OFF}`,
        inApp: `Call about ${role} scheduled${ctx.when ? ` for ${ctx.when}` : ''}.`
      };

    case 'request_message_from_admin':
      return {
        module: 'requests',
        alsoInApp: true,
        subject: `A message from Kongila about ${role}`,
        body: withAction(
          `${hi}\n\nYour Kongila team sent you a message about ${role}.` +
          (ctx.reason ? `\n\nMessage: ${ctx.reason}` : ''),
          ctx, 'Open your request'
        ) + `\n\n${SIGN_OFF}`,
        inApp: `New message from Kongila about ${role}.`
      };

    case 'request_message_from_client':
      return {
        module: 'requests',
        alsoInApp: true,
        subject: `A client sent a message about ${role}`,
        body: withAction(
          `${hi}\n\nA client sent a message about ${role}.` +
          (ctx.reason ? `\n\nMessage: ${ctx.reason}` : ''),
          ctx, 'Open the request'
        ) + `\n\n${SIGN_OFF}`,
        inApp: `New client message about ${role}.`
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

    // ── Vetting, stage by stage ───────────────────────────────────────────

    case 'assessment_assigned':
      return {
        module: 'vetting',
        alsoInApp: true,
        subject: `Your skill assessment is ready${ctx.deadline ? ` — due ${ctx.deadline}` : ''}`,
        body: withAction(
          `${hi}\n\n${ctx.stageName || 'A skill assessment'} has been assigned to you as part of your Kongila vetting.` +
          (ctx.deadline
            ? `\n\nIt is due by ${ctx.deadline}${ctx.timeRemaining ? `, which is ${ctx.timeRemaining} from now` : ''}. ` +
              'You can start it whenever suits you before then.'
            : '\n\nThere is no deadline on this one, but the sooner you sit it the sooner we can move you on.'),
          ctx, 'Start the assessment'
        ) + `\n\n${SIGN_OFF}`,
        inApp: `Skill assessment assigned${ctx.deadline ? `, due ${ctx.deadline}` : ''}.`
      };

    case 'assessment_marked':
      return {
        module: 'vetting',
        alsoInApp: true,
        subject: `Your skill assessment has been marked${ctx.score ? ` — ${ctx.score}` : ''}`,
        body: withAction(
          `${hi}\n\nYour skill assessment has been marked.` +
          (ctx.score ? `\n\nYou scored ${ctx.score}${ctx.passMark ? ` against a pass mark of ${ctx.passMark}` : ''}.` : '') +
          (ctx.feedback ? `\n\nFrom the reviewer:\n${ctx.feedback}` : ''),
          ctx, 'See your result'
        ) + `\n\n${SIGN_OFF}`,
        inApp: `Skill assessment marked${ctx.score ? `: ${ctx.score}` : ''}.`
      };

    case 'work_simulation_assigned':
      return {
        module: 'vetting',
        alsoInApp: true,
        subject: `A work simulation has been set for you${ctx.deadline ? ` — due ${ctx.deadline}` : ''}`,
        body: withAction(
          `${hi}\n\n${ctx.stageName || 'A work simulation'} has been set for you. ` +
          'This is a piece of real work rather than a test, so take the time it deserves.' +
          (ctx.deadline
            ? `\n\nIt is due by ${ctx.deadline}${ctx.timeRemaining ? `, which is ${ctx.timeRemaining} from now` : ''}.`
            : ''),
          ctx, 'Open the task'
        ) + `\n\n${SIGN_OFF}`,
        inApp: `Work simulation assigned${ctx.deadline ? `, due ${ctx.deadline}` : ''}.`
      };

    case 'work_simulation_marked':
      return {
        module: 'vetting',
        alsoInApp: true,
        subject: `Your work simulation has been marked${ctx.score ? ` — ${ctx.score}` : ''}`,
        body: withAction(
          `${hi}\n\nYour work simulation has been reviewed.` +
          (ctx.score ? `\n\nYou scored ${ctx.score}.` : '') +
          (ctx.feedback ? `\n\nFrom the reviewer:\n${ctx.feedback}` : ''),
          ctx, 'See your result'
        ) + `\n\n${SIGN_OFF}`,
        inApp: `Work simulation marked${ctx.score ? `: ${ctx.score}` : ''}.`
      };

    case 'vetting_stage_result':
      return {
        module: 'vetting',
        alsoInApp: true,
        subject: `${ctx.stageName || 'A vetting stage'} — your result`,
        body: withAction(
          `${hi}\n\nWe have finished reviewing ${ctx.stageName || 'this stage'} of your vetting.` +
          (ctx.score ? `\n\nYou scored ${ctx.score}.` : '') +
          (ctx.feedback ? `\n\n${ctx.feedback}` : '') +
          '\n\nYour dashboard shows what happens next.',
          ctx, 'Open your dashboard'
        ) + `\n\n${SIGN_OFF}`,
        inApp: `${ctx.stageName || 'Stage'} result is in${ctx.score ? `: ${ctx.score}` : ''}.`
      };

    case 'vetting_complete':
      // Only ever sent once every stage is actually settled. A grade with no
      // finished assessment behind it is not a grade.
      return {
        module: 'vetting',
        alsoInApp: true,
        subject: 'Your Kongila vetting is complete',
        body: withAction(
          `${hi}\n\nYou have finished Kongila's vetting.` +
          (ctx.grade ? `\n\nYour classification is ${ctx.grade}.` : '') +
          '\n\nYou are now visible to clients looking for people with your skills, and we will be ' +
          'in touch as soon as there is an opportunity worth your time.',
          ctx, 'See your scorecard'
        ) + `\n\n${SIGN_OFF}`,
        inApp: `Vetting complete${ctx.grade ? ` — ${ctx.grade}` : ''}.`
      };

    case 'profile_rereview_required':
      return {
        module: 'vetting',
        alsoInApp: true,
        subject: `${ctx.talentName || 'A candidate'} changed their profile after classification`,
        body: withAction(
          `${hi}\n\n${ctx.talentName || 'A vetted candidate'} has edited part of their profile that ` +
          'their classification was based on, so it needs re-reviewing before the change is reflected to clients.' +
          (ctx.reason ? `\n\nWhat changed: ${ctx.reason}` : ''),
          ctx, 'Review the change'
        ) + `\n\n${SIGN_OFF}`,
        inApp: `${ctx.talentName || 'A candidate'} needs re-review after a profile change.`
      };

    case 'certification_expiring':
      return {
        module: 'vetting',
        alsoInApp: true,
        subject: `${ctx.documentName || 'A certification'} expires ${ctx.deadline || 'soon'}`,
        body: withAction(
          `${hi}\n\n${ctx.documentName || 'One of your certifications'} on file with Kongila expires ` +
          `${ctx.deadline ? `on ${ctx.deadline}` : 'in the next 30 days'}. ` +
          'Upload the renewed certificate when you have it so your profile stays current for clients.',
          ctx, 'Update your documents'
        ) + `\n\n${SIGN_OFF}`,
        inApp: `${ctx.documentName || 'A certification'} expires ${ctx.deadline || 'soon'}.`
      };

    // ── Opportunities, talent side ────────────────────────────────────────

    case 'submitted_to_client':
      return {
        module: 'matches',
        alsoInApp: true,
        subject: `You have been put forward for ${role}`,
        body: withAction(
          `${hi}\n\nWe have submitted your profile to ${company} for ${role}.` +
          '\n\nThere is nothing you need to do yet. If they want to meet you we will come back with ' +
          'interview times, and you can accept or propose another slot.',
          ctx, 'See the opportunity'
        ) + `\n\n${SIGN_OFF}`,
        inApp: `Submitted to ${company} for ${role}.`
      };

    case 'talent_hired':
      return {
        module: 'contracts',
        alsoInApp: true,
        subject: `${company} would like to hire you — ${role}`,
        body: withAction(
          `${hi}\n\n${company} has chosen you for ${role}.` +
          (ctx.rateSummary ? `\n\n${ctx.rateSummary}` : '') +
          '\n\nYour contract is the next step. Read it in full before you sign.',
          ctx, 'Read your contract'
        ) + `\n\n${SIGN_OFF}`,
        inApp: `${company} wants to hire you for ${role}.`
      };

    case 'talent_not_selected':
      // In-app only by design, per the FRD. A rejection for one opportunity
      // is not worth an email to someone who is still on the books.
      return {
        module: 'matches',
        alsoInApp: true,
        subject: `An update on ${role}`,
        body:
          `${hi}\n\n${company} has gone with someone else for ${role}.` +
          '\n\nThis does not affect your standing with Kongila and you stay in the pool for ' +
          `everything else that fits.\n\n${SIGN_OFF}`,
        inApp: `Not selected for ${role}.`
      };

    // ── Money ─────────────────────────────────────────────────────────────

    case 'invoice_issued':
      return {
        module: 'finance',
        alsoInApp: true,
        subject: `Invoice ${ctx.reference || ''} from Kongila`.trim(),
        body: withAction(
          `${hi}\n\nYour invoice${ctx.reference ? ` ${ctx.reference}` : ''} is ready.` +
          (ctx.amount ? `\n\nAmount: ${ctx.amount}` : '') +
          (ctx.dueDate ? `\nDue: ${ctx.dueDate}` : ''),
          ctx, 'View the invoice'
        ) + `\n\n${SIGN_OFF}`,
        inApp: `Invoice ${ctx.reference || ''} issued${ctx.amount ? ` — ${ctx.amount}` : ''}.`.trim()
      };

    case 'invoice_overdue':
      return {
        module: 'finance',
        alsoInApp: true,
        subject: `Invoice ${ctx.reference || ''} is overdue`.replace('  ', ' '),
        body: withAction(
          `${hi}\n\nInvoice${ctx.reference ? ` ${ctx.reference}` : ''}` +
          (ctx.amount ? ` for ${ctx.amount}` : '') +
          ` was due${ctx.dueDate ? ` on ${ctx.dueDate}` : ''}` +
          (ctx.daysOverdue ? `, which is ${ctx.daysOverdue} day${ctx.daysOverdue === 1 ? '' : 's'} ago` : '') +
          '.\n\nIf it has already been paid, ignore this and let us know so we can reconcile it.',
          ctx, 'Settle the invoice'
        ) + `\n\n${SIGN_OFF}`,
        inApp: `Invoice ${ctx.reference || ''} is overdue.`.replace('  ', ' ')
      };

    case 'invoice_paid':
      return {
        module: 'finance',
        alsoInApp: true,
        subject: `Payment received${ctx.reference ? ` — ${ctx.reference}` : ''}`,
        body:
          `${hi}\n\nWe have received your payment${ctx.amount ? ` of ${ctx.amount}` : ''}` +
          `${ctx.reference ? ` against ${ctx.reference}` : ''}. Thank you.\n\n${SIGN_OFF}`,
        inApp: `Payment received${ctx.amount ? ` — ${ctx.amount}` : ''}.`
      };

    case 'payout_sent':
      return {
        module: 'finance',
        alsoInApp: true,
        subject: `Your payout is on its way${ctx.amount ? ` — ${ctx.amount}` : ''}`,
        body: withAction(
          `${hi}\n\nWe have sent your payout${ctx.amount ? ` of ${ctx.amount}` : ''}` +
          `${ctx.reference ? ` (${ctx.reference})` : ''}.` +
          '\n\nHow long it takes to land depends on your bank.',
          ctx, 'See your earnings'
        ) + `\n\n${SIGN_OFF}`,
        inApp: `Payout sent${ctx.amount ? ` — ${ctx.amount}` : ''}.`
      };

    case 'payout_failed':
      return {
        module: 'finance',
        alsoInApp: true,
        subject: 'A payout did not go through',
        body: withAction(
          `${hi}\n\nA payout${ctx.amount ? ` of ${ctx.amount}` : ''}` +
          `${ctx.reference ? ` (${ctx.reference})` : ''} did not complete.` +
          (ctx.reason ? `\n\n${ctx.reason}` : '') +
          '\n\nNothing has been lost. Check the payment details on file and we will try again.',
          ctx, 'Check your details'
        ) + `\n\n${SIGN_OFF}`,
        inApp: `A payout did not go through${ctx.amount ? ` — ${ctx.amount}` : ''}.`
      };

    // ── Contracts, the rest of the lifecycle ──────────────────────────────

    case 'contract_renewal_due':
      return {
        module: 'contracts',
        alsoInApp: true,
        subject: `A contract is up for renewal${ctx.deadline ? ` on ${ctx.deadline}` : ''}`,
        body: withAction(
          `${hi}\n\nThe contract${ctx.roleTitle ? ` for ${ctx.roleTitle}` : ''}` +
          `${ctx.companyName ? ` with ${ctx.companyName}` : ''} ends ` +
          `${ctx.deadline ? `on ${ctx.deadline}` : 'in the next 30 days'}.` +
          '\n\nIf it should continue, now is the time to say so.',
          ctx, 'Open the contract'
        ) + `\n\n${SIGN_OFF}`,
        inApp: `Contract renewal due${ctx.deadline ? ` ${ctx.deadline}` : ''}.`
      };

    case 'contract_terminated':
      return {
        module: 'contracts',
        alsoInApp: true,
        subject: `A contract has ended${ctx.roleTitle ? ` — ${ctx.roleTitle}` : ''}`,
        body: withAction(
          `${hi}\n\nThe contract${ctx.roleTitle ? ` for ${ctx.roleTitle}` : ''}` +
          `${ctx.companyName ? ` with ${ctx.companyName}` : ''} has ended.` +
          (ctx.reason ? `\n\n${ctx.reason}` : '') +
          '\n\nThe signed contract stays in your records.',
          ctx, 'Open your contracts'
        ) + `\n\n${SIGN_OFF}`,
        inApp: `Contract ended${ctx.roleTitle ? ` — ${ctx.roleTitle}` : ''}.`
      };

    case 'contract_voided':
      return {
        module: 'contracts',
        alsoInApp: true,
        subject: `A contract has been voided${ctx.roleTitle ? ` — ${ctx.roleTitle}` : ''}`,
        body: withAction(
          `${hi}\n\nThe contract${ctx.roleTitle ? ` for ${ctx.roleTitle}` : ''} has been voided and is ` +
          'no longer in force.' +
          (ctx.reason ? `\n\nWhy: ${ctx.reason}` : '') +
          '\n\nA voided contract is never edited. If a corrected version is needed it will be reissued ' +
          'as a new one.',
          ctx, 'Open your contracts'
        ) + `\n\n${SIGN_OFF}`,
        inApp: `Contract voided${ctx.roleTitle ? ` — ${ctx.roleTitle}` : ''}.`
      };

    case 'contract_unsigned_chase':
      return {
        module: 'contracts',
        alsoInApp: true,
        subject: `A contract has been waiting ${ctx.overdueBy || 'a while'} for signature`,
        body: withAction(
          `${hi}\n\nThe contract${ctx.roleTitle ? ` for ${ctx.roleTitle}` : ''}` +
          `${ctx.talentName ? ` with ${ctx.talentName}` : ''} has been unsigned for ` +
          `${ctx.overdueBy || 'over two weeks'}.` +
          '\n\nWorth a direct follow-up rather than another automated nudge.',
          ctx, 'Open the contract'
        ) + `\n\n${SIGN_OFF}`,
        inApp: `Contract unsigned for ${ctx.overdueBy || 'over two weeks'}.`
      };

    case 'compliance_document_expiring':
      return {
        module: 'contracts',
        alsoInApp: true,
        subject: `${ctx.documentName || 'A compliance document'} expires ${ctx.deadline || 'soon'}`,
        body: withAction(
          `${hi}\n\n${ctx.documentName || 'A compliance document'}` +
          `${ctx.talentName ? ` for ${ctx.talentName}` : ''} expires ` +
          `${ctx.deadline ? `on ${ctx.deadline}` : 'within 30 days'}.`,
          ctx, 'Open compliance'
        ) + `\n\n${SIGN_OFF}`,
        inApp: `${ctx.documentName || 'A document'} expires ${ctx.deadline || 'soon'}.`
      };

    // ── Operations, internal ──────────────────────────────────────────────

    case 'sla_breach':
      return {
        module: 'vetting',
        alsoInApp: true,
        subject: `SLA breach — ${ctx.breachedStage || 'a stage'} is ${ctx.overdueBy || 'overdue'}`,
        body: withAction(
          `${hi}\n\n${ctx.breachedStage || 'A stage'}` +
          `${ctx.talentName ? ` for ${ctx.talentName}` : ''}` +
          `${ctx.companyName ? ` at ${ctx.companyName}` : ''} has passed its SLA` +
          `${ctx.overdueBy ? ` by ${ctx.overdueBy}` : ''}.`,
          ctx, 'Open it'
        ) + `\n\n${SIGN_OFF}`,
        inApp: `SLA breach on ${ctx.breachedStage || 'a stage'}${ctx.overdueBy ? ` — ${ctx.overdueBy} over` : ''}.`
      };

    case 'client_at_risk':
      return {
        module: 'requests',
        alsoInApp: true,
        subject: `${company} has moved to At Risk`,
        body: withAction(
          `${hi}\n\n${company}'s health score has dropped to the At Risk threshold.` +
          (ctx.reason ? `\n\n${ctx.reason}` : ''),
          ctx, 'Open the client'
        ) + `\n\n${SIGN_OFF}`,
        inApp: `${company} is now At Risk.`
      };

    case 'sourcing_required':
      return {
        module: 'requests',
        alsoInApp: true,
        subject: `Sourcing needed — ${role}${ctx.companyName ? ` for ${ctx.companyName}` : ''}`,
        body: withAction(
          `${hi}\n\n${role}${ctx.companyName ? ` for ${ctx.companyName}` : ''} has been flagged as ` +
          'needing sourcing: the vetted pool does not currently hold anyone who fits.' +
          (ctx.reason ? `\n\n${ctx.reason}` : ''),
          ctx, 'Open the request'
        ) + `\n\n${SIGN_OFF}`,
        inApp: `Sourcing needed for ${role}.`
      };

    case 'critical_setting_changed':
      return {
        module: 'account',
        alsoInApp: true,
        subject: `${ctx.settingName || 'A platform setting'} was changed`,
        body:
          `${hi}\n\n${ctx.changedBy || 'Someone'} changed ${ctx.settingName || 'a platform setting'}` +
          (ctx.previousValue !== undefined && ctx.newValue !== undefined
            ? ` from ${ctx.previousValue} to ${ctx.newValue}`
            : '') +
          '.\n\nYou are getting this because changes to fees and integrations affect every account ' +
          `on the platform.\n\n${SIGN_OFF}`,
        inApp: `${ctx.settingName || 'A setting'} changed${ctx.changedBy ? ` by ${ctx.changedBy}` : ''}.`
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
  'email_verification', 'password_reset', 'team_invitation', 'account_manager_assigned',
  'account_manager_assignment', 'account_manager_removed', 'request_assigned',
  'operator_role_changed', 'operator_account_suspended', 'operator_account_suspended_notice',
  'operator_account_restored',
  // all_candidates_rejected had a template and was never in this list, so
  // anything iterating the events — settings screens, tests — did not know
  // it existed.
  'request_received', 'candidates_ready', 'all_candidates_rejected',
  'client_call_requested', 'client_call_responded', 'client_call_scheduled',
  'request_message_from_admin', 'request_message_from_client',
  'interview_scheduled', 'interview_rescheduled', 'interview_reminder',
  'offer_extended', 'offer_accepted', 'offer_declined',
  'contract_ready', 'contract_signed', 'contract_renewal_due', 'contract_terminated',
  'contract_voided', 'contract_unsigned_chase', 'compliance_document_expiring',
  'stage_advanced', 'application_rejected',
  'assessment_assigned', 'assessment_marked',
  'work_simulation_assigned', 'work_simulation_marked',
  'vetting_stage_result', 'vetting_complete',
  'profile_rereview_required', 'certification_expiring',
  'submitted_to_client', 'talent_hired', 'talent_not_selected',
  'invoice_issued', 'invoice_overdue', 'invoice_paid',
  'payout_sent', 'payout_failed',
  'sla_breach', 'client_at_risk', 'sourcing_required', 'critical_setting_changed'
];
