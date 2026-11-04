-- ============================================================================
-- Kongila — full schema
--
-- Rebuilt 17 October 2026 from the live Supabase project, not from the previous
-- version of this file. The old one described 24 tables; the database has 54.
-- Thirty tables had been created by hand in the console and existed nowhere in
-- version control.
--
-- Running this against an empty Postgres database reproduces the live schema.
-- It does NOT include data, and it does NOT include the current RLS policies
-- (see the RLS section at the end for why).
--
-- Order: extensions, enum types, tables, foreign keys, indexes, RLS.
-- Foreign keys are added after all tables exist so table order does not matter.
-- ============================================================================

create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";


-- ============================================================================
-- ENUM TYPES
--
-- 26 types. Five are defined but unused by any column: contract_status,
-- contract_status_enum, task_status, task_priority and user_role. They are
-- kept so the schema reproduces faithfully, but see the NOTES at the end.
-- ============================================================================

create type academy_resource_status as enum ('draft', 'published', 'archived');
create type academy_resource_type as enum ('video', 'article', 'quiz', 'course');
create type calendar_event_type as enum ('meeting', 'deadline', 'milestone', 'review', 'other');
create type compliance_record_type as enum ('gdpr_consent', 'data_retention', 'access_log', 'offboarding');
create type contract_status as enum ('Draft', 'PendingSignature', 'Signed', 'Terminated');
create type contract_status_enum as enum ('pending_signatures', 'client_signed', 'talent_signed', 'fully_signed', 'active', 'ended', 'terminated', 'closed', 'pending');
create type gdpr_consent_status as enum ('pending', 'granted', 'denied', 'revoked');
create type grade_rating as enum ('A+', 'A', 'B', 'Reject');
create type offer_status_enum as enum ('draft', 'submitted', 'revision_requested', 'admin_approved', 'sent_to_talent', 'accepted', 'declined', 'admin_declined', 'contract_active', 'expired');
create type payroll_entry_status as enum ('draft', 'approved', 'processing', 'paid', 'failed');
create type remotan_project_status as enum ('planning', 'active', 'on_hold', 'completed', 'cancelled');
create type remotan_task_status as enum ('not_started', 'in_progress', 'blocked', 'under_review', 'completed');
create type review_cycle_frequency as enum ('weekly', 'monthly', 'quarterly');
create type subscription_status as enum ('trial', 'active', 'past_due', 'cancelled', 'archived');
create type subscription_tier as enum ('starter', 'growth', 'scale', 'enterprise');
create type task_priority as enum ('High', 'Medium', 'Low');
create type task_status as enum ('Todo', 'InProgress', 'Review', 'Blocked', 'Done');
create type time_log_status as enum ('active', 'stopped', 'approved', 'disputed');
create type user_role as enum ('talent', 'client', 'admin');
create type vetting_stage as enum ('Application Screening', 'Skill Assessment', 'Behavioural Interview', 'Personality Test', 'Remote Readiness', 'Work Simulation', 'Final Review');
create type vetting_status as enum ('Applied', 'Review', 'Vetted', 'Matched', 'Deployed');
create type workflow_state as enum ('pending', 'in_progress', 'failed', 'completed', 'cancelled');
create type workflow_type as enum ('talent_onboarding', 'performance_review_cycle', 'contract_renewal_alert', 'invoice_generation', 'talent_replacement', 'workspace_offboarding', 'trial_expiry', 'payroll_generation');
create type workspace_member_role as enum ('workspace_admin', 'project_manager', 'team_member', 'supervisor', 'finance');
create type workspace_member_status as enum ('active', 'pending', 'offboarded', 'suspended');
create type workspace_origin as enum ('kongila_contract', 'external_subscription');


-- ============================================================================
-- IDENTITY AND ACCESS
-- ============================================================================

create table users (
  id              varchar(255) primary key default (gen_random_uuid())::text,
  email           varchar(255) not null unique,
  password_hash   varchar(255) not null,
  role            varchar(50) not null,
  status          varchar(50) default 'active',
  email_verified  boolean default false,
  name            text,
  last_login      timestamptz,
  created_at      timestamptz default current_timestamp,
  updated_at      timestamptz default current_timestamp,
  -- 12 spellings for 4 roles. See NOTES.
  constraint users_role_check check (role in (
    'talent', 'client', 'admin', 'super_admin', 'account_manager',
    'talent_manager', 'ops_manager', 'superadmin',
    'Super Admin', 'Account Manager', 'Talent Manager', 'Operations Manager')),
  constraint users_status_check check (status in ('active', 'suspended', 'inactive'))
);

create table roles (
  id    varchar(255) primary key default (gen_random_uuid())::text,
  name  varchar(100) not null unique
);

create table user_roles (
  id       varchar(255) primary key default (gen_random_uuid())::text,
  user_id  varchar(255),
  role_id  varchar(255)
);

create table organizations (
  id                  varchar(255) primary key default (gen_random_uuid())::text,
  name                varchar(255) not null,
  industry            varchar(100),
  company_size        varchar(50),
  country             varchar(100),
  website             varchar(255),
  contact_email       varchar(255),
  contact_phone       varchar(50),
  created_by          varchar(255),
  account_manager_id  text,
  status              text default 'active',
  multi_user_enabled  boolean default false,
  created_at          timestamptz default current_timestamp
);

create table client_profiles (
  id               varchar(255) primary key default (gen_random_uuid())::text,
  user_id          varchar(255),
  organization_id  varchar(255),
  position         varchar(100),
  phone            varchar(50)
);


-- ============================================================================
-- TALENT
--
-- Two talent tables exist. talent_profiles is what the Kongila portals use.
-- talents is older, uses proper enums, and survives only because
-- workspace_members.talent_id references it. See NOTES.
-- ============================================================================

