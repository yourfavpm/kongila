import type { NextApiRequest, NextApiResponse } from 'next';
import {
  requirePermission,
  getRequestUser,
  listTemplates,
  saveTemplate,
  restoreDefaultTemplates,
  publishTemplate,
  archiveTemplate,
  actorCan
} from '@kongila/database';
import { TEMPLATE_TOKENS } from '@kongila/contracts';

/**
 * Contract templates.
 *
 * The editor saved them by posting a contractTemplates array through
 * /api/db. writeDbAsync has no branch for that key, so every save was
 * parsed and dropped, and there was no table to put them in anyway. The
 * 2026-11-04b migration adds one.
 *
 * GET returns every template and the tokens a body may use, so the editor
 * can show what is available instead of the operator guessing.
 *
 * POST { id?, name, serviceType?, body, status? }  saves one
 * POST { action: 'restoreDefaults', overwrite? }   puts the four shipped
 *                                                  templates back, as drafts
 * POST { action: 'publish', id }                   publishes one, archiving
 *                                                  whatever it replaces
 * POST { action: 'archive', id }                    takes one out of use
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const actor = await getRequestUser(req);
  if (!actor) return res.status(401).json({ error: 'Not authenticated' });
  // What this operator may do, checked against the permission the super
  // admin granted the role rather than against the role's name. Hiding a
  // tab is not access control; this is where the refusal happens.
  if (req.method === 'GET') {
    // Templates have their own module and their own permission. The contract
    // screens still read this list to offer a template on a draft, so either
    // permission is enough to look.
    if (!actorCan(actor, 'view:templates') && !actorCan(actor, 'view:contracts')) {
      return res.status(403).json({ error: 'You do not have access to contract templates.' });
    }
  } else {
    const refused = requirePermission(actor, 'contracts.manage');
    if (refused) return res.status(refused.status).json({ error: refused.error });
  }


  if (req.method === 'GET') {
    const result = await listTemplates(actor);
    if (!result.ok) return res.status(result.status).json({ error: result.error });
    res.setHeader('Cache-Control', 'private, no-store');
    return res.status(200).json({ templates: result.data, tokens: TEMPLATE_TOKENS });
  }

  if (req.method === 'POST') {
    const body = (req.body || {}) as Record<string, any>;

    if (body.action === 'restoreDefaults') {
      const restored = await restoreDefaultTemplates(actor, { overwrite: Boolean(body.overwrite) });
      if (!restored.ok) return res.status(restored.status).json({ error: restored.error });
      return res.status(200).json({ ...restored.data, warnings: (restored as any).warnings || [] });
    }

    if (body.action === 'archive') {
      const archived = await archiveTemplate(actor, { id: String(body.id || '') });
      if (!archived.ok) return res.status(archived.status).json({ error: archived.error });
      return res.status(200).json({ ...archived.data, warnings: (archived as any).warnings || [] });
    }

    if (body.action === 'publish') {
      const published = await publishTemplate(actor, { id: String(body.id || '') });
      if (!published.ok) return res.status(published.status).json({ error: published.error });
      return res.status(200).json({ ...published.data, warnings: (published as any).warnings || [] });
    }

    const result = await saveTemplate(actor, {
      id: body.id,
      name: body.name,
      serviceType: body.serviceType,
      audience: body.audience,
      body: body.body,
      status: body.status
    });
    if (!result.ok) return res.status(result.status).json({ error: result.error });
    return res.status(result.status).json({ template: result.data });
  }

  res.setHeader('Allow', 'GET, POST');
  return res.status(405).json({ error: 'Method not allowed' });
}
