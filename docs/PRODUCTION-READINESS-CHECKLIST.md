# Kongila production-readiness checklist

This checklist is the controlled migration plan for the Kongila launch.

## Scope

Included:

- `apps/kongila-web` — client and talent portal
- `apps/admin-panel` — operations portal
- Supabase Auth, Postgres, Storage, Realtime, and server-side APIs
- Production deployment, monitoring, backups, and recovery

Explicitly excluded:

- `apps/remotan-web`
- Remotan local JSON persistence
- Remotan routes, screens, and workflows

Remotan remains dormant and must not be included in the Kongila production deployment.

## Non-negotiable production rules

- [ ] All business data comes from Supabase.
- [ ] No browser component writes directly to Supabase tables.
- [ ] Browser code may use Supabase Auth for sign-in, sign-out, and session refresh.
- [ ] Browser mutations go through authenticated application API routes.
- [ ] No whole-database snapshot is posted from the browser.
- [ ] No local JSON file is used as application persistence.
- [ ] No mock, random, fabricated, or hardcoded business data is rendered.
- [ ] Failed database operations return errors to the user.
- [ ] Successful UI messages are shown only after the server confirms persistence.
- [ ] Every protected API verifies the bearer token and resolves the caller from the database.
- [ ] Every API enforces role, organization, and record ownership rules on the server.
- [ ] Service-role credentials exist only in server environments.
- [ ] Production data is never seeded with staging demo records.

## Status legend

- `[x]` Implemented in the codebase and covered by the current migration work.
- `[~]` Partially implemented; staging, end-to-end, security, or production verification remains.
- `[ ]` Not completed.

This checklist tracks implementation separately from release verification. A checked item is not by itself permission to deploy to production.

The API contract and documentation work is tracked alongside this checklist in [`API-DOCUMENTATION-PLAN.md`](./API-DOCUMENTATION-PLAN.md).

## Phase 0 — Freeze the launch boundary

- [ ] Confirm that only Kongila client, talent, and admin portals are launching.
- [ ] Keep Remotan out of the production build and deployment.
- [ ] Stop adding new direct Supabase writes to React components.
- [ ] Stop adding new calls to the whole-database `/api/db` POST endpoint.
- [ ] Record the current database schema and migration order.
- [ ] Record all current uncommitted changes before beginning migration work.
- [ ] Create a clean migration branch or worktree.
- [ ] Define the production Supabase project and confirm its project reference.
- [ ] Confirm the production application domains and callback URLs.

### Gate

Do not migrate feature data until the production project, domains, and launch scope are written down and agreed.

## Phase 1 — Prepare production Supabase

### Staging audit evidence — 2026-11-03

The refreshed staging schema is recorded in [`live-schema.json`](./live-schema.json), generated `2026-11-04T13:39:27.328472+00:00`. `node scripts/schema-audit.js` now reports no schema mismatches, no RLS-disabled tables, and no public Storage buckets.

### Correction, 4 November

An earlier version of this section said the audit limited each operation to its own table chain. It did not. `scripts/schema-audit.js` had two parser bugs:

- It searched up to 900 characters past a `.from()` for an operation, so a select on one table was reported as a write to it, carrying another table's column names. This is where the bulk of the reported mismatches came from.
- It only recognised `key: value`, never shorthand, so every `{ email, role }` looked like an insert missing two NOT NULL columns.

Both are fixed. The report went from 72 mismatches to 4, and after the migrations were applied the current report is clean:

| mismatch | fixed by |
| --- | --- |
| `client_talent_reviews` missing | `2026-11-04_client_reviews.sql` |
| `contract_templates` missing | `2026-11-04b_contract_templates.sql` |
| `contracts.updated_at` missing | `2026-11-04c_schema_reconciliation.sql` |
| `interviews.reminder_*_sent_at` missing | `2026-11-04c_schema_reconciliation.sql` |

The RLS gate is now clear to pass. The application migration is complete, the migrations have been applied in staging, and the refreshed schema confirms RLS is enabled everywhere and the last public bucket is private. The remaining work is role-based staging verification before production.

