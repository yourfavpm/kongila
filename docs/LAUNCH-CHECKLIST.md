# Kongila — build review and launch checklist

First written 23 October 2026. **Revised 28 October** after a full workflow-by-workflow trace
of the code on `staging`. The detailed findings behind this checklist are in
`docs/WORKFLOW-AUDIT.md`; this document is the list of what to do.

Scope: **Kongila only**. Remotan is excluded. Anything in `apps/remotan-web`, the workflow
engine or the Remotan payroll surfaces stays untouched.

> **Status note — 4 November 2026:** This workflow audit reflects the code as reviewed on
> 28 October and is historical, not the current implementation tracker. For changes since
> then, use [the production-readiness checklist](./PRODUCTION-READINESS-CHECKLIST.md) and
> [the progress log](../PROGRESS.md); older findings below need re-verification before action.

---

## What changed in this revision

The 23 October review looked at structure. This one traced each workflow end to end. Three
things need correcting, and several new blockers emerged.

**Corrections to the 23 October version:**

1. **The `offers` table exists.** It is at `supabase_migration.sql:404-442`, fully designed
   with match linkage, payment model, response deadline and seven constraints. No code touches
   it — a grep for `from('offers')` returns nothing. The behaviour described before was right;
   the cause was wrong. This is good news: the hard design work is done.
2. **`service_requests` is not a dead end nobody reads.** It is read on every `/api/db` call
   and written on every save. But that write always fails on four missing columns, a missing
   NOT NULL field and two CHECK violations, so the table is permanently empty and everything
   routed through it is lost silently.
3. **Six of the seven "missing" tables are now in the migration file.** `CLAUDE.md:85` is
   stale on that point. The seventh, `message_attachments`, is a storage bucket that the two
   apps spell differently.

**New blockers found that were not in the 23 October list:**

- Interview times are stored as naive wall-clock text with no timezone. A New York client
  booking 15:00 shows a Lagos candidate 15:00 when the real time is 21:00 theirs.
- The client's "Request Interview" button saves nothing and reports success, and its only
  four date slots are hardcoded to July 2026.
- The talent contracts tab runs entirely on three hardcoded fake contracts.
- `writeDbAsync` has no branch for invoices, payments or payouts, so no finance action
  persists at all.
- Around twenty column and CHECK mismatches between code and schema, each of which fails a
  whole batch of rows. Support tickets and in-app messaging cannot be created from any portal.
- Every notification insert in the codebase includes a `title` column the table does not have.
  Zero notifications reach the database, on top of zero emails being sent.
- `readDbAsync` fabricates client health scores, monthly revenue and request urgency at random.
- One vetting-stage advance resets every user's `password_hash` and forces every talent to
  active.
- The two legal templates name two different companies.

---

## 1. Where the build stands

### Genuinely working

- Monorepo, three apps, one Supabase project. Clean install across 14 workspace projects.
- Supabase auth for signup and login on all three portals. Admin auto-provisioning is removed
  from `AdminLogin.tsx` (though it still exists in the admin portal body — see Block B).
- The talent onboarding wizard: per-step validation, draft save and restore, and a final
  submit that writes only real columns and fails loudly.
- The client Smart Intake Form writes a real `talent_requests` row that the admin queue reads,
  keyed consistently on `payload->>id`.
- The 7-stage vetting pipeline, matching the scope in name and order, with a stage decision
  handler that forces rejection reasons and writes audit entries.
- The admin shortlist page (`matching/[requestId].tsx`) — the best-built screen in the repo.
  Correct eligibility filter, conflict check, justification and override requirements.
- Schema in version control, plus seed and backup scripts, so the test environment is
  reproducible.

### Built as a shell

Screens a user can click through with a backend that does not do the thing: notifications,
invoicing, payroll, offers, contracts, e-signature, the workflow engine, in-app messaging,
support tickets, talent contract history.

### The pattern underneath

Almost every failure in this codebase is silent. Browser writes do not read the returned
error; server writes go through `writeDbAsync`, which logs to console and returns nothing, so
the route returns 200 regardless (`packages/database/index.ts:1162`). Users see "Interview
request sent", "Job Offer Extended successfully", "Document uploaded and verified" for
operations that saved nothing. **Fixing the silence is a prerequisite for fixing anything
else** — otherwise every repair is unverifiable.

