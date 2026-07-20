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
    role_targeted VARCHAR(255),
    total_time_limit_minutes INTEGER DEFAULT 60,
    passing_score INTEGER DEFAULT 70,
    categories JSONB DEFAULT '[]'::jsonb,
    category_overrides JSONB DEFAULT '[]'::jsonb,
    status VARCHAR(50) DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(255)
);

CREATE TABLE IF NOT EXISTS assessment_categories (
    id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    time_limit_minutes INTEGER DEFAULT 15,
    is_reusable BOOLEAN DEFAULT true,
    tags JSONB DEFAULT '[]'::jsonb,
    questions JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(255)
);

CREATE TABLE IF NOT EXISTS assessment_questions (
    id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    category_id VARCHAR(255) REFERENCES assessment_categories(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    question_text TEXT NOT NULL,
    options JSONB,
    correct_answer JSONB,
    expected_answer TEXT,
    scoring_weight INTEGER DEFAULT 1,
    max_score INTEGER DEFAULT 10
);

CREATE TABLE IF NOT EXISTS assessment_assignments (
    id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    assessment_id VARCHAR(255) REFERENCES assessments(id) ON DELETE CASCADE,
    talent_id VARCHAR(255) REFERENCES talent_profiles(id) ON DELETE CASCADE,
    status VARCHAR(50) DEFAULT 'not_started' CHECK (status IN ('not_started', 'in_progress', 'completed', 'expired')),
    start_time TIMESTAMP WITH TIME ZONE,
    end_time TIMESTAMP WITH TIME ZONE,
    score INTEGER,
    category_scores JSONB,
    answers JSONB
);

-- Note: skill_assessment_results and talent_skill_assessments are legacy tables/types.
-- To maintain compatibility with older endpoints, we create them as well.
CREATE TABLE IF NOT EXISTS skill_assessment_results (
    id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "talentId" VARCHAR(255) REFERENCES talent_profiles(id) ON DELETE CASCADE,
    "assessmentId" VARCHAR(255) REFERENCES assessments(id) ON DELETE CASCADE,
    score INTEGER,
    passed BOOLEAN,
    "completedAt" TIMESTAMP WITH TIME ZONE,
    "submittedAt" TIMESTAMP WITH TIME ZONE,
    "subjectiveScores" JSONB,
    "categoryScores" JSONB
);

CREATE TABLE IF NOT EXISTS talent_skill_assessments (
    id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "talentId" VARCHAR(255) REFERENCES talent_profiles(id) ON DELETE CASCADE,
    "assessmentId" VARCHAR(255) REFERENCES assessments(id) ON DELETE CASCADE,
    status VARCHAR(50) DEFAULT 'assigned',
    score INTEGER,
    "assignedAt" TIMESTAMP WITH TIME ZONE
);

-- RLS Configuration
ALTER TABLE public.assessments DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessment_categories DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessment_questions DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessment_assignments DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.skill_assessment_results DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.talent_skill_assessments DISABLE ROW LEVEL SECURITY;

GRANT ALL ON TABLE public.assessments TO anon, authenticated;
GRANT ALL ON TABLE public.assessment_categories TO anon, authenticated;
GRANT ALL ON TABLE public.assessment_questions TO anon, authenticated;
GRANT ALL ON TABLE public.assessment_assignments TO anon, authenticated;
GRANT ALL ON TABLE public.skill_assessment_results TO anon, authenticated;
GRANT ALL ON TABLE public.talent_skill_assessments TO anon, authenticated;
