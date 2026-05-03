-- Phase 3.1 — Interview Command Center
-- Tracks interview stages, mock sessions, and question banks per job

CREATE TABLE IF NOT EXISTS interview_tracks (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    user_job_id   UUID NOT NULL,
    company_name  VARCHAR(255),
    role_title    VARCHAR(255),
    current_stage VARCHAR(100) DEFAULT 'applied',
    interview_date TIMESTAMPTZ,
    notes         TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_interview_tracks_user_id     ON interview_tracks(user_id);
CREATE INDEX IF NOT EXISTS idx_interview_tracks_user_job_id ON interview_tracks(user_job_id);

CREATE TABLE IF NOT EXISTS interview_sessions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    track_id        UUID REFERENCES interview_tracks(id) ON DELETE CASCADE,
    user_job_id     UUID,
    mode            VARCHAR(50) NOT NULL DEFAULT 'text',
    status          VARCHAR(50) NOT NULL DEFAULT 'in_progress',
    overall_score   NUMERIC(5,2),
    strengths       TEXT,
    weaknesses      TEXT,
    started_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_interview_sessions_user_id ON interview_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_interview_sessions_track_id ON interview_sessions(track_id);

CREATE TABLE IF NOT EXISTS interview_question_bank (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id    UUID REFERENCES interview_sessions(id) ON DELETE CASCADE,
    user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    user_job_id   UUID,
    company_name  VARCHAR(255),
    role_title    VARCHAR(255),
    skill_area    VARCHAR(100),
    question      TEXT NOT NULL,
    model_answer  TEXT,
    user_answer   TEXT,
    score         NUMERIC(5,2),
    turn_number   INT DEFAULT 0,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_iqb_user_id    ON interview_question_bank(user_id);
CREATE INDEX IF NOT EXISTS idx_iqb_session_id ON interview_question_bank(session_id);
