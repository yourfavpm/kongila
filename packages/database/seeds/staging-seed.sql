-- Kongila demo data. STAGING ONLY.
--
-- This file is not in migrations/ on purpose. It is not part of the
-- migration sequence and must never be run against production.
--
-- To run it:
--   1. Open the Supabase SQL editor on the STAGING project.
--   2. Uncomment the single line marked UNCOMMENT TO CONFIRM below.
--   3. Paste the whole file and run it.
--
-- The guard refuses to do anything until that line is uncommented, so
-- pasting this into the wrong tab by accident does nothing.
--
-- Every row has an id beginning seed_, except talent_requests whose ids
-- are uuids beginning 5eed. staging-unseed.sql removes exactly those and
-- nothing else.
--
-- Safe to run more than once: every insert is an upsert, so a second run
-- refreshes the rows rather than duplicating them.
--
-- Safe alongside data you already have:
--   skills       matched by name. A skill you already have keeps its own
--                row and id, and the candidates are linked to that one.
--   users        checked up front. If one of the demo emails already
--                belongs to another account the file stops and names it,
--                before writing anything.
--   invoices     seeded numbers use a 9000 sequence, which real numbering
--                never reaches, so they cannot collide.
--   signatures   matched on document and candidate, so an existing
--                signature is left alone.
--
-- Dates are relative to when you run it, so the overdue invoice is always
-- overdue and the expiring certificate is always about to expire.
--
-- Run the three 2026-11-03 migrations first, or the finance and document
-- sections will fail on missing columns.
--
-- LOGINS: this file fills the public tables. It does not create sign-in
-- accounts, because those live in Supabase Auth rather than in your
-- schema. Create them in Authentication, Users, Add user, with these
-- emails and any password you like. Only make the ones you need:
--
--   demo.super@kongila.test       super admin
--   demo.finance@kongila.test     finance
--   demo.talent@kongila.test      talent manager
--   demo.assessor@kongila.test    skill assessor
--   demo.northwind@kongila.test   client, Northwind Logistics
--   demo.lumen@kongila.test       client, Lumen Health
--   demo.ada@kongila.test         candidate, deployed
--   demo.bola@kongila.test        candidate, deployed
--   demo.chidi@kongila.test       candidate, matched, has signed nothing
--   demo.dayo@kongila.test        candidate, vetted
--   demo.efe@kongila.test         candidate, in review
--   demo.funke@kongila.test       candidate, applied

-- UNCOMMENT TO CONFIRM you are on staging:
-- set kongila.seed_ok = 'yes';

do $guard$
begin
  if coalesce(current_setting('kongila.seed_ok', true), '') <> 'yes' then
    raise exception
      'Refusing to seed. Uncomment the  set kongila.seed_ok  line at the top of this file, on STAGING only.';
  end if;
end
$guard$;

begin;

-- Preflight. These are the two things that can legitimately already exist
-- and would otherwise fail halfway through with a constraint error.

do $pre$
declare
  clash text;
begin
  select string_agg(email, ', ') into clash
    from public.users
   where email like 'demo.%@kongila.test'
     and id not like 'seed_%';

  if clash is not null then
    raise exception
      'These demo emails already belong to other accounts: %. Rename or remove them first.', clash;
  end if;
end
$pre$;

-- ----------------------------------------------------------------------
-- People and organisations
-- ----------------------------------------------------------------------

insert into public.users (id, email, name, role, status, password_hash, email_verified, created_at)
values ('seed_admin_super', 'demo.super@kongila.test', 'Amara Super', 'super_admin', 'active', 'managed_by_supabase_auth', true, (now() - interval '184 days'))
on conflict (id) do update set email = excluded.email, name = excluded.name, role = excluded.role, status = excluded.status, password_hash = excluded.password_hash, email_verified = excluded.email_verified, created_at = excluded.created_at;

insert into public.users (id, email, name, role, status, password_hash, email_verified, created_at)
values ('seed_admin_finance', 'demo.finance@kongila.test', 'Femi Finance', 'finance', 'active', 'managed_by_supabase_auth', true, (now() - interval '184 days'))
on conflict (id) do update set email = excluded.email, name = excluded.name, role = excluded.role, status = excluded.status, password_hash = excluded.password_hash, email_verified = excluded.email_verified, created_at = excluded.created_at;

insert into public.users (id, email, name, role, status, password_hash, email_verified, created_at)
values ('seed_admin_talent', 'demo.talent@kongila.test', 'Tola Talent', 'talent_manager', 'active', 'managed_by_supabase_auth', true, (now() - interval '184 days'))
on conflict (id) do update set email = excluded.email, name = excluded.name, role = excluded.role, status = excluded.status, password_hash = excluded.password_hash, email_verified = excluded.email_verified, created_at = excluded.created_at;

insert into public.users (id, email, name, role, status, password_hash, email_verified, created_at)
values ('seed_admin_assessor', 'demo.assessor@kongila.test', 'Segun Assessor', 'skill_assessor', 'active', 'managed_by_supabase_auth', true, (now() - interval '184 days'))
on conflict (id) do update set email = excluded.email, name = excluded.name, role = excluded.role, status = excluded.status, password_hash = excluded.password_hash, email_verified = excluded.email_verified, created_at = excluded.created_at;

insert into public.users (id, email, name, role, status, password_hash, email_verified, created_at)
values ('seed_client_northwind', 'demo.northwind@kongila.test', 'Clara Mensah', 'client', 'active', 'managed_by_supabase_auth', true, (now() - interval '123 days'))
on conflict (id) do update set email = excluded.email, name = excluded.name, role = excluded.role, status = excluded.status, password_hash = excluded.password_hash, email_verified = excluded.email_verified, created_at = excluded.created_at;

insert into public.users (id, email, name, role, status, password_hash, email_verified, created_at)
values ('seed_client_lumen', 'demo.lumen@kongila.test', 'Daniel Price', 'client', 'active', 'managed_by_supabase_auth', true, (now() - interval '123 days'))
on conflict (id) do update set email = excluded.email, name = excluded.name, role = excluded.role, status = excluded.status, password_hash = excluded.password_hash, email_verified = excluded.email_verified, created_at = excluded.created_at;

insert into public.users (id, email, name, role, status, password_hash, email_verified, created_at)
values ('seed_talent_ada', 'demo.ada@kongila.test', 'Ada Okafor', 'talent', 'active', 'managed_by_supabase_auth', true, (now() - interval '92 days'))
on conflict (id) do update set email = excluded.email, name = excluded.name, role = excluded.role, status = excluded.status, password_hash = excluded.password_hash, email_verified = excluded.email_verified, created_at = excluded.created_at;

insert into public.users (id, email, name, role, status, password_hash, email_verified, created_at)
values ('seed_talent_bola', 'demo.bola@kongila.test', 'Bola Hassan', 'talent', 'active', 'managed_by_supabase_auth', true, (now() - interval '92 days'))
on conflict (id) do update set email = excluded.email, name = excluded.name, role = excluded.role, status = excluded.status, password_hash = excluded.password_hash, email_verified = excluded.email_verified, created_at = excluded.created_at;

insert into public.users (id, email, name, role, status, password_hash, email_verified, created_at)
values ('seed_talent_chidi', 'demo.chidi@kongila.test', 'Chidi Eze', 'talent', 'active', 'managed_by_supabase_auth', true, (now() - interval '92 days'))
on conflict (id) do update set email = excluded.email, name = excluded.name, role = excluded.role, status = excluded.status, password_hash = excluded.password_hash, email_verified = excluded.email_verified, created_at = excluded.created_at;

insert into public.users (id, email, name, role, status, password_hash, email_verified, created_at)
values ('seed_talent_dayo', 'demo.dayo@kongila.test', 'Dayo Adeyemi', 'talent', 'active', 'managed_by_supabase_auth', true, (now() - interval '92 days'))
on conflict (id) do update set email = excluded.email, name = excluded.name, role = excluded.role, status = excluded.status, password_hash = excluded.password_hash, email_verified = excluded.email_verified, created_at = excluded.created_at;

insert into public.users (id, email, name, role, status, password_hash, email_verified, created_at)
values ('seed_talent_efe', 'demo.efe@kongila.test', 'Efe Johnson', 'talent', 'active', 'managed_by_supabase_auth', true, (now() - interval '92 days'))
on conflict (id) do update set email = excluded.email, name = excluded.name, role = excluded.role, status = excluded.status, password_hash = excluded.password_hash, email_verified = excluded.email_verified, created_at = excluded.created_at;

insert into public.users (id, email, name, role, status, password_hash, email_verified, created_at)
values ('seed_talent_funke', 'demo.funke@kongila.test', 'Funke Lawal', 'talent', 'active', 'managed_by_supabase_auth', true, (now() - interval '92 days'))
on conflict (id) do update set email = excluded.email, name = excluded.name, role = excluded.role, status = excluded.status, password_hash = excluded.password_hash, email_verified = excluded.email_verified, created_at = excluded.created_at;

insert into public.organizations (id, name, country, industry, company_size, contact_email, created_by, status, created_at)
values ('seed_org_northwind', 'Northwind Logistics', 'United Kingdom', 'Technology', '50-200', 'demo.northwind@kongila.test', 'seed_client_northwind', 'active', (now() - interval '123 days'))
on conflict (id) do update set name = excluded.name, country = excluded.country, industry = excluded.industry, company_size = excluded.company_size, contact_email = excluded.contact_email, created_by = excluded.created_by, status = excluded.status, created_at = excluded.created_at;

insert into public.organizations (id, name, country, industry, company_size, contact_email, created_by, status, created_at)
values ('seed_org_lumen', 'Lumen Health', 'United States', 'Technology', '50-200', 'demo.lumen@kongila.test', 'seed_client_lumen', 'active', (now() - interval '123 days'))
on conflict (id) do update set name = excluded.name, country = excluded.country, industry = excluded.industry, company_size = excluded.company_size, contact_email = excluded.contact_email, created_by = excluded.created_by, status = excluded.status, created_at = excluded.created_at;

insert into public.client_profiles (id, user_id, organization_id, position, phone, permission_level)
values ('seed_cp_northwind', 'seed_client_northwind', 'seed_org_northwind', 'Operations Director', '+44 20 7946 0100', 'admin')
on conflict (id) do update set user_id = excluded.user_id, organization_id = excluded.organization_id, position = excluded.position, phone = excluded.phone, permission_level = excluded.permission_level;

