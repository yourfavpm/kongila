-- KT-DOCS: Documents Table Migration
-- Run this in your Supabase SQL Editor (Dashboard → SQL Editor → New Query)
-- Safe to run multiple times — all statements use IF NOT EXISTS

ALTER TABLE documents ADD COLUMN IF NOT EXISTS file_url TEXT;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS file_name TEXT;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS file_size_bytes BIGINT DEFAULT 0;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS version_number INTEGER DEFAULT 1;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS certification_name TEXT;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS issuing_body TEXT;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS issue_date DATE;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS expiry_date DATE;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS requires_re_review BOOLEAN DEFAULT false;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS is_hidden BOOLEAN DEFAULT false;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS template_id TEXT;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS signature_data TEXT;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS signed_at TIMESTAMPTZ;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE documents ADD COLUMN IF NOT EXISTS description TEXT;

-- Add index for efficient per-user queries
CREATE INDEX IF NOT EXISTS idx_documents_user_id ON documents(user_id);
CREATE INDEX IF NOT EXISTS idx_documents_type ON documents(type);
CREATE INDEX IF NOT EXISTS idx_documents_status ON documents(status);

-- Enable Row-Level Security if not already enabled
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if recreating
DROP POLICY IF EXISTS "Talents can view their own documents" ON documents;
DROP POLICY IF EXISTS "Talents can insert their own documents" ON documents;
DROP POLICY IF EXISTS "Talents can update their own documents" ON documents;
DROP POLICY IF EXISTS "Admins can view all documents" ON documents;

-- RLS Policies
-- Talents see only their own docs (via user_id match on auth.uid())
CREATE POLICY "Talents can view their own documents"
  ON documents FOR SELECT
  USING (user_id = auth.uid()::text OR user_id = (SELECT id FROM talent_profiles WHERE user_id = auth.uid()::text LIMIT 1));

CREATE POLICY "Talents can insert their own documents"
  ON documents FOR INSERT
  WITH CHECK (user_id = auth.uid()::text OR user_id = (SELECT id FROM talent_profiles WHERE user_id = auth.uid()::text LIMIT 1));

CREATE POLICY "Talents can update their own documents"
  ON documents FOR UPDATE
  USING (user_id = auth.uid()::text OR user_id = (SELECT id FROM talent_profiles WHERE user_id = auth.uid()::text LIMIT 1));

-- Admins can view all documents (role check)
CREATE POLICY "Admins can view all documents"
  ON documents FOR ALL
  USING ((SELECT role FROM users WHERE id = auth.uid()::text) = 'admin');
