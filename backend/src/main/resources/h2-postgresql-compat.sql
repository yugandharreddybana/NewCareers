CREATE TABLE IF NOT EXISTS careerops.user_keys (
    user_id UUID PRIMARY KEY,
    encrypted_dek CLOB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE TABLE IF NOT EXISTS careerops.user_profiles (
    id UUID PRIMARY KEY,
    version BIGINT DEFAULT 0,
    user_id UUID NOT NULL UNIQUE,
    target_roles VARCHAR ARRAY,
    tech_stack VARCHAR ARRAY,
    location CLOB,
    linkedin_url VARCHAR(500),
    github_url VARCHAR(500),
    website_url VARCHAR(500),
    salary_min INTEGER,
    salary_max INTEGER,
    salary_currency VARCHAR(16) DEFAULT 'EUR',
    sectors VARCHAR ARRAY,
    freshness_hours INTEGER,
    min_match_percent INTEGER,
    sponsorship_required BOOLEAN,
    onboarded BOOLEAN,
    plan_tier VARCHAR(32) DEFAULT 'FREE',
    portfolio_items JSON DEFAULT JSON '[]',
    goal_title CLOB,
    work_types VARCHAR ARRAY,
    goal_salary_min INTEGER,
    goal_salary_max INTEGER,
    goal_location CLOB,
    open_to_remote BOOLEAN,
    experience_level VARCHAR(32),
    work_experience JSON DEFAULT JSON '[]',
    education JSON DEFAULT JSON '[]',
    remote_policy VARCHAR(32),
    hybrid_onsite_days VARCHAR(64),
    availability VARCHAR(64),
    job_domain VARCHAR(32),
    onboarding_delivery JSON,
    updated_at TIMESTAMP WITH TIME ZONE,
    CONSTRAINT fk_h2_user_profiles_user FOREIGN KEY (user_id) REFERENCES careerops.users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS careerops.shedlock (
    name VARCHAR(64) NOT NULL,
    lock_until TIMESTAMP NOT NULL,
    locked_at TIMESTAMP NOT NULL,
    locked_by VARCHAR(255) NOT NULL,
    PRIMARY KEY (name)
);

CREATE TABLE IF NOT EXISTS careerops.user_cvs (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    storage_path VARCHAR(500) NOT NULL,
    file_type VARCHAR(128),
    parsed_text CLOB,
    cv_markdown CLOB,
    vector_json JSON,
    uploaded_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN,
    CONSTRAINT fk_h2_user_cvs_user FOREIGN KEY (user_id) REFERENCES careerops.users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS careerops.audit_logs (
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
    ON careerops.audit_logs (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS careerops.user_jobs (
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
    is_favorite BOOLEAN,
    notes VARCHAR(255),
    deleted_at TIMESTAMP WITH TIME ZONE,
    CONSTRAINT fk_h2_user_jobs_user FOREIGN KEY (user_id) REFERENCES careerops.users(id) ON DELETE CASCADE,
    CONSTRAINT fk_h2_user_jobs_job FOREIGN KEY (job_id) REFERENCES careerops.jobs(id) ON DELETE CASCADE,
    UNIQUE (user_id, job_id)
);
