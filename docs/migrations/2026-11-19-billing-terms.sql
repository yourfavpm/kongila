-- Billing terms: configurable margins, payment schedules, seats, milestones.
--
-- Run this once, in the Supabase SQL editor, before deploying the code that
-- uses it. Everything is IF NOT EXISTS, so running it twice is harmless.
--
-- Nothing here drops or rewrites an existing column. The code tolerates every
-- one of these being absent, so a deploy that lands before the migration
-- degrades to the previous behaviour rather than failing.

-- ─── Margins, per service line ───────────────────────────────────────────────
-- client_fee_pct and talent_commission_pct already exist. These two are new.
--
-- placement_fee_pct is a fraction of annual salary (0.15 is fifteen percent),
-- which is how placement is actually sold. management_premium_pct is what
-- Kongila adds for supervising an outsourced person day to day.

ALTER TABLE fee_config ADD COLUMN IF NOT EXISTS placement_fee_pct       numeric;
ALTER TABLE fee_config ADD COLUMN IF NOT EXISTS management_premium_pct  numeric;
ALTER TABLE fee_config ADD COLUMN IF NOT EXISTS payment_terms_days      integer;
ALTER TABLE fee_config ADD COLUMN IF NOT EXISTS payment_schedule        jsonb;
ALTER TABLE fee_config ADD COLUMN IF NOT EXISTS notes                   text;

-- ─── Margins, per client ─────────────────────────────────────────────────────
-- An override of the service-line default for one organisation. A row here
-- with a NULL in a column means "use the service line's value", so a client
-- can have a bespoke placement fee and standard everything else.

CREATE TABLE IF NOT EXISTS client_billing_terms (
  id                      text PRIMARY KEY DEFAULT (gen_random_uuid())::text,
  organization_id         text NOT NULL,
  service_line            text NOT NULL,
  client_fee_pct          numeric,
  talent_commission_pct   numeric,
  placement_fee_pct       numeric,
  management_premium_pct  numeric,
  payment_terms_days      integer,
  -- { "recurring": true, "splits": [ { "label": "...", "percent": 50, "dayOfMonth": 1 } ] }
  payment_schedule        jsonb,
  notes                   text,
  updated_by              text,
  updated_at              timestamptz NOT NULL DEFAULT now(),
  created_at              timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, service_line)
);

CREATE INDEX IF NOT EXISTS client_billing_terms_org_idx
  ON client_billing_terms (organization_id);

-- ─── Terms on the contract ───────────────────────────────────────────────────
-- Locked when the contract is generated, so a margin changed in six months
-- does not silently reprice an engagement somebody already signed.

ALTER TABLE contracts ADD COLUMN IF NOT EXISTS annual_salary_usd            numeric;
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS placement_fee_pct            numeric;
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS client_fee_pct_snapshot      numeric;
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS talent_commission_pct_snapshot numeric;
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS management_premium_pct       numeric;
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS payment_schedule             jsonb;
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS seats                        integer;
-- Hire Talent activates when the first invoice is paid, not on the start date.
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS activation_invoice_id        text;
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS activated_at                 timestamptz;

-- ─── What an invoice is due in parts ─────────────────────────────────────────
-- One charge, several due dates. Modelling a 50/50 split as two invoices
-- breaks the "last period billed" bookkeeping and doubles the client's
-- paperwork for one month of work.

CREATE TABLE IF NOT EXISTS invoice_instalments (
  id            text PRIMARY KEY DEFAULT (gen_random_uuid())::text,
  invoice_id    text NOT NULL,
  sequence      integer NOT NULL,
  label         text,
  percent       numeric,
  amount        numeric NOT NULL,
  due_date      date NOT NULL,
  status        text NOT NULL DEFAULT 'due',
  paid_at       timestamptz,
  paid_amount   numeric,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (invoice_id, sequence)
);

CREATE INDEX IF NOT EXISTS invoice_instalments_invoice_idx
  ON invoice_instalments (invoice_id);
CREATE INDEX IF NOT EXISTS invoice_instalments_due_idx
  ON invoice_instalments (due_date, status);

ALTER TABLE invoices ADD COLUMN IF NOT EXISTS milestone_id        text;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS description         text;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS amount_due_now      numeric;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS next_due_date       date;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS next_due_amount     numeric;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS is_recurring        boolean NOT NULL DEFAULT false;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS activates_contract  boolean NOT NULL DEFAULT false;

