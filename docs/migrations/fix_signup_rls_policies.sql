-- fix_signup_rls_policies.sql

-- 1. organizations
DROP POLICY IF EXISTS "Allow authenticated users to insert organizations" ON public.organizations;
CREATE POLICY "Allow authenticated users to insert organizations" 
ON public.organizations FOR INSERT TO authenticated 
WITH CHECK (created_by = auth.uid()::text);

DROP POLICY IF EXISTS "Allow authenticated users to update their organizations" ON public.organizations;
CREATE POLICY "Allow authenticated users to update their organizations" 
ON public.organizations FOR UPDATE TO authenticated 
USING (created_by = auth.uid()::text);

DROP POLICY IF EXISTS "Allow authenticated users to view all organizations" ON public.organizations;
CREATE POLICY "Allow authenticated users to view all organizations" 
ON public.organizations FOR SELECT TO authenticated 
USING (true);

-- 2. client_profiles
DROP POLICY IF EXISTS "Allow authenticated users to insert their client profile" ON public.client_profiles;
CREATE POLICY "Allow authenticated users to insert their client profile" 
ON public.client_profiles FOR INSERT TO authenticated 
WITH CHECK (user_id = auth.uid()::text);

DROP POLICY IF EXISTS "Allow authenticated users to update their client profile" ON public.client_profiles;
CREATE POLICY "Allow authenticated users to update their client profile" 
ON public.client_profiles FOR UPDATE TO authenticated 
USING (user_id = auth.uid()::text);

DROP POLICY IF EXISTS "Allow authenticated users to view their client profile" ON public.client_profiles;
CREATE POLICY "Allow authenticated users to view their client profile" 
ON public.client_profiles FOR SELECT TO authenticated 
USING (user_id = auth.uid()::text);

-- 3. talent_profiles
DROP POLICY IF EXISTS "Allow authenticated users to insert their talent profile" ON public.talent_profiles;
CREATE POLICY "Allow authenticated users to insert their talent profile" 
ON public.talent_profiles FOR INSERT TO authenticated 
WITH CHECK (id = auth.uid()::text OR user_id = auth.uid()::text);

DROP POLICY IF EXISTS "Allow authenticated users to update their talent profile" ON public.talent_profiles;
CREATE POLICY "Allow authenticated users to update their talent profile" 
ON public.talent_profiles FOR UPDATE TO authenticated 
USING (id = auth.uid()::text OR user_id = auth.uid()::text);

DROP POLICY IF EXISTS "Allow authenticated users to view their talent profile" ON public.talent_profiles;
CREATE POLICY "Allow authenticated users to view their talent profile" 
ON public.talent_profiles FOR SELECT TO authenticated 
USING (id = auth.uid()::text OR user_id = auth.uid()::text);

-- 4. user_roles
DROP POLICY IF EXISTS "Allow authenticated users to insert their roles" ON public.user_roles;
CREATE POLICY "Allow authenticated users to insert their roles" 
ON public.user_roles FOR INSERT TO authenticated 
WITH CHECK (user_id = auth.uid()::text);

DROP POLICY IF EXISTS "Allow authenticated users to update their roles" ON public.user_roles;
CREATE POLICY "Allow authenticated users to update their roles" 
ON public.user_roles FOR UPDATE TO authenticated 
USING (user_id = auth.uid()::text);

DROP POLICY IF EXISTS "Allow authenticated users to view their roles" ON public.user_roles;
CREATE POLICY "Allow authenticated users to view their roles" 
ON public.user_roles FOR SELECT TO authenticated 
USING (user_id = auth.uid()::text);

-- 5. users (public)
DROP POLICY IF EXISTS "Allow authenticated users to insert their user record" ON public.users;
CREATE POLICY "Allow authenticated users to insert their user record" 
ON public.users FOR INSERT TO authenticated 
WITH CHECK (id = auth.uid()::text);

DROP POLICY IF EXISTS "Allow authenticated users to update their user record" ON public.users;
CREATE POLICY "Allow authenticated users to update their user record" 
ON public.users FOR UPDATE TO authenticated 
USING (id = auth.uid()::text);

DROP POLICY IF EXISTS "Allow authenticated users to view their user record" ON public.users;
CREATE POLICY "Allow authenticated users to view their user record" 
ON public.users FOR SELECT TO authenticated 
USING (id = auth.uid()::text);
