-- GDPR Phase 2: AI_PROCESSING consent type + backfill existing users
SET search_path TO careerops;

-- Extend consent_type CHECK to include AI_PROCESSING
ALTER TABLE user_consents DROP CONSTRAINT IF EXISTS user_consents_consent_type_check;
ALTER TABLE user_consents ADD CONSTRAINT user_consents_consent_type_check
    CHECK (consent_type IN ('ESSENTIAL', 'AI_PROCESSING', 'MARKETING', 'ANALYTICS'));

-- Backfill ESSENTIAL v1.0 for active users without a row
INSERT INTO user_consents (user_id, consent_type, version, accepted, accepted_at)
SELECT u.id, 'ESSENTIAL', 'v1.0', TRUE, COALESCE(u.created_at, now())
FROM users u
WHERE u.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM user_consents c
    WHERE c.user_id = u.id AND c.consent_type = 'ESSENTIAL'
  );

-- Backfill AI_PROCESSING from legacy column (do not opt-in MARKETING/ANALYTICS)
INSERT INTO user_consents (user_id, consent_type, version, accepted, accepted_at)
SELECT u.id, 'AI_PROCESSING', 'v1.0', u.ai_processing_consent, COALESCE(u.created_at, now())
FROM users u
WHERE u.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM user_consents c
    WHERE c.user_id = u.id AND c.consent_type = 'AI_PROCESSING'
  );

COMMENT ON COLUMN users.ai_processing_consent IS
    'DEPRECATED: authoritative source is user_consents.consent_type=AI_PROCESSING. Do not write.';
