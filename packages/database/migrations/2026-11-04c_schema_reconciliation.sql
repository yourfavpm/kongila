-- Columns the code writes that the live database does not have.
--
-- Found by diffing every insert, update and upsert in the repository
-- against docs/live-schema.json. Two tables were short:
--
--   contracts.updated_at        written by /api/contracts/sign on every
--                               signature and activation. The column does
--                               not exist, so Postgres refused the whole
--                               update and no contract could be signed.
--
--   interviews.reminder_24h_sent_at
--   interviews.reminder_1h_sent_at
--                               read and written by the interview reminder
--                               cron to know which reminders have already
--                               gone out. Without them the job errors on
--                               its first query, so no reminder has ever
--                               been sent, and if the columns were added
--                               without the guard the job would resend the
--                               same reminder on every run.
--
-- See docs/migrations-2026-11-04.md for the longer note.
--
-- Safe to run more than once.

do $mig$
begin

  -- ── contracts ────────────────────────────────────────────────────────────
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'contracts'
      and column_name = 'updated_at'
  ) then
    alter table public.contracts add column updated_at timestamptz;
    -- Backfill from signed_at where there is one, so the column is not a
    -- wall of nulls on tables that already have history.
    update public.contracts set updated_at = coalesce(signed_at, now());
    alter table public.contracts alter column updated_at set default now();
  end if;

  -- ── interviews ───────────────────────────────────────────────────────────
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'interviews'
      and column_name = 'reminder_24h_sent_at'
  ) then
    alter table public.interviews add column reminder_24h_sent_at timestamptz;
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'interviews'
      and column_name = 'reminder_1h_sent_at'
  ) then
    alter table public.interviews add column reminder_1h_sent_at timestamptz;
  end if;

end
$mig$;

-- The reminder job looks for interviews starting within a window whose
-- reminder column is still null. Without an index that is a sequential scan
-- of every interview ever held, every time the job runs.
create index if not exists interviews_reminder_24h_idx
  on public.interviews (scheduled_time)
  where reminder_24h_sent_at is null;

create index if not exists interviews_reminder_1h_idx
  on public.interviews (scheduled_time)
  where reminder_1h_sent_at is null;
