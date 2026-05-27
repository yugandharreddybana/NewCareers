SET search_path TO careerops;

ALTER TABLE password_resets ADD COLUMN IF NOT EXISTS user_id UUID;

UPDATE password_resets pr
SET user_id = u.id
FROM users u
WHERE pr.email = u.email;

ALTER TABLE password_resets ALTER COLUMN user_id SET NOT NULL;
