-- V48__notification_entity_id_uuid.sql
-- entity_id was never on the V9.1 notifications shape (metadata JSONB only).
SET search_path TO careerops;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = current_schema()
          AND table_name = 'notifications'
          AND column_name = 'entity_id'
    ) THEN
        ALTER TABLE notifications
            ALTER COLUMN entity_id TYPE UUID USING entity_id::uuid;
    END IF;
END $$;
