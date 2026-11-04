/**
 * What a contract's status may be, and what it may become.
 *
 * `contracts_status_check` allows nine values, all lowercase. The admin
 * panel worked in title case throughout: it filtered on 'Draft', 'Signed',
 * 'Active', 'Terminated' and 'Voided', set 'Voided' when voiding, 'Active'
 * when activating, and `/api/contracts` wrote 'Signed' into the audit
 * entry's condition. Not one of those is a value the column permits, so
 * every one of those writes was rejected by Postgres.
 *
 * 'Draft' and 'Voided' are not statuses at all here: a contract that is not
 * out for signature yet is 'pending', and a contract that is cancelled is
 * 'terminated'. The screen may keep its own words; this maps them.
 *
 * This file imports nothing, so it can be tested on its own.
 */

export const CONTRACT_STATUSES = [
  'pending',
  'pending_signatures',
  'client_signed',
  'talent_signed',
  'fully_signed',
  'active',
  'ended',
  'terminated',
  'closed'
] as const;

export type ContractStatus = typeof CONTRACT_STATUSES[number];

/**
 * The words the admin panel uses, and the column value each one means.
 *
 * Kept as a map rather than a lowercase-and-underscore rule, because
 * 'Draft' is 'pending' and 'Voided' is 'terminated'. A rule would have
 * produced 'draft' and 'voided', which is what the panel was writing.
 */
const LABEL_TO_STATUS: Record<string, ContractStatus> = {
  draft: 'pending',
  pending: 'pending',
  'pending signatures': 'pending_signatures',
  pending_signatures: 'pending_signatures',
  'awaiting signatures': 'pending_signatures',
  'client signed': 'client_signed',
  client_signed: 'client_signed',
  'talent signed': 'talent_signed',
  talent_signed: 'talent_signed',
  signed: 'fully_signed',
  'fully signed': 'fully_signed',
  fully_signed: 'fully_signed',
  active: 'active',
  ended: 'ended',
  completed: 'ended',
  voided: 'terminated',
  terminated: 'terminated',
  cancelled: 'terminated',
  canceled: 'terminated',
  closed: 'closed'
};

export function normaliseContractStatus(value?: string | null): ContractStatus | null {
  const text = String(value || '').trim().toLowerCase().replace(/[\s-]+/g, ' ');
  return LABEL_TO_STATUS[text] || LABEL_TO_STATUS[text.replace(/ /g, '_')] || null;
}

/** Where a contract may go from each status. */
export const CONTRACT_TRANSITIONS: Record<ContractStatus, ContractStatus[]> = {
  pending: ['pending_signatures', 'terminated'],
  pending_signatures: ['client_signed', 'talent_signed', 'fully_signed', 'terminated'],
  client_signed: ['fully_signed', 'terminated'],
  talent_signed: ['fully_signed', 'terminated'],
  fully_signed: ['active', 'terminated'],
  active: ['ended', 'terminated'],
  // An engagement that has run its course can be tidied away, but not
  // revived. A new engagement is a new contract.
  ended: ['closed'],
  terminated: ['closed'],
  closed: []
};

export interface ContractTransition {
  ok: boolean;
  status?: ContractStatus;
  error?: string;
}

/**
 * Checks a status change.
 *
 * Terminating needs a reason. A contract that ends early is the sort of
 * thing somebody asks about six months later, and "Voided" on its own
 * answers nothing.
 */
export function contractTransition(
  from: string | null | undefined,
  to: string | null | undefined,
  reason?: string | null
): ContractTransition {
  const current = normaliseContractStatus(from) || 'pending';
  const next = normaliseContractStatus(to);

  if (!next) return { ok: false, error: `"${to}" is not a contract status.` };
  if (next === current) return { ok: true, status: next };

  if (!CONTRACT_TRANSITIONS[current].includes(next)) {
    return {
      ok: false,
      error: CONTRACT_TRANSITIONS[current].length === 0
        ? `That contract is ${current} and cannot change.`
        : `A ${current} contract cannot become ${next}.`
    };
  }

  if (next === 'terminated' && !String(reason || '').trim()) {
    return { ok: false, error: 'Say why the contract is ending.' };
  }

  return { ok: true, status: next };
}

/** Whether this status means the engagement is live and billable. */
export function contractIsLive(status?: string | null): boolean {
  const resolved = normaliseContractStatus(status);
  return resolved === 'active' || resolved === 'fully_signed';
}
