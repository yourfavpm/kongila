-- Kongila — roles, and an audit log that is actually a log
--
-- Two unrelated problems that both come down to the same thing: a column
-- that anything could write whatever it liked into.
--
-- PROPOSED, NOT RUN. Back up first.

-- ============================================================================
-- 1. ROLES
-- ============================================================================
--
-- users_role_check allowed twelve values, four of which were title-case
-- duplicates of others ('Super Admin' alongside 'super_admin'), so the same
-- person stored two ways compared unequal everywhere in the code. It did not
-- contain 'finance', which the scope asks for, or 'skill_assessor', which
-- VETTING_STAGES names as responsible for the Skill Assessment stage — so
-- neither role could exist.
--
-- Settled: six admin roles in snake_case, plus client and talent.

-- Fold the legacy spellings into the canonical ones before narrowing the
-- constraint, or existing rows fail it. 'admin' was a catch-all that meant
-- nothing specific; it becomes ops_manager rather than super_admin, so no
-- existing account silently gains the ability to create more admins.

update public.users set role = 'super_admin'  where role in ('Super Admin', 'superadmin');
update public.users set role = 'account_manager' where role = 'Account Manager';
update public.users set role = 'talent_manager' where role = 'Talent Manager';
update public.users set role = 'ops_manager'  where role in ('Operations Manager', 'operations_manager', 'admin');

alter table public.users drop constraint if exists users_role_check;

alter table public.users
  add constraint users_role_check check (role in (
    'talent',
    'client',
    'super_admin',
    'account_manager',
    'talent_manager',
    'ops_manager',
    'finance',
    'skill_assessor'
  ));

comment on column public.users.role is
  'One of six admin roles, or client or talent. snake_case only: the title-case '
  'duplicates were removed on 2 Nov 2026 because the same person stored two ways '
  'compared unequal. Tab access is defined in packages/auth/roles.ts.';

-- ============================================================================
-- 2. AUDIT LOG
-- ============================================================================
--
-- It was not a log. Rows were written from the browser in five places and
-- upserted by id from client-supplied arrays, so an existing entry could be
-- overwritten by sending the same id. The actor was the hardcoded string
-- 'Admin Operator' — not a user id, so there was no way to tell who did
-- anything. And ids were `audit_${Date.now()}`, which collide whenever two
-- actions land in the same millisecond, meaning the second one overwrites
-- the first.
--
-- A log you can edit is not evidence of anything.

alter table public.audit_logs
  add column if not exists actor_user_id varchar(255);

alter table public.audit_logs
  add column if not exists actor_role varchar(50);

alter table public.audit_logs
  add column if not exists entity_type varchar(50);

alter table public.audit_logs
  add column if not exists entity_id varchar(255);

alter table public.audit_logs
  add column if not exists ip_address varchar(64);

comment on column public.audit_logs.actor_user_id is
  'Who did it, resolved server-side from the bearer token. The actor column is '
  'a display name and can be anything; this one cannot.';
comment on column public.audit_logs.entity_type is
  'What was acted on (interview, contract, user), so the log can be filtered.';

create index if not exists audit_logs_actor_idx on public.audit_logs (actor_user_id);
create index if not exists audit_logs_entity_idx on public.audit_logs (entity_type, entity_id);
create index if not exists audit_logs_timestamp_idx on public.audit_logs (timestamp desc);

-- ── Append only, enforced by the database ───────────────────────────────────
-- Not by convention, and not by the API being the only writer. A trigger is
-- the only version of this that survives someone taking a shortcut later.

create or replace function public.audit_logs_are_append_only()
returns trigger
language plpgsql
as $$
begin
  raise exception 'audit_logs is append only: % is not permitted', tg_op;
end;
$$;

drop trigger if exists audit_logs_no_update on public.audit_logs;
create trigger audit_logs_no_update
  before update on public.audit_logs
  for each row execute function public.audit_logs_are_append_only();

drop trigger if exists audit_logs_no_delete on public.audit_logs;
create trigger audit_logs_no_delete
  before delete on public.audit_logs
  for each row execute function public.audit_logs_are_append_only();

-- The browser must not write here at all. Only the service role, through the
-- server, which is the only context that knows who the actor really is.
revoke insert, update, delete on public.audit_logs from anon, authenticated;
grant select on public.audit_logs to authenticated;

-- ── Ids that cannot collide ─────────────────────────────────────────────────
-- `audit_${Date.now()}` collides within a millisecond, and because the write
-- was an upsert, the loser was silently overwritten.

alter table public.audit_logs
  alter column id set default (gen_random_uuid())::text;

-- ============================================================================
-- 3. VERIFY
-- ============================================================================

select role, count(*) from public.users group by role order by role;

select pg_get_constraintdef(oid) as users_role_check
from pg_constraint where conname = 'users_role_check';

select tgname, tgenabled from pg_trigger
where tgrelid = 'public.audit_logs'::regclass and not tgisinternal;

-- Should fail with "audit_logs is append only":
--   update public.audit_logs set action = 'tampered' where id = (select id from public.audit_logs limit 1);

-- ============================================================================
-- ROLLBACK
-- ============================================================================
-- drop trigger if exists audit_logs_no_update on public.audit_logs;
-- drop trigger if exists audit_logs_no_delete on public.audit_logs;
-- drop function if exists public.audit_logs_are_append_only();
-- The role folding is not reversible: the original spellings are gone.