create table talent_profiles (
  id                          varchar(255) primary key default (gen_random_uuid())::text,
  user_id                     varchar(255),
  full_name                   varchar(255) not null,
  phone                       varchar(50),
  country                     varchar(100),
  address                     text,
  gender                      varchar(20),
  level                       varchar(50),
  availability_hours          integer default 40,
  salary_min                  numeric,
  salary_max                  numeric,
  salary_expectation          numeric,
  experience_years            integer,
  status                      varchar(50) default 'active',
  timezone                    varchar(50) default 'GMT+1 (Lagos)',
  vetting_stage               varchar(50) default 'Final Review',
  vetting_status              varchar(50) default 'Vetted',
  grade                       varchar(10) default 'A',
  bio                         text,
  avatar_url                  varchar(255),
  government_id_url           varchar(255),
  proof_of_address_url        varchar(255),
  profile_integrity_progress  integer default 94,
  date_joined                 timestamptz default current_timestamp,
  constraint talent_profiles_status_check check (status in ('active', 'assigned', 'inactive'))
);

create table talents (
  id                  varchar(255) primary key,
  name                varchar(255) not null,
  email               varchar(255) not null,
  avatar              text,
  title               varchar(255) not null,
  skills              text[] default '{}'::text[],
  timezone            varchar(100) not null,
  salary_expectation  numeric not null,
  experience_years    integer not null,
  availability        varchar(100) not null,
  vetting_stage       vetting_stage not null default 'Application Screening',
  vetting_status      vetting_status not null default 'Applied',
  grade               grade_rating not null default 'B',
  tags                text[] default '{}'::text[],
  bio                 text
);

create table skills (
  id    varchar(255) primary key default (gen_random_uuid())::text,
  name  varchar(100) not null unique
);

create table talent_skills (
  id        varchar(255) primary key default (gen_random_uuid())::text,
  talent_id varchar(255),
  skill_id  varchar(255),
  level     varchar(50) default 'intermediate',
  constraint talent_skills_level_check check (level in ('beginner', 'intermediate', 'expert'))
);


-- ============================================================================
-- VETTING AND ASSESSMENTS
--
-- skill_assessment_results and talent_skill_assessments use camelCase column
-- names, so every reference to them has to be double-quoted. See NOTES.
-- ============================================================================

create table assessments (
  id                        varchar(255) primary key default (gen_random_uuid())::text,
  title                     varchar(255) not null,
  description               text,
  role_targeted             varchar(255),
  total_time_limit_minutes  integer default 60,
  passing_score             integer default 70,
  categories                jsonb default '[]'::jsonb,
  category_overrides        jsonb default '[]'::jsonb,
  status                    varchar(50) default 'draft',
  created_by                varchar(255),
  created_at                timestamptz default current_timestamp,
  constraint assessments_status_check check (status in ('draft', 'published', 'archived'))
);

create table assessment_categories (
  id                   varchar(255) primary key default (gen_random_uuid())::text,
  name                 varchar(255) not null,
  description          text,
  time_limit_minutes   integer default 15,
  is_reusable          boolean default true,
  tags                 jsonb default '[]'::jsonb,
  questions            jsonb default '[]'::jsonb,
  created_by           varchar(255),
  created_at           timestamptz default current_timestamp
);

create table assessment_questions (
  id              varchar(255) primary key default (gen_random_uuid())::text,
  category_id     varchar(255),
  type            varchar(50) not null,
  question_text   text not null,
  options         jsonb,
  correct_answer  jsonb,
  expected_answer text,
  scoring_weight  integer default 1,
  max_score       integer default 10
);

create table assessment_assignments (
  id               varchar(255) primary key default (gen_random_uuid())::text,
  assessment_id    varchar(255),
  talent_id        varchar(255),
  status           varchar(50) default 'not_started',
  start_time       timestamptz,
  end_time         timestamptz,
  score            integer,
  category_scores  jsonb,
  answers          jsonb,
  constraint assessment_assignments_status_check
    check (status in ('not_started', 'in_progress', 'completed', 'expired'))
);

create table skill_assessment_results (
  id                 varchar(255) primary key default (gen_random_uuid())::text,
  "talentId"         varchar(255),
  "assessmentId"     varchar(255),
  score              integer,
  passed             boolean,
  "completedAt"      timestamptz,
  "submittedAt"      timestamptz,
  "subjectiveScores" jsonb,
  "categoryScores"   jsonb
);

create table talent_skill_assessments (
  id              varchar(255) primary key default (gen_random_uuid())::text,
  "talentId"      varchar(255),
  "assessmentId"  varchar(255),
  status          varchar(50) default 'assigned',
  score           integer,
  "assignedAt"    timestamptz
);


-- ============================================================================
-- REQUESTS
--
-- Three request tables. talent_requests is what the portals use and stores the
-- whole request in a jsonb payload. service_requests is legacy but offers
-- references it. client_requests appears unused. See NOTES.
-- ============================================================================

create table talent_requests (
  id                  uuid primary key default uuid_generate_v4(),
  client_id           text not null,
  service_type        text not null,
  payload             jsonb not null,
  status              text default 'new',
  role_description    text,
  title               text,
  talent_manager_id   text,
  account_manager_id  text,
  created_at          timestamptz default now()
);

create table service_requests (
  id                varchar(255) primary key default (gen_random_uuid())::text,
  client_id         varchar(255),
  service_type      varchar(50) not null,
  title             varchar(255) not null,
  description       text,
  num_of_talents    integer default 1,
  duration          varchar(50),
  start_date        date,
  commitment_level  varchar(50),
  budget_min        numeric,
  budget_max        numeric,
  status            varchar(50) default 'new',
  created_at        timestamptz default current_timestamp,
  constraint service_requests_service_type_check
    check (service_type in ('hire', 'outsource', 'managed', 'project')),
  constraint service_requests_status_check
    check (status in ('new', 'reviewing', 'matching', 'closed'))
);

create table client_requests (
  id               varchar(255) primary key,
  client_id        varchar(255) not null,
  company_name     varchar(255) not null,
  role_title       varchar(255) not null,
  service_line     varchar(255) not null,
  description      text not null,
  skills_required  text[] default '{}'::text[],
  duration_months  integer not null default 6,
  budget_monthly   numeric not null,
  currency         varchar(10) not null default 'USD',
  status           varchar(50) not null default 'Matching in Progress'
);

