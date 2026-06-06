CREATE TABLE careerops.user_keys (
    user_id        UUID PRIMARY KEY,
    encrypted_dek  TEXT NOT NULL,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
