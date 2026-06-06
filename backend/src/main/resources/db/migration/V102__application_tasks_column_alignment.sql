SET search_path TO careerops;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = current_schema() AND table_name = 'application_tasks' AND column_name = 'is_auto_generated'
    ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = current_schema() AND table_name = 'application_tasks' AND column_name = 'auto_generated'
    ) THEN
        ALTER TABLE application_tasks RENAME COLUMN is_auto_generated TO auto_generated;
    END IF;

    ALTER TABLE application_tasks ADD COLUMN IF NOT EXISTS reminder_sent BOOLEAN NOT NULL DEFAULT FALSE;
END $$;
