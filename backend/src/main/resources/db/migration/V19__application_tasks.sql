-- Phase 3 · Section 3.2 · Task 19
-- Per-job to-do items generated or added manually by the user

CREATE TABLE IF NOT EXISTS application_tasks (
    id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_job_id   UUID        NOT NULL REFERENCES user_jobs(id) ON DELETE CASCADE,
    user_id       UUID        NOT NULL REFERENCES users(id)     ON DELETE CASCADE,

    title         TEXT        NOT NULL,
    description   TEXT,
    task_type     TEXT        NOT NULL DEFAULT 'CUSTOM',
    -- CUSTOM | FOLLOW_UP | SCHEDULE_PREP | FINAL_REVIEW | RESEARCH | SUBMIT_APPLICATION

    priority      TEXT        NOT NULL DEFAULT 'MEDIUM',
    -- LOW | MEDIUM | HIGH

    status        TEXT        NOT NULL DEFAULT 'PENDING',
    -- PENDING | IN_PROGRESS | DONE | SKIPPED

    due_date      TIMESTAMP WITH TIME ZONE,
    completed_at  TIMESTAMP WITH TIME ZONE,

    is_auto_generated BOOLEAN NOT NULL DEFAULT FALSE,
    sort_order    INTEGER     NOT NULL DEFAULT 0,

    created_at    TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at    TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_application_tasks_user_job ON application_tasks(user_job_id);
CREATE INDEX IF NOT EXISTS idx_application_tasks_user    ON application_tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_application_tasks_status  ON application_tasks(status);
CREATE INDEX IF NOT EXISTS idx_application_tasks_due     ON application_tasks(due_date);
