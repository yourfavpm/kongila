# Kongila — workflow audit

A line-by-line trace of every hiring workflow against the code on `staging`, done 28 October
2026. Scope is Kongila only; Remotan is excluded throughout.

The question this answers is not "does the screen exist" but "if a real client and a real
candidate used this today, where does the hire stop". Every finding below cites a file and a
line. Paths are relative to the repo root.

A note on method. The schema of record here is `packages/database/supabase_migration.sql`,
which its own header says was rebuilt from the live project on 17 October. `CLAUDE.md` says
that file is not the live schema. Where a finding depends on which is true, it says so. The
live Supabase project was not queried.

---

## The headline

**No hire can complete end to end today.** The flow breaks in at least six independent
places, and almost every break is silent: the UI reports success, the database rejects the
write, and nobody finds out until someone asks why nothing happened.

The reason they are silent is one shared pattern. Writes are sent from the browser with the
error object never read, or they go through `writeDbAsync`, which logs every failure to the
console and returns nothing, so the API route returns 200 regardless
(`packages/database/index.ts:1162`). A user sees "Interview request sent", "Job Offer
Extended successfully", "Document uploaded and verified" for operations that saved nothing.

Underneath that sits a second problem: the code and the schema disagree in about twenty
places. Postgres rejects the whole request when one column is unknown, so a single wrong
field name kills an entire batch of rows.

---

## 1. Talent onboarding

**Works:** signup and login are real Supabase auth (`kongila-web/pages/index.tsx:835`,
`:957`). The six-step wizard validates per step, saves a draft into `talent_profiles.bio` as
a JSON envelope and restores it on return (`:1040-1052`, `:593-630`). The final submit writes
only columns that exist and throws visibly on failure (`:1415-1445`). This is the most honest
write in the whole codebase.

**Broken:**

- **No email verification at all.** `authView` has a `'verify'` state nothing renders
  (`:145`). Signup sets `emailVerified:false` then login and session restore hardcode it to
  `true` (`:613`, `:1010`). Worse, if Supabase's own "confirm email" setting is on, `signUp`
  returns no session, the `users` upsert at `:855` then runs as anonymous and fails, and the
  candidate is stranded: the auth account exists, so retrying says "already registered".
- **A failed profile write makes a candidate look vetted.** The placeholder `talent_profiles`
  upsert only logs on error (`:903`). If it fails, the first draft save inserts a row using
  table defaults, and those defaults are stage `Final Review`, status `Vetted`, grade `A`
  (`supabase_migration.sql:142-146`). That candidate is immediately eligible for matching
  without being assessed.
- **Entry Level with 0 years cannot finish.** 0 passes step 2 but
  `calculateTalentProfileCompletion` treats the number zero as empty
  (`shared-types/index.ts:222`), so the final button fails with a message naming a field and
  no indication which step to go back to.
- **Availability is never captured.** There is no input for it, so `availability_hours` is
  written as null. The profile editor then treats the same field as a percentage
  (`TalentDashboard.tsx:4133`) and writes a percentage into an hours column (`:2018`). The
  matching engine reads it as a 0-100 score (`matching-engine/index.ts:158`), so a candidate
  available 40 hours a week scores 40 out of 100 on availability.
- **Salary range collapses to one number.** Only the maximum is written; `salary_min` never
  is (`index.tsx:1425-1426`). Currency conversion fails open: if the rate fetch throws,
  `usdRate` stays 1 and a salary entered in naira is stored as that many dollars
  (`:1272-1283`).
- **Profile edits revert minutes later.** The photo is stored as a base64 data URL into an
  `avatar_url` column that is `varchar(255)` (`TalentDashboard.tsx:3563-3607` into
  `index.tsx:2028`). The upsert fails, only `console.error` runs, and the five-second poll
  reverts the photo and everything else saved in the same call. Education, languages,
  projects, certifications and emergency contact are written into the telemetry envelope but
  never mapped on read (`packages/database/index.ts:451-560`), so they survive until the next
  page load and then vanish for good.
- **Document uploads fail against the schema.** `api/documents.ts:104-132` writes `file_name`,
  `file_size_bytes`, `version_number`, `is_mandatory`, `is_hidden`, `template_id`,
  `signature_data` and more. None of these are columns (`supabase_migration.sql:566-581`). It
  writes type `'cv'` where the constraint allows `'CV'`, and statuses `superseded` and
  `deleted` which the constraint does not allow at all. There is also a fake upload modal
  that takes a typed filename, appends `.pdf` and announces "Document uploaded and verified!"
  with no file involved (`TalentDashboard.tsx:3795-3803`).
