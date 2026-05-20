-- ==========================================
-- KONGILA SYSTEM SCHEMA MIGRATION SCRIPT
-- ==========================================

-- Clean up pre-existing tables to avoid column mismatch errors
DROP TABLE IF EXISTS support_messages CASCADE;
DROP TABLE IF EXISTS support_tickets CASCADE;
DROP TABLE IF EXISTS user_roles CASCADE;
DROP TABLE IF EXISTS roles CASCADE;
DROP TABLE IF EXISTS agent_logs CASCADE;
DROP TABLE IF EXISTS audit_logs CASCADE;
DROP TABLE IF EXISTS notifications CASCADE;
DROP TABLE IF EXISTS messages CASCADE;
DROP TABLE IF EXISTS talent_payouts CASCADE;
DROP TABLE IF EXISTS payments CASCADE;
DROP TABLE IF EXISTS invoices CASCADE;
DROP TABLE IF EXISTS assignments CASCADE;
DROP TABLE IF EXISTS contracts CASCADE;
DROP TABLE IF EXISTS tasks CASCADE;
DROP TABLE IF EXISTS projects CASCADE;
DROP TABLE IF EXISTS matches CASCADE;
DROP TABLE IF EXISTS service_requests CASCADE;
DROP TABLE IF EXISTS documents CASCADE;
DROP TABLE IF EXISTS talent_skills CASCADE;
DROP TABLE IF EXISTS skills CASCADE;
DROP TABLE IF EXISTS talent_profiles CASCADE;
DROP TABLE IF EXISTS client_profiles CASCADE;
DROP TABLE IF EXISTS organizations CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- 1. Users Table (Global Auth System)
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN ('admin', 'client', 'talent')),
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'inactive')),
    email_verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Organizations Table (Client Companies)
CREATE TABLE IF NOT EXISTS organizations (
    id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    name VARCHAR(255) NOT NULL,
    industry VARCHAR(100),
    company_size VARCHAR(50),
    country VARCHAR(100),
    website VARCHAR(255),
    created_by VARCHAR(255) REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Client Profiles Table
CREATE TABLE IF NOT EXISTS client_profiles (
    id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    user_id VARCHAR(255) REFERENCES users(id) ON DELETE CASCADE,
    organization_id VARCHAR(255) REFERENCES organizations(id) ON DELETE SET NULL,
    position VARCHAR(100),
    phone VARCHAR(50)
);

-- 4. Talent Profiles Table (Core Asset)
CREATE TABLE IF NOT EXISTS talent_profiles (
    id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    user_id VARCHAR(255) REFERENCES users(id) ON DELETE CASCADE,
    full_name VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    country VARCHAR(100),
    address TEXT,
    gender VARCHAR(20),
    level VARCHAR(50), -- associate, specialist, consultant, manager, etc.
    availability_hours INTEGER DEFAULT 40,
    salary_min NUMERIC,
    salary_max NUMERIC,
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'assigned', 'inactive')),
    timezone VARCHAR(50) DEFAULT 'GMT+1 (Lagos)',
    salary_expectation NUMERIC,
    experience_years INTEGER,
    vetting_stage VARCHAR(50) DEFAULT 'Final Review',
    vetting_status VARCHAR(50) DEFAULT 'Vetted',
    grade VARCHAR(10) DEFAULT 'A',
    bio TEXT,
    avatar_url VARCHAR(255),
    government_id_url VARCHAR(255),
    proof_of_address_url VARCHAR(255),
    profile_integrity_progress INTEGER DEFAULT 94,
    date_joined TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. Skills Table
CREATE TABLE IF NOT EXISTS skills (
    id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    name VARCHAR(100) UNIQUE NOT NULL
);

-- 6. Talent Skills Table
CREATE TABLE IF NOT EXISTS talent_skills (
    id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    talent_id VARCHAR(255) REFERENCES talent_profiles(id) ON DELETE CASCADE,
    skill_id VARCHAR(255) REFERENCES skills(id) ON DELETE CASCADE,
    level VARCHAR(50) DEFAULT 'intermediate' CHECK (level IN ('beginner', 'intermediate', 'expert'))
);

