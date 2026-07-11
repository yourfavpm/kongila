-- Create Conversations table
CREATE TABLE IF NOT EXISTS public.conversations (
    id TEXT PRIMARY KEY DEFAULT ('conv_' || substr(md5(random()::text), 1, 10)),
    client_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    admin_id TEXT REFERENCES public.users(id) ON DELETE SET NULL,
    context_type TEXT CHECK (context_type IN ('service_request', 'contract', 'invoice', 'general')),
    context_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure we don't have duplicate scoped conversations
CREATE UNIQUE INDEX IF NOT EXISTS idx_conversations_context ON public.conversations(client_id, context_type, context_id) WHERE context_type != 'general';

-- Add new columns to existing messages table
ALTER TABLE public.messages 
ADD COLUMN IF NOT EXISTS conversation_id TEXT REFERENCES public.conversations(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS is_read BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS attachment_url TEXT;

-- Enable RLS for conversations
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

-- Clients can view their own conversations
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'conversations' AND policyname = 'Clients can view their own conversations') THEN
    CREATE POLICY "Clients can view their own conversations" ON public.conversations FOR SELECT USING (client_id = auth.uid()::text);
END IF; END $$;

-- Clients can create conversations
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'conversations' AND policyname = 'Clients can create conversations') THEN
    CREATE POLICY "Clients can create conversations" ON public.conversations FOR INSERT WITH CHECK (client_id = auth.uid()::text);
END IF; END $$;

-- Admins can view/update all conversations
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'conversations' AND policyname = 'Admins can access all conversations') THEN
    CREATE POLICY "Admins can access all conversations" ON public.conversations FOR ALL USING (
        EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid()::text AND (role = 'admin' OR role = 'ops_manager'))
    );
END IF; END $$;

-- Enable RLS for messages (assuming already enabled, but safe to run)
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Storage Bucket for Message Attachments
INSERT INTO storage.buckets (id, name, public) 
VALUES ('message_attachments', 'message_attachments', true)
ON CONFLICT (id) DO NOTHING;

-- Storage Policies
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND policyname = 'Anyone can view message attachments') THEN
    CREATE POLICY "Anyone can view message attachments" ON storage.objects FOR SELECT USING (bucket_id = 'message_attachments');
END IF; END $$;

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND policyname = 'Authenticated users can upload attachments') THEN
    CREATE POLICY "Authenticated users can upload attachments" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'message_attachments' AND auth.role() = 'authenticated');
END IF; END $$;

-- Seed script to backfill existing messages into conversations
DO $$
DECLARE
    client_record RECORD;
    new_conv_id TEXT;
BEGIN
    FOR client_record IN SELECT id FROM public.users WHERE role = 'client' LOOP
        -- Create a 'general' conversation for each client if not exists
        IF NOT EXISTS (SELECT 1 FROM public.conversations WHERE client_id = client_record.id AND context_type = 'general') THEN
            INSERT INTO public.conversations (client_id, admin_id, context_type)
            VALUES (client_record.id, 'usr_michael', 'general')
            RETURNING id INTO new_conv_id;
            
            -- Assign existing un-assigned messages to this general conversation
            UPDATE public.messages SET conversation_id = new_conv_id 
            WHERE (sender_id = client_record.id OR receiver_id = client_record.id) AND conversation_id IS NULL AND request_id IS NULL;
        END IF;

        -- Create scoped conversations for messages that already had a request_id
        -- We won't strictly enforce this in the seed script to avoid complex grouping, 
        -- but this handles the basics.
    END LOOP;
END $$;
