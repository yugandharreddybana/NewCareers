-- V83: Batch 4 – hot-path composite & filter indexes (idempotent; column-aware)
SET search_path TO careerops;

DO $$
BEGIN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_user_jobs_user_delivered ON user_jobs (user_id, delivered_at DESC)';

    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = current_schema() AND table_name = 'user_jobs' AND column_name = 'kanban_column'
    ) THEN
        EXECUTE 'CREATE INDEX IF NOT EXISTS idx_user_jobs_user_kanban ON user_jobs (user_id, kanban_column)';
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = current_schema() AND table_name = 'user_jobs' AND column_name = 'match_percent'
    ) THEN
        EXECUTE 'CREATE INDEX IF NOT EXISTS idx_user_jobs_user_match ON user_jobs (user_id, match_percent DESC) WHERE match_percent IS NOT NULL';
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = current_schema() AND table_name = 'user_jobs' AND column_name = 'is_favorite'
    ) THEN
        EXECUTE 'CREATE INDEX IF NOT EXISTS idx_user_jobs_user_favorite ON user_jobs (user_id, is_favorite) WHERE is_favorite = TRUE';
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = current_schema() AND table_name = 'user_jobs' AND column_name = 'is_new'
    ) THEN
        EXECUTE 'CREATE INDEX IF NOT EXISTS idx_user_jobs_user_unread ON user_jobs (user_id) WHERE is_new = TRUE';
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = current_schema() AND table_name = 'jobs' AND column_name = 'deleted_at'
    ) THEN
        EXECUTE 'CREATE INDEX IF NOT EXISTS idx_jobs_location ON jobs (location) WHERE deleted_at IS NULL';
        IF EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = current_schema() AND table_name = 'jobs' AND column_name = 'source_name'
        ) THEN
            EXECUTE 'CREATE INDEX IF NOT EXISTS idx_jobs_source ON jobs (source_name) WHERE deleted_at IS NULL';
            EXECUTE 'CREATE INDEX IF NOT EXISTS idx_jobs_source_created ON jobs (source_name, created_at DESC) WHERE deleted_at IS NULL';
        ELSIF EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = current_schema() AND table_name = 'jobs' AND column_name = 'source'
        ) THEN
            EXECUTE 'CREATE INDEX IF NOT EXISTS idx_jobs_source ON jobs (source) WHERE deleted_at IS NULL';
            EXECUTE 'CREATE INDEX IF NOT EXISTS idx_jobs_source_created ON jobs (source, created_at DESC) WHERE deleted_at IS NULL';
        END IF;
        EXECUTE 'CREATE INDEX IF NOT EXISTS idx_jobs_active ON jobs (created_at DESC) WHERE deleted_at IS NULL';
    END IF;
END $$;
