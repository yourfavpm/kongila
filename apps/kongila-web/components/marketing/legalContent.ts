/**
 * The policy documents, as supplied.
 *
 * Generated from the approved Word drafts and kept verbatim. The square
 * bracket placeholders — the registered entity name, company number,
 * registered office, contact address, ICO number — are in the source
 * documents and are left exactly as they are. Filling them in with a
 * plausible guess would put invented legal identifiers on a published
 * policy, which is worse than an obvious gap, and the gap is what prompts
 * somebody to supply the real values.
 *
 * Each document still says DRAFT FOR APPROVAL. The page prints that at the
 * top rather than hiding it.
 *
 * Two of the five legal pages named in the website copy — Terms of Use and
 * the Acceptable Use Policy — have not been drafted. They are deliberately
 * absent from the footer rather than linked to a placeholder.
 */

export interface LegalBlock {
  t: 'h2' | 'p' | 'table';
  v?: string;
  rows?: string[][];
}

export interface LegalDocument {
  title: string;
  description: string;
  /** The draft and version line from the source document. */
  status: string;
  /** The entity line, placeholders intact. */
  entity: string;
  /** The source document's own note on implementation status. */
  note: string;
  blocks: LegalBlock[];
}

export const LEGAL_DOCUMENTS: Record<string, LegalDocument> = {
  "privacy": {
    "title": "Privacy Policy",
    "description": "How Kongila collects, uses and protects personal data.",
    "status": "DRAFT FOR APPROVAL | Version 2.0 | 13 October 2026",
    "entity": "[FULL REGISTERED UK LEGAL ENTITY NAME] | Company No: [NUMBER] | Registered Office: [FULL UK ADDRESS] | Privacy: [EMAIL] | ICO Registration: [NUMBER, IF APPLICABLE]",
    "note": "Implementation status: benchmark assumptions are proposed controls, not statements that a named technology, processor, certification or practice is already in operation.",
    "blocks": [
      {
        "t": "h2",
        "v": "1. Introduction and scope"
      },
      {
        "t": "p",
        "v": "This Privacy Policy explains how Kongila Global UK (“Kongila”, “we”, “us”) handles personal data relating to employers, prospective clients, professionals, contractors, workforce participants and website visitors. It covers our Direct Talent Hire, Talent Outsourcing and related managed workforce services where provided."
      },
      {
        "t": "h2",
        "v": "2. Identity and contact"
      },
      {
        "t": "p",
        "v": "The controller for processing described in this notice is [FULL REGISTERED UK LEGAL ENTITY NAME] | Company No: [NUMBER] | Registered Office: [FULL UK ADDRESS] | Privacy: [EMAIL] | ICO Registration: [NUMBER, IF APPLICABLE]. Where an EU representative is legally required, details will be published here: [EU REPRESENTATIVE NAME AND ADDRESS]."
      },
      {
        "t": "h2",
        "v": "3. Our role as controller or processor"
      },
      {
        "t": "p",
        "v": "Kongila generally acts as controller when administering its own accounts, candidate network, assessments, recruitment operations, sales, security and compliance. For specific employer-directed workforce operations it may act as processor under a written Article 28 data processing agreement. Roles must be confirmed per service and contract; a supplier may be an independent controller for certain services."
      },
      {
        "t": "h2",
        "v": "4. Categories and sources of data"
      },
      {
        "t": "p",
        "v": "We may process contact details, professional profiles, CVs, skills and assessment results, employment history, references, availability, contract records, payment details, communications, device and usage data, and verification outcomes. We receive data directly, from employers, referees, professional sources and approved service providers. We will process special-category and criminal-offense data only where a specific lawful condition and safeguards apply."
      },
      {
        "t": "h2",
        "v": "5. Purposes and lawful bases"
      },
      {
        "t": "p",
        "v": "Account administration, enquiries and service delivery: contract or steps requested before entering a contract; business contact processing may rely on legitimate interests."
      },
      {
        "t": "p",
        "v": "Talent sourcing, evaluation, matching and communications: legitimate interests, pre-contract steps or consent as appropriate to the activity and context; complete a legitimate interests assessment where relied upon."
      },
      {
        "t": "p",
        "v": "Payroll, employment compliance and financial records: legal obligation and/or contract, with separate conditions for sensitive data."
      },
      {
        "t": "p",
        "v": "Fraud prevention, security and audit logs: legitimate interests and legal obligations as applicable."
      },
      {
        "t": "p",
        "v": "Optional direct marketing: consent where required by PECR/ePrivacy rules, or a permitted exception; provide an easy opt-out. Non-essential cookies require appropriate consent unless a statutory exception applies."
      },
      {
        "t": "h2",
        "v": "6. Assessments and automated decisions"
      },
      {
        "t": "p",
        "v": "Kongila may use software to assist screening and matching, but must document whether decisions with legal or similarly significant effects are made solely by automated means. Where relevant legal protections apply, Kongila will provide appropriate information, safeguards, routes to contest decisions and human intervention. Fairness and bias reviews are required for assessment tools."
      },
      {
        "t": "h2",
        "v": "7. Disclosure and third parties"
      },
      {
        "t": "p",
        "v": "We may disclose relevant information to prospective employers, engaged professionals, payroll/EOR partners, verification providers, hosting and collaboration vendors, CRM and support vendors, advisers, regulators and lawful authorities. The vendor categories in the implementation annex are illustrative only, not confirmed deployed subprocessors. Employer disclosure is restricted to what is relevant and lawful."
      },
      {
        "t": "h2",
        "v": "8. International transfers"
      },
      {
        "t": "p",
        "v": "Our cross-border operating model may involve transfers from the UK or EEA to countries without an applicable adequacy decision. We will use an appropriate UK adequacy regulation or safeguard such as the UK IDTA or UK Addendum, and for EU GDPR transfers an applicable adequacy decision or EU SCCs, together with relevant transfer risk/data protection assessments and supplementary measures. Transfers must be mapped and documented before deployment."
      },
      {
        "t": "h2",
        "v": "9. Retention and deletion"
      },
      {
        "t": "p",
        "v": "We apply purpose-based retention periods, legal holds, secure deletion and periodic reviews. The accompanying benchmark schedule is a proposed starting point; actual periods will be approved following legal and operational review and published or communicated as appropriate."
      },
      {
        "t": "h2",
        "v": "10. Security and confidentiality"
      },
      {
        "t": "p",
        "v": "Our target safeguards include encryption in transit and at rest, multi-factor authentication, least-privilege access, periodic access reviews, logging, vulnerability and patch management, secure backups, supplier assurance, staff training and documented incident response. These controls are commitments for implementation and verification, not an assertion of existing certification."
      },
      {
        "t": "h2",
        "v": "11. Your rights"
      },
      {
        "t": "p",
        "v": "Subject to applicable law and exceptions, individuals may request access, correction, erasure, restriction, portability, object to processing, withdraw consent, and exercise rights regarding qualifying automated decisions. Requests can be sent to [PRIVACY EMAIL]. We will verify requests proportionately and respond within applicable statutory periods. Complaints may be raised with the UK Information Commissioner’s Office and, where applicable, an EU supervisory authority."
      },
      {
        "t": "h2",
        "v": "12. Cookies and marketing"
      },
      {
        "t": "p",
        "v": "We explain cookies and similar technologies in our Cookies Policy. Where consent is required, non-essential technologies will not activate until a valid choice is recorded. Marketing preferences can be changed or withdrawn."
      },
      {
        "t": "h2",
        "v": "13. Children"
      },
      {
        "t": "p",
        "v": "Our professional hiring services are intended for adults. We do not intentionally recruit children through our professional talent platform. If children’s data is incidentally received, we will assess and handle it in accordance with applicable law."
      },
      {
        "t": "h2",
        "v": "14. Breaches and updates"
      },
      {
        "t": "p",
        "v": "We investigate personal data breaches and notify authorities and affected individuals where legally required. This notice may be updated with a new effective date and appropriate notice of material changes."
      },
      {
        "t": "h2",
        "v": "15. Contact and effective date"
      },
      {
        "t": "p",
        "v": "Effective date: [DATE AFTER APPROVAL]. Privacy contact: [PRIVACY EMAIL]. Registered entity and address: [FULL REGISTERED UK LEGAL ENTITY NAME AND ADDRESS]."
      },
      {
        "t": "h2",
        "v": "Annex A — Proposed retention schedule (subject to approval)"
      },
      {
        "t": "table",
        "rows": [
          [
            "Record type",
            "Benchmark retention",
            "Implementation note"
          ],
          [
            "Website enquiries/sales leads",
            "24 months after last substantive interaction",
            "Proposed default; delete sooner upon justified request"
          ],
          [
            "Unsuccessful recruitment applications",
            "12 months after last application decision",
            "Subject to local employment-claims considerations; opt-in talent pool separately"
          ],
          [
            "Active talent profiles",
            "Account lifetime; review inactivity after 24 months",
            "Prompt revalidation and delete or anonymise on closure subject to exceptions"
          ],
          [
            "Talent pool opted-in records",
            "24 months after last meaningful engagement/renewed consent",
            "Refresh preference before expiry"
          ],
          [
            "Client contracts, invoices and accounting",
            "6 years after relevant financial year / contract end",
            "Adjust for statutory obligations and legal claims"
          ],
          [
            "Engagement, payroll and workforce records",
            "6 years after end of engagement as planning default",
            "Specific tax, employment and country rules may require different periods"
          ],
          [
            "Identity verification records",
            "90 days after decision where no continuing legal need",
            "Prefer verification result/token over identity document copies"
          ],
          [
            "Security / access logs",
            "90 days active, up to 12 months protected archive",
            "Extend where incidents or investigations require"
          ],
          [
            "Consent records",
            "Consent lifetime plus 3 years",
            "Evidence of choices and withdrawal"
          ],
          [
            "Backup copies",
            "Rolling 30–90 days",
            "Deletion propagates under documented cycle"
          ]
        ]
      },
      {
        "t": "h2",
        "v": "Annex B — Processor benchmark register (not a list of deployed vendors)"
      },
      {
        "t": "table",
        "rows": [
          [
            "Function",
            "Illustrative options",
            "Verification required"
          ],
          [
            "Cloud hosting / databases",
            "AWS, Microsoft Azure or Google Cloud",
            "Select actual provider; region, subprocessor list and DPA"
          ],
          [
            "Email and collaboration",
            "Microsoft 365 or Google Workspace",
            "Select actual service and storage settings"
          ],
          [
            "CRM / sales communications",
            "HubSpot or Salesforce",
            "Only if deployed; configure access and retention"
          ],
          [
            "Recruitment / assessment",
            "Approved ATS, skills testing and video interview providers",
            "Name selected vendors and assess fairness and data use"
          ],
          [
            "Identity / background checks",
            "Approved KYC or screening partner",
            "Confirm lawful basis, country rules and special data"
          ],
          [
            "Payments / payroll / EOR",
            "Approved payroll/EOR partner (e.g. Remofirst only if contracted)",
            "Confirm contractual role and jurisdictions"
          ],
          [
            "Web analytics",
            "Google Analytics 4 or privacy-focused alternative",
            "Only if actually enabled and configured"
          ],
          [
            "Advertising",
            "Google Ads / LinkedIn Insight Tag / Meta Pixel",
            "Only if actually enabled and consent-gated"
          ],
          [
            "Customer support",
            "Approved helpdesk or messaging provider",
            "Confirm provider, DPA and data transfers"
          ]
        ]
      },
      {
        "t": "h2",
        "v": "Publication and implementation checklist"
      },
      {
        "t": "p",
        "v": "Replace legal identity placeholders and designate privacy owner / DPO where required."
      },
      {
        "t": "p",
        "v": "Validate actual cookie scan, processor register, lawful-basis register and data flows; remove unused examples."
      },
      {
        "t": "p",
        "v": "Approve retention periods, transfer assessments, security controls and signed vendor agreements."
      },
      {
        "t": "p",
        "v": "Obtain UK/EU legal review, management approval and evidence of operational implementation."
      },
      {
        "t": "h2",
        "v": "Reference framework"
      },
      {
        "t": "p",
        "v": "ICO, Guidance on storage and access technologies (updated 29 April 2026): https://ico.org.uk/for-organisations/direct-marketing-and-privacy-and-electronic-communications/guidance-on-the-use-of-storage-and-access-technologies/"
      },
      {
        "t": "p",
        "v": "ICO, UK IDTA and Addendum: https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/international-transfers/appropriate-safeguards/what-are-standard-data-protection-clauses-the-uk-idta-and-the-addendum/"
      },
      {
        "t": "p",
        "v": "AICPA, SOC 2 Trust Services Criteria: https://www.aicpa-cima.com/resources/download/2017-trust-services-criteria-with-revised-points-of-focus-2022"
      }
    ]
  },
  "data-protection": {
    "title": "Data Protection",
    "description": "Kongila's data protection obligations across the UK, Europe, Canada and the USA.",
    "status": "DRAFT FOR APPROVAL | Version 2.0 | 13 October 2026",
    "entity": "[FULL REGISTERED UK LEGAL ENTITY NAME] | Company No: [NUMBER] | Registered Office: [FULL UK ADDRESS] | Privacy: [EMAIL] | ICO Registration: [NUMBER, IF APPLICABLE]",
    "note": "Implementation status: benchmark assumptions are proposed controls, not statements that a named technology, processor, certification or practice is already in operation.",
    "blocks": [
      {
        "t": "h2",
        "v": "1. Purpose and applicability"
      },
      {
        "t": "p",
        "v": "This internal Data Protection Policy establishes mandatory standards for Kongila Global UK staff, contractors, administrators and authorised suppliers processing personal data. It supports UK GDPR, EU GDPR where applicable, Data Protection Act 2018, PECR and relevant amendments, together with SOC 2 control readiness."
      },
      {
        "t": "h2",
        "v": "2. Governance and accountability"
      },
      {
        "t": "p",
        "v": "The board approves the policy and risk appetite; a designated Privacy Lead owns the processing register, requests, training and incidents; an Information Security Lead owns technical controls; service owners maintain data inventories. Appoint a statutory DPO and EU representative if the relevant legal tests are met. Review policy annually."
      },
      {
        "t": "h2",
        "v": "3. Data protection principles"
      },
      {
        "t": "p",
        "v": "Processing must be lawful, fair, transparent, purpose-limited, minimised, accurate, storage-limited, secure and demonstrably accountable. Maintain records of processing, privacy notices, lawful bases, legitimate interests assessments and appropriate policies for special-category or criminal-offence data."
      },
      {
        "t": "h2",
        "v": "4. Data inventory and lawful basis"
      },
      {
        "t": "p",
        "v": "Maintain a record of processing activities identifying data subjects, categories, purposes, legal bases, systems, recipients, locations, retention and transfer safeguards. New workflows require owner approval and privacy-by-design review."
      },
      {
        "t": "h2",
        "v": "5. Access and identity management"
      },
      {
        "t": "p",
        "v": "Benchmark: unique named accounts, phishing-resistant MFA where practical, least privilege, role-based access, quarterly access reviews for privileged users, prompt revocation on departure (target within 24 hours), and protected privileged access. Shared accounts are prohibited except formally controlled service accounts."
      },
      {
        "t": "h2",
        "v": "6. Encryption and endpoint security"
      },
      {
        "t": "p",
        "v": "Benchmark: TLS 1.2+ in transit with TLS 1.3 preferred; AES-256 or equivalent encryption at rest for supported services; centrally managed keys, full-disk encryption on managed devices, EDR/anti-malware, screen locks, device inventory and remote-wipe capability."
      },
      {
        "t": "h2",
        "v": "7. Secure development and vulnerability management"
      },
      {
        "t": "p",
        "v": "Benchmark: code review, dependency and secret scanning, separation of development/test/production, restricted production data use, annual penetration testing and after major change; critical vulnerabilities triaged immediately with a target fix within 7 days and high severity within 30 days, subject to risk-approved exceptions."
      },
      {
        "t": "h2",
        "v": "8. Logging, monitoring and backup"
      },
      {
        "t": "p",
        "v": "Benchmark: central security logs, alerts for anomalous authentication and privilege changes, 90-day readily accessible log retention with up to 12 months protected archive, daily backup for critical records, encrypted off-site copies and quarterly restore tests. Business continuity targets must be defined per system, not assumed."
      },
      {
        "t": "h2",
        "v": "9. Data retention and disposal"
      },
      {
        "t": "p",
        "v": "Use the Annex A benchmark schedule only after approving local legal and operational requirements. Apply documented deletion workflows, legal holds, annual retention reviews and supplier deletion certificates where appropriate."
      },
      {
        "t": "h2",
        "v": "10. Vendor and subprocessor governance"
      },
      {
        "t": "p",
        "v": "Before engagement, classify vendor risk, perform due diligence, execute appropriate DPA, assess security evidence and subprocessors, verify hosting regions and international transfer safeguards. Reassess high-risk vendors annually. Annex B is a selection benchmark, not an approved vendor list."
      },
      {
        "t": "h2",
        "v": "11. International transfers"
      },
      {
        "t": "p",
        "v": "Document source/destination, exporter/importer roles, adequacy status, EU SCCs and/or UK IDTA/Addendum as applicable, data protection test/transfer impact assessment and supplementary technical or organisational controls. Remote access from overseas may require transfer analysis depending on the parties and circumstances."
      },
      {
        "t": "h2",
        "v": "12. Data subject rights"
      },
      {
        "t": "p",
        "v": "Maintain intake, identity verification, case tracking, search, exemptions review, secure response and closure records. Escalate processor-received requests to the controller promptly."
      },
      {
        "t": "h2",
        "v": "13. Assessments and recruitment fairness"
      },
      {
        "t": "p",
        "v": "Complete DPIAs for likely high-risk processing, including intrusive monitoring or significant automated screening. Test assessment validity and bias, restrict sensitive attributes, provide meaningful human oversight and ensure candidates can seek review where legally applicable."
      },
      {
        "t": "h2",
        "v": "14. Security incidents and breach response"
      },
      {
        "t": "p",
        "v": "All personnel report suspected incidents immediately to [SECURITY CONTACT]. The response team triages, contains, preserves evidence, assesses personal-data risk and documents decisions. Where required, notify the ICO or relevant EU authority within the applicable 72-hour framework after awareness, and affected individuals without undue delay where high risk. Processors notify controllers without undue delay."
      },
      {
        "t": "h2",
        "v": "15. Training and workforce confidentiality"
      },
      {
        "t": "p",
        "v": "Benchmark: mandatory induction training before access, annual refresher, role-specific training for HR, recruitment, finance and engineers, signed confidentiality commitments and sanctions for misuse."
      },
      {
        "t": "h2",
        "v": "16. SOC 2 readiness and evidence"
      },
      {
        "t": "p",
        "v": "Map controls to relevant AICPA Trust Services Criteria (Security as baseline; Availability, Confidentiality, Processing Integrity and Privacy where in scope). Retain dated evidence of access reviews, vendor assessments, security tests, incidents, changes, backups, training and management oversight. SOC 2 reporting requires an independent examination; this policy does not claim attestation."
      },
      {
        "t": "h2",
        "v": "17. Audit and continuous improvement"
      },
      {
        "t": "p",
        "v": "Conduct at least annual risk assessments and internal compliance reviews, track corrective actions to owners and deadlines, and report material risks to leadership. Conduct DPIAs and update controls on significant service changes."
      },
      {
        "t": "h2",
        "v": "18. Ownership, exceptions and approval"
      },
      {
        "t": "p",
        "v": "Policy owner: [PRIVACY LEAD]. Executive approver: [UK DIRECTOR / BOARD]. Effective date: [DATE]. Exceptions require documented risk assessment, compensating controls, approver and expiry date."
      },
      {
        "t": "h2",
        "v": "Annex A — Proposed retention schedule (subject to approval)"
      },
      {
        "t": "table",
        "rows": [
          [
            "Record type",
            "Benchmark retention",
            "Implementation note"
          ],
          [
            "Website enquiries / sales leads",
            "24 months after last substantive interaction",
            "Proposed default; delete sooner upon justified request"
          ],
          [
            "Unsuccessful recruitment applications",
            "12 months after last application decision",
            "Subject to local employment-claims considerations; opt-in talent pool separately"
          ],
          [
            "Active talent profiles",
            "Account lifetime; review inactivity after 24 months",
            "Prompt revalidation and delete or anonymise on closure subject to exceptions"
          ],
          [
            "Talent pool opted-in records",
            "24 months after last meaningful engagement/renewed consent",
            "Refresh preference before expiry"
          ],
          [
            "Client contracts, invoices and accounting",
            "6 years after relevant financial year / contract end",
            "Adjust for statutory obligations and legal claims"
          ],
          [
            "Engagement, payroll and workforce records",
            "6 years after end of engagement as planning default",
            "Specific tax, employment and country rules may require different periods"
          ],
          [
            "Identity verification records",
            "90 days after decision where no continuing legal need",
            "Prefer verification result/token over identity document copies"
          ],
          [
            "Security / access logs",
            "90 days active, up to 12 months protected archive",
            "Extend where incidents or investigations require"
          ],
          [
            "Consent records",
            "Consent lifetime plus 3 years",
            "Evidence of choices and withdrawal"
          ],
          [
            "Backup copies",
            "Rolling 30–90 days",
            "Deletion propagates under documented cycle"
          ]
        ]
      },
      {
        "t": "h2",
        "v": "Annex B — Processor benchmark register (not a list of deployed vendors)"
      },
      {
        "t": "table",
        "rows": [
          [
            "Function",
            "Illustrative options",
            "Verification required"
          ],
          [
            "Cloud hosting / databases",
            "AWS, Microsoft Azure or Google Cloud",
            "Select actual provider; region, subprocessor list and DPA"
          ],
          [
            "Email and collaboration",
            "Microsoft 365 or Google Workspace",
            "Select actual service and storage settings"
          ],
          [
            "CRM / sales communications",
            "HubSpot or Salesforce",
            "Only if deployed; configure access and retention"
          ],
          [
            "Recruitment / assessment",
            "Approved ATS, skills testing and video interview providers",
            "Name selected vendors and assess fairness and data use"
          ],
          [
            "Identity / background checks",
            "Approved KYC or screening partner",
            "Confirm lawful basis, country rules and special data"
          ],
          [
            "Payments / payroll / EOR",
            "Approved payroll/EOR partner (e.g. Remofirst only if contracted)",
            "Confirm contractual role and jurisdictions"
          ],
          [
            "Web analytics",
            "Google Analytics 4 or privacy-focused alternative",
            "Only if actually enabled and configured"
          ],
          [
            "Advertising",
            "Google Ads / LinkedIn Insight Tag / Meta Pixel",
            "Only if actually enabled and consent-gated"
          ],
          [
            "Customer support",
            "Approved helpdesk or messaging provider",
            "Confirm provider, DPA and data transfers"
          ]
        ]
      },
      {
        "t": "h2",
        "v": "Publication and implementation checklist"
      },
      {
        "t": "p",
        "v": "Replace legal identity placeholders and designate privacy owner / DPO where required."
      },
      {
        "t": "p",
        "v": "Validate actual cookie scan, processor register, lawful-basis register and data flows; remove unused examples."
      },
      {
        "t": "p",
        "v": "Approve retention periods, transfer assessments, security controls and signed vendor agreements."
      },
      {
        "t": "p",
        "v": "Obtain UK/EU legal review, management approval and evidence of operational implementation."
      },
      {
        "t": "h2",
        "v": "Reference framework"
      },
      {
        "t": "p",
        "v": "ICO, Guidance on storage and access technologies (updated 29 April 2026): https://ico.org.uk/for-organisations/direct-marketing-and-privacy-and-electronic-communications/guidance-on-the-use-of-storage-and-access-technologies/"
      },
      {
        "t": "p",
        "v": "ICO, UK IDTA and Addendum: https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/international-transfers/appropriate-safeguards/what-are-standard-data-protection-clauses-the-uk-idta-and-the-addendum/"
      },
      {
        "t": "p",
        "v": "AICPA, SOC 2 Trust Services Criteria: https://www.aicpa-cima.com/resources/download/2017-trust-services-criteria-with-revised-points-of-focus-2022"
      }
    ]
  },
  "cookies": {
    "title": "Cookies Policy",
    "description": "How Kongila uses cookies and similar technologies.",
    "status": "DRAFT FOR APPROVAL | Version 2.0 | 13 October 2026",
    "entity": "[FULL REGISTERED UK LEGAL ENTITY NAME] | Company No: [NUMBER] | Registered Office: [FULL UK ADDRESS] | Privacy: [EMAIL] | ICO Registration: [NUMBER, IF APPLICABLE]",
    "note": "Implementation status: benchmark assumptions are proposed controls, not statements that a named technology, processor, certification or practice is already in operation.",
    "blocks": [
      {
        "t": "h2",
        "v": "1. Introduction"
      },
      {
        "t": "p",
        "v": "This Cookies Policy explains how Kongila Global UK proposes to use cookies, local storage, pixels, tags and similar storage/access technologies on its website and platform. It must be updated from an actual site scan before publication."
      },
      {
        "t": "h2",
        "v": "2. Categories of technologies"
      },
      {
        "t": "p",
        "v": "Essential: session authentication, load balancing, security and consent preference storage; only where an applicable exemption applies."
      },
      {
        "t": "p",
        "v": "Functional: optional language, display and preference settings; consent where required."
      },
      {
        "t": "p",
        "v": "Analytics: audience and performance measurement, for example Google Analytics 4 if deployed; consent-gated unless a specific applicable legal exception is assessed and documented."
      },
      {
        "t": "p",
        "v": "Advertising: conversion measurement, remarketing and advertising pixels, for example LinkedIn Insight Tag, Meta Pixel or Google Ads if deployed; consent-gated where required."
      },
      {
        "t": "h2",
        "v": "3. Illustrative cookie inventory — not confirmed deployment"
      },
      {
        "t": "p",
        "v": "Authentication/session token: first-party, session or short-lived; essential where necessary; confirm actual cookie name and duration."
      },
      {
        "t": "p",
        "v": "Consent preference record: first-party, proposed 6–12 months; essential to remember privacy choice where legally permitted."
      },
      {
        "t": "p",
        "v": "Analytics identifiers: vendor-specific, proposed no longer than necessary; disabled until consent or documented exception."
      },
      {
        "t": "p",
        "v": "Advertising identifiers: vendor-specific; disabled until consent; confirm vendor, expiry and sharing before activation."
      },
      {
        "t": "h2",
        "v": "4. Consent and preference management"
      },
      {
        "t": "p",
        "v": "Our target consent banner offers equally accessible “Accept all”, “Reject non-essential” and “Manage preferences” choices. Optional categories default to off; no pre-ticked boxes, implied consent or consent walls. A persistent “Cookie settings” link will allow changes and withdrawal at any time. Consent receipts should record time, categories, notice version and choice."
      },
      {
        "t": "h2",
        "v": "5. Third-party services"
      },
      {
        "t": "p",
        "v": "Possible providers include Google Analytics, LinkedIn, Meta and Google Ads; these are benchmarks only. Actual deployed providers, purposes, cookie names, expiry periods and international data transfers must be populated from a verified cookie inventory."
      },
      {
        "t": "h2",
        "v": "6. Browser controls and withdrawal"
      },
      {
        "t": "p",
        "v": "Users can change choices using [COOKIE SETTINGS LINK] and browser controls. Rejecting optional cookies should not prevent access to core services. Deleting browser cookies may remove stored preferences."
      },
      {
        "t": "h2",
        "v": "7. Retention and reviews"
      },
      {
        "t": "p",
        "v": "Proposed consent-choice refresh: at least annually or when purposes/vendors materially change. Cookie durations must be documented individually and kept proportionate. Re-scan after releases and at least quarterly as an internal benchmark."
      },
      {
        "t": "h2",
        "v": "8. Contact and updates"
      },
      {
        "t": "p",
        "v": "Effective date: [DATE]. Contact: [PRIVACY EMAIL]. Entity: [FULL REGISTERED UK LEGAL ENTITY NAME]."
      },
      {
        "t": "h2",
        "v": "Publication and implementation checklist"
      },
      {
        "t": "p",
        "v": "Replace legal identity placeholders and designate privacy owner / DPO where required."
      },
      {
        "t": "p",
        "v": "Validate actual cookie scan, processor register, lawful-basis register and data flows; remove unused examples."
      },
      {
        "t": "p",
        "v": "Approve retention periods, transfer assessments, security controls and signed vendor agreements."
      },
      {
        "t": "p",
        "v": "Obtain UK/EU legal review, management approval and evidence of operational implementation."
      },
      {
        "t": "h2",
        "v": "Reference framework"
      },
      {
        "t": "p",
        "v": "ICO, Guidance on storage and access technologies (updated 29 April 2026): https://ico.org.uk/for-organisations/direct-marketing-and-privacy-and-electronic-communications/guidance-on-the-use-of-storage-and-access-technologies/"
      },
      {
        "t": "p",
        "v": "ICO, UK IDTA and Addendum: https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/international-transfers/appropriate-safeguards/what-are-standard-data-protection-clauses-the-uk-idta-and-the-addendum/"
      },
      {
        "t": "p",
        "v": "AICPA, SOC 2 Trust Services Criteria: https://www.aicpa-cima.com/resources/download/2017-trust-services-criteria-with-revised-points-of-focus-2022"
      }
    ]
  }
};
