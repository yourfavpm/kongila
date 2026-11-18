/**
 * Where an offer has got to, and whose move it is.
 *
 * An offer is not a document a client hands a candidate. Kongila is the
 * employer of record, so the commercial terms are Kongila's to approve before
 * the candidate ever sees them, and `offer_status_enum` has modelled that
 * from the start:
 *
 *   draft → submitted → admin_approved → sent_to_talent → accepted
 *                   ↘ revision_requested ↗
 *                   ↘ admin_declined        ↘ declined / expired
 *                                                      ↘ contract_active
 *
 * What was missing was any way for the three portals to agree on what those
 * words mean. The client saw a raw status string, operations saw the same
 * string, and the candidate saw nothing until an offer arrived — so nobody
 * could tell whether an offer was waiting on Kongila, on the candidate, or on
 * the client to revise it.
 *
 * This file imports nothing, so the whole flow can be tested with node --test.
 */

export type OfferStage =
  | 'draft'
  | 'submitted'
  | 'revision_requested'
  | 'admin_approved'
  | 'sent_to_talent'
  | 'accepted'
  | 'declined'
  | 'admin_declined'
  | 'contract_active'
  | 'expired';

export type OfferEvent =
  | 'client_submits'
  | 'admin_approves'
  | 'admin_requests_revision'
  | 'admin_declines'
  | 'admin_sends'
  | 'client_revises'
  | 'talent_accepts'
  | 'talent_declines'
  | 'expire'
  | 'contract_created';

const OFFER_STAGES = new Set<OfferStage>([
  'draft', 'submitted', 'revision_requested', 'admin_approved',
  'sent_to_talent', 'accepted', 'declined', 'admin_declined',
  'contract_active', 'expired'
]);

export function normalizeOfferStage(status?: string | null): OfferStage {
  const raw = String(status || '').trim().toLowerCase().replace(/[-\s]+/g, '_');
  return OFFER_STAGES.has(raw as OfferStage) ? (raw as OfferStage) : 'draft';
}

const TRANSITIONS: Record<OfferEvent, { from: OfferStage[]; to: OfferStage }> = {
  client_submits: { from: ['draft'], to: 'submitted' },
  admin_approves: { from: ['submitted', 'revision_requested'], to: 'admin_approved' },
  admin_requests_revision: { from: ['submitted', 'admin_approved'], to: 'revision_requested' },
  admin_declines: { from: ['submitted', 'admin_approved', 'revision_requested'], to: 'admin_declined' },
  // Operations may send straight from submitted without a separate approval
  // step: approving and sending are the same decision when the terms are fine.
  admin_sends: { from: ['submitted', 'admin_approved', 'revision_requested'], to: 'sent_to_talent' },
  client_revises: { from: ['revision_requested'], to: 'submitted' },
  talent_accepts: { from: ['sent_to_talent'], to: 'accepted' },
  talent_declines: { from: ['sent_to_talent'], to: 'declined' },
  expire: { from: ['sent_to_talent'], to: 'expired' },
  contract_created: { from: ['accepted'], to: 'contract_active' }
};

/** The stage this event moves an offer to, or null when it is not legal. */
export function offerTransition(
  current: string | null | undefined,
  event: OfferEvent
): OfferStage | null {
  const rule = TRANSITIONS[event];
  if (!rule) return null;
  return rule.from.includes(normalizeOfferStage(current)) ? rule.to : null;
}

export interface OfferStageDescription {
  label: string;
  waitingOn: 'client' | 'admin' | 'talent' | null;
  detail: string;
  tone: 'pending' | 'active' | 'done' | 'dead';
}

const DESCRIPTIONS: Record<OfferStage, OfferStageDescription> = {
  draft: {
    label: 'Draft',
    waitingOn: 'client',
    detail: 'This offer has not been sent to your Kongila team yet.',
    tone: 'pending'
  },
  submitted: {
    label: 'With your Kongila team',
    waitingOn: 'admin',
    detail: 'Kongila is reviewing the terms before the candidate sees them.',
    tone: 'active'
  },
  revision_requested: {
    label: 'Changes requested',
    waitingOn: 'client',
    detail: 'Your Kongila team has asked for a change before this goes out.',
    tone: 'active'
  },
  admin_approved: {
    label: 'Approved, not yet sent',
    waitingOn: 'admin',
    detail: 'The terms are approved. Kongila is about to put it to the candidate.',
    tone: 'active'
  },
  sent_to_talent: {
    label: 'With the candidate',
    waitingOn: 'talent',
    detail: 'The candidate has the offer and is deciding.',
    tone: 'active'
  },
  accepted: {
    label: 'Accepted',
    waitingOn: 'admin',
    detail: 'The candidate accepted. The contract is being prepared.',
    tone: 'done'
  },
  declined: {
    label: 'Declined by candidate',
    waitingOn: null,
    detail: 'The candidate turned this offer down.',
    tone: 'dead'
  },
  admin_declined: {
    label: 'Not proceeding',
    waitingOn: null,
    detail: 'Your Kongila team did not take this offer forward.',
    tone: 'dead'
  },
  contract_active: {
    label: 'Contract issued',
    waitingOn: null,
    detail: 'The contract has been created and is waiting on signatures.',
    tone: 'done'
  },
  expired: {
    label: 'Expired',
    waitingOn: null,
    detail: 'The candidate did not answer before the deadline.',
    tone: 'dead'
  }
};

export function describeOfferStage(stage: OfferStage | string): OfferStageDescription {
  return DESCRIPTIONS[normalizeOfferStage(String(stage))];
}

/** The happy path, for a progress trail. */
export const OFFER_TRAIL: OfferStage[] = [
  'submitted',
  'admin_approved',
  'sent_to_talent',
  'accepted'
];

export function offerTrailPosition(stage: OfferStage | string): number {
  const normalized = normalizeOfferStage(String(stage));
  // A revision is still the review step, not a step lost.
  if (normalized === 'revision_requested' || normalized === 'draft') return 0;
  if (normalized === 'contract_active') return OFFER_TRAIL.length - 1;
  const index = OFFER_TRAIL.indexOf(normalized);
  return index >= 0 ? index : 0;
}

/** True while somebody still owes an answer. */
export function isOpenOffer(status?: string | null): boolean {
  const stage = normalizeOfferStage(status);
  return stage === 'draft' || stage === 'submitted' || stage === 'revision_requested'
    || stage === 'admin_approved' || stage === 'sent_to_talent';
}

/** True once an offer has been taken up — the hire is happening. */
export function isLiveOffer(status?: string | null): boolean {
  const stage = normalizeOfferStage(status);
  return stage === 'accepted' || stage === 'contract_active';
}
