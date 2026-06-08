-- BILL-031: Explicit billing org preference for multi-org users.
SET search_path TO careerops;

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS primary_billing_organization_id UUID
        REFERENCES organizations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_users_primary_billing_org
    ON users (primary_billing_organization_id)
    WHERE primary_billing_organization_id IS NOT NULL;
