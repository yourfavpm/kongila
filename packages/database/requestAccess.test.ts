import test from 'node:test';
import assert from 'node:assert/strict';
import { isRequestAssignedToAccountManager } from './requestAccess.ts';

test('account manager sees a request assigned directly to them', () => {
  assert.equal(
    isRequestAssignedToAccountManager(
      { account_manager_id: 'am-1', client_id: 'client-1' },
      'am-1',
      new Set()
    ),
    true
  );
});

test('account manager sees requests for clients in their managed organization', () => {
  assert.equal(
    isRequestAssignedToAccountManager(
      { client_id: 'client-1' },
      'am-1',
      new Set(['client-1'])
    ),
    true
  );
});

test("account manager does not see another manager's request or client", () => {
  assert.equal(
    isRequestAssignedToAccountManager(
      { account_manager_id: 'am-2', client_id: 'client-2' },
      'am-1',
      new Set(['client-1'])
    ),
    false
  );
});
