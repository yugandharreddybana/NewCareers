-- V6: skill_run enhancements
-- This file supersedes the duplicate V6__skill_runs_enhancements.sql.
-- Only one V6 migration must exist; the other file has been removed.

-- One column per statement for H2 + PostgreSQL compatibility.
ALTER TABLE skill_runs ADD COLUMN IF NOT EXISTS error_message TEXT;
ALTER TABLE skill_runs ADD COLUMN IF NOT EXISTS duration_ms BIGINT;
ALTER TABLE skill_runs ADD COLUMN IF NOT EXISTS retries INTEGER DEFAULT 0;

