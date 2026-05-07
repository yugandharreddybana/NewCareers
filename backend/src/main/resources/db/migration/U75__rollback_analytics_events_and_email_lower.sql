SET search_path TO career_operations;

DROP INDEX IF EXISTS idx_users_email_lower;
ALTER TABLE users ADD CONSTRAINT users_email_key UNIQUE (email);

ALTER TABLE analytics_events DROP CONSTRAINT IF EXISTS chk_analytics_events_type;
