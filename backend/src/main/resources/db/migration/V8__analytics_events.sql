-- Section 5 — Task 43
-- Analytics events table for tracking user activity: skill runs, job views, applications

CREATE TABLE IF NOT EXISTS analytics_events (
    id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    event_type  VARCHAR(50) NOT NULL,
    metadata    JSONB       NOT NULL DEFAULT '{}',
    created_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Composite index for all analytics queries (user + type + time)
CREATE INDEX IF NOT EXISTS idx_analytics_user_type_created
    ON analytics_events(user_id, event_type, created_at DESC);

-- Index for time-range queries per user
CREATE INDEX IF NOT EXISTS idx_analytics_user_created
    ON analytics_events(user_id, created_at DESC);
