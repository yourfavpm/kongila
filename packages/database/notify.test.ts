import test from 'node:test';
import assert from 'node:assert/strict';
import { mapNotificationRecipients } from './notify.ts';

test('notification recipients resolve talent profiles to their auth user', () => {
  const resolved = mapNotificationRecipients(
    ['user-1', 'talent-profile-1', 'missing-user'],
    [{ id: 'user-1', email: 'talent@example.com', name: 'Ada' }],
    [{ id: 'talent-profile-1', user_id: 'user-1' }]
  );

  assert.deepEqual(resolved.recipients, [{
    userId: 'user-1',
    email: 'talent@example.com',
    name: 'Ada',
    requestedIds: ['user-1', 'talent-profile-1']
  }]);
  assert.deepEqual(resolved.warnings, [
    '"missing-user" is not a user or linked talent profile, so nothing was sent to it.'
  ]);
});
