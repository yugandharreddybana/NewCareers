-- Phase 1: Enhance skill_runs table for Claude agentic skills
-- Adds TTL cache expiry, resume HTML storage, and performance index.

-- TTL expiry for cached results
-- NULL = cached forever (e.g. triage, compare - always re-run)
-- evaluate = 7 days, research = 1 day, prep-interview = 3 days
ALTER TABLE career_operations.skill_runs
    ADD COLUMN IF NOT EXISTS expires_at      TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS resume_html     TEXT,
    ADD COLUMN IF NOT EXISTS resume_filename TEXT;

-- Optimise the hot path: cache lookup by user + job + skill sorted by newest
CREATE INDEX IF NOT EXISTS idx_skill_runs_user_job_skill_date
    ON career_operations.skill_runs(user_id, user_job_id, skill, created_at DESC);

COMMENT ON COLUMN career_operations.skill_runs.expires_at IS
    'Cache TTL. NULL means no expiry. evaluate=7d, research=1d, prep-interview=3d, others=always fresh.';
COMMENT ON COLUMN career_operations.skill_runs.resume_html IS
    'ATS-formatted HTML resume from tailor-resume skill. Served only via PDF download endpoint, never directly via API.';
COMMENT ON COLUMN career_operations.skill_runs.resume_filename IS
    'Supabase storage path for the resume file. Format: {userId}/{company-slug}-{role-slug}.html';
