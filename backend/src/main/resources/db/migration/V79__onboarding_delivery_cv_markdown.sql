-- Track A: canonical CV markdown (GitHub cv.md parity) + onboarding job-delivery progress
SET search_path TO careerops;

ALTER TABLE user_cvs
    ADD COLUMN IF NOT EXISTS cv_markdown TEXT;

COMMENT ON COLUMN user_cvs.cv_markdown IS 'Structured markdown CV used by evaluate/delivery (Career-Ops cv.md style)';

ALTER TABLE user_profiles
    ADD COLUMN IF NOT EXISTS onboarding_delivery JSONB;

COMMENT ON COLUMN user_profiles.onboarding_delivery IS 'First-run delivery progress: stage, counts, message, error';

