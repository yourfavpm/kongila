-- Kongila payroll and currency. Run after 2026-11-03_finance.sql.
-- Notes and reasoning: docs/migrations-2026-11-03.md
--
-- payroll_entries belongs to Remotan: its keys point at remotan_workspaces
-- and workspace_members, and its hours come from time_logs. That table is
-- left untouched. These are Kongila tables, keyed on a contract.

begin;

-- 1. A run is one period, approved as a whole.

create table if not exists public.kongila_payroll_runs (
  id text primary key,
  period text not null unique,
  status text not null default 'draft'
    check (status in ('draft', 'approved', 'paid', 'cancelled')),
  currency text not null default 'USD',
  total_gross numeric(14,2) not null default 0,
  total_commission numeric(14,2) not null default 0,
  total_net numeric(14,2) not null default 0,
  entry_count integer not null default 0,
  skipped jsonb not null default '[]'::jsonb,
  generated_by text,
  generated_at timestamptz not null default now(),
  approved_by text,
  approved_at timestamptz,
  paid_at timestamptz
);

-- 2. One entry per person per run, carrying its own working.

do $mig$
declare
  contract_id_type text;
begin
  select coalesce(format_type(a.atttypid, a.atttypmod), 'text') into contract_id_type
    from pg_attribute a
    join pg_class c on c.oid = a.attrelid
    join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relname = 'contracts' and a.attname = 'id'
     and a.attnum > 0 and not a.attisdropped;

  execute format($ddl$
    create table if not exists public.kongila_payroll_entries (
      id text primary key,
      run_id text not null references public.kongila_payroll_runs(id) on delete cascade,
      contract_id %s,
      talent_id text not null,
      talent_name text,
      client_name text,
      service_line text,
      period text not null,
      monthly_rate numeric(12,2) not null,
      days_worked integer not null,
      days_in_period integer not null,
      gross_amount numeric(12,2) not null,
      commission_pct numeric(6,4) not null,
      commission_amount numeric(12,2) not null,
      net_amount numeric(12,2) not null,
      currency text not null default 'USD',
      usd_rate numeric(16,6) not null default 1,
      rate_source text,
      rate_fetched_at timestamptz,
      net_amount_usd numeric(12,2),
      status text not null default 'pending'
        check (status in ('pending', 'approved', 'paid', 'failed', 'on_hold')),
      hold_reason text,
      failure_reason text,
      paid_at timestamptz,
      created_at timestamptz not null default now()
    )$ddl$, contract_id_type);
end
$mig$;

-- Nobody is paid twice for the same month.
create unique index if not exists kongila_payroll_entries_contract_period_idx
  on public.kongila_payroll_entries (contract_id, period)
  where contract_id is not null;

create index if not exists kongila_payroll_entries_run_idx
  on public.kongila_payroll_entries (run_id);

create index if not exists kongila_payroll_entries_talent_idx
  on public.kongila_payroll_entries (talent_id);

-- 3. Currency and the rate each money row was written at.

alter table public.invoices
  add column if not exists currency text not null default 'USD',
  add column if not exists usd_rate numeric(16,6) not null default 1,
  add column if not exists rate_source text,
  add column if not exists rate_fetched_at timestamptz,
  add column if not exists total_amount_usd numeric(12,2);

alter table public.talent_payouts
  add column if not exists currency text not null default 'USD',
  add column if not exists usd_rate numeric(16,6) not null default 1,
  add column if not exists rate_source text,
  add column if not exists rate_fetched_at timestamptz,
  add column if not exists net_amount_usd numeric(12,2),
  add column if not exists payroll_entry_id text
    references public.kongila_payroll_entries(id);

alter table public.contracts
  add column if not exists currency text not null default 'USD';

update public.invoices
   set total_amount_usd = coalesce(total_amount_usd, total_usd, amount)
 where total_amount_usd is null;

update public.talent_payouts
   set net_amount_usd = coalesce(net_amount_usd, net_amount, amount)
 where net_amount_usd is null;

-- A rate_source of fallback means a built-in estimate was used rather than
-- a real rate. Finance needs to be able to find those.

do $mig$
begin
  if not exists (select 1 from pg_constraint where conname = 'invoices_rate_source_check') then
    alter table public.invoices add constraint invoices_rate_source_check
      check (rate_source is null or rate_source in
             ('live', 'cached', 'fallback', 'same_currency'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'talent_payouts_rate_source_check') then
    alter table public.talent_payouts add constraint talent_payouts_rate_source_check
      check (rate_source is null or rate_source in
             ('live', 'cached', 'fallback', 'same_currency'));
  end if;
end
$mig$;

-- 4. Server writes only.

revoke insert, update, delete on public.kongila_payroll_runs from anon, authenticated;
revoke insert, update, delete on public.kongila_payroll_entries from anon, authenticated;

alter table public.kongila_payroll_runs enable row level security;
alter table public.kongila_payroll_entries enable row level security;

commit;

-- Check it landed:
--   select table_name, column_name, data_type
--     from information_schema.columns
--    where table_schema = 'public'
--      and table_name in ('kongila_payroll_runs', 'kongila_payroll_entries')
--    order by table_name, ordinal_position;
--
-- Any money row converted at a guessed rate:
--   select id, currency, usd_rate, rate_source from public.invoices
--    where rate_source = 'fallback';
