-- V48__notification_entity_id_uuid.sql
SET search_path TO careerops;

ALTER TABLE notifications
ALTER COLUMN entity_id TYPE UUID USING entity_id::uuid;
