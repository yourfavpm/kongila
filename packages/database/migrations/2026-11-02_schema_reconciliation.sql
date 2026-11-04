-- Kongila — schema reconciliation
--
-- Confirmed against the live schema on 2 November 2026. For these five tables
-- supabase_migration.sql and the live database agree, so every mismatch in the
-- audit is real.
--
-- Most of the fixes are code-side: wrong column names and wrong casing. This
-- file covers only the four cases where the database is genuinely missing
-- something the product needs, or where a CHECK constraint is narrower than
-- the product it is meant to describe.
--
-- PROPOSED, NOT RUN. Back up first, then run in the SQL editor. Check the
-- project ref in the URL bar.
--
-- Deliberately NOT included:
--   contracts.match_id — not needed. contracts.offer_id exists and offers
--     carries match_id, so contract → offer → match already works.
--   The ~15 missing documents columns (version_number, signature_data,
--     is_mandatory and friends). Those are the document versioning and
--     e-signature feature, not a reconciliation. They belong with that work,
--     designed as a whole rather than bolted on one column at a time.
--   service_requests — not fixed, retired instead. The portals store the whole
--     request in talent_requests.payload; service_requests was a second, older
--     shape that every write failed against (missing NOT NULL title, four
--     columns that do not exist, two CHECK constraints narrower than the
--     product). @kongila/database now reads and writes talent_requests only.
--     The table is left in place rather than dropped, so nothing is lost if a
--     row turns up in it. Dropping it is a separate, later decision.

-- ── notifications.title ──────────────────────────────────────────────────────
-- All 17 notification inserts in the product write a title, and both portals
-- render one. The column was simply never created, so every one of those
-- inserts is rejected and no notification has ever been stored. Adding the
-- column is the smaller change and keeps the intent.
--
-- Nullable, because a notification with only a message is still valid.

alter table public.notifications
  add column if not exists title text;

comment on column public.notifications.title is
  'Short headline shown above the message. Nullable: message alone is valid.';

-- ── matches.client_rejection_reason ──────────────────────────────────────────
-- When a client rejects a candidate, the reason is worth keeping: it is how
-- operations learn what a client actually wants. The code already writes it.
--
-- Note the status itself stays within the existing four values. Offer and
-- interview state belong on the offers and interviews tables, not here, so
-- the matches constraint is correct as it stands and is NOT being widened.

alter table public.matches
  add column if not exists client_rejection_reason text;

comment on column public.matches.client_rejection_reason is
  'Free text from the client when a candidate is rejected. Status stays ''rejected''.';

-- ── documents.status ─────────────────────────────────────────────────────────
-- The product replaces documents rather than deleting them, so an old version
-- needs a resting state. 'superseded' and 'archived' were both written by the
-- code and neither was allowed, so document replacement and soft deletion both
-- failed.
--
-- Widening a CHECK is safe: no existing row can violate a larger set.

alter table public.documents
  drop constraint if exists documents_status_check;

alter table public.documents
  add constraint documents_status_check check (status in (
    'uploaded', 'signed', 'verified', 'vetted', 'needs_review',
    'pending_signature', 'under_review',
    'superseded',  -- replaced by a newer version of the same document
    'archived'     -- soft deleted; the product never hard deletes documents
  ));

-- ── support_tickets ──────────────────────────────────────────────────────────
-- Two problems. There is no client_id, so a client cannot raise a ticket at
-- all, only a candidate. And the category list is narrower than the categories
-- both support forms actually offer, so every ticket from either portal is
-- rejected on category even after the column problem is fixed.

alter table public.support_tickets
  add column if not exists client_id varchar(255);

comment on column public.support_tickets.client_id is
  'Set when a client raised the ticket. Exactly one of talent_id or client_id should be set.';

-- Both forms also write these three. description is the body of the ticket:
-- without it a ticket is a subject line and nothing else, so it is added
-- rather than dropped from the forms.
--
-- No foreign key on assigned_to on purpose. Routing currently writes role
-- placeholders ('account-manager-uuid-001', 'tech-support-id') rather than
-- real user ids, and an FK would reject every one of them. When routing is
-- wired to real operators, add the FK then.

alter table public.support_tickets
  add column if not exists linked_contract_id varchar(255);

alter table public.support_tickets
  add column if not exists assigned_to varchar(255);

alter table public.support_tickets
  add column if not exists description text;

comment on column public.support_tickets.linked_contract_id is
  'Contract the ticket is about, when the client picked one. No FK: may reference a contract since ended.';

comment on column public.support_tickets.assigned_to is
  'Who the ticket is routed to. Currently a role placeholder, not a user id. No FK until routing is real.';

comment on column public.support_tickets.description is
  'The body of the ticket as the raiser wrote it.';

-- The union of what the two portals offer plus the four original values, which
-- existing rows may still hold. A constraint narrower than the product is what
-- caused this, so it is widened to match rather than the forms being cut down.

alter table public.support_tickets
  drop constraint if exists support_tickets_category_check;

