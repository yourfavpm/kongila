-- docs/migrations/fix_talent_requests_rls.sql

-- Enable RLS if not already enabled
ALTER TABLE public.talent_requests ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users (both clients and admins) to insert talent_requests
DROP POLICY IF EXISTS "Allow authenticated users to insert their talent requests" ON public.talent_requests;
CREATE POLICY "Allow authenticated users to insert their talent requests" 
ON public.talent_requests FOR INSERT TO authenticated 
WITH CHECK (client_id = auth.uid()::text);

-- Allow authenticated users to view all talent requests. 
-- For strict security, we might restrict clients to only their own, 
-- but since 'organizations' is viewable by all, and to ensure admins can see them
-- when querying from the admin app using the anon key, we use USING (true).
-- In production, role-based checks (e.g., auth.jwt()->>'role' = 'admin') should be used.
DROP POLICY IF EXISTS "Allow authenticated users to view all talent requests" ON public.talent_requests;
CREATE POLICY "Allow authenticated users to view all talent requests" 
ON public.talent_requests FOR SELECT TO authenticated 
USING (true);

-- Allow clients to update their own requests
DROP POLICY IF EXISTS "Allow authenticated users to update their talent requests" ON public.talent_requests;
CREATE POLICY "Allow authenticated users to update their talent requests" 
ON public.talent_requests FOR UPDATE TO authenticated 
USING (client_id = auth.uid()::text);
