-- Batch 4 – additional indexes for job-list hot paths (column-aware)
SET search_path TO careerops;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = current_schema() AND table_name = 'user_jobs' AND column_name = 'match_percent'
    ) THEN
        IF EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = current_schema() AND table_name = 'user_jobs' AND column_name = 'deleted_at'
        ) THEN
            EXECUTE 'CREATE INDEX IF NOT EXISTS idx_user_jobs_user_match ON user_jobs (user_id, match_percent DESC) WHERE deleted_at IS NULL';
        ELSE
            EXECUTE 'CREATE INDEX IF NOT EXISTS idx_user_jobs_user_match ON user_jobs (user_id, match_percent DESC)';
        END IF;
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = current_schema() AND table_name = 'user_jobs' AND column_name = 'is_favorite'
    ) THEN
        IF EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = current_schema() AND table_name = 'user_jobs' AND column_name = 'deleted_at'
        ) THEN
            EXECUTE 'CREATE INDEX IF NOT EXISTS idx_user_jobs_user_favorite ON user_jobs (user_id, is_favorite) WHERE deleted_at IS NULL';
        ELSE
            EXECUTE 'CREATE INDEX IF NOT EXISTS idx_user_jobs_user_favorite ON user_jobs (user_id, is_favorite)';
        END IF;
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = current_schema() AND table_name = 'user_jobs' AND column_name = 'status'
    ) THEN
        IF EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = current_schema() AND table_name = 'user_jobs' AND column_name = 'deleted_at'
        ) THEN
            EXECUTE 'CREATE INDEX IF NOT EXISTS idx_user_jobs_user_status ON user_jobs (user_id, status) WHERE deleted_at IS NULL';
        ELSE
            EXECUTE 'CREATE INDEX IF NOT EXISTS idx_user_jobs_user_status ON user_jobs (user_id, status)';
        END IF;
    END IF;
END $$;
