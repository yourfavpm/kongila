-- KC-MATCHED: Matches Table Migration
-- Run this in your Supabase SQL Editor

-- 1. Add status column to talent_requests if it doesn't exist
ALTER TABLE public.talent_requests
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'new',
  ADD COLUMN IF NOT EXISTS role_description TEXT,
  ADD COLUMN IF NOT EXISTS title TEXT;

-- 2. Create the matches table
CREATE TABLE IF NOT EXISTS public.matches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id TEXT REFERENCES public.talent_requests(id) ON DELETE CASCADE,
    talent_id TEXT NOT NULL,
    match_score DECIMAL(5,2) DEFAULT 0,
    skill_fit_score DECIMAL(5,2) DEFAULT 0,
    behaviour_fit_score DECIMAL(5,2) DEFAULT 0,
    personality_fit_score DECIMAL(5,2) DEFAULT 0,
    availability_score DECIMAL(5,2) DEFAULT 0,
    performance_history_score DECIMAL(5,2) DEFAULT 0,
    status TEXT DEFAULT 'submitted_to_client',
    client_rejection_reason TEXT,
    shortlisted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Enable RLS
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;

-- 4. Allow admins to manage all matches
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'matches' AND policyname = 'Admins can manage all matches'
  ) THEN
    CREATE POLICY "Admins can manage all matches"
      ON public.matches FOR ALL
      USING (
        EXISTS (
          SELECT 1 FROM public.users
          WHERE id = auth.uid()::text
          AND (role = 'admin' OR role = 'ops_manager' OR role = 'talent_manager')
        )
      );
  END IF;
END
$$;

-- 5. Allow clients to view matches for their own requests
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'matches' AND policyname = 'Clients can view their own request matches'
  ) THEN
    CREATE POLICY "Clients can view their own request matches"
      ON public.matches FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM public.talent_requests tr
          JOIN public.client_profiles cp ON cp.user_id = auth.uid()::text
          WHERE tr.id::text = matches.request_id::text
          AND tr.client_id::text = auth.uid()::text
        )
      );
  END IF;
END
$$;

-- 6. Allow clients to update match status (shortlist / reject) on their own requests
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'matches' AND policyname = 'Clients can update match status for their requests'
  ) THEN
    CREATE POLICY "Clients can update match status for their requests"
      ON public.matches FOR UPDATE
      USING (
        EXISTS (
          SELECT 1 FROM public.talent_requests tr
          WHERE tr.id::text = matches.request_id::text
          AND tr.client_id::text = auth.uid()::text
        )
      )
      WITH CHECK (
        status IN ('shortlisted', 'rejected_by_client', 'submitted_to_client', 'accepted')
      );
  END IF;
END
$$;

-- 7. Seed test data (optional - uncomment and fill in real UUIDs to test)
-- INSERT INTO public.talent_requests (id, client_id, service_type, status, title, role_description, payload)
-- VALUES ('YOUR-REQUEST-UUID', 'YOUR-CLIENT-USER-ID', 'Engineering', 'candidates_ready', 'Senior Backend Engineer', 'Senior Node.js engineer with 5+ years', '{}');
--
-- INSERT INTO public.matches (request_id, talent_id, match_score, skill_fit_score, behaviour_fit_score, status)
-- VALUES ('YOUR-REQUEST-UUID', 'YOUR-TALENT-USER-ID', 92.5, 95, 88, 'submitted_to_client');
