SET search_path TO careerops;

ALTER TABLE interview_tracks ADD COLUMN IF NOT EXISTS reminder_sent BOOLEAN DEFAULT FALSE NOT NULL;
