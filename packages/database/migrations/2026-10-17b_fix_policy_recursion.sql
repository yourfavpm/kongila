-- ============================================================================
-- Kongila — fix infinite recursion in the client_profiles policy
-- 17 October 2026
--
-- Corrects a mistake in 2026-10-17_fix_privilege_escalation.sql.
--
-- The policy client_profiles_read_scoped contained:
--
--   or organization_id in (
--     select cp.organization_id from public.client_profiles cp
--     where cp.user_id::text = auth.uid()::text
--   )
--
-- A policy on client_profiles that reads client_profiles re-enters itself, so
-- Postgres aborts with 42P17 infinite recursion. organizations_read_scoped has
-- the same subquery and fails the same way.
--
-- The fix is two SECURITY DEFINER functions. They execute as the function
-- owner rather than the caller, so RLS does not apply inside them and the loop
-- is broken. They are STABLE, so Postgres evaluates them once per query rather
-- than once per row, which also makes every policy using them faster.
--
-- Run in the Supabase SQL editor. One transaction.
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- Helpers
--
-- SECURITY DEFINER bypasses RLS, so search_path is pinned to stop anyone
-- shadowing public with their own schema and changing what these resolve to.
-- Both read only, and neither takes an argument, so there is nothing to inject.
-- ----------------------------------------------------------------------------

create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.users u
    where (u.id)::text = (auth.uid())::text
      and (u.role)::text in (
        'admin', 'super_admin', 'account_manager', 'talent_manager', 'ops_manager'
      )
  );
$$;

create or replace function public.current_client_org_id()
returns varchar
language sql
stable
security definer
set search_path = public
as $$
  select cp.organization_id
  from public.client_profiles cp
  where (cp.user_id)::text = (auth.uid())::text
  limit 1;
$$;

revoke all on function public.is_platform_admin() from public;
revoke all on function public.current_client_org_id() from public;
grant execute on function public.is_platform_admin() to authenticated;
grant execute on function public.current_client_org_id() to authenticated;

-- ----------------------------------------------------------------------------
-- client_profiles — the recursive one
-- ----------------------------------------------------------------------------

drop policy if exists "client_profiles_read_scoped" on public.client_profiles;

create policy "client_profiles_read_scoped" on public.client_profiles
  for select to authenticated
  using (
    (user_id)::text = (auth.uid())::text
    or organization_id = public.current_client_org_id()
    or public.is_platform_admin()
  );

-- ----------------------------------------------------------------------------
-- organizations — same subquery, same failure
-- ----------------------------------------------------------------------------

drop policy if exists "organizations_read_scoped" on public.organizations;

create policy "organizations_read_scoped" on public.organizations
  for select to authenticated
  using (
    (created_by)::text = (auth.uid())::text
    or id = public.current_client_org_id()
    or public.is_platform_admin()
  );

-- ----------------------------------------------------------------------------
-- The remaining admin-check policies were not recursive, but they each run an
-- inline EXISTS against users. Switching them to the function makes them
-- consistent, evaluated once per query, and changeable in one place when the
-- role list is cleaned up on day 7.
-- ----------------------------------------------------------------------------

drop policy if exists "matches_admin_read" on public.matches;
create policy "matches_admin_read" on public.matches
  for select to authenticated
  using (public.is_platform_admin());

drop policy if exists "offers_admin_read" on public.offers;
create policy "offers_admin_read" on public.offers
  for select to authenticated
  using (public.is_platform_admin());

drop policy if exists "talent_requests_admin_read" on public.talent_requests;
create policy "talent_requests_admin_read" on public.talent_requests
  for select to authenticated
  using (public.is_platform_admin());

commit;


-- ============================================================================
-- VERIFY
--
-- As a signed-in admin in the browser, all three must return rows:
--   select count(*) from client_profiles;
--   select count(*) from organizations;
--   select count(*) from talent_requests;
--
-- As a signed-in talent, client_profiles and organizations must return 0,
-- and talent_requests must return 0.
--
-- NOTE
--
-- is_platform_admin() reads users.role, which is the column the escalation fix
-- locked down with column privileges. If that column ever becomes writable
-- from the browser again, this function becomes an escalation path. Keep the
-- two changes together.
-- ============================================================================
