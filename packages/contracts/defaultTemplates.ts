/**
 * The contract templates the platform ships with.
 *
 * The template manager had an editor, drafts, publishing and version
 * bumping, and nothing to edit: the table was empty, so the service-type
 * dropdown on the contract form had no template to offer and every contract
 * was generated from two hardcoded strings in `packages/contracts/index.ts`.
 * Those two named different companies (KONGILA EOR SYSTEMS LTD in one,
 * KONGILA TALENT DEPLOYMENT LLC in the other), referenced Remotan, and
 * between them carried no IP assignment, no termination, no liability, no
 * data protection and no governing law.
 *
 * These are the replacement. Four templates, one per service line, because
 * the four lines are different agreements: a placement hands somebody over
 * and ends, an outsourcing contract runs monthly, a managed team is bought
 * by the seat, and a project is bought by the deliverable.
 *
 * They are restored as DRAFTS, never as published. They are a structure and
 * a complete clause set, not legal advice, and the person restoring them is
 * told to have them reviewed before anybody signs one. Publishing is a
 * separate, deliberate action.
 *
 * Every variable is a {{token}} filled in at generation. No company name is
 * hardcoded: {{contracting_entity}} comes from platform settings, so there
 * is one answer to which company is contracting rather than two.
 *
 * This file imports nothing, so it can be tested on its own.
 */

export interface TemplateToken {
  token: string;
  label: string;
  /** What it resolves to, for the editor's help panel. */
  example: string;
  /** Lines this token appears on. Empty means all of them. */
  serviceLines?: string[];
}

/** Everything a template may refer to. The editor lists these. */
export const TEMPLATE_TOKENS: TemplateToken[] = [
  { token: 'contracting_entity', label: 'Kongila legal entity', example: 'Kongila EOR Systems Ltd' },
  { token: 'entity_address', label: 'Kongila registered address', example: 'Lagos, Nigeria' },
  { token: 'client_name', label: 'Client company', example: 'Horizon Fintech Ltd' },
  { token: 'client_country', label: 'Client country', example: 'United Kingdom' },
  { token: 'talent_name', label: 'Candidate', example: 'Ada Okafor' },
  { token: 'talent_country', label: 'Candidate country', example: 'Nigeria' },
  { token: 'role_title', label: 'Role', example: 'Senior Backend Engineer' },
  { token: 'start_date', label: 'Start date', example: '1 February 2026' },
  { token: 'end_date', label: 'End date', example: '31 January 2027' },
  { token: 'currency', label: 'Currency', example: 'USD' },
  { token: 'rate_amount', label: 'Rate', example: '4,500' },
  { token: 'rate_type', label: 'Rate basis', example: 'Monthly' },
  { token: 'payment_terms', label: 'Payment terms', example: '14 days from invoice' },
  { token: 'notice_period', label: 'Notice period', example: '30 days' },
  { token: 'governing_law', label: 'Governing law', example: 'the laws of England and Wales' },
  { token: 'today', label: "Today's date", example: '19 November 2026' },
  { token: 'annual_salary', label: 'Annual salary', example: '60,000', serviceLines: ['placement'] },
  { token: 'placement_fee', label: 'Placement fee', example: '9,000', serviceLines: ['placement'] },
  { token: 'guarantee_period', label: 'Replacement guarantee', example: '90 days', serviceLines: ['placement'] },
  { token: 'seats', label: 'Seats', example: '8', serviceLines: ['managed_workforce'] },
  { token: 'coverage', label: 'Coverage model', example: 'Business hours, Monday to Friday', serviceLines: ['managed_workforce'] },
  { token: 'supervisor_name', label: 'Kongila supervisor', example: 'Chidi Nwosu', serviceLines: ['managed_workforce', 'outsourcing'] },
  { token: 'project_name', label: 'Project', example: 'Payments migration', serviceLines: ['project'] },
  { token: 'project_fee', label: 'Project fee', example: '40,000', serviceLines: ['project'] },
  { token: 'deliverables', label: 'Deliverables and milestones', example: 'See Schedule 1', serviceLines: ['project'] },

  // ── The candidate's side ────────────────────────────────────────────────
  { token: 'talent_pay', label: 'What the candidate is paid', example: '4,050' },
  { token: 'talent_commission_pct', label: 'Kongila commission %', example: '10' },
  { token: 'pay_frequency', label: 'How often they are paid', example: 'Monthly' },
  { token: 'payday', label: 'Payday', example: 'the 28th of each month' },
  { token: 'first_payday', label: 'First payday', example: '28 February 2026' },
  { token: 'reports_to', label: 'Who they report to', example: 'the client\'s engineering lead' },
  { token: 'working_pattern', label: 'Working pattern', example: 'Full time, client business hours' },
  { token: 'notice_period_talent', label: 'Candidate notice period', example: '30 days' }
];

