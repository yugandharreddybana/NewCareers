-- Google OAuth: link Google accounts to users; allow passwordless Google-only users.
SET search_path TO careerops;

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS auth_provider VARCHAR(20) NOT NULL DEFAULT 'LOCAL';

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS google_sub VARCHAR(255);

ALTER TABLE users
    ALTER COLUMN password_hash DROP NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_google_sub
    ON users (google_sub);

COMMENT ON COLUMN users.auth_provider IS 'LOCAL = email/password; GOOGLE = Google Sign-In';
COMMENT ON COLUMN users.google_sub IS 'Google account subject (sub) from OIDC ID token';

