-- Phase 3 Batch 1.1 - Task 3
-- Stores generated question sets by company, role, and skill area

CREATE TABLE IF NOT EXISTS interview_question_bank (
    id BIGSERIAL PRIMARY KEY,
    interview_track_id BIGINT NOT NULL REFERENCES interview_tracks(id) ON DELETE CASCADE,
    session_id BIGINT REFERENCES interview_sessions(id) ON DELETE SET NULL,
    company_name VARCHAR(255),
    role_title VARCHAR(255),
    skill_area VARCHAR(255),
    question TEXT NOT NULL,
    expected_answer TEXT,
    user_answer TEXT,
    score INTEGER,
    ai_feedback TEXT,
    question_type VARCHAR(100) DEFAULT 'BEHAVIORAL',
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_iqb_track_id ON interview_question_bank(interview_track_id);
CREATE INDEX IF NOT EXISTS idx_iqb_session_id ON interview_question_bank(session_id);
