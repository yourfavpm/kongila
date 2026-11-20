import { getSupabaseClient } from './index';
import type { RequestActor as Actor } from './scope';
import { recordAudit } from './audit';
import { adminPortalUrl, clientPortalUrl, notifyAdmins, notifyUsers } from './notify';
import { serviceLineOf } from '@kongila/workflows';
import { complianceGate } from './signatureService';
import { isAdminRole } from '@kongila/auth';
import { requestTitle } from '@kongila/shared-types';

export interface EngagementActivationInput {
  contractId: string;
  serviceLine: 'placement' | 'outsourcing' | 'managed_workforce' | 'project';
  managementMode?: 'client_managed' | 'kongila_managed' | 'hybrid';
  supervisorId?: string | null;
  startDate: string;
  workingPattern?: string;
  activationChecks: {
    compliance_cleared: boolean;
    tools_access_ready: boolean;
    introduction_booked: boolean;
  };
  groupId?: string | null;
  groupName?: string;
  coverageType?: string;
  managementPremiumPct?: number | null;
  project?: { name: string; description?: string; deadline?: string };
  milestones?: Array<{ title: string; description?: string; sequence: number; amountUsd: number; dueDate?: string }>;
}

const fail = (status: number, error: string) => ({ ok: false as const, status, error });

