-- Kongila staging/production schema reconciliation.
-- These fields are already part of the portal's persisted profile flows.
-- IF NOT EXISTS keeps this safe to apply after a partial deployment.

alter table public.talent_profiles
  add column if not exists settings jsonb not null default '{}'::jsonb;

alter table public.organizations
  add column if not exists how_did_you_hear_about_us text;
