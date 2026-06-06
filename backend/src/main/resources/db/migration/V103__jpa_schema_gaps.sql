-- Align Flyway schema with JPA entities (user_profiles matching prefs, idempotency, batch runs)
SET search_path TO careerops;

-- user_profiles: matching / onboarding fields expected by UserProfile entity
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS version BIGINT NOT NULL DEFAULT 0;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS target_roles TEXT[];
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS tech_stack TEXT[];
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS salary_min INTEGER;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS salary_max INTEGER;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS sectors TEXT[];
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS freshness_hours INTEGER;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS min_match_percent INTEGER;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS sponsorship_required BOOLEAN;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS onboarded BOOLEAN;

-- Idempotency (Issue 2.047)
CREATE TABLE IF NOT EXISTS idempotency_keys (
    idempotency_key VARCHAR(64) PRIMARY KEY,
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    request_path    VARCHAR(512) NOT NULL,
    response_body   TEXT,
    response_status INTEGER NOT NULL,
    expires_at      TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_idempotency_keys_user_expires
    ON idempotency_keys (user_id, expires_at);

-- Batch skill runs
CREATE TABLE IF NOT EXISTS batch_skill_runs (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    user_job_id      UUID NOT NULL REFERENCES user_jobs(id) ON DELETE CASCADE,
    status           TEXT NOT NULL,
    total_skills     INTEGER,
    completed_skills INTEGER,
    created_at       TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at       TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_batch_skill_runs_user_job ON batch_skill_runs (user_job_id);

-- Daily fetch quota log
CREATE TABLE IF NOT EXISTS daily_fetch_log (
    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    fetch_date DATE NOT NULL,
    count      INTEGER,
    PRIMARY KEY (user_id, fetch_date)
);
