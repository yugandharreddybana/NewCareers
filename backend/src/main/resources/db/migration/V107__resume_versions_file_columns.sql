SET search_path TO careerops;

ALTER TABLE resume_versions ADD COLUMN IF NOT EXISTS storage_path VARCHAR(500);
ALTER TABLE resume_versions ADD COLUMN IF NOT EXISTS file_name VARCHAR(255);
