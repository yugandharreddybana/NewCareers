SET search_path TO careerops;

-- V60 — Add performance-enhancing GIN indexes for JSONB and TEXT ARRAY columns across high-traffic tables.
-- Prevents slow sequential scans during advanced path-filtering operations.

-- 1. GIN index on user_jobs JSONB score_breakdown
CREATE INDEX IF NOT EXISTS idx_user_jobs_score_breakdown_gin ON user_jobs USING GIN (score_breakdown);

-- 2. GIN indexes on user_jobs TEXT ARRAY columns
CREATE INDEX IF NOT EXISTS idx_user_jobs_unmatched_skills_gin ON user_jobs USING GIN (unmatched_skills);
CREATE INDEX IF NOT EXISTS idx_user_jobs_cv_improvement_tips_gin ON user_jobs USING GIN (cv_improvement_tips);

-- 3. GIN indexes on user_profiles TEXT ARRAY columns
CREATE INDEX IF NOT EXISTS idx_user_profiles_target_roles_gin ON user_profiles USING GIN (target_roles);
CREATE INDEX IF NOT EXISTS idx_user_profiles_tech_stack_gin ON user_profiles USING GIN (tech_stack);
CREATE INDEX IF NOT EXISTS idx_user_profiles_sectors_gin ON user_profiles USING GIN (sectors);

-- 4. GIN index on analytics_events JSONB metadata
CREATE INDEX IF NOT EXISTS idx_analytics_events_metadata_gin ON analytics_events USING GIN (metadata);

-- 5. GIN index on notifications JSONB metadata
CREATE INDEX IF NOT EXISTS idx_notifications_metadata_gin ON notifications USING GIN (metadata);

