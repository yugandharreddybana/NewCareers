-- Section 10 — Task 104
-- Profile Enhancements: portfolio_items JSONB + career goal fields

ALTER TABLE career_operations.user_profiles
    ADD COLUMN IF NOT EXISTS portfolio_items  JSONB           NOT NULL DEFAULT '[]',
    ADD COLUMN IF NOT EXISTS goal_title       VARCHAR(200),
    ADD COLUMN IF NOT EXISTS goal_salary_min  INTEGER,
    ADD COLUMN IF NOT EXISTS goal_salary_max  INTEGER,
    ADD COLUMN IF NOT EXISTS goal_location    VARCHAR(100),
    ADD COLUMN IF NOT EXISTS open_to_remote   BOOLEAN         NOT NULL DEFAULT TRUE;

COMMENT ON COLUMN career_operations.user_profiles.portfolio_items IS
    'JSON array of {id,title,url,description,techTags[]} portfolio project objects';
COMMENT ON COLUMN career_operations.user_profiles.goal_title IS
    'Career goal: desired job title';
COMMENT ON COLUMN career_operations.user_profiles.goal_salary_min IS
    'Career goal: minimum target salary (annual, EUR)';
COMMENT ON COLUMN career_operations.user_profiles.goal_salary_max IS
    'Career goal: maximum target salary (annual, EUR)';
COMMENT ON COLUMN career_operations.user_profiles.goal_location IS
    'Career goal: preferred job location';
COMMENT ON COLUMN career_operations.user_profiles.open_to_remote IS
    'Career goal: user is open to fully-remote roles';