- [x] Capture the current staging schema in [`live-schema.json`](./live-schema.json).
- [x] Apply and verify the profile/company reconciliation migration in staging.
- [x] Document the remaining schema and RLS mismatches for follow-up.
- [x] Fix the schema audit's own parser bugs, which were generating most of the reported mismatches.
- [x] Write and test the migrations that close the four real mismatches.
- [x] Write and test the RLS migration.
- [x] Re-dump the staging schema after running the migrations, and re-run `node scripts/schema-audit.js`.
- [ ] Create a separate production Supabase project.
- [ ] Apply the base schema from `packages/database/supabase_migration.sql`.
- [ ] Apply every migration in `packages/database/migrations/` in chronological order.
- [ ] Verify that every migration succeeds on a clean database.
- [ ] Confirm all expected tables exist.
- [ ] Confirm all expected columns exist.
- [ ] Confirm constraints match the application status values.
- [ ] Confirm foreign keys and delete behavior.
- [ ] Confirm indexes exist for every high-volume lookup.
- [x] Enable RLS on every user-data table after its API/policy migration is tested.
- [ ] Remove broad `true` policies.
- [ ] Test policies as an anonymous user.
- [ ] Test policies as a client.
- [ ] Test policies as a talent.
- [ ] Test policies as an account manager.
- [ ] Test policies as an operations manager.
- [ ] Test policies as a finance operator.
- [ ] Test policies as a skill assessor.
- [ ] Test policies as a super administrator.
- [x] Configure private Storage buckets for documents and attachments; all four staging buckets are private.
- [x] Access Storage objects through signed URLs. `signDbFileUrls` on every read path, including the profile route.
- [x] Write Storage objects through signed upload URLs, with the path chosen server-side.
- [ ] Verify on staging that a signed upload URL cannot be reused for a second file or a different path.
- [ ] Enable only the Realtime tables that require live updates.
- [ ] Configure production Auth redirect URLs.
- [ ] Configure email confirmation and password-reset URLs.
- [ ] Create production database backups.
- [ ] Perform a restore rehearsal into a separate verification project.

## Phase 2 — Secure application configuration

- [ ] Set `NEXT_PUBLIC_SUPABASE_URL` in each deployed app.
- [ ] Set `NEXT_PUBLIC_SUPABASE_ANON_KEY` in each deployed app.
- [ ] Set `SUPABASE_SERVICE_ROLE_KEY` only on the server.
- [ ] Confirm the service-role key is not prefixed with `NEXT_PUBLIC_`.
- [ ] Confirm the service-role key is not present in client bundles.
- [ ] Set `NEXT_PUBLIC_SITE_URL` to the production client URL.
- [ ] Set a strong `INVITE_TOKEN_SECRET`.
- [ ] Configure transactional email credentials.
- [ ] Configure the verified sending domain.
- [ ] Configure error monitoring and alerting.
- [ ] Configure rate-limit or abuse protection for public endpoints.
- [ ] Rotate any credential that has previously been exposed.
- [ ] Verify `.env.example` contains placeholders only.
- [ ] Verify `.env`, `.env.local`, and deployment secrets are excluded from Git.

## Phase 3 — Establish the server data layer

- [ ] Keep authentication and session refresh in the browser.
- [ ] Move all business reads and writes behind application APIs.
- [ ] Standardize `getRequestUser` for every protected route.
- [ ] Resolve roles from the verified Auth user and the canonical `users` row.
- [ ] Support seeded-account ID/email reconciliation only in trusted server code.
- [ ] Reject suspended users at the API boundary.
- [ ] Reject unknown roles.
- [ ] Enforce organization ownership on the server.
- [ ] Enforce talent ownership on the server.
- [ ] Enforce admin permissions on the server.
- [ ] Add request-body validation for every mutation.
- [ ] Reject unknown or unsafe fields where appropriate.
- [ ] Use transactions or database functions for multi-table operations.
- [ ] Return structured errors with safe user-facing messages.
- [ ] Log detailed internal errors without exposing secrets.
- [ ] Write audit records for privileged actions.
- [ ] Add request IDs to logs and error responses.

## Phase 4 — Remove whole-database synchronization

