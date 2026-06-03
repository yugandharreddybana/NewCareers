-- ============================================================
-- V83: Batch 4 – hot-path composite & filter indexes
-- Target table: user_jobs  (maps to UserJob entity)
-- Target table: jobs        (maps to JobListing entity)
-- All created CONCURRENTLY-style via IF NOT EXISTS guards so
-- they are safe to apply against a live database.
-- ============================================================

-- ── user_jobs ─────────────────────────────────────────────
-- Primary list sort: user's jobs ordered by delivered_at DESC
CREATE INDEX IF NOT EXISTS idx_user_jobs_user_delivered
    ON user_jobs (user_id, delivered_at DESC);

-- Kanban board: filter by column per user
CREATE INDEX IF NOT EXISTS idx_user_jobs_user_kanban
    ON user_jobs (user_id, kanban_column);

-- Stats: avg / top match-percent per user (skip NULLs)
CREATE INDEX IF NOT EXISTS idx_user_jobs_user_match
    ON user_jobs (user_id, match_percent DESC)
    WHERE match_percent IS NOT NULL;

-- Favorites filter
CREATE INDEX IF NOT EXISTS idx_user_jobs_user_favorite
    ON user_jobs (user_id, is_favorite)
    WHERE is_favorite = TRUE;

-- Unread badge count (partial – only unread rows indexed)
CREATE INDEX IF NOT EXISTS idx_user_jobs_user_unread
    ON user_jobs (user_id)
    WHERE is_new = TRUE;

-- ── jobs (job_listing) ────────────────────────────────────
-- Filter by location (used in Specification queries)
CREATE INDEX IF NOT EXISTS idx_jobs_location
    ON jobs (location);

-- Filter by source
CREATE INDEX IF NOT EXISTS idx_jobs_source
    ON jobs (source);

-- Composite covering index for the common "source + created_at" admin query
CREATE INDEX IF NOT EXISTS idx_jobs_source_created
    ON jobs (source, created_at DESC);

-- Soft-delete partial: only live rows participate in searches
CREATE INDEX IF NOT EXISTS idx_jobs_active
    ON jobs (created_at DESC)
    WHERE deleted_at IS NULL;
