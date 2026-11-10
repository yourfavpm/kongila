-- ============================================================================
-- Skill assessments: the columns the flow has always needed
--
-- Run this on staging first. It is additive: no column is dropped, no row is
-- deleted, and every statement is guarded so a re-run is harmless.
--
-- Why it is needed.
--
-- `talent_skill_assessments` had six columns: id, talentId, assessmentId,
-- status, score and assignedAt. The product wrote four more. `submitAssessment`
-- updates answers, subjectiveAnswers and submittedAt, none of which existed, so
-- every submission failed with 42703 and a candidate could not sit an
-- assessment at all. The admin portal set a deadline on the vetting stage
-- record, where the candidate's portal never looks, so a deadline was shown to
-- nobody and enforced by nothing.
--
-- `skill_assessment_results` had nowhere to keep what the candidate actually
-- wrote, so the admin's Review Submission screen read r.answers and found
-- nothing: an operator marking a written answer could not see the answer. It
-- also had one `score`, with no way to tell the part a machine marked from the
-- part a person did, and nowhere for the reviewer's notes.
--
-- NOTE on quoting: these two tables use camelCase column names, so every
-- reference has to be double-quoted. The tables around them are snake_case.
-- ============================================================================

-- ── The assignment, which is also the submission ────────────────────────────
alter table public.talent_skill_assessments
  -- What the candidate answered. Objective answers here, so the admin can see
  -- the choice beside the key; subjective ones separately, because those are
  -- the ones a person has to read.
  add column if not exists "answers"            jsonb,
  add column if not exists "subjectiveAnswers"  jsonb,
  -- When they opened it and when they sent it. startedAt is what a per-sitting
  -- time limit would run from; submittedAt is what tells the admin queue there
  -- is something to mark.
  add column if not exists "startedAt"          timestamptz,
  add column if not exists "submittedAt"        timestamptz,
  -- The date the operator set when assigning. Shown to the candidate and
  -- checked on submit.
  add column if not exists "deadline"           timestamptz;

-- The status vocabulary the product uses. There was no constraint at all, so
-- any string could be stored; these are the five the code writes and reads.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'talent_skill_assessments_status_check'
  ) then
    -- Anything already stored outside the set would fail the constraint, so
    -- settle those first rather than failing the migration.
    update public.talent_skill_assessments
       set status = 'assigned'
     where status is null
        or status not in ('assigned', 'in_progress', 'submitted', 'marked', 'expired');

    alter table public.talent_skill_assessments
      add constraint talent_skill_assessments_status_check
      check (status in ('assigned', 'in_progress', 'submitted', 'marked', 'expired'));
  end if;
exception when others then
  raise warning 'status constraint not added: %', sqlerrm;
end $$;

-- ── The marking ─────────────────────────────────────────────────────────────
alter table public.skill_assessment_results
  -- A copy of what was submitted, so the marking screen can show every
  -- question with its answer without joining back through the assignment.
  add column if not exists "answers"            jsonb,
  add column if not exists "subjectiveAnswers"  jsonb,
  -- The two halves of the score, kept apart. `score` stays as the final
  -- figure, so nothing that reads it today has to change, but an operator can
  -- now see that 40 of a 72 came from the machine.
  add column if not exists "autoScore"          integer,
  add column if not exists "manualScore"        integer,
  add column if not exists "maxScore"           integer,
  -- True from submission until a person has marked the written answers. The
  -- admin queue filters on it; without it there was no way to find the
  -- submissions waiting for a human.
  add column if not exists "needsReview"        boolean default false,
  -- Who marked it, when, and what they said. A score with no reasoning behind
  -- it is not reviewable and cannot be defended to a candidate.
  add column if not exists "reviewerNotes"      text,
  add column if not exists "reviewedBy"         varchar(255),
  add column if not exists "reviewedAt"         timestamptz;

-- ── Backfill ────────────────────────────────────────────────────────────────
--
-- Rows written before this. A result that already has a score was marked under
-- the old arrangement, so it is treated as reviewed rather than dropped into
-- the review queue, where it would look like new work.
update public.skill_assessment_results
   set "needsReview" = false
 where "needsReview" is null
   and score is not null;

update public.skill_assessment_results
   set "needsReview" = true
 where "needsReview" is null
   and score is null;

-- An old result's score came from the multiple choice alone, so that is what
-- its auto half was.
update public.skill_assessment_results
   set "autoScore" = score
 where "autoScore" is null
   and score is not null;

-- ── Indexes ─────────────────────────────────────────────────────────────────
-- The candidate's portal lists their own assignments; the admin queue lists
-- what is waiting to be marked. Both were sequential scans.
create index if not exists talent_skill_assessments_talent_idx
  on public.talent_skill_assessments ("talentId");

create index if not exists talent_skill_assessments_status_idx
  on public.talent_skill_assessments (status);

create index if not exists skill_assessment_results_talent_idx
  on public.skill_assessment_results ("talentId");

create index if not exists skill_assessment_results_review_idx
  on public.skill_assessment_results ("needsReview")
  where "needsReview" = true;

-- ── Check it landed ─────────────────────────────────────────────────────────
-- select column_name, data_type
--   from information_schema.columns
--  where table_name = 'talent_skill_assessments'
--  order by ordinal_position;
