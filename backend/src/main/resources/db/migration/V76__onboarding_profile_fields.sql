-- Onboarding: work history, education, experience level, remote/hybrid prefs
SET search_path TO careerops;

ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS experience_level VARCHAR(32);
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS work_experience JSONB NOT NULL DEFAULT '[]';
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS education JSONB NOT NULL DEFAULT '[]';
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS remote_policy VARCHAR(32);
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS hybrid_onsite_days VARCHAR(64);

COMMENT ON COLUMN user_profiles.experience_level IS
    'Career seniority band: junior, mid, senior, lead';
COMMENT ON COLUMN user_profiles.work_experience IS
    'Array of { jobTitle, companyName, startDate, endDate, current, description }';
COMMENT ON COLUMN user_profiles.education IS
    'Array of { schoolName, degree, fieldOfStudy, graduationYear }';
COMMENT ON COLUMN user_profiles.remote_policy IS
    'Remote | Hybrid | On-site preference from onboarding';
COMMENT ON COLUMN user_profiles.hybrid_onsite_days IS
    'Max on-site days per week when remote_policy is Hybrid';
