-- ─────────────────────────────────────────────────────────────────────────────
-- Phase 4 gap-fill: unsubscribe flag on outreach_messages
-- ─────────────────────────────────────────────────────────────────────────────
SET search_path TO careerops;

ALTER TABLE outreach_messages ADD COLUMN IF NOT EXISTS unsubscribed BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE outreach_messages ADD COLUMN IF NOT EXISTS send_time_hint VARCHAR(50);
