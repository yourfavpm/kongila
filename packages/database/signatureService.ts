/**
 * Electronic signatures.
 *
 * What was there: the talent signing UI updated React state and nothing
 * else. The "audit trail" was a hardcoded IP of '192.168.1.1' with the
 * comment "Mocked IP", and a content hash of `'sha256-mock-' + Date.now()`,
 * which is not a hash of anything. None of it was saved. The client side had
 * no signing UI at all — the modal was passed into ClientDashboard and never
 * rendered — and the page displayed "Alex Kongila" as a countersignature
 * that no person had given.
 *
 * So nothing in the product could show who agreed to what, or prove that the
 * document they agreed to is the one on file. That is the entire point of a
 * signature.
 *
 * What this does:
 *   - hashes the exact document text the signer was shown, with SHA-256, so
 *     a later change to the template is detectable,
 *   - records the real IP and user agent from the request,
 *   - records a server timestamp, not one the browser supplied,
 *   - requires both parties, and will not mark a contract signed until both
 *     have signed the same document hash,
 *   - makes the trail readable by both sides afterwards.
 *
 * It is not a qualified electronic signature under eIDAS or the ESIGN Act.
 * It is a defensible record of intent: who, when, from where, and exactly
 * what text. If Kongila needs qualified signatures, that is a provider
 * (DocuSign, Dropbox Sign) and a separate piece of work — this is the
 * honest version of what the product can actually attest to.
 */

import { createHash } from 'crypto';
import { getSupabaseClient } from './index';
import type { RequestActor as Actor } from './scope';
import { recordAudit } from './audit';
import { notifyUsers } from './notify';
import { complianceRefusal, complianceStatus, isGated, type GatedAction } from '@kongila/workflows';
import { buildContractDocument, documentToHtml, type ContractDocument } from '@kongila/contracts';

export interface SignatureResult<T = any> {
  ok: boolean;
  status: number;
  error?: string;
  data?: T;
  warnings?: string[];
}

function fail(status: number, error: string): SignatureResult {
  return { ok: false, status, error };
}

/**
 * The hash of the document as presented.
 *
 * Normalises line endings and trims trailing whitespace so the same
 * agreement does not hash differently on Windows and Linux, but changes
 * nothing else: any difference in the words produces a different hash.
 */
export function hashDocument(text: string): string {
  const normalised = String(text || '')
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+$/gm, '')
    .trim();
  return `sha256:${createHash('sha256').update(normalised, 'utf8').digest('hex')}`;
}

/** The caller's real IP, as far as the proxy chain can be trusted. */
export function clientIpFrom(req: any): string | null {
  const forwarded = req?.headers?.['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    // First entry is the original client; the rest are proxies.
    return forwarded.split(',')[0].trim();
  }
  if (Array.isArray(forwarded) && forwarded.length > 0) return String(forwarded[0]).trim();

  const real = req?.headers?.['x-real-ip'];
  if (typeof real === 'string' && real) return real;

  return req?.socket?.remoteAddress || null;
}

export type SignerRole = 'talent' | 'client' | 'kongila';

export interface SignInput {
  contractId: string;
  /** What they typed as their name, which is the act of signing. */
  typedName: string;
  /** Optional drawn signature, as a data URL. */
  drawnSignature?: string | null;
  /** Taken from the request, never from the body. */
  ipAddress?: string | null;
  userAgent?: string | null;
}

function signerRoleFor(actor: Actor): SignerRole | null {
  if (actor.kind === 'talent') return 'talent';
  if (actor.kind === 'client') return 'client';
  if (actor.kind === 'admin') return 'kongila';
  return null;
}

/**
 * Records one party's signature.
 *
 * Refuses rather than guesses in every case where the record would be
 * misleading: an empty name, a document with no text, a second signature
 * from the same party, or a signature over text that differs from what the
 * other party already signed.
 */
