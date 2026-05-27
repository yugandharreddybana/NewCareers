SET search_path TO careerops;

-- V66 — Password Rotation and History Hardening Schema.
-- Implements the password_history table to store past hashed credentials, enabling password re-use checks.

CREATE TABLE IF NOT EXISTS password_history (
    id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
    password_hash TEXT NOT NULL,
    created_at    TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Optimize historical checks to verify the last 5 passwords instantly
CREATE INDEX IF NOT EXISTS idx_password_history_user_created ON password_history (user_id, created_at DESC);

