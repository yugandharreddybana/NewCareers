-- V6: skill_run enhancements
-- This file supersedes the duplicate V6__skill_runs_enhancements.sql.
-- Only one V6 migration must exist; the other file has been removed.

ALTER TABLE career_operations.skill_runs
    ADD COLUMN IF NOT EXISTS error_message TEXT,
    ADD COLUMN IF NOT EXISTS duration_ms   BIGINT,
    ADD COLUMN IF NOT EXISTS retries       INTEGER DEFAULT 0;
