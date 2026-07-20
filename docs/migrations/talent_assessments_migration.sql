-- ============================================================
-- TALENT ASSESSMENTS SCHEMA MIGRATION
-- Purpose: Adds the missing tables required for the Talent
-- Assessment feature (tests, categories, questions, and 
-- talent results).
-- ============================================================

CREATE TABLE IF NOT EXISTS assessments (
    id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    time_limit_minutes INTEGER DEFAULT 60,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(255) REFERENCES public.users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS assessment_categories (
    id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    assessment_id VARCHAR(255) REFERENCES assessments(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    order_index INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS assessment_questions (
    id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    category_id VARCHAR(255) REFERENCES assessment_categories(id) ON DELETE CASCADE,
    question_text TEXT NOT NULL,
    options JSONB NOT NULL, -- Array of strings e.g. ["A", "B", "C"]
    correct_answer VARCHAR(255) NOT NULL,
    points INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS talent_skill_assessments (
    id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    talent_id VARCHAR(255) REFERENCES talent_profiles(id) ON DELETE CASCADE,
    assessment_id VARCHAR(255) REFERENCES assessments(id) ON DELETE CASCADE,
    status VARCHAR(50) DEFAULT 'not_started' CHECK (status IN ('not_started', 'in_progress', 'completed', 'submitted')),
    score INTEGER,
    total_possible_score INTEGER,
    answers JSONB,
    subjective_answers JSONB,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    submitted_at TIMESTAMP WITH TIME ZONE
);
