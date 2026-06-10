CREATE SCHEMA IF NOT EXISTS careerops;
CREATE DOMAIN IF NOT EXISTS JSONB AS JSON;
CREATE DOMAIN IF NOT EXISTS TIMESTAMPTZ AS TIMESTAMP WITH TIME ZONE;
SET SCHEMA careerops;
CREATE DOMAIN IF NOT EXISTS JSONB AS JSON;
CREATE DOMAIN IF NOT EXISTS TIMESTAMPTZ AS TIMESTAMP WITH TIME ZONE;

CREATE TABLE IF NOT EXISTS careerops.shedlock (
    name VARCHAR(64) NOT NULL,
    lock_until TIMESTAMP NOT NULL,
    locked_at TIMESTAMP NOT NULL,
    locked_by VARCHAR(255) NOT NULL,
    PRIMARY KEY (name)
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
    updated_at TIMESTAMP WITH TIME ZONE
);

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
    UNIQUE (user_id, job_id)
);

