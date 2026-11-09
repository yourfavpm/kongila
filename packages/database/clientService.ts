/**
 * Client companies, for operations.
 *
 * The admin Clients module had no API of its own. It read the whole
 * database through `/api/db` and filtered in the browser: every
 * organisation, every client profile, every request, contract, invoice
 * and payment on the platform, to render one company's page. Before that
 * it read the tables directly with the anon key.
 *
 * `/api/clients` is the resource route that module should always have
 * had. The list is a summary; the detail is one company with the records
 * that belong to it, resolved server-side.
 *
 * There is no write here. A client's own company details are edited by
 * the client through `/api/company`, and their account manager is set
 * through `/api/clients/assign-manager`. Operations editing a company's
 * profile behind their back is not a thing the product does, so the route
 * does not offer it.
 */

import { getSupabaseClient } from './index';
import type { RequestActor as Actor } from './scope';

export interface ClientResult<T = any> {
  ok: boolean;
  status: number;
  error?: string;
  data?: T;
}

function fail(status: number, error: string): ClientResult {
  return { ok: false, status, error };
}

function money(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Every company, with enough on each to render the list.
 *
 * The counts and totals are computed here rather than by shipping every
 * contract and invoice to the browser so it can add them up.
 */
export async function listClients(actor: Actor): Promise<ClientResult> {
  if (!actor) return fail(401, 'Not authenticated.');
  if (actor.kind !== 'admin') return fail(403, 'Not authorised.');

  const supabase = getSupabaseClient();

  const [orgs, profiles, requests, contracts, invoices, users] = await Promise.all([
    supabase.from('organizations').select('*').order('name'),
    supabase.from('client_profiles').select('id, user_id, organization_id, position, phone, permission_level'),
    supabase.from('talent_requests').select('id, client_id, service_type, status, payload, created_at'),
    supabase.from('contracts').select('id, client_id, status, rate_amount, monthly_rate_usd, currency'),
    supabase.from('invoices').select('id, client_id, amount, status, currency'),
    supabase.from('users').select('id, name, email')
  ]);

  if (orgs.error) return fail(500, `Those companies could not be loaded: ${orgs.error.message}`);

  const byOrg = new Map<string, string[]>();
  for (const p of profiles.data || []) {
    if (!p.organization_id) continue;
    const list = byOrg.get(String(p.organization_id)) || [];
    list.push(String(p.user_id));
    byOrg.set(String(p.organization_id), list);
  }

  const userById = new Map<string, any>((users.data || []).map((u: any) => [String(u.id), u]));

  const rows = (orgs.data || []).map((org: any) => {
    const memberIds = byOrg.get(String(org.id)) || [];
    const ours = <T extends { client_id?: string | null }>(list: T[] | null) =>
      (list || []).filter(r => memberIds.includes(String(r.client_id)));

    const orgRequests = ours(requests.data as any[]);
    const orgContracts = ours(contracts.data as any[]);
    const orgInvoices = ours(invoices.data as any[]);
    const manager = org.account_manager_id ? userById.get(String(org.account_manager_id)) : null;

    return {
      id: org.id,
      name: org.name,
      industry: org.industry,
      companySize: org.company_size,
      country: org.country,
      website: org.website,
      status: org.status,
      contactEmail: org.contact_email,
      contactPhone: org.contact_phone,
      createdAt: org.created_at,
      accountManagerId: org.account_manager_id,
      accountManagerName: manager ? (manager.name || manager.email) : null,
      memberCount: memberIds.length,
      requestCount: orgRequests.length,
      openRequestCount: orgRequests.filter((r: any) =>
        !['closed', 'onboarding'].includes(String(r.status || '').toLowerCase())).length,
      activeContractCount: orgContracts.filter((c: any) =>
        ['active', 'fully_signed'].includes(String(c.status || '').toLowerCase())).length,
      // What they are actually billed per month, from live contracts. The
      // dashboard used to show a random number here.
      monthlyRevenue: orgContracts
        .filter((c: any) => ['active', 'fully_signed'].includes(String(c.status || '').toLowerCase()))
        .reduce((sum: number, c: any) => sum + money(c.monthly_rate_usd ?? c.rate_amount), 0),
      outstandingInvoiceTotal: orgInvoices
        .filter((i: any) => ['sent', 'overdue'].includes(String(i.status || '').toLowerCase()))
        .reduce((sum: number, i: any) => sum + money(i.amount), 0),
      hasOverdueInvoice: orgInvoices.some((i: any) =>
        String(i.status || '').toLowerCase() === 'overdue')
    };
  });

  return { ok: true, status: 200, data: rows };
}

/**
 * One company and the records belonging to it.
 *
 * Everything is scoped by the organisation's own member list, resolved
 * here. The page used to do that filtering in the browser, against a copy
 * of every row on the platform.
 */
export async function getClient(actor: Actor, organizationId: string): Promise<ClientResult> {
  if (!actor) return fail(401, 'Not authenticated.');
  if (actor.kind !== 'admin') return fail(403, 'Not authorised.');

  const id = String(organizationId || '').trim();
  if (!id) return fail(400, 'Which company?');

  const supabase = getSupabaseClient();

  const { data: org } = await supabase
    .from('organizations').select('*').eq('id', id).maybeSingle();
  if (!org) return fail(404, 'That company does not exist.');

  const { data: profiles } = await supabase
    .from('client_profiles').select('*').eq('organization_id', id);

  const memberIds = (profiles || []).map((p: any) => String(p.user_id)).filter(Boolean);

  // A company with no members yet has no records either, and `.in()` with
  // an empty list is a query nobody needs to run.
  const empty = { data: [] as any[] };
  const [members, requests, contracts, invoices] = memberIds.length
    ? await Promise.all([
        supabase.from('users').select('id, name, email, role, status').in('id', memberIds),
        supabase.from('talent_requests').select('*').in('client_id', memberIds),
        supabase.from('contracts').select('*').in('client_id', memberIds),
        supabase.from('invoices').select('*').in('client_id', memberIds)
      ])
    : [empty, empty, empty, empty];

  const invoiceIds = (invoices.data || []).map((i: any) => String(i.id));
  const { data: payments } = invoiceIds.length
    ? await supabase.from('payments').select('*').in('invoice_id', invoiceIds)
    : { data: [] as any[] };

  const { data: manager } = org.account_manager_id
    ? await supabase.from('users').select('id, name, email')
        .eq('id', org.account_manager_id).maybeSingle()
    : { data: null };

  const memberById = new Map<string, any>((members.data || []).map((u: any) => [String(u.id), u]));

  return {
    ok: true,
    status: 200,
    data: {
      organization: {
        ...org,
        accountManagerId: org.account_manager_id,
        accountManagerName: manager ? (manager.name || manager.email) : null
      },
      members: (profiles || []).map((p: any) => {
        const user = memberById.get(String(p.user_id));
        return {
          id: p.id,
          userId: p.user_id,
          name: user?.name || null,
          email: user?.email || null,
          status: user?.status || null,
          position: p.position,
          phone: p.phone,
          permissionLevel: p.permission_level
        };
      }),
      requests: (requests.data || []).map((r: any) => ({
        ...(r.payload || {}),
        id: r.payload?.id || r.id,
        rowId: r.id,
        dbId: r.id,
        clientId: r.client_id,
        serviceType: r.payload?.serviceType || r.service_type,
        status: r.payload?.status || r.status,
        createdAt: r.payload?.createdAt || r.created_at
      })),
      contracts: (contracts.data || []).map((c: any) => ({
        id: c.id,
        clientId: c.client_id,
        talentId: c.talent_id,
        serviceType: c.service_type,
        status: c.status,
        rateType: c.rate_type,
        rateAmount: c.rate_amount === null ? null : Number(c.rate_amount),
        monthlyRateUsd: c.monthly_rate_usd === null ? null : Number(c.monthly_rate_usd),
        currency: c.currency,
        startDate: c.start_date,
        endDate: c.end_date,
        signedAt: c.signed_at
      })),
      invoices: (invoices.data || []).map((i: any) => ({
        id: i.id,
        clientId: i.client_id,
        invoiceNumber: i.invoice_number,
        amount: i.amount === null ? null : Number(i.amount),
        currency: i.currency,
        status: i.status,
        issueDate: i.issue_date,
        dueDate: i.due_date
      })),
      payments: (payments || []).map((p: any) => ({
        id: p.id,
        invoiceId: p.invoice_id,
        amount: p.amount === null ? null : Number(p.amount),
        status: p.status,
        paidAt: p.paid_at
      }))
    }
  };
}

/**
 * Who may be assigned as an account manager.
 *
 * The page read `users`, `roles` and `user_roles` from the browser to work
 * this out. Three of those reads were what made `users` readable by
 * anyone signed in.
 */
export async function listAssignableManagers(actor: Actor): Promise<ClientResult> {
  if (!actor) return fail(401, 'Not authenticated.');
  if (actor.kind !== 'admin') return fail(403, 'Not authorised.');

  const supabase = getSupabaseClient();
  const [users, roles, links] = await Promise.all([
    supabase.from('users').select('id, name, email, role, status'),
    supabase.from('roles').select('id, name'),
    supabase.from('user_roles').select('user_id, role_id')
  ]);

  const rolesByUser = new Map<string, string[]>();
  for (const link of links.data || []) {
    const list = rolesByUser.get(String(link.user_id)) || [];
    list.push(String(link.role_id));
    rolesByUser.set(String(link.user_id), list);
  }

  return {
    ok: true,
    status: 200,
    data: {
      users: (users.data || []).map((u: any) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
        status: u.status,
        roleIds: rolesByUser.get(String(u.id)) || []
      })),
      roles: roles.data || []
    }
  };
}
