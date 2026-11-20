/**
 * The two documents a contract is made of.
 *
 * Contract generation renders a client document and a candidate document and
 * stores both. Until now nothing read them: the signing path went back to the
 * templates table, re-rendered one generic document, and asked both parties
 * to sign that. So the two-document split existed on paper and could not be
 * signed, and a party could be asked to agree to text that was never
 * generated for them.
 *
 * These rows are the issued documents. One per party, each with its own
 * state, its own sent and viewed times, and its own hash. The contract's
 * status is derived from the pair rather than set by hand.
 *
 * The lifecycle rules live in `@kongila/workflows/contractDocuments`, which
 * imports nothing and is tested on its own. This is the part that talks to
 * the database.
 */

import { createHash } from 'crypto';
import { getSupabaseClient } from './index';
import type { RequestActor as Actor } from './scope';
import { recordAudit } from './audit';
import { notifyUsers } from './notify';
import { parseDocument, documentToText } from '@kongila/contracts';
import { buildContractPdf } from '@kongila/notifications';
import { getSettings } from './settingsService';
import { isAssignedAccountManager } from './invoiceAccess';
import {
  documentTransition,
  contractStatusFromDocuments,
  whoIsOutstanding,
  isVisibleToParty,
  type DocumentAudience,
  type ContractDocumentRow
} from '@kongila/workflows';

export interface ContractDocumentResult<T = any> {
  ok: boolean;
  status: number;
  error?: string;
  data?: T;
  warnings?: string[];
}

function fail(status: number, error: string): ContractDocumentResult {
  return { ok: false, status, error };
}

/** True when the error is this table or column not being there yet. */
function missingSchema(error: any): boolean {
  const message = String(error?.message || '');
  return /does not exist/i.test(message)
    || /schema cache/i.test(message)
    || error?.code === '42P01'
    || error?.code === '42703';
}

/**
 * The hash of a document as issued.
 *
 * Line endings normalised and trailing whitespace trimmed, so the same
 * agreement does not hash differently on Windows and Linux. Nothing else
 * changes: any difference in the words produces a different hash.
 */
export function hashBody(text: string): string {
  const normalised = String(text || '').replace(/\r\n/g, '\n').replace(/[ \t]+$/gm, '').trim();
  return createHash('sha256').update(normalised, 'utf8').digest('hex');
}

function toRow(row: any): ContractDocumentRow & Record<string, any> {
  return {
    id: String(row.id),
    contractId: String(row.contract_id),
    audience: String(row.audience) as DocumentAudience,
    body: row.body || '',
    templateId: row.template_id || null,
    templateVersion: row.template_version ?? null,
    documentHash: row.document_hash || null,
    status: row.status || 'draft',
    sentAt: row.sent_at || null,
    sentBy: row.sent_by || null,
    viewedAt: row.viewed_at || null,
    signedAt: row.signed_at || null,
    signatureId: row.signature_id || null,
    voidReason: row.void_reason || null
  };
}

/**
 * Creates the two documents for a contract that has just been generated.
 *
 * As drafts. Generating a contract and sending it to both parties are two
 * decisions, and collapsing them is how an operator discovers a typo after
 * the client has already read it.
 *
 * Safe to call again: a contract that already has its documents is left
 * alone, because the issued text is what somebody may already have signed.
 */