- **Compliance signatures are not saved.** `handleSign` appends a signed document to the
  telemetry envelope and calls back with a `signedByTalentIds` field that has no column and
  is not in the upsert payload (`TalentDashboard.tsx:3152-3167`, `index.tsx:4840-4863`). The
  signature disappears on the next poll and the candidate sees "Pending Signature" again. The
  admin's signature progress bar reads the same non-existent field
  (`ComplianceManager.tsx:108`), so the admin never sees a signature either. The drawn
  signature canvas is ignored, and an empty typed field still signs, as the string "Digital
  Signature".
- **Vetting stages can be self-completed.** `api/vetting/advance.ts` has no authentication and
  no ordering check — it verifies only that the action name matches the stage index
  (`:49-86`). Anyone with a talent id can POST `SUBMIT_STAGE_5` then `SUBMIT_STAGE_6` and
  reach Final Review from stage 0. The "Take Personality Test" button simply calls
  `COMPLETE_STAGE_4` (`TalentDashboard.tsx:6872`); there is no test behind it.
- **Every talent sees every user's notifications.** The notifications array is passed through
  unfiltered (`index.tsx:488`, `:4824`) and the panel applies no user filter
  (`TalentNotificationsPanel.tsx:20-35`).
- **The scores page shows fabricated data to everyone.** `mockReviews` falls back to a
  hardcoded 72/78/85 trend and a fake "Autonomous Executer" personality snapshot
  (`TalentDashboard.tsx:7014-7024`), shown to every candidate including brand new ones.
- **`GET /api/db` is unauthenticated and returns the entire database**, including dates of
  birth, national ID and passport numbers, phone numbers and CV URLs
  (`kongila-web/pages/api/db.ts:42-46`, `packages/database/index.ts:507-514`).

**Not built:** email verification, password reset (there is no recovery path at all),
certifications as real documents, a working welcome video (it is the w3schools Big Buck Bunny
placeholder, `index.tsx:1343`), and the post-signup progress tracker, which exists as dead
code that is never rendered (`TalentDashboard.tsx:5008`).

---

## 2. Client request intake

**Works:** the intake form writes a real row. It inserts into `talent_requests` with three
columns — `client_id`, `service_type` and a JSON `payload` (`SmartIntakeForm.tsx:216-220`) —
and the admin queue reads that table (`admin-panel/pages/index.tsx:320`) and keys every
update on `payload->>id`. That part is consistent and it works.

**One correction to the earlier checklist:** `service_requests` is not simply ignored. It is
read on every `/api/db` call and written on every `saveToDb` (`packages/database/index.ts:236`,
`:955-983`). But that write **always fails**, for three independent reasons: it sends four
columns that do not exist (`urgency`, `assigned_talent_manager_id`,
`assigned_account_manager_id`, `internal_notes`), it omits `title` which is NOT NULL, and it
violates both CHECK constraints by writing `'Hire Talent'` where the constraint allows
`'hire'` and `'Sourcing Talent'` where it allows `'new'`, `'reviewing'`, `'matching'`,
`'closed'` (`supabase_migration.sql:301-304`). The table is therefore permanently empty and
everything routed through it is lost.

**Broken:**

- **A third of the form is thrown away.** The payload is an explicit field list, not a spread
  of the form state (`SmartIntakeForm.tsx:187-214`). Dropped: `roleTitle`, `seniorityLevel`,
  `mustHaveQualifications`, `coverageType`, `teamDescription`, `supervisionLevel`,
  `reportingStructure`, `projectName`, `projectDeadline`, `estimatedScope`, `partTimeHours`,
  `durationMonths`, `urgencyLevel`, `roleCriticality`, `additionalNotes`.
- **Outsource and Managed requests arrive with no role description at all**, because
  `teamDescription` is not in the fallback chain (`:197`). The admin card then falls back to
  showing the service type as the title (`admin-panel/pages/index.tsx:1820`).
- **Priority and urgency are not wired.** `priority` has no input and is always `'Medium'`
  (`:205`); `urgencyLevel` is collected and dropped. The admin's Urgent filter and ASAP sort
  read `payload.urgency`, which intake never sets (`admin-panel/pages/index.tsx:1735-1739`).
  What the admin actually sees is random: `readDbAsync` fabricates urgency, marking 20% of
  requests ASAP at random (`packages/database/index.ts:613`), and fabricates client health
  scores and monthly revenue the same way (`:371-372`).
