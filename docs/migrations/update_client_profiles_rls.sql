-- Drop the existing policy that restricts viewing client_profiles to only the owner
DROP POLICY IF EXISTS "Allow authenticated users to view their client profile" ON public.client_profiles;

-- Create a new policy that allows all authenticated users (including admins) to view client_profiles
-- This ensures the admin panel can fetch client profile mappings for the CRM
CREATE POLICY "Allow authenticated users to view all client profiles" 
ON public.client_profiles FOR SELECT TO authenticated 
USING (true);
