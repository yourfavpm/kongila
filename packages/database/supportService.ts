/**
 * Support tickets.
 *
 * Tickets could not be created at all: the insert wrote `client_id`,
 * `linked_contract_id`, `assigned_to` and `description`, none of which
 * existed, plus a lowercase `'open'` against a constraint expecting `'Open'`
 * and a category list neither form matched. Migration 2026-11-02 fixed the
 * schema; this fixes the path.
 *
 * Both portals wrote straight to the table from the browser, so a ticket was
 * created with no notification to operations, a reply was written with no
 * notification to the raiser, and nothing was scoped — the query decided who
 * saw what, not the server.
 *
 * Everything goes through here now: created, replied to, and closed in one
 * place, with the raiser resolved from the verified token rather than from
 * whatever the browser sent.
 */

import { getSupabaseClient } from './index';
import type { RequestActor as Actor } from './scope';
import { recordAudit } from './audit';
import { notifyUsers, notifyAdmins } from './notify';

export interface SupportResult<T = any> {
  ok: boolean;
  status: number;
  error?: string;
  data?: T;
  warnings?: string[];
}

function fail(status: number, error: string): SupportResult {
  return { ok: false, status, error };
}

/** Matches support_tickets_category_check after the 2 Nov migration. */
export const TICKET_CATEGORIES = [
  'Payment Issues', 'Technical Support', 'Verification', 'Guidance',
  'Contract Question', 'Billing Issue', 'Talent Performance Concern',
  'Vetting Question', 'Technical Bug', 'Account Access', 'Payment Issue',
  'Other'
];

/** Matches support_tickets_status_check. Title case, not lowercase. */
export const TICKET_STATUSES = ['Open', 'In Progress', 'Resolved'];

const PRIORITY_BY_CATEGORY: Record<string, string> = {
  'Billing Issue': 'High',
  'Payment Issues': 'High',
  'Payment Issue': 'High',
  'Talent Performance Concern': 'High',
  'Account Access': 'High',
  'Contract Question': 'Medium',
  'Verification': 'Medium',
  'Vetting Question': 'Medium',
  'Technical Bug': 'Medium',
  'Technical Support': 'Medium'
};

