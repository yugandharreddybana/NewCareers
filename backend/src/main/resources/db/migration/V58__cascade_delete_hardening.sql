SET search_path TO career_operations;

-- V58 — Cascade delete hardening to ensure clean account deletion without referential integrity blockages.

-- 1. Hardening ai_token_usage foreign key
DO $$
BEGIN
    -- Drop existing foreign keys if they exist under standard naming conventions
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_schema = 'career_operations' AND table_name = 'ai_token_usage' AND constraint_name = 'ai_token_usage_user_id_fkey') THEN
        ALTER TABLE ai_token_usage DROP CONSTRAINT ai_token_usage_user_id_fkey;
    END IF;
    
    -- Ensure safe fallback execution
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_schema = 'career_operations' AND table_name = 'ai_token_usage' AND constraint_name = 'fk_ai_token_usage_user') THEN
        ALTER TABLE ai_token_usage ADD CONSTRAINT fk_ai_token_usage_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
    END IF;
END$$;

-- 2. Hardening org_invitations foreign key
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_schema = 'career_operations' AND table_name = 'org_invitations' AND constraint_name = 'org_invitations_invited_by_fkey') THEN
        ALTER TABLE org_invitations DROP CONSTRAINT org_invitations_invited_by_fkey;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_schema = 'career_operations' AND table_name = 'org_invitations' AND constraint_name = 'fk_org_invitations_inviter') THEN
        ALTER TABLE org_invitations ADD CONSTRAINT fk_org_invitations_inviter FOREIGN KEY (invited_by) REFERENCES users(id) ON DELETE CASCADE;
    END IF;
END$$;
