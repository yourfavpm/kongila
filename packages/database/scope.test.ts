import test from 'node:test';
import assert from 'node:assert/strict';
import { scopeDbForUser, filterDbByPermissions } from './scope.ts';

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

test('a client sees the shortlist on their own request, whichever id it was written against', () => {
  // Matches, interviews and offers are all written against talent_requests.id.
  // The snapshot used to expose payload.id as the request's id, so this set
  // never matched and operations' shortlist was filtered out of the client's
  // own dashboard.
  const db = {
    talents: [
      { id: 'talent-1', name: 'Ada' },
      { id: 'talent-2', name: 'Chidi' }
    ],
    clientRequests: [
      { id: 'row-1', rowId: 'row-1', payloadId: 'payload-1', clientId: 'client-user-1' }
    ],
    matches: [
      { id: 'match-row', requestId: 'row-1', talentId: 'talent-1' },
      { id: 'match-legacy', requestId: 'payload-1', talentId: 'talent-2' },
      { id: 'match-other', requestId: 'row-2', talentId: 'talent-3' }
    ],
    interviews: [
      { id: 'iv-row', requestId: 'row-1', talentId: 'talent-1' },
      { id: 'iv-other', requestId: 'row-2', talentId: 'talent-3' }
    ]
  };
  const actor = {
    userId: 'client-user-1', email: 'client@example.com', role: 'client',
    kind: 'client' as const, organizationId: null, talentProfileId: null
  };

  const scoped = scopeDbForUser(db, actor);
  assert.deepEqual(scoped.matches.map((m: any) => m.id), ['match-row', 'match-legacy']);
  assert.deepEqual(scoped.interviews.map((iv: any) => iv.id), ['iv-row']);
  assert.deepEqual(scoped.talents.map((t: any) => t.id), ['talent-1', 'talent-2']);
});

test('a candidate on a shortlist can see the request behind it', () => {
  const db = {
    talents: [{ id: 'talent-profile-1', userId: 'auth-user-1' }],
    clientRequests: [
      { id: 'row-1', rowId: 'row-1', payloadId: 'payload-1', clientId: 'client-user-1', title: 'Backend Engineer' },
      { id: 'row-2', rowId: 'row-2', payloadId: 'payload-2', clientId: 'client-user-2', title: 'Designer' }
    ],
    matches: [{ id: 'match-1', requestId: 'row-1', talentId: 'talent-profile-1' }]
  };
  const actor = {
    userId: 'auth-user-1', email: null, role: 'talent',
    kind: 'talent' as const, organizationId: null, talentProfileId: 'talent-profile-1'
  };

  const scoped = scopeDbForUser(db, actor);
  assert.deepEqual(scoped.clientRequests.map((r: any) => r.id), ['row-1']);
});

test('a client never receives a way to contact a candidate directly', () => {
  // Kongila introduces the candidate and holds the conversation. A client who
  // has the email address or the phone number of someone they have not hired
  // can step around all of it. The CV goes with them: its header is an email
  // address, a phone number and usually a home address.
  const db = {
    talents: [{
      id: 'talent-1',
      name: 'Ada',
      title: 'Backend Engineer',
      email: 'ada@example.com',
      phone: '+234 800 000 0000',
      linkedinUrl: 'https://linkedin.com/in/ada',
      linkedIn: 'ada',
      cvUrl: 'https://files/cv.pdf',
      cvName: 'ada-cv.pdf',
      cvSize: 1024,
      githubUrl: 'https://github.com/ada',
      portfolioUrl: 'https://ada.dev',
      bio: 'Six years on payment systems.'
    }],
    clientRequests: [{ id: 'row-1', rowId: 'row-1', clientId: 'client-user-1' }],
    matches: [{ id: 'match-1', requestId: 'row-1', talentId: 'talent-1' }]
  };
  const actor = {
    userId: 'client-user-1', email: 'client@example.com', role: 'client',
    kind: 'client' as const, organizationId: null, talentProfileId: null
  };

  const [talent] = scopeDbForUser(db, actor).talents;
  for (const field of ['email', 'phone', 'linkedinUrl', 'linkedIn', 'cvUrl', 'cvName', 'cvSize']) {
    assert.equal(talent[field], undefined, `${field} reached the client`);
  }

  // Work samples stay: they are the evidence the hiring decision rests on.
  assert.equal(talent.githubUrl, 'https://github.com/ada');
  assert.equal(talent.portfolioUrl, 'https://ada.dev');
  assert.equal(talent.bio, 'Six years on payment systems.');
});

// ─── Filtering the snapshot by permission ────────────────────────────────────

test('a snapshot keeps only the collections the permissions allow', () => {
  const db = {
    talents: [{ id: 't1' }],
    invoices: [{ id: 'i1' }],
    interviews: [{ id: 'iv1' }],
    skills: [{ id: 's1' }],
    users: [{ id: 'u1', name: 'A', email: 'a@b.c', role: 'finance', password_hash: 'x' }]
  };

  const finance = filterDbByPermissions(db, ['view:finance', 'view:overview']);
  assert.deepEqual(finance.invoices, [{ id: 'i1' }]);
  assert.deepEqual(finance.talents, [], 'finance has no candidate screens');
  assert.deepEqual(finance.interviews, []);
  // Reference data is not permissioned.
  assert.deepEqual(finance.skills, [{ id: 's1' }]);
});

test('the operator list keeps names for labelling but drops everything else', () => {
  const db = { users: [{ id: 'u1', name: 'A', email: 'a@b.c', role: 'finance', password_hash: 'x', status: 'active' }] };

  const withoutManage = filterDbByPermissions(db, ['view:overview']);
  assert.deepEqual(withoutManage.users, [{ id: 'u1', name: 'A', email: 'a@b.c', role: 'finance' }]);

  const withManage = filterDbByPermissions(db, ['users.manage']);
  assert.equal(withManage.users[0].password_hash, 'x');
});

test('no permissions means no permissioned collections', () => {
  const db = { talents: [{ id: 't1' }], invoices: [{ id: 'i1' }] };
  const nothing = filterDbByPermissions(db, undefined);
  assert.deepEqual(nothing.talents, []);
  assert.deepEqual(nothing.invoices, []);
});

test('filtering does not remove a key, so callers that filter it still work', () => {
  const filtered = filterDbByPermissions({ talents: [{ id: 't1' }] }, []);
  assert.ok(Array.isArray(filtered.talents));
});
