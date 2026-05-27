-- =============================================================================
-- Section 8 — Task 78 : Notifications table
-- =============================================================================

CREATE TABLE careerops.notifications (
    id         UUID          DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id    UUID          NOT NULL,
    type       VARCHAR(50)   NOT NULL,
    title      VARCHAR(200)  NOT NULL,
    body       TEXT,
    read       BOOLEAN       NOT NULL DEFAULT false,
    metadata   JSONB,
    created_at TIMESTAMP WITH TIME ZONE   NOT NULL DEFAULT NOW()
);

-- Fast lookup of all notifications for a user (newest first)
CREATE INDEX idx_notifications_user_created
    ON careerops.notifications (user_id, created_at DESC);

-- Partial index for unread badge count — extremely cheap to query
CREATE INDEX idx_notifications_user_unread
    ON careerops.notifications (user_id);

COMMENT ON TABLE  careerops.notifications              IS 'In-app notifications per user';
COMMENT ON COLUMN careerops.notifications.type        IS 'SKILL_COMPLETE | INTERVIEW_REMINDER | JOB_MATCH | WEEKLY_DIGEST | SYSTEM';
COMMENT ON COLUMN careerops.notifications.metadata    IS 'Optional JSONB payload, e.g. {"userJobId":"...", "skillName":"..."}';

