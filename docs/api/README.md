# Kongila API — Postman

Two files:

- `kongila.postman_collection.json` — 310 requests in 27 folders
- `kongila.postman_environment.json` — 57 variables

The collection covers the production launch routes in `kongila-web` and
`admin-panel`, including the resource routes added during the API migration.
Remotan is excluded apart from one check that its
`/api/db` no longer accepts an unauthenticated write.

## Setup

1. Import both files into Postman and select the environment.
2. Fill in the six connection variables:

   | variable | where to get it |
   | --- | --- |
   | `supabaseUrl` | Supabase project settings |
   | `supabaseAnonKey` | Supabase project API settings |
   | `baseUrl` | the client/talent portal host |
   | `adminBaseUrl` | the admin portal host |
   | `remotanBaseUrl` | the Remotan host, if deployed |
   | `cronSecret` | the `CRON_SECRET` set on the admin app |

3. Create four accounts on staging and fill in their credentials:

   - a client
   - a candidate
   - an administrator
   - a **second client, in a different organisation** — folder 25 needs it

4. Run folder **00 Authentication and tokens**. It signs each account in and
   saves `clientToken`, `talentToken`, `adminToken` and `otherClientToken`.

Then run the folders in order. Each one captures ids the later ones use.

## The folders

| | folder | what it covers |
| --- | --- | --- |
| 00 | Authentication and tokens | sign-in for all four accounts |
| 01 | Account and onboarding | provisioning, activation, invite signup |
| 02 | Talent profile | profile, skills, drafts, settings |
| 03 | Company and team | organisation, contact details, invitations |
| 04 | Client requests | creating and editing service requests |
| 05 | Matching and shortlists | submission, shortlist, rejection |
| 06 | Vetting and assessments | scores, pipeline, candidate-driven stages |
| 07 | Assessment authoring | categories, questions, grading |
| 08 | Interviews | propose, respond, reschedule, rate, cancel |
| 09 | Offers | raise, approve, send, accept, decline |
| 10 | Contracts | create, sign, activate, terminate |
| 11 | Contract templates | drafts, publishing, versioning |
| 12 | Signatures and compliance | signing, compliance documents |
| 13 | Documents and uploads | signed upload URLs, versions |
| 14 | Messaging | conversations, messages, attachments |
| 15 | Notifications | inbox, marking read, sending events |
| 16 | Support | tickets, replies, resolution |
| 17 | Reviews | client reviews of a candidate |
| 18 | Finance (client and talent) | invoices, payouts, disputes, PDFs |
| 19 | Finance (operations) | fees, generation, sending, settlement |
| 20 | Payroll | preview, generate, approve, export |
| 21 | Operations: requests and assignment | status moves, manager assignment |
| 22 | Operations: users, settings, audit | operator accounts, settings, audit |
| 23 | `/api/db` compatibility checks | Scoped reads, unauthenticated/wrong-role refusals, and writes rejected |
| 24 | Scheduled jobs | nightly and interview reminders |
| 25 | Cross-user isolation | one person's token against another's records |
| 26 | Anon key against the database | PostgREST and Storage directly |

## Reading the results

103 of the 310 requests are named **NEGATIVE**. They are supposed to fail.
Their tests assert the failure, so a green tick means the refusal worked. A
red one there is the finding.

Folders **25** and **26** are the ones that decide whether this is safe to
ship. Everything in them must fail.

Folder 26 goes around the application entirely and talks to PostgREST and
Storage with the anon key, the way a browser would. If any of those come back
with rows, RLS is not on for that table and nothing else in this collection
matters.

## What the collection cannot do

**Raw file bytes.** Postman cannot carry a file inside a saved collection.
Folder 13 gets a signed upload URL and stops. To finish an upload by hand:

1. Run *Start an upload (talent document)*. It saves `uploadSignedUrl`,
   `uploadPath` and `uploadStoredUrl`.
2. Make a new request: `PUT {{uploadSignedUrl}}`, body type **binary**, pick a
   file, set `Content-Type` to match what you declared.
3. Run *Record an uploaded document*, which posts `uploadStoredUrl`.

Worth doing once per bucket, because it is the only way to confirm the signed
URL works and that it cannot be reused for a second file or a different path.

The admin-only **`/api/clients`** and **`/api/talents`** list/detail endpoints
are included in the resource endpoint folder. The client and admin portals no
longer call `/api/db`; folder 23 remains to test the read-only compatibility
routes while they are retained.

## Variables you set by hand

Folder 25 needs ids belonging to someone other than the main test accounts.
There is no way to capture them automatically, because the whole point is that
the signed-in account cannot see them. Fill these from a second account's data
using the admin token or the SQL editor:

`otherTalentId`, `otherDocumentId`, `otherTicketId`,
`otherTalentSkillAssessmentId`, `paidInvoiceId`, `accountManagerUserId`,
`talentManagerUserId`, `expiredToken`.

`talent_name` and `client_company` are deliberately set to their own literal
text. They are contract-template merge fields, and Postman substitutes a
variable once, so the braces survive into the saved template. Leave them alone.

## Running from the command line

```bash
npx newman run docs/api/kongila.postman_collection.json \
  -e docs/api/kongila.postman_environment.json
```

One folder at a time:

```bash
npx newman run docs/api/kongila.postman_collection.json \
  -e docs/api/kongila.postman_environment.json \
  --folder "26 Anon key against the database directly"
```

Newman needs the environment to be filled in first; it does not prompt.
