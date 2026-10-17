# Progress log

One entry per day of the launch sprint. Written at the close of the day, read at the start
of the next, and pasted into the first AI session of the morning so it starts with context
instead of guesses.

Keep entries short and factual. What landed, what broke, what moved, what was decided.
Decisions matter most: they are the thing nobody remembers a week later.

---

## Day 1 — repo, environment, ground rules

Started 17 October, ahead of the 19 October plan date.

**Landed**

- Local working copy switched from `main` to `staging`. `main` is 98 commits behind and is
  being left alone until launch day. Deployments come from `staging` in the meantime.
- Toolchain installed: Node 24.21.0, pnpm 11.1.2 via npm global. `corepack enable` failed
  with EPERM because it writes into `C:\Program Files\nodejs`, and PowerShell's execution
  policy blocked npm's script wrapper until it was set to RemoteSigned for CurrentUser.
  Worth knowing if anyone else sets up on Windows.
- `pnpm install` clean across all 14 workspace projects.
- `.env.example` written at the repo root, covering the six variables actually referenced in
  the code.
- `CLAUDE.md` written. The standing context for every AI session: branch truth, layout, the
  data access rule, the seven tables missing from the migration file, the known traps.
- 74 development scripts staged for deletion from the repo root, `scratch/`,
  `apps/kongila-web` and `packages/database`.

**Broke**

- A `git rm *.js *.ts` command staged deletion of every `.js` and `.ts` file in the repo,
  including all real source. Git pathspec wildcards match recursively, not just at the
  level you run them. Recovered with `git restore --source=HEAD --staged --worktree .` with
  nothing lost, because `git rm` only stages and `git status` was checked before committing.
  Replaced with an explicit 74-path list in `cleanup-list.txt`.
  Rule taken from this: no wildcards in destructive commands, list paths explicitly.

**Decided**

- The Supabase anon key will NOT be rotated today. It is designed to be public and ships in
  the browser bundle by design. Rotating it now breaks every local environment and buys
  nothing while RLS is off. Rotation moves to the end of day 4, once RLS is on, as a clean
  break.
- A scan of all 99 commits across both branches found only one literal key ever committed,
  and it is the anon key. No service role key was ever hardcoded, no `.env` file was ever
  committed. Every script reads `SUPABASE_SERVICE_ROLE_KEY` from the environment.
- `apps/kongila-web/migrate_db.js` is kept, not deleted. It documents how the old `db.json`
  structure maps into Supabase and will be needed for the day 2 schema work.
- `db.json` at the root is kept until `packages/database` stops falling back to it on day 3.

**Outstanding from day 1**

- [ ] Commit the cleanup, `.env.example` and `CLAUDE.md`
- [ ] Ask the dev team whether the service role key has been shared anywhere outside the
      repo (Slack, WhatsApp, a shared doc, an AI session). If yes or nobody is sure, rotate
      that one today. It bypasses RLS entirely.
- [ ] Remove the hardcoded anon key fallbacks so a misconfigured deploy fails loudly instead
      of silently connecting to the wrong database:
      `apps/kongila-web/pages/api/documents.ts` line 5,
      `packages/database/index.ts` around line 843,
      `apps/kongila-web/components/TalentDashboard.tsx` line 2952,
      and the three `lib/supabaseClient.ts` placeholder fallbacks
- [ ] Fill `.env.local` in `apps/kongila-web` and `apps/admin-panel`, confirm `pnpm dev`
      brings up both portals
- [ ] Three questions for the dev team: does an interview reschedule flow exist anywhere
      unmerged, is the live Supabase project the only environment, and is the data in it
      real or seeded

**Open questions for Mr. Dare** (chased on day 1, needed later)

- Final legal templates from his lawyer — blocks day 10
- Email provider account, sending domain, DNS access — blocks day 9
- E-signature provider decision — blocks day 10
- Domain and hosting for the marketing site — blocks day 9
- Does Kongila handle money at launch, or does finance invoice manually — blocks day 11

---

## Template for the next entry

```
## Day N — <the day's outcome in four words>

**Landed**
-

**Broke**
-

**Decided**
-

**Outstanding**
- [ ]

**Close condition**: met / not met, and why
```
