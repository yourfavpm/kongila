/**
 * Document versions, and certifications that expire.
 *
 * What was there: `versionNumber` was computed in the browser as
 * `highest + 1` and written onto the new row, and nothing marked the old
 * one superseded. Every version stayed `status: 'uploaded'`, so a
 * candidate's document list showed four CVs with no indication which one
 * was current, and every screen that picked one took whichever the query
 * happened to return first.
 *
 * Expiry was worse: `getExpiryState` existed in the talent dashboard and
 * coloured a badge, and that was the whole feature. Nothing on the server
 * knew a certification had lapsed, nobody was told it was about to, and an
 * expired certificate counted towards compliance exactly like a valid one.
 *
 * This file imports nothing, so it can be tested on its own.
 */

export type ExpiryState = 'valid' | 'expiring_soon' | 'expired' | 'none';

/** How long before expiry a certification starts warning. */
export const EXPIRY_WARNING_DAYS = 30;

export interface VersionedDocument {
  id: string;
  userId?: string | null;
  type?: string | null;
  name?: string | null;
  status?: string | null;
  versionNumber?: number | null;
  uploadedAt?: string | null;
  expiryDate?: string | null;
  supersededById?: string | null;
  isCurrent?: boolean | null;
  certificationName?: string | null;
}

// ─── Versions ────────────────────────────────────────────────────────────────

/** Document types where a newer upload replaces the one before it. */
export const VERSIONED_TYPES = ['cv', 'portfolio'];

export function isVersionedType(type?: string | null): boolean {
  return VERSIONED_TYPES.includes(String(type || '').toLowerCase());
}

function uploadedTime(doc: VersionedDocument): number {
  const value = Date.parse(String(doc.uploadedAt || ''));
  return Number.isNaN(value) ? 0 : value;
}

/**
 * Every version of one document type for one person, newest first.
 *
 * Sorted by version number and then by upload time, so two rows that both
 * claim version 2 (which the browser-side counter made possible when two
 * tabs were open) still come back in a stable order rather than whichever
 * the database felt like.
 */
export function versionChain(
  documents: VersionedDocument[],
  userId: string,
  type: string
): VersionedDocument[] {
  return (documents || [])
    .filter(doc =>
      doc
      && String(doc.userId) === String(userId)
      && String(doc.type || '').toLowerCase() === String(type).toLowerCase()
      && String(doc.status || '').toLowerCase() !== 'deleted')
    .sort((a, b) => {
      const byVersion = (Number(b.versionNumber) || 1) - (Number(a.versionNumber) || 1);
      return byVersion !== 0 ? byVersion : uploadedTime(b) - uploadedTime(a);
    });
}

/** The one that counts. */
export function currentVersion(
  documents: VersionedDocument[],
  userId: string,
  type: string
): VersionedDocument | null {
  const chain = versionChain(documents, userId, type);
  // An explicit flag wins over position, because a document restored from
  // an earlier version is current without being the highest numbered.
  return chain.find(doc => doc.isCurrent) || chain[0] || null;
}

export function nextVersionNumber(
  documents: VersionedDocument[],
  userId: string,
  type: string
): number {
  const chain = versionChain(documents, userId, type);
  const highest = chain.reduce((max, doc) => Math.max(max, Number(doc.versionNumber) || 1), 0);
  return highest + 1;
}

export interface SupersedePlan {
  /** Rows to mark as no longer current, with the id that replaced them. */
  superseded: { id: string; supersededById: string }[];
  newVersionNumber: number;
}

/**
 * What a new upload does to the versions before it.
 *
 * Returns the changes rather than applying them, so the caller writes them
 * in one place and the decision stays testable.
 */
export function planSupersede(
  documents: VersionedDocument[],
  userId: string,
  type: string,
  newDocumentId: string
): SupersedePlan {
  const chain = versionChain(documents, userId, type);

  return {
    superseded: chain
      .filter(doc => doc.id !== newDocumentId && !doc.supersededById)
      .map(doc => ({ id: doc.id, supersededById: newDocumentId })),
    newVersionNumber: nextVersionNumber(documents, userId, type)
  };
}

// ─── Expiry ──────────────────────────────────────────────────────────────────

function dayOf(value: Date): number {
  return Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate());
}

/** Whole days until expiry. Negative once it has passed. */
export function daysUntilExpiry(expiryDate?: string | null, now: Date = new Date()): number | null {
  if (!expiryDate) return null;
  const expiry = new Date(expiryDate);
  if (Number.isNaN(expiry.getTime())) return null;
  return Math.round((dayOf(expiry) - dayOf(now)) / 86400000);
}

/**
 * Where a certification stands.
 *
 * A certification expiring today is still valid today. Treating the expiry
 * date as the first invalid day takes a day of validity off every
 * certificate on the platform.
 */
export function expiryState(expiryDate?: string | null, now: Date = new Date()): ExpiryState {
  const days = daysUntilExpiry(expiryDate, now);
  if (days === null) return 'none';
  if (days < 0) return 'expired';
  if (days <= EXPIRY_WARNING_DAYS) return 'expiring_soon';
  return 'valid';
}

export interface ExpiryNotice {
  documentId: string;
  userId: string | null;
  name: string;
  state: 'expiring_soon' | 'expired';
  daysUntilExpiry: number;
  message: string;
}

/**
 * Who needs telling, and what to tell them.
 *
 * Only current documents are reported. Warning somebody that a certificate
 * they replaced last year is expiring is noise, and noise is how a real
 * warning gets ignored.
 */
export function expiryNotices(
  documents: VersionedDocument[],
  now: Date = new Date()
): ExpiryNotice[] {
  const notices: ExpiryNotice[] = [];

  for (const doc of documents || []) {
    if (!doc || !doc.expiryDate) continue;
    if (String(doc.status || '').toLowerCase() === 'deleted') continue;
    if (doc.supersededById) continue;

    const state = expiryState(doc.expiryDate, now);
    if (state !== 'expired' && state !== 'expiring_soon') continue;

    const days = daysUntilExpiry(doc.expiryDate, now) as number;
    const name = doc.certificationName || doc.name || 'A certification';

    notices.push({
      documentId: doc.id,
      userId: doc.userId || null,
      name,
      state,
      daysUntilExpiry: days,
      message: state === 'expired'
        ? `${name} expired ${days === -1 ? 'yesterday' : `${Math.abs(days)} days ago`}. `
          + 'Upload a current copy to keep your profile deployable.'
        : `${name} expires ${days === 0 ? 'today' : days === 1 ? 'tomorrow' : `in ${days} days`}. `
          + 'Upload a renewal before it lapses.'
    });
  }

  // Most urgent first, so a digest leads with what has already lapsed.
  return notices.sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry);
}

/**
 * Whether an expired certification should block deployment.
 *
 * Deliberately a separate question from the compliance gate. A lapsed
 * certificate is a reason to chase somebody, not a reason to stop a
 * placement already under contract, and conflating the two would strand
 * live engagements over an out-of-date certificate.
 */
export function expiredCertifications(
  documents: VersionedDocument[],
  userId: string,
  now: Date = new Date()
): VersionedDocument[] {
  return (documents || []).filter(doc =>
    doc
    && String(doc.userId) === String(userId)
    && String(doc.type || '').toLowerCase() === 'certification'
    && !doc.supersededById
    && String(doc.status || '').toLowerCase() !== 'deleted'
    && expiryState(doc.expiryDate, now) === 'expired');
}
