-- Backfill for companies that existed before the primary contact column.
--
-- READ BEFORE RUNNING. This one touches existing rows in ways the schema
-- migration deliberately did not. Run it on staging, check the two reports it
-- prints, then run it on production.
--
-- Three problems it fixes, all from the same cause: /api/account/provision
-- created the public.users row without a name, and invented a company name
-- when the signup did not supply one.
--
--   1. public.users.name is null for every account created by provisioning.
--      The admin company list, the company detail page and the request board
--      all read that column, so every organisation showed a primary contact
--      with a blank name.
--   2. Organisations created without a company name are called
--      "<person>'s Company", which is a person's name on a company record.
--   3. Organisations with no primary contact where created_by is not a
--      current member, so the schema migration's backfill skipped them.
--
-- Nothing here deletes a row or overwrites a value a person entered. Every
-- statement is conditional on the current value being null or empty, so it is
-- safe to run more than once.

-- ── 1. Names, from the auth record ──────────────────────────────────────────
--
-- Supabase keeps what the person typed at signup in
-- auth.users.raw_user_meta_data. Provisioning never copied it across. The
-- fallbacks run in the order the signup forms write them: full_name is what
-- the standalone form sends, name is what the intake form sends.
--
-- The email local part is the last resort. It is a poor display name, but it
-- is the person's own address and it beats a blank cell in the admin portal.

update public.users u
   set name = coalesce(
     nullif(trim(au.raw_user_meta_data ->> 'full_name'), ''),
     nullif(trim(au.raw_user_meta_data ->> 'name'), ''),
     initcap(replace(split_part(u.email, '@', 1), '.', ' '))
   )
  from auth.users au
 where au.id = u.id
   and (u.name is null or trim(u.name) = '');

do $report$
declare
  still_blank integer;
begin
  select count(*) into still_blank
    from public.users
   where name is null or trim(name) = '';
  raise notice 'users with no name after backfill: %', still_blank;
end
$report$;

-- ── 2. Primary contacts the schema migration could not place ────────────────
--
-- The migration only accepted a created_by who is still a member of that
-- organisation. This widens it by one step: where exactly one client profile
-- points at the organisation, that member is the contact, whatever created_by
-- says. A company with several members and no recorded contact is left alone,
-- because picking one of them would be a guess.

update public.organizations o
   set primary_contact_user_id = sole.user_id
  from (
    select cp.organization_id, min(cp.user_id::text)::uuid as user_id
      from public.client_profiles cp
     where cp.organization_id is not null
     group by cp.organization_id
    having count(*) = 1
  ) as sole
 where sole.organization_id = o.id
   and o.primary_contact_user_id is null;

do $report$
declare
  rec record;
  remaining integer := 0;
begin
  for rec in
    select o.id, o.name, count(cp.id) as members
      from public.organizations o
      left join public.client_profiles cp on cp.organization_id = o.id
     where o.primary_contact_user_id is null
     group by o.id, o.name
     order by o.name
  loop
    remaining := remaining + 1;
    raise notice 'no primary contact: % (%) — % member(s)', rec.name, rec.id, rec.members;
  end loop;

  if remaining = 0 then
    raise notice 'every organisation has a primary contact.';
  else
    raise notice '% organisation(s) need a contact set by hand. Assign one in the admin portal.', remaining;
  end if;
end
$report$;

-- ── 3. Company names that are really a person's name ────────────────────────
--
-- Provisioning used to fall back to "<name>'s Company" when the signup sent
-- no company name. That fallback is gone, but the rows it created remain.
--
-- These are NOT renamed automatically: there is nothing to rename them to,
-- and a company genuinely called "Ada's Company" would be clobbered. They are
-- listed so somebody can ask those clients what their company is called.

do $report$
declare
  rec record;
  suspect integer := 0;
begin
  for rec in
    select o.id, o.name, u.email
      from public.organizations o
      left join public.users u on u.id = o.primary_contact_user_id
     where o.name like '%''s Company'
     order by o.name
  loop
    suspect := suspect + 1;
    raise notice 'check company name: "%" (%) — contact %', rec.name, rec.id, coalesce(rec.email, 'unknown');
  end loop;

  if suspect = 0 then
    raise notice 'no auto-generated company names found.';
  end if;
end
$report$;
