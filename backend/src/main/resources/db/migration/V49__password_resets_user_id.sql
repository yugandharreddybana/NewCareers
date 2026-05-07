-- V49__password_resets_user_id.sql
ALTER TABLE career_operations.password_resets
ADD COLUMN user_id UUID;

-- Set user_id for existing records based on email lookup
UPDATE career_operations.password_resets pr
SET user_id = u.id
FROM career_operations.users u
WHERE pr.email = u.email;

-- Make user_id NOT NULL now that existing records have been populated
ALTER TABLE career_operations.password_resets
ALTER COLUMN user_id SET NOT NULL;
