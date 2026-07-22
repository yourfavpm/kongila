-- ============================================================================
-- Add missing columns to 'interviews' table to match frontend Interview schema
-- ============================================================================

-- First, change 'id' and 'request_id' to TEXT to support the frontend's string formats (e.g. 'int_12345')
-- Also make request_id nullable since internal vetting interviews don't have a client request attached.
ALTER TABLE public.interviews ALTER COLUMN id TYPE TEXT USING id::TEXT;
ALTER TABLE public.interviews ALTER COLUMN request_id TYPE TEXT USING request_id::TEXT;
ALTER TABLE public.interviews ALTER COLUMN request_id DROP NOT NULL;

-- Now add all the missing columns required by the UI
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

-- For existing missing interviews, we can generate a temporary uuid if needed, 
-- but since we changed it to TEXT, the UI's 'int_12345' format will now save successfully!
