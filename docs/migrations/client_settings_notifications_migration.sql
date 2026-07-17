-- Migration: Client Settings and Notifications Update

-- Add `settings` JSONB column to `client_profiles` if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'client_profiles'
        AND column_name = 'settings'
    ) THEN
        ALTER TABLE client_profiles ADD COLUMN settings JSONB DEFAULT '{
          "notifications": {
            "email": {
              "Requests": true,
              "Matches": true,
              "Interviews": true,
              "Contracts": true,
              "Billing": true,
              "Messages": true,
              "Marketing": false
            },
            "whatsapp": {
              "Requests": false,
              "Matches": true,
              "Interviews": true,
              "Contracts": false,
              "Billing": true,
              "Messages": true,
              "Marketing": false
            }
          },
          "paymentMethods": []
        }';
    END IF;
END $$;

-- Extend notifications table with category and source_record_id
DO $$
BEGIN
    -- Check if notifications table exists, create if not
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'notifications') THEN
        CREATE TABLE notifications (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            user_id UUID REFERENCES users(id),
            title TEXT NOT NULL,
            message TEXT NOT NULL,
            read BOOLEAN DEFAULT FALSE,
            category TEXT,
            source_record_id TEXT,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
    ELSE
        -- If it exists, add new columns
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notifications' AND column_name = 'category') THEN
            ALTER TABLE notifications ADD COLUMN category TEXT;
        END IF;

        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notifications' AND column_name = 'source_record_id') THEN
            ALTER TABLE notifications ADD COLUMN source_record_id TEXT;
        END IF;
    END IF;
END $$;