insert into public.client_profiles (id, user_id, organization_id, position, phone, permission_level)
values ('seed_cp_lumen', 'seed_client_lumen', 'seed_org_lumen', 'Operations Director', '+44 20 7946 0100', 'admin')
on conflict (id) do update set user_id = excluded.user_id, organization_id = excluded.organization_id, position = excluded.position, phone = excluded.phone, permission_level = excluded.permission_level;

insert into public.talent_profiles (id, user_id, full_name, country, timezone, level, availability_hours, experience_years, salary_expectation, salary_min, salary_max, status, vetting_status, grade, bio, date_joined)
values ('seed_tp_ada', 'seed_talent_ada', 'Ada Okafor', 'Nigeria', 'GMT+1 (Lagos)', 'Senior', 40, 7, 2800, 2500, 3200, 'assigned', 'Deployed', 'A+', 'Backend Engineer with 7 years of experience, working remotely from Lagos.', (now() - interval '92 days'))
on conflict (id) do update set user_id = excluded.user_id, full_name = excluded.full_name, country = excluded.country, timezone = excluded.timezone, level = excluded.level, availability_hours = excluded.availability_hours, experience_years = excluded.experience_years, salary_expectation = excluded.salary_expectation, salary_min = excluded.salary_min, salary_max = excluded.salary_max, status = excluded.status, vetting_status = excluded.vetting_status, grade = excluded.grade, bio = excluded.bio, date_joined = excluded.date_joined;

insert into public.talent_profiles (id, user_id, full_name, country, timezone, level, availability_hours, experience_years, salary_expectation, salary_min, salary_max, status, vetting_status, grade, bio, date_joined)
values ('seed_tp_bola', 'seed_talent_bola', 'Bola Hassan', 'Nigeria', 'GMT+1 (Lagos)', 'Mid', 40, 5, 2400, 2100, 2800, 'assigned', 'Deployed', 'A', 'Frontend Engineer with 5 years of experience, working remotely from Lagos.', (now() - interval '92 days'))
on conflict (id) do update set user_id = excluded.user_id, full_name = excluded.full_name, country = excluded.country, timezone = excluded.timezone, level = excluded.level, availability_hours = excluded.availability_hours, experience_years = excluded.experience_years, salary_expectation = excluded.salary_expectation, salary_min = excluded.salary_min, salary_max = excluded.salary_max, status = excluded.status, vetting_status = excluded.vetting_status, grade = excluded.grade, bio = excluded.bio, date_joined = excluded.date_joined;

insert into public.talent_profiles (id, user_id, full_name, country, timezone, level, availability_hours, experience_years, salary_expectation, salary_min, salary_max, status, vetting_status, grade, bio, date_joined)
values ('seed_tp_chidi', 'seed_talent_chidi', 'Chidi Eze', 'Nigeria', 'GMT+1 (Lagos)', 'Mid', 40, 4, 2000, 1700, 2400, 'active', 'Matched', 'A', 'Data Analyst with 4 years of experience, working remotely from Lagos.', (now() - interval '92 days'))
on conflict (id) do update set user_id = excluded.user_id, full_name = excluded.full_name, country = excluded.country, timezone = excluded.timezone, level = excluded.level, availability_hours = excluded.availability_hours, experience_years = excluded.experience_years, salary_expectation = excluded.salary_expectation, salary_min = excluded.salary_min, salary_max = excluded.salary_max, status = excluded.status, vetting_status = excluded.vetting_status, grade = excluded.grade, bio = excluded.bio, date_joined = excluded.date_joined;

insert into public.talent_profiles (id, user_id, full_name, country, timezone, level, availability_hours, experience_years, salary_expectation, salary_min, salary_max, status, vetting_status, grade, bio, date_joined)
values ('seed_tp_dayo', 'seed_talent_dayo', 'Dayo Adeyemi', 'Nigeria', 'GMT+1 (Lagos)', 'Mid', 40, 3, 1200, 900, 1600, 'active', 'Vetted', 'B', 'Customer Support with 3 years of experience, working remotely from Lagos.', (now() - interval '92 days'))
on conflict (id) do update set user_id = excluded.user_id, full_name = excluded.full_name, country = excluded.country, timezone = excluded.timezone, level = excluded.level, availability_hours = excluded.availability_hours, experience_years = excluded.experience_years, salary_expectation = excluded.salary_expectation, salary_min = excluded.salary_min, salary_max = excluded.salary_max, status = excluded.status, vetting_status = excluded.vetting_status, grade = excluded.grade, bio = excluded.bio, date_joined = excluded.date_joined;

insert into public.talent_profiles (id, user_id, full_name, country, timezone, level, availability_hours, experience_years, salary_expectation, salary_min, salary_max, status, vetting_status, grade, bio, date_joined)
values ('seed_tp_efe', 'seed_talent_efe', 'Efe Johnson', 'Nigeria', 'GMT+1 (Lagos)', 'Mid', 40, 2, 900, 600, 1300, 'active', 'Review', 'B', 'Virtual Assistant with 2 years of experience, working remotely from Lagos.', (now() - interval '92 days'))
on conflict (id) do update set user_id = excluded.user_id, full_name = excluded.full_name, country = excluded.country, timezone = excluded.timezone, level = excluded.level, availability_hours = excluded.availability_hours, experience_years = excluded.experience_years, salary_expectation = excluded.salary_expectation, salary_min = excluded.salary_min, salary_max = excluded.salary_max, status = excluded.status, vetting_status = excluded.vetting_status, grade = excluded.grade, bio = excluded.bio, date_joined = excluded.date_joined;

insert into public.talent_profiles (id, user_id, full_name, country, timezone, level, availability_hours, experience_years, salary_expectation, salary_min, salary_max, status, vetting_status, grade, bio, date_joined)
values ('seed_tp_funke', 'seed_talent_funke', 'Funke Lawal', 'Nigeria', 'GMT+1 (Lagos)', 'Senior', 40, 6, 1800, 1500, 2200, 'active', 'Applied', 'B', 'Accountant with 6 years of experience, working remotely from Lagos.', (now() - interval '92 days'))
on conflict (id) do update set user_id = excluded.user_id, full_name = excluded.full_name, country = excluded.country, timezone = excluded.timezone, level = excluded.level, availability_hours = excluded.availability_hours, experience_years = excluded.experience_years, salary_expectation = excluded.salary_expectation, salary_min = excluded.salary_min, salary_max = excluded.salary_max, status = excluded.status, vetting_status = excluded.vetting_status, grade = excluded.grade, bio = excluded.bio, date_joined = excluded.date_joined;

-- ----------------------------------------------------------------------
-- Skills
-- ----------------------------------------------------------------------

-- skills.name is unique and your database already has most of these,
-- so an existing skill is left exactly as it is.

insert into public.skills (id, name)
values ('seed_skill_node_js', 'Node.js')
on conflict (name) do nothing;

insert into public.skills (id, name)
values ('seed_skill_postgresql', 'PostgreSQL')
on conflict (name) do nothing;

insert into public.skills (id, name)
values ('seed_skill_aws', 'AWS')
on conflict (name) do nothing;

insert into public.skills (id, name)
values ('seed_skill_react', 'React')
on conflict (name) do nothing;

insert into public.skills (id, name)
values ('seed_skill_typescript', 'TypeScript')
on conflict (name) do nothing;

insert into public.skills (id, name)
values ('seed_skill_css', 'CSS')
on conflict (name) do nothing;

insert into public.skills (id, name)
values ('seed_skill_sql', 'SQL')
on conflict (name) do nothing;

insert into public.skills (id, name)
values ('seed_skill_python', 'Python')
on conflict (name) do nothing;

insert into public.skills (id, name)
values ('seed_skill_power_bi', 'Power BI')
on conflict (name) do nothing;

insert into public.skills (id, name)
values ('seed_skill_zendesk', 'Zendesk')
on conflict (name) do nothing;

insert into public.skills (id, name)
values ('seed_skill_written_english', 'Written English')
on conflict (name) do nothing;

insert into public.skills (id, name)
values ('seed_skill_calendar_management', 'Calendar Management')
on conflict (name) do nothing;

insert into public.skills (id, name)
values ('seed_skill_xero', 'Xero')
on conflict (name) do nothing;

insert into public.skills (id, name)
values ('seed_skill_reconciliation', 'Reconciliation')
on conflict (name) do nothing;

-- The skill is found by name, because the row above may not have been
-- inserted if that skill already existed under a different id.

insert into public.talent_skills (id, talent_id, skill_id, level)
select 'seed_ts_ada_seed_skill_node_js', 'seed_tp_ada', s.id, 'expert'
  from public.skills s where s.name = 'Node.js'
on conflict (id) do update set talent_id = excluded.talent_id, skill_id = excluded.skill_id, level = excluded.level;

insert into public.talent_skills (id, talent_id, skill_id, level)
select 'seed_ts_ada_seed_skill_postgresql', 'seed_tp_ada', s.id, 'expert'
  from public.skills s where s.name = 'PostgreSQL'
on conflict (id) do update set talent_id = excluded.talent_id, skill_id = excluded.skill_id, level = excluded.level;

insert into public.talent_skills (id, talent_id, skill_id, level)
select 'seed_ts_ada_seed_skill_aws', 'seed_tp_ada', s.id, 'expert'
  from public.skills s where s.name = 'AWS'
on conflict (id) do update set talent_id = excluded.talent_id, skill_id = excluded.skill_id, level = excluded.level;

insert into public.talent_skills (id, talent_id, skill_id, level)
select 'seed_ts_bola_seed_skill_react', 'seed_tp_bola', s.id, 'intermediate'
  from public.skills s where s.name = 'React'
on conflict (id) do update set talent_id = excluded.talent_id, skill_id = excluded.skill_id, level = excluded.level;

insert into public.talent_skills (id, talent_id, skill_id, level)
select 'seed_ts_bola_seed_skill_typescript', 'seed_tp_bola', s.id, 'intermediate'
  from public.skills s where s.name = 'TypeScript'
on conflict (id) do update set talent_id = excluded.talent_id, skill_id = excluded.skill_id, level = excluded.level;

insert into public.talent_skills (id, talent_id, skill_id, level)
select 'seed_ts_bola_seed_skill_css', 'seed_tp_bola', s.id, 'intermediate'
  from public.skills s where s.name = 'CSS'
on conflict (id) do update set talent_id = excluded.talent_id, skill_id = excluded.skill_id, level = excluded.level;

insert into public.talent_skills (id, talent_id, skill_id, level)
select 'seed_ts_chidi_seed_skill_sql', 'seed_tp_chidi', s.id, 'intermediate'
  from public.skills s where s.name = 'SQL'
