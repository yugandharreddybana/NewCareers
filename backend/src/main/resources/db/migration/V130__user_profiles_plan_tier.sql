-- Prompt 6: per-user plan tier for AI/job limits (default FREE for existing rows).
SET search_path TO careerops;

ALTER TABLE user_profiles
    ADD COLUMN IF NOT EXISTS plan_tier VARCHAR(20) NOT NULL DEFAULT 'FREE';