- **The client's status tracker never moves.** The canonical statuses are `New Request`,
  `Reviewing`, `Sourcing Talent`, `Candidates Ready`, `Client Interview`, `Offer Accepted`,
  `Onboarding`. The client timeline keys on `"Matching"`, `"Interview"` and `"Completed"`
  (`ClientDashboard.tsx:3375-3401`), which `normalizeRequestStatus` can never emit. The My
  Requests tabs use a third vocabulary — lowercase `new`, `candidates_ready`, `hired`
  (`MyRequestsPanel.tsx:105-107`) — so the Active tab shows only requests at `Reviewing` and
  the Hired tab is empty forever.
- **The admin Kanban has no Onboarding column** (`admin-panel/pages/index.tsx:1743`), so a
  request moved to the final stage disappears from the board.
- **`canTransitionRequest` is imported by nothing.** It is defined at
  `packages/workflows/index.ts:70` and no file in the repo calls it. Admins assign status
  directly from a dropdown (`requests/[id].tsx:222-297`), so any status can follow any other.
  And `normalizeRequestStatus` maps every unrecognised string — including a typo — silently
  back to `'New Request'` (`:22-37`), which resets a request to the start of the pipeline.
- **The client cannot edit a submitted request.** The edit writes `role_description` to
  `service_requests`, a column that does not exist on that table, keyed by the payload id
  which matches no row there (`MyRequestsPanel.tsx:145-150`).
- **Replacement requests never reach the admin.** `MyTeamPanel.submitReplacement` routes
  through `saveToDb` into the always-failing `service_requests` upsert (`:68-86`). It lives in
  React state until the next poll and then vanishes.
- **Team invites are an open door.** `api/company/invite.ts` has no authentication, no check
  that the caller belongs to the organisation, no persistence and no email — it console-logs
  a simulation and returns the link in the response (`:3-40`). The link carries `orgId` and
  `permissionLevel` as plain query parameters, and signup writes both straight from the URL
  into `client_profiles` (`index.tsx:866`, `:879-885`). Anyone with an organisation id can
  join it at Full Access. Permission levels are labels only; nothing reads them.
- **Client signup may be broken outright.** It writes `permission_level` and `settings` to
  `client_profiles`, and neither column is in the migration (`supabase_migration.sql:107-113`).
  If the live schema matches the file, every client signup throws "Client Profile DB Error"
  at `index.tsx:887`. This one needs checking against the live database today.
- **Every signup creates a new organisation** with a fresh UUID (`SmartIntakeForm.tsx:156`),
  so two colleagues from the same company become two separate orgs. There is no transaction
  across the four signup writes, so a partial failure orphans the request from any
  organisation and the admin cannot see it under any client.

---

## 3. Vetting, scoring and matching

**Works:** the seven stages match the scope in name and order
(`matching-engine/index.ts:28-69`). The admin stage handler forces a rejection reason, stores
it, writes an audit entry and maps the stage score into the right slot
(`admin-panel/pages/index.tsx:641-804`). Re-deciding an earlier stage does not wipe later
ones (`matching-engine/index.ts:112-118`). The admin shortlist page is the best-built screen
in the repo: it requires `Vetted` plus grade A or A+, blocks a talent already active on
another request, and demands a justification for a short list or an override reason for a
low-ranked pick (`matching/[requestId].tsx:231-390`).

**Broken:**

