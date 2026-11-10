/**
 * Run with:  pnpm test
 * (node --test --experimental-strip-types, no test framework installed)
 *
 * index.ts imports nothing, so this runs without resolving workspace
 * packages. Keep it that way.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  requestRoles,
  requestHeadcount,
  isMultiRoleRequest,
  requestTitle,
  REQUEST_ROLE_STATUSES,
  validateRequestRoles
} from './index.ts';

// ── A request from before roles existed ──────────────────────────────────────

test('a request with no roles array still has one role', () => {
  // Every request filed before this existed is this shape, and a client
  // hiring one person still files it. No screen should have to branch.
  const roles = requestRoles({
    id: 'req_1',
    roleTitle: 'Senior Backend Engineer',
    seniorityLevel: 'Senior',
    requiredSkills: ['TypeScript', 'Postgres'],
    numberOfHires: 2
  } as any);

  assert.equal(roles.length, 1);
  assert.equal(roles[0].title, 'Senior Backend Engineer');
  assert.equal(roles[0].count, 2);
  assert.equal(roles[0].status, 'Open');
  assert.deepEqual(roles[0].requiredSkills, ['TypeScript', 'Postgres']);
});

test('the synthesised role id is stable for a given request', () => {
  const a = requestRoles({ id: 'req_1', roleTitle: 'QA Analyst' } as any)[0].id;
  const b = requestRoles({ id: 'req_1', roleTitle: 'QA Analyst' } as any)[0].id;
  // A match or an interview references this, so it cannot be random.
  assert.equal(a, b);
  assert.equal(a, 'req_1:role-1');
});

test('a request with no headcount is for one person, not zero', () => {
  assert.equal(requestRoles({ id: 'r', roleTitle: 'Designer' } as any)[0].count, 1);
  assert.equal(requestHeadcount({ id: 'r', roleTitle: 'Designer' } as any), 1);
});

test('an outsource request falls back to its team size', () => {
  assert.equal(requestHeadcount({ id: 'r', teamDescription: 'Support team', teamSize: 6 } as any), 6);
});

// ── A request with roles ─────────────────────────────────────────────────────

const threeRoles = {
  id: 'req_2',
  serviceType: 'Hire Talent',
  roles: [
    { id: 'r1', title: 'Senior Backend Engineer', count: 2, status: 'Sourcing' },
    { id: 'r2', title: 'Product Designer', count: 1, status: 'Candidates Ready' },
    { id: 'r3', title: 'QA Analyst', count: 1, status: 'Open' }
  ]
} as any;

test('roles are read from the array when there is one', () => {
  const roles = requestRoles(threeRoles);
  assert.equal(roles.length, 3);
  assert.deepEqual(roles.map(r => r.title), ['Senior Backend Engineer', 'Product Designer', 'QA Analyst']);
});

test('roles progress independently of each other', () => {
  const roles = requestRoles(threeRoles);
  assert.equal(roles[0].status, 'Sourcing');
  assert.equal(roles[1].status, 'Candidates Ready');
  assert.equal(roles[2].status, 'Open');
});

test('headcount is the sum across roles, not the number of roles', () => {
  assert.equal(requestHeadcount(threeRoles), 4);
});

test('a multi-role request is named after its first role and says how many more', () => {
  assert.equal(requestTitle(threeRoles), 'Senior Backend Engineer +2 more roles');
  assert.equal(
    requestTitle({ id: 'r', roles: [{ id: 'a', title: 'Designer', count: 1, status: 'Open' }, { id: 'b', title: 'Engineer', count: 1, status: 'Open' }] } as any),
    'Designer +1 more role'
  );
});

test('a one-role array is named after that role, with no suffix', () => {
  assert.equal(
    requestTitle({ id: 'r', roles: [{ id: 'a', title: 'Product Designer', count: 1, status: 'Open' }] } as any),
    'Product Designer'
  );
});

test('isMultiRoleRequest is false for one role however it was stored', () => {
  assert.equal(isMultiRoleRequest({ id: 'r', roleTitle: 'Designer', numberOfHires: 5 } as any), false);
  assert.equal(isMultiRoleRequest({ id: 'r', roles: [{ id: 'a', title: 'X', count: 1, status: 'Open' }] } as any), false);
  assert.equal(isMultiRoleRequest(threeRoles), true);
});

// ── Rubbish in the stored array ──────────────────────────────────────────────

test('a role with no title is dropped rather than shown as blank', () => {
  // payload is jsonb; a half-filled role can be saved from an older client.
  const roles = requestRoles({
    id: 'r',
    roleTitle: 'Fallback Role',
    roles: [{ id: 'a', title: '   ', count: 1 }, { id: 'b', title: 'Real Role', count: 1 }]
  } as any);
  assert.deepEqual(roles.map(r => r.title), ['Real Role']);
});

test('an entirely unusable roles array falls back to the flat fields', () => {
  const roles = requestRoles({ id: 'r', roleTitle: 'Fallback Role', roles: [{ id: 'a' }, null] } as any);
  assert.equal(roles.length, 1);
  assert.equal(roles[0].title, 'Fallback Role');
});

test('a bad count becomes one, never zero or a fraction', () => {
  const roles = requestRoles({
    id: 'r',
    roles: [
      { id: 'a', title: 'A', count: 0 },
      { id: 'b', title: 'B', count: -3 },
      { id: 'c', title: 'C', count: 2.7 },
      { id: 'd', title: 'D', count: 'two' }
    ]
  } as any);
  assert.deepEqual(roles.map(r => r.count), [1, 1, 2, 1]);
});

test('an unrecognised status reads as Open rather than being passed through', () => {
  const roles = requestRoles({ id: 'r', roles: [{ id: 'a', title: 'A', count: 1, status: 'Vetted' }] } as any);
  assert.equal(roles[0].status, 'Open');
  assert.ok(REQUEST_ROLE_STATUSES.includes(roles[0].status));
});

test('a role missing an id gets a positional one', () => {
  const roles = requestRoles({ id: 'req_9', roles: [{ title: 'A', count: 1 }, { title: 'B', count: 1 }] } as any);
  assert.deepEqual(roles.map(r => r.id), ['req_9:role-1', 'req_9:role-2']);
});

test('no request means no roles', () => {
  assert.deepEqual(requestRoles(null), []);
  assert.deepEqual(requestRoles(undefined), []);
  assert.equal(requestHeadcount(null), 0);
});

// ── Validation, which guards what goes in ────────────────────────────────────

test('a valid roles array is accepted', () => {
  assert.equal(validateRequestRoles([
    { id: 'a', title: 'Senior Backend Engineer', count: 2 },
    { id: 'b', title: 'Product Designer', count: 1 }
  ]), null);
});

test('a role must have a title', () => {
  assert.match(String(validateRequestRoles([{ id: 'a', count: 1 }])), /needs a title/);
  assert.match(String(validateRequestRoles([{ id: 'a', title: '   ', count: 1 }])), /needs a title/);
});

test('two roles cannot share a title', () => {
  // Otherwise they cannot be told apart on the board or in a shortlist.
  assert.match(
    String(validateRequestRoles([{ title: 'Engineer', count: 1 }, { title: 'engineer', count: 1 }])),
    /two roles called/
  );
});

test('a count must be a whole number in range', () => {
  for (const bad of [0, -1, 2.5, 101, 'two']) {
    assert.match(String(validateRequestRoles([{ title: 'Engineer', count: bad }])), /whole number between/);
  }
  assert.equal(validateRequestRoles([{ title: 'Engineer', count: 100 }]), null);
});

test('an empty or oversized list is refused', () => {
  assert.match(String(validateRequestRoles([])), /at least one role/);
  const many = Array.from({ length: 21 }, (_, i) => ({ title: `Role ${i}`, count: 1 }));
  assert.match(String(validateRequestRoles(many)), /up to 20 roles/);
});

test('a budget that starts higher than it ends is refused', () => {
  assert.match(
    String(validateRequestRoles([{ title: 'Engineer', count: 1, budgetMinUsd: 9000, budgetMaxUsd: 4000 }])),
    /starts higher than it ends/
  );
  // An open-ended budget is not that: max of 0 means unset.
  assert.equal(validateRequestRoles([{ title: 'Engineer', count: 1, budgetMinUsd: 9000, budgetMaxUsd: 0 }]), null);
});

test('a negative budget is refused', () => {
  assert.match(
    String(validateRequestRoles([{ title: 'Engineer', count: 1, budgetMinUsd: -5 }])),
    /not be negative|not negative/
  );
});

test('anything that is not a list of objects is refused', () => {
  assert.match(String(validateRequestRoles('roles')), /must be a list/);
  assert.match(String(validateRequestRoles(null)), /must be a list/);
  assert.match(String(validateRequestRoles([null])), /is not a role/);
  assert.match(String(validateRequestRoles([['Engineer']])), /is not a role/);
});
