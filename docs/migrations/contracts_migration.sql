-- Create contracts table
CREATE TABLE IF NOT EXISTS public.contracts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id TEXT NOT NULL,
    talent_id TEXT NOT NULL,
    role_title TEXT NOT NULL,
    start_date DATE,
    end_date DATE,
    engagement_type TEXT DEFAULT 'Full-time',
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'ended', 'terminated', 'closed')),
    client_monthly_fee_usd DECIMAL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;

-- Policy: Clients can view their own contracts
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'contracts' AND policyname = 'Clients can view their own contracts') THEN
CREATE POLICY "Clients can view their own contracts"
    ON public.contracts FOR SELECT
    USING (client_id = auth.uid()::text);
END IF; END $$;

-- Policy: Talents can view their own contracts
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'contracts' AND policyname = 'Talents can view their own contracts') THEN
CREATE POLICY "Talents can view their own contracts"
    ON public.contracts FOR SELECT
    USING (talent_id = auth.uid()::text);
END IF; END $$;

-- Policy: Clients can create contracts (or via system/admin)
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'contracts' AND policyname = 'Clients can create contracts') THEN
CREATE POLICY "Clients can create contracts"
    ON public.contracts FOR INSERT
    WITH CHECK (client_id = auth.uid()::text);
END IF; END $$;

-- Policy: Clients can update their own contracts (e.g. status)
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'contracts' AND policyname = 'Clients can update their own contracts') THEN
CREATE POLICY "Clients can update their own contracts"
    ON public.contracts FOR UPDATE
    USING (client_id = auth.uid()::text)
    WITH CHECK (client_id = auth.uid()::text);
END IF; END $$;

-- Admins
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'contracts' AND policyname = 'Admins can view all contracts'
  ) THEN
    CREATE POLICY "Admins can view all contracts"
        ON public.contracts FOR SELECT
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

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'contracts' AND policyname = 'Admins can update all contracts'
  ) THEN
    CREATE POLICY "Admins can update all contracts"
        ON public.contracts FOR UPDATE
        USING (
            EXISTS (
                SELECT 1 FROM public.users
                WHERE id = auth.uid()::text
                AND (role = 'admin' OR role = 'ops_manager')
            )
        )
        WITH CHECK (
            EXISTS (
                SELECT 1 FROM public.users
                WHERE id = auth.uid()::text
                AND (role = 'admin' OR role = 'ops_manager')
            )
        );
  END IF;
END
$$;
