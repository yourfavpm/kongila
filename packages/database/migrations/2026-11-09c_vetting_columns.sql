-- Vetting pipeline and scores become columns.
--
-- Where they live now: inside talent_profiles.bio, which holds a JSON
-- envelope { __kongila, tags, scores, telemetry, bio } with the pipeline
-- under telemetry.vettingPipeline and the stage scores under scores.
--
-- Four things that costs:
--
--   1. Nothing can query them. The admin pipeline board cannot sort by
--      composite score, filter to candidates stuck at one stage, or count
--      how many are waiting on a skill assessment, without reading every
--      candidate row and parsing JSON in the application.
--   2. A candidate editing their own bio and an operator writing a score
--      are the same UPDATE on the same column. Last write wins, and what it
--      wins over is the other person's work.
--   3. The envelope has to be unpacked, merged and repacked on every write,
--      so a bug in the packer loses the pipeline, the scores and the
--      candidate's bio text together.
--   4. A plain-text bio, which is what a candidate who wrote one before the
--      envelope existed has, parses to nothing and silently reads as an
--      empty pipeline.
--
-- After this migration the columns are the truth. The envelope is left in
-- place and is NOT cleared: it stays as a readable fallback until the
-- application has been running on the columns long enough to trust them.
-- Clearing it is a separate migration, deliberately.
--
-- composite_score is nullable on purpose. NULL means no stage has produced a
-- score yet, which is different from a score of zero. The application
-- distinguishes "not yet graded" from "graded badly" on exactly this.
--
-- Safe to run more than once.

-- ── Columns ─────────────────────────────────────────────────────────────────

do $cols$
begin
  if to_regclass('public.talent_profiles') is null then
    raise exception 'public.talent_profiles does not exist; run supabase_migration.sql first';
  end if;

  if not exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'talent_profiles'
       and column_name = 'vetting_pipeline'
  ) then
    alter table public.talent_profiles
      add column vetting_pipeline jsonb not null default '[]'::jsonb;
    raise notice 'talent_profiles.vetting_pipeline added';
  end if;

  if not exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'talent_profiles'
       and column_name = 'vetting_scores'
  ) then
    alter table public.talent_profiles
      add column vetting_scores jsonb not null default '{}'::jsonb;
    raise notice 'talent_profiles.vetting_scores added';
  end if;

  if not exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'talent_profiles'
       and column_name = 'composite_score'
  ) then
    alter table public.talent_profiles add column composite_score numeric;
    raise notice 'talent_profiles.composite_score added';
  end if;

  if not exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'talent_profiles'
       and column_name = 'vetting_started_at'
  ) then
    alter table public.talent_profiles add column vetting_started_at timestamptz;
    raise notice 'talent_profiles.vetting_started_at added';
  end if;
end
$cols$;

comment on column public.talent_profiles.vetting_pipeline is
  'The candidate''s seven vetting stages, as written by @kongila/matching-engine buildDefaultVettingPipeline and advanced by the admin portal. Created when onboarding completes, never by the browser.';
comment on column public.talent_profiles.vetting_scores is
  'Per-dimension stage scores: technical, behavioral, personality, remoteReadiness, workSimulation. Each 0-100. A dimension absent from this object has not been scored.';
comment on column public.talent_profiles.composite_score is
  'Weighted composite, 0-100, recomputed server side whenever a stage score changes. NULL means nothing has been scored yet, which is not the same as zero.';

-- ── Backfill out of the bio envelope ────────────────────────────────────────
--
-- Row by row, with the parse wrapped per row. A bio that is plain text, or
-- malformed JSON, or an onboarding draft rather than a vetting envelope, is
-- skipped rather than failing the migration. There are not many candidates;
-- correctness matters more than speed here.
--
-- Only rows whose columns are still empty are touched, so re-running this
-- after the application has started writing columns cannot clobber anything.

do $backfill$
declare
  rec record;
  envelope jsonb;
  found_pipeline jsonb;
  found_scores jsonb;
  moved integer := 0;
  skipped_unparsable integer := 0;
  skipped_nothing integer := 0;
