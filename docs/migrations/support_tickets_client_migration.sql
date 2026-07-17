-- Migration: Support Tickets Client Update

DO $$
BEGIN
    -- Check if support_tickets table exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'support_tickets') THEN
        CREATE TABLE support_tickets (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            talent_id TEXT REFERENCES users(id),
            client_id TEXT REFERENCES users(id),
            linked_contract_id TEXT REFERENCES contracts(id),
            assigned_to TEXT,
            subject TEXT NOT NULL,
            category TEXT NOT NULL,
            status TEXT NOT NULL,
            priority TEXT NOT NULL,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            last_activity TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
    ELSE
        -- If it exists, add new columns
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'support_tickets' AND column_name = 'client_id') THEN
            ALTER TABLE support_tickets ADD COLUMN client_id TEXT REFERENCES users(id);
        END IF;

        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'support_tickets' AND column_name = 'linked_contract_id') THEN
            ALTER TABLE support_tickets ADD COLUMN linked_contract_id TEXT REFERENCES contracts(id);
        END IF;

        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'support_tickets' AND column_name = 'assigned_to') THEN
            ALTER TABLE support_tickets ADD COLUMN assigned_to TEXT;
        END IF;
    END IF;
END $$;
