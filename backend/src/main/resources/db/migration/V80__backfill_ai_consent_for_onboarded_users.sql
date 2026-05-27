-- Users who completed onboarding should already have consented; backfill any gaps.
UPDATE users u
SET ai_processing_consent = TRUE
WHERE ai_processing_consent = FALSE
  AND EXISTS (
    SELECT 1 FROM user_profiles p
    WHERE p.user_id = u.id AND p.onboarded = TRUE
  );
