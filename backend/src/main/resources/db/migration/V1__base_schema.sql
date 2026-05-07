CREATE SCHEMA IF NOT EXISTS career_operations;
SET search_path TO career_operations;

-- V1 — Base schema: users, jobs, user_jobs
-- Created retroactively so the DB can be rebuilt from scratch.
-- All columns here reflect the state BEFORE any V5+ migrations ran.

CREATE TABLE IF NOT EXISTS users (
    id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    email         VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255),
    name          VARCHAR(255),
    role          VARCHAR(50)  NOT NULL DEFAULT 'USER',
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS jobs (
    id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    title        VARCHAR(255) NOT NULL,
    company      VARCHAR(255),
    location     VARCHAR(255),
    description  TEXT,
    url          VARCHAR(1000),
    source       VARCHAR(100),
    posted_at    TIMESTAMPTZ,
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_jobs (
    id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id        UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    job_id         UUID        NOT NULL REFERENCES jobs(id)  ON DELETE CASCADE,
    kanban_column  VARCHAR(50) NOT NULL DEFAULT 'Discovered',
    match_percent  SMALLINT,
    notes          TEXT,
    delivered_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, job_id)
);

CREATE INDEX IF NOT EXISTS idx_user_jobs_user_id    ON user_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_user_jobs_job_id     ON user_jobs(job_id);
CREATE INDEX IF NOT EXISTS idx_users_email          ON users(email);