create table request_activity_logs (
  id             uuid primary key default gen_random_uuid(),
  request_id     uuid,
  actor_id       text,
  action_type    text not null,
  field_changes  jsonb,
  created_at     timestamptz default now()
);


-- ============================================================================
-- MATCHING, INTERVIEWS, OFFERS, CONTRACTS
-- ============================================================================

create table matches (
  id          varchar(255) primary key default (gen_random_uuid())::text,
  request_id  varchar(255),
  talent_id   varchar(255),
  score       integer,
  breakdown   jsonb,
  status      varchar(50) default 'proposed',
  created_at  timestamptz default current_timestamp,
  constraint matches_status_check check (status in ('proposed', 'shortlisted', 'rejected', 'accepted'))
);

create table interviews (
  id                        text primary key default (gen_random_uuid())::text,
  request_id                text,
  match_id                  text,
  talent_id                 text not null,
  client_id                 text not null,
  title                     text,
  scheduled_time            timestamptz,
  duration_minutes          integer default 30,
  status                    text default 'pending_confirmation',
  interview_type            text,
  meeting_link              text,
  -- denormalised display fields
  talent_name               text,
  talent_avatar             text,
  client_name               text,
  date                      text,
  time                      text,
  -- scheduling negotiation
  proposed_slots            jsonb,
  confirmed_slot            timestamptz,
  talent_response_deadline  timestamptz,
  loop_count                integer not null default 0,
  reschedule_requested      boolean default false,
  reschedule_reason         text,
  proposed_new_date         text,
  proposed_new_time         text,
  revealed_to_talent_at     timestamptz,
  -- calendar
  google_calendar_event_id  text,
  google_calendar_link      text,
  -- outcome and notes
  client_rating             integer,
  client_notes              text,
  client_feedback           text,
  client_note_to_admin      text,
  talent_notes              text,
  talent_decline_reason     text,
  admin_outcome             text,
  admin_note_internal       text,
  notes                     text,
  outcome                   text,
  created_at                timestamptz default now(),
  updated_at                timestamptz default now(),
  constraint interviews_client_rating_check check (client_rating >= 1 and client_rating <= 5),
  constraint interviews_admin_outcome_check
    check (admin_outcome in ('Proceed to Hire', 'No Fit', 'Hold')),
  constraint interviews_interview_type_check
    check (interview_type in ('video', 'phone', 'async_video')),
  -- 18 values, including Cancelled and cancelled as separate options. See NOTES.
  constraint interviews_status_check check (status in (
    'client_requested', 'admin_reviewing', 'sent_to_talent', 'talent_accepted',
    'talent_countered', 'talent_declined', 'confirmed', 'expired',
    'admin_declined', 'cancelled', 'Completed', 'Scheduled', 'Rescheduled',
    'Cancelled', 'Proposed', 'Reschedule Requested', 'scheduled',
    'pending_confirmation'))
);

create table offers (
  id                        varchar(255) primary key default (gen_random_uuid())::text,
  request_id                varchar(255),
  match_id                  varchar(255),
  client_id                 varchar(255),
  talent_id                 varchar(255),
  initiated_by              text,
  entry_point               text,
  status                    offer_status_enum default 'draft',
  role_title                text not null,
  service_type              text not null,
  engagement_type           text,
  hours_per_week            integer,
  proposed_start_date       date,
  contract_duration_type    text,
  contract_months           integer,
  payment_model             text,
  proposed_rate_usd         numeric not null,
  payment_due_day           integer,
  payment_period            text,
  remotan_enabled           boolean default true,
  client_note_to_admin      text,
  talent_decline_reason     text,
  admin_note_internal       text,
  sent_to_talent_at         timestamptz,
  talent_response_deadline  timestamptz,
  accepted_at               timestamptz,
  loop_count                integer default 0,
  created_at                timestamptz default now(),
  updated_at                timestamptz default now(),
  constraint offers_initiated_by_check check (initiated_by in ('client', 'admin')),
  constraint offers_entry_point_check check (entry_point in
    ('matched_talent_page', 'my_requests_page', 'post_interview', 'direct_hire')),
  constraint offers_engagement_type_check check (engagement_type in ('full_time', 'part_time')),
  constraint offers_contract_duration_type_check check (contract_duration_type in ('ongoing', 'fixed_term')),
  constraint offers_payment_model_check check (payment_model in ('flat_rate', 'hourly')),
  constraint offers_payment_period_check check (payment_period in ('monthly', 'weekly')),
  constraint offers_payment_due_day_check check (payment_due_day >= 1 and payment_due_day <= 28)
);

create table contracts (
  id                   varchar(255) primary key default (gen_random_uuid())::text,
  client_id            varchar(255),
  talent_id            varchar(255),
  offer_id             varchar(255),
  service_type         varchar(50),
  engagement_model     varchar(100),
  entry_point          text,
  template_version_id  varchar(255),
  auto_generated       boolean default true,
  start_date           date,
  end_date             date,
  status               varchar(50) default 'pending',
  signed_at            timestamptz,
  -- rates and money
  rate_type            varchar(20),
  rate_amount          numeric,
  monthly_rate         numeric,
  monthly_rate_usd     numeric,
  hourly_rate_usd      numeric,
  payment_period       text,
  payment_due_day      integer,
  total_earned         numeric default 0,
  invoiced_balance     numeric default 0,
  next_payout          numeric default 0,
  next_payout_date     date,
  -- performance
  rating               numeric,
  quality_of_work      numeric,
  communication        numeric,
  timeliness           numeric,
  performance_score    numeric default 0,
  time_tracking_enabled boolean default false,
  constraint contracts_rate_type_check check (rate_type in ('Hourly', 'Monthly')),
  constraint contracts_rating_check check (rating >= 1 and rating <= 5),
  constraint contracts_quality_of_work_check check (quality_of_work >= 1.0 and quality_of_work <= 5.0),
  constraint contracts_communication_check check (communication >= 1.0 and communication <= 5.0),
  constraint contracts_timeliness_check check (timeliness >= 1.0 and timeliness <= 5.0),
  constraint contracts_status_check check (status in (
    'pending', 'active', 'ended', 'terminated', 'closed',
    'pending_signatures', 'client_signed', 'talent_signed', 'fully_signed'))
);