function newId(prefix: string): string {
  return globalThis.crypto?.randomUUID?.()
    || `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function rowToTicket(row: any) {
  return {
    id: row.id,
    talentId: row.talent_id,
    clientId: row.client_id,
    subject: row.subject,
    category: row.category,
    description: row.description,
    status: row.status,
    priority: row.priority,
    assignedTo: row.assigned_to,
    linkedContractId: row.linked_contract_id,
    createdAt: row.created_at,
    lastActivity: row.last_activity
  };
}

// ─── Raising a ticket ────────────────────────────────────────────────────────

export interface CreateTicketInput {
  subject: string;
  category: string;
  description?: string;
  linkedContractId?: string | null;
}

export async function createTicket(
  actor: Actor,
  input: CreateTicketInput
): Promise<SupportResult> {
  if (!actor) return fail(401, 'Not authenticated.');
  if (!input.subject?.trim()) return fail(400, 'A subject is required.');

  const category = String(input.category || '').trim();
  if (!TICKET_CATEGORIES.includes(category)) {
    return fail(400, `"${category}" is not a support category.`);
  }

  const supabase = getSupabaseClient();
  const now = new Date().toISOString();

  // Whoever is signed in raised it. The browser used to decide this.
  const row: any = {
    id: newId('tkt'),
    subject: input.subject.trim(),
    category,
    description: input.description?.trim() || null,
    // Title case. The forms sent lowercase 'open', which the constraint
    // rejected, so no ticket was ever created from either portal.
    status: 'Open',
    priority: PRIORITY_BY_CATEGORY[category] || 'Low',
    linked_contract_id: input.linkedContractId || null,
    created_at: now,
    last_activity: now
  };

  if (actor.kind === 'talent') row.talent_id = actor.talentProfileId || actor.userId;
  else if (actor.kind === 'client') row.client_id = actor.userId;
  else row.client_id = actor.userId;

  const { data: created, error } = await supabase
    .from('support_tickets')
    .insert(row)
    .select()
    .maybeSingle();

  if (error) return fail(500, `The ticket could not be created: ${error.message}`);

  const ticket = rowToTicket(created || row);

  // Operations is told. Nothing used to tell them, so a ticket sat unread.
  const notified = await notifyAdmins('request_received', {
    roleTitle: `Support: ${ticket.subject}`,
    reason: ticket.description || undefined
  }, { inAppOnly: true });

  await recordAudit(actor, {
    action: 'Raise Support Ticket',
    details: `"${ticket.subject}" (${category}, ${ticket.priority} priority).`,
    entityType: 'support_ticket',
    entityId: ticket.id
  });

  return { ok: true, status: 201, data: ticket, warnings: notified.warnings };
}

// ─── Reading ─────────────────────────────────────────────────────────────────

/**
 * Tickets this actor may see, decided server-side.
 *
 * A client sees their own, a candidate sees theirs, operations sees all.
 * Previously the browser queried the table and whatever came back was shown.
 */
export async function listTickets(actor: Actor): Promise<SupportResult> {
  if (!actor) return fail(401, 'Not authenticated.');

  const supabase = getSupabaseClient();
  let query = supabase.from('support_tickets').select('*').order('created_at', { ascending: false });

  if (actor.kind === 'client') {
    query = query.eq('client_id', actor.userId);
  } else if (actor.kind === 'talent') {
    query = query.eq('talent_id', actor.talentProfileId || actor.userId);
  }

  const { data, error } = await query;
  if (error) return fail(500, error.message);

  const tickets = (data || []).map(rowToTicket);
  const ids = tickets.map((t: any) => t.id);

  const { data: messages } = ids.length
    ? await supabase.from('support_messages').select('*').in('ticket_id', ids).order('created_at')
    : { data: [] as any[] };

  return {
    ok: true,
    status: 200,
    data: {
      tickets,
      messages: (messages || []).map((m: any) => ({
        id: m.id,
        ticketId: m.ticket_id,
        senderName: m.sender_name,
        senderRole: m.sender_role,
        isSupport: m.is_support,
        text: m.text,
        createdAt: m.created_at
      }))
    }
  };
}

async function loadTicket(id: string) {
  const supabase = getSupabaseClient();
  const { data } = await supabase.from('support_tickets').select('*').eq('id', id).maybeSingle();
  return data;
}

async function ticketRecipientUserId(ticket: any): Promise<string | null> {
  if (ticket?.client_id) return String(ticket.client_id);
  if (!ticket?.talent_id) return null;

  const { data } = await getSupabaseClient()
    .from('talent_profiles')
    .select('user_id')
    .eq('id', ticket.talent_id)
    .maybeSingle();
  return data?.user_id ? String(data.user_id) : null;
}

function actorOwnsTicket(actor: Actor, ticket: any): boolean {
  if (actor.kind === 'admin') return true;
  if (actor.kind === 'client') return String(ticket.client_id) === String(actor.userId);
  if (actor.kind === 'talent') {
    return String(ticket.talent_id) === String(actor.talentProfileId || actor.userId);
  }
  return false;
}

// ─── Replying ────────────────────────────────────────────────────────────────

export async function replyToTicket(
  actor: Actor,
  input: { ticketId: string; text: string }
): Promise<SupportResult> {
  if (!actor) return fail(401, 'Not authenticated.');
  if (!input.ticketId) return fail(400, 'ticketId is required.');
  if (!input.text?.trim()) return fail(400, 'A reply cannot be empty.');

  const ticket = await loadTicket(input.ticketId);
  if (!ticket) return fail(404, 'That ticket does not exist.');
  if (!actorOwnsTicket(actor, ticket)) return fail(403, 'That ticket is not yours.');

  const supabase = getSupabaseClient();
  const now = new Date().toISOString();
  const isSupport = actor.kind === 'admin';

  const { error } = await supabase.from('support_messages').insert({
    id: newId('smsg'),
    ticket_id: input.ticketId,
    sender_name: actor.email || actor.userId,
    sender_role: actor.kind,
    is_support: isSupport,
    text: input.text.trim(),
    // The column is varchar and NOT NULL, so it gets a readable stamp; the
    // orderable one is created_at.
    timestamp: new Date(now).toISOString(),
    created_at: now
  });

  if (error) return fail(500, `Your reply was not saved: ${error.message}`);

  // A reply from support moves an Open ticket along; a reply from the
  // raiser does not silently reopen a resolved one.
  const nextStatus = isSupport && ticket.status === 'Open' ? 'In Progress' : ticket.status;
  await supabase
    .from('support_tickets')
    .update({ status: nextStatus, last_activity: now })
    .eq('id', input.ticketId);

  const warnings: string[] = [];
  if (isSupport) {
    const recipient = await ticketRecipientUserId(ticket);
    if (recipient) {
      const result = await notifyUsers(recipient, 'request_received', {
        roleTitle: `Support: ${ticket.subject}`,
        reason: 'Support has replied to your ticket.'
      });
      warnings.push(...result.warnings);
    }
  } else {
    const result = await notifyAdmins('request_received', {
      roleTitle: `Support reply: ${ticket.subject}`
    }, { inAppOnly: true });
    warnings.push(...result.warnings);
  }

  return { ok: true, status: 201, data: { ticketId: input.ticketId, status: nextStatus }, warnings };
}

// ─── Status ──────────────────────────────────────────────────────────────────

export async function setTicketStatus(
  actor: Actor,
  input: { ticketId: string; status: string; assignedTo?: string | null }
): Promise<SupportResult> {
  if (!actor) return fail(401, 'Not authenticated.');
  if (actor.kind !== 'admin') return fail(403, 'Only operations can change a ticket status.');
  if (!TICKET_STATUSES.includes(input.status)) {
    return fail(400, `"${input.status}" is not a ticket status.`);
  }

  const ticket = await loadTicket(input.ticketId);
  if (!ticket) return fail(404, 'That ticket does not exist.');

  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from('support_tickets')
    .update({
      status: input.status,
      assigned_to: input.assignedTo ?? ticket.assigned_to,
      last_activity: new Date().toISOString()
    })
    .eq('id', input.ticketId);

  if (error) return fail(500, error.message);

  const warnings: string[] = [];
  const recipient = await ticketRecipientUserId(ticket);
  if (input.status === 'Resolved' && recipient) {
    const result = await notifyUsers(recipient, 'request_received', {
      roleTitle: `Support: ${ticket.subject}`,
      reason: 'Your ticket has been marked resolved.'
    });
    warnings.push(...result.warnings);
  }

  await recordAudit(actor, {
    action: 'Update Support Ticket',
    details: `"${ticket.subject}" moved from ${ticket.status} to ${input.status}.`,
    entityType: 'support_ticket',
    entityId: input.ticketId
  });

  return { ok: true, status: 200, data: { id: input.ticketId, status: input.status }, warnings };
}
