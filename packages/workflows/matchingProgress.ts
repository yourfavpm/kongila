export type MatchingProgressEvent =
  | 'candidates_submitted'
  | 'interview_requested'
  | 'all_candidates_rejected'
  | 'offer_accepted'
  | 'offer_declined';

const MATCHING_STATUS_ORDER = [
  'New Request',
  'Reviewing',
  'Sourcing Talent',
  'Candidates Ready',
  'Client Interview',
  'Offer Accepted',
  'Onboarding',
  'Closed'
] as const;

function canonicalStatus(status: string | null | undefined): string {
  const text = String(status || '').trim().toLowerCase().replace(/[_-]+/g, ' ');
  const alias: Record<string, string> = {
    'closed / cancelled': 'Closed',
    'closed/cancelled': 'Closed',
    cancelled: 'Closed',
    canceled: 'Closed',
    hired: 'Onboarding',
    active: 'Onboarding'
  };
  return alias[text]
    || MATCHING_STATUS_ORDER.find((item) => item.toLowerCase() === text)
    || (text || 'New Request');
}

export function matchingProgressStatus(
  currentStatus: string | null | undefined,
  event: MatchingProgressEvent
): string | null {
  const current = canonicalStatus(currentStatus);

  if (current === 'Closed' || current === 'Onboarding') return null;

  switch (event) {
    case 'candidates_submitted':
      return ['New Request', 'Reviewing', 'Sourcing Talent'].includes(current)
        ? 'Candidates Ready'
        : null;
    case 'interview_requested':
      return ['New Request', 'Reviewing', 'Sourcing Talent', 'Candidates Ready'].includes(current)
        ? 'Client Interview'
        : null;
    case 'all_candidates_rejected':
      return ['Candidates Ready', 'Client Interview'].includes(current)
        ? 'Sourcing Talent'
        : null;
    case 'offer_accepted':
      return MATCHING_STATUS_ORDER.indexOf(current as typeof MATCHING_STATUS_ORDER[number]) >= 0
        && MATCHING_STATUS_ORDER.indexOf(current as typeof MATCHING_STATUS_ORDER[number])
          < MATCHING_STATUS_ORDER.indexOf('Offer Accepted')
        ? 'Offer Accepted'
        : null;
    case 'offer_declined':
      return current === 'Offer Accepted' ? 'Client Interview' : null;
  }
}

export function compareMatchingProgress(left: string, right: string): number {
  const leftIndex = MATCHING_STATUS_ORDER.indexOf(
    canonicalStatus(left) as typeof MATCHING_STATUS_ORDER[number]
  );
  const rightIndex = MATCHING_STATUS_ORDER.indexOf(
    canonicalStatus(right) as typeof MATCHING_STATUS_ORDER[number]
  );
  return leftIndex - rightIndex;
}
