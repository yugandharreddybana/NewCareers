-- Phase 6.3 Reliability + 6.5 Security tables
SET search_path TO careerops;

-- ── Audit Log (6.5) ────────────────────────────────────────────────────────
CREATE TABLE audit_log (
    id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id         UUID         REFERENCES users(id),
    org_id          UUID         REFERENCES organizations(id),
    action          VARCHAR(100) NOT NULL,   -- e.g. user.login, job.delete, org.invite
    resource_type   VARCHAR(100),
    resource_id     VARCHAR(255),
    ip_address      VARCHAR(50),
    user_agent      VARCHAR(500),
    request_id      VARCHAR(64),
    metadata        JSONB        NOT NULL DEFAULT '{}',
    severity        VARCHAR(20)  NOT NULL DEFAULT 'info',  -- info|warn|critical
    created_at      TIMESTAMP WITH TIME ZONE  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_log_user      ON audit_log(user_id);
CREATE INDEX idx_audit_log_org       ON audit_log(org_id);
CREATE INDEX idx_audit_log_action    ON audit_log(action);
CREATE INDEX idx_audit_log_created   ON audit_log(created_at DESC);

-- ── User Sessions (6.5) ────────────────────────────────────────────────────
CREATE TABLE user_sessions (
    id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id         UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_token   VARCHAR(255) NOT NULL UNIQUE,
    device_info     VARCHAR(500),
    ip_address      VARCHAR(50),
    user_agent      VARCHAR(500),
    last_active_at  TIMESTAMP WITH TIME ZONE  NOT NULL DEFAULT NOW(),
    expires_at      TIMESTAMP WITH TIME ZONE  NOT NULL,
    revoked         BOOLEAN      NOT NULL DEFAULT false,
    revoked_at      TIMESTAMP WITH TIME ZONE,
    created_at      TIMESTAMP WITH TIME ZONE  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_user_sessions_user    ON user_sessions(user_id);
CREATE INDEX idx_user_sessions_token   ON user_sessions(session_token);
CREATE INDEX idx_user_sessions_expires ON user_sessions(expires_at);

-- ── AI Token Usage (6.4) ───────────────────────────────────────────────────
CREATE TABLE ai_token_usage (
    id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id         UUID         REFERENCES users(id),
    feature         VARCHAR(100) NOT NULL,  -- skill name or feature key
    model           VARCHAR(100) NOT NULL,
    input_tokens    INT          NOT NULL DEFAULT 0,
    output_tokens   INT          NOT NULL DEFAULT 0,
    total_tokens    INT          NOT NULL DEFAULT 0,
    cost_usd        NUMERIC(10,6) NOT NULL DEFAULT 0,
    request_id      VARCHAR(64),
    created_at      TIMESTAMP WITH TIME ZONE  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ai_token_usage_user    ON ai_token_usage(user_id);
CREATE INDEX idx_ai_token_usage_feature ON ai_token_usage(feature);
CREATE INDEX idx_ai_token_usage_created ON ai_token_usage(created_at DESC);

-- ── Recommendation Feedback (6.2) ─────────────────────────────────────────
CREATE TABLE recommendation_feedback (
    id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id         UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    user_job_id     UUID         REFERENCES user_jobs(id) ON DELETE SET NULL,
    feedback_type   VARCHAR(30)  NOT NULL,  -- useful|not_useful|hide_similar
    reason          VARCHAR(100),
    created_at      TIMESTAMP WITH TIME ZONE  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_rec_feedback_user ON recommendation_feedback(user_id);

-- ── User Engagement Signals (6.2) ─────────────────────────────────────────
CREATE TABLE user_engagement_signals (
    id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id         UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    user_job_id     UUID         REFERENCES user_jobs(id) ON DELETE SET NULL,
    signal_type     VARCHAR(50)  NOT NULL,  -- view|click|apply|skip|save|skill_run
    dwell_ms        INT,
    created_at      TIMESTAMP WITH TIME ZONE  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_eng_signals_user ON user_engagement_signals(user_id);
CREATE INDEX idx_eng_signals_type ON user_engagement_signals(signal_type);

-- ── DLQ for background jobs (6.3) ─────────────────────────────────────────
CREATE TABLE dead_letter_queue (
    id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    job_type        VARCHAR(100) NOT NULL,
    payload         JSONB        NOT NULL,
    error_message   TEXT,
    attempts        INT          NOT NULL DEFAULT 0,
    max_attempts    INT          NOT NULL DEFAULT 3,
    status          VARCHAR(30)  NOT NULL DEFAULT 'pending', -- pending|retrying|dead
    next_retry_at   TIMESTAMP WITH TIME ZONE,
    created_at      TIMESTAMP WITH TIME ZONE  NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP WITH TIME ZONE  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_dlq_status     ON dead_letter_queue(status);
CREATE INDEX idx_dlq_next_retry ON dead_letter_queue(next_retry_at);

-- ── Login Anomaly Signals (6.5) ────────────────────────────────────────────
CREATE TABLE login_anomalies (
    id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id         UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    anomaly_type    VARCHAR(50)  NOT NULL,  -- new_location|new_device|brute_force|suspicious_ua
    ip_address      VARCHAR(50),
    user_agent      VARCHAR(500),
    risk_score      SMALLINT     NOT NULL DEFAULT 0,
    resolved        BOOLEAN      NOT NULL DEFAULT false,
    created_at      TIMESTAMP WITH TIME ZONE  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_login_anomalies_user ON login_anomalies(user_id);

