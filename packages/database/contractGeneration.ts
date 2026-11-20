/**
 * Turning an accepted offer into the documents and the bill.
 *
 * What happened before: an operator opened an empty contract form and typed
 * in, by hand, figures that already existed on the offer. The margin was not
 * applied because nothing applied it. The candidate's document did not exist
 * at all. The invoice was raised separately, later, by somebody remembering
 * to. Every one of those steps was a chance for the contract and the invoice
 * to disagree, and they did.
 *
 * This does all of it from the one thing that is already agreed, the offer:
 *
 *   1. resolves the service line and the client's commercial terms
 *   2. works out the three figures that follow from them: what the client
 *      pays, what the candidate receives, and what Kongila keeps
 *   3. renders the client's contract and the candidate's contract from the
 *      published templates for that line
 *   4. writes the contract with the terms frozen onto it
 *   5. leaves invoice preparation to the account manager or finance operator
 *
 * Everything it produces is editable afterwards. The point is not that an
 * operator cannot change it; the point is that they start from something
 * correct rather than from an empty form.
 */

import { getSupabaseClient, isUndefinedColumn } from './index';
import type { RequestActor as Actor } from './scope';
import { recordAudit } from './audit';
import { effectiveTerms } from './billingTermsService';
import { templateForServiceType } from './templateService';
import { copyMilestonesToContract, projectFeeOf } from './offerMilestoneService';
import { createContractDocuments, hashBody } from './contractDocumentService';
import { isAssignedAccountManager } from './invoiceAccess';
import { rulesForPricing } from './feeRuleService';
import { getSettings } from './settingsService';
import {
  serviceLineOf,
  billingModelFor,
  splitRate,
  money,
  draftsForContract,
  scheduleProblem,
  type ServiceLine,
  type PaymentSchedule
} from '@kongila/workflows';
import { renderTemplate, missingValues } from '@kongila/contracts';

export interface GenerationResult<T = any> {
  ok: boolean;
  status: number;
  error?: string;
  data?: T;
  warnings?: string[];
}

function fail(status: number, error: string): GenerationResult {
  return { ok: false, status, error };
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
                'July', 'August', 'September', 'October', 'November', 'December'];

function longDate(value: any): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}

function amount(value: any): string {
  const parsed = Number(value || 0);
  return parsed.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function percent(fraction: any): string {
  const parsed = Number(fraction);
  if (!Number.isFinite(parsed)) return '';
  return String(Math.round(parsed * 10000) / 100);
}

/** 1st, 2nd, 3rd. Used for a payday the candidate has to recognise. */
function ordinal(day: number): string {
  const n = Math.trunc(Number(day) || 0);
  if (n < 1) return '';
  const suffix = n % 100 >= 11 && n % 100 <= 13
    ? 'th'
    : ['th', 'st', 'nd', 'rd'][n % 10] || 'th';
  return `${n}${suffix}`;
}

/**
 * The next payday on or after a date.
 *
 * A candidate's first question is when they get paid, and answering it with
 * a rule ("the 28th") rather than a date makes them work it out themselves
 * and get it wrong in the month they start.
 */
export function nextPayday(
  from: Date,
  frequency: string,
  dayOfMonth: number
): string {
  const day = Math.min(Math.max(1, Math.trunc(dayOfMonth || 28)), 31);

  if (frequency === 'fortnightly') {
    return new Date(from.getTime() + 14 * 86400000).toISOString().slice(0, 10);
  }

  const inMonth = (year: number, month: number) => {
    const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    return new Date(Date.UTC(year, month, Math.min(day, lastDay)));
  };

  let candidate = inMonth(from.getUTCFullYear(), from.getUTCMonth());
  if (candidate < from) {
    candidate = inMonth(from.getUTCFullYear(), from.getUTCMonth() + 1);
  }

  if (frequency === 'twice_monthly') {
    const midMonth = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), 15));
    if (midMonth >= from && midMonth < candidate) return midMonth.toISOString().slice(0, 10);
  }

  return candidate.toISOString().slice(0, 10);
}

function describePayday(frequency: string, dayOfMonth: number): string {
  if (frequency === 'fortnightly') return 'every two weeks';
  if (frequency === 'on_milestone') return 'after each milestone is accepted';
  if (frequency === 'twice_monthly') {
    return `the 15th and the ${ordinal(dayOfMonth)} of each month`;
  }
  return `the ${ordinal(dayOfMonth)} of each month`;
}

export interface GenerateInput {
  offerId: string;
  /** Anything the operator changed on the review screen before saving. */
  overrides?: {
    rateAmount?: number;
    placementFeeUsd?: number;
    projectFeeUsd?: number;
    roleTitle?: string;
    annualSalaryUsd?: number;
    startDate?: string;
    endDate?: string;
    seats?: number;
    talentPayFrequency?: string;
    talentPaydayDay?: number;
    clientTemplateId?: string;
    talentTemplateId?: string;
    paymentTermsDays?: number;
    paymentSchedule?: PaymentSchedule | null;
    clientFeePct?: number;
    talentCommissionPct?: number;
    placementFeePct?: number;
    managementPremiumPct?: number;
    clientBody?: string;
    talentBody?: string;
  };
  /** False produces the preview without writing anything. */
  commit?: boolean;
}

