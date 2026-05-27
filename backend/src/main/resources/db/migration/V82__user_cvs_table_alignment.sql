-- Align Flyway cv_documents with JPA entity user_cvs; enable local file fallback + one active CV per user.
SET search_path TO careerops;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'careerops' AND table_name = 'cv_documents'
    ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'careerops' AND table_name = 'user_cvs'
    ) THEN
        ALTER TABLE cv_documents RENAME TO user_cvs;
    END IF;
END $$;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'careerops' AND table_name = 'cv_documents'
    ) AND EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'careerops' AND table_name = 'user_cvs'
    ) THEN
        INSERT INTO user_cvs (id, user_id, file_name, storage_path, file_type, parsed_text, is_active, uploaded_at)
        SELECT cd.id, cd.user_id, cd.file_name, cd.storage_path, cd.file_type, cd.parsed_text, cd.is_active, cd.uploaded_at
        FROM cv_documents cd
        WHERE NOT EXISTS (SELECT 1 FROM user_cvs uc WHERE uc.id = cd.id);
        DROP TABLE cv_documents;
    END IF;
END $$;

ALTER TABLE user_cvs ADD COLUMN IF NOT EXISTS file_data BYTEA;
ALTER TABLE user_cvs ADD COLUMN IF NOT EXISTS cv_markdown TEXT;
ALTER TABLE user_cvs ADD COLUMN IF NOT EXISTS vector_json JSONB;

DROP INDEX IF EXISTS idx_cv_documents_user_active_uniq;
DROP INDEX IF EXISTS idx_cv_documents_user_id;

CREATE INDEX IF NOT EXISTS idx_user_cvs_user_id ON user_cvs (user_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_cvs_one_active_per_user
    ON user_cvs (user_id)
    WHERE is_active = TRUE;
