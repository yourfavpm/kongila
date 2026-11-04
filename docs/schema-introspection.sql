-- Kongila — live schema introspection
--
-- Run this in the Supabase SQL editor against the project you want to check,
-- then export the single result cell and save it to:
--   docs/live-schema.json
--
-- It returns one JSON object describing every table, column, nullability,
-- default, CHECK constraint, foreign key and storage bucket in the public
-- schema. `scripts/schema-audit.js` reads that file and compares it against
-- what the application code actually writes.
--
-- Read-only. It reads catalog views and writes nothing.
--
-- Check the project ref in the URL bar before running. The staging project is
-- bsmwuofugczuhdbintgs.

select json_build_object(
  'generated_at', now(),
  'database', current_database(),

  'columns', (
    select coalesce(json_agg(row_to_json(c) order by c.table_name, c.ordinal_position), '[]'::json)
    from (
      select
        table_name,
        column_name,
        ordinal_position,
        data_type,
        is_nullable,
        column_default
      from information_schema.columns
      where table_schema = 'public'
    ) c
  ),

  'checks', (
    select coalesce(json_agg(row_to_json(k) order by k.table_name, k.constraint_name), '[]'::json)
    from (
      select
        rel.relname  as table_name,
        con.conname  as constraint_name,
        pg_get_constraintdef(con.oid) as definition
      from pg_constraint con
      join pg_class rel      on rel.oid = con.conrelid
      join pg_namespace ns   on ns.oid  = rel.relnamespace
      where ns.nspname = 'public'
        and con.contype = 'c'
    ) k
  ),

  'foreign_keys', (
    select coalesce(json_agg(row_to_json(f) order by f.table_name, f.constraint_name), '[]'::json)
    from (
      select
        rel.relname  as table_name,
        con.conname  as constraint_name,
        pg_get_constraintdef(con.oid) as definition
      from pg_constraint con
      join pg_class rel      on rel.oid = con.conrelid
      join pg_namespace ns   on ns.oid  = rel.relnamespace
      where ns.nspname = 'public'
        and con.contype = 'f'
    ) f
  ),

  'enums', (
    select coalesce(json_agg(row_to_json(e) order by e.enum_name), '[]'::json)
    from (
      select
        t.typname as enum_name,
        array_agg(en.enumlabel order by en.enumsortorder) as values
      from pg_type t
      join pg_enum en on en.enumtypid = t.oid
      join pg_namespace ns on ns.oid = t.typnamespace
      where ns.nspname = 'public'
      group by t.typname
    ) e
  ),

  'rls', (
    select coalesce(json_agg(row_to_json(r) order by r.tablename), '[]'::json)
    from (
      select
        c.relname as tablename,
        c.relrowsecurity as rls_enabled,
        (select count(*) from pg_policies p
          where p.schemaname = 'public' and p.tablename = c.relname) as policy_count
      from pg_class c
      join pg_namespace ns on ns.oid = c.relnamespace
      where ns.nspname = 'public' and c.relkind = 'r'
    ) r
  ),

  'buckets', (
    select coalesce(json_agg(row_to_json(b) order by b.id), '[]'::json)
    from (select id, name, public from storage.buckets) b
  )
) as schema_dump;
