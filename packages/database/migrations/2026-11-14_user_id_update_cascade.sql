-- Some legacy self-service signups created public.users with a generated ID
-- rather than the matching Supabase Auth ID. Account provisioning now repairs
-- those rows by changing the primary key to auth.users.id. Preserve all linked
-- records when that repair happens.
--
-- Keep each FK's current ON DELETE behavior. This updates only FKs whose
-- referenced table is public.users.
do $migration$
declare
  fk record;
  definition text;
begin
  for fk in
    select c.conname, c.conrelid::regclass as table_name,
           pg_get_constraintdef(c.oid) as definition
      from pg_constraint c
     where c.contype = 'f'
       and c.confrelid = 'public.users'::regclass
  loop
    definition := regexp_replace(
      fk.definition,
      ' ON UPDATE (NO ACTION|RESTRICT|CASCADE|SET NULL|SET DEFAULT)',
      '',
      'gi'
    );

    if definition ~* 'ON DELETE (NO ACTION|RESTRICT|CASCADE|SET NULL|SET DEFAULT)' then
      definition := regexp_replace(
        definition,
        '(ON DELETE (NO ACTION|RESTRICT|CASCADE|SET NULL|SET DEFAULT))',
        '\1 ON UPDATE CASCADE',
        'i'
      );
    elsif definition ~* 'DEFERRABLE' then
      definition := regexp_replace(definition, 'DEFERRABLE', 'ON UPDATE CASCADE DEFERRABLE', 'i');
    else
      definition := definition || ' ON UPDATE CASCADE';
    end if;

    execute format('alter table %s drop constraint %I', fk.table_name, fk.conname);
    execute format('alter table %s add constraint %I %s', fk.table_name, fk.conname, definition);
  end loop;
end;
$migration$;
