-- V41 — Referral Outbox for reliable processing.
-- Task 3.011: Move referral handling to an outbox to ensure consistency and retries.

SET search_path TO careerops;

CREATE TABLE IF NOT EXISTS referral_outbox (
    id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    referee_email VARCHAR(255) NOT NULL,
    referee_name  VARCHAR(255) NOT NULL,
    processed     BOOLEAN      NOT NULL DEFAULT false,
    attempts      INT          NOT NULL DEFAULT 0,
    last_error    TEXT,
    created_at    TIMESTAMP WITH TIME ZONE  NOT NULL DEFAULT NOW(),
    processed_at  TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_referral_outbox_processed ON referral_outbox(processed);

