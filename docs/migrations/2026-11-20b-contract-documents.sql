-- Two documents per contract, each with its own lifecycle.
--
-- Run this once, in the Supabase SQL editor, after 2026-11-20-offer-milestones.
-- Everything is IF NOT EXISTS, so running it twice is harmless, and the code
-- falls back to the single-body columns when this table is absent.
--
-- Why: a contract has had one status covering both parties. That cannot say
-- the client has had their document for nine days and not opened it while the
-- candidate signed theirs on the day it arrived, which is exactly what an
-- operator chasing a signature needs to know. It also cannot express the two
-- different documents the parties actually sign: the client's carries the
-- service fee, the candidate's carries their pay, and they are not the same
-- text.
--
-- The contract's own status column stays, and stays authoritative for
-- everything downstream. It is now derived from these rows rather than set by
-- hand, so it cannot say fully_signed while a document sits unsent.

CREATE TABLE IF NOT EXISTS contract_documents (
  id             text PRIMARY KEY DEFAULT (gen_random_uuid())::text,
  contract_id    text NOT NULL,
  -- 'client' or 'talent'. Which party signs this one.
  audience       text NOT NULL,
  -- The rendered text as issued. Frozen: re-rendering later from a template
  -- that has since been edited is not the document anybody signed.
  body           text,
  -- The template it came from, for the audit trail.
  template_id    text,
  template_version integer,
  -- sha256 of the body as sent, so a change after sending is detectable.
  document_hash  text,
  status         text NOT NULL DEFAULT 'draft',
  sent_at        timestamptz,
  sent_by        text,
  viewed_at      timestamptz,
  signed_at      timestamptz,
  signature_id   text,
  void_reason    text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

-- One document per party per contract.
CREATE UNIQUE INDEX IF NOT EXISTS contract_documents_party_idx
  ON contract_documents (contract_id, audience);

CREATE INDEX IF NOT EXISTS contract_documents_status_idx
  ON contract_documents (status);

ALTER TABLE contract_documents
  DROP CONSTRAINT IF EXISTS contract_documents_audience_check;
ALTER TABLE contract_documents
  ADD CONSTRAINT contract_documents_audience_check
  CHECK (audience IN ('client', 'talent'));

ALTER TABLE contract_documents
  DROP CONSTRAINT IF EXISTS contract_documents_status_check;
ALTER TABLE contract_documents
  ADD CONSTRAINT contract_documents_status_check
  CHECK (status IN ('draft', 'sent', 'viewed', 'signed', 'void'));

-- Which document a signature is against. A signature has always named its
-- signer_role; this names the exact text, which is the point of the record.
ALTER TABLE contract_signatures ADD COLUMN IF NOT EXISTS contract_document_id text;

-- ─── Row level security ──────────────────────────────────────────────────────
-- Written and read by the server with the service role key. A party reads
-- their own document through an endpoint that checks who they are, never
-- directly, so the browser gets no policy at all.

ALTER TABLE contract_documents ENABLE ROW LEVEL SECURITY;
