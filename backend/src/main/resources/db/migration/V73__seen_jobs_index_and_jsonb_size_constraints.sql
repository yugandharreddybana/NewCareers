SET search_path TO careerops;

-- 10.063 — seen_jobs table + fingerprint index (entity existed; table was missing from earlier migrations)
CREATE TABLE IF NOT EXISTS seen_jobs (
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    fingerprint VARCHAR(512) NOT NULL,
    seen_at     TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, fingerprint)
);

CREATE INDEX IF NOT EXISTS idx_seen_jobs_fingerprint ON seen_jobs(fingerprint);
CREATE INDEX IF NOT EXISTS idx_seen_jobs_seen_at ON seen_jobs(seen_at);

-- 10.065 — Cap JSONB payload size when columns exist
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = current_schema() AND table_name = 'user_jobs' AND column_name = 'score_breakdown'
    ) THEN
        ALTER TABLE user_jobs DROP CONSTRAINT IF EXISTS chk_user_jobs_score_breakdown_size;
        ALTER TABLE user_jobs ADD CONSTRAINT chk_user_jobs_score_breakdown_size
            CHECK (score_breakdown IS NULL OR octet_length(score_breakdown::text) < 65536);
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = current_schema() AND table_name = 'audit_logs' AND column_name = 'metadata'
    ) THEN
        ALTER TABLE audit_logs DROP CONSTRAINT IF EXISTS chk_audit_log_metadata_size;
        ALTER TABLE audit_logs DROP CONSTRAINT IF EXISTS chk_audit_logs_metadata_size;
        ALTER TABLE audit_logs ADD CONSTRAINT chk_audit_logs_metadata_size
            CHECK (metadata IS NULL OR octet_length(metadata::text) < 65536);
    ELSIF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = current_schema() AND table_name = 'audit_log' AND column_name = 'metadata'
    ) THEN
        ALTER TABLE audit_log DROP CONSTRAINT IF EXISTS chk_audit_log_metadata_size;
        ALTER TABLE audit_log ADD CONSTRAINT chk_audit_log_metadata_size
            CHECK (metadata IS NULL OR octet_length(metadata::text) < 65536);
    END IF;
END $$;