/**
 * Works out everything a contract needs, without writing it.
 *
 * Separated from the save so the operator sees the figures and the wording
 * before anything exists. A contract that appears first and is corrected
 * afterwards has already been counted by every screen that reads contracts.
 */
export async function previewContractFromOffer(
  actor: Actor,
  input: GenerateInput
): Promise<GenerationResult> {
  if (!actor) return fail(401, 'Not authenticated.');
  const held = Array.isArray(actor.permissions) ? actor.permissions : [];
  if (!held.includes('contracts.manage')) {
    return fail(403, 'Your role cannot generate a contract.');
  }

  const supabase = getSupabaseClient();
  const overrides = input.overrides || {};
  const warnings: string[] = [];

  // ── The offer ────────────────────────────────────────────────────────────
  const { data: offer } = await supabase
    .from('offers').select('*').eq('id', String(input.offerId)).maybeSingle();

  if (!offer) return fail(404, 'That offer does not exist.');
  if (actor.role === 'account_manager' && !(await isAssignedAccountManager(actor, String(offer.client_id || '')))) {
    return fail(403, 'You can generate contracts only for client accounts assigned to you.');
  }

  const offerStatus = String(offer.status || '').toLowerCase();
  if (!['accepted', 'contract_active'].includes(offerStatus)) {
    return fail(409,
      `That offer is at "${offer.status}". A contract is generated from an offer the candidate `
      + 'has accepted, because the accepted terms are what it is built from.');
  }

  // ── Who it is between ────────────────────────────────────────────────────
  const [{ data: talent }, { data: clientProfile }] = await Promise.all([
    supabase.from('talent_profiles').select('id, full_name, country, user_id').eq('id', offer.talent_id).maybeSingle(),
    supabase.from('client_profiles').select('organization_id').eq('user_id', offer.client_id).maybeSingle()
  ]);

  const { data: organization } = clientProfile?.organization_id
    ? await supabase.from('organizations')
        .select('id, name, country').eq('id', clientProfile.organization_id).maybeSingle()
    : { data: null };

  const { data: request } = offer.request_id
    ? await supabase.from('talent_requests').select('*').eq('id', offer.request_id).maybeSingle()
    : { data: null };

  // ── The service line and the terms ───────────────────────────────────────
  const serviceType = offer.service_type || request?.service_type || 'Hire Talent';
  const line = serviceLineOf(serviceType);
  if (!line) return fail(422, `"${serviceType}" is not one of the four service lines.`);

  const model = billingModelFor(serviceType);
  const { terms, warnings: termWarnings } = await effectiveTerms(organization?.id, serviceType);
  warnings.push(...termWarnings);

  if (!terms || (line !== 'placement' && (terms.clientFeePct === null || terms.talentCommissionPct === null))) {
    return fail(409,
      `No margin is configured for ${line.replace(/_/g, ' ')}. Set the client fee and the talent `
      + 'commission in Finance before generating this contract.');
  }

  const clientFeePct = overrides.clientFeePct ?? terms.clientFeePct;
  const talentCommissionPct = overrides.talentCommissionPct ?? terms.talentCommissionPct;

  // A placement is handed over and ends, so nobody supervises it on
  // Kongila's behalf and there is nothing to charge a premium for.
  const managementPremiumPct = line === 'placement'
    ? 0
    : (overrides.managementPremiumPct ?? terms.managementPremiumPct ?? 0);

  if (line === 'placement' && (overrides.managementPremiumPct || terms.managementPremiumPct)) {
    warnings.push('A supervision premium does not apply to a direct hire: the client employs them '
      + 'and Kongila does not manage the engagement. It has been left off.');
  }

  const paymentTermsDays = overrides.paymentTermsDays ?? terms.paymentTermsDays ?? 14;
  const paymentSchedule = overrides.paymentSchedule !== undefined
    ? overrides.paymentSchedule
    : terms.paymentSchedule;

  const scheduleIssue = scheduleProblem(paymentSchedule);
  if (scheduleIssue) return fail(422, `The payment schedule cannot be used: ${scheduleIssue}`);

  // ── The money ────────────────────────────────────────────────────────────
  const rate = Number(overrides.rateAmount ?? offer.proposed_rate_usd ?? 0);
  if (!Number.isFinite(rate) || rate <= 0) {
    return fail(422, 'The offer has no rate, so there is nothing to build a contract from.');
  }

  const seats = line === 'managed_workforce'
    ? Math.max(1, Math.trunc(Number(overrides.seats ?? request?.number_of_hires ?? 1)))
    : 1;

  const split = splitRate(rate, {
    serviceLine: line as ServiceLine,
    clientFeePct,
    talentCommissionPct
  });

  // Placement is a percentage of what the client will pay in a year.
  // Everything else is a percentage of the monthly rate, which is why the
  // two are different fields and not one.
  const annualSalary = line === 'placement'
    ? Number(overrides.annualSalaryUsd ?? (rate * 12))
    : null;
  const placementFeePct = overrides.placementFeePct ?? terms.placementFeePct;
  const placementFee = line === 'placement' && Number(overrides.placementFeeUsd) > 0
    ? money(Number(overrides.placementFeeUsd))
    : line === 'placement' && annualSalary && placementFeePct
      ? money(annualSalary * placementFeePct)
      : null;

  if (line === 'placement' && placementFee === null) {
    warnings.push('No placement fee percentage is configured, so the fee cannot be worked out. '
      + 'Set one in Finance, or type a flat fee on this screen.');
  }

  const supervision = money(rate * managementPremiumPct * seats);
  const clientMonthly = line === 'placement'
    ? null
    : money(split.clientTotal * seats + supervision);

  // ── Payday ───────────────────────────────────────────────────────────────
  const payFrequency = String(
    overrides.talentPayFrequency
    || (line === 'project' ? 'on_milestone' : 'monthly')
  );
  const paydayDay = Math.min(Math.max(1, Math.trunc(Number(
    overrides.talentPaydayDay ?? offer.payment_due_day ?? 28
  ))), 31);

  const startDate = overrides.startDate || offer.proposed_start_date || null;
  const endDate = overrides.endDate
    || (offer.contract_months && startDate
      ? new Date(new Date(startDate).setMonth(new Date(startDate).getMonth() + Number(offer.contract_months)))
          .toISOString().slice(0, 10)
      : null);

  const firstPayday = line === 'placement'
    ? null
    : nextPayday(startDate ? new Date(startDate) : new Date(), payFrequency, paydayDay);

  // ── The delivery plan ────────────────────────────────────────────────────
  // A project's milestones were agreed on the offer. They go into the
  // contract as the schedule both parties signed, and are copied onto the
  // contract as the working delivery record when it is generated. A project
  // without them cannot be invoiced at all, so say so loudly rather than
  // producing a contract that silently bills nothing.
  let offerMilestones: any[] = [];
  if (line === 'project') {
    const { data: planRows } = await supabase
      .from('offer_milestones')
      .select('*')
      .eq('offer_id', String(offer.id))
      .order('sequence');
    offerMilestones = planRows || [];
    if (offerMilestones.length === 0) {
      warnings.push('This project offer carries no milestone plan, so there is nothing to invoice '
        + 'against. Set the plan before the work starts.');
    }
  }

  const projectFee = line === 'project' ? Number(overrides.projectFeeUsd ?? projectFeeOf(offer)) : 0;

  /** The milestone schedule as it reads in a contract. */
  const describeMilestones = (): string => {
    if (offerMilestones.length === 0) return '';
    return offerMilestones.map((row: any, index: number) => {
      const value = Number(row.amount_usd) > 0
        ? Number(row.amount_usd)
        : (Number(row.percent) > 0 ? projectFee * (Number(row.percent) / 100) : 0);
      const due = row.due_date ? `, due ${longDate(row.due_date)}` : '';
      const detail = row.description ? ` — ${String(row.description).trim()}` : '';
      return `(${index + 1}) ${row.name}${detail}${due}: ${amount(value)}`;
    }).join('; ');
  };

  // ── The documents ────────────────────────────────────────────────────────
  const settings = await getSettings().catch(() => ({} as Record<string, any>));
  const settingText = (key: string): string => {
    const value = (settings as any)?.[key];
    return value == null ? '' : String(value).replace(/^"|"$/g, '');
  };

  const values: Record<string, string> = {
    contracting_entity: settingText('contracting_entity_name') || 'Kongila',
    entity_address: settingText('contracting_entity_address'),
    client_name: organization?.name || 'the Client',
    client_country: organization?.country || '',
    talent_name: talent?.full_name || '',
    talent_country: talent?.country || '',
    role_title: overrides.roleTitle ?? offer.role_title ?? request?.role_title ?? '',
    start_date: longDate(startDate),
    end_date: longDate(endDate),
    currency: 'USD',
    rate_amount: amount(rate),
    rate_type: String(offer.payment_period || 'Monthly'),
    payment_terms: `${paymentTermsDays} days from invoice`,
    notice_period: '30 days',
    notice_period_talent: '30 days',
    governing_law: settingText('governing_law') || 'the laws of the Federal Republic of Nigeria',
    today: longDate(new Date().toISOString()),
    annual_salary: annualSalary ? amount(annualSalary) : '',
    placement_fee: placementFee ? amount(placementFee) : '',
    placement_fee_pct: placementFeePct == null ? '' : percent(placementFeePct),
    base_rate_amount: amount(rate),
    client_fee_pct: percent(clientFeePct),
    client_monthly_total: clientMonthly == null ? '' : amount(clientMonthly),
    guarantee_period: settingText('placement_guarantee_period') || '90 days',
    seats: seats > 1 ? String(seats) : '',
    coverage: request?.coverage_type || '',
    supervisor_name: '',
    project_name: request?.project_name || request?.title || '',
    project_fee: line === 'project' ? amount(projectFee || rate) : '',
    deliverables: describeMilestones(),
    talent_pay: amount(split.talentNet),
    talent_commission_pct: percent(talentCommissionPct),
    pay_frequency: payFrequency === 'on_milestone' ? 'On each accepted milestone'
      : payFrequency === 'fortnightly' ? 'Fortnightly'
      : payFrequency === 'twice_monthly' ? 'Twice a month' : 'Monthly',
    payday: describePayday(payFrequency, paydayDay),
    first_payday: firstPayday ? longDate(firstPayday) : '',
    reports_to: '',
    working_pattern: offer.engagement_type || '',
    notice_period_talent_days: '30'
  };

  const [clientTemplate, talentTemplate] = await Promise.all([
    templateForServiceType(serviceType, 'client', overrides.clientTemplateId),
    templateForServiceType(serviceType, 'talent', overrides.talentTemplateId)
  ]);

  if (!clientTemplate.template) return fail(409, clientTemplate.reason || 'No client template.');
  if (!talentTemplate.template) warnings.push(talentTemplate.reason || 'No candidate template is published, so only the client document was prepared.');

  const clientBody = overrides.clientBody
    ?? renderTemplate(clientTemplate.template.body, {
      ...values,
      // The client document's rate is what the client owes, including the
      // configured fee and supervision premium, while the candidate's rate
      // remains the agreed base used to calculate their payout.
      rate_amount: line === 'placement' ? amount(rate) : amount((clientMonthly || 0) / seats)
    });
  const talentBody = overrides.talentBody
    ?? (talentTemplate.template ? renderTemplate(talentTemplate.template.body, values) : '');

  // Anything still showing as [a placeholder] is said out loud, because a
  // contract reading "the role of [role]" is one somebody signs anyway.
  const stillMissing = [
    ...missingValues(clientTemplate.template.body, values),
    ...(talentTemplate.template ? missingValues(talentTemplate.template.body, values) : [])
  ];
  const unique = [...new Set(stillMissing)];
  if (unique.length > 0) {
    warnings.push(
      `These are not filled in and will appear in square brackets: ${unique.join(', ')}. `
      + 'Edit the wording below, or fill them in on the engagement before sending.'
    );
  }

  return {
    ok: true,
    status: 200,
    data: {
      offerId: offer.id,
      serviceType,
      serviceLine: line,
      billingModel: model,
      clientId: offer.client_id,
      organizationId: organization?.id || null,
      clientName: organization?.name || null,
      talentId: offer.talent_id,
      talentName: talent?.full_name || null,
      roleTitle: overrides.roleTitle ?? offer.role_title ?? request?.role_title ?? null,
      requestId: offer.request_id || null,
      matchId: offer.match_id || null,
      milestones: offerMilestones.map((row: any, index: number) => ({
        id: String(row.id),
        name: row.name,
        description: row.description ?? null,
        dueDate: row.due_date || null,
        percent: row.percent == null ? null : Number(row.percent),
        amountUsd: row.amount_usd == null ? null : Number(row.amount_usd),
        value: Number(row.amount_usd) > 0
          ? Number(row.amount_usd)
          : (Number(row.percent) > 0 ? Math.round(projectFee * (Number(row.percent) / 100) * 100) / 100 : 0),
        sequence: index
      })),
      projectFee,

      terms: {
        clientFeePct,
        talentCommissionPct,
        managementPremiumPct,
        placementFeePct: placementFeePct ?? null,
        paymentTermsDays,
        paymentSchedule,
        source: terms.source
      },

      money: {
        rate,
        seats,
        annualSalary,
        placementFee,
        clientPaysMonthly: clientMonthly,
        supervision,
        talentReceives: money(split.talentNet),
        kongilaKeeps: line === 'placement'
          ? placementFee
          : money((clientMonthly || 0) - split.talentNet * seats),
        currency: 'USD'
      },

      schedule: {
        startDate,
        endDate,
        payFrequency,
        paydayDay,
        firstPayday,
        paydayDescription: describePayday(payFrequency, paydayDay)
      },

      documents: {
        clientTemplateId: clientTemplate.template.id,
        clientTemplateName: clientTemplate.template.name,
        clientBody,
        talentTemplateId: talentTemplate.template?.id || null,
        talentTemplateName: talentTemplate.template?.name || null,
        talentBody
      }
    },
    warnings
  };
}

