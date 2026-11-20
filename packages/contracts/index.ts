export function generateNDATemplate(talentName: string, clientName: string): string {
  return `
================================================================================
KONGILA GLOBAL TALENT PLATFORM - MUTUAL NON-DISCLOSURE AGREEMENT
================================================================================

This Non-Disclosure Agreement (the "Agreement") is entered into by and between:
1. KONGILA EOR SYSTEMS LTD, on behalf of contractor: ${talentName} ("Disclosing Party")
2. ${clientName} ("Receiving Party")

Effective Date: ${new Date().toLocaleDateString()}

1. PURPOSE OF DISCLOSURE:
The Disclosing Party is sharing proprietary technical skills, architectural workflows,
source code designs, and product insights with the Receiving Party solely for the
purposes of remote work delivery, matching performance, and task execution management.

2. CONFIDENTIAL INFORMATION:
"Confidential Information" refers to any proprietary specifications, system databases,
operational task metrics, codebase structures, and business documents.

3. OBLIGATIONS OF RECEIVING PARTY:
The Receiving Party agrees to maintain the strict confidentiality of all disclosed materials
and shall restrict access solely to team managers supervising project completion.

4. TERM:
This agreement remains active during contractor's deployment under Remotan OS and for
a period of three (3) years following contract completion.

Signed and Executed on the platform by:
- Contractor Representative: [E-Signed / Verified Kongila Secure ID]
- Client Representative: [E-Signed / Verified ${clientName} Manager]
================================================================================
  `;
}

export function generateContractTemplate(talentName: string, role: string, salary: number): string {
  return `
================================================================================
EMPLOYER OF RECORD (EOR) DEPLOYMENT MASTER AGREEMENT
================================================================================

This Master Services Agreement is executed between:
- Contractor Name: ${talentName}
- Platform Operator: KONGILA TALENT DEPLOYMENT LLC (Employer of Record)

Terms of Employment:
- Allocated Role: ${role}
- Monthly Compensation: $${salary.toLocaleString()} USD
- Payment Cycle: Weekly / Bi-Weekly invoicing via Paystack or Wise
- Standard Timezone Commitment: Match client's timezone

Standard Code of Conduct:
- Deliver regular task status reports under Remotan Work OS.
- File blocker tickets immediately upon operational delays.
- Complete weekly productivity self-assessment scorecards.

AUTHORIZED E-SIGNATURE:
By clicking "Sign and Deploy Contract", the contractor accepts all Terms of Use.
================================================================================
  `;
}

// The document a candidate is actually asked to sign, and the check that
// stops them signing one whose terms do not exist.
// document.ts has a renderTemplate of its own, for the older single-document
// signing path, and defaultTemplates.ts has the one new contracts are
// rendered with. Both cannot be re-exported under the same name, and the
// ambiguity was a build error. The older one stays internal to document.ts,
// which is its only caller.
export {
  buildContractDocument,
  contractCoverSheet,
  templateFields,
  unfilledFields,
  MINIMUM_TERMS_LENGTH,
  type ContractDocument,
  type ContractFacts
} from './document';

// ─── The templates the platform ships with ───────────────────────────────────
//
// The two generators above are the originals: they name two different
// companies, reference Remotan, and carry no IP, termination, liability,
// data protection or governing law clause between them. They are kept only
// so an old contract generated from one still renders.
//
// New contracts come from the four templates in defaultTemplates.ts, which
// are restored into the template manager and edited there.
export * from './defaultTemplates';
export * from './html';
