-- Kongila — add the two client_profiles columns the application already writes
--
-- Why: client signup is currently broken. kongila-web/pages/index.tsx writes
-- permission_level on the client_profiles upsert, the column does not exist,
-- PostgREST rejects the whole row, and the code throws "Client Profile DB
-- Error". By that point supabase.auth.signUp has already created the auth
-- user, so the person cannot retry: a second attempt answers "already
-- registered". They are stranded with an auth account and no profile.
--
-- Confirmed against the live schema on 31 October 2026. client_profiles has
-- exactly: id, user_id, organization_id, position, phone.
--
-- Also unblocks:
--   - ClientDashboard.tsx settings save (writes client_profiles.settings)
--   - the client_profiles branch of writeDbAsync, which writes both columns
--     and currently fails the whole batch
--
-- PROPOSED, NOT RUN. Take a backup first, then run this in the SQL editor.
-- Check the project ref in the URL bar before you do.

-- ── permission_level ─────────────────────────────────────────────────────────
-- Deliberately no CHECK constraint. shared-types declares this as
-- 'Full Access' | 'Billing Only' | 'View Only' | string, the UI can add
-- options, and a constraint that disagrees with the code is the exact failure
-- this migration exists to fix. The default matches the fallback already in
-- the read mapper, so existing rows keep behaving as they do today.

alter table public.client_profiles
  add column if not exists permission_level text not null default 'Full Access';

comment on column public.client_profiles.permission_level is
  'Team member access level. Expected: Full Access, Billing Only, View Only. Not yet enforced anywhere in the application.';

-- ── settings ─────────────────────────────────────────────────────────────────
-- NULLABLE ON PURPOSE, and with no default.
--
-- The read mapper does `cp.settings || { ...notification defaults }`. An empty
-- object is truthy in JavaScript, so a default of '{}' would satisfy that
-- fallback and hand every client an empty settings object instead of their
-- default notification preferences. Leaving it null preserves today's
-- behaviour exactly.

alter table public.client_profiles
  add column if not exists settings jsonb;

comment on column public.client_profiles.settings is
  'Client notification preferences and saved payment methods. Null means "use the application defaults" — do not backfill with an empty object.';

-- ── Verify ───────────────────────────────────────────────────────────────────
-- Expect five original columns plus the two added here.

select column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema = 'public' and table_name = 'client_profiles'
order by ordinal_position;

-- ── Rollback ─────────────────────────────────────────────────────────────────
-- Only safe while nothing has written real values. Dropping these after
-- clients have saved settings loses that data.
--
-- alter table public.client_profiles drop column if exists permission_level;
-- alter table public.client_profiles drop column if exists settings;
