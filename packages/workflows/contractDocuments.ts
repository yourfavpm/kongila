/**
 * The two documents a contract is made of, and what each one's state means.
 *
 * A contract has always had one status covering both parties, which cannot
 * express what actually happens: the client gets their document on Monday
 * and reads it on Tuesday, the candidate gets a different document on
 * Wednesday and signs it on Thursday, and on Friday somebody has to say
 * which of the two is holding things up. One column cannot answer that, and
 * the answer is the whole job of chasing a signature.
 *
 * So each party has their own document with its own lifecycle, and the
 * contract's status is derived from the pair rather than set directly.
 *
 * This file imports nothing, so it can be tested on its own.
 */

export const DOCUMENT_AUDIENCES = ['client', 'talent'] as const;
export type DocumentAudience = typeof DOCUMENT_AUDIENCES[number];

export const DOCUMENT_STATUSES = [
  /** Generated, not yet sent. The party cannot see it. */
  'draft',
  /** Sent. The party can open it and sign it. */
  'sent',
  /** Opened by the party at least once. */
  'viewed',
  /** Signed by the party. */
  'signed',
  /** Withdrawn before signing, usually because the terms changed. */
  'void'
] as const;

export type DocumentStatus = typeof DOCUMENT_STATUSES[number];

export interface ContractDocumentRow {
  audience: DocumentAudience;
  status?: DocumentStatus | string | null;
  sentAt?: string | null;
  viewedAt?: string | null;
  signedAt?: string | null;
  /** The hash of the text that was sent, so a change after sending is visible. */
  documentHash?: string | null;
}

function normalise(status?: string | null): DocumentStatus {
  const text = String(status || '').trim().toLowerCase();
  return (DOCUMENT_STATUSES as readonly string[]).includes(text)
    ? (text as DocumentStatus)
    : 'draft';
}

/**
 * Where a document may go from each state.
 *
 * Viewing is not reversible and signing is final: a party who has signed
 * cannot be moved back to sent by re-sending, because their signature
 * attests to text that already exists. Changing the terms after a signature
 * means voiding and issuing again, which is what `void` is for.
 */
export const DOCUMENT_TRANSITIONS: Record<DocumentStatus, DocumentStatus[]> = {
  draft: ['sent', 'void'],
  sent: ['viewed', 'signed', 'void'],
  viewed: ['signed', 'void'],
  signed: [],
  void: []
};

export interface DocumentTransition {
  ok: boolean;
  status?: DocumentStatus;
  error?: string;
}

/** Checks a document state change, with a reason a person can read. */
export function documentTransition(
  from: string | null | undefined,
  to: string | null | undefined
): DocumentTransition {
  const current = normalise(from);
  const next = String(to || '').trim().toLowerCase() as DocumentStatus;

  if (!(DOCUMENT_STATUSES as readonly string[]).includes(next)) {
    return { ok: false, error: `"${to}" is not a document state.` };
  }
  if (next === current) return { ok: true, status: next };

  if (!DOCUMENT_TRANSITIONS[current].includes(next)) {
    if (current === 'signed') {
      return { ok: false, error: 'That party has already signed. Void the contract and issue a new one to change the terms.' };
    }
    if (current === 'void') {
      return { ok: false, error: 'That document has been withdrawn.' };
    }
    return { ok: false, error: `A ${current} document cannot become ${next}.` };
  }

  return { ok: true, status: next };
}

/** True when this document has been signed. */
export function isSigned(row?: ContractDocumentRow | null): boolean {
  return normalise(row?.status) === 'signed';
}

/** True when the party can open it: sent, viewed or signed. */
export function isVisibleToParty(row?: ContractDocumentRow | null): boolean {
  const status = normalise(row?.status);
  return status === 'sent' || status === 'viewed' || status === 'signed';
}

/**
 * The contract's status, read off its two documents.
 *
 * Derived rather than stored, so the contract cannot claim to be fully
 * signed while one of its documents is sitting unsent. Activation is an
 * explicit operator action after both signatures, regardless of start date.
 */
export function contractStatusFromDocuments(
  documents: ContractDocumentRow[],
  _options: { startsInFuture?: boolean } = {}
): 'pending' | 'pending_signatures' | 'client_signed' | 'talent_signed' | 'fully_signed' | 'active' {
  const byAudience = new Map<string, ContractDocumentRow>();
  for (const row of documents || []) {
    if (row?.audience) byAudience.set(String(row.audience), row);
  }

  const client = byAudience.get('client');
  const talent = byAudience.get('talent');

  const clientSigned = isSigned(client);
  const talentSigned = isSigned(talent);

  if (clientSigned && talentSigned) return 'fully_signed';
  if (clientSigned) return 'client_signed';
  if (talentSigned) return 'talent_signed';

  // Nobody has signed. Out for signature only once at least one party can
  // actually see their document.
  const anySent = [client, talent].some(row => isVisibleToParty(row));
  return anySent ? 'pending_signatures' : 'pending';
}

/**
 * Who is holding the contract up, in the words an operator would use.
 *
 * Both parties are named when both are outstanding, because chasing one of
 * them is half a job.
 */
export function whoIsOutstanding(documents: ContractDocumentRow[]): string | null {
  const byAudience = new Map<string, ContractDocumentRow>();
  for (const row of documents || []) {
    if (row?.audience) byAudience.set(String(row.audience), row);
  }

  const waiting: string[] = [];
  for (const [audience, label] of [['client', 'the client'], ['talent', 'the candidate']] as const) {
    const row = byAudience.get(audience);
    const status = normalise(row?.status);
    if (status === 'signed' || status === 'void') continue;
    if (status === 'draft') waiting.push(`${label} (not sent yet)`);
    else if (status === 'viewed') waiting.push(`${label} (opened, not signed)`);
    else waiting.push(`${label} (sent, not opened)`);
  }

  if (waiting.length === 0) return null;
  return waiting.join(' and ');
}

/** How long a document has sat unsigned since it was sent, in whole days. */
export function daysSinceSent(row: ContractDocumentRow, asOf: Date = new Date()): number | null {
  if (!row?.sentAt) return null;
  if (isSigned(row)) return null;
  const sent = new Date(row.sentAt).getTime();
  if (!Number.isFinite(sent)) return null;
  return Math.max(0, Math.floor((asOf.getTime() - sent) / 86400000));
}