export async function signContract(
  actor: Actor,
  input: SignInput
): Promise<SignatureResult> {
  if (!actor) return fail(401, 'Not authenticated.');
  if (!input.contractId) return fail(400, 'contractId is required.');

  const typedName = String(input.typedName || '').trim();
  if (typedName.length < 2) {
    return fail(400, 'Type your full name to sign. An empty field is not a signature.');
  }

  const role = signerRoleFor(actor);
  if (!role) return fail(403, 'You cannot sign this contract.');

  const supabase = getSupabaseClient();

  const { data: contract, error: loadError } = await supabase
    .from('contracts')
    .select('*')
    .eq('id', input.contractId)
    .maybeSingle();

  if (loadError) return fail(500, loadError.message);
  if (!contract) return fail(404, 'That contract does not exist.');

  // Only the two parties and Kongila may sign, and only their own line.
  if (role === 'talent' && String(contract.talent_id) !== String(actor.talentProfileId || actor.userId)) {
    return fail(403, 'That contract is not yours.');
  }
  if (role === 'client' && String(contract.client_id) !== String(actor.userId)) {
    return fail(403, 'That contract is not yours.');
  }
  if (['ended', 'terminated', 'closed'].includes(String(contract.status))) {
    return fail(409, `This contract is ${contract.status} and cannot be signed.`);
  }

  // A candidate cannot sign a contract while compliance documents are
  // outstanding. Nothing used to block this.
  if (role === 'talent') {
    const refusal = await complianceGate('sign_contract', String(contract.talent_id));
    if (refusal) return fail(409, refusal);
  }

  // The text being signed is built here, from the document issued to this
  // party. It used to arrive in the request body, which meant the signer
  // decided what their own signature attested to.
  //
  // Each party signs their own document. This used to build one document and
  // ask both parties to sign it, then refuse the second signature if the
  // text differed — which is exactly what it does, because the client's
  // document carries the service fee and the candidate's carries their pay.
  const audience: 'client' | 'talent' = role === 'client' ? 'client' : 'talent';
  const document = await contractDocumentFor(contract, audience);
  if (!document.ready) return fail(409, document.reason as string);

  const documentHash = hashDocument(document.text);

  // The issued row, when this database has them. It is what says whether the
  // document was ever sent to this party, and what it said when it was.
  let issued: any = null;
  try {
    const { data } = await supabase
      .from('contract_documents')
      .select('*')
      .eq('contract_id', input.contractId)
      .eq('audience', audience)
      .maybeSingle();
    issued = data || null;
  } catch {
    issued = null;
  }

  if (issued) {
    if (String(issued.status) === 'signed') {
      return fail(409, 'You have already signed this contract.');
    }
    if (String(issued.status) === 'void') {
      return fail(409, 'This document has been withdrawn. A replacement will be issued.');
    }
    if (String(issued.status) === 'draft') {
      return fail(409, 'This contract has not been sent to you yet.');
    }
    // The words have changed since this party was sent them. Signing now
    // would attest to text they were never shown.
    if (issued.document_hash && issued.document_hash !== documentHash) {
      return fail(409,
        'This document has changed since it was sent to you. '
        + 'A replacement will be issued so you sign the text you were given.');
    }
  }

  const { data: existing } = await supabase
    .from('contract_signatures')
    .select('*')
    .eq('contract_id', input.contractId);

  const already = (existing || []).find((s: any) => s.signer_role === role);
  if (already) {
    return fail(409, 'You have already signed this contract.');
  }

  const signedAt = new Date().toISOString();
  const signatureId = globalThis.crypto?.randomUUID?.()
    || `sig_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const { error: insertError } = await supabase.from('contract_signatures').insert({
    id: signatureId,
    contract_id: input.contractId,
    // Which of the two documents this signature is against. The role said
    // who signed; this says what they signed.
    contract_document_id: issued?.id || null,
    signer_user_id: actor.userId,
    signer_role: role,
    signer_name: typedName,
    signer_email: actor.email,
    document_hash: documentHash,
    drawn_signature: input.drawnSignature || null,
    // Real, from the request. Was a hardcoded '192.168.1.1'.
    ip_address: input.ipAddress || null,
    user_agent: input.userAgent || null,
    // Server time. A browser-supplied timestamp is worth nothing.
    signed_at: signedAt
  });

  if (insertError) {
    // contract_document_id arrives with the 2026-11-20b migration. Without
    // it the signature is still a complete record, so retry rather than
    // refusing a signature the party has already given.
    if (/contract_document_id/.test(String(insertError.message))) {
      const { error: retryError } = await supabase.from('contract_signatures').insert({
        id: signatureId,
        contract_id: input.contractId,
        signer_user_id: actor.userId,
        signer_role: role,
        signer_name: typedName,
        signer_email: actor.email,
        document_hash: documentHash,
        drawn_signature: input.drawnSignature || null,
        ip_address: input.ipAddress || null,
        user_agent: input.userAgent || null,
        signed_at: signedAt
      });
      if (retryError) {
        return fail(500, `Your signature was not recorded: ${retryError.message}`);
      }
    } else {
      return fail(500, `Your signature was not recorded: ${insertError.message}`);
    }
  }

  // This party's document is signed. Done before the contract status is
  // worked out, because the status is read off these rows.
  if (issued?.id) {
    await supabase
      .from('contract_documents')
      .update({
        status: 'signed',
        signed_at: signedAt,
        signature_id: signatureId,
        document_hash: documentHash,
        updated_at: signedAt
      })
      .eq('id', issued.id);
  }

  // Fully signed only when both parties have signed the same text.
  const signatures = [...(existing || []), { signer_role: role, document_hash: documentHash }];
  const roles = new Set(signatures.map((s: any) => s.signer_role));
  const bothParties = roles.has('talent') && roles.has('client');

  /**
   * Both signed, and the engagement has begun: the contract is active.
   *
   * It used to stop at 'fully_signed' and stay there. Nothing ever moved a
   * contract to 'active', so a placement both sides had signed showed as
   * still being signed — on the client's My Team screen, in the candidate's
   * contracts, and in every count of active placements.
   *
   * A contract signed before its start date waits at 'fully_signed' until
   * the day arrives, because saying a placement is active a fortnight before
   * anyone starts work is the same lie in the other direction. The nightly
   * pass promotes those.
   */
  const startsInFuture = Boolean(
    contract.start_date && new Date(contract.start_date).getTime() > Date.now()
  );

  // Derived from the two documents where this database has them, so the
  // contract cannot read as fully signed while one document sits unsent.
  // Falls back to counting signatures on databases without that table.
  let nextStatus = bothParties
    ? (startsInFuture ? 'fully_signed' : 'active')
    : role === 'talent' ? 'talent_signed'
    : role === 'client' ? 'client_signed'
    : 'pending_signatures';

  if (issued?.id) {
    try {
      const { syncContractStatus } = await import('./contractDocumentService');
      const derived = await syncContractStatus(String(input.contractId));
      if (derived) nextStatus = derived;
    } catch {
      // Fall back to the status worked out above.
    }
  }

  await supabase
    .from('contracts')
    .update({
      status: nextStatus,
      signed_at: bothParties ? signedAt : null,
      document_hash: documentHash
    })
    .eq('id', input.contractId);

  const warnings: string[] = [];
  const counterparty = role === 'talent' ? contract.client_id : contract.talent_id;
  if (counterparty) {
    const result = await notifyUsers(
      counterparty,
      bothParties ? 'contract_signed' : 'contract_ready',
      { reason: bothParties ? undefined : `${typedName} has signed. The contract is waiting for you.` }
    );
    warnings.push(...result.warnings);
  }

  await recordAudit(actor, {
    action: bothParties ? 'Contract Fully Signed' : 'Sign Contract',
    details: `${typedName} signed as ${role}. Document ${documentHash}.` +
             (input.ipAddress ? ` From ${input.ipAddress}.` : ''),
    entityType: 'contract',
    entityId: input.contractId
  });

  return {
    ok: true,
    status: 201,
    data: { contractId: input.contractId, status: nextStatus, documentHash, signedAt, bothParties },
    warnings
  };
}

// ─── The compliance gate, server side ───────────────────────────────────────

/**
 * Refuses an action when the candidate has unsigned compliance documents.
 *
 * One call, used by every gated path. The gate used to be a banner on the
 * candidate's own dashboard plus two ad-hoc checks in the admin panel, so
 * any other route around it worked.
 */
export async function complianceGate(
  action: GatedAction,
  talentId: string
): Promise<string | null> {
  if (!isGated(action)) return null;
  if (!talentId) return 'No candidate was given, so compliance could not be checked.';

  const supabase = getSupabaseClient();

  const { data: documents, error: docError } = await supabase
    .from('documents')
    .select('id, name, type, is_mandatory, is_template, user_id');

  if (docError) {
    // Fail closed. A gate that opens when the database is unreachable is
    // not a gate.
    console.error('[compliance] could not read documents:', docError.message);
    return 'Compliance could not be checked just now, so this is blocked. Try again shortly.';
  }

  const { data: signatures } = await supabase
    .from('document_signatures')
    .select('document_id, talent_id, signed_at')
    .eq('talent_id', talentId);

  return complianceRefusal(
    action,
    talentId,
    (documents || []).map((d: any) => ({
      id: d.id,
      name: d.name,
      type: d.type,
      isMandatory: d.is_mandatory,
      isTemplate: d.is_template,
      userId: d.user_id
    })),
    (signatures || []).map((s: any) => ({
      documentId: s.document_id,
      talentId: s.talent_id,
      signedAt: s.signed_at
    }))
  );
}

/** Records a candidate signing one of the universal compliance templates. */
export async function signComplianceDocument(
  actor: Actor,
  input: {
    documentId: string;
    typedName: string;
    documentText?: string;
    ipAddress?: string | null;
    userAgent?: string | null;
  }
): Promise<SignatureResult> {
  if (!actor) return fail(401, 'Not authenticated.');
  if (actor.kind !== 'talent') return fail(403, 'Only a candidate signs a compliance document.');

  const typedName = String(input.typedName || '').trim();
  if (typedName.length < 2) return fail(400, 'Type your full name to sign.');

  const talentId = actor.talentProfileId || actor.userId;
  const supabase = getSupabaseClient();

  const { data: document } = await supabase
    .from('documents')
    .select('id, name, is_template, is_mandatory')
    .eq('id', input.documentId)
    .maybeSingle();

  if (!document) return fail(404, 'That document does not exist.');

  // Adds a row. Never writes to the document, which is how the first signer
  // used to take ownership of a universal template and remove it from
  // everybody else's requirements.
  const { error } = await supabase.from('document_signatures').insert({
    id: globalThis.crypto?.randomUUID?.() || `dsig_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    document_id: input.documentId,
    talent_id: talentId,
    signer_name: typedName,
    document_hash: input.documentText ? hashDocument(input.documentText) : null,
    ip_address: input.ipAddress || null,
    user_agent: input.userAgent || null,
    signed_at: new Date().toISOString()
  });

  if (error) {
    if (String(error.message).includes('document_signatures_once')) {
      return fail(409, 'You have already signed this document.');
    }
    return fail(500, `Your signature was not recorded: ${error.message}`);
  }

  await recordAudit(actor, {
    action: 'Sign Compliance Document',
    details: `${typedName} signed "${document.name}".` + (input.ipAddress ? ` From ${input.ipAddress}.` : ''),
    entityType: 'document',
    entityId: input.documentId
  });

  return { ok: true, status: 201, data: { documentId: input.documentId, signedAt: new Date().toISOString() } };
}

