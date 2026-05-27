-- Phase 3 · Section 3.2 · Task 20
-- Follow-up dates, interview dates, application close dates per job

CREATE TABLE IF NOT EXISTS deadline_events (
    id              UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
    user_job_id     UUID        NOT NULL REFERENCES user_jobs(id) ON DELETE CASCADE,
    user_id         UUID        NOT NULL REFERENCES users(id)     ON DELETE CASCADE,

    event_type      TEXT        NOT NULL,
    -- APPLICATION_CLOSE | INTERVIEW_DATE | FOLLOW_UP | OFFER_DEADLINE | CUSTOM

    title           TEXT        NOT NULL,
    notes           TEXT,

    event_date      TIMESTAMP WITH TIME ZONE NOT NULL,
    remind_at       TIMESTAMP WITH TIME ZONE,
    -- when to fire the in-app + email reminder

    reminder_sent   BOOLEAN     NOT NULL DEFAULT FALSE,
    is_completed    BOOLEAN     NOT NULL DEFAULT FALSE,
    completed_at    TIMESTAMP WITH TIME ZONE,

    created_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_deadline_events_user_job  ON deadline_events(user_job_id);
CREATE INDEX IF NOT EXISTS idx_deadline_events_user      ON deadline_events(user_id);
CREATE INDEX IF NOT EXISTS idx_deadline_events_date      ON deadline_events(event_date);
CREATE INDEX IF NOT EXISTS idx_deadline_events_remind    ON deadline_events(remind_at);
