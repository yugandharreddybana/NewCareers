SET search_path TO careerops;

-- V62 — Standardize high-traffic VARCHAR columns to TEXT for future-proof and truncating-safe storage.
-- In PostgreSQL, there is no performance difference between VARCHAR(N) and TEXT.

ALTER TABLE jobs ALTER COLUMN title TYPE TEXT;
ALTER TABLE jobs ALTER COLUMN company TYPE TEXT;
ALTER TABLE jobs ALTER COLUMN location TYPE TEXT;
ALTER TABLE jobs ALTER COLUMN source_name TYPE TEXT;
ALTER TABLE jobs ALTER COLUMN source_url TYPE TEXT;

ALTER TABLE users ALTER COLUMN name TYPE TEXT;
ALTER TABLE users ALTER COLUMN username TYPE TEXT;
ALTER TABLE users ALTER COLUMN email TYPE TEXT;

ALTER TABLE user_profiles ALTER COLUMN location TYPE TEXT;

ALTER TABLE user_jobs ALTER COLUMN human_summary TYPE TEXT;
ALTER TABLE user_jobs ALTER COLUMN verdict TYPE TEXT;
ALTER TABLE user_jobs ALTER COLUMN status TYPE TEXT;
ALTER TABLE user_jobs ALTER COLUMN kanban_column TYPE TEXT;
ALTER TABLE user_jobs ALTER COLUMN notes TYPE TEXT;

