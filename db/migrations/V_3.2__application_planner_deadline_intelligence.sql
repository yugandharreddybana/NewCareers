-- Phase 3.2: Application Planner and Deadline Intelligence
-- Tasks 19, 20

CREATE TABLE IF NOT EXISTS application_tasks (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_job_id     UUID NOT NULL REFERENCES user_jobs(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES users(id),
    title           VARCHAR(500) NOT NULL,
    description     TEXT,
    task_type       VARCHAR(100) NOT NULL DEFAULT 'ACTION',
    -- task_type: ACTION | FOLLOW_UP | PREP | REVIEW | SUBMIT
    priority        VARCHAR(20) NOT NULL DEFAULT 'MEDIUM',
    -- priority: LOW | MEDIUM | HIGH | URGENT
    status          VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    -- status: PENDING | IN_PROGRESS | COMPLETED | SKIPPED
    due_date        TIMESTAMPTZ,
    completed_at    TIMESTAMPTZ,
    reminder_sent   BOOLEAN NOT NULL DEFAULT FALSE,
    auto_generated  BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS deadline_events (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_job_id     UUID NOT NULL REFERENCES user_jobs(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES users(id),
    event_type      VARCHAR(100) NOT NULL,
    -- event_type: APPLICATION_CLOSE | INTERVIEW | FOLLOW_UP | OFFER_DEADLINE | ASSESSMENT | CUSTOM
    title           VARCHAR(500) NOT NULL,
    event_date      TIMESTAMPTZ NOT NULL,
    notes           TEXT,
    reminder_sent   BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_app_tasks_user_job     ON application_tasks(user_job_id);
CREATE INDEX IF NOT EXISTS idx_app_tasks_user_due     ON application_tasks(user_id, due_date);
CREATE INDEX IF NOT EXISTS idx_app_tasks_status       ON application_tasks(status);
CREATE INDEX IF NOT EXISTS idx_deadline_events_user   ON deadline_events(user_id, event_date);
CREATE INDEX IF NOT EXISTS idx_deadline_events_job    ON deadline_events(user_job_id);
