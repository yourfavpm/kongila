# The 3 November migrations

The reasoning that used to sit in long comment headers inside the SQL
files. It was moved here because those headers made the files awkward to
paste into the Supabase editor, and because none of it is load-bearing at
run time.

Run them in this order:

1. `2026-11-03_finance.sql`
2. `2026-11-03b_payroll_and_currency.sql`
3. `2026-11-03c_invoicing_and_documents.sql`

All three are idempotent. Running one twice is a no-op.

## Why key columns are read from the catalog

`contracts.id` is a `varchar` on this schema, not a `uuid`, and so are most
other id columns: they carry prefixed strings like `contract_1762...`
alongside real uuids. The first version of the finance migration assumed
uuid and failed with:

    foreign key constraint "invoices_contract_id_fkey" cannot be implemented
    Key columns "contract_id" and "id" are of incompatible types

Rather than hardcode a second guess, each foreign key column is created
with whatever type the column it references actually has. Where the column
already exists with the wrong type, it is converted. That second case is
what caught us out: `invoices.contract_id` already existed as a `uuid` on
staging, so `add column if not exists` skipped it and left the mismatch in
place.

## 2026-11-03_finance.sql

- `fee_config`, one row per service line. Percentages start NULL. The
  billing code refuses a line with no configured fee rather than inventing
  a margin, so nothing bills until the four are set.
- `fee_audit_log`, append only via a trigger. A margin change rewrites what
  every future invoice is worth.
- One-time fee columns on `contracts`: placement and project engagements
  are not monthly.
- `billed_through` on `contracts`, which is what makes a billing run safe
  to repeat.
- Invoice period and totals, plus `invoice_line_items`.
- A unique index on `(contract_id, period)`: a second run in the same month
  hits the constraint instead of double-billing.
- Gross, commission and net on `talent_payouts`. Before this both gross and
  net fell back to `amount`, so a payout showed the same number twice and
  the deduction was invisible.

## 2026-11-03b_payroll_and_currency.sql

`payroll_entries` belongs to Remotan. Its foreign keys point at
`remotan_workspaces` and `workspace_members`, and its hours come from
`time_logs`, which is also Remotan. Kongila is launching without any of it,
and has no hours anywhere. Nothing in the Kongila codebase ever read or
wrote a row of that table, and it is left untouched here.

`kongila_payroll_runs` and `kongila_payroll_entries` are keyed on a
contract instead. Gross is the monthly rate prorated by calendar days, so a
contract starting on the 15th is paid for 16 of 30 days rather than a full
month. Each entry stores its own working, so a candidate querying their
payout can be shown how it was reached.

Currency and the rate used go on every money row. A figure converted in
March and read in June used to be shown against June's rate, so nothing
reconciled. `rate_source = 'fallback'` marks a row converted at a built-in
estimate rather than a real rate, which finance can query for.

## 2026-11-03c_invoicing_and_documents.sql

- `payment_terms_days` on contracts, so a due date comes from the agreement
  rather than a hardcoded fourteen days.
- Issue, sent and overdue dates on invoices, and a unique invoice number.
- `overdue` added to the invoice status constraint. Nothing could move an
  invoice there before, which is why the overdue filter in the admin panel
  and the overdue banner in the client portal were always empty.
- Fourteen columns added to `documents`. That table had eleven columns and
  `writeDbAsync` writes twenty-three, so every document write through that
  path failed, logged a line to the server console and carried on. It is
  why CV version numbers and certification expiry dates never survived a
  reload.
- `superseded_by_id` and `is_current`, so a candidate's four CVs say which
  one counts.

## Seeding staging

`packages/database/seeds/staging-seed.sql` and `staging-unseed.sql`. They
are deliberately not in `migrations/`, so they are not part of the
migration sequence and cannot reach production that way. Both refuse to run
until you uncomment a confirmation line.

`scripts/seed-demo.js` does the same thing from the command line and also
creates the Supabase Auth logins, which SQL in the editor cannot do. Use
whichever suits. The SQL file is the one to use if you only want the data.