on conflict (id) do update set talent_id = excluded.talent_id, skill_id = excluded.skill_id, level = excluded.level;

insert into public.talent_skills (id, talent_id, skill_id, level)
select 'seed_ts_chidi_seed_skill_python', 'seed_tp_chidi', s.id, 'intermediate'
  from public.skills s where s.name = 'Python'
on conflict (id) do update set talent_id = excluded.talent_id, skill_id = excluded.skill_id, level = excluded.level;

insert into public.talent_skills (id, talent_id, skill_id, level)
select 'seed_ts_chidi_seed_skill_power_bi', 'seed_tp_chidi', s.id, 'intermediate'
  from public.skills s where s.name = 'Power BI'
on conflict (id) do update set talent_id = excluded.talent_id, skill_id = excluded.skill_id, level = excluded.level;

insert into public.talent_skills (id, talent_id, skill_id, level)
select 'seed_ts_dayo_seed_skill_zendesk', 'seed_tp_dayo', s.id, 'intermediate'
  from public.skills s where s.name = 'Zendesk'
on conflict (id) do update set talent_id = excluded.talent_id, skill_id = excluded.skill_id, level = excluded.level;

insert into public.talent_skills (id, talent_id, skill_id, level)
select 'seed_ts_dayo_seed_skill_written_english', 'seed_tp_dayo', s.id, 'intermediate'
  from public.skills s where s.name = 'Written English'
on conflict (id) do update set talent_id = excluded.talent_id, skill_id = excluded.skill_id, level = excluded.level;

insert into public.talent_skills (id, talent_id, skill_id, level)
select 'seed_ts_efe_seed_skill_calendar_management', 'seed_tp_efe', s.id, 'intermediate'
  from public.skills s where s.name = 'Calendar Management'
on conflict (id) do update set talent_id = excluded.talent_id, skill_id = excluded.skill_id, level = excluded.level;

insert into public.talent_skills (id, talent_id, skill_id, level)
select 'seed_ts_efe_seed_skill_written_english', 'seed_tp_efe', s.id, 'intermediate'
  from public.skills s where s.name = 'Written English'
on conflict (id) do update set talent_id = excluded.talent_id, skill_id = excluded.skill_id, level = excluded.level;

insert into public.talent_skills (id, talent_id, skill_id, level)
select 'seed_ts_funke_seed_skill_xero', 'seed_tp_funke', s.id, 'expert'
  from public.skills s where s.name = 'Xero'
on conflict (id) do update set talent_id = excluded.talent_id, skill_id = excluded.skill_id, level = excluded.level;

insert into public.talent_skills (id, talent_id, skill_id, level)
select 'seed_ts_funke_seed_skill_reconciliation', 'seed_tp_funke', s.id, 'expert'
  from public.skills s where s.name = 'Reconciliation'
on conflict (id) do update set talent_id = excluded.talent_id, skill_id = excluded.skill_id, level = excluded.level;

-- ----------------------------------------------------------------------
-- Skill assessments
-- ----------------------------------------------------------------------

insert into public.assessment_categories (id, name, description, time_limit_minutes, is_reusable, tags, questions, created_by, created_at)
values ('seed_cat_remote', 'Remote Readiness', 'Working unsupervised across time zones.', 10, true, '["shared","behavioural"]', '["seed_cat_remote_q1","seed_cat_remote_q2","seed_cat_remote_q3"]', 'seed_admin_assessor', (now() - interval '61 days'))
on conflict (id) do update set name = excluded.name, description = excluded.description, time_limit_minutes = excluded.time_limit_minutes, is_reusable = excluded.is_reusable, tags = excluded.tags, questions = excluded.questions, created_by = excluded.created_by, created_at = excluded.created_at;

insert into public.assessment_categories (id, name, description, time_limit_minutes, is_reusable, tags, questions, created_by, created_at)
values ('seed_cat_comms', 'Written Communication', 'Clear written English under normal working pressure.', 15, true, '["shared"]', '["seed_cat_comms_q1","seed_cat_comms_q2"]', 'seed_admin_assessor', (now() - interval '61 days'))
on conflict (id) do update set name = excluded.name, description = excluded.description, time_limit_minutes = excluded.time_limit_minutes, is_reusable = excluded.is_reusable, tags = excluded.tags, questions = excluded.questions, created_by = excluded.created_by, created_at = excluded.created_at;

insert into public.assessment_categories (id, name, description, time_limit_minutes, is_reusable, tags, questions, created_by, created_at)
values ('seed_cat_backend', 'Backend Engineering', 'APIs, data modelling and failure handling.', 30, true, '["role"]', '["seed_cat_backend_q1","seed_cat_backend_q2","seed_cat_backend_q3"]', 'seed_admin_assessor', (now() - interval '61 days'))
on conflict (id) do update set name = excluded.name, description = excluded.description, time_limit_minutes = excluded.time_limit_minutes, is_reusable = excluded.is_reusable, tags = excluded.tags, questions = excluded.questions, created_by = excluded.created_by, created_at = excluded.created_at;

insert into public.assessment_categories (id, name, description, time_limit_minutes, is_reusable, tags, questions, created_by, created_at)
values ('seed_cat_frontend', 'Frontend Engineering', 'Interface work, state and accessibility.', 30, true, '["role"]', '["seed_cat_frontend_q1","seed_cat_frontend_q2","seed_cat_frontend_q3"]', 'seed_admin_assessor', (now() - interval '61 days'))
on conflict (id) do update set name = excluded.name, description = excluded.description, time_limit_minutes = excluded.time_limit_minutes, is_reusable = excluded.is_reusable, tags = excluded.tags, questions = excluded.questions, created_by = excluded.created_by, created_at = excluded.created_at;

insert into public.assessment_categories (id, name, description, time_limit_minutes, is_reusable, tags, questions, created_by, created_at)
values ('seed_cat_data', 'Data Analysis', 'SQL, interpretation and honest reporting.', 30, true, '["role"]', '["seed_cat_data_q1","seed_cat_data_q2","seed_cat_data_q3"]', 'seed_admin_assessor', (now() - interval '61 days'))
on conflict (id) do update set name = excluded.name, description = excluded.description, time_limit_minutes = excluded.time_limit_minutes, is_reusable = excluded.is_reusable, tags = excluded.tags, questions = excluded.questions, created_by = excluded.created_by, created_at = excluded.created_at;

insert into public.assessment_categories (id, name, description, time_limit_minutes, is_reusable, tags, questions, created_by, created_at)
values ('seed_cat_support', 'Customer Support', 'Handling people who are already annoyed.', 25, true, '["role"]', '["seed_cat_support_q1","seed_cat_support_q2"]', 'seed_admin_assessor', (now() - interval '61 days'))
on conflict (id) do update set name = excluded.name, description = excluded.description, time_limit_minutes = excluded.time_limit_minutes, is_reusable = excluded.is_reusable, tags = excluded.tags, questions = excluded.questions, created_by = excluded.created_by, created_at = excluded.created_at;

insert into public.assessment_categories (id, name, description, time_limit_minutes, is_reusable, tags, questions, created_by, created_at)
values ('seed_cat_va', 'Virtual Assistance', 'Calendar, inbox and judgement about priority.', 25, true, '["role"]', '["seed_cat_va_q1","seed_cat_va_q2"]', 'seed_admin_assessor', (now() - interval '61 days'))
on conflict (id) do update set name = excluded.name, description = excluded.description, time_limit_minutes = excluded.time_limit_minutes, is_reusable = excluded.is_reusable, tags = excluded.tags, questions = excluded.questions, created_by = excluded.created_by, created_at = excluded.created_at;

insert into public.assessment_categories (id, name, description, time_limit_minutes, is_reusable, tags, questions, created_by, created_at)
values ('seed_cat_accounting', 'Accounting', 'Bookkeeping accuracy and reconciliation.', 30, true, '["role"]', '["seed_cat_accounting_q1","seed_cat_accounting_q2"]', 'seed_admin_assessor', (now() - interval '61 days'))
on conflict (id) do update set name = excluded.name, description = excluded.description, time_limit_minutes = excluded.time_limit_minutes, is_reusable = excluded.is_reusable, tags = excluded.tags, questions = excluded.questions, created_by = excluded.created_by, created_at = excluded.created_at;

insert into public.assessment_questions (id, category_id, type, question_text, options, correct_answer, expected_answer, scoring_weight, max_score)
values ('seed_cat_remote_q1', 'seed_cat_remote', 'multiple_choice', 'Your internet drops an hour before a client demo. What do you do first?', '["Wait and hope it returns","Message the client and switch to a backup connection","Start the demo late without warning","Ask a colleague to run it instead"]', '"Message the client and switch to a backup connection"', null, 2, 10)
on conflict (id) do update set category_id = excluded.category_id, type = excluded.type, question_text = excluded.question_text, options = excluded.options, correct_answer = excluded.correct_answer, expected_answer = excluded.expected_answer, scoring_weight = excluded.scoring_weight, max_score = excluded.max_score;

insert into public.assessment_questions (id, category_id, type, question_text, options, correct_answer, expected_answer, scoring_weight, max_score)
values ('seed_cat_remote_q2', 'seed_cat_remote', 'multiple_choice', 'Your client is six hours behind you. When do you schedule a standing daily call?', '["Start of your day","End of your day, which is their morning","Whenever is convenient that week","Their evening"]', '"End of your day, which is their morning"', null, 2, 10)
on conflict (id) do update set category_id = excluded.category_id, type = excluded.type, question_text = excluded.question_text, options = excluded.options, correct_answer = excluded.correct_answer, expected_answer = excluded.expected_answer, scoring_weight = excluded.scoring_weight, max_score = excluded.max_score;

insert into public.assessment_questions (id, category_id, type, question_text, options, correct_answer, expected_answer, scoring_weight, max_score)
values ('seed_cat_remote_q3', 'seed_cat_remote', 'short_answer', 'Describe your power and internet backup arrangements.', null, null, 'Names a specific backup: inverter, generator, second ISP or mobile data.', 1, 10)
on conflict (id) do update set category_id = excluded.category_id, type = excluded.type, question_text = excluded.question_text, options = excluded.options, correct_answer = excluded.correct_answer, expected_answer = excluded.expected_answer, scoring_weight = excluded.scoring_weight, max_score = excluded.max_score;