/** The clauses every one of the four shares, so they cannot drift apart. */
const COMMON_CLAUSES = `
8. CONFIDENTIALITY
   Each party shall keep confidential all non-public information of the other
   party and of any third party disclosed under this Agreement, and shall use
   it only to perform this Agreement. This obligation survives termination by
   three (3) years. It does not apply to information that is public through no
   breach of this clause, was lawfully held before disclosure, or must be
   disclosed by law or a competent authority.

9. INTELLECTUAL PROPERTY
   All work product created in the performance of this Agreement vests in
   {{client_name}} on creation, and {{contracting_entity}} assigns, and shall
   procure the assignment of, all such rights to {{client_name}} with full
   title guarantee. Each party retains ownership of its pre-existing material,
   and grants the other a non-exclusive licence to use that material only so
   far as is necessary to perform this Agreement.

10. DATA PROTECTION
    Each party shall comply with the data protection law applicable to it. Where
    {{contracting_entity}} processes personal data on behalf of {{client_name}},
    it shall do so only on documented instructions, impose confidentiality on
    those with access, apply appropriate technical and organisational measures,
    assist with data subject requests, and delete or return the data at the end
    of this Agreement. Neither party shall transfer personal data across a
    border without a lawful transfer mechanism.

11. WARRANTIES
    {{contracting_entity}} warrants that the services shall be performed with
    reasonable skill and care by personnel who are suitably qualified and
    entitled to work as required. {{client_name}} warrants that it has the
    authority to enter this Agreement and shall provide the access, systems and
    information the services reasonably require.

12. LIABILITY
    Neither party excludes liability for death or personal injury caused by its
    negligence, for fraud, or for anything else that cannot lawfully be
    excluded. Subject to that, neither party is liable for loss of profit,
    revenue, goodwill or anticipated savings, or for indirect or consequential
    loss, and each party's total liability in any twelve (12) month period is
    limited to the fees paid or payable under this Agreement in that period.

13. TERMINATION
    Either party may terminate this Agreement on {{notice_period}} written
    notice. Either party may terminate immediately on written notice if the
    other commits a material breach that is not remedied within fourteen (14)
    days of notice of it, or becomes insolvent. Termination does not affect any
    right or liability accrued before it, and fees earned up to the termination
    date remain payable.

14. NON-SOLICITATION
    {{client_name}} shall not, during this Agreement and for six (6) months
    after it ends, engage directly any person introduced by
    {{contracting_entity}} other than through {{contracting_entity}}, except on
    terms agreed in writing.

15. STATUS OF THE PARTIES
    Nothing in this Agreement creates a partnership, joint venture or
    employment relationship between {{client_name}} and {{contracting_entity}}.
    Each party is an independent contractor acting on its own account.

16. GENERAL
    This Agreement is the entire agreement between the parties on its subject
    matter and replaces anything said or written before it. A variation is
    effective only in writing and signed by both parties. A failure to enforce
    a term is not a waiver of it. If a term is unenforceable the rest stands.
    Nobody other than the parties may enforce this Agreement.

17. GOVERNING LAW
    This Agreement and any dispute arising from it is governed by
    {{governing_law}}, and the parties submit to the exclusive jurisdiction of
    its courts.

SIGNED

For {{contracting_entity}}                 For {{client_name}}

Name: ______________________              Name: ______________________
Title: _____________________              Title: _____________________
Date: {{today}}                           Date: ______________________
`.trim();

