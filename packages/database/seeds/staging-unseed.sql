-- Removes everything staging-seed.sql created, and nothing else.
-- STAGING ONLY. Same guard as the seed file.
--
-- Uncomment the confirm line, paste the whole file, run it.
--
-- Sign-in accounts are left alone. Delete those in Authentication, Users
-- if you want them gone.

-- UNCOMMENT TO CONFIRM you are on staging:
-- set kongila.seed_ok = 'yes';

do $guard$
begin
  if coalesce(current_setting('kongila.seed_ok', true), '') <> 'yes' then
    raise exception
      'Refusing to unseed. Uncomment the  set kongila.seed_ok  line at the top of this file, on STAGING only.';
  end if;
end
$guard$;

begin;

-- Children before parents, so foreign keys do not block the delete.
-- Each table is skipped if it does not exist, so this works on a project
-- where only some of the migrations have been run.

do $unseed$
declare
  t text;
  seeded_tables text[] := array[
    'invoice_line_items', 'kongila_payroll_entries', 'kongila_payroll_runs',
    'talent_payouts', 'payments', 'invoices',
    'contract_signatures', 'document_signatures', 'contracts', 'offers',
    'interviews', 'matches', 'assessment_assignments', 'assessment_questions',
    'assessment_categories', 'assessments', 'support_messages', 'support_tickets',
    'messages', 'conversations', 'documents', 'talent_skills', 'skills',
    'talent_profiles', 'client_profiles', 'organizations',
    'notifications', 'audit_logs', 'users'
  ];
begin
  foreach t in array seeded_tables loop
    if to_regclass(format('public.%I', t)) is not null then
      execute format('delete from public.%I where id::text like %L', t, 'seed_%');
    end if;
  end loop;
end
$unseed$;

-- talent_requests ids are uuids rather than seed_ strings.
delete from public.talent_requests
 where id::text like '5eed0001-%';

-- The four fee_config rows are created by the finance migration, not by
-- the seed, so their percentages are reset rather than the rows deleted.
update public.fee_config
   set client_fee_pct = null, talent_commission_pct = null
 where id in ('fee_placement', 'fee_outsourcing', 'fee_managed_workforce', 'fee_project');

commit;

-- Check it worked:
--   select count(*) from public.users where id like 'seed_%';
--   select count(*) from public.talent_requests where id::text like '5eed0001-%';
