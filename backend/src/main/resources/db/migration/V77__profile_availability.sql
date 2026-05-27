SET search_path TO careerops;

ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS availability VARCHAR(64);

COMMENT ON COLUMN user_profiles.availability IS
    'Notice period / start availability from onboarding (e.g. 2 weeks notice)';
