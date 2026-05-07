SET search_path TO career_operations;

DROP INDEX IF EXISTS idx_jobs_title_trgm;
DROP INDEX IF EXISTS idx_jobs_company_trgm;
DROP INDEX IF EXISTS idx_jobs_tsv;

ALTER TABLE jobs DROP COLUMN IF EXISTS tsv;
