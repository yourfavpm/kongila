import test from 'node:test';
import assert from 'node:assert/strict';

import {
  countUnreadMessages,
  countUnreadNotifications,
  countUnreadByModule,
  countUnreadInConversation,
  isUnreadMessage
} from './unread.ts';

test('a message row uses isRead, not read', () => {
  // The bug in one line. The badge read m.read, which no message row has,
  // so every message in the database counted as unread for every user.
  const messages = [
    { id: '1', senderId: 'other', isRead: true },
    { id: '2', senderId: 'other', isRead: false }
  ];
  assert.equal(countUnreadMessages(messages, 'me'), 1);
});

test('your own messages are never unread for you', () => {
  const messages = [
    { id: '1', senderId: 'me', isRead: false },
    { id: '2', senderId: 'other', isRead: false }
  ];
  assert.equal(countUnreadMessages(messages, 'me'), 1);
});

test('snake_case rows from the database count the same', () => {
  const messages = [{ id: '1', sender_id: 'other', is_read: false }];
  assert.equal(countUnreadMessages(messages, 'me'), 1);
});

test('read_status is honoured for rows written before is_read existed', () => {
  assert.equal(isUnreadMessage({ senderId: 'other', read_status: true }, 'me'), false);
});

test('an empty or missing list is zero, not a crash', () => {
  assert.equal(countUnreadMessages(null), 0);
  assert.equal(countUnreadMessages(undefined), 0);
  assert.equal(countUnreadNotifications(null), 0);
});

test('per-conversation counts only that thread', () => {
  const messages = [
    { id: '1', conversationId: 'c1', senderId: 'other', isRead: false },
    { id: '2', conversationId: 'c2', senderId: 'other', isRead: false },
    { id: '3', conversation_id: 'c1', sender_id: 'other', is_read: false }
  ];
  assert.equal(countUnreadInConversation(messages, 'c1', 'me'), 2);
});

test('notifications use read, not isRead', () => {
  const notifications = [{ id: '1', read: false }, { id: '2', read: true }];
  assert.equal(countUnreadNotifications(notifications), 1);
});

test('module_type decides the badge, not keyword guessing', () => {
  // The old code searched the title and message for words, so a
  // notification mentioning another section counted against the wrong badge.
  const counts = countUnreadByModule([
    { read: false, module_type: 'interviews', title: 'Your contract interview' },
    { read: false, module_type: 'contracts', title: 'Interview outcome' }
  ]);
  assert.equal(counts.interviews, 1);
  assert.equal(counts.contracts, 1);
});

test('rows with no module fall back to keywords', () => {
  const counts = countUnreadByModule([
    { read: false, title: 'Interview scheduled', message: '' },
    { read: false, title: 'Contract ready', message: '' }
  ]);
  assert.equal(counts.interviews, 1);
  assert.equal(counts.contracts, 1);
});

test('read notifications count towards nothing', () => {
  assert.deepEqual(countUnreadByModule([{ read: true, module_type: 'interviews' }]), {});
});

test('a portal that names its screens differently still gets its badges', () => {
  // The client portal calls its interviews screen "scheduling" and its
  // matches screen "radar". The counts came back keyed by the candidate
  // portal's names, so every interview notification landed on a section id
  // the client portal does not have, and the Interviews badge read zero
  // however many were waiting.
  const notifications = [
    { read: false, module_type: 'interviews', title: 'Interview invitation' },
    { read: false, module_type: 'interviews', title: 'Interview confirmed' },
    { read: false, module_type: 'matches', title: 'Candidates ready' },
    { read: true, module_type: 'interviews', title: 'Already read' }
  ];

  const clientAliases = { interviews: 'scheduling', matches: 'radar', requests: 'requests' };
  const counts = countUnreadByModule(notifications, clientAliases);
  assert.equal(counts.scheduling, 2);
  assert.equal(counts.radar, 1);
  assert.equal(counts.interviews, undefined);

  // The default is unchanged, so the candidate portal is untouched.
  const defaults = countUnreadByModule(notifications);
  assert.equal(defaults.interviews, 2);
  assert.equal(defaults.opportunities, 1);
});

test('an older row with no module_type lands on the right screen too', () => {
  // The keyword fallback guesses in the default vocabulary, so it has to be
  // translated as well, or a row written before module_type existed counts
  // against a section id the portal does not have.
  const notifications = [{ read: false, title: 'Your interview is confirmed', message: '' }];
  const counts = countUnreadByModule(notifications, { interviews: 'scheduling' });
  assert.equal(counts.scheduling, 1);
});
