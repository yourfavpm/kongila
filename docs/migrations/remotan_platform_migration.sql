-- Migration: Remotan Platform (REM-WORKSPACE, REM-TASKS, REM-TIME, REM-PERF, etc.)
-- Extends Kongila to support the Multi-Agent OS for workforce management.

-- Enums
CREATE TYPE workspace_origin AS ENUM ('kongila_contract', 'external_subscription');
CREATE TYPE subscription_tier AS ENUM ('starter', 'growth', 'scale', 'enterprise');
CREATE TYPE subscription_status AS ENUM ('trial', 'active', 'past_due', 'cancelled', 'archived');
CREATE TYPE workspace_member_role AS ENUM ('workspace_admin', 'project_manager', 'team_member', 'supervisor', 'finance');
CREATE TYPE workspace_member_status AS ENUM ('active', 'pending', 'offboarded', 'suspended');
CREATE TYPE remotan_project_status AS ENUM ('planning', 'active', 'on_hold', 'completed', 'cancelled');
CREATE TYPE remotan_task_status AS ENUM ('not_started', 'in_progress', 'blocked', 'under_review', 'completed');
CREATE TYPE time_log_status AS ENUM ('active', 'stopped', 'approved', 'disputed');
CREATE TYPE gdpr_consent_status AS ENUM ('pending', 'granted', 'denied', 'revoked');
CREATE TYPE calendar_event_type AS ENUM ('meeting', 'deadline', 'milestone', 'review', 'other');
CREATE TYPE payroll_entry_status AS ENUM ('draft', 'approved', 'processing', 'paid', 'failed');
CREATE TYPE compliance_record_type AS ENUM ('gdpr_consent', 'data_retention', 'access_log', 'offboarding');
CREATE TYPE academy_resource_type AS ENUM ('video', 'article', 'quiz', 'course');
CREATE TYPE academy_resource_status AS ENUM ('draft', 'published', 'archived');
CREATE TYPE review_cycle_frequency AS ENUM ('weekly', 'monthly', 'quarterly');

-- Workspaces
CREATE TABLE remotan_workspaces (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id VARCHAR(255) REFERENCES organizations(id) ON DELETE SET NULL, -- Null for external
    workspace_origin workspace_origin NOT NULL,
    kongila_managed BOOLEAN NOT NULL DEFAULT false,
    name VARCHAR(255) NOT NULL,
    logo_url TEXT,
    default_timezone VARCHAR(100) DEFAULT 'UTC',
    working_hours_start TIME,
    working_hours_end TIME,
    working_days JSONB, -- Array of days e.g. ["Mon","Tue"]
    date_format VARCHAR(50),
    subscription_tier subscription_tier NOT NULL,
    subscription_status subscription_status NOT NULL,
    max_seats INTEGER NOT NULL,
    current_seats INTEGER NOT NULL DEFAULT 0,
    trial_end_date TIMESTAMP WITH TIME ZONE,
    payment_method_on_file BOOLEAN NOT NULL DEFAULT false,
    kongila_supervisor_id UUID,
    gdpr_mode_enabled BOOLEAN NOT NULL DEFAULT false,
    last_activity_at TIMESTAMP WITH TIME ZONE,
    provisioned_by VARCHAR(50) NOT NULL,
    setup_wizard_completed BOOLEAN NOT NULL DEFAULT false,
    remotan_enabled BOOLEAN DEFAULT true,
    website VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Workspace Members
CREATE TABLE workspace_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES remotan_workspaces(id) ON DELETE CASCADE,
    talent_id VARCHAR(255) REFERENCES talents(id) ON DELETE SET NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    avatar TEXT,
    role workspace_member_role NOT NULL,
    department VARCHAR(255),
    job_title VARCHAR(255),
    status workspace_member_status NOT NULL,
    gdpr_consent_status gdpr_consent_status NOT NULL,
    gdpr_consent_date TIMESTAMP WITH TIME ZONE,
    last_active_at TIMESTAMP WITH TIME ZONE,
    joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    offboarded_at TIMESTAMP WITH TIME ZONE
);

