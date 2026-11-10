import { RequestStatus, VettingStatus, TaskStatus, ServiceType } from '@kongila/shared-types';
export {
  countSignedHires,
  hasOfferCapacity,
  hasReachedHireTarget,
  isSignedHireContract,
  requestedHeadcount
} from './hiringProgress';
export {
  compareMatchingProgress,
  matchingProgressStatus,
  type MatchingProgressEvent
} from './matchingProgress';

const REQUEST_STATUS_ALIASES: Record<string, RequestStatus> = {
  'new': 'New Request',
  'new request': 'New Request',
  'review': 'Reviewing',
  'reviewing': 'Reviewing',
  'sourcing': 'Sourcing Talent',
  'sourcing talent': 'Sourcing Talent',
  'sourcing_required': 'Reviewing',
  'sourcing required': 'Reviewing',
  'candidates ready': 'Candidates Ready',
  'candidates_ready': 'Candidates Ready',
  'candidate ready': 'Candidates Ready',
  'client interview': 'Client Interview',
  'client_interview': 'Client Interview',
  'offer accepted': 'Offer Accepted',
  'offer_accepted': 'Offer Accepted',
  'onboarding': 'Onboarding',
  'closed': 'Closed',
  'closed/cancelled': 'Closed'
};

/**
 * Resolves a stored or inbound status to a canonical one, or null if it is
 * not recognised.
 *
 * This used to return 'New Request' for anything it did not recognise, which
 * meant a typo, a renamed status or a value from another part of the product
 * silently sent a request back to the start of the pipeline. Unknown input is
 * now an answer the caller has to handle rather than a silent reset.
 *
 * Use this on any path that writes. For display, use coerceRequestStatus.
 */
export function normalizeRequestStatus(status?: string | null): RequestStatus | null {
  if (!status) return null;
  const trimmed = String(status).trim();
  if (!trimmed) return null;

  const direct = REQUEST_STATUS_ALIASES[trimmed.toLowerCase()];
  if (direct) return direct;

  const normalized = trimmed
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return REQUEST_STATUS_ALIASES[normalized] || null;
}

/**
 * Display-only. Resolves to a canonical status, falling back when the value
 * is not recognised, and says so in the console rather than hiding it.
 *
 * Never use this to decide what to write.
 */
export function coerceRequestStatus(
  status?: string | null,
  fallback: RequestStatus = 'New Request'
): RequestStatus {
  const resolved = normalizeRequestStatus(status);
  if (resolved) return resolved;
  if (status) {
    console.warn(`[workflows] unrecognised request status "${status}", displaying as ${fallback}`);
  }
  return fallback;
}

export function isMatchingRequestStatus(status?: string | null): boolean {
  const normalized = coerceRequestStatus(status);
  return normalized === 'Sourcing Talent' || normalized === 'Candidates Ready' || normalized === 'Client Interview' || normalized === 'Offer Accepted' || normalized === 'Onboarding';
}

export function isActiveRequestStatus(status?: string | null): boolean {
  const normalized = coerceRequestStatus(status);
  if (normalized === 'Closed') return false;
  return normalized === 'New Request' || normalized === 'Reviewing' || isMatchingRequestStatus(normalized);
}

/**
 * Hired means a contract has been signed, not that an offer was accepted.
 * Only 'Onboarding' qualifies: a request reaches it once the contract is
 * signed, which is what the stage covers (welcome kit, NDAs, tools check).
 *
 * A request at 'Offer Accepted' has a candidate who said yes and no signed
 * contract, so it is still in flight. Backs the client portal's Hired tab.
 */
export function isHiredRequestStatus(status?: string | null): boolean {
  return coerceRequestStatus(status) === 'Onboarding';
}

/** An offer is out and accepted, but nothing is signed yet. */
export function isOfferRequestStatus(status?: string | null): boolean {
  return coerceRequestStatus(status) === 'Offer Accepted';
}

export function isClosedRequestStatus(status?: string | null): boolean {
  return coerceRequestStatus(status) === 'Closed';
}

/** A client may still edit a request until sourcing has started. */
export function isEditableRequestStatus(status?: string | null): boolean {
  const normalized = coerceRequestStatus(status);
  return normalized === 'New Request' || normalized === 'Reviewing';
}

