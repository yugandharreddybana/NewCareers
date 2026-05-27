SET search_path TO careerops;

-- V52 — Add missing columns to user_jobs table to align with JPA UserJob entity.
-- Avoids boot failures under ddl-auto=validate in staging/production environments.

ALTER TABLE user_jobs ADD COLUMN IF NOT EXISTS version BIGINT DEFAULT 0;
ALTER TABLE user_jobs ADD COLUMN IF NOT EXISTS ai_score INT;
ALTER TABLE user_jobs ADD COLUMN IF NOT EXISTS matched_skills TEXT ARRAY;
ALTER TABLE user_jobs ADD COLUMN IF NOT EXISTS unmatched_skills TEXT ARRAY;
ALTER TABLE user_jobs ADD COLUMN IF NOT EXISTS cv_improvement_tips TEXT ARRAY;
ALTER TABLE user_jobs ADD COLUMN IF NOT EXISTS score_breakdown JSONB;
ALTER TABLE user_jobs ADD COLUMN IF NOT EXISTS human_summary TEXT;
ALTER TABLE user_jobs ADD COLUMN IF NOT EXISTS verdict VARCHAR(255);
ALTER TABLE user_jobs ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'Discovered';

