-- docs/migrations/add_assignment_columns_to_talent_requests.sql
-- Adds dedicated talent_manager_id and account_manager_id columns to talent_requests
-- so that assignments are persisted as first-class columns, not buried in the JSON payload.

ALTER TABLE public.talent_requests
  ADD COLUMN IF NOT EXISTS talent_manager_id TEXT REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS account_manager_id TEXT REFERENCES public.users(id) ON DELETE SET NULL;

-- Backfill from existing payload data where the assignment was already saved in JSON
UPDATE public.talent_requests
SET
  talent_manager_id = COALESCE(
    talent_manager_id,
    payload->>'assignedTalentManagerId'
  ),
  account_manager_id = COALESCE(
    account_manager_id,
    payload->>'assignedAccountManagerId'
  )
WHERE
  payload->>'assignedTalentManagerId' IS NOT NULL
  OR payload->>'assignedAccountManagerId' IS NOT NULL;

-- Allow admins to update the new columns
-- (covered by existing "Admins can update talent requests" policy)
