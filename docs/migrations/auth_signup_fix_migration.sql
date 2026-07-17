-- ============================================================
-- AUTH SIGNUP FIX MIGRATION
-- Purpose: The users.status CHECK constraint only allowed
-- ('active', 'suspended', 'inactive'). The signup code was
-- trying to insert 'onboarding' which violated the constraint.
--
-- This migration drops the old constraint and adds a new one
-- that allows 'inactive' for new talent accounts that are still
-- going through onboarding.
--
-- After running this: new talent signups will start with
-- status='inactive' and be updated to 'active' when they
-- complete onboarding.
-- ============================================================

-- Step 1: Drop the old check constraint on users.status
ALTER TABLE public.users
  DROP CONSTRAINT IF EXISTS users_status_check;

-- Step 2: Add an updated check constraint that includes all valid statuses
-- 'inactive' = talent user who has not completed onboarding yet
-- 'active'   = fully onboarded and active user
-- 'suspended' = administratively suspended account
ALTER TABLE public.users
  ADD CONSTRAINT users_status_check
  CHECK (status IN ('active', 'suspended', 'inactive'));

-- Step 3: Ensure any stuck 'onboarding' records (from before this fix)
-- are corrected to 'inactive' so onboarding can resume cleanly
UPDATE public.users
  SET status = 'inactive'
  WHERE status = 'onboarding';

-- Verification query (run after migration to confirm)
-- SELECT id, email, role, status FROM public.users ORDER BY created_at DESC LIMIT 20;
