SET search_path TO careerops;

CREATE TABLE IF NOT EXISTS application_cvs (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_job_id  UUID NOT NULL REFERENCES user_jobs(id) ON DELETE CASCADE,
    storage_path TEXT NOT NULL,
    file_name    VARCHAR(512),
    uploaded_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_application_cvs_user_job_id ON application_cvs(user_job_id);
