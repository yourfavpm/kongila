-- Kongila invoice numbering and ageing, document versions and expiry.
-- Run after 2026-11-03_finance.sql and 2026-11-03b_payroll_and_currency.sql.
-- Notes and reasoning: docs/migrations-2026-11-03.md

begin;

-- 1. Contract payment terms, so a due date comes from the agreement.

alter table public.contracts
  add column if not exists payment_terms_days integer;

do $mig$
begin
  if not exists (select 1 from pg_constraint where conname = 'contracts_payment_terms_check') then
    alter table public.contracts add constraint contracts_payment_terms_check
      check (payment_terms_days is null
             or (payment_terms_days >= 0 and payment_terms_days <= 180));
  end if;
end
$mig$;

-- 2. The dates an invoice actually has, and chasing state.

alter table public.invoices
  add column if not exists issued_at timestamptz,
  add column if not exists sent_at timestamptz,
  add column if not exists overdue_at timestamptz,
  add column if not exists last_reminder_at timestamptz,
  add column if not exists reminder_count integer not null default 0,
  add column if not exists payment_terms_days integer,
  add column if not exists pdf_generated_at timestamptz;

update public.invoices
   set issued_at = coalesce(issued_at, created_at, now())
 where issued_at is null;

-- An invoice number is what a client quotes on a transfer. Two invoices
-- cannot share one.
create unique index if not exists invoices_number_idx
  on public.invoices (invoice_number)
  where invoice_number is not null;

-- overdue has to be a legal status before anything can move to it.
do $mig$
declare
  old_constraint text;
begin
  select conname into old_constraint
    from pg_constraint
   where conrelid = 'public.invoices'::regclass
     and contype = 'c'
     and pg_get_constraintdef(oid) ilike '%status%';

  if old_constraint is not null then
    execute format('alter table public.invoices drop constraint %I', old_constraint);
  end if;

  alter table public.invoices add constraint invoices_status_check
    check (status in ('draft', 'sent', 'paid', 'overdue', 'void'));
end
$mig$;

-- 3. The document columns the code already writes.
--
-- documents has eleven columns and writeDbAsync writes twenty-three. The
-- missing twelve have never existed, so every document write through that
-- path failed, logged a line and carried on. That is why CV version
-- numbers and certification expiry dates never survived a reload.

alter table public.documents
  add column if not exists file_name varchar(255),
  add column if not exists file_size_bytes bigint default 0,
  add column if not exists version_number integer default 1,
  add column if not exists certification_name varchar(255),
  add column if not exists issuing_body varchar(255),
  add column if not exists issue_date date,
  add column if not exists expiry_date date,
  add column if not exists template_id varchar(255),
  add column if not exists signature_data text,
  add column if not exists signed_at timestamptz,
  add column if not exists requires_re_review boolean default false,
  add column if not exists description text,
  add column if not exists is_hidden boolean default false,
  add column if not exists updated_at timestamptz default now();

-- 4. Document versions.

do $mig$
declare
  document_id_type text;
begin
  select coalesce(format_type(a.atttypid, a.atttypmod), 'text') into document_id_type
    from pg_attribute a
    join pg_class c on c.oid = a.attrelid
    join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relname = 'documents' and a.attname = 'id'
     and a.attnum > 0 and not a.attisdropped;

  execute format(
    'alter table public.documents add column if not exists superseded_by_id %s',
    document_id_type);
end
$mig$;

alter table public.documents
  add column if not exists is_current boolean not null default true,
  add column if not exists superseded_at timestamptz,
  add column if not exists expiry_notified_at timestamptz,
  add column if not exists expiry_state text;

do $mig$
begin
  if not exists (select 1 from pg_constraint where conname = 'documents_expiry_state_check') then
    alter table public.documents add constraint documents_expiry_state_check
      check (expiry_state is null
             or expiry_state in ('valid', 'expiring_soon', 'expired', 'none'));
  end if;
end
$mig$;

-- Existing rows: the highest version per person per type stays current.
with ranked as (
  select
    id,
    first_value(id) over (
      partition by user_id, type
      order by coalesce(version_number, 1) desc, uploaded_at desc
    ) as current_id
  from public.documents
  where user_id is not null
    and type in ('CV', 'cv', 'portfolio')
    and coalesce(status, '') <> 'deleted'
)
update public.documents d
   set is_current = false,
       superseded_by_id = r.current_id,
       superseded_at = now()
  from ranked r
 where d.id = r.id
   and d.id <> r.current_id;

create index if not exists documents_current_idx
  on public.documents (user_id, type)
  where is_current;

create index if not exists documents_expiry_idx
  on public.documents (expiry_date)
  where expiry_date is not null;

commit;

-- Check it landed:
--   select invoice_number, count(*) from public.invoices
--    where invoice_number is not null group by 1 having count(*) > 1;
--
--   select user_id, count(*) from public.documents
--    where type in ('CV','cv') and is_current and coalesce(status,'') <> 'deleted'
--    group by 1 having count(*) > 1;
