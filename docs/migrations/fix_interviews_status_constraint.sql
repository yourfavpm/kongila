-- Drop the existing constraint
ALTER TABLE public.interviews DROP CONSTRAINT IF EXISTS interviews_status_check;

-- Add the new constraint with 'Reschedule Requested' allowed
ALTER TABLE public.interviews ADD CONSTRAINT interviews_status_check 
CHECK (status IN ('pending_confirmation', 'scheduled', 'completed', 'cancelled', 'Scheduled', 'Completed', 'Cancelled', 'Reschedule Requested'));
