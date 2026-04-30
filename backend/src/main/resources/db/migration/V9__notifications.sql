-- =============================================================================
-- Section 8 — Task 78 : Notifications table
-- =============================================================================

CREATE TABLE career_operations.notifications (
    id         UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID          NOT NULL,
    type       VARCHAR(50)   NOT NULL,
    title      VARCHAR(200)  NOT NULL,
    body       TEXT,
    read       BOOLEAN       NOT NULL DEFAULT false,
    metadata   JSONB,
    created_at TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- Fast lookup of all notifications for a user (newest first)
CREATE INDEX idx_notifications_user_created
    ON career_operations.notifications (user_id, created_at DESC);

-- Partial index for unread badge count — extremely cheap to query
CREATE INDEX idx_notifications_user_unread
    ON career_operations.notifications (user_id)
    WHERE read = false;

COMMENT ON TABLE  career_operations.notifications              IS 'In-app notifications per user';
COMMENT ON COLUMN career_operations.notifications.type        IS 'SKILL_COMPLETE | INTERVIEW_REMINDER | JOB_MATCH | WEEKLY_DIGEST | SYSTEM';
COMMENT ON COLUMN career_operations.notifications.metadata    IS 'Optional JSONB payload, e.g. {"userJobId":"...", "skillName":"..."}';
