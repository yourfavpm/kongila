import test from 'node:test';
import assert from 'node:assert/strict';

import {
  PERMISSION_KEYS,
  DEFAULT_ROLE_PERMISSIONS,
  effectivePermissions,
  hasPermission,
  sanitizePermissions,
  unknownPermissions,
  tabsForPermissions,
  permissionsAllowTab,
  isPermissionKey,
  ADMIN_ROLES,
  tabsForRole
} from './roles.ts';

test('the defaults grant exactly the tabs each role could already open', () => {
  for (const role of ADMIN_ROLES) {
    const fromPermissions = tabsForPermissions(DEFAULT_ROLE_PERMISSIONS[role]);
    assert.deepEqual(fromPermissions, tabsForRole(role), `${role} lost or gained a tab`);
  }
});

test('a super admin has everything and cannot be edited down', () => {
  assert.deepEqual(effectivePermissions('super_admin'), PERMISSION_KEYS);
  const stripped = effectivePermissions('super_admin', { super_admin: [] });
  assert.deepEqual(stripped, PERMISSION_KEYS);
});

test('an override replaces the default for that role only', () => {
  const overrides = { finance: ['view:overview', 'view:finance'] };
  assert.deepEqual(effectivePermissions('finance', overrides), ['view:overview', 'view:finance']);
  assert.deepEqual(effectivePermissions('talent_manager', overrides), DEFAULT_ROLE_PERMISSIONS.talent_manager);
});

test('an empty override is a real decision, not a fallback to defaults', () => {
  assert.deepEqual(effectivePermissions('finance', { finance: [] }), []);
});

test('legacy and spaced role spellings resolve', () => {
  assert.deepEqual(effectivePermissions('Super Admin'), PERMISSION_KEYS);
  assert.deepEqual(effectivePermissions('ops-manager'), DEFAULT_ROLE_PERMISSIONS.ops_manager);
});

test('a client or an unknown role has no admin permissions', () => {
  assert.deepEqual(effectivePermissions('client'), []);
  assert.deepEqual(effectivePermissions('talent'), []);
  assert.deepEqual(effectivePermissions(''), []);
  assert.deepEqual(effectivePermissions(null), []);
});

test('only a super admin manages users by default', () => {
  for (const role of ADMIN_ROLES) {
    assert.equal(
      hasPermission(role, 'users.manage'),
      role === 'super_admin',
      `${role} should not manage users by default`
    );
  }
});

test('finance cannot touch candidates and talent managers cannot touch money', () => {
  assert.equal(hasPermission('finance', 'view:talent-pipeline'), false);
  assert.equal(hasPermission('finance', 'talent.vet'), false);
  assert.equal(hasPermission('talent_manager', 'finance.manage'), false);
  assert.equal(hasPermission('talent_manager', 'view:finance'), false);
});

test('an account manager cannot approve the offers they raise', () => {
  assert.equal(hasPermission('account_manager', 'view:offers'), true);
  assert.equal(hasPermission('account_manager', 'offers.approve'), false);
});

test('a skill assessor marks assessments but decides nothing else', () => {
  assert.equal(hasPermission('skill_assessor', 'talent.assess'), true);
  assert.equal(hasPermission('skill_assessor', 'talent.vet'), false);
  assert.equal(hasPermission('skill_assessor', 'view:contracts'), false);
});

test('a granted permission actually takes effect', () => {
  assert.equal(hasPermission('finance', 'view:audit'), false);
  assert.equal(
    hasPermission('finance', 'view:audit', { finance: ['view:overview', 'view:audit'] }),
    true
  );
});

test('rubbish in a stored list is dropped rather than granted', () => {
  assert.deepEqual(sanitizePermissions(['view:finance', 'view:nonsense', '', null]), ['view:finance']);
  assert.deepEqual(sanitizePermissions('view:finance' as any), []);
  assert.deepEqual(unknownPermissions(['view:finance', 'view:nonsense']), ['view:nonsense']);
});

test('a sanitized list keeps the catalogue order and de-duplicates', () => {
  const messy = ['users.manage', 'view:overview', 'view:overview', 'view:finance'];
  const cleaned = sanitizePermissions(messy);
  assert.deepEqual(cleaned, PERMISSION_KEYS.filter(key => messy.includes(key)));
});

test('a tab needs its own view permission', () => {
  assert.equal(permissionsAllowTab(['view:finance'], 'finance'), true);
  assert.equal(permissionsAllowTab(['view:finance'], 'vetting'), false);
  assert.equal(permissionsAllowTab(['view:finance'], 'not-a-tab'), false);
});

test('isPermissionKey rejects anything not in the catalogue', () => {
  assert.equal(isPermissionKey('users.manage'), true);
  assert.equal(isPermissionKey('users.manage '), false);
  assert.equal(isPermissionKey('everything'), false);
});

test('a legacy "admin" row resolves to the operations manager bundle', () => {
  assert.deepEqual(effectivePermissions('admin'), DEFAULT_ROLE_PERMISSIONS.ops_manager);
  assert.equal(hasPermission('admin', 'users.manage'), false);
});
