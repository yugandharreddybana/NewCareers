SET search_path TO career_operations;

ALTER TABLE org_invitations
ADD COLUMN IF NOT EXISTS token_hash VARCHAR(128);

UPDATE org_invitations
SET token_hash = encode(digest(token, 'sha256'), 'hex')
WHERE token_hash IS NULL AND token IS NOT NULL;

ALTER TABLE org_invitations
ALTER COLUMN token_hash SET NOT NULL;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM pg_indexes
        WHERE schemaname = 'career_operations'
          AND tablename = 'org_invitations'
          AND indexname = 'idx_org_invitations_token'
    ) THEN
        DROP INDEX idx_org_invitations_token;
    END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_org_invitations_token_hash
    ON org_invitations(token_hash);

ALTER TABLE org_invitations
DROP COLUMN IF EXISTS token;