// ─── What the client sees ────────────────────────────────────────────────────
//
// The seven canonical values are internal operations stages. Showing a client
// "Sourcing Talent" is not useful to them, and the scope document specifies a
// five-step journey instead. That journey is derived here rather than stored,
// so there is still exactly one set of values in the database.
//
// The client portal previously keyed on "Matching", "Interview" and
// "Completed", which the normaliser can never produce, so the stepper never
// moved past the first step.

/**
 * Six steps rather than the scope document's five. The scope does not
 * distinguish an accepted offer from a signed contract, but the product does,
 * and Hired means signed. Without a separate Offer step a client would see
 * "Hired" the moment a candidate said yes, before anything was countersigned.
 */
export const CLIENT_JOURNEY_STEPS = [
  'Submitted',
  'Matching',
  'Candidates Ready',
  'Interview',
  'Offer',
  'Hired'
] as const;

export type ClientJourneyStep = typeof CLIENT_JOURNEY_STEPS[number];

export interface ClientStatusView {
  /** The label to show the client. */
  label: ClientJourneyStep | 'Closed';
  /** Zero-based index into CLIENT_JOURNEY_STEPS, or -1 for a closed request. */
  step: number;
  /** Progress for a bar, 0 to 100. */
  pct: number;
}

/** Progress for each journey step, so a stepper and a bar cannot disagree. */
export function clientJourneyStepPct(index: number): number {
  return Math.round(((index + 1) / CLIENT_JOURNEY_STEPS.length) * 100);
}

const CLIENT_STATUS_VIEW: Record<RequestStatus, ClientStatusView> = {
  'New Request':      { label: 'Submitted',        step: 0, pct: 8 },
  'Reviewing':        { label: 'Submitted',        step: 0, pct: 16 },
  'Sourcing Talent':  { label: 'Matching',         step: 1, pct: 33 },
  'Candidates Ready': { label: 'Candidates Ready', step: 2, pct: 50 },
  'Client Interview': { label: 'Interview',        step: 3, pct: 66 },
  'Offer Accepted':   { label: 'Offer',            step: 4, pct: 83 },
  'Onboarding':       { label: 'Hired',            step: 5, pct: 100 },
  'Closed':           { label: 'Closed',           step: -1, pct: 0 }
};

/** The client-facing view of any stored status. Safe for unrecognised input. */
export function clientStatusView(status?: string | null): ClientStatusView {
  return CLIENT_STATUS_VIEW[coerceRequestStatus(status)];
}

export { CLIENT_STATUS_VIEW };

// Client Service Request Workflows
export const SERVICE_REQUEST_STATUSES: RequestStatus[] = [
  'New Request',
  'Reviewing',
  'Sourcing Talent',
  'Candidates Ready',
  'Client Interview',
  'Offer Accepted',
  'Onboarding'
];

/**
 * Which moves are legal. Each stage can go forward one step or back one step,
 * so an operator can correct a mistake without jumping the pipeline. 'Closed'
 * is reachable from anywhere and is terminal.
 *
 * Enforced server-side by apps/admin-panel/pages/api/requests/status.ts. Do
 * not write a status from the browser without going through that route.
 */
export const VALID_REQUEST_TRANSITIONS: Record<RequestStatus, RequestStatus[]> = {
  'New Request': ['Reviewing', 'Closed'],
  'Reviewing': ['Sourcing Talent', 'New Request', 'Closed'],
  'Sourcing Talent': ['Candidates Ready', 'Reviewing', 'Closed'],
  'Candidates Ready': ['Client Interview', 'Sourcing Talent', 'Closed'],
  'Client Interview': ['Offer Accepted', 'Candidates Ready', 'Closed'],
  'Offer Accepted': ['Onboarding', 'Client Interview', 'Closed'],
  'Onboarding': ['Closed'],
  'Closed': [] // Terminal. Reopening means a new request.
};

export function canTransitionRequest(from: RequestStatus, to: RequestStatus): boolean {
  if (from === to) return true;
  return VALID_REQUEST_TRANSITIONS[from]?.includes(to) || false;
}

/** Why a move was refused, for an error message a human can act on. */
export function explainTransition(from: RequestStatus, to: RequestStatus): string | null {
  if (canTransitionRequest(from, to)) return null;
  const allowed = VALID_REQUEST_TRANSITIONS[from] || [];
  if (allowed.length === 0) {
    return `A request at "${from}" is closed and cannot be moved.`;
  }
  return `A request at "${from}" can only move to ${allowed.map(s => `"${s}"`).join(' or ')}, not "${to}".`;
}

