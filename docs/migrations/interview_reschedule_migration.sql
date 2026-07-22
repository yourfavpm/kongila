-- Add reschedule workflow fields to interviews table
ALTER TABLE interviews 
ADD COLUMN IF NOT EXISTS reschedule_requested BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS reschedule_reason TEXT,
ADD COLUMN IF NOT EXISTS proposed_new_date TEXT,
ADD COLUMN IF NOT EXISTS proposed_new_time TEXT;