export async function createContractDocuments(
  actor: Actor,
  input: {
    contractId: string;
    clientBody: string;
    talentBody?: string | null;
    clientTemplateId?: string | null;
    talentTemplateId?: string | null;
  }
): Promise<ContractDocumentResult> {
  if (!input.contractId) return fail(400, 'Which contract?');

  const supabase = getSupabaseClient();

  const { data: existing, error: readError } = await supabase
    .from('contract_documents')
    .select('id, audience')
    .eq('contract_id', String(input.contractId));

  if (readError) {
    if (missingSchema(readError)) {
      return {
        ok: true, status: 200, data: { created: 0 },
        warnings: ['This database has no contract_documents table yet, so the two documents were '
          + 'not issued separately. Run the 2026-11-20b migration.']
      };
    }
    return fail(500, readError.message);
  }

  const have = new Set((existing || []).map((row: any) => String(row.audience)));
  const now = new Date().toISOString();
  const rows: any[] = [];

  if (!have.has('client') && String(input.clientBody || '').trim()) {
    rows.push({
      contract_id: String(input.contractId),
      audience: 'client',
      body: input.clientBody,
      template_id: input.clientTemplateId || null,
      document_hash: hashBody(input.clientBody),
      status: 'draft',
      created_at: now,
      updated_at: now
    });
  }

  if (!have.has('talent') && String(input.talentBody || '').trim()) {
    rows.push({
      contract_id: String(input.contractId),
      audience: 'talent',
      body: input.talentBody,
      template_id: input.talentTemplateId || null,
      document_hash: hashBody(String(input.talentBody)),
      status: 'draft',
      created_at: now,
      updated_at: now
    });
  }

  if (rows.length === 0) return { ok: true, status: 200, data: { created: 0 } };

  const { error } = await supabase.from('contract_documents').insert(rows);
  if (error) {
    if (missingSchema(error)) {
      return {
        ok: true, status: 200, data: { created: 0 },
        warnings: ['This database has no contract_documents table yet, so the two documents were '
          + 'not issued separately. Run the 2026-11-20b migration.']
      };
    }
    return fail(500, `The contract documents were not created: ${error.message}`);
  }

  return { ok: true, status: 201, data: { created: rows.length } };
}

/** Every document on a contract, with who is still outstanding. */
export async function listContractDocuments(
  actor: Actor,
  contractId: string
): Promise<ContractDocumentResult> {
  if (!actor) return fail(401, 'Not authenticated.');
  if (!contractId) return fail(400, 'Which contract?');

  const supabase = getSupabaseClient();

  const { data: contract } = await supabase
    .from('contracts')
    .select('id, client_id, talent_id, status, start_date')
    .eq('id', String(contractId))
    .maybeSingle();

  if (!contract) return fail(404, 'That contract does not exist.');
  if (actor.kind === 'admin' && actor.role === 'account_manager'
      && !(await isAssignedAccountManager(actor, String(contract.client_id || '')))) {
    return fail(403, 'You can access contracts only for client accounts assigned to you.');
  }

  const isParty = actor.kind === 'admin'
    || String(contract.talent_id) === String(actor.talentProfileId || actor.userId)
    || String(contract.client_id) === String(actor.userId);
  if (!isParty) return fail(403, 'That contract is not yours.');

  const { data, error } = await supabase
    .from('contract_documents')
    .select('*')
    .eq('contract_id', String(contractId));

  if (error) {
    if (missingSchema(error)) {
      return {
        ok: true, status: 200,
        data: { documents: [], outstanding: null, derivedStatus: contract.status },
        warnings: ['Contract documents are not set up on this database yet. '
          + 'Run the 2026-11-20b migration.']
      };
    }
    return fail(500, error.message);
  }

  const documents = (data || []).map(toRow);

  // A party sees their own document and whether the other side has signed,
  // never the other side's text: the client's document carries the service
  // fee and the candidate's carries their pay, and showing either to the
  // other party is how a candidate learns the margin.
  const visible = actor.kind === 'admin'
    ? documents
    : documents.map((row: any) => {
      const mine = actor.kind === 'talent' ? row.audience === 'talent' : row.audience === 'client';
      return mine ? row : { ...row, body: '', documentHash: null };
    });

  const startsInFuture = Boolean(
    contract.start_date && new Date(contract.start_date).getTime() > Date.now()
  );

  return {
    ok: true,
    status: 200,
    data: {
      contractId: String(contractId),
      documents: visible,
      outstanding: whoIsOutstanding(documents),
      derivedStatus: contractStatusFromDocuments(documents, { startsInFuture })
    }
  };
}

