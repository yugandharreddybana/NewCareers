SET search_path TO careerops;

-- V53 — Add missing columns and standard renames to jobs table to align with JPA Job entity.

-- Safe column renames
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'careerops' AND table_name = 'jobs' AND column_name = 'url') THEN
        ALTER TABLE jobs RENAME COLUMN url TO source_url;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'careerops' AND table_name = 'jobs' AND column_name = 'source') THEN
        ALTER TABLE jobs RENAME COLUMN source TO source_name;
    END IF;
END$$;

-- Add missing columns
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS fingerprint VARCHAR(255);
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS currency VARCHAR(50) DEFAULT 'EUR';
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS sponsorship BOOLEAN;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS sector VARCHAR(255);
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS scraped_at TIMESTAMP WITH TIME ZONE DEFAULT now();

-- Backfill fingerprint for uniqueness safety if null
UPDATE jobs SET fingerprint = md5(id::text || title || company) WHERE fingerprint IS NULL;

-- Enforce constraints
ALTER TABLE jobs ALTER COLUMN fingerprint SET NOT NULL;
ALTER TABLE jobs ALTER COLUMN company SET NOT NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
         WHERE conrelid = 'careerops.jobs'::regclass
           AND conname  = 'uq_jobs_fingerprint'
    ) THEN
        ALTER TABLE jobs ADD CONSTRAINT uq_jobs_fingerprint UNIQUE (fingerprint);
    END IF;
END$$;