export async function listEngagements(actor: Actor) {
  if (!actor) return fail(401, 'Not authenticated.');
  if (actor.kind === 'admin' && actor.role === 'finance') return fail(403, 'Finance can manage invoices and payroll, but not talent engagement details.');
  const supabase = getSupabaseClient();
  let query = supabase.from('assignments').select('*, contracts!inner(client_id, talent_id, service_type, role_title, rate_amount, rate_type, currency, status, placement_fee_usd, project_fee_usd, offer_id), projects(name, description, deadline, status), engagement_groups(name, coverage_type, kongila_lead_id)');
  let clientIds: string[] = [];
  if (actor.kind === 'client') {
    const { data: ownProfile } = await supabase.from('client_profiles').select('organization_id').eq('user_id', actor.userId).maybeSingle();
    if (ownProfile?.organization_id) {
      const { data: colleagues, error: colleaguesError } = await supabase.from('client_profiles').select('user_id').eq('organization_id', ownProfile.organization_id);
      if (colleaguesError) return fail(500, `Could not verify your company team: ${colleaguesError.message}`);
      clientIds = Array.from(new Set([actor.userId, ...(colleagues || []).map((row: any) => String(row.user_id))]));
    } else clientIds = [actor.userId];
    query = query.in('contracts.client_id', clientIds);
  }
  else if (actor.kind === 'talent') query = query.eq('talent_id', actor.talentProfileId || actor.userId);
  else if (!actor.permissions?.includes('contracts.view') && !actor.permissions?.includes('contracts.manage')) {
    return fail(403, 'Your role cannot view engagements.');
  } else if (actor.role === 'account_manager') {
    const { data: organizations } = await supabase.from('organizations').select('id').eq('account_manager_id', actor.userId);
    const organizationIds = (organizations || []).map((row: any) => String(row.id));
    if (!organizationIds.length) return { ok: true as const, status: 200, data: [] };
    const { data: clients } = await supabase.from('client_profiles').select('user_id').in('organization_id', organizationIds);
    const clientIds = (clients || []).map((row: any) => String(row.user_id));
    if (!clientIds.length) return { ok: true as const, status: 200, data: [] };
    query = query.in('contracts.client_id', clientIds);
  }
  const { data, error } = await query.order('start_date', { ascending: false });
  if (error) return fail(500, `Could not load engagements: ${error.message}`);
  const rows = data || [];
  // Offers create contracts as soon as the talent accepts, but operational
  // assignments are intentionally written only after contract signature and
  // activation. Show accepted hires during that gap so My Team never looks
  // empty while the client is completing the remaining steps.
  let pendingContracts: any[] = [];
  if (actor.kind === 'client' && clientIds.length) {
    const { data: contracts, error: contractsError } = await supabase.from('contracts')
      .select('id, client_id, talent_id, service_type, role_title, rate_amount, rate_type, currency, status, start_date, offer_id, created_at')
      .in('client_id', clientIds)
      .in('status', ['pending_signatures', 'client_signed', 'talent_signed', 'fully_signed', 'active']);
    if (contractsError) return fail(500, `Could not load your accepted hires: ${contractsError.message}`);
    const assigned = new Set(rows.map((row: any) => String(row.contract_id)));
    const missing = (contracts || []).filter((contract: any) => !assigned.has(String(contract.id)));
    const talentIds = [...new Set(missing.map((contract: any) => String(contract.talent_id)).filter(Boolean))];
    const { data: talentRows } = talentIds.length
      ? await supabase.from('talent_profiles').select('id, full_name, country, avatar_url').in('id', talentIds)
      : { data: [] as any[] };
    const talentById = new Map((talentRows || []).map((talent: any) => [String(talent.id), talent]));
    pendingContracts = missing.map((contract: any) => ({
      id: `contract:${contract.id}`,
      contract_id: contract.id,
      talent_id: contract.talent_id,
      service_line: serviceLineOf(contract.service_type) || 'outsourcing',
      role: contract.role_title,
      status: 'contract_pending',
      operational_status: contract.status,
      start_date: contract.start_date,
      contracts: contract,
      talent: talentById.get(String(contract.talent_id)) || null,
      clientName: 'Your organisation',
      milestones: []
    }));
  }
  const talentIds = [...new Set(rows.map((row: any) => row.talent_id).filter(Boolean).map(String))];
  const engagementClientIds = [...new Set(rows.map((row: any) => row.contracts?.client_id).filter(Boolean).map(String))];
  const contactIds = [...new Set(rows.flatMap((row: any) => [row.kongila_supervisor_id, row.account_manager_id, row.engagement_groups?.kongila_lead_id, ...(actor.kind === 'talent' ? [row.contracts?.client_id] : [])]).filter(Boolean).map(String))];
  const projectIds = [...new Set(rows.map((row: any) => row.project_id).filter(Boolean).map(String))];
  const [{ data: talents }, { data: contacts }, { data: milestones }, { data: clientProfiles }] = await Promise.all([
    talentIds.length ? supabase.from('talent_profiles').select('id, full_name, country, avatar_url').in('id', talentIds) : Promise.resolve({ data: [] as any[] }),
    contactIds.length ? supabase.from('users').select('id, name, email').in('id', contactIds) : Promise.resolve({ data: [] as any[] }),
    projectIds.length ? supabase.from('project_milestones').select('*').in('project_id', projectIds).order('sequence') : Promise.resolve({ data: [] as any[] }),
    engagementClientIds.length ? supabase.from('client_profiles').select('user_id, organization_id').in('user_id', engagementClientIds) : Promise.resolve({ data: [] as any[] })
  ]);
  const talentById = new Map((talents || []).map((row: any) => [String(row.id), row]));
  const contactById = new Map((contacts || []).map((row: any) => [String(row.id), row]));
  const organizationIds = [...new Set((clientProfiles || []).map((row: any) => row.organization_id).filter(Boolean).map(String))];
  const { data: organizations } = organizationIds.length
    ? await supabase.from('organizations').select('id, name').in('id', organizationIds)
    : { data: [] as any[] };
  const organizationName = new Map((organizations || []).map((row: any) => [String(row.id), row.name]));
  const clientNameById = new Map((clientProfiles || []).map((row: any) => [String(row.user_id), organizationName.get(String(row.organization_id)) || 'Client organisation']));
  const milestonesByProject = new Map<string, any[]>();
  for (const milestone of milestones || []) {
    const key = String(milestone.project_id);
    milestonesByProject.set(key, [...(milestonesByProject.get(key) || []), milestone]);
  }
  return {
    ok: true as const,
    status: 200,
    data: [...rows.map((row: any) => ({
      ...row,
      talent: talentById.get(String(row.talent_id)) || null,
      clientName: clientNameById.get(String(row.contracts?.client_id)) || 'Client organisation',
      supervisor: row.kongila_supervisor_id ? contactById.get(String(row.kongila_supervisor_id)) || null : null,
      accountManager: row.account_manager_id ? contactById.get(String(row.account_manager_id)) || null : null,
      clientContact: row.contracts?.client_id ? contactById.get(String(row.contracts.client_id)) || null : null,
      groupLead: row.engagement_groups?.kongila_lead_id ? contactById.get(String(row.engagement_groups.kongila_lead_id)) || null : null,
      milestones: row.project_id
        ? (milestonesByProject.get(String(row.project_id)) || []).filter((milestone: any) => String(milestone.contract_id) === String(row.contract_id))
        : []
    })), ...pendingContracts]
  };
}

