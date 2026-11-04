-- Kongila — support messages, and platform settings
--
-- PROPOSED, NOT RUN. Back up first.

-- ============================================================================
-- 1. SUPPORT MESSAGES
-- ============================================================================
-- support_messages.timestamp is varchar(50) and NOT NULL, and the admin route
-- filled it with a locale time string like "07:10 PM" — which cannot be
-- ordered, compared or converted, and loses the date entirely. created_at is
-- the orderable column and already exists; this just stops the varchar being
-- required so a writer is not forced to invent something for it.

alter table public.support_messages
  alter column timestamp drop not null;

comment on column public.support_messages."timestamp" is
  'Legacy display string. Order by created_at: this column held locale times '
  'like "07:10 PM", which carry no date and cannot be compared.';

-- ============================================================================
-- 2. PLATFORM SETTINGS
-- ============================================================================
-- There was no settings table at all. The Schema type has a platformSettings
-- array that nothing reads or writes, the fee config is a TypeScript interface
-- with no storage, and analytics cannot report revenue because no fee rate
-- exists anywhere to multiply by.
--
-- One row per setting, typed loosely on purpose: a settings table that needs a
-- migration every time someone adds a toggle does not get used.

create table if not exists public.platform_settings (
  key          varchar(100) primary key,
  value        jsonb not null,
  description  text,
  category     varchar(50) not null default 'general',
  updated_at   timestamptz not null default now(),
  updated_by   varchar(255),
  constraint platform_settings_category_check check (category in (
    'general', 'finance', 'vetting', 'notifications', 'interviews'))
);

comment on table public.platform_settings is
  'Key/value platform configuration. Read through getSettings in '
  'packages/database/settingsService.ts, never queried directly.';

-- Seeds. Every one of these is a number the product currently hardcodes or
-- invents, written down in one place where an operator can change it.

insert into public.platform_settings (key, value, description, category) values
  ('platform_fee_rate', '0.25'::jsonb,
   'Kongila''s margin as a fraction of contract value. Analytics reports revenue as unavailable until this is set.',
   'finance'),

  ('default_currency', '"USD"'::jsonb,
   'Currency contract values are quoted in.',
   'finance'),

  ('payout_day_of_month', '25'::jsonb,
   'Day of the month talent payouts are run.',
   'finance'),

  ('vetting_grade_thresholds', '{"A+": 85, "A": 75, "B": 65}'::jsonb,
   'Composite score needed for each grade. Mirrors GRADE_THRESHOLDS in packages/matching-engine/grading.ts.',
   'vetting'),

  ('grade_b_deployable', 'false'::jsonb,
   'Whether grade B is matched automatically. False: B is the trainable pool and needs an override reason.',
   'vetting'),

  ('max_interviews_per_candidate', '3'::jsonb,
   'How many interviews one client may book with one candidate for one request.',
   'interviews'),

  ('interview_late_change_hours', '4'::jsonb,
   'How close to the start a client may still move an interview themselves.',
   'interviews'),

  ('interview_default_duration_minutes', '60'::jsonb,
   'Assumed length of an interview when none is given.',
   'interviews'),

  ('reminder_hours_before', '[24, 1]'::jsonb,
   'When interview reminders are sent, in hours before the start.',
   'notifications'),

  ('support_sla_hours', '{"High": 4, "Medium": 24, "Low": 48}'::jsonb,
   'Target first-response time per ticket priority.',
   'general')
on conflict (key) do nothing;

-- Only the server writes settings, and only a super admin through it.
revoke insert, update, delete on public.platform_settings from anon, authenticated;
grant select on public.platform_settings to authenticated;

-- ============================================================================
-- VERIFY
-- ============================================================================

select key, value, category from public.platform_settings order by category, key;

select column_name, is_nullable
from information_schema.columns
where table_schema = 'public' and table_name = 'support_messages'
  and column_name = 'timestamp';

-- ============================================================================
-- ROLLBACK
-- ============================================================================
-- drop table if exists public.platform_settings;s
-- alter table public.support_messages alter column timestamp enot t null;
