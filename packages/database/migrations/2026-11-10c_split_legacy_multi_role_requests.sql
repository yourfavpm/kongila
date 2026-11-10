-- Kongila — split previously saved multi-role requests into per-role rows.
--
-- PROPOSED, NOT RUN. Back up the database and verify the live schema before
-- running this file. The base migration is not the source of truth for several
-- hand-created tables.
--
-- This preserves each original talent_requests row as role 1, including its
-- database id and any request_activity_logs. It creates rows for the remaining
-- roles. Matches, offers, and interviews are ambiguous on an aggregate request,
-- so the whole transaction aborts if any are linked to a row being split.
-- Only early-stage requests are eligible; later-stage rows require manual
-- review rather than copying one shared status across unrelated roles.

begin;
set local lock_timeout = '5s';

do $$
declare
  source_row record;
  role_row record;
  original_payload jsonb;
  original_roles jsonb;
  payload_request_id text;
  role_payload jsonb;
  role_id_text text;
  role_reference text;
  role_group_id text;
  role_title text;
  role_description text;
  role_skills jsonb;
  role_hires integer;
  role_count integer;
  source_status text;
  row_status text;
  row_created_at text;
  request_id_type text;
  payload_type text;
  column_type text;
  required_column text;
  linked_table_name text;
begin
  if to_regclass('public.talent_requests') is null then
    raise exception 'public.talent_requests is missing; no rows were changed';
  end if;

  foreach required_column in array array[
    'id', 'client_id', 'service_type', 'payload', 'status',
    'role_description', 'title', 'created_at'
  ] loop
    if not exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'talent_requests'
        and column_name = required_column
    ) then
      raise exception 'public.talent_requests.% is missing; no rows were changed', required_column;
    end if;
  end loop;

  select data_type into request_id_type
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'talent_requests'
    and column_name = 'id';

  if request_id_type not in ('uuid', 'text', 'character varying', 'character') then
    raise exception 'Unsupported talent_requests.id type (%); no rows were changed', request_id_type;
  end if;

  select data_type into payload_type
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'talent_requests'
    and column_name = 'payload';

  if payload_type <> 'jsonb' then
    raise exception 'Expected talent_requests.payload to be jsonb, found %; no rows were changed', payload_type;
  end if;

  select data_type into column_type
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'talent_requests'
    and column_name = 'created_at';

  if column_type not in ('timestamp with time zone', 'timestamp without time zone') then
    raise exception 'Unsupported talent_requests.created_at type (%); no rows were changed', column_type;
  end if;

  foreach linked_table_name in array array['matches', 'offers', 'interviews'] loop
    if to_regclass(format('public.%I', linked_table_name)) is null
      or not exists (
        select 1
        from information_schema.columns
        where table_schema = 'public'
          and information_schema.columns.table_name = linked_table_name
          and column_name = 'request_id'
      )
    then
      raise exception 'public.% is missing or has no request_id column; no rows were changed', linked_table_name;
    end if;
  end loop;

  for source_row in
    select tr.id::text as row_id, to_jsonb(tr) as row_data
    from public.talent_requests as tr
    where case
      when jsonb_typeof(tr.payload->'roles') = 'array'
        then jsonb_array_length(tr.payload->'roles') > 1
      else false
    end
    for update
  loop
    original_payload := source_row.row_data->'payload';
    original_roles := original_payload->'roles';
    payload_request_id := original_payload->>'id';
    role_count := jsonb_array_length(original_roles);
    source_status := coalesce(
      nullif(original_payload->>'status', ''),
      nullif(source_row.row_data->>'status', ''),
      'New Request'
    );
    row_status := coalesce(nullif(source_row.row_data->>'status', ''), 'new');
    row_created_at := source_row.row_data->>'created_at';

    if lower(trim(source_status)) not in ('new', 'new request', 'submitted', 'reviewing') then
      raise exception 'Request % is at stage "%"; review it manually before splitting', source_row.row_id, source_status;
    end if;

    if exists (
      select 1 from public.matches m
      where m.request_id::text in (source_row.row_id, payload_request_id)
    )
      or exists (
        select 1 from public.offers o
        where o.request_id::text in (source_row.row_id, payload_request_id)
      )
      or exists (
        select 1 from public.interviews i
        where i.request_id::text in (source_row.row_id, payload_request_id)
      )
    then
      raise exception 'Request % has linked matching or hiring activity; review it manually before splitting', source_row.row_id;
    end if;

    role_group_id := 'legacy_' || source_row.row_id;

    for role_row in
      select roles.value as role, roles.ordinality::integer as position
      from jsonb_array_elements(original_roles) with ordinality as roles(value, ordinality)
    loop
      if jsonb_typeof(role_row.role) <> 'object' then
        raise exception 'Request % contains a non-object role at position %', source_row.row_id, role_row.position;
      end if;

      role_title := nullif(trim(role_row.role->>'title'), '');
      if role_title is null then
        raise exception 'Request % has an untitled role at position %', source_row.row_id, role_row.position;
      end if;

      if coalesce(role_row.role->>'count', '1') !~ '^[0-9]+$' then
        raise exception 'Request % has an invalid headcount for role "%"', source_row.row_id, role_title;
      end if;
      role_hires := coalesce(nullif(role_row.role->>'count', '')::integer, 1);
      if role_hires < 1 or role_hires > 100 then
        raise exception 'Request % has an out-of-range headcount for role "%"', source_row.row_id, role_title;
      end if;

      role_description := coalesce(
        nullif(trim(role_row.role->>'description'), ''),
        original_payload->>'roleDescription',
        ''
      );
      role_skills := case
        when jsonb_typeof(role_row.role->'requiredSkills') = 'array'
          then role_row.role->'requiredSkills'
        else coalesce(original_payload->'requiredSkills', '[]'::jsonb)
      end;

      role_id_text := case
        when role_row.position = 1
          then coalesce(nullif(original_payload->>'id', ''), source_row.row_id)
        else gen_random_uuid()::text
      end;
      role_reference := case
        when role_row.position = 1 and nullif(original_payload->>'referenceNumber', '') is not null
          then original_payload->>'referenceNumber'
        else 'KNG-REQ-'
          || to_char(coalesce(nullif(row_created_at, '')::timestamptz, now()), 'YYYYMMDD')
          || '-'
          || upper(left(role_id_text, 8))
      end;

      role_payload := (original_payload - 'roles' - 'id' - 'referenceNumber')
        || jsonb_strip_nulls(jsonb_build_object(
          'id', role_id_text,
          'referenceNumber', role_reference,
          'title', role_title,
          'roleTitle', role_title,
          'roleDescription', role_description,
          'seniorityLevel', coalesce(role_row.role->'seniorityLevel', original_payload->'seniorityLevel'),
          'requiredSkills', role_skills,
          'numberOfHires', role_hires,
          'commitmentLevel', coalesce(role_row.role->'commitmentLevel', original_payload->'commitmentLevel'),
          'startDate', coalesce(role_row.role->'startDate', original_payload->'startDate'),
          'budgetMinUsd', coalesce(role_row.role->'budgetMinUsd', original_payload->'budgetMinUsd'),
          'budgetMaxUsd', coalesce(role_row.role->'budgetMaxUsd', original_payload->'budgetMaxUsd'),
          'requestGroupId', role_group_id,
          'groupPosition', role_row.position,
          'groupSize', role_count,
          'legacyGroupedRoles', case when role_row.position = 1 then original_roles end,
          'legacySplitFromRequestId', source_row.row_id
        ));

      if role_row.position = 1 then
        execute
          'update public.talent_requests
           set payload = $1, role_description = $2, title = $3
           where id::text = $4'
          using role_payload, role_description, role_title, source_row.row_id;
      else
        execute
          'insert into public.talent_requests
           select (jsonb_populate_record(null::public.talent_requests, $1)).*'
        using source_row.row_data || jsonb_build_object(
          'id', role_id_text,
          'payload', role_payload,
          'status', row_status,
          'role_description', role_description,
          'title', role_title,
          'created_at', row_created_at
        );
      end if;
    end loop;

    raise notice 'Prepared per-role rows for legacy request % (% roles)', source_row.row_id, role_count;
  end loop;
end;
$$;

commit;

-- Verification after a reviewed run:
-- select id, title, status, payload->>'requestGroupId' as group_id,
--        payload->>'groupPosition' as role_position,
--        payload->>'groupSize' as group_size
-- from public.talent_requests
-- where payload->>'legacySplitFromRequestId' is not null
--    or payload->>'legacyGroupedRoles' is not null
-- order by created_at desc, title;
