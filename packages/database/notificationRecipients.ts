export interface Recipient {
  userId: string;
  email?: string | null;
  name?: string | null;
  requestedIds: string[];
}

/** Resolve user IDs and talent profile IDs to real user records. */
export function mapNotificationRecipients(
  userIds: string[],
  users: any[],
  talentProfiles: any[]
): { recipients: Recipient[]; warnings: string[] } {
  const wanted = Array.from(new Set(userIds.filter(Boolean).map(String)));
  const recipientByUserId = new Map<string, Recipient>();
  const recipientByRequestedId = new Map<string, Recipient>();

  const addRecipient = (user: any, requestedId: string) => {
    const userId = String(user?.id || '');
    if (!userId) return;
    let recipient = recipientByUserId.get(userId);
    if (!recipient) {
      recipient = {
        userId,
        email: user.email,
        name: user.name,
        requestedIds: []
      };
      recipientByUserId.set(userId, recipient);
    }
    if (!recipient.requestedIds.includes(requestedId)) recipient.requestedIds.push(requestedId);
    recipientByRequestedId.set(requestedId, recipient);
  };

  const wantedIds = new Set(wanted);
  for (const user of users || []) {
    const id = String(user?.id || '');
    if (wantedIds.has(id)) addRecipient(user, id);
  }

  for (const profile of talentProfiles || []) {
    const profileId = String(profile?.id || '');
    const user = (users || []).find((row: any) => String(row?.id) === String(profile?.user_id));
    if (wantedIds.has(profileId) && user) addRecipient(user, profileId);
  }

  const warnings = wanted
    .filter(id => !recipientByRequestedId.has(id))
    .map(id => `"${id}" is not a user or linked talent profile, so nothing was sent to it.`);

  return { recipients: Array.from(recipientByUserId.values()), warnings };
}