---

## 2. The date

Six days remain to 3 November. The hire path does not complete end to end, finance persists
nothing, payroll is not started, no email can be sent, the legal templates are placeholders,
and timezone handling is absent from a product whose premise is cross-border hiring.

**3 November is not achievable.** Attempting it means putting a real client and a real
candidate into a flow that loses their data without telling them, which costs more than the
delay. The realistic target, with the sequence in section 4 and the client inputs arriving
this week, is **a controlled launch in the first half of December** with a genuine end-to-end
rehearsal before it.

That conversation with Mr. Dare should happen this week, not in the last few days, and it is
easier with this document in hand: the work is well understood and much of the hard design
(the offers table, the matching engine, the shortlist screen, the stage model) is already
done.

---

## 3. The pending checklist

Ordered so each block unblocks the next. P0 means launch cannot happen without it.

### Block A — Chase today

- [ ] **P0** Email provider account, sending domain and DNS access. Domain verification takes
      24 to 48 hours and the entire notification layer waits on it.
- [ ] **P0** Final legal templates: NDA, talent agreement, data protection addendum, IT policy,
      master services agreement. Also settle **which legal entity** is the contracting party —
      the two existing templates name "KONGILA EOR SYSTEMS LTD" and "KONGILA TALENT DEPLOYMENT
      LLC", and the product describes itself as both an Employer of Record and an independent
      contractor intermediary in different places.
- [ ] **P0** E-signature provider decision and account.
- [ ] **P0** Domain and hosting for the marketing site, and confirm the app domain
      (`app.kongila.io` is still marked unconfirmed in `.env.example`).
- [ ] **P0** Confirm in writing: contracts and invoices generated on the platform, payment
      collected off-platform, payroll calculated and exported, no money moves through Kongila
      at launch.
- [ ] Personality test and remote readiness providers. Not a launch blocker, but the choice
      determines later integration.

### Block B — Security and the data substrate (first, and in this order)

- [ ] **P0** Rotate the service role key. It is written out in full in `.env.example`, which is
      a committed file. Replace both keys there with placeholders. Ask the dev team whether it
      has been shared in Slack, WhatsApp, a shared doc or an AI session.
- [ ] **P0** Authenticate `/api/db`. It currently returns the entire database — every email,
      date of birth, national ID, passport number, phone number and CV URL — to any caller,
      and accepts a POST that upserts sixteen tables including `users.role`. That is an
      unauthenticated path to super admin.
- [ ] **P0** Authenticate `api/vetting/advance.ts` and `api/vetting/sla-check.ts` and add
      ownership and stage-ordering checks. Today anyone with a talent id can POST
      `SUBMIT_STAGE_6` and walk a candidate from stage 0 to Final Review.
- [ ] **P0** Authenticate the five admin API routes (`contracts`, `compliance`, `interviews`,
      `support`, `assessments`). None of them check anything.
- [ ] **P0** Remove the browser-side admin auto-provisioning still in
      `admin-panel/pages/index.tsx:451-465` and `:489-504`.
- [ ] **P0** Replace the invite query parameters with a signed, expiring token.
      `api/company/invite.ts` has no auth, no persistence, sends no email, and returns a link
      carrying `orgId` and `permissionLevel` that signup trusts verbatim.
- [ ] **P0** Move the documents bucket to private with time-limited signed URLs.
- [ ] **P0** Replace `readDbAsync`/`writeDbAsync` in `advance.ts` and `sla-check.ts` with
      targeted updates, then delete both. A single stage advance currently rewrites every
      user's `password_hash` to `'auth_managed'`, forces every talent to active, and sets every
      interview's `client_id` to `'system'`.
- [ ] **P0** Make writes loud. Every `supabase.from(...)` call that does not read its error
      becomes a visible failure. Remove the success toasts that fire before the write is
      confirmed. Until this is done, no fix below can be verified.
