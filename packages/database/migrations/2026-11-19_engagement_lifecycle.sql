-- Contract-to-work lifecycle. This migration is intentionally additive: a signed
-- contract remains signed until an operator explicitly activates an engagement.
begin;

insert into public.platform_settings(key, value, description, category)
values ('placement_guarantee_months', '4'::jsonb,
  'Free-replacement guarantee window applied to newly activated placement engagements.', 'finance')
on conflict (key) do nothing;

create table if not exists public.engagement_groups (
  id text primary key default ('eng_' || gen_random_uuid()::text),
  client_id text not null references public.users(id),
  service_line text not null check (service_line in ('managed_workforce')),
  request_id text,
  name text not null,
  coverage_type text,
  sla_definition jsonb not null default '{}'::jsonb,
  kongila_lead_id text references public.users(id),
  status text not null default 'pending_start'
    check (status in ('pending_start','active','paused','ended')),
  created_by text references public.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.assignments
  add column if not exists service_line text,
  add column if not exists management_mode text,
  add column if not exists kongila_supervisor_id text references public.users(id),
  add column if not exists account_manager_id text references public.users(id),
  add column if not exists engagement_group_id text references public.engagement_groups(id),
  add column if not exists working_pattern text,
  add column if not exists activation_checks jsonb not null default '{}'::jsonb,
  add column if not exists ended_reason text,
  add column if not exists guarantee_months integer,
  add column if not exists guarantee_end_date date,
  add column if not exists management_premium_pct numeric(5,4),
  add column if not exists activated_at timestamptz,
  add column if not exists updated_at timestamptz not null default now();

alter table public.assignments drop constraint if exists assignments_status_check;
update public.assignments set status = 'ended', ended_reason = 'completed' where status = 'completed';
alter table public.assignments add constraint assignments_status_check
  check (status in ('pending_start','active','paused','ended'));

do $foreign_keys$
begin
  if exists (select 1 from pg_constraint where conname = 'assignments_contract_id_fkey'
    and conrelid = 'public.assignments'::regclass) then
    alter table public.assignments drop constraint assignments_contract_id_fkey;
  end if;
  alter table public.assignments add constraint assignments_contract_id_fkey
    foreign key (contract_id) references public.contracts(id) on delete restrict;
  if not exists (select 1 from pg_constraint where conname = 'assignments_project_id_fkey') then
    alter table public.assignments add constraint assignments_project_id_fkey
      foreign key (project_id) references public.projects(id) on delete set null;
  end if;
end
$foreign_keys$;

do $constraints$
begin
  if not exists (select 1 from pg_constraint where conname = 'assignments_service_line_check') then
    alter table public.assignments add constraint assignments_service_line_check
      check (service_line is null or service_line in ('placement','outsourcing','managed_workforce','project'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'assignments_management_mode_check') then
    alter table public.assignments add constraint assignments_management_mode_check
      check (management_mode is null or management_mode in ('client_managed','kongila_managed','hybrid'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'assignments_end_reason_check') then
    alter table public.assignments add constraint assignments_end_reason_check
      check (ended_reason is null or ended_reason in ('completed','terminated','converted','replaced'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'assignments_management_premium_check') then
    alter table public.assignments add constraint assignments_management_premium_check
      check (management_premium_pct is null or management_premium_pct between 0.10 and 0.20);
  end if;
end
$constraints$;

-- Preserve current operational records when billing/payroll switch their
-- source from contracts to engagements.
update public.assignments a set service_line = case
  when replace(replace(lower(coalesce(c.service_type,'')), ' ', '_'), '-', '_') in ('hire_talent','direct_hire','placement') then 'placement'
  when replace(replace(lower(coalesce(c.service_type,'')), ' ', '_'), '-', '_') in ('outsource_talent','talent_outsourcing','outsourcing') then 'outsourcing'
  when replace(replace(lower(coalesce(c.service_type,'')), ' ', '_'), '-', '_') in ('managed_workforce','managed_service') then 'managed_workforce'
  when replace(replace(lower(coalesce(c.service_type,'')), ' ', '_'), '-', '_') in ('project_execution','project_management','project') then 'project'
  else null end
from public.contracts c where c.id = a.contract_id and a.service_line is null;

update public.assignments a set management_mode = case
  when a.service_line = 'placement' then 'client_managed'
  when a.service_line = 'managed_workforce' then 'kongila_managed'
  when lower(coalesce(r.payload ->> 'supervisionLevel','')) like '%kongila%' then 'kongila_managed'
  when lower(coalesce(r.payload ->> 'supervisionLevel','')) like '%hybrid%' then 'hybrid'
  when a.service_line = 'outsourcing' then 'client_managed'
  else a.management_mode end
from public.contracts c
left join public.offers o on o.id = c.offer_id
left join public.talent_requests r on r.id = o.request_id
where c.id = a.contract_id and a.management_mode is null and a.service_line is not null;

update public.assignments a set account_manager_id = o.account_manager_id
from public.contracts c
join public.client_profiles cp on cp.user_id = c.client_id
join public.organizations o on o.id = cp.organization_id
where c.id = a.contract_id and a.account_manager_id is null and o.account_manager_id is not null;

create unique index if not exists assignments_contract_unique_idx
  on public.assignments(contract_id) where contract_id is not null;
create index if not exists assignments_client_active_idx
  on public.assignments(account_manager_id, status, service_line);
create index if not exists assignments_talent_active_idx
  on public.assignments(talent_id, status);
create unique index if not exists engagement_groups_client_request_unique_idx
  on public.engagement_groups(client_id, request_id) where request_id is not null and status <> 'ended';

alter table public.projects
  add column if not exists engagement_group_id text references public.engagement_groups(id),
  add column if not exists request_id text,
  add column if not exists deadline date,
  add column if not exists coverage_type text,
  add column if not exists kongila_lead_id text references public.users(id),
  add column if not exists status_detail text;
create unique index if not exists projects_client_request_unique_idx
  on public.projects(client_id, request_id) where request_id is not null and status <> 'completed';

create table if not exists public.project_milestones (
  id text primary key default ('milestone_' || gen_random_uuid()::text),
  project_id varchar(255) not null references public.projects(id) on delete cascade,
  contract_id varchar(255) not null references public.contracts(id),
  title text not null,
  description text,
  sequence integer not null,
  amount_usd numeric(12,2) not null check (amount_usd > 0),
  due_date date,
  status text not null default 'pending' check (status in ('pending','in_progress','completed','invoiced')),
  completed_at timestamptz,
  invoice_id varchar(255) references public.invoices(id),
  created_at timestamptz not null default now(),
  unique(project_id, contract_id, sequence)
);

alter table public.invoices
  add column if not exists engagement_id varchar(255),
  add column if not exists project_milestone_id text references public.project_milestones(id),
  add column if not exists invoice_trigger text;

create unique index if not exists invoices_project_milestone_unique_idx
  on public.invoices(project_milestone_id) where project_milestone_id is not null;

alter table public.kongila_payroll_entries
  add column if not exists assignment_id varchar(255);

create index if not exists payroll_entries_assignment_idx
  on public.kongila_payroll_entries(assignment_id, period);

alter table public.contracts
  add column if not exists role_title text,
  add column if not exists placement_fee_invoiced_at timestamptz,
  add column if not exists placement_guarantee_months integer not null default 4,
  add column if not exists placement_activated_at timestamptz;

do $placement$
begin
  if not exists (select 1 from pg_constraint where conname = 'contracts_placement_guarantee_months_check') then
    alter table public.contracts add constraint contracts_placement_guarantee_months_check
      check (placement_guarantee_months between 1 and 24);
  end if;
end
$placement$;

update public.assignments a set
  guarantee_months = coalesce(a.guarantee_months, c.placement_guarantee_months, 4),
  guarantee_end_date = coalesce(a.guarantee_end_date,
    (a.start_date + make_interval(months => coalesce(c.placement_guarantee_months, 4)))::date)
from public.contracts c
where c.id = a.contract_id and a.service_line = 'placement' and a.start_date is not null;

-- A completed direct-hire guarantee removes the professional from the
-- available talent pool without pretending they are a Kongila employee.
alter table public.talent_profiles drop constraint if exists talent_profiles_status_check;
alter table public.talent_profiles add constraint talent_profiles_status_check
  check (status in ('active','assigned','inactive','placed_externally'));

-- Contracts already marked active are already operating; preserve them as
-- active engagement records so the billing/payroll source switch does not
-- silently stop their existing cycles. New signed contracts still require
-- the explicit activation action below.
with legacy_active as (
  select c.id as contract_id, c.client_id, o.request_id, r.payload,
    coalesce(nullif(r.payload ->> 'teamName',''), nullif(r.payload ->> 'functionName',''), 'Managed workforce') as group_name,
    coalesce(nullif(r.payload ->> 'coverageType',''), 'business_hours') as coverage_type,
    coalesce(c.placement_guarantee_months,4) as guarantee_months
  from public.contracts c
  left join public.offers o on o.id = c.offer_id
  left join public.talent_requests r on r.id = o.request_id
  where c.status = 'active'
    and replace(replace(lower(coalesce(c.service_type,'')), ' ', '_'), '-', '_') in ('managed_workforce','managed_service')
)
insert into public.engagement_groups(id, client_id, service_line, request_id, name, coverage_type, status)
select 'eng_legacy_' || md5(client_id || '|' || coalesce(request_id, contract_id)), client_id,
  'managed_workforce', request_id, group_name, coverage_type, 'active'
from legacy_active
group by client_id, request_id, contract_id, group_name, coverage_type
on conflict do nothing;

with mapped as (
  select c.*, case
    when replace(replace(lower(coalesce(c.service_type,'')), ' ', '_'), '-', '_') in ('hire_talent','direct_hire','placement') then 'placement'
    when replace(replace(lower(coalesce(c.service_type,'')), ' ', '_'), '-', '_') in ('outsource_talent','talent_outsourcing','outsourcing') then 'outsourcing'
    when replace(replace(lower(coalesce(c.service_type,'')), ' ', '_'), '-', '_') in ('managed_workforce','managed_service') then 'managed_workforce'
    when replace(replace(lower(coalesce(c.service_type,'')), ' ', '_'), '-', '_') in ('project_execution','project_management','project') then 'project'
    else null end as engagement_line,
    o.request_id, r.payload,
    org.account_manager_id
  from public.contracts c
  left join public.offers o on o.id = c.offer_id
  left join public.talent_requests r on r.id = o.request_id
  left join public.client_profiles cp on cp.user_id = c.client_id
  left join public.organizations org on org.id = cp.organization_id
  where c.status = 'active'
)
insert into public.assignments(
  talent_id, contract_id, role, start_date, end_date, status, service_line,
  management_mode, account_manager_id, engagement_group_id, guarantee_months,
  guarantee_end_date, activated_at
)
select m.talent_id, m.id, left(coalesce(m.role_title,m.service_type,'Contract'),100),
  m.start_date, m.end_date, 'active', m.engagement_line,
  case when m.engagement_line = 'placement' then 'client_managed'
       when m.engagement_line = 'managed_workforce' then 'kongila_managed'
       when lower(coalesce(m.payload ->> 'supervisionLevel','')) like '%kongila%' then 'kongila_managed'
       when lower(coalesce(m.payload ->> 'supervisionLevel','')) like '%hybrid%' then 'hybrid'
       when m.engagement_line = 'outsourcing' then 'client_managed'
       else null end,
  m.account_manager_id,
  case when m.engagement_line = 'managed_workforce'
    then 'eng_legacy_' || md5(m.client_id || '|' || coalesce(m.request_id,m.id)) else null end,
  case when m.engagement_line = 'placement' then m.placement_guarantee_months else null end,
  case when m.engagement_line = 'placement' and m.start_date is not null
    then (m.start_date + make_interval(months => m.placement_guarantee_months))::date else null end,
  coalesce(m.signed_at, m.start_date::timestamptz, now())
from mapped m
where m.engagement_line is not null
  and not exists (select 1 from public.assignments a where a.contract_id = m.id);

-- Atomic, idempotent activation. All checklist fields must be explicitly true.
create or replace function public.activate_contract_engagement(
  p_contract_id text,
  p_service_line text,
  p_management_mode text,
  p_supervisor_id text,
  p_account_manager_id text,
  p_engagement_group_id text,
  p_start_date date,
  p_working_pattern text,
  p_activation_checks jsonb,
  p_project jsonb default null,
  p_milestones jsonb default '[]'::jsonb,
  p_management_premium_pct numeric default null
) returns jsonb
language plpgsql security definer set search_path = public as $fn$
declare
  c public.contracts%rowtype;
  assignment_row public.assignments%rowtype;
  project_id_value text;
  group_id_value text := nullif(p_engagement_group_id, '');
  check_key text;
begin
  select * into c from public.contracts where id = p_contract_id for update;
  if not found then raise exception 'Contract not found'; end if;
  if c.status <> 'fully_signed' then raise exception 'Only a fully signed contract can be activated'; end if;
  if exists (select 1 from public.assignments where contract_id = c.id) then
    select * into assignment_row from public.assignments where contract_id = c.id;
    if assignment_row.status = 'active' then
      update public.contracts set status = 'active', start_date = assignment_row.start_date, updated_at = now()
      where id = c.id and status = 'fully_signed';
    end if;
    return jsonb_build_object('assignment_id', assignment_row.id, 'project_id', assignment_row.project_id,
      'engagement_group_id', assignment_row.engagement_group_id, 'status', assignment_row.status, 'already_active', true);
  end if;
  if p_service_line not in ('placement','outsourcing','managed_workforce','project') then
    raise exception 'Unknown service line';
  end if;
  if p_service_line <> 'placement' and coalesce(p_management_mode,'') not in ('client_managed','kongila_managed','hybrid') then
    raise exception 'Choose a management mode';
  end if;
  if p_service_line = 'managed_workforce' and p_management_mode <> 'kongila_managed' then
    raise exception 'Managed workforce functions must be operated by Kongila';
  end if;
  if p_start_date is null then raise exception 'A confirmed start date is required'; end if;
  if (p_management_mode = 'kongila_managed' or p_service_line = 'managed_workforce') and p_supervisor_id is null then
    raise exception 'A Kongila supervisor is required';
  end if;
  if p_service_line = 'placement' and p_start_date is null then
    raise exception 'A placement start date is required';
  end if;
  if p_service_line <> 'placement' then
    foreach check_key in array array['compliance_cleared','tools_access_ready','introduction_booked'] loop
      if coalesce((p_activation_checks ->> check_key)::boolean, false) is not true then
        raise exception 'Activation checklist incomplete: %', check_key;
      end if;
    end loop;
  end if;
  if p_management_premium_pct is not null and p_management_premium_pct not between 0.10 and 0.20 then
    raise exception 'Kongila supervision premium must be between 10%% and 20%%';
  end if;
  if p_service_line = 'outsourcing' and p_management_mode = 'kongila_managed' and p_management_premium_pct is null then
    raise exception 'Confirm the agreed Kongila supervision premium';
  end if;

  if p_service_line = 'managed_workforce' and group_id_value is null then
    select id into group_id_value from public.engagement_groups
      where client_id = c.client_id and request_id = nullif(p_project ->> 'request_id','')
        and nullif(p_project ->> 'request_id','') is not null
        and status <> 'ended' limit 1;
    if group_id_value is null then
      select id into group_id_value from public.engagement_groups
        where client_id = c.client_id and name = coalesce(p_project ->> 'group_name', 'Managed workforce')
          and nullif(p_project ->> 'request_id','') is null and status <> 'ended' limit 1;
    end if;
    if group_id_value is null then
      group_id_value := 'eng_' || gen_random_uuid()::text;
      insert into public.engagement_groups(id, client_id, service_line, request_id, name, coverage_type, kongila_lead_id, created_by)
      values (group_id_value, c.client_id, 'managed_workforce', nullif(p_project ->> 'request_id',''),
        coalesce(p_project ->> 'group_name', 'Managed workforce'), p_project ->> 'coverage_type', p_supervisor_id, p_account_manager_id);
    else
      update public.engagement_groups set coverage_type = p_project ->> 'coverage_type',
        kongila_lead_id = coalesce(kongila_lead_id, p_supervisor_id), updated_at = now() where id = group_id_value;
    end if;
  end if;

  if p_service_line = 'project' then
    if p_project is null or length(trim(coalesce(p_project ->> 'name',''))) = 0 then
      raise exception 'Project name is required';
    end if;
    select id into project_id_value from public.projects where client_id = c.client_id
      and request_id = nullif(p_project ->> 'request_id','')
      and nullif(p_project ->> 'request_id','') is not null and status = 'active' limit 1;
    if project_id_value is null and nullif(p_project ->> 'request_id','') is null then
      select id into project_id_value from public.projects where client_id = c.client_id
        and name = p_project ->> 'name' and status = 'active' limit 1;
    end if;
    if project_id_value is null then
      insert into public.projects(client_id, request_id, name, description, start_date, end_date, deadline, status, kongila_lead_id)
      values (c.client_id, nullif(p_project ->> 'request_id',''), p_project ->> 'name', p_project ->> 'description', p_start_date,
        nullif(p_project ->> 'deadline','')::date, nullif(p_project ->> 'deadline','')::date, 'active', p_supervisor_id)
      returning id into project_id_value;
    end if;
    if jsonb_array_length(coalesce(p_milestones, '[]'::jsonb)) = 0 then
      raise exception 'At least one billable project milestone is required for each project contract';
    end if;
    insert into public.project_milestones(project_id, contract_id, title, description, sequence, amount_usd, due_date)
    select project_id_value, c.id, m ->> 'title', m ->> 'description', (m ->> 'sequence')::integer,
      (m ->> 'amountUsd')::numeric, nullif(m ->> 'dueDate','')::date
    from jsonb_array_elements(p_milestones) as m;
    if abs((select coalesce(sum(amount_usd),0) from public.project_milestones where contract_id = c.id)
      - coalesce(c.project_fee_usd,0)) > 0.01 then
      raise exception 'Milestone amounts must add up to this contract project fee';
    end if;
  end if;

  insert into public.assignments(
    talent_id, project_id, contract_id, role, start_date, end_date, status,
    service_line, management_mode, kongila_supervisor_id, account_manager_id,
    engagement_group_id, working_pattern, activation_checks, management_premium_pct,
    guarantee_months, guarantee_end_date, activated_at
  ) values (
    c.talent_id, project_id_value, c.id, c.service_type, p_start_date, c.end_date,
    case when p_start_date > current_date then 'pending_start' else 'active' end,
    p_service_line, case when p_service_line = 'placement' then 'client_managed' else p_management_mode end,
    p_supervisor_id, p_account_manager_id, group_id_value, p_working_pattern, p_activation_checks,
    case when p_management_mode = 'kongila_managed' then p_management_premium_pct else null end,
    case when p_service_line = 'placement' then c.placement_guarantee_months else null end,
    case when p_service_line = 'placement' then (p_start_date + make_interval(months => c.placement_guarantee_months))::date else null end,
    now()
  ) returning * into assignment_row;

  update public.contracts set status =
      case when p_start_date <= current_date then 'active' else 'fully_signed' end,
    start_date = p_start_date, updated_at = now()
  where id = c.id and status = 'fully_signed';

  if group_id_value is not null and assignment_row.status = 'active' then
    update public.engagement_groups set status = 'active', updated_at = now()
    where id = group_id_value and status = 'pending_start';
  end if;

  if project_id_value is not null and assignment_row.status = 'active' then
    update public.projects set status = 'active' where id = project_id_value;
  end if;

  return jsonb_build_object('assignment_id', assignment_row.id, 'project_id', project_id_value,
    'engagement_group_id', group_id_value, 'status', assignment_row.status, 'already_active', false);
end
$fn$;

revoke all on function public.activate_contract_engagement(text,text,text,text,text,text,date,text,jsonb,jsonb,jsonb,numeric) from public, anon, authenticated;
grant execute on function public.activate_contract_engagement(text,text,text,text,text,text,date,text,jsonb,jsonb,jsonb,numeric) to service_role;

create or replace function public.invoice_placement_activation(p_contract_id text, p_due_date date)
returns jsonb language plpgsql security definer set search_path = public as $fn$
declare
  c public.contracts%rowtype;
  invoice_id_value text;
  guarantee_months_value integer;
begin
  select * into c from public.contracts where id = p_contract_id for update;
  if not found then raise exception 'Contract not found'; end if;
  if c.offer_id is null then raise exception 'A placement offer must exist before activation'; end if;
  if lower(coalesce(c.service_type,'')) not in ('hire talent','direct hire','direct_hire','placement') then
    raise exception 'This contract is not a direct-hire placement';
  end if;
  if c.status not in ('pending_signatures','client_signed','talent_signed','fully_signed') then
    raise exception 'The placement invoice is available after the offer and contract have been sent for signature';
  end if;
  if c.start_date is null then raise exception 'Confirm the placement start date before activation'; end if;
  if c.placement_fee_invoiced_at is not null then
    return jsonb_build_object('invoice_id', (select id from public.invoices where contract_id = c.id and invoice_trigger = 'placement_activation' limit 1), 'already_invoiced', true);
  end if;
  if c.placement_fee_usd is null or c.placement_fee_usd <= 0 then raise exception 'Placement fee is not configured'; end if;
  select coalesce((value #>> '{}')::integer, 4) into guarantee_months_value
    from public.platform_settings where key = 'placement_guarantee_months';
  guarantee_months_value := coalesce(guarantee_months_value, 4);
  insert into public.invoices(id, invoice_number, client_id, contract_id, period, service_line,
    invoice_trigger, amount, subtotal_usd, tax_amount_usd, total_usd, total_amount_usd,
    currency, usd_rate, status, due_date, created_at)
  values ('inv_' || gen_random_uuid()::text,
    'KNG-PLACE-' || to_char(now(),'YYYYMMDD') || '-' || upper(substr(gen_random_uuid()::text,1,6)),
    c.client_id, c.id, 'placement-activation', 'placement', 'placement_activation',
    c.placement_fee_usd, c.placement_fee_usd, 0, c.placement_fee_usd, c.placement_fee_usd,
    coalesce(nullif(to_jsonb(c)->>'currency',''),'USD'), 1, 'draft', p_due_date, now())
  returning id into invoice_id_value;
  insert into public.invoice_line_items(id, invoice_id, description, quantity, unit_amount, amount)
  values ('line_' || gen_random_uuid()::text, invoice_id_value,
    'Placement activation fee', 1, c.placement_fee_usd, c.placement_fee_usd);
  update public.contracts set placement_fee_invoiced_at = now(), placement_activated_at = now(),
    placement_guarantee_months = guarantee_months_value
  where id = c.id;
  return jsonb_build_object('invoice_id', invoice_id_value, 'already_invoiced', false,
    'client_id', c.client_id, 'talent_id', c.talent_id,
    'guarantee_months', guarantee_months_value);
end
$fn$;
revoke all on function public.invoice_placement_activation(text,date) from public, anon, authenticated;
grant execute on function public.invoice_placement_activation(text,date) to service_role;

create or replace function public.invoice_completed_project_milestone(p_milestone_id text, p_due_date date)
returns jsonb language plpgsql security definer set search_path = public as $fn$
declare
  m public.project_milestones%rowtype;
  p public.projects%rowtype;
  c public.contracts%rowtype;
  invoice_id_value text;
  fee_pct numeric;
  net_value numeric;
begin
  select * into m from public.project_milestones where id = p_milestone_id for update;
  if not found then raise exception 'Milestone not found'; end if;
  if m.status <> 'completed' then raise exception 'Only a completed milestone can be invoiced'; end if;
  if m.invoice_id is not null then return jsonb_build_object('invoice_id',m.invoice_id,'already_invoiced',true); end if;
  select * into p from public.projects where id = m.project_id;
  select * into c from public.contracts where id = m.contract_id;
  select talent_commission_pct into fee_pct from public.fee_config where service_line = 'project';
  if fee_pct is null then raise exception 'Project talent commission is not configured'; end if;
  insert into public.invoices(id, invoice_number, client_id, contract_id, period, service_line,
    project_milestone_id, invoice_trigger, amount, subtotal_usd, tax_amount_usd,
    total_usd, total_amount_usd, currency, usd_rate, status, due_date, created_at)
  values ('inv_' || gen_random_uuid()::text,
    'KNG-MILE-' || to_char(now(),'YYYYMMDD') || '-' || upper(substr(gen_random_uuid()::text,1,6)),
    p.client_id, c.id, 'milestone-' || m.id, 'project', m.id, 'project_milestone',
    m.amount_usd, m.amount_usd, 0, m.amount_usd, m.amount_usd,
    'USD', 1, 'draft', p_due_date, now())
  returning id into invoice_id_value;
  insert into public.invoice_line_items(id, invoice_id, description, quantity, unit_amount, amount)
  values ('line_' || gen_random_uuid()::text, invoice_id_value, 'Project milestone: ' || m.title, 1, m.amount_usd, m.amount_usd);
  net_value := round(m.amount_usd * (1 - fee_pct), 2);
  insert into public.talent_payouts(id, talent_id, contract_id, invoice_id, period, gross_amount,
    commission_pct, net_amount, amount, currency, usd_rate, net_amount_usd, status, created_at)
  values ('payout_' || gen_random_uuid()::text, c.talent_id, c.id, invoice_id_value,
    'milestone-' || m.id, m.amount_usd, fee_pct, net_value, net_value, 'USD', 1, net_value, 'pending', now());
  update public.project_milestones set status = 'invoiced', invoice_id = invoice_id_value where id = m.id;
  return jsonb_build_object('invoice_id', invoice_id_value, 'already_invoiced', false);
end
$fn$;
revoke all on function public.invoice_completed_project_milestone(text,date) from public, anon, authenticated;
grant execute on function public.invoice_completed_project_milestone(text,date) to service_role;

-- Complete project delivery atomically: end all attached engagements and
-- their contracts so payroll and monthly billing stop together.
create or replace function public.complete_project_engagements(p_project_id text)
returns jsonb language plpgsql security definer set search_path = public as $fn$
declare
  p public.projects%rowtype;
  ended_count integer;
begin
  select * into p from public.projects where id = p_project_id for update;
  if not found then raise exception 'Project not found'; end if;
  if p.status = 'completed' then return jsonb_build_object('project_id',p.id,'already_completed',true,'ended',0); end if;
  if exists (select 1 from public.project_milestones where project_id = p.id and status not in ('completed','invoiced')) then
    raise exception 'Complete or invoice every project milestone before handover';
  end if;

  update public.assignments set status = 'ended', ended_reason = 'completed', end_date = current_date, updated_at = now()
    where project_id = p.id and status in ('active','pending_start','paused');
  get diagnostics ended_count = row_count;
  update public.contracts set status = 'ended', end_date = current_date, updated_at = now()
    where id in (select contract_id from public.assignments where project_id = p.id) and status in ('fully_signed','active');
  update public.projects set status = 'completed', end_date = current_date where id = p.id;
  return jsonb_build_object('project_id',p.id,'already_completed',false,'ended',ended_count);
end
$fn$;
revoke all on function public.complete_project_engagements(text) from public, anon, authenticated;
grant execute on function public.complete_project_engagements(text) to service_role;

-- One nightly transaction activates confirmed start dates and converts
-- guaranteed placements only after the window is over and their invoice is paid.
create or replace function public.advance_engagement_lifecycle(p_today date)
returns jsonb language plpgsql security definer set search_path = public as $fn$
declare
  started_contract_ids text[];
  started_group_ids text[];
  converted_contract_ids text[];
  converted_talent_ids text[];
begin
  with started as (
    update public.assignments set status = 'active', updated_at = now()
    where status = 'pending_start' and start_date <= p_today
    returning contract_id, engagement_group_id
  )
    select coalesce(array_agg(distinct contract_id::text) filter (where contract_id is not null), '{}'),
         coalesce(array_agg(distinct engagement_group_id::text) filter (where engagement_group_id is not null), '{}')
    into started_contract_ids, started_group_ids from started;

  if cardinality(started_contract_ids) > 0 then
    update public.contracts set status = 'active', updated_at = now()
      where id::text = any(started_contract_ids) and status = 'fully_signed';
  end if;
  if cardinality(started_group_ids) > 0 then
    update public.engagement_groups set status = 'active', updated_at = now()
      where id = any(started_group_ids) and status = 'pending_start';
  end if;

  with converted as (
    update public.assignments a set status = 'ended', ended_reason = 'converted', updated_at = now()
    where a.service_line = 'placement' and a.status = 'active'
      and a.guarantee_end_date < p_today
      and exists (select 1 from public.invoices i where i.contract_id = a.contract_id
        and i.invoice_trigger = 'placement_activation' and i.status = 'paid')
    returning a.contract_id, a.talent_id
  )
    select coalesce(array_agg(distinct contract_id::text), '{}'), coalesce(array_agg(distinct talent_id::text), '{}')
    into converted_contract_ids, converted_talent_ids from converted;

  if cardinality(converted_contract_ids) > 0 then
    update public.contracts set status = 'ended', updated_at = now()
      where id::text = any(converted_contract_ids) and status in ('fully_signed','active');
  end if;
  if cardinality(converted_talent_ids) > 0 then
    update public.talent_profiles set status = 'placed_externally'
      where id::text = any(converted_talent_ids) and status in ('active','assigned');
  end if;

  return jsonb_build_object('started', cardinality(started_contract_ids),
    'converted', cardinality(converted_contract_ids));
end
$fn$;
revoke all on function public.advance_engagement_lifecycle(date) from public, anon, authenticated;
grant execute on function public.advance_engagement_lifecycle(date) to service_role;

commit;
