-- Client reviews of a placed candidate.
--
-- The review modal in the client portal wrote nothing. It inserted two rows
-- into notifications, one public and one marked confidential, both addressed
-- to the client who wrote them. The notifications table denies browser
-- writes, so neither landed, and even had they landed the rating lived in a
-- sentence of message text that nothing could read back.
--
-- See docs/migrations-2026-11-04.md for the longer note.
--
-- Safe to run more than once.

do $mig$
begin

  if to_regclass('public.client_talent_reviews') is null then
    create table public.client_talent_reviews (
      id varchar primary key default (gen_random_uuid())::text,
      client_id varchar not null,
      talent_id varchar not null,
      contract_id varchar,
      rating integer not null,
      technical_score integer,
      communication_score integer,
      reliability_score integer,
      public_feedback text,
      -- Operations only. Never returned to a candidate.
      private_feedback text,
      is_anonymous boolean not null default false,
      created_at timestamptz not null default now()
    );
  end if;

  -- Ratings are out of five everywhere in the product.
  if not exists (
    select 1 from pg_constraint where conname = 'client_talent_reviews_rating_check'
  ) then
    alter table public.client_talent_reviews
      add constraint client_talent_reviews_rating_check
      check (rating between 1 and 5);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'client_talent_reviews_subscores_check'
  ) then
    alter table public.client_talent_reviews
      add constraint client_talent_reviews_subscores_check
      check (
        (technical_score is null or technical_score between 1 and 5)
        and (communication_score is null or communication_score between 1 and 5)
        and (reliability_score is null or reliability_score between 1 and 5)
      );
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'client_talent_reviews_client_fkey'
  ) then
    alter table public.client_talent_reviews
      add constraint client_talent_reviews_client_fkey
      foreign key (client_id) references public.users (id) on delete cascade;
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'client_talent_reviews_talent_fkey'
  ) then
    alter table public.client_talent_reviews
      add constraint client_talent_reviews_talent_fkey
      foreign key (talent_id) references public.talent_profiles (id) on delete cascade;
  end if;

  create index if not exists client_talent_reviews_talent_idx
    on public.client_talent_reviews (talent_id);
  create index if not exists client_talent_reviews_client_idx
    on public.client_talent_reviews (client_id);

  -- One review per client per candidate. A second submission updates it
  -- rather than stacking duplicates in the average.
  create unique index if not exists client_talent_reviews_pair_idx
    on public.client_talent_reviews (client_id, talent_id);

end
$mig$;

-- Nothing reaches this table from a browser. Every read and write goes
-- through the server, which holds the service role key.
alter table public.client_talent_reviews enable row level security;