insert into public.assessment_questions (id, category_id, type, question_text, options, correct_answer, expected_answer, scoring_weight, max_score)
values ('seed_cat_comms_q1', 'seed_cat_comms', 'essay', 'A deliverable will be two days late. Write the message you send the client.', null, null, 'States the delay, the new date and the reason, without excessive apology.', 3, 20)
on conflict (id) do update set category_id = excluded.category_id, type = excluded.type, question_text = excluded.question_text, options = excluded.options, correct_answer = excluded.correct_answer, expected_answer = excluded.expected_answer, scoring_weight = excluded.scoring_weight, max_score = excluded.max_score;

insert into public.assessment_questions (id, category_id, type, question_text, options, correct_answer, expected_answer, scoring_weight, max_score)
values ('seed_cat_comms_q2', 'seed_cat_comms', 'short_answer', 'Rewrite this so a non-technical reader understands it: "The job failed due to a null pointer in the ETL."', null, null, 'Plain language, no jargon, says what the reader should do.', 2, 10)
on conflict (id) do update set category_id = excluded.category_id, type = excluded.type, question_text = excluded.question_text, options = excluded.options, correct_answer = excluded.correct_answer, expected_answer = excluded.expected_answer, scoring_weight = excluded.scoring_weight, max_score = excluded.max_score;

insert into public.assessment_questions (id, category_id, type, question_text, options, correct_answer, expected_answer, scoring_weight, max_score)
values ('seed_cat_backend_q1', 'seed_cat_backend', 'multiple_choice', 'Which HTTP status fits a request that is valid but refused because of a business rule?', '["400 Bad Request","403 Forbidden","409 Conflict","500 Internal Server Error"]', '"409 Conflict"', null, 2, 10)
on conflict (id) do update set category_id = excluded.category_id, type = excluded.type, question_text = excluded.question_text, options = excluded.options, correct_answer = excluded.correct_answer, expected_answer = excluded.expected_answer, scoring_weight = excluded.scoring_weight, max_score = excluded.max_score;

insert into public.assessment_questions (id, category_id, type, question_text, options, correct_answer, expected_answer, scoring_weight, max_score)
values ('seed_cat_backend_q2', 'seed_cat_backend', 'multiple_choice', 'A query that was fast on 10,000 rows crawls on 10 million. What do you check first?', '["Add more memory","Read the query plan and the indexes","Rewrite it in another language","Cache the whole table"]', '"Read the query plan and the indexes"', null, 3, 15)
on conflict (id) do update set category_id = excluded.category_id, type = excluded.type, question_text = excluded.question_text, options = excluded.options, correct_answer = excluded.correct_answer, expected_answer = excluded.expected_answer, scoring_weight = excluded.scoring_weight, max_score = excluded.max_score;

insert into public.assessment_questions (id, category_id, type, question_text, options, correct_answer, expected_answer, scoring_weight, max_score)
values ('seed_cat_backend_q3', 'seed_cat_backend', 'scenario', 'A payment webhook can be delivered twice. How do you make processing it safe?', null, null, 'Idempotency key or a unique constraint on the event id; the second delivery is a no-op.', 3, 20)
on conflict (id) do update set category_id = excluded.category_id, type = excluded.type, question_text = excluded.question_text, options = excluded.options, correct_answer = excluded.correct_answer, expected_answer = excluded.expected_answer, scoring_weight = excluded.scoring_weight, max_score = excluded.max_score;

insert into public.assessment_questions (id, category_id, type, question_text, options, correct_answer, expected_answer, scoring_weight, max_score)
values ('seed_cat_frontend_q1', 'seed_cat_frontend', 'multiple_choice', 'What does a React key on a list item actually do?', '["Styles the item","Lets React match elements between renders","Sorts the list","Makes it accessible"]', '"Lets React match elements between renders"', null, 2, 10)
on conflict (id) do update set category_id = excluded.category_id, type = excluded.type, question_text = excluded.question_text, options = excluded.options, correct_answer = excluded.correct_answer, expected_answer = excluded.expected_answer, scoring_weight = excluded.scoring_weight, max_score = excluded.max_score;

insert into public.assessment_questions (id, category_id, type, question_text, options, correct_answer, expected_answer, scoring_weight, max_score)
values ('seed_cat_frontend_q2', 'seed_cat_frontend', 'multiple_choice', 'A form is unusable with a keyboard. What is the most likely cause?', '["Missing labels and focus order","The font is too small","Too many colours","It is not responsive"]', '"Missing labels and focus order"', null, 2, 10)
on conflict (id) do update set category_id = excluded.category_id, type = excluded.type, question_text = excluded.question_text, options = excluded.options, correct_answer = excluded.correct_answer, expected_answer = excluded.expected_answer, scoring_weight = excluded.scoring_weight, max_score = excluded.max_score;

insert into public.assessment_questions (id, category_id, type, question_text, options, correct_answer, expected_answer, scoring_weight, max_score)
values ('seed_cat_frontend_q3', 'seed_cat_frontend', 'scenario', 'A page shows stale data after a save. Where do you look?', null, null, 'Cache or local state not invalidated after the write; refetch or update the store.', 3, 20)
on conflict (id) do update set category_id = excluded.category_id, type = excluded.type, question_text = excluded.question_text, options = excluded.options, correct_answer = excluded.correct_answer, expected_answer = excluded.expected_answer, scoring_weight = excluded.scoring_weight, max_score = excluded.max_score;

insert into public.assessment_questions (id, category_id, type, question_text, options, correct_answer, expected_answer, scoring_weight, max_score)
values ('seed_cat_data_q1', 'seed_cat_data', 'multiple_choice', 'Which join keeps every row of the left table?', '["INNER JOIN","LEFT JOIN","CROSS JOIN","FULL JOIN"]', '"LEFT JOIN"', null, 2, 10)
on conflict (id) do update set category_id = excluded.category_id, type = excluded.type, question_text = excluded.question_text, options = excluded.options, correct_answer = excluded.correct_answer, expected_answer = excluded.expected_answer, scoring_weight = excluded.scoring_weight, max_score = excluded.max_score;

insert into public.assessment_questions (id, category_id, type, question_text, options, correct_answer, expected_answer, scoring_weight, max_score)
values ('seed_cat_data_q2', 'seed_cat_data', 'scenario', 'Signups rose 40% but revenue did not move. What do you check?', null, null, 'Segment the new signups: source quality, conversion rate, plan mix, refunds.', 3, 20)
on conflict (id) do update set category_id = excluded.category_id, type = excluded.type, question_text = excluded.question_text, options = excluded.options, correct_answer = excluded.correct_answer, expected_answer = excluded.expected_answer, scoring_weight = excluded.scoring_weight, max_score = excluded.max_score;

insert into public.assessment_questions (id, category_id, type, question_text, options, correct_answer, expected_answer, scoring_weight, max_score)
values ('seed_cat_data_q3', 'seed_cat_data', 'short_answer', 'A stakeholder asks for a number you think is misleading. What do you do?', null, null, 'Give the number with the caveat, and offer the measure that answers their real question.', 2, 10)
on conflict (id) do update set category_id = excluded.category_id, type = excluded.type, question_text = excluded.question_text, options = excluded.options, correct_answer = excluded.correct_answer, expected_answer = excluded.expected_answer, scoring_weight = excluded.scoring_weight, max_score = excluded.max_score;

insert into public.assessment_questions (id, category_id, type, question_text, options, correct_answer, expected_answer, scoring_weight, max_score)
values ('seed_cat_support_q1', 'seed_cat_support', 'essay', 'A customer has been waiting three days for a reply and is angry. Write your first message.', null, null, 'Acknowledges the wait without over-apologising, gives a concrete next step and a time.', 3, 20)
on conflict (id) do update set category_id = excluded.category_id, type = excluded.type, question_text = excluded.question_text, options = excluded.options, correct_answer = excluded.correct_answer, expected_answer = excluded.expected_answer, scoring_weight = excluded.scoring_weight, max_score = excluded.max_score;

insert into public.assessment_questions (id, category_id, type, question_text, options, correct_answer, expected_answer, scoring_weight, max_score)
values ('seed_cat_support_q2', 'seed_cat_support', 'multiple_choice', 'You do not know the answer and the customer is waiting. What is best?', '["Guess, to seem fast","Say you are finding out and when you will come back","Transfer without explaining","Close the ticket"]', '"Say you are finding out and when you will come back"', null, 2, 10)
on conflict (id) do update set category_id = excluded.category_id, type = excluded.type, question_text = excluded.question_text, options = excluded.options, correct_answer = excluded.correct_answer, expected_answer = excluded.expected_answer, scoring_weight = excluded.scoring_weight, max_score = excluded.max_score;

insert into public.assessment_questions (id, category_id, type, question_text, options, correct_answer, expected_answer, scoring_weight, max_score)
values ('seed_cat_va_q1', 'seed_cat_va', 'scenario', 'Two meetings are double-booked and both organisers are senior. What do you do?', null, null, 'Check which is externally facing or harder to move, propose one alternative, tell both.', 3, 15)
on conflict (id) do update set category_id = excluded.category_id, type = excluded.type, question_text = excluded.question_text, options = excluded.options, correct_answer = excluded.correct_answer, expected_answer = excluded.expected_answer, scoring_weight = excluded.scoring_weight, max_score = excluded.max_score;

insert into public.assessment_questions (id, category_id, type, question_text, options, correct_answer, expected_answer, scoring_weight, max_score)
values ('seed_cat_va_q2', 'seed_cat_va', 'multiple_choice', 'An email looks like it is from your principal asking for a gift card purchase. What do you do?', '["Buy it quickly","Reply asking for details","Verify through a known channel before acting","Forward it to the finance team"]', '"Verify through a known channel before acting"', null, 3, 15)
on conflict (id) do update set category_id = excluded.category_id, type = excluded.type, question_text = excluded.question_text, options = excluded.options, correct_answer = excluded.correct_answer, expected_answer = excluded.expected_answer, scoring_weight = excluded.scoring_weight, max_score = excluded.max_score;

insert into public.assessment_questions (id, category_id, type, question_text, options, correct_answer, expected_answer, scoring_weight, max_score)
values ('seed_cat_accounting_q1', 'seed_cat_accounting', 'multiple_choice', 'The bank statement shows a payment the ledger does not. What is this called?', '["An accrual","A reconciling item","A write-off","A provision"]', '"A reconciling item"', null, 2, 10)
on conflict (id) do update set category_id = excluded.category_id, type = excluded.type, question_text = excluded.question_text, options = excluded.options, correct_answer = excluded.correct_answer, expected_answer = excluded.expected_answer, scoring_weight = excluded.scoring_weight, max_score = excluded.max_score;

