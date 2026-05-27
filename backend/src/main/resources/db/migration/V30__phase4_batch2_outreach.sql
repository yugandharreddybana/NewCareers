-- ─────────────────────────────────────────────────────────────────────────────
-- Phase 4 Batch 2 — 4.4 Multi-Channel Outreach Automation
-- Tasks 51–66
-- ─────────────────────────────────────────────────────────────────────────────

-- 4.4 Task 51 — outreach_campaigns
CREATE TABLE IF NOT EXISTS outreach_campaigns (
  id               UUID         DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id          UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name             VARCHAR(255) NOT NULL,
  campaign_type    VARCHAR(50)  NOT NULL DEFAULT 'recruiter_outreach'
                   CHECK (campaign_type IN ('recruiter_outreach','alumni_outreach','referral_request','follow_up')),
  status           VARCHAR(20)  NOT NULL DEFAULT 'draft'
                   CHECK (status IN ('draft','active','paused','completed')),
  target_count     INTEGER      NOT NULL DEFAULT 0,
  sent_count       INTEGER      NOT NULL DEFAULT 0,
  replied_count    INTEGER      NOT NULL DEFAULT 0,
  positive_count   INTEGER      NOT NULL DEFAULT 0,
  created_at       TIMESTAMP WITH TIME ZONE  NOT NULL DEFAULT now(),
  updated_at       TIMESTAMP WITH TIME ZONE  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_campaigns_user ON outreach_campaigns(user_id);

-- 4.4 Task 52 — outreach_sequences (steps in a campaign)
CREATE TABLE IF NOT EXISTS outreach_sequences (
  id               UUID         DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id      UUID         NOT NULL REFERENCES outreach_campaigns(id) ON DELETE CASCADE,
  user_id          UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  step_number      SMALLINT     NOT NULL,
  delay_days       SMALLINT     NOT NULL DEFAULT 0,
  subject_template TEXT,
  body_template    TEXT         NOT NULL,
  channel          VARCHAR(30)  NOT NULL DEFAULT 'linkedin'
                   CHECK (channel IN ('linkedin','email','other')),
  created_at       TIMESTAMP WITH TIME ZONE  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sequences_campaign ON outreach_sequences(campaign_id);

-- 4.4 Task 53 — outreach_messages (per-contact message instances)
CREATE TABLE IF NOT EXISTS outreach_messages (
  id               UUID         DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id      UUID         NOT NULL REFERENCES outreach_campaigns(id) ON DELETE CASCADE,
  sequence_id      UUID         REFERENCES outreach_sequences(id) ON DELETE SET NULL,
  user_id          UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  contact_name     VARCHAR(255),
  contact_email    VARCHAR(255),
  contact_linkedin VARCHAR(500),
  personalised_body TEXT        NOT NULL,
  status           VARCHAR(20)  NOT NULL DEFAULT 'draft'
                   CHECK (status IN ('draft','scheduled','sent','opened','replied','bounced')),
  sent_at          TIMESTAMP WITH TIME ZONE,
  replied_at       TIMESTAMP WITH TIME ZONE,
  score            SMALLINT,
  created_at       TIMESTAMP WITH TIME ZONE  NOT NULL DEFAULT now(),
  updated_at       TIMESTAMP WITH TIME ZONE  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_messages_campaign ON outreach_messages(campaign_id);
CREATE INDEX IF NOT EXISTS idx_messages_user     ON outreach_messages(user_id);