-- 7. Documents Table (CV, NDA, Certifications, etc.)
CREATE TABLE IF NOT EXISTS documents (
    id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    user_id VARCHAR(255) REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) CHECK (type IN ('CV', 'portfolio', 'NDA', 'agreement', 'certification', 'IT_Ethics_Policy')),
    file_url VARCHAR(255),
    file_size VARCHAR(50),
    status VARCHAR(50) DEFAULT 'uploaded' CHECK (status IN ('uploaded', 'signed', 'verified', 'vetted', 'needs_review', 'pending_signature', 'under_review')),
    certificate_image VARCHAR(255),
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 8. Service Requests Table (Client Entry Point)
CREATE TABLE IF NOT EXISTS service_requests (
    id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    client_id VARCHAR(255) REFERENCES users(id) ON DELETE CASCADE,
    service_type VARCHAR(50) NOT NULL CHECK (service_type IN ('hire', 'outsource', 'managed', 'project')),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    num_of_talents INTEGER DEFAULT 1,
    duration VARCHAR(50),
    start_date DATE,
    commitment_level VARCHAR(50),
    budget_min NUMERIC,
    budget_max NUMERIC,
    status VARCHAR(50) DEFAULT 'new' CHECK (status IN ('new', 'reviewing', 'matching', 'closed')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 9. Matches Table
CREATE TABLE IF NOT EXISTS matches (
    id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    request_id VARCHAR(255) REFERENCES service_requests(id) ON DELETE CASCADE,
    talent_id VARCHAR(255) REFERENCES talent_profiles(id) ON DELETE CASCADE,
    status VARCHAR(50) DEFAULT 'proposed' CHECK (status IN ('proposed', 'shortlisted', 'rejected', 'accepted')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 10. Projects Table (Project Management Service)
CREATE TABLE IF NOT EXISTS projects (
    id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    client_id VARCHAR(255) REFERENCES users(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    start_date DATE,
    end_date DATE,
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'completed', 'paused'))
);

-- 11. Tasks Table
CREATE TABLE IF NOT EXISTS tasks (
    id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    project_id VARCHAR(255) REFERENCES projects(id) ON DELETE CASCADE,
    assigned_to VARCHAR(255) REFERENCES users(id) ON DELETE SET NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(50) DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'review', 'done')),
    priority VARCHAR(20) DEFAULT 'Medium',
    deadline DATE
);

-- 12. Contracts Table (Employment / Contractor Retainers)
CREATE TABLE IF NOT EXISTS contracts (
    id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    client_id VARCHAR(255) REFERENCES users(id) ON DELETE CASCADE,
    talent_id VARCHAR(255) REFERENCES talent_profiles(id) ON DELETE CASCADE,
    service_type VARCHAR(50),
    start_date DATE,
    end_date DATE,
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'signed', 'completed', 'terminated')),
    rate_type VARCHAR(20) CHECK (rate_type IN ('Hourly', 'Monthly')),
    rate_amount NUMERIC,
    monthly_rate NUMERIC,
    total_earned NUMERIC DEFAULT 0,
    invoiced_balance NUMERIC DEFAULT 0,
    next_payout NUMERIC DEFAULT 0,
    next_payout_date DATE,
    engagement_model VARCHAR(100),
    signed_at TIMESTAMP WITH TIME ZONE,
    rating NUMERIC CHECK (rating >= 1 AND rating <= 5),
    quality_of_work NUMERIC CHECK (quality_of_work >= 1.0 AND quality_of_work <= 5.0),
    communication NUMERIC CHECK (communication >= 1.0 AND communication <= 5.0),
    timeliness NUMERIC CHECK (timeliness >= 1.0 AND timeliness <= 5.0),
    performance_score NUMERIC DEFAULT 0
);

-- 13. Assignments Table
CREATE TABLE IF NOT EXISTS assignments (
    id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    talent_id VARCHAR(255) REFERENCES talent_profiles(id) ON DELETE CASCADE,
    project_id VARCHAR(255) REFERENCES projects(id) ON DELETE SET NULL,
    contract_id VARCHAR(255) REFERENCES contracts(id) ON DELETE CASCADE,
    role VARCHAR(100),
    start_date DATE,
    end_date DATE,
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'completed', 'paused'))
);

-- 14. Invoices Table
CREATE TABLE IF NOT EXISTS invoices (
    id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    client_id VARCHAR(255) REFERENCES users(id) ON DELETE CASCADE,
    amount NUMERIC NOT NULL,
    status VARCHAR(50) DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'paid', 'overdue')),
    due_date DATE
);

-- 15. Payments Table (Payments log history)
CREATE TABLE IF NOT EXISTS payments (
    id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    invoice_id VARCHAR(255) REFERENCES invoices(id) ON DELETE CASCADE,
    amount NUMERIC NOT NULL,
    payment_method VARCHAR(50),
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'failed')),
    paid_at TIMESTAMP WITH TIME ZONE
);

-- 16. Talent Payouts Table
CREATE TABLE IF NOT EXISTS talent_payouts (
    id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    talent_id VARCHAR(255) REFERENCES talent_profiles(id) ON DELETE CASCADE,
    contract_id VARCHAR(255) REFERENCES contracts(id) ON DELETE CASCADE,
    amount NUMERIC NOT NULL,
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'paid')),
    paid_at TIMESTAMP WITH TIME ZONE
);

-- 17. Messages Table (Talent/Client direct message logs)
CREATE TABLE IF NOT EXISTS messages (
    id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    sender_id VARCHAR(255) REFERENCES users(id) ON DELETE CASCADE,
    receiver_id VARCHAR(255) REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    read_status BOOLEAN DEFAULT FALSE
);

