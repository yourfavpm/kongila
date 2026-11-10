-- ============================================================================
-- Work simulation tasks: the table the stage has always needed
--
-- Run this on staging first. It creates one table and nothing else; no
-- existing column is touched and no row is deleted.
--
-- Why it is needed.
--
-- Work Simulation is stage 6 of 7 and worth 20% of the composite grade, and
-- there was nowhere to store a task. `workSimulationTasks` appears in the
-- Schema type and is initialised to an empty array, readDbAsync never reads
-- it because there is nothing to read, and the admin portal built the task in
-- the browser, put it in React state and attached it to a `payload` object
-- that is never sent. So assigning a work simulation looked like it worked,
-- the stage recorded a taskId pointing at nothing, the candidate was never
-- shown a task, and the whole thing was gone on the next reload.
--
-- Column naming: snake_case, like the tables around it. The two assessment
-- tables are camelCase for historical reasons and are the exception, not the
-- pattern to follow.
-- ============================================================================

create table if not exists public.work_simulation_tasks (
  id               varchar(255) primary key default (gen_random_uuid())::text,
  talent_id        varchar(255) not null,

  title            text not null,
  description      text,
  -- How the candidate is expected to hand it in: a file, a link to a repo or
  -- a deployed thing, or written text. The portal collects this when the task
  -- is created and it decides what the submission form shows.
  submission_type  varchar(50) default 'file',

  assigned_by      varchar(255),
  assigned_at      timestamptz default current_timestamp,
  deadline         timestamptz,

  -- The submission.
  submitted_at     timestamptz,
  submission_url   text,
  submission_text  text,
  submission_name  text,

  -- The marking. Kept apart from the submission so it is obvious which half
  -- is the candidate's and which is ours, and so a score always has the
  -- reasoning beside it.
  score            integer,
  max_score        integer default 100,
  reviewer_notes   text,
  reviewed_by      varchar(255),
  reviewed_at      timestamptz,

  status           varchar(50) default 'assigned',
  created_at       timestamptz default current_timestamp,

  constraint work_simulation_tasks_status_check
    check (status in ('assigned', 'in_progress', 'submitted', 'marked', 'expired', 'cancelled')),
  constraint work_simulation_tasks_submission_type_check
    check (submission_type in ('file', 'link', 'text')),
  -- A score outside its own maximum is a typo, not a result.
  constraint work_simulation_tasks_score_range
    check (score is null or (score >= 0 and max_score is not null and score <= max_score))
);

-- The candidate's portal lists their own tasks; the admin queue lists what is
-- waiting to be marked.
create index if not exists work_simulation_tasks_talent_idx
  on public.work_simulation_tasks (talent_id);

create index if not exists work_simulation_tasks_status_idx
  on public.work_simulation_tasks (status);

create index if not exists work_simulation_tasks_review_idx
  on public.work_simulation_tasks (status)
  where status = 'submitted';

-- ── Row level security ──────────────────────────────────────────────────────
--
-- Every route that touches this table uses the service role key, which
-- bypasses RLS. The policies are here so that a browser holding the anon key
-- cannot read or write it if one ever reaches this table directly, which is
-- how talent_profiles ended up writable from the client.
alter table public.work_simulation_tasks enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
     where tablename = 'work_simulation_tasks'
       and policyname = 'work_simulation_tasks_no_anon'
  ) then
    -- No policy granting anything to anon or authenticated. With RLS on and
    -- no permissive policy, both are denied, and the service role is
    -- unaffected.
    create policy "work_simulation_tasks_no_anon"
      on public.work_simulation_tasks
      for select
      using (false);
  end if;
exception when others then
  raise warning 'work_simulation_tasks policy not added: %', sqlerrm;
end $$;

-- ── Check it landed ─────────────────────────────────────────────────────────
-- select column_name, data_type
--   from information_schema.columns
--  where table_name = 'work_simulation_tasks'
--  order by ordinal_position;
