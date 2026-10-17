-- ============================================================================
-- Kongila — privilege escalation fixes
-- 17 October 2026
--
-- Run this in the Supabase SQL editor against the LIVE project.
-- Take a backup first (Database → Backups → Create backup).
--
-- It runs in a transaction. If any statement fails, nothing is applied.
-- Read the NOTES at the bottom before running: three things stop working
-- on purpose, and one of them is admin auto-provisioning.
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- 1. users — stop anyone promoting themselves to admin
--
-- The UPDATE policy allows a row where id = auth.uid(), and has no WITH CHECK,
-- so Postgres reuses USING as the check. The row still belongs to you after you
-- change your own role column, so the update is allowed. Any signed-up talent
-- can set role = 'super_admin' and walk into the admin portal.
--
-- Policies cannot compare the old row to the new one, so the fix is column
-- privileges. A table-level UPDATE grant covers every column, so it has to be
-- revoked first, then re-granted on the harmless columns only.
-- ----------------------------------------------------------------------------

revoke update on public.users from anon, authenticated;
grant update (name, last_login, updated_at) on public.users to authenticated;

-- Signup still needs to create the row, but not with a privileged role.
drop policy if exists "Allow authenticated users to insert their user record" on public.users;

create policy "users_insert_self_unprivileged" on public.users
  for insert to authenticated
  with check (
    (id)::text = (auth.uid())::text
    and (role)::text in ('talent', 'client')
  );

-- ----------------------------------------------------------------------------
-- 2. user_roles — role grants become server-side only
--
-- The INSERT policy only required user_id = auth.uid(). The role_id was never
-- checked, so a user could grant themselves any role including super_admin.
-- ----------------------------------------------------------------------------

drop policy if exists "Allow authenticated users to insert their roles" on public.user_roles;
drop policy if exists "Allow authenticated users to update their roles" on public.user_roles;

-- The SELECT policy (own roles only) stays.

-- ----------------------------------------------------------------------------
-- 3. roles — nobody defines or edits roles from a browser
--
-- INSERT and UPDATE were open to any authenticated user with check (true).
-- ----------------------------------------------------------------------------

drop policy if exists "Allow authenticated users to insert roles" on public.roles;
drop policy if exists "Allow authenticated users to update roles" on public.roles;

-- ----------------------------------------------------------------------------
-- 4. offers — close the fully public policy
--
-- One policy: ALL commands, role {public}, using (true), with check (true).
-- Anyone, signed in or not, could read, change or delete every offer and the
-- salary on it. Nothing in the application code uses this table yet, so
-- locking it breaks nothing today.
-- ----------------------------------------------------------------------------

drop policy if exists "Allow all operations for offers" on public.offers;

create policy "offers_client_read" on public.offers
  for select to authenticated
  using ((client_id)::text = (auth.uid())::text);

create policy "offers_talent_read" on public.offers
  for select to authenticated
  using ((talent_id)::text = (auth.uid())::text);

create policy "offers_admin_read" on public.offers
  for select to authenticated
  using (exists (
    select 1 from public.users u
    where (u.id)::text = (auth.uid())::text
      and (u.role)::text in ('admin','super_admin','account_manager','talent_manager','ops_manager')
  ));

-- Writes to offers are service-role only, from server-side API routes.

-- ----------------------------------------------------------------------------
-- 5. matches — remove the blanket grants
--
-- matches_admin_all gave ALL commands to every authenticated user with
-- using (true) and with check (true), despite the name. A talent could
-- shortlist themselves onto any client's request.
-- ----------------------------------------------------------------------------

drop policy if exists "matches_admin_all" on public.matches;
drop policy if exists "Allow read access to matches" on public.matches;

create policy "matches_admin_read" on public.matches
  for select to authenticated
  using (exists (
    select 1 from public.users u
    where (u.id)::text = (auth.uid())::text
      and (u.role)::text in ('admin','super_admin','account_manager','talent_manager','ops_manager')
  ));

create policy "matches_talent_read" on public.matches
  for select to authenticated
  using (exists (
    select 1 from public.talent_profiles tp
    where (tp.id)::text = (matches.talent_id)::text
      and ((tp.user_id)::text = (auth.uid())::text or (tp.id)::text = (auth.uid())::text)
  ));

-- matches_client_read stays. The two admin-scoped insert/update policies stay.

-- ----------------------------------------------------------------------------
-- 6. audit_logs — no forged entries
--
-- INSERT was open to {public} with check (true). An audit trail anyone can
-- write to is worse than no audit trail, because it looks trustworthy.
-- ----------------------------------------------------------------------------

drop policy if exists "Allow all to insert audit logs" on public.audit_logs;

-- ----------------------------------------------------------------------------
-- 7. talent_requests — no anonymous inserts, no cross-tenant reads
--
-- One INSERT policy accepted {anon,authenticated} with check (true), so anyone
-- could post requests into the pipeline. One SELECT policy had qual (true) for
-- any authenticated user, so any talent could read every client's requests,
-- including budgets.
-- ----------------------------------------------------------------------------