// ─── The trail ───────────────────────────────────────────────────────────────

/**
 * Who signed what, visible to both parties.
 *
 * The signature record was saved nowhere, so neither side could see the
 * other's. Both can now, which is the point of a countersigned document.
 */
export async function getSignatures(
  actor: Actor,
  contractId: string
): Promise<SignatureResult> {
  if (!actor) return fail(401, 'Not authenticated.');

  const supabase = getSupabaseClient();
  const { data: contract } = await supabase
    .from('contracts')
    .select('id, talent_id, client_id, document_hash, status')
    .eq('id', contractId)
    .maybeSingle();

  if (!contract) return fail(404, 'That contract does not exist.');

  const isParty = actor.kind === 'admin'
    || String(contract.talent_id) === String(actor.talentProfileId || actor.userId)
    || String(contract.client_id) === String(actor.userId);

  if (!isParty) return fail(403, 'That contract is not yours.');

  const { data, error } = await supabase
    .from('contract_signatures')
    .select('*')
    .eq('contract_id', contractId)
    .order('signed_at');

  if (error) return fail(500, error.message);

  return {
    ok: true,
    status: 200,
    data: {
      contractStatus: contract.status,
      documentHash: contract.document_hash,
      signatures: (data || []).map((s: any) => ({
        id: s.id,
        signerRole: s.signer_role,
        signerName: s.signer_name,
        signerEmail: s.signer_email,
        signedAt: s.signed_at,
        documentHash: s.document_hash,
        ipAddress: s.ip_address,
        userAgent: s.user_agent,
        // True when this signature covers the contract's current document.
        matchesCurrentDocument: s.document_hash === contract.document_hash
      }))
    }
  };
}