export async function activateEngagement(actor: Actor, input: EngagementActivationInput) {
  if (!actor) return fail(401, 'Not authenticated.');
  if (actor.kind !== 'admin') return fail(403, 'Only an authorised operator can activate an engagement.');
  if (!actor.permissions?.includes('contracts.manage')) return fail(403, 'Your role cannot activate contracts.');
  if (!input.contractId || !input.startDate) return fail(400, 'Contract and confirmed start date are required.');
  if (input.serviceLine !== 'placement' && !input.activationChecks
    || input.serviceLine !== 'placement' && Object.values(input.activationChecks).some(v => v !== true)) {
    return fail(422, 'Complete all activation checklist items first.');
  }

  const supabase = getSupabaseClient();
  const { data: contract, error } = await supabase.from('contracts').select('id, client_id, talent_id, offer_id, status, service_type, start_date, project_fee_usd, placement_fee_invoiced_at').eq('id', input.contractId).maybeSingle();
  if (error) return fail(500, error.message);
  if (!contract) return fail(404, 'Contract not found.');
  if (contract.status !== 'fully_signed') return fail(409, 'The contract must be fully signed before activating work.');
  const complianceRefusal = await complianceGate('issue_contract', String(contract.talent_id));
  if (complianceRefusal) return fail(409, `Compliance gate: ${complianceRefusal}`);
  let contractLine = serviceLineOf(contract.service_type);
  let linkedRequestId: string | null = null;
  if (contract.offer_id) {
    const { data: offer } = await supabase.from('offers').select('request_id').eq('id', contract.offer_id).maybeSingle();
    linkedRequestId = offer?.request_id ? String(offer.request_id) : null;
    if (!contractLine && linkedRequestId) {
      const { data: request } = await supabase.from('talent_requests').select('payload').eq('id', linkedRequestId).maybeSingle();
      const payload: any = request?.payload || {};
      contractLine = serviceLineOf(payload.serviceType || payload.service_type || payload.engagementType || payload.selectedService);
    }
  }
  if (contractLine && contractLine !== input.serviceLine) return fail(422, 'The selected service line does not match the signed request or offer.');
  if (!contractLine) return fail(422, 'The service line could not be confirmed from the linked request or offer.');

  let supervisorId = input.supervisorId || null;
  if (supervisorId) {
    const lookup = supabase.from('users').select('id, role, status');
    const { data: operator } = supervisorId.includes('@')
      ? await lookup.eq('email', supervisorId).maybeSingle()
      : await lookup.eq('id', supervisorId).maybeSingle();
    if (!operator || !isAdminRole(operator.role) || ['finance','skill_assessor'].includes(String(operator.role)) || operator.status !== 'active') {
      return fail(422, 'Choose an active Kongila operator as the work supervisor.');
    }
    supervisorId = String(operator.id);
  }

  let accountManagerId: string | null = null;
  const { data: clientProfile } = await supabase.from('client_profiles').select('organization_id').eq('user_id', contract.client_id).maybeSingle();
  if (clientProfile?.organization_id) {
    const { data: org } = await supabase.from('organizations').select('account_manager_id').eq('id', clientProfile.organization_id).maybeSingle();
    accountManagerId = org?.account_manager_id || null;
  }

  if (input.serviceLine === 'placement' && !contract.placement_fee_invoiced_at) {
    return fail(409, 'Prepare the placement fee invoice and release the candidate to the client before activating the signed placement.');
  }
  if (input.serviceLine === 'managed_workforce' && input.managementMode !== 'kongila_managed') {
    return fail(422, 'Managed workforce engagements are operated by Kongila; confirm Kongila-managed supervision.');
  }
  if (input.serviceLine === 'project') {
    if ((input.milestones || []).some(item => !String(item.title || '').trim() || !Number.isFinite(Number(item.amountUsd)) || Number(item.amountUsd) <= 0)) {
      return fail(422, 'Every project milestone needs a title and a positive amount.');
    }
    const milestonesTotal = (input.milestones || []).reduce((sum, item) => sum + Number(item.amountUsd || 0), 0);
    if (!input.project?.name || !input.milestones?.length || Math.abs(milestonesTotal - Number(contract.project_fee_usd || 0)) > 0.01) {
      return fail(422, 'Add the project details and milestones whose amounts equal the agreed project fee.');
    }
  }
  if (input.serviceLine === 'outsourcing' && input.managementMode === 'kongila_managed'
    && (input.managementPremiumPct == null || input.managementPremiumPct < 0.1 || input.managementPremiumPct > 0.2)) {
    return fail(422, 'Choose the agreed Kongila supervision premium between 10% and 20%.');
  }

  const { data: result, error: activationError } = await supabase.rpc('activate_contract_engagement', {
    p_contract_id: input.contractId,
    p_service_line: input.serviceLine,
    p_management_mode: input.managementMode || null,
    p_supervisor_id: supervisorId,
    p_account_manager_id: accountManagerId,
    p_engagement_group_id: input.groupId || null,
    p_start_date: input.startDate,
    p_working_pattern: input.workingPattern || null,
    p_activation_checks: input.activationChecks || {},
    p_project: input.project
      ? { ...input.project, request_id: linkedRequestId, group_name: input.groupName, coverage_type: input.coverageType }
      : input.serviceLine === 'managed_workforce' ? { request_id: linkedRequestId, group_name: input.groupName, coverage_type: input.coverageType } : null,
    p_milestones: input.milestones || [],
    p_management_premium_pct: input.managementPremiumPct ?? null
  });
  if (activationError) return fail(/fully signed|checklist|supervisor|required|milestone|premium|service line|management mode/i.test(activationError.message) ? 422 : 500, activationError.message);

  await recordAudit(actor, { action: 'Activate Engagement', details: `Activated ${input.serviceLine} engagement for contract ${input.contractId}.`, entityType: 'contract', entityId: input.contractId });
  const parties = [contract.client_id, contract.talent_id, accountManagerId, supervisorId].filter(Boolean).map(String);
  if (parties.length) {
    const notice = await notifyUsers(parties, 'engagement_activated', {
      roleTitle: contract.service_type || undefined,
      serviceLine: input.serviceLine,
      managementMode: input.managementMode
    }, { sourceRecordId: String(input.contractId) });
    return { ok: true as const, status: 200, data: result, warnings: notice.warnings };
  }
  return { ok: true as const, status: 200, data: result, warnings: [] };
}