begin
  for rec in
    select id, bio
      from public.talent_profiles
     where bio is not null
       and bio <> ''
       and vetting_pipeline = '[]'::jsonb
       and vetting_scores = '{}'::jsonb
  loop
    begin
      envelope := rec.bio::jsonb;
    exception when others then
      -- A bio the candidate typed themselves. Nothing to move.
      skipped_unparsable := skipped_unparsable + 1;
      continue;
    end;

    if envelope is null or jsonb_typeof(envelope) <> 'object' then
      skipped_unparsable := skipped_unparsable + 1;
      continue;
    end if;

    found_pipeline := envelope -> 'telemetry' -> 'vettingPipeline';
    found_scores   := envelope -> 'scores';

    if jsonb_typeof(coalesce(found_pipeline, 'null'::jsonb)) <> 'array' then
      found_pipeline := null;
    end if;
    if jsonb_typeof(coalesce(found_scores, 'null'::jsonb)) <> 'object' then
      found_scores := null;
    end if;

    if found_pipeline is null and found_scores is null then
      skipped_nothing := skipped_nothing + 1;
      continue;
    end if;

    update public.talent_profiles
       set vetting_pipeline = coalesce(found_pipeline, vetting_pipeline),
           vetting_scores   = coalesce(found_scores, vetting_scores),
           vetting_started_at = case
             when coalesce(jsonb_array_length(coalesce(found_pipeline, '[]'::jsonb)), 0) > 0
               then coalesce(vetting_started_at, date_joined, now())
             else vetting_started_at
           end
     where id = rec.id;

    moved := moved + 1;
  end loop;

  raise notice 'pipelines/scores moved out of the bio envelope: %', moved;
  raise notice 'rows whose bio was not a JSON envelope (left alone): %', skipped_unparsable;
  raise notice 'rows with an envelope but no vetting data: %', skipped_nothing;
end
$backfill$;

-- ── Composite score, from what was just moved ───────────────────────────────
--
-- The same weights as packages/matching-engine/grading.ts: technical 30,
-- behavioral 30, workSimulation 20, personality 10, remoteReadiness 10.
--
-- Kept NULL where no dimension has a value, so an unassessed candidate does
-- not acquire a score of zero and the grade of Reject that follows from it.
-- If these weights ever change, grading.ts is the source of truth and this
-- statement is a one-off backfill, not a second implementation to maintain.

update public.talent_profiles
   set composite_score = round((
         coalesce((vetting_scores ->> 'technical')::numeric, 0) * 0.30 +
         coalesce((vetting_scores ->> 'behavioral')::numeric, 0) * 0.30 +
         coalesce((vetting_scores ->> 'workSimulation')::numeric, 0) * 0.20 +
         coalesce((vetting_scores ->> 'personality')::numeric, 0) * 0.10 +
         coalesce((vetting_scores ->> 'remoteReadiness')::numeric, 0) * 0.10
       ))
 where composite_score is null
   and vetting_scores <> '{}'::jsonb
   and (
     vetting_scores ? 'technical' or vetting_scores ? 'behavioral' or
     vetting_scores ? 'workSimulation' or vetting_scores ? 'personality' or
     vetting_scores ? 'remoteReadiness'
   );

-- ── Indexes ─────────────────────────────────────────────────────────────────
--
-- The two the admin board actually needs: candidates by where they are in
-- vetting, and candidates by composite score.

create index if not exists talent_profiles_vetting_status_idx
  on public.talent_profiles (vetting_status);

create index if not exists talent_profiles_composite_score_idx
  on public.talent_profiles (composite_score desc nulls last);

-- ── What the state looks like afterwards ────────────────────────────────────

do $report$
declare
  total integer;
  with_pipeline integer;
  with_scores integer;
  graded integer;
begin
  select count(*) into total from public.talent_profiles;
  select count(*) into with_pipeline from public.talent_profiles
   where jsonb_array_length(vetting_pipeline) > 0;
  select count(*) into with_scores from public.talent_profiles
   where vetting_scores <> '{}'::jsonb;
  select count(*) into graded from public.talent_profiles
   where composite_score is not null;

  raise notice '---';
  raise notice 'candidates: %', total;
  raise notice '  with a vetting pipeline: %', with_pipeline;
  raise notice '  with at least one score:  %', with_scores;
  raise notice '  with a composite score:   %', graded;
  raise notice 'candidates with no pipeline get one when they next load their portal.';
end
$report$;
