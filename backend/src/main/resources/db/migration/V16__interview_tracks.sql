-- Phase 3 Batch 1.1 - Task 1
-- Stores interview stage timelines per job
-- Skipped when V9__interview_command_center already created interview_tracks (UUID schema).

SET search_path TO careerops;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = current_schema() AND table_name = 'interview_tracks'
    ) THEN
        RETURN;
    END IF;

    CREATE TABLE interview_tracks (
        id BIGSERIAL PRIMARY KEY,
        user_job_id BIGINT NOT NULL REFERENCES user_jobs(id) ON DELETE CASCADE,
        user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        company_name VARCHAR(255),
        role_title VARCHAR(255),
        current_stage VARCHAR(100) NOT NULL DEFAULT 'APPLIED',
        interview_date TIMESTAMP,
        notes TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    );

    CREATE INDEX idx_interview_tracks_user_job_id ON interview_tracks(user_job_id);
    CREATE INDEX idx_interview_tracks_user_id ON interview_tracks(user_id);
END $$;
