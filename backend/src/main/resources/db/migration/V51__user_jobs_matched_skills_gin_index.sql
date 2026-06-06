SET search_path TO careerops;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = current_schema()
          AND table_name = 'user_jobs'
          AND column_name = 'matched_skills'
    ) THEN
        EXECUTE 'CREATE INDEX IF NOT EXISTS idx_user_jobs_matched_skills_gin ON user_jobs USING GIN (matched_skills)';
    END IF;
END $$;