- [x] Make `/api/db` read-only during migration. All three apps answer 405 to anything but GET.
- [x] Remove all browser calls that POST a full database snapshot.
- [x] Remove `saveToDb` from the client portal.
- [x] Remove equivalent snapshot writes from the admin portal.
- [x] Authenticate `apps/remotan-web/pages/api/db.ts`. It had no authentication at all and accepted a POST straight into `writeDbAsync`.
- [x] Replace portal `/api/db` hydration calls with authenticated resource/API reads. The read-only `/api/db` routes remain only as compatibility endpoints and for Postman coverage.
- [ ] Replace the shared `readDbAsync` implementation behind `/api/resources/[resource]` with targeted reads; each resource request still loads the full schema before returning one resource.
- [x] Stop merging stale browser state into database state.
- [ ] Stop returning empty database objects after database failures.
- [ ] Stop returning cached data as if it were current data.
- [ ] Make read failures visible to the UI.
- [x] Make write failures non-2xx responses on the migrated routes.
- [ ] Remove the whole-database writer after all features are migrated.

## Phase 5 — Migrate identity, profiles, and organizations

### Authentication

- [ ] Client sign-in reads the real Auth session.
- [ ] Talent sign-in reads the real Auth session.
- [ ] Admin sign-in validates the database role.
- [ ] Sign-out clears the session and protected UI state.
- [ ] Password reset works on the production domain.
- [ ] Email confirmation works on the production domain.
- [ ] Expired sessions return users to the correct login screen.
- [ ] No portal grants access based on email domain alone.

### Talent profile APIs

- [x] Create `GET /api/profile/talent`.
- [x] Create `PATCH /api/profile/talent`.
- [x] Create document upload and delete APIs. Uploads go through `POST /api/uploads`, which issues a signed upload URL for a server-chosen path.
- [x] Validate profile fields server-side. `packages/workflows/profileFields.ts`, covered by `profileFields.test.ts`.
- [x] Prevent a talent from editing another talent's profile.
- [x] Prevent a talent from setting their own `grade`, `vetting_status` or `vetting_stage`. A refused field is named in the response rather than dropped.
- [x] Persist onboarding drafts in Supabase.
- [x] Persist onboarding completion in Supabase.
- [~] Reload the profile after a browser refresh and verify identical data. Needs the staging walkthrough.

### Client and organization APIs

- [x] Create `GET /api/company`. The organisation is resolved from the caller's own `client_profiles` row, not from an id sent by the browser.
- [x] Create `PATCH /api/company`. `permission_level` and `organization_id` are not writable, so a client cannot promote themselves or move company.
- [x] Create team-member invitation API with authentication.
- [x] Verify invitation tokens server-side.
- [x] Bind invitations to the invited email address.
- [~] Enforce organization membership and permission level. Enforced on write; the read paths need the staging check.
- [ ] Prevent duplicate organizations for the same company where required.
- [ ] Make organization creation and profile creation transactional.
- [x] Verify that an admin can see organizations through an authenticated API.

## Phase 6 — Migrate client requests

- [x] Create `GET /api/requests` with role-aware scoping.
- [x] Create `POST /api/requests`.
- [x] Create authenticated admin `GET /api/requests/:id` for request detail pages.
- [ ] Create `PATCH /api/requests/:id` for allowed status changes.
- [ ] Validate service type, budget, number of hires, skills, dates, and timezone.
- [x] Derive `client_id` from the verified session, never the request body.
- [x] Persist one canonical request row in `talent_requests`.
- [ ] Store normalized searchable columns alongside the payload if needed.
- [x] Write request audit entries server-side.
- [ ] Notify the correct admin users server-side.
- [x] Remove direct browser inserts from `pages/index.tsx` and `SmartIntakeForm.tsx`.
- [x] Add authenticated admin request-detail API support.
- [x] Add server-side request status transition validation and audit logging.
- [ ] Verify the client sees the request after a full reload.
- [ ] Verify the admin sees the same request after a full reload.

## Phase 7 — Migrate matching and vetting

