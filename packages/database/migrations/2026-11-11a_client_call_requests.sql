-- Proposed schema for the per-role client-call workflow.
-- Do not apply to the live database until reviewed and backed up.
create table if not exists client_call_requests (
  id              text primary key default (gen_random_uuid())::text,
  request_id      uuid not null references talent_requests(id),
  requested_by    text not null,
  responded_by    text,
  status          text not null default 'requested',
  agenda          text,
  timezone        text not null default 'UTC',
  preferred_times jsonb not null default '[]'::jsonb,
  client_note     text,
  scheduled_at    timestamptz,
  meeting_link    text,
  responded_at    timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint client_call_requests_status_check
    check (status in ('requested', 'client_responded', 'scheduled', 'cancelled'))
);

create index if not exists client_call_requests_request_status_idx
  on client_call_requests (request_id, status);

create unique index if not exists client_call_requests_one_open_per_request_idx
  on client_call_requests (request_id)
  where status in ('requested', 'client_responded');

alter table client_call_requests enable row level security;
revoke all on client_call_requests from anon, authenticated;
grant all on client_call_requests to service_role;
