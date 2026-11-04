# Migrations, 4 November 2026

Two files, in this order:

```
packages/database/migrations/2026-11-04_client_reviews.sql
packages/database/migrations/2026-11-04b_contract_templates.sql
```

Run them in the Supabase SQL editor on staging first, then production. Both
are safe to run more than once. Both were tested against a Postgres 16
instance loaded with `supabase_migration.sql` and every migration from 31
October onwards, and run twice to confirm they are idempotent.

---

## 2026-11-04_client_reviews.sql

Adds `public.client_talent_reviews` — a client's review of a candidate they
have engaged.

| column | notes |
| --- | --- |
| `client_id` | FK to `users`, cascades |
| `talent_id` | FK to `talent_profiles`, cascades |
| `contract_id` | which engagement the review is about |
| `rating` | 1 to 5, required |
| `technical_score`, `communication_score`, `reliability_score` | 1 to 5, optional |
| `public_feedback` | the candidate may see this |
| `private_feedback` | operations only |
| `is_anonymous` | hides the client name from the candidate |

A unique index on `(client_id, talent_id)` means a client revising their
view updates the review rather than adding a second one to the average.

### Why it exists

The review modal in the client portal stored nothing at all. It inserted
two rows into `notifications`, both addressed to the client who wrote the
review, one of them titled "Confidential Admin Review", with the rating
written into the message text:

```
CONFIDENTIAL ADMIN-ONLY REVIEW for Ada Okafor (Backend Engineer).
Ratings - Overall: 4 Stars, Tech: 4, Comm: 5, Reliability: 5.
Private feedback: "..."
```

RLS is on with no policy on `notifications`, so the browser insert was
denied and neither row was written. Even if they had been, a rating inside
a sentence of message text is not something any screen can read back, and
the "admin only" row was addressed to the client, not to an administrator.

The modal then showed: *"Your verified evaluation has been logged in our
EOR ledger and securely synchronized."*

---

## 2026-11-04b_contract_templates.sql

Adds `public.contract_templates` — the templates behind the editor in the
Contracts tab.

| column | notes |
| --- | --- |
| `name` | required |
| `service_type` | which line it is for; null means any |
| `body` | the template text |
| `status` | `draft`, `published` or `archived` |
| `version` | bumps when a published template's wording changes |
| `created_by` | FK to `users`, set null on delete |

A partial unique index allows at most one published template per service
line. Two published templates for the same line means whichever row is read
first decides what a contract says, which is not something anyone wants to
discover from a signed contract. Drafts are unlimited.

### Why it exists

There was no table. The editor's save handler posted a `contractTemplates`
array through `/api/db`, and `writeDbAsync` has no branch for that key, so
every save was parsed and dropped on the floor. Drafts, publishing and the
version numbers in the template dropdown were all browser state that
vanished on refresh.

---

## After running them

Nothing else is needed. `/api/reviews`, `/api/contracts/templates` and both
portals are already pointed at the new tables in the same change.

---

# The rest of the 4 November batch

Three more files. Run them **in this order**, after the two above:

```
packages/database/migrations/2026-11-04c_schema_reconciliation.sql
packages/database/migrations/2026-11-04d_storage_buckets.sql
packages/database/migrations/2026-11-04e_enable_rls.sql
```

All three are safe to run more than once, and all three were tested
against a Postgres 16 instance loaded with the full schema plus every
migration from 31 October onwards, each run twice.

`d` and `e` must come **after** the application change is deployed, not
before. Both of them close doors the old code was walking through.

---

## 2026-11-04c_schema_reconciliation.sql

Two columns the code writes that the database does not have. Found by
diffing every insert, update and upsert in the repository against
`docs/live-schema.json`.

| column | what was broken |
| --- | --- |
| `contracts.updated_at` | `/api/contracts/sign` writes it on every signature and activation. The column does not exist, so Postgres refused the whole update and **no contract could be signed**. |
| `interviews.reminder_24h_sent_at` | The reminder cron reads and writes these to know which reminders have gone out. Without them the job errors on its first query, so **no interview reminder has ever been sent**. |
| `interviews.reminder_1h_sent_at` | As above. Adding them without the guard would have meant resending the same reminder on every run. |

Also adds two partial indexes so the reminder job does not sequentially
scan every interview ever held, every time it runs.

---

## 2026-11-04d_storage_buckets.sql

Makes `profile-assets` private. It was the last public bucket.

The other three were locked down earlier, which is why every browser
upload that called `getPublicUrl` afterwards stored a link that 400s.

Nothing reads these buckets by public URL now. Every read path runs its
response through `signDbFileUrls`, which swaps a stored URL for a
short-lived signed one, and the profile route does the same. Every write
goes through `/api/uploads`, which issues a signed upload URL for a path
the **server** chose from the verified session.

Also sets file size limits on the buckets themselves, so a signed upload
URL cannot be used to push a 2GB file.

**Run this after the deploy.** Flipping the bucket before the new read
paths are live would break avatars.

---

## 2026-11-04e_enable_rls.sql

Row level security on every table in `public`. This is the one the whole
API rewrite was clearing the way for.

The anon key is in the public JavaScript bundle. Anyone who opens the site
has it. The only thing that was ever supposed to stop that key reading and
writing the database is RLS, and RLS was off on 29 tables, including
`users`, `talent_profiles` and `talent_skill_assessments`.

It could not be turned on earlier because both portals were reading and
writing tables directly from the browser. They no longer are.

The posture is **deny by default**: RLS on, and no policy for `anon` or
`authenticated`, so a browser holding the anon key gets nothing. The API
routes use the service role key, which bypasses RLS entirely, so none of
them are affected. The existing policies on `client_profiles`, `matches`,
`offers`, `organizations`, `talent_profiles`, `talent_requests`, `users`,
`user_roles`, `interviews` and `request_activity_logs` are left exactly as
they are; this migration does not widen anything.

It also revokes the `anon` role's table grants. RLS is the control that
matters, but a grant plus a future policy wider than intended is how a
leak comes back.

### Before running this on production

On staging, in this order:

1. Deploy the application change that goes with it.
2. Run `2026-11-04e_enable_rls.sql` on staging.
3. Sign in **as a candidate**. Profile, documents, assessments and
   messages should all load.
4. Sign in **as a client**. Requests, candidates, interviews and invoices
   should all load.
5. Sign in **as an administrator**. Open every tab.

If anything comes back empty, something is still reading a table from the
browser. Find it before running this on production.

To undo one table while debugging:

```sql
alter table public.<name> disable row level security;
```

---

## After all five have run

Re-dump the schema so the audit is working from current facts:

1. Run `docs/schema-introspection.sql` in the SQL editor.
2. Save the single JSON result cell over `docs/live-schema.json`.
3. `node scripts/schema-audit.js`

It should report no mismatches, no tables with RLS off, and no public
buckets. If it does not, the output names the file and line.
