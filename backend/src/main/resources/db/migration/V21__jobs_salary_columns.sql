-- Add salary range columns to jobs table
ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS salary_min INTEGER,
  ADD COLUMN IF NOT EXISTS salary_max INTEGER;

CREATE INDEX IF NOT EXISTS idx_jobs_salary_min ON jobs (salary_min);
CREATE INDEX IF NOT EXISTS idx_jobs_salary_max ON jobs (salary_max);
