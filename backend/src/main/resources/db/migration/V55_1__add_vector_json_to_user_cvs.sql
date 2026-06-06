SET search_path TO careerops;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = current_schema() AND table_name = 'user_cvs'
    ) THEN
        ALTER TABLE user_cvs ADD COLUMN IF NOT EXISTS vector_json jsonb;
    END IF;
END $$;
