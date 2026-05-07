-- V43: AI Processing Consent (GDPR compliance - 3.081)
ALTER TABLE career_operations.users
ADD COLUMN ai_processing_consent BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN career_operations.users.ai_processing_consent IS 'Explicit user consent for CV/PII processing by third-party AI vendors (Anthropic, Google).';
