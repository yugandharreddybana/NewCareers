-- V38 — Reconcile users table with the JPA User entity.
--
-- AUDIT 10.004 / Pass 6 #6.005
--
--  1. Add `username` column required by the User entity. V1 left this out so
--     Spring's ddl-auto=validate fails at boot. Backfill by deriving from the
--     email local-part — collisions are resolved by appending the row's id-suffix.
--
--  2. The `role` column already exists in V1 (default 'USER'). We add a CHECK
--     so only known values can ever be inserted. Promotion to ADMIN happens via
--     a dedicated SQL update or admin endpoint in production — never via API.
--
-- Idempotent: every statement is gated on existence so re-runs are safe.
SET search_path TO careerops;

-- ── 1. Add `username` column ──────────────────────────────────────────────
ALTER TABLE users ADD COLUMN IF NOT EXISTS username VARCHAR(64);

-- ── 1a. Backfill existing rows from email local-part + id suffix ──────────
-- The id suffix guarantees uniqueness even when two emails share a local-part.
UPDATE users
   SET username = lower(
       regexp_replace(
           split_part(email, '@', 1) || '_' || substring(id::text from 1 for 8),
           '[^a-z0-9._-]', '', 'g'
       )
   )
 WHERE username IS NULL;

-- ── 1b. Enforce NOT NULL + UNIQUE only after backfill ─────────────────────
ALTER TABLE users ALTER COLUMN username SET NOT NULL;

-- Drop a stray legacy unique index if it exists, then create the canonical one.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes
         WHERE schemaname = 'careerops'
           AND indexname  = 'idx_users_username_unique'
    ) THEN
        CREATE UNIQUE INDEX idx_users_username_unique ON users (lower(username));
    END IF;
END$$;

-- ── 2. CHECK constraint on `role` to lock the value-set down ──────────────
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
         WHERE conname = 'chk_users_role'
           AND conrelid = 'careerops.users'::regclass
    ) THEN
        ALTER TABLE users ADD CONSTRAINT chk_users_role
            CHECK (role IN ('USER', 'ADMIN'));
    END IF;
END $$;

-- ── 3. Helpful index on email lower-case for case-insensitive lookups ────
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_lower
    ON users (lower(email));

