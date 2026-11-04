-- Kongila — interview timezones
--
-- The product places African talent with clients abroad, so an interview
-- almost always spans two zones. Nothing recorded one.
--
-- `date` and `time` are naive wall-clock text. A client in New York booking
-- 15:00 stored "15:00". The candidate in Lagos was shown "15:00 (Your Local
-- Time)" for a call that started at 21:00 their time.
--
-- `scheduled_time timestamptz` already existed and was written by exactly one
-- of the four code paths that create an interview. This migration adds the
-- missing half: which zone the wall-clock time was entered in, and which zone
-- each party reads it in.
--
-- The text columns stay. They are display fallbacks for rows written before
-- this, and nothing should treat them as the source of truth again.
--
-- PROPOSED, NOT RUN. Back up first, then run in the SQL editor.

-- ── Which zone the time was entered in ───────────────────────────────────────

alter table public.interviews
  add column if not exists scheduled_timezone text;

comment on column public.interviews.scheduled_timezone is
  'IANA zone the wall-clock date/time were entered in, e.g. America/New_York. '
  'Needed to interpret the legacy date and time columns. scheduled_time is '
  'the source of truth; this says how it was arrived at.';

-- ── Which zone each party reads it in ────────────────────────────────────────
-- So each side can be shown its own time and the other side's, without a
-- lookup against two profile tables on every render.

alter table public.interviews
  add column if not exists client_timezone text;

alter table public.interviews
  add column if not exists talent_timezone text;

comment on column public.interviews.client_timezone is
  'IANA zone to display this interview in for the client.';
comment on column public.interviews.talent_timezone is
  'IANA zone to display this interview in for the candidate.';

-- ── Reschedule as a real record ──────────────────────────────────────────────
-- reschedule_requested, reschedule_reason, proposed_new_date and
-- proposed_new_time already exist, but there was no way to tell who asked, no
-- timestamp, and the proposal was naive text like everything else. Approving a
-- request created a second interview row and left the first one Scheduled
-- forever, so the admin queue showed two live interviews for one conversation.

alter table public.interviews
  add column if not exists reschedule_requested_by text;

alter table public.interviews
  add column if not exists reschedule_requested_at timestamptz;

alter table public.interviews
  add column if not exists proposed_time timestamptz;

alter table public.interviews
  add column if not exists proposed_timezone text;

alter table public.interviews
  add column if not exists rescheduled_from timestamptz;

comment on column public.interviews.reschedule_requested_by is
  'Who asked: ''client'', ''talent'' or ''admin''. No CHECK, so a new actor is not an outage.';
comment on column public.interviews.proposed_time is
  'The proposed new instant, in UTC. Supersedes proposed_new_date/time, which are naive text.';
comment on column public.interviews.rescheduled_from is
  'The previous scheduled_time, kept when a reschedule is approved in place. '
  'Approving used to mint a new row and abandon the old one.';

create index if not exists interviews_reschedule_requested_idx
  on public.interviews (reschedule_requested)
  where reschedule_requested = true;

-- ── Reminders ─────────────────────────────────────────────────────
-- There were no interview reminders at all. The cron route at
-- apps/admin-panel/pages/api/cron/interview-reminders.ts stamps these so a
-- reminder cannot be sent twice, and so a run that is late or skipped still
-- catches one that is due.

alter table public.interviews
  add column if not exists reminder_24h_sent_at timestamptz;

alter table public.interviews
  add column if not exists reminder_1h_sent_at timestamptz;

comment on column public.interviews.reminder_24h_sent_at is
  'Set when the day-before reminder went out. Stamped even on a partial failure, '
  'so an undeliverable address does not resend every fifteen minutes forever.';

create index if not exists interviews_scheduled_time_idx
  on public.interviews (scheduled_time)
  where scheduled_time is not null;

-- ── Backfill ─────────────────────────────────────────────────────────────────
-- Rows written before this have a wall-clock time and no zone, so their real
-- instant is unknowable. They are interpreted as UTC, which is a guess, and
-- marked so an operator can tell the difference between a guess and a fact.
--
-- Check what this is about to touch before running it:
--
--   select id, title, date, time, scheduled_time from public.interviews
--   where scheduled_time is null and date is not null;

update public.interviews
set scheduled_time = (date || ' ' || coalesce(nullif(time, ''), '00:00') || ':00')::timestamp at time zone 'UTC',
    scheduled_timezone = 'UTC'
where scheduled_time is null
  and date ~ '^\d{4}-\d{2}-\d{2}$'
  and (time is null or time ~ '^\d{2}:\d{2}');

-- ── Verify ───────────────────────────────────────────────────────────────────

select column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name = 'interviews'
  and column_name in (
    'scheduled_time', 'scheduled_timezone', 'client_timezone', 'talent_timezone',
    'reschedule_requested_by', 'reschedule_requested_at', 'proposed_time',
    'proposed_timezone', 'rescheduled_from',
    'reminder_24h_sent_at', 'reminder_1h_sent_at')
order by column_name;

select count(*) filter (where scheduled_time is null) as still_without_an_instant,
       count(*) filter (where scheduled_timezone = 'UTC') as assumed_utc,
       count(*) as total
from public.interviews;

-- ── Rollback ─────────────────────────────────────────────────────────────────
-- alter table public.interviews drop column if exists scheduled_timezone;
-- alter table public.interviews drop column if exists client_timezone;
-- alter table public.interviews drop column if exists talent_timezone;
-- alter table public.interviews drop column if exists reschedule_requested_by;
-- alter table public.interviews drop column if exists reschedule_requested_at;
-- alter table public.interviews drop column if exists proposed_time;
-- alter table public.interviews drop column if exists proposed_timezone;
-- alter table public.interviews drop column if exists rescheduled_from;
-- alter table public.interviews drop column if exists reminder_24h_sent_at;
-- alter table public.interviews drop column if exists reminder_1h_sent_at;
