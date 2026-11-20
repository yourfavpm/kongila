-- Milestones on the offer, where a project is actually agreed.
--
-- Run this once, in the Supabase SQL editor. Everything is IF NOT EXISTS, so
-- running it twice is harmless, and the code tolerates the table being absent
-- so a deploy landing before the migration degrades rather than failing.
--
-- Why a second milestone table rather than reusing project_milestones:
-- project_milestones hangs off a contract, which does not exist until the
-- offer has been accepted. A project offer with no milestones is an offer
-- with no agreed delivery plan and no agreed payment points, which is how
-- project engagements have been arriving at operations to be invented after
-- the fact. These are the ones the client proposed and the candidate
-- accepted; they are copied to project_milestones at contract generation and
-- then left alone, so the accepted offer stays exactly what was agreed.

CREATE TABLE IF NOT EXISTS offer_milestones (
  id            text PRIMARY KEY DEFAULT (gen_random_uuid())::text,
  offer_id      text NOT NULL,
  name          text NOT NULL,
  description   text,
  due_date      date,
  -- A share of the project fee, or an explicit amount. Not both: the amount
  -- wins if somebody sends both, which is what milestoneAmount() does.
  percent       numeric,
  amount_usd    numeric,
  sequence      integer NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS offer_milestones_offer_idx
  ON offer_milestones (offer_id);

-- ─── Where the project fee lives on the offer ────────────────────────────────
-- proposed_rate_usd carries a monthly rate for every other service line. For
-- a project it is the whole fee, which is a different thing, so it gets its
-- own column rather than a comment somebody has to remember.

ALTER TABLE offers ADD COLUMN IF NOT EXISTS project_fee_usd numeric;

-- Which milestone plan a contract was generated from, so the copy can be
-- traced back to what was agreed.
ALTER TABLE project_milestones ADD COLUMN IF NOT EXISTS source_offer_milestone_id text;
ALTER TABLE project_milestones ADD COLUMN IF NOT EXISTS offer_id                  text;

-- ─── Row level security ──────────────────────────────────────────────────────
-- Written by the server with the service role key and read by nothing else,
-- so the browser gets no policy at all.

ALTER TABLE offer_milestones ENABLE ROW LEVEL SECURITY;
