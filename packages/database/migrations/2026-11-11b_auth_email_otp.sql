-- Server-only, short-lived email verification and password-recovery codes.
-- Apply this migration in Supabase before enabling the custom OTP endpoints.
-- OTP values are HMACed in the application and are never stored as plaintext.

create table if not exists public.auth_email_otp_challenges (
  id                    uuid primary key default gen_random_uuid(),
  email                 text not null,
  purpose               text not null check (purpose in ('signup', 'password_reset')),
  code_hash             text not null,
  attempts              integer not null default 0 check (attempts between 0 and 5),
  send_window_started_at timestamptz not null default now(),
  send_count            integer not null default 1 check (send_count between 1 and 5),
  last_sent_at          timestamptz not null default now(),
  expires_at            timestamptz not null,
  consumed_at           timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  constraint auth_email_otp_challenges_email_purpose_key unique (email, purpose)
);

alter table public.auth_email_otp_challenges enable row level security;
revoke all on table public.auth_email_otp_challenges from anon, authenticated;
grant all on table public.auth_email_otp_challenges to service_role;

create table if not exists public.auth_email_otp_ip_limits (
  ip_hash               text primary key,
  window_started_at     timestamptz not null,
  request_count         integer not null default 0 check (request_count >= 0),
  last_requested_at     timestamptz not null
);

alter table public.auth_email_otp_ip_limits enable row level security;
revoke all on table public.auth_email_otp_ip_limits from anon, authenticated;
grant all on table public.auth_email_otp_ip_limits to service_role;

create or replace function public.consume_auth_email_otp_ip_limit(
  p_ip_hash text,
  p_now timestamptz,
  p_limit integer,
  p_window_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_count integer;
begin
  if p_ip_hash !~ '^[a-f0-9]{64}$'
     or p_limit < 1
     or p_window_seconds < 1 then
    raise exception 'Invalid email OTP rate-limit input';
  end if;

  insert into public.auth_email_otp_ip_limits (
    ip_hash, window_started_at, request_count, last_requested_at
  )
  values (p_ip_hash, p_now, 1, p_now)
  on conflict (ip_hash) do update
    set request_count = case
          when public.auth_email_otp_ip_limits.window_started_at
            <= p_now - (p_window_seconds * interval '1 second')
          then 1
          else public.auth_email_otp_ip_limits.request_count + 1
        end,
        window_started_at = case
          when public.auth_email_otp_ip_limits.window_started_at
            <= p_now - (p_window_seconds * interval '1 second')
          then p_now
          else public.auth_email_otp_ip_limits.window_started_at
        end,
        last_requested_at = p_now
  returning request_count into v_count;

  return v_count <= p_limit;
end;
$$;

revoke all on function public.consume_auth_email_otp_ip_limit(text, timestamptz, integer, integer)
  from public, anon, authenticated;
grant execute on function public.consume_auth_email_otp_ip_limit(text, timestamptz, integer, integer)
  to service_role;
