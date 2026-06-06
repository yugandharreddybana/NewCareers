-- Append-only GDPR consent trail (ESSENTIAL / MARKETING / ANALYTICS)
SET search_path TO careerops;

CREATE TABLE IF NOT EXISTS user_consents (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    consent_type VARCHAR(32) NOT NULL CHECK (consent_type IN ('ESSENTIAL', 'MARKETING', 'ANALYTICS')),
    version      VARCHAR(32) NOT NULL,
    accepted     BOOLEAN NOT NULL DEFAULT TRUE,
    accepted_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    ip_address   VARCHAR(64),
    user_agent   TEXT
);

CREATE INDEX IF NOT EXISTS idx_user_consents_user_type_accepted_at
    ON user_consents (user_id, consent_type, accepted_at DESC);
