SET search_path TO career_operations;

-- 10.058 — Full-text search support on jobs.title & jobs.description
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS tsv tsvector GENERATED ALWAYS AS (
    to_tsvector('english', coalesce(title,'') || ' ' || coalesce(description,''))
) STORED;

CREATE INDEX IF NOT EXISTS idx_jobs_tsv ON jobs USING GIN (tsv);

-- 10.059 — Trigram fuzzy matching support on jobs.company & jobs.title
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_jobs_company_trgm ON jobs USING GIN (company gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_jobs_title_trgm ON jobs USING GIN (title gin_trgm_ops);