// Talent Journey Workflows
export const TALENT_STATUSES: VettingStatus[] = [
  'Applied',
  'Review',
  'Vetted',
  'Matched',
  'Deployed'
];

export const VALID_TALENT_TRANSITIONS: Record<VettingStatus, VettingStatus[]> = {
  'Applied': ['Review'],
  'Review': ['Vetted', 'Applied'],
  'Vetted': ['Matched', 'Review'],
  'Matched': ['Deployed', 'Vetted'],
  'Deployed': ['Vetted'] // Can go back if project finishes
};

export function canTransitionTalent(from: VettingStatus, to: VettingStatus): boolean {
  if (from === to) return true;
  return VALID_TALENT_TRANSITIONS[from]?.includes(to) || false;
}

// Remotan Task Workflows
export const TASK_STATUSES: TaskStatus[] = [
  'Not Started',
  'In Progress',
  'Blocked',
  'Under Review',
  'Completed'
];

export const VALID_TASK_TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  'Not Started': ['In Progress'],
  'In Progress': ['Blocked', 'Under Review', 'Not Started'],
  'Blocked': ['In Progress', 'Under Review'],
  'Under Review': ['Completed', 'In Progress', 'Blocked'],
  'Completed': ['Under Review', 'In Progress']
};

export function canTransitionTask(from: TaskStatus, to: TaskStatus): boolean {
  if (from === to) return true;
  return VALID_TASK_TRANSITIONS[from]?.includes(to) || false;
}

// Pipeline display names and icons
export const GET_SERVICE_STAGES = (service: ServiceType): { name: string; description: string }[] => {
  switch (service) {
    case 'Managed Workforce':
      return [
        { name: 'New Request', description: 'Client submits workforce role request' },
        { name: 'Reviewing', description: 'Internal team reviews operational feasibility' },
        { name: 'Sourcing Talent', description: 'Sourcing matching elite African candidates' },
        { name: 'Candidates Ready', description: 'Shortlist with matching score generated' },
        { name: 'Client Interview', description: 'Scheduling and holding video interviews' },
        { name: 'Offer Accepted', description: 'Securing contract acceptances & onboarding' },
        { name: 'Onboarding', description: 'Welcome kit, NDAs signed, tools check, active management' }
      ];
    case 'Outsource Talent':
      return [
        { name: 'Request Received', description: 'Workforce request logged' },
        { name: 'Matching', description: 'Connecting talent directly' },
        { name: 'Client Review', description: 'Client reviews candidates' },
        { name: 'Assigned', description: 'Talent contracts complete' },
        { name: 'Active', description: 'Lighter oversight operational execution' },
        { name: 'Completed', description: 'Contract cycle finalized' }
      ];
    default:
      return [
        { name: 'Job Intake', description: 'Requirements submitted' },
        { name: 'Sourcing', description: 'Filtering databases' },
        { name: 'Screening', description: 'Running assessment tests' },
        { name: 'Shortlisted', description: 'Candidates prepared' },
        { name: 'Client Interview', description: 'Holding client calls' },
        { name: 'Offer Made', description: 'Facilitating job offers' },
        { name: 'Placed', description: 'Deployment complete' }
      ];
  }
};

// ─── Interviews ──────────────────────────────────────────
// The interviews row is the source of truth; conflict checking and status
// mapping live with it. Covered by interviews.test.ts (`pnpm test`).
export * from './interviews';

// The compliance gate. Covered by compliance.test.ts.
export * from './compliance';

// How each service line is billed, and the margin applied to it.
export * from './billing';

// The monthly payroll run: proration, commission and the export.
export * from './payroll';

// Invoice numbering, due dates and going overdue.
export * from './invoicing';

// Document versions, and certifications that expire.
export * from './documents';

// Who may write which talent profile field, and what the values must
// look like. Covered by profileFields.test.ts.
export * from './profileFields';

// Marking a skill assessment from the answer key. Covered by
// assessmentScoring.test.ts.
export * from './assessmentScoring';

// What a client may do to a match. The four statuses
// matches_status_check allows, and nothing else. Covered by
// matchStatus.test.ts.
export * from './matchStatus';

// What a contract's status may be. The admin panel worked in title
// case throughout and the column takes none of those values. Covered
// by contractStatus.test.ts.
export * from './contractStatus';
