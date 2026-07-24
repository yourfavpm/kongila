-- docs/migrations/fix_client_profiles_rls.sql

-- Drop the restrictive policy that prevents admins from reading client_profiles
DROP POLICY IF EXISTS "Allow authenticated users to view their client profile" ON public.client_profiles;

-- Create a new permissive read policy so admins and clients can both query the profiles for CRM logic
CREATE POLICY "Allow authenticated users to view all client profiles" 
ON public.client_profiles FOR SELECT TO authenticated 
USING (true);
