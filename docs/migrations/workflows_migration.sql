-- Migration: Workflow Orchestration Engine (REM-WORKFLOW)
-- Automation backbone managing multi-step business processes across Kongila and Remotan

-- Enums
CREATE TYPE workflow_type AS ENUM (
    'talent_onboarding',
    'performance_review_cycle',
    'contract_renewal_alert',
    'invoice_generation',
    'talent_replacement',
    'workspace_offboarding',
    'trial_expiry',
    'payroll_generation'
);

CREATE TYPE workflow_state AS ENUM (
    'pending',
    'in_progress',
    'failed',
    'completed',
    'cancelled'
);

-- Workflow Instances Table
CREATE TABLE workflow_instances (
    workflow_instance_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workflow_type workflow_type NOT NULL,
    state workflow_state NOT NULL DEFAULT 'pending',
    trigger_event VARCHAR(255) NOT NULL,
    trigger_entity_id VARCHAR(255) NOT NULL,
    last_step_completed INTEGER NOT NULL DEFAULT 0,
    failed_at_step INTEGER,
    failure_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_active_workflow UNIQUE (workflow_type, trigger_entity_id, state) DEFERRABLE INITIALLY DEFERRED
);

-- Index for querying failed workflows for the queue
CREATE INDEX idx_workflows_state ON workflow_instances(state);
CREATE INDEX idx_workflows_created_at ON workflow_instances(created_at DESC);
