SET search_path TO career_operations;

-- 10.070 — Enforce lowercase email uniqueness at the DB level
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_email_key;
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_lower ON users(lower(email));

-- 10.069 — Enforce event_type check constraints on analytics_events
ALTER TABLE analytics_events DROP CONSTRAINT IF EXISTS chk_analytics_events_type;
ALTER TABLE analytics_events ADD CONSTRAINT chk_analytics_events_type 
    CHECK (event_type IN ('skill_run_complete', 'job_viewed', 'application_submitted', 'user_login', 'user_signup', 'token_refresh', 'logout', 'account_locked', 'onboarding_started', 'onboarding_completed', 'onboarding_dropped'));