// ─── The document itself ────────────────────────────────────────────────────

/**
 * Builds the text for a contract from its row and its published template.
 *
 * There is deliberately no fallback body. When no template is published the
 * document comes back not ready, and every path that would have shown or
 * signed it stops. The page used to fill the gap with fifteen identical
 * paragraphs of placeholder text and let a candidate sign them.
 */
export async function contractDocumentFor(
  contract: any,
  audience: 'client' | 'talent' = 'talent'
): Promise<ContractDocument> {
  // ── The document that was actually issued ──────────────────────────────
  // This is the first place to look, and until now it was not looked at at
  // all. Contract generation renders a client document and a candidate
  // document and stores both; this used to ignore them, go back to the
  // templates table, re-render one generic document and ask both parties to
  // sign that same text. A client and a candidate do not sign the same
  // document: one carries the service fee, the other carries the pay.
  const supabase = getSupabaseClient();

  try {
    const { data: issued } = await supabase
      .from('contract_documents')
      .select('body, status')
      .eq('contract_id', String(contract.id))
      .eq('audience', audience)
      .maybeSingle();

    if (issued?.body && String(issued.body).trim()) {
      if (String(issued.status) === 'void') {
        return {
          ready: false,
          text: String(issued.body),
          reason: 'This document has been withdrawn. A replacement will be issued.'
        };
      }
      return { ready: true, text: String(issued.body), reason: null };
    }
  } catch {
    // No contract_documents table yet. Fall through to the body frozen onto
    // the contract row, which is the same text.
  }

  // ── The body frozen onto the contract at generation ────────────────────
  const frozen = audience === 'talent'
    ? contract.talent_contract_body
    : contract.client_contract_body;

  if (frozen && String(frozen).trim()) {
    return { ready: true, text: String(frozen), reason: null };
  }

  // ── Contracts made before any of that ──────────────────────────────────
  // Rendered from the published template, as the only path used to do. A
  // missing template is "not ready", never "sign the cover sheet".
  const facts = {
    referenceNumber: contract.reference_number,
    talentName: contract.talent_name,
    clientName: contract.client_name || contract.client_company,
    roleTitle: contract.role_title || contract.role,
    monthlyRateUsd: contract.monthly_rate_usd ?? contract.salary,
    startDate: contract.start_date,
    endDate: contract.end_date,
    engagementType: contract.engagement_type
  };

  let body: string | null = null;

  try {
    const templateId = audience === 'talent'
      ? (contract.talent_template_id || contract.template_id)
      : (contract.client_template_id || contract.template_id);

    let query = supabase.from('contract_templates').select('body, status, version');
    if (templateId) query = query.eq('id', templateId);
    else query = query.eq('status', 'published').eq('audience', audience);

    const { data } = await query.order('version', { ascending: false }).limit(1);
    const template = (data || [])[0];
    if (template && String(template.status) === 'published') body = template.body;
  } catch {
    body = null;
  }

  return buildContractDocument(facts, body);
}