-- ============================================================================
-- DELIVERY (Kongila side, pre-Remotan)
-- ============================================================================

create table projects (
  id           varchar(255) primary key default (gen_random_uuid())::text,
  client_id    varchar(255),
  name         varchar(255) not null,
  description  text,
  start_date   date,
  end_date     date,
  status       varchar(50) default 'active',
  constraint projects_status_check check (status in ('active', 'completed', 'paused'))
);

create table tasks (
  id           varchar(255) primary key default (gen_random_uuid())::text,
  project_id   varchar(255),
  assigned_to  varchar(255),
  title        varchar(255) not null,
  description  text,
  status       varchar(50) default 'todo',
  priority     varchar(20) default 'Medium',
  deadline     date,
  constraint tasks_status_check check (status in ('todo', 'in_progress', 'review', 'done'))
);

create table assignments (
  id           varchar(255) primary key default (gen_random_uuid())::text,
  talent_id    varchar(255),
  project_id   varchar(255),
  contract_id  varchar(255),
  role         varchar(100),
  start_date   date,
  end_date     date,
  status       varchar(50) default 'active',
  constraint assignments_status_check check (status in ('active', 'completed', 'paused'))
);


-- ============================================================================
-- FINANCE
-- ============================================================================

create table invoices (
  id         varchar(255) primary key default (gen_random_uuid())::text,
  client_id  varchar(255),
  amount     numeric not null,
  status     varchar(50) default 'draft',
  due_date   date,
  constraint invoices_status_check check (status in ('draft', 'sent', 'paid', 'overdue'))
);

create table payments (
  id              varchar(255) primary key default (gen_random_uuid())::text,
  invoice_id      varchar(255),
  amount          numeric not null,
  payment_method  varchar(50),
  status          varchar(50) default 'pending',
  paid_at         timestamptz,
  constraint payments_status_check check (status in ('pending', 'paid', 'failed'))
);

create table talent_payouts (
  id           varchar(255) primary key default (gen_random_uuid())::text,
  talent_id    varchar(255),
  contract_id  varchar(255),
  amount       numeric not null,
  status       varchar(50) default 'pending',
  paid_at      timestamptz,
  constraint talent_payouts_status_check check (status in ('pending', 'paid'))
);


-- ============================================================================
-- DOCUMENTS, MESSAGING, SUPPORT, LOGS
-- ============================================================================

create table documents (
  id                 varchar(255) primary key default (gen_random_uuid())::text,
  user_id            varchar(255),
  name               varchar(255) not null,
  type               varchar(50),
  file_url           varchar(255),
  file_size          varchar(50),
  status             varchar(50) default 'uploaded',
  certificate_image  varchar(255),
  uploaded_at        timestamptz default current_timestamp,
  constraint documents_type_check check (type in
    ('CV', 'portfolio', 'NDA', 'agreement', 'certification', 'IT_Ethics_Policy')),
  constraint documents_status_check check (status in
    ('uploaded', 'signed', 'verified', 'vetted', 'needs_review',
     'pending_signature', 'under_review'))
);

create table conversations (
  id               uuid primary key default uuid_generate_v4(),
  type             text not null,
  participant_ids  uuid[] not null default '{}'::uuid[],
  context_type     text,
  context_id       uuid,
  created_at       timestamptz default now(),
  updated_at       timestamptz default now()
);

create table messages (
  id           varchar(255) primary key default (gen_random_uuid())::text,
  sender_id    varchar(255),
  receiver_id  varchar(255),
  content      text not null,
  read_status  boolean default false,
  timestamp    timestamptz default current_timestamp
);

create table notifications (
  id           varchar(255) primary key default (gen_random_uuid())::text,
  user_id      text,
  type         varchar(50),
  module_type  text,
  message      text not null,
  status       varchar(20) default 'unread',
  read         boolean default false,
  created_at   timestamptz default current_timestamp,
  constraint notifications_status_check check (status in ('read', 'unread'))
);

create table support_tickets (
  id             varchar(255) primary key default (gen_random_uuid())::text,
  talent_id      varchar(255),
  subject        varchar(255) not null,
  category       varchar(100) not null,
  status         varchar(50) default 'Open',
  priority       varchar(50) default 'High',
  last_activity  varchar(100) default 'Just now',
  created_at     timestamptz default current_timestamp,
  constraint support_tickets_category_check check (category in
    ('Payment Issues', 'Technical Support', 'Verification', 'Guidance')),
  constraint support_tickets_status_check check (status in ('Open', 'In Progress', 'Resolved')),
  constraint support_tickets_priority_check check (priority in ('Low', 'Medium', 'High', 'Urgent'))
);

create table support_messages (
  id           varchar(255) primary key default (gen_random_uuid())::text,
  ticket_id    varchar(255),
  sender_name  varchar(100) not null,
  sender_role  varchar(100) not null,
  is_support   boolean default false,
  avatar_url   varchar(255),
  text         text not null,
  timestamp    varchar(50) not null,
  created_at   timestamptz default current_timestamp
);

create table audit_logs (
  id         varchar(255) primary key default (gen_random_uuid())::text,
  user_id    varchar(255),
  actor      varchar(100),
  action     varchar(255) not null,
  entity     varchar(100),
  entity_id  varchar(100),
  details    text,
  timestamp  timestamptz default current_timestamp
);

create table agent_logs (
  id          varchar(255) primary key default (gen_random_uuid())::text,
  agent_name  varchar(100) not null,
  message     text not null,
  type        varchar(20) default 'info',
  timestamp   timestamptz default current_timestamp,
  constraint agent_logs_type_check check (type in ('info', 'success', 'warning', 'error'))
);

