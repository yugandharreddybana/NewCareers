-- V39 — Brute-force protection: failed login tracking and account lockout.
--
-- Task 3.002:
--  - Track `failed_login_attempts` (resets on success).
--  - `locked_until` timestamp for temporary lockouts.
--  - Lock account for 15 minutes after 5 failures.
--  - Captcha required after 3 failures (enforced in AuthService).

SET search_path TO careerops;

ALTER TABLE users ADD COLUMN IF NOT EXISTS failed_login_attempts INT NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS locked_until TIMESTAMP WITH TIME ZONE;

-- Index on locked_until might be useful if we ever want to run a cleanup job, 
-- but it's mainly used during login lookups on a single row.
CREATE INDEX IF NOT EXISTS idx_users_locked_until ON users(locked_until);

