/**
 * The compliance gate.
 *
 * It was a banner. `pendingDocs` rendered a warning on the candidate's own
 * dashboard and nothing anywhere blocked matching, shortlisting, hiring or
 * signing on unsigned documents — the two places that did check were the
 * admin's manual shortlist and push-match buttons, and both could be walked
 * around by using any other path.
 *
 * Three further problems underneath it:
 *
 *   - The check matched documents by name, so an uploaded file called
 *     "NDA.pdf" satisfied a requirement for a signed NDA.
 *   - `signedByTalentIds` was not a column. It lived in memory, vanished on
 *     reload, and the admin's signature progress bar always read zero.
 *   - Signing wrote the whole document row back with the signer's user_id
 *     attached, so the first candidate to sign a universal template took
 *     ownership of it and it stopped applying to everyone else.
 *
 * This file imports nothing, so it can be tested on its own.
 */

/** What a candidate must have signed before they can be put in front of a client. */
export const MANDATORY_DOCUMENT_TYPES = ['NDA', 'agreement', 'IT_Ethics_Policy'];

export interface ComplianceDocument {
  id: string;
  name?: string;
  type?: string;
  isMandatory?: boolean;
  isTemplate?: boolean;
  userId?: string | null;
}

export interface DocumentSignature {
  documentId: string;
  talentId: string;
  signedAt?: string;
}

export interface ComplianceStatus {
  compliant: boolean;
  /** Templates this candidate still has to sign. */
  outstanding: ComplianceDocument[];
  signedCount: number;
  requiredCount: number;
  /** A sentence to show whoever is blocked, or null when clear. */
  reason: string | null;
}

/**
 * Which documents every candidate must sign.
 *
 * A template has no owner. Reading `!userId` alone was how a template whose
 * user_id had been rewritten by its first signer silently dropped out of the
 * required set, so the flag is checked too.
 */
export function mandatoryTemplates(documents: ComplianceDocument[]): ComplianceDocument[] {
  return (documents || []).filter(doc => {
    if (!doc) return false;
    if (doc.isTemplate) return true;
    // Fall back to the shape a template has, for rows written before the
    // is_template column existed.
    return Boolean(doc.isMandatory)
      && !doc.userId
      && MANDATORY_DOCUMENT_TYPES.includes(String(doc.type));
  });
}

/**
 * Whether a candidate has signed everything they must.
 *
 * Matches on document id through the signature table, not on name. A file
 * the candidate uploaded and called "NDA.pdf" is not a signed NDA.
 */
export function complianceStatus(
  talentId: string,
  documents: ComplianceDocument[],
  signatures: DocumentSignature[]
): ComplianceStatus {
  const required = mandatoryTemplates(documents);

  if (required.length === 0) {
    return { compliant: true, outstanding: [], signedCount: 0, requiredCount: 0, reason: null };
  }

  const signedIds = new Set(
    (signatures || [])
      .filter(s => String(s.talentId) === String(talentId))
      .map(s => String(s.documentId))
  );

  const outstanding = required.filter(doc => !signedIds.has(String(doc.id)));

  if (outstanding.length === 0) {
    return {
      compliant: true,
      outstanding: [],
      signedCount: required.length,
      requiredCount: required.length,
      reason: null
    };
  }

  const names = outstanding.map(d => d.name || d.type || 'a required document');
  return {
    compliant: false,
    outstanding,
    signedCount: required.length - outstanding.length,
    requiredCount: required.length,
    reason: outstanding.length === 1
      ? `This candidate has not signed ${names[0]}.`
      : `This candidate has ${outstanding.length} unsigned compliance documents: ${names.join(', ')}.`
  };
}

/** The actions the gate covers. */
export type GatedAction =
  | 'match'
  | 'shortlist'
  | 'submit_to_client'
  | 'schedule_interview'
  | 'extend_offer'
  | 'issue_contract'
  | 'sign_contract';

/**
 * Which actions compliance blocks.
 *
 * Interviews deliberately are not blocked. A candidate meeting a client for
 * the first time has not yet been given anything confidential, and blocking
 * the interview would stall the pipeline at the point where the candidate
 * has least reason to have signed anything. Everything downstream of that —
 * being shortlisted to a client, an offer, a contract — is blocked.
 */
const BLOCKED_ACTIONS: GatedAction[] = [
  'match', 'shortlist', 'submit_to_client', 'extend_offer', 'issue_contract', 'sign_contract'
];

export function isGated(action: GatedAction): boolean {
  return BLOCKED_ACTIONS.includes(action);
}

/**
 * The one call every path makes before acting on a candidate.
 *
 * Returns a reason to refuse, or null to proceed. A gate that each caller
 * implements for itself is a gate with a hole in it.
 */
export function complianceRefusal(
  action: GatedAction,
  talentId: string,
  documents: ComplianceDocument[],
  signatures: DocumentSignature[]
): string | null {
  if (!isGated(action)) return null;

  const status = complianceStatus(talentId, documents, signatures);
  if (status.compliant) return null;

  return `${status.reason} They cannot be put forward until it is signed ` +
         `(${status.signedCount} of ${status.requiredCount} complete).`;
}
