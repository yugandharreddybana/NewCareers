SET search_path TO careerops;

-- V60 — GIN indexes on JSONB / TEXT[] columns when those columns exist (ordering vs V52/V76 varies).

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = current_schema() AND table_name = 'user_jobs' AND column_name = 'score_breakdown'
    ) THEN
        EXECUTE 'CREATE INDEX IF NOT EXISTS idx_user_jobs_score_breakdown_gin ON user_jobs USING GIN (score_breakdown)';
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = current_schema() AND table_name = 'user_jobs' AND column_name = 'unmatched_skills'
    ) THEN
        EXECUTE 'CREATE INDEX IF NOT EXISTS idx_user_jobs_unmatched_skills_gin ON user_jobs USING GIN (unmatched_skills)';
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = current_schema() AND table_name = 'user_jobs' AND column_name = 'cv_improvement_tips'
    ) THEN
        EXECUTE 'CREATE INDEX IF NOT EXISTS idx_user_jobs_cv_improvement_tips_gin ON user_jobs USING GIN (cv_improvement_tips)';
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = current_schema() AND table_name = 'user_profiles' AND column_name = 'target_roles'
    ) THEN
        EXECUTE 'CREATE INDEX IF NOT EXISTS idx_user_profiles_target_roles_gin ON user_profiles USING GIN (target_roles)';
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = current_schema() AND table_name = 'user_profiles' AND column_name = 'tech_stack'
    ) THEN
        EXECUTE 'CREATE INDEX IF NOT EXISTS idx_user_profiles_tech_stack_gin ON user_profiles USING GIN (tech_stack)';
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = current_schema() AND table_name = 'user_profiles' AND column_name = 'sectors'
    ) THEN
        EXECUTE 'CREATE INDEX IF NOT EXISTS idx_user_profiles_sectors_gin ON user_profiles USING GIN (sectors)';
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = current_schema() AND table_name = 'analytics_events' AND column_name = 'metadata'
    ) THEN
        EXECUTE 'CREATE INDEX IF NOT EXISTS idx_analytics_events_metadata_gin ON analytics_events USING GIN (metadata)';
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = current_schema() AND table_name = 'notifications' AND column_name = 'metadata'
    ) THEN
        EXECUTE 'CREATE INDEX IF NOT EXISTS idx_notifications_metadata_gin ON notifications USING GIN (metadata)';
    END IF;
END $$;
