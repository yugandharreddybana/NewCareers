-- Phase 1: Skill Conversations table
-- Stores paused Claude agentic skill runs awaiting user input via ask_user tool.
-- A row is created when Claude calls ask_user mid-skill and deleted after 30 min or on completion.

CREATE TABLE IF NOT EXISTS career_operations.skill_conversations (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      UUID        NOT NULL,
    user_job_id  UUID,
    skill        TEXT        NOT NULL,

    -- Full Claude messages array (system + user + assistant turns) needed to resume.
    -- Never exposed via API directly.
    messages     JSONB       NOT NULL DEFAULT '[]'::jsonb,

    status       TEXT        NOT NULL DEFAULT 'pending_answer'
                             CHECK (status IN ('pending_answer', 'completed', 'error')),

    -- The question Claude asked the user via the ask_user tool.
    question     TEXT,

    -- The Claude tool_use_id for the pending ask_user call.
    -- Required to correctly resume the conversation by appending a tool_result.
    tool_use_id  TEXT,

    -- Conversations expire 30 minutes after creation if not answered.
    expires_at   TIMESTAMPTZ,

    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Fast lookup for pending conversations per user
CREATE INDEX IF NOT EXISTS idx_skill_conv_user_status
    ON career_operations.skill_conversations(user_id, status);

-- Efficient cleanup of expired conversations by the cleanup cron job
CREATE INDEX IF NOT EXISTS idx_skill_conv_expires
    ON career_operations.skill_conversations(expires_at)
    WHERE expires_at IS NOT NULL;

COMMENT ON TABLE  career_operations.skill_conversations IS
    'Paused Claude agentic skill runs awaiting user input. Rows expire after 30 minutes.';
COMMENT ON COLUMN career_operations.skill_conversations.messages IS
    'Full Claude Messages API conversation history array stored as JSONB. Used to resume exactly where Claude paused.';
COMMENT ON COLUMN career_operations.skill_conversations.tool_use_id IS
    'Claude tool_use_id of the pending ask_user call. Must be included in the tool_result when resuming.';
COMMENT ON COLUMN career_operations.skill_conversations.expires_at IS
    'Conversation becomes invalid after this timestamp. Set to now() + 30 minutes on creation.';