/**
 * The clauses every candidate-facing agreement shares.
 *
 * Deliberately a different set from the client's. A candidate needs to know
 * what they are paid, when, what is deducted and by whom they are managed.
 * A client needs to know what the service costs and what happens if it goes
 * wrong. Putting both in one document means each party reads terms that are
 * not theirs, and the candidate learns the margin.
 */
const TALENT_COMMON_CLAUSES = `
6. CONFIDENTIALITY
   You shall keep confidential all non-public information of Kongila and of
   the client, and use it only to do the work. This survives the end of this
   Agreement by three (3) years and applies to anything you are given access
   to, including systems, documents, data and the identities of the client's
   own customers.

7. INTELLECTUAL PROPERTY
   Everything you create in doing this work belongs to the client on
   creation. You assign all such rights with full title guarantee and shall
   sign anything reasonably needed to confirm it. You keep what you made
   before this engagement, and grant a licence to use it where the work
   needs it.

8. DATA PROTECTION AND SECURITY
   You shall handle personal data only as instructed, keep it on approved
   systems, and tell Kongila immediately if you lose a device, suspect a
   breach, or send something to the wrong person. Do not copy client data to
   personal storage.

9. CONDUCT
   You shall do the work with reasonable skill and care, keep to the agreed
   working pattern, tell Kongila as soon as you know about planned leave or
   anything that will stop you working, and raise a blocker rather than let
   a deadline pass quietly.

10. STATUS
    You are engaged by {{contracting_entity}} as an independent contractor,
    not as an employee of the client. Nothing here makes you an employee of
    either party. You are responsible for your own taxes and filings where
    you live, and Kongila shall give you whatever record of payment you need
    for them.

11. NO DIRECT ENGAGEMENT
    During this Agreement and for six (6) months after it ends, you shall not
    contract directly with the client for work of this kind other than
    through Kongila, unless Kongila agrees in writing.

12. LIABILITY
    Neither you nor Kongila excludes liability for death or personal injury
    caused by negligence, or for fraud. Subject to that, your liability to
    Kongila in any twelve (12) month period is limited to the fees paid to
    you in that period, except where loss arises from your wilful misconduct,
    a breach of confidentiality, or a breach of clause 8. Kongila's liability
    to you is limited to fees owed to you.

13. TERMINATION
    Either party may end this Agreement on {{notice_period_talent}} written
    notice. Kongila may end it immediately for a material breach that is not
    put right within fourteen (14) days of notice. You are paid for work done
    up to the end date, on the normal payday.

14. GENERAL
    This is the entire agreement between you and Kongila on its subject
    matter. A change is effective only in writing. This Agreement is governed
    by {{governing_law}}.

SIGNED

For {{contracting_entity}}                 The contractor

Name: ______________________              Name: {{talent_name}}
Title: _____________________              Signature: _________________
Date: {{today}}                           Date: ______________________
`.trim();

function header(title: string): string {
  return `${title}

This Agreement is made on {{today}} between:

(1) {{contracting_entity}} of {{entity_address}} ("Kongila"); and
(2) {{client_name}} of {{client_country}} (the "Client").
`;
}

/**
 * Who a template is written to.
 *
 * Every engagement produces two documents, not one. The client signs an
 * agreement with Kongila about the service; the candidate signs a different
 * agreement with Kongila about the work and the pay. Sending either party
 * the other's document is how a candidate learns the client's margin.
 */
