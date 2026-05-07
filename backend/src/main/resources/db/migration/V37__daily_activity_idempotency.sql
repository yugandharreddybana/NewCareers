-- Issue 2.067 — Daily activity idempotency
-- Tracks one entry per user per day to ensure streaks are updated exactly once.

SET search_path TO career_operations;

CREATE TABLE IF NOT EXISTS daily_activity_log (
    user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    activity_date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, activity_date)
);

CREATE INDEX idx_daily_activity_user ON daily_activity_log(user_id);