-- Workspace Invitations
CREATE TABLE workspace_invitations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES remotan_workspaces(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    role workspace_member_role NOT NULL,
    department VARCHAR(255),
    job_title VARCHAR(255),
    token VARCHAR(255) UNIQUE NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    accepted_at TIMESTAMP WITH TIME ZONE,
    status VARCHAR(50) NOT NULL,
    sent_by UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Projects
CREATE TABLE remotan_projects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES remotan_workspaces(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    status remotan_project_status NOT NULL,
    start_date TIMESTAMP WITH TIME ZONE,
    end_date TIMESTAMP WITH TIME ZONE,
    member_ids JSONB,
    manager_id UUID REFERENCES workspace_members(id),
    color VARCHAR(20),
    created_by UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Project Milestones
CREATE TABLE remotan_project_milestones (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES remotan_projects(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    due_date TIMESTAMP WITH TIME ZONE,
    owner_id UUID REFERENCES workspace_members(id),
    weight INTEGER NOT NULL DEFAULT 0, -- 0-100
    status VARCHAR(50) NOT NULL DEFAULT 'not_started'
);

-- Tasks
CREATE TABLE remotan_tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES remotan_workspaces(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES remotan_projects(id) ON DELETE CASCADE,
    parent_task_id UUID REFERENCES remotan_tasks(id) ON DELETE SET NULL,
    milestone_id UUID REFERENCES remotan_project_milestones(id) ON DELETE SET NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    assignee_id UUID NOT NULL REFERENCES workspace_members(id),
    reviewer_id UUID REFERENCES workspace_members(id),
    status remotan_task_status NOT NULL,
    priority VARCHAR(50) NOT NULL,
    tags JSONB,
    due_date TIMESTAMP WITH TIME ZONE,
    blocker_category VARCHAR(50),
    blocker_description TEXT,
    blocker_reported_at TIMESTAMP WITH TIME ZONE,
    blocker_escalated BOOLEAN DEFAULT false,
    estimated_hours NUMERIC(10, 2),
    actual_hours NUMERIC(10, 2) DEFAULT 0,
    time_logged_minutes INTEGER DEFAULT 0,
    submission_link TEXT,
    review_notes TEXT,
    unassigned_flag BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE
);

-- Task Dependencies
CREATE TABLE remotan_task_dependencies (
    task_id UUID NOT NULL REFERENCES remotan_tasks(id) ON DELETE CASCADE,
    depends_on_task_id UUID NOT NULL REFERENCES remotan_tasks(id) ON DELETE CASCADE,
    PRIMARY KEY (task_id, depends_on_task_id)
);

-- Task Comments
CREATE TABLE remotan_task_comments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_id UUID NOT NULL REFERENCES remotan_tasks(id) ON DELETE CASCADE,
    author_id UUID NOT NULL REFERENCES workspace_members(id),
    content TEXT NOT NULL,
    is_internal_note BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    edited_at TIMESTAMP WITH TIME ZONE
);

-- Task Activity Logs
CREATE TABLE remotan_task_activity_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_id UUID NOT NULL REFERENCES remotan_tasks(id) ON DELETE CASCADE,
    actor_id UUID NOT NULL REFERENCES workspace_members(id),
    action_type VARCHAR(100) NOT NULL,
    old_value TEXT,
    new_value TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
-- Task Board Columns (Dynamic Statuses)
CREATE TABLE remotan_board_columns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES remotan_workspaces(id) ON DELETE CASCADE,
    project_id UUID REFERENCES remotan_projects(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    status_key VARCHAR(100) NOT NULL,
    color VARCHAR(20) NOT NULL DEFAULT '#8DA8CC',
    order_index INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Time Logs
CREATE TABLE remotan_time_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES remotan_workspaces(id) ON DELETE CASCADE,
    member_id UUID NOT NULL REFERENCES workspace_members(id) ON DELETE CASCADE,
    task_id UUID NOT NULL REFERENCES remotan_tasks(id) ON DELETE CASCADE,
    log_date DATE NOT NULL,
    hours_logged DECIMAL(4,1) NOT NULL,
    notes TEXT,
    log_type VARCHAR(50) NOT NULL, -- 'manual' or 'timer'
    is_approved BOOLEAN NOT NULL DEFAULT false,
    approved_by UUID REFERENCES workspace_members(id),
    approved_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Time Logs View (Computes feeds_payroll)
CREATE VIEW remotan_time_logs_view AS
SELECT 
    t.*,
    (t.is_approved = true AND w.kongila_managed = true) AS feeds_payroll
FROM remotan_time_logs t
JOIN remotan_workspaces w ON t.workspace_id = w.id;

-- Activity Monitoring Logs (Dual-Consent Gated)
CREATE TABLE remotan_activity_monitoring (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES remotan_workspaces(id) ON DELETE CASCADE,
    member_id UUID NOT NULL REFERENCES workspace_members(id) ON DELETE CASCADE,
    time_log_id UUID REFERENCES remotan_time_logs(id) ON DELETE CASCADE,
    activity_score INTEGER,
    screenshots JSONB,
    recorded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- GDPR Consent Records
CREATE TABLE gdpr_consent_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES remotan_workspaces(id) ON DELETE CASCADE,
    member_id UUID NOT NULL REFERENCES workspace_members(id) ON DELETE CASCADE,
    feature VARCHAR(100) NOT NULL,
    status gdpr_consent_status NOT NULL,
    requested_at TIMESTAMP WITH TIME ZONE NOT NULL,
    responded_at TIMESTAMP WITH TIME ZONE,
    ip_address VARCHAR(50),
    notes TEXT
);

-- Performance Review Cycles
CREATE TABLE performance_review_cycles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES remotan_workspaces(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    frequency review_cycle_frequency NOT NULL,
    start_date TIMESTAMP WITH TIME ZONE NOT NULL,
    end_date TIMESTAMP WITH TIME ZONE NOT NULL,
    member_ids JSONB,
    reviewer_ids JSONB,
    status VARCHAR(50) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Performance Reviews
CREATE TABLE remotan_performance_reviews (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES remotan_workspaces(id) ON DELETE CASCADE,
    cycle_id UUID NOT NULL REFERENCES performance_review_cycles(id) ON DELETE CASCADE,
    member_id UUID NOT NULL REFERENCES workspace_members(id) ON DELETE CASCADE,
    reviewer_id UUID NOT NULL REFERENCES workspace_members(id) ON DELETE CASCADE,
    task_efficiency INTEGER NOT NULL,
    work_quality INTEGER NOT NULL,
    reliability INTEGER NOT NULL,
    communication INTEGER NOT NULL,
    collaboration INTEGER NOT NULL,
    overall_score INTEGER NOT NULL,
    feedback TEXT NOT NULL,
    strengths JSONB,
    improvement_areas JSONB,
    pip_triggered BOOLEAN NOT NULL DEFAULT false,
    pip_notes TEXT,
    submitted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Calendar Events
CREATE TABLE calendar_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES remotan_workspaces(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    type calendar_event_type NOT NULL,
    start_datetime TIMESTAMP WITH TIME ZONE NOT NULL,
    end_datetime TIMESTAMP WITH TIME ZONE,
    all_day BOOLEAN DEFAULT false,
    attendee_ids JSONB,
    project_id UUID REFERENCES remotan_projects(id) ON DELETE SET NULL,
    task_id UUID REFERENCES remotan_tasks(id) ON DELETE SET NULL,
    meeting_link TEXT,
    location VARCHAR(255),
    created_by UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Workspace Messages
CREATE TABLE workspace_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES remotan_workspaces(id) ON DELETE CASCADE,
    channel VARCHAR(255) NOT NULL,
    sender_id UUID NOT NULL REFERENCES workspace_members(id),
    content TEXT NOT NULL,
    attachment_url TEXT,
    attachment_name VARCHAR(255),
    is_announcement BOOLEAN DEFAULT false,
    is_pinned BOOLEAN DEFAULT false,
    read_by_ids JSONB,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Payroll Entries
CREATE TABLE payroll_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES remotan_workspaces(id) ON DELETE CASCADE,
    member_id UUID NOT NULL REFERENCES workspace_members(id) ON DELETE CASCADE,
    period_start TIMESTAMP WITH TIME ZONE NOT NULL,
    period_end TIMESTAMP WITH TIME ZONE NOT NULL,
    total_hours NUMERIC(10, 2) NOT NULL,
    hourly_rate NUMERIC(10, 2),
    gross_amount NUMERIC(10, 2) NOT NULL,
    currency VARCHAR(10) NOT NULL DEFAULT 'USD',
    deductions JSONB,
    net_amount NUMERIC(10, 2) NOT NULL,
    status payroll_entry_status NOT NULL,
    payment_method VARCHAR(50),
    paid_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Compliance Records
CREATE TABLE compliance_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES remotan_workspaces(id) ON DELETE CASCADE,
    type compliance_record_type NOT NULL,
    description TEXT NOT NULL,
    data JSONB,
    recorded_by UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Academy Resources
CREATE TABLE academy_resources (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    category VARCHAR(100) NOT NULL,
    type academy_resource_type NOT NULL,
    url TEXT NOT NULL,
    thumbnail_url TEXT,
    duration_minutes INTEGER,
    min_grade_required VARCHAR(10),
    difficulty VARCHAR(50) NOT NULL,
    status academy_resource_status NOT NULL,
    author VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Academy Enrollments
CREATE TABLE academy_enrollments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES remotan_workspaces(id) ON DELETE CASCADE,
    member_id UUID NOT NULL REFERENCES workspace_members(id) ON DELETE CASCADE,
    resource_id UUID NOT NULL REFERENCES academy_resources(id) ON DELETE CASCADE,
    progress_percentage INTEGER NOT NULL DEFAULT 0,
    started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    score INTEGER
);

-- Remotan Agent Logs
CREATE TABLE remotan_agent_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES remotan_workspaces(id) ON DELETE CASCADE,
    agent VARCHAR(100) NOT NULL,
    message TEXT NOT NULL,
    type VARCHAR(50) NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
