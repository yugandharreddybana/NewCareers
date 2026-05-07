-- Section 3.6 Task 78 — AB test framework tables

CREATE TABLE IF NOT EXISTS experiments (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  experiment_key VARCHAR(100) NOT NULL UNIQUE,  -- e.g. 'onboarding_cta_v2'
  name         VARCHAR(255) NOT NULL,
  description  TEXT,
  status       VARCHAR(50) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','paused','completed')),
  variants     JSONB NOT NULL DEFAULT '["control","variant_a"]',
  traffic_pct  SMALLINT NOT NULL DEFAULT 100 CHECK (traffic_pct BETWEEN 0 AND 100),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS experiment_assignments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  experiment_id   UUID NOT NULL REFERENCES experiments(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  variant         VARCHAR(100) NOT NULL,
  assigned_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (experiment_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_exp_assignments_user ON experiment_assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_exp_assignments_exp  ON experiment_assignments(experiment_id);

-- Section 3.6 Task 69 — onboarding analytics events table
CREATE TABLE IF NOT EXISTS onboarding_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  step        VARCHAR(100) NOT NULL CHECK (step IN ('profile_complete', 'first_job_saved', 'first_skill_run', 'planner_viewed', 'first_application')),
  event_type  VARCHAR(50)  NOT NULL CHECK (event_type IN ('started', 'completed', 'dropped')),
  metadata    JSONB,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_onboarding_events_user ON onboarding_events(user_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_events_step ON onboarding_events(step, event_type);

-- Section 3.6 Task 70 — feature adoption events
CREATE TABLE IF NOT EXISTS feature_adoption_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  feature     VARCHAR(100) NOT NULL,  -- 'cover_letter', 'mock_interview', 'planner', etc.
  action      VARCHAR(100) NOT NULL,  -- 'viewed', 'first_use', 'repeat_use'
  metadata    JSONB,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_feat_adoption_user    ON feature_adoption_events(user_id);
CREATE INDEX IF NOT EXISTS idx_feat_adoption_feature ON feature_adoption_events(feature, action);
