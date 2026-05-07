SET search_path TO career_operations;

-- 10.068 — Optimize active password resets lookup
CREATE INDEX IF NOT EXISTS idx_password_resets_email_active ON password_resets(email) WHERE used = false;
