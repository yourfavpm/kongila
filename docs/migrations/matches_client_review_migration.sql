-- KC-MATCHED: Migration for Matches Table Client Rejection features
-- Run this in your Supabase SQL Editor

ALTER TABLE public.matches 
ADD COLUMN IF NOT EXISTS client_rejection_reason TEXT;

-- We don't strictly enforce an enum change here to avoid breaking existing queries that expect TEXT,
-- but the new statuses in the system will be: 'submitted_to_client', 'rejected_by_client', 'accepted'.