export async function invoiceProjectMilestone(actor: Actor, milestoneId: string) {
  if (!actor) return fail(401, 'Not authenticated.');
  if (actor.kind !== 'admin' || !actor.permissions?.includes('finance.manage')) return fail(403, 'Your role cannot invoice project milestones.');
  const { data, error } = await getSupabaseClient().rpc('invoice_completed_project_milestone', {
    p_milestone_id: milestoneId,
    p_due_date: new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10)
  });
  if (error) return fail(/not found|completed|milestone/i.test(error.message) ? 422 : 500, error.message);
  await recordAudit(actor, { action: 'Invoice Project Milestone', details: `Created invoice for completed milestone ${milestoneId}.`, entityType: 'project_milestone', entityId: milestoneId });
  return { ok: true as const, status: 200, data };
}

export async function completeProjectMilestone(actor: Actor, milestoneId: string) {
  if (!actor) return fail(401, 'Not authenticated.');
  if (actor.kind !== 'admin' || !actor.permissions?.includes('contracts.manage')) return fail(403, 'Your role cannot confirm project delivery.');
  if (!milestoneId) return fail(400, 'Choose a milestone.');
  const supabase = getSupabaseClient();
  const { data: milestone, error: readError } = await supabase.from('project_milestones').select('id, status, invoice_id').eq('id', milestoneId).maybeSingle();
  if (readError) return fail(500, readError.message);
  if (!milestone) return fail(404, 'Milestone not found.');
  if (milestone.invoice_id) return { ok: true as const, status: 200, data: { alreadyInvoiced: true } };
  if (milestone.status !== 'completed') {
    const { error } = await supabase.from('project_milestones').update({ status: 'completed', completed_at: new Date().toISOString() }).eq('id', milestoneId).in('status', ['pending', 'in_progress']);
    if (error) return fail(500, `Milestone completion was not recorded: ${error.message}`);
  }
  await recordAudit(actor, { action: 'Complete Project Milestone', details: `Confirmed milestone ${milestoneId} as delivered; finance can invoice it.`, entityType: 'project_milestone', entityId: milestoneId });
  return { ok: true as const, status: 200, data: { completed: true, invoicingRequiresFinance: true } };
}

export async function completeProjectEngagement(actor: Actor, projectId: string) {
  if (!actor) return fail(401, 'Not authenticated.');
  if (actor.kind !== 'admin' || !actor.permissions?.includes('contracts.manage')) return fail(403, 'Your role cannot hand over project delivery.');
  if (!projectId) return fail(400, 'Choose a project.');
  const { data, error } = await getSupabaseClient().rpc('complete_project_engagements', { p_project_id: projectId });
  if (error) return fail(/not found|milestone|complete/i.test(error.message) ? 422 : 500, error.message);
  await recordAudit(actor, { action: 'Complete Project Handover', details: `Completed project ${projectId} and ended its active engagements.`, entityType: 'project', entityId: projectId });
  return { ok: true as const, status: 200, data };
}

