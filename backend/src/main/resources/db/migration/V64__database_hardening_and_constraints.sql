SET search_path TO career_operations;

-- V64 — Hardening and constraints across high-traffic tables.
-- 1. Enable pgcrypto extension for gen_random_uuid() support on legacy PG versions (e.g., PG 12).
-- 2. Add CHECK constraints to enum-like text columns to prevent database corruption.
-- 3. Defensively standardize ON UPDATE CASCADE behaviour across primary foreign keys.

-- 1. Enable pgcrypto extension
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 2. CHECK constraints on enum-like text columns
ALTER TABLE user_jobs DROP CONSTRAINT IF EXISTS chk_user_jobs_kanban;
ALTER TABLE user_jobs ADD CONSTRAINT chk_user_jobs_kanban CHECK (kanban_column IN ('Discovered', 'Saved', 'Applied', 'Interview', 'Offer', 'Rejected'));

ALTER TABLE user_jobs DROP CONSTRAINT IF EXISTS chk_user_jobs_status;
ALTER TABLE user_jobs ADD CONSTRAINT chk_user_jobs_status CHECK (status IN ('Discovered', 'Saved', 'Applied', 'Interview', 'Offer', 'Rejected'));

-- Ensure application_runs table exists before adding the constraint (safety guard for non-monolithic databases)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'career_operations' AND table_name = 'application_runs') THEN
        ALTER TABLE application_runs DROP CONSTRAINT IF EXISTS chk_application_runs_status;
        ALTER TABLE application_runs ADD CONSTRAINT chk_application_runs_status CHECK (status IN ('pending', 'in_progress', 'awaiting_approval', 'completed', 'cancelled', 'failed'));
    END IF;
END$$;

-- 3. ON UPDATE CASCADE behavior defensive hardening
DO $$
BEGIN
    -- user_jobs -> users FK
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_schema = 'career_operations' AND table_name = 'user_jobs' AND constraint_name = 'user_jobs_user_id_fkey') THEN
        ALTER TABLE user_jobs DROP CONSTRAINT user_jobs_user_id_fkey;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_schema = 'career_operations' AND table_name = 'user_jobs' AND constraint_name = 'fk_user_jobs_user') THEN
        ALTER TABLE user_jobs ADD CONSTRAINT fk_user_jobs_user FOREIGN KEY (user_id) REFERENCES users(id) ON UPDATE CASCADE ON DELETE CASCADE;
    END IF;

    -- user_profiles -> users FK
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_schema = 'career_operations' AND table_name = 'user_profiles' AND constraint_name = 'user_profiles_user_id_fkey') THEN
        ALTER TABLE user_profiles DROP CONSTRAINT user_profiles_user_id_fkey;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_schema = 'career_operations' AND table_name = 'user_profiles' AND constraint_name = 'fk_user_profiles_user') THEN
        ALTER TABLE user_profiles ADD CONSTRAINT fk_user_profiles_user FOREIGN KEY (user_id) REFERENCES users(id) ON UPDATE CASCADE ON DELETE CASCADE;
    END IF;
END$$;
