-- Create Interviews Table
CREATE TABLE public.interviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id UUID NOT NULL,
    talent_id TEXT NOT NULL,
    client_id TEXT NOT NULL,
    title TEXT,
    scheduled_time TIMESTAMPTZ,
    duration_minutes INTEGER DEFAULT 30,
    status TEXT DEFAULT 'pending_confirmation' CHECK (status IN ('pending_confirmation', 'scheduled', 'completed', 'cancelled')),
    meeting_link TEXT,
    client_rating INTEGER CHECK (client_rating >= 1 AND client_rating <= 5),
    client_notes TEXT,
    admin_outcome TEXT CHECK (admin_outcome IN ('Proceed to Hire', 'No Fit', 'Hold')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Turn on RLS
ALTER TABLE public.interviews ENABLE ROW LEVEL SECURITY;

-- Clients can view their own interviews
CREATE POLICY "Clients can view their own interviews"
    ON public.interviews FOR SELECT
    USING (client_id = auth.uid()::text);

-- Talents can view their own interviews
CREATE POLICY "Talents can view their own interviews"
    ON public.interviews FOR SELECT
    USING (talent_id = auth.uid()::text);

-- Admins can view all interviews
CREATE POLICY "Admins can view all interviews"
    ON public.interviews FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid()::text
            AND (role = 'admin' OR role = 'ops_manager')
        )
    );

-- Clients can create interviews for themselves
CREATE POLICY "Clients can create interviews"
    ON public.interviews FOR INSERT
    WITH CHECK (client_id = auth.uid()::text);

-- Clients can update their own interviews (e.g. reschedule, cancel, rate)
CREATE POLICY "Clients can update their own interviews"
    ON public.interviews FOR UPDATE
    USING (client_id = auth.uid()::text)
    WITH CHECK (client_id = auth.uid()::text);

-- Talents can update their own interviews (e.g. accept/confirm)
CREATE POLICY "Talents can update their own interviews"
    ON public.interviews FOR UPDATE
    USING (talent_id = auth.uid()::text)
    WITH CHECK (talent_id = auth.uid()::text);

-- Admins can update all interviews
CREATE POLICY "Admins can update all interviews"
    ON public.interviews FOR UPDATE
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
