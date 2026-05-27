SET search_path TO careerops;

-- V63 — Add composite indexes on high-traffic large tables to drastically accelerate user queries and prevent sequential global scans.
-- Avoids global scans on unbounded growing tables by providing highly optimized search paths.

CREATE INDEX IF NOT EXISTS idx_ai_token_usage_user_created ON ai_token_usage (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_skill_runs_user_created ON skill_runs (user_id, created_at DESC);

