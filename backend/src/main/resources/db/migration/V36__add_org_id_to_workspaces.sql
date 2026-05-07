-- V36: Link workspaces to organizations for quota enforcement
SET search_path TO career_operations;

ALTER TABLE shared_workspaces 
ADD COLUMN org_id UUID REFERENCES organizations(id) ON DELETE SET NULL;

-- Backfill: Assign existing workspaces to their owner's primary organization
UPDATE shared_workspaces ws
SET org_id = (
    SELECT org_id 
    FROM org_members 
    WHERE user_id = ws.owner_id 
    AND role = 'owner' 
    LIMIT 1
)
WHERE org_id IS NULL;
