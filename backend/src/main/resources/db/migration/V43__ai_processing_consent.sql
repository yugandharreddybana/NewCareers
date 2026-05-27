-- V43: AI Processing Consent (GDPR compliance - 3.081)
SET search_path TO careerops;

ALTER TABLE users ADD COLUMN IF NOT EXISTS ai_processing_consent BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN users.ai_processing_consent IS 'Explicit user consent for CV/PII processing by third-party AI vendors (Anthropic, Google).';
