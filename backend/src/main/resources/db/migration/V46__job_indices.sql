-- V46__job_indices.sql
-- Index columns only when present (source_name arrives in V53; scraped_at in V53).
SET search_path TO careerops;

CREATE INDEX IF NOT EXISTS idx_jobs_company_posted ON jobs (company, posted_at DESC);

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = current_schema() AND table_name = 'jobs' AND column_name = 'source_name'
    ) THEN
        EXECUTE 'CREATE INDEX IF NOT EXISTS idx_jobs_source_posted ON jobs (source_name, posted_at DESC)';
    ELSIF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = current_schema() AND table_name = 'jobs' AND column_name = 'source'
    ) THEN
        EXECUTE 'CREATE INDEX IF NOT EXISTS idx_jobs_source_posted ON jobs (source, posted_at DESC)';
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = current_schema() AND table_name = 'jobs' AND column_name = 'scraped_at'
    ) THEN
        EXECUTE 'CREATE INDEX IF NOT EXISTS idx_jobs_scraped ON jobs (scraped_at)';
    END IF;
END $$;
