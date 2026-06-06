SET search_path TO careerops;

-- Align legacy V2 skill_runs shape with SkillRun JPA entity
ALTER TABLE skill_runs ADD COLUMN IF NOT EXISTS user_job_id UUID REFERENCES user_jobs(id) ON DELETE SET NULL;
ALTER TABLE skill_runs ADD COLUMN IF NOT EXISTS input JSONB;
ALTER TABLE skill_runs ADD COLUMN IF NOT EXISTS output JSONB;
ALTER TABLE skill_runs ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE skill_runs ADD COLUMN IF NOT EXISTS resume_html TEXT;
ALTER TABLE skill_runs ADD COLUMN IF NOT EXISTS resume_filename VARCHAR(512);

CREATE INDEX IF NOT EXISTS idx_skill_runs_user_job_skill_date
    ON skill_runs (user_id, user_job_id, skill, created_at DESC);