/**
 * Recomputes the contract's status from its documents and saves it.
 *
 * Called after anything that changes a document. Derived rather than set,
 * so the contract cannot claim to be fully signed while one of its documents
 * is sitting in draft.
 */
export async function syncContractStatus(contractId: string): Promise<string | null> {
  const supabase = getSupabaseClient();

  const { data: contract } = await supabase
    .from('contracts')
    .select('id, status, start_date')
    .eq('id', String(contractId))
    .maybeSingle();

  if (!contract) return null;

  // These are terminal from the contract's point of view and are not
  // something a document state should reopen.
  if (['ended', 'terminated', 'closed'].includes(String(contract.status))) {
    return String(contract.status);
  }

  const { data, error } = await supabase
    .from('contract_documents')
    .select('audience, status, sent_at, viewed_at, signed_at')
    .eq('contract_id', String(contractId));

  if (error || !data || data.length === 0) return String(contract.status);

  const startsInFuture = Boolean(
    contract.start_date && new Date(contract.start_date).getTime() > Date.now()
  );

  const next = contractStatusFromDocuments(
    data.map((row: any) => ({
      audience: row.audience,
      status: row.status,
      sentAt: row.sent_at,
      viewedAt: row.viewed_at,
      signedAt: row.signed_at
    })),
    { startsInFuture }
  );

  if (next === String(contract.status)) return next;

  const patch: Record<string, any> = { status: next };
  if (next === 'active' || next === 'fully_signed') {
    const signedAt = data
      .map((row: any) => row.signed_at)
      .filter(Boolean)
      .sort()
      .pop();
    if (signedAt) patch.signed_at = signedAt;
  }

  await supabase.from('contracts').update(patch).eq('id', String(contractId));
  return next;
}

/**
 * Sends a document to its party.
 *
 * One party at a time on purpose. The two documents are different texts and
 * are often ready at different moments, and "send the client's while the
 * candidate's wording is still being checked" is a normal thing to want.
 *
 * The hash is taken at the moment of sending, so a later edit to the body is
 * visible as a change to text somebody has already been shown.
 */
