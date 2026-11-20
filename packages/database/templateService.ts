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
import { DEFAULT_CONTRACT_TEMPLATES, unknownTokens } from '@kongila/contracts';

function templateServiceKey(value: any): string {
  const key = String(value || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  const aliases: Record<string, string> = {
    'hire_talent': 'placement', 'direct_hire': 'placement', 'direct_placement': 'placement',
    'outsource_talent': 'outsourcing', 'managed_team': 'managed_workforce',
    'project_execution': 'project'
  };
  return aliases[key] || key;
}

export interface TemplateResult<T = any> {
  ok: boolean;
  status: number;
  error?: string;
  data?: T;
  warnings?: string[];
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
      audience: row.audience || 'client',
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
    audience?: string | null;
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

  const audience = String(input.audience || 'client').trim().toLowerCase();
  if (!['client', 'talent'].includes(audience)) {
    return fail(422, 'A template is written either to the client or to the candidate.');
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
        audience,
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

    return { ok: true, status: 200, data: {
      id: data.id, name: data.name, serviceType: data.service_type,
      audience: data.audience || audience, body: data.body,
      status: data.status, version, createdAt: data.created_at, updatedAt: data.updated_at
    } };
  }

  // ── Create ───────────────────────────────────────────────────────────────
  const { data, error } = await supabase
    .from('contract_templates')
    .insert({
      name,
      service_type: serviceType,
      audience,
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

  return { ok: true, status: 201, data: {
    id: data.id, name: data.name, serviceType: data.service_type,
    audience: data.audience || audience, body: data.body,
    status: data.status, version: data.version, createdAt: data.created_at, updatedAt: data.updated_at
  } };
}

// ─── The templates the platform ships with ───────────────────────────────────

/**
 * Puts the four standard templates back.
 *
 * The table was empty, so the template manager had nothing to list and the
 * contract form had nothing to offer. This restores one template per service
 * line, and is safe to run again: a service line that already has a template
 * carrying the same shipped key is left exactly as it is, because somebody
 * has probably edited it since.
 *
 * Restored as DRAFTS, never published, and that is deliberate. These are a
 * complete clause set and a structure, not legal advice, and publishing one
 * is what makes it the document a client signs. Somebody has to read them
 * first, and making that a separate click is the only way to be sure they
 * did.
 */
export async function restoreDefaultTemplates(
  actor: Actor,
  options: { overwrite?: boolean } = {}
): Promise<TemplateResult> {
  if (!actor) return fail(401, 'Not authenticated.');
  if (!canEdit(actor)) {
    return fail(403, 'Only a super admin or operations manager restores templates.');
  }

  const supabase = getSupabaseClient();
  const { data: existing, error: readError } = await supabase
    .from('contract_templates')
    .select('id, name, service_type, status, source_key, body');

  if (readError) {
    return fail(500, `The existing templates could not be read: ${readError.message}`);
  }

  const bySourceKey = new Map<string, any>();
  const byName = new Map<string, any>();
  for (const row of existing || []) {
    if (row.source_key) bySourceKey.set(String(row.source_key), row);
    byName.set(String(row.name || '').trim().toLowerCase(), row);
  }

  const created: string[] = [];
  const skipped: string[] = [];
  const updated: string[] = [];
  const warnings: string[] = [];
  const now = new Date().toISOString();

  for (const template of DEFAULT_CONTRACT_TEMPLATES) {
    const match = bySourceKey.get(template.key) || byName.get(template.name.trim().toLowerCase());

    if (match && !options.overwrite) {
      skipped.push(template.name);
      continue;
    }

    if (match && options.overwrite) {
      // Never silently rewrite something in use. A published template is
      // what somebody is signing today.
      if (String(match.status).toLowerCase() === 'published') {
        skipped.push(template.name);
        warnings.push(`"${template.name}" is published and was left alone. Archive it first if you want the shipped wording back.`);
        continue;
      }

      const { error } = await supabase
        .from('contract_templates')
        .update({ body: template.body, name: template.name, service_type: template.serviceType, audience: template.audience, updated_at: now })
        .eq('id', match.id);

      if (error) warnings.push(`"${template.name}" was not restored: ${error.message}`);
      else updated.push(template.name);
      continue;
    }

    const row: Record<string, any> = {
      name: template.name,
      service_type: template.serviceType,
      audience: template.audience,
      body: template.body,
      status: 'draft',
      version: 1,
      created_by: actor.userId
    };

    // Columns added by the 2026-11-19 migration. An environment that has
    // not had it run still gets its templates, minus whatever is missing,
    // rather than a failure nobody can act on.
    //
    // Dropping the column named in the error and retrying is deliberate: the
    // alternative is checking the schema first, which is a round trip on
    // every restore to answer a question that is almost always "it is
    // there".
    let attempt: Record<string, any> = { ...row, source_key: template.key };
    let error: any = null;
    const dropped: string[] = [];

    for (let tries = 0; tries < 3; tries += 1) {
      ({ error } = await supabase.from('contract_templates').insert(attempt));
      if (!error) break;

      const missing = /column "?([a-z_]+)"? of relation|could not find the '([a-z_]+)' column/i
        .exec(error.message || '');
      const column = missing?.[1] || missing?.[2];
      if (!column || !(column in attempt)) break;

      delete attempt[column];
      dropped.push(column);
    }

    if (error) {
      warnings.push(`"${template.name}" was not restored: ${error.message}`);
      continue;
    }

    created.push(template.name);

    if (dropped.includes('audience')) {
      warnings.push('This database has no audience column yet, so the client and candidate '
        + 'templates were restored without it and cannot be told apart. Run the 2026-11-19 '
        + 'billing terms migration, then restore again.');
    }
    if (dropped.includes('source_key')) {
      warnings.push('Templates were restored without their shipped key, so restoring again '
        + 'will match them by name. Run the 2026-11-19 billing terms migration to add the column.');
    }
  }

  await recordAudit(actor, {
    action: 'Restore Contract Templates',
    details: `${created.length} created, ${updated.length} replaced, ${skipped.length} left alone.`,
    entityType: 'contract_template',
    entityId: 'defaults'
  });

  if (created.length > 0 || updated.length > 0) {
    warnings.unshift(
      'These are drafts, and they are a structure with a complete clause set rather than legal '
      + 'advice. Have them reviewed, then publish the ones you want contracts generated from.'
    );
  }

  return {
    ok: true,
    status: 200,
    data: { created, updated, skipped, total: DEFAULT_CONTRACT_TEMPLATES.length },
    // Eight templates hitting the same missing column would otherwise say
    // the same thing eight times.
    warnings: [...new Set(warnings)]
  };
}

/**
 * Publishes a template, archiving whatever it replaces.
 *
 * Two published templates for one service line means whichever row is read
 * first decides what a contract says. The unique index refuses the second,
 * so the one it replaces is archived in the same breath rather than leaving
 * the operator to work out why publishing failed.
 */
export async function publishTemplate(
  actor: Actor,
  input: { id: string }
): Promise<TemplateResult> {
  if (!actor) return fail(401, 'Not authenticated.');
  if (!canEdit(actor)) return fail(403, 'Only a super admin or operations manager publishes templates.');
  if (!input.id) return fail(400, 'Which template?');

  const supabase = getSupabaseClient();
  const { data: template } = await supabase
    .from('contract_templates').select('*').eq('id', String(input.id)).maybeSingle();

  if (!template) return fail(404, 'That template does not exist.');
  if (String(template.status).toLowerCase() === 'published') {
    return { ok: true, status: 200, data: { id: template.id, status: 'published' } };
  }

  const unknown = unknownTokens(template.body || '');
  if (unknown.length > 0) {
    return fail(422,
      `This template uses ${unknown.length === 1 ? 'a placeholder' : 'placeholders'} nothing will `
      + `fill in: ${unknown.map(token => `{{${token}}}`).join(', ')}. `
      + 'A contract would go out with that text in it.');
  }

  const warnings: string[] = [];

  if (template.service_type) {
    // Only the same audience. A client template and a candidate template for
    // the same service line are two different documents and both are
    // published at once.
    const { data: current } = await supabase
      .from('contract_templates')
      .select('id, name')
      .eq('service_type', template.service_type)
      .eq('audience', template.audience || 'client')
      .eq('status', 'published');

    for (const row of current || []) {
      if (String(row.id) === String(template.id)) continue;
      const { error } = await supabase
        .from('contract_templates')
        .update({ status: 'archived', updated_at: new Date().toISOString() })
        .eq('id', row.id);

      if (error) return fail(500, `"${row.name}" could not be archived, so publishing stopped: ${error.message}`);
      warnings.push(`"${row.name}" was archived. It was the published template for this service line.`);
    }
  }

  const { error } = await supabase
    .from('contract_templates')
    .update({ status: 'published', updated_at: new Date().toISOString() })
    .eq('id', template.id);

  if (error) return fail(500, `That template was not published: ${error.message}`);

  await recordAudit(actor, {
    action: 'Publish Contract Template',
    details: `${template.name} (v${template.version}) published for ${template.service_type || 'every service line'}.`,
    entityType: 'contract_template',
    entityId: String(template.id)
  });

  return { ok: true, status: 200, data: { id: template.id, status: 'published' }, warnings };
}

/**
 * Takes a template out of use without deleting it.
 *
 * Contracts already generated keep their own copy of the wording, so
 * archiving never changes a document somebody has signed. It only stops the
 * template being picked for the next one.
 *
 * Archiving the published template for a service line leaves that line with
 * nothing to generate from, so this says so rather than letting the operator
 * discover it at the moment they try to raise a contract.
 */
export async function archiveTemplate(
  actor: Actor,
  input: { id: string }
): Promise<TemplateResult> {
  if (!actor) return fail(401, 'Not authenticated.');
  if (!canEdit(actor)) return fail(403, 'Only a super admin or operations manager archives templates.');
  if (!input.id) return fail(400, 'Which template?');

  const supabase = getSupabaseClient();
  const { data: template } = await supabase
    .from('contract_templates').select('*').eq('id', String(input.id)).maybeSingle();

  if (!template) return fail(404, 'That template does not exist.');
  if (String(template.status).toLowerCase() === 'archived') {
    return { ok: true, status: 200, data: { id: template.id, status: 'archived' } };
  }

  const wasPublished = String(template.status).toLowerCase() === 'published';

  const { error } = await supabase
    .from('contract_templates')
    .update({ status: 'archived', updated_at: new Date().toISOString() })
    .eq('id', template.id);

  if (error) return fail(500, `That template was not archived: ${error.message}`);

  const warnings: string[] = [];
  if (wasPublished && template.service_type) {
    warnings.push(
      `${template.service_type} now has no published `
      + `${String(template.audience || 'client') === 'talent' ? 'candidate' : 'client'} template. `
      + 'Contracts for that service line cannot be generated until one is published.');
  }

  await recordAudit(actor, {
    action: 'Archive Contract Template',
    details: `${template.name} (v${template.version}) archived.`,
    entityType: 'contract_template',
    entityId: String(template.id)
  });

  return { ok: true, status: 200, data: { id: template.id, status: 'archived' }, warnings };
}

/**
 * The template a contract should be generated from.
 *
 * Falls back to a template published for every service line, and says
 * plainly when there is none rather than letting the caller generate an
 * empty contract.
 */
export async function templateForServiceType(
  serviceType: string | null | undefined,
  audience: 'client' | 'talent' = 'client',
  selectedTemplateId?: string
): Promise<{ template: any | null; reason?: string }> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('contract_templates')
    .select('*')
    .eq('status', 'published');

  if (error) return { template: null, reason: `Templates could not be read: ${error.message}` };

  const published = (data || []).filter((row: any) =>
    String(row.audience || 'client') === audience);
  if (selectedTemplateId) {
    const selected = published.find((row: any) => String(row.id) === selectedTemplateId);
    if (!selected) return { template: null, reason: `The selected ${audience} template is not published or does not match this audience.` };
    const selectedLine = templateServiceKey(selected.service_type);
    const wantedLine = templateServiceKey(serviceType);
    if (selectedLine && selectedLine !== wantedLine) return { template: null, reason: `The selected template is for ${selected.service_type}, not ${serviceType}.` };
    return { template: selected };
  }
  if (published.length === 0) {
    return {
      template: null,
      reason: `No ${audience === 'talent' ? 'candidate' : 'client'} contract template has been `
        + 'published yet. Restore the standard templates in Contracts, have them reviewed, and '
        + 'publish the one for this service line.'
    };
  }

  const wanted = String(serviceType || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  const exact = published.find((row: any) =>
    String(row.service_type || '').trim().toLowerCase().replace(/[\s-]+/g, '_') === wanted);

  if (exact) return { template: exact };

  const generic = published.find((row: any) => !row.service_type);
  if (generic) return { template: generic };

  return {
    template: null,
    reason: `No ${audience === 'talent' ? 'candidate' : 'client'} template is published for `
      + `${serviceType || 'this service line'}. Publish one before generating this contract.`
  };
}