create table workflow_instances (
  workflow_instance_id  uuid primary key default uuid_generate_v4(),
  workflow_type         workflow_type not null,
  state                 workflow_state not null default 'pending',
  trigger_event         varchar(255) not null,
  trigger_entity_id     varchar(255) not null,
  last_step_completed   integer not null default 0,
  failed_at_step        integer,
  failure_reason        text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  constraint unique_active_workflow unique (workflow_type, trigger_entity_id, state)
    deferrable initially deferred
);


-- ============================================================================
-- REMOTAN
--
-- Out of scope for the Kongila launch, but these tables live in the same
-- database and must be reproduced, and must be secured on day 4.
-- ============================================================================

create table remotan_workspaces (
  id                        uuid primary key default uuid_generate_v4(),
  organization_id           varchar(255),
  workspace_origin          workspace_origin not null,
  kongila_managed           boolean not null default false,
  name                      varchar(255) not null,
  logo_url                  text,
  website                   varchar(255),
  default_timezone          varchar(100) default 'UTC',
  working_hours_start       time,
  working_hours_end         time,
  working_days              jsonb,
  date_format               varchar(50),
  subscription_tier         subscription_tier not null,
  subscription_status       subscription_status not null,
  max_seats                 integer not null,
  current_seats             integer not null default 0,
  trial_end_date            timestamptz,
  payment_method_on_file    boolean not null default false,
  kongila_supervisor_id     uuid,
  gdpr_mode_enabled         boolean not null default false,
  remotan_enabled           boolean default true,
  last_activity_at          timestamptz,
  provisioned_by            varchar(50) not null,
  setup_wizard_completed    boolean not null default false,
  created_at                timestamptz not null default now()
);

create table workspace_members (
  id                   uuid primary key default uuid_generate_v4(),
  workspace_id         uuid not null,
  talent_id            varchar(255),
  user_id              uuid,
  name                 varchar(255) not null,
  email                varchar(255) not null,
  avatar               text,
  role                 workspace_member_role not null,
  department           varchar(255),
  job_title            varchar(255),
  status               workspace_member_status not null,
  gdpr_consent_status  gdpr_consent_status not null,
  gdpr_consent_date    timestamptz,
  last_active_at       timestamptz,
  joined_at            timestamptz not null default now(),
  offboarded_at        timestamptz
);

create table workspace_invitations (
  id            uuid primary key default uuid_generate_v4(),
  workspace_id  uuid not null,
  email         varchar(255) not null,
  role          workspace_member_role not null,
  department    varchar(255),
  job_title     varchar(255),
  token         varchar(255) not null unique,
  expires_at    timestamptz not null,
  accepted_at   timestamptz,
  status        varchar(50) not null,
  sent_by       uuid not null,
  created_at    timestamptz not null default now()
);

create table workspace_messages (
  id               uuid primary key default uuid_generate_v4(),
  workspace_id     uuid not null,
  channel          varchar(255) not null,
  sender_id        uuid not null,
  content          text not null,
  attachment_url   text,
  attachment_name  varchar(255),
  is_announcement  boolean default false,
  is_pinned        boolean default false,
  read_by_ids      jsonb,
  created_at       timestamptz not null default now()
);

create table remotan_projects (
  id            uuid primary key default uuid_generate_v4(),
  workspace_id  uuid not null,
  name          varchar(255) not null,
  description   text,
  status        remotan_project_status not null,
  start_date    timestamptz,
  end_date      timestamptz,
  member_ids    jsonb,
  manager_id    uuid,
  color         varchar(20),
  created_by    uuid not null,
  created_at    timestamptz not null default now()
);

create table remotan_tasks (
  id                   uuid primary key default uuid_generate_v4(),
  workspace_id         uuid not null,
  project_id           uuid not null,
  title                varchar(255) not null,
  description          text not null,
  assignee_id          uuid not null,
  reviewer_id          uuid,
  status               remotan_task_status not null,
  priority             varchar(50) not null,
  tags                 jsonb,
  due_date             timestamptz,
  blocker_description  text,
  blocker_escalated    boolean default false,
  time_logged_minutes  integer default 0,
  submission_link      text,
  review_notes         text,
  unassigned_flag      boolean default false,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz,
  completed_at         timestamptz
);

create table time_logs (
  id                uuid primary key default uuid_generate_v4(),
  workspace_id      uuid not null,
  member_id         uuid not null,
  task_id           uuid,
  project_id        uuid,
  clock_in          timestamptz not null,
  clock_out         timestamptz,
  duration_minutes  integer,
  status            time_log_status not null,
  activity_score    integer,
  notes             text,
  screenshots       jsonb,
  approved_by       uuid,
  approved_at       timestamptz,
  created_at        timestamptz not null default now()
);

create table payroll_entries (
  id              uuid primary key default uuid_generate_v4(),
  workspace_id    uuid not null,
  member_id       uuid not null,
  period_start    timestamptz not null,
  period_end      timestamptz not null,
  total_hours     numeric not null,
  hourly_rate     numeric,
  gross_amount    numeric not null,
  currency        varchar(10) not null default 'USD',
  deductions      jsonb,
  net_amount      numeric not null,
  status          payroll_entry_status not null,
  payment_method  varchar(50),
  paid_at         timestamptz,
  created_at      timestamptz not null default now()
);

create table performance_review_cycles (
  id            uuid primary key default uuid_generate_v4(),
  workspace_id  uuid not null,
  name          varchar(255) not null,
  frequency     review_cycle_frequency not null,
  start_date    timestamptz not null,
  end_date      timestamptz not null,
  member_ids    jsonb,
  reviewer_ids  jsonb,
  status        varchar(50) not null,
  created_at    timestamptz not null default now()
);

create table remotan_performance_reviews (
  id                 uuid primary key default uuid_generate_v4(),
  workspace_id       uuid not null,
  cycle_id           uuid not null,
  member_id          uuid not null,
  reviewer_id        uuid not null,
  task_efficiency    integer not null,
  work_quality       integer not null,
  reliability        integer not null,
  communication      integer not null,
  collaboration      integer not null,
  overall_score      integer not null,
  feedback           text not null,
  strengths          jsonb,
  improvement_areas  jsonb,
  pip_triggered      boolean not null default false,
  pip_notes          text,
  submitted_at       timestamptz not null default now()
);

