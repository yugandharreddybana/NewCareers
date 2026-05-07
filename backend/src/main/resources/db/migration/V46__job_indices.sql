-- V46__job_indices.sql
CREATE INDEX IF NOT EXISTS idx_jobs_company_posted ON career_operations.jobs (company, posted_at DESC);
CREATE INDEX IF NOT EXISTS idx_jobs_source_posted ON career_operations.jobs (source_name, posted_at DESC);
CREATE INDEX IF NOT EXISTS idx_jobs_scraped ON career_operations.jobs (scraped_at);
