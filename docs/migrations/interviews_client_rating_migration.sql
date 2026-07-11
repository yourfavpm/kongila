-- KC-INTERVIEW: Migration for Interviews Table Client Rating features
-- Run this in your Supabase SQL Editor

ALTER TABLE public.interviews 
ADD COLUMN IF NOT EXISTS client_rating INTEGER,
ADD COLUMN IF NOT EXISTS client_feedback TEXT;
