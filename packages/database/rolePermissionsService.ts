/**
 * What each role may do, as decided by the super admin rather than by code.
 *
 * The defaults live in @kongila/auth and are the six roles exactly as they
 * behaved before any of this existed. This stores the differences.
 *
 * It uses platform_settings rather than a table of its own, deliberately.
 * One jsonb row holds the whole matrix, so there is no migration to run
 * against a live database, the row seeds itself the first time it is saved,
 * and a permission removed in a later release is dropped on read instead of
 * silently granting nothing.
 *
 * Cached for a minute, like settings: it is read on every admin API call and
 * changes perhaps monthly. Any write clears the cache, so a super admin
 * watching the screen sees the change take hold immediately.
 */

import { getSupabaseClient } from './index';
import type { RequestActor as Actor } from './scope';
import { recordAudit } from './audit';
import {
  ADMIN_ROLES,
  ROLE_LABELS,
  PERMISSIONS,
  PERMISSION_KEYS,
  DEFAULT_ROLE_PERMISSIONS,
  effectivePermissions,
  sanitizePermissions,
  unknownPermissions,
  permissionDefinition,
  resolveRole,
  hasPermission,
  type AdminRole,
  type RolePermissionOverrides
} from '@kongila/auth';

export const ROLE_PERMISSIONS_KEY = 'role_permissions';

export interface RolePermissionsResult<T = any> {
  ok: boolean;
  status: number;
  error?: string;
  data?: T;
  warnings?: string[];
}

const CACHE_MS = 60_000;
let cache: { overrides: RolePermissionOverrides; readAt: number } | null = null;

export function clearRolePermissionsCache(): void {
  cache = null;
}

/**
 * The saved matrix, or an empty one.
 *
 * Never throws. A database that cannot be reached falls back to the
 * defaults, because an operator locked out of every screen by a transient
 * read failure is worse than one running on the shipped permissions.
 */
export async function getRolePermissionOverrides(): Promise<RolePermissionOverrides> {
  if (cache && Date.now() - cache.readAt < CACHE_MS) return cache.overrides;

  const overrides: RolePermissionOverrides = {};

  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('platform_settings')
      .select('value')
      .eq('key', ROLE_PERMISSIONS_KEY)
      .maybeSingle();

    if (error) {
      console.warn(`[role-permissions] could not read, using defaults: ${error.message}`);
      return overrides;
    }

    const stored = (data?.value || {}) as Record<string, unknown>;
    for (const role of ADMIN_ROLES) {
      // Super admin is never stored and never read: it always has everything.
      if (role === 'super_admin') continue;
      const saved = (stored as any)[role];
      if (Array.isArray(saved)) overrides[role] = sanitizePermissions(saved);
    }
  } catch (err: any) {
    console.warn(`[role-permissions] could not read, using defaults: ${err?.message}`);
    return overrides;
  }

  cache = { overrides, readAt: Date.now() };
  return overrides;
}

/** What one role may do right now, overrides applied. */
export async function permissionsForRole(role: unknown): Promise<string[]> {
  const overrides = await getRolePermissionOverrides();
  return effectivePermissions(role, overrides);
}

/**
 * The whole matrix, for the screen that edits it.
 *
 * Returns the catalogue as well as the grants, so the screen does not have
 * to keep its own copy of what a permission means.
 */
export async function listRolePermissions(actor: Actor): Promise<RolePermissionsResult> {
  if (!actor) return { ok: false, status: 401, error: 'Not authenticated.' };
  if (actor.kind !== 'admin') return { ok: false, status: 403, error: 'Not authorised.' };

  const overrides = await getRolePermissionOverrides();
  const editable = await actorCanEdit(actor);

  return {
    ok: true,
    status: 200,
    data: {
      permissions: PERMISSIONS,
      roles: ADMIN_ROLES.map(role => ({
        role,
        label: ROLE_LABELS[role],
        permissions: effectivePermissions(role, overrides),
        defaults: DEFAULT_ROLE_PERMISSIONS[role],
        customised: Array.isArray(overrides[role]),
        // Super admin is fixed, so the screen can show it read-only rather
        // than offering an edit that will be refused.
        editable: editable && role !== 'super_admin'
      })),
      canEdit: editable
    }
  };
}

