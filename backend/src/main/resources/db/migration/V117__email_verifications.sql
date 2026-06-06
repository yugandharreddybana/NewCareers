SET search_path TO careerops;

CREATE TABLE email_verifications (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email               VARCHAR(254) NOT NULL,
  otp_hash            VARCHAR(64) NOT NULL,
  expires_at          TIMESTAMPTZ NOT NULL,
  attempts            INT NOT NULL DEFAULT 0,
  resend_count        INT NOT NULL DEFAULT 0,
  last_sent_at        TIMESTAMPTZ NOT NULL,
  otp_verified_at     TIMESTAMPTZ,
  captcha_verified_at TIMESTAMPTZ,
  consumed_at         TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  version             BIGINT NOT NULL DEFAULT 0
);

CREATE INDEX idx_email_verifications_email_active
  ON email_verifications (email)
  WHERE consumed_at IS NULL;
