-- Section 10 — Task 104
-- Profile Enhancements: portfolio, career goal fields, open_to_remote

ALTER TABLE career_operations.user_profiles
    ADD COLUMN IF NOT EXISTS portfolio_items  JSONB        NOT NULL DEFAULT '[]',
    ADD COLUMN IF NOT EXISTS goal_title       VARCHAR(200),
    ADD COLUMN IF NOT EXISTS goal_salary_min  INTEGER,
    ADD COLUMN IF NOT EXISTS goal_salary_max  INTEGER,
    ADD COLUMN IF NOT EXISTS goal_location    VARCHAR(100),
    ADD COLUMN IF NOT EXISTS open_to_remote   BOOLEAN      NOT NULL DEFAULT true;

COMMENT ON COLUMN career_operations.user_profiles.portfolio_items IS
    'JSON array of {id,title,url,description,techTags[]} objects';
COMMENT ON COLUMN career_operations.user_profiles.goal_title IS
    'Target job title the user is aiming for';
COMMENT ON COLUMN career_operations.user_profiles.goal_salary_min IS
    'Lower bound of desired salary range (EUR)';
COMMENT ON COLUMN career_operations.user_profiles.goal_salary_max IS
    'Upper bound of desired salary range (EUR)';
COMMENT ON COLUMN career_operations.user_profiles.goal_location IS
    'Preferred city/region for the target role';
COMMENT ON COLUMN career_operations.user_profiles.open_to_remote IS
    'Whether the user is open to fully-remote positions';