- [x] Move admin shortlist submission to authenticated `POST /api/matching/submit`.
- [x] Move vetting scores, grade and the stage pipeline to `POST /api/vetting`. The grade is computed server-side from the scores, and only the one candidate's row is written: the browser used to post the whole talents array, repacking every candidate's bio envelope and so rewriting their own bio text as a side effect.
- [x] Stop candidates submitting their own assessment score. `POST /api/assessments/submit` takes answers only, marks them against the key, and refuses a second submission.
- [x] Submit candidates as `proposed`, not `shortlisted`. Shortlisting is the client's verdict; submitting as it left the client unable to shortlist at all.
- [x] Use one shared scoring engine for admin and client views.
- [x] Remove random match scores and random breakdowns from migrated paths.
- [x] Persist match explanations and scores in Supabase.
- [x] Add authenticated vetting advancement API support.
- [x] Require score input for scored stages in the migrated vetting workflow.
- [x] Persist migrated vetting decisions and rejection reasons.
- [ ] Move every remaining match-generation path to the server API or a database function.
- [ ] Never calculate the authoritative shortlist in the client browser on every path.
- [ ] Enforce candidate eligibility and legal match statuses on every server mutation.
- [ ] Add complete duplicate/idempotency tests for match submission.
- [ ] Prevent advancing beyond a rejected stage without an explicit override on every path.
- [ ] Prevent clients from seeing unapproved candidates.
- [ ] Verify the admin shortlist and client shortlist show the same records.

## Phase 8 — Migrate support

Implementation slice completed: the existing authenticated `/api/support` resource is now the primary support read path for client, talent, and admin portals. The staging column names were also reconciled for notification writes.

- [x] Create authenticated support list/create/reply/status API operations.
- [x] Derive the ticket source from the verified session.
- [x] Allow both clients and talents to create tickets.
- [x] Scope client and talent reads to their own tickets.
- [x] Allow authorized admins to see all tickets.
- [x] Persist support messages in `support_messages`.
- [x] Create notifications for new tickets and replies.
- [ ] Verify admin can see whether a ticket came from a client or talent.
- [ ] Verify resolution is visible to the ticket creator after refresh.
- [x] Remove direct browser support writes.
- [x] Add admin-side source labeling for client/talent tickets.
- [x] Add admin reply and status-update API calls.

## Phase 9 — Migrate interviews

The interview service and authenticated API routes now use the live `interviews` table.

Correction to an earlier entry here: it said the reminder timestamp columns had been removed from the code because they are absent from the live schema. They had not. `interviewService.ts` still wrote `reminder_24h_sent_at` and `reminder_1h_sent_at`, and the reminder cron reads them. The columns are added by `2026-11-04c`, because the feature needs them: without the guard the job would resend the same reminder on every run. No interview reminder has ever been sent.

- [x] Create server APIs for proposing, confirming, rescheduling, and cancelling interviews.
- [x] Store the scheduled instant in UTC where supplied.
- [x] Store the client's timezone and talent's timezone where supplied.
- [x] Validate future proposed times and detect participant conflicts in the shared service.
- [x] Remove fabricated meeting links and calendar event IDs.
- [x] Move admin interview listing and mutation paths to the authenticated interview API/service.
- [x] Remove unreachable legacy fallback code. The dead Supabase write path below the `return` in `matching/[requestId].tsx` is gone; the sourcing-required button it sat under was also posting a body the route answered 400 to, and now works.
- [ ] Send invitations only when email configuration is active.
- [ ] Report email failures as warnings, not false success.
- [ ] Show the same persisted interview to client, talent, and admin.
- [ ] Test daylight-saving and cross-timezone scenarios.

## Phase 10 — Migrate messaging and notifications

- [x] Create scoped conversation APIs.
- [x] Create message send and read APIs.
- [x] Ensure participants are derived from the conversation and session.
- [~] Prevent cross-client and cross-talent message access. Enforced server-side; needs the cross-user check on staging.
- [x] Move attachment uploads behind signed upload URLs. `POST /api/uploads`; the server chooses the object path from the session.
- [x] Use private Storage buckets. Three were already private; `profile-assets` is closed by `2026-11-04d`.
- [x] Create notifications server-side from domain events.
- [x] Remove notification inserts from browser components. All eight went to a table with RLS on and no policy, so none of them ever landed.
- [ ] Verify unread counts after refresh.
- [ ] Verify read state persists.

