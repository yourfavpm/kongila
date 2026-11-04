/**
 * The text a candidate is actually asked to sign.
 *
 * The signing page used to render fifteen identical paragraphs reading
 * "Standard terms and conditions regarding confidentiality, intellectual
 * property, termination, and independent contractor status go here. This
 * text ensures the document is long enough to require scrolling." A
 * candidate scrolled past that and typed their name, and the product
 * recorded a signed agreement whose terms did not exist.
 *
 * Deleting the filler is not enough on its own. What replaces it has to say
 * plainly that the terms have not been issued and stop the signing, which is
 * what `ready` is for.
 *
 * This file imports nothing, so it can be tested on its own.
 */

export interface ContractFacts {
  referenceNumber?: string | null;
  talentName?: string | null;
  clientName?: string | null;
  roleTitle?: string | null;
  monthlyRateUsd?: number | string | null;
  startDate?: string | null;
  endDate?: string | null;
  engagementType?: string | null;
}

export interface ContractDocument {
  /** Whether this may be signed. False means the terms are not there. */
  ready: boolean;
  /** The exact text shown to the signer and hashed on signing. */
  text: string;
  /** Why it cannot be signed, or null. */
  reason: string | null;
}

/** The shortest a real set of terms could plausibly be. */
export const MINIMUM_TERMS_LENGTH = 200;

const FIELDS: Record<string, (f: ContractFacts) => string> = {
  talent_name: f => String(f.talentName || ''),
  client_company: f => String(f.clientName || ''),
  client_name: f => String(f.clientName || ''),
  role_title: f => String(f.roleTitle || ''),
  monthly_rate_usd: f => (f.monthlyRateUsd == null ? '' : String(f.monthlyRateUsd)),
  start_date: f => String(f.startDate || ''),
  end_date: f => String(f.endDate || ''),
  reference_number: f => String(f.referenceNumber || ''),
  engagement_type: f => String(f.engagementType || '')
};

/** Which merge fields a template body uses, in the order they appear. */
export function templateFields(body: string): string[] {
  const found: string[] = [];
  const pattern = /\{\{\s*([a-z0-9_]+)\s*\}\}/gi;
  let match = pattern.exec(body || '');
  while (match) {
    const name = match[1].toLowerCase();
    if (!found.includes(name)) found.push(name);
    match = pattern.exec(body || '');
  }
  return found;
}

/**
 * Fills a template's merge fields.
 *
 * A field with no value is left as its own placeholder rather than replaced
 * with an empty string, so an unfilled contract reads as unfinished instead
 * of as a contract with a blank where the rate should be.
 */
export function renderTemplate(body: string, facts: ContractFacts): string {
  return String(body || '').replace(/\{\{\s*([a-z0-9_]+)\s*\}\}/gi, (whole, raw) => {
    const name = String(raw).toLowerCase();
    const resolve = FIELDS[name];
    if (!resolve) return whole;
    const value = resolve(facts).trim();
    return value || whole;
  });
}

/** Merge fields still unfilled after rendering. */
export function unfilledFields(rendered: string): string[] {
  return templateFields(rendered);
}

/**
 * The cover sheet: the particulars of this engagement.
 *
 * These are real values from the contract row, so they are shown whether or
 * not the terms exist. They are not terms, and on their own they are not
 * signable.
 */
export function contractCoverSheet(facts: ContractFacts): string {
  const lines = [
    'INDEPENDENT CONTRACTOR AGREEMENT',
    '',
    `Reference: ${facts.referenceNumber || 'not yet assigned'}`,
    `Contractor: ${facts.talentName || 'not yet named'}`,
    `Client: ${facts.clientName || 'not yet named'}`,
    `Role: ${facts.roleTitle || 'not yet set'}`,
    `Monthly rate: ${facts.monthlyRateUsd == null ? 'not yet set' : `USD ${facts.monthlyRateUsd}`}`,
    `Start date: ${facts.startDate || 'not yet set'}`
  ];
  if (facts.endDate) lines.push(`End date: ${facts.endDate}`);
  if (facts.engagementType) lines.push(`Engagement: ${facts.engagementType}`);
  return lines.join('\n');
}

/**
 * The document, or an honest refusal.
 *
 * `templateBody` is the published terms for this contract. There is no
 * fallback body: inventing terms to fill the gap is how the filler got there
 * in the first place, and text nobody drafted is worse than no text.
 */
export function buildContractDocument(
  facts: ContractFacts,
  templateBody?: string | null
): ContractDocument {
  const cover = contractCoverSheet(facts);
  const body = String(templateBody || '').trim();

  if (!body) {
    return {
      ready: false,
      text: cover,
      reason: 'The terms of this agreement have not been issued yet, so it cannot be signed. '
            + 'Your account manager will send it once it is ready.'
    };
  }

  const rendered = renderTemplate(body, facts);

  if (rendered.length < MINIMUM_TERMS_LENGTH) {
    return {
      ready: false,
      text: `${cover}\n\n${rendered}`,
      reason: 'The terms attached to this agreement are too short to be a contract, '
            + 'so it cannot be signed yet.'
    };
  }

  const missing = unfilledFields(rendered);
  if (missing.length > 0) {
    return {
      ready: false,
      text: `${cover}\n\n${rendered}`,
      reason: `This agreement is incomplete: ${missing.join(', ')} `
            + `${missing.length === 1 ? 'has' : 'have'} not been filled in. `
            + 'It cannot be signed until it is.'
    };
  }

  return { ready: true, text: `${cover}\n\n${rendered}`, reason: null };
}