export type TemplateAudience = 'client' | 'talent';

function talentHeader(title: string): string {
  return `${title}

This Agreement is made on {{today}} between:

(1) {{contracting_entity}} of {{entity_address}} ("Kongila"); and
(2) {{talent_name}} of {{talent_country}} ("you").
`;
}

export interface DefaultTemplate {
  /** Stable key, so restoring twice does not create a second copy. */
  key: string;
  name: string;
  serviceType: string;
  audience: TemplateAudience;
  body: string;
}

export const DEFAULT_CONTRACT_TEMPLATES: DefaultTemplate[] = [
  {
    key: 'standard-placement',
    audience: 'client' as const,
    name: 'Standard direct hire (placement) agreement',
    serviceType: 'placement',
    body: `${header('RECRUITMENT SERVICES AGREEMENT — DIRECT HIRE')}
1. WHAT THIS COVERS
   Kongila introduces {{talent_name}} of {{talent_country}} to the Client for
   the role of {{role_title}}. If the Client engages that person, the Client
   employs them directly and Kongila has no part in the engagement after the
   introduction. Kongila is not the employer and does not pay the person.

2. THE FEE
   The Client shall pay Kongila a placement fee of {{currency}}
   {{placement_fee}}, calculated on an expected annual salary of {{currency}}
   {{annual_salary}}. The fee is invoiced when the contract is issued and is
   payable within {{payment_terms}}.

3. WHEN THE ENGAGEMENT STARTS
   The engagement is confirmed once the placement fee has been paid and the
   candidate has accepted. The expected start date is {{start_date}}.

4. REPLACEMENT GUARANTEE
   If the person leaves or is dismissed for cause within {{guarantee_period}}
   of starting, Kongila shall, at the Client's request and once the invoice is
   settled, source a replacement at no further placement fee. The guarantee
   does not apply where the role has materially changed, where the Client has
   made the position redundant, or where fees are outstanding.

5. WHAT THE CLIENT MUST DO
   The Client shall tell Kongila promptly when an introduced candidate is
   offered a role, when an offer is accepted, and the agreed salary. The fee is
   payable on any engagement of an introduced candidate within twelve (12)
   months of the introduction, whether or not it came through Kongila.

6. REFERENCES AND RIGHT TO WORK
   Kongila carries out the vetting described in its service description.
   Verifying the right to work and carrying out any further checks the role
   requires is the Client's responsibility as the employer.

7. NO ONGOING MANAGEMENT
   For the avoidance of doubt, Kongila does not supervise, pay, invoice for or
   manage the person after the engagement begins.

${COMMON_CLAUSES}`
  },

  {
    key: 'standard-outsourcing',
    audience: 'client' as const,
    name: 'Standard outsourcing agreement',
    serviceType: 'outsourcing',
    body: `${header('OUTSOURCING SERVICES AGREEMENT')}
1. WHAT THIS COVERS
   Kongila provides the services of {{talent_name}} of {{talent_country}} to
   the Client as {{role_title}}, from {{start_date}}${''} until {{end_date}} or
   until terminated under clause 13.

2. WHO MANAGES THE WORK
   Day-to-day direction is as recorded in the engagement record for this
   contract. Where Kongila supervises, the named supervisor is
   {{supervisor_name}} and the Client raises matters with them rather than with
   the individual. Where the Client directs the work, Kongila remains
   responsible for the contractual relationship, payment and compliance.

3. CHARGES
   The Client shall pay {{currency}} {{rate_amount}} {{rate_type}}, invoiced
   monthly in arrears. Payment terms are {{payment_terms}}. Where an invoice is
   payable in instalments, the instalment dates are stated on it. A part month
   is charged pro rata by days.

4. THE PERSON
   {{talent_name}} is engaged by Kongila, not by the Client. Kongila is
   responsible for paying them and for the deductions and filings that apply
   where they are resident. The Client shall not make any payment directly to
   them.

5. HOURS, LEAVE AND ABSENCE
   The agreed working pattern is as recorded for this engagement. Kongila shall
   tell the Client of planned leave with reasonable notice and of unplanned
   absence as soon as it knows. Extended absence may be charged pro rata or
   covered, as the parties agree at the time.

6. REPLACEMENT
   If the Client is dissatisfied on reasonable grounds, it shall tell Kongila,
   and Kongila shall have fourteen (14) days to address it before the Client
   may request a replacement. Kongila shall then source a replacement without a
   further onboarding charge.

7. EQUIPMENT AND ACCESS
   The Client shall provide the systems access the work requires. Each party is
   responsible for the equipment it supplies and for keeping its own systems
   secure.

${COMMON_CLAUSES}`
  },

  {
    key: 'standard-managed-workforce',
    audience: 'client' as const,
    name: 'Standard managed team agreement',
    serviceType: 'managed_workforce',
    body: `${header('MANAGED SERVICES AGREEMENT — MANAGED TEAM')}
1. WHAT THIS COVERS
   Kongila provides a managed team of {{seats}} seats performing
   {{role_title}}, from {{start_date}} until {{end_date}} or until terminated
   under clause 13. The Client buys an outcome and a level of cover, not named
   individuals.

2. HOW IT IS RUN
   Kongila manages the team day to day, including supervision, scheduling,
   quality and cover for absence. The named Kongila lead is
   {{supervisor_name}}. The Client raises everything through the lead.

3. COVER
   The agreed coverage model is {{coverage}}. Kongila shall maintain the agreed
   number of seats and arrange cover for planned and unplanned absence at no
   extra charge.

4. SUBSTITUTION
   Kongila may change who fills a seat, provided the replacement is suitably
   qualified and the change does not reduce the service. The Client may not
   direct who fills a seat.

5. CHARGES
   The Client shall pay {{currency}} {{rate_amount}} per seat {{rate_type}} for
   {{seats}} seats, invoiced monthly in arrears on a single invoice carrying a
   line per seat. Payment terms are {{payment_terms}}. Seats added or removed
   mid-month are charged pro rata by days.

6. CHANGING THE TEAM SIZE
   Either party may request a change in the number of seats on thirty (30)
   days' written notice. A change takes effect from the start of the next
   billing month unless agreed otherwise.

7. REPORTING
   Kongila shall provide a monthly service report covering activity, coverage
   against the agreed model, and anything affecting the service.

${COMMON_CLAUSES}`
  },

  {
    key: 'standard-project',
    audience: 'client' as const,
    name: 'Standard project agreement',
    serviceType: 'project',
    body: `${header('PROJECT SERVICES AGREEMENT')}
1. WHAT THIS COVERS
   Kongila shall deliver the project known as {{project_name}}, beginning
   {{start_date}} and due for completion by {{end_date}}.

2. SCOPE AND DELIVERABLES
   The deliverables and milestones are: {{deliverables}}. Anything not stated
   there is out of scope.

3. THE FEE AND HOW IT IS BILLED
   The total project fee is {{currency}} {{project_fee}}. It is invoiced
   against milestones. A milestone is invoiced when Kongila delivers it and the
   Client accepts it under clause 4. Payment terms are {{payment_terms}}.

4. ACCEPTANCE
   The Client shall review each deliverable within five (5) working days of
   delivery and either accept it or set out in writing what does not meet the
   agreed scope. A deliverable not rejected within that period is treated as
   accepted. Kongila shall correct an agreed shortfall at no further charge.

5. CHANGES
   A change to the scope, the deliverables or the dates is effective only when
   both parties have agreed it in writing, including its effect on the fee and
   the timetable.

6. CLIENT DEPENDENCIES
   The Client shall provide the access, information, decisions and approvals
   the project reasonably requires. Where a delay is caused by the Client, the
   dates move by the length of the delay and Kongila may charge reasonable
   costs of standing time.

7. COMPLETION
   The project is complete when the final milestone has been accepted. Kongila
   has no continuing obligation after completion other than those clauses that
   survive.

${COMMON_CLAUSES}`
  },

  // ── The candidate's side ────────────────────────────────────────────────
  {
    key: 'standard-placement-talent',
    name: 'Standard direct hire — candidate terms',
    serviceType: 'placement',
    audience: 'talent' as const,
    body: `${talentHeader('PLACEMENT TERMS — DIRECT HIRE')}
1. WHAT THIS IS
   Kongila has introduced you to {{client_name}} for the role of
   {{role_title}}. If they engage you, you are employed by {{client_name}}
   directly. Kongila is not your employer, does not pay you, and does not
   manage your work.

2. YOUR PAY
   Your salary is agreed with {{client_name}}, not with Kongila. The expected
   annual salary for this role is {{currency}} {{annual_salary}}. Kongila
   deducts nothing from it: Kongila is paid separately by the client.

3. STARTING
   Your expected start date is {{start_date}}. Your employment terms,
   including notice, leave and benefits, come from {{client_name}} in their
   own contract with you, which you should read before signing it.

4. WHAT YOU AGREE TO HERE
   You confirm that you want this introduction, that what you have told
   Kongila about your experience and your right to work is true, and that if
   you take the role you took it through Kongila.

5. NO GOING AROUND KONGILA
   If you engage with {{client_name}} within twelve (12) months of this
   introduction, you agree that the introduction came from Kongila. This
   matters because Kongila is paid for the introduction and for nothing else.

${TALENT_COMMON_CLAUSES}`
  },

  {
    key: 'standard-outsourcing-talent',
    name: 'Standard outsourcing — contractor agreement',
    serviceType: 'outsourcing',
    audience: 'talent' as const,
    body: `${talentHeader('CONTRACTOR AGREEMENT — OUTSOURCED ENGAGEMENT')}
1. THE WORK
   You shall work as {{role_title}} for {{client_name}}, from {{start_date}}
   until {{end_date}} or until this Agreement ends under clause 13. Your
   working pattern is {{working_pattern}}. You report to {{reports_to}}.

2. YOUR PAY
   You are paid {{currency}} {{talent_pay}} {{rate_type}}. This is what
   reaches you after Kongila's commission of {{talent_commission_pct}}%,
   which covers finding the engagement, contracting, invoicing the client,
   chasing payment and handling compliance.

3. WHEN YOU ARE PAID
   You are paid {{pay_frequency}}, on {{payday}}. Your first payday is
   {{first_payday}}. Payment is made to the account you have given Kongila.
   Tell Kongila before a payday if those details change.

4. WHAT HAPPENS IF THE CLIENT PAYS LATE
   You are paid on the agreed payday whether or not the client has paid
   Kongila by then. Chasing the client is Kongila's job, not yours.

5. HOURS, LEAVE AND ABSENCE
   Tell Kongila of planned leave with reasonable notice, and of unplanned
   absence as soon as you can. Extended unpaid absence may reduce that
   period's pay pro rata, and Kongila shall tell you before it does.

${TALENT_COMMON_CLAUSES}`
  },

  {
    key: 'standard-managed-workforce-talent',
    name: 'Standard managed team — contractor agreement',
    serviceType: 'managed_workforce',
    audience: 'talent' as const,
    body: `${talentHeader('CONTRACTOR AGREEMENT — MANAGED TEAM')}
1. THE WORK
   You shall work as part of a Kongila managed team serving {{client_name}},
   as {{role_title}}, from {{start_date}} until {{end_date}} or until this
   Agreement ends under clause 13. The team's coverage model is {{coverage}}
   and your working pattern within it is {{working_pattern}}.

2. WHO MANAGES YOU
   You report to {{supervisor_name}} at Kongila. Kongila sets your schedule,
   reviews your work and handles anything the client raises. You do not take
   direction from the client and should pass anything they ask of you
   directly to your supervisor.

3. YOUR PAY
   You are paid {{currency}} {{talent_pay}} {{rate_type}}, after Kongila's
   commission of {{talent_commission_pct}}%.

4. WHEN YOU ARE PAID
   You are paid {{pay_frequency}}, on {{payday}}. Your first payday is
   {{first_payday}}. You are paid on that day whether or not the client has
   paid Kongila.

5. COVER AND SUBSTITUTION
   Kongila may move you between seats and shifts within the team to keep the
   agreed coverage. You shall give reasonable notice of anything that stops
   you working a scheduled shift so cover can be arranged.

${TALENT_COMMON_CLAUSES}`
  },

  {
    key: 'standard-project-talent',
    name: 'Standard project — contractor agreement',
    serviceType: 'project',
    audience: 'talent' as const,
    body: `${talentHeader('CONTRACTOR AGREEMENT — PROJECT WORK')}
1. THE WORK
   You shall deliver your part of the project known as {{project_name}} for
   {{client_name}}, beginning {{start_date}} and due for completion by
   {{end_date}}. The deliverables and milestones are: {{deliverables}}.

2. YOUR PAY
   You are paid {{currency}} {{talent_pay}} for this project, after Kongila's
   commission of {{talent_commission_pct}}%. Where the project is paid
   against milestones, your share of each milestone is paid once that
   milestone has been delivered and accepted.

3. WHEN YOU ARE PAID
   Payment runs {{pay_frequency}}, on {{payday}}, for whatever has been
   accepted by then. Your first expected payday is {{first_payday}}.

4. ACCEPTANCE
   A deliverable counts as delivered when the client has accepted it, or has
   not raised anything within five (5) working days of receiving it. Where a
   deliverable falls short of what was agreed, you shall correct it at no
   further charge.

5. CHANGES
   If the client asks for something outside the agreed scope, pass it to
   Kongila rather than agreeing to it. Scope changes affect the fee and the
   dates, and both have to be agreed in writing before the work starts.

${TALENT_COMMON_CLAUSES}`
  }
];