create table calendar_events (
  id              uuid primary key default uuid_generate_v4(),
  workspace_id    uuid not null,
  title           varchar(255) not null,
  description     text,
  type            calendar_event_type not null,
  start_datetime  timestamptz not null,
  end_datetime    timestamptz,
  all_day         boolean default false,
  attendee_ids    jsonb,
  project_id      uuid,
  task_id         uuid,
  meeting_link    text,
  location        varchar(255),
  created_by      uuid not null,
  created_at      timestamptz not null default now()
);

create table academy_resources (
  id                 uuid primary key default uuid_generate_v4(),
  title              varchar(255) not null,
  description        text not null,
  category           varchar(100) not null,
  type               academy_resource_type not null,
  url                text not null,
  thumbnail_url      text,
  duration_minutes   integer,
  min_grade_required varchar(10),
  difficulty         varchar(50) not null,
  status             academy_resource_status not null,
  author             varchar(255),
  created_at         timestamptz not null default now()
);

create table academy_enrollments (
  id                   uuid primary key default uuid_generate_v4(),
  workspace_id         uuid not null,
  member_id            uuid not null,
  resource_id          uuid not null,
  progress_percentage  integer not null default 0,
  started_at           timestamptz not null default now(),
  completed_at         timestamptz,
  score                integer
);

create table compliance_records (
  id            uuid primary key default uuid_generate_v4(),
  workspace_id  uuid not null,
  type          compliance_record_type not null,
  description   text not null,
  data          jsonb,
  recorded_by   uuid not null,
  created_at    timestamptz not null default now()
);

create table gdpr_consent_records (
  id            uuid primary key default uuid_generate_v4(),
  workspace_id  uuid not null,
  member_id     uuid not null,
  feature       varchar(100) not null,
  status        gdpr_consent_status not null,
  requested_at  timestamptz not null,
  responded_at  timestamptz,
  ip_address    varchar(50),
  notes         text
);

create table remotan_agent_logs (
  id            uuid primary key default uuid_generate_v4(),
  workspace_id  uuid not null,
  agent         varchar(100) not null,
  message       text not null,
  type          varchar(50) not null,
  timestamp     timestamptz not null default now()
);


-- ============================================================================
-- FOREIGN KEYS
--
-- Added after all tables exist. Note the inconsistencies carried over from the
-- live schema: offers.talent_id points at users while contracts.talent_id
-- points at talent_profiles, and offers.request_id points at service_requests
-- while request_activity_logs.request_id points at talent_requests.
-- matches and interviews have no foreign keys at all. See NOTES.
-- ============================================================================

alter table user_roles
  add constraint user_roles_user_id_fkey foreign key (user_id) references users(id) on delete cascade,
  add constraint user_roles_role_id_fkey foreign key (role_id) references roles(id) on delete cascade;

alter table organizations
  add constraint organizations_created_by_fkey foreign key (created_by) references users(id) on delete set null,
  add constraint organizations_account_manager_id_fkey foreign key (account_manager_id) references users(id) on delete set null;

alter table client_profiles
  add constraint client_profiles_user_id_fkey foreign key (user_id) references users(id) on delete cascade,
  add constraint client_profiles_organization_id_fkey foreign key (organization_id) references organizations(id) on delete set null;

alter table talent_profiles
  add constraint talent_profiles_user_id_fkey foreign key (user_id) references users(id) on delete cascade;

alter table talent_skills
  add constraint talent_skills_talent_id_fkey foreign key (talent_id) references talent_profiles(id) on delete cascade,
  add constraint talent_skills_skill_id_fkey foreign key (skill_id) references skills(id) on delete cascade;

alter table assessment_questions
  add constraint assessment_questions_category_id_fkey foreign key (category_id) references assessment_categories(id) on delete cascade;

alter table assessment_assignments
  add constraint assessment_assignments_assessment_id_fkey foreign key (assessment_id) references assessments(id) on delete cascade,
  add constraint assessment_assignments_talent_id_fkey foreign key (talent_id) references talent_profiles(id) on delete cascade;

alter table skill_assessment_results
  add constraint "skill_assessment_results_assessmentId_fkey" foreign key ("assessmentId") references assessments(id) on delete cascade,
  add constraint "skill_assessment_results_talentId_fkey" foreign key ("talentId") references talent_profiles(id) on delete cascade;

alter table talent_skill_assessments
  add constraint "talent_skill_assessments_assessmentId_fkey" foreign key ("assessmentId") references assessments(id) on delete cascade,
  add constraint "talent_skill_assessments_talentId_fkey" foreign key ("talentId") references talent_profiles(id) on delete cascade;

alter table talent_requests
  add constraint talent_requests_talent_manager_id_fkey foreign key (talent_manager_id) references users(id) on delete set null,
  add constraint talent_requests_account_manager_id_fkey foreign key (account_manager_id) references users(id) on delete set null;

alter table service_requests
  add constraint service_requests_client_id_fkey foreign key (client_id) references users(id) on delete cascade;

alter table request_activity_logs
  add constraint request_activity_logs_request_id_fkey foreign key (request_id) references talent_requests(id) on delete cascade;

alter table offers
  add constraint offers_client_id_fkey foreign key (client_id) references users(id) on delete cascade,
  add constraint offers_talent_id_fkey foreign key (talent_id) references users(id) on delete cascade,
  add constraint offers_match_id_fkey foreign key (match_id) references matches(id) on delete cascade,
  add constraint offers_request_id_fkey foreign key (request_id) references service_requests(id) on delete cascade;

alter table contracts
  add constraint contracts_client_id_fkey foreign key (client_id) references users(id) on delete cascade,
  add constraint contracts_talent_id_fkey foreign key (talent_id) references talent_profiles(id) on delete cascade,
  add constraint contracts_offer_id_fkey foreign key (offer_id) references offers(id) on delete set null;

alter table projects
  add constraint projects_client_id_fkey foreign key (client_id) references users(id) on delete set null;

