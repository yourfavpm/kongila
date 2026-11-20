/**
 * The milestone plan on an offer.
 *
 * A project is the one service line where the thing being bought is a set of
 * deliverables rather than a person's time, so "what are we paying for and
 * when" has to be settled at the offer, by the client, in front of the
 * candidate. Until now it was settled after contract generation, by
 * operations, from whatever the client had said in a note. That is why
 * project engagements arrive with a fee and no plan.
 *
 * These rows are what was proposed and accepted. They are copied to
 * project_milestones when the contract is generated and then left alone, so
 * the accepted offer stays exactly what both parties agreed to, whatever
 * happens to the delivery plan afterwards.
 *
 * The arithmetic lives in `@kongila/workflows/billing`, which imports
 * nothing and is tested on its own. This is the part that talks to the
 * database.
 */

import { getSupabaseClient } from './index';
import type { RequestActor as Actor } from './scope';
import { recordAudit } from './audit';
import {
  milestonePlanProblem,
  milestoneAmount,
  money,
  type ProjectMilestone
} from '@kongila/workflows';

export interface OfferMilestoneResult<T = any> {
  ok: boolean;
  status: number;
  error?: string;
  data?: T;
  warnings?: string[];
}

function fail(status: number, error: string): OfferMilestoneResult {
  return { ok: false, status, error };
}

function newId(): string {
  return `omil_${globalThis.crypto?.randomUUID?.().slice(0, 12)
    || `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`}`;
}

/** True when the error is this table or column not being there yet. */
function missingSchema(error: any): boolean {
  const message = String(error?.message || '');
  return /does not exist/i.test(message) || error?.code === '42P01' || error?.code === '42703';
}

function toMilestone(row: any): ProjectMilestone & { description?: string | null } {
  return {
    id: String(row.id),
    name: row.name,
    description: row.description ?? null,
    dueDate: row.due_date || null,
    percent: row.percent == null ? null : Number(row.percent),
    amountUsd: row.amount_usd == null ? null : Number(row.amount_usd)
  };
}

/**
 * The offer, and whether this actor is allowed to see it.
 *
 * A client sees their own organisation's offers, a candidate sees offers
 * made to them, and operations see them because the route has already
 * checked a permission.
 */
async function loadOffer(actor: Actor, offerId: string): Promise<{ offer?: any; refusal?: OfferMilestoneResult }> {
  const supabase = getSupabaseClient();
  const { data: offer, error } = await supabase
    .from('offers')
    .select('id, client_id, talent_id, status, service_type, project_fee_usd, proposed_rate_usd')
    .eq('id', String(offerId))
    .maybeSingle();

  if (error) return { refusal: fail(500, `Could not read that offer: ${error.message}`) };
  if (!offer) return { refusal: fail(404, 'That offer does not exist.') };

  if (actor.kind === 'client' && String(offer.client_id) !== String(actor.userId)) {
    // The organisation, not just the one user who created it: a colleague at
    // the same company is entitled to see what their company offered.
    const { data: colleagues } = await supabase
      .from('client_profiles')
      .select('user_id')
      .eq('organization_id', actor.organizationId || '');
    const allowed = (colleagues || []).map((row: any) => String(row.user_id));
    if (!allowed.includes(String(offer.client_id))) {
      return { refusal: fail(403, 'Not authorised for that offer.') };
    }
  }

  if (actor.kind === 'talent'
      && String(offer.talent_id) !== String(actor.talentProfileId || actor.userId)) {
    return { refusal: fail(403, 'Not authorised for that offer.') };
  }

  return { offer };
}

/** The fee a project offer's milestones are billed against. */
export function projectFeeOf(offer: any): number {
  const explicit = Number(offer?.project_fee_usd);
  if (Number.isFinite(explicit) && explicit > 0) return explicit;
  // Older project offers put the whole fee in proposed_rate_usd, because
  // that was the only money column there was.
  const rate = Number(offer?.proposed_rate_usd);
  return Number.isFinite(rate) && rate > 0 ? rate : 0;
}

