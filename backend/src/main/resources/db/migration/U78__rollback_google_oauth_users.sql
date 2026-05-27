SET search_path TO careerops;

DROP INDEX IF EXISTS idx_users_google_sub;

ALTER TABLE users DROP COLUMN IF EXISTS google_sub;
ALTER TABLE users DROP COLUMN IF EXISTS auth_provider;

-- Restore NOT NULL only when no passwordless rows remain (manual check in prod).
-- ALTER TABLE users ALTER COLUMN password_hash SET NOT NULL;

