-- V40 — Password Reset and OTP Hardening.
-- 
-- Task 3.004: Rate limit OTP requests.
-- Task 3.005: 8-char alphanumeric OTP + attempt cap.

SET search_path TO careerops;

CREATE TABLE IF NOT EXISTS password_resets (
    id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    email       VARCHAR(255) NOT NULL,
    otp_hash    VARCHAR(255) NOT NULL,
    attempts    INT NOT NULL DEFAULT 0,
    used        BOOLEAN NOT NULL DEFAULT false,
    expires_at  TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    version     BIGINT NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_password_resets_email ON password_resets(email);
CREATE INDEX IF NOT EXISTS idx_password_resets_created ON password_resets(created_at DESC);

