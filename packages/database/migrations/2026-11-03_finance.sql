-- Kongila finance: fee config, invoice columns, line items, payout columns.
-- Run this first of the three 2026-11-03 files.
-- Notes and reasoning: docs/migrations-2026-11-03.md
--
-- Key columns are read from the catalog rather than assumed, because
-- contracts.id is a varchar on this schema, not a uuid.

begin;

-- 1. Fee configuration, one row per service line. Percentages start NULL
--    on purpose: the billing code refuses a line with no fee rather than
--    inventing a margin.

create table if not exists public.fee_config (
  id text primary key,
  service_line text not null unique
    check (service_line in ('placement', 'outsourcing', 'managed_workforce', 'project')),
  client_fee_pct numeric(6,4) check (client_fee_pct >= 0 and client_fee_pct <= 1),
  talent_commission_pct numeric(6,4) check (talent_commission_pct >= 0 and talent_commission_pct <= 1),
  updated_by text,
  updated_at timestamptz not null default now()
);

insert into public.fee_config (id, service_line)
values
  ('fee_placement', 'placement'),
  ('fee_outsourcing', 'outsourcing'),
  ('fee_managed_workforce', 'managed_workforce'),
  ('fee_project', 'project')
on conflict (service_line) do nothing;

create table if not exists public.fee_audit_log (
  id text primary key,
  config_id text references public.fee_config(id),
  service_line text,
  changed_by text,
  previous_client_fee_pct numeric(6,4),
  new_client_fee_pct numeric(6,4),
  previous_talent_commission_pct numeric(6,4),
  new_talent_commission_pct numeric(6,4),
  changed_at timestamptz not null default now()
);

create or replace function public.fee_audit_is_append_only()
returns trigger language plpgsql as $fn$
begin
  raise exception 'fee_audit_log is append only';
end;
$fn$;

drop trigger if exists fee_audit_no_update on public.fee_audit_log;
create trigger fee_audit_no_update
  before update or delete on public.fee_audit_log
  for each row execute function public.fee_audit_is_append_only();

-- 2. Contracts: one-time fees and the billing cursor.

alter table public.contracts
  add column if not exists placement_fee_usd numeric(12,2),
  add column if not exists project_fee_usd numeric(12,2),
  add column if not exists billed_through text,
  add column if not exists billing_model text;

do $mig$
begin
  if not exists (select 1 from pg_constraint where conname = 'contracts_billing_model_check') then
    alter table public.contracts add constraint contracts_billing_model_check
      check (billing_model is null or billing_model in
             ('recurring_monthly', 'placement_fee', 'project_fee'));
  end if;
end
$mig$;

-- 3. Invoices.

alter table public.invoices
  add column if not exists invoice_number text,
  add column if not exists period text,
  add column if not exists subtotal_usd numeric(12,2),
  add column if not exists tax_amount_usd numeric(12,2) default 0,
  add column if not exists total_usd numeric(12,2),
  add column if not exists service_line text,
  add column if not exists is_disputed boolean default false,
  add column if not exists dispute_reason text,
  add column if not exists created_at timestamptz default now();

-- invoices.contract_id must match the type of contracts.id. If the column
-- is missing it is created with that type; if it exists with a different
-- type it is converted. This is the step that failed before.

do $mig$
declare
  target_type text;
  current_type text;
begin
  select format_type(a.atttypid, a.atttypmod) into target_type
    from pg_attribute a
    join pg_class c on c.oid = a.attrelid
    join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relname = 'contracts' and a.attname = 'id'
     and a.attnum > 0 and not a.attisdropped;

  if target_type is null then
    raise notice 'contracts.id not found, skipping invoices.contract_id';
    return;
  end if;

  select format_type(a.atttypid, a.atttypmod) into current_type
    from pg_attribute a
    join pg_class c on c.oid = a.attrelid
    join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relname = 'invoices' and a.attname = 'contract_id'
     and a.attnum > 0 and not a.attisdropped;

  if current_type is null then
    execute format('alter table public.invoices add column contract_id %s', target_type);
  elsif current_type <> target_type then
    execute format(
      'alter table public.invoices drop constraint if exists invoices_contract_id_fkey');
    execute format(
      'alter table public.invoices alter column contract_id type %s using contract_id::text::%s',
      target_type, target_type);
  end if;

  if not exists (
    select 1 from pg_constraint
     where conname = 'invoices_contract_id_fkey'
       and conrelid = 'public.invoices'::regclass
  ) then
    alter table public.invoices
      add constraint invoices_contract_id_fkey
      foreign key (contract_id) references public.contracts(id);
  end if;
