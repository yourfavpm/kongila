-- ============================================================================
-- Add missing columns to 'interviews' table to match frontend Interview schema
-- ============================================================================

ALTER TABLE public.interviews
ADD COLUMN IF NOT EXISTS match_id TEXT,
ADD COLUMN IF NOT EXISTS talent_name TEXT,
ADD COLUMN IF NOT EXISTS talent_avatar TEXT,
ADD COLUMN IF NOT EXISTS client_name TEXT,
ADD COLUMN IF NOT EXISTS date TEXT,
ADD COLUMN IF NOT EXISTS time TEXT,
ADD COLUMN IF NOT EXISTS notes TEXT,
ADD COLUMN IF NOT EXISTS talent_notes TEXT,
ADD COLUMN IF NOT EXISTS client_feedback TEXT,
ADD COLUMN IF NOT EXISTS outcome TEXT,
ADD COLUMN IF NOT EXISTS google_calendar_event_id TEXT,
ADD COLUMN IF NOT EXISTS google_calendar_link TEXT,
ADD COLUMN IF NOT EXISTS reschedule_requested BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS reschedule_reason TEXT,
ADD COLUMN IF NOT EXISTS proposed_new_date TEXT,
ADD COLUMN IF NOT EXISTS proposed_new_time TEXT;

-- Update the existing 'admin_outcome' checks or move to 'outcome' if necessary
-- For now, adding 'outcome' to handle the frontend mapping perfectly.
