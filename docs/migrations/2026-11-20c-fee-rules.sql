-- Fee rules with dates, bounds and versions.
--
-- Run this after 2026-11-20b. Everything is IF NOT EXISTS, so running it
-- twice is harmless, and the code falls back to fee_config when the table is
-- absent, so a deploy landing before the migration keeps pricing contracts
-- exactly as it does now.
--
-- Why: fee_config holds one row per service line, overwritten whenever
-- somebody changes a figure. That prices a contract today and answers none of
-- the questions asked afterwards — what was the rate in March, why does this
-- contract bill 15% when the screen says 18%, who changed it and when.
--
-- Contracts already freeze their terms at generation, so a change does not
-- reprice what was signed. This is the other half: the rules keep their
-- history, so the figure frozen onto a contract can be traced to the rule
-- version it came from.
--
-- Nothing is ever edited in place. Changing a fee closes the current version
-- with an end date and inserts a new one.

CREATE TABLE IF NOT EXISTS fee_rules (
  id              text PRIMARY KEY DEFAULT (gen_random_uuid())::text,
  service_line    text NOT NULL,
  -- 'client': added to the client's bill. 'talent': deducted from their pay.
  party           text NOT NULL,
  -- percent_of_rate, percent_of_annual_salary, percent_of_project_fee,
  -- flat_amount, per_seat.
  basis           text NOT NULL,
  -- A fraction for a percentage basis (0.15), an amount for a flat one.
  value           numeric NOT NULL,
  minimum_usd     numeric,
  maximum_usd     numeric,
  -- The window. An open end means this is the current version.
  effective_from  date,
  effective_to    date,
  version         integer NOT NULL DEFAULT 1,
  active          boolean NOT NULL DEFAULT true,
  label           text,
  created_by      text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS fee_rules_lookup_idx
  ON fee_rules (service_line, party, effective_from);

ALTER TABLE fee_rules
  DROP CONSTRAINT IF EXISTS fee_rules_party_check;
ALTER TABLE fee_rules
  ADD CONSTRAINT fee_rules_party_check
  CHECK (party IN ('client', 'talent'));

ALTER TABLE fee_rules
  DROP CONSTRAINT IF EXISTS fee_rules_basis_check;
ALTER TABLE fee_rules
  ADD CONSTRAINT fee_rules_basis_check
  CHECK (basis IN ('percent_of_rate', 'percent_of_annual_salary',
                   'percent_of_project_fee', 'flat_amount', 'per_seat'));

-- Which rule version priced a contract. The figures are already frozen on the
-- contract; these say where they came from, so an invoice can be explained
-- two years later without guessing.
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS client_fee_rule_id       text;
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS client_fee_rule_version  integer;
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS talent_fee_rule_id       text;
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS talent_fee_rule_version  integer;

-- ─── Row level security ──────────────────────────────────────────────────────

ALTER TABLE fee_rules ENABLE ROW LEVEL SECURITY;

-- ─── Seeding from what is already configured ─────────────────────────────────
-- Each fee_config row becomes version 1 of a rule with an open start, so
-- everything priced before today still resolves to the same figure. Only runs
-- when fee_rules is empty, so re-running the migration never duplicates.

INSERT INTO fee_rules (service_line, party, basis, value, version, active, label, effective_from)
SELECT
  f.service_line,
  'client',
  CASE
    WHEN f.service_line = 'placement' AND f.placement_fee_pct IS NOT NULL
      THEN 'percent_of_annual_salary'
    WHEN f.service_line = 'project' THEN 'percent_of_project_fee'
    ELSE 'percent_of_rate'
  END,
  COALESCE(
    CASE WHEN f.service_line = 'placement' THEN f.placement_fee_pct END,
    f.client_fee_pct,
    0
  ),
  1, true, 'Carried over from the fee configuration', NULL
FROM fee_config f
WHERE NOT EXISTS (SELECT 1 FROM fee_rules)
  AND COALESCE(
        CASE WHEN f.service_line = 'placement' THEN f.placement_fee_pct END,
        f.client_fee_pct) IS NOT NULL;

INSERT INTO fee_rules (service_line, party, basis, value, version, active, label, effective_from)
SELECT
  f.service_line, 'talent', 'percent_of_rate', f.talent_commission_pct,
  1, true, 'Carried over from the fee configuration', NULL
FROM fee_config f
WHERE f.talent_commission_pct IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM fee_rules r WHERE r.service_line = f.service_line AND r.party = 'talent');
