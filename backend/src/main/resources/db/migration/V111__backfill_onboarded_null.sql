-- Users who completed onboarding before the onboarded column existed were left NULL
-- and were incorrectly sent back through /onboarding on every sign-in.
SET search_path TO careerops;

UPDATE user_profiles p
SET onboarded = TRUE
WHERE onboarded IS NULL
  AND (
    (target_roles IS NOT NULL AND cardinality(target_roles) > 0)
    OR (goal_title IS NOT NULL AND btrim(goal_title) <> '')
    OR EXISTS (
        SELECT 1 FROM user_cvs cv
        WHERE cv.user_id = p.user_id
    )
    OR EXISTS (
        SELECT 1 FROM user_jobs uj
        WHERE uj.user_id = p.user_id AND uj.deleted_at IS NULL
    )
  );
