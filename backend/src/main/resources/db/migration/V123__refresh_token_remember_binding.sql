SET search_path TO careerops;

ALTER TABLE refresh_tokens
    ADD COLUMN IF NOT EXISTS remember_me BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS binding_hash VARCHAR(64);