alter table tasks
  add constraint tasks_project_id_fkey foreign key (project_id) references projects(id) on delete cascade,
  add constraint tasks_assigned_to_fkey foreign key (assigned_to) references users(id) on delete set null;

alter table assignments
  add constraint assignments_talent_id_fkey foreign key (talent_id) references talent_profiles(id) on delete cascade,
  add constraint assignments_project_id_fkey foreign key (project_id) references projects(id) on delete set null,
  add constraint assignments_contract_id_fkey foreign key (contract_id) references contracts(id) on delete cascade;

alter table invoices
  add constraint invoices_client_id_fkey foreign key (client_id) references users(id) on delete cascade;

alter table payments
  add constraint payments_invoice_id_fkey foreign key (invoice_id) references invoices(id) on delete cascade;

alter table talent_payouts
  add constraint talent_payouts_talent_id_fkey foreign key (talent_id) references talent_profiles(id) on delete cascade,
  add constraint talent_payouts_contract_id_fkey foreign key (contract_id) references contracts(id) on delete cascade;

alter table documents
  add constraint documents_user_id_fkey foreign key (user_id) references users(id) on delete cascade;

alter table messages
  add constraint messages_sender_id_fkey foreign key (sender_id) references users(id) on delete cascade,
  add constraint messages_receiver_id_fkey foreign key (receiver_id) references users(id) on delete cascade;

alter table notifications
  add constraint notifications_user_id_fkey foreign key (user_id) references users(id) on delete cascade;

alter table support_tickets
  add constraint support_tickets_talent_id_fkey foreign key (talent_id) references talent_profiles(id) on delete cascade;

alter table support_messages
  add constraint support_messages_ticket_id_fkey foreign key (ticket_id) references support_tickets(id) on delete cascade;

alter table audit_logs
  add constraint audit_logs_user_id_fkey foreign key (user_id) references users(id) on delete set null;

-- Remotan
alter table workspace_members
  add constraint workspace_members_workspace_id_fkey foreign key (workspace_id) references remotan_workspaces(id) on delete cascade,
  add constraint workspace_members_talent_id_fkey foreign key (talent_id) references talents(id) on delete set null,
  add constraint workspace_members_user_id_fkey foreign key (user_id) references auth.users(id) on delete set null;

alter table workspace_invitations
  add constraint workspace_invitations_workspace_id_fkey foreign key (workspace_id) references remotan_workspaces(id) on delete cascade;

alter table workspace_messages
  add constraint workspace_messages_workspace_id_fkey foreign key (workspace_id) references remotan_workspaces(id) on delete cascade,
  add constraint workspace_messages_sender_id_fkey foreign key (sender_id) references workspace_members(id);

alter table remotan_projects
  add constraint remotan_projects_workspace_id_fkey foreign key (workspace_id) references remotan_workspaces(id) on delete cascade,
  add constraint remotan_projects_manager_id_fkey foreign key (manager_id) references workspace_members(id);

alter table remotan_tasks
  add constraint remotan_tasks_workspace_id_fkey foreign key (workspace_id) references remotan_workspaces(id) on delete cascade,
  add constraint remotan_tasks_project_id_fkey foreign key (project_id) references remotan_projects(id) on delete cascade,
  add constraint remotan_tasks_assignee_id_fkey foreign key (assignee_id) references workspace_members(id),
  add constraint remotan_tasks_reviewer_id_fkey foreign key (reviewer_id) references workspace_members(id);

alter table time_logs
  add constraint time_logs_workspace_id_fkey foreign key (workspace_id) references remotan_workspaces(id) on delete cascade,
  add constraint time_logs_member_id_fkey foreign key (member_id) references workspace_members(id) on delete cascade,
  add constraint time_logs_task_id_fkey foreign key (task_id) references remotan_tasks(id) on delete set null,
  add constraint time_logs_project_id_fkey foreign key (project_id) references remotan_projects(id) on delete set null,
  add constraint time_logs_approved_by_fkey foreign key (approved_by) references workspace_members(id);

alter table payroll_entries
  add constraint payroll_entries_workspace_id_fkey foreign key (workspace_id) references remotan_workspaces(id) on delete cascade,
  add constraint payroll_entries_member_id_fkey foreign key (member_id) references workspace_members(id) on delete cascade;

alter table performance_review_cycles
  add constraint performance_review_cycles_workspace_id_fkey foreign key (workspace_id) references remotan_workspaces(id) on delete cascade;

alter table remotan_performance_reviews
  add constraint remotan_performance_reviews_workspace_id_fkey foreign key (workspace_id) references remotan_workspaces(id) on delete cascade,
  add constraint remotan_performance_reviews_cycle_id_fkey foreign key (cycle_id) references performance_review_cycles(id) on delete cascade,
  add constraint remotan_performance_reviews_member_id_fkey foreign key (member_id) references workspace_members(id) on delete cascade,
  add constraint remotan_performance_reviews_reviewer_id_fkey foreign key (reviewer_id) references workspace_members(id) on delete cascade;

alter table calendar_events
  add constraint calendar_events_workspace_id_fkey foreign key (workspace_id) references remotan_workspaces(id) on delete cascade,
  add constraint calendar_events_project_id_fkey foreign key (project_id) references remotan_projects(id) on delete set null,
  add constraint calendar_events_task_id_fkey foreign key (task_id) references remotan_tasks(id) on delete set null;

alter table academy_enrollments
  add constraint academy_enrollments_workspace_id_fkey foreign key (workspace_id) references remotan_workspaces(id) on delete cascade,
  add constraint academy_enrollments_member_id_fkey foreign key (member_id) references workspace_members(id) on delete cascade,
  add constraint academy_enrollments_resource_id_fkey foreign key (resource_id) references academy_resources(id) on delete cascade;

alter table compliance_records
  add constraint compliance_records_workspace_id_fkey foreign key (workspace_id) references remotan_workspaces(id) on delete cascade;

alter table gdpr_consent_records
  add constraint gdpr_consent_records_workspace_id_fkey foreign key (workspace_id) references remotan_workspaces(id) on delete cascade,
  add constraint gdpr_consent_records_member_id_fkey foreign key (member_id) references workspace_members(id) on delete cascade;

