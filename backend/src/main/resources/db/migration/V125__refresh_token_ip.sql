ALTER TABLE careerops.refresh_tokens
    ADD COLUMN IF NOT EXISTS ip_address VARCHAR(45);
