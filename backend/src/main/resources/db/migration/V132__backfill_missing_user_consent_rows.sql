SET search_path TO careerops;

INSERT INTO user_consents (user_id, consent_type, version, accepted, accepted_at)
SELECT u.id, 'ESSENTIAL', 'v1.0', TRUE, COALESCE(u.created_at, now())
FROM users u
WHERE u.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM user_consents c
    WHERE c.user_id = u.id AND c.consent_type = 'ESSENTIAL'
  );

INSERT INTO user_consents (user_id, consent_type, version, accepted, accepted_at)
SELECT u.id, 'AI_PROCESSING', 'v1.0', u.ai_processing_consent, COALESCE(u.created_at, now())
FROM users u
WHERE u.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM user_consents c
    WHERE c.user_id = u.id AND c.consent_type = 'AI_PROCESSING'
  );
