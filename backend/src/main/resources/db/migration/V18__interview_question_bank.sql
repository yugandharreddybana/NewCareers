-- Phase 3 Batch 1.1 - Task 3
-- Stores generated question sets by company, role, and skill area
-- Skipped when V9__interview_command_center already created interview_question_bank.

SET search_path TO careerops;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = current_schema() AND table_name = 'interview_question_bank'
    ) THEN
        RETURN;
    END IF;

    CREATE TABLE interview_question_bank (
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

    CREATE INDEX idx_iqb_track_id ON interview_question_bank(interview_track_id);
    CREATE INDEX idx_iqb_session_id ON interview_question_bank(session_id);
END $$;