end
$mig$;

-- One invoice per contract per period, so a billing run is safe to repeat.
create unique index if not exists invoices_contract_period_idx
  on public.invoices (contract_id, period)
  where contract_id is not null and period is not null;

do $mig$
declare
  invoice_id_type text;
begin
  select coalesce(format_type(a.atttypid, a.atttypmod), 'text') into invoice_id_type
    from pg_attribute a
    join pg_class c on c.oid = a.attrelid
    join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relname = 'invoices' and a.attname = 'id'
     and a.attnum > 0 and not a.attisdropped;

  execute format($ddl$
    create table if not exists public.invoice_line_items (
      id text primary key,
      invoice_id %s not null references public.invoices(id) on delete cascade,
      description text not null,
      quantity numeric(10,2) not null default 1,
      unit_amount numeric(12,2) not null,
      amount numeric(12,2) not null,
      created_at timestamptz not null default now()
    )$ddl$, invoice_id_type);
end
$mig$;

create index if not exists invoice_line_items_invoice_idx
  on public.invoice_line_items (invoice_id);

-- 4. Payouts: store the working, not just the net.

alter table public.talent_payouts
  add column if not exists period text,
  add column if not exists gross_amount numeric(12,2),
  add column if not exists commission_pct numeric(6,4),
  add column if not exists net_amount numeric(12,2),
  add column if not exists payment_method text,
  add column if not exists failure_reason text,
  add column if not exists created_at timestamptz default now();

do $mig$
declare
  target_type text;
  current_type text;
begin
  select format_type(a.atttypid, a.atttypmod) into target_type
    from pg_attribute a
    join pg_class c on c.oid = a.attrelid
    join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relname = 'invoices' and a.attname = 'id'
     and a.attnum > 0 and not a.attisdropped;

  select format_type(a.atttypid, a.atttypmod) into current_type
    from pg_attribute a
    join pg_class c on c.oid = a.attrelid
    join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relname = 'talent_payouts' and a.attname = 'invoice_id'
     and a.attnum > 0 and not a.attisdropped;

  if current_type is null then
    execute format('alter table public.talent_payouts add column invoice_id %s', target_type);
  elsif current_type <> target_type then
    execute format(
      'alter table public.talent_payouts drop constraint if exists talent_payouts_invoice_id_fkey');
    execute format(
      'alter table public.talent_payouts alter column invoice_id type %s using invoice_id::text::%s',
      target_type, target_type);
  end if;

  if not exists (
    select 1 from pg_constraint
     where conname = 'talent_payouts_invoice_id_fkey'
       and conrelid = 'public.talent_payouts'::regclass
  ) then
    alter table public.talent_payouts
      add constraint talent_payouts_invoice_id_fkey
      foreign key (invoice_id) references public.invoices(id);
  end if;
end
$mig$;

create unique index if not exists talent_payouts_contract_period_idx
  on public.talent_payouts (contract_id, period)
  where contract_id is not null and period is not null;

-- 5. Money rows are written by the server only.

revoke insert, update, delete on public.fee_config from anon, authenticated;
revoke insert, update, delete on public.invoice_line_items from anon, authenticated;
revoke insert, update, delete on public.fee_audit_log from anon, authenticated;

alter table public.fee_config enable row level security;
alter table public.fee_audit_log enable row level security;
alter table public.invoice_line_items enable row level security;

commit;

-- Check it landed:
--   select service_line, client_fee_pct, talent_commission_pct from public.fee_config;
--
-- Then set the four margins before the first billing run. Replace these
-- placeholder numbers with the real commercial terms:
--
--   update public.fee_config set client_fee_pct = 0.20, talent_commission_pct = 0.00
--     where service_line = 'placement';
--   update public.fee_config set client_fee_pct = 0.15, talent_commission_pct = 0.10
--     where service_line = 'outsourcing';
--   update public.fee_config set client_fee_pct = 0.25, talent_commission_pct = 0.10
--     where service_line = 'managed_workforce';
--   update public.fee_config set client_fee_pct = 0.30, talent_commission_pct = 0.15
--     where service_line = 'project';
