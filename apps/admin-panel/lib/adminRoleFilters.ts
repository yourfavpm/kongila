export type AssignableUser = {
  id: string;
  name?: string | null;
  email?: string | null;
  role?: string | null;
  platform_access?: string[] | string | null;
  assignedRoleIds?: string[];
  assignedRoleNames?: string[];
};

const normalizeRoleKey = (role: any) =>
  String(role || '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');

const getPlatformAccessRoles = (user: AssignableUser) => {
  const access = user.platform_access;
  if (Array.isArray(access)) return access;
  if (typeof access === 'string') return access.split(',');
  return [];
};

export const getUserRoleKeys = (user: AssignableUser) => {
  const keys = new Set<string>();
  [
    user.role,
    ...(user.assignedRoleIds || []),
    ...(user.assignedRoleNames || []),
    ...getPlatformAccessRoles(user),
  ].forEach((role) => {
    const key = normalizeRoleKey(role);
    if (key) keys.add(key);
  });
  return keys;
};

export const enrichUsersWithRoleAssignments = (
  users: any[] = [],
  roles: any[] = [],
  userRoles: any[] = [],
): AssignableUser[] => {
  const roleNameById = new Map<string, string>();
  roles.forEach((role) => {
    if (role?.id) roleNameById.set(role.id, role.name || role.id);
  });

  const assignmentsByUserId = new Map<string, { ids: string[]; names: string[] }>();
  userRoles.forEach((assignment) => {
    if (!assignment?.user_id || !assignment?.role_id) return;
    const existing = assignmentsByUserId.get(assignment.user_id) || { ids: [], names: [] };
    existing.ids.push(assignment.role_id);
    const roleName = roleNameById.get(assignment.role_id);
    if (roleName) existing.names.push(roleName);
    assignmentsByUserId.set(assignment.user_id, existing);
  });

  return users.map((user) => {
    const assignments = assignmentsByUserId.get(user.id) || { ids: [], names: [] };
    return {
      ...user,
      assignedRoleIds: assignments.ids,
      assignedRoleNames: assignments.names,
    };
  });
};

const hasAnyRole = (user: AssignableUser, allowedRoles: string[]) => {
  const keys = getUserRoleKeys(user);
  return allowedRoles.some((role) => keys.has(normalizeRoleKey(role)));
};

export const isAccountManagerAssignable = (user: AssignableUser) =>
  hasAnyRole(user, [
    'super_admin',
    'superadmin',
    'account_manager',
    'operations_manager',
    'ops_manager',
  ]);

export const isTalentManagerAssignable = (user: AssignableUser) =>
  hasAnyRole(user, [
    'super_admin',
    'superadmin',
    'talent_manager',
  ]);

export const formatAssignableUserLabel = (user: AssignableUser) => {
  const label = user.name || user.email || user.id;
  const roleLabels = Array.from(getUserRoleKeys(user)).slice(0, 3).join(', ');
  return roleLabels ? `${label} (${roleLabels})` : label;
};
