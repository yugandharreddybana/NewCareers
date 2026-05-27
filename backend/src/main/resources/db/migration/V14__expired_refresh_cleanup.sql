-- Task 123 — Index to accelerate nightly sweep of expired refresh tokens.
-- The cron (Task 124) runs: UPDATE users SET refresh_token = NULL, refresh_token_expires_at = NULL
-- WHERE refresh_token_expires_at < NOW();
-- This partial index makes that sweep O(expired rows) rather than O(all users).

SET search_path TO careerops;

CREATE INDEX IF NOT EXISTS idx_users_refresh_expires
    ON users (refresh_token_expires_at);