/**
 * The document a party is about to sign, or the reason they cannot.
 *
 * The browser renders what this returns rather than composing the agreement
 * itself, so the words on screen are the words that get hashed.
 */
export async function getContractDocument(
  actor: Actor,
  contractId: string
): Promise<SignatureResult<ContractDocument & { contractId: string }>> {
  if (!actor) return fail(401, 'Not authenticated.');
  if (!contractId) return fail(400, 'contractId is required.');

  const supabase = getSupabaseClient();
  const { data: contract, error } = await supabase
    .from('contracts')
    .select('*')
    .eq('id', contractId)
    .maybeSingle();

  if (error) return fail(500, error.message);
  if (!contract) return fail(404, 'That contract does not exist.');

  const isTalent = String(contract.talent_id) === String(actor.talentProfileId || actor.userId);
  const isClient = String(contract.client_id) === String(actor.userId);
  const isParty = actor.kind === 'admin' || isTalent || isClient;

  if (!isParty) return fail(403, 'That contract is not yours.');

  // Each party gets their own document. An operator looking at it sees the
  // client's, which is the one they are usually chasing.
  const audience: 'client' | 'talent' = isTalent ? 'talent' : 'client';

  // Opening it is what records the view, so an unsigned contract can be
  // told apart from one the party never opened. An operator reading it is
  // not the party reading it, so that does not count.
  if (actor.kind !== 'admin') {
    try {
      const { viewContractDocument } = await import('./contractDocumentService');
      await viewContractDocument(actor, { contractId, audience });
    } catch {
      // No contract_documents table yet. The document still renders.
    }
  }

  const document = await contractDocumentFor(contract, audience);

  // Laid out, as well as flat. The portal used to render the raw body in a
  // <pre>, which was fine while every template was plain text and shows a
  // candidate a page of markup now that they are not. The text is still
  // what gets hashed.
  return {
    ok: true,
    status: 200,
    data: { contractId, audience, html: documentToHtml(document.text), ...document } as any
  };
}

