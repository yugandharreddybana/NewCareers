CREATE TABLE IF NOT EXISTS careerops.user_two_factor (
    user_id UUID PRIMARY KEY REFERENCES careerops.users(id) ON DELETE CASCADE,
    secret_encrypted TEXT,
    pending_secret_encrypted TEXT,
    enabled_at TIMESTAMPTZ,
    backup_codes_hash JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