/**
 * Writes the contract and draft signature documents. Invoice preparation is
 * a separate action so the operator can review and send it independently.
 */
export async function generateContractFromOffer(
  actor: Actor,
  input: GenerateInput
): Promise<GenerationResult> {
  const preview = await previewContractFromOffer(actor, input);
  if (!preview.ok) return preview;

  const plan = preview.data!;
  const warnings = [...(preview.warnings || [])];
  const supabase = getSupabaseClient();

  // One contract per offer. A second click produces the one that exists
  // rather than a duplicate the client would be invoiced twice for.
  const { data: existing } = await supabase
    .from('contracts').select('id, status, client_contract_body, talent_contract_body').eq('offer_id', plan.offerId).maybeSingle();

  if (existing) {
    const { data: savedDocs } = await supabase.from('contract_documents')
      .select('status').eq('contract_id', existing.id);
    if ((savedDocs || []).some((doc: any) => ['sent', 'signed', 'opened'].includes(String(doc.status).toLowerCase()))) {
      return { ok: true, status: 200, data: { id: existing.id, alreadyExisted: true },
        warnings: ['This offer already has a contract that has been sent or signed. Its terms were left unchanged.'] };
    }
    if (existing.client_contract_body || existing.talent_contract_body || (savedDocs || []).length) {
      return { ok: true, status: 200, data: { id: existing.id, alreadyExisted: true },
        warnings: ['This offer already has a generated contract. Its saved terms were left unchanged.'] };
    }
  }

  const now = new Date().toISOString();
  // The rule versions in force today, recorded alongside the frozen figures.
  // Absent on a database without the 2026-11-20c migration, in which case
  // the columns below are simply null and nothing else changes.
  const pricingRules = await rulesForPricing(plan.serviceLine, new Date())
    .catch(() => ({ client: null, talent: null, available: false }));

  const row: Record<string, any> = {
    offer_id: plan.offerId,
    client_id: plan.clientId,
    talent_id: plan.talentId,
    service_type: plan.serviceType,
    role_title: plan.roleTitle,
    // Generated, not sent. The two documents are issued as drafts and go out
    // separately, so a contract cannot be out for signature the instant it
    // is made and before anybody has read it.
    status: 'pending',
    rate_type: plan.schedule.payFrequency === 'fortnightly' ? 'Monthly' : 'Monthly',
    rate_amount: plan.money.rate,
    monthly_rate: plan.money.rate,
    monthly_rate_usd: plan.money.rate,
    currency: plan.money.currency,
    start_date: plan.schedule.startDate,
    end_date: plan.schedule.endDate,
    entry_point: 'offer',
    auto_generated: true,
    billing_model: plan.billingModel,

    // The terms, frozen. Never looked up again, so a margin changed next
    // quarter cannot reprice what was signed this one.
    client_fee_pct_snapshot: plan.terms.clientFeePct,
    // Which version of which rule produced those figures. The figures are
    // what bills; this is what explains them two years later.
    client_fee_rule_id: pricingRules.client?.id || null,
    client_fee_rule_version: pricingRules.client?.version ?? null,
    talent_fee_rule_id: pricingRules.talent?.id || null,
    talent_fee_rule_version: pricingRules.talent?.version ?? null,
    talent_commission_pct_snapshot: plan.terms.talentCommissionPct,
    management_premium_pct: plan.terms.managementPremiumPct,
    placement_fee_pct: plan.terms.placementFeePct,
    payment_terms_days: plan.terms.paymentTermsDays,
    payment_schedule: plan.terms.paymentSchedule,
    annual_salary_usd: plan.money.annualSalary,
    placement_fee_usd: plan.money.placementFee,
    project_fee_usd: plan.serviceLine === 'project'
      ? (Number((plan as any).projectFee) > 0 ? Number((plan as any).projectFee) : plan.money.rate)
      : null,
    seats: plan.money.seats > 1 ? plan.money.seats : null,

    // When the candidate is paid, so payroll and the talent portal read it
    // from the contract rather than from a rule somebody remembers.
    talent_pay_frequency: plan.schedule.payFrequency,
    talent_payday_day: plan.schedule.paydayDay,
    talent_pay_amount: plan.money.talentReceives,

    // The rendered documents, not the template ids alone. A contract
    // re-rendered later from a template that has since been edited is not
    // the document anybody signed.
    client_contract_body: plan.documents.clientBody,
    talent_contract_body: plan.documents.talentBody || null,
    client_template_id: plan.documents.clientTemplateId,
    talent_template_id: plan.documents.talentTemplateId,
    generated_at: now
  };

  if (existing) row.status = 'pending';
  const writeContract = () => existing
    ? supabase.from('contracts').update(row).eq('id', existing.id).select('*').maybeSingle()
    : supabase.from('contracts').insert(row).select('*').maybeSingle();
  const { data: created, error } = await writeContract();

  let contract = created;

  if (error) {
    // The fee rule columns arrive with 2026-11-20c. Without them a contract
    // is still complete — its figures are frozen either way — so retry
    // without them rather than refusing to generate.
    if (/fee_rule_id|fee_rule_version/.test(String(error.message))) {
      const { client_fee_rule_id, client_fee_rule_version,
        talent_fee_rule_id, talent_fee_rule_version, ...withoutRules } = row;
      const retried = existing
        ? await supabase.from('contracts').update(withoutRules).eq('id', existing.id).select('*').maybeSingle()
        : await supabase.from('contracts').insert(withoutRules).select('*').maybeSingle();
      if (retried.error) {
        if (isUndefinedColumn(retried.error)) {
          return fail(503,
            'This database has not had the 2026-11-19 billing terms migration run against it yet, '
            + 'so a contract cannot carry its terms or its documents. Run it and try again.');
        }
        return fail(500, `That contract was not created: ${retried.error.message}`);
      }
      contract = retried.data;
      warnings.push('This database cannot record which fee rule version priced this contract. '
        + 'Run the 2026-11-20c migration.');
    } else if (isUndefinedColumn(error)) {
      return fail(503,
        'This database has not had the 2026-11-19 billing terms migration run against it yet, '
        + 'so a contract cannot carry its terms or its documents. Run it and try again.');
    } else {
      return fail(500, `That contract was not created: ${error.message}`);
    }
  }

  if (!contract) return fail(500, 'That contract was not created.');

  // The two documents, as drafts. Each party gets their own and signs their
  // own: the client's carries the service fee, the candidate's carries the
  // pay. Until now both were stored on the contract and neither was read.
  const issued = await createContractDocuments(actor, {
    contractId: String(contract.id),
    clientBody: plan.documents.clientBody,
    talentBody: plan.documents.talentBody || null,
    clientTemplateId: plan.documents.clientTemplateId,
    talentTemplateId: plan.documents.talentTemplateId
  });
  if (issued.warnings?.length) warnings.push(...issued.warnings);
  if (!issued.ok) warnings.push(`The contract was created but its documents were not issued: ${issued.error}`);
  else if (!plan.documents.talentBody) {
    warnings.push('No candidate document was issued, because no candidate template is published '
      + 'for this service line. Publish one in Contract Templates, then generate again.');
  }
  const { error: offerLinkError } = await supabase.from('offers')
    .update({ status: 'contract_active', updated_at: new Date().toISOString() })
    .eq('id', plan.offerId);
  if (offerLinkError) warnings.push(`The contract was created, but the offer status did not update: ${offerLinkError.message}`);

  await recordAudit(actor, {
    action: existing ? 'Repair Contract From Offer' : 'Generate Contract',
    details: `Generated from offer ${plan.offerId} for ${plan.talentName || plan.talentId} `
      + `(${plan.serviceLine.replace(/_/g, ' ')}).`,
    entityType: 'contract',
    entityId: String(contract?.id)
  });

  // ── The invoice ──────────────────────────────────────────────────────────
  if (plan.serviceLine === 'project') {
    // The plan the client proposed and the candidate accepted becomes the
    // contract's delivery record. Copied rather than shared: the offer keeps
    // what was agreed, and this copy is what gains delivered dates and
    // invoice ids as the project runs.
    const copied = await copyMilestonesToContract(String(plan.offerId), String(contract.id));
    if (copied.warning) warnings.push(copied.warning);
    if (copied.copied > 0) {
      warnings.push(`${copied.copied} milestone${copied.copied === 1 ? '' : 's'} carried over from `
        + 'the offer. Each raises its invoice when you mark it delivered.');
    }
  } else if (plan.serviceLine === 'placement') {
    warnings.push('The contract is ready for signature. Prepare and send its invoice separately.');
  } else {
    warnings.push('Outsourcing and managed teams are invoiced monthly in arrears. The first '
      + 'invoice is raised by the billing run after the first month, or you can raise it from '
      + 'Finance once the engagement starts.');
  }

  return {
    ok: true,
    status: 201,
    data: { id: contract.id, contract, plan, repairedExisting: Boolean(existing) },
    warnings
  };
}

