/**
 * Roles, and what each one can see.
 *
 * Three different lists disagreed about what a role even is. The database
 * CHECK allowed twelve values, including title-case duplicates of four of
 * them ('Super Admin' alongside 'super_admin'), so the same person could be
 * stored two ways and compared unequal. The admin panel accepted seven. The
 * vetting pipeline named a Skill Assessor that no list contained, and the
 * scope asked for a finance role that existed nowhere at all.
 *
 * Worse, none of it was enforced: every accepted role string opened the same
 * thirteen tabs. A skill assessor could read contracts, and an account
 * manager could change anyone's vetting grade.
 *
 * Settled on 2 November 2026: six roles, listed below, stored in snake_case.
 * The legacy spellings still normalise so existing rows keep working.
 *
 * This file imports nothing, so it can be tested on its own.
 */

export const ADMIN_ROLES = [
  'super_admin',
  'account_manager',
  'talent_manager',
  'ops_manager',
  'finance',
  'skill_assessor'
] as const;

export type AdminRole = typeof ADMIN_ROLES[number];
export type PortalRole = AdminRole | 'client' | 'talent';

/** Every tab the admin portal can show. */
export const ADMIN_TABS = [
  'overview', 'talent-pipeline', 'vetting', 'client-pipeline', 'hiring-requests',
  'interviews', 'offers', 'contracts', 'compliance', 'assessments', 'matching',
  'finance', 'support', 'workflows', 'notifications', 'audit', 'users', 'settings',
  'remotan-overview', 'remotan-clients', 'remotan-talent', 'remotan-payroll'
] as const;

export type AdminTabKey = typeof ADMIN_TABS[number];

/**
 * What each role sees.
 *
 * Deliberately a allow-list per role rather than a deny-list: a tab added
 * later is invisible until someone decides who should have it, which is the
 * safer direction to fail in.
 */
const TAB_ACCESS: Record<AdminRole, AdminTabKey[] | 'all'> = {
  // Everything, including the two screens that can change who else has access.
  super_admin: 'all',

  // The client side of the business.
  account_manager: [
    'overview', 'client-pipeline', 'hiring-requests', 'matching',
    'interviews', 'offers', 'contracts', 'support', 'notifications'
  ],

  // The talent side.
  talent_manager: [
    'overview', 'talent-pipeline', 'vetting', 'assessments', 'matching',
    'interviews', 'compliance', 'support', 'notifications'
  ],

  // Runs the operation day to day. Everything except money and user admin.
  ops_manager: [
    'overview', 'talent-pipeline', 'vetting', 'client-pipeline', 'hiring-requests',
    'interviews', 'offers', 'contracts', 'compliance', 'assessments', 'matching',
    'support', 'workflows', 'notifications', 'audit',
    'remotan-overview', 'remotan-clients', 'remotan-talent'
  ],

  // Money only. No access to candidate profiles or vetting.
  finance: [
    'overview', 'finance', 'contracts', 'notifications', 'remotan-payroll'
  ],

  // Marks assessments. Named by VETTING_STAGES as responsible for stage 1,
  // and until now could not exist as a role at all.
  skill_assessor: [
    'overview', 'assessments', 'vetting', 'notifications'
  ]
};

/** Legacy spellings, and what they mean now. */
const ROLE_ALIASES: Record<string, AdminRole | 'client' | 'talent'> = {
  superadmin: 'super_admin',
  super_admin: 'super_admin',
  'super admin': 'super_admin',
  // 'admin' was a catch-all that meant nothing specific. Existing rows with
  // it are treated as ops_manager, which is the closest real job, rather
  // than silently granted everything.
  admin: 'ops_manager',
  operations_manager: 'ops_manager',
  'operations manager': 'ops_manager',
  ops_manager: 'ops_manager',
  account_manager: 'account_manager',
  'account manager': 'account_manager',
  talent_manager: 'talent_manager',
  'talent manager': 'talent_manager',
  finance: 'finance',
  finance_manager: 'finance',
  skill_assessor: 'skill_assessor',
  'skill assessor': 'skill_assessor',
  assessor: 'skill_assessor',
  client: 'client',
  talent: 'talent'
};

