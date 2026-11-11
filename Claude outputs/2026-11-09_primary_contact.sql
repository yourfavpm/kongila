-- The primary contact on an organisation.
--
-- A Kongila client account is a company, not a person. The person who signs
-- up is that company's primary contact and its administrator, and everyone
-- else in the company arrives later through an invitation. Nothing in the
-- schema said so.
--
-- What existed:
--   organizations.created_by   the user id of whoever inserted the row
--   client_profiles.position   free text, which provisioning happened to
--                              set to 'Admin' for the first member
--   client_profiles.permission_level  'Full Access' for the first member
--
-- None of those is read as "this is the account owner". `created_by` is an
-- audit fact, not a role: it cannot be transferred, and it keeps pointing at
-- a person after they have been deactivated or removed from the company. The
-- admin portal had no way to tell which member to contact, and the client
-- portal could not tell a member whether the company was theirs to edit.
--
-- This adds the fact explicitly, and backfills it from created_by, which is
-- the best evidence available for companies that already exist.
--
-- Transfer of ownership is a plain update of this column. There is no code
-- path for it yet; that is deliberate, so it stays an operations action.
--
-- Safe to run more than once.

do $mig$
begin
  if to_regclass('public.organizations') is null then
    raise exception 'public.organizations does not exist; run supabase_migration.sql first';
  end if;

  if not exists (
    select 1 from information_schema.columns
     where table_schema = 'public'
       and table_name = 'organizations'
       and column_name = 'primary_contact_user_id'
  ) then
    alter table public.organizations
      add column primary_contact_user_id uuid references public.users(id) on delete set null;
    raise notice 'organizations.primary_contact_user_id added';
  else
    raise notice 'organizations.primary_contact_user_id already present';
  end if;
end
$mig$;

comment on column public.organizations.primary_contact_user_id is
  'The company''s primary contact and account administrator. Set at provisioning from the person who signed up. Transferable: created_by is not.';

-- Backfill from created_by, but only where that user is still a member of
-- this organisation. A created_by pointing at someone who has since moved to
-- another company, or who was removed, is not a contact worth recording.
update public.organizations o
   set primary_contact_user_id = o.created_by
 where o.primary_contact_user_id is null
   and o.created_by is not null
   and exists (
     select 1
       from public.client_profiles cp
      where cp.user_id = o.created_by
        and cp.organization_id = o.id
   );

-- Looked up on every admin company list and on every client portal load.
create index if not exists organizations_primary_contact_user_id_idx
  on public.organizations (primary_contact_user_id);

-- What is left over after the backfill, for review. An organisation with no
-- primary contact still works; the portals show "not set" and operations can
-- assign one. It usually means the company was seeded rather than signed up.
do $report$
declare
  orphaned integer;
begin
  select count(*) into orphaned
    from public.organizations
   where primary_contact_user_id is null;

  if orphaned > 0 then
    raise notice '% organisation(s) have no primary contact. See 2026-11-09b_backfill_primary_contacts.sql.', orphaned;
  end if;
end
$report$;
