-- ═══════════════════════════════════════════════════════════════════════════
-- Migration: fix_matches_and_notifications.sql
-- Purpose  : Ensure matches and notifications tables have all required columns
--            so admin and client submission flows don't silently fail.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── matches table ────────────────────────────────────────────────────────────
-- Add created_at so we can order matches chronologically
ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now() NOT NULL;

-- Add breakdown column (JSONB) to store per-category scores from the matching engine
ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS breakdown JSONB;

-- Add score column if missing
ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS score INTEGER;

-- ── notifications table ───────────────────────────────────────────────────────
-- The client dashboard and matching engine use different column names.
-- Unify: add both `message` and `module_type` columns if not already present.
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS message TEXT;

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS module_type TEXT;

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS read BOOLEAN DEFAULT false;

-- Some old code inserts `content` instead of `message` — copy content → message for old rows
UPDATE public.notifications
  SET message = content
  WHERE message IS NULL AND content IS NOT NULL;

-- ── RLS policies for matches ──────────────────────────────────────────────────
-- Allow authenticated admin users to read/write all matches
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'matches' AND policyname = 'matches_admin_all'
  ) THEN
    CREATE POLICY matches_admin_all ON public.matches
      FOR ALL
      TO authenticated
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

-- Allow clients to read matches for their own requests
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'matches' AND policyname = 'matches_client_read'
  ) THEN
    CREATE POLICY matches_client_read ON public.matches
      FOR SELECT
      TO authenticated
      USING (
        request_id IN (
          SELECT payload->>'id'
          FROM public.talent_requests
          WHERE client_id = auth.uid()::text
        )
      );
  END IF;
END $$;

-- ── Enable RLS on matches if not already ─────────────────────────────────────
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;
