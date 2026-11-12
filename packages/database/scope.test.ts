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
