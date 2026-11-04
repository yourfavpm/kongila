/**
 * Platform settings.
 *
 * There was no configuration surface and no storage for one. The Schema type
 * has a `platformSettings` array that nothing reads or writes, `FeeConfig` is
 * a TypeScript interface with no table behind it, and every number that
 * should have been configurable was hardcoded at its call site — the grade
 * thresholds, the three-interview cap, the four-hour reschedule rule, the
 * reminder times. The platform fee had no value at all, which is why
 * analytics cannot report revenue.
 *
 * Settings are cached for a minute: they are read on most admin requests and
 * change perhaps monthly. Any write clears the cache, so an operator
 * changing one sees it immediately rather than wondering if it saved.
 */

import { getSupabaseClient } from './index';
import type { RequestActor as Actor } from './scope';
import { recordAudit } from './audit';
import { canManageUsers } from '@kongila/auth';

export interface SettingsResult<T = any> {
  ok: boolean;
  status: number;
  error?: string;
  data?: T;
}

export { SETTING_DEFAULTS, validateSetting } from './settingsRules';
import { SETTING_DEFAULTS, validateSetting } from './settingsRules';

const CACHE_MS = 60_000;
let cache: { values: Record<string, any>; readAt: number } | null = null;

export function clearSettingsCache(): void {
  cache = null;
}

/**
 * Every setting, defaults filled in.
 *
 * Never throws: a database that cannot be reached returns the defaults with
 * a warning, because a platform that stops working when the settings table
 * hiccups is worse than one running on known-good values.
 */
export async function getSettings(): Promise<Record<string, any>> {
  if (cache && Date.now() - cache.readAt < CACHE_MS) return cache.values;

  const values = { ...SETTING_DEFAULTS };

  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.from('platform_settings').select('key, value');

    if (error) {
      console.warn(`[settings] could not read platform_settings, using defaults: ${error.message}`);
      return values;
    }

    for (const row of data || []) {
      values[row.key] = row.value;
    }
  } catch (err: any) {
    console.warn(`[settings] could not read platform_settings, using defaults: ${err?.message}`);
    return values;
  }

  cache = { values, readAt: Date.now() };
  return values;
}

/** One setting, with its default. */
export async function getSetting<T = any>(key: string, fallback?: T): Promise<T> {
  const all = await getSettings();
  const value = all[key];
  if (value === undefined || value === null) {
    return (fallback !== undefined ? fallback : SETTING_DEFAULTS[key]) as T;
  }
  return value as T;
}

/** Everything, grouped for a settings screen. */
export async function listSettings(actor: Actor): Promise<SettingsResult> {
  if (!actor || actor.kind !== 'admin') return { ok: false, status: 403, error: 'Not authorised' };

  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('platform_settings')
    .select('*')
    .order('category')
    .order('key');

  if (error) return { ok: false, status: 500, error: error.message };

  return {
    ok: true,
    status: 200,
    data: (data || []).map((row: any) => ({
      key: row.key,
      value: row.value,
      description: row.description,
      category: row.category,
      updatedAt: row.updated_at,
      updatedBy: row.updated_by
    }))
  };
}

/**
 * Changes a setting.
 *
 * Super admin only, and every change is audited with its old and new value:
 * a platform fee or a grade threshold moving is exactly the kind of thing
 * someone needs to be able to trace later.
 */
export async function updateSetting(
  actor: Actor,
  input: { key: string; value: any }
): Promise<SettingsResult> {
  if (!actor) return { ok: false, status: 401, error: 'Not authenticated.' };
  if (!canManageUsers(actor.role)) {
    return { ok: false, status: 403, error: 'Only a super admin can change platform settings.' };
  }
  if (!input.key) return { ok: false, status: 400, error: 'key is required.' };

  const supabase = getSupabaseClient();

  const { data: existing } = await supabase
    .from('platform_settings')
    .select('key, value')
    .eq('key', input.key)
    .maybeSingle();

  if (!existing) {
    return { ok: false, status: 404, error: `"${input.key}" is not a platform setting.` };
  }

  const problem = validateSetting(input.key, input.value);
  if (problem) return { ok: false, status: 400, error: problem };

  const { error } = await supabase
    .from('platform_settings')
    .update({
      value: input.value,
      updated_at: new Date().toISOString(),
      updated_by: actor.email || actor.userId
    })
    .eq('key', input.key);

  if (error) return { ok: false, status: 500, error: error.message };

  clearSettingsCache();

  await recordAudit(actor, {
    action: 'Change Platform Setting',
    details: `${input.key}: ${JSON.stringify(existing.value)} to ${JSON.stringify(input.value)}.`,
    entityType: 'platform_setting',
    entityId: input.key
  });

  return { ok: true, status: 200, data: { key: input.key, value: input.value } };
}

