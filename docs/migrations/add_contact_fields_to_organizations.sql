-- docs/migrations/add_contact_fields_to_organizations.sql

ALTER TABLE public.organizations
ADD COLUMN IF NOT EXISTS contact_email VARCHAR(255),
ADD COLUMN IF NOT EXISTS contact_phone VARCHAR(50);
