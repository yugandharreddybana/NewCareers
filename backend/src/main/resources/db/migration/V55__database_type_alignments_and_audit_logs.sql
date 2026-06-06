SET search_path TO careerops;

-- V55 — Database type alignments and audit_logs pluralization.

-- 1. Align match_percent type with JPA Integer representation
ALTER TABLE user_jobs ALTER COLUMN match_percent TYPE INTEGER;

-- 2. Rename audit_log (singular) to audit_logs (plural) for JPA alignment
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'careerops' AND table_name = 'audit_log')
       AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'careerops' AND table_name = 'audit_logs') THEN
        ALTER TABLE audit_log RENAME TO audit_logs;
        -- Rename corresponding indices to maintain clean naming structures
        ALTER INDEX IF EXISTS idx_audit_log_user RENAME TO idx_audit_logs_user;
        ALTER INDEX IF EXISTS idx_audit_log_org RENAME TO idx_audit_logs_org;
        ALTER INDEX IF EXISTS idx_audit_log_action RENAME TO idx_audit_logs_action;
        ALTER INDEX IF EXISTS idx_audit_log_created RENAME TO idx_audit_logs_created;
    END IF;
END$$;

