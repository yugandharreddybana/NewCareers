-- V3 — CV documents table

CREATE TABLE IF NOT EXISTS cv_documents (
    id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    file_name     VARCHAR(500) NOT NULL,
    storage_path  VARCHAR(1000),
    file_type     VARCHAR(100),
    parsed_text   TEXT,
    is_active     BOOLEAN      NOT NULL DEFAULT false,
    uploaded_at   TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cv_documents_user_id ON cv_documents(user_id);
