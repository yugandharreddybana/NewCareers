SET search_path TO career_operations;

-- 10.063 — Add index on seen_jobs(fingerprint) for scale
CREATE INDEX IF NOT EXISTS idx_seen_jobs_fingerprint ON seen_jobs(fingerprint);

-- 10.065 — Prevent unbounded JSONB TOAST overhead by capping size
ALTER TABLE user_jobs DROP CONSTRAINT IF EXISTS chk_user_jobs_score_breakdown_size;
ALTER TABLE user_jobs ADD CONSTRAINT chk_user_jobs_score_breakdown_size 
    CHECK (octet_length(score_breakdown::text) < 65536);

ALTER TABLE audit_log DROP CONSTRAINT IF EXISTS chk_audit_log_metadata_size;
ALTER TABLE audit_log ADD CONSTRAINT chk_audit_log_metadata_size 
    CHECK (octet_length(metadata::text) < 65536);
