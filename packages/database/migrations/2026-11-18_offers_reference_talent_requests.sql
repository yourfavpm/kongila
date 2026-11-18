-- Offers belong to the request rows the portals actually create. The old
-- constraint referenced the retired service_requests table, so inserting an
-- offer for a valid talent_requests row failed its foreign-key check.
--
-- Keep request_id as text to preserve the existing API and any historical
-- identifiers. id_text is a generated representation of the UUID primary key
-- and gives the text reference a proper unique target. NOT VALID preserves
-- legacy offer rows that may still refer only to service_requests; new and
-- updated offers are checked against talent_requests.

begin;

alter table public.talent_requests
  add column if not exists id_text text generated always as (id::text) stored;

create unique index if not exists talent_requests_id_text_uidx
  on public.talent_requests (id_text);

alter table public.offers
  drop constraint if exists offers_request_id_fkey;

alter table public.offers
  alter column request_id type text using request_id::text;

-- Earlier request payloads sometimes exposed payload.id instead of the row
-- primary key. Normalize matching offers so their foreign key uses the
-- persisted request row id. Unmatched historical rows remain untouched.
update public.offers as offer
set request_id = request.id::text
from public.talent_requests as request
where offer.request_id = request.payload->>'id'
  and offer.request_id is distinct from request.id::text;

alter table public.offers
  add constraint offers_request_id_fkey
  foreign key (request_id)
  references public.talent_requests (id_text)
  on delete cascade
  not valid;

comment on column public.talent_requests.id_text is
  'Text representation of the request UUID for compatible foreign keys from text-based workflow records.';

commit;