/**
 * A candidate's own compliance position: what they must sign, and what they
 * have signed.
 *
 * The dashboard used to decide this in the browser by matching document
 * names, and the signed state lived in React, so it reset on reload.
 */
export async function myComplianceStatus(actor: Actor): Promise<SignatureResult> {
  if (!actor) return fail(401, 'Not authenticated.');
  if (actor.kind !== 'talent') return fail(403, 'Only a candidate has a compliance position.');

  const talentId = String(actor.talentProfileId || actor.userId);
  const supabase = getSupabaseClient();

  const { data: documents, error } = await supabase
    .from('documents')
    .select('id, name, type, is_mandatory, is_template, user_id');

  if (error) return fail(500, error.message);

  const { data: signed } = await supabase
    .from('document_signatures')
    .select('document_id, signed_at')
    .eq('talent_id', talentId);

  const status = complianceStatus(
    talentId,
    (documents || []).map((d: any) => ({
      id: d.id, name: d.name, type: d.type,
      isMandatory: d.is_mandatory, isTemplate: d.is_template, userId: d.user_id
    })),
    (signed || []).map((s: any) => ({
      documentId: s.document_id, talentId, signedAt: s.signed_at
    }))
  );

  return {
    ok: true,
    status: 200,
    data: {
      ...status,
      signedDocumentIds: (signed || []).map((s: any) => String(s.document_id))
    }
  };
}