insert into public.assessment_questions (id, category_id, type, question_text, options, correct_answer, expected_answer, scoring_weight, max_score)
values ('seed_cat_accounting_q2', 'seed_cat_accounting', 'scenario', 'A manager asks you to move an expense into next quarter. How do you respond?', null, null, 'Declines to misstate the period, explains the rule, offers to document the reason if legitimate.', 3, 20)
on conflict (id) do update set category_id = excluded.category_id, type = excluded.type, question_text = excluded.question_text, options = excluded.options, correct_answer = excluded.correct_answer, expected_answer = excluded.expected_answer, scoring_weight = excluded.scoring_weight, max_score = excluded.max_score;

insert into public.assessments (id, title, description, role_targeted, total_time_limit_minutes, passing_score, categories, category_overrides, status, created_by, created_at)
values ('seed_assessment_backend_engineer', 'Backend Engineer — Kongila vetting', 'Technical, communication and remote-readiness assessment for Backend Engineer candidates.', 'Backend Engineer', 55, 70, '["seed_cat_backend","seed_cat_remote","seed_cat_comms"]', '[]', 'published', 'seed_admin_assessor', (now() - interval '61 days'))
on conflict (id) do update set title = excluded.title, description = excluded.description, role_targeted = excluded.role_targeted, total_time_limit_minutes = excluded.total_time_limit_minutes, passing_score = excluded.passing_score, categories = excluded.categories, category_overrides = excluded.category_overrides, status = excluded.status, created_by = excluded.created_by, created_at = excluded.created_at;

insert into public.assessments (id, title, description, role_targeted, total_time_limit_minutes, passing_score, categories, category_overrides, status, created_by, created_at)
values ('seed_assessment_frontend_engineer', 'Frontend Engineer — Kongila vetting', 'Technical, communication and remote-readiness assessment for Frontend Engineer candidates.', 'Frontend Engineer', 55, 70, '["seed_cat_frontend","seed_cat_remote","seed_cat_comms"]', '[]', 'published', 'seed_admin_assessor', (now() - interval '61 days'))
on conflict (id) do update set title = excluded.title, description = excluded.description, role_targeted = excluded.role_targeted, total_time_limit_minutes = excluded.total_time_limit_minutes, passing_score = excluded.passing_score, categories = excluded.categories, category_overrides = excluded.category_overrides, status = excluded.status, created_by = excluded.created_by, created_at = excluded.created_at;

insert into public.assessments (id, title, description, role_targeted, total_time_limit_minutes, passing_score, categories, category_overrides, status, created_by, created_at)
values ('seed_assessment_data_analyst', 'Data Analyst — Kongila vetting', 'Technical, communication and remote-readiness assessment for Data Analyst candidates.', 'Data Analyst', 55, 70, '["seed_cat_data","seed_cat_remote","seed_cat_comms"]', '[]', 'published', 'seed_admin_assessor', (now() - interval '61 days'))
on conflict (id) do update set title = excluded.title, description = excluded.description, role_targeted = excluded.role_targeted, total_time_limit_minutes = excluded.total_time_limit_minutes, passing_score = excluded.passing_score, categories = excluded.categories, category_overrides = excluded.category_overrides, status = excluded.status, created_by = excluded.created_by, created_at = excluded.created_at;

insert into public.assessments (id, title, description, role_targeted, total_time_limit_minutes, passing_score, categories, category_overrides, status, created_by, created_at)
values ('seed_assessment_customer_support', 'Customer Support — Kongila vetting', 'Technical, communication and remote-readiness assessment for Customer Support candidates.', 'Customer Support', 50, 70, '["seed_cat_support","seed_cat_remote","seed_cat_comms"]', '[]', 'published', 'seed_admin_assessor', (now() - interval '61 days'))
on conflict (id) do update set title = excluded.title, description = excluded.description, role_targeted = excluded.role_targeted, total_time_limit_minutes = excluded.total_time_limit_minutes, passing_score = excluded.passing_score, categories = excluded.categories, category_overrides = excluded.category_overrides, status = excluded.status, created_by = excluded.created_by, created_at = excluded.created_at;

insert into public.assessments (id, title, description, role_targeted, total_time_limit_minutes, passing_score, categories, category_overrides, status, created_by, created_at)
values ('seed_assessment_virtual_assistant', 'Virtual Assistant — Kongila vetting', 'Technical, communication and remote-readiness assessment for Virtual Assistant candidates.', 'Virtual Assistant', 50, 70, '["seed_cat_va","seed_cat_remote","seed_cat_comms"]', '[]', 'published', 'seed_admin_assessor', (now() - interval '61 days'))
on conflict (id) do update set title = excluded.title, description = excluded.description, role_targeted = excluded.role_targeted, total_time_limit_minutes = excluded.total_time_limit_minutes, passing_score = excluded.passing_score, categories = excluded.categories, category_overrides = excluded.category_overrides, status = excluded.status, created_by = excluded.created_by, created_at = excluded.created_at;

insert into public.assessments (id, title, description, role_targeted, total_time_limit_minutes, passing_score, categories, category_overrides, status, created_by, created_at)
values ('seed_assessment_accountant', 'Accountant — Kongila vetting', 'Technical, communication and remote-readiness assessment for Accountant candidates.', 'Accountant', 55, 70, '["seed_cat_accounting","seed_cat_remote","seed_cat_comms"]', '[]', 'published', 'seed_admin_assessor', (now() - interval '61 days'))
on conflict (id) do update set title = excluded.title, description = excluded.description, role_targeted = excluded.role_targeted, total_time_limit_minutes = excluded.total_time_limit_minutes, passing_score = excluded.passing_score, categories = excluded.categories, category_overrides = excluded.category_overrides, status = excluded.status, created_by = excluded.created_by, created_at = excluded.created_at;

insert into public.assessment_assignments (id, assessment_id, talent_id, status, start_time, end_time, score)
values ('seed_assign_ada', 'seed_assessment_backend_engineer', 'seed_tp_ada', 'completed', (now() - interval '12 days'), (now() - interval '12 days'), 88)
on conflict (id) do update set assessment_id = excluded.assessment_id, talent_id = excluded.talent_id, status = excluded.status, start_time = excluded.start_time, end_time = excluded.end_time, score = excluded.score;

insert into public.assessment_assignments (id, assessment_id, talent_id, status, start_time, end_time, score)
values ('seed_assign_bola', 'seed_assessment_frontend_engineer', 'seed_tp_bola', 'completed', (now() - interval '12 days'), (now() - interval '12 days'), 76)
on conflict (id) do update set assessment_id = excluded.assessment_id, talent_id = excluded.talent_id, status = excluded.status, start_time = excluded.start_time, end_time = excluded.end_time, score = excluded.score;

insert into public.assessment_assignments (id, assessment_id, talent_id, status, start_time, end_time, score)
values ('seed_assign_chidi', 'seed_assessment_data_analyst', 'seed_tp_chidi', 'in_progress', (now() - interval '12 days'), null, null)
on conflict (id) do update set assessment_id = excluded.assessment_id, talent_id = excluded.talent_id, status = excluded.status, start_time = excluded.start_time, end_time = excluded.end_time, score = excluded.score;

insert into public.assessment_assignments (id, assessment_id, talent_id, status, start_time, end_time, score)
values ('seed_assign_dayo', 'seed_assessment_customer_support', 'seed_tp_dayo', 'completed', (now() - interval '12 days'), (now() - interval '12 days'), 64)
on conflict (id) do update set assessment_id = excluded.assessment_id, talent_id = excluded.talent_id, status = excluded.status, start_time = excluded.start_time, end_time = excluded.end_time, score = excluded.score;

insert into public.assessment_assignments (id, assessment_id, talent_id, status, start_time, end_time, score)
values ('seed_assign_efe', 'seed_assessment_virtual_assistant', 'seed_tp_efe', 'not_started', null, null, null)
on conflict (id) do update set assessment_id = excluded.assessment_id, talent_id = excluded.talent_id, status = excluded.status, start_time = excluded.start_time, end_time = excluded.end_time, score = excluded.score;

insert into public.assessment_assignments (id, assessment_id, talent_id, status, start_time, end_time, score)
values ('seed_assign_funke', 'seed_assessment_accountant', 'seed_tp_funke', 'not_started', null, null, null)
on conflict (id) do update set assessment_id = excluded.assessment_id, talent_id = excluded.talent_id, status = excluded.status, start_time = excluded.start_time, end_time = excluded.end_time, score = excluded.score;

-- ----------------------------------------------------------------------
-- Documents, versions and compliance
-- ----------------------------------------------------------------------

insert into public.documents (id, name, type, status, is_mandatory, is_template, is_hidden, user_id, uploaded_at, description)
values ('seed_doc_nda', 'Mutual Non-Disclosure Agreement', 'NDA', 'pending_signature', true, true, false, null, (now() - interval '184 days'), 'Signed by every candidate before they are put in front of a client.')
on conflict (id) do update set name = excluded.name, type = excluded.type, status = excluded.status, is_mandatory = excluded.is_mandatory, is_template = excluded.is_template, is_hidden = excluded.is_hidden, user_id = excluded.user_id, uploaded_at = excluded.uploaded_at, description = excluded.description;

insert into public.documents (id, name, type, status, is_mandatory, is_template, is_hidden, user_id, uploaded_at, description)
values ('seed_doc_agreement', 'Contractor Agreement', 'agreement', 'pending_signature', true, true, false, null, (now() - interval '184 days'), 'The master terms between Kongila and the contractor.')
on conflict (id) do update set name = excluded.name, type = excluded.type, status = excluded.status, is_mandatory = excluded.is_mandatory, is_template = excluded.is_template, is_hidden = excluded.is_hidden, user_id = excluded.user_id, uploaded_at = excluded.uploaded_at, description = excluded.description;

insert into public.documents (id, name, type, status, is_mandatory, is_template, is_hidden, user_id, uploaded_at, description)
values ('seed_doc_ethics', 'IT and Ethics Policy', 'IT_Ethics_Policy', 'pending_signature', true, true, false, null, (now() - interval '184 days'), 'Acceptable use, data handling and conflict of interest.')
on conflict (id) do update set name = excluded.name, type = excluded.type, status = excluded.status, is_mandatory = excluded.is_mandatory, is_template = excluded.is_template, is_hidden = excluded.is_hidden, user_id = excluded.user_id, uploaded_at = excluded.uploaded_at, description = excluded.description;