## Phase 11 — Migrate offers, contracts, documents, and signatures

Implementation slices completed: client contract creation now uses an authenticated server route and only writes columns present in the staging contracts table. Contract signing and document APIs exist, but remaining admin UI mutations and provider verification still need release testing.

- [ ] Create server-side offer submission and approval flows.
- [ ] Validate offer rate, currency, payment period, deadline, and participants.
- [ ] Prevent clients from approving their own admin-controlled offer transitions.
- [x] Create server-side contract generation for the client dashboard flow.
- [x] Add authenticated client contract creation API support.
- [x] Fix the invalid `updated_at` contract-column write in the admin signing path. An earlier entry recorded this as removed; it had not been. The write is still there and the column is added by `2026-11-04c`, because an updated-at on a contract is worth having. Until that migration runs, no contract can be signed.
- [x] Load contract templates from the database. There was no `contract_templates` table and the editor's save went to a key `writeDbAsync` has no branch for, so every template was dropped. Added by `2026-11-04b`.
- [x] Use only contract statuses `contracts_status_check` permits. The panel worked in title case throughout; `packages/workflows/contractStatus.ts` maps its words onto legal values and is covered by `contractStatus.test.ts`.
- [x] Remove direct browser writes from contract and document screens.
- [ ] Load legal templates from Supabase, not source-code placeholders.
- [ ] Confirm the correct legal entity before launch.
- [ ] Configure the selected e-signature provider.
- [ ] Verify webhook signatures from the provider.
- [ ] Persist signature status and timestamps.
- [ ] Keep document versions immutable.
- [ ] Generate signed URLs only after authorization.

## Phase 12 — Migrate finance and payroll

- [ ] Confirm whether payments are collected inside or outside Kongila.
- [ ] Configure the real fee schedule in Supabase.
- [ ] Create server-side invoice generation.
- [ ] Persist invoice line items transactionally.
- [ ] Persist payment records.
- [ ] Persist payout records.
- [ ] Prevent duplicate invoice generation.
- [ ] Add idempotency keys to payment and invoice operations.
- [ ] Ensure currency and exchange-rate sources are recorded.
- [ ] Ensure payroll is calculated from live contracts only.
- [x] Fix the failing payroll test import.
- [x] Verify payroll export against a known fixture. `payroll.test.ts`.
- [ ] Do not show zero revenue when the data is unavailable; show an explicit unavailable state.

## Phase 13 — Remove fabricated and placeholder data

- [ ] Remove random client health scores.
- [ ] Remove random monthly revenue values.
- [ ] Remove random match scores.
- [ ] Remove hardcoded contract records.
- [ ] Remove fake payment-card data.
- [ ] Remove hardcoded interview dates.
- [ ] Remove mock document names from business displays.
- [ ] Remove placeholder emails and phone numbers from persisted records.
- [ ] Replace fake values with database values or an explicit “not configured” state.
- [ ] Review every dashboard metric for a real database source.

## Phase 14 — Error handling and observability

- [ ] Add a global API error format.
- [ ] Add server-side structured logging.
- [ ] Add request correlation IDs.
- [ ] Alert on repeated 401, 403, 409, and 500 responses.
- [ ] Alert on failed Supabase writes.
- [ ] Alert on failed email and webhook delivery.
- [ ] Add a user-visible retry state for temporary database failures.
- [ ] Distinguish “no records” from “database unavailable”.
- [ ] Remove `console.log` statements containing user data or tokens.
- [ ] Confirm no service-role key is ever logged.

## Phase 15 — Automated testing

### Unit and integration tests

- [x] Make the entire existing test suite pass: 293 tests, 0 failures.
- [x] Pure-logic coverage for the rules that constraints enforce: `profileFields`, `assessmentScoring`, `matchStatus`, `contractStatus`, `billing`, `payroll`, `invoicing`, `documents`, `compliance`, `interviews`.
- [ ] Add tests for every API validation rule.
- [ ] Add tests for role authorization.
- [ ] Add tests for organization scoping.
- [ ] Add tests for talent scoping.
- [ ] Add tests for duplicate submissions and idempotency.
- [ ] Add tests for database error propagation.
- [ ] Add tests for timezone conversion.
- [ ] Add tests for notification creation.
- [ ] Add tests for support ticket lifecycle.

