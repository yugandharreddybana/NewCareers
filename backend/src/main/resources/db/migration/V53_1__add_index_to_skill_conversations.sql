CREATE INDEX IF NOT EXISTS idx_skill_conv_user_skill_status
    ON skill_conversations (user_id, skill, status);
