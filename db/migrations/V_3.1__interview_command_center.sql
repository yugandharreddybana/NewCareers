-- Phase 3.1: Interview Command Center
-- Tasks 1, 2, 3

CREATE TABLE IF NOT EXISTS interview_tracks (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_job_id     UUID NOT NULL REFERENCES user_jobs(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES users(id),
    stage           VARCHAR(50) NOT NULL DEFAULT 'PREP',
    interview_date  TIMESTAMPTZ,
    reminder_sent   BOOLEAN NOT NULL DEFAULT FALSE,
    notes           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS interview_sessions (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_job_id      UUID NOT NULL REFERENCES user_jobs(id) ON DELETE CASCADE,
    user_id          UUID NOT NULL REFERENCES users(id),
    mode             VARCHAR(20) NOT NULL DEFAULT 'TEXT',
    status           VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    score            INTEGER NOT NULL DEFAULT 0,
    turn_count       INTEGER NOT NULL DEFAULT 0,
    current_question TEXT,
    transcript_json  TEXT,
    started_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at     TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS interview_question_bank (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    track_id       UUID REFERENCES interview_tracks(id) ON DELETE CASCADE,
    user_job_id    UUID REFERENCES user_jobs(id) ON DELETE CASCADE,
    company        VARCHAR(255),
    role_title     VARCHAR(255),
    questions_json TEXT NOT NULL,
    generated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_interview_tracks_user_job ON interview_tracks(user_job_id);
CREATE INDEX IF NOT EXISTS idx_interview_sessions_user_job ON interview_sessions(user_job_id, user_id);
CREATE INDEX IF NOT EXISTS idx_interview_qbank_user_job ON interview_question_bank(user_job_id);
