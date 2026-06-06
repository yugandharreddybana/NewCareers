ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS work_types text[];
