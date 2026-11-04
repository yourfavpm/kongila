/**
 * Contract templates.
 *
 * The admin panel has a template editor with drafts, publishing and
 * version bumping. None of it was ever stored. The save handler posted a
 * `contractTemplates` array through `/api/db`, and `writeDbAsync` has no
 * branch for that key, so the payload was parsed and dropped on the floor.
 * There was no table either; the 2026-11-04b migration adds one.
 *
 * Publishing is the part that needed a server. Two published templates for
 * the same service line means whichever row is read first decides what a
 * contract says, and the unique index now refuses the second. Version
 * numbers are decided here rather than in the browser, where the editor
 * computed `old.version + 1` from whatever it happened to be holding.
 */

import { getSupabaseClient } from './index';
import type { RequestActor as Actor } from './scope';
import { recordAudit } from './audit';

export interface TemplateResult<T = any> {
  ok: boolean;
  status: number;
  error?: string;
  data?: T;
}

function fail(status: number, error: string): TemplateResult {
  return { ok: false, status, error };
}

const STATUSES = ['draft', 'published', 'archived'];
const MAX_BODY = 200_000;

function canEdit(actor: Actor): boolean {
  return actor.kind === 'admin'
    && (actor.role === 'super_admin' || actor.role === 'ops_manager');
}

export async function listTemplates(actor: Actor): Promise<TemplateResult> {
  if (!actor) return fail(401, 'Not authenticated.');
  if (actor.kind !== 'admin') return fail(403, 'Not authorised.');

  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('contract_templates')
    .select('*')
    .order('updated_at', { ascending: false });

  if (error) return fail(500, `Those templates could not be loaded: ${error.message}`);

  return {
    ok: true,
    status: 200,
    data: (data || []).map((row: any) => ({
      id: row.id,
      name: row.name,
      serviceType: row.service_type,
      body: row.body,
      status: row.status,
      version: row.version,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }))
  };
}

/**
 * Creates or updates a template.
 *
 * The version bumps when a published template's wording changes, because
 * that is a different document from the one somebody already signed. A
 * draft can be edited freely; it is not in use yet.
 */
export async function saveTemplate(
  actor: Actor,
  input: {
    id?: string | null;
    name: string;
    serviceType?: string | null;
    body: string;
    status?: string | null;
  }
): Promise<TemplateResult> {
  if (!actor) return fail(401, 'Not authenticated.');
  if (!canEdit(actor)) return fail(403, 'Only a super admin or operations manager edits templates.');

  const name = String(input.name || '').trim();
  if (!name) return fail(422, 'A template needs a name.');
  if (name.length > 200) return fail(422, 'Keep the name under 200 characters.');

  const body = String(input.body || '');
  if (!body.trim()) return fail(422, 'A template needs a body.');
  if (body.length > MAX_BODY) return fail(422, 'That template is too long to store.');

  const status = String(input.status || 'draft').trim().toLowerCase();
  if (!STATUSES.includes(status)) {
    return fail(422, `A template is draft, published or archived, not "${input.status}".`);
  }

  const supabase = getSupabaseClient();
  const serviceType = input.serviceType ? String(input.serviceType).trim() : null;

  // ── Update ───────────────────────────────────────────────────────────────
  if (input.id) {
    const { data: existing } = await supabase
      .from('contract_templates').select('*').eq('id', String(input.id)).maybeSingle();

    if (!existing) return fail(404, 'That template does not exist.');

    // A published template whose wording changes becomes a new version.
    // The browser worked this out from its own copy of the old row.
    const wordingChanged = existing.body !== body;
    const version = existing.status === 'published' && wordingChanged
      ? Number(existing.version || 1) + 1
      : Number(existing.version || 1);

    const { data, error } = await supabase
      .from('contract_templates')
      .update({
        name,
        service_type: serviceType,
        body,
        status,
        version,
        updated_at: new Date().toISOString()
      })
      .eq('id', existing.id)
      .select('*')
      .maybeSingle();

    if (error) {
      // The unique index is the likeliest failure, and the message it
      // carries is not one to show an operator.
      if (String(error.message).includes('contract_templates_published_idx')) {
        return fail(409,
          `There is already a published template for ${serviceType || 'every service line'}. `
          + 'Archive that one first.');
      }
      return fail(500, `That template was not saved: ${error.message}`);
    }

    await recordAudit(actor, {
      action: 'Update Contract Template',
      details: `${name} (v${version}) saved as ${status}.`,
      entityType: 'contract_template',
      entityId: String(existing.id)
    });

    return { ok: true, status: 200, data: { ...data, version } };
  }

  // ── Create ───────────────────────────────────────────────────────────────
  const { data, error } = await supabase
    .from('contract_templates')
    .insert({
      name,
      service_type: serviceType,
      body,
      status,
      version: 1,
      created_by: actor.userId
    })
    .select('*')
    .maybeSingle();

  if (error) {
    if (String(error.message).includes('contract_templates_published_idx')) {
      return fail(409,
        `There is already a published template for ${serviceType || 'every service line'}. `
        + 'Archive that one first.');
    }
    return fail(500, `That template was not saved: ${error.message}`);
  }

  await recordAudit(actor, {
    action: 'Create Contract Template',
    details: `${name} created as ${status}.`,
    entityType: 'contract_template',
    entityId: String(data?.id)
  });

  return { ok: true, status: 201, data };
}
