-- ─────────────────────────────────────────────────────────────────────────────
-- Phase 4 gap-fill: unsubscribe flag on outreach_messages
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE outreach_messages
  ADD COLUMN IF NOT EXISTS unsubscribed     BOOLEAN     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS send_time_hint   VARCHAR(50);   -- e.g. 'Tuesday 10:00'