export async function requestPlacementReplacement(actor: Actor, input: { assignmentId: string; reason: string; notes?: string }) {
  if (!actor) return fail(401, 'Not authenticated.');
  if (actor.kind !== 'client') return fail(403, 'Only the client can request a placement replacement.');
  if (!input.assignmentId || !String(input.reason || '').trim()) return fail(400, 'Select the placement and explain why a replacement is needed.');

  const supabase = getSupabaseClient();
  const { data: assignment, error } = await supabase.from('assignments')
    .select('id, role, status, guarantee_end_date, guarantee_months, contract_id, contracts!inner(id, client_id, role_title, service_type)')
    .eq('id', input.assignmentId).maybeSingle();
  if (error) return fail(500, `Could not verify the placement guarantee: ${error.message}`);
  if (!assignment) return fail(404, 'Placement engagement not found.');
  const contract = (assignment as any).contracts;
  let companyClientIds = [String(actor.userId)];
  if (String(contract?.client_id) !== String(actor.userId)) {
    const [{ data: contractClient }, { data: callerClient }] = await Promise.all([
      supabase.from('client_profiles').select('organization_id').eq('user_id', contract?.client_id).maybeSingle(),
      supabase.from('client_profiles').select('organization_id').eq('user_id', actor.userId).maybeSingle()
    ]);
    if (!contractClient?.organization_id || contractClient.organization_id !== callerClient?.organization_id) {
      return fail(403, 'This placement does not belong to your organisation.');
    }
    const { data: companyUsers } = await supabase.from('client_profiles').select('user_id').eq('organization_id', contractClient.organization_id);
    companyClientIds = [...new Set([String(actor.userId), ...(companyUsers || []).map((row: any) => String(row.user_id))])];
  }
  if (serviceLineOf(contract?.service_type) !== 'placement') return fail(422, 'Replacement requests are only available for direct-hire placements.');
  const today = new Date().toISOString().slice(0, 10);
  if (!assignment.guarantee_end_date || assignment.guarantee_end_date < today || assignment.status === 'ended') {
    return fail(409, 'The recorded placement guarantee window has ended.');
  }
  const { data: previousRequests } = await supabase.from('talent_requests').select('id, status, payload')
    .in('client_id', companyClientIds).contains('payload', { replacedAssignmentId: assignment.id }).limit(10);
  if ((previousRequests || []).some((row: any) => !['closed','cancelled','rejected'].includes(String(row.status || '').toLowerCase()))) {
    return fail(409, 'A replacement request for this placement is already open.');
  }

  const createdAt = new Date().toISOString();
  const id = globalThis.crypto?.randomUUID?.() || `req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const title = String(contract.role_title || assignment.role || 'Direct hire replacement');
  const payload: Record<string, any> = {
    id,
    referenceNumber: `KNG-REP-${createdAt.slice(0, 10).replace(/-/g, '')}-${id.slice(0, 8).toUpperCase()}`,
    clientId: actor.userId,
    serviceType: 'Hire Talent',
    roleTitle: title,
    roleDescription: title,
    requiredSkills: [],
    numberOfHires: 1,
    budget: 0,
    status: 'New Request',
    priority: 'High',
    urgency: 'ASAP',
    isReplacement: true,
    freeReplacement: true,
    replacementGuaranteeEndDate: assignment.guarantee_end_date,
    replacedContractId: contract.id,
    replacedAssignmentId: assignment.id,
    replacementReason: String(input.reason).trim(),
    internalNotes: String(input.notes || '').trim(),
    createdAt
  };
  payload.title = requestTitle(payload);
  const { data: row, error: insertError } = await supabase.from('talent_requests').insert({
    client_id: actor.userId, service_type: 'Hire Talent', payload, status: 'new',
    role_description: title, title: payload.title
  }).select('*').single();
  if (insertError) return fail(500, `The replacement request was not saved: ${insertError.message}`);

  await recordAudit(actor, { action: 'Request Placement Replacement', details: `Requested a replacement under the active ${assignment.guarantee_months || 4}-month guarantee for assignment ${assignment.id}.`, entityType: 'assignment', entityId: String(assignment.id) });
  const [{ warnings: opsWarnings }, { warnings: clientWarnings }] = await Promise.all([
    notifyAdmins('new_request_for_ops', { roleTitle: title, companyName: actor.email || undefined, actionUrl: adminPortalUrl(`/requests/${row.id}`) }),
    notifyUsers(actor.userId, 'request_received', { roleTitle: title, actionUrl: clientPortalUrl('/?section=requests') }, { sourceRecordId: String(row.id) })
  ]);
  return { ok: true as const, status: 201, data: { request: { ...payload, rowId: row.id, id: row.id } }, warnings: [...opsWarnings, ...clientWarnings] };
}
