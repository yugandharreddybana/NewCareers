-- V4 — User profiles table

CREATE TABLE IF NOT EXISTS user_profiles (
    id              UUID  PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID  NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    headline        VARCHAR(255),
    bio             TEXT,
    location        VARCHAR(255),
    linkedin_url    VARCHAR(500),
    github_url      VARCHAR(500),
    website_url     VARCHAR(500),
    avatar_url      VARCHAR(1000),
    skills          TEXT[],
    open_to_work    BOOLEAN NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
