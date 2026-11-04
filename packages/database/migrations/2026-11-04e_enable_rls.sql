-- Row level security on every table in public.
--
-- This is the migration the whole API rewrite was clearing the way for.
--
-- The anon key is in the public JavaScript bundle. Anyone who opens the
-- site has it. The only thing that was ever supposed to stop that key
-- reading and writing the database is RLS, and RLS was off on 29 tables,
-- including `users`, `talent_profiles` and `talent_skill_assessments`.
--
-- It could not be turned on earlier because both portals were reading and
-- writing tables directly from the browser. They no longer are: every
-- write goes through an API route, and every read comes from /api/db or
-- a resource route. Those routes use the service role key, which bypasses
-- RLS entirely, so none of them are affected by this.
--
-- The posture is deny by default. RLS on, and no policy for anon or
-- authenticated, means a browser holding the anon key gets nothing: no
-- rows on select, no rows written on insert or update. That is correct
-- here because nothing in either portal talks to a table any more.
--
-- The existing policies on client_profiles, matches, offers, organizations,
-- talent_profiles, talent_requests, users, user_roles, interviews and
-- request_activity_logs are left exactly as they are. They are narrower
-- than deny-all and this migration does not widen anything.
--
-- BEFORE RUNNING THIS, on staging, in this order:
--   1. Deploy the application change that goes with it.
--   2. Sign in as a candidate and load the portal. Profile, documents,
--      assessments and messages should all appear.
--   3. Sign in as a client and load the portal. Requests, candidates,
--      interviews and invoices should all appear.
--   4. Sign in as an administrator and load every tab.
-- If anything comes back empty, something is still reading a table from
-- the browser. Find it before running this on production.
--
-- To undo one table while debugging:
--   alter table public.<name> disable row level security;
--
-- Safe to run more than once.

do $rls$
declare
  target text;
  enabled boolean;
begin
  for target in
    select c.relname
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public'
       and c.relkind = 'r'
     order by c.relname
  loop
    select c.relrowsecurity into enabled
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relname = target;

    if not enabled then
      execute format('alter table public.%I enable row level security', target);
      raise notice 'RLS enabled on %', target;
    end if;
  end loop;
end
$rls$;

-- Belt and braces: take away the table grants the anon role holds.
--
-- RLS is the control that matters, but a grant plus a future policy that
-- turns out wider than intended is how a leak comes back. The anon role
-- has no reason to touch a table in this product; it exists so the
-- browser can call Supabase Auth.
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
alter default privileges in schema public revoke all on tables from anon;

-- `authenticated` keeps its grants, because RLS still governs it and
-- Supabase Auth relies on the role existing with sane defaults. With no
-- policy on a table, a grant gets it nothing.
