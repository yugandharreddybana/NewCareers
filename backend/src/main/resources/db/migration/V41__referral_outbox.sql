-- V41 — Referral Outbox for reliable processing.
-- Task 3.011: Move referral handling to an outbox to ensure consistency and retries.

SET search_path TO career_operations;

CREATE TABLE IF NOT EXISTS referral_outbox (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    referee_email VARCHAR(255) NOT NULL,
    referee_name  VARCHAR(255) NOT NULL,
    processed     BOOLEAN      NOT NULL DEFAULT false,
    attempts      INT          NOT NULL DEFAULT 0,
    last_error    TEXT,
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    processed_at  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_referral_outbox_processed ON referral_outbox(processed) WHERE processed = false;