/**
 * Revises an unsigned offer-based contract and both signature documents as
 * one preparation step. The offer remains unchanged; these are contract-only
 * negotiated terms. Sent documents and existing invoices are immutable here.
 */
export async function updateContractTerms(
  actor: Actor,
  input: {
    contractId: string;
    serviceLine?: string;
    roleTitle: string;
    rateAmount: unknown;
    rateType?: string;
    startDate: string;
    endDate?: string | null;
    placementFeeUsd?: unknown;
    projectFeeUsd?: unknown;
  }
): Promise<GenerationResult> {
  if (!actor) return fail(401, 'Not authenticated.');
  const held = Array.isArray(actor.permissions) ? actor.permissions : [];
  if (!held.includes('contracts.manage')) return fail(403, 'Your role cannot change contract terms.');
  const contractId = String(input.contractId || '').trim();
  if (!contractId) return fail(400, 'Which contract?');

  const supabase = getSupabaseClient();
  const { data: contract, error: readError } = await supabase
    .from('contracts').select('*').eq('id', contractId).maybeSingle();
  if (readError) return fail(500, `The contract could not be read: ${readError.message}`);
  if (!contract) return fail(404, 'That contract does not exist.');
  if (actor.role === 'account_manager' && !(await isAssignedAccountManager(actor, String(contract.client_id || '')))) {
    return fail(403, 'You can change terms only for client accounts assigned to you.');
  }
  if (!contract.offer_id) return fail(409, 'This contract was not generated from an accepted offer. Its terms cannot be revised here.');
  if (!['pending', 'pending_signatures'].includes(String(contract.status || '').toLowerCase())) {
    return fail(409, 'Contract terms can be revised only before either party signs or the engagement starts.');
  }

  const { data: docs, error: docsError } = await supabase
    .from('contract_documents').select('id, audience, status')
    .eq('contract_id', contractId);
  if (docsError && !/does not exist|schema cache/i.test(String(docsError.message || ''))) {
    return fail(500, `The signature documents could not be checked: ${docsError.message}`);
  }
  if ((docs || []).some((doc: any) => !['draft', 'voided'].includes(String(doc.status || '').toLowerCase()))) {
    return fail(409, 'A contract document has already been sent or signed. Void and regenerate the contract to change its terms.');
  }
  const { count: invoiceCount, error: invoiceError } = await supabase
    .from('invoices').select('id', { count: 'exact', head: true }).eq('contract_id', contractId);
  if (invoiceError && !/does not exist|schema cache/i.test(String(invoiceError.message || ''))) {
    return fail(500, `Existing invoices could not be checked: ${invoiceError.message}`);
  }
  if (invoiceCount) return fail(409, 'An invoice already exists for this contract. Update it separately in Finance before changing the contract terms.');

  const amount = Number(input.rateAmount);
  const roleTitle = String(input.roleTitle || '').trim();
  const startDate = String(input.startDate || '').trim();
  const endDate = String(input.endDate || '').trim() || null;
  if (!Number.isFinite(amount) || amount <= 0) return fail(422, 'Enter a rate above zero.');
  if (!roleTitle) return fail(422, 'Enter the role or function for this contract.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || (endDate && !/^\d{4}-\d{2}-\d{2}$/.test(endDate))) {
    return fail(422, 'Enter valid contract dates.');
  }
  if (endDate && endDate < startDate) return fail(422, 'The end date is before the start date.');
  if (String(input.rateType || 'Monthly') !== 'Monthly') return fail(422, 'Offer-based contracts currently use a monthly rate.');

  const line = serviceLineOf(contract.service_type);
  const requestedLine = serviceLineOf(input.serviceLine || contract.service_type);
  if (!line || requestedLine !== line) return fail(422, 'The service line cannot be changed on an existing contract. Generate a new contract from the correct accepted offer.');

  const preview = await previewContractFromOffer(actor, {
    offerId: String(contract.offer_id),
    overrides: {
      rateAmount: amount,
      roleTitle,
      annualSalaryUsd: line === 'placement' ? Number(contract.annual_salary_usd || amount * 12) : undefined,
      startDate,
      endDate: endDate || undefined,
      placementFeeUsd: line === 'placement' ? Number(input.placementFeeUsd) : undefined,
      projectFeeUsd: line === 'project' ? Number(input.projectFeeUsd) : undefined,
      placementFeePct: contract.placement_fee_pct == null ? undefined : Number(contract.placement_fee_pct),
      clientFeePct: contract.client_fee_pct_snapshot == null ? undefined : Number(contract.client_fee_pct_snapshot),
      talentCommissionPct: contract.talent_commission_pct_snapshot == null ? undefined : Number(contract.talent_commission_pct_snapshot),
      managementPremiumPct: contract.management_premium_pct == null ? undefined : Number(contract.management_premium_pct),
      paymentTermsDays: contract.payment_terms_days == null ? undefined : Number(contract.payment_terms_days),
      paymentSchedule: contract.payment_schedule || undefined,
      seats: contract.seats == null ? undefined : Number(contract.seats),
      talentPayFrequency: contract.talent_pay_frequency || undefined,
      talentPaydayDay: contract.talent_payday_day == null ? undefined : Number(contract.talent_payday_day),
      clientTemplateId: contract.client_template_id || undefined,
      talentTemplateId: contract.talent_template_id || undefined
    }
  });
  if (!preview.ok) return preview;
  const plan: any = preview.data;
  const now = new Date().toISOString();
  const updates: Record<string, any> = {
    role_title: plan.roleTitle,
    rate_type: 'Monthly',
    rate_amount: plan.money.rate,
    monthly_rate: plan.money.rate,
    monthly_rate_usd: plan.money.rate,
    start_date: plan.schedule.startDate,
    end_date: plan.schedule.endDate,
    annual_salary_usd: plan.money.annualSalary,
    placement_fee_usd: plan.money.placementFee,
    placement_fee_pct: plan.terms.placementFeePct,
    project_fee_usd: line === 'project' ? plan.projectFee : null,
    client_fee_pct_snapshot: plan.terms.clientFeePct,
    talent_commission_pct_snapshot: plan.terms.talentCommissionPct,
    management_premium_pct: plan.terms.managementPremiumPct,
    payment_terms_days: plan.terms.paymentTermsDays,
    payment_schedule: plan.terms.paymentSchedule,
    talent_pay_frequency: plan.schedule.payFrequency,
    talent_payday_day: plan.schedule.paydayDay,
    talent_pay_amount: plan.money.talentReceives,
    client_contract_body: plan.documents.clientBody,
    talent_contract_body: plan.documents.talentBody || null,
    client_template_id: plan.documents.clientTemplateId,
    talent_template_id: plan.documents.talentTemplateId,
    updated_at: now
  };
  const { data: updated, error: updateError } = await supabase
    .from('contracts').update(updates).eq('id', contractId).select('*').maybeSingle();
  if (updateError) return fail(500, `The contract terms were not saved: ${updateError.message}`);
  if (!updated) return fail(409, 'The contract changed while it was being edited. Reload and try again.');

  for (const doc of docs || []) {
    const body = doc.audience === 'client' ? plan.documents.clientBody : plan.documents.talentBody;
    if (!body) continue;
    const templateId = doc.audience === 'client' ? plan.documents.clientTemplateId : plan.documents.talentTemplateId;
    const { error: docUpdateError } = await supabase.from('contract_documents').update({
      body, template_id: templateId, document_hash: hashBody(body), updated_at: now
    }).eq('id', doc.id);
    if (docUpdateError) return fail(500, `Contract terms saved, but the ${doc.audience} draft document did not update: ${docUpdateError.message}`);
  }

  await recordAudit(actor, {
    action: 'Update Contract Terms',
    details: `${roleTitle}: rate ${amount}, start ${startDate}${endDate ? `, end ${endDate}` : ''}.`,
    entityType: 'contract', entityId: contractId
  });
  return { ok: true, status: 200, data: updated, warnings: preview.warnings || [] };
}

