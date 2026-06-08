-- Ensure legacy V4 social URL columns exist for JPA mapping
SET search_path TO careerops;

ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS linkedin_url TEXT;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS github_url TEXT;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS website_url TEXT;
