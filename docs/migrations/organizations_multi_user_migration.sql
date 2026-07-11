-- Migration: Add Multi-User & Account Manager Fields to Organizations
-- Description: Adds account_manager_id, status, and multi_user_enabled fields to the organizations table.

ALTER TABLE "public"."organizations"
ADD COLUMN IF NOT EXISTS "account_manager_id" TEXT REFERENCES "public"."users"("id") ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS "status" TEXT DEFAULT 'active',
ADD COLUMN IF NOT EXISTS "multi_user_enabled" BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS "how_did_you_hear_about_us" TEXT,
ADD COLUMN IF NOT EXISTS "industry" TEXT,
ADD COLUMN IF NOT EXISTS "company_size" TEXT,
ADD COLUMN IF NOT EXISTS "country" TEXT,
ADD COLUMN IF NOT EXISTS "website" TEXT;