insert into public.documents (id, user_id, name, type, status, version_number, is_current, superseded_by_id, uploaded_at)
values ('seed_doc_cv_ada_v1', 'seed_talent_ada', 'Ada Okafor CV.pdf', 'CV', 'uploaded', 1, false, 'seed_doc_cv_ada_v3', (now() - interval '245 days'))
on conflict (id) do update set user_id = excluded.user_id, name = excluded.name, type = excluded.type, status = excluded.status, version_number = excluded.version_number, is_current = excluded.is_current, superseded_by_id = excluded.superseded_by_id, uploaded_at = excluded.uploaded_at;

insert into public.documents (id, user_id, name, type, status, version_number, is_current, superseded_by_id, uploaded_at)
values ('seed_doc_cv_ada_v2', 'seed_talent_ada', 'Ada Okafor CV.pdf', 'CV', 'uploaded', 2, false, 'seed_doc_cv_ada_v3', (now() - interval '123 days'))
on conflict (id) do update set user_id = excluded.user_id, name = excluded.name, type = excluded.type, status = excluded.status, version_number = excluded.version_number, is_current = excluded.is_current, superseded_by_id = excluded.superseded_by_id, uploaded_at = excluded.uploaded_at;

insert into public.documents (id, user_id, name, type, status, version_number, is_current, uploaded_at)
values ('seed_doc_cv_ada_v3', 'seed_talent_ada', 'Ada Okafor CV.pdf', 'CV', 'uploaded', 3, true, (now() - interval '31 days'))
on conflict (id) do update set user_id = excluded.user_id, name = excluded.name, type = excluded.type, status = excluded.status, version_number = excluded.version_number, is_current = excluded.is_current, uploaded_at = excluded.uploaded_at;

insert into public.documents (id, user_id, name, certification_name, issuing_body, type, status, is_current, issue_date, expiry_date, uploaded_at)
values ('seed_doc_cert_valid', 'seed_talent_ada', 'AWS Solutions Architect', 'AWS Solutions Architect', 'Amazon Web Services', 'certification', 'uploaded', true, (current_date - 304), (current_date + 400), (now() - interval '304 days'))
on conflict (id) do update set user_id = excluded.user_id, name = excluded.name, certification_name = excluded.certification_name, issuing_body = excluded.issuing_body, type = excluded.type, status = excluded.status, is_current = excluded.is_current, issue_date = excluded.issue_date, expiry_date = excluded.expiry_date, uploaded_at = excluded.uploaded_at;

insert into public.documents (id, user_id, name, certification_name, issuing_body, type, status, is_current, issue_date, expiry_date, uploaded_at)
values ('seed_doc_cert_soon', 'seed_talent_bola', 'Scrum Master', 'Professional Scrum Master I', 'Scrum.org', 'certification', 'uploaded', true, (current_date - 669), (current_date + 12), (now() - interval '669 days'))
on conflict (id) do update set user_id = excluded.user_id, name = excluded.name, certification_name = excluded.certification_name, issuing_body = excluded.issuing_body, type = excluded.type, status = excluded.status, is_current = excluded.is_current, issue_date = excluded.issue_date, expiry_date = excluded.expiry_date, uploaded_at = excluded.uploaded_at;

insert into public.documents (id, user_id, name, certification_name, issuing_body, type, status, is_current, issue_date, expiry_date, uploaded_at)
values ('seed_doc_cert_expired', 'seed_talent_chidi', 'Power BI Analyst', 'Microsoft Power BI Data Analyst', 'Microsoft', 'certification', 'uploaded', true, (current_date - 791), (current_date - 45), (now() - interval '791 days'))
on conflict (id) do update set user_id = excluded.user_id, name = excluded.name, certification_name = excluded.certification_name, issuing_body = excluded.issuing_body, type = excluded.type, status = excluded.status, is_current = excluded.is_current, issue_date = excluded.issue_date, expiry_date = excluded.expiry_date, uploaded_at = excluded.uploaded_at;

insert into public.document_signatures (id, document_id, talent_id, signer_name, signed_at)
values ('seed_sig_ada_nda', 'seed_doc_nda', 'seed_tp_ada', 'Ada Okafor', (now() - interval '61 days'))
on conflict (document_id, talent_id) do nothing;

insert into public.document_signatures (id, document_id, talent_id, signer_name, signed_at)
values ('seed_sig_ada_agreement', 'seed_doc_agreement', 'seed_tp_ada', 'Ada Okafor', (now() - interval '61 days'))
on conflict (document_id, talent_id) do nothing;

insert into public.document_signatures (id, document_id, talent_id, signer_name, signed_at)
values ('seed_sig_ada_ethics', 'seed_doc_ethics', 'seed_tp_ada', 'Ada Okafor', (now() - interval '61 days'))
on conflict (document_id, talent_id) do nothing;

insert into public.document_signatures (id, document_id, talent_id, signer_name, signed_at)
values ('seed_sig_bola_nda', 'seed_doc_nda', 'seed_tp_bola', 'Bola Hassan', (now() - interval '61 days'))
on conflict (document_id, talent_id) do nothing;

insert into public.document_signatures (id, document_id, talent_id, signer_name, signed_at)
values ('seed_sig_bola_agreement', 'seed_doc_agreement', 'seed_tp_bola', 'Bola Hassan', (now() - interval '61 days'))
on conflict (document_id, talent_id) do nothing;

insert into public.document_signatures (id, document_id, talent_id, signer_name, signed_at)
values ('seed_sig_bola_ethics', 'seed_doc_ethics', 'seed_tp_bola', 'Bola Hassan', (now() - interval '61 days'))
on conflict (document_id, talent_id) do nothing;

-- ----------------------------------------------------------------------
-- Requests, matches and interviews
-- ----------------------------------------------------------------------

insert into public.talent_requests (id, client_id, service_type, title, status, role_description, payload, created_at)
values ('5eed0001-0000-4000-8000-000000000001', 'seed_client_northwind', 'Managed Workforce', 'Backend Engineer', 'Onboarding', 'Backend engineer to own the logistics API, managed by Kongila.', '{"roleTitle":"Backend Engineer","numOfTalents":1,"budgetMinUsd":2500,"budgetMaxUsd":3200,"urgencyLevel":"Standard","description":"Backend engineer to own the logistics API, managed by Kongila.","serviceType":"Managed Workforce"}', (now() - interval '90 days'))
on conflict (id) do update set client_id = excluded.client_id, service_type = excluded.service_type, title = excluded.title, status = excluded.status, role_description = excluded.role_description, payload = excluded.payload, created_at = excluded.created_at;

insert into public.talent_requests (id, client_id, service_type, title, status, role_description, payload, created_at)
values ('5eed0001-0000-4000-8000-000000000002', 'seed_client_lumen', 'Outsource Talent', 'Frontend Engineer', 'Onboarding', 'React engineer for the patient portal.', '{"roleTitle":"Frontend Engineer","numOfTalents":1,"budgetMinUsd":2000,"budgetMaxUsd":2600,"urgencyLevel":"ASAP","description":"React engineer for the patient portal.","serviceType":"Outsource Talent"}', (now() - interval '60 days'))
on conflict (id) do update set client_id = excluded.client_id, service_type = excluded.service_type, title = excluded.title, status = excluded.status, role_description = excluded.role_description, payload = excluded.payload, created_at = excluded.created_at;

insert into public.talent_requests (id, client_id, service_type, title, status, role_description, payload, created_at)
values ('5eed0001-0000-4000-8000-000000000003', 'seed_client_northwind', 'Hire Talent', 'Data Analyst', 'Client Interview', 'Permanent analyst hire, employed directly by Northwind.', '{"roleTitle":"Data Analyst","numOfTalents":1,"budgetMinUsd":1800,"budgetMaxUsd":2400,"urgencyLevel":"Standard","description":"Permanent analyst hire, employed directly by Northwind.","serviceType":"Hire Talent"}', (now() - interval '21 days'))
on conflict (id) do update set client_id = excluded.client_id, service_type = excluded.service_type, title = excluded.title, status = excluded.status, role_description = excluded.role_description, payload = excluded.payload, created_at = excluded.created_at;

insert into public.talent_requests (id, client_id, service_type, title, status, role_description, payload, created_at)
values ('5eed0001-0000-4000-8000-000000000004', 'seed_client_lumen', 'Project Execution', 'Support Migration', 'Candidates Ready', 'Migrate three years of support history into a new helpdesk.', '{"roleTitle":"Support Migration","numOfTalents":2,"budgetMinUsd":8000,"budgetMaxUsd":14000,"urgencyLevel":"Standard","description":"Migrate three years of support history into a new helpdesk.","serviceType":"Project Execution"}', (now() - interval '10 days'))
on conflict (id) do update set client_id = excluded.client_id, service_type = excluded.service_type, title = excluded.title, status = excluded.status, role_description = excluded.role_description, payload = excluded.payload, created_at = excluded.created_at;

insert into public.talent_requests (id, client_id, service_type, title, status, role_description, payload, created_at)
values ('5eed0001-0000-4000-8000-000000000005', 'seed_client_northwind', 'Outsource Talent', 'Virtual Assistant', 'New Request', 'Inbox and calendar support for two directors.', '{"roleTitle":"Virtual Assistant","numOfTalents":1,"budgetMinUsd":800,"budgetMaxUsd":1200,"urgencyLevel":"Standard","description":"Inbox and calendar support for two directors.","serviceType":"Outsource Talent"}', (now() - interval '2 days'))
on conflict (id) do update set client_id = excluded.client_id, service_type = excluded.service_type, title = excluded.title, status = excluded.status, role_description = excluded.role_description, payload = excluded.payload, created_at = excluded.created_at;

insert into public.matches (id, request_id, talent_id, status, score)
values ('seed_match_ada', '5eed0001-0000-4000-8000-000000000001', 'seed_tp_ada', 'accepted', 92)
on conflict (id) do update set request_id = excluded.request_id, talent_id = excluded.talent_id, status = excluded.status, score = excluded.score;

insert into public.matches (id, request_id, talent_id, status, score)
values ('seed_match_bola', '5eed0001-0000-4000-8000-000000000002', 'seed_tp_bola', 'accepted', 88)
on conflict (id) do update set request_id = excluded.request_id, talent_id = excluded.talent_id, status = excluded.status, score = excluded.score;

insert into public.matches (id, request_id, talent_id, status, score)
values ('seed_match_chidi', '5eed0001-0000-4000-8000-000000000003', 'seed_tp_chidi', 'shortlisted', 84)
on conflict (id) do update set request_id = excluded.request_id, talent_id = excluded.talent_id, status = excluded.status, score = excluded.score;

insert into public.matches (id, request_id, talent_id, status, score)
values ('seed_match_dayo', '5eed0001-0000-4000-8000-000000000004', 'seed_tp_dayo', 'shortlisted', 71)
on conflict (id) do update set request_id = excluded.request_id, talent_id = excluded.talent_id, status = excluded.status, score = excluded.score;

