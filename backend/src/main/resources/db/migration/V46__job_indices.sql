-- V46__job_indices.sql
SET search_path TO careerops;

CREATE INDEX IF NOT EXISTS idx_jobs_company_posted ON jobs (company, posted_at DESC);
CREATE INDEX IF NOT EXISTS idx_jobs_source_posted ON jobs (source_name, posted_at DESC);
CREATE INDEX IF NOT EXISTS idx_jobs_scraped ON jobs (scraped_at);
