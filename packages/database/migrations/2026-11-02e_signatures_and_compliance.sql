-- Kongila — signatures, and a compliance gate that is a gate
--
-- PROPOSED, NOT RUN. Back up first.

-- ============================================================================
-- 1. CONTRACT SIGNATURES
-- ============================================================================
-- There was nowhere to put one. The talent signing UI updated React state and
-- nothing else: the "audit trail" was a hardcoded IP of '192.168.1.1' with the
-- comment "Mocked IP" and a content hash of 'sha256-mock-' + Date.now(), which
-- is not a hash of anything, and none of it was saved. The client side had no
-- signing UI at all, and the page displayed "Alex Kongila" as a
-- countersignature no person had given.
--
-- One row per party per contract. Append only, like audit_logs: a signature
-- you can edit afterwards proves nothing.

create table if not exists public.contract_signatures (
  id              varchar(255) primary key default (gen_random_uuid())::text,
  contract_id     varchar(255) not null references public.contracts(id) on delete cascade,
  signer_user_id  varchar(255) not null,
  signer_role     varchar(20)  not null,
  signer_name     varchar(255) not null,
  signer_email    varchar(255),
  -- SHA-256 of the exact text shown to the signer. This is what makes the
  -- record mean something: it answers "is this the document they agreed to".
  document_hash   varchar(128) not null,
  drawn_signature text,
  ip_address      varchar(64),
  user_agent      text,
  signed_at       timestamptz  not null default now(),

  constraint contract_signatures_role_check
    check (signer_role in ('talent', 'client', 'kongila')),
  -- One signature per party per contract.
  constraint contract_signatures_one_per_party unique (contract_id, signer_role)
);

create index if not exists contract_signatures_contract_idx
  on public.contract_signatures (contract_id);

-- The contract remembers which document its signatures cover, so a template
-- edited afterwards is detectable rather than silently replacing the terms.
alter table public.contracts
  add column if not exists document_hash varchar(128);

comment on column public.contracts.document_hash is
  'SHA-256 of the agreement both parties signed. Compare before relying on any '
  'rendered contract text: a mismatch means the template changed after signing.';

create or replace function public.signatures_are_append_only()
returns trigger
language plpgsql
as $$
begin
  raise exception 'contract_signatures is append only: % is not permitted', tg_op;
end;
$$;

drop trigger if exists contract_signatures_no_update on public.contract_signatures;
create trigger contract_signatures_no_update
  before update on public.contract_signatures
  for each row execute function public.signatures_are_append_only();

drop trigger if exists contract_signatures_no_delete on public.contract_signatures;
create trigger contract_signatures_no_delete
  before delete on public.contract_signatures
  for each row execute function public.signatures_are_append_only();

-- Written only by the server, which is the only context that knows the real
-- signer, IP and time.
revoke insert, update, delete on public.contract_signatures from anon, authenticated;
grant select on public.contract_signatures to authenticated;

-- ============================================================================
-- 2. DOCUMENT SIGNATURES
-- ============================================================================
-- Who has signed each mandatory compliance document.
--
-- This was tracked in a `signedByTalentIds` array that is not a column and
-- lived only in memory, so it vanished on every reload and the admin's
-- signature progress bar always read zero. Worse, signing wrote the whole
-- document row back with the signer's user_id attached — so the first
-- candidate to sign a universal template took ownership of it, and it stopped
-- being a mandatory document for everybody else.
--
-- A join table cannot have that problem: signing adds a row and never touches
-- the template.

create table if not exists public.document_signatures (
  id            varchar(255) primary key default (gen_random_uuid())::text,
  document_id   varchar(255) not null references public.documents(id) on delete cascade,
  talent_id     varchar(255) not null,
  signer_name   varchar(255) not null,
  document_hash varchar(128),
  ip_address    varchar(64),
  user_agent    text,
  signed_at     timestamptz  not null default now(),

  constraint document_signatures_once unique (document_id, talent_id)
);

create index if not exists document_signatures_talent_idx
  on public.document_signatures (talent_id);

revoke insert, update, delete on public.document_signatures from anon, authenticated;
grant select on public.document_signatures to authenticated;

-- A mandatory document applies to everyone, so it has no owner. This is the
-- flag the gate reads, rather than inferring it from user_id being null.
alter table public.documents
  add column if not exists is_mandatory boolean not null default false;

alter table public.documents
  add column if not exists is_template boolean not null default false;

comment on column public.documents.is_template is
  'A universal document every candidate must sign. It has no user_id, and '
  'signing it adds a row to document_signatures rather than claiming the template.';

-- Repair: any template whose user_id was rewritten by the first signer.
-- Check what this will touch before running it:
--
--   select id, name, user_id, type from public.documents
--   where type in ('NDA', 'agreement', 'IT_Ethics_Policy');

update public.documents
set is_mandatory = true,
    is_template = true,
    user_id = null
where type in ('NDA', 'agreement', 'IT_Ethics_Policy')
  and id in (
    -- Only rows that look like templates: one per name, the earliest.
    select min(id) from public.documents
    where type in ('NDA', 'agreement', 'IT_Ethics_Policy')
    group by name
  );

-- ============================================================================
-- 3. THE CONTRACTING ENTITY
-- ============================================================================
-- The two templates sign as different companies — 'KONGILA EOR SYSTEMS LTD'
-- on the NDA and 'KONGILA TALENT DEPLOYMENT LLC' on the master agreement —
-- and a contract needs a registration number and a registered address, which
-- appear nowhere. No defaults: a contract must not issue with a guessed
-- legal entity on it.

insert into public.platform_settings (key, value, description, category) values
  ('contracting_entity_name', 'null'::jsonb,
   'The legal entity that contracts with candidates. Contracts cannot be issued until this is set.',
   'general'),
  ('contracting_entity_registration', 'null'::jsonb,
   'Company registration number of the contracting entity.',
   'general'),
  ('contracting_entity_address', 'null'::jsonb,
   'Registered address of the contracting entity.',
   'general'),
  ('contracting_entity_jurisdiction', 'null'::jsonb,
   'Governing law and jurisdiction for contracts, e.g. "Lagos State, Nigeria".',
   'general')
on conflict (key) do nothing;

-- ============================================================================
-- VERIFY
-- ============================================================================

select table_name, column_name, data_type
from information_schema.columns
where table_schema = 'public'
  and table_name in ('contract_signatures', 'document_signatures')
order by table_name, ordinal_position;

select id, name, type, user_id, is_mandatory, is_template
from public.documents
where is_template = true;

select tgname from pg_trigger
where tgrelid = 'public.contract_signatures'::regclass and not tgisinternal;

-- ============================================================================
-- ROLLBACK
-- ============================================================================
-- drop table if exists public.contract_signatures;
-- drop table if exists public.document_signatures;
-- drop function if exists public.signatures_are_append_only();
-- alter table public.contracts drop column if exists document_hash;
-- The user_id repair is not reversible: the original values are gone.