export async function sendContractDocument(
  actor: Actor,
  input: { contractId: string; audience: DocumentAudience; resend?: boolean }
): Promise<ContractDocumentResult> {
  if (!actor) return fail(401, 'Not authenticated.');
  if (actor.kind !== 'admin') return fail(403, 'Only Kongila sends a contract out.');
  const held = Array.isArray(actor.permissions) ? actor.permissions : [];
  if (!held.includes('contracts.manage')) {
    return fail(403, 'Your role cannot send a contract out.');
  }
  if (!input.contractId) return fail(400, 'Which contract?');
  if (!['client', 'talent'].includes(String(input.audience))) {
    return fail(400, 'A contract document goes either to the client or to the candidate.');
  }

  const supabase = getSupabaseClient();

  const { data: contract } = await supabase
    .from('contracts')
    .select('id, client_id, talent_id, status, role_title')
    .eq('id', String(input.contractId))
    .maybeSingle();

  if (!contract) return fail(404, 'That contract does not exist.');
  if (actor.role === 'account_manager'
      && !(await isAssignedAccountManager(actor, String(contract.client_id || '')))) {
    return fail(403, 'You can send contracts only for client accounts assigned to you.');
  }
  if (['ended', 'terminated', 'closed'].includes(String(contract.status))) {
    return fail(409, `This contract is ${contract.status} and cannot be sent.`);
  }

  const { data: row, error: readError } = await supabase
    .from('contract_documents')
    .select('*')
    .eq('contract_id', String(input.contractId))
    .eq('audience', String(input.audience))
    .maybeSingle();

  if (readError && missingSchema(readError)) {
    return fail(503, 'This database has not had the 2026-11-20b contract documents migration run '
      + 'against it yet, so documents cannot be sent separately. Run it and try again.');
  }
  if (!row) {
    return fail(404, input.audience === 'talent'
      ? 'This contract has no candidate document. Generate it again once a candidate template is published.'
      : 'This contract has no client document.');
  }

  const current = String(row.status || 'draft');

  // Re-sending a document the party already has is a reminder, not a state
  // change, so it is allowed and says so.
  const isReminder = ['sent', 'viewed'].includes(current);
  if (!isReminder) {
    const move = documentTransition(current, 'sent');
    if (!move.ok) return fail(409, move.error as string);
  }

  const now = new Date().toISOString();
  const hash = hashBody(row.body || '');

  const { error } = await supabase
    .from('contract_documents')
    .update({
      status: isReminder ? current : 'sent',
      document_hash: hash,
      sent_at: isReminder ? row.sent_at : now,
      sent_by: actor.userId,
      updated_at: now
    })
    .eq('id', row.id);

  if (error) return fail(500, `That document was not sent: ${error.message}`);

  await syncContractStatus(String(input.contractId));

  const recipient = input.audience === 'talent' ? contract.talent_id : contract.client_id;
  const warnings: string[] = [];
  if (recipient) {
    const sent = await notifyUsers(recipient, 'contract_ready', {
      reason: isReminder
        ? `A reminder: your contract for ${contract.role_title || 'this engagement'} is waiting for your signature.`
        : undefined
    });
    warnings.push(...sent.warnings);
  } else {
    warnings.push('The document is marked sent, but there is nobody on the contract to notify.');
  }

  await recordAudit(actor, {
    action: isReminder ? 'Chase Contract Signature' : 'Send Contract Document',
    details: `${input.audience === 'talent' ? 'Candidate' : 'Client'} document `
      + `${isReminder ? 'reminder sent' : 'sent'} for contract ${input.contractId}.`,
    entityType: 'contract',
    entityId: String(input.contractId)
  });

  return {
    ok: true,
    status: 200,
    data: { contractId: String(input.contractId), audience: input.audience, reminder: isReminder },
    warnings
  };
}

/**
 * The document a party is entitled to see, and records that they saw it.
 *
 * Reading it is what moves it from sent to viewed. That is the only way to
 * know whether a signature is late because the party is thinking about it or
 * because the email went to spam, which is a different conversation.
 */
export async function viewContractDocument(
  actor: Actor,
  input: { contractId: string; audience?: DocumentAudience }
): Promise<ContractDocumentResult> {
  if (!actor) return fail(401, 'Not authenticated.');
  if (!input.contractId) return fail(400, 'Which contract?');

  const supabase = getSupabaseClient();

  const { data: contract } = await supabase
    .from('contracts')
    .select('*')
    .eq('id', String(input.contractId))
    .maybeSingle();

  if (!contract) return fail(404, 'That contract does not exist.');

  const isTalent = String(contract.talent_id) === String(actor.talentProfileId || actor.userId);
  const isClient = String(contract.client_id) === String(actor.userId);

  // A party always gets their own document whatever they ask for. Only an
  // operator may name one, and only because they can see both.
  const audience: DocumentAudience = actor.kind === 'admin'
    ? ((input.audience === 'talent' ? 'talent' : 'client') as DocumentAudience)
    : isTalent ? 'talent' : 'client';

  if (actor.kind !== 'admin' && !isTalent && !isClient) {
    return fail(403, 'That contract is not yours.');
  }

  const { data: row, error } = await supabase
    .from('contract_documents')
    .select('*')
    .eq('contract_id', String(input.contractId))
    .eq('audience', audience)
    .maybeSingle();

  if (error && missingSchema(error)) {
    return {
      ok: true, status: 200,
      data: { contractId: String(input.contractId), audience, body: null, status: null },
      warnings: ['Contract documents are not set up on this database yet. '
        + 'Run the 2026-11-20b migration.']
    };
  }

  if (!row) return fail(404, 'There is no document for you on this contract yet.');

  // A party cannot read a draft. It has not been issued to them.
  if (actor.kind !== 'admin' && !isVisibleToParty(toRow(row))) {
    return fail(409, 'This contract has not been sent to you yet.');
  }

  // First open, by the party it belongs to. An operator looking at it is not
  // the party reading it, so it does not count.
  if (actor.kind !== 'admin' && String(row.status) === 'sent') {
    const now = new Date().toISOString();
    await supabase
      .from('contract_documents')
      .update({ status: 'viewed', viewed_at: now, updated_at: now })
      .eq('id', row.id);
    row.status = 'viewed';
    row.viewed_at = now;
  }

  return { ok: true, status: 200, data: { ...toRow(row), contractId: String(input.contractId) } };
}