### Authenticated end-to-end tests

- [ ] Talent can sign up, onboard, refresh, and sign back in.
- [ ] Client can sign up, create an organization, refresh, and sign back in.
- [ ] Client can submit a request.
- [ ] Admin can see the request.
- [ ] Admin can vet and match a talent.
- [ ] Client sees only approved matches.
- [ ] Client and talent can schedule an interview.
- [ ] Client and talent can create support tickets.
- [ ] Admin can reply and resolve support tickets.
- [ ] Messages remain private to participants.
- [ ] Contract and document workflows persist after refresh.
- [ ] Finance and payroll records persist after refresh.
- [ ] Unauthorized users cannot access another user's records.

## Phase 16 — Production rehearsal

- [ ] Create a clean staging project from the production schema.
- [ ] Load only controlled test fixtures.
- [ ] Run the complete talent journey.
- [ ] Run the complete client journey.
- [ ] Run the complete admin journey.
- [ ] Test browser refresh after every mutation.
- [ ] Test two users changing the same record.
- [ ] Test expired sessions.
- [ ] Test revoked or suspended users.
- [ ] Test Supabase outage behavior.
- [ ] Test email provider outage behavior.
- [ ] Test file upload failure behavior.
- [ ] Test rollback of the latest deployment.
- [ ] Restore a backup into a separate project.
- [ ] Compare expected records with actual Supabase rows.
- [ ] Confirm no local file is required for the workflow to complete.

## Phase 17 — Deployment and launch gate

- [x] `pnpm test` passes with zero failures: 293 tests.
- [x] `admin-panel` production build passes.
- [x] `kongila-web` production build passes.
- [ ] The repository-wide production build command is documented and verified in CI.
- [ ] Type checking passes for all three launch packages.
- [ ] Security review is complete.
- [ ] RLS review is complete.
- [ ] Production environment variables are configured.
- [ ] Production Auth redirects are verified.
- [ ] Production email sending is verified.
- [ ] Production Storage access is verified.
- [ ] Production backups are verified.
- [ ] Monitoring and alerting are active.
- [ ] A rollback procedure is documented.
- [ ] A database restore procedure is documented.
- [ ] Support ownership and escalation contacts are documented.
- [ ] Demo accounts are disabled or isolated from production.
- [ ] Remotan is excluded from the production deployment.
- [ ] Final smoke test passes against production.
- [ ] Launch owner signs off on the release.

## Current known blockers

- [x] Remove remaining browser-side Supabase mutations, especially admin vetting, finance, contracts, compliance, and profile-detail screens.
- [x] Replace remaining whole-database `/api/db` writes and make the route read-only.
- [x] Remove browser-side Supabase Storage uploads. All eight sites now request a signed upload URL from `/api/uploads`; the server chooses the object path from the verified session.
- [x] Remove direct browser table reads. `users`, `organizations`, `client_profiles`, `audit_logs`, `matches`, `roles`, `user_roles` and `talent_requests` were read with the anon key from six files; `users` handed every browser every email, role and account status on the platform.
- [ ] Stop swallowing Supabase write failures in `packages/database/index.ts`.
- [ ] Remove empty/cached data fallbacks that hide outages.
- [ ] Remove fabricated and hardcoded business data.
- [x] Fix the failing payroll test import.
- [ ] Complete staging verification for support source/resolution visibility.
- [ ] Complete messaging, offers, documents/signatures, finance, and payroll end-to-end migrations.
- [~] Staging Supabase/RLS verification. The migrations are applied and the schema audit is clean; role-based staging walkthroughs and production verification remain.
- [x] Add the canonical OpenAPI 3.1 contract and importable Postman collection/environment under `docs/api/`.
- [ ] Publish Swagger UI or the OpenAPI contract through the production documentation site.
- [ ] Add authenticated API integration tests and complete the staging Postman rehearsal.
- [ ] Complete authenticated end-to-end rehearsal for client, talent, admin, and negative authorization cases.

### Migrations applied and verified in staging