/** Lower-cases and collapses spaces and hyphens to underscores. */
export function normalizeRole(role: unknown): string {
  return String(role || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
}

/** The canonical role for any stored value, or null when unrecognised. */
export function resolveRole(role: unknown): PortalRole | null {
  const raw = String(role || '').trim().toLowerCase();
  const normalized = normalizeRole(role);
  return (ROLE_ALIASES[normalized] || ROLE_ALIASES[raw] || null) as PortalRole | null;
}

export function isAdminRole(role: unknown): boolean {
  const resolved = resolveRole(role);
  return resolved !== null && (ADMIN_ROLES as readonly string[]).includes(resolved);
}

/** Only a super admin may change who else has access. */
export function canManageUsers(role: unknown): boolean {
  return resolveRole(role) === 'super_admin';
}

export function canAccessTab(role: unknown, tab: string): boolean {
  const resolved = resolveRole(role);
  if (!resolved || !isAdminRole(resolved)) return false;

  const allowed = TAB_ACCESS[resolved as AdminRole];
  if (allowed === 'all') return true;
  return (allowed as readonly string[]).includes(tab);
}

/** The tabs a role should see, in the order ADMIN_TABS declares. */
export function tabsForRole(role: unknown): AdminTabKey[] {
  const resolved = resolveRole(role);
  if (!resolved || !isAdminRole(resolved)) return [];

  const allowed = TAB_ACCESS[resolved as AdminRole];
  if (allowed === 'all') return [...ADMIN_TABS];
  return ADMIN_TABS.filter(tab => (allowed as readonly string[]).includes(tab));
}

/** For a role picker. */
export const ROLE_LABELS: Record<AdminRole, string> = {
  super_admin: 'Super Admin',
  account_manager: 'Account Manager',
  talent_manager: 'Talent Manager',
  ops_manager: 'Operations Manager',
  finance: 'Finance',
  skill_assessor: 'Skill Assessor'
};

export const ROLE_DESCRIPTIONS: Record<AdminRole, string> = {
  super_admin: 'Everything, including adding and removing other operators.',
  account_manager: 'Clients, their requests, shortlists, offers and contracts.',
  talent_manager: 'Candidates, vetting, assessments and matching.',
  ops_manager: 'Day-to-day operations. No finance and no user administration.',
  finance: 'Invoices, payouts, payroll and revenue. No candidate profiles.',
  skill_assessor: 'Marks skill assessments and enters stage scores.'
};

/**
 * Which role to store for a user.
 *
 * Replaces getDatabaseSafeAdminRole, which returned 'ops_manager' or 'admin'
 * based only on whether the user was assignable as an operations manager —
 * so saving a request that assigned someone as its account manager rewrote
 * that person's role to 'admin' and quietly took their real permissions
 * away. A user's role is theirs; being assigned to a request is not a role
 * change, and nothing here derives one from an assignment.
 */
export function storableRole(role: unknown, fallback: AdminRole = 'ops_manager'): AdminRole {
  const resolved = resolveRole(role);
  if (resolved && (ADMIN_ROLES as readonly string[]).includes(resolved)) {
    return resolved as AdminRole;
  }
  return fallback;
}

/** Who may be assigned as a request's account manager. */
export function isAccountManagerAssignable(role: unknown): boolean {
  const resolved = resolveRole(role);
  return resolved === 'account_manager' || resolved === 'ops_manager' || resolved === 'super_admin';
}

/** Who may be assigned as a request's talent manager. */
export function isTalentManagerAssignable(role: unknown): boolean {
  const resolved = resolveRole(role);
  return resolved === 'talent_manager' || resolved === 'ops_manager' || resolved === 'super_admin';
}