/** The milestone plan on an offer, with what each one is worth. */
export async function listOfferMilestones(
  actor: Actor,
  offerId: string
): Promise<OfferMilestoneResult> {
  if (!actor) return fail(401, 'Not authenticated.');
  if (!offerId) return fail(400, 'Which offer?');

  const { offer, refusal } = await loadOffer(actor, offerId);
  if (refusal) return refusal;

  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('offer_milestones')
    .select('*')
    .eq('offer_id', String(offerId))
    .order('sequence');

  if (error) {
    if (missingSchema(error)) {
      return {
        ok: true, status: 200,
        data: { milestones: [], projectFee: projectFeeOf(offer), planned: 0, unallocated: 0 },
        warnings: ['Offer milestones are not set up on this database yet. '
          + 'Run the 2026-11-20 offer milestones migration.']
      };
    }
    return fail(500, error.message);
  }

  const projectFee = projectFeeOf(offer);
  const milestones = (data || []).map((row: any) => {
    const milestone = toMilestone(row);
    return { ...milestone, value: milestoneAmount(milestone, projectFee) };
  });
  const planned = money(milestones.reduce((sum: number, entry: any) => sum + entry.value, 0));

  return {
    ok: true,
    status: 200,
    data: {
      offerId: String(offerId),
      serviceType: offer.service_type,
      projectFee,
      milestones,
      planned,
      unallocated: money(projectFee - planned)
    }
  };
}

/** Offers whose plan is still the client's to change. */
const EDITABLE_STATUSES = new Set(['draft', 'submitted', 'revision_requested']);

/**
 * Replaces an offer's milestone plan.
 *
 * All of them at once, because what has to be true is a property of the set:
 * they total the fee. Saving one at a time means every intermediate save is
 * invalid, so the check gets skipped, which is how a plan ends up at 80%.
 *
 * Once the offer has gone to the candidate the plan is frozen for the
 * client. Operations can still change it while the offer is being reviewed,
 * which is the point of the review, but not after it has been sent: a
 * candidate who accepted a plan accepted that plan.
 */
export async function setOfferMilestones(
  actor: Actor,
  input: { offerId: string; milestones: (ProjectMilestone & { description?: string | null })[] }
): Promise<OfferMilestoneResult> {
  if (!actor) return fail(401, 'Not authenticated.');
  if (!input.offerId) return fail(400, 'Which offer?');

  const { offer, refusal } = await loadOffer(actor, input.offerId);
  if (refusal) return refusal;

  const status = String(offer.status || '').toLowerCase();
  const isAdmin = actor.kind === 'admin';
  const adminMayEdit = isAdmin
    && Array.isArray(actor.permissions)
    && actor.permissions.includes('offers.approve');

  if (!EDITABLE_STATUSES.has(status) && !(adminMayEdit && status === 'admin_approved')) {
    return fail(409,
      status === 'sent_to_talent'
        ? 'This offer is with the candidate. Ask for a revision before changing the plan.'
        : `An offer that is ${status.replace(/_/g, ' ')} cannot have its milestone plan changed.`);
  }
  if (isAdmin && !adminMayEdit) {
    return fail(403, 'Your role cannot change an offer.');
  }

  const projectFee = projectFeeOf(offer);
  const incoming = (input.milestones || []).map((entry, index) => ({
    ...entry,
    id: String(entry.id || newId()),
    sequence: index
  }));

  const problem = milestonePlanProblem(incoming as ProjectMilestone[], projectFee);
  if (problem) return fail(422, problem);

  const supabase = getSupabaseClient();
  const now = new Date().toISOString();

  const rows = incoming.map((entry: any, index: number) => ({
    id: entry.id,
    offer_id: String(input.offerId),
    name: String(entry.name).trim(),
    description: entry.description ? String(entry.description).trim() : null,
    due_date: entry.dueDate || null,
    percent: entry.percent ?? null,
    amount_usd: entry.amountUsd ?? null,
    sequence: index,
    updated_at: now
  }));

  // Replace rather than merge. The plan is the set, so the previous set
  // going away entirely is the correct outcome, and nothing downstream has
  // referenced these rows yet — the contract gets its own copies.
  const { error: clearError } = await supabase
    .from('offer_milestones')
    .delete()
    .eq('offer_id', String(input.offerId));

  if (clearError && missingSchema(clearError)) {
    return fail(503, 'This database has not had the 2026-11-20 offer milestones migration run '
      + 'against it yet, so a project plan cannot be saved. Run it and try again.');
  }
  if (clearError) return fail(500, clearError.message);

  if (rows.length > 0) {
    const { error } = await supabase.from('offer_milestones').insert(rows);
    if (error) {
      if (missingSchema(error)) {
        return fail(503, 'This database has not had the 2026-11-20 offer milestones migration '
          + 'run against it yet. Run it and try again.');
      }
      return fail(500, `That milestone plan was not saved: ${error.message}`);
    }
  }

  await recordAudit(actor, {
    action: 'Set Offer Milestones',
    details: `${rows.length} milestone${rows.length === 1 ? '' : 's'} on offer ${input.offerId}, `
      + `totalling ${money(projectFee)}.`,
    entityType: 'offer',
    entityId: String(input.offerId)
  });

  return {
    ok: true,
    status: 200,
    data: { offerId: String(input.offerId), milestones: rows.length, projectFee }
  };
}