alter table public.support_tickets
  add constraint support_tickets_category_check check (category in (
    -- original four
    'Payment Issues', 'Technical Support', 'Verification', 'Guidance',
    -- offered by the client portal
    'Contract Question', 'Billing Issue', 'Talent Performance Concern',
    -- offered by the talent portal
    'Vetting Question', 'Technical Bug', 'Account Access', 'Payment Issue',
    -- catch-all, so a new form option is a product decision and not an outage
    'Other'
  ));

-- status stays 'Open' / 'In Progress' / 'Resolved'. The code writes lowercase
-- 'open', which is a code fix, not a schema one.

-- ── talent_skill_assessments ─────────────────────────────────────────────────
-- The submit path writes answers, subjective_answers and submitted_at. None of
-- them exist, so no assessment result has ever been saved: the candidate's
-- answers are lost on submit, the admin has nothing to grade, and because the
-- row never reaches 'submitted' a candidate can retake the assessment forever.
--
-- The existing columns on this table are quoted camelCase ("talentId",
-- "assessmentId", "assignedAt"), which is also what the admin UI reads off the
-- raw row. The new columns follow that, so the grading screen finds them
-- without a mapping layer. Ugly, but consistent beats half-and-half.

alter table public.talent_skill_assessments
  add column if not exists "answers" jsonb;

alter table public.talent_skill_assessments
  add column if not exists "subjectiveAnswers" jsonb;

alter table public.talent_skill_assessments
  add column if not exists "submittedAt" timestamptz;

comment on column public.talent_skill_assessments."answers" is
  'All answers as submitted, keyed by question id.';
comment on column public.talent_skill_assessments."subjectiveAnswers" is
  'Free-text answers needing a human grade, keyed by question id. The admin grading screen reads this.';

-- ── conversations and messages ───────────────────────────────────────────────
-- In-app messaging has never worked. Three separate reasons:
--
--   1. conversations.id is uuid, but every id in this product is a prefixed
--      string ('conv_x8f2a', 'usr_...'). Every insert fails on the cast.
--      Same for context_id, which holds a request id, and participant_ids,
--      which holds user ids.
--   2. messages has no conversation_id, so a message cannot belong to a
--      thread. Both portals write one, and both read it back.
--   3. messages has no attachment or read-tracking columns, though the
--      composer uploads attachments and both portals mark messages read.
--
-- The read and write mappers in @kongila/database already assume the shape
-- below, so the database is the outlier here, not the code.

alter table public.conversations
  alter column id drop default;

alter table public.conversations
  alter column id type varchar(255) using id::text;

alter table public.conversations
  alter column id set default ('conv_' || replace((gen_random_uuid())::text, '-', ''));

alter table public.conversations
  alter column context_id type varchar(255) using context_id::text;

alter table public.conversations
  alter column participant_ids type text[] using participant_ids::text[];

-- type is NOT NULL and the client portal never sets it, so every client-side
-- insert failed on it. A default makes the column honest without loosening it.
alter table public.conversations
  alter column type set default 'direct';

alter table public.messages
  add column if not exists conversation_id varchar(255);

alter table public.messages
  add column if not exists attachment_url text;

alter table public.messages
  add column if not exists attachment_name text;

alter table public.messages
  add column if not exists is_read boolean default false;

alter table public.messages
  add column if not exists read_at timestamptz;

create index if not exists messages_conversation_id_idx
  on public.messages (conversation_id);

comment on column public.messages.is_read is
  'Supersedes read_status. The reader falls back to read_status for rows written before this column existed.';

-- ── Verify ───────────────────────────────────────────────────────────────────

select table_name, column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public'
  and (
    (table_name = 'notifications' and column_name = 'title') or
    (table_name = 'matches' and column_name = 'client_rejection_reason') or
    (table_name = 'support_tickets' and column_name in
      ('client_id', 'linked_contract_id', 'assigned_to', 'description')) or
    (table_name = 'talent_skill_assessments' and column_name in
      ('answers', 'subjectiveAnswers', 'submittedAt')) or
    (table_name = 'conversations' and column_name in
      ('id', 'context_id', 'participant_ids', 'type')) or
    (table_name = 'messages' and column_name in
      ('conversation_id', 'attachment_url', 'attachment_name', 'is_read', 'read_at'))
  )
order by table_name;

select rel.relname as table_name, con.conname, pg_get_constraintdef(con.oid) as definition
from pg_constraint con
join pg_class rel on rel.oid = con.conrelid
join pg_namespace ns on ns.oid = rel.relnamespace
where ns.nspname = 'public'
  and con.contype = 'c'
  and con.conname in ('documents_status_check', 'support_tickets_category_check');

-- ── Rollback ─────────────────────────────────────────────────────────────────
-- Dropping the columns loses data once anything has written to them.
--
-- alter table public.notifications drop column if exists title;
-- alter table public.matches drop column if exists client_rejection_reason;
-- alter table public.support_tickets drop column if exists client_id;
-- alter table public.support_tickets drop column if exists linked_contract_id;
-- alter table public.support_tickets drop column if exists assigned_to;
-- alter table public.support_tickets drop column if exists description;
-- (the two CHECK constraints would need restoring to their original lists)