/**
 * Fills a template's tokens.
 *
 * A token with no value is left visible as [role title] rather than replaced
 * with an empty string, because a contract clause that reads "the role of"
 * and then stops is a document somebody will sign without noticing.
 */
export function renderTemplate(
  body: string,
  values: Record<string, string | number | null | undefined>
): string {
  return String(body || '').replace(/\{\{\s*([a-z0-9_]+)\s*\}\}/gi, (_match, name: string) => {
    const key = String(name).toLowerCase();
    const value = values[key];
    if (value === null || value === undefined || String(value).trim() === '') {
      const token = TEMPLATE_TOKENS.find(entry => entry.token === key);
      return `[${token ? token.label.toLowerCase() : key.replace(/_/g, ' ')}]`;
    }
    return String(value);
  });
}

/** Tokens in a body that nothing will fill. For a warning in the editor. */
export function unknownTokens(body: string): string[] {
  const known = new Set(TEMPLATE_TOKENS.map(entry => entry.token));
  const found = new Set<string>();
  for (const match of String(body || '').matchAll(/\{\{\s*([a-z0-9_]+)\s*\}\}/gi)) {
    const key = String(match[1]).toLowerCase();
    if (!known.has(key)) found.add(key);
  }
  return [...found];
}

/** Tokens a body still needs filling, given what is available. */
export function missingValues(
  body: string,
  values: Record<string, unknown>
): string[] {
  const needed = new Set<string>();
  for (const match of String(body || '').matchAll(/\{\{\s*([a-z0-9_]+)\s*\}\}/gi)) {
    const key = String(match[1]).toLowerCase();
    const value = values[key];
    if (value === null || value === undefined || String(value).trim() === '') needed.add(key);
  }
  return [...needed];
}