- [ ] **P0** Move the ~55 browser write calls to server-side API routes. Split by portal,
      starting with anything that writes to matches, contracts or documents.
- [ ] **P0** Enable RLS on every table and verify cross-account isolation. The two existing
      migrations cover nine tables; talent_profiles, documents, messages, conversations,
      notifications, support_tickets, contracts, invoices, payments, payouts and service_requests
      have no policy. Note that the first migration, if applied, revokes general update on
      `users` and would break signup — test that path specifically.
- [ ] Write the data protection note: where candidate data lives, who can see it, how long it
      is held, what happens on a deletion request.

### Block C — Reconcile schema and code (nothing else works until this is done)

- [ ] **P0** Dump the live schema and diff it against `supabase_migration.sql`. Settle which is
      true. Every item below depends on the answer.
- [ ] **P0** Fix the notifications mismatch. Every insert in the codebase writes `title`; the
      table has `message` and no `title`. Nine inserts also write `content` and `read_status`
      instead of `message` and `read`. Three write `user_id` values that violate the foreign
      key (`'admin_team'`, `''`, `'usr_horizon'`).
- [ ] **P0** Fix the `matches` status values. The constraint allows `proposed`, `shortlisted`,
      `rejected`, `accepted`; the code writes `interview_scheduled`, `offer_extended`,
      `rejected_by_client` and a lowercased `offer accepted`.
- [ ] **P0** Fix the `documents` mismatch: about fifteen non-existent columns, type `'cv'`
      against a constraint expecting `'CV'`, and statuses `superseded` and `deleted` that are
      not allowed.
- [ ] **P0** Fix `contracts`: `client_monthly_fee_usd`, `termination_reason`, `role_title`,
      `engagement_type` do not exist; statuses `signed` and `completed` are illegal; there is no
      `match_id` column, so a contract cannot be traced back to its match.
- [ ] **P0** Fix `support_tickets` so a ticket can be created at all: `client_id`,
      `linked_contract_id`, `assigned_to`, `description` do not exist, the code writes lowercase
      `'open'` against a constraint expecting `'Open'`, and every category both forms offer is
      illegal.
- [ ] **P0** Fix `client_profiles.permission_level` and `settings`. If the live schema matches
      the migration file, **client signup is currently throwing**. Verify this one first.
- [ ] **P0** Fix `talent_skill_assessments` — all five columns the submit path writes are wrong,
      so no assessment result is ever saved and candidates can retake assessments indefinitely.
- [ ] **P0** Fix `conversations` and `messages` so in-app messaging works: missing NOT NULL
      `type`, non-existent `client_id`/`admin_id`/`conversation_id`/`attachment_url`/`is_read`.
- [ ] **P0** Fix `interviews`: the client modal omits NOT NULL `client_id`.
- [ ] **P0** Decide the fate of `service_requests`. Either fix the four missing columns, the
      NOT NULL `title` and both CHECK constraints, or remove the table and the `writeDbAsync`
      branch entirely and route everything through `talent_requests`. The second is cleaner.
- [ ] Settle the `message_attachments` bucket name — the two apps spell it differently.
- [ ] Remove the random data generation in `readDbAsync`: fabricated client health scores,
      monthly revenue (`:371-372`) and request urgency marking 20% ASAP at random (`:613`).

### Block D — Make the hiring workflow tight

- [ ] **P0** Agree one canonical set of status values in `packages/shared-types` and enforce the
      transitions in `packages/workflows` server-side. `canTransitionRequest` is currently
      imported by no file. Note that `normalizeRequestStatus` maps any unrecognised string —
      including a typo — silently back to `'New Request'`, resetting a request to the start.
- [ ] **P0** Make the client's status tracker use those values. It currently keys on
      `"Matching"`, `"Interview"` and `"Completed"`, which the normaliser can never emit, so the
      stepper never moves past Reviewing. My Requests uses a third vocabulary, so its Hired tab
      is empty forever.
- [ ] **P0** Add the Onboarding column to the admin Kanban; requests moved there currently
      disappear from the board.
