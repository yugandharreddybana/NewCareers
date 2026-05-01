-- Phase 3 Batch 1.1 - Task 2
-- Stores mock interview runs, timestamps, mode, and score

CREATE TABLE IF NOT EXISTS interview_sessions (
    id BIGSERIAL PRIMARY KEY,
    interview_track_id BIGINT NOT NULL REFERENCES interview_tracks(id) ON DELETE CASCADE,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    mode VARCHAR(50) NOT NULL DEFAULT 'TEXT',
    overall_score INTEGER,
    feedback_summary TEXT,
    started_at TIMESTAMP NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_interview_sessions_track_id ON interview_sessions(interview_track_id);
CREATE INDEX IF NOT EXISTS idx_interview_sessions_user_id ON interview_sessions(user_id);