/**
 * Edits the wording of a contract that has not been signed.
 *
 * The document is stored as text on the contract rather than re-rendered
 * from its template, so this changes the actual thing both parties will
 * sign. Refused once anybody has signed: a signed document that can still
 * be edited is not a contract.
 */
export async function updateContractDocument(
  actor: Actor,
  input: { contractId: string; clientBody?: string; talentBody?: string }
): Promise<GenerationResult> {
  if (!actor) return fail(401, 'Not authenticated.');
  const held = Array.isArray(actor.permissions) ? actor.permissions : [];
  if (!held.includes('contracts.manage')) {
    return fail(403, 'Your role cannot change a contract.');
  }
  if (!input.contractId) return fail(400, 'Which contract?');

  const supabase = getSupabaseClient();
  const { data: contract } = await supabase
    .from('contracts')
    .select('id, client_id, status, client_signed_at, talent_signed_at')
    .eq('id', input.contractId)
    .maybeSingle();

  if (!contract) return fail(404, 'That contract does not exist.');
  if (actor.role === 'account_manager' && !(await isAssignedAccountManager(actor, String(contract.client_id || '')))) {
    return fail(403, 'You can edit only contracts for client accounts assigned to you.');
  }

  const status = String(contract.status || '').toLowerCase();
  const signed = ['active', 'signed', 'fully_signed', 'client_signed', 'talent_signed', 'completed']
    .includes(status)
    || Boolean(contract.client_signed_at)
    || Boolean(contract.talent_signed_at);

  if (signed) {
    return fail(409,
      'Somebody has already signed this contract, so its wording cannot change. '
      + 'Void it and generate a new one if the terms are wrong.');
  }

  const { data: issuedDocs } = await supabase.from('contract_documents')
    .select('id, audience, status').eq('contract_id', input.contractId);
  if ((issuedDocs || []).some((doc: any) => ['sent', 'opened', 'signed'].includes(String(doc.status).toLowerCase()))) {
    return fail(409, 'A contract document has already been sent. Void and regenerate the contract if its wording must change.');
  }

  const changes: Record<string, any> = { updated_at: new Date().toISOString() };
  if (typeof input.clientBody === 'string') changes.client_contract_body = input.clientBody;
  if (typeof input.talentBody === 'string') changes.talent_contract_body = input.talentBody;

  if (Object.keys(changes).length === 1) return fail(400, 'Nothing to change.');

  const { error } = await supabase
    .from('contracts').update(changes).eq('id', input.contractId);

  if (error) {
    if (isUndefinedColumn(error)) {
      return fail(503, 'This database has not had the 2026-11-19 billing terms migration run yet.');
    }
    return fail(500, error.message);
  }

  for (const doc of issuedDocs || []) {
    const body = doc.audience === 'client' ? input.clientBody : input.talentBody;
    if (typeof body !== 'string') continue;
    const { error: docError } = await supabase.from('contract_documents').update({
      body, document_hash: hashBody(body), updated_at: new Date().toISOString()
    }).eq('id', doc.id);
    if (docError) return fail(500, `The contract wording saved, but its ${doc.audience} signature document did not update: ${docError.message}`);
  }

  await recordAudit(actor, {
    action: 'Edit Contract Wording',
    details: `Edited the ${typeof input.clientBody === 'string' ? 'client' : ''}`
      + `${typeof input.clientBody === 'string' && typeof input.talentBody === 'string' ? ' and ' : ''}`
      + `${typeof input.talentBody === 'string' ? 'candidate' : ''} document before signature.`,
    entityType: 'contract',
    entityId: String(input.contractId)
  });

  return { ok: true, status: 200, data: { id: input.contractId } };
}

