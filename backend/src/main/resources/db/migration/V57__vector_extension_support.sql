SET search_path TO careerops;

-- V57 — Enable pgvector when the extension is installed on this Postgres instance.
-- Local dev on stock PostgreSQL may not ship pgvector; skip without failing startup.
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'vector') THEN
        CREATE EXTENSION IF NOT EXISTS vector;
    ELSE
        RAISE NOTICE 'pgvector extension not available on this server — skipping CREATE EXTENSION vector';
    END IF;
END $$;
