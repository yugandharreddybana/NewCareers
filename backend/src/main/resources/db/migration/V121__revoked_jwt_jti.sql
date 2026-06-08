SET search_path TO careerops;

CREATE TABLE IF NOT EXISTS revoked_jwt_jti (
    jti         VARCHAR(64) PRIMARY KEY,
    expires_at  TIMESTAMPTZ NOT NULL,
    revoked_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_revoked_jwt_jti_expires_at ON revoked_jwt_jti (expires_at);
