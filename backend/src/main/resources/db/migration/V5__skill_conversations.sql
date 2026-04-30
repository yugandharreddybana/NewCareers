-- ============================================================
-- V5: skill_conversations
-- Stores paused Claude agentic conversations when ask_user fires.
-- Each row is one "waiting for user answer" state.
-- ============================================================
CREATE TABLE IF NOT EXISTS career_operations.skill_conversations (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      UUID        NOT NULL,
    user_job_id  UUID,                                          -- null for triage / compare
    skill        TEXT        NOT NULL,
    -- Full Claude messages array snapshot (role/content pairs)
    -- Stored as JSONB so we can resume the exact conversation
    messages     JSONB       NOT NULL DEFAULT '[]'::jsonb,
    -- Status lifecycle: pending_answer → completed | expired | error
    status       TEXT        NOT NULL DEFAULT 'pending_answer'
                             CHECK (status IN ('pending_answer','completed','expired','error')),
    -- The exact question Claude asked via ask_user tool
    question     TEXT,
    -- Claude's tool_use_id for the ask_user call (required to send tool_result back)
    tool_use_id  TEXT,
    -- Conversation expires after 30 min of inactivity (configurable)
    expires_at   TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '30 minutes'),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Fast lookup: find pending conversation for a user
CREATE INDEX IF NOT EXISTS idx_skill_conv_user_status
    ON career_operations.skill_conversations (user_id, status);

-- Cleanup index: find expired rows efficiently
CREATE INDEX IF NOT EXISTS idx_skill_conv_expires
    ON career_operations.skill_conversations (expires_at)
    WHERE status = 'pending_answer';

-- Ensure only ONE pending conversation per user+skill at a time
-- (prevents double-clicking skill button from creating duplicate states)
CREATE UNIQUE INDEX IF NOT EXISTS idx_skill_conv_unique_pending
    ON career_operations.skill_conversations (user_id, skill, user_job_id)
    WHERE status = 'pending_answer';

COMMENT ON TABLE career_operations.skill_conversations IS
    'Paused Claude agentic conversations waiting for user input via ask_user tool';
COMMENT ON COLUMN career_operations.skill_conversations.messages IS
    'Full Claude API messages array — role+content pairs serialised as JSONB for exact resumption';
COMMENT ON COLUMN career_operations.skill_conversations.tool_use_id IS
    'Claude tool_use_id for the pending ask_user call — used to send tool_result on resumption';
