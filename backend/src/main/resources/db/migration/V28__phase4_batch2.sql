-- ─────────────────────────────────────────────────────────────────────────────
-- Phase 4 Batch 2 — Auto-Apply Assistant
-- 4.2 Tasks 17–36
-- ─────────────────────────────────────────────────────────────────────────────

-- 4.2 Task 21 — answer_bank (reusable application answers)
CREATE TABLE IF NOT EXISTS answer_bank (
  id               UUID         DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id          UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  question_key     VARCHAR(100) NOT NULL,  -- e.g. 'work_authorization', 'salary_expectation'
  answer_text      TEXT         NOT NULL,
  is_default       BOOLEAN      NOT NULL DEFAULT true,
  created_at       TIMESTAMP WITH TIME ZONE  NOT NULL DEFAULT now(),
  updated_at       TIMESTAMP WITH TIME ZONE  NOT NULL DEFAULT now(),
  UNIQUE (user_id, question_key)
);

CREATE INDEX IF NOT EXISTS idx_answer_bank_user ON answer_bank(user_id);

-- 4.2 Task 17 — application_runs
CREATE TABLE IF NOT EXISTS application_runs (
  id               UUID         DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id          UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_job_id      UUID         NOT NULL REFERENCES user_jobs(id) ON DELETE CASCADE,
  status           VARCHAR(30)  NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending','in_progress','awaiting_approval','completed','failed','cancelled')),
  total_steps      SMALLINT     NOT NULL DEFAULT 0,
  completed_steps  SMALLINT     NOT NULL DEFAULT 0,
  error_message    TEXT,
  resume_version_id UUID,
  approved_at      TIMESTAMP WITH TIME ZONE,
  submitted_at     TIMESTAMP WITH TIME ZONE,
  created_at       TIMESTAMP WITH TIME ZONE  NOT NULL DEFAULT now(),
  updated_at       TIMESTAMP WITH TIME ZONE  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_app_runs_user    ON application_runs(user_id);
CREATE INDEX IF NOT EXISTS idx_app_runs_job     ON application_runs(user_job_id);
CREATE INDEX IF NOT EXISTS idx_app_runs_status  ON application_runs(user_id, status);

-- 4.2 Task 18 — application_run_steps
CREATE TABLE IF NOT EXISTS application_run_steps (
  id               UUID         DEFAULT gen_random_uuid() PRIMARY KEY,
  run_id           UUID         NOT NULL REFERENCES application_runs(id) ON DELETE CASCADE,
  user_id          UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  step_number      SMALLINT     NOT NULL,
  step_type        VARCHAR(50)  NOT NULL,  -- 'prefill', 'cv_upload', 'answer_question', 'approval_gate', 'submit'
  description      TEXT         NOT NULL,
  status           VARCHAR(20)  NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending','in_progress','completed','failed','skipped')),
  input_data       JSONB,
  output_data      JSONB,
  error_message    TEXT,
  executed_at      TIMESTAMP WITH TIME ZONE,
  created_at       TIMESTAMP WITH TIME ZONE  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_run_steps_run    ON application_run_steps(run_id);
CREATE INDEX IF NOT EXISTS idx_run_steps_user   ON application_run_steps(user_id);