insert into public.interviews (id, talent_id, client_id, request_id, title, status, interview_type, scheduled_time, date, time, duration_minutes, scheduled_timezone, client_timezone, talent_timezone, created_at)
values ('seed_int_chidi', 'seed_tp_chidi', 'seed_client_northwind', '5eed0001-0000-4000-8000-000000000003', 'Data Analyst — first conversation', 'Proposed', 'video', (now() + interval '3 days'), (current_date + 3), '10:16', 45, 'Europe/London', 'Europe/London', 'Africa/Lagos', (now() - interval '5 days'))
on conflict (id) do update set talent_id = excluded.talent_id, client_id = excluded.client_id, request_id = excluded.request_id, title = excluded.title, status = excluded.status, interview_type = excluded.interview_type, scheduled_time = excluded.scheduled_time, date = excluded.date, time = excluded.time, duration_minutes = excluded.duration_minutes, scheduled_timezone = excluded.scheduled_timezone, client_timezone = excluded.client_timezone, talent_timezone = excluded.talent_timezone, created_at = excluded.created_at;

insert into public.interviews (id, talent_id, client_id, request_id, title, status, interview_type, scheduled_time, date, time, duration_minutes, scheduled_timezone, client_timezone, talent_timezone, created_at)
values ('seed_int_dayo', 'seed_tp_dayo', 'seed_client_lumen', '5eed0001-0000-4000-8000-000000000004', 'Support migration — scoping call', 'Scheduled', 'video', (now() + interval '1 days'), (current_date + 1), '10:16', 30, 'America/New_York', 'America/New_York', 'Africa/Lagos', (now() - interval '5 days'))
on conflict (id) do update set talent_id = excluded.talent_id, client_id = excluded.client_id, request_id = excluded.request_id, title = excluded.title, status = excluded.status, interview_type = excluded.interview_type, scheduled_time = excluded.scheduled_time, date = excluded.date, time = excluded.time, duration_minutes = excluded.duration_minutes, scheduled_timezone = excluded.scheduled_timezone, client_timezone = excluded.client_timezone, talent_timezone = excluded.talent_timezone, created_at = excluded.created_at;

insert into public.interviews (id, talent_id, client_id, request_id, title, status, interview_type, scheduled_time, date, time, duration_minutes, scheduled_timezone, client_timezone, talent_timezone, created_at)
values ('seed_int_bola', 'seed_tp_bola', 'seed_client_lumen', '5eed0001-0000-4000-8000-000000000002', 'Frontend Engineer — technical', 'Completed', 'video', (now() - interval '30 days'), (current_date - 30), '10:16', 60, 'America/New_York', 'America/New_York', 'Africa/Lagos', (now() - interval '5 days'))
on conflict (id) do update set talent_id = excluded.talent_id, client_id = excluded.client_id, request_id = excluded.request_id, title = excluded.title, status = excluded.status, interview_type = excluded.interview_type, scheduled_time = excluded.scheduled_time, date = excluded.date, time = excluded.time, duration_minutes = excluded.duration_minutes, scheduled_timezone = excluded.scheduled_timezone, client_timezone = excluded.client_timezone, talent_timezone = excluded.talent_timezone, created_at = excluded.created_at;

-- ----------------------------------------------------------------------
-- Contracts and service fees
-- ----------------------------------------------------------------------

insert into public.contracts (id, talent_id, client_id, service_type, rate_type, rate_amount, currency, payment_terms_days, status, start_date, billing_model, billed_through, signed_at)
values ('seed_contract_ada', 'seed_tp_ada', 'seed_client_northwind', 'Managed Workforce', 'Monthly', 2800, 'USD', 30, 'active', (current_date - 92), 'recurring_monthly', to_char(now() - interval '1 months', 'YYYY-MM'), (now() - interval '92 days'))
on conflict (id) do update set talent_id = excluded.talent_id, client_id = excluded.client_id, service_type = excluded.service_type, rate_type = excluded.rate_type, rate_amount = excluded.rate_amount, currency = excluded.currency, payment_terms_days = excluded.payment_terms_days, status = excluded.status, start_date = excluded.start_date, billing_model = excluded.billing_model, billed_through = excluded.billed_through, signed_at = excluded.signed_at;

insert into public.contracts (id, talent_id, client_id, service_type, rate_type, rate_amount, currency, payment_terms_days, status, start_date, billing_model, billed_through, signed_at)
values ('seed_contract_bola', 'seed_tp_bola', 'seed_client_lumen', 'Outsource Talent', 'Monthly', 2400, 'USD', 14, 'active', (current_date - 45), 'recurring_monthly', null, (now() - interval '45 days'))
on conflict (id) do update set talent_id = excluded.talent_id, client_id = excluded.client_id, service_type = excluded.service_type, rate_type = excluded.rate_type, rate_amount = excluded.rate_amount, currency = excluded.currency, payment_terms_days = excluded.payment_terms_days, status = excluded.status, start_date = excluded.start_date, billing_model = excluded.billing_model, billed_through = excluded.billed_through, signed_at = excluded.signed_at;

insert into public.contracts (id, talent_id, client_id, service_type, rate_type, rate_amount, currency, payment_terms_days, status, start_date, billing_model, placement_fee_usd)
values ('seed_contract_chidi', 'seed_tp_chidi', 'seed_client_northwind', 'Hire Talent', 'Monthly', 2000, 'USD', 14, 'pending_signatures', (current_date + 14), 'placement_fee', 7200)
on conflict (id) do update set talent_id = excluded.talent_id, client_id = excluded.client_id, service_type = excluded.service_type, rate_type = excluded.rate_type, rate_amount = excluded.rate_amount, currency = excluded.currency, payment_terms_days = excluded.payment_terms_days, status = excluded.status, start_date = excluded.start_date, billing_model = excluded.billing_model, placement_fee_usd = excluded.placement_fee_usd;

insert into public.contracts (id, talent_id, client_id, service_type, rate_type, rate_amount, currency, payment_terms_days, status, start_date, end_date, billing_model, project_fee_usd)
values ('seed_contract_project', 'seed_tp_dayo', 'seed_client_lumen', 'Project Execution', 'Monthly', 0, 'USD', 30, 'active', (current_date - 20), (current_date + 40), 'project_fee', 11000)
on conflict (id) do update set talent_id = excluded.talent_id, client_id = excluded.client_id, service_type = excluded.service_type, rate_type = excluded.rate_type, rate_amount = excluded.rate_amount, currency = excluded.currency, payment_terms_days = excluded.payment_terms_days, status = excluded.status, start_date = excluded.start_date, end_date = excluded.end_date, billing_model = excluded.billing_model, project_fee_usd = excluded.project_fee_usd;

insert into public.fee_config (id, service_line, client_fee_pct, talent_commission_pct)
values ('fee_placement', 'placement', 0.2, 0)
on conflict (service_line) do update set id = excluded.id, client_fee_pct = excluded.client_fee_pct, talent_commission_pct = excluded.talent_commission_pct;

insert into public.fee_config (id, service_line, client_fee_pct, talent_commission_pct)
values ('fee_outsourcing', 'outsourcing', 0.15, 0.1)
on conflict (service_line) do update set id = excluded.id, client_fee_pct = excluded.client_fee_pct, talent_commission_pct = excluded.talent_commission_pct;

insert into public.fee_config (id, service_line, client_fee_pct, talent_commission_pct)
values ('fee_managed_workforce', 'managed_workforce', 0.25, 0.1)
on conflict (service_line) do update set id = excluded.id, client_fee_pct = excluded.client_fee_pct, talent_commission_pct = excluded.talent_commission_pct;

insert into public.fee_config (id, service_line, client_fee_pct, talent_commission_pct)
values ('fee_project', 'project', 0.3, 0.15)
on conflict (service_line) do update set id = excluded.id, client_fee_pct = excluded.client_fee_pct, talent_commission_pct = excluded.talent_commission_pct;

-- ----------------------------------------------------------------------
-- Invoices, line items and payouts
-- ----------------------------------------------------------------------

insert into public.invoices (id, invoice_number, client_id, contract_id, period, service_line, amount, subtotal_usd, tax_amount_usd, total_usd, total_amount_usd, currency, usd_rate, rate_source, status, payment_terms_days, issued_at, sent_at, due_date, created_at)
values ('seed_inv_paid', ('KNG-INV-' || to_char(now() - interval '2 months', 'YYYYMM') || '-9001'), 'seed_client_northwind', 'seed_contract_ada', to_char(now() - interval '2 months', 'YYYY-MM'), 'managed_workforce', 3500, 3500, 0, 3500, 3500, 'USD', 1, 'same_currency', 'paid', 30, (now() - interval '61 days'), (now() - interval '61 days'), (now() - interval '28 days'), (now() - interval '61 days'))
on conflict (id) do update set invoice_number = excluded.invoice_number, client_id = excluded.client_id, contract_id = excluded.contract_id, period = excluded.period, service_line = excluded.service_line, amount = excluded.amount, subtotal_usd = excluded.subtotal_usd, tax_amount_usd = excluded.tax_amount_usd, total_usd = excluded.total_usd, total_amount_usd = excluded.total_amount_usd, currency = excluded.currency, usd_rate = excluded.usd_rate, rate_source = excluded.rate_source, status = excluded.status, payment_terms_days = excluded.payment_terms_days, issued_at = excluded.issued_at, sent_at = excluded.sent_at, due_date = excluded.due_date, created_at = excluded.created_at;

insert into public.invoices (id, invoice_number, client_id, contract_id, period, service_line, amount, subtotal_usd, tax_amount_usd, total_usd, total_amount_usd, currency, usd_rate, rate_source, status, payment_terms_days, issued_at, sent_at, due_date, created_at)
values ('seed_inv_overdue', ('KNG-INV-' || to_char(now() - interval '1 months', 'YYYYMM') || '-9001'), 'seed_client_northwind', 'seed_contract_ada', to_char(now() - interval '1 months', 'YYYY-MM'), 'managed_workforce', 3500, 3500, 0, 3500, 3500, 'USD', 1, 'same_currency', 'sent', 30, (now() - interval '31 days'), (now() - interval '31 days'), (now() - interval '9 days'), (now() - interval '31 days'))
on conflict (id) do update set invoice_number = excluded.invoice_number, client_id = excluded.client_id, contract_id = excluded.contract_id, period = excluded.period, service_line = excluded.service_line, amount = excluded.amount, subtotal_usd = excluded.subtotal_usd, tax_amount_usd = excluded.tax_amount_usd, total_usd = excluded.total_usd, total_amount_usd = excluded.total_amount_usd, currency = excluded.currency, usd_rate = excluded.usd_rate, rate_source = excluded.rate_source, status = excluded.status, payment_terms_days = excluded.payment_terms_days, issued_at = excluded.issued_at, sent_at = excluded.sent_at, due_date = excluded.due_date, created_at = excluded.created_at;

