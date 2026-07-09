-- KT-DOCS: Audit Logs Migration
-- Run this in your Supabase SQL Editor

CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor TEXT NOT NULL,
    action TEXT NOT NULL,
    details TEXT,
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to insert logs
CREATE POLICY "Authenticated users can insert audit logs"
  ON public.audit_logs FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Allow admins to view all logs
CREATE POLICY "Admins can view audit logs"
  ON public.audit_logs FOR SELECT
  USING ((SELECT role FROM public.users WHERE id = auth.uid()::text) = 'admin');

-- Also, execute this command to elevate the admin user AFTER you run the seed_admin.js script:
-- UPDATE public.users SET role = 'admin' WHERE email = 'admin@kongila.co';