- [ ] **P0** Build the offer flow on the existing `offers` table. Draft, sent, viewed, accepted,
      declined, expired, with `talent_response_deadline` actually set, and a contract created on
      acceptance. The table and its constraints are already there.
- [ ] **P0** Give the candidate an accept and a decline button. There is none anywhere, for
      offers or for interviews.
- [ ] **P0** Replace `MOCK_CONTRACTS` in `TalentDashboard.tsx:2147`. Every candidate currently
      sees the same three fake contracts, including an active $8,000/month engagement.
- [ ] **P0** Fix `generateMatchesForRequest` to exclude `Applied` and `Review`
      (`matching-engine/index.ts:198`), and stop generating matches in the client's browser at
      intake.
- [ ] **P0** Fix the match id collision. `` `match_${id.split('_')[1]}_...` `` produces
      `match_<ts>_undefined` for every candidate because talent ids are UUIDs, so two matches
      collide and the whole batch upsert is rejected.
- [ ] **P0** Settle the composite grade weights. The code uses 30/30/20/10/10; the scope
      specifies 25/20/15/15/10/10/5 including communication and experience, neither of which has
      an input anywhere. Wire those two inputs or formally drop them from the scope — but do not
      switch to the scope weights while they read zero, or nobody can score above 80. Write the
      test first.
- [ ] **P0** Make stages 3, 4 and 5 produce a score. They currently pass with none, so 40% of
      the composite is structurally zero and a real candidate maxes out at 60, a reject.
- [ ] **P0** Stop the default 80 from entering as a real score
      (`admin-panel/pages/index.tsx:807`, `:2283`, `:2542`).
- [ ] **P0** Make Final Review check the grade before granting Vetted (`:758-761`), and stop a
      rejected stage from being walked past.
- [ ] **P0** Replace the random match score in `handleShortlistCandidate`
      (`Math.floor(Math.random()*15)+84`, `:1083`). Clients are shown invented numbers.
- [ ] Reconcile the two match-scoring implementations. The admin page reimplements the formula
      with substring skill matching, so "Java" matches "JavaScript", and overwrites the engine's
      score on submit.
- [ ] Make matches regenerate when a request or a candidate's grade changes, and remove rejected
      candidates from existing matches. Make `requiresReReview` actually block matching.
- [ ] Persist the fields the intake form drops — role title, seniority, team description,
      coverage, project name and deadline, urgency, criticality, notes. Outsource and Managed
      requests currently reach the admin with no role description at all.
- [ ] Fix the client's ability to edit a submitted request, and route replacement requests to
      the admin queue.
- [ ] Decide whether grade B is deployable. The scope says it is a trainable pool; the engine
      and the matching page both exclude it.

### Block E — Interviews and timezones

- [ ] **P0** Store interview times as `timestamptz` in UTC, with the scheduler's timezone
      recorded alongside. Today `date` and `time` are naive text and every portal prints the raw
      string labelled "Your Local Time".
- [ ] **P0** Render each interview in the viewer's own timezone on all three portals, and show
      the other party's time next to it.
- [ ] **P0** Make the timezone selector in `ScheduleInterviewModal` do something. It is set,
      rendered and never read.
- [ ] **P0** Fix the "Request Interview" flow: it omits NOT NULL `client_id`, never reads the
      error, and tells the client the interview was booked. Its only four slots are hardcoded to
      20-22 July 2026.
- [ ] **P0** Make the reschedule request a real record that reaches the admin queue and notifies
      both sides. Approving one currently creates a second interview and leaves the first
      `Scheduled` forever.
- [ ] **P0** One source of truth for an interview. There are currently three: the `interviews`
      row, the vetting pipeline stage record, and `requestedDate`/`requestedTime` on the match.
- [ ] **P0** Replace the fabricated Google Meet links with real ones, or remove the link and say
      the joining details will follow. The audit log currently records "Google Calendar event
      created" when none was.
- [ ] Fix the `Rescheduled` status being collapsed to `scheduled` on every save.
- [ ] Add a double-booking check. There is none.
- [ ] Add interview reminders and a calendar invitation.

### Block F — Notifications and messaging

- [ ] **P0** Wire the email provider and replace the console.log stubs in
      `packages/notifications` and `api/notifications.ts`.
