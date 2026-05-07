CREATE TABLE IF NOT EXISTS career_operations.user_profiles (
    id UUID PRIMARY KEY,
    version BIGINT,
    user_id UUID NOT NULL UNIQUE,
    target_roles VARCHAR ARRAY,
    tech_stack VARCHAR ARRAY,
    location VARCHAR(255),
    salary_min INTEGER,
    salary_max INTEGER,
    salary_currency VARCHAR(16) DEFAULT 'EUR',
    sectors VARCHAR ARRAY,
    freshness_hours INTEGER,
    min_match_percent INTEGER,
    sponsorship_required BOOLEAN,
    onboarded BOOLEAN,
    portfolio_items JSON,
    goal_title VARCHAR(200),
    goal_salary_min INTEGER,
    goal_salary_max INTEGER,
    goal_location VARCHAR(100),
    open_to_remote BOOLEAN,
    updated_at TIMESTAMP WITH TIME ZONE,
    CONSTRAINT fk_h2_user_profiles_user FOREIGN KEY (user_id) REFERENCES career_operations.users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS career_operations.audit_logs (
    id UUID PRIMARY KEY,
    user_id UUID,
    org_id UUID,
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(255),
    resource_id VARCHAR(255),
    ip_address VARCHAR(45),
    user_agent VARCHAR(1000),
    request_id VARCHAR(255),
    metadata JSON,
    severity VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user_created
    ON career_operations.audit_logs (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS career_operations.user_jobs (
    id UUID PRIMARY KEY,
    version BIGINT,
    user_id UUID NOT NULL,
    job_id UUID NOT NULL,
    ai_score INTEGER,
    match_percent INTEGER,
    matched_skills VARCHAR ARRAY,
    unmatched_skills VARCHAR ARRAY,
    cv_improvement_tips VARCHAR ARRAY,
    score_breakdown JSON,
    human_summary VARCHAR(255),
    verdict VARCHAR(255),
    delivered_at TIMESTAMP WITH TIME ZONE,
    status VARCHAR(255),
    kanban_column VARCHAR(255),
    notes VARCHAR(255),
    deleted_at TIMESTAMP WITH TIME ZONE,
    CONSTRAINT fk_h2_user_jobs_user FOREIGN KEY (user_id) REFERENCES career_operations.users(id) ON DELETE CASCADE,
    CONSTRAINT fk_h2_user_jobs_job FOREIGN KEY (job_id) REFERENCES career_operations.jobs(id) ON DELETE CASCADE,
    UNIQUE (user_id, job_id)
);
