# Kongila — working notes for AI sessions

Read this before touching anything. It is the shared context for every AI session on this
repo during the launch sprint. If something here is out of date, fix it here first, then
make the change.

Last updated: 19 October 2026

---

## What this is

Kongila is a remote-work hiring platform: African talent, clients abroad. Three portals,
one Supabase database.

Remotan is a separate product for post-placement work execution. **It is out of scope for
this launch.** Do not build, fix or extend anything Remotan. If a task leads you into
`apps/remotan-web` or the workflow engine, stop.

## Branches

- `staging` is the trunk. All work happens here. Deploy from here.
- `main` is 98 commits behind and stays untouched until launch day.
- Never suggest merging to main during the sprint.

## Layout

```
apps/kongila-web     client + talent portal, port 3000   ← most of the work
apps/admin-panel     admin portal, port 3002             ← most of the rest
apps/remotan-web     out of scope, do not touch
packages/database        data access (being dismantled, see below)
packages/shared-types    types and status enums — the contract between portals
packages/matching-engine scoring and matching — real logic, treat with care
packages/workflows       valid status transitions — currently enforced nowhere
packages/contracts       legal templates — do not edit without the lawyer's text
packages/notifications   console.log stubs, being replaced
packages/ui, utils, auth, analytics
```

Commands: `pnpm dev`, `pnpm build`, `pnpm lint`. Node 24, pnpm 11.1.2.

## The three big files

`ClientDashboard.tsx` (8,984 lines), `TalentDashboard.tsx` (8,128), `kongila-web/pages/index.tsx`
(5,101). Over a thousand inline style objects between them.

**Never rewrite one of these files whole.** Never reformat one. Change the specific lines
asked for and leave everything else byte for byte. A diff nobody can read is a diff nobody
can review.

`TalentDashboard.tsx` makes no database calls of its own except two storage uploads.
Everything reaches it as props from `pages/index.tsx` and changes go back through callbacks.
Follow that pattern, do not add direct calls to it.

---

## Data access — the rule that matters most

**Target state, from day 3 of the sprint onward:**

- All writes go through server-side API routes using the service role key.
- No React component calls `supabase.from(...)` to write. Ever.
- Browser reads go through RLS policies scoped to the signed-in user.
- The service role key is server-only. Never `NEXT_PUBLIC_`, never imported into a component.

**What you will still find in the code (being removed, do not copy):**

- ~55 direct `supabase.from(...)` calls in browser components.
- `readDbAsync` / `writeDbAsync` in `packages/database` — reads all 22 tables and upserts 16
  of them on every call. `api/vetting/advance.ts` uses it, so advancing one candidate one
  stage rewrites every user, contract and invoice row. Being replaced with targeted updates.
- `readDb` / `writeDb` — falls back to a `db.json` file on the server and localStorage in the
  browser. `writeDbAsync` still calls `writeDb` on its first line, so the file and the
  database can disagree. Being deleted.

If a task would add to any of those three patterns, it is the wrong approach. Say so.

## Database

One Supabase project. The migration file in `packages/database/supabase_migration.sql` is
**not** the live schema. Seven tables the code uses every day were created by hand in the
console and are missing from it:

`interviews`, `talent_requests`, `conversations`, `message_attachments`,
`request_activity_logs`, `skill_assessment_results`, `assessment_assignments`

Fixing this is day 2. Until it is fixed, do not assume the migration file tells you what
columns exist. Check the live schema.

Two tables for the same thing:

- `talent_requests` — what the client and admin portals actually use. Stores the request as
  a JSON `payload` column. This one survives and gets real columns.
- `service_requests` — legacy. Only `MyRequestsPanel` still writes to it, into a dead end
  nobody reads. Being removed.

RLS is currently disabled on every table. It gets enabled on day 4. Write new code as if it
is already on.

## Status values

`packages/shared-types` holds the enums. They are not yet consistently used — offers appear
as both `Offer Extended` and `offer_extended` in different files. One canonical list is
agreed on day 7 and goes here.

`packages/workflows` defines which transitions are legal. Nothing enforces them yet. New
server-side code should.

---

## Known traps

- **`AdminLogin.tsx` auto-provisions admins.** Any `@kongila.co` signup with no `users` row
  gets role admin; `admin@kongila.co` gets super_admin. Being removed on day 4. Do not
  replicate this pattern anywhere.
- **Team invites are escalatable.** `api/company/invite.ts` passes `orgId` and
  `permissionLevel` as plain URL query parameters. Being replaced with a signed token.
- **Documents are in a public bucket.** `getPublicUrl` on CVs, IDs and signed NDAs. Moving to
  private with signed URLs.
- **Mocks that report success.** `packages/notifications` logs to console and returns
  `success: true`. `api/notifications.ts` is a `[NOTIFICATION MOCK]` log.
  `api/finance/generate-drafts.ts` returns a hardcoded array of fake invoices.
  `api/workflows.ts` is a mock state machine that fails at step 3 on purpose. The UI cannot
  tell. Do not add more of these.
- **No offers table.** An offer is a status string on a match. A real table lands on day 6.
- **Matching admits unvetted candidates.** `generateMatchesForRequest` lets `Applied` and
  `Review` through alongside `Vetted`.
- **86 `alert()` calls** standing in for error handling and confirmations.
- **No tests, no CI** as of day 1. Both arrive on day 8.

## Working rules

1. Read the existing code and explain what it does before proposing a change.
2. One prompt, one file, one outcome. Narrow asks produce reviewable diffs.
3. Show only changed lines. Never output a whole large file back.
4. Never use a wildcard in a destructive command. List paths explicitly.
5. Never run or suggest anything that deletes rows or drops tables. Propose it, let a human
   run it, after a backup.
6. For scoring, matching and status transitions: write the test first.
7. After any change touching auth, access control or data visibility, explain how the new
   code could be abused.
8. If a change would take more than one file, say so and propose the order before starting.

## Not yours to edit

- `packages/contracts` legal templates — the lawyer's text, not ours. Both currently
  reference Remotan OS and are being replaced.
- Any migration against live data — propose, do not run.
- `pnpm-lock.yaml` — let pnpm manage it.

## Current sprint position

Update this line at the close of each day, and see `PROGRESS.md` for detail.

**Day 1, 19 October.** Repo cleanup, environment setup, this file.
