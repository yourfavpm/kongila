-- Contract templates.
--
-- The admin panel has a template editor with drafts, publishing and
-- versioning. None of it was ever stored anywhere. The save handler posted
-- a contractTemplates array through /api/db, and writeDbAsync has no branch
-- for that key, so the payload was read and dropped. There is no
-- contract_templates table in the database either.
--
-- See docs/migrations-2026-11-04.md for the longer note.
--
-- Safe to run more than once.

do $mig$
begin

  if to_regclass('public.contract_templates') is null then
    create table public.contract_templates (
      id varchar primary key default (gen_random_uuid())::text,
      name varchar not null,
      -- Which service line this template is for. Null means it applies to
      -- any of them.
      service_type varchar,
      body text not null,
      status varchar not null default 'draft',
      version integer not null default 1,
      created_by varchar,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'contract_templates_status_check'
  ) then
    alter table public.contract_templates
      add constraint contract_templates_status_check
      check (status in ('draft', 'published', 'archived'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'contract_templates_version_check'
  ) then
    alter table public.contract_templates
      add constraint contract_templates_version_check
      check (version >= 1);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'contract_templates_created_by_fkey'
  ) then
    alter table public.contract_templates
      add constraint contract_templates_created_by_fkey
      foreign key (created_by) references public.users (id) on delete set null;
  end if;

  create index if not exists contract_templates_status_idx
    on public.contract_templates (status);

  -- At most one published template per service line. Two published
  -- templates for the same line means whichever is read first wins, which
  -- is not something anyone wants to discover from a signed contract.
  create unique index if not exists contract_templates_published_idx
    on public.contract_templates (coalesce(service_type, ''))
    where status = 'published';

end
$mig$;

-- Nothing reaches this table from a browser.
alter table public.contract_templates enable row level security;
