-- KC-REQUESTS: Add request_id to messages
-- Run this in your Supabase SQL Editor

ALTER TABLE public.messages
ADD COLUMN IF NOT EXISTS request_id TEXT REFERENCES public.talent_requests(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_messages_request_id ON public.messages(request_id);