- [ ] **P0** The fifteen journey emails: verification, password reset, team invitation, request
      received, candidates ready, interview scheduled, interview rescheduled, interview reminder,
      offer extended, offer accepted, offer declined, contract ready, contract signed, stage
      advanced, rejection. **Zero of these are sent today.**
- [ ] **P0** Make in-app notifications actually insert (Block C) and fire from the same events as
      the emails.
- [ ] **P0** Scope notifications to the user. Every talent currently sees every user's
      notifications.
- [ ] **P0** Give the admin portal a notification inbox. It never reads the table, so anything
      addressed to operations is invisible.
- [ ] **P0** Fix the unread counts. They are computed three different ways, and the message badge
      counts every message in the database as unread for every user.
- [ ] **P0** Build email verification and password reset. Neither exists; there is no account
      recovery path at all.
- [ ] Make support tickets work end to end (Block C unblocks creation).
- [ ] Make in-app messaging work between talent, client and admin. The admin has no messaging UI
      at all.

### Block G — Contracts, compliance and finance

- [ ] **P0** Load the final legal templates into `packages/contracts`, replacing the placeholder
      text. The current master agreement has a role, a rate and three bullet points of conduct —
      no IP assignment, termination, liability, data protection, tax, dispute resolution,
      governing law or signature block. Both templates reference Remotan.
- [ ] **P0** Remove the fifteen filler paragraphs reading "Standard terms and conditions ... go
      here... (Clause N)" from the talent signing page (`TalentDashboard.tsx:2284`).
- [ ] **P0** Real e-signature: both parties sign, stored with a content hash, real timestamp, IP
      and user agent, visible to both sides afterwards. The current trail is a hardcoded
      `'192.168.1.1'` and `'sha256-mock-' + Date.now()`, saved nowhere.
- [ ] **P0** Make the compliance gate a gate. It is currently a banner; nothing blocks matching,
      hiring or signing on unsigned documents, the check matches by document name, and the first
      talent to sign a universal template rewrites its `user_id` so it stops applying to everyone
      else.
- [ ] **P0** Fix contract status. `writeDbAsync` collapses everything that is not Signed,
      terminated or completed to `pending`, so an activated contract shows Pending after a
      refresh.
- [ ] **P0** Add invoices, payments and talent_payouts to `writeDbAsync`. There is no branch for
      any of them, so no finance action persists.
- [ ] **P0** Real invoice generation from active contracts, replacing the mock that returns
      Horizon Fintech $5,000 and Nexus Health $3,200 every time.
- [ ] **P0** Bill the four service lines differently: recurring monthly for Managed Workforce and
      Outsourcing, one-time placement fee for Placement, project fee for Project. Today every
      service is written as a monthly rate.
- [ ] **P0** Define the Kongila margin somewhere durable and apply it. `FeeConfig` is a type with
      no table and no handler, and no code anywhere multiplies a rate by a fee.
- [ ] **P0** Build the payroll run: iterate active managed and outsourced contracts for a period,
      compute gross from rate and hours, deduct commission, produce an approvable schedule and an
      export. The `payroll_entries` table exists and nothing reads or writes it. This is what the
      client specifically asked for and it is not started.
- [ ] **P0** Fix payout gross versus net — the commission fields have no columns so both show the
      same number — and remove the shipped test stub that fails one approval in five at random
      with "Invalid bank details routing number" (`FinanceManager.tsx:149`).
- [ ] **P0** Make the client and admin finance numbers agree. The client billing tab sums a field
      that does not exist and shows $0 while the admin shows a real figure.
- [ ] **P0** Store currency and the exchange rate used on every money record. The rate service
      silently substitutes a hardcoded 1600 NGN on any failure and caches it as fresh.
- [ ] Invoice numbers, line items, due dates from contract terms, automatic overdue marking, PDF
      generation and sending.
- [ ] Replace the mock workflow engine (`api/workflows.ts`), which is hardcoded to fail at step 3
      with a fabricated WhatsApp timeout, or remove it from the UI.
- [ ] Document versioning and expiry on certifications.

