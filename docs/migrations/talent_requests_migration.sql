-- KT-DOCS: Talent Requests Migration
-- Run this in your Supabase SQL Editor to ensure the talent_requests table and policies are correctly configured.

CREATE TABLE IF NOT EXISTS public.talent_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id TEXT NOT NULL,
    service_type TEXT NOT NULL,
    payload JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.talent_requests ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users (clients) to insert their own requests
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'talent_requests' AND policyname = 'Clients can insert their own talent requests'
  ) THEN
    CREATE POLICY "Clients can insert their own talent requests"
      ON public.talent_requests FOR INSERT
      WITH CHECK (auth.uid() IS NOT NULL);
  END IF;
END
$$;

-- Allow admins to view all talent requests
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'talent_requests' AND policyname = 'Admins can view all talent requests'
  ) THEN
    CREATE POLICY "Admins can view all talent requests"
      ON public.talent_requests FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM public.users 
          WHERE id = auth.uid()::text 
          AND (role = 'admin' OR role = 'ops_manager')
        )
      );
  END IF;
END
$$;

-- Allow admins to update talent requests
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'talent_requests' AND policyname = 'Admins can update talent requests'
  ) THEN
    CREATE POLICY "Admins can update talent requests"
      ON public.talent_requests FOR UPDATE
      USING (
        EXISTS (
          SELECT 1 FROM public.users 
          WHERE id = auth.uid()::text 
          AND (role = 'admin' OR role = 'ops_manager')
        )
      );
  END IF;
END
$$;