-- ─── Project milestones ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS project_milestones (
  id            text PRIMARY KEY DEFAULT (gen_random_uuid())::text,
  project_id    text,
  contract_id   text,
  name          text NOT NULL,
  description   text,
  due_date      date,
  -- Percentage of the project fee, or an explicit amount. Not both.
  percent       numeric,
  amount_usd    numeric,
  sequence      integer NOT NULL DEFAULT 0,
  status        text NOT NULL DEFAULT 'pending',
  delivered_at  timestamptz,
  delivered_by  text,
  invoice_id    text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS project_milestones_contract_idx
  ON project_milestones (contract_id);
CREATE INDEX IF NOT EXISTS project_milestones_status_idx
  ON project_milestones (status);

ALTER TABLE project_milestones
  DROP CONSTRAINT IF EXISTS project_milestones_status_check;
ALTER TABLE project_milestones
  ADD CONSTRAINT project_milestones_status_check
  CHECK (status IN ('pending', 'delivered', 'invoiced', 'paid', 'cancelled'));

-- ─── Row level security ──────────────────────────────────────────────────────
-- Every one of these is written by the server with the service role key and
-- read by nothing else, so the browser gets no policy at all.

ALTER TABLE client_billing_terms ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_instalments  ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_milestones   ENABLE ROW LEVEL SECURITY;

-- In-app notifications can link back to the offer or contract they describe.
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS source_record_id text;

-- ─── Contract templates ──────────────────────────────────────────────────────
-- source_key records which shipped template a row came from, so restoring the
-- defaults a second time recognises what it already put there and leaves any
-- edits alone. Without it the match falls back to the name, which breaks the
-- moment somebody renames one.

-- Bootstrap the table here as well as in the earlier standalone migration:
-- this is the current billing/contract migration operators are directed to
-- apply, and it must work on a database that has never received templates.
CREATE TABLE IF NOT EXISTS public.contract_templates (
  id varchar PRIMARY KEY DEFAULT (gen_random_uuid())::text,
  name varchar NOT NULL,
  service_type varchar,
  body text NOT NULL,
  status varchar NOT NULL DEFAULT 'draft',
  version integer NOT NULL DEFAULT 1,
  created_by varchar REFERENCES public.users(id) ON DELETE SET NULL,
  source_key text,
  audience text NOT NULL DEFAULT 'client',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT contract_templates_status_check CHECK (status IN ('draft', 'published', 'archived')),
  CONSTRAINT contract_templates_version_check CHECK (version >= 1),
  CONSTRAINT contract_templates_audience_check CHECK (audience IN ('client', 'talent'))
);

ALTER TABLE public.contract_templates ADD COLUMN IF NOT EXISTS source_key text;
ALTER TABLE public.contract_templates ADD COLUMN IF NOT EXISTS audience text NOT NULL DEFAULT 'client';

ALTER TABLE contract_templates ADD COLUMN IF NOT EXISTS source_key text;

CREATE INDEX IF NOT EXISTS contract_templates_source_key_idx
  ON contract_templates (source_key);

-- ─── Client and candidate get different documents ────────────────────────────
-- Every engagement produces two: the client signs an agreement with Kongila
-- about the service, the candidate signs a different one about the work and
-- the pay. One published template per service line per audience.

ALTER TABLE contract_templates
  ADD COLUMN IF NOT EXISTS audience text NOT NULL DEFAULT 'client';

ALTER TABLE contract_templates
  DROP CONSTRAINT IF EXISTS contract_templates_audience_check;
ALTER TABLE contract_templates
  ADD CONSTRAINT contract_templates_audience_check
  CHECK (audience IN ('client', 'talent'));

-- The old index allowed one published template per service line, which makes
-- the second audience impossible to publish.
DROP INDEX IF EXISTS contract_templates_published_idx;
CREATE UNIQUE INDEX IF NOT EXISTS contract_templates_published_idx
  ON contract_templates (service_type, audience)
  WHERE status = 'published';

-- ─── The contract carries what was generated and when they are paid ──────────
-- The rendered documents are stored, not re-rendered. A contract re-rendered
-- from a template that has since been edited is not the document anybody
-- signed.

ALTER TABLE contracts ADD COLUMN IF NOT EXISTS client_contract_body text;
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS talent_contract_body text;
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS client_template_id   text;
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS talent_template_id   text;
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS generated_at         timestamptz;
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS sent_at              timestamptz;

-- When the candidate is paid. Feeds payroll and the next-payday line in the
-- talent portal, so the answer comes from the contract rather than from a
-- rule someone remembers.
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS talent_pay_frequency text;
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS talent_payday_day    integer;
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS talent_pay_amount    numeric;

ALTER TABLE contracts
  DROP CONSTRAINT IF EXISTS contracts_talent_pay_frequency_check;
ALTER TABLE contracts
  ADD CONSTRAINT contracts_talent_pay_frequency_check
  CHECK (talent_pay_frequency IS NULL
         OR talent_pay_frequency IN ('monthly', 'twice_monthly', 'fortnightly', 'on_milestone'));
