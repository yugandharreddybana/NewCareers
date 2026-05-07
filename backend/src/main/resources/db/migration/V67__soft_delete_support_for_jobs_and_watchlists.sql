SET search_path TO career_operations;

-- V67 — Soft-delete support for user_jobs and job_watchlists.
-- Enhances auditability and prevents data loss by enabling a logical delete pattern.

ALTER TABLE user_jobs ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_user_jobs_deleted_at ON user_jobs (deleted_at) WHERE deleted_at IS NOT NULL;

ALTER TABLE job_watchlists ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_job_watchlists_deleted_at ON job_watchlists (deleted_at) WHERE deleted_at IS NOT NULL;