alter table remotan_agent_logs
  add constraint remotan_agent_logs_workspace_id_fkey foreign key (workspace_id) references remotan_workspaces(id) on delete cascade;


-- ============================================================================
-- INDEXES
-- Primary keys and unique constraints create their own. These are the extras.
-- ============================================================================

create index idx_users_email on users (email);
create index idx_client_profiles_user on client_profiles (user_id);
create index idx_talent_profiles_user on talent_profiles (user_id);
create index idx_service_requests_client on service_requests (client_id);
create index idx_contracts_client on contracts (client_id);
create index idx_contracts_talent on contracts (talent_id);
create index idx_documents_user on documents (user_id);
create index idx_messages_sender_receiver on messages (sender_id, receiver_id);
create index idx_notifications_user on notifications (user_id);
create index idx_support_messages_ticket on support_messages (ticket_id);
create index idx_support_tickets_talent on support_tickets (talent_id);
create index idx_tasks_project on tasks (project_id);
create index idx_workflows_state on workflow_instances (state);
create index idx_workflows_created_at on workflow_instances (created_at desc);


-- ============================================================================
-- ROW LEVEL SECURITY
--
-- RLS is enabled on every table and NO policies are created here.
--
-- That is deliberate. A fresh database built from this file denies all browser
-- access until policies are written, which is the correct default. The live
-- project's current policies are not reproduced because several of them are
-- the security holes being removed:
--   - users UPDATE with no WITH CHECK, allowing self-promotion to super_admin
--   - offers ALL to {public} with using (true)
--   - matches_admin_all granting ALL to every authenticated user
--   - talent_requests, client_profiles and organizations readable by anyone
-- See migrations/2026-10-17_fix_privilege_escalation.sql.
--
-- Real policies are written on day 4, once writes move server-side on day 3.
-- Until then, server code uses the service role key, which bypasses RLS.
-- ============================================================================

alter table users enable row level security;
alter table roles enable row level security;
alter table user_roles enable row level security;
alter table organizations enable row level security;
alter table client_profiles enable row level security;
alter table talent_profiles enable row level security;
alter table talents enable row level security;
alter table skills enable row level security;
alter table talent_skills enable row level security;
alter table assessments enable row level security;
alter table assessment_categories enable row level security;
alter table assessment_questions enable row level security;
alter table assessment_assignments enable row level security;
alter table skill_assessment_results enable row level security;
alter table talent_skill_assessments enable row level security;
alter table talent_requests enable row level security;
alter table service_requests enable row level security;
alter table client_requests enable row level security;
alter table request_activity_logs enable row level security;
alter table matches enable row level security;
alter table interviews enable row level security;
alter table offers enable row level security;
alter table contracts enable row level security;
alter table projects enable row level security;
alter table tasks enable row level security;
alter table assignments enable row level security;
alter table invoices enable row level security;
alter table payments enable row level security;
alter table talent_payouts enable row level security;
alter table documents enable row level security;
alter table conversations enable row level security;
alter table messages enable row level security;
alter table notifications enable row level security;
alter table support_tickets enable row level security;
alter table support_messages enable row level security;
alter table audit_logs enable row level security;
alter table agent_logs enable row level security;
alter table workflow_instances enable row level security;
alter table remotan_workspaces enable row level security;
alter table workspace_members enable row level security;
alter table workspace_invitations enable row level security;
alter table workspace_messages enable row level security;
alter table remotan_projects enable row level security;
alter table remotan_tasks enable row level security;
alter table time_logs enable row level security;
alter table payroll_entries enable row level security;
alter table performance_review_cycles enable row level security;
alter table remotan_performance_reviews enable row level security;
alter table calendar_events enable row level security;
alter table academy_resources enable row level security;
alter table academy_enrollments enable row level security;
alter table compliance_records enable row level security;
alter table gdpr_consent_records enable row level security;
alter table remotan_agent_logs enable row level security;


-- ============================================================================
-- NOTES — problems reproduced faithfully, to be fixed deliberately
--
-- This file matches the live database, including its mistakes. Fixing them
-- here would mean the file no longer describes production. Each of these has a
-- day in the sprint plan.
--
-- THREE REQUEST TABLES (day 5)
--   talent_requests   used by the client and admin portals; the entire request
--                     lives in a jsonb payload column, so nothing can be
--                     filtered, sorted or reported on in the database
--   service_requests  legacy, but offers.request_id references it, so it
--                     cannot simply be dropped
--   client_requests   no code references it at all
--
-- TWO TALENT TABLES (day 5)
--   talent_profiles   used everywhere in Kongila, varchar statuses
--   talents           uses the proper vetting_stage, vetting_status and
--                     grade_rating enums; survives because
--                     workspace_members.talent_id references it
--
-- INCONSISTENT IDENTITY (day 5)
--   offers.talent_id     → users(id)
--   contracts.talent_id  → talent_profiles(id)
--   The same person is two different foreign keys depending on the table.
--
-- NO FOREIGN KEYS AT ALL
--   matches and interviews have none. matches.request_id and matches.talent_id
--   can point at rows that do not exist.
--
-- STATUS VALUES (day 7)
--   interviews.status accepts 18 values including both 'cancelled' and
--   'Cancelled', and both 'scheduled' and 'Scheduled'.
--   users.role accepts 12 spellings of 4 roles.
--   contracts.status is a varchar with a check, while two unused enums
--   (contract_status, contract_status_enum) describe the same thing.
--   task_status and task_priority enums exist; tasks uses varchars instead.
--   user_role enum exists; users.role is a varchar.
--
-- CAMELCASE COLUMNS
--   skill_assessment_results and talent_skill_assessments use "talentId" and
--   "assessmentId". Postgres folds unquoted identifiers to lowercase, so every
--   reference must be double-quoted or it fails.
--
-- AUTH LINKAGE
--   workspace_members.user_id is the only foreign key into auth.users. Every
--   other table stores a varchar id compared against auth.uid()::text. That
--   works but nothing enforces it.
-- ============================================================================