-- 18. Notifications Table (System Notifications alerts)
CREATE TABLE IF NOT EXISTS notifications (
    id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    user_id VARCHAR(255) REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(50),
    message TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'unread' CHECK (status IN ('read', 'unread')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 19. Audit Logs Table (Admin Tracking logs)
CREATE TABLE IF NOT EXISTS audit_logs (
    id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    user_id VARCHAR(255) REFERENCES users(id) ON DELETE SET NULL,
    actor VARCHAR(100),
    action VARCHAR(255) NOT NULL,
    entity VARCHAR(100),
    entity_id VARCHAR(100),
    details TEXT,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 20. Agent Logs Table (Performance / execution bot audits)
CREATE TABLE IF NOT EXISTS agent_logs (
    id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    agent_name VARCHAR(100) NOT NULL,
    message TEXT NOT NULL,
    type VARCHAR(20) DEFAULT 'info' CHECK (type IN ('info', 'success', 'warning', 'error')),
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 21. Roles Table (Admin roles control list)
CREATE TABLE IF NOT EXISTS roles (
    id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    name VARCHAR(100) UNIQUE NOT NULL
);

-- 22. User Roles Table
CREATE TABLE IF NOT EXISTS user_roles (
    id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    user_id VARCHAR(255) REFERENCES users(id) ON DELETE CASCADE,
    role_id VARCHAR(255) REFERENCES roles(id) ON DELETE CASCADE
);

-- 23. Support Tickets Table
CREATE TABLE IF NOT EXISTS support_tickets (
    id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    talent_id VARCHAR(255) REFERENCES talent_profiles(id) ON DELETE CASCADE,
    subject VARCHAR(255) NOT NULL,
    category VARCHAR(100) NOT NULL CHECK (category IN ('Payment Issues', 'Technical Support', 'Verification', 'Guidance')),
    status VARCHAR(50) DEFAULT 'Open' CHECK (status IN ('Open', 'In Progress', 'Resolved')),
    priority VARCHAR(50) DEFAULT 'High' CHECK (priority IN ('Low', 'Medium', 'High', 'Urgent')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_activity VARCHAR(100) DEFAULT 'Just now'
);

-- 24. Support Messages Table (Replies inside ticket threads)
CREATE TABLE IF NOT EXISTS support_messages (
    id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    ticket_id VARCHAR(255) REFERENCES support_tickets(id) ON DELETE CASCADE,
    sender_name VARCHAR(100) NOT NULL,
    sender_role VARCHAR(100) NOT NULL,
    is_support BOOLEAN DEFAULT FALSE,
    avatar_url VARCHAR(255),
    text TEXT NOT NULL,
    timestamp VARCHAR(50) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ==========================================
-- INDEX DEFINITIONS FOR QUERY OPTIMIZATION
-- ==========================================
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_talent_profiles_user ON talent_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_client_profiles_user ON client_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_documents_user ON documents(user_id);
CREATE INDEX IF NOT EXISTS idx_service_requests_client ON service_requests(client_id);
CREATE INDEX IF NOT EXISTS idx_contracts_talent ON contracts(talent_id);
CREATE INDEX IF NOT EXISTS idx_contracts_client ON contracts(client_id);
CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender_receiver ON messages(sender_id, receiver_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_talent ON support_tickets(talent_id);
CREATE INDEX IF NOT EXISTS idx_support_messages_ticket ON support_messages(ticket_id);

-- ==========================================
-- DISABLE ROW LEVEL SECURITY (RLS) FOR DEVELOPMENT
-- ==========================================
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE organizations DISABLE ROW LEVEL SECURITY;
ALTER TABLE client_profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE talent_profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE skills DISABLE ROW LEVEL SECURITY;
ALTER TABLE talent_skills DISABLE ROW LEVEL SECURITY;
ALTER TABLE documents DISABLE ROW LEVEL SECURITY;
ALTER TABLE service_requests DISABLE ROW LEVEL SECURITY;
ALTER TABLE matches DISABLE ROW LEVEL SECURITY;
ALTER TABLE projects DISABLE ROW LEVEL SECURITY;
ALTER TABLE tasks DISABLE ROW LEVEL SECURITY;
ALTER TABLE contracts DISABLE ROW LEVEL SECURITY;
ALTER TABLE assignments DISABLE ROW LEVEL SECURITY;
ALTER TABLE invoices DISABLE ROW LEVEL SECURITY;
ALTER TABLE payments DISABLE ROW LEVEL SECURITY;
ALTER TABLE talent_payouts DISABLE ROW LEVEL SECURITY;
ALTER TABLE messages DISABLE ROW LEVEL SECURITY;
ALTER TABLE notifications DISABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE agent_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE roles DISABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles DISABLE ROW LEVEL SECURITY;
ALTER TABLE support_tickets DISABLE ROW LEVEL SECURITY;
ALTER TABLE support_messages DISABLE ROW LEVEL SECURITY;
