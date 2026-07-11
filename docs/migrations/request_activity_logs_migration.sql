-- KC-REQUESTS: Activity Logs for Talent Requests
-- Run this in your Supabase SQL Editor

CREATE TABLE IF NOT EXISTS public.request_activity_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id TEXT REFERENCES public.talent_requests(id) ON DELETE CASCADE,
    actor_id TEXT REFERENCES public.users(id) ON DELETE SET NULL,
    action_type TEXT NOT NULL,
    field_changes JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.request_activity_logs ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to view logs for requests they own
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'request_activity_logs' AND policyname = 'Clients can view logs for their own requests'
  ) THEN
    CREATE POLICY "Clients can view logs for their own requests"
      ON public.request_activity_logs FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM public.talent_requests tr
          WHERE tr.id::text = request_activity_logs.request_id::text
          AND tr.client_id::text = auth.uid()::text
        )
      );
  END IF;
END
$$;

-- Allow authenticated users to insert logs for requests they own
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'request_activity_logs' AND policyname = 'Clients can insert logs for their own requests'
  ) THEN
    CREATE POLICY "Clients can insert logs for their own requests"
      ON public.request_activity_logs FOR INSERT
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.talent_requests tr
          WHERE tr.id::text = request_activity_logs.request_id::text
          AND tr.client_id::text = auth.uid()::text
        )
      );
  END IF;
END
$$;

-- Admins can do anything
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'request_activity_logs' AND policyname = 'Admins manage request logs'
  ) THEN
    CREATE POLICY "Admins manage request logs"
      ON public.request_activity_logs FOR ALL
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
