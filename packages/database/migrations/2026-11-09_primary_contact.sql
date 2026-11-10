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
-- A note on the type. public.users.id is `character varying`, defaulting to
-- (gen_random_uuid())::text, not a uuid column. So is organizations.id, and
-- so are client_profiles.user_id and organization_id. This column matches
-- that. Declaring it uuid, which is what it looks like it should be, fails
-- with "key columns are of incompatible types: uuid and character varying"
-- because a foreign key needs an equality operator between the two sides.
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
      add column primary_contact_user_id character varying;
    raise notice 'organizations.primary_contact_user_id added';
  else
    raise notice 'organizations.primary_contact_user_id already present';
  end if;
end
$mig$;

-- The foreign key, added separately so a problem with it does not take the
-- column with it.
--
-- organizations.account_manager_id, added by an earlier migration, is plain
-- text with no foreign key at all. This one has the constraint because a
-- primary contact who is not a user is a company nobody can be contacted
-- about, and `on delete set null` is what should happen when that person's
-- account goes: the company keeps working and operations is shown "not set".
do $fk$
begin
  if exists (
    select 1 from pg_constraint
     where conname = 'organizations_primary_contact_user_id_fkey'
       and conrelid = 'public.organizations'::regclass
  ) then
    raise notice 'foreign key already present';
    return;
  end if;

  alter table public.organizations
    add constraint organizations_primary_contact_user_id_fkey
    foreign key (primary_contact_user_id)
    references public.users(id) on delete set null;
  raise notice 'foreign key added';
exception
  when others then
    -- The column is the part the application needs. If the constraint cannot
    -- be created, say why and carry on rather than failing the migration and
    -- leaving the deploy half done.
    raise warning 'foreign key not added (%): %', sqlstate, sqlerrm;
end
$fk$;

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
