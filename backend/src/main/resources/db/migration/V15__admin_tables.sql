-- Task 133 — Admin supporting tables
-- Schema: career_operations

SET search_path TO career_operations;

-- ───────────────────────────────────────────────────────────────────────────────
-- 1. feature_flags — runtime feature toggles manageable via admin API
-- ───────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS feature_flags (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    flag_key    TEXT NOT NULL UNIQUE,
    enabled     BOOLEAN NOT NULL DEFAULT FALSE,
    description TEXT,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_feature_flags_key ON feature_flags (flag_key);

-- Seed sensible defaults so the table is never empty on first boot
INSERT INTO feature_flags (flag_key, enabled, description) VALUES
    ('JOB_FETCH_ENABLED',        TRUE,  'Master switch — allows the daily job-fetch cron to run'),
    ('AI_SCORING_ENABLED',       TRUE,  'Enable/disable AI job-score pipeline'),
    ('EMAIL_DIGEST_ENABLED',     TRUE,  'Allow weekly/daily email digests to be sent'),
    ('REFERRAL_ENABLED',         TRUE,  'Enable referral feature for all users'),
    ('LINKEDIN_IMPORT_ENABLED',  TRUE,  'Allow LinkedIn ZIP imports on the profile page'),
    ('SKILL_COACH_ENABLED',      TRUE,  'Enable AI skill-coach sessions')
ON CONFLICT (flag_key) DO NOTHING;

-- ───────────────────────────────────────────────────────────────────────────────
-- 2. admin_stats_cache — optional cache table for expensive aggregation queries
--    AdminService writes a snapshot here every N minutes via the cron;
--    GET /admin/stats reads the live query (not this cache) at low traffic.
-- ───────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS admin_stats_cache (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stat_key    TEXT NOT NULL UNIQUE,
    stat_value  JSONB NOT NULL,
    computed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_stats_key ON admin_stats_cache (stat_key);

-- ───────────────────────────────────────────────────────────────────────────────
-- 3. Soft-delete column on users (used by DELETE /admin/users/{id})
-- ───────────────────────────────────────────────────────────────────────────────
ALTER TABLE users ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_users_deleted_at ON users (deleted_at)
    WHERE deleted_at IS NOT NULL;
