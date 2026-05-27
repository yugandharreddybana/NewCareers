-- ============================================================
-- Section 3.5: Weekly Progress Intelligence
-- Task 59
-- ============================================================

CREATE TABLE IF NOT EXISTS weekly_progress_snapshots (
    id                      UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id                 UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    week_start              DATE NOT NULL,
    week_end                DATE NOT NULL,

    -- Core counts for the week
    jobs_reviewed           INT NOT NULL DEFAULT 0,
    applications_submitted  INT NOT NULL DEFAULT 0,
    interviews_scheduled    INT NOT NULL DEFAULT 0,
    responses_received      INT NOT NULL DEFAULT 0,
    offers_received         INT NOT NULL DEFAULT 0,

    -- Streaks (Task 64)
    daily_use_streak        INT NOT NULL DEFAULT 0,
    max_daily_use_streak    INT NOT NULL DEFAULT 0,

    -- AI-generated insights (Tasks 60, 68)
    wins_summary            TEXT,
    bottlenecks_summary     TEXT,
    recommendations         TEXT,
    best_performing_category VARCHAR(255),

    -- Response and interview rates for chart widgets (Task 67)
    response_rate           NUMERIC(5,2),
    interview_rate          NUMERIC(5,2),

    created_at              TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),

    CONSTRAINT wps_unique_user_week UNIQUE (user_id, week_start)
);

CREATE INDEX idx_wps_user_id   ON weekly_progress_snapshots(user_id);
CREATE INDEX idx_wps_week_start ON weekly_progress_snapshots(week_start DESC);

-- Task 64: streak tracking table
CREATE TABLE IF NOT EXISTS user_streaks (
    id                    UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id               UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
    current_daily_streak  INT NOT NULL DEFAULT 0,
    longest_daily_streak  INT NOT NULL DEFAULT 0,
    last_active_date      DATE,
    total_jobs_reviewed   INT NOT NULL DEFAULT 0,
    total_apps_submitted  INT NOT NULL DEFAULT 0,
    updated_at            TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_user_streaks_user ON user_streaks(user_id);
