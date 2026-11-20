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
  'interviews', 'offers', 'contracts', 'engagements', 'templates', 'compliance', 'assessments', 'matching',
  'finance', 'payroll', 'support', 'messages', 'workflows', 'notifications',
  'audit', 'users', 'settings',
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
    'interviews', 'offers', 'contracts', 'engagements', 'support', 'notifications'
  ],

  // The talent side.
  talent_manager: [
    'overview', 'talent-pipeline', 'vetting', 'assessments', 'matching',
    'interviews', 'engagements', 'compliance', 'support', 'notifications'
  ],

  // Runs the operation day to day. Everything except money and user admin.
  ops_manager: [
    'overview', 'talent-pipeline', 'vetting', 'client-pipeline', 'hiring-requests',
    'interviews', 'offers', 'contracts', 'engagements', 'templates', 'compliance', 'assessments',
    'matching', 'support', 'workflows', 'notifications', 'audit',
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

// ─── Permissions ─────────────────────────────────────────────────────────────
/**
 * What an operator may actually do.
 *
 * Roles answered this until now, and they answered it in code: TAB_ACCESS in
 * roles.ts is a fixed list per role, so changing what a Finance operator can
 * see meant a developer, a deploy and a wait. That is the wrong place for a
 * decision the person running the business makes.
 *
 * Two things change here.
 *
 * First, permission is the unit, not the role. A role is a named bundle of
 * permissions, and the bundle is editable. The defaults below are exactly
 * what the six roles could do before, so nothing moves until someone decides
 * it should.
 *
 * Second, a permission is not only a tab. Seeing the offers screen and
 * approving an offer are different powers, and collapsing them is how an
 * account manager ends up able to approve their own deals. Viewing
 * permissions are named `view:<tab>`; everything that changes something is
 * named for the action.
 *
 * This file imports nothing, so it can be tested on its own.
 */


export interface PermissionDefinition {
  key: string;
  label: string;
  group: string;
  description: string;
  /**
   * Granting this lets the holder change who else has access, which means
   * they can grant themselves anything. Shown with a warning, and never
   * given to a role by default.
   */
  escalates?: boolean;
}

/** A readable name for each tab, for the permissions screen. */
const TAB_LABELS: Record<AdminTabKey, { label: string; group: string }> = {
  overview: { label: 'Overview', group: 'Kongila' },
  'talent-pipeline': { label: 'Talent pipeline', group: 'Talent' },
  vetting: { label: 'Vetting', group: 'Talent' },
  assessments: { label: 'Assessments', group: 'Talent' },
  'client-pipeline': { label: 'Client pipeline', group: 'Clients' },
  'hiring-requests': { label: 'Hiring requests', group: 'Clients' },
  matching: { label: 'Matching', group: 'Clients' },
  interviews: { label: 'Interviews', group: 'Hiring' },
  offers: { label: 'Offers', group: 'Hiring' },
  contracts: { label: 'Contracts', group: 'Hiring' },
  engagements: { label: 'Active work', group: 'Hiring' },
  templates: { label: 'Contract templates', group: 'Hiring' },
  compliance: { label: 'Compliance', group: 'Hiring' },
  finance: { label: 'Finance', group: 'Money' },
  payroll: { label: 'Payroll', group: 'Money' },
  messages: { label: 'Messages', group: 'Operations' },
  support: { label: 'Support', group: 'Operations' },
  workflows: { label: 'Workflows', group: 'Operations' },
  notifications: { label: 'Notifications', group: 'Operations' },
  audit: { label: 'Audit log', group: 'Operations' },
  users: { label: 'Operators', group: 'Administration' },
  settings: { label: 'Settings', group: 'Administration' },
  'remotan-overview': { label: 'Remotan overview', group: 'Remotan' },
  'remotan-clients': { label: 'Remotan clients', group: 'Remotan' },
  'remotan-talent': { label: 'Remotan talent', group: 'Remotan' },
  'remotan-payroll': { label: 'Remotan payroll', group: 'Remotan' }
};

/** The permission that opens each tab. */
export const TAB_PERMISSIONS: Record<AdminTabKey, string> = ADMIN_TABS.reduce((map, tab) => {
  map[tab] = `view:${tab}`;
  return map;
}, {} as Record<AdminTabKey, string>);

/**
 * Permissions that change something, as opposed to opening a screen.
 *
 * Each one is checked on the server by the route that performs it, so
 * removing it from a role actually stops the action rather than hiding the
 * button that starts it.
 */
export const ACTION_PERMISSIONS: PermissionDefinition[] = [
  {
    key: 'talent.vet',
    label: 'Record vetting decisions',
    group: 'Talent',
    description: 'Pass, fail or grade a candidate at any vetting stage.'
  },
  {
    key: 'talent.assess',
    label: 'Mark assessments',
    group: 'Talent',
    description: 'Assign skill assessments and enter scores.'
  },
  {
    key: 'talent.manage',
    label: 'Edit candidate records',
    group: 'Talent',
    description: 'Change a candidate profile, status or talent manager.'
  },
  {
    key: 'requests.manage',
    label: 'Manage hiring requests',
    group: 'Clients',
    description: 'Change a request status, assign managers, log client calls.'
  },
  {
    key: 'matching.submit',
    label: 'Send shortlists to clients',
    group: 'Clients',
    description: 'Release matched candidates into a client dashboard.'
  },
  {
    key: 'interviews.manage',
    label: 'Run interviews',
    group: 'Hiring',
    description: 'Send requests to talent, schedule, reschedule and record outcomes.'
  },
  {
    key: 'offers.approve',
    label: 'Approve or decline offers',
    group: 'Hiring',
    description: 'Decide on a client offer before the candidate ever sees it.'
  },
  {
    key: 'contracts.manage',
    label: 'Issue and sign contracts',
    group: 'Hiring',
    description: 'Generate a contract and countersign on behalf of Kongila.'
  },
  {
    key: 'compliance.manage',
    label: 'Manage compliance',
    group: 'Hiring',
    description: 'Approve documents and clear compliance holds.'
  },
  {
    key: 'finance.manage',
    label: 'Manage money',
    group: 'Money',
    description: 'Raise invoices, record payments and run payroll.'
  },
  {
    key: 'invoices.manage',
    label: 'Prepare and send client invoices',
    group: 'Money',
    description: 'Create, edit and send invoices for assigned client accounts.'
  },
  {
    key: 'support.manage',
    label: 'Answer support tickets',
    group: 'Operations',
    description: 'Reply to and close tickets from clients and candidates.'
  },
  {
    key: 'settings.manage',
    label: 'Change platform settings',
    group: 'Administration',
    description: 'Fees, thresholds, reminder timings and other platform-wide values.'
  },
  {
    key: 'users.manage',
    label: 'Manage operators and permissions',
    group: 'Administration',
    description:
      'Invite operators, change their roles, and edit what every role can do. '
      + 'Anyone with this can give themselves every other permission.',
    escalates: true
  }
];

/** Every permission, view permissions first, in tab order. */
export const PERMISSIONS: PermissionDefinition[] = [
  ...ADMIN_TABS.map(tab => ({
    key: TAB_PERMISSIONS[tab],
    label: `See ${TAB_LABELS[tab].label.toLowerCase()}`,
    group: TAB_LABELS[tab].group,
    description: `Opens the ${TAB_LABELS[tab].label} screen.`
  })),
  ...ACTION_PERMISSIONS
];

export const PERMISSION_KEYS: string[] = PERMISSIONS.map(permission => permission.key);

const PERMISSION_SET = new Set(PERMISSION_KEYS);

export function isPermissionKey(key: unknown): boolean {
  return PERMISSION_SET.has(String(key || ''));
}

export function permissionDefinition(key: string): PermissionDefinition | null {
  return PERMISSIONS.find(permission => permission.key === key) || null;
}

/**
 * What each role can do out of the box.
 *
 * The view permissions reproduce exactly what TAB_ACCESS allowed before, so
 * upgrading changes nobody's access. The action permissions are new, and are
 * granted to the role that was already doing that work in practice.
 */
export const DEFAULT_ROLE_PERMISSIONS: Record<AdminRole, string[]> = {
  // Everything. A super admin with a gap in their permissions is a lockout
  // waiting to happen, so this one is not editable anywhere.
  super_admin: [...PERMISSION_KEYS],

  account_manager: [
    'view:overview', 'view:client-pipeline', 'view:hiring-requests', 'view:matching',
    'view:interviews', 'view:offers', 'view:contracts', 'view:engagements',
    'view:support', 'view:notifications',
    'requests.manage', 'matching.submit', 'interviews.manage', 'contracts.manage',
    'invoices.manage', 'support.manage'
  ],

  talent_manager: [
    'view:overview', 'view:talent-pipeline', 'view:vetting', 'view:assessments', 'view:matching',
    'view:interviews', 'view:engagements', 'view:compliance', 'view:support',
    'view:notifications',
    'talent.vet', 'talent.assess', 'talent.manage', 'interviews.manage', 'support.manage'
  ],

  ops_manager: [
    'view:overview', 'view:talent-pipeline', 'view:vetting', 'view:client-pipeline',
    'view:hiring-requests', 'view:interviews', 'view:offers', 'view:contracts',
    'view:engagements', 'view:templates', 'view:compliance', 'view:assessments', 'view:matching',
    'view:support', 'view:workflows',
    'view:notifications', 'view:audit',
    'view:remotan-overview', 'view:remotan-clients', 'view:remotan-talent',
    'talent.vet', 'talent.assess', 'talent.manage', 'requests.manage', 'matching.submit',
    'interviews.manage', 'offers.approve', 'contracts.manage', 'compliance.manage',
    'support.manage'
  ],

  finance: [
    'view:overview', 'view:finance', 'view:contracts', 'view:notifications',
    'view:remotan-payroll',
    'finance.manage'
  ],

  skill_assessor: [
    'view:overview', 'view:assessments', 'view:vetting', 'view:notifications',
    'talent.assess'
  ]
};

/** What a super admin has saved, if anything. Roles absent here use the defaults. */
export type RolePermissionOverrides = Partial<Record<AdminRole, string[]>>;

/**
 * Drops anything that is not a real permission and de-duplicates the rest.
 *
 * A stored list outlives the code that wrote it: a permission removed in a
 * later release is still sitting in the database, and a typo would otherwise
 * grant nothing silently.
 */
export function sanitizePermissions(permissions: unknown): string[] {
  if (!Array.isArray(permissions)) return [];
  const seen = new Set<string>();
  for (const entry of permissions) {
    const key = String(entry || '').trim();
    if (PERMISSION_SET.has(key)) seen.add(key);
  }
  return PERMISSION_KEYS.filter(key => seen.has(key));
}

/** The names of anything stored that is no longer a permission, for reporting. */
export function unknownPermissions(permissions: unknown): string[] {
  if (!Array.isArray(permissions)) return [];
  return permissions
    .map(entry => String(entry || '').trim())
    .filter(key => key && !PERMISSION_SET.has(key));
}

/**
 * What a role can do, given what the super admin has saved.
 *
 * Super admin ignores overrides entirely. Everything that can change who has
 * access lives behind users.manage, and a super admin who can edit their own
 * permissions can lock the last one out of the platform with two clicks.
 */
export function effectivePermissions(
  role: unknown,
  overrides?: RolePermissionOverrides | null
): string[] {
  // resolveRole rather than a plain lowercase, so the legacy spellings still
  // in the users table ('admin', 'Super Admin', 'operations manager') land on
  // a real role instead of silently resolving to no permissions at all.
  const key = resolveRole(role);
  if (!key || !(ADMIN_ROLES as readonly string[]).includes(key)) return [];
  if (key === 'super_admin') return [...PERMISSION_KEYS];

  const saved = overrides?.[key as AdminRole];
  if (Array.isArray(saved)) return sanitizePermissions(saved);
  return [...DEFAULT_ROLE_PERMISSIONS[key as AdminRole]];
}

export function hasPermission(
  role: unknown,
  permission: string,
  overrides?: RolePermissionOverrides | null
): boolean {
  if (!isPermissionKey(permission)) return false;
  return effectivePermissions(role, overrides).includes(permission);
}

/** True when the holder of these permissions may open this tab. */
export function permissionsAllowTab(permissions: string[], tab: string): boolean {
  const required = TAB_PERMISSIONS[tab as AdminTabKey];
  if (!required) return false;
  return permissions.includes(required);
}

/** The tabs a set of permissions opens, in the order ADMIN_TABS declares. */
export function tabsForPermissions(permissions: string[]): AdminTabKey[] {
  return ADMIN_TABS.filter(tab => permissions.includes(TAB_PERMISSIONS[tab]));
}

/**
 * Whether a saved set would leave the role with nothing at all.
 *
 * Allowed, but worth saying out loud: a role with no permissions can sign in
 * and see an empty shell, which looks like a broken product rather than a
 * decision somebody made.
 */
export function isEmptyGrant(permissions: string[]): boolean {
  return permissions.length === 0;
}

/** Groups, in the order the screen should show them. */
export const PERMISSION_GROUPS: string[] = PERMISSIONS.reduce((groups: string[], permission) => {
  if (!groups.includes(permission.group)) groups.push(permission.group);
  return groups;
}, []);
