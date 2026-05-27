-- V2 — Skill runs table

CREATE TABLE IF NOT EXISTS skill_runs (
    id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    skill       VARCHAR(100) NOT NULL,
    status      VARCHAR(50)  NOT NULL DEFAULT 'pending',
    result      JSONB,
    created_at  TIMESTAMP WITH TIME ZONE  NOT NULL DEFAULT now(),
    updated_at  TIMESTAMP WITH TIME ZONE  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_skill_runs_user_id ON skill_runs(user_id);
CREATE INDEX IF NOT EXISTS idx_skill_runs_skill   ON skill_runs(skill);