drop policy if exists "Allow authenticated users to insert requests" on public.talent_requests;
drop policy if exists "Clients can insert their own talent requests" on public.talent_requests;
drop policy if exists "Allow authenticated users to view all talent requests" on public.talent_requests;

create policy "talent_requests_admin_read" on public.talent_requests
  for select to authenticated
  using (exists (
    select 1 from public.users u
    where (u.id)::text = (auth.uid())::text
      and (u.role)::text in ('admin','super_admin','account_manager','talent_manager','ops_manager')
  ));

-- Kept: "Allow users to read their own requests" (client_id = auth.uid())
-- Kept: "Allow authenticated users to insert their talent requests"
-- Kept: "Allow authenticated users to update their talent requests"
-- Kept: "Allow admins to update any talent requests"

-- ----------------------------------------------------------------------------
-- 8. client_profiles and organizations — own, same company, or admin
--
-- Both had SELECT with qual (true) for any authenticated user, so a talent
-- could enumerate every client contact and company on the platform.
-- ----------------------------------------------------------------------------

drop policy if exists "Allow authenticated users to view all client profiles" on public.client_profiles;

create policy "client_profiles_read_scoped" on public.client_profiles
  for select to authenticated
  using (
    (user_id)::text = (auth.uid())::text
    or organization_id in (
      select cp.organization_id from public.client_profiles cp
      where (cp.user_id)::text = (auth.uid())::text
    )
    or exists (
      select 1 from public.users u
      where (u.id)::text = (auth.uid())::text
        and (u.role)::text in ('admin','super_admin','account_manager','talent_manager','ops_manager')
    )
  );

drop policy if exists "Allow authenticated users to view all organizations" on public.organizations;

create policy "organizations_read_scoped" on public.organizations
  for select to authenticated
  using (
    (created_by)::text = (auth.uid())::text
    or id in (
      select cp.organization_id from public.client_profiles cp
      where (cp.user_id)::text = (auth.uid())::text
    )
    or exists (
      select 1 from public.users u
      where (u.id)::text = (auth.uid())::text
        and (u.role)::text in ('admin','super_admin','account_manager','talent_manager','ops_manager')
    )
  );

-- ----------------------------------------------------------------------------
-- 9. interviews — remove the allow-all policies
--
-- Four policies granting select, insert, update and delete to {public} with
-- (true). RLS is currently OFF on this table, so they are inert and the table
-- is open regardless. Dropping them now means that when RLS is switched on
-- during day 4, it is switched on against a clean slate rather than against
-- four policies that re-open it.
--
-- RLS is deliberately NOT enabled here yet. Interview writes still happen in
-- the browser, and enabling it before day 3 moves those server-side would
-- break scheduling.
-- ----------------------------------------------------------------------------

drop policy if exists "Allow all select" on public.interviews;
drop policy if exists "Allow all insert" on public.interviews;
drop policy if exists "Allow all update" on public.interviews;
drop policy if exists "Allow all delete" on public.interviews;

-- "Admins can insert interviews" stays, it is correctly scoped.

commit;


-- ============================================================================
-- NOTES — what changes, including three things that stop working on purpose
-- ============================================================================
--
-- 1. Admin auto-provisioning stops.
--    AdminLogin.tsx creates a users row with role 'admin' for any @kongila.co
--    address, and grants super_admin to admin@kongila.co, from the browser.
--    Section 1 blocks that. The companion code fix removes the behaviour.
--    Before running this, make sure at least one real admin already exists,
--    or create one in the SQL editor afterwards:
--
--      update public.users set role = 'super_admin' where email = 'you@kongila.co';
--
--    That runs as the service role in the editor, so it is not affected.
--
-- 2. Browser-side audit logging stops.
--    Audit entries now have to be written server-side. Until the API routes
--    exist, nothing is logged. That is the right trade: a log anyone can forge
--    is not evidence.
--
-- 3. Any code path writing offers, roles or user_roles from the browser fails.
--    Nothing currently writes offers. AdminLogin writes user_roles, which is
--    covered by note 1.
--
-- STILL OPEN after this script, by design:
--
--  - RLS is off on 28 tables, including users, talent_profiles, interviews and
--    skill_assessment_results. Those remain readable with the anon key. That is
--    day 4, and it needs the server-side write layer from day 3 first.
--  - 16 tables have RLS on with zero policies, so the browser cannot read them
--    at all. Also day 4.
--  - The anon key is still published in the JavaScript bundle. That is normal
--    and only safe once RLS is on everywhere.
--
-- VERIFY after running, in a browser signed in as a non-admin:
--
--    update users set role = 'super_admin' where id = '<your own id>';
--      → must fail with a permission error on column "role"
--    select * from talent_requests;
--      → must return only your own rows
--    select * from offers;
--      → must return only offers you are party to
-- ============================================================================
