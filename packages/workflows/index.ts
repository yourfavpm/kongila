import { RequestStatus, VettingStatus, TaskStatus, ServiceType } from '@kongila/shared-types';

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
  'onboarding': 'Onboarding'
};

export function normalizeRequestStatus(status?: string | null): RequestStatus {
  if (!status) return 'New Request';
  const trimmed = String(status).trim();
  if (!trimmed) return 'New Request';

  const direct = REQUEST_STATUS_ALIASES[trimmed.toLowerCase()];
  if (direct) return direct;

  const normalized = trimmed
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return REQUEST_STATUS_ALIASES[normalized] || 'New Request';
}

export function isMatchingRequestStatus(status?: string | null): boolean {
  const normalized = normalizeRequestStatus(status);
  return normalized === 'Sourcing Talent' || normalized === 'Candidates Ready' || normalized === 'Client Interview' || normalized === 'Offer Accepted' || normalized === 'Onboarding';
}

export function isActiveRequestStatus(status?: string | null): boolean {
  const normalized = normalizeRequestStatus(status);
  return normalized === 'New Request' || normalized === 'Reviewing' || isMatchingRequestStatus(normalized);
}

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

export const VALID_REQUEST_TRANSITIONS: Record<RequestStatus, RequestStatus[]> = {
  'New Request': ['Reviewing'],
  'Reviewing': ['Sourcing Talent', 'New Request'],
  'Sourcing Talent': ['Candidates Ready', 'Reviewing'],
  'Candidates Ready': ['Client Interview', 'Sourcing Talent'],
  'Client Interview': ['Offer Accepted', 'Candidates Ready'],
  'Offer Accepted': ['Onboarding', 'Client Interview'],
  'Onboarding': ['Onboarding'] // Terminus stage
};

export function canTransitionRequest(from: RequestStatus, to: RequestStatus): boolean {
  if (from === to) return true;
  return VALID_REQUEST_TRANSITIONS[from]?.includes(to) || false;
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
