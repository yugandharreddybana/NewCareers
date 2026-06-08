-- Server-side signup intent: stores bcrypt password hash during onboarding (no client persistence).
CREATE TABLE IF NOT EXISTS careerops.signup_intents (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email           VARCHAR(254) NOT NULL,
    password_hash   VARCHAR(255) NOT NULL,
    name            VARCHAR(100),
    terms_accepted  BOOLEAN NOT NULL DEFAULT FALSE,
    ai_processing_accepted BOOLEAN NOT NULL DEFAULT FALSE,
    marketing_accepted BOOLEAN NOT NULL DEFAULT FALSE,
    analytics_accepted BOOLEAN NOT NULL DEFAULT FALSE,
    consumed_at     TIMESTAMPTZ,
    expires_at      TIMESTAMPTZ NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_signup_intents_email ON careerops.signup_intents (email);
CREATE INDEX IF NOT EXISTS idx_signup_intents_expires ON careerops.signup_intents (expires_at);
