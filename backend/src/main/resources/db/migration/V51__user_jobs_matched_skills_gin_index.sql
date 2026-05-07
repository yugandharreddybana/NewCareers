CREATE INDEX IF NOT EXISTS idx_user_jobs_matched_skills_gin
    ON user_jobs USING GIN (matched_skills);