- **RESOLVED 2 Nov 2026 — the composite grade now follows an agreed model.** The scope
  specified seven dimensions: technical 25, work simulation 20, communication 15,
  behavioural 15, personality 10, remote readiness 10, experience 5. Two of them,
  communication and experience, had no vetting stage, no admin field and nothing writing
  them, so they were permanently zero. Scoring to the scope would have capped every
  candidate at 80 and put A+ out of reach for everyone.

  **Decision: communication and experience are dropped from the scoring model.** Neither is
  lost, only not scored twice. Communication is observed in the behavioural interview
  rubric, which already feeds the behavioural score. Years of experience is screened at
  Application Screening, which is pass or fail by design. The five remaining dimensions are
  renormalised to 100 — technical 30, behavioural 30, work simulation 20, personality 10,
  remote readiness 10 — each mapping one-to-one onto a stage that produces a score.

  The rule now lives in `packages/matching-engine/grading.ts`, which imports nothing and is
  covered by `grading.test.ts` (`pnpm test`, Node's built-in runner, no framework added).
  One test asserts that every weighted dimension has a stage behind it, so a dimension
  cannot be added back before its input is built. On the same decision the match score's
  past-performance term moved from work simulation 70 / experience 30 to work simulation 60
  / remote readiness 40, since experience was zero there too and capped that term at 70.
  Both fields stay on `TalentScores` as optional and deprecated, so profiles saved before
  the decision still read back.
- **RESOLVED 2 Nov 2026 — stages 3, 4 and 5 must now produce a score.** Personality, remote
  readiness and work simulation could all be passed with no score, and between them they
  are 40% of the composite, so a candidate who passed every stage reached 60 and graded as
  Reject. `advanceTalentStage` now refuses to pass any stage carrying a score key without
  one, `validateStageDecision` gives the reason, and the admin handler shows it rather than
  saving a scoreless pass. Stage 0 and stage 6 remain pass or fail.
- **80 leaks in as a real score.** The score input resets to 80
  (`admin-panel/pages/index.tsx:807`), and "Admin manually marked assessment as complete"
  (`:2283`) and "Mark Result Received" (`:2542`) submit that 80 as a genuine technical or
  personality score with no assessment behind it. An admin who deliberately types 80 gets the
  auto-score instead, because of the `stageScoreInput !== 80` test at `:2381`.
- **Final Review grants Vetted regardless of grade** (`:758-761`). A composite below 65 still
  becomes a Vetted candidate.
- **A rejected stage can be walked past.** After a Reject, the next stage stays pending and
  the UI advances to it, so an admin can push a rejected candidate to the end and Vetted at
  `:760`. There is no way to reopen the failed stage.
- **Grade B is unreachable in practice.** The scope defines B (65-74) as a trainable pool, but
  both the engine (`matching-engine/index.ts:198`) and the admin matching page
  (`matching/[requestId].tsx:234`) exclude it.
- **Matching admits unvetted candidates.** `generateMatchesForRequest` allows `Applied` and
  `Review` alongside `Vetted` and `Matched` (`matching-engine/index.ts:198`). Matches are
  generated in the **client's browser** at the moment of intake (`index.tsx:3209`), and the
  client's request screen lists every match regardless of status with candidate names
  (`ClientDashboard.tsx:3840-3862`).
- **Every match gets the same id.** `` `match_${request.id.split('_')[1]}_${talent.id.split('_')[1]}` ``
  (`matching-engine/index.ts:204`). Talent ids are auth UUIDs with no underscore, so the
  second half is always `undefined` and every match for a request becomes
  `match_<timestamp>_undefined`. Two eligible candidates produce duplicate primary keys in one
  batch, Postgres rejects the whole upsert with "cannot affect row a second time", and the
  error is swallowed (`packages/database/index.ts:1046`). Any admin match status change
  bundled into that same payload is lost with it.
- **Match status values are illegal.** The constraint allows `proposed`, `shortlisted`,
  `rejected`, `accepted` (`supabase_migration.sql:343`). The code writes
  `'interview_scheduled'` (`ClientDashboard.tsx:746`), `'offer_extended'` (`:4792`),
  `'rejected_by_client'` (`MatchedTalentPanel.tsx:113`) and lowercased `'offer accepted'`
  (`packages/database/index.ts:1041`). None persist.
- **Two scoring engines disagree.** The admin matching page reimplements the match formula
  with substring skill matching, so "Java" matches "JavaScript" (`matching/[requestId].tsx:245-300`),
  and a different 10% term. Submitting a shortlist overwrites the engine's score, so a client
  sees one match percentage at intake and a different one afterwards.
- **Manual shortlisting invents the score.** `handleShortlistCandidate` sets
  `score: Math.floor(Math.random()*15)+84` with random breakdown values
  (`admin-panel/pages/index.tsx:1083`). The client is shown a random number between 84 and 98
  as a match score.
- **Assessment results never reach the grade by themselves.** Marking is done in the
  candidate's browser (`TalentDashboard.tsx:6045-6063`) — and every browser is sent the raw
  question rows including `correct_answer` (`packages/database/index.ts:824`). The result is
  written to `talent_skill_assessments` using columns that do not exist: the code sends
  `talent_id`, `assessment_id`, `answers`, `submitted_at`; the table has `"talentId"`,
  `"assessmentId"`, `status`, `score`, `"assignedAt"` (`supabase_migration.sql:256-262`). The
  write fails, and the candidate can retake the assessment after the next poll. The
  server-side marking endpoint exists but nothing calls it
  (`admin-panel/pages/api/assessments.ts:63-132`). Subjective grading has a backend and no UI.
- **Work simulation submissions are invisible.** They are stored on the stage record
  (`advance.ts:73`) and nothing in the admin panel reads them; the admin's stage 5 screen is a
  slider defaulting to 80.
- **Matches are never regenerated.** They are built once at intake. Editing the request, or a
  candidate's grade or status changing later, never rebuilds them, and a rejected candidate is
  never removed from existing match rows. `requiresReReview` is set when a vetted talent edits
  core fields (`index.tsx:1975`) and no matching code reads it.
- **Two screens, two grades.** The admin list shows the stored grade next to a computed score;
  the detail view shows a computed grade; the talent dashboard computes its own and relabels
  Reject as "C", a grade that exists nowhere else. The stored grade is only refreshed on a
  stage decision, so anything changed by `advance.ts` leaves them out of sync.
- **The manual score override writes no audit entry** (`admin-panel/pages/index.tsx:2830-2843`),
  and neither does `advance.ts`, the SLA auto-skip, or any talent-side write. Audit actors are
  the hardcoded string `'Admin Operator'` and ids are `audit_${Date.now()}`, which collide
  when two actions land in the same millisecond.

---

## 4. Interview scheduling

This is where the product's core premise — African talent, clients abroad — is quietly
broken.

**Timezones are not handled at all.** Interview times are stored as two text columns, `date`
and `time`, holding naive wall-clock strings with no zone, and nothing records the zone of
whoever scheduled it (`supabase_migration.sql:358-359`). The code says so out loud:
`ScheduleInterviewModal.tsx:57` carries the comment "We would normally convert this to UTC for
DB... keeping it simple here". Every portal prints the raw string and labels it local:
"(Local Time)" on the client panel (`ClientInterviewsPanel.tsx:300`), "Your Local Time" twice
on the talent side (`TalentDashboard.tsx:749`, `:1328`), and no label at all on the admin side.

Worked example: a client in New York schedules 15:00 on 10 November, meaning 20:00 UTC. The
row stores `15:00`. The candidate in Lagos is shown "15:00 (Your Local Time)" when the real
start is 21:00 their time. They join six hours early. No error is raised anywhere.

The timezone selector in the modal is cosmetic — `selectedTimezone` is set at `:23`, rendered
at `:103-112`, and never read again. The talent's own timezone field is free text defaulting
to 'GMT+1 (Lagos)' and is never used for conversion. Separately, `new Date(iv.date)` parses a
date-only string as UTC midnight, so any viewer west of UTC sees the date a day early
(`ClientInterviewsPanel.tsx:299`, `TalentDashboard.tsx:748`). And the three Google Calendar
link builders disagree: two append a literal `Z` to wall-clock time
(`ClientDashboard.tsx:699`, `admin-panel/pages/index.tsx:1128`), one omits it, one goes
through a Date object. The same interview produces three different calendar times.

**The "Request Interview" button saves nothing.** `ScheduleInterviewModal` inserts without
`client_id`, which is NOT NULL (`:63-76`), never reads the returned error, and then shows
"Interview request sent to talent for confirmation!" (`:81`). The only four slots offered are
hardcoded to 20-22 July 2026 (`:27-32`), which are now in the past. So the client's main path
to an interview offers only expired dates and then lies about having booked one.

**Other breaks:**

- Three sources of truth for one interview time: the `interviews` row, the vetting pipeline
  stage record, and `requestedDate`/`requestedTime` on the match (`ClientDashboard.tsx:676-684`).
  The talent's upcoming list is built from the pipeline with synthetic ids, not from the table
  (`TalentDashboard.tsx:484-495`), so an interview can exist on one and not the other.
- Vetting reschedule requests are invisible to the admin. The talent sets a pipeline flag and
  tries to patch an interview by a synthetic id that matches no row
  (`TalentDashboard.tsx:7457-7503`). The global admin reschedule queue requires
  `rescheduleRequested` on the interview row (`admin-panel/pages/index.tsx:1915`), so the
  request only appears buried inside that candidate's stage drawer. Nobody is notified.
- Approving a reschedule mints a **new** interview row and leaves the old one `Scheduled`
  forever (`:2447` into the create branch at `:685`).
- `Rescheduled` status is destroyed on save: the writer collapses it to `scheduled` and the
  reader only restores `Scheduled` (`packages/database/index.ts:1139`, `:772`). The admin's
  "Rescheduled" counter reads zero after any reload.
- The candidate cannot accept or decline. There is no button; the database columns
  `talent_decline_reason` and `talent_response_deadline` and the `talent_accepted` status are
  referenced by no code. The client flow writes `Scheduled` immediately
  (`ClientDashboard.tsx:711`), so the candidate is never asked.
- Meeting links are fabricated random strings in the shape of a Google Meet URL
  (`api/interviews.ts:5-9`, `ClientDashboard.tsx:697`), and the audit log records "Google
  Calendar event created" when none was (`api/interviews.ts:52`).
- No double-booking check anywhere, no reminders, no calendar invitation, no email.

---

## 5. Offer and contract

**Correction to the earlier checklist: the `offers` table does exist.** It is at
`supabase_migration.sql:404-442` and it is thoroughly designed — `match_id`, `initiated_by`,
`entry_point`, payment model, `talent_response_deadline`, `accepted_at`, decline reason, and
seven CHECK constraints. `contracts.offer_id` has a foreign key to it.

**And no code touches it.** A grep for `from('offers')` across every `.ts` and `.tsx` file
returns nothing. The RLS migration says as much in a comment: "Nothing currently writes
offers" (`migrations/2026-10-17_fix_privilege_escalation.sql:240`). So the earlier finding was
right about the behaviour and wrong about the cause: the table is not missing, it is
abandoned. An offer is a status string on a match, written as `'Offer Extended'` in React
state and `'offer_extended'` to the database — and neither value is legal under the match
constraint, so neither persists.

**What happens when a client clicks Hire:**

1. A modal opens with a start date, a monthly rate and free-text notes
   (`ClientDashboard.tsx:4650-4695`). There is no contract type and no payment summary, both
   of which the scope requires. The notes are collected and never stored.
2. The match status update is rejected by the constraint, unchecked (`:4791-4793`).
3. A contract row is inserted with status `pending` (`:4773-4783`). The contracts table has no
   `match_id` column, so the link back to the match is lost, and `offer_id` is never set.
4. The notification insert writes `title`, `content` and `read_status` — the table has
   `message` and `read` and no `title` (`supabase_migration.sql:602-611`) — so it is rejected,
   unchecked.
5. The client sees "Job Offer Extended successfully!" (`:4803`) from React state alone.
6. **The talent sees nothing.** The contracts tab initialises its state from `MOCK_CONTRACTS`,
   three hardcoded fake contracts for "Nexus Health Systems", "Horizon Fintech" and "Global
   Corp Inc" (`TalentDashboard.tsx:2147`, `:2209`). Every candidate sees the same fake active
   $8,000/month contract.

There is no accept and no decline button anywhere. The pipeline infers acceptance from the
existence of any contract row (`TalentDashboard.tsx:2640-2648`), so a merely pending contract
displays as an accepted placement.

**Signature:** the client signing modal is passed into `ClientDashboard` and never rendered
(`index.tsx:4976-4979`); its trigger `handleExtendOffer` is passed as a prop that no component
destructures. The talent signing UI updates React state only, with a hardcoded IP
`'192.168.1.1'` commented "Mocked IP" and a hash of `'sha256-mock-' + Date.now()`
(`TalentDashboard.tsx:2245-2248`). Nothing is saved. There is no signed PDF, no content hash,
no real timestamp, and no client counter-signature.

**Contract status collapses on every save.** `writeDbAsync` maps anything that is not Signed,
terminated or completed to `'pending'` (`packages/database/index.ts:996`), and read-back
returns only `Signed` or `Pending` (`:690`). An admin clicks "Activate", the row shows Active,
and a refresh shows Pending. Meanwhile `signed` and `completed` are not legal values under the
contracts constraint, so those writes fail the whole batch.

**The compliance gate is a banner, not a gate.** `pendingDocs` renders a warning and nothing
blocks matching, hiring or signing on unsigned documents
(`TalentDashboard.tsx:580-614`). The check matches by document name, so an uploaded file with
the right name satisfies it. And the first talent to sign a universal template rewrites that
template row's `user_id` to their own (`index.tsx:4838-4843`), so it stops being a mandatory
document for everyone else.

**The legal templates are placeholders, and they name two different companies.** The NDA
signs as "KONGILA EOR SYSTEMS LTD" (`packages/contracts/index.ts:8`); the master agreement
signs as "KONGILA TALENT DEPLOYMENT LLC" (`:45`). The master agreement has a role, a rate, a
payment line and three bullet points of conduct — no IP assignment, no termination, no
liability, no data protection, no tax, no dispute resolution, no governing law, no signature
block. Both reference Remotan. The talent signing page then displays fifteen identical filler
paragraphs reading "Standard terms and conditions regarding confidentiality, intellectual
property, termination, and independent contractor status go here... (Clause N)"
(`TalentDashboard.tsx:2284-2286`), which exist purely so the scroll-to-accept gate triggers.

**Onboarding on hire** routes into `api/workflows.ts`, whose `talent_onboarding` handler is
hardcoded to fail at step 3 with a fabricated "Network timeout contacting WhatsApp API"
(`:51-67`). Retry marks it completed without doing anything.

---

## 6. Finance, invoicing and payouts

The client has dropped the payment gateway, so the question is only whether invoices and
payroll can be generated and recorded. They cannot.

- **Nothing in finance persists.** `writeDbAsync` upserts sixteen tables and `invoices`,
  `payments` and `talent_payouts` are not among them (`packages/database/index.ts:855-1156`,
  verified by grep). Every finance action in the admin UI calls `saveToDb`, receives HTTP 200,
  and reverts on the next poll.
- **Invoice generation is a hardcoded mock.** `api/finance/generate-drafts.ts:16-41` returns
  the same two invoices every time — Horizon Fintech $5,000 and Nexus Health $3,200 — with
  fake client ids and no database access at all. Clicking "Auto-Generate Drafts" prepends
  them again each time.
- **No invoice is derived from a contract.** Nothing reads `contracts.rate_amount` to build
  one. The only contract-derived figure is MRR, computed in the browser and filtered on
  contract statuses that the read mapper can never return, so it always shows $0.
- **The four service lines are not billed differently.** There is no placement-fee field, no
  project-fee field, and no recurring-versus-one-time flag. The hire flow hardcodes
  `rateType: "Monthly"` for every service (`ClientDashboard.tsx:4772`), so a one-time
  placement fee is stored as a monthly rate.
- **The Kongila margin exists nowhere durable.** `FeeConfig` is a type
  (`shared-types/index.ts:803-810`) with no table, no seed, and no handler in `writeDbAsync`.
  The admin fee tab renders an empty array. No code anywhere multiplies a rate by a fee
  percentage.
- **Payout gross always equals net.** `grossAmount`, `commissionPct` and `netAmount` are type
  fields with no columns, so the UI falls back to showing the same `amount` twice
  (`FinanceManager.tsx:381-382`). Commission is never deducted.
- **Payout approval blocks on a link that cannot exist.** The gate requires the client invoice
  to be paid, via `TalentPayout.invoiceId` — a type field with no column — so it is always
  undefined and every approval is blocked (`:114-118`). There is also a shipped test stub that
  fails one approval in five at random with "Invalid bank details routing number" (`:149-152`).
- **The client sees $0 where the admin sees a number.** The client billing tab sums `totalUsd`,
  a field the table lacks and the mapper drops, so Paid YTD and Outstanding both read zero
  (`ClientDashboard.tsx:5716`), while the same client's dashboard widget and the admin tab sum
  `amount` with different filters. Three screens, three answers.
- **Currency is not stored on any money record.** The exchange rate service caches in a
  module-level Map that resets on every serverless cold start, silently substitutes a
  hardcoded 1600 NGN fallback on any fetch failure and caches that fallback as fresh
  (`api/exchange-rate.ts:10-46`), and returns 1:1 for an unknown currency (`:54`). Its only
  caller is talent onboarding. No invoice records the rate it was created at, so no naira
  figure is reproducible later.
- **Payroll does not exist.** There is a `payroll_entries` table with `total_hours`,
  `hourly_rate`, `gross_amount`, `deductions`, `net_amount` (`supabase_migration.sql:816-830`)
  and a matching type. Neither `readDbAsync` nor `writeDbAsync` touches it. There is no
  monthly run, no period selection, no proration, no hours-to-pay calculation, no deductions,
  no payslip and no export. The admin "Payroll & EOR" tab lists payout rows and totals and
  offers no actions. This is the thing the client specifically asked for and it is not started.
- Also absent: invoice numbers, line items, tax, PDF generation (the button is inert), sending
  (the Sent transition changes a local field), automatic overdue marking, and revenue or cost
  per client or per talent.

---

## 7. The foundation everything sits on

**Schema drift.** Six of the seven tables `CLAUDE.md` lists as missing are now in the
migration file; the seventh, `message_attachments`, is a storage bucket, and the two apps
spell it differently (`message_attachments` versus `message-attachments`), so one of them
points at a bucket that probably does not exist. But roughly twenty column and constraint
mismatches remain, each of which kills a whole batch:

| Table | What the code writes that the schema rejects |
| --- | --- |
| notifications | `title` on every insert; `content` and `read_status` on nine of them; `user_id` values `'admin_team'`, `''`, `'usr_horizon'` against a foreign key |
| documents | ~15 non-existent columns; type `'cv'` vs `'CV'`; statuses `superseded`, `deleted` |
| contracts | `client_monthly_fee_usd`, `termination_reason`, `role_title`, `engagement_type`; statuses `signed`, `completed` |
| matches | `interview_scheduled`, `offer_extended`, `rejected_by_client`, `offer accepted` |
| support_tickets | `client_id`, `linked_contract_id`, `assigned_to`, `description`; lowercase `'open'`; every category the two forms offer |
| service_requests | four non-existent columns; missing NOT NULL `title`; both CHECK constraints violated |
| client_profiles | `permission_level`, `settings` |
| conversations | `client_id`, `admin_id`; missing NOT NULL `type` |
| messages | `conversation_id`, `attachment_url`, `is_read`, `read_at` |
| talent_skill_assessments | all five columns the submit path writes |
| organizations | `how_did_you_hear_about_us`, `monthly_revenue`, `internal_notes`, `last_activity_at` |
| interviews | missing NOT NULL `client_id` from the modal |

Support tickets cannot be created from either portal. Messaging fails at both the conversation
and message inserts. If the live schema does carry these columns, then the writes succeed and
apply the lossy mappings instead — which is its own problem, and either way this table needs
resolving against the live database before anything else is fixed.

**Notifications: zero delivery.** Of the fifteen emails a hire needs, **none** are sent by any
application code. There is no provider and no SMTP anywhere. Two are console-log mocks
(`api/notifications.ts`, `invite.ts`). The rest either attempt an in-app row that the schema
rejects, or have no code at all. The admin panel never reads the notifications table, so
anything addressed to operations is invisible regardless. Unread counts are computed three
different ways; the message badge counts every message in the database as unread for every
user, because it reads a `read` field that does not exist on message rows
(`TalentDashboard.tsx:7520`, `ClientDashboard.tsx:598-600`).

**Roles are not enforced.** All seven accepted role strings get the same thirteen tabs with no
role checks at render (`admin-panel/pages/index.tsx:172-193`, `:3868-3895`). The `finance` role
cannot exist — it is not in `users_role_check`. No admin API route authenticates at all, and
`/api/db` will upsert a `users` row with any `role` value supplied in the body using the
service role key, which is an unauthenticated path to super admin. The admin portal also still
auto-provisions `@kongila.co` addresses from the browser (`:451-465`, `:489-504`), even though
`AdminLogin.tsx` had that removed.

**The audit log is not an audit log.** It is written from the browser in five places, upserted
by id from client-supplied arrays through five API routes (so existing rows can be
overwritten), has no real actor, no `user_id`, no trigger enforcing immutability, no filter and
no export.

**The data substrate.** `readDbAsync` runs one RPC or falls back to 31 unbounded `select('*')`
queries. `writeDbAsync` upserts every row handed to it across 16 tables, never deletes, has no
transaction and no version check, and swallows every error. One candidate advancing one vetting
stage therefore reads 31 tables and rewrites 16, and in the process resets **every user's**
`password_hash` to `'auth_managed'` (`:855`), forces **every** talent to `status: 'active'`
(`:952`), sets **every** interview's `client_id` to `'system'`, and drops seven profile fields
that the reader maps but the writer does not. Both portals poll this every four to five
seconds. Two people acting at once overwrite each other with no warning.

**RLS.** The two migrations cover nine tables: users, user_roles, roles, offers, matches,
audit_logs, talent_requests, client_profiles, organizations. Left with no new policy:
talent_profiles, documents, messages, conversations, notifications, support_tickets, contracts,
invoices, payments, talent_payouts, service_requests, assessments and the rest. Three sources
disagree about whether RLS is currently on, and this cannot be settled from the files. One
thing the first migration would do if applied is revoke general update on `users` with a grant
on only three columns, which would break every browser `users` upsert — including signup.

---

## What this means for the date

Six days remain to 3 November. The hire path does not complete, finance does not persist,
payroll does not exist, zero emails send, the legal templates are placeholders naming two
different companies, and timezone handling — the premise of the product — is absent.

This is not a week of work. The honest sequence is: settle the live schema, then make writes
durable and loud, then rebuild the offer-to-contract path on the `offers` table that is
already designed and waiting, then notifications, then invoicing and payroll. A controlled
launch in the first half of December with a real end-to-end rehearsal is achievable. 3
November is not, and attempting it means putting a client and a candidate into a flow that
will lose their data silently.