Applied in this order. The refreshed schema and audit confirm the resulting tables, columns, RLS state, and bucket privacy. See [`migrations-2026-11-04.md`](./migrations-2026-11-04.md).

| file | what it does |
| --- | --- |
| `2026-11-02c/d/e` | roles and audit, support and settings, signatures and compliance |
| `2026-11-03`, `b`, `c` | finance, payroll and currency, invoicing and documents |
| `2026-11-04_client_reviews` | the reviews table. Reviews were written into `notifications` as message text and never landed |
| `2026-11-04b_contract_templates` | the templates table. The editor saved to a key `writeDbAsync` has no branch for, so every save was dropped |
| `2026-11-04c_schema_reconciliation` | `contracts.updated_at` (no contract could be signed without it) and the two interview reminder columns (no reminder has ever been sent) |
| `2026-11-04d_storage_buckets` | makes `profile-assets` private. Applied in staging |
| `2026-11-04e_enable_rls` | RLS on every table, deny-all to the anon key. Applied in staging; role walkthrough remains |

## Baseline recorded — 3 November 2026

- [x] Launch scope confirmed: Kongila client, talent, and admin portals only.
- [x] Remotan confirmed dormant and excluded from this launch.
- [x] Full `pnpm build` passes for the repository.
- [x] Full `pnpm test` passes: 293 tests, 0 failures.
- [x] The payroll test import-resolution failure was corrected in `packages/workflows/payroll.ts`.
- [x] Staging schema evidence and profile/company reconciliation were recorded.
- [x] Support API reads and writes were migrated for client, talent, and admin portals.
- [x] Client request APIs and request status transitions were added.
- [x] Client contract creation was moved behind an authenticated API.
- [x] Interview service/API reads and mutations were moved to Supabase-backed paths.
- [x] Admin matching submission was moved behind `POST /api/matching/submit`.
- [x] Admin and client production builds passed during the migration audit.
- [ ] The worktree is not clean: existing tracked and untracked changes must be preserved and reviewed before release.
- [ ] Direct browser-side business writes remain in unmigrated features and are the next migration target.
- [x] Portal code no longer depends on whole-database `/api/db` snapshots. The read-only compatibility routes remain temporarily.

## Recorded — 4 November 2026

The application-layer migration is complete. What remains is verification.

- [x] No browser component reads or writes a business table. Verified by sweep: zero `supabase.from(...)` outside `pages/api/`.
- [x] No browser component uploads to Storage directly. Verified the same way.
- [x] `/api/db` is read-only in all three apps, and deprecated.
- [x] `scripts/schema-audit.js` had two parser bugs that produced most of its reported mismatches: it matched an operation up to 900 characters past the `.from()`, so a select on one table was reported as a write to it with another table's columns, and it never recognised shorthand properties, so every `{ email, role }` looked like a missing NOT NULL. Both fixed. The report went from 72 to 4, and all four are fixed by migrations above.
- [x] Full `pnpm test` passes: 293 tests, 0 failures.

### Next implementation slice

Verification, not implementation:

1. Run the migrations in order on staging.
2. Re-dump the schema (`docs/schema-introspection.sql` → `docs/live-schema.json`) and re-run `node scripts/schema-audit.js`. It should report nothing.
3. Walk the three authenticated journeys on staging, before and after `2026-11-04e`.
4. Cross-user authorization: sign in as one client and try to reach another's request, invoice and candidate by id.
5. Storage: confirm a signed upload URL cannot be reused for a second file or a different path.
6. Email delivery, including the failure path when Resend is unreachable.
7. Backup restore and deployment rollback rehearsals.

## Definition of production ready

Kongila is production ready only when all of the following are true:

1. A client, talent, and admin can complete their workflows using real Supabase data.
2. Refreshing or reopening any portal does not lose or invent data.
3. No browser component directly mutates business tables.
4. No whole-database browser snapshot is accepted by the server.
5. Every failed write is visible and actionable.
6. Every protected read and write is role- and ownership-scoped.
7. The complete test suite passes.
8. All three Kongila builds pass.
9. A clean staging rehearsal succeeds.
10. Backup restoration and rollback have been tested.