### Block H — Admin completeness

- [ ] **P0** User and sub-admin management. No surface exists. The `finance` role cannot even be
      created — it is not in `users_role_check`.
- [ ] **P0** Enforce the five roles. All seven accepted role strings currently get the same
      thirteen tabs with no checks, and `getDatabaseSafeAdminRole` overwrites a user's role when
      they are assigned as an account or talent manager.
- [ ] **P0** Server-side append-only audit logging with a real actor. It is currently written
      from the browser in five places, upserted by id from client-supplied arrays so rows can be
      overwritten, attributed to the hardcoded string `'Admin Operator'`, with ids that collide
      within the same millisecond.
- [ ] System settings and platform configuration.
- [ ] Analytics from real data: active clients, active talent, revenue, utilisation, conversion.
      Active Contracts currently reads zero for real data because of the status mapping.
- [ ] Score entry screens for the two externally administered assessments.
- [ ] A view for work simulation submissions. They are stored and nothing reads them.

### Block I — Prove it works

- [ ] **P0** One person runs a complete hire on the test environment: client signs up, submits a
      request, admin matches, candidate goes through all seven stages with real scores, interview
      scheduled across two timezones, offer sent and accepted, contract signed by both parties,
      invoice generated, payroll run — and receives every email a real user would.
- [ ] **P0** Automated end-to-end tests for the three journeys.
- [ ] **P0** Verify matching and grading against worked examples by hand.
- [ ] **P0** Security review: cross-account access, document access, invitation handling,
      administrator provisioning, audit integrity, and the unauthenticated API routes.
- [ ] **P0** Remove every remaining mock and random value before launch. Known: `MOCK_CONTRACTS`,
      `mockReviews` and the fake personality snapshot on the talent scores page, the fabricated
      health scores and urgency in `readDbAsync`, the random shortlist score, the random payout
      failure, the mock invoice generator, the mock workflow engine, the fake document upload
      modal, the placeholder welcome video.
- [ ] Replace the 86 `alert()` calls with real error handling, at least on the hiring path.
- [ ] Load test the admin queues. Both portals currently poll the entire database every four to
      five seconds per open tab.

### Block J — Ship

- [ ] **P0** Build the production Supabase project from version control.
- [ ] **P0** Monitoring and error alerting.
- [ ] **P0** Final backup and a rollback plan.
- [ ] **P0** Administrator runbook.
- [ ] Marketing site live three days ahead of the platform.
- [ ] Open to one or two real clients and a controlled candidate cohort, watched through the day.

### Deliberately out of scope at launch — confirm in writing

- Payment gateway, talent payouts to bank, wallet. Invoices generated, payment collected
  off-platform.
- Personality and remote readiness tests on an external tool, scores entered by the talent
  manager.
- Two-way Google Calendar sync.
- LinkedIn and Google OAuth signup.
- WhatsApp notifications.
- Remotan, and Kongila-to-Remotan SSO and workspace provisioning.

---

## 4. Order of work

1. **Day 1.** Dump the live schema and diff it (Block C first item). Send Mr. Dare the Block A
   chase with the dates each item blocks, and the revised date conversation. Rotate the service
   role key.
2. **Days 1-3.** Block B. Authenticate the API routes, make writes loud, kill the full-database
   read-write. Nothing can be verified until failures are visible.
3. **Days 3-6.** Block C. Reconcile every column and constraint mismatch. This is mechanical
   work and it unblocks six separate features at once.
4. **Days 6-11.** Block D, then Block E. The hiring workflow and timezones.
5. **As soon as the email domain verifies.** Block F.
6. **As soon as the templates land.** Block G contracts, then invoicing and payroll.
7. **Then** Block H, and Block I in full before any date is confirmed.

Nothing new is built in the last four days of whatever schedule is agreed. That time is for
proving the product works, putting it in front of people who did not build it, and launching.

## 5. Keep `PROGRESS.md` current

One entry per day: what landed, what broke, what was decided, what is outstanding. The log
currently stops at day 1 while the repo has day 2 to day 4 work in it, which means the only
record of what is finished lives in someone's head.
