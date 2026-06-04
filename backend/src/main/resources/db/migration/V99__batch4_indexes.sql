-- Batch 4 – additional indexes for job-list hot paths
-- These complement the two indexes already declared in the UserJob entity
-- and cover the new filter/sort dimensions added in Batch 4.

-- Fast look-up of jobs sorted by AI match score per user
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_jobs_user_match
    ON careerops.user_jobs (user_id, match_percent DESC)
    WHERE deleted_at IS NULL;

-- Favourite-only list (isFavorite boolean filter)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_jobs_user_favorite
    ON careerops.user_jobs (user_id, is_favorite)
    WHERE deleted_at IS NULL;

-- Status / kanban column filter (if the separate idx_user_jobs_user_kanban
-- from the entity definition already exists this is a safe no-op due to IF NOT EXISTS)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_jobs_user_status
    ON careerops.user_jobs (user_id, status)
    WHERE deleted_at IS NULL;
