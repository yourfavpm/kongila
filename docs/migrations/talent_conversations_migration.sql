-- Migration: Talent Conversations and Messages Update

DO $$
BEGIN
    -- Create conversations table
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'conversations') THEN
        CREATE TABLE conversations (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            type TEXT NOT NULL, -- 'talent_admin' or 'client_admin'
            participant_ids TEXT[] NOT NULL DEFAULT '{}',
            context_type TEXT, -- 'vetting', 'request', 'contract'
            context_id TEXT,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
    END IF;

    -- Update messages table to link to conversations and support attachments/read receipts
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'messages') THEN
        -- Add conversation_id if missing
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'messages' AND column_name = 'conversation_id') THEN
            ALTER TABLE messages ADD COLUMN conversation_id UUID REFERENCES conversations(id);
        END IF;

        -- Remove receiver_id since participant_ids in conversation handles it (optional, but good for cleanup)
        -- IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'messages' AND column_name = 'receiver_id') THEN
        --     ALTER TABLE messages DROP COLUMN receiver_id;
        -- END IF;

        -- Add attachment_url
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'messages' AND column_name = 'attachment_url') THEN
            ALTER TABLE messages ADD COLUMN attachment_url TEXT;
        END IF;

        -- Add attachment_name
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'messages' AND column_name = 'attachment_name') THEN
            ALTER TABLE messages ADD COLUMN attachment_name TEXT;
        END IF;

        -- Rename read_status to is_read and change type (usually boolean is fine, but checking)
        -- To avoid breaking changes, we might just add is_read and read_at
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'messages' AND column_name = 'is_read') THEN
            ALTER TABLE messages ADD COLUMN is_read BOOLEAN DEFAULT FALSE;
        END IF;

        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'messages' AND column_name = 'read_at') THEN
            ALTER TABLE messages ADD COLUMN read_at TIMESTAMP WITH TIME ZONE;
        END IF;
    ELSE
        -- Create messages table if it doesn't exist
        CREATE TABLE messages (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            conversation_id UUID REFERENCES conversations(id),
            sender_id TEXT NOT NULL,
            content TEXT,
            attachment_url TEXT,
            attachment_name TEXT,
            is_read BOOLEAN DEFAULT FALSE,
            read_at TIMESTAMP WITH TIME ZONE,
            timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
    END IF;
END $$;
