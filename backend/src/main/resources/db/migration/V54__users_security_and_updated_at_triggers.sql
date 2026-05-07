SET search_path TO career_operations;

-- V54 — Security hardening and updated_at database triggers.

-- 1. Increase password_hash column limit for future-proofing hashing upgrades (Argon2id)
ALTER TABLE users ALTER COLUMN password_hash TYPE VARCHAR(512);

-- 2. Drop duplicate index on email since email already has a UNIQUE constraint auto-index
DROP INDEX IF EXISTS idx_users_email;

-- 3. Generic set_updated_at trigger function
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Apply set_updated_at trigger to users table
DROP TRIGGER IF EXISTS trg_users_updated_at ON users;
CREATE TRIGGER trg_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();

-- 5. Apply set_updated_at trigger to user_jobs table
DROP TRIGGER IF EXISTS trg_user_jobs_updated_at ON user_jobs;
CREATE TRIGGER trg_user_jobs_updated_at
    BEFORE UPDATE ON user_jobs
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();
