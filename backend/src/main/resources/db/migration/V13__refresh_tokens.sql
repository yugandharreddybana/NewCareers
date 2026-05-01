-- Task 116: Add refresh token columns to users
SET search_path TO career_operations;

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS refresh_token            VARCHAR(500),
    ADD COLUMN IF NOT EXISTS refresh_token_expires_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_users_refresh_token ON users(refresh_token);