insert into public.invoices (id, invoice_number, client_id, contract_id, period, service_line, amount, subtotal_usd, tax_amount_usd, total_usd, total_amount_usd, currency, usd_rate, rate_source, status, payment_terms_days, is_disputed, dispute_reason, issued_at, sent_at, due_date, created_at)
values ('seed_inv_disputed', ('KNG-INV-' || to_char(now() - interval '1 months', 'YYYYMM') || '-9002'), 'seed_client_lumen', 'seed_contract_bola', to_char(now() - interval '1 months', 'YYYY-MM'), 'outsourcing', 2760, 2760, 0, 2760, 2760, 'USD', 1, 'same_currency', 'sent', 14, true, 'Two days of the period were covered by our own team.', (now() - interval '31 days'), (now() - interval '31 days'), (now() - interval '4 days'), (now() - interval '31 days'))
on conflict (id) do update set invoice_number = excluded.invoice_number, client_id = excluded.client_id, contract_id = excluded.contract_id, period = excluded.period, service_line = excluded.service_line, amount = excluded.amount, subtotal_usd = excluded.subtotal_usd, tax_amount_usd = excluded.tax_amount_usd, total_usd = excluded.total_usd, total_amount_usd = excluded.total_amount_usd, currency = excluded.currency, usd_rate = excluded.usd_rate, rate_source = excluded.rate_source, status = excluded.status, payment_terms_days = excluded.payment_terms_days, is_disputed = excluded.is_disputed, dispute_reason = excluded.dispute_reason, issued_at = excluded.issued_at, sent_at = excluded.sent_at, due_date = excluded.due_date, created_at = excluded.created_at;

insert into public.invoices (id, client_id, contract_id, service_line, amount, subtotal_usd, tax_amount_usd, total_usd, total_amount_usd, currency, usd_rate, rate_source, status, payment_terms_days, created_at)
values ('seed_inv_draft', 'seed_client_lumen', 'seed_contract_project', 'project', 11000, 11000, 0, 11000, 11000, 'USD', 1, 'same_currency', 'draft', 30, (now() - interval '3 days'))
on conflict (id) do update set client_id = excluded.client_id, contract_id = excluded.contract_id, service_line = excluded.service_line, amount = excluded.amount, subtotal_usd = excluded.subtotal_usd, tax_amount_usd = excluded.tax_amount_usd, total_usd = excluded.total_usd, total_amount_usd = excluded.total_amount_usd, currency = excluded.currency, usd_rate = excluded.usd_rate, rate_source = excluded.rate_source, status = excluded.status, payment_terms_days = excluded.payment_terms_days, created_at = excluded.created_at;

insert into public.invoice_line_items (id, invoice_id, quantity, description, unit_amount, amount)
values ('seed_ili_paid', 'seed_inv_paid', 1, 'Ada Okafor — managed workforce, 2026-09', 3500, 3500)
on conflict (id) do update set invoice_id = excluded.invoice_id, quantity = excluded.quantity, description = excluded.description, unit_amount = excluded.unit_amount, amount = excluded.amount;

insert into public.invoice_line_items (id, invoice_id, quantity, description, unit_amount, amount)
values ('seed_ili_overdue', 'seed_inv_overdue', 1, 'Ada Okafor — managed workforce, 2026-10', 3500, 3500)
on conflict (id) do update set invoice_id = excluded.invoice_id, quantity = excluded.quantity, description = excluded.description, unit_amount = excluded.unit_amount, amount = excluded.amount;

insert into public.invoice_line_items (id, invoice_id, quantity, description, unit_amount, amount)
values ('seed_ili_disputed', 'seed_inv_disputed', 1, 'Bola Hassan — outsourcing, 2026-10', 2760, 2760)
on conflict (id) do update set invoice_id = excluded.invoice_id, quantity = excluded.quantity, description = excluded.description, unit_amount = excluded.unit_amount, amount = excluded.amount;

insert into public.invoice_line_items (id, invoice_id, quantity, description, unit_amount, amount)
values ('seed_ili_draft', 'seed_inv_draft', 1, 'Support history migration — fixed project fee', 11000, 11000)
on conflict (id) do update set invoice_id = excluded.invoice_id, quantity = excluded.quantity, description = excluded.description, unit_amount = excluded.unit_amount, amount = excluded.amount;

insert into public.talent_payouts (id, talent_id, contract_id, invoice_id, period, gross_amount, commission_pct, net_amount, amount, net_amount_usd, currency, usd_rate, rate_source, status, paid_at, created_at)
values ('seed_payout_paid', 'seed_tp_ada', 'seed_contract_ada', 'seed_inv_paid', to_char(now() - interval '2 months', 'YYYY-MM'), 2800, 0.1, 2520, 2520, 2520, 'USD', 1, 'same_currency', 'paid', (now() - interval '25 days'), (now() - interval '61 days'))
on conflict (id) do update set talent_id = excluded.talent_id, contract_id = excluded.contract_id, invoice_id = excluded.invoice_id, period = excluded.period, gross_amount = excluded.gross_amount, commission_pct = excluded.commission_pct, net_amount = excluded.net_amount, amount = excluded.amount, net_amount_usd = excluded.net_amount_usd, currency = excluded.currency, usd_rate = excluded.usd_rate, rate_source = excluded.rate_source, status = excluded.status, paid_at = excluded.paid_at, created_at = excluded.created_at;

insert into public.talent_payouts (id, talent_id, contract_id, invoice_id, period, gross_amount, commission_pct, net_amount, amount, net_amount_usd, currency, usd_rate, rate_source, status, created_at)
values ('seed_payout_pending', 'seed_tp_ada', 'seed_contract_ada', 'seed_inv_overdue', to_char(now() - interval '1 months', 'YYYY-MM'), 2800, 0.1, 2520, 2520, 2520, 'USD', 1, 'same_currency', 'pending', (now() - interval '31 days'))
on conflict (id) do update set talent_id = excluded.talent_id, contract_id = excluded.contract_id, invoice_id = excluded.invoice_id, period = excluded.period, gross_amount = excluded.gross_amount, commission_pct = excluded.commission_pct, net_amount = excluded.net_amount, amount = excluded.amount, net_amount_usd = excluded.net_amount_usd, currency = excluded.currency, usd_rate = excluded.usd_rate, rate_source = excluded.rate_source, status = excluded.status, created_at = excluded.created_at;

-- ----------------------------------------------------------------------
-- Support
-- ----------------------------------------------------------------------

insert into public.support_tickets (id, client_id, subject, category, description, status, priority, created_at, last_activity)
values ('seed_tkt_open', 'seed_client_northwind', 'Invoice query for last month', 'Billing Issue', 'The November invoice looks higher than the agreed rate.', 'Open', 'High', (now() - interval '3 days'), (now() - interval '3 days'))
on conflict (id) do update set client_id = excluded.client_id, subject = excluded.subject, category = excluded.category, description = excluded.description, status = excluded.status, priority = excluded.priority, created_at = excluded.created_at, last_activity = excluded.last_activity;

insert into public.support_tickets (id, talent_id, subject, category, description, status, priority, created_at, last_activity)
values ('seed_tkt_progress', 'seed_tp_bola', 'Cannot upload my renewed certificate', 'Technical Support', 'The upload fails at 80% every time.', 'In Progress', 'Medium', (now() - interval '6 days'), (now() - interval '1 days'))
on conflict (id) do update set talent_id = excluded.talent_id, subject = excluded.subject, category = excluded.category, description = excluded.description, status = excluded.status, priority = excluded.priority, created_at = excluded.created_at, last_activity = excluded.last_activity;

insert into public.support_tickets (id, talent_id, subject, category, description, status, priority, created_at, last_activity)
values ('seed_tkt_resolved', 'seed_tp_ada', 'Payout date confirmation', 'Guidance', 'Wanted to confirm when October payouts land.', 'Resolved', 'Low', (now() - interval '20 days'), (now() - interval '18 days'))
on conflict (id) do update set talent_id = excluded.talent_id, subject = excluded.subject, category = excluded.category, description = excluded.description, status = excluded.status, priority = excluded.priority, created_at = excluded.created_at, last_activity = excluded.last_activity;

insert into public.support_messages (id, ticket_id, sender_name, sender_role, is_support, text, timestamp, created_at)
values ('seed_smsg_1', 'seed_tkt_progress', 'Bola Hassan', 'talent', false, 'It gets to 80% and then says upload failed. Tried twice on two networks.', (now() - interval '6 days'), (now() - interval '6 days'))
on conflict (id) do update set ticket_id = excluded.ticket_id, sender_name = excluded.sender_name, sender_role = excluded.sender_role, is_support = excluded.is_support, text = excluded.text, timestamp = excluded.timestamp, created_at = excluded.created_at;

insert into public.support_messages (id, ticket_id, sender_name, sender_role, is_support, text, timestamp, created_at)
values ('seed_smsg_2', 'seed_tkt_progress', 'Tola Talent', 'admin', true, 'Thanks Bola. What size is the file? Anything over 5MB is rejected.', (now() - interval '1 days'), (now() - interval '1 days'))
on conflict (id) do update set ticket_id = excluded.ticket_id, sender_name = excluded.sender_name, sender_role = excluded.sender_role, is_support = excluded.is_support, text = excluded.text, timestamp = excluded.timestamp, created_at = excluded.created_at;

commit;

-- What the data is arranged to let you test:
--
--   Payroll        generate the run for last month. Two people, one of
--                  them prorated because the contract started mid-month.
--   Billing        generate drafts. The placement and project contracts
--                  bill once; the two monthly ones bill per month.
--   Overdue        run the nightly cron. The sent invoice past its due
--                  date moves to overdue; the disputed one does not.
--   Compliance     try to extend an offer to Chidi Eze, who has signed
--                  no compliance documents.
--   Payouts        try to approve the pending payout. Its invoice is
--                  not paid, so it is blocked.
--   Documents      Ada Okafor has three CV versions, one current.
--                  Three certificates: valid, expiring soon, expired.
--   Assessments    six published assessments, one per role, with real
--                  questions. Assignments at every state.