async function actorCanEdit(actor: Actor): Promise<boolean> {
  if (!actor || actor.kind !== 'admin') return false;
  const overrides = await getRolePermissionOverrides();
  return hasPermission(actor.role, 'users.manage', overrides);
}

/**
 * Saves what a role may do.
 *
 * Refused for super_admin: the role exists so somebody can always get back
 * in, and an editable super admin is one mis-click from a platform nobody
 * can administer.
 */
export async function updateRolePermissions(
  actor: Actor,
  input: { role: string; permissions: string[] }
): Promise<RolePermissionsResult> {
  if (!actor) return { ok: false, status: 401, error: 'Not authenticated.' };
  if (!(await actorCanEdit(actor))) {
    return { ok: false, status: 403, error: 'Only an operator who can manage users may change permissions.' };
  }

  const role = resolveRole(input.role);
  if (!role || !(ADMIN_ROLES as readonly string[]).includes(role)) {
    return { ok: false, status: 400, error: `"${input.role}" is not one of the six roles.` };
  }
  if (role === 'super_admin') {
    return {
      ok: false,
      status: 409,
      error: 'Super Admin always has every permission. Change who holds the role instead.'
    };
  }
  if (!Array.isArray(input.permissions)) {
    return { ok: false, status: 400, error: 'permissions must be a list.' };
  }

  const clean = sanitizePermissions(input.permissions);
  const dropped = unknownPermissions(input.permissions);

  const warnings: string[] = [];
  if (dropped.length) {
    warnings.push(`Ignored ${dropped.length} unrecognised permission${dropped.length === 1 ? '' : 's'}: ${dropped.join(', ')}.`);
  }
  if (clean.length === 0) {
    warnings.push(`${ROLE_LABELS[role as AdminRole]} now has no permissions at all. Anyone with that role will sign in to an empty dashboard.`);
  }
  for (const key of clean) {
    const definition = permissionDefinition(key);
    if (definition?.escalates) {
      warnings.push(
        `${ROLE_LABELS[role as AdminRole]} can now ${definition.label.toLowerCase()}, `
        + 'which lets anyone with that role give themselves every other permission.'
      );
    }
  }

  const supabase = getSupabaseClient();
  const before = await getRolePermissionOverrides();

  const next: Record<string, string[]> = {};
  for (const existing of ADMIN_ROLES) {
    if (existing === 'super_admin') continue;
    if (existing === role) continue;
    if (Array.isArray(before[existing])) next[existing] = before[existing] as string[];
  }
  next[role] = clean;

  // Upsert, so the row seeds itself the first time anybody saves and there
  // is no migration to remember to run.
  const { error } = await supabase
    .from('platform_settings')
    .upsert({
      key: ROLE_PERMISSIONS_KEY,
      value: next,
      category: 'access',
      description: 'What each admin role may do. Edited from Operators > Permissions.',
      updated_at: new Date().toISOString(),
      updated_by: actor.email || actor.userId
    }, { onConflict: 'key' });

  if (error) return { ok: false, status: 500, error: error.message };

  clearRolePermissionsCache();

  const previous = effectivePermissions(role, before);
  const added = clean.filter(key => !previous.includes(key));
  const removed = previous.filter(key => !clean.includes(key));

  await recordAudit(actor, {
    action: 'Change Role Permissions',
    details:
      `${ROLE_LABELS[role as AdminRole]}: `
      + (added.length ? `granted ${added.join(', ')}. ` : '')
      + (removed.length ? `revoked ${removed.join(', ')}.` : '')
      + (!added.length && !removed.length ? 'no change.' : ''),
    entityType: 'role',
    entityId: role
  });

  return {
    ok: true,
    status: 200,
    data: { role, permissions: clean, added, removed },
    warnings
  };
}

/** Puts a role back to what it shipped with. */
export async function resetRolePermissions(
  actor: Actor,
  input: { role: string }
): Promise<RolePermissionsResult> {
  const role = resolveRole(input.role);
  if (!role || !(ADMIN_ROLES as readonly string[]).includes(role)) {
    return { ok: false, status: 400, error: `"${input.role}" is not one of the six roles.` };
  }
  return updateRolePermissions(actor, {
    role,
    permissions: DEFAULT_ROLE_PERMISSIONS[role as AdminRole]
  });
}

/** Every permission there is, for a screen that wants the catalogue alone. */
export function permissionCatalogue() {
  return { permissions: PERMISSIONS, keys: PERMISSION_KEYS };
}
