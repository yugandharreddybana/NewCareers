SET search_path TO careerops;

ALTER TABLE refresh_tokens
    ADD COLUMN IF NOT EXISTS token_family_id UUID,
    ADD COLUMN IF NOT EXISTS consumed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_family_id ON refresh_tokens (token_family_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_consumed_hash ON refresh_tokens (token_hash) WHERE consumed_at IS NOT NULL;
