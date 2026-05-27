-- Task 114: Audit logs table
SET search_path TO careerops;

CREATE TABLE IF NOT EXISTS audit_logs (
    id            UUID         DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id       UUID         REFERENCES users(id) ON DELETE SET NULL,
    action        VARCHAR(100) NOT NULL,
    ip_address    VARCHAR(45),
    user_agent    TEXT,
    metadata      JSONB        DEFAULT '{}',
    created_at    TIMESTAMP WITH TIME ZONE  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id    ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action     ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);

