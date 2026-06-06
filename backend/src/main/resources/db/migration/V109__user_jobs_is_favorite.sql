SET search_path TO careerops;

ALTER TABLE user_jobs ADD COLUMN IF NOT EXISTS is_favorite BOOLEAN NOT NULL DEFAULT FALSE;
