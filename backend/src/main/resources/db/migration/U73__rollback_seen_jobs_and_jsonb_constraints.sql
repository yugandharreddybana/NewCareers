SET search_path TO careerops;

DROP INDEX IF EXISTS idx_seen_jobs_fingerprint;

ALTER TABLE user_jobs DROP CONSTRAINT IF EXISTS chk_user_jobs_score_breakdown_size;
ALTER TABLE audit_log DROP CONSTRAINT IF EXISTS chk_audit_log_metadata_size;

