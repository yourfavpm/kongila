-- KC-TEAM: Migration for My Team features
-- Run this in your Supabase SQL Editor

ALTER TABLE public.contracts 
ADD COLUMN IF NOT EXISTS termination_reason TEXT,
ADD COLUMN IF NOT EXISTS client_monthly_fee_usd NUMERIC,
ADD COLUMN IF NOT EXISTS performance_score NUMERIC;
