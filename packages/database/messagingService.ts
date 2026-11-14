/**
 * In-app messaging.
 *
 * It never worked. conversations.id was a uuid column receiving prefixed
 * strings, messages had no conversation_id so a message could not belong to
 * a thread, and the client portal's insert wrote client_id and admin_id,
 * which are not columns, while omitting the NOT NULL type. The 2 November
 * migration fixed the schema. This fixes the path, and adds the side that
 * never existed at all: the admin has no messaging UI, so a candidate or a
 * client writing to support was writing into a void.
 *
 * Who may talk to whom:
 *   - a candidate talks to operations,
 *   - a client talks to operations,
 *   - a client and a candidate talk only once a contract or an interview
 *     connects them, and operations is always a participant.
 *
 * The last rule matters: this is a managed marketplace, and two parties
 * going direct is how the business loses the placement it brokered.
 */

import { getSupabaseClient } from './index';
import type { RequestActor as Actor } from './scope';
import { notifyUsers } from './notify';
import { requestTitle } from '@kongila/shared-types';

export interface MessagingResult<T = any> {
  ok: boolean;
  status: number;
  error?: string;
  data?: T;
  warnings?: string[];
}

function fail(status: number, error: string): MessagingResult {
  return { ok: false, status, error };
}

function newId(prefix: string): string {
  return globalThis.crypto?.randomUUID?.()
    || `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export type ConversationType = 'talent_admin' | 'client_admin' | 'placement';
const REQUEST_CONTEXT_TYPES = new Set(['request', 'service_request', 'talent_request']);

function rowToConversation(row: any) {
  return {
    id: row.id,
    type: row.type,
    participantIds: row.participant_ids || [],
    contextType: row.context_type,
    contextId: row.context_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function rowToMessage(row: any) {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    senderId: row.sender_id,
    content: row.content,
    attachmentUrl: row.attachment_url,
    attachmentName: row.attachment_name,
    isRead: row.is_read ?? row.read_status ?? false,
    readAt: row.read_at,
    timestamp: row.timestamp
  };
}

/** Everyone who should be in a thread, operations included. */
async function resolveParticipants(
  type: ConversationType,
  actor: Actor,
  otherPartyId?: string | null
): Promise<{ ids: string[]; error?: string }> {
  const supabase = getSupabaseClient();

  // Operations is in every thread. Not surveillance — it is the only way a
  // message to support reaches anybody, and the only reason a placement
  // conversation can be picked up when someone goes quiet.
  const { data: admins, error } = await supabase
    .from('users')
    .select('id')
    .in('role', ['super_admin', 'account_manager', 'talent_manager', 'ops_manager']);

  if (error) return { ids: [], error: `Could not resolve operations: ${error.message}` };
  if (!admins || admins.length === 0) {
    return { ids: [], error: 'There are no operations users to include in the conversation.' };
  }

  const ids = new Set<string>([actor.userId, ...admins.map((a: any) => String(a.id))]);
  if (type === 'talent_admin' && actor.kind === 'talent') {
    // Operations are included in talent support threads, and explicitly
    // resolve the assigned manager so their inbox always receives the thread.
    const profileId = String(actor.talentProfileId || actor.userId);
    let profile = await supabase
      .from('talent_profiles')
      .select('talent_manager_id')
      .eq('id', profileId)
      .maybeSingle();
    if (profile.error) {
      // Older deployments may still keep assignments in the profile envelope.
      const legacy = await supabase.from('talent_profiles').select('bio').eq('id', profileId).maybeSingle();
      if (legacy.data?.bio) {
        try {
          const parsed = JSON.parse(legacy.data.bio);
          if (parsed?.__kongila && parsed?.telemetry?.talentManagerId) {
            ids.add(String(parsed.telemetry.talentManagerId));
          }
        } catch { /* Plain-text bios do not contain assignment metadata. */ }
      }
    } else if (profile.data?.talent_manager_id) {
      ids.add(String(profile.data.talent_manager_id));
    }
  }
  if (type === 'placement' && otherPartyId) ids.add(String(otherPartyId));

  return { ids: Array.from(ids) };
}

async function requestConversationParticipants(
  actor: Actor,
  requestId: string
): Promise<{ ids: string[]; request?: any; error?: string; status?: number }> {
  const supabase = getSupabaseClient();
  let { data: request, error } = await supabase
    .from('talent_requests')
    .select('*')
    .eq('id', requestId)
    .maybeSingle();

  if (error) return { ids: [], error: `The role request could not be loaded: ${error.message}`, status: 500 };
  if (!request) {
    const legacy = await supabase
      .from('talent_requests')
      .select('*')
      .eq('payload->>id', requestId)
      .maybeSingle();
    request = legacy.data;
    error = legacy.error;
  }
  if (error) return { ids: [], error: `The role request could not be loaded: ${error.message}`, status: 500 };
  if (!request) return { ids: [], error: 'The role request does not exist.', status: 404 };

  const clientId = String(request.client_id || '');
  if (!clientId) return { ids: [], error: 'This role request has no client.', status: 409 };
  if (actor.kind === 'talent') {
    return { ids: [], error: 'Candidates cannot message a client about a role request.', status: 403 };
  }

  const profiles = await supabase
    .from('client_profiles')
    .select('user_id, organization_id')
    .eq('user_id', clientId)
    .maybeSingle();
  if (profiles.error) {
    return { ids: [], error: `The client account could not be verified: ${profiles.error.message}`, status: 500 };
  }

  let clientIds = [clientId];
  const organizationId = profiles.data?.organization_id || request.organization_id;
  if (organizationId) {
    const members = await supabase
      .from('client_profiles')
      .select('user_id')
      .eq('organization_id', organizationId);
    if (members.error) {
      return { ids: [], error: `The client team could not be verified: ${members.error.message}`, status: 500 };
    }
    clientIds = Array.from(new Set([clientId, ...(members.data || []).map((row: any) => String(row.user_id))]));
  }

  if (actor.kind === 'client' && !clientIds.includes(String(actor.userId))) {
    return { ids: [], error: 'This role request is not for your company.', status: 403 };
  }

  const payload = request.payload || {};
  const operationsIds = new Set<string>(
    [
      request.account_manager_id,
      request.talent_manager_id,
      request.assigned_account_manager_id,
      request.assigned_talent_manager_id,
      payload.assignedAccountManagerId,
      payload.assignedTalentManagerId,
      payload.accountManagerId,
      payload.talentManagerId
    ].filter(Boolean).map(String)
  );

  if (organizationId) {
    const organization = await supabase
      .from('organizations')
      .select('account_manager_id')
      .eq('id', organizationId)
      .maybeSingle();
    if (organization.error) {
      return { ids: [], error: `The account manager could not be resolved: ${organization.error.message}`, status: 500 };
    }
    if (organization.data?.account_manager_id) {
      operationsIds.add(String(organization.data.account_manager_id));
    }
  }

  if (operationsIds.size === 0) {
    const operations = await supabase
      .from('users')
      .select('id')
      .in('role', ['super_admin', 'admin', 'account_manager', 'talent_manager', 'ops_manager']);
    if (operations.error) {
      return { ids: [], error: `The Kongila team could not be resolved: ${operations.error.message}`, status: 500 };
    }
    for (const user of operations.data || []) operationsIds.add(String(user.id));
  }

  if (actor.kind === 'admin') operationsIds.add(String(actor.userId));
  return {
    ids: Array.from(new Set([...clientIds, ...operationsIds])),
    request
  };
}

/**
 * A client and a candidate may only talk once something connects them.
 *
 * Without this, anyone could open a thread with any candidate and take the
 * conversation off the platform before a placement is made.
 */
async function placementExists(clientId: string, talentId: string): Promise<boolean> {
  const supabase = getSupabaseClient();

  const { data: contracts } = await supabase
    .from('contracts')
    .select('id')
    .eq('client_id', clientId)
    .eq('talent_id', talentId)
    .limit(1);
  if (contracts && contracts.length > 0) return true;

  const { data: interviews } = await supabase
    .from('interviews')
    .select('id')
    .eq('client_id', clientId)
    .eq('talent_id', talentId)
    .limit(1);
  return Boolean(interviews && interviews.length > 0);
}

// ─── Starting a thread ───────────────────────────────────────────────────────

export async function startConversation(
  actor: Actor,
  input: {
    type?: ConversationType;
    otherPartyId?: string | null;
    contextType?: string | null;
    contextId?: string | null;
    firstMessage?: string;
  }
): Promise<MessagingResult> {
  if (!actor) return fail(401, 'Not authenticated.');

  const type: ConversationType = input.type
    || (actor.kind === 'talent' ? 'talent_admin' : 'client_admin');
  const contextType = String(input.contextType || '').trim().toLowerCase();
  const requestScoped = REQUEST_CONTEXT_TYPES.has(contextType);

  if (requestScoped && type !== 'client_admin') {
    return fail(400, 'Role request conversations must be client-to-Kongila conversations.');
  }

  let participantIds: string[];
  let request: any;
  if (requestScoped) {
    const requestId = String(input.contextId || '').trim();
    if (!requestId) return fail(400, 'A role request is required for this conversation.');
    const resolved = await requestConversationParticipants(actor, requestId);
    if (resolved.error) return fail(resolved.status || 500, resolved.error);
    participantIds = resolved.ids;
    request = resolved.request;

    const supabase = getSupabaseClient();
    const { data: existing, error } = await supabase
      .from('conversations')
      .select('*')
      .eq('type', type)
      .in('context_type', Array.from(REQUEST_CONTEXT_TYPES))
      .eq('context_id', String(request.id))
      .maybeSingle();
    if (error) return fail(500, `The role conversation could not be loaded: ${error.message}`);
    if (existing) {
      const currentParticipants = (existing.participant_ids || []).map(String);
      if (actor.kind === 'admin' && !currentParticipants.includes(String(actor.userId))) {
        const updatedParticipants = Array.from(new Set([...currentParticipants, ...participantIds]));
        const update = await supabase
          .from('conversations')
          .update({ participant_ids: updatedParticipants, updated_at: new Date().toISOString() })
          .eq('id', existing.id)
          .select('*')
          .single();
        if (update.error) return fail(500, `The role conversation could not be updated: ${update.error.message}`);
        return { ok: true, status: 200, data: rowToConversation(update.data) };
      }
      if (!currentParticipants.includes(String(actor.userId))) {
        return fail(403, 'You are not a participant in this role conversation.');
      }
      return { ok: true, status: 200, data: rowToConversation(existing) };
    }
  } else {
    const { ids, error: participantError } = await resolveParticipants(type, actor, input.otherPartyId);
    if (participantError) return fail(500, participantError);
    participantIds = ids;
  }

  if (type === 'placement') {
    if (!input.otherPartyId) return fail(400, 'A placement conversation needs the other party.');
    const clientId = actor.kind === 'client' ? actor.userId : input.otherPartyId;
    const talentId = actor.kind === 'talent' ? actor.userId : input.otherPartyId;

    if (!(await placementExists(String(clientId), String(talentId)))) {
      return fail(403,
        'You can only message this person once an interview is booked or a contract is in place. ' +
        'Until then, your account manager can pass a message on.');
    }
  }

  const supabase = getSupabaseClient();
  const now = new Date().toISOString();

  const row = {
    id: newId('conv'),
    // NOT NULL, and the client portal never set it, so every insert failed.
    type,
    participant_ids: participantIds,
    context_type: requestScoped ? 'request' : input.contextType || null,
    context_id: requestScoped ? String(request.id) : input.contextId || null,
    created_at: now,
    updated_at: now
  };

  const { data: created, error } = await supabase
    .from('conversations')
    .insert(row)
    .select()
    .maybeSingle();

  if (error) return fail(500, `The conversation could not be started: ${error.message}`);

  const conversation = rowToConversation(created || row);
  const warnings: string[] = [];

  if (input.firstMessage?.trim()) {
    const sent = await sendMessage(actor, {
      conversationId: conversation.id,
      content: input.firstMessage
    });
    if (!sent.ok) warnings.push(sent.error as string);
  }

  return { ok: true, status: 201, data: conversation, warnings };
}

// ─── Reading ─────────────────────────────────────────────────────────────────

/** The threads this actor is in, decided server-side. */
export async function listConversations(actor: Actor): Promise<MessagingResult> {
  if (!actor) return fail(401, 'Not authenticated.');

  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('conversations')
    .select('*')
    .contains('participant_ids', [actor.userId])
    .order('updated_at', { ascending: false });

  if (error) return fail(500, error.message);

  const conversations = (data || []).map(rowToConversation);
  const ids = conversations.map((c: any) => c.id);

  const { data: messages } = ids.length
    ? await supabase
        .from('messages')
        .select('*')
        .in('conversation_id', ids)
        .order('timestamp', { ascending: true })
    : { data: [] as any[] };

  return {
    ok: true,
    status: 200,
    data: {
      conversations,
      messages: (messages || []).map(rowToMessage)
    }
  };
}

async function actorIsParticipant(actor: Actor, conversationId: string): Promise<any | null> {
  const supabase = getSupabaseClient();
  const { data } = await supabase
    .from('conversations')
    .select('*')
    .eq('id', conversationId)
    .maybeSingle();

  if (!data) return null;
  const participants = (data.participant_ids || []).map(String);
  return participants.includes(String(actor.userId)) ? data : null;
}

// ─── Sending ─────────────────────────────────────────────────────────────────

export async function sendMessage(
  actor: Actor,
  input: {
    conversationId: string;
    content: string;
    attachmentUrl?: string | null;
    attachmentName?: string | null;
  }
): Promise<MessagingResult> {
  if (!actor) return fail(401, 'Not authenticated.');
  if (!input.conversationId) return fail(400, 'conversationId is required.');
  if (!input.content?.trim() && !input.attachmentUrl) {
    return fail(400, 'A message needs text or an attachment.');
  }

  const conversation = await actorIsParticipant(actor, input.conversationId);
  if (!conversation) return fail(403, 'That conversation is not yours.');

  const supabase = getSupabaseClient();
  const now = new Date().toISOString();

  const { data: created, error } = await supabase
    .from('messages')
    .insert({
      id: newId('msg'),
      conversation_id: input.conversationId,
      sender_id: actor.userId,
      content: input.content?.trim() || '',
      attachment_url: input.attachmentUrl || null,
      attachment_name: input.attachmentName || null,
      is_read: false,
      timestamp: now
    })
    .select()
    .maybeSingle();

  if (error) return fail(500, `Your message was not sent: ${error.message}`);

  await supabase
    .from('conversations')
    .update({ updated_at: now })
    .eq('id', input.conversationId);

  // Everyone else in the thread hears about it. Nothing used to notify
  // anybody, so a message sat unread until its recipient happened to look.
  const others = (conversation.participant_ids || [])
    .map(String)
    .filter((id: string) => id !== String(actor.userId));

  const warnings: string[] = [];
  if (others.length > 0) {
    const isRequestMessage = REQUEST_CONTEXT_TYPES.has(String(conversation.context_type || '').toLowerCase());
    const requestResult = isRequestMessage
      ? await getSupabaseClient()
          .from('talent_requests')
          .select('id, title, payload')
          .eq('id', conversation.context_id)
          .maybeSingle()
      : null;
    if (requestResult?.error) {
      warnings.push(`The message was sent, but its role title could not be loaded: ${requestResult.error.message}`);
    }
    const roleTitle = requestResult?.data
      ? requestTitle({
          ...(requestResult.data.payload || {}),
          title: requestResult.data.payload?.title || requestResult.data.title
        })
      : 'your request';
    const event = isRequestMessage
      ? actor.kind === 'client' ? 'request_message_from_client' : 'request_message_from_admin'
      : 'request_received';
    const result = await notifyUsers(others, event, {
      roleTitle,
      reason: input.content?.trim().slice(0, 300) || 'An attachment was sent.'
    }, isRequestMessage
      ? { sourceRecordId: String(conversation.context_id) }
      : { inAppOnly: true });
    warnings.push(...result.warnings);
  }

  return { ok: true, status: 201, data: rowToMessage(created), warnings };
}

// ─── Read receipts ───────────────────────────────────────────────────────────

export async function markMessagesRead(
  actor: Actor,
  input: { conversationId: string }
): Promise<MessagingResult> {
  if (!actor) return fail(401, 'Not authenticated.');

  const conversation = await actorIsParticipant(actor, input.conversationId);
  if (!conversation) return fail(403, 'That conversation is not yours.');

  const supabase = getSupabaseClient();
  // Only other people's messages. Marking your own read is meaningless, and
  // the old badge counted them, which is why it never reached zero.
  const { error } = await supabase
    .from('messages')
    .update({ is_read: true, read_at: new Date().toISOString() })
    .eq('conversation_id', input.conversationId)
    .neq('sender_id', actor.userId)
    .eq('is_read', false);

  if (error) return fail(500, error.message);
  return { ok: true, status: 200, data: { conversationId: input.conversationId } };
}
