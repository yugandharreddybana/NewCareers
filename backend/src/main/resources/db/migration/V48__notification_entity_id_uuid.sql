-- V48__notification_entity_id_uuid.sql
ALTER TABLE career_operations.notifications
ALTER COLUMN entity_id TYPE UUID USING entity_id::uuid;