/**
 * Withdraws a document that has not been signed.
 *
 * What to do when the terms were wrong. The signed one, if there is one,
 * stays exactly as it is: a signature attests to text that existed, and
 * tidying it away afterwards is the one thing an audit trail must not do.
 */
export async function voidContractDocument(
  actor: Actor,
  input: { contractId: string; audience: DocumentAudience; reason: string }
): Promise<ContractDocumentResult> {
  if (!actor) return fail(401, 'Not authenticated.');
  if (actor.kind !== 'admin') return fail(403, 'Only Kongila withdraws a contract document.');
  const held = Array.isArray(actor.permissions) ? actor.permissions : [];
  if (!held.includes('contracts.manage')) return fail(403, 'Your role cannot withdraw a contract.');

  const reason = String(input.reason || '').trim();
  if (!reason) return fail(422, 'Say why the document is being withdrawn.');

  const supabase = getSupabaseClient();

  const { data: row } = await supabase
    .from('contract_documents')
    .select('*')
    .eq('contract_id', String(input.contractId))
    .eq('audience', String(input.audience))
    .maybeSingle();

  if (!row) return fail(404, 'There is no such document on that contract.');

  const move = documentTransition(String(row.status || 'draft'), 'void');
  if (!move.ok) return fail(409, move.error as string);

  const now = new Date().toISOString();
  const { error } = await supabase
    .from('contract_documents')
    .update({ status: 'void', void_reason: reason, updated_at: now })
    .eq('id', row.id);

  if (error) return fail(500, error.message);

  await syncContractStatus(String(input.contractId));

  await recordAudit(actor, {
    action: 'Withdraw Contract Document',
    details: `${input.audience === 'talent' ? 'Candidate' : 'Client'} document withdrawn: ${reason}`,
    entityType: 'contract',
    entityId: String(input.contractId)
  });

  return { ok: true, status: 200, data: { contractId: String(input.contractId), audience: input.audience } };
}


/**
 * A contract document as a PDF.
 *
 * The thing a party was asked to sign could not be kept, printed or sent to
 * a lawyer: it existed as text in a column, shown in a scrolling div. This
 * is the same words, laid out as a document, with the signature block and
 * the hash of what was signed in the footer.
 *
 * A party gets their own; an operator may ask for either, because they can
 * see both anyway.
 */
