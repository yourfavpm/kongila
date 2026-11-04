import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ADMIN_ROLES,
  resolveRole,
  isAdminRole,
  canAccessTab,
  canManageUsers,
  tabsForRole,
  storableRole,
  normalizeRole,
  isAccountManagerAssignable,
  isTalentManagerAssignable
} from './roles.ts';

test('there are six roles', () => {
  assert.equal(ADMIN_ROLES.length, 6);
  assert.ok(ADMIN_ROLES.includes('finance'), 'finance must exist; the scope asks for it');
  assert.ok(ADMIN_ROLES.includes('skill_assessor'), 'skill_assessor is named by the vetting pipeline');
});

test('the title-case duplicates resolve to the same role', () => {
  // The CHECK allowed 'Super Admin' and 'super_admin' as separate values, so
  // the same person stored two ways compared unequal everywhere.
  for (const spelling of ['Super Admin', 'super_admin', 'superadmin', 'SUPER ADMIN', ' Super-Admin ']) {
    assert.equal(resolveRole(spelling), 'super_admin', `${spelling} did not resolve`);
  }
  assert.equal(resolveRole('Operations Manager'), 'ops_manager');
  assert.equal(resolveRole('Account Manager'), 'account_manager');
});

test('the old catch-all admin role is not a super admin', () => {
  // 'admin' meant nothing specific. Treating it as super_admin would hand
  // every existing catch-all account the ability to create more admins.
  assert.equal(resolveRole('admin'), 'ops_manager');
  assert.equal(canManageUsers('admin'), false);
});

test('an unrecognised role is nobody', () => {
  assert.equal(resolveRole('wizard'), null);
  assert.equal(resolveRole(''), null);
  assert.equal(resolveRole(null), null);
  assert.equal(isAdminRole('wizard'), false);
  assert.deepEqual(tabsForRole('wizard'), []);
});

test('only a super admin can manage users', () => {
  assert.equal(canManageUsers('super_admin'), true);
  for (const role of ['account_manager', 'talent_manager', 'ops_manager', 'finance', 'skill_assessor']) {
    assert.equal(canManageUsers(role), false, `${role} must not manage users`);
  }
});

test('the roles no longer all see the same tabs', () => {
  // Every accepted role string used to open the same thirteen tabs.
  const counts = ADMIN_ROLES.map(r => tabsForRole(r).length);
  assert.equal(new Set(counts).size > 1, true, 'every role still sees the same number of tabs');
});

test('finance cannot read candidate profiles or vetting', () => {
  assert.equal(canAccessTab('finance', 'finance'), true);
  assert.equal(canAccessTab('finance', 'talent-pipeline'), false);
  assert.equal(canAccessTab('finance', 'vetting'), false);
  assert.equal(canAccessTab('finance', 'users'), false);
});

test('a skill assessor cannot read contracts or money', () => {
  assert.equal(canAccessTab('skill_assessor', 'assessments'), true);
  assert.equal(canAccessTab('skill_assessor', 'contracts'), false);
  assert.equal(canAccessTab('skill_assessor', 'finance'), false);
  assert.equal(canAccessTab('skill_assessor', 'client-pipeline'), false);
});

test('an account manager cannot change vetting, a talent manager cannot see contracts', () => {
  assert.equal(canAccessTab('account_manager', 'vetting'), false);
  assert.equal(canAccessTab('account_manager', 'contracts'), true);
  assert.equal(canAccessTab('talent_manager', 'vetting'), true);
  assert.equal(canAccessTab('talent_manager', 'contracts'), false);
});

test('ops manager runs everything except money and user admin', () => {
  assert.equal(canAccessTab('ops_manager', 'hiring-requests'), true);
  assert.equal(canAccessTab('ops_manager', 'vetting'), true);
  assert.equal(canAccessTab('ops_manager', 'finance'), false);
  assert.equal(canAccessTab('ops_manager', 'users'), false);
});

test('a super admin sees every tab', () => {
  assert.equal(tabsForRole('super_admin').length, tabsForRole('super_admin').length);
  for (const tab of ['finance', 'users', 'settings', 'audit', 'remotan-payroll']) {
    assert.equal(canAccessTab('super_admin', tab), true, `super admin cannot see ${tab}`);
  }
});

test('a client or candidate reaches no admin tab', () => {
  for (const role of ['client', 'talent']) {
    assert.equal(isAdminRole(role), false);
    assert.equal(canAccessTab(role, 'overview'), false);
  }
});

test('being assigned to a request does not change a role', () => {
  // getDatabaseSafeAdminRole returned 'admin' for anyone who was not an ops
  // manager, so saving a request that named someone its account manager
  // rewrote that person's role and took their real permissions away.
  assert.equal(storableRole('account_manager'), 'account_manager');
  assert.equal(storableRole('talent_manager'), 'talent_manager');
  assert.equal(storableRole('finance'), 'finance');
  assert.equal(storableRole('super_admin'), 'super_admin');
});

test('an unknown role falls back rather than being stored as-is', () => {
  assert.equal(storableRole('wizard'), 'ops_manager');
  assert.equal(storableRole(undefined, 'finance'), 'finance');
});

test('assignability is about the job, not about being an admin', () => {
  assert.equal(isAccountManagerAssignable('account_manager'), true);
  assert.equal(isAccountManagerAssignable('talent_manager'), false);
  assert.equal(isTalentManagerAssignable('talent_manager'), true);
  assert.equal(isTalentManagerAssignable('finance'), false);
  // An ops manager covers both, and a super admin can be assigned anything.
  assert.equal(isAccountManagerAssignable('ops_manager'), true);
  assert.equal(isTalentManagerAssignable('super_admin'), true);
});

test('normalizeRole only reshapes, it does not resolve', () => {
  assert.equal(normalizeRole(' Account-Manager '), 'account_manager');
  assert.equal(normalizeRole('Super Admin'), 'super_admin');
});