/**
 * Copies an accepted offer's plan onto its contract.
 *
 * Copied, not re-pointed. The offer keeps what was agreed; the contract gets
 * the working delivery record that gains delivered dates, invoice ids and
 * statuses as the project runs. Returns how many were copied so the caller
 * can say whether a project contract has a plan at all.
 */
export async function copyMilestonesToContract(
  offerId: string,
  contractId: string
): Promise<{ copied: number; warning?: string }> {
  if (!offerId || !contractId) return { copied: 0 };

  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('offer_milestones')
    .select('*')
    .eq('offer_id', String(offerId))
    .order('sequence');

  if (error) {
    if (missingSchema(error)) {
      return { copied: 0, warning: 'Offer milestones are not set up on this database yet, so this '
        + 'project has no delivery plan. Run the 2026-11-20 migration, then set the plan on the '
        + 'contract.' };
    }
    return { copied: 0, warning: `The milestone plan could not be read: ${error.message}` };
  }

  const source = data || [];
  if (source.length === 0) {
    return { copied: 0, warning: 'This project offer carried no milestone plan, so nothing can be '
      + 'invoiced yet. Set the plan on the contract before the work starts.' };
  }

  const now = new Date().toISOString();
  const rows = source.map((row: any, index: number) => ({
    contract_id: String(contractId),
    offer_id: String(offerId),
    source_offer_milestone_id: String(row.id),
    name: row.name,
    description: row.description ?? null,
    due_date: row.due_date || null,
    percent: row.percent ?? null,
    amount_usd: row.amount_usd ?? null,
    sequence: index,
    status: 'pending',
    created_at: now,
    updated_at: now
  }));

  const { error: insertError } = await supabase.from('project_milestones').insert(rows);

  if (insertError) {
    if (missingSchema(insertError)) {
      // The 2026-11-20 columns are missing but the table is there: insert
      // what the older schema can hold rather than losing the plan.
      const reduced = rows.map((row: any) => {
        const { offer_id, source_offer_milestone_id, description, ...rest } = row;
        return rest;
      });
      const { error: retryError } = await supabase.from('project_milestones').insert(reduced);
      if (!retryError) {
        return { copied: reduced.length, warning: 'The milestone plan was copied, but this '
          + 'database cannot record which offer it came from. Run the 2026-11-20 migration.' };
      }
      return { copied: 0, warning: `The milestone plan was not copied: ${retryError.message}` };
    }
    return { copied: 0, warning: `The milestone plan was not copied: ${insertError.message}` };
  }

  return { copied: rows.length };
}
