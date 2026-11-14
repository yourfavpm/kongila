import test from 'node:test';
import assert from 'node:assert/strict';
import { scopeDbForUser } from './scope.ts';

test('talent interview scope includes profile-id and auth-user-id records only', () => {
  const db = {
    talents: [],
    interviews: [
      { id: 'profile-interview', talentId: 'talent-profile-1' },
      { id: 'user-interview', talentId: 'auth-user-1' },
      { id: 'other-interview', talentId: 'talent-profile-2' }
    ]
  };
  const actor = {
    userId: 'auth-user-1',
    email: null,
    role: 'talent',
    kind: 'talent' as const,
    organizationId: null,
    talentProfileId: 'talent-profile-1'
  };

  const scoped = scopeDbForUser(db, actor);
  assert.deepEqual(
    scoped.interviews.map((interview: any) => interview.id),
    ['profile-interview', 'user-interview']
  );
});

test('talent sees contact details for their assigned manager, but not the operator directory', () => {
  const db = {
    talents: [{ id: 'talent-profile-1', userId: 'auth-user-1', talentManagerId: 'manager-1' }],
    users: [
      { id: 'auth-user-1', name: 'Talent User', email: 'talent@example.com', role: 'talent', status: 'active' },
      { id: 'manager-1', name: 'Assigned Manager', email: 'manager@example.com', role: 'talent_manager', status: 'active' },
      { id: 'manager-2', name: 'Other Manager', email: 'other@example.com', role: 'talent_manager', status: 'active' }
    ]
  };
  const actor = {
    userId: 'auth-user-1', email: 'talent@example.com', role: 'talent',
    kind: 'talent' as const, organizationId: null, talentProfileId: 'talent-profile-1'
  };

  const scoped = scopeDbForUser(db, actor);
  assert.deepEqual(scoped.users.map((user: any) => user.id), ['auth-user-1', 'manager-1']);
  assert.deepEqual(scoped.users[1], {
    id: 'manager-1', name: 'Assigned Manager', email: 'manager@example.com',
    role: 'talent_manager', isKongilaContact: true
  });
});