/**
 * The contract as it stands, with its documents and its invoices.
 *
 * One call, because the screen that shows a contract needs all three and
 * three round trips is three chances for them to disagree.
 */
export async function getContractDetail(
  actor: Actor,
  contractId: string
): Promise<GenerationResult> {
  if (!actor) return fail(401, 'Not authenticated.');
  if (actor.kind !== 'admin') return fail(403, 'Not authorised.');
  if (!contractId) return fail(400, 'Which contract?');

  const supabase = getSupabaseClient();
  const { data: contract, error } = await supabase
    .from('contracts').select('*').eq('id', contractId).maybeSingle();

  if (error) return fail(500, error.message);
  if (!contract) return fail(404, 'That contract does not exist.');
  if (actor.role === 'account_manager' && !(await isAssignedAccountManager(actor, String(contract.client_id || '')))) {
    return fail(403, 'You can view only contracts for client accounts assigned to you.');
  }

  const { data: invoices } = await supabase
    .from('invoices')
    .select('id, invoice_number, status, amount, total_usd, currency, due_date, period, description, amount_due_now, next_due_date, next_due_amount, created_at')
    .eq('contract_id', contractId)
    .order('created_at', { ascending: false });

  const { data: instalments } = invoices?.length
    ? await supabase
        .from('invoice_instalments')
        .select('invoice_id, sequence, label, amount, due_date, status')
        .in('invoice_id', invoices.map((invoice: any) => invoice.id))
        .order('sequence')
    : { data: [] };
  const { data: invoiceLines } = invoices?.length
    ? await supabase.from('invoice_line_items').select('id, invoice_id, description, quantity, unit_amount, amount')
        .in('invoice_id', invoices.map((invoice: any) => invoice.id)).order('id')
    : { data: [] };

  return {
    ok: true,
    status: 200,
    data: {
      contract,
      documents: {
        clientBody: contract.client_contract_body || '',
        talentBody: contract.talent_contract_body || '',
        editable: !['active', 'signed', 'fully_signed', 'client_signed', 'talent_signed', 'completed']
          .includes(String(contract.status || '').toLowerCase())
      },
      invoices: (invoices || []).map((invoice: any) => ({
        ...invoice,
        instalments: (instalments || []).filter((part: any) => part.invoice_id === invoice.id),
        lines: (invoiceLines || []).filter((line: any) => line.invoice_id === invoice.id)
      }))
    }
  };
}