export async function getContractDocumentPdf(
  actor: Actor,
  input: { contractId: string; audience?: DocumentAudience }
): Promise<ContractDocumentResult<{ filename: string; pdf: Buffer }>> {
  if (!actor) return fail(401, 'Not authenticated.');
  if (!input.contractId) return fail(400, 'Which contract?');

  const supabase = getSupabaseClient();

  const { data: contract } = await supabase
    .from('contracts')
    .select('*')
    .eq('id', String(input.contractId))
    .maybeSingle();

  if (!contract) return fail(404, 'That contract does not exist.');

  const isTalent = String(contract.talent_id) === String(actor.talentProfileId || actor.userId);
  const isClient = String(contract.client_id) === String(actor.userId);
  if (actor.kind !== 'admin' && !isTalent && !isClient) {
    return fail(403, 'That contract is not yours.');
  }

  const audience: DocumentAudience = actor.kind === 'admin'
    ? ((input.audience === 'talent' ? 'talent' : 'client') as DocumentAudience)
    : isTalent ? 'talent' : 'client';

  let row: any = null;
  try {
    const { data } = await supabase
      .from('contract_documents')
      .select('*')
      .eq('contract_id', String(input.contractId))
      .eq('audience', audience)
      .maybeSingle();
    row = data || null;
  } catch {
    row = null;
  }

  // A party cannot download a draft. It has not been issued to them.
  if (row && actor.kind !== 'admin' && !isVisibleToParty(toRow(row))) {
    return fail(409, 'This contract has not been sent to you yet.');
  }

  const body = row?.body
    || (audience === 'talent' ? contract.talent_contract_body : contract.client_contract_body);

  if (!body || !String(body).trim()) {
    return fail(404, audience === 'talent'
      ? 'This contract has no candidate document.'
      : 'This contract has no client document.');
  }

  // Signatures, so an executed contract carries who signed and when rather
  // than two blank lines.
  const { data: signatures } = await supabase
    .from('contract_signatures')
    .select('signer_role, signer_name, signed_at')
    .eq('contract_id', String(input.contractId));

  const signatureFor = (role: string) =>
    (signatures || []).find((entry: any) => String(entry.signer_role) === role);

  const longDate = (value?: string | null) => {
    if (!value) return null;
    const date = new Date(value);
    return Number.isFinite(date.getTime())
      ? date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
      : null;
  };

  const settings = await getSettings().catch(() => ({} as Record<string, any>));
  const setting = (key: string): string => {
    const value = (settings as any)?.[key];
    return value == null ? '' : String(value).replace(/^"|"$/g, '');
  };

  const clientSignature = signatureFor('client');
  const talentSignature = signatureFor('talent');
  const signed = Boolean(clientSignature && talentSignature);

  const subtitleParts = [
    contract.client_name || contract.client_company,
    contract.role_title || contract.role,
    contract.start_date ? `from ${longDate(contract.start_date)}` : null
  ].filter(Boolean);

  const pdf = buildContractPdf({
    title: audience === 'talent' ? 'Contractor Agreement' : 'Services Agreement',
    reference: contract.reference_number || contract.id,
    subtitle: subtitleParts.join(' \u00b7 '),
    blocks: parseDocument(String(body)),
    issuerName: setting('contracting_entity_name') || 'Kongila',
    issuerAddress: setting('contracting_entity_address') || null,
    documentHash: row?.document_hash || contract.document_hash || null,
    draft: !signed,
    parties: audience === 'talent'
      ? [
        {
          role: 'The Contractor',
          name: contract.talent_name || '',
          signedBy: talentSignature?.signer_name || null,
          signedAt: longDate(talentSignature?.signed_at)
        },
        { role: 'For Kongila', name: setting('contracting_entity_name') || 'Kongila' }
      ]
      : [
        {
          role: 'For the Client',
          name: contract.client_name || contract.client_company || '',
          signedBy: clientSignature?.signer_name || null,
          signedAt: longDate(clientSignature?.signed_at)
        },
        { role: 'For Kongila', name: setting('contracting_entity_name') || 'Kongila' }
      ]
  });

  const reference = String(contract.reference_number || contract.id).replace(/[^A-Za-z0-9_-]+/g, '-');
  return {
    ok: true,
    status: 200,
    data: {
      filename: `${reference}-${audience === 'talent' ? 'contractor' : 'services'}-agreement.pdf`,
      pdf
    }
  };
}

/** The document as plain text, for hashing and for email. */
export function documentBodyToText(body: string): string {
  return documentToText(body);
}
