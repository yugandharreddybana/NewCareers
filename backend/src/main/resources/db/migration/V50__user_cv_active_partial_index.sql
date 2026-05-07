-- V50 — Enforce only one active CV per user at the database level
SET search_path TO career_operations;

CREATE UNIQUE INDEX IF NOT EXISTS idx_cv_documents_user_active_uniq
    ON cv_documents (user_id)
    WHERE is_active = TRUE;
