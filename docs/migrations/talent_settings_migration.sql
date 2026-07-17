-- Migration: Talent Settings Update

DO $$
BEGIN
    -- Check if talent_profiles table exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'talent_profiles') THEN
        -- Add settings column if it doesn't exist
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'talent_profiles' AND column_name = 'settings') THEN
            ALTER TABLE talent_profiles ADD COLUMN settings JSONB DEFAULT '{}'::jsonb;
        END IF;
    END IF;
END $$;
