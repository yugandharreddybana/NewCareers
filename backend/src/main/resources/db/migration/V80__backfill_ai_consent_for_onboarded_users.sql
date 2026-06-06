-- Users who completed onboarding should already have consented; backfill any gaps.
SET search_path TO careerops;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = current_schema() AND table_name = 'users' AND column_name = 'ai_processing_consent'
    ) THEN
        RETURN;
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = current_schema() AND table_name = 'user_profiles' AND column_name = 'onboarded'
    ) THEN
        UPDATE users u
        SET ai_processing_consent = TRUE
        WHERE ai_processing_consent = FALSE
          AND EXISTS (
            SELECT 1 FROM user_profiles p
            WHERE p.user_id = u.id AND p.onboarded = TRUE
          );
    ELSIF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = current_schema() AND table_name = 'user_profiles' AND column_name = 'onboarding_delivery'
    ) THEN
        UPDATE users u
        SET ai_processing_consent = TRUE
        WHERE ai_processing_consent = FALSE
          AND EXISTS (
            SELECT 1 FROM user_profiles p
            WHERE p.user_id = u.id AND p.onboarding_delivery IS NOT NULL
          );
    END IF;
END $$;
